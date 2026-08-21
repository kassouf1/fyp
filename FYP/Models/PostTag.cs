namespace SmartFashion.Api.Models;

public class PostTag
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public int TaggedUserId { get; set; }

    public Post? Post { get; set; }
    public User? TaggedUser { get; set; }
}
