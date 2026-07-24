using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for version information.
/// </summary>
public interface IVersionService
{
    /// <summary>
    /// Fetches the latest version information from Config/version.
    /// </summary>
    Task<VersionInfo> GetVersionInfoAsync();
}
