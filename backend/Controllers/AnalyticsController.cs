using System.Globalization;
using System.Security.Claims;
using Ledger.API.Data;
using Ledger.API.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class AnalyticsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Returns monthly income vs expense totals and per-category spending per month
    /// for the current user's full transaction history (up to last 12 months).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(AnalyticsResponse), 200)]
    public async Task<IActionResult> GetAnalytics()
    {
        var cutoff = DateOnly.FromDateTime(DateTime.UtcNow).AddMonths(-12);

        var transactions = await db.Transactions
            .Where(t => t.UserId == UserId && t.Date >= cutoff)
            .Select(t => new { t.Date, t.Amount, t.Category })
            .ToListAsync();

        if (transactions.Count == 0)
            return Ok(new AnalyticsResponse([], []));

        // ── Group by year-month ──────────────────────────────────
        var byMonth = transactions
            .GroupBy(t => new { t.Date.Year, t.Date.Month })
            .OrderBy(g => g.Key.Year).ThenBy(g => g.Key.Month)
            .ToList();

        // ── Monthly totals (income = positive amounts, expenses = negative) ──
        var monthlyTotals = byMonth.Select(g =>
        {
            var monthKey = $"{g.Key.Year:D4}-{g.Key.Month:D2}";
            var label    = new DateOnly(g.Key.Year, g.Key.Month, 1)
                               .ToString("MMM yyyy", CultureInfo.InvariantCulture);
            var expenses = g.Where(t => t.Amount < 0).Sum(t => Math.Abs(t.Amount));
            var income   = g.Where(t => t.Amount > 0).Sum(t => t.Amount);
            return new MonthlyTotalDto(monthKey, label, expenses, income);
        }).ToList();

        // ── Category breakdown per month ────────────────────────
        var categoryByMonth = byMonth
            .SelectMany(g =>
            {
                var monthKey = $"{g.Key.Year:D4}-{g.Key.Month:D2}";
                return g
                    .Where(t => t.Amount < 0)             // expenses only
                    .GroupBy(t => t.Category)
                    .Select(cg => new CategoryMonthDto(
                        monthKey,
                        cg.Key,
                        Math.Abs(cg.Sum(t => t.Amount))
                    ));
            })
            .OrderBy(c => c.Month)
            .ThenByDescending(c => c.Amount)
            .ToList();

        return Ok(new AnalyticsResponse(monthlyTotals, categoryByMonth));
    }
}
