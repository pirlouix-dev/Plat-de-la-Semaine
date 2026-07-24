using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling feedback submission.
/// </summary>
public class FeedbackService : IFeedbackService
{
    /// <inheritdoc />
    public Task SubmitFeedbackAsync(string userId, FeedbackPayload payload)
    {
        // TODO: Discord webhook integration
        Console.WriteLine($"Feedback from {userId}: {payload.Message}");
        return Task.CompletedTask;
    }
}
