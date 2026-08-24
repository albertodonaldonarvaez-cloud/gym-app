import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, BookOpen, History, LogOut } from 'lucide-react'
import { clearAuth } from './clientApi'

export default function ClientLayout() {
  const navigate = useNavigate()
  const logout = () => { clearAuth(); navigate('/login') }

  return (
    <div className="flex flex-col bg-[#F2F2F7] min-h-screen">
      <div className="flex-1 overflow-auto pb-[80px]">
        <Outlet />
      </div>
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t border-gray-200/60 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="flex items-center justify-around px-2 pt-2 pb-1">
          <TabItem to="/client" label="Inicio" icon={Home} end />
          <TabItem to="/client/catalog" label="Catalogo" icon={BookOpen} />
          <TabItem to="/client/history" label="Historial" icon={History} />
          <button
            onClick={logout}
            className="flex flex-col items-center gap-1 px-3 py-1 rounded-xl text-gray-400 active:scale-95 transition-all"
          >
            <LogOut className="w-6 h-6" />
            <span className="text-[10px] font-medium">Salir</span>
          </button>
        </div>
      </nav>
    </div>
  )
}

function TabItem({ to, label, icon: Icon, end }: {
  to: string; label: string; icon: React.ElementType; end?: boolean
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all active:scale-95 ${
          isActive ? 'text-[#007AFF]' : 'text-gray-400'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon className={`w-6 h-6 ${isActive ? 'stroke-2' : 'stroke-[1.5px]'}`} />
          <span className={`text-[10px] ${isActive ? 'font-semibold' : 'font-medium'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}
