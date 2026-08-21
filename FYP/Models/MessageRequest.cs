namespace SmartFashion.Api.Models;

public class MessageRequest
{
    public int Id { get; set; }
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public string MessageText { get; set; } = string.Empty;
    public string? MediaUrl { get; set; }
    public string Status { get; set; } = "pending"; // pending | accepted | rejected
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User Sender { get; set; } = null!;
    public User Receiver { get; set; } = null!;
}
