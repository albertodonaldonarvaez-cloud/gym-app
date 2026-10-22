import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, Check, Loader2, Minus, MessageSquarePlus, Plus, RotateCcw, Save } from 'lucide-react'
import BodyViewer from './BodyViewer'
import BodyProgress, { ViewButtons } from './BodyProgress'
import {
  HEIGHT_MAX, HEIGHT_MIN, PRESETS, SKIN_TONES, ZONES, applyPreset, defaultParams, estFatPct, fatLabel, muscleLabel,
} from './bodyModel'
import type { BodyParams, Gender, ZoneKey } from './bodyModel'
import { deleteScan, fetchScans, saveScan } from './bodyApi'
import type { BodyScan } from './bodyApi'

type Tab = 'body' | 'muscle' | 'shape'

function Slider({
  label, value, min = 0, max = 100, step = 1, onChange, left, right, display, onActivate, big = false,
}: {
  label: string; value: number; min?: number; max?: number; step?: number
  onChange: (v: number) => void; left?: string; right?: string; display?: string
  onActivate?: () => void; big?: boolean
}) {
  const pct = ((value - min) / (max - min)) * 100
  const nudge = (d: number) => { onActivate?.(); onChange(Math.min(max, Math.max(min, value + d * step))) }
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <label className={`${big ? 'text-base' : 'text-sm'} font-semibold text-gray-800`}>{label}</label>
        <div className="flex items-center gap-1">
          <button type="button" aria-label={`Disminuir ${label}`} onClick={() => nudge(-(max - min > 60 ? 2 : 1))}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-90 active:bg-gray-200 transition-all">
            <Minus className="w-4 h-4" />
          </button>
          <span className="min-w-[4.2rem] text-center text-sm font-bold text-[#007AFF] tabular-nums">{display ?? value}</span>
          <button type="button" aria-label={`Aumentar ${label}`} onClick={() => nudge(max - min > 60 ? 2 : 1)}
            className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center active:scale-90 active:bg-gray-200 transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="py-2.5">
        <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
          onPointerDown={onActivate}
          onChange={e => onChange(Number(e.target.value))}
          className="bm-range"
          style={{ background: `linear-gradient(to right, #007AFF ${pct}%, #e5e7eb ${pct}%)` }} />
      </div>
      {(left || right) && (
        <div className="flex justify-between text-[10px] text-gray-400 -mt-1.5">
          <span>{left}</span><span>{right}</span>
        </div>
      )}
    </div>
  )
}

const SHAPE: { key: keyof BodyParams; label: string; left: string; right: string }[] = [
  { key: 'shoulders', label: 'Ancho de hombros', left: 'Estrechos', right: 'Anchos' },
  { key: 'chest', label: 'Pecho / busto', left: 'Menos', right: 'Más' },
  { key: 'waist', label: 'Cintura', left: 'Delgada', right: 'Ancha' },
  { key: 'hips', label: 'Caderas', left: 'Estrechas', right: 'Anchas' },
  { key: 'arms', label: 'Grosor de brazos', left: 'Delgados', right: 'Gruesos' },
  { key: 'legs', label: 'Grosor de piernas', left: 'Delgadas', right: 'Gruesas' },
  { key: 'armLen', label: 'Largo de brazos', left: 'Cortos', right: 'Largos' },
  { key: 'legLen', label: 'Largo de piernas', left: 'Cortas', right: 'Largas' },
]

export default function BodyAvatarEditor({ onSaved }: { onSaved?: (p: BodyParams) => void }) {
  const [params, setParams] = useState<BodyParams>(defaultParams('male'))
  const [scans, setScans] = useState<BodyScan[]>([])
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState<'edit' | 'progress'>('edit')
  const [tab, setTab] = useState<Tab>('body')
  const [zone, setZone] = useState<ZoneKey>('chest')
  const [yaw, setYaw] = useState<number | undefined>(undefined)
  const [label, setLabel] = useState('')
  const [noteOpen, setNoteOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [justSaved, setJustSaved] = useState(false)

  const last = scans[scans.length - 1]
  const baseline = last?.params
  const dirty = useMemo(() => !baseline || JSON.stringify(baseline) !== JSON.stringify(params), [baseline, params])
  const zoneDef = ZONES.find(z => z.key === zone)!
  const highlight: ZoneKey | '' = mode === 'edit' && tab === 'muscle' ? zone : ''

  useEffect(() => {
    fetchScans()
      .then(list => { setScans(list); if (list.length) setParams(list[list.length - 1].params) })
      .catch(() => setError('No se pudieron cargar tus registros. Puedes editar, pero revisa tu conexión para guardar.'))
      .finally(() => setLoading(false))
  }, [])

  const set = <K extends keyof BodyParams>(k: K, v: BodyParams[K]) => { setParams(p => ({ ...p, [k]: v })); setJustSaved(false) }
  const pickZone = (z: ZoneKey) => { setZone(z); setYaw(ZONES.find(x => x.key === z)!.yaw) }
  const goTab = (t: Tab) => { setTab(t); if (t === 'muscle') setYaw(zoneDef.yaw) }
  const zoneLevel = (z: (typeof ZONES)[number]) => Math.round(Math.min(1, Math.max(0, params.muscle / 100 + (Number(params[z.field]) - 50) / 100)) * 100)

  const save = async () => {
    setSaving(true); setError('')
    try {
      const s = await saveScan(params, label.trim())
      setScans(prev => [...prev, s])
      setLabel(''); setNoteOpen(false); setJustSaved(true)
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
    <div className="space-y-3">
      {/* Modo: editar / progreso */}
      <div className="flex p-1 bg-gray-200/70 rounded-2xl">
        {([['edit', 'Mi cuerpo'], ['progress', `Progreso${scans.length ? ` (${scans.length})` : ''}`]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setMode(k)}
            className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-all ${mode === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
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
      ) : mode === 'progress' ? (
        <BodyProgress scans={scans} onDelete={remove}
          onLoad={s => { setParams(s.params); setMode('edit'); setJustSaved(false) }} />
      ) : (
        <>
          {scans.length === 0 && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-100">
              <p className="text-sm font-semibold text-blue-900">Crea tu avatar 3D</p>
              <p className="text-xs text-blue-800/80 mt-0.5 leading-relaxed">
                Elige un punto de partida y ajústalo hasta parecerte a cómo estás hoy. Tu coach lo usará para planear tu entrenamiento y verás tu evolución. No necesitas subir fotos.
              </p>
            </div>
          )}

          {/* Visor (siempre visible mientras ajustas) */}
          <div className="relative rounded-3xl overflow-hidden bg-gradient-to-b from-sky-50 via-blue-50 to-blue-100">
            <div className="absolute top-2.5 left-2.5 right-2.5 z-10 flex items-start justify-between gap-2 pointer-events-none">
              <div className="flex p-1 bg-white/85 backdrop-blur rounded-2xl shadow-sm w-40 pointer-events-auto">
                {genderBtn('male', 'Hombre', '♂')}
                {genderBtn('female', 'Mujer', '♀')}
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-bold text-gray-700 shadow-sm">{params.heightCm} cm</span>
                <span className="px-2.5 py-1 rounded-full bg-white/85 backdrop-blur text-[11px] font-bold text-gray-700 shadow-sm">≈ {estFatPct(params)}% grasa</span>
              </div>
            </div>
            <BodyViewer params={params} yaw={yaw} onYawChange={setYaw} highlight={highlight}
              className="w-full h-[42vh] min-h-[290px] max-h-[460px]" />
            <div className="absolute bottom-2 left-0 right-0 z-10">
              <ViewButtons onPick={setYaw} />
            </div>
          </div>

          {/* Panel de controles con pestañas */}
          <div className="bg-white rounded-3xl shadow-sm overflow-hidden">
            <div className="flex border-b border-gray-100">
              {([['body', 'Cuerpo'], ['muscle', 'Músculos'], ['shape', 'Proporciones']] as const).map(([k, t]) => (
                <button key={k} type="button" onClick={() => goTab(k)}
                  className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${tab === k ? 'text-[#007AFF]' : 'text-gray-400'}`}>
                  {t}
                  {tab === k && <span className="absolute bottom-0 left-4 right-4 h-0.5 rounded-full bg-[#007AFF]" />}
                </button>
              ))}
            </div>

            <div className="p-4 max-h-[34vh] min-h-[200px] overflow-y-auto overscroll-contain space-y-4">
              {tab === 'body' && (
                <>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Punto de partida</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
                      {PRESETS.map(p => (
                        <button key={p.id} type="button" onClick={() => { setParams(prev => applyPreset(prev, p)); setJustSaved(false) }}
                          className="shrink-0 px-3.5 py-2 rounded-full bg-gray-100 text-xs font-semibold text-gray-700 active:scale-95 active:bg-[#007AFF] active:text-white transition-all">
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Slider label="Altura" value={params.heightCm} min={HEIGHT_MIN} max={HEIGHT_MAX}
                    onChange={v => set('heightCm', v)} display={`${params.heightCm} cm`} left={`${HEIGHT_MIN} cm`} right={`${HEIGHT_MAX} cm`} />
                  <Slider label="Grasa corporal" value={params.fat} onChange={v => set('fat', v)}
                    display={`≈${estFatPct(params)}%`} left="Muy definido" right="Alto" />
                  <p className="text-[11px] text-gray-400 -mt-3">{fatLabel(params)}</p>
                  <Slider label="Masa muscular general" value={params.muscle} onChange={v => set('muscle', v)}
                    display={muscleLabel(params)} left="Poca" right="Mucha" />
                  <p className="text-[11px] text-gray-400 -mt-3">Ajusta cada zona por separado en la pestaña Músculos.</p>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Tono de piel</p>
                    <div className="flex gap-3">
                      {SKIN_TONES.map((c, i) => (
                        <button key={c} type="button" onClick={() => set('skin', i)} aria-label={`Tono ${i + 1}`}
                          className={`w-9 h-9 rounded-full transition-all ${params.skin === i ? 'ring-2 ring-offset-2 ring-[#007AFF] scale-110' : ''}`}
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {tab === 'muscle' && (
                <>
                  <div className="grid grid-cols-4 gap-2">
                    {ZONES.map(z => {
                      const lvl = zoneLevel(z)
                      const on = zone === z.key
                      return (
                        <button key={z.key} type="button" onClick={() => pickZone(z.key)}
                          className={`rounded-2xl px-1 py-2 text-center transition-all active:scale-95 ${on ? 'bg-[#007AFF] text-white shadow-md' : 'bg-gray-100 text-gray-700'}`}>
                          <span className="block text-[11px] font-bold leading-tight">{z.label}</span>
                          <span className={`block h-1 rounded-full mt-1.5 mx-1.5 ${on ? 'bg-white/30' : 'bg-gray-300'}`}>
                            <span className={`block h-full rounded-full ${on ? 'bg-white' : 'bg-[#007AFF]'}`} style={{ width: `${lvl}%` }} />
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <div className="rounded-2xl bg-blue-50/60 p-3.5">
                    <p className="text-[11px] text-blue-900/70 mb-1">{zoneDef.hint} · se ilumina en el modelo</p>
                    <Slider big label={zoneDef.label} value={Number(params[zoneDef.field])}
                      onChange={v => set(zoneDef.field, v as never)} onActivate={() => setYaw(zoneDef.yaw)}
                      display={`${zoneLevel(zoneDef)}%`} left="Menos desarrollo" right="Más desarrollo" />
                    <button type="button" onClick={() => set(zoneDef.field, 50 as never)}
                      className="text-[11px] font-semibold text-[#007AFF] mt-1">Restablecer esta zona</button>
                  </div>
                </>
              )}

              {tab === 'shape' && (
                <div className="space-y-4">
                  {SHAPE.map(f => (
                    <Slider key={f.key} label={f.label} value={params[f.key] as number}
                      onChange={v => set(f.key, v as never)} left={f.left} right={f.right}
                      display={`${(params[f.key] as number) - 50 > 0 ? '+' : ''}${(params[f.key] as number) - 50}`} />
                  ))}
                </div>
              )}
            </div>

            {/* Guardar */}
            <div className="p-3.5 border-t border-gray-100 space-y-2.5 bg-white">
              {noteOpen && (
                <input value={label} onChange={e => setLabel(e.target.value)} maxLength={60} autoFocus
                  placeholder="Nota (ej. Inicio de programa, 3 meses…)"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#007AFF]/30" />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={() => { setParams(baseline ?? defaultParams(params.gender)); setJustSaved(false) }}
                  disabled={!dirty} aria-label="Deshacer cambios"
                  className="w-12 rounded-2xl bg-gray-100 text-gray-600 disabled:opacity-40 active:scale-95 transition-all flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </button>
                <button type="button" onClick={() => setNoteOpen(o => !o)} aria-label="Agregar nota"
                  className={`w-12 rounded-2xl flex items-center justify-center active:scale-95 transition-all ${noteOpen || label ? 'bg-blue-50 text-[#007AFF]' : 'bg-gray-100 text-gray-600'}`}>
                  <MessageSquarePlus className="w-5 h-5" />
                </button>
                <button type="button" onClick={save} disabled={saving || (!dirty && !justSaved)}
                  className={`flex-1 py-3.5 rounded-2xl font-semibold text-[15px] flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 ${
                    justSaved ? 'bg-green-500 text-white' : 'bg-[#007AFF] text-white'
                  }`}>
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" />
                    : justSaved ? <><Check className="w-5 h-5" /> Guardado</>
                    : <><Save className="w-5 h-5" /> {scans.length === 0 ? 'Guardar mi estado actual' : dirty ? 'Guardar nuevo registro' : 'Sin cambios'}</>}
                </button>
              </div>
              <p className="text-[10px] text-gray-400 text-center">El % de grasa es una estimación visual, no una medición médica.</p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
