using System.Text.Json.Serialization;
using Google.Cloud.Firestore;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Request payload for creating a new dish.
/// </summary>
public class CreateDishPayload
{
    public required string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public required int Course { get; set; }
    public required int[] Seasons { get; set; } = Array.Empty<int>();
}

/// <summary>
/// Request payload for updating an existing dish.
/// </summary>
public class UpdateDishPayload
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public int? Course { get; set; }
    public int[]? Seasons { get; set; }
}

/// <summary>
/// Response containing a list of dishes.
/// </summary>
public class DishListResponse
{
    public required List<Dish> Data { get; set; } = new();
    public required int Total { get; set; }
}

/// <summary>
/// Response containing a single dish.
/// </summary>
public class DishSingleResponse
{
    public required Dish Data { get; set; } = new();
}

/// <summary>
/// Backup summary information.
/// </summary>
public class BackupSummary
{
    public required string Id { get; set; } = string.Empty;
    public required DateTimeOffset CreatedAt { get; set; }
    public required int DishCount { get; set; }
}

/// <summary>
/// Full backup stored in Firestore.
/// </summary>
[FirestoreData]
public class Backup
{
    [FirestoreDocumentId]
    public string? Id { get; set; }

    [FirestoreProperty]
    public string UserId { get; set; } = string.Empty;

    [FirestoreProperty]
    public DateTimeOffset CreatedAt { get; set; }

    [FirestoreProperty]
    public List<Dish> Dishes { get; set; } = new();
}

/// <summary>
/// Response containing a list of backups.
/// </summary>
public class BackupListResponse
{
    public required List<BackupSummary> Data { get; set; } = new();
    public required int Total { get; set; }
}

/// <summary>
/// Response from restoring a backup.
/// </summary>
public class RestoreBackupResponse
{
    public required string BackupId { get; set; } = string.Empty;
    public required int RestoredCount { get; set; }
    public required DateTimeOffset SafetyBackupCreatedAt { get; set; }
}

/// <summary>
/// Response containing restore backup result.
/// </summary>
public class BackupRestoreResponse
{
    public required RestoreBackupResponse Data { get; set; }
}

/// <summary>
/// Version information response.
/// </summary>
public class VersionInfo
{
    public required string LatestVersion { get; set; } = string.Empty;
    public required string Description { get; set; } = string.Empty;
    public required string DownloadUrl { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for submitting feedback.
/// </summary>
public class FeedbackPayload
{
    public required string Message { get; set; } = string.Empty;
    public required string AppVersion { get; set; } = string.Empty;
}

/// <summary>
/// Result of a feedback submission attempt.
/// </summary>
public class FeedbackResult
{
    public required bool Success { get; set; }
    public string? ErrorCode { get; set; }
    public string? ErrorMessage { get; set; }
}
