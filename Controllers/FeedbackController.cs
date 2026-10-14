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

    public FeedbackController(IFeedbackService feedbackService, ITokenVerifier tokenVerifier)
        : base(tokenVerifier)
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
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status429TooManyRequests)]
    public async Task<IActionResult> Submit([FromBody] FeedbackPayload payload)
    {
        var userId = await GetUserIdAsync();
        var result = await _feedbackService.SubmitFeedbackAsync(userId, payload);

        if (result.Success)
            return Ok();

        return result.ErrorCode switch
        {
            "VERSION_MISMATCH" => BadRequest(new ApiErrorDetail
            {
                Code = result.ErrorCode,
                Message = result.ErrorMessage!
            }),
            "RATE_LIMITED" => StatusCode(StatusCodes.Status429TooManyRequests, new ApiErrorDetail
            {
                Code = result.ErrorCode,
                Message = result.ErrorMessage!
            }),
            _ => StatusCode(StatusCodes.Status500InternalServerError, new ApiErrorDetail
            {
                Code = result.ErrorCode ?? "UNKNOWN_ERROR",
                Message = result.ErrorMessage ?? "An unexpected error occurred."
            })
        };
    }
}
