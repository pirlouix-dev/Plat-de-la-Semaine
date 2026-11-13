namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Raised when a menu write is conditional on a version that is no longer the
/// stored one. The write is rejected so a client cannot overwrite a version it
/// has not seen.
/// </summary>
public class MenuVersionConflictException : Exception
{
    public const string ErrorCode = "MENU_VERSION_CONFLICT";

    public MenuVersionConflictException()
        : base("The menu was modified by another request.")
    {
    }
}
