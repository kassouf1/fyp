using System.Net;
using System.Net.Mail;

namespace SmartFashion.Api.Services;

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration config, ILogger<SmtpEmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public Task SendVerificationCodeAsync(string toEmail, string fullName, string code) =>
        SendCodeEmailAsync(
            toEmail, fullName, code,
            subject: "Your SmartFashion Verification Code",
            headline: "Verify your email address",
            bodyText: "Use the code below to complete your SmartFashion registration.");

    public Task SendPasswordResetCodeAsync(string toEmail, string fullName, string code) =>
        SendCodeEmailAsync(
            toEmail, fullName, code,
            subject: "Your SmartFashion Password Reset Code",
            headline: "Reset your password",
            bodyText: "Use the code below to choose a new password for your SmartFashion account. " +
                      "If you didn't request this, you can safely ignore this email — your password won't change.");

    private async Task SendCodeEmailAsync(
        string toEmail, string fullName, string code, string subject, string headline, string bodyText)
    {
        var host     = _config["Email:SmtpHost"]     ?? throw new InvalidOperationException("Email:SmtpHost not configured.");
        var port     = int.Parse(_config["Email:SmtpPort"] ?? "587");
        var username = _config["Email:Username"]     ?? throw new InvalidOperationException("Email:Username not configured.");
        var password = _config["Email:Password"]     ?? throw new InvalidOperationException("Email:Password not configured.");
        var from     = _config["Email:FromAddress"]  ?? username;
        var fromName = _config["Email:FromName"]     ?? "SmartFashion";

        using var smtp = new SmtpClient(host, port)
        {
            EnableSsl   = true,
            Credentials = new NetworkCredential(username, password),
        };

        var msg = new MailMessage
        {
            From       = new MailAddress(from, fromName),
            Subject    = subject,
            Body       = BuildHtml(fullName, code, headline, bodyText),
            IsBodyHtml = true,
        };
        msg.To.Add(toEmail);

        try
        {
            await smtp.SendMailAsync(msg);
            _logger.LogInformation("Code email ({Subject}) sent to {Email}", subject, toEmail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send code email ({Subject}) to {Email}", subject, toEmail);
            throw;
        }
    }

    private static string BuildHtml(string name, string code, string headline, string bodyText) => $"""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8"/>
          <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
          <title>SmartFashion</title>
        </head>
        <body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial,Helvetica,sans-serif;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" style="padding:48px 16px;">
                <table width="480" cellpadding="0" cellspacing="0"
                       style="background:#13131A;border-radius:20px;border:1px solid #2A2A3A;overflow:hidden;">

                  <!-- Header -->
                  <tr>
                    <td style="background:linear-gradient(135deg,#1C1810,#13131A);padding:40px;text-align:center;
                               border-bottom:1px solid #2A2A3A;">
                      <div style="font-size:36px;margin-bottom:8px;">✦</div>
                      <div style="font-size:26px;font-weight:800;color:#C9A96E;letter-spacing:1px;">SmartFashion</div>
                      <div style="font-size:13px;color:#6A6A80;margin-top:4px;letter-spacing:0.5px;">
                        AI-Powered Style Companion
                      </div>
                    </td>
                  </tr>

                  <!-- Body -->
                  <tr>
                    <td style="padding:40px;">
                      <h2 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 12px;">
                        {headline}
                      </h2>
                      <p style="color:#A0A0B8;font-size:15px;line-height:1.6;margin:0 0 28px;">
                        Hi <strong style="color:#FFFFFF;">{name}</strong>,<br/>
                        {bodyText}
                        The code expires in <strong style="color:#C9A96E;">15 minutes</strong>.
                      </p>

                      <!-- Code box -->
                      <div style="background:#1C1810;border:1px solid #C9A96E40;border-radius:14px;
                                  padding:28px;text-align:center;margin-bottom:28px;">
                        <div style="font-size:10px;font-weight:700;color:#C9A96E;letter-spacing:2px;
                                    text-transform:uppercase;margin-bottom:16px;">
                          Your Code
                        </div>
                        <div style="font-size:44px;font-weight:800;color:#C9A96E;letter-spacing:16px;
                                    font-family:'Courier New',monospace;">
                          {code}
                        </div>
                      </div>
                    </td>
                  </tr>

                  <!-- Footer -->
                  <tr>
                    <td style="padding:20px 40px;border-top:1px solid #2A2A3A;text-align:center;">
                      <p style="color:#6A6A80;font-size:11px;margin:0;letter-spacing:0.4px;">
                        SmartFashion &nbsp;·&nbsp; Final Year Project &nbsp;·&nbsp; 2025–2026
                      </p>
                    </td>
                  </tr>

                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
        """;
}
