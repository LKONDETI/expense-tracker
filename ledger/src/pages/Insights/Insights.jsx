import { useState, useEffect, useCallback } from 'react'
import { TrendingUp, TrendingDown, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../utils/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

// ── Bullet dot colours ───────────────────────────────────────
const BULLET_STYLES = {
  red:   { dot: 'var(--color-danger)',  bg: '#fef2f2' },
  green: { dot: 'var(--color-success)', bg: '#f0fdf4' },
  blue:  { dot: 'var(--color-brand)',   bg: '#eff6ff' },
}

// ── Skeleton for a stat card ─────────────────────────────────
function StatCardSkeleton() {
  return (
    <div className="stat-card">
      <div className="skeleton" style={{ width: 120, height: 13, marginBottom: 10, borderRadius: 4 }} />
      <div className="skeleton" style={{ width: 90,  height: 28, borderRadius: 6 }} />
    </div>
  )
}

// ── Skeleton for a bullet row ────────────────────────────────
function BulletSkeleton() {
  return (
    <div className="insight-item">
      <div className="skeleton" style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 3 }} />
      <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 4 }} />
    </div>
  )
}

export default function Insights() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')

  const fetchInsights = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/api/insights')
      setData(result)
    } catch (err) {
      setError(err.message || 'Failed to load insights.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  // ── Derived display values ───────────────────────────────
  const projectedMonthEnd    = data?.projectedMonthEnd    ?? data?.ProjectedMonthEnd    ?? 0
  const diningVsAvg          = data?.diningVsAvgPercent   ?? data?.DiningVsAvgPercent   ?? 0
  const unusedSubscriptions  = data?.unusedSubscriptions  ?? data?.UnusedSubscriptions  ?? 0
  const bullets              = data?.bullets              ?? data?.Bullets              ?? []

  // ── Empty state: no data from API (bullets is empty + all zeros) ──
  const isEmpty = !loading && !error && bullets.length === 0 && projectedMonthEnd === 0

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Insights &amp; advice</h2>
          {!loading && !error && !isEmpty && (
            <p className="page-subtitle">AI-generated analysis of your recent spending.</p>
          )}
        </div>
        {!loading && !isEmpty && (
          <button
            className="btn-secondary"
            onClick={fetchInsights}
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            aria-label="Refresh insights"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        )}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="upload-error-banner" style={{ marginBottom: 'var(--space-5)' }}>
          {error}
          <button className="upload-error-dismiss" onClick={fetchInsights}>Retry</button>
        </div>
      )}

      {/* Empty State — no transactions uploaded yet */}
      {isEmpty && (
        <div className="empty-state">
          <AlertCircle size={40} strokeWidth={1.5} />
          <p className="empty-state-title">No insights yet</p>
          <p className="empty-state-sub">
            Upload at least one bank statement to generate AI-powered spending insights.
          </p>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            Upload statement
          </Link>
        </div>
      )}

      {/* Stat Cards */}
      {!isEmpty && (
        <>
          <div className="insights-stats">
            {loading ? (
              <>
                <StatCardSkeleton />
                <StatCardSkeleton />
                <StatCardSkeleton />
              </>
            ) : (
              <>
                {/* Projected Month-End */}
                <div className="stat-card" id="insight-projected">
                  <p className="stat-label">Projected month-end</p>
                  <p className="stat-value">{fmt(projectedMonthEnd)}</p>
                </div>

                {/* Dining vs 3-mo avg */}
                <div className="stat-card" id="insight-dining-vs-avg">
                  <p className="stat-label">Dining vs 3-mo avg</p>
                  <p
                    className="stat-value"
                    style={{
                      color: diningVsAvg > 0
                        ? 'var(--color-danger)'
                        : diningVsAvg < 0
                        ? 'var(--color-success)'
                        : 'var(--color-text-primary)',
                    }}
                  >
                    {diningVsAvg > 0 && <TrendingUp  size={18} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                    {diningVsAvg < 0 && <TrendingDown size={18} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                    {diningVsAvg > 0 ? '+' : ''}{diningVsAvg}%
                  </p>
                </div>

                {/* Unused Subscriptions */}
                <div className="stat-card" id="insight-unused-subs">
                  <p className="stat-label">Unused subscriptions</p>
                  <p className="stat-value">{unusedSubscriptions}</p>
                </div>
              </>
            )}
          </div>

          {/* Insight Bullets */}
          <div className="insight-bullets" id="insight-bullets-list">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => <BulletSkeleton key={i} />)
              : bullets.map((item, idx) => {
                  const type = (item.type ?? item.Type ?? 'blue').toLowerCase()
                  const text = item.text ?? item.Text ?? ''
                  const style = BULLET_STYLES[type] ?? BULLET_STYLES.blue

                  return (
                    <div
                      className="insight-item"
                      key={idx}
                      id={`insight-bullet-${idx}`}
                      style={{ background: style.bg, borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)' }}
                    >
                      <div
                        className={`insight-dot ${type}`}
                        aria-hidden="true"
                        style={{ background: style.dot }}
                      />
                      <p className="insight-text">{text}</p>
                    </div>
                  )
                })}
          </div>
        </>
      )}
    </div>
  )
}
