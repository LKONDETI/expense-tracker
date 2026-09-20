using System.Text.RegularExpressions;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

/// <summary>
/// Development AI service used when AzureFoundry credentials are not configured.
/// Parses bank statement text using a robust multi-pass approach:
///   1. Splits text on real newlines AND on whitespace gaps that indicate column boundaries
///   2. Finds date-anchored lines (date at start of segment)
///   3. Per segment: picks the smallest amount (transaction amt) vs largest (running balance)
///   4. Detects sign from CR/DR keywords and parentheses, not just a leading minus
/// </summary>
public class MockAiService : IAiService
{
    // Date at the very start of a segment (allows leading whitespace only)
    private static readonly Regex LineDateRegex = new Regex(
        @"^\s*(?<date>\d{4}[/\-]\d{1,2}[/\-]\d{1,2}|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?|(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2}(?:,?\s+\d{2,4})?)\s+",
        RegexOptions.IgnoreCase | RegexOptions.Compiled);

    // Amounts: (6.75)  -$42.10  $2,450.00  -10.44  - 10.44  10.44
    // Crucially: capture the leading minus EVEN when there is a space between - and digits
    private static readonly Regex AmountRegex = new Regex(
        @"(?<amount>\(\s*\$?\s*[\d,]+\.\d{2}\s*\)|(?<neg>-)\s*\$?\s*[\d,]+\.\d{2}|\$\s*[\d,]+\.\d{2}|(?<!\d)[\d,]+\.\d{2}(?!\d))",
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

    // Income / credit keywords — if description contains these AND no explicit debit signal, treat as positive
    private static readonly string[] CreditKeywords =
    [
        "payroll", "direct deposit", "ppd", "ach deposit", "deposit", "refund",
        "credit", "transfer in", "payment received", "reversal", "zelle in",
        "cashback", "reimburs", "interest paid",
    ];

    // Debit / expense keywords
    private static readonly string[] DebitKeywords =
    [
        "card purchase", "purchase", "pos debit", "ach debit", "withdrawal",
        "payment to", "autopay", "bill pay", "check", "fee", "atm",
        "transfer out", "zelle out", "wire",
    ];

    public Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        if (string.IsNullOrWhiteSpace(pdfText))
            return Task.FromResult(Fallback());

        // ── Step 1: split into segments ───────────────────────────
        // PdfPig sometimes emits several transactions on one text line separated
        // by large whitespace gaps. We split on BOTH real newlines and on gaps of
        // 4+ spaces so each physical bank-statement row becomes its own segment.
        var rawSegments = pdfText
            .Split(['\n', '\r'], StringSplitOptions.RemoveEmptyEntries)
            .SelectMany(line => Regex.Split(line, @"(?<=\d)\s{4,}(?=\d{1,2}[/\-])"))
            .ToList();

        var results = new List<ParsedTransactionDto>();

        foreach (var rawSeg in rawSegments)
        {
            var seg = rawSeg.Trim();
            if (seg.Length < 5) continue;

            // Must start with a date
            var dateMatch = LineDateRegex.Match(seg);
            if (!dateMatch.Success) continue;
            if (!TryParseDate(dateMatch.Groups["date"].Value, out var date)) continue;

            // Everything after the date
            string remainder = seg.Substring(dateMatch.Index + dateMatch.Length).Trim();

            // Skip known header/footer lines
            var lower = seg.ToLower();
            if (SkipPatterns.Any(p => lower.Contains(p))) continue;

            // Find all amounts in the remainder
            var amtMatches = AmountRegex.Matches(remainder).Cast<Match>().ToList();
            if (amtMatches.Count == 0) continue;

            // ── Step 2: pick the transaction amount ───────────────
            // Running balance = largest absolute value on the line.
            // Transaction amount = smallest absolute value.
            // We keep track of both the value AND the full match for sign extraction.
            Match? chosenMatch = null;
            decimal chosenAbs  = decimal.MaxValue;

            foreach (var m in amtMatches)
            {
                if (TryParseAmountAbs(m.Value, out var abs) && abs < chosenAbs)
                {
                    chosenAbs   = abs;
                    chosenMatch = m;
                }
            }
            if (chosenMatch is null || chosenAbs == 0m) continue;

            // ── Step 3: determine description (before first amount) ──
            string descRaw = remainder.Substring(0, amtMatches[0].Index);
            string desc    = CleanDescription(descRaw);
            if (desc.Length < 2) continue;
            if (SkipPatterns.Any(p => desc.ToLower().Contains(p))) continue;

            // ── Step 4: determine sign ────────────────────────────
            // Priority: parentheses > explicit '-' in the matched amount > CR/DR keywords
            decimal amount = DetermineSignedAmount(chosenMatch.Value, chosenAbs, desc, remainder);

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

    // ── Sign determination ────────────────────────────────────────
    // Returns the signed decimal amount using these rules (in priority order):
    //   1. Parentheses   (6.75) → always negative (accounting notation)
    //   2. Explicit minus in the raw match: "-10.44" or "- 10.44" → negative
    //   3. "DR"/"debit" anywhere on the line → negative (expense)
    //   4. "CR"/"credit"/payroll/deposit keywords → positive (income)
    //   5. Default: negative (most transactions on a bank statement are expenses)
    private static decimal DetermineSignedAmount(string rawMatch, decimal absValue, string desc, string remainder)
    {
        // Rule 1: accounting parentheses → negative
        if (rawMatch.TrimStart().StartsWith('('))
            return -absValue;

        // Rule 2: explicit minus sign in the raw match (with or without space)
        if (rawMatch.Contains('-'))
            return -absValue;

        // Rule 3: DR / Debit keywords on the line
        var lineContext = (desc + " " + remainder).ToLower();
        if (lineContext.Contains(" dr ") || lineContext.Contains(" dr\t") ||
            lineContext.Contains("debit"))
            return -absValue;

        // Rule 4: CR / credit / income keywords → positive
        var descLower = desc.ToLower();
        if (lineContext.Contains(" cr ") || lineContext.Contains(" cr\t") ||
            CreditKeywords.Any(k => descLower.Contains(k)))
            return absValue;   // positive — income / credit

        // Rule 5: default → negative (expense)
        // Most bank statement rows ARE expenses; deposits are usually labelled clearly.
        return -absValue;
    }

    // ── Absolute value parser ─────────────────────────────────────
    private static bool TryParseAmountAbs(string raw, out decimal abs)
    {
        abs = 0;
        if (string.IsNullOrWhiteSpace(raw)) return false;
        string cleaned = Regex.Replace(raw, @"[^\d.]", "");
        return decimal.TryParse(cleaned,
            System.Globalization.NumberStyles.Number,
            System.Globalization.CultureInfo.InvariantCulture, out abs);
    }

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

    // ── Description cleanup ───────────────────────────────────────
    private static string CleanDescription(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw)) return string.Empty;
        raw = raw.Replace("\r", " ").Replace("\n", " ").Replace("\t", " ");
        // Remove embedded "posting date" patterns (e.g. "08/05" inside "Card Purchase 08/05 Chipotle")
        raw = Regex.Replace(raw, @"\b\d{1,2}/\d{1,2}\b", "").Trim();
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

    // ── Fallback ──────────────────────────────────────────────────
    private static List<ParsedTransactionDto> Fallback() =>
    [
        new ParsedTransactionDto(
            DateOnly.FromDateTime(DateTime.UtcNow),
            "⚠️ Could not parse PDF text — connect Azure Foundry for AI extraction",
            0m,
            "Other"
        ),
    ];

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
