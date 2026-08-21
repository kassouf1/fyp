namespace SmartFashion.Api.Dtos;

public class LoginRequest
{
    // Accepts either email address or username
    public string Identifier { get; set; } = string.Empty;

    public string Password { get; set; } = string.Empty;
}
