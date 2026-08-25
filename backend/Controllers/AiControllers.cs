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
public class SubscriptionsController(ISubscriptionService subService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Get detected subscriptions for the current user.
    /// A subscription is any merchant in the Subscriptions category that appears 2+ times across multiple months.
    /// Status: flat | up (price increased) | unused (no activity in 45+ days).
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(List<SubscriptionDto>), 200)]
    public async Task<IActionResult> GetSubscriptions()
    {
        var result = await subService.GetSubscriptionsAsync(UserId);
        return Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class InsightsController(IInsightService insightService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Generate AI-powered insights from the last 3 months of the user's transaction data.
    /// Powered by Claude via Azure AI Foundry — data scoped strictly to the current user.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(InsightsResponse), 200)]
    public async Task<IActionResult> GetInsights()
    {
        var result = await insightService.GetInsightsAsync(UserId);
        return Ok(result);
    }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
[Produces("application/json")]
public class AskController(IAiService ai, ITransactionService txnService) : ControllerBase
{
    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? User.FindFirstValue("sub")!);

    /// <summary>
    /// Ask a natural-language question about your spending.
    /// The API fetches only YOUR transactions, passes them to Claude, and returns a factual answer.
    /// Claude never has access to other users' data.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(AskResponse), 200)]
    [ProducesResponseType(400)]
    public async Task<IActionResult> Ask([FromBody] AskRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.Question))
            return BadRequest(new { message = "Question cannot be empty." });

        // Fetch user's recent transactions as context
        var transactions = await txnService.GetAllAsync(UserId, null, null);
        var context = string.Join("\n", transactions.Take(200).Select(t =>
            $"{t.Date:yyyy-MM-dd}|{t.Description}|{t.Amount:F2}|{t.Category}"));

        var answer = await ai.AskAsync(req.Question, context);
        return Ok(new AskResponse(answer));
    }
}
