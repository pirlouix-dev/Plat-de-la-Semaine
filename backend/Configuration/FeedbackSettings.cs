namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// Feedback submission configuration options.
/// </summary>
public class FeedbackSettings
{
    /// <summary>
    /// Discord webhook URL used to deliver feedback messages.
    /// </summary>
    public string? DiscordWebhookUrl { get; set; }
}
