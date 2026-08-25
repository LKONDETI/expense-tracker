namespace Ledger.API.Models;

/// <summary>
/// Remembers user-corrected merchant → category mappings.
/// Checked before calling Claude so categorization improves over time.
/// </summary>
public class MerchantCategoryMap
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string MerchantPattern { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}

/// <summary>Per-category budget set by the user in Settings.</summary>
public class CategoryBudget
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public string Category { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
}
