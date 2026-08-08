import { useEffect, useState } from 'react'
import { getAdminUsers, assignCoach, unassignCoach } from '../api'
import type { AdminUser } from '../api'
import { UserCheck, Shield, User, Loader2, AlertCircle, ChevronDown, Check } from 'lucide-react'

export default function AssignmentsPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)
  
  // Selection state for dropdowns
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  const loadData = () => {
    setLoading(true)
    getAdminUsers()
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t) }
  }, [success])

  const handleAssign = async (clientId: string, coachId: string) => {
    setAssigningId(clientId); setError(''); setSuccess('')
    try {
      await assignCoach(clientId, coachId)
      setSuccess('Coach asignado correctamente')
      loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al asignar coach')
    } finally {
      setAssigningId(null)
      setOpenDropdown(null)
    }
  }

  const handleUnassign = async (clientId: string) => {
    setAssigningId(clientId); setError(''); setSuccess('')
    try {
      await unassignCoach(clientId)
      setSuccess('Coach desasignado')
      loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al desasignar coach')
    } finally {
      setAssigningId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32 gap-3 text-slate-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Cargando asignaciones...
      </div>
    )
  }

  const coaches = users.filter(u => u.role === 'COACH')
  const clients = users.filter(u => u.role === 'CLIENT')
  const unassignedClients = clients.filter(c => !c.coach)

  return (
    <div className="space-y-8 fade-in" onClick={() => setOpenDropdown(null)}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Asignaciones</h1>
        <p className="text-slate-500 text-sm mt-1">Gestiona las relaciones entre coaches y clientes</p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
          <Check className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side: Coaches */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-violet-400" />
            Coaches ({coaches.length})
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {coaches.map(coach => {
              const assignedClients = clients.filter(c => c.coach?.id === coach.id)
              const initials = coach.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
              
              return (
                <div key={coach.id} className="card p-0 overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-slate-800 bg-slate-800/30">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center text-violet-400 font-bold shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-100">{coach.name}</p>
                        <p className="text-xs text-slate-500">{assignedClients.length} clientes asignados</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-2 flex-1 max-h-48 overflow-y-auto">
                    {assignedClients.length === 0 ? (
                      <p className="text-center text-xs text-slate-500 py-4">Sin clientes asignados</p>
                    ) : (
                      <div className="space-y-1">
                        {assignedClients.map(client => (
                          <div key={client.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/50 group transition-colors">
                            <div className="flex items-center gap-2">
                              <User className="w-3.5 h-3.5 text-emerald-400" />
                              <p className="text-sm text-slate-300">{client.name}</p>
                            </div>
                            <button
                              onClick={() => handleUnassign(client.id)}
                              disabled={assigningId === client.id}
                              className="text-xs text-slate-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              {assigningId === client.id ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Desasignar'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right side: Unassigned clients */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-emerald-400" />
            Sin Asignar ({unassignedClients.length})
          </h2>
          
          <div className="card p-4 space-y-3">
            {unassignedClients.length === 0 ? (
              <p className="text-center text-sm text-slate-500 py-6">Todos los clientes tienen coach</p>
            ) : (
              unassignedClients.map(client => (
                <div key={client.id} className="p-3 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <p className="font-medium text-slate-200 text-sm mb-1">{client.name}</p>
                  <p className="text-xs text-slate-500 mb-3">{client.email}</p>
                  
                  <div className="relative">
                    <button
                      onClick={(e) => { e.stopPropagation(); setOpenDropdown(openDropdown === client.id ? null : client.id) }}
                      className="w-full flex items-center justify-between px-3 py-2 text-xs bg-slate-900 border border-slate-700 rounded-lg text-slate-300 hover:border-slate-600 transition-colors"
                    >
                      <span>Asignar coach...</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </button>
                    
                    {openDropdown === client.id && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden z-10">
                        {coaches.map(coach => (
                          <button
                            key={coach.id}
                            onClick={() => handleAssign(client.id, coach.id)}
                            className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-brand-500/20 hover:text-brand-300 transition-colors"
                          >
                            {coach.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
