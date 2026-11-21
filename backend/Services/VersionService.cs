using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling version information retrieval.
/// </summary>
public class VersionService : IVersionService
{
    private readonly IFirestoreService _firestore;

    public VersionService(IFirestoreService firestore)
    {
        _firestore = firestore;
    }

    /// <inheritdoc />
    public async Task<VersionInfo> GetVersionInfoAsync()
    {
        var info = await _firestore.GetVersionInfoAsync()
            ?? throw new KeyNotFoundException("Version info not found.");
        return info;
    }
}
