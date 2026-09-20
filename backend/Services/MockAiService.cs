using System.Text.RegularExpressions;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development AI service used when AzureFoundry credentials are not configured.
///
/// Bank statement column layout (all major US banks):
///   DATE | DESCRIPTION | AMOUNT | BALANCE
///
/// Sign encoding (standard US banks):
///   Debits  → explicit minus:  -2,030.00  or  (2,030.00)
///   Credits → no minus:         1,020.00   (the bank already encodes the sign)
///
/// Amount selection:
///   AMOUNT column is always LEFT of BALANCE column → always appears FIRST in text stream.
///   We take the FIRST number on the line as the transaction amount.
///   Guard: if the first number is suspiciously large (>10× the second), swap — balance
///   was emitted first by PdfPig (rare but possible on some PDFs).
/// </summary>
public class MockAiService : IAiService
{
    // Date at the very start of a segment (allows leading whitespace only)
    private static readonly Regex LineDateRegex = new Regex(
        @"^\s*(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{2,4})?)\s+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Amounts: captures the leading minus (with or without space) as part of the match
    private static readonly Regex AmountRegex = new Regex(
        @"(?<amount>\(\s*\$?\s*[\d,]+\.\d{2}\s*\)|-\s*\$?\s*[\d,]+\.\d{2}|\$\s*[\d,]+\.\d{2}|(?<![.\d])[\d,]+\.\d{2}(?![.\d]))",
        RegexOptions.Compiled);

    // Lines that are definitely NOT transactions
    private static readonly string[] SkipPatterns =
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
        "daily balance", "account summary",
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
        if (string.IsNullOrWhiteSpace(pdfText))
            return Task.FromResult(Fallback());

        // ── Split text into one-transaction-per-segment ────────────
        // Splits on newlines AND on 4+ whitespace gaps that precede a date pattern,
        // because PdfPig sometimes concatenates two statement rows on one text line.
        var segments = pdfText
            .Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .SelectMany(line => Regex.Split(line.TrimEnd(), @"(?<=[\d\s])\s{4,}(?=\d{1,2}[/\-])"))
            .Where(s => s.Trim().Length >= 5)
            .ToList();

        var results = new List<ParsedTransactionDto>();

        foreach (var rawSeg in segments)
        {
            var seg = rawSeg.Trim();

            // Skip known header / footer / summary lines
            var lower = seg.ToLower();
            if (SkipPatterns.Any(p => lower.Contains(p))) continue;

            // Must start with a date
            var dateMatch = LineDateRegex.Match(seg);
            if (!dateMatch.Success) continue;
            if (!TryParseDate(dateMatch.Groups["date"].Value, out var date)) continue;

            // Everything after the date
            string remainder = seg.Substring(dateMatch.Index + dateMatch.Length).Trim();

            // Find all amounts in the remainder
            var amtMatches = AmountRegex.Matches(remainder).Cast<Match>().ToList();
            if (amtMatches.Count == 0) continue;

            // ── Select the transaction amount ─────────────────────
            // Column order: AMOUNT is always LEFT of BALANCE → FIRST in text stream.
            // Guard: if first number is >10× the second, PdfPig emitted balance first → use second.
            Match txnMatch = amtMatches[0];

            if (amtMatches.Count >= 2 &&
                TryParseAmountAbs(amtMatches[0].Value, out var abs0) &&
                TryParseAmountAbs(amtMatches[1].Value, out var abs1) &&
                abs1 > 0 && abs0 / abs1 > 10m)
            {
                // Balance was emitted first (unusual) → use second match
                txnMatch = amtMatches[1];
            }

            // ── Determine description ─────────────────────────────
            // Everything between the date and the FIRST amount = description
            string descRaw = remainder.Substring(0, amtMatches[0].Index);
            string desc    = CleanDescription(descRaw);
            if (desc.Length < 2) continue;
            if (SkipPatterns.Any(p => desc.ToLower().Contains(p))) continue;

            // ── Determine sign ────────────────────────────────────
            // US banks explicitly mark debits with '-' or '()'.
            // A plain positive number (no minus, no parens) = credit/income.
            decimal amount = ApplySign(txnMatch.Value, desc);
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

    // ── Sign logic ────────────────────────────────────────────────
    // Priority:
    //   1. Parentheses (10.00) → always negative (accounting notation)
    //   2. Leading minus '-10.00' or '- 10.00' → negative
    //   3. No minus, no parens → POSITIVE (bank already encoded: no minus = credit)
    private static decimal ApplySign(string rawMatch, string desc)
    {
        if (!TryParseAmountAbs(rawMatch, out var abs) || abs == 0m) return 0m;

        // Rule 1: accounting parentheses
        var trimmed = rawMatch.Trim();
        if (trimmed.StartsWith('(') && trimmed.EndsWith(')'))
            return -abs;

        // Rule 2: explicit minus (with or without space)
        if (trimmed.StartsWith('-') || trimmed.Contains("- "))
            return -abs;

        // Rule 3: no explicit sign → positive (credit / income)
        return abs;
    }

    // ── Helpers ───────────────────────────────────────────────────
    private static bool TryParseAmountAbs(string raw, out decimal abs)
    {
        abs = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        string cleaned = Regex.Replace(raw, @"[^\d.]", "");
        return decimal.TryParse(cleaned,
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out abs);
    }

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
                if (date.Year == 1) date = InferYear(date);
                return true;
            }
        }

        if (DateTime.TryParse(raw,
            System.Globalization.CultureInfo.InvariantCulture,
            System.Globalization.DateTimeStyles.None, out var dt))
        {
            date = DateOnly.FromDateTime(dt);
            if (date.Year == 1) date = InferYear(date);
            return true;
        }

        return false;
    }

    private static DateOnly InferYear(DateOnly shortDate)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var candidate = new DateOnly(today.Year, shortDate.Month, shortDate.Day);
        // If the resulting date is >30 days in the future it likely belongs to the prior year
        return candidate > today.AddDays(30)
            ? new DateOnly(today.Year - 1, shortDate.Month, shortDate.Day)
            : candidate;
    }

    private static string CleanDescription(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        raw = raw.Replace("\r", " ").Replace("\n", " ").Replace("\t", " ");
        // Strip embedded MM/DD "purchase date" tokens that banks embed in descriptions
        raw = Regex.Replace(raw, @"\b\d{1,2}/\d{2}\b", "").Trim();
        // Collapse multiple spaces
        raw = Regex.Replace(raw.Trim(), @"\s{2,}", " ");
        raw = raw.Trim('-', ':', '|', ' ', '#');
        return raw.Length > 80 ? raw[..80] : raw;
    }

    private static string ResolveCategory(string desc, Dictionary<string, string> knownMerchants)
    {
        var lower = desc.ToLower();
        foreach (var (pattern, cat) in knownMerchants)
            if (lower.Contains(pattern.ToLower())) return cat;

        foreach (var (keywords, category) in CategoryRules)
            if (keywords.Any(kw => lower.Contains(kw))) return category;

        return "Other";
    }

    private static List<ParsedTransactionDto> Fallback() =>
    [
        new ParsedTransactionDto(
            DateOnly.FromDateTime(DateTime.UtcNow),
            "⚠️ Could not parse PDF text — connect Azure Foundry for AI extraction",
            0m,
            "Other"
        ),
    ];

    // ── AI stubs (MockAiService does not call any real AI) ────────
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
