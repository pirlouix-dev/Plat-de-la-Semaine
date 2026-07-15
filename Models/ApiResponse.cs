namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Standard API response wrapper for consistent error formatting.
/// </summary>
public class ApiResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? Data { get; set; }
}

/// <summary>
/// Standard error response structure.
/// </summary>
public class ErrorResponse
{
    public string ErrorCode { get; set; } = "UNKNOWN_ERROR";
    public string Message { get; set; } = string.Empty;
    public string? Details { get; set; }
}
