using Microsoft.AspNetCore.Mvc;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Health check and hello endpoint.
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class HelloController : ControllerBase
{
    /// <summary>
    /// Returns a simple hello world message for health checks.
    /// </summary>
    [HttpGet]
    public IActionResult GetHello()
    {
        return Ok(new { message = "Hello World!" });
    }
}
