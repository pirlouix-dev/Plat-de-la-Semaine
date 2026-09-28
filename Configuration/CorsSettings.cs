namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// CORS configuration options.
/// </summary>
public class CorsSettings
{
    /// <summary>
    /// Origins allowed to call the API from a browser.
    /// Origins must be absolute URLs without a trailing slash.
    /// </summary>
    public string[] AllowedOrigins { get; set; } = [];

    /// <summary>
    /// Reads the allowed origins from the comma-separated
    /// <c>CORS_ALLOWED_ORIGINS</c> environment variable.
    /// </summary>
    public static string[] ResolveAllowedOrigins()
    {
        var value = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
        if (string.IsNullOrWhiteSpace(value))
        {
            return [];
        }

        return value.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    }
}
