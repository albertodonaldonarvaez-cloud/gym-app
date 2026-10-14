import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Dumbbell, Lock, Eye, EyeOff, Loader2, Check, AlertCircle } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

export default function ResetPasswordPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const strength = password.length >= 12 ? 3 : password.length >= 10 ? 2 : password.length >= 8 ? 1 : 0
  const strengthLabel = ['Muy corta', 'Aceptable', 'Buena', 'Excelente'][strength]
  const strengthColor = ['bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-green-500'][strength]

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) return setError('La contraseña debe tener al menos 8 caracteres.')
    if (password !== confirm) return setError('Las contraseñas no coinciden.')
    setLoading(true)
    try {
      const r = await fetch(`${BASE}/api/v1/auth/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.error || 'No se pudo restablecer la contraseña')
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 3000)
    } catch (err: any) {
      setError(err.message || 'Error de conexión')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F2F2F7]">
      <div className="w-full max-w-md fade-in">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #3d6eff 0%, #8b5cf6 100%)' }}>
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">GymAura</span>
        </div>

        <div className="bg-white rounded-3xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.05)]">
          {done ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Check className="w-8 h-8 text-green-600" strokeWidth={3} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">¡Contraseña actualizada!</h1>
              <p className="text-sm text-gray-500 mb-5">Ya puedes iniciar sesión con tu nueva contraseña. Te llevamos al inicio…</p>
              <Link to="/login" className="inline-block px-6 py-3 rounded-xl bg-[#007AFF] text-white font-semibold text-sm">Iniciar sesión</Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">Nueva contraseña</h1>
              <p className="text-sm text-gray-500 mb-5">Elige una contraseña segura de al menos 8 caracteres.</p>
              <form onSubmit={submit} className="space-y-4">
                <div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={show ? 'text' : 'password'} required autoFocus value={password}
                      onChange={e => setPassword(e.target.value)} placeholder="Nueva contraseña" autoComplete="new-password"
                      className="w-full pl-10 pr-11 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all" />
                    <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {password && (
                    <div className="mt-2">
                      <div className="flex gap-1">
                        {[0, 1, 2].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i < strength ? strengthColor : 'bg-gray-200'}`} />
                        ))}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{strengthLabel}</p>
                    </div>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type={show ? 'text' : 'password'} required value={confirm}
                    onChange={e => setConfirm(e.target.value)} placeholder="Confirmar contraseña" autoComplete="new-password"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all" />
                </div>
                {error && (
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      {error}
                      {/expir|inv[aá]lid/i.test(error) && (
                        <Link to="/forgot-password" className="block mt-1 font-semibold underline">Solicitar un nuevo enlace</Link>
                      )}
                    </div>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-[#007AFF] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Guardar contraseña'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
