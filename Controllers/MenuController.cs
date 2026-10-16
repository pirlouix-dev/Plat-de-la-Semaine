using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Saved weekly menu endpoints.
/// </summary>
[ApiController]
[Route("api/menu")]
[Tags("Menu")]
public class MenuController : BaseController
{
    private readonly IMenuService _menuService;

    public MenuController(IMenuService menuService, ITokenVerifier tokenVerifier)
        : base(tokenVerifier)
    {
        _menuService = menuService;
    }

    /// <summary>
    /// Fetch the current user's saved menu, or an empty menu when none has been saved.
    /// </summary>
    [HttpGet]
    [EndpointSummary("Fetch the current user's saved menu")]
    [ProducesResponseType(typeof(MenuResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Get()
    {
        var userId = await GetUserIdAsync();
        var response = await _menuService.GetMenuAsync(userId);
        return Ok(response);
    }

    /// <summary>
    /// Save the current user's menu (upsert), including an empty selection to reset it.
    /// </summary>
    [HttpPut]
    [EndpointSummary("Save the current user's menu")]
    [ProducesResponseType(typeof(MenuResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Save([FromBody] SaveMenuPayload payload)
    {
        var userId = await GetUserIdAsync();
        var response = await _menuService.SaveMenuAsync(userId, payload);
        return Ok(response);
    }
}
