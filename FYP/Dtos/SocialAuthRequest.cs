namespace SmartFashion.Api.Dtos;

/// <summary>
/// Sent by the mobile app after a successful Google or Apple sign-in.
/// The client has already retrieved the user's email and full name
/// from the provider, so backend verification is not required.
/// </summary>
public class SocialAuthRequest
{
    /// <summary>"google" or "apple"</summary>
    public string Provider { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    /// <summary>Provider-specific user ID (for future deduplication).</summary>
    public string ProviderId { get; set; } = string.Empty;
}
