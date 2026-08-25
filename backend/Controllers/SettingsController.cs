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
        var user = await db.Users
            .Include(u => u.CategoryBudgets)
            .FirstAsync(u => u.Id == UserId);

        user.MonthlyBudget = req.MonthlyBudget;

        foreach (var dto in req.CategoryBudgets)
        {
            var existing = user.CategoryBudgets.FirstOrDefault(b => b.Category == dto.Category);
            if (existing is null)
                user.CategoryBudgets.Add(new CategoryBudget
                {
                    UserId   = UserId,
                    Category = dto.Category,
                    Amount   = dto.Amount,
                });
            else
            {
                existing.Amount    = dto.Amount;
                existing.UpdatedAt = DateTime.UtcNow;
            }
        }

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
