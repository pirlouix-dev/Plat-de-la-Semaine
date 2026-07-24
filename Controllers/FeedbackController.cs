using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Feedback submission endpoint.
/// </summary>
[ApiController]
[Route("api/feedback")]
[Tags("Settings")]
public class FeedbackController : BaseController
{
    private readonly IFeedbackService _feedbackService;

    public FeedbackController(IFeedbackService feedbackService)
    {
        _feedbackService = feedbackService;
    }

    /// <summary>
    /// Submit a bug report or feedback message.
    /// </summary>
    [HttpPost]
    [EndpointSummary("Submit a bug report or feedback message")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Submit([FromBody] FeedbackPayload payload)
    {
        var userId = await GetUserIdAsync();
        await _feedbackService.SubmitFeedbackAsync(userId, payload);
        return Ok();
    }
}
