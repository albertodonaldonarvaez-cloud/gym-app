import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Camera, Save, Loader2, LogOut, Plus, Minus, FileText, ChevronRight } from 'lucide-react'
import BodyPhotosManager from '../../components/BodyPhotosManager'
import { getToken, getUser, clearAuth } from '../clientApi'

const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

const GOALS = [
  'Acondicionamiento Físico', 'Pérdida de peso', 'Ganancia muscular',
  'Fuerza', 'Resistencia', 'Flexibilidad', 'Rehabilitación'
]

export default function ClientProfilePage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const user = getUser()

  const [name, setName] = useState(user?.name || '')
  const [goal, setGoal] = useState('Acondicionamiento Físico')
  const [weightKg, setWeightKg] = useState(70)
  const [heightCm, setHeightCm] = useState(170)
  const [avatar, setAvatar] = useState('')
  const [lookingFor, setLookingFor] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    fetch(`${BASE}/api/v1/user/profile`, {
      headers: { Authorization: `Bearer ${getToken()}` }
    })
      .then(r => r.json())
      .then(d => {
        setName(d.name || '')
        setGoal(d.goal || 'Acondicionamiento Físico')
        setWeightKg(d.weightKg || 70)
        setHeightCm(d.heightCm || 170)
        setAvatar(d.avatar || '')
        setLookingFor(d.lookingFor || '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setSaved(false)
    try {
      const res = await fetch(`${BASE}/api/v1/user/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, goal, weightKg, heightCm, lookingFor })
      })
      if (res.ok) {
        const updated = await res.json()
        localStorage.setItem('gymaura_user', JSON.stringify(updated))
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    } catch {}
    finally { setSaving(false) }
  }

  const handleAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const form = new FormData()
      form.append('avatar', file)
      const res = await fetch(`${BASE}/api/v1/user/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getToken()}` },
        body: form
      })
      if (res.ok) {
        const data = await res.json()
        setAvatar(data.avatar)
        const u = getUser()
        if (u) localStorage.setItem('gymaura_user', JSON.stringify({ ...u, avatar: data.avatar }))
      }
    } catch {}
    finally { setUploading(false) }
  }

  const handleLogout = () => { clearAuth(); navigate('/login') }

  const initials = name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || '?'

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-[#007AFF] animate-spin" />
      </div>
    )
  }

  return (
    <div className="px-4 pt-6 pb-8 max-w-lg mx-auto space-y-6">
      {/* Header */}
      <h1 className="text-2xl font-bold text-gray-900">Mi Perfil</h1>

      {/* Avatar */}
      <div className="flex justify-center">
        <button
          onClick={() => fileRef.current?.click()}
          className="relative group"
          disabled={uploading}
        >
          {avatar ? (
            <img src={`${BASE}${avatar}`} alt="Avatar" className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[#007AFF]/10 flex items-center justify-center border-4 border-white shadow-lg">
              <span className="text-2xl font-bold text-[#007AFF]">{initials}</span>
            </div>
          )}
          <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 group-active:opacity-100 transition-opacity">
            {uploading ? <Loader2 className="w-6 h-6 text-white animate-spin" /> : <Camera className="w-6 h-6 text-white" />}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatar} className="hidden" />
        </button>
      </div>

      {/* Name */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</label>
        <input
          className="w-full mt-1 text-lg font-medium text-gray-900 bg-transparent border-0 outline-none placeholder:text-gray-300"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Tu nombre"
        />
      </div>

      {/* Email (read only) */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Email</label>
        <p className="mt-1 text-gray-500">{user?.email}</p>
      </div>

      {/* Goal */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Objetivo</label>
        <select
          className="w-full mt-1 text-gray-900 bg-transparent border-0 outline-none text-base"
          value={goal}
          onChange={e => setGoal(e.target.value)}
        >
          {GOALS.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {/* Weight */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Peso</label>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setWeightKg(Math.max(30, weightKg - 0.5))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <Minus className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <span className="text-3xl font-bold text-gray-900">{weightKg}</span>
            <span className="text-lg text-gray-400 ml-1">kg</span>
          </div>
          <button
            onClick={() => setWeightKg(Math.min(300, weightKg + 0.5))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* Height */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Estatura</label>
        <div className="flex items-center justify-between mt-2">
          <button
            onClick={() => setHeightCm(Math.max(100, heightCm - 1))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <Minus className="w-5 h-5 text-gray-600" />
          </button>
          <div className="text-center">
            <span className="text-3xl font-bold text-gray-900">{heightCm}</span>
            <span className="text-lg text-gray-400 ml-1">cm</span>
          </div>
          <button
            onClick={() => setHeightCm(Math.min(250, heightCm + 1))}
            className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200 transition-colors"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {/* What are you looking for */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">¿Qué buscas lograr?</label>
        <textarea
          className="w-full mt-2 text-[15px] text-gray-900 bg-gray-50 rounded-xl p-3 border-0 outline-none resize-none placeholder:text-gray-400 focus:ring-2 focus:ring-[#007AFF]/30"
          rows={4}
          maxLength={1000}
          value={lookingFor}
          onChange={e => setLookingFor(e.target.value)}
          placeholder="Cuéntale a tu coach qué quieres lograr: bajar de peso, ganar fuerza, prepararte para una competencia, tus lesiones, cuántos días puedes entrenar…"
        />
        <p className="text-[11px] text-gray-400 mt-1 text-right">{lookingFor.length}/1000</p>
      </div>

      {/* Body photos */}
      <div className="bg-white rounded-2xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Fotos de progreso</label>
          <span className="text-[10px] font-semibold text-[#007AFF] bg-blue-50 px-2 py-0.5 rounded-full">Opcional · Privado</span>
        </div>
        <BodyPhotosManager mode="owner" />
      </div>

      {/* Save */}      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-4 rounded-2xl bg-[#007AFF] text-white font-semibold text-base flex items-center justify-center gap-2 active:bg-[#0066DD] transition-colors disabled:opacity-50"
      >
        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : saved ? '✅ Guardado' : <><Save className="w-5 h-5" /> Guardar cambios</>}
      </button>

      {/* Legal */}
      <Link to="/terms" className="w-full py-3.5 px-4 rounded-2xl bg-white text-gray-700 font-medium text-sm flex items-center gap-3 shadow-sm active:bg-gray-50 transition-colors">
        <FileText className="w-5 h-5 text-gray-400" />
        <span className="flex-1">Términos y Condiciones</span>
        <ChevronRight className="w-4 h-4 text-gray-300" />
      </Link>

      {/* Logout */}      <button
        onClick={handleLogout}
        className="w-full py-3 rounded-2xl bg-white text-red-500 font-medium text-base flex items-center justify-center gap-2 shadow-sm active:bg-red-50 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Cerrar sesión
      </button>
    </div>
  )
}
