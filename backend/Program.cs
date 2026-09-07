using System.Text;
using Ledger.API.Data;
using Ledger.API.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// ── Database ──────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("NeonDb")));

// ── CORS (allow React dev server + GitHub Pages) ──────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("LedgerPolicy", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",         // Vite dev server
                "https://localhost:5173",
                builder.Configuration["AllowedOrigins"] ?? "" // GitHub Pages URL in prod
            )
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

// ── JWT Authentication ────────────────────────────────────────
var jwtKey = builder.Configuration["Jwt:Key"]
    ?? throw new InvalidOperationException("Jwt:Key is not configured");

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = builder.Configuration["Jwt:Issuer"],
            ValidAudience            = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });

builder.Services.AddAuthorization();

// ── Application Services ─────────────────────────────────────
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<ITransactionService, TransactionService>();
builder.Services.AddScoped<IStatementService, StatementService>();
builder.Services.AddScoped<ISubscriptionService, SubscriptionService>();
builder.Services.AddScoped<IInsightService, InsightService>();
builder.Services.AddScoped<IAiService, AzureFoundryService>();

// ── Controllers ───────────────────────────────────────────────
builder.Services.AddControllers();

// ── Swagger / OpenAPI ─────────────────────────────────────────
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title       = "Ledger API",
        Version     = "v1",
        Description = "Backend API for the Ledger personal expense tracker. Handles PDF parsing, transaction management, AI-powered insights, and chat.",
    });

    // Add JWT Bearer input in Swagger UI
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header. Enter: Bearer {your-token}",
        Name        = "Authorization",
        In          = ParameterLocation.Header,
        Type        = SecuritySchemeType.ApiKey,
        Scheme      = "Bearer",
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id   = "Bearer",
                },
            },
            Array.Empty<string>()
        }
    });
});

// ── Http Client (for Azure Foundry) ──────────────────────────
builder.Services.AddHttpClient();

var app = builder.Build();

// ── Middleware Pipeline ───────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Ledger API v1");
        c.RoutePrefix = "swagger"; // http://localhost:5000/swagger
    });
}

app.UseCors("LedgerPolicy");
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// ── Auto-migrate on startup (dev only) ────────────────────────
// Skipped gracefully if Neon connection string is not yet configured.
// Set ConnectionStrings:NeonDb in appsettings.json before running.
if (app.Environment.IsDevelopment())
{
    var connString = builder.Configuration.GetConnectionString("NeonDb") ?? "";
    if (!connString.Contains("YOUR_") && !string.IsNullOrWhiteSpace(connString))
    {
        try
        {
            using var scope = app.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Database.MigrateAsync();
            Console.WriteLine("✅ Database migrated successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"⚠️  DB migration skipped: {ex.Message}");
        }
    }
    else
    {
        Console.WriteLine("⚠️  NeonDb connection string not configured — DB skipped. Swagger is still available.");
    }
}

app.Run();
