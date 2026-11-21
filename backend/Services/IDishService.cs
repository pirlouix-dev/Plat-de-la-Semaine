using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for dish-related business logic.
/// </summary>
public interface IDishService
{
    /// <summary>
    /// Fetches all dishes for a user, optionally filtered by a minimum UpdatedAt timestamp.
    /// </summary>
    Task<DishListResponse> GetAllDishesAsync(string userId, DateTimeOffset? since);

    /// <summary>
    /// Creates a new dish after validation and backup.
    /// </summary>
    Task<DishSingleResponse> CreateDishAsync(string userId, CreateDishPayload payload);

    /// <summary>
    /// Updates an existing dish with partial field merge.
    /// </summary>
    Task<DishSingleResponse> UpdateDishAsync(string userId, string dishId, UpdateDishPayload payload);

    /// <summary>
    /// Deletes a dish.
    /// </summary>
    Task DeleteDishAsync(string userId, string dishId);

    /// <summary>
    /// Applies create, update, and delete operations in order, reporting an
    /// outcome for each one. A failing operation does not reject the others.
    /// </summary>
    Task<DishBatchResponse> ApplyDishBatchAsync(string userId, List<DishBatchOperation> operations);

    /// <summary>
    /// Creates a backup of the user's current dishes and manages the max backup limit.
    /// </summary>
    Task CreateBackupAsync(string userId);
}
