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
    /// Sends an email verification message to the user associated with the given ID token.
    /// </summary>
    Task SendVerificationEmailAsync(string idToken);
}
