import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts'
import { UploadCloud, AlertCircle } from 'lucide-react'
import { api } from '../../utils/api'

// ── Category colours (consistent with dashboard) ─────────────
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

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)

const fmtFull = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

// ── Skeleton blocks ───────────────────────────────────────────
function ChartSkeleton({ height = 280 }) {
  return (
    <div
      className="skeleton"
      style={{ width: '100%', height, borderRadius: 'var(--radius-lg)' }}
    />
  )
}

// ── Custom Bar tooltip ────────────────────────────────────────
function BarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 13,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--color-text-primary)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} style={{ color: p.fill, margin: '3px 0' }}>
          {p.name}: <strong>{fmtFull(p.value)}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Custom Pie tooltip ────────────────────────────────────────
function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const { name, value } = payload[0]
  return (
    <div style={{
      background: 'var(--color-surface)', border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)', padding: '8px 12px', fontSize: 13,
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    }}>
      <p style={{ fontWeight: 600, color: 'var(--color-text-primary)', margin: 0 }}>{name}</p>
      <p style={{ color: 'var(--color-text-secondary)', margin: '2px 0 0' }}>{fmtFull(value)}</p>
    </div>
  )
}

// ── Pie centre label ──────────────────────────────────────────
function PieCenterLabel({ cx, cy, total }) {
  return (
    <>
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--color-text-muted)" fontSize={12}>
        Total spent
      </text>
      <text x={cx} y={cy + 14} textAnchor="middle" fill="var(--color-text-primary)" fontSize={18} fontWeight={700}>
        {fmt(total)}
      </text>
    </>
  )
}

// ── Main component ────────────────────────────────────────────
export default function Analytics() {
  const [data,          setData]          = useState(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState('')
  const [selectedMonth, setSelectedMonth] = useState('')   // "2026-06"

  const fetchAnalytics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.get('/api/analytics')
      setData(result)

      // Default to the most recent month
      const months = result?.monthlyTotals ?? []
      if (months.length > 0) {
        setSelectedMonth(months[months.length - 1].month)
      }
    } catch (err) {
      setError(err.message || 'Failed to load analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAnalytics() }, [fetchAnalytics])

  // ── Derived data ──────────────────────────────────────────
  const monthlyTotals  = data?.monthlyTotals  ?? []
  const categoryByMonth = data?.categoryByMonth ?? []
  const isEmpty = !loading && !error && monthlyTotals.length === 0

  // Pie data for the selected month
  const pieData = categoryByMonth
    .filter((c) => c.month === selectedMonth)
    .map((c) => ({ name: c.category, value: c.amount }))

  const pieTotal = pieData.reduce((s, c) => s + c.value, 0)

  // Month options for selector
  const monthOptions = monthlyTotals.map((m) => ({ value: m.month, label: m.label }))

  // Formatted bar data — use labels for display
  const barData = monthlyTotals.map((m) => ({
    label:    m.label,
    Expenses: m.expenses,
    Income:   m.income,
  }))

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Analytics</h2>
          <p className="page-subtitle">Visual breakdown of your income and spending history.</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="upload-error-banner" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={15} /> {error}
          <button className="upload-error-dismiss" onClick={fetchAnalytics}>Retry</button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="empty-state">
          <UploadCloud size={40} strokeWidth={1.5} />
          <p className="empty-state-title">No data to chart yet</p>
          <p className="empty-state-sub">
            Upload at least one bank statement to start seeing your spending analytics.
          </p>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            Upload statement
          </Link>
        </div>
      )}

      {/* ── Bar Chart — Monthly Income vs Expenses ── */}
      {(loading || !isEmpty) && (
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <p className="card-title" style={{ marginBottom: 'var(--space-5)' }}>
            Monthly Income vs Expenses
          </p>

          {loading ? (
            <ChartSkeleton height={300} />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={false} tickLine={false}
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  axisLine={false} tickLine={false} width={48}
                />
                <Tooltip content={<BarTooltip />} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                <Legend
                  wrapperStyle={{ fontSize: 13, paddingTop: 12 }}
                  formatter={(v) => <span style={{ color: 'var(--color-text-secondary)' }}>{v}</span>}
                />
                <Bar dataKey="Expenses" fill="#f97066" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Income"   fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      )}

      {/* ── Pie Chart — Category Breakdown ── */}
      {(loading || !isEmpty) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--space-5)',
          }}
        >
          {/* Left: pie */}
          <div className="card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-5)' }}>
              <p className="card-title" style={{ margin: 0 }}>Category Breakdown</p>
              {!loading && monthOptions.length > 0 && (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{
                    fontSize: 13, padding: '4px 10px',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-surface)',
                    cursor: 'pointer',
                  }}
                  aria-label="Select month"
                >
                  {monthOptions.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}
            </div>

            {loading ? (
              <ChartSkeleton height={260} />
            ) : pieData.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-10) 0', color: 'var(--color-text-muted)', fontSize: 13 }}>
                No expense data for this month.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={110}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry) => (
                      <Cell
                        key={entry.name}
                        fill={CAT_COLORS[entry.name] ?? '#94a3b8'}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                  <PieCenterLabel cx="50%" cy="50%" total={pieTotal} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Right: legend table */}
          <div className="card">
            <p className="card-title" style={{ marginBottom: 'var(--space-4)' }}>
              Breakdown details
            </p>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="skeleton" style={{ width: 110, height: 13 }} />
                    <div className="skeleton" style={{ width: 60,  height: 13 }} />
                  </div>
                ))}
              </div>
            ) : pieData.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>No data for this month.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {pieData.map((entry) => {
                  const pct = pieTotal > 0 ? ((entry.value / pieTotal) * 100).toFixed(1) : '0'
                  const color = CAT_COLORS[entry.name] ?? '#94a3b8'
                  return (
                    <div
                      key={entry.name}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: 'var(--space-2) 0',
                        borderBottom: '1px solid var(--color-border-light)',
                      }}
                    >
                      {/* colour dot */}
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />

                      {/* category name */}
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                        {entry.name}
                      </span>

                      {/* percent */}
                      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', minWidth: 38, textAlign: 'right' }}>
                        {pct}%
                      </span>

                      {/* amount */}
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', minWidth: 72, textAlign: 'right' }}>
                        {fmtFull(entry.value)}
                      </span>
                    </div>
                  )
                })}

                {/* Total row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 'var(--space-2)', fontWeight: 700 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>Total</span>
                  <span style={{ fontSize: 13, color: 'var(--color-text-primary)' }}>{fmtFull(pieTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
