using System.Security.Claims;
using Ledger.API.Data;
using Ledger.API.DTOs;
using Ledger.API.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Ledger.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class StatementsController(IStatementService statementService, AppDbContext db) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// List all statements uploaded by the current user, with transaction counts.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<StatementSummaryDto>), 200)]
    public async Task<IActionResult> GetStatements()
    {
        var statements = await db.Statements
            .Where(s => s.UserId == UserId)
            .OrderByDescending(s => s.UploadedAt)
            .Select(s => new StatementSummaryDto(
                s.Id,
                s.FileName,
                s.UploadedAt,
                s.DateRangeStart,
                s.DateRangeEnd,
                s.Transactions.Count
            ))
            .ToListAsync();

        return Ok(statements);
    }

    [HttpPost("upload")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(UploadResponse), 200)]
    [ProducesResponseType(400)]
    [ProducesResponseType(422)]
    public async Task<IActionResult> Upload(IFormFile file)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { message = "No file provided." });

        if (!file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "Only PDF files are supported in v1." });

        if (file.Length > 20 * 1024 * 1024) // 20MB limit
            return BadRequest(new { message = "File exceeds the 20MB size limit." });

        try
        {
            var result = await statementService.ParseAndPreviewAsync(UserId, file);
            return Ok(result);
        }
        catch (InvalidOperationException ex)
        {
            return UnprocessableEntity(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Confirm and save user-reviewed transactions to the database.
    /// This is the second step after /upload — the user corrects any parsing errors first.
    /// </summary>
    [HttpPost("confirm")]
    [ProducesResponseType(typeof(object), 200)]
    [ProducesResponseType(404)]
    public async Task<IActionResult> Confirm([FromBody] ConfirmStatementRequest req)
    {
        try
        {
            var count = await statementService.ConfirmAndSaveAsync(UserId, req);
            return Ok(new { message = $"Saved {count} transactions successfully.", count });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}
