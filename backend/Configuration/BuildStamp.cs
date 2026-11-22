using System.Reflection;

namespace PlatDeLaSemaineBack.Configuration;

/// <summary>
/// Identifies the build that is actually running, so a deployment can be
/// verified with one request instead of by probing for a behavioural marker.
/// </summary>
public static class BuildStamp
{
    /// <summary>
    /// Commit SHA that the running assembly was built from, or <c>"unknown"</c>
    /// when the build did not carry one.
    /// </summary>
    public static string Commit { get; } = ResolveCommit(
        Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
            .InformationalVersion);

    /// <summary>
    /// Extracts the revision from an informational version such as
    /// <c>1.0.0+ca009f1…</c>. The deployment workflow stamps the deployed
    /// commit with <c>SourceRevisionId</c>; local builds take it from the git
    /// checkout.
    /// </summary>
    public static string ResolveCommit(string? informationalVersion)
    {
        const string unknown = "unknown";
        if (string.IsNullOrWhiteSpace(informationalVersion))
        {
            return unknown;
        }

        var separator = informationalVersion.IndexOf('+');
        if (separator < 0 || separator == informationalVersion.Length - 1)
        {
            return unknown;
        }

        var revision = informationalVersion[(separator + 1)..].Trim();
        return revision.Length == 0 ? unknown : revision;
    }
}
