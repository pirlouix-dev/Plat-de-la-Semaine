using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for authentication operations.
/// </summary>
public interface IAuthService
{
    /// <summary>
    /// Registers a new user and returns authentication tokens.
    /// </summary>
    Task<AuthResponse> RegisterAsync(string email, string password, string username);

    /// <summary>
    /// Authenticates a user and returns authentication tokens.
    /// </summary>
    Task<AuthResponse> LoginAsync(string email, string password);

    /// <summary>
    /// Refreshes an expired token and returns a new id token, refresh token and its expiration.
    /// </summary>
    Task<RefreshResponse> RefreshTokenAsync(string refreshToken);

    /// <summary>
    /// Updates the username of the authenticated user.
    /// </summary>
    Task UpdateUsernameAsync(string userId, string username);

    /// <summary>
    /// Sends a password reset email to the given address.
    /// </summary>
    Task SendPasswordResetEmailAsync(string email);

    /// <summary>
    /// Deletes the user's Firebase Auth account and all associated Firestore data.
    /// </summary>
    Task DeleteAccountAsync(string userId);
}
