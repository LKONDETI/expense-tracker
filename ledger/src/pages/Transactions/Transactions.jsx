import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Search, Pencil, Trash2, Loader2, UploadCloud, Check, X } from 'lucide-react'
import { api } from '../../utils/api'

const CATEGORIES = [
  'All', 'Housing', 'Dining', 'Groceries', 'Transportation',
  'Subscriptions', 'Shopping', 'Insurance', 'Other',
]

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

// ── Skeleton row ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="skeleton-row">
      {[80, 200, 100, 80].map((w, i) => (
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
  const startEdit = (txn) => {
    setEditingId(txn.id)
    setEditCategory(txn.category)
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
                              <button className="icon-btn-muted" onClick={() => startEdit(txn)} aria-label="Edit category">
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
    </div>
  )
}
