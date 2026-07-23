using PlatDeLaSemaineBack.Models;

namespace PlatDeLaSemaineBack.Services;

/// <summary>
/// Service handling dish-specific business logic.
/// </summary>
public class DishService : IDishService
{
    private readonly IFirestoreService _firestore;

    public DishService(IFirestoreService firestore)
    {
        _firestore = firestore;
    }
}
