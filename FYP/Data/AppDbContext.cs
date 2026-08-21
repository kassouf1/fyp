using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using SmartFashion.Api.Models;

namespace SmartFashion.Api.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<TryOnHistory> TryOnHistories => Set<TryOnHistory>();
    public DbSet<OutfitLike> OutfitLikes => Set<OutfitLike>();
    public DbSet<OutfitComment> OutfitComments => Set<OutfitComment>();
    public DbSet<OutfitFavorite> OutfitFavorites => Set<OutfitFavorite>();
    public DbSet<EmailVerificationCode> EmailVerificationCodes => Set<EmailVerificationCode>();
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Story> Stories => Set<Story>();
    public DbSet<StoryView> StoryViews => Set<StoryView>();
    public DbSet<StoryLike> StoryLikes => Set<StoryLike>();
    public DbSet<Follow> Follows => Set<Follow>();
    public DbSet<Like> Likes => Set<Like>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<UserPushToken> UserPushTokens => Set<UserPushToken>();
    public DbSet<PostTag> PostTags => Set<PostTag>();
    public DbSet<Block> Blocks => Set<Block>();
    public DbSet<MessageRequest> MessageRequests => Set<MessageRequest>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>()
            .HasIndex(u => u.Email)
            .IsUnique();

        modelBuilder.Entity<TryOnHistory>()
            .HasIndex(h => new { h.UserId, h.CreatedAt });

        modelBuilder.Entity<OutfitLike>()
            .HasIndex(l => new { l.UserId, l.TryOnHistoryId })
            .IsUnique();

        modelBuilder.Entity<OutfitComment>()
            .HasIndex(c => c.TryOnHistoryId);

        modelBuilder.Entity<OutfitFavorite>()
            .HasIndex(f => new { f.UserId, f.TryOnHistoryId })
            .IsUnique();

        modelBuilder.Entity<EmailVerificationCode>()
            .HasIndex(c => c.UserId);

        // Posts
        modelBuilder.Entity<Post>()
            .HasIndex(p => new { p.UserId, p.CreatedAt });

        // Stories — only active (non-expired) lookups
        modelBuilder.Entity<Story>()
            .HasIndex(s => new { s.UserId, s.ExpiresAt });

        // StoryView — unique: one view per viewer per story
        modelBuilder.Entity<StoryView>()
            .HasIndex(v => new { v.StoryId, v.ViewerId })
            .IsUnique();

        // StoryLike — unique: one like per user per story
        modelBuilder.Entity<StoryLike>()
            .HasIndex(l => new { l.StoryId, l.UserId })
            .IsUnique();

        // Follow — unique: one follow record per pair
        modelBuilder.Entity<Follow>()
            .HasIndex(f => new { f.FollowerId, f.FollowingId })
            .IsUnique();

        // Like — unique: one like per user per post
        modelBuilder.Entity<Like>()
            .HasIndex(l => new { l.UserId, l.PostId })
            .IsUnique();

        // Comments
        modelBuilder.Entity<Comment>()
            .HasIndex(c => c.PostId);

        // Messages — fast conversation lookup
        modelBuilder.Entity<Message>()
            .HasIndex(m => new { m.SenderId, m.ReceiverId, m.CreatedAt });

        // Notifications
        modelBuilder.Entity<Notification>()
            .HasIndex(n => new { n.UserId, n.CreatedAt });

        // Push tokens — one per user
        modelBuilder.Entity<UserPushToken>()
            .HasIndex(t => t.UserId)
            .IsUnique();

        // Post tags
        modelBuilder.Entity<PostTag>()
            .HasIndex(t => new { t.PostId, t.TaggedUserId })
            .IsUnique();

        // Block — unique: one block record per pair
        modelBuilder.Entity<Block>()
            .HasIndex(b => new { b.BlockerId, b.BlockedId })
            .IsUnique();

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocker)
            .WithMany()
            .HasForeignKey(b => b.BlockerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Block>()
            .HasOne(b => b.Blocked)
            .WithMany()
            .HasForeignKey(b => b.BlockedId)
            .OnDelete(DeleteBehavior.Restrict);

        // MessageRequest
        modelBuilder.Entity<MessageRequest>()
            .HasIndex(r => new { r.SenderId, r.ReceiverId })
            .IsUnique();

        modelBuilder.Entity<MessageRequest>()
            .HasOne(r => r.Sender)
            .WithMany()
            .HasForeignKey(r => r.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<MessageRequest>()
            .HasOne(r => r.Receiver)
            .WithMany()
            .HasForeignKey(r => r.ReceiverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<PostTag>()
            .HasOne(t => t.TaggedUser)
            .WithMany()
            .HasForeignKey(t => t.TaggedUserId)
            .OnDelete(DeleteBehavior.Restrict);

        // Prevent EF cascade delete cycles on self-referencing User navigation
        modelBuilder.Entity<Follow>()
            .HasOne(f => f.Follower)
            .WithMany()
            .HasForeignKey(f => f.FollowerId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Follow>()
            .HasOne(f => f.Following)
            .WithMany()
            .HasForeignKey(f => f.FollowingId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Sender)
            .WithMany()
            .HasForeignKey(m => m.SenderId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Message>()
            .HasOne(m => m.Receiver)
            .WithMany()
            .HasForeignKey(m => m.ReceiverId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.User)
            .WithMany()
            .HasForeignKey(n => n.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        modelBuilder.Entity<Notification>()
            .HasOne(n => n.Actor)
            .WithMany()
            .HasForeignKey(n => n.ActorId)
            .OnDelete(DeleteBehavior.Restrict);

        // SQLite drops timezone info — ensure all DateTime values round-trip as UTC
        var utcConverter = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
            foreach (var property in entityType.GetProperties())
                if (property.ClrType == typeof(DateTime))
                    property.SetValueConverter(utcConverter);

        base.OnModelCreating(modelBuilder);
    }
}
