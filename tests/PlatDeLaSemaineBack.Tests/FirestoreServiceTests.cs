using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class FirestoreServiceTests
{
    [Fact]
    public void IsConnected_DefaultsToFalse()
    {
        // Arrange & Act
        var service = new FirestoreService();

        // Assert
        Assert.False(service.IsConnected);
    }

    [Fact]
    public async Task InitializeAsync_WithoutEnvVar_ReturnsFalse()
    {
        // Arrange
        var service = new FirestoreService();
        var original = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");

        try
        {
            Environment.SetEnvironmentVariable("FIREBASE_PROJECT_ID", null);

            // Act
            var result = await service.InitializeAsync();

            // Assert
            Assert.False(result);
            Assert.False(service.IsConnected);
        }
        finally
        {
            Environment.SetEnvironmentVariable("FIREBASE_PROJECT_ID", original);
        }
    }

    [Fact]
    public async Task GetAllDishesAsync_WhenNotConnected_ReturnsEmptyList()
    {
        // Arrange
        var service = new FirestoreService();

        // Act
        var result = await service.GetAllDishesAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAllUsersAsync_WhenNotConnected_ReturnsEmptyList()
    {
        // Arrange
        var service = new FirestoreService();

        // Act
        var result = await service.GetAllUsersAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result);
    }

    [Fact]
    public async Task InsertDishAsync_WhenNotConnected_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = new FirestoreService();
        var dish = new Dish { Name = "Test" };

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.InsertDishAsync(dish));
    }

    [Fact]
    public async Task InsertUserAsync_WhenNotConnected_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = new FirestoreService();
        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.InsertUserAsync(user, "test-id"));
    }

    [Fact]
    public async Task InitializeAsync_WithEmptyEnvVar_ReturnsFalse()
    {
        // Arrange
        var service = new FirestoreService();
        var original = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");

        try
        {
            Environment.SetEnvironmentVariable("FIREBASE_PROJECT_ID", "");

            // Act
            var result = await service.InitializeAsync();

            // Assert
            Assert.False(result);
            Assert.False(service.IsConnected);
        }
        finally
        {
            Environment.SetEnvironmentVariable("FIREBASE_PROJECT_ID", original);
        }
    }
}
