using System.Net;
using System.Text.Json;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Middleware;

/// <summary>
/// Global error handling middleware that catches unhandled exceptions
/// and returns structured JSON error responses.
/// </summary>
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred during request processing.");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, errorCode, message) = exception switch
        {
            KeyNotFoundException => (HttpStatusCode.NotFound, "NOT_FOUND", "The requested resource was not found."),
            ArgumentException => (HttpStatusCode.BadRequest, "BAD_REQUEST", exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, "UNAUTHORIZED", "Access denied."),
            InvalidOperationException => (HttpStatusCode.BadRequest, "INVALID_OPERATION", exception.Message),
            _ => (HttpStatusCode.InternalServerError, "INTERNAL_ERROR", "An unexpected error occurred.")
        };

        context.Response.StatusCode = (int)statusCode;

        var errorResponse = new ApiErrorDetail
        {
            Code = errorCode,
            Message = message
        };

        var json = JsonSerializer.Serialize(errorResponse, new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        });

        await context.Response.WriteAsync(json);
    }
}
