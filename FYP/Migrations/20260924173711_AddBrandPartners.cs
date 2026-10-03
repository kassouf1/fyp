using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FYP.Migrations
{
    /// <inheritdoc />
    public partial class AddBrandPartners : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BrandPartners",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BrandName = table.Column<string>(type: "TEXT", nullable: false),
                    ContactEmail = table.Column<string>(type: "TEXT", nullable: false),
                    ApiBaseUrl = table.Column<string>(type: "TEXT", nullable: false),
                    ApiKey = table.Column<string>(type: "TEXT", nullable: true),
                    Category = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    LastError = table.Column<string>(type: "TEXT", nullable: true),
                    ProductCount = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastSyncedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BrandPartners", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "BrandCatalogItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BrandPartnerId = table.Column<int>(type: "INTEGER", nullable: false),
                    ExternalId = table.Column<string>(type: "TEXT", nullable: false),
                    Title = table.Column<string>(type: "TEXT", nullable: false),
                    Price = table.Column<double>(type: "REAL", nullable: false),
                    ImageUrl = table.Column<string>(type: "TEXT", nullable: false),
                    Category = table.Column<string>(type: "TEXT", nullable: false),
                    Gender = table.Column<string>(type: "TEXT", nullable: true),
                    Color = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BrandCatalogItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BrandCatalogItems_BrandPartners_BrandPartnerId",
                        column: x => x.BrandPartnerId,
                        principalTable: "BrandPartners",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BrandCatalogItems_BrandPartnerId",
                table: "BrandCatalogItems",
                column: "BrandPartnerId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BrandCatalogItems");

            migrationBuilder.DropTable(
                name: "BrandPartners");
        }
    }
}
