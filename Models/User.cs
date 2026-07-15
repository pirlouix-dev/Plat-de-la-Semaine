using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace PlatDeLaSemaineBack.Models;

[Table("Users")]
public class User : BaseModel
{
    [PrimaryKey("id")]
    public Guid? Id { get; set; }

    [Column("created_at")]
    public DateTimeOffset CreatedAt { get; set; }
}
