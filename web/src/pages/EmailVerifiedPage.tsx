import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { Check, X, Dumbbell, ArrowRight, Mail, ShieldCheck, Sparkles } from 'lucide-react'

const REDIRECT_SECONDS = 6

export default function EmailVerifiedPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const status = params.get('status') ?? 'error'
  const name = params.get('name') ?? ''
  const ok = status === 'ok'

  const token = localStorage.getItem('gymaura_token')
  const stored = (() => { try { return JSON.parse(localStorage.getItem('gymaura_user') ?? 'null') } catch { return null } })()
  const isLogged = !!token && !!stored
  const target = isLogged ? (stored.role === 'CLIENT' ? '/client' : '/dashboard') : '/login'
  const [left, setLeft] = useState(REDIRECT_SECONDS)

  // Keep local session in sync so the "unverified" banner disappears immediately
  useEffect(() => {
    if (ok && stored) {
      localStorage.setItem('gymaura_user', JSON.stringify({ ...stored, emailVerified: true }))
    }
  }, [ok])

  useEffect(() => {
    if (!ok) return
    if (left <= 0) { navigate(target, { replace: true }); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [ok, left])

  const errorText = status === 'invalid'
    ? { title: 'Enlace inválido o expirado', msg: 'Este enlace de verificación ya no es válido. Inicia sesión y pulsa “Verificar ahora” para recibir uno nuevo.' }
    : { title: 'No pudimos verificar tu correo', msg: 'Ocurrió un problema en el servidor. Intenta de nuevo en unos minutos.' }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
         style={{ background: 'radial-gradient(ellipse at 20% 30%, rgba(52,199,89,0.10) 0%, transparent 55%), radial-gradient(ellipse at 80% 70%, rgba(0,122,255,0.10) 0%, transparent 55%), #F2F2F7' }}>
      <div className="w-full max-w-md fade-in">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
               style={{ background: 'linear-gradient(135deg, #3d6eff 0%, #8b5cf6 100%)' }}>
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-900">GymAura</span>
        </div>

        <div className="bg-white rounded-3xl p-8 text-center shadow-[0_8px_30px_rgb(0,0,0,0.06)]">
          {ok ? (
            <>
              <div className="relative w-24 h-24 mx-auto mb-6">
                <span className="absolute inset-0 rounded-full bg-green-400/25 animate-ping" />
                <div className="relative w-24 h-24 rounded-full flex items-center justify-center shadow-lg shadow-green-500/30"
                     style={{ background: 'linear-gradient(135deg, #34C759 0%, #30B0C7 100%)' }}>
                  <Check className="w-12 h-12 text-white" strokeWidth={3} />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Correo verificado{name ? `, ${name}` : ''}!
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">
                Tu cuenta ya está confirmada. Recibirás avisos importantes de tu entrenamiento en este correo.
              </p>

              <div className="grid grid-cols-3 gap-2 mb-6">
                {[{ i: Mail, t: 'Correo' }, { i: ShieldCheck, t: 'Cuenta segura' }, { i: Sparkles, t: 'Todo listo' }].map(({ i: I, t }) => (
                  <div key={t} className="rounded-2xl bg-green-50 py-3 flex flex-col items-center gap-1">
                    <I className="w-5 h-5 text-green-600" />
                    <span className="text-[11px] font-semibold text-green-700">{t}</span>
                  </div>
                ))}
              </div>

              <button onClick={() => navigate(target, { replace: true })}
                className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
                {isLogged ? 'Ir a mi panel' : 'Iniciar sesión'} <ArrowRight className="w-4 h-4" />
              </button>
              <p className="text-xs text-gray-400 mt-3">Redirigiendo automáticamente en {left}s…</p>
              <div className="h-1 bg-gray-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-[#007AFF] transition-all duration-1000 ease-linear"
                     style={{ width: `${((REDIRECT_SECONDS - left) / REDIRECT_SECONDS) * 100}%` }} />
              </div>
            </>
          ) : (
            <>
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-5">
                <X className="w-10 h-10 text-red-500" strokeWidth={3} />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{errorText.title}</h1>
              <p className="text-gray-500 text-sm leading-relaxed mb-6">{errorText.msg}</p>
              <Link to="/login"
                className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white font-semibold flex items-center justify-center gap-2">
                Ir a iniciar sesión <ArrowRight className="w-4 h-4" />
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
