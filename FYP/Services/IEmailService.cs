namespace SmartFashion.Api.Services;

public interface IEmailService
{
    Task SendVerificationCodeAsync(string toEmail, string fullName, string code);
    Task SendPasswordResetCodeAsync(string toEmail, string fullName, string code);
}
