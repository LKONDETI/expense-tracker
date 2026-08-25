import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import Upload from './pages/Upload/Upload'
import Transactions from './pages/Transactions/Transactions'
import Subscriptions from './pages/Subscriptions/Subscriptions'
import Insights from './pages/Insights/Insights'
import Ask from './pages/Ask/Ask'
import Privacy from './pages/Privacy/Privacy'
import Settings from './pages/Settings/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"   element={<Dashboard />} />
          <Route path="upload"      element={<Upload />} />
          <Route path="transactions" element={<Transactions />} />
          <Route path="subscriptions" element={<Subscriptions />} />
          <Route path="insights"    element={<Insights />} />
          <Route path="ask"         element={<Ask />} />
          <Route path="privacy"     element={<Privacy />} />
          <Route path="settings"    element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
