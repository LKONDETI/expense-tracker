import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Pencil, Trash2, Loader2, UploadCloud, Check, X, Plus } from 'lucide-react'
import { api } from '../../utils/api'

const CATEGORIES = [
  'All', 'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Health', 'Loan', 'Other',
]

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

// ── Skeleton row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="skeleton-row">
      {[80, 200, 100, 80, 80].map((w, i) => (
        <td key={i}><div className="skeleton" style={{ width: w, height: 14 }} /></td>
      ))}
    </tr>
  )
}

export default function Transactions() {
  const navigate = useNavigate()

  const [transactions, setTransactions] = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery]   = useState('')

  // Inline edit state
  const [editingId, setEditingId]       = useState(null)
  const [editCategory, setEditCategory] = useState('')
  const [savingId, setSavingId]         = useState(null)
  const [deletingId, setDeletingId]     = useState(null)

  // ── Fetch transactions ──────────────────────────────────────
  const fetchTransactions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (activeCategory !== 'All') params.set('category', activeCategory)
      if (searchQuery.trim())       params.set('search', searchQuery.trim())

      const data = await api.get(`/api/transactions?${params}`)
      setTransactions(data)
    } catch (err) {
      setError(err.message || 'Failed to load transactions.')
    } finally {
      setLoading(false)
    }
  }, [activeCategory, searchQuery])

  // Re-fetch whenever filter or search changes (debounced for search)
  useEffect(() => {
    const timer = setTimeout(fetchTransactions, searchQuery ? 400 : 0)
    return () => clearTimeout(timer)
  }, [fetchTransactions, searchQuery])

  // Immediate fetch on category change
  useEffect(() => {
    if (!searchQuery) fetchTransactions()
  }, [activeCategory]) // eslint-disable-line

  // ── Inline category edit ────────────────────────────────────
  // ── Add / edit modal ────────────────────────────────────────
  const [form, setForm]             = useState(null)  // null = closed
  const [formSaving, setFormSaving] = useState(false)
  const [formError, setFormError]   = useState('')

  const today = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const openAdd = () => {
    setFormError('')
    setForm({ id: null, date: today(), description: '', type: 'expense', amount: '', category: 'Other' })
  }

  const openEdit = (txn) => {
    setFormError('')
    setForm({
      id: txn.id,
      date: String(txn.date).slice(0, 10),
      description: txn.description,
      type: txn.amount < 0 ? 'expense' : 'income',
      amount: String(Math.abs(txn.amount)),
      category: txn.category,
    })
  }

  const closeForm = () => setForm(null)

  const submitForm = async (e) => {
    e.preventDefault()
    const value = Math.abs(parseFloat(form.amount))
    if (!value) { setFormError('Enter an amount greater than 0.'); return }

    const payload = {
      date: form.date,
      description: form.description.trim(),
      amount: form.type === 'expense' ? -value : value,
      category: form.category,
    }

    setFormSaving(true)
    setFormError('')
    try {
      if (form.id) await api.put(`/api/transactions/${form.id}`, payload)
      else         await api.post('/api/transactions', payload)
      closeForm()
      fetchTransactions()
    } catch (err) {
      setFormError(err.message || 'Failed to save transaction.')
    } finally {
      setFormSaving(false)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditCategory('')
  }

  const saveEdit = async (txn) => {
    if (editCategory === txn.category) { cancelEdit(); return }
    setSavingId(txn.id)
    try {
      await api.patch(`/api/transactions/${txn.id}/category`, { category: editCategory })
      setTransactions((prev) =>
        prev.map((t) => t.id === txn.id ? { ...t, category: editCategory } : t)
      )
    } catch (err) {
      alert(err.message)
    } finally {
      setSavingId(null)
      setEditingId(null)
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  const deleteTransaction = async (id) => {
    if (!confirm('Delete this transaction?')) return
    setDeletingId(id)
    try {
      await api.delete(`/api/transactions/${id}`)
      setTransactions((prev) => prev.filter((t) => t.id !== id))
    } catch (err) {
      alert(err.message)
    } finally {
      setDeletingId(null)
    }
  }

  // ── Empty state ─────────────────────────────────────────────
  const isEmpty = !loading && !error && transactions.length === 0

  return (
    <div className="page-fade-in">
      {/* Toolbar */}
      <div className="transactions-toolbar">
        <h2 className="page-title">Transactions</h2>
        <div className="search-input-wrapper">
          <Search className="search-icon" aria-hidden="true" />
          <input
            type="search"
            className="search-input"
            placeholder="Search transactions…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
        <button className="btn-primary" onClick={openAdd}>
          <Plus size={14} /> Add transaction
        </button>
      </div>

      {/* Category chips */}
      <div className="filter-chips" role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            className={`chip${activeCategory === cat ? ' active' : ''}`}
            onClick={() => { setActiveCategory(cat) }}
            aria-pressed={activeCategory === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="upload-error-banner" style={{ marginBottom: 16 }}>
          {error}
          <button onClick={fetchTransactions} className="upload-error-dismiss">Retry</button>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div className="empty-state">
          <UploadCloud size={40} strokeWidth={1.5} />
          <p className="empty-state-title">No transactions yet</p>
          <p className="empty-state-sub">
            {activeCategory !== 'All' || searchQuery
              ? 'No transactions match your filter.'
              : 'Upload your first statement to get started.'}
          </p>
          {!activeCategory || activeCategory === 'All' && !searchQuery ? (
            <Link to="/upload" className="btn-primary" style={{ textDecoration: 'none' }}>
              Upload statement
            </Link>
          ) : (
            <button className="btn-secondary" onClick={() => { setActiveCategory('All'); setSearchQuery('') }}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Table */}
      {!isEmpty && (
        <div className="table-container">
          <table className="data-table" aria-label="Transactions">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Merchant</th>
                <th scope="col">Category</th>
                <th scope="col">Amount</th>
                <th scope="col" className="table-amount" style={{ color: 'var(--color-text-muted)' }}>Balance</th>
                <th scope="col" style={{ width: 72 }}></th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
                : transactions.map((txn) => {
                    const isEditing  = editingId  === txn.id
                    const isSaving   = savingId   === txn.id
                    const isDeleting = deletingId === txn.id

                    return (
                      <tr key={txn.id} style={{ opacity: isDeleting ? 0.4 : 1 }}>
                        <td className="table-date">{String(txn.date)}</td>
                        <td style={{ fontWeight: 500 }}>{txn.description}</td>
                        <td>
                          {isEditing ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <select
                                className="category-select-inline"
                                value={editCategory}
                                onChange={(e) => setEditCategory(e.target.value)}
                                autoFocus
                              >
                                {CATEGORIES.filter(c => c !== 'All').map((c) => (
                                  <option key={c} value={c}>{c}</option>
                                ))}
                              </select>
                              {isSaving
                                ? <Loader2 size={14} className="upload-spinner" />
                                : (
                                  <>
                                    <button className="icon-btn-success" onClick={() => saveEdit(txn)} aria-label="Save"><Check size={13} /></button>
                                    <button className="icon-btn-muted"   onClick={cancelEdit}        aria-label="Cancel"><X size={13} /></button>
                                  </>
                                )
                              }
                            </div>
                          ) : (
                            <span className="category-tag">{txn.category}</span>
                          )}
                        </td>
                        <td className={txn.amount < 0 ? 'amount-debit' : 'amount-credit'}>
                          {txn.amount < 0 ? '-' : '+'}{fmt(txn.amount)}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                            {!isEditing && (
                              <button className="icon-btn-muted" onClick={() => openEdit(txn)} aria-label="Edit transaction">
                                <Pencil size={13} />
                              </button>
                            )}
                            <button
                              className="icon-btn-danger"
                              onClick={() => deleteTransaction(txn.id)}
                              disabled={isDeleting}
                              aria-label="Delete transaction"
                            >
                              {isDeleting ? <Loader2 size={13} className="upload-spinner" /> : <Trash2 size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
              }
            </tbody>
          </table>
          {!loading && (
            <p className="table-footer-count">
              {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      )}

      {/* Add / edit modal */}
      {form && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={form.id ? 'Edit transaction' : 'Add transaction'}
          onClick={(e) => { if (e.target === e.currentTarget && !formSaving) closeForm() }}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
        >
          <form
            onSubmit={submitForm}
            style={{
              background: 'var(--color-surface, #fff)', borderRadius: 12, padding: 24,
              width: 380, maxWidth: '90vw', display: 'flex', flexDirection: 'column', gap: 12,
            }}
          >
            <h3 style={{ margin: 0 }}>{form.id ? 'Edit transaction' : 'Add transaction'}</h3>

            <label>Date
              <input type="date" required className="search-input" style={{ width: '100%' }}
                value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </label>
            <label>Description
              <input type="text" required maxLength={200} className="search-input" style={{ width: '100%' }}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <label style={{ flex: 1 }}>Type
                <select className="category-select-inline" style={{ width: '100%' }}
                  value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <label style={{ flex: 1 }}>Amount
                <input type="number" required min="0.01" step="0.01" className="search-input" style={{ width: '100%' }}
                  value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
              </label>
            </div>
            <label>Category
              <select className="category-select-inline" style={{ width: '100%' }}
                value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {CATEGORIES.filter((c) => c !== 'All').map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>

            {formError && <div className="upload-error-banner">{formError}</div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" className="btn-secondary" onClick={closeForm} disabled={formSaving}>Cancel</button>
              <button type="submit" className="btn-primary" disabled={formSaving}>
                {formSaving ? <Loader2 size={14} className="upload-spinner" /> : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
