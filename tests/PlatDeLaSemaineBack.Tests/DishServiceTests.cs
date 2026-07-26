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
        _firestore.GetDishesByUserIdAsync(userId).Returns(dishes);

        // Act
        var result = await _service.GetAllDishesAsync(userId);

        // Assert
        Assert.Equal(2, result.Total);
        Assert.Equal(2, result.Data.Count);
    }

    [Fact]
    public async Task GetAllDishes_EmptyList_ReturnsZeroTotal()
    {
        // Arrange
        _firestore.GetDishesByUserIdAsync("user1").Returns(new List<Dish>());

        // Act
        var result = await _service.GetAllDishesAsync("user1");

        // Assert
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Data);
    }

    [Fact]
    public async Task CreateDish_CreatesBackupAndInsertsDish()
    {
        // Arrange
        var userId = "user1";
        _firestore.GetDishesByUserIdAsync(userId).Returns(new List<Dish>());
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
    public async Task CreateDish_UserNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        var userId = "new-user";
        _firestore.GetDishesByUserIdAsync(userId).Returns(new List<Dish>());
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
        _firestore.GetDishesByUserIdAsync("user1").Returns(new List<Dish>());
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
        _firestore.GetDishByIdAsync(dishId).Returns(existing);
        _firestore.GetDishesByUserIdAsync(userId).Returns(new List<Dish> { existing });
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
        _firestore.GetDishByIdAsync("nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.UpdateDishAsync("user1", "nonexistent", new UpdateDishPayload()));
    }

    [Fact]
    public async Task UpdateDish_NotOwner_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var dish = new Dish { Id = "d1", UserId = "other-user", Name = "Dish" };
        _firestore.GetDishByIdAsync("d1").Returns(dish);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _service.UpdateDishAsync("user1", "d1", new UpdateDishPayload()));
    }

    [Fact]
    public async Task DeleteDish_SoftDeletesDish()
    {
        // Arrange
        var userId = "user1";
        var dishId = "dish1";
        var dish = new Dish { Id = dishId, UserId = userId, Name = "Dish" };
        _firestore.GetDishByIdAsync(dishId).Returns(dish);
        _firestore.GetDishesByUserIdAsync(userId).Returns(new List<Dish> { dish });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        // Act
        await _service.DeleteDishAsync(userId, dishId);

        // Assert
        Assert.True(dish.IsDeleted);
        Assert.NotEqual(default, dish.UpdatedAt);
        await _firestore.Received(1).UpdateDishAsync(dish);
        await _firestore.DidNotReceive().DeleteDishAsync(Arg.Any<string>());
    }

    [Fact]
    public async Task DeleteDish_DishNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetDishByIdAsync("nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.DeleteDishAsync("user1", "nonexistent"));
    }

    [Fact]
    public async Task DeleteDish_NotOwner_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var dish = new Dish { Id = "d1", UserId = "other-user", Name = "Dish" };
        _firestore.GetDishByIdAsync("d1").Returns(dish);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _service.DeleteDishAsync("user1", "d1"));
    }

    [Fact]
    public async Task CreateBackup_EvictsOldestWhenOverMax()
    {
        // Arrange
        var userId = "user1";
        var existingIds = new List<string> { "b1", "b2", "b3", "b4", "b5" };
        var user = new User { Id = userId, CreatedAt = DateTimeOffset.UtcNow, BackupIds = existingIds };
        _firestore.GetDishesByUserIdAsync(userId).Returns(new List<Dish>());
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
        await _firestore.Received(1).DeleteBackupAsync("b1");
        Assert.Equal(5, user.BackupIds.Count);
        Assert.Equal("b2", user.BackupIds[0]);
        Assert.Equal("b6", user.BackupIds[^1]);
    }
}
