using System.ComponentModel.DataAnnotations;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling dish-specific business logic.
/// </summary>
public class DishService : IDishService
{
    private readonly IFirestoreService _firestore;
    private const int MaxBackups = 5;
    private const int MaxBatchSize = 500;

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
        // A client may supply an id (e.g. for offline sync). Ids are scoped to the
        // owner's namespace, so the dish is created under the caller only and can
        // never take over a document owned by another user. An id that already
        // exists is returned untouched: a retried create must not overwrite a
        // later edit of the same dish.
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

        var inserted = await _firestore.TryInsertDishAsync(dish);

        return new DishSingleResponse
        {
            Data = inserted.Dish
        };
    }

    /// <inheritdoc />
    public async Task<DishSingleResponse> UpdateDishAsync(string userId, string dishId, UpdateDishPayload payload)
    {
        var existing = await _firestore.GetDishByIdAsync(userId, dishId)
            ?? throw new KeyNotFoundException("Dish not found.");

        await CreateBackupAsync(userId);

        MergeDishUpdate(existing, payload);
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
        var existing = await _firestore.GetDishByIdAsync(userId, dishId)
            ?? throw new KeyNotFoundException("Dish not found.");

        await CreateBackupAsync(userId);

        existing.IsDeleted = true;
        existing.UpdatedAt = DateTimeOffset.UtcNow;
        await _firestore.UpdateDishAsync(existing);
    }

    /// <inheritdoc />
    public async Task<DishBatchResponse> ApplyDishBatchAsync(string userId, List<DishBatchOperation> operations)
    {
        if (operations.Count > MaxBatchSize)
            throw new ArgumentException($"A maximum of {MaxBatchSize} operations can be applied at once.");

        var results = new List<DishBatchOperationResult>(operations.Count);

        // One timestamp for the batch so a sync push shares a single UpdatedAt:
        // the client then pulls every write with a single `since` boundary.
        var appliedAt = DateTimeOffset.UtcNow;
        var backedUp = false;

        async Task EnsureBackupAsync()
        {
            if (backedUp) return;
            await CreateBackupAsync(userId);
            backedUp = true;
        }

        for (var index = 0; index < operations.Count; index++)
        {
            var operation = operations[index];

            var validationErrors = ValidateBatchOperation(operation);
            if (validationErrors.Count > 0)
            {
                results.Add(Failed(
                    index,
                    operation,
                    ApiErrorCodes.ValidationError,
                    "The operation is invalid.",
                    validationErrors));
                continue;
            }

            try
            {
                results.Add(await ApplyBatchOperationAsync(userId, index, operation, appliedAt, EnsureBackupAsync));
            }
            catch (FirestoreUnavailableException)
            {
                // A dependency outage is not an operation-level failure: fail the
                // whole request so the client retries the batch.
                throw;
            }
            catch (Exception)
            {
                // Do not echo the raw exception: it may carry driver internals.
                results.Add(Failed(
                    index,
                    operation,
                    ApiErrorCodes.InternalError,
                    "The operation could not be completed."));
            }
        }

        return new DishBatchResponse
        {
            Created = results.Count(result => result.Status == DishBatchStatus.Created),
            Updated = results.Count(result => result.Status == DishBatchStatus.Updated),
            Deleted = results.Count(result => result.Status == DishBatchStatus.Deleted),
            Failed = results.Count(result => result.Status == DishBatchStatus.Failed),
            Results = results
        };
    }

    /// <summary>
    /// Applies one validated operation. The backup is taken lazily, right before
    /// the first write, so a batch that writes nothing leaves no snapshot.
    /// </summary>
    private async Task<DishBatchOperationResult> ApplyBatchOperationAsync(
        string userId,
        int index,
        DishBatchOperation operation,
        DateTimeOffset appliedAt,
        Func<Task> ensureBackup)
    {
        if (operation.Op == BatchOperationKinds.Create)
        {
            await ensureBackup();

            // A blank id is treated as absent: the store then asks Firestore
            // for one. A supplied id makes the create idempotent, so a retry
            // after a lost response returns the existing dish instead of
            // overwriting edits made after the first attempt.
            var inserted = await _firestore.TryInsertDishAsync(new Dish
            {
                Id = string.IsNullOrWhiteSpace(operation.Id) ? null : operation.Id,
                UserId = userId,
                Name = operation.Name!,
                Description = operation.Description ?? string.Empty,
                Course = operation.Course!.Value,
                Seasons = operation.Seasons!,
                UpdatedAt = appliedAt
            });

            return Succeeded(index, operation, DishBatchStatus.Created, inserted.Dish);
        }

        var existing = await _firestore.GetDishByIdAsync(userId, operation.Id!);
        if (existing is null)
        {
            return Failed(index, operation, ApiErrorCodes.NotFound, "The requested resource was not found.");
        }

        await ensureBackup();

        if (operation.Op == BatchOperationKinds.Update)
        {
            MergeDishUpdate(existing, ToUpdatePayload(operation));
        }
        else
        {
            existing.IsDeleted = true;
        }

        existing.UpdatedAt = appliedAt;
        await _firestore.UpdateDishAsync(existing);

        return Succeeded(index, operation, operation.Op == BatchOperationKinds.Update
            ? DishBatchStatus.Updated
            : DishBatchStatus.Deleted, existing);
    }

    /// <summary>
    /// Validates a single batch operation, reusing the create and update rules.
    /// </summary>
    private static List<ApiFieldError> ValidateBatchOperation(DishBatchOperation operation)
    {
        switch (operation.Op)
        {
            case BatchOperationKinds.Create:
                return ValidateCreateOperation(operation);

            case BatchOperationKinds.Update:
            case BatchOperationKinds.Delete:
                if (string.IsNullOrWhiteSpace(operation.Id))
                {
                    return [new ApiFieldError
                    {
                        Field = nameof(operation.Id),
                        Message = $"Id is required for a {operation.Op}."
                    }];
                }

                return operation.Op == BatchOperationKinds.Update
                    ? ValidateUpdateOperation(operation)
                    : [];

            default:
                return [new ApiFieldError
                {
                    Field = nameof(operation.Op),
                    Message = $"Op must be \"{BatchOperationKinds.Create}\", \"{BatchOperationKinds.Update}\", or \"{BatchOperationKinds.Delete}\"."
                }];
        }
    }

    private static List<ApiFieldError> ValidateCreateOperation(DishBatchOperation operation)
    {
        var payload = new CreateDishPayload
        {
            Name = operation.Name ?? string.Empty,
            Description = operation.Description ?? string.Empty,
            Course = operation.Course ?? 0,
            Seasons = operation.Seasons ?? Array.Empty<int>()
        };

        var results = new List<ValidationResult>();
        Validator.TryValidateObject(payload, new ValidationContext(payload), results, validateAllProperties: true);

        // A missing course deserializes to null and defaults to 0, which the
        // range check accepts, so it has to be reported explicitly.
        if (operation.Course is null)
            results.Add(new ValidationResult("Course is required.", [nameof(operation.Course)]));

        return ToFieldErrors(results);
    }

    private static List<ApiFieldError> ValidateUpdateOperation(DishBatchOperation operation)
    {
        var payload = ToUpdatePayload(operation);

        var results = new List<ValidationResult>();
        Validator.TryValidateObject(payload, new ValidationContext(payload), results, validateAllProperties: true);

        return ToFieldErrors(results);
    }

    private static UpdateDishPayload ToUpdatePayload(DishBatchOperation operation) => new()
    {
        Name = operation.Name,
        Description = operation.Description,
        Course = operation.Course,
        Seasons = operation.Seasons
    };

    /// <summary>
    /// Applies the non-null fields of a partial update to a dish.
    /// </summary>
    private static void MergeDishUpdate(Dish dish, UpdateDishPayload payload)
    {
        if (payload.Name != null) dish.Name = payload.Name;
        if (payload.Description != null) dish.Description = payload.Description;
        if (payload.Course != null) dish.Course = payload.Course.Value;
        if (payload.Seasons != null) dish.Seasons = payload.Seasons;
    }

    private static List<ApiFieldError> ToFieldErrors(List<ValidationResult> results)
        => results
            .Select(result => new ApiFieldError
            {
                Field = result.MemberNames.FirstOrDefault() ?? string.Empty,
                Message = result.ErrorMessage ?? "Invalid value."
            })
            .ToList();

    private static DishBatchOperationResult Succeeded(
        int index,
        DishBatchOperation operation,
        string status,
        Dish dish) => new()
        {
            Index = index,
            Op = operation.Op,
            Status = status,
            Id = dish.Id,
            Data = dish
        };

    private static DishBatchOperationResult Failed(
        int index,
        DishBatchOperation operation,
        string code,
        string message,
        List<ApiFieldError>? errors = null) => new()
        {
            Index = index,
            Op = operation.Op,
            Status = DishBatchStatus.Failed,
            Id = operation.Id,
            Code = code,
            Message = message,
            Errors = errors
        };

    private static class BatchOperationKinds
    {
        public const string Create = "create";
        public const string Update = "update";
        public const string Delete = "delete";
    }

    /// <summary>
    /// Creates a backup of the user's current dishes and manages the max backup limit.
    /// </summary>
    public async Task CreateBackupAsync(string userId)
    {
        var currentDishes = await _firestore.GetDishesByUserIdAsync(userId, null);

        // A backup is the active dish list that can be reverted to. Tombstones
        // are not part of that state, and restoring them would resurrect dishes
        // the user deleted.
        var backup = new Backup
        {
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = currentDishes
                .Where(dish => !dish.IsDeleted)
                .Select(BackupDish.FromDish)
                .ToList()
        };

        var createdBackup = await _firestore.InsertBackupAsync(backup);

        var user = await _firestore.GetUserByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.BackupIds.Add(createdBackup.Id!);

        if (user.BackupIds.Count > MaxBackups)
        {
            var oldestId = user.BackupIds[0];
            await _firestore.DeleteBackupAsync(userId, oldestId);
            user.BackupIds.RemoveAt(0);
        }

        await _firestore.UpdateUserAsync(user);
    }
}
