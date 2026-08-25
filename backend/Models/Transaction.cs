namespace Ledger.API.Models;

public class Transaction
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid UserId { get; set; }
    public Guid? StatementId { get; set; }
    public DateOnly Date { get; set; }
    public string Description { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public string Category { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User User { get; set; } = null!;
    public Statement? Statement { get; set; }
}

/// <summary>Fixed category list — must match frontend CATEGORIES constant.</summary>
public static class TransactionCategory
{
    public const string Housing        = "Housing";
    public const string Dining         = "Dining";
    public const string Groceries      = "Groceries";
    public const string Transportation = "Transportation";
    public const string Subscriptions  = "Subscriptions";
    public const string Shopping       = "Shopping";
    public const string Insurance      = "Insurance";
    public const string Other          = "Other";

    public static readonly string[] All =
    [
        Housing, Dining, Groceries, Transportation,
        Subscriptions, Shopping, Insurance, Other
    ];
}
