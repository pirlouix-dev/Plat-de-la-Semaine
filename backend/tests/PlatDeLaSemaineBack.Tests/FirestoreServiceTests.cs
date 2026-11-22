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

    [Fact]
    public async Task GetDishesByUserIdAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetDishesByUserIdAsync("user1", null));
    }

    [Fact]
    public async Task GetDishByIdAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetDishByIdAsync("user1", "dish1"));
    }

    [Fact]
    public async Task GetMenuAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetMenuAsync("user1"));
    }

    [Fact]
    public async Task GetUserByIdAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetUserByIdAsync("user1"));
    }

    [Fact]
    public async Task GetBackupByIdAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetBackupByIdAsync("user1", "backup1"));
    }

    [Fact]
    public async Task GetBackupsByUserIdAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetBackupsByUserIdAsync("user1"));
    }

    [Fact]
    public async Task GetVersionInfoAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.GetVersionInfoAsync());
    }

    [Fact]
    public async Task InsertDishAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();
        var dish = new Dish { Name = "Test" };

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.InsertDishAsync(dish));
    }

    [Fact]
    public async Task TryInsertDishAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();
        var dish = new Dish { Name = "Test" };

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.TryInsertDishAsync(dish));
    }

    [Fact]
    public async Task InsertUserAsync_WhenNotConnected_Throws()
    {
        // Arrange
        var service = CreateService();
        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        // Act & Assert
        await Assert.ThrowsAsync<FirestoreUnavailableException>(
            () => service.InsertUserAsync(user, "test-id"));
    }
}
