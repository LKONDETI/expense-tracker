namespace Ledger.API.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public decimal? MonthlyBudget { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<Statement> Statements { get; set; } = new List<Statement>();
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
    public ICollection<MerchantCategoryMap> MerchantMappings { get; set; } = new List<MerchantCategoryMap>();
    public ICollection<CategoryBudget> CategoryBudgets { get; set; } = new List<CategoryBudget>();
}
