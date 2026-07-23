using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using NSubstitute;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class ApiIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task GetHello_ReturnsOk()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(false);

        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(firestore);
            });
        }).CreateClient();

        // Act
        var response = await client.GetAsync("/api/hello");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);
        Assert.Equal("Hello World!", json.GetProperty("message").GetString());
    }

    [Fact]
    public async Task GetStatus_ReturnsOkWithDatabaseStatus()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();
        firestore.IsConnected.Returns(false);

        var client = _factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                services.AddSingleton(firestore);
            });
        }).CreateClient();

        // Act
        var response = await client.GetAsync("/api/status");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);
        Assert.Equal("disconnected", json.GetProperty("database").GetString());
    }

    [Fact]
    public async Task GetHello_WithMockPrefix_ReturnsCorrectRoute()
    {
        // Arrange
        var client = _factory.CreateClient();

        // Act
        var response = await client.GetAsync("/api/hello");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var json = JsonSerializer.Deserialize<JsonElement>(body);
        Assert.NotNull(json.GetProperty("message").GetString());
    }
}
