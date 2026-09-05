import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  LayoutDashboard, Calendar, Dumbbell, LogOut, ChevronRight,
  Bell, User, Users, UserCheck, Settings, AlertTriangle, Mail, Loader2, Menu, X
} from 'lucide-react'
import clsx from 'clsx'
import { useState, useEffect } from 'react'
import ProfileModal from './ProfileModal'

const navItems = [
  { to: '/dashboard',             icon: LayoutDashboard, label: 'Dashboard',      id: 'nav-dashboard',    roles: ['ADMIN', 'COACH'] },
  { to: '/dashboard/users',       icon: Users,           label: 'Usuarios',       id: 'nav-users',        roles: ['ADMIN'] },
  { to: '/dashboard/assignments', icon: UserCheck,        label: 'Asignaciones',   id: 'nav-assignments',  roles: ['ADMIN'] },
  { to: '/dashboard/routines',    icon: Calendar,         label: 'Rutinas',        id: 'nav-routines',     roles: ['ADMIN', 'COACH'] },
  { to: '/dashboard/exercises',   icon: Dumbbell,         label: 'Ejercicios',     id: 'nav-exercises',    roles: ['ADMIN', 'COACH'] },
  { to: '/dashboard/settings',    icon: Settings,         label: 'Configuración',  id: 'nav-settings',     roles: ['ADMIN'] },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')
  const [profileOpen, setProfileOpen] = useState(false)
  const [emailVerified, setEmailVerified] = useState(user?.emailVerified ?? true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const BASE = import.meta.env.VITE_API_URL ?? ''

  // Close sidebar on route change (mobile)
  useEffect(() => { setSidebarOpen(false) }, [location.pathname])

  // Refresh emailVerified from server on mount
  useEffect(() => {
    fetch(`${BASE}/api/v1/user/profile`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` }
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d && d.emailVerified !== undefined) {
          setEmailVerified(d.emailVerified)
          const stored = localStorage.getItem('gymaura_user')
          if (stored) {
            try {
              const u = JSON.parse(stored)
              u.emailVerified = d.emailVerified
              localStorage.setItem('gymaura_user', JSON.stringify(u))
            } catch {}
          }
        }
      })
      .catch(() => {})
  }, [])

  const handleLogout = () => { logout(); navigate('/login') }
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() ?? 'C'

  const handleResendVerify = async () => {
    setResending(true); setResendMsg('')
    try {
      const res = await fetch(`${BASE}/api/v1/auth/resend-verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` }
      })
      const data = await res.json()
      setResendMsg(res.ok ? '✅ Correo enviado' : data.error || 'Error')
    } catch { setResendMsg('Error de conexión') }
    finally { setResending(false) }
  }

  const handleProfileUpdated = (updatedUser: any) => {
    localStorage.setItem('gymaura_user', JSON.stringify(updatedUser))
    window.location.reload()
  }

  const filteredNav = navItems.filter(({ roles }) => roles.includes(user?.role ?? ''))

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
               style={{ background: 'linear-gradient(135deg, #3d6eff 0%, #8b5cf6 100%)' }}>
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-none font-[Space_Grotesk]">GymAura</p>
            <p className="text-[10px] text-gray-500 mt-0.5">{user?.role === 'ADMIN' ? 'Admin Panel' : 'Coach Panel'}</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {filteredNav.map(({ to, icon: Icon, label, id }) => (
          <NavLink
            key={to}
            to={to}
            id={id}
            end={to === '/dashboard'}
            className={({ isActive }) =>
              clsx('nav-item group', isActive && 'active')
            }
          >
            <Icon className="w-4 h-4" />
            {label}
            <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100" />
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="px-3 py-4 border-t border-gray-200 space-y-1">
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50 cursor-pointer" onClick={() => { setProfileOpen(true); setSidebarOpen(false) }}>
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600 shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-900 truncate">{user?.name}</p>
            <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          id="btn-logout"
          onClick={handleLogout}
          className="nav-item w-full text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <LogOut className="w-4 h-4" />
          Cerrar sesión
        </button>
      </div>
    </>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white overflow-y-auto">
        {sidebarContent}
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-72 bg-white flex flex-col shadow-xl animate-slide-in">
            <div className="flex items-center justify-end p-3">
              <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-4 md:px-6 border-b border-gray-200 shrink-0 bg-white/80 backdrop-blur-md">
          <button
            className="md:hidden btn-ghost p-2"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2 md:gap-3">
            <button className="btn-ghost p-2 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-blue-600" />
            </button>
            <button className="btn-ghost p-2" onClick={() => setProfileOpen(true)} title="Mi perfil">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Email verification banner */}
        {user && emailVerified === false && (
          <div className="px-4 md:px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-amber-800 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Tu correo electrónico no está verificado.</span>
              <span className="sm:hidden text-xs">Email no verificado</span>
              {resendMsg && <span className="text-xs font-medium">{resendMsg}</span>}
            </div>
            <button
              onClick={handleResendVerify}
              disabled={resending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-medium transition-colors shrink-0"
            >
              {resending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">Verificar ahora</span>
              <span className="sm:hidden">Verificar</span>
            </button>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-4 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>

      {user && (
        <ProfileModal
          isOpen={profileOpen}
          onClose={() => setProfileOpen(false)}
          user={user}
          onProfileUpdated={handleProfileUpdated}
        />
      )}
    </div>
  )
}
