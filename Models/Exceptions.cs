namespace PlatDeLaSemaineBack.Models;

public class EmailNotVerifiedException : Exception
{
    public EmailNotVerifiedException()
        : base("Email not verified.") { }
}
