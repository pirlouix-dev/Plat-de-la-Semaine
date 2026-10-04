using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using PlatDeLaSemaineBack.Middleware;
using PlatDeLaSemaineBack.Models;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class ErrorHandlingMiddlewareTests
{
    [Fact]
    public async Task InvokeAsync_NoException_CallsNextDelegate()
    {
        // Arrange
        var wasCalled = false;
        var middleware = new ErrorHandlingMiddleware(
            _ =>
            {
                wasCalled = true;
                return Task.CompletedTask;
            },
            NullLogger<ErrorHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.True(wasCalled);
    }

    [Fact]
    public async Task InvokeAsync_KeyNotFoundException_Returns404()
    {
        // Arrange
        var middleware = new ErrorHandlingMiddleware(
            _ => throw new KeyNotFoundException("Dish not found."),
            NullLogger<ErrorHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status404NotFound, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var response = JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.NotNull(response);
        Assert.Equal("NOT_FOUND", response!.Code);
        Assert.Equal("The requested resource was not found.", response.Message);
    }

    [Fact]
    public async Task InvokeAsync_ArgumentException_Returns400()
    {
        // Arrange
        var middleware = new ErrorHandlingMiddleware(
            _ => throw new ArgumentException("Invalid dish name."),
            NullLogger<ErrorHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var response = JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.NotNull(response);
        Assert.Equal("BAD_REQUEST", response!.Code);
        Assert.Equal("Invalid dish name.", response.Message);
    }

    [Fact]
    public async Task InvokeAsync_GenericException_Returns500()
    {
        // Arrange
        var middleware = new ErrorHandlingMiddleware(
            _ => throw new InvalidOperationException("Something went wrong."),
            NullLogger<ErrorHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        // Act
        await middleware.InvokeAsync(context);

        // Assert
        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        var response = JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        Assert.NotNull(response);
        Assert.Equal("INVALID_OPERATION", response!.Code);
    }

    [Fact]
    public async Task InvokeAsync_UnauthorizedAccessException_Returns401()
    {
        // Arrange & Act
        var (statusCode, body) = await CaptureAsync(
            new UnauthorizedAccessException("Missing or invalid authorization header."));

        // Assert
        Assert.Equal(StatusCodes.Status401Unauthorized, statusCode);
        var response = JsonSerializer.Deserialize<ApiErrorDetail>(body, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });
        Assert.NotNull(response);
        Assert.Equal("UNAUTHORIZED", response!.Code);
    }

    [Fact]
    public async Task InvokeAsync_OwnershipFailure_IsIndistinguishableFromMissingResource()
    {
        // A resource that exists under another owner must produce byte-identical
        // output to a resource that does not exist, so the response cannot be used
        // as an existence oracle (issue #39).
        // Arrange & Act
        var missing = await CaptureAsync(new KeyNotFoundException("Dish not found."));
        var unowned = await CaptureAsync(new KeyNotFoundException("You do not own this dish."));

        // Assert
        Assert.Equal(missing.StatusCode, unowned.StatusCode);
        Assert.Equal(missing.Body, unowned.Body);
    }

    private static async Task<(int StatusCode, string Body)> CaptureAsync(Exception exception)
    {
        var middleware = new ErrorHandlingMiddleware(
            _ => throw exception,
            NullLogger<ErrorHandlingMiddleware>.Instance);

        var context = new DefaultHttpContext();
        context.Response.Body = new MemoryStream();

        await middleware.InvokeAsync(context);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        var body = await new StreamReader(context.Response.Body).ReadToEndAsync();
        return (context.Response.StatusCode, body);
    }
}
