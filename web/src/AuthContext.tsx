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
        setToken(t)
        setUser(JSON.parse(u))
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const res: LoginResponse = await apiLogin(email, password)
    if (res.user.role !== 'COACH') {
      throw new Error('Acceso restringido: solo para coaches')
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
