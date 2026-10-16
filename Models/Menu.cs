namespace PlatDeLaSemaineBack.Models;

using Google.Cloud.Firestore;

/// <summary>
/// The allowed values for <see cref="Menu.Mode"/>, mirrored from the frontend view mode.
/// </summary>
public static class MenuMode
{
    /// <summary>The user is picking dishes.</summary>
    public const string Editing = "editing";

    /// <summary>The user is viewing the "Plats sauvegardés" recap.</summary>
    public const string Recap = "recap";

    /// <summary>All valid modes.</summary>
    public static readonly string[] All = [Editing, Recap];
}

/// <summary>
/// The user's saved weekly menu, stored as a singleton document at
/// <c>Users/{userId}/Menu/current</c>. Ownership is implicit in the path, so
/// cross-user access is impossible by construction.
/// </summary>
[FirestoreData]
public class Menu
{
    /// <summary>
    /// Ids of the selected dishes, in display order. Empty when the menu was reset.
    /// Ids live in the same namespace as the dishes returned by <c>/api/dishes</c>.
    /// </summary>
    [FirestoreProperty]
    public List<string> SelectedDishIds { get; set; } = new();

    /// <summary>
    /// Frontend view mode, either <see cref="MenuMode.Editing"/> or <see cref="MenuMode.Recap"/>.
    /// </summary>
    [FirestoreProperty]
    public string Mode { get; set; } = MenuMode.Editing;

    /// <summary>
    /// Server-set timestamp of the last write, used by the client for last-write-wins.
    /// Null when the user has never saved a menu.
    /// </summary>
    [FirestoreProperty]
    public DateTimeOffset? UpdatedAt { get; set; }
}
