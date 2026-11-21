using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for feedback submission.
/// </summary>
public interface IFeedbackService
{
    /// <summary>
    /// Submits a feedback message via Discord webhook.
    /// </summary>
    Task<FeedbackResult> SubmitFeedbackAsync(string userId, FeedbackPayload payload);
}
