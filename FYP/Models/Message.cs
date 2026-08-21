namespace SmartFashion.Api.Models;

public class Message
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? StoryImageUrl { get; set; }
    public string? MediaUrl { get; set; }
    public int? PostId { get; set; }
    public string? PostImageUrl { get; set; }
    public string? PostAuthorName { get; set; }
    public string? PostAuthorAvatarUrl { get; set; }
    public string? PostCaption { get; set; }
    public bool IsRead { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Sender { get; set; }
    public User? Receiver { get; set; }
}
