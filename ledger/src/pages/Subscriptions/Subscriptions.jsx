import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { TrendingUp, RefreshCw } from 'lucide-react'
import { api } from '../../utils/api'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

const getOrdinal = (d) => {
  if (!d && d !== 0) return ''
  const s = ['th', 'st', 'nd', 'rd']
  const v = d % 100
  return d + (s[(v - 20) % 10] || s[v] || s[0])
}

const formatMerchantName = (m) => {
  if (!m) return 'Unknown'
  return m
    .split(' ')
    .map((word) => {
      if (word.toUpperCase() === 'AT&T' || word.toUpperCase() === 'USA') return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    })
    .join(' ')
}

const STATUS_LABELS = {
  flat:   { label: 'Flat',   className: 'flat' },
  up:     { label: '↑ Up',   className: 'up' },
  unused: { label: 'Unused', className: 'unused' },
}

function SubItemSkeleton() {
  return (
    <div className="sub-item">
      <div className="skeleton" style={{ width: 38, height: 38, borderRadius: 'var(--radius-md)', flexShrink: 0 }} />
      <div className="sub-info">
        <div className="skeleton" style={{ width: 140, height: 14, marginBottom: 6 }} />
        <div className="skeleton" style={{ width: 90, height: 11 }} />
      </div>
      <div className="skeleton" style={{ width: 64, height: 22, borderRadius: 'var(--radius-full)' }} />
      <div className="skeleton" style={{ width: 55, height: 16 }} />
    </div>
  )
}

export default function Subscriptions() {
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/api/subscriptions')
      setSubscriptions(data || [])
    } catch (err) {
      setError(err.message || 'Failed to load subscriptions.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSubscriptions()
  }, [fetchSubscriptions])

  const totalMonthly = subscriptions.reduce(
    (sum, s) => sum + (s.amount ?? s.Amount ?? 0),
    0
  )

  if (error) {
    return (
      <div className="page-fade-in">
        <div className="page-header">
          <h2 className="page-title">Subscriptions</h2>
        </div>
        <div className="upload-error-banner">
          {error}
          <button onClick={fetchSubscriptions} className="upload-error-dismiss">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Subscriptions</h2>
          <p className="subscriptions-summary">
            {loading ? (
              'Loading subscriptions...'
            ) : subscriptions.length > 0 ? (
              `${fmt(totalMonthly)} / month across ${subscriptions.length} active ${
                subscriptions.length === 1 ? 'subscription' : 'subscriptions'
              }`
            ) : (
              'No active subscriptions detected'
            )}
          </p>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && (
        <div className="subs-list" id="subscriptions-list">
          {Array.from({ length: 4 }).map((_, i) => (
            <SubItemSkeleton key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && subscriptions.length === 0 && (
        <div className="empty-state">
          <RefreshCw size={40} strokeWidth={1.5} />
          <p className="empty-state-title">No subscriptions detected</p>
          <p className="empty-state-sub">
            Subscriptions are automatically detected from recurring charges in your Subscriptions category across multiple months.
          </p>
          <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
            Upload statement
          </Link>
        </div>
      )}

      {/* Subscriptions List */}
      {!loading && subscriptions.length > 0 && (
        <div className="subs-list" id="subscriptions-list">
          {subscriptions.map((sub, idx) => {
            const merchant = sub.merchant ?? sub.Merchant ?? 'Unknown'
            const amount = sub.amount ?? sub.Amount ?? 0
            const renewalDay = sub.renewalDay ?? sub.RenewalDay
            const statusKey = (sub.status ?? sub.Status ?? 'flat').toLowerCase()
            const { label, className } = STATUS_LABELS[statusKey] || STATUS_LABELS.flat
            const initial = (merchant ? merchant.charAt(0) : '?').toUpperCase()

            return (
              <div className="sub-item" key={sub.id || `${merchant}-${idx}`} id={`sub-item-${idx}`}>
                <div className="sub-avatar" aria-hidden="true">
                  {initial}
                </div>

                <div className="sub-info">
                  <p className="sub-name">{formatMerchantName(merchant)}</p>
                  <p className="sub-renews">
                    {renewalDay ? `Renews on the ${getOrdinal(renewalDay)} of each month` : 'Monthly recurring'}
                  </p>
                </div>

                <span className={`sub-status ${className}`}>
                  {statusKey === 'up' && <TrendingUp size={12} />}
                  {label}
                </span>

                <span className="sub-amount">{fmt(amount)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
