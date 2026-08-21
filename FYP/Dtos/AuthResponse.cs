namespace SmartFashion.Api.Dtos;

public class AuthResponse
{
    public int UserId { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Username { get; set; } = string.Empty;

    public string? Bio { get; set; }

    public string? AvatarUrl { get; set; }

    public string Email { get; set; } = string.Empty;

    public string Token { get; set; } = string.Empty;

    public bool IsEmailVerified { get; set; }

    public bool NeedsNameSetup { get; set; }

    // True only immediately after SocialAuth creates a brand-new account —
    // lets the client gate entry into the app behind a "complete your
    // profile" screen before the user ever sees the main app.
    public bool IsNewAccount { get; set; }
}
