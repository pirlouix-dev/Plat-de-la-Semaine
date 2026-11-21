using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using NSubstitute;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// Exercises the dish batch HTTP contract through the real application pipeline.
/// </summary>
[Collection(EnvironmentVariableCollection.Name)]
public class DishesApiTests
{
    private static WebApplicationFactory<Program> CreateFactory(InMemoryFirestoreService store)
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");

            builder.ConfigureServices(services =>
            {
                services.RemoveAll<IFirestoreService>();
                services.AddSingleton<IFirestoreService>(store);

                var verifier = Substitute.For<ITokenVerifier>();
                verifier.VerifyAsync(Arg.Any<string>())
                    .Returns(call => call.Arg<string>());

                services.RemoveAll<ITokenVerifier>();
                services.AddSingleton(verifier);
            });
        });
    }

    private static HttpClient CreateClient(WebApplicationFactory<Program> factory)
        => factory.CreateClient(new WebApplicationFactoryClientOptions
        {
            BaseAddress = new Uri("http://localhost")
        });

    private static async Task<HttpResponseMessage> PostBatchAsync(
        HttpClient client,
        string body,
        string? user = "alice")
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/dishes/batch")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        if (user is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user);
        }

        return await client.SendAsync(request);
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response)
    {
        var text = await response.Content.ReadAsStringAsync();
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    private static Dish NewDish(string userId, string id, string name) => new()
    {
        Id = id,
        UserId = userId,
        Name = name,
        Description = string.Empty,
        Course = 1,
        Seasons = [0],
        UpdatedAt = DateTimeOffset.UtcNow
    };

    [Fact]
    public async Task Batch_MixedOperations_ReturnsOneOutcomePerOperation()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        store.SeedUser("alice");
        await store.InsertDishAsync(NewDish("alice", "u1", "Old"));
        await store.InsertDishAsync(NewDish("alice", "d1", "Gone"));

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        const string body = """
        {
          "operations": [
            { "op": "create", "id": "c1", "name": "New", "description": "Fresh", "course": 2, "seasons": [2] },
            { "op": "update", "id": "u1", "name": "Renamed" },
            { "op": "delete", "id": "d1" }
          ]
        }
        """;

        // Act
        using var response = await PostBatchAsync(client, body);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJsonAsync(response);
        Assert.Equal(1, json.GetProperty("created").GetInt32());
        Assert.Equal(1, json.GetProperty("updated").GetInt32());
        Assert.Equal(1, json.GetProperty("deleted").GetInt32());
        Assert.Equal(0, json.GetProperty("failed").GetInt32());

        var results = json.GetProperty("results");
        Assert.Equal(3, results.GetArrayLength());

        Assert.Equal("create", results[0].GetProperty("op").GetString());
        Assert.Equal("created", results[0].GetProperty("status").GetString());
        Assert.Equal("c1", results[0].GetProperty("id").GetString());
        Assert.Equal("New", results[0].GetProperty("data").GetProperty("name").GetString());
        Assert.Equal("Fresh", results[0].GetProperty("data").GetProperty("description").GetString());

        Assert.Equal("updated", results[1].GetProperty("status").GetString());
        Assert.Equal("Renamed", results[1].GetProperty("data").GetProperty("name").GetString());

        Assert.Equal("deleted", results[2].GetProperty("status").GetString());

        // The writes are persisted and readable through the single-dish endpoint.
        var storedDish = await store.GetDishByIdAsync("alice", "c1");
        Assert.NotNull(storedDish);
        Assert.Equal("New", storedDish!.Name);
        Assert.Equal(2, storedDish.Course);

        var deletedDish = await store.GetDishByIdAsync("alice", "d1");
        Assert.True(deletedDish!.IsDeleted);
    }

    [Fact]
    public async Task Batch_InvalidOperation_ReturnsFailedOutcomeNotRejectedRequest()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        store.SeedUser("alice");

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        const string body = """
        { "operations": [ { "op": "upsert", "id": "x" } ] }
        """;

        // Act
        using var response = await PostBatchAsync(client, body);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJsonAsync(response);
        Assert.Equal(1, json.GetProperty("failed").GetInt32());

        var result = json.GetProperty("results")[0];
        Assert.Equal("failed", result.GetProperty("status").GetString());
        Assert.Equal("VALIDATION_ERROR", result.GetProperty("code").GetString());
        Assert.Equal("Op", result.GetProperty("errors")[0].GetProperty("field").GetString());
    }

    [Fact]
    public async Task Batch_DishOwnedByAnotherUser_ReportsNotFound()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        store.SeedUser("bob");
        await store.InsertDishAsync(NewDish("bob", "shared", "Bob's dish"));

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        const string body = """
        { "operations": [ { "op": "delete", "id": "shared" } ] }
        """;

        // Act
        using var response = await PostBatchAsync(client, body, user: "alice");

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJsonAsync(response);
        Assert.Equal(1, json.GetProperty("failed").GetInt32());
        Assert.Equal("NOT_FOUND", json.GetProperty("results")[0].GetProperty("code").GetString());

        var untouched = await store.GetDishByIdAsync("bob", "shared");
        Assert.False(untouched!.IsDeleted);
    }

    [Fact]
    public async Task Batch_TooManyOperations_ReturnsBadRequest()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        store.SeedUser("alice");

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        var body = JsonSerializer.Serialize(new
        {
            operations = Enumerable.Range(0, 501)
                .Select(index => new { op = "delete", id = $"d{index}" })
        });

        // Act
        using var response = await PostBatchAsync(client, body);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var json = await ReadJsonAsync(response);
        Assert.Equal("BAD_REQUEST", json.GetProperty("code").GetString());
    }

    [Fact]
    public async Task Batch_WithoutToken_ReturnsUnauthorized()
    {
        // Arrange
        var store = new InMemoryFirestoreService();

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        const string body = """
        { "operations": [] }
        """;

        // Act
        using var response = await PostBatchAsync(client, body, user: null);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Batch_EmptyOperations_ReturnsZeroCounts()
    {
        // Arrange
        var store = new InMemoryFirestoreService();

        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        const string body = """
        { "operations": [] }
        """;

        // Act
        using var response = await PostBatchAsync(client, body);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var json = await ReadJsonAsync(response);
        Assert.Equal(0, json.GetProperty("created").GetInt32());
        Assert.Equal(0, json.GetProperty("updated").GetInt32());
        Assert.Equal(0, json.GetProperty("deleted").GetInt32());
        Assert.Equal(0, json.GetProperty("failed").GetInt32());
        Assert.Empty(json.GetProperty("results").EnumerateArray());
    }
}
