import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { login as apiLogin, LoginResponse } from './api'

interface AuthUser {
  id: string
  name: string
  email: string
  role: string
}

interface AuthCtx {
  user: AuthUser | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]   = useState<AuthUser | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const t = localStorage.getItem('gymaura_token')
    const u = localStorage.getItem('gymaura_user')
    if (t && u) {
      try {
        const parsed = JSON.parse(u)
        // Validate the role is still allowed
        if (parsed.role === 'ADMIN' || parsed.role === 'COACH') {
          // Verify the token is still valid by calling a lightweight endpoint
          const BASE = import.meta.env.VITE_API_URL ?? ''
          fetch(`${BASE}/api/health`, {
            headers: { Authorization: `Bearer ${t}` }
          })
            .then(res => {
              if (res.ok) {
                setToken(t)
                setUser(parsed)
              } else {
                // Token expired or invalid, clear
                localStorage.removeItem('gymaura_token')
                localStorage.removeItem('gymaura_user')
              }
            })
            .catch(() => {
              // Network error - still allow cached session for offline use
              setToken(t)
              setUser(parsed)
            })
            .finally(() => setLoading(false))
          return
        }
      } catch { /* ignore corrupted data */ }
      // If we get here, data was invalid
      localStorage.removeItem('gymaura_token')
      localStorage.removeItem('gymaura_user')
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res: LoginResponse = await apiLogin(email, password)
    if (res.user.role !== 'ADMIN' && res.user.role !== 'COACH') {
      throw new Error('Acceso restringido: solo personal autorizado')
    }
    localStorage.setItem('gymaura_token', res.token)
    localStorage.setItem('gymaura_user', JSON.stringify(res.user))
    setToken(res.token)
    setUser(res.user)
  }

  const logout = () => {
    localStorage.removeItem('gymaura_token')
    localStorage.removeItem('gymaura_user')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
