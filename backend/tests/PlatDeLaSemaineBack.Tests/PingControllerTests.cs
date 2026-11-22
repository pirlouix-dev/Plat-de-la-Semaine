using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Controllers;
using PlatDeLaSemaineBack.Models;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class PingControllerTests
{
    [Fact]
    public void Ping_ReturnsRunningBuildCommit()
    {
        // Arrange
        var controller = new PingController();

        // Act
        var result = controller.Ping();

        // Assert
        var ok = Assert.IsType<OkObjectResult>(result);
        var body = Assert.IsType<BuildInfo>(ok.Value);
        Assert.Equal(BuildStamp.Commit, body.Commit);
        Assert.NotEqual("unknown", body.Commit);
    }

    [Theory]
    [InlineData("1.0.0+ca009f126cbe848b3c0052cc659493adabdf7e09", "ca009f126cbe848b3c0052cc659493adabdf7e09")]
    [InlineData("1.0.0-preview.1+abc123", "abc123")]
    [InlineData("1.0.0", "unknown")]
    [InlineData("1.0.0+", "unknown")]
    [InlineData("", "unknown")]
    [InlineData(null, "unknown")]
    public void ResolveCommit_ExtractsSourceRevision(string? informationalVersion, string expected)
    {
        Assert.Equal(expected, BuildStamp.ResolveCommit(informationalVersion));
    }
}
