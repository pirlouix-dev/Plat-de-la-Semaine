namespace PlatDeLaSemaineBack.Models;

using Google.Cloud.Firestore;

[FirestoreData]
public class User
{
    [FirestoreDocumentId]
    public string? Id { get; set; }

    [FirestoreProperty]
    public DateTimeOffset CreatedAt { get; set; }

    [FirestoreProperty]
    public string Username { get; set; } = string.Empty;

    [FirestoreProperty]
    public List<string> BackupIds { get; set; } = new();
}
