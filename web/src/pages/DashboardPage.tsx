import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { getAdminStats, getAdminUsers, getAthletes, getExercises } from '../api'
import type { AdminStats, AdminUser, Athlete } from '../api'
import {
  Users, UserCheck, Dumbbell, Loader2, AlertCircle,
  Shield, TrendingUp, UserX, Activity, Plus
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  
  const [adminStats, setAdminStats] = useState<AdminStats | null>(null)
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([])
  
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [totalExercises, setTotalExercises] = useState(0)
  
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    
    if (user?.role === 'ADMIN') {
      Promise.all([
        getAdminStats().catch(() => null),
        getAdminUsers().catch(() => [] as AdminUser[]),
      ])
        .then(([s, u]) => {
          if (s) setAdminStats(s)
          setRecentUsers(u.slice(0, 8))
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    } else if (user?.role === 'COACH') {
      Promise.all([
        getAthletes().catch(() => [] as Athlete[]),
        getExercises({ limit: 1 }).catch(() => ({ total: 0, data: [], page: 1, pages: 1 })),
      ])
        .then(([a, e]) => {
          setAthletes(a)
          setTotalExercises(e.total || 0)
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false))
    } else {
      // Default / fallback
      setLoading(false)
    }
  }, [user])

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
        
        {user?.role === 'ADMIN' && (
          <Link to="/users" id="btn-manage-users" className="btn-primary">
            <Users className="w-4 h-4" />
            Gestionar Usuarios
          </Link>
        )}
        
        {user?.role === 'COACH' && (
          <Link to="/routines" className="btn-primary">
            <Plus className="w-4 h-4" />
            Crear Rutina
          </Link>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {/* ADMIN VIEW */}
      {user?.role === 'ADMIN' && (
        <>
          {adminStats && (
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon={Users}      label="Total Usuarios"   value={adminStats.totalUsers}    sub="registrados"          color="bg-brand-500/15 text-brand-400" />
              <StatCard icon={Shield}     label="Coaches"          value={adminStats.totalCoaches}  sub="entrenadores"         color="bg-violet-500/15 text-violet-400" />
              <StatCard icon={UserCheck}  label="Clientes"         value={adminStats.totalClients}  sub="atletas activos"      color="bg-emerald-500/15 text-emerald-400" />
              <StatCard icon={Dumbbell}   label="Ejercicios"       value={adminStats.totalExercises} sub="catálogo disponible" color="bg-amber-500/15 text-amber-400" />
              <StatCard icon={UserX}      label="Sin Asignar"      value={adminStats.unassigned}    sub="necesitan coach"      color="bg-red-500/15 text-red-400" />
            </div>
          )}

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
        </>
      )}

      {/* COACH VIEW */}
      {user?.role === 'COACH' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard icon={Users}      label="Mis Atletas"      value={athletes.length}   sub="asignados"          color="bg-brand-500/15 text-brand-400" />
            <StatCard icon={Dumbbell}   label="Ejercicios DB"    value={totalExercises}    sub="catálogo total"     color="bg-violet-500/15 text-violet-400" />
            <StatCard icon={Activity}   label="Rutinas Activas"  value={athletes.length}   sub="en seguimiento"     color="bg-emerald-500/15 text-emerald-400" />
          </div>

          <div className="card p-0 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-slate-400" />
                <h2 className="font-semibold text-slate-200">Tus Atletas</h2>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Atleta</th>
                    <th>Objetivo</th>
                    <th>Métricas</th>
                    <th className="text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {athletes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 text-center text-slate-500 text-sm">
                        No tienes atletas asignados por el momento.
                      </td>
                    </tr>
                  ) : athletes.map((athlete, i) => {
                    const initials = athlete.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                    const colors = ['bg-brand-500/20 text-brand-400','bg-violet-500/20 text-violet-400','bg-emerald-500/20 text-emerald-400','bg-amber-500/20 text-amber-400']
                    return (
                      <tr key={athlete.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[i % colors.length]}`}>
                              {initials}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-100 text-sm">{athlete.name}</p>
                              <p className="text-xs text-slate-500">{athlete.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="badge-purple">{athlete.goal || 'General'}</span>
                        </td>
                        <td className="py-4 px-6 text-sm text-slate-400">
                          {athlete.weightKg}kg / {athlete.heightCm}cm
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button 
                            onClick={() => navigate(`/routines?athlete=${athlete.id}`)}
                            className="text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors"
                          >
                            Ver Rutina →
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
