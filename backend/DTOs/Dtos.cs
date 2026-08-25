namespace Ledger.API.DTOs;

// ── Auth ──────────────────────────────────────────────────────
public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Email, Guid UserId);

// ── Dashboard ─────────────────────────────────────────────────
public record DashboardResponse(
    decimal TotalSpent,
    decimal PrevMonthSpent,
    decimal SubscriptionsMonthly,
    int ActiveSubscriptions,
    decimal? MonthlyBudget,
    decimal LeftToBudget,
    List<CategorySpendDto> SpendByCategory,
    List<TransactionDto> RecentTransactions
);

public record CategorySpendDto(string Category, decimal Amount);

// ── Transactions ──────────────────────────────────────────────
public record TransactionDto(
    Guid Id,
    DateOnly Date,
    string Description,
    decimal Amount,
    string Category
);

public record CreateTransactionRequest(
    DateOnly Date,
    string Description,
    decimal Amount,
    string Category
);

public record UpdateCategoryRequest(string Category);

// ── Statement Upload ──────────────────────────────────────────
public record UploadResponse(
    Guid StatementId,
    string FileName,
    List<ParsedTransactionDto> ParsedTransactions
);

public record ParsedTransactionDto(
    DateOnly Date,
    string Description,
    decimal Amount,
    string Category  // AI-suggested, user can correct before saving
);

public record ConfirmStatementRequest(
    Guid StatementId,
    List<ParsedTransactionDto> Transactions  // user-reviewed/corrected
);

// ── Subscriptions ─────────────────────────────────────────────
public record SubscriptionDto(
    string Merchant,
    decimal Amount,
    int RenewalDay,
    string Status  // "flat" | "up" | "unused"
);

// ── Insights ──────────────────────────────────────────────────
public record InsightsResponse(
    decimal ProjectedMonthEnd,
    decimal DiningVsAvgPercent,
    int UnusedSubscriptions,
    List<InsightBulletDto> Bullets
);

public record InsightBulletDto(string Type, string Text);  // type: red|green|blue

// ── Chat / Ask ────────────────────────────────────────────────
public record AskRequest(string Question);
public record AskResponse(string Answer);

// ── Settings ──────────────────────────────────────────────────
public record SettingsResponse(
    decimal? MonthlyBudget,
    List<CategoryBudgetDto> CategoryBudgets
);

public record UpdateSettingsRequest(
    decimal? MonthlyBudget,
    List<CategoryBudgetDto> CategoryBudgets
);

public record CategoryBudgetDto(string Category, decimal Amount);
