import { useNavigate } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowRight } from 'lucide-react'
import {
  CURRENT_MONTH,
  SUMMARY_STATS,
  CATEGORY_SPEND,
  RECENT_TRANSACTIONS,
} from '../../data/mockData'

// ---- helpers ----
const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

const maxSpend = Math.max(...CATEGORY_SPEND.map((c) => c.amount))

export default function Dashboard() {
  const navigate = useNavigate()
  const leftToBudget = SUMMARY_STATS.budget - SUMMARY_STATS.spent
  const isOnTrack = leftToBudget > 0

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span className="page-meta">{CURRENT_MONTH}</span>
      </div>

      {/* Summary Stats */}
      <div className="stats-grid">
        {/* Total Spent */}
        <div className="stat-card" id="stat-total-spent">
          <p className="stat-label">Total spent</p>
          <p className="stat-value">{fmt(SUMMARY_STATS.totalSpent)}</p>
          <span
            className={`stat-badge ${SUMMARY_STATS.prevMonthChange > 0 ? 'up' : 'down'}`}
          >
            {SUMMARY_STATS.prevMonthChange > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {SUMMARY_STATS.prevMonthChange > 0 ? '+' : ''}{SUMMARY_STATS.prevMonthChange}% vs last month
          </span>
        </div>

        {/* Subscriptions */}
        <div className="stat-card" id="stat-subscriptions">
          <p className="stat-label">Subscriptions</p>
          <p className="stat-value">
            {fmt(SUMMARY_STATS.subscriptions)}
            <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-text-secondary)' }}>/mo</span>
          </p>
          <span className="stat-sub">{SUMMARY_STATS.activeSubscriptions} active</span>
        </div>

        {/* Left to budget */}
        <div className="stat-card" id="stat-budget">
          <p className="stat-label">Left to budget</p>
          <p className="stat-value">{fmt(leftToBudget)}</p>
          <span className={`stat-badge ${isOnTrack ? 'on-track' : 'up'}`}>
            {isOnTrack ? '✓ On track' : '⚠ Over budget'}
          </span>
        </div>
      </div>

      {/* Main Grid */}
      <div className="dashboard-grid">
        {/* Spend by Category */}
        <div className="card" id="card-spend-by-category">
          <p className="card-title">Spend by category</p>
          <div className="category-bars">
            {CATEGORY_SPEND.map((cat) => (
              <div className="category-row" key={cat.name}>
                <div className="category-row-header">
                  <span className="category-name">{cat.name}</span>
                  <span className="category-amount">{fmt(cat.amount)}</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: `${(cat.amount / maxSpend) * 100}%`,
                      background: cat.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="card" id="card-recent-transactions">
          <p className="card-title">Recent transactions</p>
          <div className="recent-transactions">
            {RECENT_TRANSACTIONS.map((txn) => (
              <div className="transaction-item" key={txn.id}>
                <div className="txn-left">
                  <span className="txn-merchant">{txn.merchant}</span>
                  <span className="txn-meta">
                    {txn.category} · {txn.date}
                  </span>
                </div>
                <span className="txn-amount negative">
                  {txn.amount < 0 ? '-' : ''}{fmt(txn.amount)}
                </span>
              </div>
            ))}
          </div>

          <button
            id="btn-view-all-transactions"
            className="view-all-link"
            onClick={() => navigate('/transactions')}
          >
            View all transactions <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
