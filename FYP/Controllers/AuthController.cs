using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Dtos;
using SmartFashion.Api.Models;
using SmartFashion.Api.Services;
using System.Security.Claims;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly JwtTokenService _jwtTokenService;
    private readonly IEmailService _emailService;

    public AuthController(
        AppDbContext context,
        JwtTokenService jwtTokenService,
        IEmailService emailService)
    {
        _context = context;
        _jwtTokenService = jwtTokenService;
        _emailService = emailService;
    }

    // ── Register ─────────────────────────────────────────────────────────────
    [HttpPost("register")]
    public async Task<ActionResult<RegisterResponse>> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName) ||
            string.IsNullOrWhiteSpace(request.Username) ||
            string.IsNullOrWhiteSpace(request.Email)    ||
            string.IsNullOrWhiteSpace(request.Password))
            return BadRequest("All fields are required.");

        var username = request.Username.Trim().ToLower();
        if (username.Length < 3 || username.Length > 30)
            return BadRequest("Username must be 3–30 characters.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, @"^[a-z0-9_.]+$"))
            return BadRequest("Username may only contain letters, numbers, underscores, and dots.");

        var email = request.Email.Trim().ToLower();

        if (await _context.Users.AnyAsync(u => u.Email == email))
            return BadRequest("An account with this email already exists.");
        if (await _context.Users.AnyAsync(u => u.Username == username))
            return BadRequest("That username is already taken.");

        var user = new User
        {
            FullName         = request.FullName.Trim(),
            Username         = username,
            Email            = email,
            PasswordHash     = BCrypt.Net.BCrypt.HashPassword(request.Password),
            IsEmailVerified  = false,
            Provider         = null,
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        await IssueVerificationCodeAsync(user);

        // Issue token immediately so the user can skip verification and use the app right away.
        // isEmailVerified = false in the response; the client can prompt verification later.
        return Ok(BuildAuthResponse(user));
    }

    // ── Login ─────────────────────────────────────────────────────────────────
    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest request)
    {
        var identifier = request.Identifier.Trim().ToLower();
        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.Email == identifier || u.Username == identifier);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
            return Unauthorized("Invalid email/username or password.");

        if (!user.IsEmailVerified)
        {
            // Send a fresh code so the user can verify if they want to, but still issue a token.
            await IssueVerificationCodeAsync(user);
        }

        return Ok(BuildAuthResponse(user));
    }

    // ── Verify Email ──────────────────────────────────────────────────────────
    [HttpPost("verify-email")]
    public async Task<ActionResult<AuthResponse>> VerifyEmail(VerifyEmailRequest request)
    {
        var record = await _context.EmailVerificationCodes
            .Where(c =>
                c.UserId  == request.UserId    &&
                c.Code    == request.Code      &&
                !c.IsUsed                      &&
                c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.ExpiresAt)
            .FirstOrDefaultAsync();

        if (record == null)
            return BadRequest("Invalid or expired verification code.");

        record.IsUsed = true;

        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null) return NotFound("User not found.");

        user.IsEmailVerified = true;
        await _context.SaveChangesAsync();

        return Ok(BuildAuthResponse(user));
    }

    // ── Resend Code ───────────────────────────────────────────────────────────
    [HttpPost("resend-code")]
    public async Task<IActionResult> ResendCode([FromBody] ResendCodeRequest request)
    {
        var user = await _context.Users.FindAsync(request.UserId);
        if (user == null) return NotFound("User not found.");

        if (user.IsEmailVerified)
            return BadRequest("Email is already verified.");

        await IssueVerificationCodeAsync(user);
        return Ok(new { message = "A new verification code has been sent." });
    }

    // ── Forgot Password ───────────────────────────────────────────────────────
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var email = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);

        // Always respond the same way regardless of whether the account
        // exists, so this endpoint can't be used to enumerate registered
        // emails — only actually issue/send a code if it does.
        if (user != null)
        {
            var old = await _context.PasswordResetCodes
                .Where(c => c.UserId == user.Id && !c.IsUsed)
                .ToListAsync();
            old.ForEach(c => c.IsUsed = true);

            var code = new Random().Next(100_000, 999_999).ToString();

            _context.PasswordResetCodes.Add(new PasswordResetCode
            {
                UserId    = user.Id,
                Code      = code,
                ExpiresAt = DateTime.UtcNow.AddMinutes(15),
                IsUsed    = false,
            });

            await _context.SaveChangesAsync();
            await _emailService.SendPasswordResetCodeAsync(user.Email, user.FullName, code);
        }

        return Ok(new { message = "If an account exists for that email, a reset code has been sent." });
    }

    // ── Reset Password ────────────────────────────────────────────────────────
    [HttpPost("reset-password")]
    public async Task<ActionResult<AuthResponse>> ResetPassword(ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NewPassword) || request.NewPassword.Length < 6)
            return BadRequest("New password must be at least 6 characters.");

        var email = request.Email.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        if (user == null)
            return BadRequest("Invalid or expired reset code.");

        var record = await _context.PasswordResetCodes
            .Where(c =>
                c.UserId  == user.Id        &&
                c.Code    == request.Code   &&
                !c.IsUsed                   &&
                c.ExpiresAt > DateTime.UtcNow)
            .OrderByDescending(c => c.ExpiresAt)
            .FirstOrDefaultAsync();

        if (record == null)
            return BadRequest("Invalid or expired reset code.");

        record.IsUsed = true;
        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(BuildAuthResponse(user));
    }

    // ── Social Auth (Google / Apple) ──────────────────────────────────────────
    [HttpPost("social")]
    public async Task<ActionResult<AuthResponse>> SocialAuth(SocialAuthRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Email))
            return BadRequest("Email is required for social login.");

        var email = request.Email.Trim().ToLower();
        var user  = await _context.Users.FirstOrDefaultAsync(u => u.Email == email);
        var isNewAccount = user == null;

        if (user == null)
        {
            // First-time social login — create account (email verified by provider)
            var baseName = email.Split('@')[0]
                .ToLower()
                .Replace('.', '_')
                .Replace('-', '_');
            baseName = System.Text.RegularExpressions.Regex.Replace(baseName, @"[^a-z0-9_]", "");
            if (baseName.Length < 3) baseName = "user_" + baseName;

            // Ensure username is unique
            var candidate = baseName;
            var suffix    = 1;
            while (await _context.Users.AnyAsync(u => u.Username == candidate))
                candidate = baseName + suffix++;

            user = new User
            {
                FullName        = string.IsNullOrWhiteSpace(request.FullName)
                                    ? email.Split('@')[0]
                                    : request.FullName.Trim(),
                Username        = candidate,
                Email           = email,
                PasswordHash    = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
                IsEmailVerified = true,
                Provider        = request.Provider.ToLower(),
            };
            _context.Users.Add(user);
            await _context.SaveChangesAsync();
        }
        else
        {
            var changed = false;

            if (!user.IsEmailVerified)
            {
                // Existing unverified account — mark verified via social
                user.IsEmailVerified = true;
                user.Provider        = request.Provider.ToLower();
                changed = true;
            }

            // The provider only sends the real name on the user's first-ever
            // authorization — if we previously fell back to an email-derived
            // name, adopt the real one as soon as the provider supplies it.
            if (!string.IsNullOrWhiteSpace(request.FullName)
                && !string.Equals(user.FullName, request.FullName.Trim(), StringComparison.Ordinal)
                && IsFallbackName(user.FullName, email))
            {
                user.FullName = request.FullName.Trim();
                changed = true;
            }

            if (changed)
                await _context.SaveChangesAsync();
        }

        var response = BuildAuthResponse(user);
        response.IsNewAccount = isNewAccount;
        return Ok(response);
    }

    // ── Update Profile ────────────────────────────────────────────────────────
    [Authorize]
    [HttpPut("profile")]
    public async Task<ActionResult<AuthResponse>> UpdateProfile(UpdateProfileRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
            return BadRequest("Full name is required.");

        if (string.IsNullOrWhiteSpace(request.Username))
            return BadRequest("Username is required.");

        var username = request.Username.Trim().ToLower();
        if (username.Length < 3 || username.Length > 30)
            return BadRequest("Username must be 3–30 characters.");
        if (!System.Text.RegularExpressions.Regex.IsMatch(username, @"^[a-z0-9_.]+$"))
            return BadRequest("Username may only contain letters, numbers, underscores, and dots.");

        var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

        if (await _context.Users.AnyAsync(u => u.Username == username && u.Id != callerId))
            return BadRequest("That username is already taken.");

        var user = await _context.Users.FindAsync(callerId);
        if (user == null) return NotFound("User not found.");

        user.FullName  = request.FullName.Trim();
        user.Username  = username;
        user.Bio       = request.Bio?.Trim();
        if (request.AvatarUrl != null)
            user.AvatarUrl = request.AvatarUrl;

        await _context.SaveChangesAsync();

        return Ok(BuildAuthResponse(user));
    }

    // ── Change Password ───────────────────────────────────────────────────────
    [Authorize]
    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) ||
            string.IsNullOrWhiteSpace(request.NewPassword))
            return BadRequest("Both current and new passwords are required.");

        if (request.NewPassword.Length < 6)
            return BadRequest("New password must be at least 6 characters.");

        var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _context.Users.FindAsync(callerId);
        if (user == null) return NotFound("User not found.");

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
            return BadRequest("Current password is incorrect.");

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    private AuthResponse BuildAuthResponse(User user) => new()
    {
        UserId          = user.Id,
        FullName        = user.FullName,
        Username        = user.Username,
        Bio             = user.Bio,
        AvatarUrl       = user.AvatarUrl,
        Email           = user.Email,
        Token           = _jwtTokenService.CreateToken(user),
        IsEmailVerified = user.IsEmailVerified,
        NeedsNameSetup  = IsFallbackName(user.FullName, user.Email),
    };

    // True when a name still equals the auto-generated email-prefix placeholder
    // used when a social provider (typically Apple, on a repeat authorization)
    // didn't supply the user's real name.
    private static bool IsFallbackName(string fullName, string email) =>
        string.Equals(fullName, email.Split('@')[0], StringComparison.OrdinalIgnoreCase);

    private async Task IssueVerificationCodeAsync(User user)
    {
        // Invalidate any existing unused codes for this user
        var old = await _context.EmailVerificationCodes
            .Where(c => c.UserId == user.Id && !c.IsUsed)
            .ToListAsync();
        old.ForEach(c => c.IsUsed = true);

        var code = new Random().Next(100_000, 999_999).ToString();

        _context.EmailVerificationCodes.Add(new EmailVerificationCode
        {
            UserId    = user.Id,
            Code      = code,
            ExpiresAt = DateTime.UtcNow.AddMinutes(15),
            IsUsed    = false,
        });

        await _context.SaveChangesAsync();

        await _emailService.SendVerificationCodeAsync(user.Email, user.FullName, code);
    }
}
