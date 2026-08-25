import { useState } from 'react'

const CATEGORIES_FOR_BUDGET = [
  'Housing', 'Dining', 'Groceries', 'Transportation', 'Subscriptions', 'Shopping', 'Insurance', 'Other'
]

const DEFAULT_BUDGETS = {
  overall: '4000',
  Housing: '1500', Dining: '500', Groceries: '400', Transportation: '250',
  Subscriptions: '200', Shopping: '350', Insurance: '150', Other: '100',
}

export default function Settings() {
  const [budgets, setBudgets] = useState(DEFAULT_BUDGETS)
  const [saved, setSaved] = useState(false)

  const handleChange = (key, value) =>
    setBudgets((prev) => ({ ...prev, [key]: value }))

  const handleSave = (e) => {
    e.preventDefault()
    // TODO: POST to /api/settings in Phase 2
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Manage your budgets and preferences.</p>
        </div>
      </div>

      <form onSubmit={handleSave} id="settings-form">
        {/* Overall Budget */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }} id="card-overall-budget">
          <p className="card-title">Overall monthly budget</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', maxWidth: 280 }}>
            <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-secondary)' }}>$</span>
            <input
              id="input-overall-budget"
              type="number"
              min="0"
              step="50"
              value={budgets.overall}
              onChange={(e) => handleChange('overall', e.target.value)}
              style={{
                flex: 1,
                padding: 'var(--space-3) var(--space-4)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                fontSize: 16,
                fontFamily: 'var(--font-sans)',
                fontWeight: 600,
                color: 'var(--color-text-primary)',
                outline: 'none',
              }}
              aria-label="Overall monthly budget"
            />
          </div>
        </div>

        {/* Per-Category Budgets */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }} id="card-category-budgets">
          <p className="card-title">Per-category budgets</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {CATEGORIES_FOR_BUDGET.map((cat) => (
              <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label
                  htmlFor={`budget-${cat.toLowerCase()}`}
                  style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}
                >
                  {cat}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ color: 'var(--color-text-muted)', fontWeight: 600 }}>$</span>
                  <input
                    id={`budget-${cat.toLowerCase()}`}
                    type="number"
                    min="0"
                    step="10"
                    value={budgets[cat] || ''}
                    onChange={(e) => handleChange(cat, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--color-border)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 14,
                      fontFamily: 'var(--font-sans)',
                      color: 'var(--color-text-primary)',
                      outline: 'none',
                    }}
                    aria-label={`${cat} budget`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button type="submit" id="btn-save-settings" className="btn-primary">
            Save settings
          </button>
          {saved && (
            <span style={{ fontSize: 13, color: 'var(--color-success)', fontWeight: 500 }}>
              ✓ Settings saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
