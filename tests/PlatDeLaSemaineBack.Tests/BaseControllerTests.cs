using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using PlatDeLaSemaineBack.Controllers;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class BaseControllerTests
{
    [Fact]
    public async Task GetUserIdAsync_WithoutAuthorizationHeader_ThrowsUnauthorized()
    {
        // Arrange
        var verifier = Substitute.For<ITokenVerifier>();
        var controller = CreateController(verifier);

        // Act
        var act = () => controller.GetUserIdForTestAsync();

        // Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(act);
    }

    [Fact]
    public async Task GetUserIdAsync_WithNonBearerScheme_ThrowsUnauthorized()
    {
        // Arrange
        var verifier = Substitute.For<ITokenVerifier>();
        var controller = CreateController(verifier, "Basic dXNlcjpwYXNz");

        // Act
        var act = () => controller.GetUserIdForTestAsync();

        // Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(act);
    }

    [Fact]
    public async Task GetUserIdAsync_WithValidBearerToken_ReturnsUidAndForwardsRawToken()
    {
        // Arrange
        var verifier = Substitute.For<ITokenVerifier>();
        verifier.VerifyAsync("raw-id-token").Returns("user-123");
        var controller = CreateController(verifier, "Bearer raw-id-token");

        // Act
        var userId = await controller.GetUserIdForTestAsync();

        // Assert
        Assert.Equal("user-123", userId);
        await verifier.Received(1).VerifyAsync("raw-id-token");
    }

    [Fact]
    public async Task GetUserIdAsync_WhenVerifierThrows_PropagatesException()
    {
        // Arrange
        var verifier = Substitute.For<ITokenVerifier>();
        verifier.VerifyAsync(Arg.Any<string>())
            .Returns<Task<string>>(_ => throw new UnauthorizedAccessException("revoked"));
        var controller = CreateController(verifier, "Bearer raw-id-token");

        // Act
        var act = () => controller.GetUserIdForTestAsync();

        // Assert
        await Assert.ThrowsAsync<UnauthorizedAccessException>(act);
    }

    private static TestController CreateController(ITokenVerifier verifier, string? authHeader = null)
    {
        var controller = new TestController(verifier)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };

        if (authHeader != null)
            controller.Request.Headers["Authorization"] = authHeader;

        return controller;
    }

    private sealed class TestController : BaseController
    {
        public TestController(ITokenVerifier tokenVerifier)
            : base(tokenVerifier)
        {
        }

        public Task<string> GetUserIdForTestAsync() => GetUserIdAsync();
    }
}
