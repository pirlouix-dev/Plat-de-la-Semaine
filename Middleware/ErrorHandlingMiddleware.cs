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
            if (ex is UnauthorizedAccessException)
                _logger.LogWarning("Authorization failed.");
            else
                _logger.LogError(ex, "An unhandled exception occurred during request processing.");

            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";

        var (statusCode, errorCode, message) = exception switch
        {
            ApiException apiException => (apiException.StatusCode, apiException.ErrorCode, apiException.Message),
            KeyNotFoundException => (HttpStatusCode.NotFound, ApiErrorCodes.NotFound, "The requested resource was not found."),
            MenuVersionConflictException => (HttpStatusCode.Conflict, MenuVersionConflictException.ErrorCode, exception.Message),
            ArgumentException => (HttpStatusCode.BadRequest, ApiErrorCodes.BadRequest, exception.Message),
            UnauthorizedAccessException => (HttpStatusCode.Unauthorized, ApiErrorCodes.Unauthorized, exception.Message),
            FirebaseAdmin.Auth.FirebaseAuthException => (HttpStatusCode.Unauthorized, ApiErrorCodes.AuthFailed, "Authentication failed."),
            InvalidOperationException => (HttpStatusCode.BadRequest, ApiErrorCodes.InvalidOperation, exception.Message),
            _ => (HttpStatusCode.InternalServerError, ApiErrorCodes.InternalError, "An unexpected error occurred.")
        };

        context.Response.StatusCode = (int)statusCode;

        // An unavailable dependency is transient, so tell well-behaved clients
        // when a retry is worth attempting instead of having them hammer us.
        if (statusCode == HttpStatusCode.ServiceUnavailable)
            context.Response.Headers.RetryAfter = "5";

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
