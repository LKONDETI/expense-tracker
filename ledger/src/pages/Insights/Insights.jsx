import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import { INSIGHTS } from '../../data/mockData'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export default function Insights() {
  const { projectedMonthEnd, diningVsAvg, unusedSubscriptions, bullets } = INSIGHTS

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Insights &amp; advice</h2>
      </div>

      {/* Stat Cards */}
      <div className="insights-stats">
        <div className="stat-card" id="insight-projected">
          <p className="stat-label">Projected month-end</p>
          <p className="stat-value">{fmt(projectedMonthEnd)}</p>
        </div>

        <div className="stat-card" id="insight-dining-vs-avg">
          <p className="stat-label">Dining vs 3-mo avg</p>
          <p className="stat-value" style={{ color: diningVsAvg > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {diningVsAvg > 0 ? '+' : ''}{diningVsAvg}%
          </p>
        </div>

        <div className="stat-card" id="insight-unused-subs">
          <p className="stat-label">Unused subscriptions</p>
          <p className="stat-value">{unusedSubscriptions}</p>
        </div>
      </div>

      {/* Insight Bullets */}
      <div className="insight-bullets" id="insight-bullets-list">
        {bullets.map((item, idx) => (
          <div className="insight-item" key={idx} id={`insight-bullet-${idx}`}>
            <div className={`insight-dot ${item.type}`} aria-hidden="true" />
            <p className="insight-text">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
