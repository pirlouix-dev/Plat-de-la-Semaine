namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Produces the server-owned version stamp for a menu write.
/// </summary>
public static class MenuVersion
{
    /// <summary>
    /// Minimum distance between two menu versions. Firestore stores timestamps
    /// with microsecond precision, so a one-tick increment could round back to
    /// the previous value.
    /// </summary>
    private static readonly long MinimumStepTicks = TimeSpan.TicksPerMicrosecond;

    /// <summary>
    /// Returns a timestamp strictly greater than <paramref name="previous"/>,
    /// even when the clock has not advanced (or has moved backwards) since the
    /// last write.
    /// </summary>
    /// <remarks>
    /// The result is truncated to the precision Firestore persists (microseconds,
    /// towards the start of time). Returning a higher-precision value would make
    /// the client send back a version that is not the stored one, so the next
    /// conditional write would fail even though nothing changed.
    /// </remarks>
    public static DateTimeOffset Next(DateTimeOffset now, DateTimeOffset? previous)
    {
        var candidate = ToStoredPrecision(now);

        if (previous is null)
        {
            return candidate;
        }

        var minimum = ToStoredPrecision(previous.Value).AddTicks(MinimumStepTicks);
        return candidate > minimum ? candidate : minimum;
    }

    /// <summary>
    /// Truncates a timestamp to the microsecond precision Firestore uses when it
    /// persists a <see cref="DateTimeOffset"/>.
    /// </summary>
    private static DateTimeOffset ToStoredPrecision(DateTimeOffset value)
    {
        var utc = value.ToUniversalTime();
        var remainder = utc.Ticks % TimeSpan.TicksPerMicrosecond;
        if (remainder < 0)
        {
            // Floor towards the start of time, matching Firestore's truncation.
            remainder += TimeSpan.TicksPerMicrosecond;
        }

        return new DateTimeOffset(utc.Ticks - remainder, TimeSpan.Zero);
    }
}
