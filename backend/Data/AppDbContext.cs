using Ledger.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Statement> Statements => Set<Statement>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<MerchantCategoryMap> MerchantCategoryMaps => Set<MerchantCategoryMap>();
    public DbSet<CategoryBudget> CategoryBudgets => Set<CategoryBudget>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        // ── User ────────────────────────────────────────────────
        model.Entity<User>(e =>
        {
            e.HasKey(u => u.Id);
            e.HasIndex(u => u.Email).IsUnique();
            e.Property(u => u.MonthlyBudget).HasPrecision(10, 2);
        });

        // ── Statement ───────────────────────────────────────────
        model.Entity<Statement>(e =>
        {
            e.HasKey(s => s.Id);
            e.HasOne(s => s.User)
             .WithMany(u => u.Statements)
             .HasForeignKey(s => s.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Transaction ─────────────────────────────────────────
        model.Entity<Transaction>(e =>
        {
            e.HasKey(t => t.Id);
            e.Property(t => t.Amount).HasPrecision(10, 2);
            e.HasOne(t => t.User)
             .WithMany(u => u.Transactions)
             .HasForeignKey(t => t.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(t => t.Statement)
             .WithMany(s => s.Transactions)
             .HasForeignKey(t => t.StatementId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── MerchantCategoryMap ─────────────────────────────────
        model.Entity<MerchantCategoryMap>(e =>
        {
            e.HasKey(m => m.Id);
            e.HasIndex(m => new { m.UserId, m.MerchantPattern }).IsUnique();
            e.HasOne(m => m.User)
             .WithMany(u => u.MerchantMappings)
             .HasForeignKey(m => m.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── CategoryBudget ──────────────────────────────────────
        model.Entity<CategoryBudget>(e =>
        {
            e.HasKey(b => b.Id);
            e.Property(b => b.Amount).HasPrecision(10, 2);
            e.HasIndex(b => new { b.UserId, b.Category }).IsUnique();
            e.HasOne(b => b.User)
             .WithMany(u => u.CategoryBudgets)
             .HasForeignKey(b => b.UserId)
             .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
