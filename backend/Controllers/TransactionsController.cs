using System.Security.Claims;
using Ledger.API.DTOs;
using Ledger.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Ledger.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class TransactionsController(ITransactionService txnService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>Get all transactions for the current user, with optional filtering.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<TransactionDto>), 200)]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? category,
        [FromQuery] string? search)
    {
        var result = await txnService.GetAllAsync(UserId, category, search);
        return Ok(result);
    }

    /// <summary>Manually create a single transaction.</summary>
    [HttpPost]
    [ProducesResponseType(typeof(TransactionDto), 201)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Create([FromBody] CreateTransactionRequest req)
    {
        var result = await txnService.CreateAsync(UserId, req);
        if (result is null)
            return BadRequest(new { message = $"Invalid category '{req.Category}'. Must be one of the 8 fixed categories." });

        return CreatedAtAction(nameof(GetAll), result);
    }

    /// <summary>Correct the category for a transaction (also updates merchant memory).</summary>
    [HttpPatch("{id:guid}/category")]
    [ProducesResponseType(204)]
    [ProducesResponseType(400)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> UpdateCategory(Guid id, [FromBody] UpdateCategoryRequest req)
    {
        var ok = await txnService.UpdateCategoryAsync(UserId, id, req.Category);
        if (!ok)
            return NotFound(new { message = "Transaction not found or invalid category." });

        return NoContent();
    }

    /// <summary>Delete a transaction.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(204)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Delete(Guid id)
    {
        var ok = await txnService.DeleteAsync(UserId, id);
        return ok ? NoContent() : NotFound();
    }
}
