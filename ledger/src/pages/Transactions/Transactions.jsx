import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { ALL_TRANSACTIONS, CATEGORIES } from '../../data/mockData'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Math.abs(n))

export default function Transactions() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')

  const filtered = useMemo(() => {
    let txns = ALL_TRANSACTIONS
    if (activeCategory !== 'All') {
      txns = txns.filter((t) => t.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      txns = txns.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      )
    }
    return txns
  }, [activeCategory, searchQuery])

  return (
    <div className="page-fade-in">
      {/* Header */}
      <div className="transactions-toolbar">
        <h2 className="page-title">Transactions</h2>
        <div className="search-input-wrapper">
          <Search className="search-icon" aria-hidden="true" />
          <input
            id="transactions-search"
            type="search"
            className="search-input"
            placeholder="Search transactions"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search transactions"
          />
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="filter-chips" role="group" aria-label="Filter by category">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            id={`filter-chip-${cat.toLowerCase()}`}
            className={`chip${activeCategory === cat ? ' active' : ''}`}
            onClick={() => setActiveCategory(cat)}
            aria-pressed={activeCategory === cat}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Transactions Table */}
      <div className="table-container">
        <table className="data-table" aria-label="Transactions table">
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Merchant</th>
              <th scope="col">Category</th>
              <th scope="col">Amount</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length > 0 ? (
              filtered.map((txn) => (
                <tr key={txn.id} id={`txn-row-${txn.id}`}>
                  <td className="table-date">{txn.date}</td>
                  <td style={{ fontWeight: 500 }}>{txn.merchant}</td>
                  <td>
                    <span className="category-tag">{txn.category}</span>
                  </td>
                  <td>
                    -{fmt(txn.amount)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: 40 }}>
                  No transactions found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
