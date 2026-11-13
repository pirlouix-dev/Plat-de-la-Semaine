using Google.Cloud.Firestore;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// In-memory implementation of the menu store used by endpoint tests. The menu
/// methods mirror the atomic compare-and-swap contract of the Firestore store;
/// all other operations are intentionally unsupported.
/// </summary>
public sealed class InMemoryFirestoreService : IFirestoreService
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Menu> _menus = new();

    public bool IsConnected => true;

    public Task<bool> InitializeAsync() => Task.FromResult(true);

    public Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since)
        => throw new NotSupportedException();

    public Task<Dish?> GetDishByIdAsync(string userId, string dishId)
        => throw new NotSupportedException();

    public Task<Dish> InsertDishAsync(Dish dish)
        => throw new NotSupportedException();

    public Task UpdateDishAsync(Dish dish)
        => throw new NotSupportedException();

    public Task DeleteDishAsync(string userId, string dishId)
        => throw new NotSupportedException();

    public Task<Menu?> GetMenuAsync(string userId)
    {
        lock (_gate)
        {
            return Task.FromResult(_menus.TryGetValue(userId, out var menu) ? Clone(menu) : null);
        }
    }

    public Task<Menu?> TrySaveMenuAsync(
        string userId,
        IReadOnlyList<string> selectedDishIds,
        DateTimeOffset? expectedUpdatedAt)
    {
        lock (_gate)
        {
            _menus.TryGetValue(userId, out var current);

            var matches = expectedUpdatedAt is null
                ? current is null
                : current?.UpdatedAt is { } currentUpdatedAt
                    && currentUpdatedAt.ToUniversalTime() == expectedUpdatedAt.Value.ToUniversalTime();

            if (!matches)
            {
                return Task.FromResult<Menu?>(null);
            }

            var saved = new Menu
            {
                SelectedDishIds = [.. selectedDishIds],
                // Mirror Firestore, which truncates timestamps to microseconds on
                // write. Tests then catch a version that cannot be reused.
                UpdatedAt = Timestamp
                    .FromDateTimeOffset(MenuVersion.Next(DateTimeOffset.UtcNow, current?.UpdatedAt))
                    .ToDateTimeOffset()
            };

            _menus[userId] = saved;
            return Task.FromResult<Menu?>(Clone(saved));
        }
    }

    public Task<User?> GetUserByIdAsync(string userId)
        => throw new NotSupportedException();

    public Task<User> InsertUserAsync(User user, string id)
        => throw new NotSupportedException();

    public Task UpdateUserAsync(User user)
        => throw new NotSupportedException();

    public Task DeleteUserAsync(string userId)
        => throw new NotSupportedException();

    public Task<Backup?> GetBackupByIdAsync(string userId, string backupId)
        => throw new NotSupportedException();

    public Task<Backup> InsertBackupAsync(Backup backup)
        => throw new NotSupportedException();

    public Task DeleteBackupAsync(string userId, string backupId)
        => throw new NotSupportedException();

    public Task<List<Backup>> GetBackupsByUserIdAsync(string userId)
        => throw new NotSupportedException();

    public Task DeleteBatchAsync(string userId, string collection, IEnumerable<string> ids)
        => throw new NotSupportedException();

    public Task<VersionInfo?> GetVersionInfoAsync()
        => throw new NotSupportedException();

    private static Menu Clone(Menu menu) => new()
    {
        SelectedDishIds = [.. menu.SelectedDishIds],
        UpdatedAt = menu.UpdatedAt
    };
}
