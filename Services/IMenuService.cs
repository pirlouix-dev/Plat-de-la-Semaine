using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling the user's saved menu.
/// </summary>
public interface IMenuService
{
    /// <summary>
    /// Fetches the user's saved menu, or an empty menu when none has been saved yet.
    /// </summary>
    Task<MenuResponse> GetMenuAsync(string userId);

    /// <summary>
    /// Upserts the user's saved menu and returns the stored menu, including the
    /// server-set UpdatedAt. An empty selection is still persisted so that a reset
    /// propagates to other devices.
    /// </summary>
    Task<MenuResponse> SaveMenuAsync(string userId, SaveMenuPayload payload);
}
