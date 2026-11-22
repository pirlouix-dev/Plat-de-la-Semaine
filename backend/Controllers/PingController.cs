using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;

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
    /// Return 200 OK and the running build's commit to signal the server is
    /// warm and ready.
    /// </summary>
    [HttpGet]
    [EndpointSummary("Ping the server to warm it up")]
    [ProducesResponseType(typeof(BuildInfo), StatusCodes.Status200OK)]
    public IActionResult Ping() => Ok(new BuildInfo { Commit = BuildStamp.Commit });
}
