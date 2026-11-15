namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Stable, machine-readable error codes returned in <see cref="ApiErrorDetail.Code"/>.
/// The frontend maps these codes to user-facing copy; <see cref="ApiErrorDetail.Message"/>
/// is an English diagnostic and must not be rendered as UI text.
/// </summary>
public static class ApiErrorCodes
{
    public const string ValidationError = "VALIDATION_ERROR";
    public const string NotFound = "NOT_FOUND";
    public const string BadRequest = "BAD_REQUEST";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string InvalidOperation = "INVALID_OPERATION";
    public const string ServiceUnavailable = "SERVICE_UNAVAILABLE";
    public const string InternalError = "INTERNAL_ERROR";
    public const string UnknownError = "UNKNOWN_ERROR";
    public const string MenuVersionConflict = "MENU_VERSION_CONFLICT";

    public const string EmailExists = "EMAIL_EXISTS";
    public const string InvalidEmail = "INVALID_EMAIL";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string UserDisabled = "USER_DISABLED";
    public const string TooManyAttempts = "TOO_MANY_ATTEMPTS";
    public const string InvalidRefreshToken = "INVALID_REFRESH_TOKEN";
    public const string AuthFailed = "AUTH_FAILED";

    public const string VersionMismatch = "VERSION_MISMATCH";
    public const string RateLimited = "RATE_LIMITED";
    public const string WebhookNotConfigured = "WEBHOOK_NOT_CONFIGURED";
    public const string WebhookFailed = "WEBHOOK_FAILED";
}
