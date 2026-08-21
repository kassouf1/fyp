namespace SmartFashion.Api.Models;

public class StoryLike
{
    public int Id { get; set; }
    public int StoryId { get; set; }
    public int UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Story? Story { get; set; }
    public User? User { get; set; }
}
