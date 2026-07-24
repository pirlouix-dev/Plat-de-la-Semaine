using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for feedback submission.
/// </summary>
public interface IFeedbackService
{
    /// <summary>
    /// Submits a feedback message. TODO: dispatch via Discord webhook.
    /// </summary>
    Task SubmitFeedbackAsync(string userId, FeedbackPayload payload);
}
