using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FirebaseAdmin.Auth;
using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling authentication via Firebase Auth.
/// </summary>
public class AuthService : IAuthService
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    private const string IdentityToolkitUrl = "https://identitytoolkit.googleapis.com/v1/accounts";
    private const string SecureTokenUrl = "https://securetoken.googleapis.com/v1/token";

    public AuthService(HttpClient http)
    {
        _http = http;

        _apiKey = Environment.GetEnvironmentVariable("FIREBASE_API_KEY")
            ?? throw new InvalidOperationException("FIREBASE_API_KEY is not configured.");
    }

    /// <inheritdoc />
    public async Task<AuthResponse> RegisterAsync(string email, string password)
    {
        var userRecordArgs = new UserRecordArgs
        {
            Email = email,
            Password = password,
        };

        await FirebaseAuth.DefaultInstance.CreateUserAsync(userRecordArgs);

        return await SignInAsync(email, password);
    }

    /// <inheritdoc />
    public async Task<AuthResponse> LoginAsync(string email, string password)
    {
        return await SignInAsync(email, password);
    }

    /// <inheritdoc />
    public async Task<AuthResponse> RefreshTokenAsync(string refreshToken)
    {
        var request = new Dictionary<string, string>
        {
            { "grant_type", "refresh_token" },
            { "refresh_token", refreshToken }
        };

        var response = await _http.PostAsJsonAsync($"{SecureTokenUrl}?key={_apiKey}", request);
        response.EnsureSuccessStatusCode();

        var result = await response.Content.ReadFromJsonAsync<SecureTokenResponse>()
            ?? throw new InvalidOperationException("Invalid response from Firebase.");

        return new AuthResponse
        {
            IdToken = result.IdToken,
            RefreshToken = result.RefreshToken,
            ExpiresIn = result.ExpiresIn,
            UserId = result.UserId
        };
    }

    private async Task<AuthResponse> SignInAsync(string email, string password)
    {
        var request = new Dictionary<string, string>
        {
            { "email", email },
            { "password", password },
            { "returnSecureToken", "true" }
        };

        var response = await _http.PostAsJsonAsync($"{IdentityToolkitUrl}:signInWithPassword?key={_apiKey}", request);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadFromJsonAsync<SignInErrorResponse>();
            var errorMessage = errorBody?.Error?.Message ?? "Authentication failed.";
            throw new UnauthorizedAccessException(errorMessage);
        }

        var result = await response.Content.ReadFromJsonAsync<SignInResponse>()
            ?? throw new InvalidOperationException("Invalid response from Firebase.");

        return new AuthResponse
        {
            IdToken = result.IdToken,
            RefreshToken = result.RefreshToken,
            ExpiresIn = result.ExpiresIn,
            UserId = result.LocalId
        };
    }
}

internal class SignInResponse
{
    [JsonPropertyName("idToken")]
    public string IdToken { get; set; } = string.Empty;

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = string.Empty;

    [JsonPropertyName("expiresIn")]
    public string ExpiresIn { get; set; } = string.Empty;

    [JsonPropertyName("localId")]
    public string LocalId { get; set; } = string.Empty;
}

internal class SecureTokenResponse
{
    [JsonPropertyName("id_token")]
    public string IdToken { get; set; } = string.Empty;

    [JsonPropertyName("refresh_token")]
    public string RefreshToken { get; set; } = string.Empty;

    [JsonPropertyName("expires_in")]
    public string ExpiresIn { get; set; } = string.Empty;

    [JsonPropertyName("user_id")]
    public string UserId { get; set; } = string.Empty;
}

internal class SignInErrorResponse
{
    [JsonPropertyName("error")]
    public SignInError? Error { get; set; }
}

internal class SignInError
{
    [JsonPropertyName("message")]
    public string Message { get; set; } = string.Empty;
}
