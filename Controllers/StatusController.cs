using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Application status and diagnostic endpoint.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class StatusController : ControllerBase
{
    private readonly ISupabaseService _supabase;

    public StatusController(ISupabaseService supabase)
    {
        _supabase = supabase;
    }

    /// <summary>
    /// Returns the application status, including database connection info.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetStatus()
    {
        var usersCount = 0;
        var dishesCount = 0;

        if (_supabase.IsConnected)
        {
            try
            {
                var users = await _supabase.GetAllUsersAsync();
                usersCount = users.Count;

                var dishes = await _supabase.GetAllDishesAsync();
                dishesCount = dishes.Count;
            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    database = "connected",
                    warning = ex.Message,
                    usersCount,
                    dishesCount
                });
            }
        }

        return Ok(new
        {
            database = _supabase.IsConnected ? "connected" : "disconnected",
            usersCount,
            dishesCount
        });
    }
}
