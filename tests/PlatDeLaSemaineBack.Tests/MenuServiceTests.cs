using NSubstitute;
using NSubstitute.ReturnsExtensions;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class MenuServiceTests
{
    private readonly IFirestoreService _firestore;
    private readonly MenuService _service;

    public MenuServiceTests()
    {
        _firestore = Substitute.For<IFirestoreService>();
        _service = new MenuService(_firestore);
    }

    [Fact]
    public async Task GetMenu_ReturnsStoredMenu()
    {
        // Arrange
        var userId = "user1";
        var updatedAt = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero);
        _firestore.GetMenuAsync(userId).Returns(new Menu
        {
            SelectedDishIds = ["42", "57"],
            Mode = MenuMode.Recap,
            UpdatedAt = updatedAt
        });

        // Act
        var result = await _service.GetMenuAsync(userId);

        // Assert
        Assert.Equal(new[] { "42", "57" }, result.Data.SelectedDishIds);
        Assert.Equal(MenuMode.Recap, result.Data.Mode);
        Assert.Equal(updatedAt, result.Data.UpdatedAt);
    }
    [Fact]
    public async Task GetMenu_WhenNoneSaved_ReturnsEmptyMenuWithNullUpdatedAt()
    {
        // Arrange
        _firestore.GetMenuAsync("user1").ReturnsNull();

        // Act
        var result = await _service.GetMenuAsync("user1");

        // Assert
        Assert.Empty(result.Data.SelectedDishIds);
        Assert.Equal(MenuMode.Editing, result.Data.Mode);
        Assert.Null(result.Data.UpdatedAt);
    }

    [Fact]
    public async Task GetMenu_WhenFirestoreUnavailable_PropagatesInsteadOfReturningEmpty()
    {
        // Arrange
        // An empty menu means "the user reset it", so a Firestore outage must not be
        // reported as an empty menu: the client would erase its local copy.
        _firestore.GetMenuAsync("user1").Returns(
            _ => Task.FromException<Menu?>(new InvalidOperationException("Firestore client is not initialized.")));

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => _service.GetMenuAsync("user1"));
    }

    [Fact]
    public async Task SaveMenu_UpsertsAndStampsUpdatedAt()
    {
        // Arrange
        var userId = "user1";
        var before = DateTimeOffset.UtcNow;
        _firestore.UpsertMenuAsync(userId, Arg.Any<Menu>()).Returns(call => call.Arg<Menu>());

        // Act
        var result = await _service.SaveMenuAsync(userId, new SaveMenuPayload
        {
            SelectedDishIds = ["42", "57"],
            Mode = MenuMode.Recap
        });

        // Assert
        Assert.Equal(new[] { "42", "57" }, result.Data.SelectedDishIds);
        Assert.Equal(MenuMode.Recap, result.Data.Mode);
        Assert.NotNull(result.Data.UpdatedAt);
        Assert.True(result.Data.UpdatedAt >= before);

        await _firestore.Received(1).UpsertMenuAsync(
            userId,
            Arg.Is<Menu>(menu => menu.SelectedDishIds.Count == 2 && menu.Mode == MenuMode.Recap));
    }

    [Fact]
    public async Task SaveMenu_WithEmptySelection_StillPersistsAndBumpsUpdatedAt()
    {
        // Arrange
        var userId = "user1";
        _firestore.UpsertMenuAsync(userId, Arg.Any<Menu>()).Returns(call => call.Arg<Menu>());

        // Act
        var result = await _service.SaveMenuAsync(userId, new SaveMenuPayload
        {
            SelectedDishIds = [],
            Mode = MenuMode.Editing
        });

        // Assert
        Assert.Empty(result.Data.SelectedDishIds);
        Assert.NotNull(result.Data.UpdatedAt);

        // A reset must write the document, never delete it: the fresh UpdatedAt is
        // what propagates the reset to the user's other devices.
        await _firestore.Received(1).UpsertMenuAsync(
            userId,
            Arg.Is<Menu>(menu => menu.SelectedDishIds.Count == 0 && menu.UpdatedAt != null));
    }

    [Fact]
    public async Task SaveMenu_AlwaysScopesToAuthenticatedUser()
    {
        // Arrange
        _firestore.UpsertMenuAsync(Arg.Any<string>(), Arg.Any<Menu>()).Returns(call => call.Arg<Menu>());

        // Act
        await _service.SaveMenuAsync("owner", new SaveMenuPayload
        {
            SelectedDishIds = ["1"],
            Mode = MenuMode.Editing
        });

        // Assert
        await _firestore.Received(1).UpsertMenuAsync("owner", Arg.Any<Menu>());
        await _firestore.DidNotReceive().UpsertMenuAsync(
            Arg.Is<string>(id => id != "owner"),
            Arg.Any<Menu>());
    }

    [Fact]
    public async Task GetMenu_AlwaysScopesToAuthenticatedUser()
    {
        // Arrange
        _firestore.GetMenuAsync(Arg.Any<string>()).ReturnsNull();

        // Act
        await _service.GetMenuAsync("owner");

        // Assert
        await _firestore.Received(1).GetMenuAsync("owner");
        await _firestore.DidNotReceive().GetMenuAsync(Arg.Is<string>(id => id != "owner"));
    }
}
