import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  Upload,
  List,
  RefreshCw,
  Lightbulb,
  MessageCircle,
  ShieldCheck,
  Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { to: '/dashboard',     icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload',        icon: Upload,          label: 'Upload' },
  { to: '/transactions',  icon: List,            label: 'Transactions' },
  { to: '/subscriptions', icon: RefreshCw,       label: 'Subscriptions' },
  { to: '/insights',      icon: Lightbulb,       label: 'Insights' },
  { to: '/ask',           icon: MessageCircle,   label: 'Ask' },
  { to: '/privacy',       icon: ShieldCheck,     label: 'Privacy & Security' },
  { to: '/settings',      icon: Settings,        label: 'Settings' },
]

export default function Sidebar() {
  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-logo">
        <h1>Ledger</h1>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            id={`nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <Icon className="nav-icon" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p>
          Your documents are scanned locally for account and personal details
          before anything is stored.
        </p>
      </div>
    </aside>
  )
}
