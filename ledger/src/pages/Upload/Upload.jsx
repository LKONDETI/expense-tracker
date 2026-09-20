import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import {
  UploadCloud, FileText, X, AlertCircle, Loader2,
  ShieldCheck, Calendar, Hash, ChevronRight,
} from 'lucide-react'
import { api } from '../../utils/api'

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

const CATEGORIES = [
  'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Other',
]

// Parse a date string safely — avoids the UTC-midnight timezone shift bug.
// "2026-08-06" parsed as UTC shows Aug 5 in US timezones; appending T12:00:00 keeps it local noon.
const parseDate = (d) => {
  if (!d) return null
  const s = typeof d === 'string' ? d : String(d)
  // If it's already a full ISO string, use as-is; if it's a bare date, pin to local noon
  return s.length === 10 ? new Date(s + 'T12:00:00') : new Date(s)
}

const fmtDate = (d) => {
  if (!d) return null
  const date = parseDate(d)
  return date ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : null
}

const fmtUploadedAt = (iso) => {
  const d = new Date(iso)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ── Skeleton for a statement row ─────────────────────────────
function StatementRowSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)',
    }}>
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skeleton" style={{ width: '55%', height: 13 }} />
        <div className="skeleton" style={{ width: '35%', height: 11 }} />
      </div>
      <div className="skeleton" style={{ width: 60, height: 22, borderRadius: 20 }} />
    </div>
  )
}

// ── Statement history row ─────────────────────────────────────
function StatementRow({ stmt }) {
  const dateRange = (stmt.dateRangeStart && stmt.dateRangeEnd)
    ? `${fmtDate(stmt.dateRangeStart)} – ${fmtDate(stmt.dateRangeEnd)}`
    : 'Date range unknown'

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: 'var(--space-4)', borderBottom: '1px solid var(--color-border-light)',
    }}>
      {/* Icon */}
      <div style={{
        width: 36, height: 36, borderRadius: 8, flexShrink: 0,
        background: 'var(--color-brand-light, #eff6ff)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <FileText size={18} color="var(--color-brand)" />
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', margin: 0,
        }}>
          {stmt.fileName}
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 3 }}>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={11} /> {dateRange}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Hash size={11} /> {stmt.transactionCount} transactions
          </span>
        </div>
      </div>

      {/* Uploaded date */}
      <span style={{ fontSize: 12, color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
        {fmtUploadedAt(stmt.uploadedAt)}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function Upload() {
  const navigate   = useNavigate()
  const fileInputRef = useRef(null)

  // Upload state
  const [isDragOver,   setIsDragOver]   = useState(false)
  const [uploadState,  setUploadState]  = useState('idle')  // idle | uploading | parsed | error
  const [errorMsg,     setErrorMsg]     = useState('')
  const [selectedFile, setSelectedFile] = useState(null)
  const [statementId,  setStatementId]  = useState(null)
  const [parsedRows,   setParsedRows]   = useState([])
  const [fileName,     setFileName]     = useState('')

  // Statement history state
  const [history,        setHistory]        = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [historyError,   setHistoryError]   = useState('')

  // ── Load statement history ───────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true)
    setHistoryError('')
    try {
      const data = await api.get('/api/statements')
      setHistory(Array.isArray(data) ? data : [])
    } catch (err) {
      // 404 just means no statements exist yet — treat as empty, not an error
      if (err.status === 404) {
        setHistory([])
      } else {
        setHistoryError(err.message || 'Could not load statement history.')
      }
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // ── Upload handler ────────────────────────────────────────
  const uploadFile = useCallback(async (file) => {
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMsg('Only PDF files are supported. Please upload a .pdf bank statement.')
      setUploadState('error')
      return
    }
    if (file.size > 20 * 1024 * 1024) {
      setErrorMsg('File is too large. Maximum size is 20MB.')
      setUploadState('error')
      return
    }

    setSelectedFile(file)
    setUploadState('uploading')
    setErrorMsg('')

    try {
      const token = localStorage.getItem('ledger_token')
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('http://localhost:5000/api/statements/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })

      if (res.status === 401) {
        localStorage.removeItem('ledger_token')
        navigate('/login')
        return
      }

      const data = await res.json()
      if (!res.ok) throw new Error(data?.message || `Upload failed (${res.status})`)

      setStatementId(data.statementId)
      setFileName(data.fileName)
      setParsedRows(data.parsedTransactions.map((t) => ({ ...t })))
      setUploadState('parsed')

      // Refresh history so newly confirmed statement appears right away
      fetchHistory()
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed. Please try again.')
      setUploadState('error')
    }
  }, [navigate, fetchHistory])

  // ── Drag & Drop ──────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragOver(false), [])
  const handleDrop      = useCallback((e) => {
    e.preventDefault(); setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0]
    if (file) uploadFile(file)
    e.target.value = ''
  }, [uploadFile])

  const updateCategory = (idx, category) =>
    setParsedRows((prev) => { const c = [...prev]; c[idx] = { ...c[idx], category }; return c })

  const reset = () => {
    setUploadState('idle'); setErrorMsg(''); setSelectedFile(null)
    setStatementId(null); setParsedRows([]); setFileName('')
  }

  const goToReview = () => {
    sessionStorage.setItem('ledger_review', JSON.stringify({ statementId, fileName, rows: parsedRows }))
    navigate('/upload/review')
  }

  return (
    <div className="page-fade-in">
      {/* ── Page header ── */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Upload statement</h2>
          <p className="page-subtitle">
            Upload up to 6 months of bank statements. Each is parsed, reviewed by you, then saved.
          </p>
        </div>
      </div>

      {/* ── Privacy trust wall ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 'var(--space-5)',
        padding: 'var(--space-4) var(--space-5)',
        background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-lg)',
      }}>
        <ShieldCheck size={20} color="#16a34a" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#15803d', margin: '0 0 4px' }}>
            Your bank statements are safe here
          </p>
          <p style={{ fontSize: 13, color: '#166534', lineHeight: 1.6, margin: 0 }}>
            Your PDF is <strong>never stored</strong> — it is processed in memory on our server and
            immediately discarded. Only anonymized transaction data&nbsp;
            <strong>(date, merchant, amount, category)</strong> is saved to the database.
            Account numbers, routing numbers, card numbers, and your name are
            <strong> automatically stripped</strong> before anything is written.
            All data is scoped exclusively to your account.
          </p>
          <Link
            to="/privacy"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 12, color: '#15803d', fontWeight: 600, marginTop: 8,
              textDecoration: 'none',
            }}
          >
            View full Privacy &amp; Security policy <ChevronRight size={12} />
          </Link>
        </div>
      </div>

      {/* ── Error banner ── */}
      {uploadState === 'error' && (
        <div className="upload-error-banner" style={{ marginBottom: 'var(--space-5)' }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
          <button onClick={reset} className="upload-error-dismiss" aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Drop zone (hidden once parsed) ── */}
      {uploadState !== 'parsed' && (
        <div
          id="upload-drop-zone"
          className={`upload-zone${isDragOver ? ' drag-over' : ''}${uploadState === 'uploading' ? ' uploading' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => uploadState === 'idle' && fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Upload PDF statement"
          onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
          style={{ marginBottom: 'var(--space-6)' }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
          {uploadState === 'uploading' ? (
            /* ── Uploading: spinner + filename left-aligned ── */
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
              <Loader2 size={36} className="upload-spinner" style={{ flexShrink: 0, color: 'var(--color-brand)' }} />
              <div>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>
                  Parsing {selectedFile?.name}…
                </p>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  Extracting transactions — this may take a few seconds
                </p>
              </div>
            </div>
          ) : (
            /* ── Idle: icon + text left, button right ── */
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, width: '100%' }}>
              {/* Icon badge */}
              <div style={{
                width: 48, height: 48, borderRadius: 12, flexShrink: 0,
                background: 'var(--color-brand-light, #eff6ff)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UploadCloud size={24} color="var(--color-brand)" />
              </div>

              {/* Text */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--color-text-primary)' }}>
                  Drag your PDF statement here
                </p>
                <p style={{ margin: '3px 0 0', fontSize: 13, color: 'var(--color-text-muted)' }}>
                  PDF only · max 20 MB · your file is never stored
                </p>
              </div>

              {/* Button */}
              <button
                className="btn-primary"
                style={{ flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              >
                Choose file
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Parsed preview table ── */}
      {uploadState === 'parsed' && (
        <div className="parsed-section" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="parsed-header">
            <div className="parsed-header-left">
              <FileText size={18} color="var(--color-brand)" />
              <div>
                <p className="parsed-filename">{fileName}</p>
                <p className="parsed-count">
                  {parsedRows.length} transactions extracted — review before saving
                </p>
              </div>
            </div>
            <div className="parsed-header-actions">
              <button className="btn-secondary" onClick={reset}>
                <X size={14} /> Upload different file
              </button>
              <button className="btn-primary" onClick={goToReview}>
                Review &amp; Save →
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="data-table" aria-label="Parsed transactions preview">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Merchant</th>
                  <th scope="col">Category</th>
                  <th scope="col">Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => (
                  <tr key={idx} className={row.category === 'Other' ? 'row-uncertain' : ''}>
                    <td className="table-date">{String(row.date)}</td>
                    <td style={{ fontWeight: 500 }}>{row.description}</td>
                    <td>
                      <select
                        className="category-select-inline"
                        value={row.category}
                        onChange={(e) => updateCategory(idx, e.target.value)}
                        aria-label={`Category for ${row.description}`}
                      >
                        {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
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

          <p className="parsed-hint">
            <span style={{ color: 'var(--color-warning)' }}>●</span>{' '}
            Highlighted rows were categorised as &quot;Other&quot; — review before saving.
            You can edit any category inline above.
          </p>
        </div>
      )}

      {/* ── Statement history ── */}
      <div className="card" id="card-statement-history">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
          <p className="card-title" style={{ margin: 0 }}>
            Uploaded statements
            {!historyLoading && history.length > 0 && (
              <span style={{
                marginLeft: 8, fontSize: 12, fontWeight: 500,
                color: 'var(--color-text-muted)',
                background: 'var(--color-surface-2, #f3f4f6)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                {history.length}
              </span>
            )}
          </p>
          {!historyLoading && history.length > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              {history.reduce((sum, s) => sum + s.transactionCount, 0)} total transactions
            </span>
          )}
        </div>

        {/* Loading skeletons */}
        {historyLoading && (
          <>
            <StatementRowSkeleton />
            <StatementRowSkeleton />
            <StatementRowSkeleton />
          </>
        )}

        {/* Error */}
        {historyError && (
          <div className="upload-error-banner">
            <AlertCircle size={14} /> {historyError}
            <button className="upload-error-dismiss" onClick={fetchHistory}>Retry</button>
          </div>
        )}

        {/* Empty state */}
        {!historyLoading && !historyError && history.length === 0 && (
          <div style={{
            padding: 'var(--space-8) 0', textAlign: 'center',
            color: 'var(--color-text-muted)',
          }}>
            <UploadCloud size={32} strokeWidth={1.5} style={{ marginBottom: 8 }} />
            <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
              No statements uploaded yet
            </p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Upload your first PDF statement above to get started.
            </p>
          </div>
        )}

        {/* Statement rows */}
        {!historyLoading && !historyError && history.length > 0 && (
          <div>
            {history.map((stmt) => (
              <StatementRow key={stmt.id} stmt={stmt} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
