using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FYP.Migrations
{
    public partial class AddBlocksAndMessageRequests : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Blocks",
                columns: table => new
                {
                    Id        = table.Column<int>(type: "INTEGER", nullable: false)
                                    .Annotation("Sqlite:Autoincrement", true),
                    BlockerId = table.Column<int>(type: "INTEGER", nullable: false),
                    BlockedId = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Blocks", x => x.Id);
                    table.ForeignKey("FK_Blocks_Users_BlockerId", x => x.BlockerId, "Users", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_Blocks_Users_BlockedId", x => x.BlockedId, "Users", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(name: "IX_Blocks_BlockedId",  table: "Blocks", column: "BlockedId");
            migrationBuilder.CreateIndex(name: "IX_Blocks_BlockerId_BlockedId", table: "Blocks", columns: new[] { "BlockerId", "BlockedId" }, unique: true);

            migrationBuilder.CreateTable(
                name: "MessageRequests",
                columns: table => new
                {
                    Id          = table.Column<int>(type: "INTEGER", nullable: false)
                                       .Annotation("Sqlite:Autoincrement", true),
                    SenderId    = table.Column<int>(type: "INTEGER", nullable: false),
                    ReceiverId  = table.Column<int>(type: "INTEGER", nullable: false),
                    MessageText = table.Column<string>(type: "TEXT", nullable: false),
                    MediaUrl    = table.Column<string>(type: "TEXT", nullable: true),
                    Status      = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt   = table.Column<DateTime>(type: "TEXT", nullable: false),
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MessageRequests", x => x.Id);
                    table.ForeignKey("FK_MessageRequests_Users_SenderId",   x => x.SenderId,   "Users", "Id", onDelete: ReferentialAction.Restrict);
                    table.ForeignKey("FK_MessageRequests_Users_ReceiverId", x => x.ReceiverId, "Users", "Id", onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(name: "IX_MessageRequests_ReceiverId",              table: "MessageRequests", column: "ReceiverId");
            migrationBuilder.CreateIndex(name: "IX_MessageRequests_SenderId_ReceiverId",     table: "MessageRequests", columns: new[] { "SenderId", "ReceiverId" }, unique: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "MessageRequests");
            migrationBuilder.DropTable(name: "Blocks");
        }
    }
}
