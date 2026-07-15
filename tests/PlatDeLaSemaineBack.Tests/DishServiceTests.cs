using NSubstitute;
using PlatDeLaSemaineBack.Models;
using PlatDeLaSemaineBack.Services;
using Xunit;

namespace PlatDeLaSemaineBack.Tests;

public class DishServiceTests
{
    [Fact]
    public async Task InsertSeedDishAsync_SupabaseDisconnected_ReturnsNull()
    {
        // Arrange
        var supabase = Substitute.For<ISupabaseService>();
        supabase.IsConnected.Returns(false);

        var service = new DishService(supabase);

        // Act
        var result = await service.InsertSeedDishAsync();

        // Assert
        Assert.Null(result);
        await supabase.DidNotReceive().InsertDishAsync(Arg.Any<Dish>());
    }

    [Fact]
    public async Task InsertSeedDishAsync_SupabaseConnected_InsertsAndReturnsDish()
    {
        // Arrange
        var supabase = Substitute.For<ISupabaseService>();
        supabase.IsConnected.Returns(true);

        var expectedDish = new Dish
        {
            Id = Guid.NewGuid(),
            Name = "Spaghetti Carbonara",
            Course = 1,
            Seasons = [1, 2]
        };

        supabase.InsertDishAsync(Arg.Any<Dish>()).Returns(expectedDish);

        var service = new DishService(supabase);

        // Act
        var result = await service.InsertSeedDishAsync();

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedDish.Name, result!.Name);
        Assert.Equal(expectedDish.Course, result.Course);

        await supabase.Received(1).InsertDishAsync(Arg.Is<Dish>(d =>
            d.Name == "Spaghetti Carbonara" &&
            d.Course == 1 &&
            d.Seasons.SequenceEqual(new[] { 1, 2 })));
    }
}
