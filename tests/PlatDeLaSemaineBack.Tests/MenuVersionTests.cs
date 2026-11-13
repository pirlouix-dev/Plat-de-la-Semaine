using Google.Cloud.Firestore;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class MenuVersionTests
{
    [Fact]
    public void Next_WithoutPrevious_ReturnsNow()
    {
        var now = new DateTimeOffset(2026, 11, 11, 20, 0, 0, TimeSpan.Zero);

        var next = MenuVersion.Next(now, null);

        Assert.Equal(now, next);
    }

    [Fact]
    public void Next_WhenClockAdvanced_ReturnsNow()
    {
        var previous = new DateTimeOffset(2026, 11, 11, 20, 0, 0, TimeSpan.Zero);
        var now = previous.AddSeconds(1);

        var next = MenuVersion.Next(now, previous);

        Assert.Equal(now, next);
    }

    [Fact]
    public void Next_WhenClockHasNotAdvanced_StrictlyBumpsPrevious()
    {
        var previous = new DateTimeOffset(2026, 11, 11, 20, 0, 0, TimeSpan.Zero);

        var next = MenuVersion.Next(previous, previous);

        Assert.True(next > previous);
    }

    [Fact]
    public void Next_WhenClockMovedBackwards_StrictlyBumpsPrevious()
    {
        var previous = new DateTimeOffset(2026, 11, 11, 20, 0, 0, TimeSpan.Zero);
        var now = previous.AddSeconds(-5);

        var next = MenuVersion.Next(now, previous);

        Assert.True(next > previous);
    }

    [Fact]
    public void Next_ReturnsAMicrosecondAlignedValue()
    {
        // DateTimeOffset has 100 ns ticks, Firestore stores microseconds. A value
        // with sub-microsecond ticks would be truncated on write and never match
        // the version returned to the client.
        var now = new DateTimeOffset(2026, 11, 13, 17, 54, 23, TimeSpan.Zero)
            .AddTicks(8_732_944);

        var next = MenuVersion.Next(now, null);

        Assert.Equal(0, next.Ticks % TimeSpan.TicksPerMicrosecond);
    }

    [Fact]
    public void Next_RoundTripsThroughFirestorePrecision()
    {
        // The version sent back to the client must be the value Firestore keeps,
        // otherwise the client's next expectedUpdatedAt can never match.
        var now = new DateTimeOffset(2026, 11, 13, 17, 54, 23, TimeSpan.Zero)
            .AddTicks(8_732_944);

        var next = MenuVersion.Next(now, null);
        var stored = Timestamp.FromDateTimeOffset(next).ToDateTimeOffset();

        Assert.Equal(next, stored);
    }
}
