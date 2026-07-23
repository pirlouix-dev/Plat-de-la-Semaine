namespace PlatDeLaSemaineBack.Models;

using Google.Cloud.Firestore;

[FirestoreData]
public class Dish
{
    [FirestoreDocumentId]
    public string? Id { get; set; }

    [FirestoreProperty]
    public int Version { get; set; } = 0;

    [FirestoreProperty]
    public string UserId { get; set; } = string.Empty;

    [FirestoreProperty]
    public string Name { get; set; } = string.Empty;

    [FirestoreProperty]
    public string Description { get; set; } = string.Empty;

    [FirestoreProperty]
    public long Course { get; set; }

    [FirestoreProperty]
    public int[] Seasons { get; set; } = Array.Empty<int>();

    [FirestoreProperty]
    public DateTimeOffset UpdatedAt { get; set; }

    [FirestoreProperty]
    public bool IsDeleted { get; set; }
}
