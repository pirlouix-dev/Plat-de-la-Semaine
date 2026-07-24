using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling dish-specific business logic.
/// </summary>
public class DishService : IDishService
{
    private readonly IFirestoreService _firestore;
    private const int MaxBackups = 5;

    public DishService(IFirestoreService firestore)
    {
        _firestore = firestore;
    }

    /// <inheritdoc />
    public async Task<DishListResponse> GetAllDishesAsync(string userId)
    {
        var dishes = await _firestore.GetDishesByUserIdAsync(userId);
        return new DishListResponse
        {
            Data = dishes,
            Total = dishes.Count
        };
    }

    /// <inheritdoc />
    public async Task<DishSingleResponse> CreateDishAsync(string userId, CreateDishPayload payload)
    {
        await CreateBackupAsync(userId);

        var dish = new Dish
        {
            UserId = userId,
            Name = payload.Name,
            Description = payload.Description,
            Course = payload.Course,
            Seasons = payload.Seasons,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var created = await _firestore.InsertDishAsync(dish);

        return new DishSingleResponse
        {
            Data = created
        };
    }

    /// <inheritdoc />
    public async Task<DishSingleResponse> UpdateDishAsync(string userId, string dishId, UpdateDishPayload payload)
    {
        var existing = await _firestore.GetDishByIdAsync(dishId)
            ?? throw new KeyNotFoundException("Dish not found.");

        if (existing.UserId != userId)
            throw new UnauthorizedAccessException("You do not own this dish.");

        await CreateBackupAsync(userId);

        if (payload.Name != null) existing.Name = payload.Name;
        if (payload.Description != null) existing.Description = payload.Description;
        if (payload.Course != null) existing.Course = payload.Course.Value;
        if (payload.Seasons != null) existing.Seasons = payload.Seasons;
        existing.UpdatedAt = DateTimeOffset.UtcNow;

        await _firestore.UpdateDishAsync(existing);

        return new DishSingleResponse
        {
            Data = existing
        };
    }

    /// <inheritdoc />
    public async Task DeleteDishAsync(string userId, string dishId)
    {
        var existing = await _firestore.GetDishByIdAsync(dishId)
            ?? throw new KeyNotFoundException("Dish not found.");

        if (existing.UserId != userId)
            throw new UnauthorizedAccessException("You do not own this dish.");

        await CreateBackupAsync(userId);

        await _firestore.DeleteDishAsync(dishId);
    }

    /// <summary>
    /// Creates a backup of the user's current dishes and manages the max backup limit.
    /// </summary>
    public async Task CreateBackupAsync(string userId)
    {
        var currentDishes = await _firestore.GetDishesByUserIdAsync(userId);

        var backup = new Backup
        {
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = currentDishes
        };

        var createdBackup = await _firestore.InsertBackupAsync(backup);

        var user = await _firestore.GetUserByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.BackupIds.Add(createdBackup.Id!);

        if (user.BackupIds.Count > MaxBackups)
        {
            var oldestId = user.BackupIds[0];
            await _firestore.DeleteBackupAsync(oldestId);
            user.BackupIds.RemoveAt(0);
        }

        await _firestore.UpdateUserAsync(user);
    }
}
