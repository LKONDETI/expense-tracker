using Ledger.API.Data;
using Ledger.API.DTOs;
using Ledger.API.Models;
using Microsoft.EntityFrameworkCore;
using UglyToad.PdfPig;

namespace Ledger.API.Services;

public interface IStatementService
{
    Task<UploadResponse> ParseAndPreviewAsync(Guid userId, IFormFile file);
    Task<int> ConfirmAndSaveAsync(Guid userId, ConfirmStatementRequest req);
}

public class StatementService(AppDbContext db, IAiService ai) : IStatementService
{
    public async Task<UploadResponse> ParseAndPreviewAsync(Guid userId, IFormFile file)
    {
        // 1. Save statement record
        var statement = new Statement
        {
            UserId   = userId,
            FileName = SanitizeFileName(file.FileName),
        };
        db.Statements.Add(statement);
        await db.SaveChangesAsync();

        // 2. Extract raw text from PDF using PdfPig word coordinates
        //    ContentOrderTextExtractor often groups multi-column PDFs by block/column
        //    (all dates first, then all descriptions, then all amounts) rather than by row.
        //    Instead we use word bounding boxes: group words whose Y centres are within
        //    4 points of each other into the same "row", then sort left→right within each row.
        string rawText;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            ms.Position = 0;

            using var pdf = PdfDocument.Open(ms);
            var pageTexts = new List<string>();

            foreach (var page in pdf.GetPages())
            {
                var words = page.GetWords().ToList();
                if (words.Count == 0)
                {
                    pageTexts.Add(string.Empty);
                    continue;
                }

                // Build rows: bucket words by rounded Y-centre (4-point tolerance)
                var rowBuckets = new SortedDictionary<int, List<(double X, string Text)>>(
                    Comparer<int>.Create((a, b) => b.CompareTo(a))); // descending = top first

                foreach (var word in words)
                {
                    var yCentre = (word.BoundingBox.Top + word.BoundingBox.Bottom) / 2.0;
                    var bucket  = (int)Math.Round(yCentre / 4.0) * 4; // snap to 4pt grid
                    if (!rowBuckets.TryGetValue(bucket, out var list))
                    {
                        list = [];
                        rowBuckets[bucket] = list;
                    }
                    list.Add((word.BoundingBox.Left, word.Text));
                }

                var lines = new List<string>();
                foreach (var (_, row) in rowBuckets)
                {
                    var line = string.Join(" ", row.OrderBy(w => w.X).Select(w => w.Text));
                    if (!string.IsNullOrWhiteSpace(line))
                        lines.Add(line);
                }

                pageTexts.Add(string.Join("\n", lines));
            }

            rawText = string.Join("\n", pageTexts);
        }

        if (string.IsNullOrWhiteSpace(rawText))
            throw new InvalidOperationException("Could not extract text from PDF. The file may be a scanned image — OCR is not supported in v1.");

        // 3. Check merchant_category_map for known merchants (before calling AI)
        var userMappings = await db.MerchantCategoryMaps
            .Where(m => m.UserId == userId)
            .ToListAsync();

        // 4. Call AI / Mock Service to extract + categorize transactions
        // ── DEBUG: log extracted text + parsed results ────────────
        Console.WriteLine($"[PDF DEBUG] rawText length={rawText.Length}");
        Console.WriteLine($"[PDF DEBUG] First 3000 chars:\n{rawText.Substring(0, Math.Min(rawText.Length, 3000))}");
        Console.WriteLine("[PDF DEBUG] ─────────────────────────────────────────");

        var parsed = await ai.ExtractTransactionsAsync(rawText, userMappings
            .ToDictionary(m => m.MerchantPattern, m => m.Category));

        Console.WriteLine($"[PDF DEBUG] parsedCount={parsed.Count}");
        foreach (var t in parsed.Take(10))
            Console.WriteLine($"[PDF DEBUG]   {t.Date} | {t.Amount,12:F2} | {t.Category,-15} | {t.Description}");


        // 5. Detect date range from parsed transactions
        if (parsed.Count > 0)
        {
            statement.DateRangeStart = parsed.Min(t => t.Date);
            statement.DateRangeEnd   = parsed.Max(t => t.Date);
            await db.SaveChangesAsync();
        }

        return new UploadResponse(statement.Id, statement.FileName, parsed);
    }

    public async Task<int> ConfirmAndSaveAsync(Guid userId, ConfirmStatementRequest req)
    {
        var statement = await db.Statements
            .FirstOrDefaultAsync(s => s.Id == req.StatementId && s.UserId == userId)
            ?? throw new KeyNotFoundException("Statement not found.");

        var transactions = req.Transactions.Select(t => new Transaction
        {
            UserId      = userId,
            StatementId = statement.Id,
            Date        = t.Date,
            Description = t.Description,
            Amount      = t.Amount,
            Category    = t.Category,
            Balance     = t.Balance,
        }).ToList();

        db.Transactions.AddRange(transactions);
        await db.SaveChangesAsync();

        return transactions.Count;
    }

    private static string SanitizeFileName(string name) =>
        Path.GetFileName(name).Replace("..", "").Replace("/", "").Replace("\\", "");
}
