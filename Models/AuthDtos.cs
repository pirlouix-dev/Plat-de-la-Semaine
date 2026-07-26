namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Request payload for registering a new account.
/// </summary>
public class RegisterPayload
{
    public required string Email { get; set; } = string.Empty;
    public required string Password { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for logging in.
/// </summary>
public class LoginPayload
{
    public required string Email { get; set; } = string.Empty;
    public required string Password { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for refreshing an expired token.
/// </summary>
public class RefreshPayload
{
    public required string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// Response from authentication endpoints.
/// </summary>
public class AuthResponse
{
    public required string IdToken { get; set; } = string.Empty;
    public required string RefreshToken { get; set; } = string.Empty;
    public required string ExpiresIn { get; set; } = string.Empty;
    public required string UserId { get; set; } = string.Empty;
}
