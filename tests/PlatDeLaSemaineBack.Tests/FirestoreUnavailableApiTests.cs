using System.Net;
using System.Net.Http.Headers;
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
/// Verifies that an unreachable Firestore is surfaced as a non-2xx response.
/// A successful empty list is a meaningful answer for the offline-first client,
/// so an outage must never be reported that way.
/// </summary>
[Collection(EnvironmentVariableCollection.Name)]
public class FirestoreUnavailableApiTests
{
    private static WebApplicationFactory<Program> CreateFactory()
    {
        return new WebApplicationFactory<Program>().WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment("Development");

            builder.ConfigureServices(services =>
            {
                var firestore = Substitute.For<IFirestoreService>();
                firestore.GetDishesByUserIdAsync(Arg.Any<string>(), Arg.Any<DateTimeOffset?>())
                    .Returns(Task.FromException<List<Dish>>(new FirestoreUnavailableException()));
                firestore.GetUserByIdAsync(Arg.Any<string>())
                    .Returns(Task.FromException<User?>(new FirestoreUnavailableException()));
                firestore.GetVersionInfoAsync()
                    .Returns(Task.FromException<VersionInfo?>(new FirestoreUnavailableException()));
                firestore.GetMenuAsync(Arg.Any<string>())
                    .Returns(Task.FromException<Menu?>(new FirestoreUnavailableException()));

                services.RemoveAll<IFirestoreService>();
                services.AddSingleton(firestore);

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

    private static async Task<HttpResponseMessage> GetAsync(HttpClient client, string path)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, path);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", "alice");
        return await client.SendAsync(request);
    }

    private static async Task AssertServiceUnavailableAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.ServiceUnavailable, response.StatusCode);

        var body = await response.Content.ReadAsStringAsync();
        var error = JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.NotNull(error);
        Assert.Equal("SERVICE_UNAVAILABLE", error!.Code);
    }

    [Fact]
    public async Task GetDishes_WhenFirestoreUnavailable_Returns503()
    {
        // Arrange
        using var factory = CreateFactory();
        using var client = CreateClient(factory);

        // Act
        using var response = await GetAsync(client, "/api/dishes");

        // Assert
        await AssertServiceUnavailableAsync(response);
    }

    [Fact]
    public async Task GetBackups_WhenFirestoreUnavailable_Returns503()
    {
        // Arrange
        using var factory = CreateFactory();
        using var client = CreateClient(factory);

        // Act
        using var response = await GetAsync(client, "/api/backups");

        // Assert
        await AssertServiceUnavailableAsync(response);
    }

    [Fact]
    public async Task GetVersion_WhenFirestoreUnavailable_Returns503()
    {
        // Arrange
        using var factory = CreateFactory();
        using var client = CreateClient(factory);

        // Act
        using var response = await client.GetAsync("/api/version");

        // Assert
        await AssertServiceUnavailableAsync(response);
    }

    [Fact]
    public async Task GetMenu_WhenFirestoreUnavailable_Returns503()
    {
        // Arrange
        using var factory = CreateFactory();
        using var client = CreateClient(factory);

        // Act
        using var response = await GetAsync(client, "/api/menu");

        // Assert
        await AssertServiceUnavailableAsync(response);
    }
}
