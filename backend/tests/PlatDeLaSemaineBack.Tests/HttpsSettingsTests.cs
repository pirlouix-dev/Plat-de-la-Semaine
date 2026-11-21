using PlatDeLaSemaineBack.Configuration;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

[Collection(EnvironmentVariableCollection.Name)]
public class HttpsSettingsTests
{
    [Fact]
    public void ResolveFlag_WhenUnset_ReturnsDefault()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("HTTPS_REDIRECTION_ENABLED", null));

        // Act
        var result = HttpsSettings.ResolveFlag("HTTPS_REDIRECTION_ENABLED", defaultValue: true);

        // Assert
        Assert.True(result);
    }

    [Theory]
    [InlineData("true", true)]
    [InlineData("TRUE", true)]
    [InlineData("1", true)]
    [InlineData("false", false)]
    [InlineData("FALSE", false)]
    [InlineData("0", false)]
    public void ResolveFlag_ParsesBooleanValues(string value, bool expected)
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("HSTS_ENABLED", value));

        // Act
        var result = HttpsSettings.ResolveFlag("HSTS_ENABLED", defaultValue: true);

        // Assert
        Assert.Equal(expected, result);
    }

    [Fact]
    public void ResolveFlag_WhenNotABoolean_ReturnsDefault()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("HSTS_ENABLED", "yes please"));

        // Act
        var result = HttpsSettings.ResolveFlag("HSTS_ENABLED", defaultValue: true);

        // Assert
        Assert.True(result);
    }

    [Fact]
    public void RedirectEnabled_WhenUnset_DefaultsToTrue()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("HTTPS_REDIRECTION_ENABLED", null));

        // Act
        var enabled = HttpsSettings.RedirectEnabled;

        // Assert
        Assert.True(enabled);
    }

    [Fact]
    public void HstsEnabled_WhenDisabled_ReturnsFalse()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(("HSTS_ENABLED", "false"));

        // Act
        var enabled = HttpsSettings.HstsEnabled;

        // Assert
        Assert.False(enabled);
    }
}
