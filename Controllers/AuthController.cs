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
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;

    public AuthController(IAuthService authService)
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
    public async Task<IActionResult> Register([FromBody] RegisterPayload payload)
    {
        var response = await _authService.RegisterAsync(payload.Email, payload.Password);
        return Ok(response);
    }

    /// <summary>
    /// Authenticate and return a JWT.
    /// </summary>
    [HttpPost("login")]
    [EndpointSummary("Authenticate and return a JWT")]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
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
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Refresh([FromBody] RefreshPayload payload)
    {
        var response = await _authService.RefreshTokenAsync(payload.RefreshToken);
        return Ok(response);
    }
}
