using PlatDeLaSemaineBack.Configuration;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

[Collection(EnvironmentVariableCollection.Name)]
public class HostSettingsTests
{
    [Fact]
    public void ResolveAllowedHosts_WhenUnset_ReturnsNull()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("ALLOWED_HOSTS", null));

        // Act
        var allowedHosts = HostSettings.ResolveAllowedHosts();

        // Assert
        Assert.Null(allowedHosts);
    }

    [Fact]
    public void ResolveAllowedHosts_WhenBlank_ReturnsNull()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("ALLOWED_HOSTS", "   "));

        // Act
        var allowedHosts = HostSettings.ResolveAllowedHosts();

        // Assert
        Assert.Null(allowedHosts);
    }

    [Fact]
    public void ResolveAllowedHosts_ReturnsTrimmedValue()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", " api.example.com;localhost "));

        // Act
        var allowedHosts = HostSettings.ResolveAllowedHosts();

        // Assert
        Assert.Equal("api.example.com;localhost", allowedHosts);
    }
}
