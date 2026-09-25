using PlatDeLaSemaineBack.Configuration;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class CorsSettingsTests
{
    [Fact]
    public void ResolveAllowedOrigins_ParsesCommaSeparatedValues()
    {
        var previous = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
        Environment.SetEnvironmentVariable("CORS_ALLOWED_ORIGINS", "https://a.example.com, https://b.example.com");
        try
        {
            var origins = CorsSettings.ResolveAllowedOrigins();

            Assert.Equal(new[] { "https://a.example.com", "https://b.example.com" }, origins);
        }
        finally
        {
            Environment.SetEnvironmentVariable("CORS_ALLOWED_ORIGINS", previous);
        }
    }

    [Fact]
    public void ResolveAllowedOrigins_WhenUnset_ReturnsEmpty()
    {
        var previous = Environment.GetEnvironmentVariable("CORS_ALLOWED_ORIGINS");
        Environment.SetEnvironmentVariable("CORS_ALLOWED_ORIGINS", null);
        try
        {
            var origins = CorsSettings.ResolveAllowedOrigins();

            Assert.Empty(origins);
        }
        finally
        {
            Environment.SetEnvironmentVariable("CORS_ALLOWED_ORIGINS", previous);
        }
    }
}
