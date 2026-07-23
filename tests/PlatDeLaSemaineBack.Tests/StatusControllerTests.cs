using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using PlatDeLaSemaineBack.Controllers;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class StatusControllerTests
{
    [Fact]
    public async Task GetStatus_FirestoreDisconnected_ReturnsDisconnected()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(false);
        var controller = new StatusController(firestore);

        // Act
        var result = await controller.GetStatus();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = okResult.Value!;
        var dbProp = json.GetType().GetProperty("database");
        Assert.Equal("disconnected", dbProp!.GetValue(json));
    }

    [Fact]
    public async Task GetStatus_FirestoreConnected_ReturnsConnectedWithCounts()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(true);
        firestore.GetAllUsersAsync().Returns(new List<User>
        {
            new() { Id = "u1", CreatedAt = DateTimeOffset.UtcNow },
            new() { Id = "u2", CreatedAt = DateTimeOffset.UtcNow }
        });
        firestore.GetAllDishesAsync().Returns(new List<Dish>
        {
            new() { Id = "d1", Name = "Dish 1", Course = 1 },
            new() { Id = "d2", Name = "Dish 2", Course = 2 },
            new() { Id = "d3", Name = "Dish 3", Course = 3 }
        });

        var controller = new StatusController(firestore);

        // Act
        var result = await controller.GetStatus();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = okResult.Value!;
        var dbProp = json.GetType().GetProperty("database");
        var usersCountProp = json.GetType().GetProperty("usersCount");
        var dishesCountProp = json.GetType().GetProperty("dishesCount");
        Assert.Equal("connected", dbProp!.GetValue(json));
        Assert.Equal(2, usersCountProp!.GetValue(json));
        Assert.Equal(3, dishesCountProp!.GetValue(json));
    }

    [Fact]
    public async Task GetStatus_FirestoreConnected_ThrowsException_ReturnsConnectedWithWarning()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(true);
        firestore.GetAllUsersAsync()
            .Returns(Task.FromException<List<User>>(new Exception("Firestore read error")));

        var controller = new StatusController(firestore);

        // Act
        var result = await controller.GetStatus();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = okResult.Value!;
        var dbProp = json.GetType().GetProperty("database");
        var warningProp = json.GetType().GetProperty("warning");
        Assert.Equal("connected", dbProp!.GetValue(json));
        Assert.NotNull(warningProp!.GetValue(json));
        Assert.Contains("Firestore read error", warningProp.GetValue(json)!.ToString());
    }

    [Fact]
    public async Task GetStatus_FirestoreDisconnected_ZeroCounts()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(false);
        var controller = new StatusController(firestore);

        // Act
        var result = await controller.GetStatus();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var json = okResult.Value!;
        var usersCountProp = json.GetType().GetProperty("usersCount");
        var dishesCountProp = json.GetType().GetProperty("dishesCount");
        Assert.Equal(0, usersCountProp!.GetValue(json));
        Assert.Equal(0, dishesCountProp!.GetValue(json));
    }
}
