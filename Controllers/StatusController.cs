using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Application status and diagnostic endpoint.
/// </summary>
[ApiController]
[Route("api/Status")]
[Tags("Health")]
public class StatusController : ControllerBase
{
    private readonly IFirestoreService _firestore;

    public StatusController(IFirestoreService firestore)
    {
        _firestore = firestore;
    }

    /// <summary>
    /// Returns the application status, including database connection info.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetStatus()
    {
        var usersCount = 0;
        var dishesCount = 0;

        if (_firestore.IsConnected)
        {
            try
            {
                var users = await _firestore.GetAllUsersAsync();
                usersCount = users.Count;

                var dishes = await _firestore.GetAllDishesAsync();
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
            database = _firestore.IsConnected ? "connected" : "disconnected",
            usersCount,
            dishesCount
        });
    }
}
