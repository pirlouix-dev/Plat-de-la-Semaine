using FirebaseAdmin.Auth;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Verifies Firebase ID tokens via the Firebase Admin SDK.
/// </summary>
public class FirebaseTokenVerifier : ITokenVerifier
{
    /// <inheritdoc />
    public async Task<string> VerifyAsync(string idToken)
    {
        var decoded = await FirebaseAuth.DefaultInstance
            .VerifyIdTokenAsync(idToken, checkRevoked: true);

        return decoded.Uid;
    }
}
