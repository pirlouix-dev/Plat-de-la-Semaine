namespace PlatDeLaSemaineBack.Models;

using System.Text.Json.Serialization;
using Google.Cloud.Firestore;

/// <summary>
/// View mode of the saved menu, mirrored from the frontend.
/// </summary>
[JsonConverter(typeof(MenuModeJsonConverter))]
public enum MenuMode
{
    /// <summary>The user is picking dishes.</summary>
    [JsonStringEnumMemberName("editing")]
    Editing = 0,

    /// <summary>The user is viewing the recap of saved dishes.</summary>
    [JsonStringEnumMemberName("recap")]
    Recap = 1,
}

/// <summary>
/// Serializes <see cref="MenuMode"/> as its lowercase wire value. Rejects numeric
/// values, so <c>"1"</c> is not accepted as an alias for <see cref="MenuMode.Recap"/>.
/// </summary>
internal sealed class MenuModeJsonConverter : JsonStringEnumConverter<MenuMode>
{
    public MenuModeJsonConverter() : base(allowIntegerValues: false)
    {
    }
}

/// <summary>
/// The user's saved menu, stored as a singleton document at
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
    /// View mode of the menu, either <see cref="MenuMode.Editing"/> or <see cref="MenuMode.Recap"/>.
    /// Stored as the enum name so the document stays readable in the Firestore console.
    /// </summary>
    [FirestoreProperty(ConverterType = typeof(FirestoreEnumNameConverter<MenuMode>))]
    public MenuMode Mode { get; set; } = MenuMode.Editing;

    /// <summary>
    /// Server-set timestamp of the last write, used by the client for last-write-wins.
    /// Null when the user has never saved a menu.
    /// </summary>
    [FirestoreProperty]
    public DateTimeOffset? UpdatedAt { get; set; }
}
