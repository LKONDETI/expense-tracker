import { ShieldCheck, EyeOff, Trash2 } from 'lucide-react'

const PII_ITEMS = [
  { label: 'Account numbers', detail: 'Stripped before any data is stored' },
  { label: 'Routing numbers', detail: 'Removed during document scan' },
  { label: 'Full name', detail: 'Not associated with transaction records' },
  { label: 'Home address', detail: 'Never extracted or stored' },
  { label: 'SSN / Tax ID', detail: 'Detected and removed automatically' },
  { label: 'Card numbers', detail: 'Last 4 digits only, if present' },
]

export default function Privacy() {
  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Privacy &amp; Security</h2>
          <p className="page-subtitle">How your data is handled and what we store.</p>
        </div>
      </div>

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
        style={{ border: '1px solid var(--color-danger-bg)', background: 'var(--color-danger-bg)' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)' }}>
          <Trash2 size={20} color="var(--color-danger)" />
          <p className="card-title" style={{ margin: 0, color: 'var(--color-danger)' }}>Delete all data</p>
        </div>
        <p style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 'var(--space-4)' }}>
          This permanently deletes all your transactions, statements, and settings. This action cannot be undone.
        </p>
        <button
          id="btn-delete-all-data"
          style={{
            padding: '8px 20px',
            background: 'var(--color-danger)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontWeight: 600,
            fontSize: 13,
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
          onClick={() => alert('Delete confirmation dialog — coming soon.')}
        >
          Delete all my data
        </button>
      </div>
    </div>
  )
}
