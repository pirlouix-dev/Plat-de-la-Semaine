using DotNetEnv;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Services;

// ── Environment ───────────────────────────────────────────────────
// Load .env before the builder so its values feed configuration and can
// select the environment. NoClobber keeps real host variables authoritative.
Env.TraversePath().NoClobber().Load();

var builder = WebApplication.CreateBuilder(args);

// ── Configuration ─────────────────────────────────────────────────
builder.Services.AddAppSettings();

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddControllers();
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

app.UseMiddleware<ErrorHandlingMiddleware>();
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
