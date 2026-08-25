import { useState, useCallback } from 'react'
import { UploadCloud, CheckCircle2, X } from 'lucide-react'

const SAMPLE_FILES = [
  {
    id: 1,
    name: 'chase_statement_july.pdf',
    size: '412 KB',
    status: 'Imported',
    pii: ['Account number', 'Routing number', 'Full name', 'Address'],
  },
  {
    id: 2,
    name: 'amex_statement_july.pdf',
    size: '298 KB',
    status: 'Imported',
    pii: ['Card number', 'Full name', 'SSN / Tax ID'],
  },
]

export default function Upload() {
  const [isDragOver, setIsDragOver] = useState(false)
  const [queue, setQueue] = useState(SAMPLE_FILES)

  const handleDragOver = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setIsDragOver(false), [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setIsDragOver(false)
    // TODO: wire to backend upload endpoint in Phase 1
    alert('File dropped! Backend integration coming in Phase 1.')
  }, [])

  const handleRemove = (id) =>
    setQueue((prev) => prev.filter((f) => f.id !== id))

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Upload documents</h2>
          <p className="page-subtitle" style={{ maxWidth: 520 }}>
            Bank and card statements are scanned and personal or account identifiers
            are removed before anything is stored or categorized.
          </p>
        </div>
      </div>

      {/* Drop Zone */}
      <div
        id="upload-drop-zone"
        className={`upload-zone${isDragOver ? ' drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
        role="button"
        aria-label="Upload PDF statement"
        tabIndex={0}
      >
        <input
          id="file-input"
          type="file"
          accept=".pdf"
          style={{ display: 'none' }}
          onChange={() => alert('File selected! Backend integration coming in Phase 1.')}
        />
        <UploadCloud className="upload-icon" />
        <h3>Drag PDF statements here</h3>
        <p>or choose a file from your computer</p>
        <button
          id="btn-add-sample-statement"
          className="btn-primary"
          onClick={(e) => {
            e.stopPropagation()
            alert('Sample statement will be loaded from backend in Phase 1.')
          }}
        >
          Add a sample statement
        </button>
      </div>

      {/* Processing Queue */}
      {queue.length > 0 && (
        <div className="queue-section">
          <h3>Processing queue</h3>
          {queue.map((file) => (
            <div className="queue-item" key={file.id} id={`queue-item-${file.id}`}>
              <div className="queue-item-header">
                <span className="queue-filename">{file.name}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="queue-size">{file.size}</span>
                  <button
                    className="btn-secondary"
                    style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)' }}
                    onClick={() => handleRemove(file.id)}
                    aria-label={`Remove ${file.name}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div className="queue-status">
                <CheckCircle2 size={13} style={{ display: 'inline', marginRight: 4 }} />
                {file.status}
              </div>

              <p className="pii-label">Removed before import</p>
              <div className="pii-removed">
                {file.pii.map((item) => (
                  <span className="pii-badge" key={item}>
                    ✓ {item}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
