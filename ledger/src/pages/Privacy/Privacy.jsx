import { useState } from 'react'
import { ShieldCheck, EyeOff, Trash2, AlertTriangle, Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '../../utils/api'

const PII_ITEMS = [
  { label: 'Account numbers', detail: 'Stripped before any data is stored' },
  { label: 'Routing numbers', detail: 'Removed during document scan' },
  { label: 'Full name', detail: 'Not associated with transaction records' },
  { label: 'Home address', detail: 'Never extracted or stored' },
  { label: 'SSN / Tax ID', detail: 'Detected and removed automatically' },
  { label: 'Card numbers', detail: 'Last 4 digits only, if present' },
]

export default function Privacy() {
  const [showModal, setShowModal]   = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [deleting, setDeleting]     = useState(false)
  const [deleted, setDeleted]       = useState(false)
  const [error, setError]           = useState('')

  const handleDelete = async () => {
    if (confirmText.toLowerCase() !== 'delete') return

    setDeleting(true)
    setError('')
    try {
      await api.delete('/api/settings/data')
      setDeleted(true)
      setShowModal(false)
      setConfirmText('')
    } catch (err) {
      setError(err.message || 'Failed to delete data. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  const openModal = () => {
    setShowModal(true)
    setConfirmText('')
    setError('')
    setDeleted(false)
  }

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Privacy &amp; Security</h2>
          <p className="page-subtitle">How your data is handled and what we store.</p>
        </div>
      </div>

      {/* Success Notification */}
      {deleted && (
        <div className="privacy-success-banner" role="status">
          <CheckCircle2 size={16} />
          <span>All transactions, statements, and budget settings have been permanently deleted.</span>
        </div>
      )}

      {/* What We Remove */}
      <div className="card" id="card-pii-removed" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-5)' }}>
          <EyeOff size={20} color="var(--color-brand)" />
          <p className="card-title" style={{ margin: 0 }}>What we remove before storing</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {PII_ITEMS.map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--color-border-light)' }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-text-primary)' }}>
                ✓ {item.label}
              </span>
              <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{item.detail}</span>
            </div>
          ))}
        </div>
      </div>

      {/* What We Store */}
      <div className="card" id="card-what-stored" style={{ marginBottom: 'var(--space-5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-5)' }}>
          <ShieldCheck size={20} color="var(--color-brand)" />
          <p className="card-title" style={{ margin: 0 }}>What we store</p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
          Only anonymized transaction data is stored: <strong>date</strong>, <strong>merchant name</strong>, <strong>amount</strong>, and <strong>category</strong>.
          No account identifiers, personal names, or sensitive financial details are ever written to the database.
          All data is scoped to your account — no other user can access your records.
        </p>
      </div>

      {/* Danger Zone */}
      <div
        className="card"
        id="card-danger-zone"
        style={{ border: '1px solid #fecaca', background: 'var(--color-danger-bg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)' }}>
          <Trash2 size={20} color="var(--color-danger)" />
          <p className="card-title" style={{ margin: 0, color: 'var(--color-danger)' }}>Danger Zone: Delete all data</p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          Permanently erase all your uploaded statements, categorized transactions, and budget data from the database. Your user account and login will remain active.
        </p>
        <button
          id="btn-delete-all-data"
          className="btn-danger-action"
          onClick={openModal}
        >
          <Trash2 size={14} /> Delete all my data
        </button>
      </div>

      {/* Confirmation Modal */}
      {showModal && (
        <div className="modal-backdrop" onClick={() => !deleting && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-danger">
              <div className="modal-icon-badge">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h3 className="modal-title">Delete all data?</h3>
                <p className="modal-subtitle">This action is permanent and cannot be undone.</p>
              </div>
            </div>

            {error && (
              <div className="upload-error-banner" style={{ marginTop: 'var(--space-3)' }}>
                {error}
              </div>
            )}

            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5, marginBottom: 'var(--space-4)' }}>
                All of your uploaded statements, transaction history, custom category mappings, and budgets will be permanently wiped from the database.
              </p>

              <label htmlFor="confirm-delete-input" style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: 'var(--space-2)' }}>
                Type <strong style={{ color: 'var(--color-danger)' }}>DELETE</strong> to confirm:
              </label>
              <input
                id="confirm-delete-input"
                type="text"
                className="auth-input"
                placeholder="Type DELETE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                disabled={deleting}
                autoFocus
              />
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setShowModal(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-confirm"
                onClick={handleDelete}
                disabled={confirmText.toLowerCase() !== 'delete' || deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 size={14} className="upload-spinner" /> Deleting…
                  </>
                ) : (
                  'Permanently delete data'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
