using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for Firestore database operations.
/// </summary>
public interface IFirestoreService
{
    /// <summary>
    /// Retrieves all dishes from Firestore.
    /// </summary>
    Task<List<Dish>> GetAllDishesAsync();

    /// <summary>
    /// Retrieves all users from Firestore.
    /// </summary>
    Task<List<User>> GetAllUsersAsync();

    /// <summary>
    /// Inserts a new user into Firestore.
    /// </summary>
    Task<User> InsertUserAsync(User user);

    /// <summary>
    /// Inserts a new dish into Firestore.
    /// </summary>
    Task<Dish> InsertDishAsync(Dish dish);

    /// <summary>
    /// Initializes the Firestore client.
    /// </summary>
    Task<bool> InitializeAsync();

    /// <summary>
    /// Checks whether the Firestore client is initialized and connected.
    /// </summary>
    bool IsConnected { get; }
}
