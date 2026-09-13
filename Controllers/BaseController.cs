using FirebaseAdmin.Auth;
using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Base controller providing Firebase Auth helper for authenticated endpoints.
/// </summary>
[ApiController]
public abstract class BaseController : ControllerBase
{
    /// <summary>
    /// Extracts and verifies the Firebase ID token from the Authorization header.
    /// Returns the authenticated user's UID.
    /// </summary>
    protected async Task<string> GetUserIdAsync()
    {
        var authHeader = Request.Headers.Authorization.FirstOrDefault();

        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith("Bearer "))
            throw new UnauthorizedAccessException("Missing or invalid authorization header.");

        var token = authHeader["Bearer ".Length..];
        var decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token);

        return decoded.Uid;
    }
}
