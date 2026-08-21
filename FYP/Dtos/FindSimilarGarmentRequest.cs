namespace FYP.Dtos;

public class FindSimilarGarmentRequest
{
    public string ImageUrl { get; set; } = string.Empty;

    // "top" | "bottom" | "shoes" — null searches every category.
    public string? Category { get; set; }

    // "men" | "women" — null searches both.
    public string? Gender { get; set; }
}
