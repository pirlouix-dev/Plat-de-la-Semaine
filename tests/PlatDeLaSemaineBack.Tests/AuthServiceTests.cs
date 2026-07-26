using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class AuthServiceTests
{
    private static (AuthService service, TestHttpMessageHandler handler) CreateService(
        string? apiKey = "test-api-key")
    {
        var previousApiKey = Environment.GetEnvironmentVariable("FIREBASE_API_KEY");
        if (apiKey != null)
            Environment.SetEnvironmentVariable("FIREBASE_API_KEY", apiKey);
        else
            Environment.SetEnvironmentVariable("FIREBASE_API_KEY", null);

        var handler = new TestHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var service = new AuthService(httpClient);

        if (previousApiKey != null)
            Environment.SetEnvironmentVariable("FIREBASE_API_KEY", previousApiKey);
        else
            Environment.SetEnvironmentVariable("FIREBASE_API_KEY", null);

        return (service, handler);
    }

    [Fact]
    public void Constructor_MissingApiKey_ThrowsInvalidOperationException()
    {
        // Arrange
        var previousApiKey = Environment.GetEnvironmentVariable("FIREBASE_API_KEY");
        Environment.SetEnvironmentVariable("FIREBASE_API_KEY", null);

        try
        {
            var handler = new TestHttpMessageHandler();
            var httpClient = new HttpClient(handler);

            // Act & Assert
            Assert.Throws<InvalidOperationException>(() => new AuthService(httpClient));
        }
        finally
        {
            if (previousApiKey != null)
                Environment.SetEnvironmentVariable("FIREBASE_API_KEY", previousApiKey);
        }
    }

    [Fact]
    public async Task LoginAsync_Success_ReturnsAuthResponse()
    {
        // Arrange
        var (service, handler) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new
            {
                idToken = "fake-id-token",
                refreshToken = "fake-refresh-token",
                expiresIn = "3600",
                localId = "user-uid-123"
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act
        var result = await service.LoginAsync("test@example.com", "password123");

        // Assert
        Assert.Equal("fake-id-token", result.IdToken);
        Assert.Equal("fake-refresh-token", result.RefreshToken);
        Assert.Equal("3600", result.ExpiresIn);
        Assert.Equal("user-uid-123", result.UserId);
    }

    [Fact]
    public async Task LoginAsync_InvalidCredentials_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var (service, handler) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new { error = new { message = "INVALID_PASSWORD" } };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<UnauthorizedAccessException>(
            () => service.LoginAsync("test@example.com", "wrongpassword"));
        Assert.Contains("INVALID_PASSWORD", ex.Message);
    }

    [Fact]
    public async Task RefreshTokenAsync_Success_ReturnsAuthResponse()
    {
        // Arrange
        var (service, handler) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new
            {
                id_token = "new-id-token",
                refresh_token = "new-refresh-token",
                expires_in = "3600",
                user_id = "user-uid-123"
            };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act
        var result = await service.RefreshTokenAsync("old-refresh-token");

        // Assert
        Assert.Equal("new-id-token", result.IdToken);
        Assert.Equal("new-refresh-token", result.RefreshToken);
        Assert.Equal("3600", result.ExpiresIn);
        Assert.Equal("user-uid-123", result.UserId);
    }

    [Fact]
    public async Task RefreshTokenAsync_InvalidToken_ThrowsHttpRequestException()
    {
        // Arrange
        var (service, handler) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new { error = new { message = "INVALID_REFRESH_TOKEN" } };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act & Assert
        await Assert.ThrowsAsync<HttpRequestException>(
            () => service.RefreshTokenAsync("invalid-token"));
    }
}
