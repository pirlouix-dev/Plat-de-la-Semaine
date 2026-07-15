using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling dish-specific business logic.
/// </summary>
public class DishService : IDishService
{
    private readonly ISupabaseService _supabase;

    public DishService(ISupabaseService supabase)
    {
        _supabase = supabase;
    }

    /// <inheritdoc />
    public async Task<Dish?> InsertSeedDishAsync()
    {
        if (!_supabase.IsConnected) return null;

        var dish = new Dish
        {
            Id = Guid.NewGuid(),
            Version = 0,
            UserId = Guid.Parse("249b35c6-83af-491e-bc1f-15e128b38630"),
            Name = "Spaghetti Carbonara",
            Description = "A classic Italian pasta dish made with eggs, cheese, pancetta, and pepper.",
            Course = 1,
            Seasons = [1, 2],
            UpdatedAt = DateTimeOffset.UtcNow,
            IsDeleted = false
        };

        return await _supabase.InsertDishAsync(dish);
    }
}
