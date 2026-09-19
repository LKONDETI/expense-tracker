using System.Text.RegularExpressions;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development AI service used when AzureFoundry credentials are not configured.
/// Parses bank statement text line-by-line — more robust than block-based matching
/// and handles Chase, BofA, Wells Fargo, Citi, and most common US bank formats.
/// </summary>
public class MockAiService : IAiService
{
    // Date at or near the START of a line (within first 12 chars).
    // Handles: 01/15, 1/5, 01/15/26, 01/15/2026, 2026-01-15, Jan 15, January 15 2026
    private static readonly Regex LineDateRegex = new Regex(
        @"^\s*(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{2,4})?)\s+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Amounts anywhere in the line: (6.75), -$42.10, $2,450.00, 15.49, 1,456.09
    private static readonly Regex AmountRegex = new Regex(
        @"(?<amount>\(\s*\$?\s*[\d,]+\.\d{2}\s*\)|-?\s*\$\s*[\d,]+\.\d{2}|(?<!\d)[\d,]+\.\d{2}(?!\d))",
        RegexOptions.Compiled);

    // Lines that are definitely NOT transactions
    private static readonly string[] SkipLinePatterns =
    [
        "beginning balance", "ending balance", "opening balance", "closing balance",
        "statement period", "account ending", "account number",
        "page ", "total ", "subtotal", "continued on", "continued from",
        "date description amount", "date  description", "transaction description",
        "available balance", "current balance", "previous balance",
        "minimum payment", "payment due", "credit limit", "apr ",
        "thank you", "customer service", "member since", "rewards",
        "interest charge", "finance charge", "fees charged",
        "deposits/credits", "checks/debits", "electronic payments",
    ];

    private static readonly (string[] keywords, string category)[] CategoryRules =
    [
        (["rent", "mortgage", "lease", "hoa", "property", "duke energy", "electric",
          "power", "utility", "water", "sewer", "pge ", "con edison", "xcel energy",
          "dominion", "georgia power", "fpl group", "entergy", "eversource"], "Housing"),
        (["restaurant", "cafe", "coffee", "pizza", "burger", "sushi", "taco", "diner",
          "mcdonald", "starbucks", "chipotle", "subway", "doordash", "ubereats",
          "grubhub", "seamless", "postmates", "dining", "eatery", "bistro", "grill",
          "kitchen", "food delivery", "bakery", "deli", "bar ", " pub", "brewery",
          "panera", "wendy", "chick-fil", "panda express", "five guys", "shake shack",
          "wingstop", "raising cane", "taco bell", "kfc", "popeyes", "whataburger",
          "in-n-out", "jersey mike", "jimmy john", "firehouse", "zaxby"], "Dining"),
        (["grocery", "groceries", "whole foods", "trader joe", "safeway", "kroger",
          "publix", "aldi", "heb", "wegmans", "sprouts", "market", "supermarket",
          "costco", "sam's club", "bj's wholesale", "food lion", "giant eagle",
          "stop & shop", "harris teeter", "meijer", "winn-dixie", "fresh market"], "Groceries"),
        (["uber", "lyft", "taxi", "transit", "metro", "bart", "mta", "amtrak",
          "delta air", "united air", "american air", "southwest", "jetblue", "spirit air",
          "gas station", "shell", "exxon", "chevron", "bp ", "sunoco", "speedway",
          "quiktrip", "wawa", "racetrac", "casey's", "marathon", "pilot travel",
          "parking", "toll", "e-zpass", "sunpass", "fastrak",
          "zipcar", "enterprise", "hertz", "avis", "budget car", "national car",
          "autozone", "o'reilly auto", "advance auto", "jiffy lube", "valvoline"], "Transportation"),
        (["netflix", "spotify", "hulu", "disney+", "apple.com/bill", "amazon prime",
          "hbo max", "peacock", "paramount+", "youtube premium", "pandora", "tidal",
          "adobe", "microsoft 365", "dropbox", "icloud", "google one", "google storage",
          "gym", "fitness", "planet fitness", "equinox", "la fitness", "anytime fitness",
          "membership", "subscription", "recurring",
          "comcast", "at&t", "verizon", "t-mobile", "spectrum", "cox comm", "dish network",
          "sirius xm", "audible", "linkedin premium", "youtube tv"], "Subscriptions"),
        (["amazon", "walmart", "target", "best buy", "apple store", "ebay",
          "etsy", "wayfair", "home depot", "lowe's", "ikea", "zara", "h&m",
          "gap", "old navy", "banana republic", "nike", "adidas", "nordstrom",
          "macy's", "tj maxx", "marshalls", "ross stores", "burlington",
          "shopify", "cvs", "walgreens", "rite aid", "dollar tree", "dollar general",
          "five below", "bath body", "ulta", "sephora", "great clips", "supercuts",
          "amc theatre", "regal cinema", "fandango", "ticketmaster", "stubhub"], "Shopping"),
        (["insurance", "geico", "progressive", "allstate", "state farm",
          "blue cross", "aetna", "cigna", "humana", "kaiser", "united health",
          "anthem", "molina", "centene", "cvs health",
          "usaa", "metlife", "nationwide", "new york life", "prudential",
          "liberty mutual", "travelers", "hartford"], "Insurance"),
    ];

    public Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        var results = new List<ParsedTransactionDto>();

        if (string.IsNullOrWhiteSpace(pdfText))
            return Task.FromResult(Fallback());

        // ── Line-by-line parsing ──────────────────────────────────
        // Split on real newlines; also split on sequences of 3+ spaces
        // (PdfPig sometimes concatenates columns with whitespace instead of newlines)
        var lines = pdfText
            .Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .SelectMany(line => SplitOnColumnBoundary(line))
            .ToList();

        foreach (var rawLine in lines)
        {
            var line = rawLine.Trim();
            if (line.Length < 5) continue;

            // Skip known header / footer / summary lines
            var lineLower = line.ToLower();
            if (SkipLinePatterns.Any(p => lineLower.Contains(p))) continue;

            // Must start with a date
            var dateMatch = LineDateRegex.Match(line);
            if (!dateMatch.Success) continue;
            if (!TryParseDate(dateMatch.Groups["date"].Value, out var date)) continue;

            // The rest of the line after the date is "description + amounts"
            string remainder = line.Substring(dateMatch.Index + dateMatch.Length);

            // Find all amounts in the remainder
            var amtMatches = AmountRegex.Matches(remainder).Cast<Match>().ToList();
            if (amtMatches.Count == 0) continue;

            // ── Amount vs Running Balance disambiguation ───────────
            // Running balance = largest absolute value on the line.
            // Transaction amount = smallest absolute value.
            Match? chosenMatch = null;
            decimal chosenAbs  = decimal.MaxValue;

            foreach (var m in amtMatches)
            {
                if (TryParseAmount(m.Groups["amount"].Value, out var v))
                {
                    var abs = Math.Abs(v);
                    if (abs < chosenAbs)
                    {
                        chosenAbs   = abs;
                        chosenMatch = m;
                    }
                }
            }
            if (chosenMatch is null) continue;

            // Description = everything between the date and the FIRST amount
            string descRaw = remainder.Substring(0, amtMatches[0].Index);
            string desc    = CleanDescription(descRaw);

            // Skip if description is too short or looks like a header
            if (desc.Length < 2) continue;
            if (SkipLinePatterns.Any(p => desc.ToLower().Contains(p))) continue;

            if (!TryParseAmount(chosenMatch.Groups["amount"].Value, out var amount)) continue;

            // Skip zero-amount lines (totals, balance markers)
            if (amount == 0m) continue;

            // Deduplicate
            if (results.Any(r => r.Date == date && r.Description == desc && r.Amount == amount))
                continue;

            var category = ResolveCategory(desc, knownMerchants);
            results.Add(new ParsedTransactionDto(date, desc, amount, category));
        }

        if (results.Count == 0)
            return Task.FromResult(Fallback());

        return Task.FromResult(results.OrderByDescending(r => r.Date).ToList());
    }

    // ── Split a single long text line on 3+ consecutive spaces (column boundary) ──
    // PdfPig sometimes outputs: "01/15  AMAZON PURCHASE    -86.42   1,234.56"
    // We split to: ["01/15  AMAZON PURCHASE", "-86.42   1,234.56"]
    // but actually we want to keep it as one line for parsing — this helper is
    // a no-op for now but can split on obvious column gaps if needed.
    private static IEnumerable<string> SplitOnColumnBoundary(string line)
    {
        // Keep the full line intact; just yield it as-is.
        // If PdfPig joins multiple rows due to two-column layout, we can add splitting here.
        yield return line;
    }

    // ── Fallback when nothing parsed ─────────────────────────────
    private static List<ParsedTransactionDto> Fallback() =>
    [
        new ParsedTransactionDto(
            DateOnly.FromDateTime(DateTime.UtcNow),
            "⚠️ Could not parse PDF text — connect Azure Foundry for AI extraction",
            0m,
            "Other"
        ),
    ];

    // ── Date parsing ─────────────────────────────────────────────
    private static bool TryParseDate(string raw, out DateOnly date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        raw = raw.Trim().Replace("-", "/").TrimEnd('.');

        string[] formats =
        [
            "yyyy/MM/dd", "yyyy/M/d",
            "MM/dd/yyyy", "M/d/yyyy",
            "MM/dd/yy",   "M/d/yy",
            "MM/dd",      "M/d",
            "MMMM d yyyy","MMMM d, yyyy",
            "MMM d yyyy", "MMM d, yyyy",
            "MMM d",
        ];

        foreach (var fmt in formats)
        {
            if (DateOnly.TryParseExact(raw, fmt,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None, out date))
            {
                if (date.Year == 1)
                {
                    var today = DateOnly.FromDateTime(DateTime.UtcNow);
                    date = new DateOnly(today.Year, date.Month, date.Day);
                    if (date > today.AddDays(30))
                        date = new DateOnly(today.Year - 1, date.Month, date.Day);
                }
                return true;
            }
        }

        if (DateTime.TryParse(raw,
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var dt))
        {
            date = DateOnly.FromDateTime(dt);
            if (date.Year == 1)
            {
                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                date = new DateOnly(today.Year, date.Month, date.Day);
                if (date > today.AddDays(30))
                    date = new DateOnly(today.Year - 1, date.Month, date.Day);
            }
            return true;
        }

        return false;
    }

    // ── Amount parsing ────────────────────────────────────────────
    private static bool TryParseAmount(string raw, out decimal amount)
    {
        amount = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;

        raw = raw.Trim();
        bool isNegative = raw.StartsWith('(') && raw.EndsWith(')') || raw.Contains('-');

        string cleaned = Regex.Replace(raw, @"[^\d.]", "");
        if (!decimal.TryParse(cleaned,
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out decimal val))
            return false;

        amount = isNegative ? -val : val;
        return true;
    }

    // ── Description cleanup ───────────────────────────────────────
    private static string CleanDescription(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        raw = raw.Replace("\r", " ").Replace("\n", " ").Replace("\t", " ");
        raw = Regex.Replace(raw.Trim(), @"\s{2,}", " ");
        raw = raw.Trim('-', ':', '|', ' ', '#');
        return raw.Length > 80 ? raw[..80] : raw;
    }

    // ── Category resolution ───────────────────────────────────────
    private static string ResolveCategory(string desc, Dictionary<string, string> knownMerchants)
    {
        var lower = desc.ToLower();
        foreach (var (pattern, cat) in knownMerchants)
            if (lower.Contains(pattern.ToLower())) return cat;

        foreach (var (keywords, category) in CategoryRules)
            if (keywords.Any(kw => lower.Contains(kw))) return category;

        return "Other";
    }

    // ── AI stubs ──────────────────────────────────────────────────
    public Task<string> AskAsync(string question, string transactionContext)
    {
        var q = question.ToLower();
        string answer = q switch
        {
            var s when s.Contains("dining")  => "Connect Azure Foundry for AI-powered dining analysis.",
            var s when s.Contains("budget")  => "Budget tracking is active. Set your budget in Settings to see progress.",
            var s when s.Contains("subscri") => "Connect Azure Foundry to detect unused subscriptions intelligently.",
            _                                => "Connect Azure Foundry (Claude) in appsettings.json for real AI-powered answers.",
        };
        return Task.FromResult(answer);
    }

    public Task<InsightsResponse> GenerateInsightsAsync(string transactionContext)
    {
        return Task.FromResult(new InsightsResponse(
            ProjectedMonthEnd:   0m,
            DiningVsAvgPercent:  0m,
            UnusedSubscriptions: 0,
            Bullets: [new("blue", "Connect Azure Foundry to get real AI-powered spending insights from Claude.")]
        ));
    }
}
