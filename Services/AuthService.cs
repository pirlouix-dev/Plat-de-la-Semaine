using System.Net.Http.Json;
using System.Text.Json.Serialization;
using FirebaseAdmin.Auth;
using Microsoft.Extensions.Options;
using PlatDeLaSemaineBack.Configuration;
using PlatDeLaSemaineBack.Models;

using System.Linq;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling authentication via Firebase Auth.
/// </summary>
public class AuthService : IAuthService
{
    private readonly HttpClient _http;
    private readonly IFirestoreService _firestore;
    private readonly string _apiKey;

    private const string IdentityToolkitUrl = "https://identitytoolkit.googleapis.com/v1/accounts";
    private const string SecureTokenUrl = "https://securetoken.googleapis.com/v1/token";

    public AuthService(HttpClient http, IFirestoreService firestore, IOptions<FirebaseSettings> settings)
    {
        _http = http;
        _firestore = firestore;

        if (string.IsNullOrEmpty(settings.Value.ApiKey))
            throw new InvalidOperationException("FIREBASE_API_KEY is not configured.");

        _apiKey = settings.Value.ApiKey;
    }

    /// <inheritdoc />
    public async Task<AuthResponse> RegisterAsync(string email, string password, string username)
    {
        var userRecordArgs = new UserRecordArgs
        {
            Email = email,
            Password = password,
            EmailVerified = true,
        };

        var userRecord = await FirebaseAuth.DefaultInstance.CreateUserAsync(userRecordArgs);

        var user = new User
        {
            CreatedAt = DateTimeOffset.UtcNow,
            Username = username,
        };
        await _firestore.InsertUserAsync(user, userRecord.Uid);

        var result = await SignInInternalAsync(email, password);

        return new AuthResponse
        {
            IdToken = result.IdToken,
            RefreshToken = result.RefreshToken,
            ExpiresIn = result.ExpiresIn,
            UserId = result.LocalId,
            Username = username
        };
    }

    /// <inheritdoc />
    public async Task<AuthResponse> LoginAsync(string email, string password)
    {
        var result = await SignInInternalAsync(email, password);

        var user = await _firestore.GetUserByIdAsync(result.LocalId)
            ?? throw new InvalidOperationException("User not found in Firestore.");

        return new AuthResponse
        {
            IdToken = result.IdToken,
            RefreshToken = result.RefreshToken,
            ExpiresIn = result.ExpiresIn,
            UserId = result.LocalId,
            Username = user.Username
        };
    }

    /// <inheritdoc />
    public async Task<RefreshResponse> RefreshTokenAsync(string refreshToken)
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

        return new RefreshResponse
        {
            IdToken = result.IdToken,
            RefreshToken = result.RefreshToken,
            ExpiresIn = result.ExpiresIn
        };
    }

    private async Task<SignInResponse> SignInInternalAsync(string email, string password)
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

        return await response.Content.ReadFromJsonAsync<SignInResponse>()
            ?? throw new InvalidOperationException("Invalid response from Firebase.");
    }

    /// <inheritdoc />
    public async Task UpdateUsernameAsync(string userId, string username)
    {
        var user = await _firestore.GetUserByIdAsync(userId)
            ?? throw new KeyNotFoundException("User not found.");

        user.Username = username;
        await _firestore.UpdateUserAsync(user);
    }

    /// <inheritdoc />
    public async Task SendPasswordResetEmailAsync(string email)
    {
        var request = new Dictionary<string, string>
        {
            { "requestType", "PASSWORD_RESET" },
            { "email", email }
        };

        var response = await _http.PostAsJsonAsync(
            $"{IdentityToolkitUrl}:sendOobCode?key={_apiKey}", request);

        if (!response.IsSuccessStatusCode)
        {
            var errorBody = await response.Content.ReadFromJsonAsync<SignInErrorResponse>();
            var errorMessage = errorBody?.Error?.Message ?? "Failed to send password reset email.";
            throw new InvalidOperationException(errorMessage);
        }
    }

    /// <inheritdoc />
    public async Task DeleteAccountAsync(string userId)
    {
        await FirebaseAuth.DefaultInstance.DeleteUserAsync(userId);

        var dishes = await _firestore.GetDishesByUserIdAsync(userId, null);
        var backups = await _firestore.GetBackupsByUserIdAsync(userId);

        var dishIds = dishes.Where(d => d.Id != null).Select(d => d.Id!).ToList();
        var backupIds = backups.Where(b => b.Id != null).Select(b => b.Id!).ToList();

        if (dishIds.Count > 0)
            await _firestore.DeleteBatchAsync(userId, "Dishes", dishIds);
        if (backupIds.Count > 0)
            await _firestore.DeleteBatchAsync(userId, "Backups", backupIds);

        await _firestore.DeleteUserAsync(userId);
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
