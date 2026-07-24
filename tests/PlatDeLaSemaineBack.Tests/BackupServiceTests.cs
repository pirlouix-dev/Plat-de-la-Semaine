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
        _firestore.GetBackupByIdAsync("b1").Returns(new Backup
        {
            Id = "b1",
            UserId = "user1",
            CreatedAt = new DateTimeOffset(2025, 1, 1, 0, 0, 0, TimeSpan.Zero),
            Dishes = [new Dish { Id = "d1" }]
        });
        _firestore.GetBackupByIdAsync("b2").Returns(new Backup
        {
            Id = "b2",
            UserId = "user1",
            CreatedAt = new DateTimeOffset(2025, 6, 1, 0, 0, 0, TimeSpan.Zero),
            Dishes = [new Dish { Id = "d2" }, new Dish { Id = "d3" }]
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
    public async Task RestoreBackup_CreatesSafetySnapshotAndRestoresDishes()
    {
        // Arrange
        var userId = "user1";
        var backupId = "backup1";

        var backup = new Backup
        {
            Id = backupId,
            UserId = userId,
            CreatedAt = DateTimeOffset.UtcNow,
            Dishes = new List<Dish>
            {
                new() { Id = "old-d1", UserId = "other", Name = "Restored Dish" }
            }
        };

        var currentDishes = new List<Dish>
        {
            new() { Id = "current-d1", UserId = userId, Name = "Current Dish" }
        };

        var user = new User { Id = userId, BackupIds = [] };

        _firestore.GetBackupByIdAsync(backupId).Returns(backup);
        _firestore.GetDishesByUserIdAsync(userId).Returns(currentDishes);
        _firestore.GetUserByIdAsync(userId).Returns(user);
        _firestore.InsertBackupAsync(Arg.Any<Backup>()).Returns(ci => ci.Arg<Backup>());
        _firestore.InsertDishAsync(Arg.Any<Dish>()).Returns(ci =>
        {
            var d = ci.Arg<Dish>();
            d.Id = "new-id";
            return d;
        });

        // We need to cast to DishService for the safety backup
        var dishService = new DishService(_firestore);
        var service = new BackupService(_firestore, dishService);

        // Act
        var result = await service.RestoreBackupAsync(userId, backupId);

        // Assert
        Assert.Equal(backupId, result.Data.BackupId);
        Assert.Equal(1, result.Data.RestoredCount);
        await _firestore.Received(1).DeleteDishAsync("current-d1");
        await _firestore.Received(1).InsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task RestoreBackup_BackupNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        _firestore.GetBackupByIdAsync("nonexistent").ReturnsNull();

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _service.RestoreBackupAsync("user1", "nonexistent"));
    }

    [Fact]
    public async Task RestoreBackup_NotOwner_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var backup = new Backup
        {
            Id = "b1",
            UserId = "other-user",
            CreatedAt = DateTimeOffset.UtcNow
        };
        _firestore.GetBackupByIdAsync("b1").Returns(backup);

        // Act & Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => _service.RestoreBackupAsync("user1", "b1"));
    }
}
