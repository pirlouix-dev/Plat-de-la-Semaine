using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for Firestore database operations.
/// </summary>
public interface IFirestoreService
{
    /// <summary>
    /// Initializes the Firestore client.
    /// </summary>
    Task<bool> InitializeAsync();

    /// <summary>
    /// Checks whether the Firestore client is initialized and connected.
    /// </summary>
    bool IsConnected { get; }

    // ── Dishes ──────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves all dishes from Firestore (used by status endpoint).
    /// </summary>
    Task<List<Dish>> GetAllDishesAsync();

    /// <summary>
    /// Retrieves all dishes for a given user, optionally filtered by a minimum UpdatedAt timestamp.
    /// </summary>
    Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since);

    /// <summary>
    /// Retrieves a single dish by its ID.
    /// </summary>
    Task<Dish?> GetDishByIdAsync(string dishId);

    /// <summary>
    /// Inserts a new dish into Firestore.
    /// </summary>
    Task<Dish> InsertDishAsync(Dish dish);

    /// <summary>
    /// Updates an existing dish document.
    /// </summary>
    Task UpdateDishAsync(Dish dish);

    /// <summary>
    /// Hard-deletes a dish document from Firestore.
    /// </summary>
    Task DeleteDishAsync(string dishId);

    // ── Users ───────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves all users from Firestore (used by status endpoint).
    /// </summary>
    Task<List<User>> GetAllUsersAsync();

    /// <summary>
    /// Retrieves a user by their ID.
    /// </summary>
    Task<User?> GetUserByIdAsync(string userId);

    /// <summary>
    /// Inserts a new user with a specific ID.
    /// </summary>
    Task<User> InsertUserAsync(User user, string id);

    /// <summary>
    /// Updates an existing user document.
    /// </summary>
    Task UpdateUserAsync(User user);

    // ── Backups ─────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves a single backup by its ID.
    /// </summary>
    Task<Backup?> GetBackupByIdAsync(string backupId);

    /// <summary>
    /// Inserts a new backup document into Firestore.
    /// </summary>
    Task<Backup> InsertBackupAsync(Backup backup);

    /// <summary>
    /// Hard-deletes a backup document from Firestore.
    /// </summary>
    Task DeleteBackupAsync(string backupId);

    // ── Config ──────────────────────────────────────────────────────

    /// <summary>
    /// Reads the version info from the Config/version document.
    /// </summary>
    Task<VersionInfo?> GetVersionInfoAsync();
}
