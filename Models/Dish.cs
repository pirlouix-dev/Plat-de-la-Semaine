using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;

namespace PlatDeLaSemaineBack.Models;

[Table("Dishes")]
public class Dish : BaseModel
{
    [PrimaryKey("id")]
    public Guid? Id { get; set; }
    
    [Column("version")]
    public int Version { get; set; } = 0;
    
    [Column("user_id")]
    public Guid UserId { get; set; }
    
    [Column("name")]
    public string Name { get; set; } = string.Empty;
    
    [Column("description")]
    public string Description { get; set; } = string.Empty;
    
    [Column("course")]
    public long Course { get; set; }
    
    [Column("seasons")]
    public int[] Seasons { get; set; } = Array.Empty<int>();
    
    [Column("updated_at")]
    public DateTimeOffset UpdatedAt { get; set; }
    
    [Column("is_deleted")]
    public bool IsDeleted { get; set; }
}
