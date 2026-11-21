using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Version information endpoint.
/// </summary>
[ApiController]
[Route("api/version")]
[Tags("Settings")]
public class VersionController : ControllerBase
{
    private readonly IVersionService _versionService;

    public VersionController(IVersionService versionService)
    {
        _versionService = versionService;
    }

    /// <summary>
    /// Fetch the latest version information.
    /// </summary>
    [HttpGet]
    [EndpointSummary("Fetch the latest version information")]
    [ProducesResponseType(typeof(VersionInfo), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> GetVersion()
    {
        var response = await _versionService.GetVersionInfoAsync();
        return Ok(response);
    }
}
