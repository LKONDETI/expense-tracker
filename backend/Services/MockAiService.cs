using System.Text.RegularExpressions;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development AI service used when AzureFoundry credentials are not configured.
/// Reads PDF text and extracts transactions using regex patterns matching bank statements.
/// Categorization is done via keyword matching.
/// </summary>
public class MockAiService : IAiService
{
    private static readonly Regex[] LinePatterns =
    [
        // Pattern 1: ISO Date (YYYY-MM-DD or YYYY/MM/DD)
        // Format: 2026-06-01 Description ($12.34) $5,668.47
        new Regex(
            @"^\s*(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2})\s+(?<desc>.+?)\s+(?<amount>\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)(?:\s+\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)?\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // Pattern 2: US Date (MM/DD/YYYY or MM/DD/YY or MM/DD)
        // Format: 06/01/2026 Description ($12.34) $5,668.47
        new Regex(
            @"^\s*(?<date>\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\s+(?<desc>.+?)\s+(?<amount>\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)(?:\s+\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)?\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),

        // Pattern 3: Month Name Date (Jun 01, 2026 or Jun 1)
        // Format: Jun 01 Description ($12.34)
        new Regex(
            @"^\s*(?<date>(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,?\s+\d{2,4})?)\s+(?<desc>.+?)\s+(?<amount>\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)(?:\s+\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)?\s*$",
            RegexOptions.IgnoreCase | RegexOptions.Compiled),
    ];

    // Fallback regex for un-anchored lines if line-by-line regex missed something
    private static readonly Regex FallbackPattern = new Regex(
        @"(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\s+(?<desc>[A-Za-z0-9* &'.#,\-/]+?)\s+(?<amount>\(?\s*-?\$?\s*[\d,]+\.\d{2}\)?)",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    private static readonly (string[] keywords, string category)[] CategoryRules =
    [
        (["rent", "mortgage", "lease", "hoa", "property", "duke energy", "electric", "power", "utility", "water"], "Housing"),
        (["restaurant", "cafe", "coffee", "pizza", "burger", "sushi", "taco", "diner",
          "mcdonald", "starbucks", "chipotle", "subway", "doordash", "ubereats",
          "grubhub", "seamless", "postmates", "dining", "eatery", "bistro", "grill",
          "kitchen", "food", "bakery", "deli", "bar ", " pub", "brewery", "panera"], "Dining"),
        (["grocery", "groceries", "whole foods", "trader joe", "safeway", "kroger",
          "publix", "aldi", "heb", "wegmans", "sprouts", "market", "supermarket",
          "costco", "sam's club", "bj's"], "Groceries"),
        (["uber", "lyft", "taxi", "transit", "metro", "bart", "mta", "amtrak",
          "delta", "united", "american air", "southwest", "jetblue", "spirit",
          "gas", "shell", "exxon", "chevron", "bp ", "sunoco", "speedway",
          "parking", "toll", "zipcar", "enterprise", "hertz", "avis", "exxonmobil"], "Transportation"),
        (["netflix", "spotify", "hulu", "disney", "apple.com/bill", "amazon prime",
          "hbo", "peacock", "paramount", "youtube premium", "pandora", "tidal",
          "adobe", "microsoft 365", "dropbox", "icloud", "google one",
          "gym", "fitness", "planet fitness", "equinox", "membership", "subscription",
          "comcast", "at&t", "verizon", "t-mobile", "redbox"], "Subscriptions"),
        (["amazon", "walmart", "target", "best buy", "apple store", "ebay",
          "etsy", "wayfair", "home depot", "lowe's", "ikea", "zara", "h&m",
          "gap", "nike", "adidas", "nordstrom", "macy's", "tj maxx", "marshalls",
          "shopify", "purchase", "order", "cvs", "walgreens", "great clips", "amc"], "Shopping"),
        (["insurance", "geico", "progressive", "allstate", "state farm",
          "blue cross", "aetna", "cigna", "humana", "kaiser",
          "usaa", "metlife", "nationwide"], "Insurance"),
    ];

    public Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        var results = new List<ParsedTransactionDto>();

        if (!string.IsNullOrWhiteSpace(pdfText))
        {
            var lines = pdfText.Split(['\r', '\n'], StringSplitOptions.RemoveEmptyEntries);

            foreach (var line in lines)
            {
                var trimmed = line.Trim();
                if (string.IsNullOrWhiteSpace(trimmed)) continue;

                // Match against line patterns
                bool matched = false;
                foreach (var pattern in LinePatterns)
                {
                    var m = pattern.Match(trimmed);
                    if (m.Success)
                    {
                        if (TryParseDate(m.Groups["date"].Value, out var date) &&
                            TryParseAmount(m.Groups["amount"].Value, out var amount))
                        {
                            var desc = CleanDescription(m.Groups["desc"].Value);
                            if (desc.Length >= 2)
                            {
                                var category = ResolveCategory(desc, knownMerchants);
                                results.Add(new ParsedTransactionDto(date, desc, amount, category));
                                matched = true;
                                break;
                            }
                        }
                    }
                }

                // If line pattern didn't match, try fallback regex
                if (!matched)
                {
                    var m = FallbackPattern.Match(trimmed);
                    if (m.Success)
                    {
                        if (TryParseDate(m.Groups["date"].Value, out var date) &&
                            TryParseAmount(m.Groups["amount"].Value, out var amount))
                        {
                            var desc = CleanDescription(m.Groups["desc"].Value);
                            if (desc.Length >= 2 && !results.Any(r => r.Date == date && r.Description == desc && r.Amount == amount))
                            {
                                var category = ResolveCategory(desc, knownMerchants);
                                results.Add(new ParsedTransactionDto(date, desc, amount, category));
                            }
                        }
                    }
                }
            }
        }

        // Fallback: if nothing matched at all
        if (results.Count == 0)
        {
            results.Add(new ParsedTransactionDto(
                DateOnly.FromDateTime(DateTime.UtcNow),
                "⚠️ Could not parse PDF text — connect Azure Foundry for AI extraction",
                0m,
                "Other"
            ));
        }

        // Sort by date descending
        results = [.. results.OrderByDescending(r => r.Date)];
        return Task.FromResult(results);
    }

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

    private static bool TryParseDate(string raw, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        raw = raw.Trim().Replace("-", "/");

        string[] formats = ["yyyy/MM/dd", "yyyy/M/d", "MM/dd/yyyy", "M/d/yyyy", "MM/dd/yy", "M/d/yy", "MM/dd", "M/d"];
        foreach (var fmt in formats)
        {
            if (DateOnly.TryParseExact(raw, fmt,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out date))
            {
                if (date.Year == 1) date = new DateOnly(DateTime.UtcNow.Year, date.Month, date.Day);
                return true;
            }
        }

        if (DateTime.TryParse(raw, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var dt))
        {
            date = DateOnly.FromDateTime(dt);
            if (date.Year == 1) date = new DateOnly(DateTime.UtcNow.Year, date.Month, date.Day);
            return true;
        }

        return false;
    }

    private static bool TryParseAmount(string raw, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        raw = raw.Trim();
        bool isNegative = raw.StartsWith("(") && raw.EndsWith(")") || raw.Contains("-");

        string cleaned = Regex.Replace(raw, @"[^\d.]", "");

        if (!decimal.TryParse(cleaned, System.Globalization.CultureInfo.InvariantCulture, out decimal val))
            return false;

        amount = isNegative ? -val : val;
        return true;
    }

    private static string CleanDescription(string raw)
    {
        raw = Regex.Replace(raw.Trim(), @"\s{2,}", " ");
        raw = Regex.Replace(raw, @"\s+\d{4,}\s*$", "");
        return raw.Trim();
    }

    private static string ResolveCategory(string desc, Dictionary<string, string> knownMerchants)
    {
        var descLower = desc.ToLower();
        foreach (var (pattern, cat) in knownMerchants)
            if (descLower.Contains(pattern.ToLower())) return cat;

        foreach (var (keywords, category) in CategoryRules)
            if (keywords.Any(kw => descLower.Contains(kw))) return category;

        return "Other";
    }
}
