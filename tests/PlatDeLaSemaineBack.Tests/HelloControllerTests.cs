using Microsoft.AspNetCore.Mvc;
using PlatDeLaSemaineBack.Controllers;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class HelloControllerTests
{
    [Fact]
    public void GetHello_ReturnsOkWithMessage()
    {
        // Arrange
        var controller = new HelloController();

        // Act
        var result = controller.GetHello();

        // Assert
        var okResult = Assert.IsType<OkObjectResult>(result);
        var response = okResult.Value;

        var messageProperty = response?.GetType().GetProperty("message");
        Assert.NotNull(messageProperty);
        var message = messageProperty!.GetValue(response) as string;
        Assert.Equal("Hello World!", message);
    }
}
