namespace SmartFashion.Api.Models;

public class TryOnHistory
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public string Prompt { get; set; } = string.Empty;

    public string SelectedOutfitTitle { get; set; } = string.Empty;

    public string SelectedOutfitColor { get; set; } = string.Empty;

    public string SelectedOutfitCategory { get; set; } = string.Empty;

    public string PersonImageUrl { get; set; } = string.Empty;

    public string ResultImageUrl { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}