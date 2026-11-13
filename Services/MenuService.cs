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
        // The write is conditional on the version the client last saw. The store
        // performs the compare-and-swap atomically and stamps the new version
        // itself: a client timestamp is never used as the new version.
        var saved = await _firestore.TrySaveMenuAsync(
            userId,
            payload.SelectedDishIds,
            payload.ExpectedUpdatedAt);

        if (saved is null)
        {
            throw new MenuVersionConflictException();
        }

        // An empty selection is still written: the fresh UpdatedAt is what tells
        // other devices the menu was cleared.
        return new MenuResponse
        {
            Data = saved
        };
    }
}
