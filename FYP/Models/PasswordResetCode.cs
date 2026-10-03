namespace SmartFashion.Api.Models;

public class PasswordResetCode
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Code { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; } = false;
    public User? User { get; set; }
}
