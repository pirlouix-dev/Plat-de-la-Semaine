using NSubstitute;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class DishServiceTests
{
    [Fact]
    public void Constructor_WithValidFirestoreService_CreatesInstance()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();

        // Act
        var service = new DishService(firestore);

        // Assert
        Assert.NotNull(service);
    }

    [Fact]
    public void Constructor_CreatesDishService_ThatImplementsIDishService()
    {
        // Arrange
        var firestore = Substitute.For<IFirestoreService>();

        // Act
        IDishService service = new DishService(firestore);

        // Assert
        Assert.NotNull(service);
        Assert.IsAssignableFrom<IDishService>(service);
    }
}
