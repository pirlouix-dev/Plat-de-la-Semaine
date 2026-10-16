using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling the user's saved menu.
/// </summary>
public class MenuService : IMenuService
{
    private readonly IFirestoreService _firestore;

    public MenuService(IFirestoreService firestore)
    {
        _firestore = firestore;
    }

    /// <inheritdoc />
    public async Task<MenuResponse> GetMenuAsync(string userId)
    {
        var menu = await _firestore.GetMenuAsync(userId);

        // A user with no saved menu gets an empty one (UpdatedAt null), never a 404:
        // the sync engine needs a comparable timestamp on every read.
        return new MenuResponse
        {
            Data = menu ?? new Menu()
        };
    }

    /// <inheritdoc />
    public async Task<MenuResponse> SaveMenuAsync(string userId, SaveMenuPayload payload)
    {
        // The document is always written, even for an empty selection: the fresh
        // UpdatedAt is what tells other devices the menu was reset.
        var menu = new Menu
        {
            SelectedDishIds = payload.SelectedDishIds,
            Mode = payload.Mode,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        var saved = await _firestore.UpsertMenuAsync(userId, menu);

        return new MenuResponse
        {
            Data = saved
        };
    }
}
