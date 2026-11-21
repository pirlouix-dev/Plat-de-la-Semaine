using System.Net;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Raised when a Firestore operation cannot run because the client is not
/// initialized or reachable. Unlike an empty result, this is an infrastructure
/// failure: clients must not interpret it as "the user has no data".
/// </summary>
public sealed class FirestoreUnavailableException : ApiException
{
    public FirestoreUnavailableException()
        : base(
            HttpStatusCode.ServiceUnavailable,
            ApiErrorCodes.ServiceUnavailable,
            "The database is temporarily unavailable.")
    {
    }
}
