using System.Text.Json.Serialization;

namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Field-level validation error.
/// </summary>
public class ApiFieldError
{
    /// <summary>
    /// The field that failed validation.
    /// </summary>
    public string Field { get; set; } = string.Empty;

    /// <summary>
    /// Validation error message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Rejected value (if available).
    /// </summary>
    public object? RejectedValue { get; set; }
}

/// <summary>
/// Structured error response.
/// </summary>
public class ApiErrorDetail
{
    /// <summary>
    /// Machine-readable error code (e.g. "VALIDATION_ERROR", "NOT_FOUND").
    /// </summary>
    public string Code { get; set; } = string.Empty;

    /// <summary>
    /// Human-readable error message.
    /// </summary>
    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Optional field-level validation errors.
    /// </summary>
    public List<ApiFieldError>? Details { get; set; }
}
