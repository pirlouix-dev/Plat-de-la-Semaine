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
    public void MenuResponse_SerializesSelectionAndUpdatedAt()
    {
        // Arrange
        var response = new MenuResponse
        {
            Data = new Menu
            {
                SelectedDishIds = ["42", "57"],
                UpdatedAt = new DateTimeOffset(2026, 10, 16, 12, 0, 0, TimeSpan.Zero)
            }
        };

        // Act
        var json = JsonSerializer.Serialize(response, Options);

        // Assert
        Assert.Contains("\"selectedDishIds\":[\"42\",\"57\"]", json);
        Assert.DoesNotContain("\"mode\"", json);
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
        Assert.Contains("\"updatedAt\":null", json);
        Assert.DoesNotContain("\"mode\"", json);
    }

    [Fact]
    public void SaveMenuPayload_DeserializesSelectionOnly()
    {
        // Act
        var payload = JsonSerializer.Deserialize<SaveMenuPayload>(
            """{"selectedDishIds":["42","57"]}""", Options);

        // Assert
        Assert.Equal(new[] { "42", "57" }, payload!.SelectedDishIds);
    }
}
