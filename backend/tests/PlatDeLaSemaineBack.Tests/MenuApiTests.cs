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
/// Exercises the menu HTTP contract through the real application pipeline.
/// </summary>
[Collection(EnvironmentVariableCollection.Name)]
public class MenuApiTests
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

    private static async Task<HttpResponseMessage> GetMenuAsync(HttpClient client, string? user = "alice")
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/menu");
        if (user is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user);
        }

        return await client.SendAsync(request);
    }

    private static async Task<HttpResponseMessage> PutMenuAsync(
        HttpClient client,
        IEnumerable<string>? selectedDishIds,
        string? expectedUpdatedAt,
        string? user = "alice",
        bool includeExpectedUpdatedAt = true)
    {
        var body = includeExpectedUpdatedAt
            ? JsonSerializer.Serialize(new
            {
                selectedDishIds = selectedDishIds ?? [],
                expectedUpdatedAt
            })
            : JsonSerializer.Serialize(new
            {
                selectedDishIds = selectedDishIds ?? []
            });

        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/menu")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };

        if (user is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", user);
        }

        return await client.SendAsync(request);
    }

    private static async Task<(List<string> SelectedDishIds, string? UpdatedAt)> ReadMenuAsync(
        HttpResponseMessage response)
    {
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var data = document.RootElement.GetProperty("data");
        var ids = data.GetProperty("selectedDishIds")
            .EnumerateArray()
            .Select(element => element.GetString()!)
            .ToList();
        var updatedAtElement = data.GetProperty("updatedAt");
        var updatedAt = updatedAtElement.ValueKind == JsonValueKind.Null
            ? null
            : updatedAtElement.GetString();

        return (ids, updatedAt);
    }

    private static async Task<ApiErrorDetail> ReadErrorAsync(HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync();
        return JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        })!;
    }

    private static async Task<string> CreateMenuAsync(
        HttpClient client,
        params string[] selectedDishIds)
    {
        using var response = await PutMenuAsync(client, selectedDishIds, null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (_, updatedAt) = await ReadMenuAsync(response);
        Assert.NotNull(updatedAt);
        return updatedAt!;
    }

    [Fact]
    public async Task Get_WhenNoMenuWasSaved_ReturnsEmptySelectionAndNullVersion()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await GetMenuAsync(client);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (ids, updatedAt) = await ReadMenuAsync(response);
        Assert.Empty(ids);
        Assert.Null(updatedAt);
    }

    [Fact]
    public async Task Put_WithNullExpectation_CreatesMenu()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await PutMenuAsync(client, ["42", "57"], null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (ids, updatedAt) = await ReadMenuAsync(response);
        Assert.Equal(new[] { "42", "57" }, ids);
        Assert.NotNull(updatedAt);

        using var getResponse = await GetMenuAsync(client);
        var (storedIds, storedUpdatedAt) = await ReadMenuAsync(getResponse);
        Assert.Equal(new[] { "42", "57" }, storedIds);
        Assert.Equal(updatedAt, storedUpdatedAt);
    }

    [Fact]
    public async Task Put_WithCurrentVersion_UpdatesMenuAndBumpsVersion()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        var firstVersion = await CreateMenuAsync(client, "42");

        // Act
        using var response = await PutMenuAsync(client, ["57"], firstVersion);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (ids, updatedAt) = await ReadMenuAsync(response);
        Assert.Equal(new[] { "57" }, ids);
        Assert.NotNull(updatedAt);
        Assert.NotEqual(firstVersion, updatedAt);
        Assert.True(DateTimeOffset.Parse(updatedAt!) > DateTimeOffset.Parse(firstVersion));
    }

    [Fact]
    public async Task Put_WithStaleVersion_Returns409AndLeavesStoredMenuUnchanged()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        var staleVersion = await CreateMenuAsync(client, "42");
        using (var newerResponse = await PutMenuAsync(client, ["57"], staleVersion))
        {
            Assert.Equal(HttpStatusCode.OK, newerResponse.StatusCode);
        }

        // Act
        using var response = await PutMenuAsync(client, ["99"], staleVersion);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var error = await ReadErrorAsync(response);
        Assert.Equal("MENU_VERSION_CONFLICT", error.Code);
        Assert.Equal("The menu was modified by another request.", error.Message);

        using var getResponse = await GetMenuAsync(client);
        var (ids, _) = await ReadMenuAsync(getResponse);
        Assert.Equal(new[] { "57" }, ids);
    }

    [Fact]
    public async Task Put_WithNullExpectationWhenMenuExists_Returns409()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        await CreateMenuAsync(client, "42");

        // Act
        using var response = await PutMenuAsync(client, ["57"], null);

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("MENU_VERSION_CONFLICT", (await ReadErrorAsync(response)).Code);
    }

    [Fact]
    public async Task Put_WithVersionWhenNoMenuExists_Returns409()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await PutMenuAsync(client, ["57"], DateTimeOffset.UtcNow.ToString("O"));

        // Assert
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("MENU_VERSION_CONFLICT", (await ReadErrorAsync(response)).Code);

        using var getResponse = await GetMenuAsync(client);
        var (ids, updatedAt) = await ReadMenuAsync(getResponse);
        Assert.Empty(ids);
        Assert.Null(updatedAt);
    }

    [Fact]
    public async Task Put_WithEmptySelection_StoresAVersionedEmptyMenu()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        var firstVersion = await CreateMenuAsync(client, "42");

        // Act
        using var response = await PutMenuAsync(client, [], firstVersion);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (ids, clearedVersion) = await ReadMenuAsync(response);
        Assert.Empty(ids);
        Assert.NotNull(clearedVersion);
        Assert.True(DateTimeOffset.Parse(clearedVersion!) > DateTimeOffset.Parse(firstVersion));

        using var getResponse = await GetMenuAsync(client);
        var (storedIds, storedVersion) = await ReadMenuAsync(getResponse);
        Assert.Empty(storedIds);
        Assert.Equal(clearedVersion, storedVersion);
    }

    [Fact]
    public async Task Put_WithEmptySelectionAndNullExpectation_CreatesVersionedEmptyMenu()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await PutMenuAsync(client, [], null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var (ids, updatedAt) = await ReadMenuAsync(response);
        Assert.Empty(ids);
        Assert.NotNull(updatedAt);

        using var getResponse = await GetMenuAsync(client);
        var (storedIds, storedUpdatedAt) = await ReadMenuAsync(getResponse);
        Assert.Empty(storedIds);
        Assert.Equal(updatedAt, storedUpdatedAt);
    }

    [Fact]
    public async Task Put_WithSameVersionConcurrently_ExactlyOneSucceeds()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var firstClient = CreateClient(factory);
        using var secondClient = CreateClient(factory);
        var version = await CreateMenuAsync(firstClient, "42");

        // Act
        var responses = await Task.WhenAll(
            PutMenuAsync(firstClient, ["57"], version),
            PutMenuAsync(secondClient, ["99"], version));

        // Assert
        try
        {
            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.OK);
            Assert.Single(responses, response => response.StatusCode == HttpStatusCode.Conflict);

            var winner = responses.Single(response => response.StatusCode == HttpStatusCode.OK);
            var winningIds = (await ReadMenuAsync(winner)).SelectedDishIds;

            using var getResponse = await GetMenuAsync(firstClient);
            var (storedIds, _) = await ReadMenuAsync(getResponse);
            Assert.Equal(winningIds, storedIds);
        }
        finally
        {
            foreach (var response in responses)
            {
                response.Dispose();
            }
        }
    }

    [Fact]
    public async Task Put_PreservesOrderAndDuplicates()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await PutMenuAsync(client, ["42", "7", "42"], null);

        // Assert
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(new[] { "42", "7", "42" }, (await ReadMenuAsync(response)).SelectedDishIds);

        using var getResponse = await GetMenuAsync(client);
        Assert.Equal(new[] { "42", "7", "42" }, (await ReadMenuAsync(getResponse)).SelectedDishIds);
    }

    [Fact]
    public async Task Menus_AreIsolatedPerUser()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        await CreateMenuAsync(client, "42");

        // Act
        using var bobGet = await GetMenuAsync(client, "bob");
        using var bobPut = await PutMenuAsync(client, ["99"], null, "bob");

        // Assert
        Assert.Equal(HttpStatusCode.OK, bobGet.StatusCode);
        var (bobIdsBefore, bobVersionBefore) = await ReadMenuAsync(bobGet);
        Assert.Empty(bobIdsBefore);
        Assert.Null(bobVersionBefore);

        Assert.Equal(HttpStatusCode.OK, bobPut.StatusCode);
        Assert.Equal(new[] { "99" }, (await ReadMenuAsync(bobPut)).SelectedDishIds);

        using var aliceGet = await GetMenuAsync(client, "alice");
        Assert.Equal(new[] { "42" }, (await ReadMenuAsync(aliceGet)).SelectedDishIds);
    }

    [Fact]
    public async Task UnauthenticatedRequests_Return401()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var getResponse = await GetMenuAsync(client, user: null);
        using var putResponse = await PutMenuAsync(client, [], null, user: null);

        // Assert
        Assert.Equal(HttpStatusCode.Unauthorized, getResponse.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, putResponse.StatusCode);
    }

    [Fact]
    public async Task Put_WithMissingExpectedVersion_Returns400ValidationError()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);

        // Act
        using var response = await PutMenuAsync(client, [], null, includeExpectedUpdatedAt: false);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", (await ReadErrorAsync(response)).Code);

        using var getResponse = await GetMenuAsync(client);
        var (ids, updatedAt) = await ReadMenuAsync(getResponse);
        Assert.Empty(ids);
        Assert.Null(updatedAt);
    }

    [Fact]
    public async Task Put_WithMalformedExpectedVersion_Returns400ValidationError()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        const string body = """
            {"selectedDishIds":[],"expectedUpdatedAt":"not-a-timestamp"}
            """;

        using var request = new HttpRequestMessage(HttpMethod.Put, "/api/menu")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "alice");

        // Act
        using var response = await client.SendAsync(request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("VALIDATION_ERROR", (await ReadErrorAsync(response)).Code);
    }

    [Fact]
    public async Task SuccessivePuts_HaveStrictlyIncreasingVersions()
    {
        // Arrange
        var store = new InMemoryFirestoreService();
        using var factory = CreateFactory(store);
        using var client = CreateClient(factory);
        var versions = new List<DateTimeOffset>();
        string? expected = null;

        // Act
        for (var i = 0; i < 6; i++)
        {
            using var response = await PutMenuAsync(client, [i.ToString()], expected);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            expected = (await ReadMenuAsync(response)).UpdatedAt;
            Assert.NotNull(expected);
            versions.Add(DateTimeOffset.Parse(expected!));
        }

        // Assert
        for (var i = 1; i < versions.Count; i++)
        {
            Assert.True(versions[i] > versions[i - 1]);
        }
    }
}
