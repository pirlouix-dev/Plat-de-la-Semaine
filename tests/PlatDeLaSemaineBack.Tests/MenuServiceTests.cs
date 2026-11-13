using NSubstitute;
using NSubstitute.ReturnsExtensions;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class MenuServiceTests
{
    private readonly InMemoryFirestoreService _firestore = new();
    private readonly MenuService _service;

    public MenuServiceTests()
    {
        _service = new MenuService(_firestore);
    }

    [Fact]
    public async Task GetMenu_ReturnsStoredMenu()
    {
        // Arrange
        var userId = "user1";
        var updatedAt = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero);
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetMenuAsync(userId).Returns(new Menu
        {
            SelectedDishIds = ["42", "57"],
            UpdatedAt = updatedAt
        });
        var service = new MenuService(firestore);

        // Act
        var result = await service.GetMenuAsync(userId);

        // Assert
        Assert.Equal(new[] { "42", "57" }, result.Data.SelectedDishIds);
        Assert.Equal(updatedAt, result.Data.UpdatedAt);
    }

    [Fact]
    public async Task GetMenu_WhenNoneSaved_ReturnsEmptyMenuWithNullUpdatedAt()
    {
        // Act
        var result = await _service.GetMenuAsync("user1");

        // Assert
        Assert.Empty(result.Data.SelectedDishIds);
        Assert.Null(result.Data.UpdatedAt);
    }

    [Fact]
    public async Task GetMenu_WhenFirestoreUnavailable_PropagatesInsteadOfReturningEmpty()
    {
        // Arrange
        // An empty menu means "the user reset it", so a Firestore outage must not be
        // reported as an empty menu: the client would erase its local copy.
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetMenuAsync("user1").Returns(
            _ => Task.FromException<Menu?>(new InvalidOperationException("Firestore client is not initialized.")));
        var service = new MenuService(firestore);

        // Act & Assert
        await Assert.ThrowsAsync<InvalidOperationException>(() => service.GetMenuAsync("user1"));
    }

    [Fact]
    public async Task SaveMenu_WithNullExpectation_CreatesMenu()
    {
        // Act
        var result = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42", "57"],
            ExpectedUpdatedAt = null
        });

        // Assert
        Assert.Equal(new[] { "42", "57" }, result.Data.SelectedDishIds);
        Assert.NotNull(result.Data.UpdatedAt);

        var stored = await _firestore.GetMenuAsync("user1");
        Assert.NotNull(stored);
        Assert.Equal(result.Data.UpdatedAt, stored!.UpdatedAt);
    }

    [Fact]
    public async Task SaveMenu_WithCurrentVersion_UpdatesAndBumpsUpdatedAt()
    {
        // Arrange
        var created = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42"],
            ExpectedUpdatedAt = null
        });

        // Act
        var updated = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["57"],
            ExpectedUpdatedAt = created.Data.UpdatedAt
        });

        // Assert
        Assert.Equal(new[] { "57" }, updated.Data.SelectedDishIds);
        Assert.True(updated.Data.UpdatedAt > created.Data.UpdatedAt);
    }

    [Fact]
    public async Task SaveMenu_WithStaleVersion_ThrowsConflictAndLeavesMenuUnchanged()
    {
        // Arrange
        var created = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42"],
            ExpectedUpdatedAt = null
        });
        var newer = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["57"],
            ExpectedUpdatedAt = created.Data.UpdatedAt
        });

        // Act & Assert
        await Assert.ThrowsAsync<MenuVersionConflictException>(() => _service.SaveMenuAsync(
            "user1",
            new SaveMenuPayload
            {
                SelectedDishIds = ["99"],
                ExpectedUpdatedAt = created.Data.UpdatedAt
            }));

        var stored = await _firestore.GetMenuAsync("user1");
        Assert.Equal(new[] { "57" }, stored!.SelectedDishIds);
        Assert.Equal(newer.Data.UpdatedAt, stored.UpdatedAt);
    }

    [Fact]
    public async Task SaveMenu_WithNullExpectationWhenMenuExists_ThrowsConflict()
    {
        // Arrange
        await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42"],
            ExpectedUpdatedAt = null
        });

        // Act & Assert
        await Assert.ThrowsAsync<MenuVersionConflictException>(() => _service.SaveMenuAsync(
            "user1",
            new SaveMenuPayload
            {
                SelectedDishIds = ["57"],
                ExpectedUpdatedAt = null
            }));
    }

    [Fact]
    public async Task SaveMenu_WithVersionWhenNoMenuExists_ThrowsConflict()
    {
        // Act & Assert
        await Assert.ThrowsAsync<MenuVersionConflictException>(() => _service.SaveMenuAsync(
            "user1",
            new SaveMenuPayload
            {
                SelectedDishIds = ["57"],
                ExpectedUpdatedAt = DateTimeOffset.UtcNow
            }));
    }

    [Fact]
    public async Task SaveMenu_WithEmptySelection_StillPersistsAVersionedMenu()
    {
        // Arrange
        var created = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42"],
            ExpectedUpdatedAt = null
        });

        // Act
        var cleared = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = [],
            ExpectedUpdatedAt = created.Data.UpdatedAt
        });

        // Assert
        Assert.Empty(cleared.Data.SelectedDishIds);
        Assert.NotNull(cleared.Data.UpdatedAt);
        Assert.True(cleared.Data.UpdatedAt > created.Data.UpdatedAt);

        // A clear must leave a record behind: the fresh version is what propagates
        // the reset to the user's other devices.
        var stored = await _firestore.GetMenuAsync("user1");
        Assert.NotNull(stored);
        Assert.Empty(stored!.SelectedDishIds);
        Assert.NotNull(stored.UpdatedAt);
    }

    [Fact]
    public async Task SaveMenu_PreservesOrderAndDuplicates()
    {
        // Act
        var result = await _service.SaveMenuAsync("user1", new SaveMenuPayload
        {
            SelectedDishIds = ["42", "7", "42"],
            ExpectedUpdatedAt = null
        });

        // Assert
        Assert.Equal(new[] { "42", "7", "42" }, result.Data.SelectedDishIds);
        var stored = await _firestore.GetMenuAsync("user1");
        Assert.Equal(new[] { "42", "7", "42" }, stored!.SelectedDishIds);
    }

    [Fact]
    public async Task SaveMenu_AlwaysScopesToAuthenticatedUser()
    {
        // Act
        await _service.SaveMenuAsync("owner", new SaveMenuPayload
        {
            SelectedDishIds = ["1"],
            ExpectedUpdatedAt = null
        });

        // Assert
        Assert.NotNull(await _firestore.GetMenuAsync("owner"));
        Assert.Null(await _firestore.GetMenuAsync("someone-else"));
    }

    [Fact]
    public async Task SaveMenu_SuccessiveWrites_HaveStrictlyIncreasingVersions()
    {
        // Arrange
        DateTimeOffset? expected = null;
        var versions = new List<DateTimeOffset>();

        // Act
        for (var i = 0; i < 8; i++)
        {
            var result = await _service.SaveMenuAsync("user1", new SaveMenuPayload
            {
                SelectedDishIds = [i.ToString()],
                ExpectedUpdatedAt = expected
            });

            versions.Add(result.Data.UpdatedAt!.Value);
            expected = result.Data.UpdatedAt;
        }

        // Assert
        for (var i = 1; i < versions.Count; i++)
        {
            Assert.True(versions[i] > versions[i - 1]);
        }
    }

    [Fact]
    public async Task GetMenu_AlwaysScopesToAuthenticatedUser()
    {
        // Arrange
        await _service.SaveMenuAsync("owner", new SaveMenuPayload
        {
            SelectedDishIds = ["1"],
            ExpectedUpdatedAt = null
        });

        // Act
        var owned = await _service.GetMenuAsync("owner");
        var other = await _service.GetMenuAsync("someone-else");

        // Assert
        Assert.Equal(new[] { "1" }, owned.Data.SelectedDishIds);
        Assert.Empty(other.Data.SelectedDishIds);
        Assert.Null(other.Data.UpdatedAt);
    }
}
