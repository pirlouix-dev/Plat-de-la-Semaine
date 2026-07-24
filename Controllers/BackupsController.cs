using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;

namespace PlatDeLaSemaineBack.Controllers;

/// <summary>
/// Backup management endpoints.
/// </summary>
[ApiController]
[Route("api/backups")]
[Tags("Backups")]
public class BackupsController : BaseController
{
    private readonly IBackupService _backupService;

    public BackupsController(IBackupService backupService)
    {
        _backupService = backupService;
    }

    /// <summary>
    /// Fetch all backups for the current user (max 5, newest first).
    /// </summary>
    [HttpGet]
    [EndpointSummary("Fetch all backups for the current user (max 5, newest first)")]
    [ProducesResponseType(typeof(BackupListResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> GetAll()
    {
        var userId = await GetUserIdAsync();
        var response = await _backupService.GetAllBackupsAsync(userId);
        return Ok(response);
    }

    /// <summary>
    /// Restore the dish list from a specific backup.
    /// </summary>
    [HttpPost("restore/{backupId}")]
    [EndpointSummary("Restore the dish list from a specific backup")]
    [ProducesResponseType(typeof(BackupRestoreResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorDetail), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Restore(string backupId)
    {
        var userId = await GetUserIdAsync();
        var response = await _backupService.RestoreBackupAsync(userId, backupId);
        return Ok(response);
    }
}
