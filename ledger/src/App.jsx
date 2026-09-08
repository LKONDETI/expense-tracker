import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute/ProtectedRoute'
import Layout from './components/Layout/Layout'

// Public pages
import Login    from './pages/Login/Login'
import Register from './pages/Register/Register'

// Protected pages
import Dashboard     from './pages/Dashboard/Dashboard'
import Upload        from './pages/Upload/Upload'
import Review        from './pages/Upload/Review'
import Transactions  from './pages/Transactions/Transactions'
import Subscriptions from './pages/Subscriptions/Subscriptions'
import Insights      from './pages/Insights/Insights'
import Ask           from './pages/Ask/Ask'
import Privacy       from './pages/Privacy/Privacy'
import Settings      from './pages/Settings/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* ── Public routes (no auth needed) ──────────────── */}
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* ── Protected routes (require JWT) ──────────────── */}
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard"     element={<Dashboard />} />
            <Route path="upload"        element={<Upload />} />
            <Route path="upload/review" element={<Review />} />
            <Route path="transactions"  element={<Transactions />} />
            <Route path="subscriptions" element={<Subscriptions />} />
            <Route path="insights"      element={<Insights />} />
            <Route path="ask"           element={<Ask />} />
            <Route path="privacy"       element={<Privacy />} />
            <Route path="settings"      element={<Settings />} />
          </Route>

          {/* ── Catch-all ────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
