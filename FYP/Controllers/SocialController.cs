using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SocialController : ControllerBase
{
    private readonly AppDbContext _context;

    public SocialController(AppDbContext context) => _context = context;

    // POST /api/social/follow
    [HttpPost("follow")]
    public async Task<IActionResult> Follow([FromBody] FollowRequest req)
    {
        if (req.FollowerId == req.FollowingId) return BadRequest("Cannot follow yourself.");

        var existing = await _context.Follows
            .AnyAsync(f => f.FollowerId == req.FollowerId && f.FollowingId == req.FollowingId);
        if (existing) return Ok(new { following = true });

        _context.Follows.Add(new Follow { FollowerId = req.FollowerId, FollowingId = req.FollowingId });

        _context.Notifications.Add(new Notification
        {
            UserId  = req.FollowingId,
            ActorId = req.FollowerId,
            Type    = "follow",
        });

        await _context.SaveChangesAsync();
        return Ok(new { following = true });
    }

    // DELETE /api/social/follow?followerId=1&followingId=2
    [HttpDelete("follow")]
    public async Task<IActionResult> Unfollow([FromQuery] int followerId, [FromQuery] int followingId)
    {
        var follow = await _context.Follows
            .FirstOrDefaultAsync(f => f.FollowerId == followerId && f.FollowingId == followingId);
        if (follow == null) return Ok(new { following = false });
        _context.Follows.Remove(follow);
        await _context.SaveChangesAsync();
        return Ok(new { following = false });
    }

    // GET /api/social/{userId}/followers?requesterId=1
    [HttpGet("{userId}/followers")]
    public async Task<IActionResult> GetFollowers(int userId, [FromQuery] int requesterId)
    {
        var myFollowingIds = await _context.Follows
            .Where(f => f.FollowerId == requesterId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == requesterId)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var followers = await _context.Follows
            .Where(f => f.FollowingId == userId)
            .Include(f => f.Follower)
            .Select(f => new
            {
                userId         = f.FollowerId,
                fullName       = f.Follower!.FullName,
                username       = f.Follower.Username,
                avatarUrl      = f.Follower.AvatarUrl,
                isFollowedByMe = myFollowingIds.Contains(f.FollowerId),
                followsMe      = myFollowerIds.Contains(f.FollowerId),
            })
            .ToListAsync();

        return Ok(followers);
    }

    // GET /api/social/{userId}/following?requesterId=1
    [HttpGet("{userId}/following")]
    public async Task<IActionResult> GetFollowing(int userId, [FromQuery] int requesterId)
    {
        var myFollowingIds = await _context.Follows
            .Where(f => f.FollowerId == requesterId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == requesterId)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var following = await _context.Follows
            .Where(f => f.FollowerId == userId)
            .Include(f => f.Following)
            .Select(f => new
            {
                userId         = f.FollowingId,
                fullName       = f.Following!.FullName,
                username       = f.Following.Username,
                avatarUrl      = f.Following.AvatarUrl,
                isFollowedByMe = myFollowingIds.Contains(f.FollowingId),
                followsMe      = myFollowerIds.Contains(f.FollowingId),
            })
            .ToListAsync();

        return Ok(following);
    }

    // GET /api/social/{userId}/friends?requesterId=1
    // A "friend" is a mutual follow — userId follows them and they follow userId back.
    [HttpGet("{userId}/friends")]
    public async Task<IActionResult> GetFriends(int userId, [FromQuery] int requesterId)
    {
        var myFollowingIds = await _context.Follows
            .Where(f => f.FollowerId == requesterId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        var myFollowerIds = await _context.Follows
            .Where(f => f.FollowingId == requesterId)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var followingIds = await _context.Follows
            .Where(f => f.FollowerId == userId)
            .Select(f => f.FollowingId)
            .ToListAsync();

        var followerIds = await _context.Follows
            .Where(f => f.FollowingId == userId)
            .Select(f => f.FollowerId)
            .ToListAsync();

        var friendIds = followingIds.Intersect(followerIds).ToList();

        var friends = await _context.Users
            .Where(u => friendIds.Contains(u.Id))
            .Select(u => new
            {
                userId         = u.Id,
                fullName       = u.FullName,
                username       = u.Username,
                avatarUrl      = u.AvatarUrl,
                isFollowedByMe = myFollowingIds.Contains(u.Id),
                followsMe      = myFollowerIds.Contains(u.Id),
            })
            .ToListAsync();

        return Ok(friends);
    }
}

public class FollowRequest { public int FollowerId { get; set; } public int FollowingId { get; set; } }
