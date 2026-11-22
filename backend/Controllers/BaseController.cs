using System.Net;
using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Base controller providing Firebase Auth helper for authenticated endpoints.
/// </summary>
[ApiController]
public abstract class BaseController : ControllerBase
{
    private readonly ITokenVerifier _tokenVerifier;

    protected BaseController(ITokenVerifier tokenVerifier)
    {
        _tokenVerifier = tokenVerifier;
    }

    /// <summary>
    /// Extracts and verifies the Firebase ID token from the Authorization header.
    /// Returns the authenticated user's UID.
    /// </summary>
    protected async Task<string> GetUserIdAsync()
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            throw new ApiException(
                HttpStatusCode.Unauthorized,
                ApiErrorCodes.MissingToken,
                "Missing or invalid authorization header.");

        var token = authHeader["Bearer ".Length..];

        return await _tokenVerifier.VerifyAsync(token);
    }
}
