using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StoriesController : ControllerBase
{
    private readonly AppDbContext _context;

    public StoriesController(AppDbContext context) => _context = context;

    // POST /api/stories
    [HttpPost]
    public async Task<IActionResult> CreateStory([FromBody] CreateStoryRequest req)
    {
        var story = new Story
        {
            UserId             = req.UserId,
            ImageUrl           = req.ImageUrl,
            Caption            = req.Caption,
            PostId             = req.PostId,
            PostAuthorName     = req.PostAuthorName,
            PostAuthorAvatarUrl = req.PostAuthorAvatarUrl,
            PostCaption        = req.PostCaption,
            ExpiresAt          = DateTime.UtcNow.AddHours(24),
        };
        _context.Stories.Add(story);
        await _context.SaveChangesAsync();
        return Ok(new { id = story.Id, createdAt = story.CreatedAt, expiresAt = story.ExpiresAt });
    }

    // GET /api/stories/feed?userId=1  — stories from followed users (+ own), grouped by user
    [HttpGet("feed")]
    public async Task<IActionResult> GetFeedStories([FromQuery] int userId)
    {
        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == userId)
            .Select(f => f.FollowingId)
            .ToListAsync();
        followingIds.Add(userId);

        var now = DateTime.UtcNow;

        var viewedStoryIds = await _context.StoryViews
            .Where(v => v.ViewerId == userId)
            .Select(v => v.StoryId)
            .ToListAsync();

        var stories = await _context.Stories
            .Where(s => followingIds.Contains(s.UserId) && s.ExpiresAt > now)
            .OrderBy(s => s.UserId)
            .ThenBy(s => s.CreatedAt)   // oldest first so viewer progresses forward in time
            .Include(s => s.User)
            .ToListAsync();

        if (stories.Count == 0) return Ok(new List<object>());

        var storyIds = stories.Select(s => s.Id).ToList();

        var viewCounts = await _context.StoryViews
            .Where(v => storyIds.Contains(v.StoryId))
            .GroupBy(v => v.StoryId)
            .Select(g => new { StoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoryId, x => x.Count);

        var likeCounts = await _context.StoryLikes
            .Where(l => storyIds.Contains(l.StoryId))
            .GroupBy(l => l.StoryId)
            .Select(g => new { StoryId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.StoryId, x => x.Count);

        var likedStoryIds = await _context.StoryLikes
            .Where(l => l.UserId == userId && storyIds.Contains(l.StoryId))
            .Select(l => l.StoryId)
            .ToListAsync();

        var grouped = stories
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                userId      = g.Key,
                fullName    = g.First().User!.FullName,
                avatarUrl   = g.First().User!.AvatarUrl,
                hasUnviewed = g.Any(s => !viewedStoryIds.Contains(s.Id)),
                stories     = g.Select(s => new
                {
                    id                 = s.Id,
                    imageUrl           = s.ImageUrl,
                    caption            = s.Caption,
                    postId             = s.PostId,
                    postAuthorName     = s.PostAuthorName,
                    postAuthorAvatarUrl = s.PostAuthorAvatarUrl,
                    postCaption        = s.PostCaption,
                    createdAt          = s.CreatedAt,
                    expiresAt   = s.ExpiresAt,
                    isViewed    = viewedStoryIds.Contains(s.Id),
                    viewCount   = viewCounts.GetValueOrDefault(s.Id, 0),
                    likeCount   = likeCounts.GetValueOrDefault(s.Id, 0),
                    isLikedByMe = likedStoryIds.Contains(s.Id),
                }).ToList(),
            })
            .OrderByDescending(g => g.userId == userId)
            .ThenByDescending(g => g.hasUnviewed)
            .ToList();

        return Ok(grouped);
    }

    // POST /api/stories/{id}/view
    [HttpPost("{id}/view")]
    public async Task<IActionResult> MarkViewed(int id, [FromBody] UserIdRequest req)
    {
        var already = await _context.StoryViews
            .AnyAsync(v => v.StoryId == id && v.ViewerId == req.UserId);
        if (!already)
        {
            _context.StoryViews.Add(new StoryView { StoryId = id, ViewerId = req.UserId });
            await _context.SaveChangesAsync();
        }
        return Ok();
    }

    // POST /api/stories/{id}/like
    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(int id, [FromBody] UserIdRequest req)
    {
        var existing = await _context.StoryLikes
            .FirstOrDefaultAsync(l => l.StoryId == id && l.UserId == req.UserId);

        if (existing != null)
        {
            _context.StoryLikes.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { liked = false, likeCount = await _context.StoryLikes.CountAsync(l => l.StoryId == id) });
        }

        _context.StoryLikes.Add(new StoryLike { StoryId = id, UserId = req.UserId });
        await _context.SaveChangesAsync();
        return Ok(new { liked = true, likeCount = await _context.StoryLikes.CountAsync(l => l.StoryId == id) });
    }

    // GET /api/stories/{id}/viewers?userId=1  — story owner only
    [HttpGet("{id}/viewers")]
    public async Task<IActionResult> GetViewers(int id, [FromQuery] int userId)
    {
        var story = await _context.Stories.FindAsync(id);
        if (story == null) return NotFound();
        if (story.UserId != userId) return Forbid();

        var likedUserIds = await _context.StoryLikes
            .Where(l => l.StoryId == id)
            .Select(l => l.UserId)
            .ToListAsync();

        var viewers = await _context.StoryViews
            .Where(v => v.StoryId == id)
            .Include(v => v.Viewer)
            .Select(v => new
            {
                userId    = v.ViewerId,
                fullName  = v.Viewer!.FullName,
                avatarUrl = v.Viewer.AvatarUrl,
                hasLiked  = likedUserIds.Contains(v.ViewerId),
            })
            .ToListAsync();

        return Ok(viewers);
    }

    // DELETE /api/stories/{id}?userId=1
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteStory(int id, [FromQuery] int userId)
    {
        var story = await _context.Stories.FindAsync(id);
        if (story == null) return NotFound();
        if (story.UserId != userId) return Forbid();
        _context.Stories.Remove(story);
        await _context.SaveChangesAsync();
        return Ok();
    }
}

public class CreateStoryRequest
{
    public int UserId { get; set; }
    public string ImageUrl { get; set; } = string.Empty;
    public string? Caption { get; set; }
    public int? PostId { get; set; }
    public string? PostAuthorName { get; set; }
    public string? PostAuthorAvatarUrl { get; set; }
    public string? PostCaption { get; set; }
}
