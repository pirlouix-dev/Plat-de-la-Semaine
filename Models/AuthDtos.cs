using System.ComponentModel.DataAnnotations;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Request payload for registering a new account.
/// </summary>
public class RegisterPayload
{
    public required string Email { get; set; } = string.Empty;
    public required string Password { get; set; } = string.Empty;

    [StringLength(100, MinimumLength = 1)]
    public required string Username { get; set; } = string.Empty;
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
/// ExpiresIn is in seconds
/// </summary>
public class AuthResponse
{
    public required string IdToken { get; set; } = string.Empty;
    public required string RefreshToken { get; set; } = string.Empty;
    public required string ExpiresIn { get; set; } = string.Empty;
    public required string UserId { get; set; } = string.Empty;
    public required string Username { get; set; } = string.Empty;
    public bool EmailVerified { get; set; }
}

/// <summary>
/// Response from the token refresh endpoint.
/// ExpiresIn is in seconds
/// </summary>
public class RefreshResponse
{
    public required string IdToken { get; set; } = string.Empty;
    public required string RefreshToken { get; set; } = string.Empty;
    public required string ExpiresIn { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for sending a verification email.
/// </summary>
public class SendVerificationPayload
{
    public required string IdToken { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for updating the authenticated user's username.
/// </summary>
public class UpdateUsernamePayload
{
    [StringLength(100, MinimumLength = 1)]
    public required string Username { get; set; } = string.Empty;
}

/// <summary>
/// Request payload for a forgot-password email.
/// </summary>
public class ForgotPasswordPayload
{
    [Required]
    [EmailAddress]
    public required string Email { get; set; } = string.Empty;
}

/// <summary>
/// Response after deleting an account.
/// </summary>
public class AccountDeletionResponse
{
    public string Message { get; set; } = string.Empty;
}
