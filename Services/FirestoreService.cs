using System.Text;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling Firestore database initialization and CRUD operations.
/// </summary>
public class FirestoreService : IFirestoreService
{
    private FirestoreDb? _db;
    private bool _initialized;

    /// <inheritdoc />
    public bool IsConnected => _initialized && _db != null;

    /// <summary>
    /// Initializes the Firebase Admin SDK and Firestore client using environment variables.
    /// </summary>
    public Task<bool> InitializeAsync()
    {
        try
        {
            var projectId = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID");

            if (string.IsNullOrEmpty(projectId))
            {
                Console.WriteLine("Firestore warning: FIREBASE_PROJECT_ID not set.");
                return Task.FromResult(false);
            }

            if (FirebaseApp.DefaultInstance == null)
            {
                var credentialsJson = Environment.GetEnvironmentVariable("GOOGLE_CREDENTIALS_JSON");
                var credential = string.IsNullOrEmpty(credentialsJson)
                    ? GoogleCredential.GetApplicationDefault()
                    : CredentialFactory.FromJson<ServiceAccountCredential>(
                        Encoding.UTF8.GetString(Convert.FromBase64String(credentialsJson))).ToGoogleCredential();

                FirebaseApp.Create(new AppOptions
                {
                    Credential = credential
                });
            }

            _db = FirestoreDb.Create(projectId);
            _initialized = true;
            Console.WriteLine("Firestore client initialized successfully.");
            return Task.FromResult(true);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Firestore initialization warning: {ex.Message}");
            _initialized = false;
            return Task.FromResult(false);
        }
    }

    // ── Dishes ──────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<List<Dish>> GetAllDishesAsync()
    {
        if (!IsConnected) return new List<Dish>();
        var snapshot = await _db!.Collection("Dishes").GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Dish>()).ToList();
    }

    /// <inheritdoc />
    public async Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since)
    {
        if (!IsConnected) return new List<Dish>();
        var query = _db!.Collection("Dishes")
            .WhereEqualTo("UserId", userId) as Query;
        if (since.HasValue)
            query = query.WhereGreaterThanOrEqualTo("UpdatedAt", since.Value);
        var snapshot = await query.GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Dish>()).ToList();
    }

    /// <inheritdoc />
    public async Task<Dish?> GetDishByIdAsync(string dishId)
    {
        if (!IsConnected) return null;
        var doc = await _db!.Collection("Dishes").Document(dishId).GetSnapshotAsync();
        return doc.Exists ? doc.ConvertTo<Dish>() : null;
    }

    /// <inheritdoc />
    public async Task<Dish> InsertDishAsync(Dish dish)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        var collection = _db!.Collection("Dishes");
        var docRef = dish.Id == null
            ? collection.Document()
            : collection.Document(dish.Id);

        if (dish.Id == null)
            dish.Id = docRef.Id;

        await docRef.SetAsync(dish);
        return dish;
    }

    /// <inheritdoc />
    public async Task UpdateDishAsync(Dish dish)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        if (dish.Id == null) throw new ArgumentException("Dish ID cannot be null.");

        await _db!.Collection("Dishes").Document(dish.Id).SetAsync(dish, SetOptions.MergeAll);
    }

    /// <inheritdoc />
    public async Task DeleteDishAsync(string dishId)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        await _db!.Collection("Dishes").Document(dishId).DeleteAsync();
    }

    // ── Users ───────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<List<User>> GetAllUsersAsync()
    {
        if (!IsConnected) return new List<User>();
        var snapshot = await _db!.Collection("Users").GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<User>()).ToList();
    }

    /// <inheritdoc />
    public async Task<User?> GetUserByIdAsync(string userId)
    {
        if (!IsConnected) return null;
        var doc = await _db!.Collection("Users").Document(userId).GetSnapshotAsync();
        return doc.Exists ? doc.ConvertTo<User>() : null;
    }

    /// <inheritdoc />
    public async Task<User> InsertUserAsync(User user, string id)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        user.Id = id;
        var docRef = _db!.Collection("Users").Document(id);
        await docRef.SetAsync(user);
        return user;
    }

    /// <inheritdoc />
    public async Task UpdateUserAsync(User user)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        if (user.Id == null) throw new ArgumentException("User ID cannot be null.");

        await _db!.Collection("Users").Document(user.Id).SetAsync(user, SetOptions.MergeAll);
    }

    /// <inheritdoc />
    public async Task DeleteUserAsync(string userId)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        await _db!.Collection("Users").Document(userId).DeleteAsync();
    }

    // ── Backups ─────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<Backup?> GetBackupByIdAsync(string backupId)
    {
        if (!IsConnected) return null;
        var doc = await _db!.Collection("Backups").Document(backupId).GetSnapshotAsync();
        return doc.Exists ? doc.ConvertTo<Backup>() : null;
    }

    /// <inheritdoc />
    public async Task<Backup> InsertBackupAsync(Backup backup)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        var collection = _db!.Collection("Backups");
        var docRef = backup.Id == null
            ? collection.Document()
            : collection.Document(backup.Id);

        if (backup.Id == null)
            backup.Id = docRef.Id;

        await docRef.SetAsync(backup);
        return backup;
    }

    /// <inheritdoc />
    public async Task DeleteBackupAsync(string backupId)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        await _db!.Collection("Backups").Document(backupId).DeleteAsync();
    }

    /// <inheritdoc />
    public async Task<List<Backup>> GetBackupsByUserIdAsync(string userId)
    {
        if (!IsConnected) return new List<Backup>();
        var snapshot = await _db!.Collection("Backups")
            .WhereEqualTo("UserId", userId)
            .GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Backup>()).ToList();
    }

    /// <inheritdoc />
    public async Task DeleteBatchAsync(string collection, IEnumerable<string> ids)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        var batch = _db!.StartBatch();
        foreach (var id in ids)
            batch.Delete(_db.Collection(collection).Document(id));
        await batch.CommitAsync();
    }

    // ── Config ──────────────────────────────────────────────────────

    /// <inheritdoc />
    public async Task<VersionInfo?> GetVersionInfoAsync()
    {
        if (!IsConnected) return null;
        var doc = await _db!.Collection("Config").Document("version").GetSnapshotAsync();
        if (!doc.Exists) return null;
        return new VersionInfo
        {
            LatestVersion = doc.GetValue<string>("LatestVersion"),
            Description = doc.GetValue<string>("Description"),
            DownloadUrl = doc.GetValue<string>("DownloadUrl")
        };
    }
}
