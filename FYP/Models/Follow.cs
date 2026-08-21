namespace SmartFashion.Api.Models;

public class Follow
{
    public int Id { get; set; }
    public int FollowerId { get; set; }
    public int FollowingId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User? Follower { get; set; }
    public User? Following { get; set; }
}
