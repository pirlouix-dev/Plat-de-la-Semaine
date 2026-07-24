using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// End-to-end tests for FirestoreService against the Firestore emulator.
///
/// Prerequisites:
///   1. Start the Firestore emulator:
///      gcloud beta emulators firestore start --project=test-e2e --host-port=localhost:8080
///   2. Set the environment variable: FIRESTORE_EMULATOR_HOST=localhost:8080
///   3. Ensure GOOGLE_APPLICATION_CREDENTIALS is set (or gcloud ADC is configured)
///
/// Run with: dotnet test --filter Category=E2E
/// </summary>
public class FirestoreServiceE2ETests : IAsyncLifetime
{
    private FirestoreService? _firestore;

    public async Task InitializeAsync()
    {
        var emulatorHost = Environment.GetEnvironmentVariable("FIRESTORE_EMULATOR_HOST");
        if (string.IsNullOrEmpty(emulatorHost))
            return;

        Environment.SetEnvironmentVariable("FIREBASE_PROJECT_ID", "test-e2e");
        _firestore = new FirestoreService();
        var connected = await _firestore.InitializeAsync();
        if (!connected)
            _firestore = null;
    }

    public Task DisposeAsync() => Task.CompletedTask;

    private static string TestId(string prefix) => $"{prefix}-{Guid.NewGuid():N}";

    private bool SkipIfNotConnected() => _firestore == null || !_firestore.IsConnected;

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertUserAsync_WithValidUser_ReturnsWithGeneratedId()
    {
        if (SkipIfNotConnected()) return;

        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        var result = await _firestore!.InsertUserAsync(user, TestId("e2e-user"));

        Assert.NotNull(result.Id);
        Assert.NotEmpty(result.Id);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertUserAsync_WithKnownId_ReturnsWithSameId()
    {
        if (SkipIfNotConnected()) return;

        var userId = TestId("e2e-user");
        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        var result = await _firestore!.InsertUserAsync(user, userId);

        Assert.Equal(userId, result.Id);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertUserAsync_ThenGetAllUsers_ContainsInsertedUser()
    {
        if (SkipIfNotConnected()) return;

        var userId = TestId("e2e-user");
        var user = new User { CreatedAt = DateTimeOffset.UtcNow };

        await _firestore!.InsertUserAsync(user, userId);
        var allUsers = await _firestore.GetAllUsersAsync();

        Assert.Contains(allUsers, u => u.Id == userId);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertUserAsync_ThenGetAll_PreservesCreatedAt()
    {
        if (SkipIfNotConnected()) return;

        var now = DateTimeOffset.UtcNow;
        var userId = TestId("e2e-user");
        var user = new User { CreatedAt = now };

        await _firestore!.InsertUserAsync(user, userId);
        var allUsers = await _firestore.GetAllUsersAsync();

        var inserted = allUsers.First(u => u.Id == userId);
        Assert.Equal(now, inserted.CreatedAt);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_WithValidDish_ReturnsWithGeneratedId()
    {
        if (SkipIfNotConnected()) return;

        var dish = new Dish
        {
            Name = "E2E Test Dish",
            Description = "Created by E2E test",
            Course = 1,
            Seasons = new[] { 1, 2 },
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var result = await _firestore!.InsertDishAsync(dish);

        Assert.NotNull(result.Id);
        Assert.NotEmpty(result.Id);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_WithKnownId_ReturnsWithSameId()
    {
        if (SkipIfNotConnected()) return;

        var dishId = TestId("e2e-dish");
        var dish = new Dish
        {
            Id = dishId,
            Name = "E2E Test Dish",
            Description = "Created by E2E test",
            Course = 2,
            Seasons = new[] { 3, 4 },
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var result = await _firestore!.InsertDishAsync(dish);

        Assert.Equal(dishId, result.Id);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_ThenGetAllDishes_ContainsInsertedDish()
    {
        if (SkipIfNotConnected()) return;

        var dishId = TestId("e2e-dish");
        var dish = new Dish
        {
            Id = dishId,
            Name = "E2E Test Dish",
            Description = "Created by E2E test",
            Course = 1,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _firestore!.InsertDishAsync(dish);
        var allDishes = await _firestore.GetAllDishesAsync();

        Assert.Contains(allDishes, d => d.Id == dishId);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_ThenGetAll_PreservesAllProperties()
    {
        if (SkipIfNotConnected()) return;

        var dishId = TestId("e2e-dish");
        var now = DateTimeOffset.UtcNow;
        var dish = new Dish
        {
            Id = dishId,
            Name = "Full Dish Test",
            Description = "Testing all properties",
            Course = 3,
            Seasons = new[] { 1, 2, 3 },
            UpdatedAt = now
        };

        await _firestore!.InsertDishAsync(dish);
        var allDishes = await _firestore.GetAllDishesAsync();

        var inserted = allDishes.First(d => d.Id == dishId);
        Assert.Equal("Full Dish Test", inserted.Name);
        Assert.Equal("Testing all properties", inserted.Description);
        Assert.Equal(3, inserted.Course);
        Assert.Equal(new[] { 1, 2, 3 }, inserted.Seasons);
        Assert.Equal(now, inserted.UpdatedAt);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_OverwritesExistingDocument()
    {
        if (SkipIfNotConnected()) return;

        var dishId = TestId("e2e-dish");
        var dish1 = new Dish
        {
            Id = dishId,
            Name = "Original Name",
            Course = 1,
            UpdatedAt = DateTimeOffset.UtcNow
        };
        var dish2 = new Dish
        {
            Id = dishId,
            Name = "Updated Name",
            Course = 2,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await _firestore!.InsertDishAsync(dish1);
        await _firestore.InsertDishAsync(dish2);
        var allDishes = await _firestore.GetAllDishesAsync();

        var matching = allDishes.Where(d => d.Id == dishId).ToList();
        Assert.Single(matching);
        Assert.Equal("Updated Name", matching[0].Name);
    }

    [Fact]
    [Trait("Category", "E2E")]
    public async Task InsertDishAsync_WithNullId_GeneratesIdAutomatically()
    {
        if (SkipIfNotConnected()) return;

        var dish = new Dish
        {
            Name = "Auto-ID Dish",
            Course = 1,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var result = await _firestore!.InsertDishAsync(dish);

        Assert.NotNull(result.Id);
        Assert.NotEmpty(result.Id);
    }
}
