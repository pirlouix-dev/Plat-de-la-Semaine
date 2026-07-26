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
    Task<AuthResponse> RegisterAsync(string email, string password);

    /// <summary>
    /// Authenticates a user and returns authentication tokens.
    /// </summary>
    Task<AuthResponse> LoginAsync(string email, string password);

    /// <summary>
    /// Refreshes an expired token and returns new authentication tokens.
    /// </summary>
    Task<AuthResponse> RefreshTokenAsync(string refreshToken);
}
