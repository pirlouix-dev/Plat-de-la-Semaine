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
    /// Retrieves all dishes for a given user, optionally filtered by a minimum UpdatedAt timestamp.
    /// </summary>
    Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since);

    /// <summary>
    /// Retrieves a single dish by its ID within the given user's namespace.
    /// Returns null when the dish does not exist for that user.
    /// </summary>
    Task<Dish?> GetDishByIdAsync(string userId, string dishId);

    /// <summary>
    /// Inserts a new dish into Firestore, under its owner's namespace.
    /// </summary>
    Task<Dish> InsertDishAsync(Dish dish);

    /// <summary>
    /// Updates an existing dish document, under its owner's namespace.
    /// </summary>
    Task UpdateDishAsync(Dish dish);

    /// <summary>
    /// Hard-deletes a dish document from the given user's namespace.
    /// </summary>
    Task DeleteDishAsync(string userId, string dishId);

    // ── Menu ────────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves the given user's saved menu.
    /// Returns null when the user has never saved one.
    /// </summary>
    Task<Menu?> GetMenuAsync(string userId);

    /// <summary>
    /// Atomically saves the given user's menu only when its current version
    /// matches <paramref name="expectedUpdatedAt"/>.
    /// A null expectation means no menu record may exist yet.
    /// Returns the stored menu on success, or null when the version did not
    /// match and nothing was written.
    /// </summary>
    Task<Menu?> TrySaveMenuAsync(
        string userId,
        IReadOnlyList<string> selectedDishIds,
        DateTimeOffset? expectedUpdatedAt);

    // ── Users ───────────────────────────────────────────────────────

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

    /// <summary>
    /// Hard-deletes a user document from Firestore.
    /// </summary>
    Task DeleteUserAsync(string userId);

    // ── Backups ─────────────────────────────────────────────────────

    /// <summary>
    /// Retrieves a single backup by its ID within the given user's namespace.
    /// Returns null when the backup does not exist for that user.
    /// </summary>
    Task<Backup?> GetBackupByIdAsync(string userId, string backupId);

    /// <summary>
    /// Inserts a new backup document into Firestore, under its owner's namespace.
    /// </summary>
    Task<Backup> InsertBackupAsync(Backup backup);

    /// <summary>
    /// Hard-deletes a backup document from the given user's namespace.
    /// </summary>
    Task DeleteBackupAsync(string userId, string backupId);

    /// <summary>
    /// Retrieves all backups for a given user.
    /// </summary>
    Task<List<Backup>> GetBackupsByUserIdAsync(string userId);

    /// <summary>
    /// Deletes multiple documents from a user's subcollection in a single batch.
    /// </summary>
    Task DeleteBatchAsync(string userId, string collection, IEnumerable<string> ids);

    // ── Config ──────────────────────────────────────────────────────

    /// <summary>
    /// Reads the version info from the Config/version document.
    /// </summary>
    Task<VersionInfo?> GetVersionInfoAsync();
}
