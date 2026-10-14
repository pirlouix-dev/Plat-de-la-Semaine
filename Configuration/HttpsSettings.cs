namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// HTTPS enforcement configuration.
/// </summary>
/// <remarks>
/// In production the application runs behind a TLS-terminating reverse proxy
/// (for example an Azure App Service load balancer), so requests reach the
/// application over plain HTTP. Enforcing HTTPS is therefore only correct once
/// the forwarded headers middleware is trusted, which <c>Program.cs</c> handles
/// outside Development. These flags exist so a broken deployment can be backed
/// out from the host configuration without a redeploy.
/// </remarks>
public static class HttpsSettings
{
    /// <summary>
    /// Whether to redirect plain HTTP requests to HTTPS. Controlled by the
    /// <c>HTTPS_REDIRECTION_ENABLED</c> environment variable, enabled by default.
    /// </summary>
    public static bool RedirectEnabled => ResolveFlag("HTTPS_REDIRECTION_ENABLED", defaultValue: true);

    /// <summary>
    /// Whether to send the <c>Strict-Transport-Security</c> header. Controlled by
    /// the <c>HSTS_ENABLED</c> environment variable, enabled by default.
    /// </summary>
    public static bool HstsEnabled => ResolveFlag("HSTS_ENABLED", defaultValue: true);

    /// <summary>
    /// Reads a boolean environment variable, falling back to
    /// <paramref name="defaultValue"/> when it is unset or not a valid boolean.
    /// </summary>
    public static bool ResolveFlag(string name, bool defaultValue)
    {
        var value = Environment.GetEnvironmentVariable(name);
        if (string.IsNullOrWhiteSpace(value))
        {
            return defaultValue;
        }

        return value.Trim() switch
        {
            "1" or "true" or "True" or "TRUE" => true,
            "0" or "false" or "False" or "FALSE" => false,
            _ => defaultValue,
        };
    }
}
