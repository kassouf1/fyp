using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;
using System.Security.Claims;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class UsersController : ControllerBase
{
    private readonly AppDbContext _context;

    public UsersController(AppDbContext context) => _context = context;

    // GET /api/users/search?q=name&requesterId=1
    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int requesterId)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(new List<object>());

        var term = "%" + q.Trim().Replace("%", "") + "%";

        var users = await _context.Users
            .Where(u => u.Id != requesterId &&
                        (EF.Functions.Like(u.FullName, term) ||
                         EF.Functions.Like(u.Username, term) ||
                         EF.Functions.Like(u.Email,    term)))
            .Select(u => new { u.Id, u.FullName, u.Username, u.AvatarUrl })
            .Take(30)
            .ToListAsync();

        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == requesterId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        // Who among results already follows the requester
        var followerIds = await _context.Follows
            .Where(f => f.FollowingId == requesterId)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var result = users.Select(u => new
        {
            userId         = u.Id,
            fullName       = u.FullName,
            username       = u.Username,
            avatarUrl      = u.AvatarUrl,
            isFollowedByMe = followingIds.Contains(u.Id),
            followsMe      = followerIds.Contains(u.Id),
        });

        return Ok(result);
    }

    // GET /api/users/{id}/profile?requesterId=1
    [HttpGet("{id}/profile")]
    public async Task<IActionResult> GetProfile(int id, [FromQuery] int requesterId)
    {
        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();

        var postCount      = await _context.Posts.CountAsync(p => p.UserId == id);
        var followerCount  = await _context.Follows.CountAsync(f => f.FollowingId == id);
        var followingCount = await _context.Follows.CountAsync(f => f.FollowerId == id);
        var isFollowing    = await _context.Follows.AnyAsync(f => f.FollowerId == requesterId && f.FollowingId == id);
        var followsMe      = await _context.Follows.AnyAsync(f => f.FollowerId == id && f.FollowingId == requesterId);

        // A "friend" is a mutual follow — this user follows them and they follow back.
        var followingIds = await _context.Follows.Where(f => f.FollowerId == id).Select(f => f.FollowingId).ToListAsync();
        var followerIds  = await _context.Follows.Where(f => f.FollowingId == id).Select(f => f.FollowerId).ToListAsync();
        var friendCount  = followingIds.Intersect(followerIds).Count();

        // Shared followers: the viewer's followers who also follow this profile
        var sharedFollowers     = Array.Empty<SharedFollowerItem>();
        var sharedFollowerCount = 0;

        if (requesterId != id)
        {
            var myFollowerIds = await _context.Follows
                .Where(f => f.FollowingId == requesterId)
                .Select(f => f.FollowerId)
                .ToListAsync();

            if (myFollowerIds.Count > 0)
            {
                sharedFollowerCount = await _context.Follows
                    .CountAsync(f => f.FollowingId == id && myFollowerIds.Contains(f.FollowerId));

                sharedFollowers = (await _context.Follows
                    .Where(f => f.FollowingId == id && myFollowerIds.Contains(f.FollowerId))
                    .Include(f => f.Follower)
                    .Take(2)
                    .ToListAsync())
                    .Select(f => new SharedFollowerItem(f.Follower!.Username, f.Follower.FullName))
                    .ToArray();
            }
        }

        return Ok(new
        {
            userId              = user.Id,
            fullName            = user.FullName,
            username            = user.Username,
            avatarUrl           = user.AvatarUrl,
            postCount,
            followerCount,
            followingCount,
            friendCount,
            isFollowedByMe      = isFollowing,
            followsMe,
            sharedFollowers,
            sharedFollowerCount,
        });
    }

    // GET /api/users/{id}/suggestions
    [HttpGet("{id}/suggestions")]
    public async Task<IActionResult> GetSuggestions(int id)
    {
        // Who the requester already follows
        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == id)
            .Select(f => f.FollowingId)
            .ToListAsync();

        // Friends-of-friends: people followed by the people I follow
        var fofIds = await _context.Follows
            .Where(f => followingIds.Contains(f.FollowerId)
                     && f.FollowingId != id
                     && !followingIds.Contains(f.FollowingId))
            .Select(f => f.FollowingId)
            .Distinct()
            .ToListAsync();

        // Who follows me (id) — some suggestions may already follow back
        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == id)
            .Select(f => f.FollowerId)
            .ToListAsync();

        // Candidates: anyone I don't follow yet (excluding myself)
        var candidates = await _context.Users
            .Where(u => u.Id != id && !followingIds.Contains(u.Id))
            .Select(u => new
            {
                u.Id,
                u.FullName,
                u.Username,
                u.AvatarUrl,
                followerCount = _context.Follows.Count(f => f.FollowingId == u.Id),
            })
            .ToListAsync();

        // Order: FOF first, then by follower count descending
        var result = candidates
            .OrderByDescending(u => fofIds.Contains(u.Id))
            .ThenByDescending(u => u.followerCount)
            .Take(20)
            .Select(u => new
            {
                userId         = u.Id,
                fullName       = u.FullName,
                username       = u.Username,
                avatarUrl      = u.AvatarUrl,
                followerCount  = u.followerCount,
                mutualFollow   = fofIds.Contains(u.Id),
                isFollowedByMe = false,
                followsMe      = myFollowerIds.Contains(u.Id),
            });

        return Ok(result);
    }

    // PUT /api/users/{id}/push-token
    [Authorize]
    [HttpPut("{id}/push-token")]
    public async Task<IActionResult> UpdatePushToken(int id, [FromBody] PushTokenRequest req)
    {
        var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (callerId != id) return Forbid();

        var existing = await _context.UserPushTokens.FirstOrDefaultAsync(t => t.UserId == id);
        if (existing != null)
        {
            existing.Token     = req.Token;
            existing.UpdatedAt = DateTime.UtcNow;
        }
        else
        {
            _context.UserPushTokens.Add(new UserPushToken { UserId = id, Token = req.Token });
        }
        await _context.SaveChangesAsync();
        return Ok();
    }

    // POST /api/users/block  { blockerId, blockedId }
    [HttpPost("block")]
    public async Task<IActionResult> BlockUser([FromBody] BlockRequest req)
    {
        if (req.BlockerId == req.BlockedId) return BadRequest();
        if (await _context.Blocks.AnyAsync(b => b.BlockerId == req.BlockerId && b.BlockedId == req.BlockedId))
            return Ok(new { blocked = true });

        _context.Blocks.Add(new Block { BlockerId = req.BlockerId, BlockedId = req.BlockedId });
        await _context.SaveChangesAsync();
        return Ok(new { blocked = true });
    }

    // DELETE /api/users/block?blockerId=1&blockedId=2
    [HttpDelete("block")]
    public async Task<IActionResult> UnblockUser([FromQuery] int blockerId, [FromQuery] int blockedId)
    {
        var block = await _context.Blocks
            .FirstOrDefaultAsync(b => b.BlockerId == blockerId && b.BlockedId == blockedId);
        if (block != null)
        {
            _context.Blocks.Remove(block);
            await _context.SaveChangesAsync();
        }
        return Ok(new { blocked = false });
    }

    // GET /api/users/{id}/is-blocked?requesterId=1
    [HttpGet("{id}/is-blocked")]
    public async Task<IActionResult> IsBlocked(int id, [FromQuery] int requesterId)
    {
        var blocked = await _context.Blocks.AnyAsync(
            b => (b.BlockerId == requesterId && b.BlockedId == id) ||
                 (b.BlockerId == id && b.BlockedId == requesterId));
        return Ok(new { blocked });
    }

    // PUT /api/users/{id}/avatar
    [Authorize]
    [HttpPut("{id}/avatar")]
    public async Task<IActionResult> UpdateAvatar(int id, [FromBody] UpdateAvatarRequest request)
    {
        var callerId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        if (callerId != id) return Forbid();

        var user = await _context.Users.FindAsync(id);
        if (user == null) return NotFound();
        user.AvatarUrl = request.AvatarUrl;
        await _context.SaveChangesAsync();
        return Ok(new { avatarUrl = user.AvatarUrl });
    }
}

public class UpdateAvatarRequest { public string? AvatarUrl { get; set; } }
public class PushTokenRequest    { public string Token { get; set; } = string.Empty; }
public class BlockRequest        { public int BlockerId { get; set; } public int BlockedId { get; set; } }

public record SharedFollowerItem(string Username, string FullName);
