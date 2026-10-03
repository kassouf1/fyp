namespace SmartFashion.Api.Models;

// A brand (e.g. Zara) that has connected its own product API so its catalog
// shows up in our Brand Shop. Status is set automatically by the sync in
// BrandPartnersController — "Pending" only exists for the instant between
// the row being created and the first sync attempt completing.
public class BrandPartner
{
    public int Id { get; set; }
    public string BrandName { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;

    // The partner's own product-catalog endpoint — we GET this to pull
    // their products in.
    public string ApiBaseUrl { get; set; } = string.Empty;
    public string? ApiKey { get; set; }
    public string? Category { get; set; }

    // Pending | Active | Failed
    public string Status { get; set; } = "Pending";
    public string? LastError { get; set; }
    public int ProductCount { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastSyncedAt { get; set; }

    public List<BrandCatalogItem> CatalogItems { get; set; } = new();
}
