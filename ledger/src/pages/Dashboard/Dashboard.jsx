import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { TrendingUp, TrendingDown, ArrowRight, UploadCloud, Loader2 } from 'lucide-react'
import { api } from '../../utils/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

// Color palette for category bars (consistent order)
const CAT_COLORS = {
  Housing:        '#6366f1',
  Dining:         '#f59e0b',
  Groceries:      '#10b981',
  Transportation: '#3b82f6',
  Subscriptions:  '#8b5cf6',
  Shopping:       '#ec4899',
  Insurance:      '#14b8a6',
  Other:          '#94a3b8',
}

// ── Skeleton components ───────────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ width: 80, height: 12, marginBottom: 12 }} />
      <div className="skeleton" style={{ width: 120, height: 28, marginBottom: 10 }} />
      <div className="skeleton" style={{ width: 100, height: 10 }} />
    </div>
  )
}

function CategoryBarSkeleton() {
  return (
    <div className="category-row">
      <div className="category-row-header">
        <div className="skeleton" style={{ width: 90, height: 12 }} />
        <div className="skeleton" style={{ width: 55, height: 12 }} />
      </div>
      <div className="bar-track">
        <div className="skeleton" style={{ width: '60%', height: '100%', borderRadius: 4 }} />
      </div>
    </div>
  )
}

function RecentTxnSkeleton() {
  return (
    <div className="transaction-item">
      <div className="txn-left">
        <div className="skeleton" style={{ width: 130, height: 13, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: 90,  height: 11 }} />
      </div>
      <div className="skeleton" style={{ width: 65, height: 13 }} />
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true)
      setError('')
      try {
        const result = await api.get('/api/dashboard')
        setData(result)
      } catch (err) {
        setError(err.message || 'Failed to load dashboard.')
      } finally {
        setLoading(false)
      }
    }
    fetchDashboard()
  }, [])

  // ── Current month label ────────────────────────────────────
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })

  // ── Derived values ─────────────────────────────────────────
  const maxSpend = data?.spendByCategory?.length
    ? Math.max(...data.spendByCategory.map((c) => c.amount))
    : 1

  const pctChange = data && data.prevMonthSpent > 0
    ? (((data.totalSpent - data.prevMonthSpent) / data.prevMonthSpent) * 100).toFixed(1)
    : null

  const isOnTrack = data?.monthlyBudget
    ? data.leftToBudget >= 0
    : null

  // ── Empty state (no transactions at all) ───────────────────
  const hasData = data && (data.totalSpent > 0 || data.recentTransactions?.length > 0)

  // ── Error state ────────────────────────────────────────────
  if (error) {
    return (
      <div className="page-fade-in">
        <div className="page-header">
          <h2 className="page-title">Dashboard</h2>
        </div>
        <div className="upload-error-banner">
          {error}
          <button onClick={() => window.location.reload()} className="upload-error-dismiss">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Dashboard</h2>
        <span className="page-meta">{currentMonth}</span>
      </div>

      {/* ── Stat Cards ── */}
      <div className="stats-grid">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            {/* Total Spent */}
            <div className="stat-card" id="stat-total-spent">
              <p className="stat-label">Total spent</p>
              <p className="stat-value">{fmt(data?.totalSpent ?? 0)}</p>
              {pctChange !== null ? (
                <span className={`stat-badge ${parseFloat(pctChange) > 0 ? 'up' : 'down'}`}>
                  {parseFloat(pctChange) > 0
                    ? <TrendingUp size={12} />
                    : <TrendingDown size={12} />}
                  {parseFloat(pctChange) > 0 ? '+' : ''}{pctChange}% vs last month
                </span>
              ) : (
                <span className="stat-sub">No prior month data</span>
              )}
            </div>

            {/* Subscriptions */}
            <div className="stat-card" id="stat-subscriptions">
              <p className="stat-label">Subscriptions</p>
              <p className="stat-value">
                {fmt(data?.subscriptionsMonthly ?? 0)}
                <span style={{ fontSize: 16, fontWeight: 400, color: 'var(--color-text-secondary)' }}>/mo</span>
              </p>
              <span className="stat-sub">{data?.activeSubscriptions ?? 0} active</span>
            </div>

            {/* Left to budget */}
            <div className="stat-card" id="stat-budget">
              <p className="stat-label">Left to budget</p>
              <p className="stat-value">
                {data?.monthlyBudget ? fmt(data.leftToBudget) : '—'}
              </p>
              {isOnTrack !== null ? (
                <span className={`stat-badge ${isOnTrack ? 'on-track' : 'up'}`}>
                  {isOnTrack ? '✓ On track' : '⚠ Over budget'}
                </span>
              ) : (
                <span className="stat-sub">
                  <Link to="/settings" style={{ color: 'var(--color-brand)', fontSize: 12 }}>
                    Set a budget →
                  </Link>
                </span>
              )}
            </div>
          </>
        )}
      </div>

      {/* ── Empty state ── */}
      {!loading && !hasData && (
        <div className="empty-state">
          <UploadCloud size={40} strokeWidth={1.5} />
          <p className="empty-state-title">No data yet</p>
          <p className="empty-state-sub">Upload your first bank statement to see your spending breakdown.</p>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            Upload statement
          </Link>
        </div>
      )}

      {/* ── Main Grid (only when there's data) ── */}
      {(loading || hasData) && (
        <div className="dashboard-grid">
          {/* Spend by Category */}
          <div className="card" id="card-spend-by-category">
            <p className="card-title">Spend by category</p>
            <div className="category-bars">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <CategoryBarSkeleton key={i} />)
                : data?.spendByCategory?.length > 0
                  ? data.spendByCategory.map((cat) => (
                      <div className="category-row" key={cat.category}>
                        <div className="category-row-header">
                          <span className="category-name">{cat.category}</span>
                          <span className="category-amount">{fmt(cat.amount)}</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill"
                            style={{
                              width: `${(cat.amount / maxSpend) * 100}%`,
                              background: CAT_COLORS[cat.category] ?? '#94a3b8',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  : <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No spending data this month.</p>
              }
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="card" id="card-recent-transactions">
            <p className="card-title">Recent transactions</p>
            <div className="recent-transactions">
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <RecentTxnSkeleton key={i} />)
                : data?.recentTransactions?.length > 0
                  ? data.recentTransactions.map((txn) => (
                      <div className="transaction-item" key={txn.id}>
                        <div className="txn-left">
                          <span className="txn-merchant">{txn.description}</span>
                          <span className="txn-meta">{txn.category} · {String(txn.date)}</span>
                        </div>
                        <span className={`txn-amount ${txn.amount < 0 ? 'negative' : ''}`}>
                          {txn.amount < 0 ? '-' : '+'}{fmt(txn.amount)}
                        </span>
                      </div>
                    ))
                  : <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No recent transactions.</p>
              }
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
      )}
    </div>
  )
}
