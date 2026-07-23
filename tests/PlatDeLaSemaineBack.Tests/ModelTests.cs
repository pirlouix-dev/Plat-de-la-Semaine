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
        Assert.Equal(0, dish.Version);
        Assert.Equal(string.Empty, dish.Name);
        Assert.Equal(string.Empty, dish.Description);
        Assert.Empty(dish.Seasons);
        Assert.False(dish.IsDeleted);
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
            Version = 1,
            UserId = userId,
            Name = "Test Dish",
            Description = "A test dish",
            Course = 1,
            Seasons = [0, 1],
            UpdatedAt = now,
            IsDeleted = false
        };

        // Assert
        Assert.Equal(id, dish.Id);
        Assert.Equal(1, dish.Version);
        Assert.Equal(userId, dish.UserId);
        Assert.Equal("Test Dish", dish.Name);
        Assert.Equal("A test dish", dish.Description);
        Assert.Equal(1, dish.Course);
        Assert.Equal([0, 1], dish.Seasons);
        Assert.Equal(now, dish.UpdatedAt);
        Assert.False(dish.IsDeleted);
    }

    [Fact]
    public void ApiResponse_Defaults_AreEmpty()
    {
        // Arrange & Act
        var response = new ApiResponse();

        // Assert
        Assert.False(response.Success);
        Assert.Equal(string.Empty, response.Message);
        Assert.Null(response.Data);
    }

    [Fact]
    public void ApiResponse_CanBePopulated()
    {
        // Arrange & Act
        var response = new ApiResponse
        {
            Success = true,
            Message = "Operation completed.",
            Data = new { id = 1 }
        };

        // Assert
        Assert.True(response.Success);
        Assert.Equal("Operation completed.", response.Message);
        Assert.NotNull(response.Data);
    }

    [Fact]
    public void ErrorResponse_Defaults_AreSet()
    {
        // Arrange & Act
        var error = new ErrorResponse();

        // Assert
        Assert.Equal("UNKNOWN_ERROR", error.ErrorCode);
        Assert.Equal(string.Empty, error.Message);
        Assert.Null(error.Details);
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
            CreatedAt = now
        };

        // Assert
        Assert.Equal(id, user.Id);
        Assert.Equal(now, user.CreatedAt);
    }
}
