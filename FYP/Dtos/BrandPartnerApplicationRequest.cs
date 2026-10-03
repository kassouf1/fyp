namespace FYP.Dtos;

public class BrandPartnerApplicationRequest
{
    public string BrandName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ApiBaseUrl { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
    public string? Category { get; set; }
}
