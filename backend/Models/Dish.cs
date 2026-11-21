namespace PlatDeLaSemaineBack.Models;

using System.ComponentModel.DataAnnotations;
using Google.Cloud.Firestore;

[FirestoreData]
public class Dish
{
    [FirestoreDocumentId]
    [Required]
    public string? Id { get; set; }

    [FirestoreProperty]
    [Required]
    public string UserId { get; set; } = string.Empty;

    [FirestoreProperty]
    public string Name { get; set; } = string.Empty;

    [FirestoreProperty]
    public string Description { get; set; } = string.Empty;

    [FirestoreProperty]
    public int Course { get; set; }

    [FirestoreProperty]
    public int[] Seasons { get; set; } = Array.Empty<int>();

    [FirestoreProperty]
    public DateTimeOffset UpdatedAt { get; set; }

    [FirestoreProperty]
    public bool IsDeleted { get; set; }
}
