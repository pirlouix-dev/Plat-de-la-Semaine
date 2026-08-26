using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Application status and diagnostic endpoint.
/// </summary>
[ApiController]
[Route("api/status")]
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
            dishesCount,
            debug = new
            {
                GOOGLE_CREDENTIALS_JSON = GetEnvFirst10("GOOGLE_CREDENTIALS_JSON"),
                FIREBASE_PROJECT_ID = Environment.GetEnvironmentVariable("FIREBASE_PROJECT_ID"),
                FIREBASE_API_KEY = GetEnvFirst10("FIREBASE_API_KEY"),
                isInitialized = _firestore.IsConnected
            }
        });
    }

    private static string? GetEnvFirst10(string name)
    {
        var value = Environment.GetEnvironmentVariable(name);
        return value is { Length: > 10 } ? value[..10] : value;
    }
}
