using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Dish management endpoints.
/// </summary>
[ApiController]
[Route("api/dishes")]
[Tags("Dishes")]
public class DishesController : BaseController
{
    private readonly IDishService _dishService;

    public DishesController(IDishService dishService)
    {
        _dishService = dishService;
    }

    /// <summary>
    /// Fetch all dishes for the current user.
    /// </summary>
    [HttpGet]
    [EndpointSummary("Fetch all dishes for the current user")]
    [ProducesResponseType(typeof(DishListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAll()
    {
        var userId = await GetUserIdAsync();
        var response = await _dishService.GetAllDishesAsync(userId);
        return Ok(response);
    }

    /// <summary>
    /// Create a new dish.
    /// </summary>
    [HttpPost]
    [EndpointSummary("Create a new dish")]
    [ProducesResponseType(typeof(DishSingleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create([FromBody] CreateDishPayload payload)
    {
        var userId = await GetUserIdAsync();
        var response = await _dishService.CreateDishAsync(userId, payload);
        return Ok(response);
    }

    /// <summary>
    /// Update an existing dish.
    /// </summary>
    [HttpPut("{id}")]
    [EndpointSummary("Update an existing dish")]
    [ProducesResponseType(typeof(DishSingleResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Update(string id, [FromBody] UpdateDishPayload payload)
    {
        var userId = await GetUserIdAsync();
        var response = await _dishService.UpdateDishAsync(userId, id, payload);
        return Ok(response);
    }

    /// <summary>
    /// Delete a dish.
    /// </summary>
    [HttpDelete("{id}")]
    [EndpointSummary("Delete a dish")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Delete(string id)
    {
        var userId = await GetUserIdAsync();
        await _dishService.DeleteDishAsync(userId, id);
        return NoContent();
    }
}
