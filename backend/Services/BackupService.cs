using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling backup-related business logic.
/// </summary>
public class BackupService : IBackupService
{
    private readonly IFirestoreService _firestore;
    private readonly IDishService _dishService;

    public BackupService(IFirestoreService firestore, IDishService dishService)
    {
        _firestore = firestore;
        _dishService = dishService;
    }

    /// <inheritdoc />
    public async Task<BackupListResponse> GetAllBackupsAsync(string userId)
    {
        var user = await _firestore.GetUserByIdAsync(userId);
        if (user == null)
        {
            return new BackupListResponse
            {
                Data = new List<BackupSummary>(),
                Total = 0
            };
        }

        var summaries = new List<BackupSummary>();

        foreach (var backupId in user.BackupIds)
        {
            var backup = await _firestore.GetBackupByIdAsync(userId, backupId);
            if (backup != null)
            {
                summaries.Add(new BackupSummary
                {
                    Id = backup.Id!,
                    CreatedAt = backup.CreatedAt,
                    DishCount = backup.Dishes.Count
                });
            }
        }

        summaries.Sort((a, b) => b.CreatedAt.CompareTo(a.CreatedAt));

        return new BackupListResponse
        {
            Data = summaries,
            Total = summaries.Count
        };
    }

    /// <inheritdoc />
    public async Task<BackupRestoreResponse> RestoreBackupAsync(string userId, string backupId)
    {
        var backup = await _firestore.GetBackupByIdAsync(userId, backupId)
            ?? throw new KeyNotFoundException("Backup not found.");

        await _dishService.CreateBackupAsync(userId);
        var safetyBackupCreatedAt = DateTimeOffset.UtcNow;

        var currentDishes = await _firestore.GetDishesByUserIdAsync(userId, null);
        var currentById = currentDishes
            .Where(dish => dish.Id != null)
            .ToDictionary(dish => dish.Id!, StringComparer.Ordinal);

        // Every dish touched by the restore gets a fresh timestamp so an
        // incremental ?since= pull observes both the updates and the deletions.
        var restoredAt = DateTimeOffset.UtcNow;
        var restoredCount = 0;

        foreach (var backupDish in backup.Dishes)
        {
            var dish = backupDish.ToDish(userId, restoredAt);

            if (dish.Id != null && currentById.Remove(dish.Id))
            {
                // The document still exists: overwrite it in place so its id,
                // and therefore any client copy, stays valid.
                await _firestore.UpdateDishAsync(dish);
            }
            else
            {
                // Either a new dish or one whose id no longer exists. Reusing the
                // persisted id (when there is one) keeps client references stable.
                await _firestore.InsertDishAsync(dish);
            }

            restoredCount++;
        }

        // Anything live that is absent from the backup must disappear, but a
        // hard delete leaves no trace for incremental sync. Tombstone it instead.
        foreach (var dish in currentById.Values)
        {
            if (dish.IsDeleted)
                continue;

            dish.IsDeleted = true;
            dish.UpdatedAt = restoredAt;
            await _firestore.UpdateDishAsync(dish);
        }

        return new BackupRestoreResponse
        {
            Data = new RestoreBackupResponse
            {
                BackupId = backupId,
                RestoredCount = restoredCount,
                SafetyBackupCreatedAt = safetyBackupCreatedAt
            }
        };
    }
}
