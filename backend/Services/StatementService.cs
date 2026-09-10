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

        // 2. Extract raw text from PDF using PdfPig
        string rawText;
        using (var ms = new MemoryStream())
        {
            await file.CopyToAsync(ms);
            ms.Position = 0;

            using var pdf = PdfDocument.Open(ms);
            var pageTexts = new List<string>();
            foreach (var page in pdf.GetPages())
            {
                var text = page.Text;
                if (string.IsNullOrWhiteSpace(text) || text.Trim().Length < 10)
                {
                    var words = page.GetWords();
                    text = string.Join(" ", words.Select(w => w.Text));
                }
                pageTexts.Add(text);
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
        var parsed = await ai.ExtractTransactionsAsync(rawText, userMappings
            .ToDictionary(m => m.MerchantPattern, m => m.Category));

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
        }).ToList();

        db.Transactions.AddRange(transactions);
        await db.SaveChangesAsync();

        return transactions.Count;
    }

    private static string SanitizeFileName(string name) =>
        Path.GetFileName(name).Replace("..", "").Replace("/", "").Replace("\\", "");
}
