import { TrendingUp } from 'lucide-react'
import { SUBSCRIPTIONS } from '../../data/mockData'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const totalMonthly = SUBSCRIPTIONS.reduce((sum, s) => sum + s.amount, 0)

const STATUS_LABELS = {
  flat:   { label: 'Flat',   className: 'flat' },
  up:     { label: '↑ Up',   className: 'up' },
  unused: { label: 'Unused', className: 'unused' },
}

export default function Subscriptions() {
  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscriptions</h2>
          <p className="subscriptions-summary">
            {fmt(totalMonthly)} / month across {SUBSCRIPTIONS.length} active subscriptions
          </p>
        </div>
      </div>

      {/* Subscriptions List */}
      <div className="subs-list" id="subscriptions-list">
        {SUBSCRIPTIONS.map((sub) => {
          const { label, className } = STATUS_LABELS[sub.status]
          return (
            <div className="sub-item" key={sub.id} id={`sub-item-${sub.id}`}>
              <div className="sub-avatar" aria-hidden="true">
                {sub.initial}
              </div>

              <div className="sub-info">
                <p className="sub-name">{sub.name}</p>
                <p className="sub-renews">Renews {sub.renews}</p>
              </div>

              <span className={`sub-status ${className}`}>
                {sub.status === 'up' && <TrendingUp size={12} />}
                {label}
              </span>

              <span className="sub-amount">{fmt(sub.amount)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
