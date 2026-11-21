namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// Firebase/Firestore configuration options.
/// </summary>
public class FirebaseSettings
{
    /// <summary>
    /// Firebase project ID used to initialize Firestore.
    /// </summary>
    public string? ProjectId { get; set; }

    /// <summary>
    /// Firebase Web API key used for Auth REST calls.
    /// </summary>
    public string? ApiKey { get; set; }

    /// <summary>
    /// Base64-encoded service account JSON. When empty, Application Default
    /// Credentials are used instead.
    /// </summary>
    public string? CredentialsJson { get; set; }
}
