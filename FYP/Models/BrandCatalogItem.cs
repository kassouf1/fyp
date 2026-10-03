namespace SmartFashion.Api.Models;

// One product pulled from a BrandPartner's API. Re-synced wholesale each
// time (see BrandPartnersController.SyncPartnerAsync) rather than diffed,
// since partner catalogs are small enough for this demo's scale.
public class BrandCatalogItem
{
    public int Id { get; set; }
    public int BrandPartnerId { get; set; }
    public BrandPartner BrandPartner { get; set; } = null!;

    public string ExternalId { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public double Price { get; set; }
    public string ImageUrl { get; set; } = string.Empty;

    // top | bottom — normalized from whatever the partner's API calls it
    // (see BrandPartnersController.NormalizeCategory). Shoes are filtered
    // out entirely during ingestion since the app has no shoes section.
    public string Category { get; set; } = "top";
    public string? Gender { get; set; }
    public string? Color { get; set; }
}
