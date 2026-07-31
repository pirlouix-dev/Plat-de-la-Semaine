using PlatDeLaSemaineBack.Models;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class ModelTests
{
    [Fact]
    public void Dish_DefaultValues_AreSetCorrectly()
    {
        // Arrange & Act
        var dish = new Dish();

        // Assert
        Assert.Equal(string.Empty, dish.Name);
        Assert.Equal(string.Empty, dish.Description);
        Assert.Empty(dish.Seasons);
    }

    [Fact]
    public void Dish_Properties_CanBeSetAndRead()
    {
        // Arrange
        var id = Guid.NewGuid().ToString();
        var userId = Guid.NewGuid().ToString();
        var now = DateTimeOffset.UtcNow;

        // Act
        var dish = new Dish
        {
            Id = id,
            UserId = userId,
            Name = "Test Dish",
            Description = "A test dish",
            Course = 1,
            Seasons = [0, 1],
            UpdatedAt = now
        };

        // Assert
        Assert.Equal(id, dish.Id);
        Assert.Equal(userId, dish.UserId);
        Assert.Equal("Test Dish", dish.Name);
        Assert.Equal("A test dish", dish.Description);
        Assert.Equal(1, dish.Course);
        Assert.Equal([0, 1], dish.Seasons);
        Assert.Equal(now, dish.UpdatedAt);
    }

    [Fact]
    public void ApiErrorDetail_Defaults_AreSet()
    {
        // Arrange & Act
        var error = new ApiErrorDetail();

        // Assert
        Assert.Equal(string.Empty, error.Code);
        Assert.Equal(string.Empty, error.Message);
        Assert.Null(error.Details);
    }

    [Fact]
    public void ApiErrorDetail_CanBePopulated()
    {
        // Arrange & Act
        var error = new ApiErrorDetail
        {
            Code = "NOT_FOUND",
            Message = "Resource not found.",
            Details = new List<ApiFieldError>
            {
                new() { Field = "id", Message = "Invalid ID." }
            }
        };

        // Assert
        Assert.Equal("NOT_FOUND", error.Code);
        Assert.Equal("Resource not found.", error.Message);
        Assert.NotNull(error.Details);
        Assert.Single(error.Details);
    }

    [Fact]
    public void User_Properties_CanBeSet()
    {
        // Arrange
        var id = Guid.NewGuid().ToString();
        var now = DateTimeOffset.UtcNow;

        // Act
        var user = new User
        {
            Id = id,
            CreatedAt = now,
            Username = "testuser",
            BackupIds = ["b1", "b2"]
        };

        // Assert
        Assert.Equal(id, user.Id);
        Assert.Equal(now, user.CreatedAt);
        Assert.Equal("testuser", user.Username);
        Assert.Equal(2, user.BackupIds.Count);
        Assert.Equal("b1", user.BackupIds[0]);
    }

    [Fact]
    public void Backup_DefaultValues_AreSet()
    {
        // Arrange & Act
        var backup = new Backup();

        // Assert
        Assert.Null(backup.Id);
        Assert.Equal(string.Empty, backup.UserId);
        Assert.Empty(backup.Dishes);
    }

    [Fact]
    public void BackupSummary_Properties_CanBeSet()
    {
        // Arrange & Act
        var summary = new BackupSummary
        {
            Id = "b1",
            CreatedAt = DateTimeOffset.UtcNow,
            DishCount = 3
        };

        // Assert
        Assert.Equal("b1", summary.Id);
        Assert.Equal(3, summary.DishCount);
    }

    [Fact]
    public void VersionInfo_Properties_CanBeSet()
    {
        // Arrange & Act
        var info = new VersionInfo
        {
            LatestVersion = "1.0.0",
            Description = "Initial release",
            DownloadUrl = "https://example.com"
        };

        // Assert
        Assert.Equal("1.0.0", info.LatestVersion);
        Assert.Equal("Initial release", info.Description);
        Assert.Equal("https://example.com", info.DownloadUrl);
    }
}
