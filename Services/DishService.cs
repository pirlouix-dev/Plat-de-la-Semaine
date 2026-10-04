using System.ComponentModel.DataAnnotations;
using PlatDeLaSemaineBack.Exceptions;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling dish-specific business logic.
/// </summary>
public class DishService : IDishService
{
    private readonly IFirestoreService _firestore;
    private const int MaxBackups = 5;
    private const int MaxImportSize = 500;

    public DishService(IFirestoreService firestore)
    {
        _firestore = firestore;
    }

    /// <inheritdoc />
    public async Task<DishListResponse> GetAllDishesAsync(string userId, DateTimeOffset? since)
    {
        var dishes = await _firestore.GetDishesByUserIdAsync(userId, since);
        return new DishListResponse
        {
            Data = dishes,
            Total = dishes.Count
        };
    }

    /// <inheritdoc />
    public async Task<DishSingleResponse> CreateDishAsync(string userId, CreateDishPayload payload)
    {
        // A client may supply an id (e.g. for offline sync), but it must never be
        // allowed to take over a document owned by another user.
        if (payload.Id != null)
        {
            var existing = await _firestore.GetDishByIdAsync(payload.Id);
            if (existing != null && existing.UserId != userId)
                throw new ConflictException("A dish with this id already exists.");
        }

        await CreateBackupAsync(userId);

        var dish = new Dish
        {
            Id = payload.Id,
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

        existing.IsDeleted = true;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await _firestore.UpdateDishAsync(existing);
    }

    /// <inheritdoc />
    public async Task<DishImportResponse> ImportDishesAsync(string userId, List<DishImportItem> items)
    {
        if (items.Count > MaxImportSize)
            throw new ArgumentException($"A maximum of {MaxImportSize} dishes can be imported at once.");

        if (items.Count == 0)
            return new DishImportResponse { Imported = 0, Failed = 0, Errors = [] };

        await CreateBackupAsync(userId);

        var imported = 0;
        var errors = new List<DishImportError>();

        for (var index = 0; index < items.Count; index++)
        {
            var item = items[index];
            var validationResults = ValidateImportItem(item);

            if (validationResults.Count > 0)
            {
                errors.Add(new DishImportError
                {
                    Index = index,
                    Name = item.Name,
                    Errors = validationResults
                });
                continue;
            }

            try
            {
                await _firestore.InsertDishAsync(new Dish
                {
                    UserId = userId,
                    Name = item.Name!,
                    Description = item.Description ?? string.Empty,
                    Course = item.Course!.Value,
                    Seasons = item.Seasons!,
                    UpdatedAt = DateTimeOffset.UtcNow
                });

                imported++;
            }
            catch (Exception ex)
            {
                errors.Add(new DishImportError
                {
                    Index = index,
                    Name = item.Name,
                    Errors = [new ApiFieldError { Message = ex.Message }]
                });
            }
        }

        return new DishImportResponse
        {
            Imported = imported,
            Failed = errors.Count,
            Errors = errors
        };
    }

    /// <summary>
    /// Validates a single import item, reusing the create-dish rules.
    /// </summary>
    private static List<ApiFieldError> ValidateImportItem(DishImportItem item)
    {
        var payload = new CreateDishPayload
        {
            Name = item.Name ?? string.Empty,
            Description = item.Description ?? string.Empty,
            Course = item.Course ?? 0,
            Seasons = item.Seasons ?? Array.Empty<int>()
        };

        var results = new List<ValidationResult>();
        Validator.TryValidateObject(payload, new ValidationContext(payload), results, validateAllProperties: true);

        if (item.Course is null)
        {
            results.Add(new ValidationResult("Course is required.", [nameof(item.Course)]));
        }

        return results
            .Select(result => new ApiFieldError
            {
                Field = result.MemberNames.FirstOrDefault() ?? string.Empty,
                Message = result.ErrorMessage ?? "Invalid value."
            })
            .ToList();
    }

    /// <summary>
    /// Creates a backup of the user's current dishes and manages the max backup limit.
    /// </summary>
    public async Task CreateBackupAsync(string userId)
    {
        var currentDishes = await _firestore.GetDishesByUserIdAsync(userId, null);

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
