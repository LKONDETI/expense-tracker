using System.Security.Claims;
using Ledger.API.Data;
using Ledger.API.DTOs;
using Ledger.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class SettingsController(AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>Get the current user's budget settings.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(SettingsResponse), 200)]
    public async Task<IActionResult> GetSettings()
    {
        var user = await db.Users
            .Include(u => u.CategoryBudgets)
            .FirstAsync(u => u.Id == UserId);

        var catBudgets = user.CategoryBudgets
            .Select(b => new CategoryBudgetDto(b.Category, b.Amount))
            .ToList();

        return Ok(new SettingsResponse(user.MonthlyBudget, catBudgets));
    }

    /// <summary>Save overall monthly budget and per-category budgets.</summary>
    [HttpPut]
    [ProducesResponseType(204)]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsRequest req)
    {
        // 1. Update overall monthly budget on the user row
        await db.Users
            .Where(u => u.Id == UserId)
            .ExecuteUpdateAsync(s => s.SetProperty(u => u.MonthlyBudget, req.MonthlyBudget));

        // 2. Load existing category budget IDs for this user
        var existing = await db.CategoryBudgets
            .Where(b => b.UserId == UserId)
            .ToListAsync();

        foreach (var dto in req.CategoryBudgets)
        {
            var match = existing.FirstOrDefault(b =>
                string.Equals(b.Category, dto.Category, StringComparison.OrdinalIgnoreCase));

            if (match is null)
            {
                // Insert — no concurrency token involved
                db.CategoryBudgets.Add(new CategoryBudget
                {
                    UserId   = UserId,
                    Category = dto.Category,
                    Amount   = dto.Amount,
                    UpdatedAt = DateTime.UtcNow,
                });
            }
            else
            {
                // Update directly via ExecuteUpdateAsync — bypasses change-tracker
                // and avoids the UpdatedAt concurrency mismatch entirely
                await db.CategoryBudgets
                    .Where(b => b.Id == match.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(b => b.Amount,    dto.Amount)
                        .SetProperty(b => b.UpdatedAt, DateTime.UtcNow));
            }
        }

        // Flush any inserts queued above
        await db.SaveChangesAsync();
        return NoContent();
    }

    /// <summary>Delete all of the current user's data (transactions, statements, mappings).</summary>
    [HttpDelete("data")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> DeleteAllData()
    {
        await db.Transactions.Where(t => t.UserId == UserId).ExecuteDeleteAsync();
        await db.Statements.Where(s => s.UserId == UserId).ExecuteDeleteAsync();
        await db.MerchantCategoryMaps.Where(m => m.UserId == UserId).ExecuteDeleteAsync();
        await db.CategoryBudgets.Where(b => b.UserId == UserId).ExecuteDeleteAsync();

        return NoContent();
    }
}
