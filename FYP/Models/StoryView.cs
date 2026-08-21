namespace SmartFashion.Api.Models;

public class StoryView
{
    public int Id { get; set; }
    public int StoryId { get; set; }
    public int ViewerId { get; set; }
    public DateTime ViewedAt { get; set; } = DateTime.UtcNow;

    public Story? Story { get; set; }
    public User? Viewer { get; set; }
}
