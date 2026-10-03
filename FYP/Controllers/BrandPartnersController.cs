using System.Globalization;
using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FYP.Dtos;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace FYP.Controllers;

// Lets a brand (e.g. Zara) self-connect its own product API so its catalog
// appears in our Brand Shop — the same "paste your API key, we pull your
// catalog" flow integration platforms like Shopify use, scoped down for
// this project: no partner dashboard/auth, just apply -> sync -> live.
[ApiController]
[Route("api/[controller]")]
public class BrandPartnersController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly AppDbContext _context;

    public BrandPartnersController(IHttpClientFactory httpClientFactory, AppDbContext context)
    {
        _httpClientFactory = httpClientFactory;
        _context = context;
    }

    [HttpPost("apply")]
    public async Task<IActionResult> Apply([FromBody] BrandPartnerApplicationRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.BrandName) ||
            string.IsNullOrWhiteSpace(request.ContactEmail) ||
            string.IsNullOrWhiteSpace(request.ApiBaseUrl))
        {
            return BadRequest("brandName, contactEmail and apiBaseUrl are required.");
        }

        if (!Uri.TryCreate(request.ApiBaseUrl, UriKind.Absolute, out _))
        {
            return BadRequest("apiBaseUrl must be a valid absolute URL.");
        }

        var partner = new BrandPartner
        {
            BrandName = request.BrandName.Trim(),
            ContactEmail = request.ContactEmail.Trim(),
            ApiBaseUrl = request.ApiBaseUrl.Trim(),
            ApiKey = string.IsNullOrWhiteSpace(request.ApiKey) ? null : request.ApiKey.Trim(),
            Category = string.IsNullOrWhiteSpace(request.Category) ? null : request.Category.Trim(),
            Status = "Pending",
        };

        _context.BrandPartners.Add(partner);
        await _context.SaveChangesAsync();

        // Self-service — attempt the connection immediately so the brand
        // sees their products live in Brand Shop without a manual review
        // step in between.
        await SyncPartnerAsync(partner);

        return Ok(ToDto(partner));
    }

    [HttpPost("{id}/resync")]
    public async Task<IActionResult> Resync(int id)
    {
        var partner = await _context.BrandPartners.FindAsync(id);
        if (partner == null) return NotFound();

        await SyncPartnerAsync(partner);
        return Ok(ToDto(partner));
    }

    [HttpGet]
    public async Task<IActionResult> List()
    {
        var partners = await _context.BrandPartners
            .OrderByDescending(p => p.CreatedAt)
            .ToListAsync();

        return Ok(partners.Select(ToDto));
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var partner = await _context.BrandPartners
            .Include(p => p.CatalogItems)
            .FirstOrDefaultAsync(p => p.Id == id);

        if (partner == null) return NotFound();

        _context.BrandCatalogItems.RemoveRange(partner.CatalogItems);
        _context.BrandPartners.Remove(partner);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    // Flattened to the same shape the app already gets from the internal
    // /catalog endpoint (see outfit-recommender's mock_adapter.py), so the
    // client can merge both lists through one mapper — see FashionApp's
    // src/data/localClothes.ts.
    [HttpGet("products")]
    public async Task<IActionResult> Products()
    {
        var items = await _context.BrandCatalogItems
            .Include(i => i.BrandPartner)
            .Where(i => i.BrandPartner.Status == "Active")
            .ToListAsync();

        var result = items.Select(i => new
        {
            id = $"partner-{i.BrandPartnerId}-{i.ExternalId}",
            brand = i.BrandPartner.BrandName,
            title = i.Title,
            category = i.Category,
            color = i.Color ?? "",
            season = "all",
            style = new[] { "casual" },
            price = i.Price,
            // Partner images are already absolute URLs (hosted by the
            // brand), unlike the internal catalog's server-relative paths —
            // the client tells them apart by checking for "http".
            image_path = i.ImageUrl,
        });

        return Ok(result);
    }

    private static object ToDto(BrandPartner p) => new
    {
        p.Id,
        p.BrandName,
        p.ContactEmail,
        p.ApiBaseUrl,
        p.Category,
        p.Status,
        p.LastError,
        p.ProductCount,
        p.CreatedAt,
        p.LastSyncedAt,
    };

    private async Task SyncPartnerAsync(BrandPartner partner)
    {
        try
        {
            var client = _httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);

            using var httpRequest = new HttpRequestMessage(HttpMethod.Get, partner.ApiBaseUrl);
            if (!string.IsNullOrWhiteSpace(partner.ApiKey))
            {
                // Sent both ways since partner APIs disagree on convention —
                // harmless for whichever one a given API ignores.
                httpRequest.Headers.TryAddWithoutValidation("X-Api-Key", partner.ApiKey);
                httpRequest.Headers.TryAddWithoutValidation("Authorization", $"Bearer {partner.ApiKey}");
            }

            var response = await client.SendAsync(httpRequest);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                partner.Status = "Failed";
                partner.LastError = $"Partner API returned HTTP {(int)response.StatusCode}.";
                await _context.SaveChangesAsync();
                return;
            }

            using var document = JsonDocument.Parse(body);
            var items = ParseProducts(document.RootElement);

            if (items.Count == 0)
            {
                partner.Status = "Failed";
                partner.LastError = "Connected, but no recognizable products were found in the response. " +
                    "Expected a JSON array (or a { products: [...] } / { items: [...] } / { data: [...] } wrapper) " +
                    "of objects with at least a title/name and an imageUrl/image_url.";
                await _context.SaveChangesAsync();
                return;
            }

            var existing = _context.BrandCatalogItems.Where(i => i.BrandPartnerId == partner.Id);
            _context.BrandCatalogItems.RemoveRange(existing);

            foreach (var item in items)
            {
                item.BrandPartnerId = partner.Id;
                _context.BrandCatalogItems.Add(item);
            }

            partner.Status = "Active";
            partner.ProductCount = items.Count;
            partner.LastSyncedAt = DateTime.UtcNow;
            partner.LastError = null;

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            partner.Status = "Failed";
            partner.LastError = $"Couldn't reach that API: {ex.Message}";
            await _context.SaveChangesAsync();
        }
    }

    // Partner APIs won't agree on field names or on whether the array is
    // top-level or wrapped — this is a best-effort, not a strict schema, so
    // brands can connect without us hand-writing an adapter per brand.
    private static List<BrandCatalogItem> ParseProducts(JsonElement root)
    {
        var array = root;

        if (root.ValueKind == JsonValueKind.Object)
        {
            foreach (var key in new[] { "products", "items", "data", "results", "catalog" })
            {
                if (root.TryGetProperty(key, out var prop) && prop.ValueKind == JsonValueKind.Array)
                {
                    array = prop;
                    break;
                }
            }
        }

        if (array.ValueKind != JsonValueKind.Array) return new List<BrandCatalogItem>();

        var results = new List<BrandCatalogItem>();

        foreach (var element in array.EnumerateArray())
        {
            if (element.ValueKind != JsonValueKind.Object) continue;

            var title = GetString(element, "title", "name", "productName", "product_name");
            var imageUrl = GetString(element, "imageUrl", "image_url", "image", "thumbnail", "imageURL");

            // Can't show a product with no name or no picture — skip rather
            // than let it render as a blank card.
            if (string.IsNullOrWhiteSpace(title) || string.IsNullOrWhiteSpace(imageUrl)) continue;

            var rawCategory = GetString(element, "category", "type");

            // Shoes aren't try-on-able (CatVTON only masks upper/lower body
            // regions) and the app no longer has a shoes section at all —
            // skip them rather than mislabeling them as a top.
            if (IsShoe(rawCategory) || IsShoe(title)) continue;

            results.Add(new BrandCatalogItem
            {
                ExternalId = GetString(element, "id", "sku", "productId", "product_id") ?? Guid.NewGuid().ToString("N"),
                Title = title!,
                ImageUrl = imageUrl!,
                Price = GetPrice(element, "price", "amount", "cost"),
                Category = NormalizeCategory(rawCategory),
                Gender = GetString(element, "gender", "audience"),
                Color = GetString(element, "color", "colour"),
            });

            // Enough for a Brand Shop demo without paginating a partner's
            // entire catalog on every sync.
            if (results.Count >= 200) break;
        }

        return results;
    }

    private static string? GetString(JsonElement element, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (element.TryGetProperty(key, out var value))
            {
                if (value.ValueKind == JsonValueKind.String) return value.GetString();
                if (value.ValueKind == JsonValueKind.Number) return value.ToString();
            }
        }
        return null;
    }

    private static double GetPrice(JsonElement element, params string[] keys)
    {
        foreach (var key in keys)
        {
            if (!element.TryGetProperty(key, out var value)) continue;

            if (value.ValueKind == JsonValueKind.Number && value.TryGetDouble(out var num)) return num;
            if (value.ValueKind == JsonValueKind.String &&
                double.TryParse(value.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var parsed))
            {
                return parsed;
            }
        }
        return 0;
    }

    private static string NormalizeCategory(string? raw)
    {
        var lowered = raw?.ToLowerInvariant() ?? "";

        if (lowered.Contains("bottom") || lowered.Contains("pant") || lowered.Contains("trouser") ||
            lowered.Contains("jean") || lowered.Contains("short") || lowered.Contains("skirt"))
        {
            return "bottom";
        }

        return "top";
    }

    // The app has no shoes section (CatVTON can't try shoes on) — checked
    // against both the partner's category/type field and the title, since
    // many partner APIs won't bother tagging category at all.
    private static bool IsShoe(string? text)
    {
        var lowered = text?.ToLowerInvariant() ?? "";
        return lowered.Contains("shoe") || lowered.Contains("sneaker") || lowered.Contains("trainer") ||
            lowered.Contains("boot") || lowered.Contains("sandal") || lowered.Contains("heel") ||
            lowered.Contains("footwear") || lowered.Contains("flip flop") || lowered.Contains("slipper");
    }
}
