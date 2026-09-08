import { useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { UploadCloud, FileText, X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { api } from '../../utils/api'

// ── Helpers ──────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

const CATEGORIES = [
  'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Other',
]

// ── Upload States ─────────────────────────────────────────────
// idle → uploading → parsed → error
export default function Upload() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [isDragOver, setIsDragOver]     = useState(false)
  const [uploadState, setUploadState]   = useState('idle')   // idle | uploading | parsed | error
  const [errorMsg, setErrorMsg]         = useState('')
  const [selectedFile, setSelectedFile] = useState(null)

  // Parsed result from backend
  const [statementId, setStatementId]   = useState(null)
  const [parsedRows, setParsedRows]     = useState([])       // ParsedTransactionDto[]
  const [fileName, setFileName]         = useState('')

  // ── Upload handler ────────────────────────────────────────
  const uploadFile = useCallback(async (file) => {
    if (!file) return

    // Client-side validation
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
      // Use FormData for multipart file upload (can't use api.js directly)
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

      if (!res.ok) {
        throw new Error(data?.message || `Upload failed (${res.status})`)
      }

      setStatementId(data.statementId)
      setFileName(data.fileName)
      setParsedRows(data.parsedTransactions.map((t) => ({ ...t })))
      setUploadState('parsed')
    } catch (err) {
      setErrorMsg(err.message || 'Upload failed. Please try again.')
      setUploadState('error')
    }
  }, [navigate])

  // ── Drag & Drop ───────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true) }, [])
  const handleDragLeave = useCallback(() => setIsDragOver(false), [])
  const handleDrop      = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) uploadFile(file)
  }, [uploadFile])

  const handleFileInput = useCallback((e) => {
    const file = e.target.files[0]
    if (file) uploadFile(file)
    e.target.value = ''   // allow re-selecting same file
  }, [uploadFile])

  // ── Category edit ─────────────────────────────────────────
  const updateCategory = (idx, category) => {
    setParsedRows((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], category }
      return copy
    })
  }

  // ── Reset ─────────────────────────────────────────────────
  const reset = () => {
    setUploadState('idle')
    setErrorMsg('')
    setSelectedFile(null)
    setStatementId(null)
    setParsedRows([])
    setFileName('')
  }

  // ── Proceed to Review ─────────────────────────────────────
  const goToReview = () => {
    // Store in sessionStorage so Review page can read it without a re-fetch
    sessionStorage.setItem('ledger_review', JSON.stringify({ statementId, fileName, rows: parsedRows }))
    navigate('/upload/review')
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Upload statement</h2>
          <p className="page-subtitle">
            Bank and card statements are scanned locally and personal identifiers
            are removed before anything is stored.
          </p>
        </div>
      </div>

      {/* ── Error banner ── */}
      {uploadState === 'error' && (
        <div className="upload-error-banner">
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
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />

          {uploadState === 'uploading' ? (
            <>
              <Loader2 className="upload-icon upload-spinner" />
              <h3>Parsing {selectedFile?.name}…</h3>
              <p>Extracting transactions — this may take a few seconds</p>
            </>
          ) : (
            <>
              <UploadCloud className="upload-icon" />
              <h3>Drag your PDF statement here</h3>
              <p>or click to choose a file · PDF only · max 20MB</p>
              <button
                className="btn-primary"
                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}
              >
                Choose file
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Parsed preview table ── */}
      {uploadState === 'parsed' && (
        <div className="parsed-section">
          {/* Header row */}
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

          {/* Preview table */}
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

          <p className="parsed-hint">
            <span style={{ color: 'var(--color-warning)' }}>●</span>{' '}
            Highlighted rows were categorised as &quot;Other&quot; — review before saving.
            You can edit any category inline above.
          </p>
        </div>
      )}
    </div>
  )
}
