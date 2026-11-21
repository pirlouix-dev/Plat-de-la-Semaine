using Microsoft.AspNetCore.Mvc;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Lightweight server warm-up endpoint.
/// </summary>
[ApiController]
[Route("api/ping")]
[Tags("Health")]
public class PingController : ControllerBase
{
    /// <summary>
    /// Return 200 OK to signal the server is warm and ready.
    /// </summary>
    [HttpGet]
    [EndpointSummary("Ping the server to warm it up")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public IActionResult Ping() => Ok();
}
