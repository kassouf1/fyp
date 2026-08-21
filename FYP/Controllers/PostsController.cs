using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PostsController : ControllerBase
{
    private readonly AppDbContext _context;

    public PostsController(AppDbContext context) => _context = context;

    // POST /api/posts
    [HttpPost]
    public async Task<IActionResult> CreatePost([FromBody] CreatePostRequest req)
    {
        var post = new Post
        {
            UserId    = req.UserId,
            ImageUrl  = req.ImageUrl,
            Caption   = req.Caption ?? string.Empty,
        };
        _context.Posts.Add(post);
        await _context.SaveChangesAsync();

        // Save tags and notify tagged users
        if (req.TaggedUserIds is { Length: > 0 })
        {
            var actor = await _context.Users.FindAsync(req.UserId);
            foreach (var taggedId in req.TaggedUserIds.Distinct())
            {
                if (taggedId == req.UserId) continue;
                var userExists = await _context.Users.AnyAsync(u => u.Id == taggedId);
                if (!userExists) continue;

                _context.PostTags.Add(new PostTag { PostId = post.Id, TaggedUserId = taggedId });

                _context.Notifications.Add(new Notification
                {
                    UserId  = taggedId,
                    ActorId = req.UserId,
                    Type    = "tag",
                    PostId  = post.Id,
                });

                // Push notification
                var pushToken = await _context.UserPushTokens.FirstOrDefaultAsync(t => t.UserId == taggedId);
                if (pushToken != null)
                    _ = ChatsController.SendExpoPushAsync(pushToken.Token,
                        actor?.FullName ?? "Someone",
                        "tagged you in a post");
            }
            await _context.SaveChangesAsync();
        }

        return Ok(await BuildPostDto(post.Id, req.UserId));
    }

    // GET /api/posts/feed?userId=1&page=0
    [HttpGet("feed")]
    public async Task<IActionResult> GetFeed([FromQuery] int userId, [FromQuery] int page = 0)
    {
        const int pageSize = 20;

        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == userId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        // Include own posts in feed too
        followingIds.Add(userId);

        var likedPostIds = await _context.Likes
            .Where(l => l.UserId == userId)
            .Select(l => l.PostId)
            .ToListAsync();

        var posts = await _context.Posts
            .Where(p => followingIds.Contains(p.UserId))
            .OrderByDescending(p => p.CreatedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Include(p => p.User)
            .Select(p => new
            {
                id           = p.Id,
                userId       = p.UserId,
                fullName     = p.User!.FullName,
                avatarUrl    = p.User.AvatarUrl,
                imageUrl     = p.ImageUrl,
                caption      = p.Caption,
                likeCount    = p.Likes.Count,
                commentCount = p.Comments.Count,
                isLikedByMe  = likedPostIds.Contains(p.Id),
                createdAt    = p.CreatedAt,
            })
            .ToListAsync();

        return Ok(posts);
    }

    // GET /api/posts/explore?userId=1&page=0 — for the Discover grid: recent
    // posts from everyone, not just people the user already follows (unlike
    // /feed, which is deliberately following-only).
    [HttpGet("explore")]
    public async Task<IActionResult> GetExplore([FromQuery] int userId, [FromQuery] int page = 0)
    {
        const int pageSize = 30;

        var likedPostIds = await _context.Likes
            .Where(l => l.UserId == userId)
            .Select(l => l.PostId)
            .ToListAsync();

        var posts = await _context.Posts
            .OrderByDescending(p => p.CreatedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Include(p => p.User)
            .Select(p => new
            {
                id           = p.Id,
                userId       = p.UserId,
                fullName     = p.User!.FullName,
                avatarUrl    = p.User.AvatarUrl,
                imageUrl     = p.ImageUrl,
                caption      = p.Caption,
                likeCount    = p.Likes.Count,
                commentCount = p.Comments.Count,
                isLikedByMe  = likedPostIds.Contains(p.Id),
                createdAt    = p.CreatedAt,
            })
            .ToListAsync();

        return Ok(posts);
    }

    // GET /api/posts/user/{userId}?requesterId=1
    [HttpGet("user/{userId}")]
    public async Task<IActionResult> GetUserPosts(int userId, [FromQuery] int requesterId)
    {
        var likedPostIds = await _context.Likes
            .Where(l => l.UserId == requesterId)
            .Select(l => l.PostId)
            .ToListAsync();

        var posts = await _context.Posts
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Include(p => p.User)
            .Select(p => new
            {
                id           = p.Id,
                userId       = p.UserId,
                fullName     = p.User!.FullName,
                avatarUrl    = p.User.AvatarUrl,
                imageUrl     = p.ImageUrl,
                caption      = p.Caption,
                likeCount    = p.Likes.Count,
                commentCount = p.Comments.Count,
                isLikedByMe  = likedPostIds.Contains(p.Id),
                createdAt    = p.CreatedAt,
            })
            .ToListAsync();

        return Ok(posts);
    }

    // PUT /api/posts/{id}
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdatePost(int id, [FromBody] UpdatePostRequest req)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();
        if (post.UserId != req.UserId) return Forbid();
        post.Caption = req.Caption ?? string.Empty;
        await _context.SaveChangesAsync();
        return Ok(await BuildPostDto(id, req.UserId));
    }

    // DELETE /api/posts/{id}?userId=1
    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePost(int id, [FromQuery] int userId)
    {
        var post = await _context.Posts.FindAsync(id);
        if (post == null) return NotFound();
        if (post.UserId != userId) return Forbid();
        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // POST /api/posts/{id}/repost
    [HttpPost("{id}/repost")]
    public async Task<IActionResult> Repost(int id, [FromBody] UserIdRequest req)
    {
        var original = await _context.Posts.FindAsync(id);
        if (original == null) return NotFound();

        var repost = new Post
        {
            UserId   = req.UserId,
            ImageUrl = original.ImageUrl,
            Caption  = original.Caption,
        };
        _context.Posts.Add(repost);

        if (original.UserId != req.UserId)
        {
            _context.Notifications.Add(new Notification
            {
                UserId  = original.UserId,
                ActorId = req.UserId,
                Type    = "repost",
                PostId  = id,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(await BuildPostDto(repost.Id, req.UserId));
    }

    // POST /api/posts/{id}/like
    [HttpPost("{id}/like")]
    public async Task<IActionResult> ToggleLike(int id, [FromBody] UserIdRequest req)
    {
        var existing = await _context.Likes
            .FirstOrDefaultAsync(l => l.UserId == req.UserId && l.PostId == id);

        if (existing != null)
        {
            _context.Likes.Remove(existing);
            await _context.SaveChangesAsync();
            return Ok(new { liked = false, likeCount = await _context.Likes.CountAsync(l => l.PostId == id) });
        }

        _context.Likes.Add(new Like { UserId = req.UserId, PostId = id });

        // Notify post owner
        var post = await _context.Posts.FindAsync(id);
        if (post != null && post.UserId != req.UserId)
        {
            _context.Notifications.Add(new Notification
            {
                UserId  = post.UserId,
                ActorId = req.UserId,
                Type    = "like",
                PostId  = id,
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { liked = true, likeCount = await _context.Likes.CountAsync(l => l.PostId == id) });
    }

    // GET /api/posts/{id}/comments
    [HttpGet("{id}/comments")]
    public async Task<IActionResult> GetComments(int id)
    {
        var comments = await _context.Comments
            .Where(c => c.PostId == id)
            .OrderBy(c => c.CreatedAt)
            .Include(c => c.User)
            .Select(c => new
            {
                id        = c.Id,
                userId    = c.UserId,
                fullName  = c.User!.FullName,
                avatarUrl = c.User.AvatarUrl,
                text      = c.Text,
                createdAt = c.CreatedAt,
            })
            .ToListAsync();

        return Ok(comments);
    }

    // POST /api/posts/{id}/comments
    [HttpPost("{id}/comments")]
    public async Task<IActionResult> AddComment(int id, [FromBody] AddCommentRequest req)
    {
        var comment = new Comment { UserId = req.UserId, PostId = id, Text = req.Text };
        _context.Comments.Add(comment);

        // Notify post owner
        var post = await _context.Posts.FindAsync(id);
        if (post != null && post.UserId != req.UserId)
        {
            _context.Notifications.Add(new Notification
            {
                UserId      = post.UserId,
                ActorId     = req.UserId,
                Type        = "comment",
                PostId      = id,
                CommentText = req.Text,
            });
        }

        await _context.SaveChangesAsync();

        var user = await _context.Users.FindAsync(req.UserId);
        return Ok(new
        {
            id        = comment.Id,
            userId    = comment.UserId,
            fullName  = user?.FullName,
            avatarUrl = user?.AvatarUrl,
            text      = comment.Text,
            createdAt = comment.CreatedAt,
        });
    }

    // GET /api/posts/{id}?requesterId=1
    [HttpGet("{id}")]
    public async Task<IActionResult> GetPost(int id, [FromQuery] int requesterId)
    {
        var dto = await BuildPostDto(id, requesterId);
        if (dto == null) return NotFound();
        return Ok(dto);
    }

    // DELETE /api/posts/{postId}/comments/{commentId}?userId=1
    [HttpDelete("{postId}/comments/{commentId}")]
    public async Task<IActionResult> DeleteComment(int postId, int commentId, [FromQuery] int userId)
    {
        var comment = await _context.Comments.FindAsync(commentId);
        if (comment == null || comment.PostId != postId) return NotFound();
        if (comment.UserId != userId) return Forbid();
        _context.Comments.Remove(comment);
        await _context.SaveChangesAsync();
        return Ok();
    }

    private async Task<object?> BuildPostDto(int postId, int requesterId)
    {
        var isLiked = await _context.Likes.AnyAsync(l => l.UserId == requesterId && l.PostId == postId);
        return await _context.Posts
            .Where(p => p.Id == postId)
            .Include(p => p.User)
            .Select(p => new
            {
                id           = p.Id,
                userId       = p.UserId,
                fullName     = p.User!.FullName,
                avatarUrl    = p.User.AvatarUrl,
                imageUrl     = p.ImageUrl,
                caption      = p.Caption,
                likeCount    = p.Likes.Count,
                commentCount = p.Comments.Count,
                isLikedByMe  = isLiked,
                createdAt    = p.CreatedAt,
            })
            .FirstOrDefaultAsync();
    }
}

public class CreatePostRequest  { public int UserId { get; set; } public string ImageUrl { get; set; } = string.Empty; public string? Caption { get; set; } public int[] TaggedUserIds { get; set; } = []; }
public class UpdatePostRequest  { public int UserId { get; set; } public string? Caption { get; set; } }
public class UserIdRequest      { public int UserId { get; set; } }
public class AddCommentRequest  { public int UserId { get; set; } public string Text { get; set; } = string.Empty; }
