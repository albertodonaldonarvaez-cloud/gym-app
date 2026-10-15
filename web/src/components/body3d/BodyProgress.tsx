import { useEffect, useMemo, useState } from 'react'
import { Trash2, Pencil, TrendingDown, TrendingUp, Minus as Equal } from 'lucide-react'
import BodyViewer from './BodyViewer'
import { estFatPct, muscleLabel } from './bodyModel'
import type { BodyScan } from './bodyApi'

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

export const VIEWS = [
  { label: 'Frente', yaw: 0 },
  { label: 'Perfil', yaw: Math.PI / 2 },
  { label: 'Espalda', yaw: Math.PI },
]

export function ViewButtons({ onPick, dark = false }: { onPick: (yaw: number) => void; dark?: boolean }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {VIEWS.map(v => (
        <button key={v.label} type="button" onClick={() => onPick(v.yaw)}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold backdrop-blur transition-colors active:scale-95 ${
            dark ? 'bg-white/15 text-white' : 'bg-white/80 text-gray-700 shadow-sm'
          }`}>
          {v.label}
        </button>
      ))}
    </div>
  )
}

function Delta({ label, a, b, unit, goodWhen }: { label: string; a: number; b: number; unit: string; goodWhen: 'down' | 'up' | 'none' }) {
  const diff = b - a
  const good = goodWhen === 'none' ? null : goodWhen === 'down' ? diff < 0 : diff > 0
  const color = diff === 0 || good === null ? 'text-gray-500' : good ? 'text-green-600' : 'text-red-500'
  const Icon = diff === 0 ? Equal : diff < 0 ? TrendingDown : TrendingUp
  return (
    <div className="rounded-2xl bg-gray-50 p-3 text-center">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 mt-1">{a}{unit} <span className="text-gray-300">→</span> {b}{unit}</p>
      <p className={`text-xs font-semibold mt-0.5 flex items-center justify-center gap-1 ${color}`}>
        <Icon className="w-3 h-3" />{diff > 0 ? '+' : ''}{diff}{unit}
      </p>
    </div>
  )
}

interface Props {
  scans: BodyScan[]
  readOnly?: boolean
  onDelete?: (id: string) => void
  onLoad?: (scan: BodyScan) => void
}

export default function BodyProgress({ scans, readOnly = false, onDelete, onLoad }: Props) {
  const [yaw, setYaw] = useState(0.3)
  const [beforeId, setBeforeId] = useState('')
  const [afterId, setAfterId] = useState('')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  // Por defecto: el primer registro vs el más reciente
  useEffect(() => {
    if (scans.length === 0) return
    if (!scans.find(s => s.id === beforeId)) setBeforeId(scans[0].id)
    if (!scans.find(s => s.id === afterId)) setAfterId(scans[scans.length - 1].id)
  }, [scans])

  const before = useMemo(() => scans.find(s => s.id === beforeId) ?? scans[0], [scans, beforeId])
  const after = useMemo(() => scans.find(s => s.id === afterId) ?? scans[scans.length - 1], [scans, afterId])

  if (scans.length === 0) {
    return (
      <div className="text-center py-10 px-4">
        <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <TrendingUp className="w-7 h-7 text-[#007AFF]" />
        </div>
        <p className="font-semibold text-gray-700">
          {readOnly ? 'El atleta aún no ha guardado su estado corporal' : 'Aún no hay registros'}
        </p>
        {!readOnly && <p className="text-sm text-gray-400 mt-1">Guarda tu estado actual para empezar a ver tu evolución.</p>}
      </div>
    )
  }

  const single = scans.length === 1
  const options = scans.map(s => (
    <option key={s.id} value={s.id}>{fmt(s.createdAt)}{s.label ? ` · ${s.label}` : ''}</option>
  ))
  const newestFirst = [...scans].reverse()

  return (
    <div className="space-y-4">
      <div className="rounded-3xl overflow-hidden bg-gradient-to-b from-sky-50 to-blue-100 pb-3">
        <div className={`grid ${single ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {[{ k: 'Antes', s: before, id: beforeId, set: setBeforeId }, ...(single ? [] : [{ k: 'Ahora', s: after, id: afterId, set: setAfterId }])].map(col => (
            <div key={col.k} className="min-w-0">
              <div className="px-3 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 text-center">{single ? 'Último registro' : col.k}</p>
                {!single && (
                  <select value={col.id} onChange={e => col.set(e.target.value)}
                    className="w-full mt-1 text-xs font-medium text-gray-700 bg-white/80 rounded-lg px-2 py-1.5 border-0 outline-none">
                    {options}
                  </select>
                )}
              </div>
              <BodyViewer params={col.s.params} yaw={yaw} onYawChange={setYaw} className="w-full h-[360px] sm:h-[420px]" />
            </div>
          ))}
        </div>
        <ViewButtons onPick={setYaw} />
        <p className="text-[11px] text-gray-400 text-center mt-2">Arrastra para girar</p>
      </div>

      {!single && (
        <div className="grid grid-cols-3 gap-2">
          <Delta label="Grasa est." a={estFatPct(before.params)} b={estFatPct(after.params)} unit="%" goodWhen="down" />
          <Delta label="Músculo" a={before.params.muscle} b={after.params.muscle} unit="" goodWhen="up" />
          <Delta label="Altura" a={before.params.heightCm} b={after.params.heightCm} unit="cm" goodWhen="none" />
        </div>
      )}

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 px-1">Historial ({scans.length})</h3>
        <div className="space-y-2">
          {newestFirst.map(s => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {fmt(s.createdAt)}{s.label && <span className="font-normal text-gray-500"> · {s.label}</span>}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.params.gender === 'male' ? 'Hombre' : 'Mujer'} · {s.params.heightCm} cm · ≈{estFatPct(s.params)}% grasa · Músculo {muscleLabel(s.params).toLowerCase()}
                </p>
              </div>
              {!readOnly && (
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => onLoad?.(s)} aria-label="Editar desde este registro"
                    className="w-9 h-9 rounded-full bg-blue-50 text-[#007AFF] flex items-center justify-center active:scale-95">
                    <Pencil className="w-4 h-4" />
                  </button>
                  {confirmId === s.id ? (
                    <button onClick={() => { onDelete?.(s.id); setConfirmId(null) }}
                      className="px-2.5 h-9 rounded-full bg-red-500 text-white text-xs font-bold">¿Seguro?</button>
                  ) : (
                    <button onClick={() => setConfirmId(s.id)} aria-label="Eliminar registro"
                      className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center active:scale-95">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
