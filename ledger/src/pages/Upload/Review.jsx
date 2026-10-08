import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, ArrowLeft, Loader2, AlertCircle } from 'lucide-react'
import { api } from '../../utils/api'

const CATEGORIES = [
  'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Health', 'Loan', 'Other',
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
    setRows(rows.map((r) => ({ ...r, include: !r.isDuplicate })))
  }, [navigate])

  const updateCategory = (idx, category) =>
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, category } : r))

  const toggleInclude = (idx) =>
    setRows((prev) => prev.map((r, i) => i === idx ? { ...r, include: !r.include } : r))

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      const toSave = rows
        .filter((r) => r.include)
        .map(({ include, ...rest }) => rest) // eslint-disable-line no-unused-vars
      await api.post('/api/statements/confirm', {
        statementId,
        transactions: toSave,
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
  const duplicateCount = rows.filter((r) => r.isDuplicate).length
  const includedCount  = rows.filter((r) => r.include).length

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Review transactions</h2>
          <p className="page-subtitle">
            {fileName} · {includedCount} of {rows.length} transactions selected · Correct any categories before saving
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
              disabled={saving || includedCount === 0}
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
          {includedCount} transactions saved! Redirecting to Transactions…
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="upload-error-banner">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Duplicate notice */}
      {duplicateCount > 0 && !saved && (
        <div className="upload-error-banner" style={{ background: 'rgba(59,130,246,0.08)', borderColor: '#93c5fd', color: '#1e40af' }}>
          <AlertCircle size={16} />
          <span>
            <strong>{duplicateCount} possible duplicate{duplicateCount > 1 ? 's' : ''}</strong> already
            exist in your transactions and are unchecked. Tick a row to save it anyway.
          </span>
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
              <th scope="col" style={{ width: 56 }}>Save</th>
              <th scope="col">#</th>
              <th scope="col">Date</th>
              <th scope="col">Merchant</th>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr
                key={idx}
                className={row.category === 'Other' ? 'row-uncertain' : ''}
                style={{ opacity: row.include ? 1 : 0.5 }}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={row.include}
                    onChange={() => toggleInclude(idx)}
                    disabled={saving || saved}
                    aria-label={`Include ${row.description}`}
                  />
                </td>
                <td style={{ color: 'var(--color-text-muted)', fontSize: 12 }}>{idx + 1}</td>
                <td className="table-date">{String(row.date)}</td>
                <td style={{ fontWeight: 500 }}>
                  {row.description}
                  {row.isDuplicate && (
                    <span className="category-tag" style={{ marginLeft: 8 }}>Possible duplicate</span>
                  )}
                </td>
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
