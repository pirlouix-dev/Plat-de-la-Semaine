using Microsoft.AspNetCore.Mvc.Testing;
using System.Net;
using System.Net.Http.Json;
using Xunit;

namespace plat_de_la_semaine_back.Tests;

public class HelloEndpointTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly HttpClient _client;

    public HelloEndpointTests(WebApplicationFactory<Program> factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task GetHello_ReturnsOk()
    {
        var response = await _client.GetAsync("/api/hello");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task GetHello_ReturnsCorrectContentType()
    {
        var response = await _client.GetAsync("/api/hello");

        Assert.Equal("application/json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task GetHello_ReturnsMessageField()
    {
        var response = await _client.GetAsync("/api/hello");
        var body = await response.Content.ReadFromJsonAsync<HelloResponse>();

        Assert.NotNull(body);
        Assert.Equal("Hello World!", body.Message);
    }
}

public class HelloResponse
{
    public string? Message { get; set; }
}
