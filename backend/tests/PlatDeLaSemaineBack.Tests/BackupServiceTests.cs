using NSubstitute;
using NSubstitute.ReturnsExtensions;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class BackupServiceTests
{
    private readonly IFirestoreService _firestore;
    private readonly IDishService _dishService;
    private readonly BackupService _service;

    public BackupServiceTests()
    {
        _firestore = Substitute.For<IFirestoreService>();
        _dishService = Substitute.For<IDishService>();
        _service = new BackupService(_firestore, _dishService);
    }

    [Fact]
    public async Task GetAllBackups_NoUser_ReturnsEmpty()
    {
        // Arrange
        _firestore.GetUserByIdAsync("user1").ReturnsNull();

        // Act
        var result = await _service.GetAllBackupsAsync("user1");

        // Assert
        Assert.Equal(0, result.Total);
        Assert.Empty(result.Data);
    }

    [Fact]
    public async Task GetAllBackups_ReturnsSortedByNewestFirst()
    {
        // Arrange
        var user = new User
        {
            Id = "user1",
            BackupIds = ["b1", "b2"]
        };
        _firestore.GetUserByIdAsync("user1").Returns(user);
        _firestore.GetBackupByIdAsync("user1", "b1").Returns(new Backup
        {
            Id = "b1",
            UserId = "user1",
            CreatedAt = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero),
            Dishes = [new BackupDish { Id = "d1" }]
        });
        _firestore.GetBackupByIdAsync("user1", "b2").Returns(new Backup
        {
            Id = "b2",
            UserId = "user1",
            CreatedAt = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
            Dishes = [new BackupDish { Id = "d2" }, new BackupDish { Id = "d3" }]
        });

        // Act
        var result = await _service.GetAllBackupsAsync("user1");

        // Assert
        Assert.Equal(2, result.Total);
        Assert.Equal("b2", result.Data[0].Id);
        Assert.Equal("b1", result.Data[1].Id);
        Assert.Equal(2, result.Data[0].DishCount);
        Assert.Equal(1, result.Data[1].DishCount);
    }

    [Fact]
    public async Task RestoreBackup_ReusesExistingDocumentId_AndCreatesSafetySnapshot()
    {
        // Arrange
        var userId = "user1";
        var backupId = "backup1";

        var backup = new Backup
        {
            Id = backupId,
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = new List<BackupDish>
            {
                new() { Id = "d1", Name = "Restored Dish", Course = 1, Seasons = [0] }
            }
        };

        var currentDishes = new List<Dish>
        {
            new() { Id = "d1", UserId = userId, Name = "Current Dish", Course = 2, Seasons = [1] }
        };

        var user = new User { Id = userId, BackupIds = [] };

        _firestore.GetBackupByIdAsync(userId, backupId).Returns(backup);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(currentDishes);
        _firestore.GetUserByIdAsync(userId).Returns(user);
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        // We need to cast to DishService for the safety backup
        var dishService = new DishService(_firestore);
        var service = new BackupService(_firestore, dishService);

        // Act
        var result = await service.RestoreBackupAsync(userId, backupId);

        // Assert
        Assert.Equal(backupId, result.Data.BackupId);
        Assert.Equal(1, result.Data.RestoredCount);
        await _firestore.Received(1).InsertBackupAsync(Arg.Any<Backup>());
        await _firestore.Received(1).UpdateDishAsync(Arg.Is<Dish>(dish =>
            dish.Id == "d1"
            && dish.UserId == userId
            && dish.Name == "Restored Dish"
            && !dish.IsDeleted));
        await _firestore.DidNotReceive().InsertDishAsync(Arg.Any<Dish>());
        await _firestore.DidNotReceive().DeleteDishAsync(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task RestoreBackup_InsertsMissingDishWithPersistedId()
    {
        // Arrange
        var userId = "user1";
        var backupId = "backup1";

        var backup = new Backup
        {
            Id = backupId,
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = new List<BackupDish>
            {
                new() { Id = "deleted-d1", Name = "Restored Dish", Course = 1, Seasons = [0] }
            }
        };

        _firestore.GetBackupByIdAsync(userId, backupId).Returns(backup);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish>());
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var service = new BackupService(_firestore, new DishService(_firestore));

        // Act
        var result = await service.RestoreBackupAsync(userId, backupId);

        // Assert
        Assert.Equal(1, result.Data.RestoredCount);
        await _firestore.Received(1).InsertDishAsync(Arg.Is<Dish>(dish =>
            dish.Id == "deleted-d1"
            && dish.UserId == userId
            && !dish.IsDeleted));
        await _firestore.DidNotReceive().UpdateDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task RestoreBackup_SoftDeletesLiveDishesMissingFromBackup()
    {
        // Arrange
        var userId = "user1";
        var backupId = "backup1";

        var backup = new Backup
        {
            Id = backupId,
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = new List<BackupDish>()
        };

        var removed = new Dish
        {
            Id = "removed-d1",
            UserId = userId,
            Name = "Removed Dish",
            IsDeleted = false,
            UpdatedAt = DateTimeOffset.UtcNow.AddDays(-1)
        };

        _firestore.GetBackupByIdAsync(userId, backupId).Returns(backup);
        _firestore.GetDishesByUserIdAsync(userId, null).Returns(new List<Dish> { removed });
        _firestore.GetUserByIdAsync(userId).Returns(new User { Id = userId, BackupIds = [] });
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());

        var service = new BackupService(_firestore, new DishService(_firestore));
        var before = DateTimeOffset.UtcNow;

        // Act
        var result = await service.RestoreBackupAsync(userId, backupId);

        // Assert
        Assert.Equal(0, result.Data.RestoredCount);
        await _firestore.Received(1).UpdateDishAsync(Arg.Is<Dish>(dish =>
            dish.Id == "removed-d1"
            && dish.IsDeleted
            && dish.UpdatedAt >= before));
        await _firestore.DidNotReceive().DeleteDishAsync(Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task RestoreBackup_BackupNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetBackupByIdAsync("user1", "nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.RestoreBackupAsync("user1", "nonexistent"));
    }

    [Fact]
    public async Task RestoreBackup_NotOwner_ThrowsSameAsNotFound()
    {
        // Arrange: the backup exists globally but not within the caller's namespace.
        _firestore.GetBackupByIdAsync("user1", "b1").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.RestoreBackupAsync("user1", "b1"));
    }
}
