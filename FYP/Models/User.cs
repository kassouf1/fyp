namespace SmartFashion.Api.Models;

public class User
{
    public int Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Username { get; set; } = string.Empty;

    public string? Bio { get; set; }

    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsEmailVerified { get; set; } = false;

    public string? AvatarUrl { get; set; }

    // null for password users; "google" or "apple" for social users
    public string? Provider { get; set; }
}