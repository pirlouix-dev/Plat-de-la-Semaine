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
            var backup = await _firestore.GetBackupByIdAsync(backupId);
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
        var backup = await _firestore.GetBackupByIdAsync(backupId)
            ?? throw new KeyNotFoundException("Backup not found.");

        if (backup.UserId != userId)
            throw new UnauthorizedAccessException("You do not own this backup.");

        await _dishService.CreateBackupAsync(userId);
        var safetyBackupCreatedAt = DateTimeOffset.UtcNow;

        var currentDishes = await _firestore.GetDishesByUserIdAsync(userId, null);
        foreach (var dish in currentDishes)
        {
            if (dish.Id != null)
                await _firestore.DeleteDishAsync(dish.Id);
        }

        var restoredCount = 0;
        foreach (var dish in backup.Dishes)
        {
            dish.Id = null;
            dish.UserId = userId;
            dish.UpdatedAt = DateTimeOffset.UtcNow;
            await _firestore.InsertDishAsync(dish);
            restoredCount++;
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
