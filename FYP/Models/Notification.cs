namespace SmartFashion.Api.Models;

public class Notification
{
    public int Id { get; set; }
    public int UserId { get; set; }        // recipient
    public int ActorId { get; set; }       // who triggered it
    public string Type { get; set; } = string.Empty; // "like" | "comment" | "follow"
    public int? PostId { get; set; }
    public string? CommentText { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
    public User? Actor { get; set; }
    public Post? Post { get; set; }
}
