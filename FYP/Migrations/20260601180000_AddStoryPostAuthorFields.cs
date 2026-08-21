using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FYP.Migrations
{
    public partial class AddStoryPostAuthorFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "PostAuthorName",      table: "Stories", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<string>(name: "PostAuthorAvatarUrl", table: "Stories", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<string>(name: "PostCaption",         table: "Stories", type: "TEXT", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PostAuthorName",      table: "Stories");
            migrationBuilder.DropColumn(name: "PostAuthorAvatarUrl", table: "Stories");
            migrationBuilder.DropColumn(name: "PostCaption",         table: "Stories");
        }
    }
}
