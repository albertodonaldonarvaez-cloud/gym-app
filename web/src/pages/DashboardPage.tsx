import { useEffect, useState } from 'react'
import { useAuth } from '../AuthContext'
import { getAthletes } from '../api'
import type { Athlete } from '../api'
import {
  Users, Activity, TrendingUp, Calendar, ChevronRight,
  Dumbbell, Loader2, User, Target
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

function AthleteRow({ athlete, idx }: { athlete: Athlete; idx: number }) {
  const initials = athlete.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
  const colors   = ['bg-brand-500/20 text-brand-400','bg-violet-500/20 text-violet-400',
                    'bg-emerald-500/20 text-emerald-400','bg-amber-500/20 text-amber-400']
  const color    = colors[idx % colors.length]

  return (
    <tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors group">
      <td className="py-4 px-6">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${color}`}>
            {initials}
          </div>
          <div>
            <p className="font-semibold text-slate-100 text-sm">{athlete.name}</p>
            <p className="text-xs text-slate-500">{athlete.email}</p>
          </div>
        </div>
      </td>
      <td className="py-4 px-6">
        <span className="badge-purple">{athlete.goal || 'Sin objetivo'}</span>
      </td>
      <td className="py-4 px-6 text-sm text-slate-400">
        {athlete.weightKg}kg · {athlete.heightCm}cm
      </td>
      <td className="py-4 px-6">
        <span className="badge-green">Activo</span>
      </td>
      <td className="py-4 px-6">
        <div className="flex items-center gap-2">
          <Link
            to={`/routines?athlete=${athlete.id}`}
            id={`btn-routine-${athlete.id}`}
            className="btn-ghost text-xs py-1.5 px-3 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Calendar className="w-3.5 h-3.5" />
            Rutina
          </Link>
          <ChevronRight className="w-4 h-4 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </td>
    </tr>
  )
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [athletes, setAthletes] = useState<Athlete[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    getAthletes()
      .then(setAthletes)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const hour  = new Date().getHours()
  const greet = hour < 12 ? 'Buenos días' : hour < 18 ? 'Buenas tardes' : 'Buenas noches'

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
        <Link to="/routines" id="btn-create-routine" className="btn-primary">
          <Calendar className="w-4 h-4" />
          Nueva Rutina
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}      label="Atletas Totales"  value={athletes.length} sub="asignados a ti"     color="bg-brand-500/15 text-brand-400" />
        <StatCard icon={Activity}   label="Activos hoy"      value={0}  sub="en progreso"           color="bg-emerald-500/15 text-emerald-400" />
        <StatCard icon={TrendingUp} label="Rutinas creadas"  value="—"  sub="este mes"              color="bg-violet-500/15 text-violet-400" />
        <StatCard icon={Dumbbell}   label="Ejercicios DB"    value="873" sub="catálogo disponible"  color="bg-amber-500/15 text-amber-400" />
      </div>

      {/* Athletes table */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-400" />
            <h2 className="font-semibold text-slate-200">Mis Atletas</h2>
          </div>
          <span className="badge-blue">{athletes.length} total</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
            <Loader2 className="w-5 h-5 animate-spin" />
            Cargando atletas...
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
            <Target className="w-10 h-10 opacity-30" />
            <p className="text-sm">{error}</p>
          </div>
        ) : athletes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-600">
            <User className="w-12 h-12 opacity-20" />
            <p className="text-sm">No tienes atletas asignados aún</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Atleta</th>
                  <th>Objetivo</th>
                  <th>Métricas</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {athletes.map((a, i) => <AthleteRow key={a.id} athlete={a} idx={i} />)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
