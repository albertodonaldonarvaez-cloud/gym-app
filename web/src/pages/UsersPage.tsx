import { useEffect, useState } from 'react'
import { getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser } from '../api'
import type { AdminUser } from '../api'
import {
  Users, Search, Plus, Edit3, Trash2, Loader2, X,
  Shield, UserCheck, User, AlertCircle, Check, MailCheck, MailX
} from 'lucide-react'

const ROLE_TABS = ['ALL', 'ADMIN', 'COACH', 'CLIENT'] as const
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'badge-purple',
  COACH: 'badge-blue',
  CLIENT: 'badge-green',
}
const ROLE_ICONS: Record<string, React.ElementType> = {
  ADMIN: Shield,
  COACH: UserCheck,
  CLIENT: User,
}

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<string>('ALL')
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState('CLIENT')
  const [formMaxClients, setFormMaxClients] = useState(10)
  const [formEmailVerified, setFormEmailVerified] = useState(false)

  const loadUsers = () => {
    setLoading(true)
    getAdminUsers({ role: roleFilter, search: search || undefined })
      .then(setUsers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadUsers() }, [roleFilter])

  useEffect(() => {
    const timer = setTimeout(() => { if (search !== undefined) loadUsers() }, 400)
    return () => clearTimeout(timer)
  }, [search])

  const resetForm = () => {
    setFormName(''); setFormEmail(''); setFormPassword(''); setFormRole('CLIENT')
    setFormMaxClients(10); setFormEmailVerified(false)
    setShowModal(false); setEditUser(null)
  }

  const openEdit = (u: AdminUser) => {
    setEditUser(u)
    setFormName(u.name)
    setFormEmail(u.email)
    setFormRole(u.role)
    setFormMaxClients(u.maxClients ?? 10)
    setFormEmailVerified(u.emailVerified ?? false)
    setFormPassword('')
    setShowModal(true)
  }

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('')
    try {
      if (editUser) {
        const data: Record<string, unknown> = { name: formName, email: formEmail, role: formRole, emailVerified: formEmailVerified }
        if (formRole === 'COACH') data.maxClients = formMaxClients
        if (formPassword) data.password = formPassword
        await updateAdminUser(editUser.id, data)
        setSuccess(`Usuario "${formName}" actualizado`)
      } else {
        if (!formPassword) { setError('Contraseña requerida'); setSaving(false); return }
        const data: Record<string, unknown> = { email: formEmail, password: formPassword, name: formName, role: formRole }
        if (formRole === 'COACH') data.maxClients = formMaxClients
        await createAdminUser(data as any)
        setSuccess(`Usuario "${formName}" creado exitosamente`)
      }
      resetForm()
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally { setSaving(false) }
  }

  const handleDelete = async (id: string) => {
    try {
      await deleteAdminUser(id)
      setSuccess('Usuario eliminado')
      setDeleteConfirm(null)
      loadUsers()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al eliminar')
    }
  }

  // Auto-clear messages
  useEffect(() => {
    if (success) { const t = setTimeout(() => setSuccess(''), 3000); return () => clearTimeout(t) }
  }, [success])

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestión de Usuarios</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} usuarios encontrados</p>
        </div>
        <button onClick={() => { resetForm(); setShowModal(true) }} className="btn-primary" id="btn-create-user">
          <Plus className="w-4 h-4" /> Nuevo Usuario
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-600 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          <button onClick={() => setError('')} className="ml-auto"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 text-sm">
          <Check className="w-4 h-4 shrink-0" /> {success}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            className="input pl-10"
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-1 bg-white rounded-xl p-1">
          {ROLE_TABS.map(tab => (
            <button
              key={tab}
              onClick={() => setRoleFilter(tab)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                roleFilter === tab
                  ? 'bg-brand-600 text-gray-900 shadow-lg shadow-brand-600/25'
                  : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              {tab === 'ALL' ? 'Todos' : tab}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin" /> Cargando usuarios...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Coach Asignado</th>
                  <th>Clientes</th>
                  <th>Registrado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => {
                  const initials = u.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()
                  const colors = ['bg-blue-100 text-blue-600','bg-violet-100 text-violet-600','bg-emerald-100 text-emerald-600','bg-amber-100 text-amber-600']
                  const RIcon = ROLE_ICONS[u.role] || User
                  return (
                    <tr key={u.id} className="border-b border-gray-200 hover:bg-gray-50 transition-colors group">
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${colors[i % colors.length]}`}>
                            {initials}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 text-sm">{u.name}</p>
                            <div className="flex items-center gap-1">
                              <p className="text-xs text-gray-500">{u.email}</p>
                              {u.emailVerified ? (
                                <span title="Email verificado"><MailCheck className="w-3.5 h-3.5 text-green-500" /></span>
                              ) : (
                                <span title="Email no verificado"><MailX className="w-3.5 h-3.5 text-red-500" /></span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className={`${ROLE_COLORS[u.role] || 'badge-blue'} inline-flex items-center gap-1`}>
                          <RIcon className="w-3 h-3" /> {u.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {u.coach ? u.coach.name : u.role === 'CLIENT' ? <span className="text-red-600 text-xs">Sin asignar</span> : '—'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {u.role === 'COACH' ? `${u.clientCount || 0}/${u.maxClients || 10}` : '—'}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-500">
                        {new Date(u.createdAt).toLocaleDateString('es-ES')}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEdit(u)} className="btn-ghost text-xs py-1.5 px-3">
                            <Edit3 className="w-3.5 h-3.5" /> Editar
                          </button>
                          {deleteConfirm === u.id ? (
                            <div className="flex gap-1">
                              <button onClick={() => handleDelete(u.id)} className="btn-ghost text-xs py-1.5 px-2 text-red-600 hover:bg-red-50">Confirmar</button>
                              <button onClick={() => setDeleteConfirm(null)} className="btn-ghost text-xs py-1.5 px-2">Cancelar</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(u.id)} className="btn-ghost text-xs py-1.5 px-3 text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-sm fade-in">
          <div className="card-glass w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900">{editUser ? 'Editar Usuario' : 'Nuevo Usuario'}</h3>
              <button onClick={resetForm} className="btn-ghost p-2"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Nombre completo</label>
                <input className="input" value={formName} onChange={e => setFormName(e.target.value)} placeholder="Nombre del usuario" />
              </div>
              <div>
                <label className="label">Correo electrónico</label>
                <input className="input" type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} placeholder="email@ejemplo.com" />
              </div>
              <div>
                <label className="label">{editUser ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                <input className="input" type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} placeholder="••••••••" />
              </div>
              <div>
                <label className="label">Rol</label>
                <div className="flex gap-2">
                  {['CLIENT', 'COACH', 'ADMIN'].map(r => (
                    <button
                      key={r}
                      onClick={() => setFormRole(r)}
                      className={`flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                        formRole === r
                          ? 'bg-brand-600 text-gray-900 border-brand-500 shadow-lg shadow-brand-600/25'
                          : 'bg-gray-100 text-gray-500 border-gray-300 hover:border-gray-300'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              
              {formRole === 'COACH' && (
                <div>
                  <label className="label">Máximo de clientes</label>
                  <input 
                    className="input" 
                    type="number" 
                    min="1" 
                    value={formMaxClients} 
                    onChange={e => setFormMaxClients(Number(e.target.value))} 
                  />
                </div>
              )}

              {editUser && (
                <div className="flex items-center gap-2 pt-2">
                  <input 
                    type="checkbox" 
                    id="emailVerified" 
                    checked={formEmailVerified} 
                    onChange={e => setFormEmailVerified(e.target.checked)} 
                    className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-gray-300" 
                  />
                  <label htmlFor="emailVerified" className="text-sm font-medium text-gray-700 cursor-pointer">
                    Email verificado
                  </label>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !formName || !formEmail}
                className="btn-primary w-full justify-center py-3 mt-4"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {editUser ? 'Guardar Cambios' : 'Crear Usuario'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
