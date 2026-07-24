using NSubstitute;
using NSubstitute.ReturnsExtensions;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class VersionServiceTests
{
    [Fact]
    public async Task GetVersionInfo_ReturnsInfoFromFirestore()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetVersionInfoAsync().Returns(new VersionInfo
        {
            LatestVersion = "2.0.0",
            Description = "Major update",
            DownloadUrl = "https://example.com/download"
        });
        var service = new VersionService(firestore);

        // Act
        var result = await service.GetVersionInfoAsync();

        // Assert
        Assert.Equal("2.0.0", result.LatestVersion);
        Assert.Equal("Major update", result.Description);
    }

    [Fact]
    public async Task GetVersionInfo_NoConfigExists_ThrowsKeyNotFoundException()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.GetVersionInfoAsync().ReturnsNull();
        var service = new VersionService(firestore);

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.GetVersionInfoAsync());
    }
}
