import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { Home, BookOpen, History, User, WifiOff, RefreshCw } from 'lucide-react'
import { flushPendingSets, getPendingSets } from './clientApi'
import InstallPrompt from './components/InstallPrompt'
import TermsGate from '../components/TermsGate'

export default function ClientLayout() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [pendingCount, setPendingCount] = useState(() => getPendingSets().length)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    const syncNow = async () => {
      const pending = getPendingSets()
      setPendingCount(pending.length)
      if (!navigator.onLine || pending.length === 0) return
      setSyncing(true)
      try {
        await flushPendingSets()
        setPendingCount(getPendingSets().length)
      } catch { /* retry on next online / tick */ }
      finally { setSyncing(false) }
    }

    const onOnline = () => { setOnline(true); syncNow() }
    const onOffline = () => { setOnline(false); setPendingCount(getPendingSets().length) }
    const onStorage = () => setPendingCount(getPendingSets().length)

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('storage', onStorage)
    syncNow()
    const timer = setInterval(() => {
      setPendingCount(getPendingSets().length)
      if (navigator.onLine && getPendingSets().length > 0) syncNow()
    }, 15000)

    return () => {
      clearInterval(timer)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('storage', onStorage)
    }
  }, [])

  return (
    <div className="flex flex-col bg-[#F2F2F7] min-h-screen overscroll-none">
      {!online && (
        <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 z-50"
             style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}>
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span>Modo sin internet · Tus series se guardan en el teléfono{pendingCount > 0 ? ` (${pendingCount} pendientes)` : ''}</span>
        </div>
      )}
      {online && (syncing || pendingCount > 0) && (
        <div className="bg-[#007AFF] text-white text-xs font-semibold px-4 py-1.5 flex items-center justify-center gap-2 z-50"
             style={{ paddingTop: 'max(0.375rem, env(safe-area-inset-top))' }}>
          <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${syncing ? 'animate-spin' : ''}`} />
          <span>Sincronizando {pendingCount} serie{pendingCount === 1 ? '' : 's'} guardada{pendingCount === 1 ? '' : 's'}...</span>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-auto scroll-ios no-scrollbar pb-[calc(104px+env(safe-area-inset-bottom))]">
        <Outlet />
      </div>

      {/* Install prompt (iOS / Android) */}
      <InstallPrompt />
      <TermsGate />

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
