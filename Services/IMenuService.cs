using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling the user's saved weekly menu.
/// </summary>
public interface IMenuService
{
    /// <summary>
    /// Fetches the user's saved menu, or an empty menu when none has been saved yet.
    /// </summary>
    Task<MenuResponse> GetMenuAsync(string userId);

    /// <summary>
    /// Upserts the user's saved menu, stamping a fresh server-side UpdatedAt.
    /// An empty selection is still persisted so that a reset propagates to other devices.
    /// </summary>
    Task<MenuResponse> SaveMenuAsync(string userId, SaveMenuPayload payload);
}
