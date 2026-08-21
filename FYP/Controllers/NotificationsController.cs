using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class NotificationsController : ControllerBase
{
    private readonly AppDbContext _context;

    public NotificationsController(AppDbContext context) => _context = context;

    // GET /api/notifications?userId=1
    [HttpGet]
    public async Task<IActionResult> GetNotifications([FromQuery] int userId)
    {
        var notifications = await _context.Notifications
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAt)
            .Take(50)
            .Include(n => n.Actor)
            .Select(n => new
            {
                id          = n.Id,
                type        = n.Type,
                actorId     = n.ActorId,
                actorName   = n.Actor!.FullName,
                actorAvatar = n.Actor.AvatarUrl,
                postId      = n.PostId,
                commentText = n.CommentText,
                isRead      = n.IsRead,
                createdAt   = n.CreatedAt,
            })
            .ToListAsync();

        return Ok(notifications);
    }

    // POST /api/notifications/read-all?userId=1
    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead([FromQuery] int userId)
    {
        var unread = await _context.Notifications
            .Where(n => n.UserId == userId && !n.IsRead)
            .ToListAsync();
        unread.ForEach(n => n.IsRead = true);
        await _context.SaveChangesAsync();
        return Ok();
    }

    // GET /api/notifications/unread-count?userId=1
    [HttpGet("unread-count")]
    public async Task<IActionResult> GetUnreadCount([FromQuery] int userId)
    {
        var count = await _context.Notifications.CountAsync(n => n.UserId == userId && !n.IsRead);
        return Ok(new { count });
    }
}
