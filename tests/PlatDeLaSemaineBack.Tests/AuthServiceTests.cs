using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using NSubstitute;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class AuthServiceTests
{
    private static (AuthService service, TestHttpMessageHandler handler, IFirestoreService firestore) CreateService(
        string? apiKey = "test-api-key")
    {
        var handler = new TestHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var firestore = Substitute.For<IFirestoreService>();
        var settings = Options.Create(new FirebaseSettings { ApiKey = apiKey });
        var service = new AuthService(httpClient, firestore, settings);

        return (service, handler, firestore);
    }

    [Fact]
    public void Constructor_MissingApiKey_ThrowsInvalidOperationException()
    {
        // Arrange
        var handler = new TestHttpMessageHandler();
        var httpClient = new HttpClient(handler);
        var firestore = Substitute.For<IFirestoreService>();
        var settings = Options.Create(new FirebaseSettings());

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => new AuthService(httpClient, firestore, settings));
    }

    [Fact]
    public async Task LoginAsync_Success_ReturnsAuthResponse()
    {
        // Arrange
        var (service, handler, firestore) = CreateService();
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

        var user = new User { Username = "testuser" };
        firestore.GetUserByIdAsync("user-uid-123").Returns(user);

        // Act
        var result = await service.LoginAsync("test@example.com", "password123");

        // Assert
        Assert.Equal("fake-id-token", result.IdToken);
        Assert.Equal("fake-refresh-token", result.RefreshToken);
        Assert.Equal("3600", result.ExpiresIn);
        Assert.Equal("user-uid-123", result.UserId);
        Assert.Equal("testuser", result.Username);
    }

    [Fact]
    public async Task LoginAsync_InvalidCredentials_ThrowsUnauthorizedAccessException()
    {
        // Arrange
        var (service, handler, _) = CreateService();
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
    public async Task LoginAsync_DoesNotPerformEmailVerification()
    {
        // Arrange
        var (service, handler, firestore) = CreateService();
        var requestedUrls = new List<string>();
        handler.OnSend = (req, ct) =>
        {
            requestedUrls.Add(req.RequestUri!.AbsoluteUri);
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

        var user = new User { Username = "testuser" };
        firestore.GetUserByIdAsync("user-uid-123").Returns(user);

        // Act
        await service.LoginAsync("test@example.com", "password123");

        // Assert
        Assert.DoesNotContain(requestedUrls, url => url.Contains("lookup"));
        Assert.DoesNotContain(requestedUrls, url => url.Contains("sendOobCode"));
    }

    [Fact]
    public async Task RefreshTokenAsync_Success_ReturnsRefreshResponse()
    {
        // Arrange
        var (service, handler, _) = CreateService();
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
    }

    [Fact]
    public async Task RefreshTokenAsync_InvalidToken_ThrowsHttpRequestException()
    {
        // Arrange
        var (service, handler, _) = CreateService();
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

    [Fact]
    public async Task UpdateUsernameAsync_Success_UpdatesUsername()
    {
        // Arrange
        var (service, _, firestore) = CreateService();
        var user = new User { Id = "user-uid-123", Username = "oldname" };
        firestore.GetUserByIdAsync("user-uid-123").Returns(user);

        // Act
        await service.UpdateUsernameAsync("user-uid-123", "newname");

        // Assert
        Assert.Equal("newname", user.Username);
        await firestore.Received(1).UpdateUserAsync(user);
    }

    [Fact]
    public async Task UpdateUsernameAsync_UserNotFound_ThrowsKeyNotFoundException()
    {
        // Arrange
        var (service, _, firestore) = CreateService();
        firestore.GetUserByIdAsync("nonexistent").Returns((User?)null);

        // Act & Assert
        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => service.UpdateUsernameAsync("nonexistent", "newname"));
    }

    [Fact]
    public async Task SendPasswordResetEmailAsync_Success_DoesNotThrow()
    {
        // Arrange
        var (service, handler, _) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new { kind = "identitytoolkit#GetOobConfirmationCodeResponse", email = "test@example.com" };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act & Assert
        await service.SendPasswordResetEmailAsync("test@example.com");
    }

    [Fact]
    public async Task SendPasswordResetEmailAsync_Failure_ThrowsInvalidOperationException()
    {
        // Arrange
        var (service, handler, _) = CreateService();
        handler.OnSend = (req, ct) =>
        {
            var body = new { error = new { message = "EMAIL_NOT_FOUND" } };
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.BadRequest)
            {
                Content = JsonContent.Create(body)
            });
        };

        // Act & Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            () => service.SendPasswordResetEmailAsync("unknown@example.com"));
        Assert.Contains("EMAIL_NOT_FOUND", ex.Message);
    }
}
