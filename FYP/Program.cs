using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using SmartFashion.Api.Data;
using SmartFashion.Api.Services;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite(
        builder.Configuration.GetConnectionString("Default")
    );
});

builder.Services.AddScoped<JwtTokenService>();
builder.Services.AddScoped<IEmailService, SmtpEmailService>();

var jwtKey = builder.Configuration["Jwt:Key"]!;
var issuer = builder.Configuration["Jwt:Issuer"]!;
var audience = builder.Configuration["Jwt:Audience"]!;

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = issuer,

            ValidateAudience = true,
            ValidAudience = audience,

            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey)
            ),

            ValidateLifetime = true
        };
    });

builder.Services.AddAuthorization();

builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactNative", policy =>
    {
        policy
            .AllowAnyOrigin()
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});
builder.Services.AddHttpClient();
// The default HttpClient.Timeout is 100s — fine for most calls, but a
// try-on generation can run 30 inference steps (or two chained passes for
// "top + bottom" mode) and legitimately take longer than that on a slower
// GPU. A dedicated longer-timeout client for just that call avoids the
// backend aborting a still-in-progress AI request.
builder.Services.AddHttpClient("AiBackend", client => client.Timeout = TimeSpan.FromMinutes(5));
builder.Services.AddMemoryCache();

var app = builder.Build();

// Apply SQLite performance PRAGMAs on every new connection via the connection pool.
// WAL lets reads proceed without blocking writes; the rest reduce unnecessary fsyncs.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.Migrate();
    db.Database.ExecuteSqlRaw("PRAGMA journal_mode = WAL;");
    db.Database.ExecuteSqlRaw("PRAGMA synchronous  = NORMAL;");
    db.Database.ExecuteSqlRaw("PRAGMA cache_size   = -16000;"); // 16 MB page cache
    db.Database.ExecuteSqlRaw("PRAGMA temp_store   = MEMORY;");
    db.Database.ExecuteSqlRaw("PRAGMA foreign_keys = ON;");
    db.Database.ExecuteSqlRaw("PRAGMA mmap_size    = 134217728;"); // 128 MB memory-mapped I/O
}

app.UseCors("AllowReactNative");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();