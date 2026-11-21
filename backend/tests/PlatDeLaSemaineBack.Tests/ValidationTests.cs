using System.ComponentModel.DataAnnotations;
using PlatDeLaSemaineBack.Models;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class ValidationTests
{
    private static List<ValidationResult> Validate(object model)
    {
        var results = new List<ValidationResult>();
        var context = new ValidationContext(model);
        Validator.TryValidateObject(model, context, results, validateAllProperties: true);
        return results;
    }

    // ── CreateDishPayload ───────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void CreateDishPayload_NameRequired(string? name)
    {
        var payload = new CreateDishPayload { Name = name!, Course = 1, Seasons = [0] };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Name"));
    }

    [Fact]
    public void CreateDishPayload_NameExceedsMaxLength()
    {
        var payload = new CreateDishPayload
        {
            Name = new string('a', 201),
            Course = 1,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("200"));
    }

    [Fact]
    public void CreateDishPayload_NameAtMaxLength_IsValid()
    {
        var payload = new CreateDishPayload
        {
            Name = new string('a', 200),
            Course = 1,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Name"));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    [InlineData(10)]
    public void CreateDishPayload_CourseOutOfRange(int course)
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = course,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Course"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    public void CreateDishPayload_CourseInBounds_IsValid(int course)
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = course,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Course"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsEmpty_IsInvalid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = []
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsNull_IsInvalid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = null!
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(4)]
    [InlineData(99)]
    public void CreateDishPayload_SeasonValueOutOfRange(int season)
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [season]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Season value"));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    public void CreateDishPayload_SeasonValueInBounds_IsValid(int season)
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [season]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Season value"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsMaxFour_IsValid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [0, 1, 2, 3]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsMoreThanFour_IsInvalid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [0, 1, 2, 3, 4]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("four"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsDuplicate_IsInvalid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [0, 0]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("duplicate"));
    }

    [Fact]
    public void CreateDishPayload_SeasonsNotAscending_IsValid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Course = 1,
            Seasons = [2, 0, 1]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Fact]
    public void CreateDishPayload_DescriptionExceedsMaxLength()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Description = new string('a', 5001),
            Course = 1,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Description"));
    }

    [Fact]
    public void CreateDishPayload_DescriptionAtMaxLength_IsValid()
    {
        var payload = new CreateDishPayload
        {
            Name = "Pizza",
            Description = new string('a', 5000),
            Course = 1,
            Seasons = [0]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Description"));
    }

    [Fact]
    public void CreateDishPayload_ValidModel_NoErrors()
    {
        var payload = new CreateDishPayload
        {
            Name = "Margherita",
            Description = "Classic tomato and mozzarella",
            Course = 1,
            Seasons = [0, 1, 2]
        };
        var results = Validate(payload);
        Assert.Empty(results);
    }

    // ── UpdateDishPayload ───────────────────────────────────────────

    [Fact]
    public void UpdateDishPayload_NameExceedsMaxLength()
    {
        var payload = new UpdateDishPayload { Name = new string('a', 201) };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Name"));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(3)]
    public void UpdateDishPayload_CourseOutOfRange(int course)
    {
        var payload = new UpdateDishPayload { Course = course };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Course"));
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(4)]
    public void UpdateDishPayload_SeasonValueOutOfRange(int season)
    {
        var payload = new UpdateDishPayload { Seasons = [season] };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Season value"));
    }

    [Fact]
    public void UpdateDishPayload_SeasonsMaxFour_IsValid()
    {
        var payload = new UpdateDishPayload { Seasons = [0, 1, 2, 3] };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Fact]
    public void UpdateDishPayload_SeasonsMoreThanFour_IsInvalid()
    {
        var payload = new UpdateDishPayload { Seasons = [0, 1, 2, 3, 4] };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("four"));
    }

    [Fact]
    public void UpdateDishPayload_SeasonsDuplicate_IsInvalid()
    {
        var payload = new UpdateDishPayload { Seasons = [0, 0] };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("duplicate"));
    }

    [Fact]
    public void UpdateDishPayload_SeasonsNotAscending_IsValid()
    {
        var payload = new UpdateDishPayload { Seasons = [2, 0, 1] };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Seasons"));
    }

    [Fact]
    public void UpdateDishPayload_NullFields_NoErrors()
    {
        var payload = new UpdateDishPayload();
        var results = Validate(payload);
        Assert.Empty(results);
    }

    [Fact]
    public void UpdateDishPayload_ValidValues_NoErrors()
    {
        var payload = new UpdateDishPayload
        {
            Name = "New Name",
            Description = "New desc",
            Course = 2,
            Seasons = [0, 3]
        };
        var results = Validate(payload);
        Assert.Empty(results);
    }

    // ── FeedbackPayload ─────────────────────────────────────────────

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void FeedbackPayload_MessageRequired(string? message)
    {
        var payload = new FeedbackPayload { Message = message!, AppVersion = "1.0.0" };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("Message"));
    }

    [Fact]
    public void FeedbackPayload_MessageExceedsMaxLength()
    {
        var payload = new FeedbackPayload
        {
            Message = new string('a', 2001),
            AppVersion = "1.0.0"
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("2000"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void FeedbackPayload_AppVersionRequired(string? version)
    {
        var payload = new FeedbackPayload { Message = "Bug report", AppVersion = version! };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("AppVersion"));
    }

    [Fact]
    public void FeedbackPayload_ValidModel_NoErrors()
    {
        var payload = new FeedbackPayload
        {
            Message = "Great app!",
            AppVersion = "1.0.0"
        };
        var results = Validate(payload);
        Assert.Empty(results);
    }

    [Fact]
    public void FeedbackPayload_MessageAtMaxLength_IsValid()
    {
        var payload = new FeedbackPayload
        {
            Message = new string('a', 2000),
            AppVersion = "1.0.0"
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("Message"));
    }

    // ── SaveMenuPayload ─────────────────────────────────────────────

    [Fact]
    public void SaveMenuPayload_EmptySelection_IsValid()
    {
        var payload = new SaveMenuPayload { SelectedDishIds = [] };
        var results = Validate(payload);
        Assert.Empty(results);
    }

    [Fact]
    public void SaveMenuPayload_ValidSelection_NoErrors()
    {
        var payload = new SaveMenuPayload
        {
            SelectedDishIds = ["42", "57"]
        };
        var results = Validate(payload);
        Assert.Empty(results);
    }

    [Fact]
    public void SaveMenuPayload_SelectedDishIdsAtMaxLength_IsValid()
    {
        var ids = Enumerable.Range(0, SaveMenuPayload.MaxSelectedDishIds)
            .Select(i => i.ToString())
            .ToList();
        var payload = new SaveMenuPayload { SelectedDishIds = ids };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("SelectedDishIds"));
    }

    [Fact]
    public void SaveMenuPayload_SelectedDishIdsOverMaxLength_IsInvalid()
    {
        var ids = Enumerable.Range(0, SaveMenuPayload.MaxSelectedDishIds + 1)
            .Select(i => i.ToString())
            .ToList();
        var payload = new SaveMenuPayload { SelectedDishIds = ids };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains($"{SaveMenuPayload.MaxSelectedDishIds}"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void SaveMenuPayload_BlankDishId_IsInvalid(string blank)
    {
        var payload = new SaveMenuPayload { SelectedDishIds = ["42", blank] };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains("empty ids"));
    }

    [Fact]
    public void SaveMenuPayload_DishIdAtMaxLength_IsValid()
    {
        var payload = new SaveMenuPayload
        {
            SelectedDishIds = [new string('a', SaveMenuPayload.MaxSelectedDishIdLength)]
        };
        var results = Validate(payload);
        Assert.DoesNotContain(results, r => r.ErrorMessage!.Contains("longer than"));
    }

    [Fact]
    public void SaveMenuPayload_DishIdOverMaxLength_IsInvalid()
    {
        var payload = new SaveMenuPayload
        {
            SelectedDishIds = [new string('a', SaveMenuPayload.MaxSelectedDishIdLength + 1)]
        };
        var results = Validate(payload);
        Assert.Contains(results, r => r.ErrorMessage!.Contains($"{SaveMenuPayload.MaxSelectedDishIdLength} characters"));
    }

    [Fact]
    public void SaveMenuPayload_DuplicateDishIds_IsValid()
    {
        // The same dish can be picked more than once in a menu.
        var payload = new SaveMenuPayload { SelectedDishIds = ["42", "42"] };
        var results = Validate(payload);
        Assert.Empty(results);
    }
}
