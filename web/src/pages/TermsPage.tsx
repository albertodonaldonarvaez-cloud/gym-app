import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Dumbbell, FileText, AlertTriangle } from 'lucide-react'
import { TERMS_SECTIONS, TERMS_UPDATED, TERMS_VERSION } from '../termsContent'

export function TermsBody() {
  return (
    <div className="space-y-4">
      {TERMS_SECTIONS.map(s => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h3 className="text-sm font-bold text-gray-900 mb-1.5">{s.title}</h3>
          {s.highlight && (
            <div className="flex gap-2.5 p-3 mb-2 rounded-xl bg-amber-50 border border-amber-200">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed font-medium">{s.highlight}</p>
            </div>
          )}
          {s.paragraphs?.map((p, i) => (
            <p key={i} className="text-[13px] text-gray-600 leading-relaxed mb-1.5">{p}</p>
          ))}
          {s.bullets && (
            <ul className="space-y-1 mt-1">
              {s.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 text-[13px] text-gray-600 leading-relaxed">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#007AFF] shrink-0 mt-2" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}

export default function TermsPage() {
  const [token] = useState(() => localStorage.getItem('gymaura_token'))
  return (
    <div className="min-h-screen bg-[#F2F2F7]">
      <header className="sticky top-0 z-10 bg-white/85 backdrop-blur-xl border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link to={token ? '/' : '/login'} className="flex items-center gap-1.5 text-sm font-medium text-[#007AFF]">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center"
                 style={{ background: 'linear-gradient(135deg, #3d6eff 0%, #8b5cf6 100%)' }}>
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-sm">GymAura</span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 md:py-10">
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-100 text-[#007AFF] text-xs font-semibold mb-3">
            <FileText className="w-3.5 h-3.5" /> Documento legal
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Términos y Condiciones y Aviso de Privacidad</h1>
          <p className="text-sm text-gray-500 mt-1.5">Última actualización: {TERMS_UPDATED} · Versión {TERMS_VERSION}</p>
        </div>

        {/* Quick index */}
        <nav className="flex gap-1.5 flex-wrap mb-5">
          {TERMS_SECTIONS.map(s => (
            <a key={s.id} href={`#${s.id}`}
               className="px-2.5 py-1 rounded-full bg-white border border-gray-200 text-[11px] font-medium text-gray-600 hover:border-[#007AFF] hover:text-[#007AFF] transition-colors">
              {s.title.replace(/^\d+\.\s/, '')}
            </a>
          ))}
        </nav>

        <div className="bg-white rounded-3xl p-5 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
          <TermsBody />
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">© {new Date().getFullYear()} TecTi · San Luis Potosí, México · www.tecti.com.mx</p>
      </main>
    </div>
  )
}
