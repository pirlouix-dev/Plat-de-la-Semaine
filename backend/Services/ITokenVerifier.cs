namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Verifies Firebase ID tokens and returns the authenticated user's UID.
/// </summary>
public interface ITokenVerifier
{
    /// <summary>
    /// Verifies the given Firebase ID token, including checking that it has not been
    /// revoked, and returns the decoded UID.
    /// </summary>
    Task<string> VerifyAsync(string idToken);
}
