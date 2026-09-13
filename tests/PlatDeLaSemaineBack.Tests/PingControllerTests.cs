using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Controllers;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class PingControllerTests
{
    [Fact]
    public void Ping_Returns200Ok()
    {
        // Arrange
        var controller = new PingController();

        // Act
        var result = controller.Ping();

        // Assert
        var ok = Assert.IsType<OkResult>(result);
        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode);
    }
}
