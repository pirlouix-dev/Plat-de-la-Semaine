using DotNetEnv;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

// ── Environment ───────────────────────────────────────────────────
// Load .env before the builder so its values feed configuration and can
// select the environment. NoClobber keeps real host variables authoritative.
Env.TraversePath().NoClobber().Load();

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ─────────────────────────────────────────────────
builder.Services.AddAppSettings();

// Feeds the host filtering middleware, which reads the AllowedHosts key.
var allowedHosts = HostSettings.ResolveAllowedHosts();
if (allowedHosts is not null)
{
    builder.Configuration.AddInMemoryCollection(
        new Dictionary<string, string?> { ["AllowedHosts"] = allowedHosts });
}

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddControllers().ConfigureApiBehaviorOptions(options =>
{
    // Model-binding failures (including a missing required expectedUpdatedAt)
    // use the same structured error shape as the rest of the API.
    options.InvalidModelStateResponseFactory = context =>
    {
        var details = context.ModelState
            .Where(entry => entry.Value?.Errors.Count > 0)
            .SelectMany(entry => entry.Value!.Errors.Select(error => new ApiFieldError
            {
                Field = entry.Key,
                Message = string.IsNullOrWhiteSpace(error.ErrorMessage)
                    ? "Invalid value."
                    : error.ErrorMessage
            }))
            .ToList();

        return new BadRequestObjectResult(new ApiErrorDetail
        {
            Code = ApiErrorCodes.ValidationError,
            Message = "The request is invalid.",
            Details = details
        });
    };
});
builder.Services.AddOpenApi();

var allowedOrigins = CorsSettings.ResolveAllowedOrigins();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy =>
{
    if (allowedOrigins.Length > 0)
    {
        policy.WithOrigins(allowedOrigins)
            .AllowAnyMethod()
            .AllowAnyHeader();
    }
}));

// Register application services
builder.Services.AddSingleton<ITokenVerifier, FirebaseTokenVerifier>();
builder.Services.AddSingleton<IFirestoreService, FirestoreService>();
builder.Services.AddScoped<IDishService, DishService>();
builder.Services.AddScoped<IMenuService, MenuService>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddHttpClient<IFeedbackService, FeedbackService>();
builder.Services.AddHttpClient<IAuthService, AuthService>();
builder.Services.AddScoped<IVersionService, VersionService>();

// ── App Pipeline ──────────────────────────────────────────────────
var app = builder.Build();

if (allowedOrigins.Length == 0)
{
    app.Logger.LogWarning(
        "No CORS origins configured. Cross-origin browser requests will be rejected. " +
        "Set CORS_ALLOWED_ORIGINS or Cors:AllowedOrigins.");
}

if (!app.Environment.IsDevelopment() && builder.Configuration["AllowedHosts"] == HostSettings.Wildcard)
{
    app.Logger.LogWarning(
        "AllowedHosts is '*': any Host header is accepted. " +
        "Set ALLOWED_HOSTS to the hostname(s) clients use.");
}

app.UseMiddleware<ErrorHandlingMiddleware>();

// ── HTTPS enforcement ─────────────────────────────────────────────
// Skipped in Development: the `http` launch profile binds no HTTPS port, so
// redirection would send the developer to a port nothing is listening on.
if (!app.Environment.IsDevelopment())
{
    var forwardedHeaders = new ForwardedHeadersOptions
    {
        ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto,
    };

    // Only loopback proxies are trusted by default. The reverse proxy in front
    // of the application is not on loopback, so X-Forwarded-Proto would be
    // ignored and UseHttpsRedirection would redirect every request forever.
    forwardedHeaders.KnownIPNetworks.Clear();
    forwardedHeaders.KnownProxies.Clear();

    app.UseForwardedHeaders(forwardedHeaders);

    if (HttpsSettings.HstsEnabled)
    {
        app.UseHsts();
    }

    if (HttpsSettings.RedirectEnabled)
    {
        app.UseHttpsRedirection();
    }
}

app.UseCors();

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ── Startup Initialization ────────────────────────────────────────
var firestoreService = app.Services.GetRequiredService<IFirestoreService>();
await firestoreService.InitializeAsync();

app.Run();

/// <summary>
/// Exposed so the integration tests can boot the real application pipeline.
/// </summary>
public partial class Program;
