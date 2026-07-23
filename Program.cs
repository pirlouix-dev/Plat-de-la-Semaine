using DotNetEnv;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors();

// Register application services
builder.Services.AddSingleton<IFirestoreService, FirestoreService>();
builder.Services.AddScoped<IDishService, DishService>();

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
var initialized = await firestoreService.InitializeAsync();

if (initialized)
{
    var insertedUser = await firestoreService.InsertUserAsync(new User { CreatedAt = DateTimeOffset.UtcNow });

    var insertedDish = await firestoreService.InsertDishAsync(new Dish
    {
        Name = "Sample Dish",
        Description = "This is a sample dish.",
        Course = 1,
        Seasons = [1, 2],
        UpdatedAt = DateTimeOffset.UtcNow,
        IsDeleted = false
    });

    var users = await firestoreService.GetAllUsersAsync();
    Console.WriteLine($"{users.Count} users retrieved from Firestore.");

    var dishes = await firestoreService.GetAllDishesAsync();
    Console.WriteLine($"{dishes.Count} dishes retrieved from Firestore.");
}



app.Run();
