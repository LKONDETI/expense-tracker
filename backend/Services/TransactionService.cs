using Ledger.API.Data;
using Ledger.API.DTOs;
using Ledger.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Services;

public interface ITransactionService
{
    Task<List<TransactionDto>> GetAllAsync(Guid userId, string? category, string? search);
    Task<TransactionDto?> CreateAsync(Guid userId, CreateTransactionRequest req);
    Task<bool> UpdateCategoryAsync(Guid userId, Guid transactionId, string category);
    Task<bool> DeleteAsync(Guid userId, Guid transactionId);
    Task<DashboardResponse> GetDashboardAsync(Guid userId);
}

public class TransactionService(AppDbContext db) : ITransactionService
{
    public async Task<List<TransactionDto>> GetAllAsync(Guid userId, string? category, string? search)
    {
        var query = db.Transactions
            .Where(t => t.UserId == userId)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(category) && category != "All")
            query = query.Where(t => t.Category == category);

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(t =>
                t.Description.ToLower().Contains(search.ToLower()) ||
                t.Category.ToLower().Contains(search.ToLower()));

        return await query
            .OrderByDescending(t => t.Date)
            .Select(t => new TransactionDto(t.Id, t.Date, t.Description, t.Amount, t.Category))
            .ToListAsync();
    }

    public async Task<TransactionDto?> CreateAsync(Guid userId, CreateTransactionRequest req)
    {
        if (!TransactionCategory.All.Contains(req.Category))
            return null;

        var txn = new Transaction
        {
            UserId      = userId,
            Date        = req.Date,
            Description = req.Description,
            Amount      = req.Amount,
            Category    = req.Category,
        };

        db.Transactions.Add(txn);
        await db.SaveChangesAsync();

        return new TransactionDto(txn.Id, txn.Date, txn.Description, txn.Amount, txn.Category);
    }

    public async Task<bool> UpdateCategoryAsync(Guid userId, Guid transactionId, string category)
    {
        var txn = await db.Transactions
            .FirstOrDefaultAsync(t => t.Id == transactionId && t.UserId == userId);

        if (txn is null || !TransactionCategory.All.Contains(category))
            return false;

        txn.Category = category;

        // Remember the correction in merchant_category_map
        var normalized = txn.Description.ToLower().Trim();
        var existing   = await db.MerchantCategoryMaps
            .FirstOrDefaultAsync(m => m.UserId == userId && m.MerchantPattern == normalized);

        if (existing is null)
            db.MerchantCategoryMaps.Add(new MerchantCategoryMap
            {
                UserId          = userId,
                MerchantPattern = normalized,
                Category        = category,
            });
        else
        {
            existing.Category  = category;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return true;
    }

    public async Task<bool> DeleteAsync(Guid userId, Guid transactionId)
    {
        var txn = await db.Transactions
            .FirstOrDefaultAsync(t => t.Id == transactionId && t.UserId == userId);

        if (txn is null) return false;

        db.Transactions.Remove(txn);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<DashboardResponse> GetDashboardAsync(Guid userId)
    {
        var now       = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(now.Year, now.Month, 1);
        var prevStart  = monthStart.AddMonths(-1);

        var thisMonth = await db.Transactions
            .Where(t => t.UserId == userId && t.Date >= monthStart)
            .ToListAsync();

        var prevMonth = await db.Transactions
            .Where(t => t.UserId == userId && t.Date >= prevStart && t.Date < monthStart)
            .ToListAsync();

        var user = await db.Users
            .Include(u => u.CategoryBudgets)
            .FirstAsync(u => u.Id == userId);

        var totalSpent  = thisMonth.Sum(t => Math.Abs(t.Amount));
        var prevSpent   = prevMonth.Sum(t => Math.Abs(t.Amount));
        var subTotal    = thisMonth.Where(t => t.Category == TransactionCategory.Subscriptions).Sum(t => Math.Abs(t.Amount));
        var activeSubs  = thisMonth.Where(t => t.Category == TransactionCategory.Subscriptions)
                                   .Select(t => t.Description).Distinct().Count();
        var budget      = user.MonthlyBudget;
        var leftBudget  = budget.HasValue ? budget.Value - totalSpent : 0m;

        var spendByCat = TransactionCategory.All
            .Select(cat => new CategorySpendDto(
                cat,
                thisMonth.Where(t => t.Category == cat).Sum(t => Math.Abs(t.Amount))
            ))
            .Where(c => c.Amount > 0)
            .OrderByDescending(c => c.Amount)
            .ToList();

        var recent = thisMonth
            .OrderByDescending(t => t.Date)
            .Take(5)
            .Select(t => new TransactionDto(t.Id, t.Date, t.Description, t.Amount, t.Category))
            .ToList();

        return new DashboardResponse(
            totalSpent, prevSpent, subTotal, activeSubs,
            budget, leftBudget, spendByCat, recent
        );
    }
}
