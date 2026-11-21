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
        _firestore.InsertDishAsync(Arg.Any<Dish>()).Returns(ci =>
        {
            var dish = ci.Arg<Dish>();
            dish.Id = "new-dish-id";
            return dish;
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
        await _firestore.Received(1).InsertDishAsync(Arg.Any<Dish>());
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
        _firestore.InsertDishAsync(Arg.Any<Dish>()).Returns(ci => ci.Arg<Dish>());

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
        await _firestore.Received(1).InsertDishAsync(
            Arg.Is<Dish>(d => d.Id == "victim-dish-id" && d.UserId == userId));
        // Ids are namespaced by owner, so no cross-user lookup is performed.
        await _firestore.DidNotReceive().GetDishByIdAsync(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task CreateDish_IdOwnedBySameUser_OverwritesDish()
    {
        // Arrange
        var userId = "user1";
        var existing = new Dish { Id = "own-dish-id", UserId = userId, Name = "Old" };
        _firestore.GetDishByIdAsync(userId, "own-dish-id").Returns(existing);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { existing });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.InsertDishAsync(Arg.Any<Dish>()).Returns(ci => ci.Arg<Dish>());

        var payload = new CreateDishPayload
        {
            Id = "own-dish-id",
            Name = "Updated",
            Course = 1,
            Seasons = [0]
        };

        // Act
        var result = await _service.CreateDishAsync(userId, payload);

        // Assert
        Assert.Equal("own-dish-id", result.Data.Id);
        await _firestore.Received(1).InsertDishAsync(Arg.Is<Dish>(d => d.Id == "own-dish-id"));
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
        _firestore.InsertDishAsync(Arg.Any<Dish>()).Returns(ci => ci.Arg<Dish>());

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
        await _firestore.Received(1).InsertDishAsync(Arg.Is<Dish>(d => d.Id == "client-id"));
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
    public async Task ImportDishes_AllValid_PersistsAllAndCreatesSingleBackup()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var items = new List<DishImportItem>
        {
            new() { Name = "Pizza", Course = 1, Seasons = [0, 1] },
            new() { Name = "Salad", Description = "Green", Course = 0, Seasons = [2] }
        };

        // Act
        var result = await _service.ImportDishesAsync(userId, items);

        // Assert
        Assert.Equal(2, result.Imported);
        Assert.Equal(0, result.Failed);
        Assert.Empty(result.Errors);
        await _firestore.Received(2).InsertDishAsync(Arg.Any<Dish>());
        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task ImportDishes_PartialFailure_PersistsValidAndReportsInvalid()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var items = new List<DishImportItem>
        {
            new() { Name = "Valid 1", Course = 1, Seasons = [0] },
            new() { Name = "Invalid", Course = 5, Seasons = [0] },
            new() { Name = "Valid 2", Course = 2, Seasons = [1] }
        };

        // Act
        var result = await _service.ImportDishesAsync(userId, items);

        // Assert
        Assert.Equal(2, result.Imported);
        Assert.Equal(1, result.Failed);
        var error = Assert.Single(result.Errors);
        Assert.Equal(1, error.Index);
        Assert.Equal("Invalid", error.Name);
        Assert.Contains(error.Errors, e => e.Field == "Course");
        await _firestore.Received(2).InsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task ImportDishes_MissingRequiredFields_ReportsErrors()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var items = new List<DishImportItem>
        {
            new() { Course = 1, Seasons = [0] },
            new() { Name = "No Course", Seasons = [0] },
            new() { Name = "No Seasons", Course = 1 }
        };

        // Act
        var result = await _service.ImportDishesAsync(userId, items);

        // Assert
        Assert.Equal(0, result.Imported);
        Assert.Equal(3, result.Failed);
        Assert.Contains(result.Errors, e => e.Errors.Any(x => x.Field == "Name"));
        Assert.Contains(result.Errors, e => e.Errors.Any(x => x.Field == "Course"));
        Assert.Contains(result.Errors, e => e.Errors.Any(x => x.Field == "Seasons"));
        await _firestore.DidNotReceive().InsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task ImportDishes_InsertFails_ReportsItemAndContinues()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.InsertDishAsync(Arg.Is<Dish>(d => d.Name == "Broken"))
            .Returns(Task.FromException<Dish>(new InvalidOperationException("write failed")));

        var items = new List<DishImportItem>
        {
            new() { Name = "Broken", Course = 1, Seasons = [0] },
            new() { Name = "Fine", Course = 1, Seasons = [0] }
        };

        // Act
        var result = await _service.ImportDishesAsync(userId, items);

        // Assert
        Assert.Equal(1, result.Imported);
        Assert.Equal(1, result.Failed);
        Assert.Equal(0, Assert.Single(result.Errors).Index);
    }

    [Fact]
    public async Task ImportDishes_EmptyList_ReturnsZeroAndNoBackup()
    {
        // Arrange
        var items = new List<DishImportItem>();

        // Act
        var result = await _service.ImportDishesAsync("user1", items);

        // Assert
        Assert.Equal(0, result.Imported);
        Assert.Equal(0, result.Failed);
        Assert.Empty(result.Errors);
        await _firestore.DidNotReceive().InsertBackupAsync(Arg.Any<Backup>());
        await _firestore.DidNotReceive().InsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task ImportDishes_ExceedsMaxSize_ThrowsArgumentException()
    {
        // Arrange
        var items = Enumerable.Range(0, 501)
            .Select(_ => new DishImportItem { Name = "Dish", Course = 1, Seasons = [0] })
            .ToList();

        // Act & Assert
        await Assert.ThrowsAsync<ArgumentException>(
            () => _service.ImportDishesAsync("user1", items));
        await _firestore.DidNotReceive().InsertBackupAsync(Arg.Any<Backup>());
    }

    [Fact]
    public async Task ImportDishes_UsesServerGeneratedId()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var items = new List<DishImportItem>
        {
            new() { Name = "No Id", Course = 1, Seasons = [0] }
        };

        // Act
        await _service.ImportDishesAsync(userId, items);

        // Assert
        await _firestore.Received(1).InsertDishAsync(Arg.Is<Dish>(d => d.Id == null && d.UserId == userId));
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
