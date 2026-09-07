import { createContext, useContext, useState, useCallback } from 'react'
import { api } from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('ledger_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  const login = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/login', { email, password })
    localStorage.setItem('ledger_token', data.token)
    localStorage.setItem('ledger_user', JSON.stringify({ email: data.email, userId: data.userId }))
    setUser({ email: data.email, userId: data.userId })
    return data
  }, [])

  const register = useCallback(async (email, password) => {
    const data = await api.post('/api/auth/register', { email, password })
    localStorage.setItem('ledger_token', data.token)
    localStorage.setItem('ledger_user', JSON.stringify({ email: data.email, userId: data.userId }))
    setUser({ email: data.email, userId: data.userId })
    return data
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('ledger_token')
    localStorage.removeItem('ledger_user')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, register, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
