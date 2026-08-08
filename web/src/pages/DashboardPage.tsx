import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { getAdminStats, getAdminUsers } from '../api'
import type { AdminStats, AdminUser } from '../api'
import {
  Users, UserCheck, Dumbbell, Loader2, AlertCircle,
  Shield, TrendingUp, UserX
} from 'lucide-react'
import { Link } from 'react-router-dom'

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string
}) {
  return (
    <div className="stat-card fade-in">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        {sub && <p className="text-xs text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      getAdminStats().catch(() => null),
      getAdminUsers().catch(() => [] as AdminUser[]),
    ])
      .then(([s, u]) => {
        if (s) setStats(s)
        setRecentUsers(u.slice(0, 8))
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        Cargando dashboard...
      </div>
    )
  }

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-400 text-sm mb-1">{greet} 👋</p>
          <h1 className="text-3xl font-bold text-white">{user?.name}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link to="/users" id="btn-manage-users" className="btn-primary">
          <Users className="w-4 h-4" />
          Gestionar Usuarios
        </Link>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <StatCard icon={Users}      label="Total Usuarios"   value={stats.totalUsers}    sub="registrados"          color="bg-brand-500/15 text-brand-400" />
          <StatCard icon={Shield}     label="Coaches"          value={stats.totalCoaches}  sub="entrenadores"         color="bg-violet-500/15 text-violet-400" />
          <StatCard icon={UserCheck}  label="Clientes"         value={stats.totalClients}  sub="atletas activos"      color="bg-emerald-500/15 text-emerald-400" />
          <StatCard icon={Dumbbell}   label="Ejercicios"       value={stats.totalExercises} sub="catálogo disponible" color="bg-amber-500/15 text-amber-400" />
          <StatCard icon={UserX}      label="Sin Asignar"      value={stats.unassigned}    sub="necesitan coach"      color="bg-red-500/15 text-red-400" />
        </div>
      )}

      {/* Recent Users */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-slate-200">Usuarios Recientes</h2>
          </div>
          <Link to="/users" className="text-brand-400 text-xs hover:text-brand-300 transition-colors">
            Ver todos →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Coach Asignado</th>
                <th>Fecha Registro</th>
              </tr>
            </thead>
            <tbody>
              {recentUsers.map((u, i) => {
                const initials = u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                const colors = ['bg-brand-500/20 text-brand-400','bg-violet-500/20 text-violet-400','bg-emerald-500/20 text-emerald-400','bg-amber-500/20 text-amber-400']
                const roleBadge = u.role === 'ADMIN' ? 'badge-purple' : u.role === 'COACH' ? 'badge-blue' : 'badge-green'
                return (
                  <tr key={u.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[i % colors.length]}`}>
                          {initials}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100 text-sm">{u.name}</p>
                          <p className="text-xs text-slate-500">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={roleBadge}>{u.role}</span>
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-400">
                      {u.coach ? u.coach.name : u.role === 'CLIENT' ? <span className="text-red-400 text-xs">Sin asignar</span> : '—'}
                    </td>
                    <td className="py-4 px-6 text-sm text-slate-500">
                      {new Date(u.createdAt).toLocaleDateString('es-ES')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
