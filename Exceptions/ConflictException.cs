namespace PlatDeLaSemaineBack.Exceptions;

/// <summary>
/// Thrown when a request conflicts with the current state of a resource,
/// such as attempting to create a dish whose id already belongs to another user.
/// Maps to HTTP 409 Conflict.
/// </summary>
public class ConflictException : Exception
{
    public ConflictException(string message) : base(message)
    {
    }
}
