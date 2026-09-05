import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Home, BookOpen, History, User } from 'lucide-react'
import { clearAuth } from './clientApi'
import { getUser } from './clientApi'
import InstallPrompt from './components/InstallPrompt'

export default function ClientLayout() {
  const navigate = useNavigate()
  const user = getUser()

  return (
    <div className="flex flex-col bg-[#F2F2F7] min-h-screen overscroll-none">
      {/* Main content */}
      <div className="flex-1 overflow-auto scroll-ios no-scrollbar pb-[82px]">
        <Outlet />
      </div>

      {/* Install prompt (iOS / Android) */}
      <InstallPrompt />

      {/* iOS-style bottom tab bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-3 mb-2 bg-white/80 backdrop-blur-2xl rounded-2xl shadow-lg shadow-black/10 border border-white/60">
          <div className="flex items-center justify-around px-2 py-2">
            <TabItem to="/client" end label="Inicio" icon={Home} />
            <TabItem to="/client/catalog" label="Catálogo" icon={BookOpen} />
            <TabItem to="/client/history" label="Historial" icon={History} />
            <TabItem to="/client/profile" label="Yo" icon={User} />
          </div>
        </div>
      </div>
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
        `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
          isActive ? 'text-[#007AFF]' : 'text-gray-400 active:bg-gray-100'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div className={`relative transition-transform ${isActive ? 'scale-110' : ''}`}>
            <Icon className={`w-6 h-6 ${isActive ? 'stroke-2' : 'stroke-[1.5px]'}`} />
          </div>
          <span className={`text-[10px] transition-all ${isActive ? 'font-bold' : 'font-medium'}`}>{label}</span>
        </>
      )}
    </NavLink>
  )
}
