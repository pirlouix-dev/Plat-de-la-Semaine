using System.ComponentModel.DataAnnotations.Schema;
using Supabase.Postgrest.Models;
using DotNetEnv;

[Table("Dishes")]
class Dishes : BaseModel
{
    [Supabase.Postgrest.Attributes.PrimaryKey("id")]
    public string? Id { get; set; }
    [Column("version")]
    public string? Version { get; set; }
    [Column("user_id")]
    public int UserId { get; set; }
    [Column("name")] public string? Name { get; set; }
    [Column("description")]
    public string? Description { get; set; }
    [Column("course")]
    public int Course { get; set; }
    [Column("seasons")]
    public int[]? Seasons { get; set; }
    [Column("updated_at")]
    public int UpdatedAt { get; set; }

}

class Program
{
    static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        // 1. Configuration des services (l'équivalent de la boîte à outils du serveur)
        builder.Services.AddCors(); // Indispensable pour que ton React puisse lui parler plus tard !

        var app = builder.Build();

        Env.Load();
        var url = Environment.GetEnvironmentVariable("SUPABASE_URL") ?? throw new Exception("SUPABASE_URL is not set in the environment variables.");
        var key = Environment.GetEnvironmentVariable("SUPABASE_KEY") ?? throw new Exception("SUPABASE_KEY is not set in the environment variables.");

        var options = new Supabase.SupabaseOptions
        {
            AutoConnectRealtime = true
        };

        var supabase = new Supabase.Client(url, key, options);
        await supabase.InitializeAsync();

        // 2. Configuration du pipeline HTTP (la sécurité et les routes)
        app.UseCors(policy => policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());

        // Notre route Hello World !
        app.MapGet("/api/hello", () => new { message = "Hello World!" });

        var result = await supabase.From<Dishes>().Get();
        Console.WriteLine(result.Models);
        Console.WriteLine("Supabase client initialized and ready to use!");

        app.Run();
    }
}
