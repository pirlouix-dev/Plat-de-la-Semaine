using DotNetEnv;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors();

// Register application services
builder.Services.AddSingleton<IFirestoreService, FirestoreService>();
builder.Services.AddScoped<IDishService, DishService>();
builder.Services.AddScoped<IBackupService, BackupService>();
builder.Services.AddHttpClient<IFeedbackService, FeedbackService>();
builder.Services.AddScoped<IVersionService, VersionService>();

// ── App Pipeline ──────────────────────────────────────────────────
var app = builder.Build();

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseCors(policy => policy
    .AllowAnyOrigin()
    .AllowAnyMethod()
    .AllowAnyHeader());

app.MapControllers();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// ── Startup Initialization ────────────────────────────────────────
Env.Load();

var firestoreService = app.Services.GetRequiredService<IFirestoreService>();
await firestoreService.InitializeAsync();

app.Run();
