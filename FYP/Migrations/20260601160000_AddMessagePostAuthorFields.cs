using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FYP.Migrations
{
    public partial class AddMessagePostAuthorFields : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(name: "PostAuthorName",      table: "Messages", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<string>(name: "PostAuthorAvatarUrl", table: "Messages", type: "TEXT", nullable: true);
            migrationBuilder.AddColumn<string>(name: "PostCaption",         table: "Messages", type: "TEXT", nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PostAuthorName",      table: "Messages");
            migrationBuilder.DropColumn(name: "PostAuthorAvatarUrl", table: "Messages");
            migrationBuilder.DropColumn(name: "PostCaption",         table: "Messages");
        }
    }
}
