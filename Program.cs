using DotNetEnv;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Services;

var builder = WebApplication.CreateBuilder(args);

// ── Services ──────────────────────────────────────────────────────
builder.Services.AddControllers();
builder.Services.AddOpenApi();
builder.Services.AddCors();

// Register application services
builder.Services.AddSingleton<ISupabaseService, SupabaseService>();
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
try
{
    Env.Load();

    var supabaseService = app.Services.GetRequiredService<ISupabaseService>();
    var initialized = await supabaseService.InitializeAsync();

    if (initialized)
    {
        var users = await supabaseService.GetAllUsersAsync();
        Console.WriteLine($"{users.Count} users retrieved from Supabase.");

        var dishes = await supabaseService.GetAllDishesAsync();
        Console.WriteLine($"{dishes.Count} dishes retrieved from Supabase.");

        // Insert seed data for development/testing
        var dishService = app.Services.GetRequiredService<IDishService>();
        await dishService.InsertSeedDishAsync();
    }
}
catch (Exception ex)
{
    Console.WriteLine($"Startup warning: {ex.Message}");
}

app.Run();
