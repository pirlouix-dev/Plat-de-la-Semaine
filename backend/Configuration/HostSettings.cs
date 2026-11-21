namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// Host header filtering configuration.
/// </summary>
public static class HostSettings
{
    /// <summary>
    /// Wildcard accepted by the host filtering middleware, matching any hostname.
    /// </summary>
    public const string Wildcard = "*";

    /// <summary>
    /// Reads the semicolon-separated <c>ALLOWED_HOSTS</c> environment variable,
    /// or <c>null</c> when it is unset.
    /// </summary>
    /// <remarks>
    /// The host filtering middleware reads the <c>AllowedHosts</c> configuration
    /// key directly, so an environment variable named <c>ALLOWED_HOSTS</c> would
    /// not be picked up on its own.
    /// </remarks>
    public static string? ResolveAllowedHosts()
    {
        var value = Environment.GetEnvironmentVariable("ALLOWED_HOSTS");
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
