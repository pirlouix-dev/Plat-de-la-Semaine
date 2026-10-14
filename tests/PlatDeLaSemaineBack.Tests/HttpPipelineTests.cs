using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.HttpsPolicy;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// Boots the real application pipeline to verify the HTTPS enforcement and
/// Host header filtering configured in <c>Program.cs</c>.
/// </summary>
[Collection(EnvironmentVariableCollection.Name)]
public class HttpPipelineTests
{
    private const string AllowedHost = "api.example.com";

    private static WebApplicationFactory<Program> CreateFactory(string environment)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);

            // The pipeline redirects using a fixed HTTPS port instead of one
            // inferred from server addresses, which the test server does not have.
            builder.ConfigureServices(services =>
                services.Configure<HttpsRedirectionOptions>(options => options.HttpsPort = 443));

            // Startup calls IFirestoreService.InitializeAsync; keep the tests offline.
            builder.ConfigureServices(services =>
                services.AddSingleton(Substitute.For<IFirestoreService>()));
        });
    }

    private static HttpClient CreateClient(
        WebApplicationFactory<Program> factory,
        string baseAddress,
        bool allowAutoRedirect = false)
    {
        var client = factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            AllowAutoRedirect = allowAutoRedirect,
            BaseAddress = new Uri(baseAddress),
        });

        return client;
    }

    [Fact]
    public async Task Production_RequestWithUnknownHost_IsRejected()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", "false"));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, "http://localhost");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/ping");
        request.Headers.Host = "evil.example.com";

        // Act
        using var response = await client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Production_RequestWithAllowedHost_IsServed()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", "false"));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, "http://localhost");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/ping");
        request.Headers.Host = AllowedHost;

        // Act
        using var response = await client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Production_PlainHttpRequest_RedirectsToHttps()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", null),
            ("HSTS_ENABLED", null));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, $"http://{AllowedHost}");

        // Act
        using var response = await client.GetAsync("/api/ping");

        // Assert
        Assert.Equal(HttpStatusCode.TemporaryRedirect, response.StatusCode);
        Assert.Equal(
            new Uri($"https://{AllowedHost}/api/ping"),
            response.Headers.Location);
    }

    [Fact]
    public async Task Production_HttpsRequest_HasHstsHeader()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", null),
            ("HSTS_ENABLED", null));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, $"https://{AllowedHost}");

        // Act
        using var response = await client.GetAsync("/api/ping");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task Production_RequestForwardedByTlsTerminatingProxy_IsNotRedirected()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", null),
            ("HSTS_ENABLED", null));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, $"http://{AllowedHost}");
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/ping");
        request.Headers.Add("X-Forwarded-Proto", "https");

        // Act
        using var response = await client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task Production_WhenRedirectionDisabled_HttpRequestIsServed()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", "false"));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, $"http://{AllowedHost}");

        // Act
        using var response = await client.GetAsync("/api/ping");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Production_WhenHstsDisabled_HttpsRequestHasNoHstsHeader()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", AllowedHost),
            ("HTTPS_REDIRECTION_ENABLED", null),
            ("HSTS_ENABLED", "false"));
        using var factory = CreateFactory("Production");
        using var client = CreateClient(factory, $"https://{AllowedHost}");

        // Act
        using var response = await client.GetAsync("/api/ping");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }

    [Fact]
    public async Task Development_PlainHttpRequest_IsNotRedirectedAndHasNoHstsHeader()
    {
        // Arrange
        using var env = new EnvironmentVariableScope(
            ("ALLOWED_HOSTS", "localhost"),
            ("HTTPS_REDIRECTION_ENABLED", null),
            ("HSTS_ENABLED", null));
        using var factory = CreateFactory("Development");
        using var client = CreateClient(factory, "http://localhost");

        // Act
        using var response = await client.GetAsync("/api/ping");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.False(response.Headers.Contains("Strict-Transport-Security"));
    }
}
