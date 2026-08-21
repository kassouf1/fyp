using Microsoft.AspNetCore.Http;

namespace FYP.Dtos;

public class GenerateTryOnRequest
{
    public string? Prompt { get; set; }

    public IFormFile PersonImage { get; set; } = null!;

    public IFormFile? ClothesImage { get; set; }

    public string? ClothesImageUrl { get; set; }

    public int UserId { get; set; }

    public string? SelectedOutfitTitle { get; set; }

    public string? SelectedOutfitColor { get; set; }

    public string? SelectedOutfitCategory { get; set; }

    public string? TopId { get; set; }

    public IFormFile? BottomImage { get; set; }

    public string? BottomImageUrl { get; set; }

    public string? BottomId { get; set; }

    // "top" (default) | "bottom" | "both"
    public string? GarmentMode { get; set; }
}