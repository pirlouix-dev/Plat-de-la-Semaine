using System.Text;
using FirebaseAdmin;
using Google.Apis.Auth.OAuth2;
using Google.Cloud.Firestore;
using Microsoft.Extensions.Options;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling Firestore database initialization and CRUD operations.
/// </summary>
public class FirestoreService : IFirestoreService
{
    private readonly FirebaseSettings _settings;
    private FirestoreDb? _db;
    private bool _initialized;

    public FirestoreService(IOptions<FirebaseSettings> settings)
    {
        _settings = settings.Value;
    }

    /// <inheritdoc />
    public bool IsConnected => _initialized && _db != null;

    /// <summary>
    /// Initializes the Firebase Admin SDK and Firestore client using the configured settings.
    /// </summary>
    public Task<bool> InitializeAsync()
    {
        try
        {
            var projectId = _settings.ProjectId;

            if (string.IsNullOrEmpty(projectId))
            {
                Console.WriteLine("Firestore warning: FIREBASE_PROJECT_ID not set.");
                return Task.FromResult(false);
            }

            if (FirebaseApp.DefaultInstance == null)
            {
                var credentialsJson = _settings.CredentialsJson;
                var credential = string.IsNullOrEmpty(credentialsJson)
                    ? GoogleCredential.GetApplicationDefault()
                    : CredentialFactory.FromJson<ServiceAccountCredential>(
                        Encoding.UTF8.GetString(Convert.FromBase64String(credentialsJson))).ToGoogleCredential();

                FirebaseApp.Create(new AppOptions()
                {
                    Credential = credential
                });
                _db = new FirestoreDbBuilder
                {
                    ProjectId = projectId,
                    Credential = credential
                }.Build();
            }
            else
            {
                _db = FirestoreDb.Create(projectId);
            }

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

    /// <summary>
    /// Returns the Dishes subcollection for a user, keeping ownership implicit
    /// in the document path so cross-user access is impossible by construction.
    /// </summary>
    private CollectionReference DishesCollection(string userId)
        => _db!.Collection("Users").Document(userId).Collection("Dishes");

    /// <inheritdoc />
    public async Task<List<Dish>> GetDishesByUserIdAsync(string userId, DateTimeOffset? since)
    {
        if (!IsConnected) return new List<Dish>();
        Query query = DishesCollection(userId);
        if (since.HasValue)
            query = query.WhereGreaterThanOrEqualTo("UpdatedAt", since.Value);
        var snapshot = await query.GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Dish>()).ToList();
    }

    /// <inheritdoc />
    public async Task<Dish?> GetDishByIdAsync(string userId, string dishId)
    {
        if (!IsConnected) return null;
        var doc = await DishesCollection(userId).Document(dishId).GetSnapshotAsync();
        return doc.Exists ? doc.ConvertTo<Dish>() : null;
    }

    /// <inheritdoc />
    public async Task<Dish> InsertDishAsync(Dish dish)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        if (string.IsNullOrEmpty(dish.UserId)) throw new ArgumentException("Dish UserId cannot be null or empty.");

        var collection = DishesCollection(dish.UserId);
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
        if (string.IsNullOrEmpty(dish.UserId)) throw new ArgumentException("Dish UserId cannot be null or empty.");

        await DishesCollection(dish.UserId).Document(dish.Id).SetAsync(dish, SetOptions.MergeAll);
    }

    /// <inheritdoc />
    public async Task DeleteDishAsync(string userId, string dishId)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        await DishesCollection(userId).Document(dishId).DeleteAsync();
    }

    // ── Users ───────────────────────────────────────────────────────

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

    /// <summary>
    /// Returns the Backups subcollection for a user, keeping ownership implicit
    /// in the document path so cross-user access is impossible by construction.
    /// </summary>
    private CollectionReference BackupsCollection(string userId)
        => _db!.Collection("Users").Document(userId).Collection("Backups");

    /// <inheritdoc />
    public async Task<Backup?> GetBackupByIdAsync(string userId, string backupId)
    {
        if (!IsConnected) return null;
        var doc = await BackupsCollection(userId).Document(backupId).GetSnapshotAsync();
        return doc.Exists ? doc.ConvertTo<Backup>() : null;
    }

    /// <inheritdoc />
    public async Task<Backup> InsertBackupAsync(Backup backup)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        if (string.IsNullOrEmpty(backup.UserId)) throw new ArgumentException("Backup UserId cannot be null or empty.");

        var collection = BackupsCollection(backup.UserId);
        var docRef = backup.Id == null
            ? collection.Document()
            : collection.Document(backup.Id);

        if (backup.Id == null)
            backup.Id = docRef.Id;

        await docRef.SetAsync(backup);
        return backup;
    }

    /// <inheritdoc />
    public async Task DeleteBackupAsync(string userId, string backupId)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");
        await BackupsCollection(userId).Document(backupId).DeleteAsync();
    }

    /// <inheritdoc />
    public async Task<List<Backup>> GetBackupsByUserIdAsync(string userId)
    {
        if (!IsConnected) return new List<Backup>();
        var snapshot = await BackupsCollection(userId).GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Backup>()).ToList();
    }

    /// <inheritdoc />
    public async Task DeleteBatchAsync(string userId, string collection, IEnumerable<string> ids)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        var subcollection = _db!.Collection("Users").Document(userId).Collection(collection);
        var batch = _db.StartBatch();
        foreach (var id in ids)
            batch.Delete(subcollection.Document(id));
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
            LatestVersion = doc.GetValue<string>("LatestVersion")
        };
    }
}
