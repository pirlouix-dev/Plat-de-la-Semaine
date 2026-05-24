using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using DotNetEnv;

[Table("Dishes")]
class Dishes : BaseModel
{
    [PrimaryKey("id")]
    public Guid? id { get; set; }
    [Column("version")]
    public int version { get; set; } = 0;
    [Column("user_id")]
    public Guid user_id { get; set; }
    [Column("name")] public string name { get; set; } = String.Empty;
    [Column("description")]
    public string description { get; set; } = String.Empty;
    [Column("course")]
    public long course { get; set; }
    [Column("seasons")]
    public int[] seasons { get; set; } = Array.Empty<int>();
    [Column("updated_at")]
    public DateTimeOffset updated_at { get; set; }
    [Column("is_deleted")]
    public bool is_deleted { get; set; }

}

[Table("Users")]
class Users : BaseModel
{
    [PrimaryKey("id")]
    public Guid? id { get; set; }
    public DateTimeOffset created_at { get; set; }
}

class Program
{
    static async Task Main(string[] args)
    {
        var builder = WebApplication.CreateBuilder(args);

        builder.Services.AddCors();

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

        app.UseCors(policy => policy
            .AllowAnyOrigin()
            .AllowAnyMethod()
            .AllowAnyHeader());

        app.MapGet("/api/hello", () => new { message = "Hello World!" });

        var userResult = await supabase.From<Users>().Get();
        Console.WriteLine(userResult.Models.Count + " users retrieved from Supabase.");

        var dishResult = await supabase.From<Dishes>().Get();
        Console.WriteLine(dishResult.Models.Count + " dishes retrieved from Supabase.");

        var user = new Users
        {
            id = Guid.NewGuid(),
            created_at = DateTimeOffset.UtcNow
        };

        await supabase.From<Users>().Insert(user);

        var dish = new Dishes
        {
            id = Guid.NewGuid(),
            version = 0,
            user_id = Guid.Parse("249b35c6-83af-491e-bc1f-15e128b38630"),
            name = "Spaghetti Carbonara",
            description = "A classic Italian pasta dish made with eggs, cheese, pancetta, and pepper.",
            course = 1,
            seasons = [1, 2],
            updated_at = DateTimeOffset.UtcNow,
            is_deleted = false
        };

        await supabase.From<Dishes>().Insert(dish);

        app.Run();
    }
}
