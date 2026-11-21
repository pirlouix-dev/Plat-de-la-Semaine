using Xunit;

namespace PlatDeLaSemaineBack.Tests;

/// <summary>
/// Groups tests that mutate process-wide environment variables. Environment
/// variables are shared by the whole process, so these tests must not run in
/// parallel with each other or with tests that boot the application.
/// </summary>
[CollectionDefinition(Name, DisableParallelization = true)]
public class EnvironmentVariableCollection
{
    public const string Name = "EnvironmentVariables";
}
