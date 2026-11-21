using Google.Cloud.Firestore;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// In-memory implementation of the Firestore store used by endpoint tests.
/// Dishes, users, and backups are kept per user like the real store; the menu
/// methods mirror its atomic compare-and-swap contract.
/// </summary>
public sealed class InMemoryFirestoreService : IFirestoreService
{
    private readonly object _gate = new();
    private readonly Dictionary<string, Dictionary<string, Dish>> _dishes = new();
    private readonly Dictionary<string, User> _users = new();
    private readonly Dictionary<string, Dictionary<string, Backup>> _backups = new();
    private readonly Dictionary<string, Menu> _menus = new();

    public bool IsConnected => true;

    public Task<bool> InitializeAsync() => Task.FromResult(true);

    /// <summary>
    /// Creates the user document registration would have written, so backup
    /// bookkeeping has somewhere to land.
    /// </summary>
    public void SeedUser(string userId)
    {
        lock (_gate)
        {
            _users[userId] = new User
            {
                Id = userId,
                CreatedAt = DateTimeOffset.UtcNow,
                BackupIds = []
            };
        }
    }

    // ── Dishes ──────────────────────────────────────────────────────

    public Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since)
    {
        lock (_gate)
        {
            IEnumerable<Dish> stored = _dishes.TryGetValue(userId, out var owned) ? owned.Values : [];

            return Task.FromResult(stored
                .Where(dish => since is null || dish.UpdatedAt >= since.Value)
                .Select(Clone)
                .ToList());
        }
    }

    public Task<Dish?> GetDishByIdAsync(string userId, string dishId)
    {
        lock (_gate)
        {
            if (_dishes.TryGetValue(userId, out var owned) && owned.TryGetValue(dishId, out var dish))
            {
                return Task.FromResult<Dish?>(Clone(dish));
            }

            return Task.FromResult<Dish?>(null);
        }
    }

    public Task<Dish> InsertDishAsync(Dish dish)
    {
        lock (_gate)
        {
            if (string.IsNullOrEmpty(dish.UserId))
                throw new ArgumentException("Dish UserId cannot be null or empty.");

            var id = string.IsNullOrEmpty(dish.Id) ? Guid.NewGuid().ToString("N") : dish.Id!;
            var stored = new Dish
            {
                Id = id,
                UserId = dish.UserId,
                Name = dish.Name,
                Description = dish.Description,
                Course = dish.Course,
                Seasons = [.. dish.Seasons],
                UpdatedAt = dish.UpdatedAt,
                IsDeleted = dish.IsDeleted
            };

            OwnedCollection(_dishes, dish.UserId)[id] = stored;

            return Task.FromResult(Clone(stored));
        }
    }

    public Task UpdateDishAsync(Dish dish)
    {
        lock (_gate)
        {
            if (dish.Id == null) throw new ArgumentException("Dish ID cannot be null.");
            if (string.IsNullOrEmpty(dish.UserId)) throw new ArgumentException("Dish UserId cannot be null or empty.");

            // Mirrors Firestore's SetAsync(MergeAll), which creates a missing document.
            OwnedCollection(_dishes, dish.UserId)[dish.Id] = Clone(dish);

            return Task.CompletedTask;
        }
    }

    public Task DeleteDishAsync(string userId, string dishId)
    {
        lock (_gate)
        {
            if (_dishes.TryGetValue(userId, out var owned))
                owned.Remove(dishId);

            return Task.CompletedTask;
        }
    }

    // ── Menu ────────────────────────────────────────────────────────

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

    // ── Users ───────────────────────────────────────────────────────

    public Task<User?> GetUserByIdAsync(string userId)
    {
        lock (_gate)
        {
            return Task.FromResult(_users.TryGetValue(userId, out var user) ? Clone(user) : null);
        }
    }

    public Task<User> InsertUserAsync(User user, string id)
    {
        lock (_gate)
        {
            var stored = Clone(user);
            stored.Id = id;
            _users[id] = stored;
            return Task.FromResult(Clone(stored));
        }
    }

    public Task UpdateUserAsync(User user)
    {
        lock (_gate)
        {
            if (user.Id == null) throw new ArgumentException("User ID cannot be null.");
            _users[user.Id] = Clone(user);
            return Task.CompletedTask;
        }
    }

    public Task DeleteUserAsync(string userId)
    {
        lock (_gate)
        {
            _users.Remove(userId);
            return Task.CompletedTask;
        }
    }

    // ── Backups ─────────────────────────────────────────────────────

    public Task<Backup?> GetBackupByIdAsync(string userId, string backupId)
    {
        lock (_gate)
        {
            if (_backups.TryGetValue(userId, out var owned) && owned.TryGetValue(backupId, out var backup))
            {
                return Task.FromResult<Backup?>(Clone(backup));
            }

            return Task.FromResult<Backup?>(null);
        }
    }

    public Task<Backup> InsertBackupAsync(Backup backup)
    {
        lock (_gate)
        {
            var id = string.IsNullOrEmpty(backup.Id) ? Guid.NewGuid().ToString("N") : backup.Id!;
            var stored = Clone(backup);
            stored.Id = id;
            OwnedCollection(_backups, backup.UserId)[id] = stored;
            return Task.FromResult(Clone(stored));
        }
    }

    public Task DeleteBackupAsync(string userId, string backupId)
    {
        lock (_gate)
        {
            if (_backups.TryGetValue(userId, out var owned))
                owned.Remove(backupId);

            return Task.CompletedTask;
        }
    }

    public Task<List<Backup>> GetBackupsByUserIdAsync(string userId)
    {
        lock (_gate)
        {
            IEnumerable<Backup> stored = _backups.TryGetValue(userId, out var owned) ? owned.Values : [];
            return Task.FromResult(stored.Select(Clone).ToList());
        }
    }

    public Task DeleteBatchAsync(string userId, string collection, IEnumerable<string> ids)
    {
        lock (_gate)
        {
            if (collection == "Dishes" && _dishes.TryGetValue(userId, out var dishes))
            {
                foreach (var id in ids) dishes.Remove(id);
            }
            else if (collection == "Backups" && _backups.TryGetValue(userId, out var backups))
            {
                foreach (var id in ids) backups.Remove(id);
            }

            return Task.CompletedTask;
        }
    }

    // ── Config ──────────────────────────────────────────────────────

    public Task<VersionInfo?> GetVersionInfoAsync() => throw new NotSupportedException();

    private static Dictionary<string, T> OwnedCollection<T>(Dictionary<string, Dictionary<string, T>> store, string userId)
    {
        if (!store.TryGetValue(userId, out var owned))
        {
            owned = new Dictionary<string, T>();
            store[userId] = owned;
        }

        return owned;
    }

    private static Dish Clone(Dish dish) => new()
    {
        Id = dish.Id,
        UserId = dish.UserId,
        Name = dish.Name,
        Description = dish.Description,
        Course = dish.Course,
        Seasons = [.. dish.Seasons],
        UpdatedAt = dish.UpdatedAt,
        IsDeleted = dish.IsDeleted
    };

    private static Backup Clone(Backup backup) => new()
    {
        Id = backup.Id,
        UserId = backup.UserId,
        CreatedAt = backup.CreatedAt,
        Dishes = backup.Dishes.Select(dish => new BackupDish
        {
            Id = dish.Id,
            Name = dish.Name,
            Description = dish.Description,
            Course = dish.Course,
            Seasons = [.. dish.Seasons]
        }).ToList()
    };

    private static User Clone(User user) => new()
    {
        Id = user.Id,
        CreatedAt = user.CreatedAt,
        Username = user.Username,
        BackupIds = [.. user.BackupIds]
    };

    private static Menu Clone(Menu menu) => new()
    {
        SelectedDishIds = [.. menu.SelectedDishIds],
        UpdatedAt = menu.UpdatedAt
    };
}
