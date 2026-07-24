using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class FeedbackServiceTests
{
    [Fact]
    public async Task SubmitFeedback_DoesNotThrow()
    {
        // Arrange
        var service = new FeedbackService();
        var payload = new FeedbackPayload { Message = "Great app!" };

        // Act & Assert (should not throw)
        await service.SubmitFeedbackAsync("user1", payload);
    }
}
