using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development-only mock AI service.
/// Used when AzureFoundry credentials are not yet configured.
/// Swap out in Day 5 by setting real AzureFoundry:Endpoint + ApiKey in appsettings.json.
/// </summary>
public class MockAiService : IAiService
{
    private static readonly Random _rng = new();

    private static readonly string[] Merchants =
    [
        "Whole Foods Market", "Uber", "Netflix", "Trader Joe's",
        "Local Coffee Co.", "Shell Gas Station", "Chipotle", "Amazon",
        "Spotify", "Rent — Meridian Apts", "CVS Pharmacy", "Target",
        "Delta Airlines", "Gym Membership", "Adobe Creative Cloud"
    ];

    private static readonly (string merchant, string category, decimal amount)[] KnownTxns =
    [
        ("Whole Foods Market",    "Groceries",      -86.42m),
        ("Uber",                  "Transportation", -18.20m),
        ("Netflix",               "Subscriptions",  -15.49m),
        ("Trader Joe's",          "Groceries",      -52.10m),
        ("Local Coffee Co.",      "Dining",          -6.75m),
        ("Shell Gas Station",     "Transportation", -44.00m),
        ("Chipotle",              "Dining",         -14.35m),
        ("Amazon",                "Shopping",       -67.99m),
        ("Spotify",               "Subscriptions",  -10.99m),
        ("Rent — Meridian Apts",  "Housing",      -1450.00m),
        ("CVS Pharmacy",          "Shopping",       -23.50m),
        ("Target",                "Shopping",       -89.45m),
        ("Gym Membership",        "Subscriptions",  -39.00m),
        ("Adobe Creative Cloud",  "Subscriptions",  -54.99m),
    ];

    public Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        // Generate realistic mock transactions spread across the current month
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var results = new List<ParsedTransactionDto>();
        var shuffled = KnownTxns.OrderBy(_ => _rng.Next()).Take(10).ToList();

        for (int i = 0; i < shuffled.Count; i++)
        {
            var (merchant, category, amount) = shuffled[i];

            // Check if user has a known mapping for this merchant
            var normalizedKey = merchant.ToLower().Trim();
            if (knownMerchants.TryGetValue(normalizedKey, out var knownCat))
                category = knownCat;

            results.Add(new ParsedTransactionDto(
                Date:        today.AddDays(-(i * 2)),
                Description: merchant,
                Amount:      amount,
                Category:    category
            ));
        }

        return Task.FromResult(results);
    }

    public Task<string> AskAsync(string question, string transactionContext)
    {
        var q = question.ToLower();
        string answer = q switch
        {
            var s when s.Contains("dining")       => "Your dining spend this month is $412.00 — up 22% from your 3-month average. [Mock AI response — connect Azure Foundry for real answers]",
            var s when s.Contains("budget")       => "You've spent $3,214.62 of your $4,000 budget — $785.38 remaining. [Mock AI response]",
            var s when s.Contains("subscri")      => "You have 7 active subscriptions totalling $142.45/month. [Mock AI response]",
            var s when s.Contains("biggest")      => "Your biggest expenses: Housing $1,450 · Dining $412 · Shopping $305. [Mock AI response]",
            _                                     => "I can answer questions about your spending. [Mock AI — connect Azure Foundry for real answers]"
        };
        return Task.FromResult(answer);
    }

    public Task<InsightsResponse> GenerateInsightsAsync(string transactionContext)
    {
        var response = new InsightsResponse(
            ProjectedMonthEnd:    4120m,
            DiningVsAvgPercent:   22m,
            UnusedSubscriptions:  1,
            Bullets: [
                new("red",   "Dining spend is up 22% versus your 3-month average — mostly weekday lunches. [Mock]"),
                new("red",   "Gym Membership ($39/mo) has had no matching check-in activity in 45 days. [Mock]"),
                new("green", "Groceries are down 9% this month, in line with fewer takeout orders. [Mock]"),
                new("blue",  "At the current pace, you're projected to end the month $120 over budget. [Mock]"),
                new("blue",  "Transportation spend has stayed flat for three consecutive months. [Mock]"),
            ]
        );
        return Task.FromResult(response);
    }
}
