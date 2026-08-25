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
public class DashboardController(ITransactionService txnService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>Get dashboard summary: totals, category spend, and recent transactions.</summary>
    [HttpGet]
    [ProducesResponseType(typeof(DashboardResponse), 200)]
    public async Task<IActionResult> GetDashboard()
    {
        var data = await txnService.GetDashboardAsync(UserId);
        return Ok(data);
    }
}
