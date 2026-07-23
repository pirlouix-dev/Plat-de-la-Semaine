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
    /// Returns true if initialization succeeded, false otherwise.
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
                FirebaseApp.Create(new AppOptions
                {
                    Credential = GoogleCredential.GetApplicationDefault()
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

    /// <inheritdoc />
    public async Task<List<Dish>> GetAllDishesAsync()
    {
        if (!IsConnected) return new List<Dish>();
        var snapshot = await _db!.Collection("Dishes").GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<Dish>()).ToList();
    }

    /// <inheritdoc />
    public async Task<List<User>> GetAllUsersAsync()
    {
        if (!IsConnected) return new List<User>();
        var snapshot = await _db!.Collection("Users").GetSnapshotAsync();
        return snapshot.Documents.Select(doc => doc.ConvertTo<User>()).ToList();
    }

    /// <inheritdoc />
    public async Task<User> InsertUserAsync(User user)
    {
        if (!IsConnected) throw new InvalidOperationException("Firestore client is not initialized.");

        var collection = _db!.Collection("Users");
        var docRef = user.Id == null
            ? collection.Document()
            : collection.Document(user.Id);

        if (user.Id == null)
            user.Id = docRef.Id;

        await docRef.SetAsync(user);
        return user;
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
}
