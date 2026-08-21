namespace SmartFashion.Api.Dtos;

public class VerifyEmailRequest
{
    public int UserId { get; set; }
    public string Code { get; set; } = string.Empty;
}
