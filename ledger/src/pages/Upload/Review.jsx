import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../../utils/api'

const CATEGORIES = [
  'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Other',
]

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

export default function Review() {
  const navigate = useNavigate()
  const [rows, setRows]               = useState([])
  const [statementId, setStatementId] = useState(null)
  const [fileName, setFileName]       = useState('')
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [error, setError]             = useState('')

  // Load from sessionStorage (set by Upload page)
  useEffect(() => {
    const raw = sessionStorage.getItem('ledger_review')
    if (!raw) { navigate('/upload'); return }
    const { statementId, fileName, rows } = JSON.parse(raw)
    setStatementId(statementId)
    setFileName(fileName)
    setRows(rows)
  }, [navigate])

  const updateCategory = (idx, category) =>
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, category } : r))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      await api.post('/api/statements/confirm', {
        statementId,
        transactions: rows,
      })
      sessionStorage.removeItem('ledger_review')
      setSaved(true)
      // Redirect to transactions after short delay so user sees success
      setTimeout(() => navigate('/transactions'), 1800)
    } catch (err) {
      setError(err.message || 'Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (!rows.length) return null

  const uncertainCount = rows.filter((r) => r.category === 'Other').length

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Review transactions</h2>
          <p className="page-subtitle">
            {fileName} · {rows.length} transactions · Correct any categories before saving
          </p>
        </div>
        <div className="review-actions">
          {!saved && (
            <button
              className="btn-secondary"
              onClick={() => navigate('/upload')}
              disabled={saving}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}
          {!saved && (
            <button
              className="btn-primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving
                ? <><Loader2 size={14} className="upload-spinner" /> Saving…</>
                : <><CheckCircle2 size={14} /> Confirm &amp; Save</>
              }
            </button>
          )}
        </div>
      </div>

      {/* Success banner */}
      {saved && (
        <div className="review-success-banner">
          <CheckCircle2 size={16} />
          {rows.length} transactions saved! Redirecting to Transactions…
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="upload-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Uncertain warning */}
      {uncertainCount > 0 && !saved && (
        <div className="upload-error-banner" style={{ background: 'rgba(245,158,11,0.08)', borderColor: '#fcd34d', color: '#92400e' }}>
          <AlertCircle size={16} />
          <span>
            <strong>{uncertainCount} row{uncertainCount > 1 ? 's' : ''}</strong> were categorised as &quot;Other&quot; —
            highlighted below. Please review before saving.
          </span>
        </div>
      )}

      {/* Table */}
      <div className="table-container">
        <table className="data-table" aria-label="Transactions to review">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Date</th>
              <th scope="col">Merchant</th>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={row.category === 'Other' ? 'row-uncertain' : ''}>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td className="table-date">{String(row.date)}</td>
                <td style={{ fontWeight: 500 }}>{row.description}</td>
                <td>
                  <select
                    className="category-select-inline"
                    value={row.category}
                    onChange={(e) => updateCategory(idx, e.target.value)}
                    disabled={saving || saved}
                    aria-label={`Category for ${row.description}`}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </td>
                <td className={row.amount < 0 ? 'amount-debit' : 'amount-credit'}>
                  {row.amount < 0 ? '-' : '+'}{fmt(row.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
