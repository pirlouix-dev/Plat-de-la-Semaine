namespace PlatDeLaSemaineBack.Models;

/// <summary>
/// Outcome of an idempotent dish insertion: whether a new document was created,
/// and the document as it exists afterwards (which may be an earlier one).
/// </summary>
public sealed record DishInsertResult(bool Created, Dish Dish);
