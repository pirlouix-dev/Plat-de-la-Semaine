using NSubstitute;
using NSubstitute.ReturnsExtensions;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class DishServiceTests
{
    private readonly IFirestoreService _firestore;
    private readonly DishService _service;

    public DishServiceTests()
    {
        _firestore = Substitute.For<IFirestoreService>();
        _service = new DishService(_firestore);
    }

    [Fact]
    public async Task GetAllDishes_ReturnsUserDishes()
    {
        // Arrange
        var userId = "user1";
        var dishes = new List<Dish>
        {
            new() { Id = "d1", UserId = userId, Name = "Dish 1" },
            new() { Id = "d2", UserId = userId, Name = "Dish 2" }
        };
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(dishes);

        // Act
        var result = await _service.GetAllDishesAsync(userId, null);

        // Assert
        Assert.Equal(2, result.Total);
        Assert.Equal(2, result.Data.Count);
    }

    [Fact]
    public async Task GetAllDishes_EmptyList_ReturnsZeroTotal()
    {
        // Arrange
        _firestore.GetDishesByUserIdAsync("user1", null).Returns(new List<Dish>());

        // Act
        var result = await _service.GetAllDishesAsync("user1", null);

        // Assert
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Data);
    }

    [Fact]
    public async Task GetAllDishes_WithSince_PassesSinceToFirestore()
    {
        // Arrange
        var userId = "user1";
        var since = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero);
        var dishes = new List<Dish>
        {
            new() { Id = "d1", UserId = userId, Name = "Recent Dish", UpdatedAt = since.AddDays(10) }
        };
        _firestore.GetDishesByUserIdAsync(userId, since).Returns(dishes);

        // Act
        var result = await _service.GetAllDishesAsync(userId, since);

        // Assert
        Assert.Equal(1, result.Total);
        Assert.Equal("Recent Dish", result.Data[0].Name);
    }

    [Fact]
    public async Task GetAllDishes_WithSince_NoMatches_ReturnsEmpty()
    {
        // Arrange
        var userId = "user1";
        var since = DateTimeOffset.UtcNow;
        _firestore.GetDishesByUserIdAsync(userId, since).Returns(new List<Dish>());

        // Act
        var result = await _service.GetAllDishesAsync(userId, since);

        // Assert
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Data);
    }

    [Fact]
    public async Task CreateDish_CreatesBackupAndInsertsDish()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, CreatedAt = DateTimeOffset.UtcNow });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci =>
        {
            var dish = ci.Arg<Dish>();
            dish.Id = "new-dish-id";
            return new DishInsertResult(true, dish);
        });

        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Description = "Margherita",
            Course = 1,
            Seasons = [0, 1]
        };

        // Act
        var result = await _service.CreateDishAsync(userId, payload);

        // Assert
        Assert.Equal("Pizza", result.Data.Name);
        Assert.Equal(userId, result.Data.UserId);
        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
        await _firestore.Received(1).TryInsertDishAsync(Arg.Any<Dish>());
        await _firestore.Received(1).UpdateUserAsync(Arg.Any<User>());
    }

    [Fact]
    public async Task CreateDish_ClientSuppliedId_IsScopedToCallerNamespace()
    {
        // Arrange
        var userId = "attacker";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));

        var payload = new CreateDishPayload
        {
            Id = "victim-dish-id",
            Name = "attacker dish",
            Course = 1,
            Seasons = [0]
        };

        // Act
        var result = await _service.CreateDishAsync(userId, payload);

        // Assert
        Assert.Equal("victim-dish-id", result.Data.Id);
        Assert.Equal(userId, result.Data.UserId);
        await _firestore.Received(1).TryInsertDishAsync(
            Arg.Is<Dish>(d => d.Id == "victim-dish-id" && d.UserId == userId));
        // Ids are namespaced by owner, so no cross-user lookup is performed.
        await _firestore.DidNotReceive().GetDishByIdAsync(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task CreateDish_IdAlreadyTaken_ReturnsExistingDishWithoutOverwriting()
    {
        // Arrange
        var userId = "user1";
        var existing = new Dish { Id = "own-dish-id", UserId = userId, Name = "Old" };
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { existing });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>())
            .Returns(new DishInsertResult(false, existing));

        var payload = new CreateDishPayload
        {
            Id = "own-dish-id",
            Name = "Updated",
            Course = 1,
            Seasons = [0]
        };

        // Act
        var result = await _service.CreateDishAsync(userId, payload);

        // Assert: a retried create must not revert a later edit.
        Assert.Equal("own-dish-id", result.Data.Id);
        Assert.Equal("Old", result.Data.Name);
        await _firestore.Received(1).TryInsertDishAsync(Arg.Is<Dish>(d => d.Id == "own-dish-id"));
        await _firestore.DidNotReceive().UpdateDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task CreateDish_IdNotTaken_InsertsDish()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishByIdAsync(userId, "client-id").ReturnsNull();
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));

        var payload = new CreateDishPayload
        {
            Id = "client-id",
            Name = "Pizza",
            Course = 1,
            Seasons = [0]
        };

        // Act
        var result = await _service.CreateDishAsync(userId, payload);

        // Assert
        Assert.Equal("client-id", result.Data.Id);
        await _firestore.Received(1).TryInsertDishAsync(Arg.Is<Dish>(d => d.Id == "client-id"));
    }

    [Fact]
    public async Task CreateDish_UserNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        var userId = "new-user";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).ReturnsNull();
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [0]
        };

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.CreateDishAsync(userId, payload));
    }

    [Fact]
    public async Task CreateBackup_UserNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetDishesByUserIdAsync("user1", null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync("user1").ReturnsNull();
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.CreateBackupAsync("user1"));
    }

    [Fact]
    public async Task UpdateDish_UpdatesExistingDish()
    {
        // Arrange
        var userId = "user1";
        var dishId = "dish1";
        var existing = new Dish
        {
            Id = dishId,
            UserId = userId,
            Name = "Old Name",
            Description = "Old Desc",
            Course = 1,
            Seasons = [0]
        };
        _firestore.GetDishByIdAsync(userId, dishId).Returns(existing);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { existing });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var payload = new UpdateDishPayload
        {
            Name = "New Name"
        };

        // Act
        var result = await _service.UpdateDishAsync(userId, dishId, payload);

        // Assert
        Assert.Equal("New Name", result.Data.Name);
        Assert.Equal("Old Desc", result.Data.Description);
        await _firestore.Received(1).UpdateDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task UpdateDish_DishNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetDishByIdAsync("user1", "nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.UpdateDishAsync("user1", "nonexistent", new UpdateDishPayload()));
    }

    [Fact]
    public async Task UpdateDish_NotOwner_ThrowsSameAsNotFound()
    {
        // Arrange: the dish exists globally but not within the caller's namespace,
        // so the scoped lookup returns null exactly as for a missing dish.
        _firestore.GetDishByIdAsync("user1", "d1").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.UpdateDishAsync("user1", "d1", new UpdateDishPayload()));
    }

    [Fact]
    public async Task DeleteDish_SoftDeletesDish()
    {
        // Arrange
        var userId = "user1";
        var dishId = "dish1";
        var dish = new Dish { Id = dishId, UserId = userId, Name = "Dish" };
        _firestore.GetDishByIdAsync(userId, dishId).Returns(dish);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { dish });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        // Act
        await _service.DeleteDishAsync(userId, dishId);

        // Assert
        Assert.True(dish.IsDeleted);
        Assert.NotEqual(default, dish.UpdatedAt);
        await _firestore.Received(1).UpdateDishAsync(dish);
        await _firestore.DidNotReceive().DeleteDishAsync(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task DeleteDish_DishNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetDishByIdAsync("user1", "nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.DeleteDishAsync("user1", "nonexistent"));
    }

    [Fact]
    public async Task DeleteDish_NotOwner_ThrowsSameAsNotFound()
    {
        // Arrange: the dish exists globally but not within the caller's namespace.
        _firestore.GetDishByIdAsync("user1", "d1").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.DeleteDishAsync("user1", "d1"));
    }

    [Fact]
    public async Task ApplyDishBatch_MixedOperations_AppliesAllInOrderWithSingleBackup()
    {
        // Arrange
        var userId = "user1";
        var updated = new Dish { Id = "u1", UserId = userId, Name = "Old", Description = "Keep", Course = 0, Seasons = [0] };
        var deleted = new Dish { Id = "d1", UserId = userId, Name = "Gone", Course = 1, Seasons = [1] };
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { updated, deleted });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));
        _firestore.GetDishByIdAsync(userId, "u1").Returns(updated);
        _firestore.GetDishByIdAsync(userId, "d1").Returns(deleted);

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Id = "c1", Name = "New", Course = 2, Seasons = [2] },
            new() { Op = "update", Id = "u1", Name = "Renamed" },
            new() { Op = "delete", Id = "d1" }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Updated);
        Assert.Equal(1, result.Deleted);
        Assert.Equal(0, result.Failed);
        Assert.Equal(3, result.Results.Count);

        Assert.Equal("created", result.Results[0].Status);
        Assert.Equal("c1", result.Results[0].Id);
        Assert.Equal("create", result.Results[0].Op);

        Assert.Equal("updated", result.Results[1].Status);
        Assert.Equal("Renamed", result.Results[1].Data!.Name);
        // Partial merge leaves untouched fields alone.
        Assert.Equal("Keep", result.Results[1].Data!.Description);

        Assert.Equal("deleted", result.Results[2].Status);
        Assert.True(deleted.IsDeleted);

        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
        await _firestore.Received(1).TryInsertDishAsync(Arg.Is<Dish>(dish => dish.Id == "c1"));
        await _firestore.Received(2).UpdateDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task ApplyDishBatch_CreateWithoutId_PersistsServerGeneratedId()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        string? idAtInsert = "unset";
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci =>
        {
            // Firestore assigns the generated id to the document it was given.
            idAtInsert = ci.Arg<Dish>().Id;
            ci.Arg<Dish>().Id = "generated";
            return new DishInsertResult(true, ci.Arg<Dish>());
        });

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Name = "Pizza", Course = 1, Seasons = [0] }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Null(idAtInsert);
        Assert.Equal("generated", result.Results[0].Id);
        Assert.Equal("generated", result.Results[0].Data!.Id);
    }

    [Fact]
    public async Task ApplyDishBatch_CreateThenUpdateSameId_AppliesInRequestOrder()
    {
        // Arrange: the create lands before the update lookup, so the latter
        // finds the dish written by the same batch.
        var userId = "user1";
        var created = new Dish { Id = "x", UserId = userId, Name = "First", Course = 1, Seasons = [0] };
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));
        _firestore.GetDishByIdAsync(userId, "x").Returns(created);

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Id = "x", Name = "First", Course = 1, Seasons = [0] },
            new() { Op = "update", Id = "x", Name = "Second" }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Equal(0, result.Failed);
        Received.InOrder(() =>
        {
            _firestore.TryInsertDishAsync(Arg.Is<Dish>(dish => dish.Id == "x"));
            _firestore.GetDishByIdAsync(userId, "x");
        });
    }

    [Fact]
    public async Task ApplyDishBatch_InvalidOperations_AreReportedAndDoNotBlockValidOnes()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>()).Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Name = "Valid", Course = 1, Seasons = [0] },
            new() { Op = "create", Name = "Bad course", Course = 5, Seasons = [0] },
            new() { Op = "create", Name = "No seasons", Course = 1 },
            new() { Op = "update", Name = "No id" },
            new() { Op = "delete" },
            new() { Op = "upsert", Id = "whatever" }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Equal(1, result.Created);
        Assert.Equal(5, result.Failed);
        Assert.All(result.Results.Skip(1), item => Assert.Equal("failed", item.Status));
        Assert.All(result.Results.Skip(1), item => Assert.Equal("VALIDATION_ERROR", item.Code));

        Assert.Contains(result.Results[1].Errors!, error => error.Field == "Course");
        Assert.Contains(result.Results[2].Errors!, error => error.Field == "Seasons");
        Assert.Contains(result.Results[3].Errors!, error => error.Field == "Id");
        Assert.Contains(result.Results[4].Errors!, error => error.Field == "Id");
        Assert.Contains(result.Results[5].Errors!, error => error.Field == "Op");

        await _firestore.Received(1).TryInsertDishAsync(Arg.Any<Dish>());
        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task ApplyDishBatch_MissingTarget_ReportsNotFoundWithoutWriting()
    {
        // Arrange: both ids resolve to null, as for a dish owned by another user.
        var userId = "user1";
        _firestore.GetDishByIdAsync(userId, Arg.Any<string>()).ReturnsNull();

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "update", Id = "missing", Name = "Nope" },
            new() { Op = "delete", Id = "also-missing" }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Equal(0, result.Created + result.Updated + result.Deleted);
        Assert.Equal(2, result.Failed);
        Assert.All(result.Results, item => Assert.Equal("NOT_FOUND", item.Code));
        await _firestore.DidNotReceive().InsertBackupAsync(Arg.Any<Backup>());
        await _firestore.DidNotReceive().UpdateDishAsync(Arg.Any<Dish>());
        await _firestore.DidNotReceive().TryInsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task ApplyDishBatch_WriteFailure_IsReportedAndOtherOperationsContinue()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Is<Dish>(dish => dish.Name == "Broken"))
            .Returns(Task.FromException<DishInsertResult>(new InvalidOperationException("write failed")));
        _firestore.TryInsertDishAsync(Arg.Is<Dish>(dish => dish.Name == "Fine"))
            .Returns(ci => new DishInsertResult(true, ci.Arg<Dish>()));

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Name = "Broken", Course = 1, Seasons = [0] },
            new() { Op = "create", Name = "Fine", Course = 1, Seasons = [0] }
        };

        // Act
        var result = await _service.ApplyDishBatchAsync(userId, operations);

        // Assert
        Assert.Equal(1, result.Created);
        Assert.Equal(1, result.Failed);
        Assert.Equal("INTERNAL_ERROR", result.Results[0].Code);
        Assert.DoesNotContain("write failed", result.Results[0].Message);
        Assert.Equal(1, result.Results[1].Index);
        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task ApplyDishBatch_FirestoreUnavailable_AbortsWholeRequest()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.TryInsertDishAsync(Arg.Any<Dish>())
            .Returns(Task.FromException<DishInsertResult>(new FirestoreUnavailableException()));

        var operations = new List<DishBatchOperation>
        {
            new() { Op = "create", Name = "Pizza", Course = 1, Seasons = [0] }
        };

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => _service.ApplyDishBatchAsync(userId, operations));
    }

    [Fact]
    public async Task ApplyDishBatch_EmptyBatch_ReturnsZeroCountsAndNoBackup()
    {
        // Act
        var result = await _service.ApplyDishBatchAsync("user1", new List<DishBatchOperation>());

        // Assert
        Assert.Equal(0, result.Created + result.Updated + result.Deleted + result.Failed);
        Assert.Empty(result.Results);
        await _firestore.DidNotReceive().InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task ApplyDishBatch_ExceedsMaxSize_ThrowsArgumentException()
    {
        // Arrange
        var operations = Enumerable.Range(0, 501)
            .Select(_ => new DishBatchOperation { Op = "create", Name = "Dish", Course = 1, Seasons = [0] })
            .ToList();

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.ApplyDishBatchAsync("user1", operations));
        await _firestore.DidNotReceive().InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task CreateBackup_ExcludesDeletedDishesAndPersistsIds()
    {
        // Arrange
        var userId = "user1";
        var live = new Dish
        {
            Id = "live-d1",
            UserId = userId,
            Name = "Live Dish",
            Course = 1,
            Seasons = [0]
        };
        var deleted = new Dish
        {
            Id = "deleted-d1",
            UserId = userId,
            Name = "Deleted Dish",
            Course = 2,
            Seasons = [1],
            IsDeleted = true
        };

        _firestore.GetDishesByUserIdAsync(userId, null)
            .Returns(new List<Dish> { live, deleted });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });

        Backup? captured = null;
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci =>
        {
            captured = ci.Arg<Backup>();
            captured.Id = "backup1";
            return captured;
        });

        // Act
        await _service.CreateBackupAsync(userId);

        // Assert
        Assert.NotNull(captured);
        var snapshot = Assert.Single(captured!.Dishes);
        Assert.Equal("live-d1", snapshot.Id);
        Assert.Equal("Live Dish", snapshot.Name);
        Assert.Equal(1, snapshot.Course);
        Assert.DoesNotContain(captured.Dishes, dish => dish.Id == "deleted-d1");
    }

    [Fact]
    public async Task CreateBackup_EvictsOldestWhenOverMax()
    {
        // Arrange
        var userId = "user1";
        var existingIds = new List<string> { "b1", "b2", "b3", "b4", "b5" };
        var user = new User { Id = userId, CreatedAt = DateTimeOffset.UtcNow, BackupIds = existingIds };
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(user);
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(new Backup
        {
            Id = "b6",
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow
        });

        // Act
        await _service.CreateBackupAsync(userId);

        // Assert
        await _firestore.Received(1).DeleteBackupAsync(userId, "b1");
        Assert.Equal(5, user.BackupIds.Count);
        Assert.Equal("b2", user.BackupIds[0]);
        Assert.Equal("b6", user.BackupIds[^1]);
    }
}
