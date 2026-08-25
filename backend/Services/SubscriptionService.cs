using Ledger.API.Data;
using Ledger.API.DTOs;
using Ledger.API.Models;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Services;

public interface ISubscriptionService
{
    Task<List<SubscriptionDto>> GetSubscriptionsAsync(Guid userId);
}

/// <summary>
/// Detects subscriptions by finding merchants that appear 2+ times across multiple months.
/// This is the pattern-based detection decided during planning:
/// "if same merchant appears 2-3 times across 3-6 months of history = subscription"
/// </summary>
public class SubscriptionService(AppDbContext db) : ISubscriptionService
{
    public async Task<List<SubscriptionDto>> GetSubscriptionsAsync(Guid userId)
    {
        var transactions = await db.Transactions
            .Where(t => t.UserId == userId &&
                        t.Category == TransactionCategory.Subscriptions)
            .OrderBy(t => t.Date)
            .ToListAsync();

        // Group by normalized merchant name
        var grouped = transactions
            .GroupBy(t => NormalizeMerchant(t.Description))
            .Where(g => g.Count() >= 2)  // must appear 2+ times = recurring
            .ToList();

        var result = new List<SubscriptionDto>();

        foreach (var group in grouped)
        {
            var items    = group.OrderByDescending(t => t.Date).ToList();
            var latest   = items.First();
            var prev     = items.Skip(1).First();

            // Detect if price went up
            var latestAmt = Math.Abs(latest.Amount);
            var prevAmt   = Math.Abs(prev.Amount);
            var status    = latestAmt > prevAmt ? "up" : "flat";

            // Mark unused: no transaction in the last 45 days
            var daysSinceLast = (DateTime.UtcNow - latest.Date.ToDateTime(TimeOnly.MinValue)).TotalDays;
            if (daysSinceLast > 45) status = "unused";

            result.Add(new SubscriptionDto(
                Merchant:   group.Key,
                Amount:     latestAmt,
                RenewalDay: latest.Date.Day,
                Status:     status
            ));
        }

        return result.OrderByDescending(s => s.Amount).ToList();
    }

    private static string NormalizeMerchant(string desc) =>
        desc.ToLower().Trim().Split(' ')[0]; // simple normalization: first word
}

public interface IInsightService
{
    Task<InsightsResponse> GetInsightsAsync(Guid userId);
}

public class InsightService(AppDbContext db, IAiService ai) : IInsightService
{
    public async Task<InsightsResponse> GetInsightsAsync(Guid userId)
    {
        var now        = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(now.Year, now.Month, 1);
        var threeMonthsAgo = monthStart.AddMonths(-3);

        var transactions = await db.Transactions
            .Where(t => t.UserId == userId && t.Date >= threeMonthsAgo)
            .OrderByDescending(t => t.Date)
            .ToListAsync();

        // Build compact context for Claude (avoid sending too many tokens)
        var context = string.Join("\n", transactions.Select(t =>
            $"{t.Date:yyyy-MM-dd}|{t.Description}|{t.Amount:F2}|{t.Category}"));

        return await ai.GenerateInsightsAsync(context);
    }
}
