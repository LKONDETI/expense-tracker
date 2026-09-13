import { useState, useEffect, useCallback } from 'react'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { api } from '../../utils/api'

const CATEGORIES = [
  'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Other',
]

// ── Skeleton for a single input row ───────────────────────────
function InputSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="skeleton" style={{ width: 80,  height: 13, borderRadius: 4 }} />
      <div className="skeleton" style={{ width: '100%', height: 38, borderRadius: 8 }} />
    </div>
  )
}

export default function Settings() {
  const [overall,      setOverall]      = useState('')
  const [categoryMap,  setCategoryMap]  = useState({})   // { Housing: '1500', ... }
  const [loading,      setLoading]      = useState(true)
  const [saving,       setSaving]       = useState(false)
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState('')

  // ── Fetch current settings on mount ────────────────────────
  const fetchSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.get('/api/settings')
      setOverall(data.monthlyBudget != null ? String(data.monthlyBudget) : '')

      // Build a flat category → amount map from the array
      const map = {}
      for (const cat of CATEGORIES) {
        const match = data.categoryBudgets?.find(
          (b) => b.category?.toLowerCase() === cat.toLowerCase()
        )
        map[cat] = match ? String(match.amount) : ''
      }
      setCategoryMap(map)
    } catch (err) {
      setError(err.message || 'Failed to load settings.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  // ── Save settings ───────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const categoryBudgets = CATEGORIES
        .filter((cat) => categoryMap[cat] !== '' && categoryMap[cat] != null)
        .map((cat) => ({ category: cat, amount: parseFloat(categoryMap[cat]) || 0 }))

      await api.put('/api/settings', {
        monthlyBudget: overall !== '' ? parseFloat(overall) : null,
        categoryBudgets,
      })

      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message || 'Failed to save settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleCategoryChange = (cat, value) =>
    setCategoryMap((prev) => ({ ...prev, [cat]: value }))

  return (
    <div className="page-fade-in">
      <div className="page-header">
        <div>
          <h2 className="page-title">Settings</h2>
          <p className="page-subtitle">Manage your budgets and preferences.</p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="upload-error-banner" style={{ marginBottom: 'var(--space-5)' }}>
          {error}
          <button className="upload-error-dismiss" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}

      <form onSubmit={handleSave} id="settings-form">
        {/* ── Overall Budget ────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }} id="card-overall-budget">
          <p className="card-title">Overall monthly budget</p>

          {loading ? (
            <div style={{ maxWidth: 280 }}>
              <InputSkeleton />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', maxWidth: 280 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text-secondary)' }}>$</span>
              <input
                id="input-overall-budget"
                type="number"
                min="0"
                step="50"
                value={overall}
                onChange={(e) => setOverall(e.target.value)}
                placeholder="e.g. 4000"
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
                  background: 'var(--color-surface)',
                }}
                aria-label="Overall monthly budget"
              />
            </div>
          )}
        </div>

        {/* ── Per-Category Budgets ──────────────────────────── */}
        <div className="card" style={{ marginBottom: 'var(--space-5)' }} id="card-category-budgets">
          <p className="card-title">Per-category budgets</p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => <InputSkeleton key={i} />)
              : CATEGORIES.map((cat) => (
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
                        value={categoryMap[cat] ?? ''}
                        onChange={(e) => handleCategoryChange(cat, e.target.value)}
                        placeholder="0"
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          border: '1px solid var(--color-border)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: 14,
                          fontFamily: 'var(--font-sans)',
                          color: 'var(--color-text-primary)',
                          outline: 'none',
                          background: 'var(--color-surface)',
                        }}
                        aria-label={`${cat} budget`}
                      />
                    </div>
                  </div>
                ))}
          </div>
        </div>

        {/* ── Save Button ───────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
          <button
            type="submit"
            id="btn-save-settings"
            className="btn-primary"
            disabled={saving || loading}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {saving ? (
              <>
                <Loader2 size={14} className="upload-spinner" /> Saving…
              </>
            ) : (
              'Save settings'
            )}
          </button>

          {saved && (
            <span
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, color: 'var(--color-success)', fontWeight: 500,
              }}
            >
              <CheckCircle2 size={15} />
              Settings saved
            </span>
          )}
        </div>
      </form>
    </div>
  )
}
