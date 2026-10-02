using Microsoft.Extensions.Options;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class FirestoreServiceTests
{
    private static FirestoreService CreateService(string? projectId = null)
        => new(Options.Create(new FirebaseSettings { ProjectId = projectId }));

    [Fact]
    public void IsConnected_DefaultsToFalse()
    {
        // Arrange
        var service = CreateService();

        // Assert
        Assert.False(service.IsConnected);
    }

    [Fact]
    public async Task InitializeAsync_WithoutProjectId_ReturnsFalse()
    {
        // Arrange
        var service = CreateService(projectId: null);

        // Act
        var result = await service.InitializeAsync();

        // Assert
        Assert.False(result);
        Assert.False(service.IsConnected);
    }

    [Fact]
    public async Task InsertDishAsync_WhenNotConnected_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var dish = new Dish { Name = "Test" };

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.InsertDishAsync(dish));
    }

    [Fact]
    public async Task InsertUserAsync_WhenNotConnected_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.InsertUserAsync(user, "test-id"));
    }

    [Fact]
    public async Task InitializeAsync_WithEmptyProjectId_ReturnsFalse()
    {
        // Arrange
        var service = CreateService(projectId: "");

        // Act
        var result = await service.InitializeAsync();

        // Assert
        Assert.False(result);
        Assert.False(service.IsConnected);
    }
}
