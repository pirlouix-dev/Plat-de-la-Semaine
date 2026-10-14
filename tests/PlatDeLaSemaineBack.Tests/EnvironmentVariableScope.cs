namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// Sets process environment variables for the lifetime of a test and restores
/// their previous values on dispose.
/// </summary>
public sealed class EnvironmentVariableScope : IDisposable
{
    private readonly Dictionary<string, string?> _previousValues = [];

    public EnvironmentVariableScope(params (string Name, string? Value)[] variables)
    {
        foreach (var (name, value) in variables)
        {
            _previousValues[name] = Environment.GetEnvironmentVariable(name);
            Environment.SetEnvironmentVariable(name, value);
        }
    }

    public void Dispose()
    {
        foreach (var (name, value) in _previousValues)
        {
            Environment.SetEnvironmentVariable(name, value);
        }
    }
}
