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
    /// Conditionally saves the user's menu and returns the stored menu, including
    /// the server-set UpdatedAt. A mismatch with the client's expected version
    /// raises <see cref="MenuVersionConflictException"/> instead of writing. An
    /// empty selection is still persisted so that a reset propagates to other
    /// devices.
    /// </summary>
    Task<MenuResponse> SaveMenuAsync(string userId, SaveMenuPayload payload);
}
