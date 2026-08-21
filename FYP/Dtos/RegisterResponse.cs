namespace SmartFashion.Api.Dtos;

public class RegisterResponse
{
    public int UserId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Message { get; set; } = "Verification code sent to your email.";
}
