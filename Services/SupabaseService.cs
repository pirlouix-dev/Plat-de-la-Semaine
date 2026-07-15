using PlatDeLaSemaineBack.Models;
using Supabase;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling Supabase database initialization and CRUD operations.
/// </summary>
public class SupabaseService : ISupabaseService
{
    private Client? _client;
    private bool _initialized;

    /// <inheritdoc />
    public bool IsConnected => _initialized && _client != null;

    /// <summary>
    /// Initializes the Supabase client using environment variables.
    /// Returns true if initialization succeeded, false otherwise.
    /// </summary>
    public async Task<bool> InitializeAsync()
    {
        try
        {
            var url = Environment.GetEnvironmentVariable("SUPABASE_URL");
            var key = Environment.GetEnvironmentVariable("SUPABASE_KEY");

            if (string.IsNullOrEmpty(url) || string.IsNullOrEmpty(key))
            {
                Console.WriteLine("Supabase warning: SUPABASE_URL or SUPABASE_KEY not set.");
                return false;
            }

            var options = new SupabaseOptions
            {
                AutoConnectRealtime = true
            };

            _client = new Client(url, key, options);
            await _client.InitializeAsync();
            _initialized = true;
            Console.WriteLine("Supabase client initialized successfully.");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Supabase initialization warning: {ex.Message}");
            _initialized = false;
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<List<Dish>> GetAllDishesAsync()
    {
        if (!IsConnected) return new List<Dish>();
        var result = await _client!.From<Dish>().Get();
        return result.Models;
    }

    /// <inheritdoc />
    public async Task<List<User>> GetAllUsersAsync()
    {
        if (!IsConnected) return new List<User>();
        var result = await _client!.From<User>().Get();
        return result.Models;
    }

    /// <inheritdoc />
    public async Task<User> InsertUserAsync(User user)
    {
        if (!IsConnected) throw new InvalidOperationException("Supabase client is not initialized.");
        var result = await _client!.From<User>().Insert(user);
        return result.Model!;
    }

    /// <inheritdoc />
    public async Task<Dish> InsertDishAsync(Dish dish)
    {
        if (!IsConnected) throw new InvalidOperationException("Supabase client is not initialized.");
        var result = await _client!.From<Dish>().Insert(dish);
        return result.Model!;
    }
}
