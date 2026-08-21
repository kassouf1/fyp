using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SmartFashion.Api.Data;
using SmartFashion.Api.Models;

namespace SmartFashion.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ChatsController : ControllerBase
{
    private readonly AppDbContext _context;

    public ChatsController(AppDbContext context) => _context = context;

    // GET /api/chats/conversations?userId=1
    [HttpGet("conversations")]
    public async Task<IActionResult> GetConversations([FromQuery] int userId)
    {
        // IDs of users who have blocked this user or been blocked by this user
        var blockedIds = await _context.Blocks
            .Where(b => b.BlockerId == userId || b.BlockedId == userId)
            .Select(b => b.BlockerId == userId ? b.BlockedId : b.BlockerId)
            .ToListAsync();

        var partnerIds = await _context.Messages
            .Where(m => (m.SenderId == userId || m.ReceiverId == userId)
                     && !blockedIds.Contains(m.SenderId == userId ? m.ReceiverId : m.SenderId))
            .Select(m => m.SenderId == userId ? m.ReceiverId : m.SenderId)
            .Distinct()
            .ToListAsync();

        var conversations = new List<object>();

        foreach (var partnerId in partnerIds)
        {
            var partner = await _context.Users.FindAsync(partnerId);
            if (partner == null) continue;

            var lastMsg = await _context.Messages
                .Where(m => (m.SenderId == userId && m.ReceiverId == partnerId) ||
                            (m.SenderId == partnerId && m.ReceiverId == userId))
                .OrderByDescending(m => m.CreatedAt)
                .FirstOrDefaultAsync();

            var unread = await _context.Messages
                .CountAsync(m => m.SenderId == partnerId && m.ReceiverId == userId && !m.IsRead);

            string? preview = null;
            if (lastMsg != null)
                preview = lastMsg.PostId != null ? "📸 Shared a post"
                        : lastMsg.MediaUrl != null && string.IsNullOrEmpty(lastMsg.Text) ? "📷 Photo"
                        : lastMsg.Text;

            conversations.Add(new
            {
                userId        = partner.Id,
                fullName      = partner.FullName,
                avatarUrl     = partner.AvatarUrl,
                lastMessage   = preview,
                lastMessageAt = lastMsg?.CreatedAt,
                unreadCount   = unread,
            });
        }

        var sorted = conversations
            .OrderByDescending(c => ((dynamic)c).lastMessageAt)
            .ToList();

        return Ok(sorted);
    }

    // GET /api/chats/requests?userId=1  — incoming pending requests
    [HttpGet("requests")]
    public async Task<IActionResult> GetRequests([FromQuery] int userId)
    {
        var requests = await _context.MessageRequests
            .Where(r => r.ReceiverId == userId && r.Status == "pending")
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new
            {
                id          = r.Id,
                senderId    = r.SenderId,
                senderName  = r.Sender.FullName,
                senderAvatar = r.Sender.AvatarUrl,
                messageText = r.MessageText,
                mediaUrl    = r.MediaUrl,
                createdAt   = r.CreatedAt,
            })
            .ToListAsync();

        return Ok(requests);
    }

    // POST /api/chats/requests/{id}/accept
    [HttpPost("requests/{id}/accept")]
    public async Task<IActionResult> AcceptRequest(int id, [FromQuery] int userId)
    {
        var req = await _context.MessageRequests.FindAsync(id);
        if (req == null || req.ReceiverId != userId) return NotFound();

        req.Status = "accepted";

        // Create the actual message
        var msg = new Message
        {
            SenderId   = req.SenderId,
            ReceiverId = req.ReceiverId,
            Text       = req.MessageText,
            MediaUrl   = req.MediaUrl,
            CreatedAt  = req.CreatedAt,
        };
        _context.Messages.Add(msg);
        await _context.SaveChangesAsync();

        return Ok(new { accepted = true });
    }

    // POST /api/chats/requests/{id}/reject
    [HttpPost("requests/{id}/reject")]
    public async Task<IActionResult> RejectRequest(int id, [FromQuery] int userId)
    {
        var req = await _context.MessageRequests.FindAsync(id);
        if (req == null || req.ReceiverId != userId) return NotFound();

        req.Status = "rejected";
        await _context.SaveChangesAsync();

        return Ok(new { rejected = true });
    }

    // GET /api/chats/messages?userId=1&partnerId=2&page=0
    [HttpGet("messages")]
    public async Task<IActionResult> GetMessages(
        [FromQuery] int userId, [FromQuery] int partnerId, [FromQuery] int page = 0)
    {
        const int pageSize = 40;

        // Mark received messages as read
        var unread = await _context.Messages
            .Where(m => m.SenderId == partnerId && m.ReceiverId == userId && !m.IsRead)
            .ToListAsync();
        unread.ForEach(m => m.IsRead = true);
        await _context.SaveChangesAsync();

        var messages = await _context.Messages
            .Where(m => (m.SenderId == userId && m.ReceiverId == partnerId) ||
                        (m.SenderId == partnerId && m.ReceiverId == userId))
            .OrderByDescending(m => m.CreatedAt)
            .Skip(page * pageSize)
            .Take(pageSize)
            .Select(m => new
            {
                id                 = m.Id,
                senderId           = m.SenderId,
                text               = m.Text,
                storyImageUrl      = m.StoryImageUrl,
                mediaUrl           = m.MediaUrl,
                postId             = m.PostId,
                postImageUrl       = m.PostImageUrl,
                postAuthorName     = m.PostAuthorName,
                postAuthorAvatarUrl = m.PostAuthorAvatarUrl,
                postCaption        = m.PostCaption,
                isRead             = m.IsRead,
                createdAt          = m.CreatedAt,
            })
            .ToListAsync();

        return Ok(messages.OrderBy(m => m.createdAt));
    }

    // POST /api/chats/messages
    [HttpPost("messages")]
    public async Task<IActionResult> SendMessage([FromBody] SendMessageRequest req)
    {
        // Check if sender is blocked
        var isBlocked = await _context.Blocks.AnyAsync(
            b => (b.BlockerId == req.ReceiverId && b.BlockedId == req.SenderId) ||
                 (b.BlockerId == req.SenderId   && b.BlockedId == req.ReceiverId));
        if (isBlocked) return StatusCode(403, new { error = "blocked" });

        // Check if request was already rejected
        var existingRequest = await _context.MessageRequests
            .FirstOrDefaultAsync(r => r.SenderId == req.SenderId && r.ReceiverId == req.ReceiverId);
        if (existingRequest?.Status == "rejected")
            return StatusCode(403, new { error = "request_rejected" });

        // Check if they follow each other OR request was already accepted
        var followsEachOther = await _context.Follows
            .AnyAsync(f => f.FollowerId == req.SenderId && f.FollowingId == req.ReceiverId);
        var requestAccepted = existingRequest?.Status == "accepted";
        var hadPriorMessages = await _context.Messages
            .AnyAsync(m => (m.SenderId == req.SenderId && m.ReceiverId == req.ReceiverId) ||
                           (m.SenderId == req.ReceiverId && m.ReceiverId == req.SenderId));

        if (!followsEachOther && !requestAccepted && !hadPriorMessages)
        {
            // First message to a non-follower — create request
            if (existingRequest != null)
                return StatusCode(409, new { error = "request_pending" });

            var msgRequest = new MessageRequest
            {
                SenderId    = req.SenderId,
                ReceiverId  = req.ReceiverId,
                MessageText = req.Text,
                MediaUrl    = req.MediaUrl ?? req.PostImageUrl,
            };
            _context.MessageRequests.Add(msgRequest);
            await _context.SaveChangesAsync();

            return Ok(new
            {
                type        = "request",
                id          = msgRequest.Id,
                senderId    = msgRequest.SenderId,
                text        = msgRequest.MessageText,
                mediaUrl    = msgRequest.MediaUrl,
                isRead      = false,
                createdAt   = msgRequest.CreatedAt,
            });
        }

        var msg = new Message
        {
            SenderId           = req.SenderId,
            ReceiverId         = req.ReceiverId,
            Text               = req.Text,
            StoryImageUrl      = req.StoryImageUrl,
            MediaUrl           = req.MediaUrl,
            PostId             = req.PostId,
            PostImageUrl       = req.PostImageUrl,
            PostAuthorName     = req.PostAuthorName,
            PostAuthorAvatarUrl = req.PostAuthorAvatarUrl,
            PostCaption        = req.PostCaption,
        };
        _context.Messages.Add(msg);
        await _context.SaveChangesAsync();

        var pushToken = await _context.UserPushTokens
            .FirstOrDefaultAsync(t => t.UserId == req.ReceiverId);
        if (pushToken != null)
        {
            var sender = await _context.Users.FindAsync(req.SenderId);
            var pushBody = req.PostId != null ? "📸 Shared a post"
                         : req.MediaUrl != null && string.IsNullOrEmpty(req.Text) ? "📷 Photo"
                         : req.Text;
            _ = SendExpoPushAsync(pushToken.Token, sender?.FullName ?? "Someone", pushBody);
        }

        return Ok(new
        {
            type               = "message",
            id                 = msg.Id,
            senderId           = msg.SenderId,
            text               = msg.Text,
            storyImageUrl      = msg.StoryImageUrl,
            mediaUrl           = msg.MediaUrl,
            postId             = msg.PostId,
            postImageUrl       = msg.PostImageUrl,
            postAuthorName     = msg.PostAuthorName,
            postAuthorAvatarUrl = msg.PostAuthorAvatarUrl,
            postCaption        = msg.PostCaption,
            isRead             = msg.IsRead,
            createdAt          = msg.CreatedAt,
        });
    }

    // DELETE /api/chats/messages/{id}?userId=
    [HttpDelete("messages/{id}")]
    public async Task<IActionResult> DeleteMessage(int id, [FromQuery] int userId)
    {
        var msg = await _context.Messages.FindAsync(id);
        if (msg == null) return NotFound();
        if (msg.SenderId != userId) return Forbid();
        _context.Messages.Remove(msg);
        await _context.SaveChangesAsync();
        return NoContent();
    }

    // PATCH /api/chats/messages/{id}
    [HttpPatch("messages/{id}")]
    public async Task<IActionResult> EditMessage(int id, [FromBody] EditMessageRequest req)
    {
        var msg = await _context.Messages.FindAsync(id);
        if (msg == null) return NotFound();
        if (msg.SenderId != req.UserId) return Forbid();
        msg.Text = req.Text;
        await _context.SaveChangesAsync();
        return Ok(new { id = msg.Id, text = msg.Text });
    }

    internal static async Task SendExpoPushAsync(string token, string title, string body)
    {
        try
        {
            using var http = new HttpClient();
            var payload = System.Text.Json.JsonSerializer.Serialize(new
            {
                to    = token,
                title = title,
                body  = body.Length > 100 ? body[..100] + "…" : body,
                sound = "default",
                data  = new { type = "message" },
            });
            await http.PostAsync(
                "https://exp.host/--/api/v2/push/send",
                new StringContent(payload, System.Text.Encoding.UTF8, "application/json"));
        }
        catch { }
    }
}

public class SendMessageRequest
{
    public int SenderId { get; set; }
    public int ReceiverId { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? StoryImageUrl { get; set; }
    public string? MediaUrl { get; set; }
    public int? PostId { get; set; }
    public string? PostImageUrl { get; set; }
    public string? PostAuthorName { get; set; }
    public string? PostAuthorAvatarUrl { get; set; }
    public string? PostCaption { get; set; }
}

public class EditMessageRequest
{
    public int UserId { get; set; }
    public string Text { get; set; } = string.Empty;
}
