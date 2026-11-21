using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for backup-related business logic.
/// </summary>
public interface IBackupService
{
    /// <summary>
    /// Fetches all backups for a user (max 5, newest first).
    /// </summary>
    Task<BackupListResponse> GetAllBackupsAsync(string userId);

    /// <summary>
    /// Restores the dish list from a specific backup, creating a safety snapshot first.
    /// </summary>
    Task<BackupRestoreResponse> RestoreBackupAsync(string userId, string backupId);
}
