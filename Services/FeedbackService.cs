using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling feedback submission via Discord webhook.
/// </summary>
public class FeedbackService : IFeedbackService
{
    private readonly HttpClient _http;
    private readonly IFirestoreService _firestore;

    private static readonly ConcurrentDictionary<string, List<DateTimeOffset>> _submissions = new();
    private const int MaxMessages = 3;
    private static readonly TimeSpan Window = TimeSpan.FromMinutes(5);

    public FeedbackService(HttpClient http, IFirestoreService firestore)
    {
        _http = http;
        _firestore = firestore;
    }

    /// <inheritdoc />
    public async Task<FeedbackResult> SubmitFeedbackAsync(string userId, FeedbackPayload payload)
    {
        var versionInfo = await _firestore.GetVersionInfoAsync();
        if (versionInfo is null || !string.Equals(payload.AppVersion, versionInfo.LatestVersion, StringComparison.OrdinalIgnoreCase))
        {
            return new FeedbackResult
            {
                Success = false,
                ErrorCode = "VERSION_MISMATCH",
                ErrorMessage = "Feedback is only accepted from the latest version of the app."
            };
        }

        var timestamps = _submissions.GetOrAdd(userId, _ => new List<DateTimeOffset>());
        lock (timestamps)
        {
            var cutoff = DateTimeOffset.UtcNow - Window;
            timestamps.RemoveAll(t => t < cutoff);

            if (timestamps.Count >= MaxMessages)
            {
                return new FeedbackResult
                {
                    Success = false,
                    ErrorCode = "RATE_LIMITED",
                    ErrorMessage = $"Too many feedback messages. Try again later."
                };
            }

            timestamps.Add(DateTimeOffset.UtcNow);
        }

        var webhookUrl = Environment.GetEnvironmentVariable("DISCORD_WEBHOOK_URL");
        if (string.IsNullOrEmpty(webhookUrl))
        {
            return new FeedbackResult
            {
                Success = false,
                ErrorCode = "WEBHOOK_NOT_CONFIGURED",
                ErrorMessage = "Discord webhook is not configured."
            };
        }

        var embed = new DiscordEmbed
        {
            Title = "New Feedback",
            Description = payload.Message,
            Color = 0x57F287,
            Fields = new List<DiscordEmbedField>
            {
                new() { Name = "User ID", Value = userId, Inline = true },
                new() { Name = "App Version", Value = payload.AppVersion, Inline = true },
                new() { Name = "Timestamp", Value = DateTimeOffset.UtcNow.ToString("o"), Inline = true }
            }
        };

        var body = new DiscordWebhookPayload { Embeds = new List<DiscordEmbed> { embed } };
        var response = await _http.PostAsJsonAsync(webhookUrl, body);

        if (!response.IsSuccessStatusCode)
        {
            return new FeedbackResult
            {
                Success = false,
                ErrorCode = "WEBHOOK_FAILED",
                ErrorMessage = "Failed to send feedback to Discord."
            };
        }

        return new FeedbackResult { Success = true };
    }
}

internal class DiscordWebhookPayload
{
    [JsonPropertyName("embeds")]
    public List<DiscordEmbed> Embeds { get; set; } = new();
}

internal class DiscordEmbed
{
    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("color")]
    public int Color { get; set; }

    [JsonPropertyName("fields")]
    public List<DiscordEmbedField> Fields { get; set; } = new();
}

internal class DiscordEmbedField
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("value")]
    public string Value { get; set; } = string.Empty;

    [JsonPropertyName("inline")]
    public bool Inline { get; set; }
}
