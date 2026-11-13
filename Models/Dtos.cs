using System.ComponentModel.DataAnnotations;
using System.Text.Json.Serialization;
using Google.Cloud.Firestore;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Request payload for creating a new dish.
/// </summary>
public class CreateDishPayload : IValidatableObject
{
    public string? Id { get; set; }

    [Required]
    [StringLength(200, ErrorMessage = "Name must not exceed 200 characters.")]
    public required string Name { get; set; } = string.Empty;

    [StringLength(5000, ErrorMessage = "Description must not exceed 5000 characters.")]
    public string Description { get; set; } = string.Empty;

    [Range(0, 2, ErrorMessage = "Course must be between 0 and 2.")]
    public required int Course { get; set; }

    [Required]
    public required int[] Seasons { get; set; } = Array.Empty<int>();

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Seasons.Length == 0)
        {
            yield return new ValidationResult("Seasons must contain at least one value.", [nameof(Seasons)]);
        }

        if (Seasons.Length > 4)
        {
            yield return new ValidationResult("Seasons must contain at most four values.", [nameof(Seasons)]);
        }

        if (Seasons.Distinct().Count() != Seasons.Length)
        {
            yield return new ValidationResult("Seasons must not contain duplicate values.", [nameof(Seasons)]);
        }

        foreach (var season in Seasons)
        {
            if (season < 0 || season > 3)
            {
                yield return new ValidationResult($"Season value {season} is invalid. Valid values are 0-3.", [nameof(Seasons)]);
                break;
            }
        }
    }
}

/// <summary>
/// Request payload for updating an existing dish.
/// </summary>
public class UpdateDishPayload : IValidatableObject
{
    [StringLength(200, ErrorMessage = "Name must not exceed 200 characters.")]
    public string? Name { get; set; }

    [StringLength(5000, ErrorMessage = "Description must not exceed 5000 characters.")]
    public string? Description { get; set; }

    [Range(0, 2, ErrorMessage = "Course must be between 0 and 2.")]
    public int? Course { get; set; }

    public int[]? Seasons { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (Seasons is { Length: > 0 })
        {
            if (Seasons.Length > 4)
            {
                yield return new ValidationResult("Seasons must contain at most four values.", [nameof(Seasons)]);
            }

            if (Seasons.Distinct().Count() != Seasons.Length)
            {
                yield return new ValidationResult("Seasons must not contain duplicate values.", [nameof(Seasons)]);
            }

            foreach (var season in Seasons)
            {
                if (season < 0 || season > 3)
                {
                    yield return new ValidationResult($"Season value {season} is invalid. Valid values are 0-3.", [nameof(Seasons)]);
                    break;
                }
            }
        }
    }
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
/// A single dish entry inside a bulk import request.
/// Fields are nullable and carry no validation attributes so that one invalid
/// entry does not reject the whole request; validation happens per item.
/// </summary>
public class DishImportItem
{
    public string? Name { get; set; }

    public string? Description { get; set; }

    public int? Course { get; set; }

    public int[]? Seasons { get; set; }
}

/// <summary>
/// Validation errors for a single rejected item in a bulk import.
/// </summary>
public class DishImportError
{
    /// <summary>
    /// Zero-based position of the item in the submitted array.
    /// </summary>
    public required int Index { get; set; }

    /// <summary>
    /// The item's name, when it could be read, to help the client identify it.
    /// </summary>
    public string? Name { get; set; }

    /// <summary>
    /// Field-level validation errors for the item.
    /// </summary>
    public required List<ApiFieldError> Errors { get; set; } = new();
}

/// <summary>
/// Response from a bulk dish import.
/// </summary>
public class DishImportResponse
{
    /// <summary>
    /// Number of dishes that were persisted.
    /// </summary>
    public required int Imported { get; set; }

    /// <summary>
    /// Number of dishes that were rejected.
    /// </summary>
    public required int Failed { get; set; }

    /// <summary>
    /// Details of each rejected dish.
    /// </summary>
    public required List<DishImportError> Errors { get; set; } = new();
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
/// Request payload for saving the user's menu. The selection is sent together
/// with the version the client last saw: a persisted menu is always the recap,
/// so there is no view mode to submit.
/// </summary>
public class SaveMenuPayload : IValidatableObject
{
    /// <summary>
    /// Cap on the number of selected dishes, to bound the document size.
    /// </summary>
    public const int MaxSelectedDishIds = 500;

    /// <summary>
    /// Cap on a single dish id, to bound the document size. Well above the 36
    /// characters of the UUIDs the client generates.
    /// </summary>
    public const int MaxSelectedDishIdLength = 128;

    /// <summary>
    /// Ids of the selected dishes, in display order. May be empty to reset the menu.
    /// The same id may appear more than once: the user can pick a dish several times
    /// in the same menu. Ids are not required to exist: a dish may be created or
    /// deleted offline and synced later, so an existence check would race the client.
    /// </summary>
    [Required]
    public required List<string> SelectedDishIds { get; set; } = new();

    /// <summary>
    /// Version the client last saw. Null means the client expects no saved menu
    /// yet. The property must be present in the request, but may be null; a
    /// missing property is rejected as a validation error rather than treated as
    /// an unconditional write.
    /// </summary>
    [JsonRequired]
    public DateTimeOffset? ExpectedUpdatedAt { get; set; }

    public IEnumerable<ValidationResult> Validate(ValidationContext validationContext)
    {
        if (SelectedDishIds.Count > MaxSelectedDishIds)
        {
            yield return new ValidationResult(
                $"SelectedDishIds must not contain more than {MaxSelectedDishIds} ids.",
                [nameof(SelectedDishIds)]);
        }

        if (SelectedDishIds.Any(string.IsNullOrWhiteSpace))
        {
            yield return new ValidationResult(
                "SelectedDishIds must not contain empty ids.",
                [nameof(SelectedDishIds)]);
        }

        if (SelectedDishIds.Any(id => id.Length > MaxSelectedDishIdLength))
        {
            yield return new ValidationResult(
                $"SelectedDishIds must not contain ids longer than {MaxSelectedDishIdLength} characters.",
                [nameof(SelectedDishIds)]);
        }
    }
}

/// <summary>
/// Response containing the user's saved menu.
/// </summary>
public class MenuResponse
{
    public required Menu Data { get; set; } = new();
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
}

/// <summary>
/// Request payload for submitting feedback.
/// </summary>
public class FeedbackPayload
{
    [Required]
    [StringLength(2000, ErrorMessage = "Message must not exceed 2000 characters.")]
    public required string Message { get; set; } = string.Empty;

    [Required]
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
