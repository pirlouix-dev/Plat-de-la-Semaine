using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for Supabase database operations.
/// </summary>
public interface ISupabaseService
{
    /// <summary>
    /// Retrieves all dishes from the database.
    /// </summary>
    Task<List<Dish>> GetAllDishesAsync();

    /// <summary>
    /// Retrieves all users from the database.
    /// </summary>
    Task<List<User>> GetAllUsersAsync();

    /// <summary>
    /// Inserts a new user into the database.
    /// </summary>
    Task<User> InsertUserAsync(User user);

    /// <summary>
    /// Inserts a new dish into the database.
    /// </summary>
    Task<Dish> InsertDishAsync(Dish dish);

    /// <summary>
    /// Initializes the Supabase client.
    /// </summary>
    Task<bool> InitializeAsync();

    /// <summary>
    /// Checks whether the Supabase client is initialized and connected.
    /// </summary>
    bool IsConnected { get; }
}
