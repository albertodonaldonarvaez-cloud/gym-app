import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, Loader2, LogOut } from 'lucide-react'
import { TermsBody } from '../pages/TermsPage'
import { TERMS_VERSION } from '../termsContent'

const BASE = import.meta.env.VITE_API_URL ?? ''

/**
 * Blocks the app until the logged-in user has accepted the current Terms & Conditions.
 * Existing accounts are asked once; whenever TERMS_VERSION changes they are asked again.
 */
export default function TermsGate() {
  const [needsAccept, setNeedsAccept] = useState(false)
  const [checked, setChecked] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('gymaura_token')
    if (!token) return
    fetch(`${BASE}/api/v1/user/profile`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (d && (!d.termsAcceptedAt || d.termsVersion !== TERMS_VERSION)) setNeedsAccept(true) })
      .catch(() => {}) // offline: don't block the gym session
  }, [])

  if (!needsAccept) return null

  const accept = async () => {
    setBusy(true); setError('')
    try {
      const r = await fetch(`${BASE}/api/v1/user/accept-terms`, {
        method: 'POST', headers: { Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` },
      })
      if (!r.ok) throw new Error()
      setNeedsAccept(false)
    } catch { setError('No se pudo guardar tu aceptación. Revisa tu conexión e intenta de nuevo.') }
    finally { setBusy(false) }
  }

  const decline = () => {
    localStorage.removeItem('gymaura_token'); localStorage.removeItem('gymaura_user')
    window.location.href = '/login'
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4">
      <div className="bg-white w-full sm:max-w-xl rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh]">
        <div className="p-5 pb-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#007AFF]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 leading-tight">Términos y Condiciones</h2>
              <p className="text-xs text-gray-500">Lee y acepta para continuar usando GymAura</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 overscroll-contain">
          <TermsBody />
        </div>

        <div className="p-5 pt-3 border-t border-gray-100 shrink-0 space-y-3"
             style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded accent-[#007AFF] shrink-0" />
            <span className="text-[13px] text-gray-700 leading-snug">
              He leído y acepto los Términos y Condiciones y el Aviso de Privacidad, incluido el tratamiento de mis datos de condición física y mi avatar corporal 3D.{' '}
              <Link to="/terms" target="_blank" className="text-[#007AFF] underline">Abrir en otra pestaña</Link>
            </span>
          </label>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={decline}
              className="px-4 py-3 rounded-2xl bg-gray-100 text-gray-600 font-semibold text-sm flex items-center gap-1.5 active:bg-gray-200">
              <LogOut className="w-4 h-4" /> No acepto
            </button>
            <button onClick={accept} disabled={!checked || busy}
              className="flex-1 py-3 rounded-2xl bg-[#007AFF] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 active:scale-[0.98] transition-all">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Aceptar y continuar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
