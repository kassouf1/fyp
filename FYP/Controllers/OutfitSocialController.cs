using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace FYP.Controllers;

[ApiController]
[Route("api/[controller]")]
public class OutfitSocialController : ControllerBase
{
    private readonly AppDbContext _db;
    public OutfitSocialController(AppDbContext db) => _db = db;

    // ── Social summary ────────────────────────────────────────────────────────
    // GET /api/outfitsocial/{historyId}/summary?userId=3
    [HttpGet("{historyId}/summary")]
    public async Task<IActionResult> Summary(int historyId, [FromQuery] int userId)
    {
        var likeCount    = await _db.OutfitLikes   .CountAsync(l => l.TryOnHistoryId == historyId);
        var commentCount = await _db.OutfitComments.CountAsync(c => c.TryOnHistoryId == historyId);
        var liked        = userId > 0 && await _db.OutfitLikes    .AnyAsync(l => l.TryOnHistoryId == historyId && l.UserId == userId);
        var favorited    = userId > 0 && await _db.OutfitFavorites.AnyAsync(f => f.TryOnHistoryId == historyId && f.UserId == userId);
        return Ok(new { likeCount, commentCount, liked, favorited });
    }

    // ── Like toggle ───────────────────────────────────────────────────────────
    // POST /api/outfitsocial/{historyId}/like   body: { "userId": 3 }
    [HttpPost("{historyId}/like")]
    public async Task<IActionResult> ToggleLike(int historyId, [FromBody] UserIdDto dto)
    {
        var existing = await _db.OutfitLikes
            .FirstOrDefaultAsync(l => l.TryOnHistoryId == historyId && l.UserId == dto.UserId);

        bool liked;
        if (existing != null)
        {
            _db.OutfitLikes.Remove(existing);
            liked = false;
        }
        else
        {
            _db.OutfitLikes.Add(new OutfitLike { UserId = dto.UserId, TryOnHistoryId = historyId });
            liked = true;
        }

        await _db.SaveChangesAsync();
        var count = await _db.OutfitLikes.CountAsync(l => l.TryOnHistoryId == historyId);
        return Ok(new { liked, likeCount = count });
    }

    // ── Favorite toggle ───────────────────────────────────────────────────────
    // POST /api/outfitsocial/{historyId}/favorite   body: { "userId": 3 }
    [HttpPost("{historyId}/favorite")]
    public async Task<IActionResult> ToggleFavorite(int historyId, [FromBody] UserIdDto dto)
    {
        var existing = await _db.OutfitFavorites
            .FirstOrDefaultAsync(f => f.TryOnHistoryId == historyId && f.UserId == dto.UserId);

        bool favorited;
        if (existing != null)
        {
            _db.OutfitFavorites.Remove(existing);
            favorited = false;
        }
        else
        {
            _db.OutfitFavorites.Add(new OutfitFavorite { UserId = dto.UserId, TryOnHistoryId = historyId });
            favorited = true;
        }

        await _db.SaveChangesAsync();
        return Ok(new { favorited });
    }

    // ── Comments ──────────────────────────────────────────────────────────────
    // GET /api/outfitsocial/{historyId}/comments
    [HttpGet("{historyId}/comments")]
    public async Task<IActionResult> GetComments(int historyId)
    {
        var comments = await _db.OutfitComments
            .Where(c => c.TryOnHistoryId == historyId)
            .OrderBy(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.Text,
                c.CreatedAt,
                UserId   = c.UserId,
                Username = c.User != null ? c.User.Username : "user",
                Avatar   = c.User != null ? c.User.AvatarUrl : null,
            })
            .ToListAsync();

        return Ok(comments);
    }

    // POST /api/outfitsocial/{historyId}/comments   body: { "userId": 3, "text": "..." }
    [HttpPost("{historyId}/comments")]
    public async Task<IActionResult> AddComment(int historyId, [FromBody] AddCommentDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Text))
            return BadRequest("Text is required.");

        var comment = new OutfitComment
        {
            UserId           = dto.UserId,
            TryOnHistoryId   = historyId,
            Text             = dto.Text.Trim(),
        };
        _db.OutfitComments.Add(comment);
        await _db.SaveChangesAsync();

        await _db.Entry(comment).Reference(c => c.User).LoadAsync();

        return Ok(new
        {
            comment.Id,
            comment.Text,
            comment.CreatedAt,
            UserId   = comment.UserId,
            Username = comment.User?.Username ?? "user",
            Avatar   = comment.User?.AvatarUrl,
        });
    }

    // DELETE /api/outfitsocial/comments/{commentId}?userId=3
    [HttpDelete("comments/{commentId}")]
    public async Task<IActionResult> DeleteComment(int commentId, [FromQuery] int userId)
    {
        var comment = await _db.OutfitComments.FindAsync(commentId);
        if (comment == null) return NotFound();
        if (comment.UserId != userId) return Forbid();
        _db.OutfitComments.Remove(comment);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Favorites list ────────────────────────────────────────────────────────
    // GET /api/outfitsocial/favorites/{userId}
    [HttpGet("favorites/{userId}")]
    public async Task<IActionResult> GetFavorites(int userId)
    {
        var favorites = await _db.OutfitFavorites
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.CreatedAt)
            .Select(f => new
            {
                FavoriteId = f.Id,
                f.TryOnHistoryId,
                f.CreatedAt,
                Outfit = f.TryOnHistory == null ? null : new
                {
                    f.TryOnHistory.Id,
                    f.TryOnHistory.ResultImageUrl,
                    f.TryOnHistory.SelectedOutfitTitle,
                    f.TryOnHistory.SelectedOutfitCategory,
                    f.TryOnHistory.SelectedOutfitColor,
                    f.TryOnHistory.Prompt,
                    f.TryOnHistory.CreatedAt,
                }
            })
            .ToListAsync();

        return Ok(favorites);
    }
}

public record UserIdDto(int UserId);
public record AddCommentDto(int UserId, string Text);
