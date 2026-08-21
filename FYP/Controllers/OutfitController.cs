using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text;
using System.Text.Json;
using FYP.Dtos;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace FYP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OutfitController : ControllerBase
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IConfiguration _configuration;
    private readonly AppDbContext _context;

    public OutfitController(
        IHttpClientFactory httpClientFactory,
        IConfiguration configuration,
        AppDbContext context)
    {
        _httpClientFactory = httpClientFactory;
        _configuration = configuration;
        _context = context;
    }

    // Downloads whatever's at imageUrl (a post photo) and asks the AI
    // backend to find the closest-looking items in our own garment
    // catalog — try-on works far better against a clean product photo than
    // against another photo of a person wearing the piece.
    [HttpPost("find-similar-garment")]
    public async Task<IActionResult> FindSimilarGarment([FromBody] FindSimilarGarmentRequest request)
    {
        var baseUrl = _configuration["AiBackend:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return StatusCode(500, "AI backend URL is missing in appsettings.json.");
        }

        baseUrl = baseUrl.TrimEnd('/');

        if (string.IsNullOrWhiteSpace(request.ImageUrl))
        {
            return BadRequest("imageUrl is required.");
        }

        try
        {
            var downloader = _httpClientFactory.CreateClient();
            var imgBytes = await downloader.GetByteArrayAsync(request.ImageUrl);

            using var form = new MultipartFormDataContent();
            var imageContent = new ByteArrayContent(imgBytes);
            imageContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(imageContent, "image", "post.jpg");

            if (!string.IsNullOrWhiteSpace(request.Category))
            {
                form.Add(new StringContent(request.Category), "category");
            }

            if (!string.IsNullOrWhiteSpace(request.Gender))
            {
                form.Add(new StringContent(request.Gender), "gender");
            }

            // Extended timeout — the first search after a catalog rebuild has
            // to embed every catalog image before it can even compare, not
            // just the one query photo.
            var client = _httpClientFactory.CreateClient("AiBackend");
            var aiResponse = await client.PostAsync($"{baseUrl}/find-similar-garment", form);
            var responseBody = await aiResponse.Content.ReadAsStringAsync();

            if (!aiResponse.IsSuccessStatusCode)
            {
                return StatusCode((int)aiResponse.StatusCode, responseBody);
            }

            return Content(responseBody, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(500, $"Could not analyze that photo: {ex.Message}");
        }
    }

    [HttpPost("recommend")]
    public async Task<IActionResult> Recommend([FromBody] JsonElement request)
    {
        if (!request.TryGetProperty("prompt", out var promptProperty))
        {
            return BadRequest("prompt is required.");
        }

        var prompt = promptProperty.GetString();

        if (string.IsNullOrWhiteSpace(prompt))
        {
            return BadRequest("prompt cannot be empty.");
        }

        var aiRequest = new { prompt };

        return await ForwardToAiBackend("/recommend-outfit", aiRequest);
    }

    [HttpPost("select")]
    public IActionResult Select([FromBody] JsonElement request)
    {
        return Ok(request);
    }

    [HttpPost("generate-tryon")]
    [Consumes("multipart/form-data")]
    public async Task<IActionResult> GenerateTryOn([FromForm] GenerateTryOnRequest request)
    {
        var baseUrl = _configuration["AiBackend:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return StatusCode(500, "AI backend URL is missing in appsettings.json.");
        }

        baseUrl = baseUrl.TrimEnd('/');

        if (request.PersonImage == null || request.PersonImage.Length == 0)
        {
            return BadRequest("personImage is required.");
        }

        var client = _httpClientFactory.CreateClient("AiBackend");

        using var form = new MultipartFormDataContent();

        form.Add(new StringContent(request.Prompt ?? string.Empty), "prompt");
        form.Add(new StringContent(request.GarmentMode ?? "top"), "garment_mode");

        if (!string.IsNullOrWhiteSpace(request.TopId))
        {
            form.Add(new StringContent(request.TopId), "top_id");
        }

        if (!string.IsNullOrWhiteSpace(request.BottomId))
        {
            form.Add(new StringContent(request.BottomId), "bottom_id");
        }

        using var personStream = request.PersonImage.OpenReadStream();
        var personContent = new StreamContent(personStream);
        personContent.Headers.ContentType =
            new System.Net.Http.Headers.MediaTypeHeaderValue(request.PersonImage.ContentType);
        form.Add(personContent, "person_image", request.PersonImage.FileName);

        if (request.ClothesImage != null && request.ClothesImage.Length > 0)
        {
            // Not `using` here: disposing at the end of this if-block would
            // close the stream before HttpClient actually reads it further
            // down. `form`'s disposal (top of method) cascades to dispose
            // this StreamContent, which disposes the wrapped stream too.
            var clothesStream = request.ClothesImage.OpenReadStream();
            var clothesContent = new StreamContent(clothesStream);
            clothesContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue(request.ClothesImage.ContentType);
            form.Add(clothesContent, "clothes_image", request.ClothesImage.FileName);
        }
        else if (!string.IsNullOrWhiteSpace(request.ClothesImageUrl))
        {
            var downloader = _httpClientFactory.CreateClient();
            var imgBytes = await downloader.GetByteArrayAsync(request.ClothesImageUrl);
            var clothesContent = new ByteArrayContent(imgBytes);
            clothesContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(clothesContent, "clothes_image", "clothes.jpg");
        }

        if (request.BottomImage != null && request.BottomImage.Length > 0)
        {
            var bottomStream = request.BottomImage.OpenReadStream();
            var bottomContent = new StreamContent(bottomStream);
            bottomContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue(request.BottomImage.ContentType);
            form.Add(bottomContent, "bottom_image", request.BottomImage.FileName);
        }
        else if (!string.IsNullOrWhiteSpace(request.BottomImageUrl))
        {
            var downloader = _httpClientFactory.CreateClient();
            var imgBytes = await downloader.GetByteArrayAsync(request.BottomImageUrl);
            var bottomContent = new ByteArrayContent(imgBytes);
            bottomContent.Headers.ContentType =
                new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
            form.Add(bottomContent, "bottom_image", "bottom.jpg");
        }

        try
        {
            var aiResponse = await client.PostAsync(
                $"{baseUrl}/generate-recommended-tryon",
                form
            );

            var responseBody = await aiResponse.Content.ReadAsStringAsync();

            if (!aiResponse.IsSuccessStatusCode)
            {
                return StatusCode((int)aiResponse.StatusCode, responseBody);
            }

            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            var resultUrl = "";

            if (root.TryGetProperty("result_url", out var resultUrlProperty))
            {
                resultUrl = resultUrlProperty.GetString() ?? "";
            }
            else if (
                root.TryGetProperty("catvton_result", out var catvtonResult) &&
                catvtonResult.TryGetProperty("result_url", out var nestedResultUrl)
            )
            {
                resultUrl = nestedResultUrl.GetString() ?? "";
            }
            else if (
                root.TryGetProperty("catvton_result", out var catvtonResult2) &&
                catvtonResult2.TryGetProperty("result_image", out var nestedResultImage)
            )
            {
                resultUrl = nestedResultImage.GetString() ?? "";
            }

            var history = new TryOnHistory
            {
                UserId = request.UserId,
                Prompt = request.Prompt ?? string.Empty,
                SelectedOutfitTitle = request.SelectedOutfitTitle ?? string.Empty,
                SelectedOutfitColor = request.SelectedOutfitColor ?? string.Empty,
                SelectedOutfitCategory = request.SelectedOutfitCategory ?? string.Empty,
                PersonImageUrl = request.PersonImage.FileName,
                ResultImageUrl = resultUrl,
                CreatedAt = DateTime.UtcNow
            };

            _context.TryOnHistories.Add(history);
            await _context.SaveChangesAsync();

            return Content(responseBody, "application/json");
        }
        catch (Exception ex)
        {
            return StatusCode(
                500,
                $"C# error while calling AI try-on backend: {ex.Message}"
            );
        }
    }

    [HttpGet("history/{userId}")]
    public async Task<IActionResult> GetHistory(int userId)
    {
        var history = await _context.TryOnHistories
            .Where(x => x.UserId == userId)
            .OrderByDescending(x => x.CreatedAt)
            .Select(x => new
            {
                x.Id,
                x.UserId,
                x.Prompt,
                x.SelectedOutfitTitle,
                x.SelectedOutfitColor,
                x.SelectedOutfitCategory,
                x.PersonImageUrl,
                x.ResultImageUrl,
                x.CreatedAt
            })
            .ToListAsync();

        return Ok(history);
    }

    private async Task<IActionResult> ForwardToAiBackend(string endpoint, object request)
    {
        var baseUrl = _configuration["AiBackend:BaseUrl"];

        if (string.IsNullOrWhiteSpace(baseUrl))
        {
            return StatusCode(500, "AI backend URL is missing in appsettings.json.");
        }

        baseUrl = baseUrl.TrimEnd('/');

        var client = _httpClientFactory.CreateClient();

        var json = JsonSerializer.Serialize(request);

        using var content = new StringContent(
            json,
            Encoding.UTF8,
            "application/json"
        );

        try
        {
            var url = $"{baseUrl}{endpoint}";

            Console.WriteLine($"Sending to AI: {url}");
            Console.WriteLine($"Body: {json}");

            var aiResponse = await client.PostAsync(url, content);

            var responseBody = await aiResponse.Content.ReadAsStringAsync();

            Console.WriteLine($"AI Status: {(int)aiResponse.StatusCode}");
            Console.WriteLine($"AI Response: {responseBody}");

            if (!aiResponse.IsSuccessStatusCode)
            {
                return StatusCode((int)aiResponse.StatusCode, responseBody);
            }

            return Content(responseBody, "application/json");
        }
        catch (Exception ex)
        {
            Console.WriteLine("AI FORWARD ERROR:");
            Console.WriteLine(ex.ToString());

            return StatusCode(
                500,
                $"C# error while calling AI backend: {ex.Message}"
            );
        }
    }
}