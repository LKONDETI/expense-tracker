using System.Text.RegularExpressions;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development AI service used when AzureFoundry credentials are not configured.
/// Unlike the old stub, this actually READS the PDF text and extracts real transactions
/// using regex patterns common to US bank statements (Chase, BofA, Wells Fargo, etc.).
/// Categorization is done via keyword matching instead of Claude.
/// Switch to AzureFoundryService on Day 5 by adding real credentials in appsettings.json.
/// </summary>
public class MockAiService : IAiService
{
    // ── Transaction line patterns ─────────────────────────────
    // Covers most US bank statement formats:
    //   01/15  STARBUCKS #1234 SEATTLE WA          -5.75
    //   01/15/2024  AMAZON.COM*1A2B3C4             67.99
    //   2024-01-15   NETFLIX.COM                   15.49
    private static readonly Regex[] TxnPatterns =
    [
        // MM/DD or MM/DD/YYYY or MM/DD/YY  then description  then amount (with optional minus/credit)
        new Regex(
            @"^(?<date>\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\s+(?<desc>[A-Za-z0-9* &'.#,\-/]+?)\s+(?<amount>-?\$?[\d,]+\.\d{2})",
            RegexOptions.Multiline | RegexOptions.Compiled),

        // YYYY-MM-DD ISO format
        new Regex(
            @"^(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2})\s+(?<desc>[A-Za-z0-9* &'.#,\-/]+?)\s+(?<amount>-?\$?[\d,]+\.\d{2})",
            RegexOptions.Multiline | RegexOptions.Compiled),

        // Date at end: description  amount  MM/DD
        new Regex(
            @"^(?<desc>[A-Za-z][A-Za-z0-9* &'.#,\-/]{5,50}?)\s+(?<amount>-?\$?[\d,]+\.\d{2})\s+(?<date>\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)",
            RegexOptions.Multiline | RegexOptions.Compiled),
    ];

    // ── Keyword → Category mapping ────────────────────────────
    private static readonly (string[] keywords, string category)[] CategoryRules =
    [
        (["rent", "mortgage", "lease", "hoa", "property"], "Housing"),
        (["restaurant", "cafe", "coffee", "pizza", "burger", "sushi", "taco", "diner",
          "mcdonald", "starbucks", "chipotle", "subway", "doordash", "ubereats",
          "grubhub", "seamless", "postmates", "dining", "eatery", "bistro", "grill",
          "kitchen", "food", "bakery", "deli", "bar ", " pub", "brewery"], "Dining"),
        (["grocery", "groceries", "whole foods", "trader joe", "safeway", "kroger",
          "publix", "aldi", "heb", "wegmans", "sprouts", "market", "supermarket",
          "costco", "sam's club", "bj's"], "Groceries"),
        (["uber", "lyft", "taxi", "transit", "metro", "bart", "mta", "amtrak",
          "delta", "united", "american air", "southwest", "jetblue", "spirit",
          "gas", "shell", "exxon", "chevron", "bp ", "sunoco", "speedway",
          "parking", "toll", "zipcar", "enterprise", "hertz", "avis"], "Transportation"),
        (["netflix", "spotify", "hulu", "disney", "apple.com/bill", "amazon prime",
          "hbo", "peacock", "paramount", "youtube premium", "pandora", "tidal",
          "adobe", "microsoft 365", "dropbox", "icloud", "google one",
          "gym", "fitness", "planet fitness", "equinox", "membership", "subscription"], "Subscriptions"),
        (["amazon", "walmart", "target", "best buy", "apple store", "ebay",
          "etsy", "wayfair", "home depot", "lowe's", "ikea", "zara", "h&m",
          "gap", "nike", "adidas", "nordstrom", "macy's", "tj maxx", "marshalls",
          "shopify", "purchase", "order"], "Shopping"),
        (["insurance", "geico", "progressive", "allstate", "state farm",
          "blue cross", "aetna", "cigna", "humana", "kaiser",
          "usaa", "metlife", "nationwide"], "Insurance"),
    ];

    // ── Extract transactions from real PDF text ───────────────
    public Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        var results = new List<ParsedTransactionDto>();

        if (!string.IsNullOrWhiteSpace(pdfText))
        {
            // Try each pattern until we get results
            foreach (var pattern in TxnPatterns)
            {
                var matches = pattern.Matches(pdfText);
                foreach (Match m in matches)
                {
                    if (!TryParseDate(m.Groups["date"].Value, out var date)) continue;
                    if (!TryParseAmount(m.Groups["amount"].Value, out var amount)) continue;

                    var desc = CleanDescription(m.Groups["desc"].Value);
                    if (desc.Length < 3) continue;

                    // Skip duplicate (same date + desc + amount)
                    if (results.Any(r => r.Date == date && r.Description == desc && r.Amount == amount))
                        continue;

                    // Known merchant mapping takes priority
                    var category = ResolveCategory(desc, knownMerchants);

                    results.Add(new ParsedTransactionDto(date, desc, amount, category));
                }

                // Use first pattern that gives at least 2 results
                if (results.Count >= 2) break;
            }
        }

        // Fallback: if regex found nothing (scanned image / unusual format)
        // return a clearly-labelled placeholder so the user knows why it's empty
        if (results.Count == 0)
        {
            results.Add(new ParsedTransactionDto(
                DateOnly.FromDateTime(DateTime.UtcNow),
                "⚠️ Could not parse PDF — connect Azure Foundry for AI extraction",
                0m,
                "Other"
            ));
        }

        // Sort by date descending
        results = [.. results.OrderByDescending(r => r.Date)];
        return Task.FromResult(results);
    }

    // ── Ask / Insights (still mocked — needs Azure Foundry) ───
    public Task<string> AskAsync(string question, string transactionContext)
    {
        var q = question.ToLower();
        string answer = q switch
        {
            var s when s.Contains("dining")  => "I can see your dining transactions. Connect Azure Foundry for AI-powered answers about your spending patterns.",
            var s when s.Contains("budget")  => "Budget analysis requires Azure Foundry to be connected. Set your budget in Settings to track progress.",
            var s when s.Contains("subscri") => "Connect Azure Foundry to get intelligent subscription analysis and unused subscription detection.",
            _                                => "Connect Azure Foundry (Claude) in appsettings.json to get real AI-powered answers about your spending."
        };
        return Task.FromResult(answer);
    }

    public Task<InsightsResponse> GenerateInsightsAsync(string transactionContext)
    {
        var response = new InsightsResponse(
            ProjectedMonthEnd:   0m,
            DiningVsAvgPercent:  0m,
            UnusedSubscriptions: 0,
            Bullets: [
                new("blue", "Connect Azure Foundry to get real AI-powered spending insights from Claude."),
            ]
        );
        return Task.FromResult(response);
    }

    // ── Helpers ───────────────────────────────────────────────
    private static bool TryParseDate(string raw, out DateOnly date)
    {
        date = default;
        raw = raw.Trim().Replace("-", "/");

        // Try common formats
        string[] formats = ["M/d/yyyy", "M/d/yy", "M/d", "yyyy/M/d"];
        foreach (var fmt in formats)
        {
            if (DateOnly.TryParseExact(raw, fmt,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out date))
            {
                // If year is missing (M/d format), use current year
                if (date.Year == 1) date = new DateOnly(DateTime.UtcNow.Year, date.Month, date.Day);
                return true;
            }
        }
        return false;
    }

    private static bool TryParseAmount(string raw, out decimal amount)
    {
        amount = 0;
        raw = raw.Trim().Replace("$", "").Replace(",", "");
        if (!decimal.TryParse(raw, out amount)) return false;
        // Treat positive amounts as debits (expenses) — negate them
        if (amount > 0) amount = -amount;
        return true;
    }

    private static string CleanDescription(string raw)
    {
        // Remove extra whitespace, card numbers, reference codes (4+ digit sequences at end)
        raw = Regex.Replace(raw.Trim(), @"\s{2,}", " ");
        raw = Regex.Replace(raw, @"\s+\d{4,}\s*$", "");
        raw = Regex.Replace(raw, @"#\d+", "").Trim();
        return raw.Length > 60 ? raw[..60] : raw;
    }

    private static string ResolveCategory(string desc, Dictionary<string, string> knownMerchants)
    {
        // 1. Check user's saved merchant mappings first
        var descLower = desc.ToLower();
        foreach (var (pattern, cat) in knownMerchants)
            if (descLower.Contains(pattern.ToLower())) return cat;

        // 2. Keyword matching
        foreach (var (keywords, category) in CategoryRules)
            if (keywords.Any(kw => descLower.Contains(kw))) return category;

        return "Other";
    }
}
