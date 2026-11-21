using System.Net;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// An expected API failure carrying the HTTP status and stable error code the
/// client uses to render user-facing copy. The message is an English diagnostic.
/// </summary>
public class ApiException : Exception
{
    public HttpStatusCode StatusCode { get; }
    public string ErrorCode { get; }

    public ApiException(HttpStatusCode statusCode, string errorCode, string message)
        : base(message)
    {
        StatusCode = statusCode;
        ErrorCode = errorCode;
    }
}
