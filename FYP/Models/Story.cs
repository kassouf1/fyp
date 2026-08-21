namespace SmartFashion.Api.Models;

public class Story
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddHours(24);

    public string? Caption { get; set; }
    public int? PostId { get; set; }
    public string? PostAuthorName { get; set; }
    public string? PostAuthorAvatarUrl { get; set; }
    public string? PostCaption { get; set; }

    public User? User { get; set; }
    public ICollection<StoryView> Views { get; set; } = new List<StoryView>();
    public ICollection<StoryLike> Likes { get; set; } = new List<StoryLike>();
}
