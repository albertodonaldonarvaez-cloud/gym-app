import { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Dumbbell, Mail, Loader2, ArrowLeft, MailCheck, AlertCircle } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const r = await fetch(`${BASE}/api/v1/auth/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (r.status === 429) throw new Error('Demasiados intentos. Espera unos minutos e inténtalo de nuevo.')
      if (!r.ok) throw new Error('No se pudo procesar la solicitud')
      setSent(true)
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
          {sent ? (
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <MailCheck className="w-8 h-8 text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Revisa tu correo</h1>
              <p className="text-sm text-gray-500 leading-relaxed mb-1">
                Si <b className="text-gray-700">{email}</b> está registrado, te enviamos un enlace para crear una nueva contraseña.
              </p>
              <p className="text-xs text-gray-400 mb-6">El enlace expira en 1 hora. Revisa también la carpeta de spam.</p>
              <Link to="/login" className="text-sm font-semibold text-[#007AFF]">Volver a iniciar sesión</Link>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-1">¿Olvidaste tu contraseña?</h1>
              <p className="text-sm text-gray-500 mb-5">Escribe tu correo y te enviaremos un enlace para restablecerla.</p>
              <form onSubmit={submit} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input type="email" required autoFocus value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="tu-email@ejemplo.com" autoComplete="email"
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-xl text-gray-900 focus:bg-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent outline-none transition-all" />
                </div>
                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                  </div>
                )}
                <button type="submit" disabled={loading || !email}
                  className="w-full py-3.5 rounded-xl bg-[#007AFF] text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-transform">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar enlace'}
                </button>
              </form>
              <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
                <ArrowLeft className="w-4 h-4" /> Volver
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
