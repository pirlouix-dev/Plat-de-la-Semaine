using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service interface for dish-related business logic.
/// </summary>
public interface IDishService
{
    /// <summary>
    /// Inserts a sample/seed dish for testing purposes.
    /// </summary>
    Task<Dish?> InsertSeedDishAsync();
}
