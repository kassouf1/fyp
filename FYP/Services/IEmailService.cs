namespace SmartFashion.Api.Services;

public interface IEmailService
{
    Task SendVerificationCodeAsync(string toEmail, string fullName, string code);
}
