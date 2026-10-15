import { useEffect, useMemo, useState } from 'react'
import { Check, ChevronDown, Loader2, RotateCcw, Save, SlidersHorizontal, AlertCircle } from 'lucide-react'
import BodyViewer from './BodyViewer'
import BodyProgress, { ViewButtons } from './BodyProgress'
import {
  HEIGHT_MAX, HEIGHT_MIN, SKIN_TONES, defaultParams, estFatPct, fatLabel, muscleLabel,
} from './bodyModel'
import type { BodyParams, Gender } from './bodyModel'
import { deleteScan, fetchScans, saveScan } from './bodyApi'
import type { BodyScan } from './bodyApi'

function Slider({
  label, value, min = 0, max = 100, onChange, left, right, display,
}: {
  label: string; value: number; min?: number; max?: number
  onChange: (v: number) => void; left?: string; right?: string; display?: string
}) {
  const pct = ((value - min) / (max - min)) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label className="text-sm font-semibold text-gray-800">{label}</label>
        {display && <span className="text-sm font-bold text-[#007AFF] tabular-nums">{display}</span>}
      </div>
      <div className="py-2">
        <input type="range" min={min} max={max} value={value} aria-label={label}
          onChange={e => onChange(Number(e.target.value))}
          className="bm-range"
          style={{ background: `linear-gradient(to right, #007AFF ${pct}%, #e5e7eb ${pct}%)` }} />
      </div>
      {(left || right) && (
        <div className="flex justify-between text-[10px] text-gray-400 -mt-1">
          <span>{left}</span><span>{right}</span>
        </div>
      )}
    </div>
  )
}

const FINE: { key: keyof BodyParams; label: string; left: string; right: string }[] = [
  { key: 'shoulders', label: 'Hombros', left: 'Estrechos', right: 'Anchos' },
  { key: 'chest', label: 'Pecho / busto', left: 'Menos', right: 'Más' },
  { key: 'waist', label: 'Cintura', left: 'Delgada', right: 'Ancha' },
  { key: 'hips', label: 'Caderas', left: 'Estrechas', right: 'Anchas' },
  { key: 'arms', label: 'Brazos', left: 'Delgados', right: 'Gruesos' },
  { key: 'legs', label: 'Piernas', left: 'Delgadas', right: 'Gruesas' },
]

export default function BodyAvatarEditor({ onSaved }: { onSaved?: (p: BodyParams) => void }) {
  const [params, setParams] = useState<BodyParams>(defaultParams('male'))
  const [scans, setScans] = useState<BodyScan[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'edit' | 'progress'>('edit')
  const [fineOpen, setFineOpen] = useState(false)
  const [yaw, setYaw] = useState<number | undefined>(undefined)
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const last = scans[scans.length - 1]
  const baseline = last?.params
  const dirty = useMemo(() => !baseline || JSON.stringify(baseline) !== JSON.stringify(params), [baseline, params])

  useEffect(() => {
    fetchScans()
      .then(list => { setScans(list); if (list.length) setParams(list[list.length - 1].params) })
      .catch(() => setError('No se pudieron cargar tus registros. Puedes editar igualmente, pero revisa tu conexión para guardar.'))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof BodyParams>(k: K, v: BodyParams[K]) => { setParams(p => ({ ...p, [k]: v })); setJustSaved(false) }

  const save = async () => {
    setSaving(true); setError('')
    try {
      const s = await saveScan(params, label.trim())
      setScans(prev => [...prev, s])
      setLabel(''); setJustSaved(true)
      onSaved?.(params)
      setTimeout(() => setJustSaved(false), 2500)
    } catch (e: any) {
      setError(e.message || 'No se pudo guardar. Revisa tu conexión.')
    } finally { setSaving(false) }
  }

  const remove = async (id: string) => {
    try { await deleteScan(id); setScans(prev => prev.filter(s => s.id !== id)) }
    catch { setError('No se pudo eliminar el registro') }
  }

  const genderBtn = (g: Gender, text: string, symbol: string) => (
    <button type="button" onClick={() => set('gender', g)}
      className={`flex-1 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-all ${
        params.gender === g ? 'bg-[#007AFF] text-white shadow' : 'text-gray-600'
      }`}>
      <span className="text-base leading-none">{symbol}</span>{text}
    </button>
  )

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex p-1 bg-gray-200/70 rounded-2xl">
        {([['edit', 'Mi cuerpo'], ['progress', `Progreso${scans.length ? ` (${scans.length})` : ''}`]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#007AFF] animate-spin" /></div>
      ) : tab === 'progress' ? (
        <BodyProgress scans={scans} onDelete={remove}
          onLoad={s => { setParams(s.params); setTab('edit'); setJustSaved(false) }} />
      ) : (
        <>
          {scans.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-sm font-semibold text-blue-900">Crea tu avatar 3D</p>
              <p className="text-xs text-blue-800/80 mt-0.5 leading-relaxed">
                Elige hombre o mujer y mueve los deslizadores hasta que se parezca a cómo estás hoy. Tu coach lo usará para planear tu entrenamiento y verás tu evolución con el tiempo. No necesitas subir fotos.
              </p>
            </div>
          )}

          {/* Visor */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-sky-50 via-blue-50 to-blue-100">
            <div className="absolute top-3 left-3 right-3 z-10 flex items-start justify-between gap-2">
              <div className="flex p-1 bg-white/85 backdrop-blur rounded-2xl shadow-sm w-44">
                {genderBtn('male', 'Hombre', '♂')}
                {genderBtn('female', 'Mujer', '♀')}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-bold text-gray-700 shadow-sm">{params.heightCm} cm</span>
                <span className="px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-bold text-gray-700 shadow-sm">≈ {estFatPct(params)}% grasa</span>
              </div>
            </div>
            <BodyViewer params={params} yaw={yaw} onYawChange={setYaw} className="w-full h-[440px] sm:h-[500px]" />
            <div className="absolute bottom-3 left-0 right-0 z-10">
              <ViewButtons onPick={setYaw} />
              <p className="text-[11px] text-gray-400 text-center mt-1.5">Arrastra para girar</p>
            </div>
          </div>

          {/* Tono de piel */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-sm font-semibold text-gray-800 mb-2.5">Tono de piel</p>
            <div className="flex gap-3">
              {SKIN_TONES.map((c, i) => (
                <button key={c} type="button" onClick={() => set('skin', i)} aria-label={`Tono ${i + 1}`}
                  className={`w-9 h-9 rounded-full transition-all ${params.skin === i ? 'ring-2 ring-offset-2 ring-[#007AFF] scale-110' : ''}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>

          {/* Controles principales */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <Slider label="Altura" value={params.heightCm} min={HEIGHT_MIN} max={HEIGHT_MAX}
              onChange={v => set('heightCm', v)} display={`${params.heightCm} cm`} left={`${HEIGHT_MIN} cm`} right={`${HEIGHT_MAX} cm`} />
            <Slider label="Grasa corporal" value={params.fat} onChange={v => set('fat', v)}
              display={`${fatLabel(params)} · ≈${estFatPct(params)}%`} left="Muy definido" right="Alto" />
            <Slider label="Masa muscular" value={params.muscle} onChange={v => set('muscle', v)}
              display={muscleLabel(params)} left="Poca" right="Mucha" />
          </div>

          {/* Ajuste fino */}
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <button type="button" onClick={() => setFineOpen(o => !o)}
              className="w-full flex items-center gap-2.5 p-4 text-left">
              <SlidersHorizontal className="w-4 h-4 text-gray-400" />
              <span className="flex-1 text-sm font-semibold text-gray-800">Ajuste fino por zonas</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${fineOpen ? 'rotate-180' : ''}`} />
            </button>
            {fineOpen && (
              <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                {FINE.map(f => (
                  <Slider key={f.key} label={f.label} value={params[f.key] as number}
                    onChange={v => set(f.key, v as never)} left={f.left} right={f.right} />
                ))}
              </div>
            )}
          </div>

          {/* Guardar */}
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60}
              placeholder="Nota opcional (ej. Inicio de programa, 3 meses…)"
              className="w-full px-3.5 py-3 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
            <div className="flex gap-2">
              <button type="button" onClick={() => { setParams(baseline ?? defaultParams(params.gender)); setJustSaved(false) }}
                disabled={!dirty} aria-label="Deshacer cambios"
                className="px-4 rounded-2xl bg-gray-100 text-gray-600 disabled:opacity-40 active:scale-95 transition-all">
                <RotateCcw className="w-5 h-5" />
              </button>
              <button type="button" onClick={save} disabled={saving || (!dirty && !justSaved)}
                className={`flex-1 py-3.5 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                  justSaved ? 'bg-green-500 text-white' : 'bg-[#007AFF] text-white'
                }`}>
                {saving ? <Loader2 className="w-5 h-5 animate-spin" />
                  : justSaved ? <><Check className="w-5 h-5" /> Guardado</>
                  : <><Save className="w-5 h-5" /> {scans.length === 0 ? 'Guardar mi estado actual' : dirty ? 'Guardar nuevo registro' : 'Sin cambios'}</>}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 text-center leading-relaxed">
              Cada registro guarda la fecha para que veas tu progreso. El % de grasa es una estimación visual, no una medición médica.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
