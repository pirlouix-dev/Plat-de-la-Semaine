using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Authentication endpoints.
/// </summary>
[ApiController]
[Route("api/auth")]
[Tags("Auth")]
public class AuthController : BaseController
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService, ITokenVerifier tokenVerifier)
        : base(tokenVerifier)
    {
        _authService = authService;
    }

    /// <summary>
    /// Register a new account.
    /// </summary>
    [HttpPost("register")]
    [EndpointSummary("Register a new account")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Register([FromBody] RegisterPayload payload)
    {
        var response = await _authService.RegisterAsync(payload.Email, payload.Password, payload.Username);
        return Ok(response);
    }

    /// <summary>
    /// Authenticate and return a JWT.
    /// </summary>
    [HttpPost("login")]
    [EndpointSummary("Authenticate and return a JWT")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Login([FromBody] LoginPayload payload)
    {
        var response = await _authService.LoginAsync(payload.Email, payload.Password);
        return Ok(response);
    }

    /// <summary>
    /// Refresh an expired token.
    /// </summary>
    [HttpPost("refresh")]
    [EndpointSummary("Refresh an expired token")]
    [ProducesResponseType(typeof(RefreshResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Refresh([FromBody] RefreshPayload payload)
    {
        var response = await _authService.RefreshTokenAsync(payload.RefreshToken);
        return Ok(response);
    }

    /// <summary>
    /// Send a password reset email to the given address.
    /// </summary>
    [HttpPost("forgot-password")]
    [EndpointSummary("Send a password reset email")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordPayload payload)
    {
        try
        {
            await _authService.SendPasswordResetEmailAsync(payload.Email);
        }
        catch (InvalidOperationException)
        {
            // Always return 200 to prevent email enumeration.
        }

        return Ok();
    }

    /// <summary>
    /// Update the authenticated user's username.
    /// </summary>
    [HttpPut("username")]
    [EndpointSummary("Update the authenticated user's username")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> UpdateUsername([FromBody] UpdateUsernamePayload payload)
    {
        var userId = await GetUserIdAsync();
        await _authService.UpdateUsernameAsync(userId, payload.Username);
        return Ok();
    }

    /// <summary>
    /// Send a password reset email to the authenticated user.
    /// </summary>
    [HttpPost("reset-password")]
    [EndpointSummary("Send a password reset email")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ResetPassword()
    {
        var userId = await GetUserIdAsync();
        var userRecord = await FirebaseAuth.DefaultInstance.GetUserAsync(userId);
        await _authService.SendPasswordResetEmailAsync(userRecord.Email!);
        return Ok();
    }

    /// <summary>
    /// Delete the authenticated user's account and all associated data.
    /// </summary>
    [HttpDelete("account")]
    [EndpointSummary("Delete the authenticated user's account and all associated data")]
    [ProducesResponseType(typeof(AccountDeletionResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> DeleteAccount()
    {
        var userId = await GetUserIdAsync();
        await _authService.DeleteAccountAsync(userId);
        return Ok(new AccountDeletionResponse { Message = "Account deleted successfully." });
    }
}
