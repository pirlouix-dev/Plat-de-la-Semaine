namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// Registration helpers for strongly-typed application settings.
/// Values are read from environment variables only.
/// </summary>
public static class SettingsExtensions
{
    /// <summary>
    /// Binds the application settings from the environment variables used by
    /// the deployment configuration.
    /// </summary>
    public static IServiceCollection AddAppSettings(this IServiceCollection services)
    {
        services.Configure<FirebaseSettings>(options =>
        {
            options.ProjectId = GetEnvironmentVariable("FIREBASE_PROJECT_ID");
            options.ApiKey = GetEnvironmentVariable("FIREBASE_API_KEY");
            options.CredentialsJson = GetEnvironmentVariable("GOOGLE_CREDENTIALS_JSON");
        });

        services.Configure<FeedbackSettings>(options =>
            options.DiscordWebhookUrl = GetEnvironmentVariable("DISCORD_WEBHOOK_URL"));

        services.Configure<CorsSettings>(options =>
            options.AllowedOrigins = CorsSettings.ResolveAllowedOrigins());

        return services;
    }

    private static string? GetEnvironmentVariable(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? null : value;
    }
}
