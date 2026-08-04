import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../AuthContext'
import {
  LayoutDashboard, Calendar, Dumbbell, LogOut, ChevronRight,
  Bell, User
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { to: '/',          icon: LayoutDashboard, label: 'Dashboard',      id: 'nav-dashboard'  },
  { to: '/routines',  icon: Calendar,        label: 'Rutinas',         id: 'nav-routines'   },
  { to: '/exercises', icon: Dumbbell,        label: 'Ejercicios',      id: 'nav-exercises'  },
]

export default function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase() ?? 'C'

  return (
    <div className="flex min-h-screen bg-[#080d1a]">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col border-r border-slate-800/60"
             style={{ background: 'linear-gradient(180deg, #0c1220 0%, #080d1a 100%)' }}>
        {/* Logo */}
        <div className="px-6 py-5 border-b border-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                 style={{ background: 'linear-gradient(135deg, #3d6eff 0%, #8b5cf6 100%)' }}>
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none font-[Space_Grotesk]">GymAura</p>
              <p className="text-[10px] text-slate-500 mt-0.5">Coach Panel</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, icon: Icon, label, id }) => (
            <NavLink
              key={to}
              to={to}
              id={id}
              end={to === '/'}
              className={({ isActive }) =>
                clsx('nav-item', isActive && 'active')
              }
            >
              <Icon className="w-4 h-4" />
              {label}
              <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="px-3 py-4 border-t border-slate-800/50 space-y-1">
          {/* Coach info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-slate-800/40">
            <div className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-xs font-bold text-brand-400 shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">{user?.name}</p>
              <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            id="btn-logout"
            onClick={handleLogout}
            className="nav-item w-full text-red-500 hover:text-red-400 hover:bg-red-500/10"
          >
            <LogOut className="w-4 h-4" />
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 flex items-center justify-between px-6 border-b border-slate-800/50 shrink-0"
                style={{ background: 'rgba(8, 13, 26, 0.8)', backdropFilter: 'blur(12px)' }}>
          <div />
          <div className="flex items-center gap-3">
            <button className="btn-ghost p-2 relative">
              <Bell className="w-4 h-4" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-brand-500" />
            </button>
            <button className="btn-ghost p-2">
              <User className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
