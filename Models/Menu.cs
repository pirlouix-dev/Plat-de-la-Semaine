namespace PlatDeLaSemaineBack.Models;

using Google.Cloud.Firestore;

/// <summary>
/// The user's saved menu, stored as a singleton document at
/// <c>Users/{userId}/Menu/current</c>. Ownership is implicit in the path, so
/// cross-user access is impossible by construction.
/// </summary>
/// <remarks>
/// Only an explicitly saved menu is persisted, so it always represents the recap
/// view. There is no view mode to store: that is client-side state.
/// </remarks>
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
    /// Server-set timestamp of the last write, used by the client for last-write-wins.
    /// Null when the user has never saved a menu.
    /// </summary>
    [FirestoreProperty]
    public DateTimeOffset? UpdatedAt { get; set; }
}
