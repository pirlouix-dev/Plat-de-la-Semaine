using System.Text.Json;
using PlatDeLaSemaineBack.Models;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// Pins the JSON wire contract of the menu endpoints, using the same
/// web defaults as <c>AddControllers()</c>.
/// </summary>
public class MenuJsonTests
{
    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web);

    [Fact]
    public void MenuResponse_SerializesModeAsLowercaseString()
    {
        // Arrange
        var response = new MenuResponse
        {
            Data = new Menu
            {
                SelectedDishIds = ["42", "57"],
                Mode = MenuMode.Recap,
                UpdatedAt = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero)
            }
        };

        // Act
        var json = JsonSerializer.Serialize(response, Options);

        // Assert
        Assert.Contains("\"mode\":\"recap\"", json);
        Assert.Contains("\"selectedDishIds\":[\"42\",\"57\"]", json);
    }

    [Fact]
    public void EmptyMenu_SerializesEmptySelectionAndNullUpdatedAt()
    {
        // Arrange
        var response = new MenuResponse { Data = new Menu() };

        // Act
        var json = JsonSerializer.Serialize(response, Options);

        // Assert
        Assert.Contains("\"selectedDishIds\":[]", json);
        Assert.Contains("\"mode\":\"editing\"", json);
        Assert.Contains("\"updatedAt\":null", json);
    }

    [Theory]
    [InlineData("editing", MenuMode.Editing)]
    [InlineData("recap", MenuMode.Recap)]
    public void SaveMenuPayload_AcceptsLowercaseMode(string json, MenuMode expected)
    {
        // Act
        var payload = JsonSerializer.Deserialize<SaveMenuPayload>(
            $$"""{"selectedDishIds":[],"mode":"{{json}}"}""", Options);

        // Assert
        Assert.Equal(expected, payload!.Mode);
    }

    [Theory]
    [InlineData("Recap")]
    [InlineData("RECAP")]
    [InlineData("review")]
    [InlineData("1")]
    [InlineData("")]
    public void SaveMenuPayload_RejectsAnyOtherMode(string mode)
    {
        // Act & Assert
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveMenuPayload>(
            $$"""{"selectedDishIds":[],"mode":"{{mode}}"}""", Options));
    }

    [Fact]
    public void SaveMenuPayload_MissingMode_IsRejected()
    {
        // Act & Assert
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveMenuPayload>(
            """{"selectedDishIds":[]}""", Options));
    }

    [Fact]
    public void SaveMenuPayload_NullMode_IsRejected()
    {
        // Act & Assert
        Assert.Throws<JsonException>(() => JsonSerializer.Deserialize<SaveMenuPayload>(
            """{"selectedDishIds":[],"mode":null}""", Options));
    }
}
