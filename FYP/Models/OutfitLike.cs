namespace SmartFashion.Api.Models;

public class OutfitLike
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int TryOnHistoryId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
    public TryOnHistory? TryOnHistory { get; set; }
}
