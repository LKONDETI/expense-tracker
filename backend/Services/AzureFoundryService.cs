using System.Text;
using System.Text.Json;
using Ledger.API.DTOs;

namespace Ledger.API.Services;

public interface IAiService
{
    Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(string pdfText, Dictionary<string, string> knownMerchants);
    Task<string> AskAsync(string question, string transactionContext);
    Task<InsightsResponse> GenerateInsightsAsync(string transactionContext);
}

public class AzureFoundryService(IConfiguration config, HttpClient http) : IAiService
{
    private const string SystemExtract = """
        You are a financial data parser. Extract all transactions from the provided bank/card statement text.
        Return ONLY valid JSON array, no markdown, no explanation.
        Format: [{"date":"YYYY-MM-DD","description":"merchant name","amount":-86.42,"category":"Groceries"}]
        Amount is negative for debits/expenses, positive for credits.
        Categories (use exactly one): Housing, Dining, Groceries, Transportation, Subscriptions, Shopping, Insurance, Other.
        For known merchants provided, use the given category exactly. For unknowns, infer from context.
        """;

    private const string SystemAsk = """
        You are a personal finance assistant for the Ledger app.
        Answer the user's question using ONLY the transaction data provided. Be concise and factual.
        If the data doesn't cover the question, say so. Never make up numbers.
        """;

    private const string SystemInsights = """
        You are a personal finance analyst. Analyze the provided transaction data and return structured insights.
        Return ONLY valid JSON in this format (no markdown):
        {
          "projectedMonthEnd": 4120.00,
          "diningVsAvgPercent": 22,
          "unusedSubscriptions": 1,
          "bullets": [
            {"type":"red","text":"..."},
            {"type":"green","text":"..."},
            {"type":"blue","text":"..."}
          ]
        }
        Types: red=warning/overspend, green=positive/saving, blue=neutral/informational.
        """;

    public async Task<List<ParsedTransactionDto>> ExtractTransactionsAsync(
        string pdfText, Dictionary<string, string> knownMerchants)
    {
        var knownJson = JsonSerializer.Serialize(knownMerchants);
        var prompt    = $"Known merchant categories: {knownJson}\n\nStatement text:\n{pdfText}";

        var json = await CallFoundryAsync(SystemExtract, prompt);

        try
        {
            var parsed = JsonSerializer.Deserialize<List<RawTransaction>>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            return parsed?.Select(t => new ParsedTransactionDto(
                DateOnly.Parse(t.Date),
                t.Description,
                t.Amount,
                t.Category
            )).ToList() ?? [];
        }
        catch
        {
            throw new InvalidOperationException($"AI returned invalid JSON: {json[..Math.Min(200, json.Length)]}");
        }
    }

    public async Task<string> AskAsync(string question, string transactionContext)
    {
        var prompt = $"Transaction data:\n{transactionContext}\n\nUser question: {question}";
        return await CallFoundryAsync(SystemAsk, prompt);
    }

    public async Task<InsightsResponse> GenerateInsightsAsync(string transactionContext)
    {
        var json = await CallFoundryAsync(SystemInsights, transactionContext);

        try
        {
            var raw = JsonSerializer.Deserialize<InsightsRaw>(json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

            return new InsightsResponse(
                raw.ProjectedMonthEnd,
                raw.DiningVsAvgPercent,
                raw.UnusedSubscriptions,
                raw.Bullets.Select(b => new InsightBulletDto(b.Type, b.Text)).ToList()
            );
        }
        catch
        {
            throw new InvalidOperationException($"AI returned invalid insights JSON: {json[..Math.Min(200, json.Length)]}");
        }
    }

    private async Task<string> CallFoundryAsync(string systemPrompt, string userMessage)
    {
        var endpoint = config["AzureFoundry:Endpoint"]!;
        var apiKey   = config["AzureFoundry:ApiKey"]!;
        var model    = config["AzureFoundry:Model"] ?? "claude-3-5-sonnet";

        var requestBody = new
        {
            model,
            messages = new[]
            {
                new { role = "system",  content = systemPrompt },
                new { role = "user",    content = userMessage },
            },
            max_tokens = 4096,
        };

        var request = new HttpRequestMessage(HttpMethod.Post, $"{endpoint}/chat/completions")
        {
            Content = new StringContent(
                JsonSerializer.Serialize(requestBody),
                Encoding.UTF8,
                "application/json")
        };
        request.Headers.Add("api-key", apiKey);

        var response = await http.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var body    = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        return doc.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString() ?? string.Empty;
    }

    // Internal deserialization helpers
    private record RawTransaction(string Date, string Description, decimal Amount, string Category);
    private record InsightsRaw(
        decimal ProjectedMonthEnd,
        decimal DiningVsAvgPercent,
        int UnusedSubscriptions,
        List<BulletRaw> Bullets
    );
    private record BulletRaw(string Type, string Text);
}
