import { useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getAthletes, getExercises, getRoutineForAthlete, saveRoutine
} from '../api'
import type { Athlete, Exercise, RoutineDay, RoutineExercise } from '../api'
import {
  ChevronDown, Search, Plus, X, Save, Loader2, Dumbbell,
  ChevronUp, GripVertical, Info, SlidersHorizontal, Users, FileText, Trash2, Copy,
  ArrowUp, ArrowDown, Minus, Undo2, AlertCircle, CopyPlus, Timer
} from 'lucide-react'
import clsx from 'clsx'

const BASE = import.meta.env.VITE_API_URL ?? ''
const getHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${localStorage.getItem('gymaura_token')}`
})

export type Template = {
  id: string;
  title: string;
  description: string;
  schedule: Record<string, RoutineDay>;
  createdAt?: string;
  updatedAt?: string;
}

async function getTemplates(): Promise<Template[]> {
  const res = await fetch(`${BASE}/api/v1/coach/templates`, { headers: getHeaders() })
  if (!res.ok) throw new Error('Failed to load templates')
  return res.json()
}

async function saveTemplateApi(data: Partial<Template>): Promise<Template> {
  const res = await fetch(`${BASE}/api/v1/coach/templates`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data)
  })
  if (!res.ok) throw new Error('Failed to save template')
  return res.json()
}

async function deleteTemplateApi(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/coach/templates/${id}`, {
    method: 'DELETE',
    headers: getHeaders()
  })
  if (!res.ok) throw new Error('Failed to delete template')
}

async function assignTemplateApi(id: string, clientIds: string[]): Promise<void> {
  const res = await fetch(`${BASE}/api/v1/coach/templates/${id}/assign`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ clientIds })
  })
  if (!res.ok) throw new Error('Failed to assign template')
}


const DAYS = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo']


function exerciseImg(ex: Exercise): string {
  if (ex.imageUrls?.length) return ex.imageUrls[0]
  if (ex.mediaUrl) return ex.mediaUrl
  return ''
}

// ── Exercise picker modal ──────────────────────────────────────────────────────
function ExercisePicker({
  onSelect, onClose
}: { onSelect: (ex: Exercise) => void; onClose: () => void }) {
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [muscle, setMuscle]     = useState('')
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading]   = useState(false)
  const [page, setPage]         = useState(1)
  const [pages, setPages]       = useState(1)
  const [total, setTotal]       = useState(0)
  const [hoveredEx, setHoveredEx] = useState<Exercise | null>(null)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await getExercises({ search, category, muscle_group: muscle, page: p, limit: 20 })
      // Handle both array and paginated response shapes
      if (Array.isArray(res)) {
        setExercises(res as unknown as Exercise[])
        setPages(1); setTotal((res as unknown as Exercise[]).length)
      } else {
        setExercises(res.data)
        setPages(res.pages)
        setTotal(res.total)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search, category, muscle])

  useEffect(() => { setPage(1); load(1) }, [load])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-3xl bg-white border border-gray-300 rounded-2xl shadow-2xl flex flex-col max-h-[85vh]"
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-blue-600" />
            <h3 className="font-semibold text-gray-900">Catálogo de Ejercicios</h3>
            <span className="badge-blue">{total} ejercicios</span>
          </div>
          <button id="btn-close-picker" onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-4 border-b border-gray-200 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="exercise-search"
              className="input pl-9"
              placeholder="Buscar ejercicio..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <select
                className="input appearance-none pr-8"
                value={category}
                onChange={e => setCategory(e.target.value)}
              >
                <option value="">Todas las categorías</option>
                {['Fuerza','Cardio','Estiramiento','Pliométricos','Powerlifting','Halterofilia','Strongman'].map(c =>
                  <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
            <div className="flex-1 relative">
              <select
                className="input appearance-none pr-8"
                value={muscle}
                onChange={e => setMuscle(e.target.value)}
              >
                <option value="">Todos los músculos</option>
                {['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Isquiotibiales','Glúteos','Abdomen','Gemelos'].map(m =>
                  <option key={m} value={m}>{m}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Content — split: list + preview */}
        <div className="flex flex-1 overflow-hidden">
          {/* Exercise list */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
              </div>
            ) : exercises.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500 gap-2">
                <Dumbbell className="w-10 h-10 opacity-20" />
                <p className="text-sm">Sin resultados</p>
              </div>
            ) : (
              <ul>
                {exercises.map(ex => (
                  <li key={ex.id}
                      className={clsx(
                        'flex items-center gap-3 px-4 py-3 cursor-pointer border-b border-gray-200',
                        'hover:bg-gray-100 transition-colors',
                        hoveredEx?.id === ex.id && 'bg-gray-100'
                      )}
                      onMouseEnter={() => setHoveredEx(ex)}
                      onMouseLeave={() => setHoveredEx(null)}
                      onClick={() => onSelect(ex)}
                  >
                    {/* Thumbnail */}
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                      {exerciseImg(ex) ? (
                        <img src={exerciseImg(ex)} alt={ex.name}
                             className="w-full h-full object-cover"
                             onError={(e) => { e.currentTarget.style.display='none' }} />
                      ) : (
                        <Dumbbell className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{ex.name}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="badge-purple text-[10px] py-0">{ex.muscleGroup || ex.targetMuscle}</span>
                        <span className="badge-gray text-[10px] py-0">{ex.equipment}</span>
                      </div>
                    </div>
                    <Plus className="w-4 h-4 text-gray-500 shrink-0" />
                  </li>
                ))}
              </ul>
            )}

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 py-4 border-t border-gray-200">
                <button className="btn-ghost py-1.5 px-3 text-xs" disabled={page === 1}
                        onClick={() => { setPage(p => p-1); load(page-1) }}>
                  ← Anterior
                </button>
                <span className="text-xs text-gray-500">{page} / {pages}</span>
                <button className="btn-ghost py-1.5 px-3 text-xs" disabled={page === pages}
                        onClick={() => { setPage(p => p+1); load(page+1) }}>
                  Siguiente →
                </button>
              </div>
            )}
          </div>

          {/* Preview panel — desktop only */}
          {hoveredEx && (
            <div className="hidden lg:flex w-56 border-l border-gray-200 p-4 flex-col gap-3 slide-in overflow-hidden">
              <div className="aspect-video rounded-xl overflow-hidden bg-gray-100">
                {hoveredEx.imageUrls?.[0] ? (
                  <img src={hoveredEx.imageUrls[0]} alt={hoveredEx.name}
                       className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Dumbbell className="w-8 h-8 text-gray-500" />
                  </div>
                )}
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm leading-tight">{hoveredEx.name}</p>
                <p className="text-xs text-gray-500 mt-1">{hoveredEx.category} · {hoveredEx.equipment}</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed line-clamp-4">
                {hoveredEx.instructions?.split('\n')[0] || ''}
              </p>
              <div className="flex flex-wrap gap-1">
                <span className="badge-purple">{hoveredEx.muscleGroup || hoveredEx.targetMuscle}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Exercise row in routine ────────────────────────────────────────────────────
function Stepper({ label, value, min, max, step = 1, onChange, unit }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void; unit?: string
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n))
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-1">{label}</p>
      <div className="inline-flex items-center bg-white border border-gray-200 rounded-xl overflow-hidden">
        <button type="button" aria-label={`Menos ${label}`} onClick={() => onChange(clamp(Math.round((value - step) * 10) / 10))}
          className="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-100">
          <Minus className="w-4 h-4" />
        </button>
        <div className="w-14 text-center">
          <input type="number" inputMode="decimal" value={Number.isFinite(value) ? value : ''}
            onChange={e => { const n = Number(e.target.value); if (!Number.isNaN(n)) onChange(clamp(n)) }}
            className="w-full h-10 text-center text-sm font-bold text-gray-900 bg-transparent outline-none" />
        </div>
        <button type="button" aria-label={`Más ${label}`} onClick={() => onChange(clamp(Math.round((value + step) * 10) / 10))}
          className="w-10 h-10 flex items-center justify-center text-gray-600 active:bg-gray-100">
          <Plus className="w-4 h-4" />
        </button>
      </div>
      {unit && <span className="text-[10px] text-gray-400 ml-1">{unit}</span>}
    </div>
  )
}

function RoutineExerciseRow({
  item, index, total, exercise, onChange, onRemove, onMove, onDuplicate
}: {
  item: RoutineExercise
  index: number
  total: number
  exercise?: Exercise
  onChange: (updated: RoutineExercise) => void
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
  onDuplicate: () => void
}) {
  const [open, setOpen] = useState(false)
  const imgUrl = exercise?.imageUrls?.[0] ?? exercise?.mediaUrl ?? item.mediaUrl ?? ''
  const details = item.setDetails
  const custom = !!details && details.length > 0

  // Keep legacy fields (sets / reps / targetWeightKg) in sync so older clients keep working
  const withDetails = (d: { reps: number; weightKg?: number }[]): RoutineExercise => ({
    ...item,
    setDetails: d,
    sets: d.length,
    reps: d[0]?.reps ?? item.reps,
    targetWeightKg: d[0]?.weightKg ?? item.targetWeightKg,
  })
  const setSetCount = (n: number) => {
    if (custom) {
      const d = [...details!]
      while (d.length < n) d.push({ ...(d[d.length - 1] ?? { reps: item.reps }) })
      onChange(withDetails(d.slice(0, n)))
    } else onChange({ ...item, sets: n })
  }
  const toggleCustom = () => {
    if (custom) {
      onChange({ ...item, setDetails: undefined, sets: details!.length, reps: details![0]?.reps ?? item.reps })
    } else {
      onChange(withDetails(Array.from({ length: item.sets }, () => ({ reps: item.reps, weightKg: item.targetWeightKg }))))
      setOpen(true)
    }
  }
  const patchSet = (i: number, patch: Partial<{ reps: number; weightKg?: number }>) =>
    onChange(withDetails(details!.map((d, k) => (k === i ? { ...d, ...patch } : d))))
  const removeSet = (i: number) => details!.length > 1 && onChange(withDetails(details!.filter((_, k) => k !== i)))

  return (
    <div className="border border-gray-200 rounded-2xl bg-white shadow-sm overflow-hidden">
      <div className="flex gap-3 p-3 sm:p-4">
        {/* Order controls */}
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button type="button" aria-label="Subir" disabled={index === 0} onClick={() => onMove(-1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-25">
            <ArrowUp className="w-4 h-4" />
          </button>
          <span className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center">{index + 1}</span>
          <button type="button" aria-label="Bajar" disabled={index === total - 1} onClick={() => onMove(1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-25">
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>

        <div className="w-14 h-14 rounded-xl overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
          {imgUrl ? (
            <img src={imgUrl} alt="" className="w-full h-full object-cover" onError={e => { e.currentTarget.style.display = 'none' }} />
          ) : <Dumbbell className="w-5 h-5 text-gray-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">{item.name || exercise?.name || 'Ejercicio'}</p>
          {(exercise || item.muscleGroup) && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{exercise?.muscleGroup || exercise?.targetMuscle || item.muscleGroup}{exercise?.equipment ? ` · ${exercise.equipment}` : ''}</p>
          )}
          <p className="text-xs font-medium text-blue-600 mt-1">
            {custom ? details!.map(d => d.reps).join(' / ') + ' reps' : `${item.sets} × ${item.reps}`}
            {(custom ? details![0]?.weightKg : item.targetWeightKg) ? ` · ${custom ? details![0]?.weightKg : item.targetWeightKg} kg` : ''}
          </p>
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button type="button" aria-label="Quitar ejercicio" onClick={onRemove}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-red-500 bg-red-50 hover:bg-red-100 active:scale-95 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
          <button type="button" aria-label="Duplicar ejercicio" onClick={onDuplicate}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 active:scale-95 transition-all">
            <Copy className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Quick editing */}
      <div className="px-3 sm:px-4 pb-3 flex flex-wrap items-end gap-x-5 gap-y-3">
        <Stepper label="Series" value={custom ? details!.length : item.sets} min={1} max={20} onChange={setSetCount} />
        {!custom && <Stepper label="Reps" value={item.reps} min={1} max={100} onChange={v => onChange({ ...item, reps: v })} />}
        {!custom && <Stepper label="Peso (kg)" value={item.targetWeightKg ?? 0} min={0} max={500} step={2.5} onChange={v => onChange({ ...item, targetWeightKg: v || undefined })} />}
        <button type="button" onClick={() => (custom ? setOpen(o => !o) : toggleCustom())}
          className="ml-auto h-10 px-3 rounded-xl text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 flex items-center gap-1.5">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {custom ? (open ? 'Ocultar series' : 'Editar series') : 'Personalizar series'}
        </button>
      </div>

      {/* Per-set customization */}
      {custom && open && (
        <div className="px-3 sm:px-4 pb-3 space-y-2 fade-in">
          <div className="rounded-xl bg-gray-50 p-3 space-y-2">
            <div className="grid grid-cols-[3rem_1fr_1fr_2rem] gap-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400 px-1">
              <span>Serie</span><span>Reps</span><span>Peso kg</span><span />
            </div>
            {details!.map((d, i) => (
              <div key={i} className="grid grid-cols-[3rem_1fr_1fr_2rem] gap-2 items-center">
                <span className="text-sm font-bold text-gray-700 pl-1">{i + 1}</span>
                <input type="number" inputMode="numeric" min={1} max={100} value={d.reps}
                  onChange={e => patchSet(i, { reps: Math.max(1, Number(e.target.value) || 1) })}
                  className="h-10 rounded-xl border border-gray-200 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-blue-400" />
                <input type="number" inputMode="decimal" min={0} step={2.5} value={d.weightKg ?? ''} placeholder="—"
                  onChange={e => patchSet(i, { weightKg: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })}
                  className="h-10 rounded-xl border border-gray-200 bg-white text-center text-sm font-bold text-gray-900 outline-none focus:border-blue-400" />
                <button type="button" aria-label={`Quitar serie ${i + 1}`} disabled={details!.length <= 1} onClick={() => removeSet(i)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-500 disabled:opacity-25">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" onClick={() => setSetCount(details!.length + 1)}
                className="h-9 px-3 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 flex items-center gap-1.5 active:scale-95">
                <Plus className="w-3.5 h-3.5" /> Agregar serie
              </button>
              <button type="button" onClick={() => onChange(withDetails(details!.map(() => ({ ...details![0] }))))}
                className="h-9 px-3 rounded-xl text-xs font-semibold bg-white border border-gray-200 text-gray-700 active:scale-95">
                Copiar serie 1 a todas
              </button>
              <button type="button" onClick={toggleCustom}
                className="h-9 px-3 rounded-xl text-xs font-semibold text-gray-500 active:scale-95">
                Volver a simple
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Extra parameters */}
      <div className="px-3 sm:px-4 pb-4">
        <button type="button" onClick={() => setOpen(o => !o)} className={clsx('text-xs font-medium text-gray-500 flex items-center gap-1', custom && 'hidden')}>
          <Timer className="w-3.5 h-3.5" /> Descanso, RPE y notas {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {(open || custom) && (
          <div className={clsx('grid grid-cols-1 sm:grid-cols-3 gap-3 fade-in', !custom && 'mt-3')}>
            <div>
              <label className="label text-[10px]">Descanso (seg)</label>
              <input type="number" inputMode="numeric" min={0} max={600} step={15} className="input py-2 text-sm"
                value={item.restSeconds ?? ''} placeholder="90"
                onChange={e => onChange({ ...item, restSeconds: e.target.value === '' ? undefined : Math.min(600, Math.max(0, Number(e.target.value))) })} />
            </div>
            <div>
              <label className="label text-[10px]">RPE (1-10)</label>
              <input type="number" inputMode="decimal" min={1} max={10} className="input py-2 text-sm"
                value={item.rpe ?? ''} placeholder="7"
                onChange={e => onChange({ ...item, rpe: e.target.value === '' ? undefined : Math.min(10, Math.max(1, Number(e.target.value))) })} />
            </div>
            <div>
              <label className="label text-[10px]">Notas para el atleta</label>
              <input type="text" className="input py-2 text-sm" value={item.notes ?? ''} placeholder="Ej. Bajar en 3 segundos"
                onChange={e => onChange({ ...item, notes: e.target.value })} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RoutinesPage() {
  const [searchParams] = useSearchParams()
  const [viewMode, setViewMode] = useState<'athletes' | 'templates_list' | 'template_edit'>('athletes')
  const [athletes, setAthletes]   = useState<Athlete[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  
  const [selectedAthlete, setSelectedAthlete] = useState<string>(searchParams.get('athlete') ?? '')
  const [selectedDay, setSelectedDay]         = useState<string>('Lunes')
  const [schedule, setSchedule]   = useState<Record<string, RoutineDay>>({})
  const [exerciseMap, setExerciseMap] = useState<Record<string, Exercise>>({})
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [loading, setLoading]       = useState(false)
  const [routineTitle, setRoutineTitle]     = useState('Rutina Semanal')
  const [routineDesc, setRoutineDesc]       = useState('Plan personalizado')
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null)
  
  const [showAssignModal, setShowAssignModal] = useState<string | null>(null)
  const [assignSelected, setAssignSelected] = useState<string[]>([])
  const [assigning, setAssigning] = useState(false)
  const [snapshot, setSnapshot] = useState<string | null>(null)
  const [saveError, setSaveError] = useState('')
  const [undoItem, setUndoItem] = useState<{ idx: number; item: RoutineExercise; day: string } | null>(null)
  const [clearConfirm, setClearConfirm] = useState(false)
  const [deleteRoutineConfirm, setDeleteRoutineConfirm] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [copyTargets, setCopyTargets] = useState<string[]>([])

  useEffect(() => {
    getAthletes().then(setAthletes).catch(() => {})
  }, [])

  useEffect(() => {
    if (viewMode === 'templates_list') {
      loadTemplates()
    }
  }, [viewMode])
  
  const loadTemplates = () => {
    setLoading(true)
    getTemplates().then(setTemplates).catch(() => {}).finally(() => setLoading(false))
  }

  useEffect(() => {
    if (viewMode !== 'athletes' || !selectedAthlete) return
    setLoading(true)
    getRoutineForAthlete(selectedAthlete)
      .then(r => {
        setSchedule(r.schedule ?? {})
        setRoutineTitle(r.title)
        setRoutineDesc(r.description)
        setSnapshot(JSON.stringify({ t: r.title, d: r.description, s: r.schedule ?? {} }))
      })
      .catch(() => { setSchedule({}); setSnapshot(null) })
      .finally(() => setLoading(false))
  }, [selectedAthlete, viewMode])

  const currentDay: RoutineDay = schedule[selectedDay] ?? {
    dayName: selectedDay, focus: '', exercises: []
  }

  const updateDay = (updated: RoutineDay) => {
    setSchedule(s => ({ ...s, [selectedDay]: updated }))
  }

  const addExercise = (ex: Exercise) => {
    setExerciseMap(m => ({ ...m, [ex.id]: ex }))
    const item: RoutineExercise = {
      exerciseId: ex.id,
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      name: ex.name,
    }
    updateDay({ ...currentDay, exercises: [...currentDay.exercises, item] })
    setShowPicker(false)
  }

  const updateExercise = (idx: number, updated: RoutineExercise) => {
    const exs = [...currentDay.exercises]
    exs[idx] = updated
    updateDay({ ...currentDay, exercises: exs })
  }

  const removeExercise = (idx: number) => {
    const item = currentDay.exercises[idx]
    updateDay({ ...currentDay, exercises: currentDay.exercises.filter((_, i) => i !== idx) })
    setUndoItem({ idx, item, day: selectedDay })
  }

  const undoRemove = () => {
    if (!undoItem) return
    setSchedule(sc => {
      const day = sc[undoItem.day] ?? { dayName: undoItem.day, focus: '', exercises: [] }
      const exs = [...day.exercises]
      exs.splice(Math.min(undoItem.idx, exs.length), 0, undoItem.item)
      return { ...sc, [undoItem.day]: { ...day, exercises: exs } }
    })
    setUndoItem(null)
  }

  const moveExercise = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= currentDay.exercises.length) return
    const exs = [...currentDay.exercises]
    ;[exs[idx], exs[j]] = [exs[j], exs[idx]]
    updateDay({ ...currentDay, exercises: exs })
  }

  const duplicateExercise = (idx: number) => {
    const exs = [...currentDay.exercises]
    exs.splice(idx + 1, 0, JSON.parse(JSON.stringify(exs[idx])))
    updateDay({ ...currentDay, exercises: exs })
  }

  const clearDay = () => {
    if (!clearConfirm) { setClearConfirm(true); setTimeout(() => setClearConfirm(false), 3500); return }
    updateDay({ ...currentDay, exercises: [] })
    setClearConfirm(false)
  }

  const copyDay = () => {
    setSchedule(sc => {
      const next = { ...sc }
      for (const d of copyTargets) {
        next[d] = { dayName: d, focus: currentDay.focus, exercises: JSON.parse(JSON.stringify(currentDay.exercises)) }
      }
      return next
    })
    setCopyOpen(false); setCopyTargets([])
  }

  const deleteWholeRoutine = async () => {
    if (!selectedAthlete) return
    if (!deleteRoutineConfirm) { setDeleteRoutineConfirm(true); setTimeout(() => setDeleteRoutineConfirm(false), 4000); return }
    setSaving(true); setSaveError('')
    try {
      await saveRoutine(selectedAthlete, { title: routineTitle, description: routineDesc, schedule: {} })
      setSchedule({})
      setSnapshot(JSON.stringify({ t: routineTitle, d: routineDesc, s: {} }))
    } catch (e: any) { setSaveError(e?.message || 'No se pudo eliminar la rutina') }
    finally { setSaving(false); setDeleteRoutineConfirm(false) }
  }

  const currentSnapshot = JSON.stringify({ t: routineTitle, d: routineDesc, s: schedule })
  const dirty = viewMode === 'athletes' && !!selectedAthlete && snapshot !== null && snapshot !== currentSnapshot

  useEffect(() => {
    if (!dirty) return
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  useEffect(() => {
    if (!undoItem) return
    const t = setTimeout(() => setUndoItem(null), 7000)
    return () => clearTimeout(t)
  }, [undoItem])

  const handleSaveRoutine = async () => {
    if (!selectedAthlete) return
    setSaving(true); setSaveError('')
    try {
      await saveRoutine(selectedAthlete, { title: routineTitle, description: routineDesc, schedule })
      setSnapshot(currentSnapshot)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { setSaveError(e?.message || 'No se pudo guardar la rutina. Revisa tu conexión.') }
    finally { setSaving(false) }
  }

  const handleSaveTemplate = async () => {
    setSaving(true)
    try {
      const data: Partial<Template> = { title: routineTitle, description: routineDesc, schedule }
      if (currentTemplateId) data.id = currentTemplateId
      const res = await saveTemplateApi(data)
      setCurrentTemplateId(res.id)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('¿Seguro que deseas eliminar esta plantilla?')) return
    try {
      await deleteTemplateApi(id)
      loadTemplates()
    } catch { /* ignore */ }
  }

  const handleAssignTemplate = async () => {
    if (!showAssignModal || assignSelected.length === 0) return
    setAssigning(true)
    try {
      await assignTemplateApi(showAssignModal, assignSelected)
      setShowAssignModal(null)
      setAssignSelected([])
    } catch { /* ignore */ }
    finally { setAssigning(false) }
  }

  const selectedAthleteData = athletes.find(a => a.id === selectedAthlete)

  return (
    <div className="space-y-6 fade-in pb-28">
      {/* Header Tabs */}
      <div className="flex items-center gap-4 border-b border-gray-200">
        <button
          className={clsx('px-4 py-3 font-medium text-sm transition-colors border-b-2', viewMode === 'athletes' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900')}
          onClick={() => setViewMode('athletes')}
        >
          Rutinas de Atletas
        </button>
        <button
          className={clsx('px-4 py-3 font-medium text-sm transition-colors border-b-2', (viewMode === 'templates_list' || viewMode === 'template_edit') ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-900')}
          onClick={() => setViewMode('templates_list')}
        >
          Mis Plantillas
        </button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {viewMode === 'athletes' ? 'Creador de Rutinas' : viewMode === 'templates_list' ? 'Mis Plantillas' : 'Editor de Plantilla'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {viewMode === 'athletes' ? 'Diseña y asigna planes de entrenamiento' : 'Administra tus plantillas reutilizables'}
          </p>
        </div>
        <div className="flex gap-3">
          {(viewMode === 'athletes' || viewMode === 'template_edit') && (
            <button onClick={handleSaveTemplate} disabled={saving} className="btn-secondary">
              <FileText className="w-4 h-4" />
              Guardar como Plantilla
            </button>
          )}
          {viewMode === 'athletes' && selectedAthlete && (
            <button id="btn-save-routine" onClick={handleSaveRoutine} disabled={saving}
                    className={clsx('btn-primary', saved && 'bg-emerald-600 hover:bg-emerald-500')}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? '¡Guardado!' : 'Guardar Rutina'}
            </button>
          )}
          {viewMode === 'template_edit' && (
            <button id="btn-save-template" onClick={handleSaveTemplate} disabled={saving}
                    className={clsx('btn-primary', saved && 'bg-emerald-600 hover:bg-emerald-500')}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saved ? '¡Guardado!' : 'Guardar Plantilla'}
            </button>
          )}
          {viewMode === 'template_edit' && (
             <button onClick={() => setViewMode('templates_list')} className="btn-ghost">
               Volver
             </button>
          )}
        </div>
      </div>

      {viewMode === 'templates_list' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button
            className="card border-dashed border-2 border-gray-300 flex flex-col items-center justify-center py-12 text-gray-500 hover:border-blue-500 hover:text-blue-600 transition-colors bg-gray-50/50 hover:bg-blue-50/50"
            onClick={() => {
              setSchedule({})
              setRoutineTitle('Nueva Plantilla')
              setRoutineDesc('')
              setCurrentTemplateId(null)
              setViewMode('template_edit')
            }}
          >
            <Plus className="w-8 h-8 mb-2 opacity-50" />
            <span className="font-medium">Nueva Plantilla</span>
          </button>
          {loading ? (
             <div className="col-span-2 flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : templates.map(t => (
            <div key={t.id} className="card flex flex-col justify-between">
               <div>
                 <h3 className="font-semibold text-lg text-gray-900">{t.title}</h3>
                 <p className="text-sm text-gray-500 mt-1 line-clamp-2">{t.description}</p>
                 <div className="mt-4 flex gap-2">
                   <span className="badge-blue text-xs">
                     {Object.values(t.schedule || {}).reduce((acc, d) => acc + (d.exercises?.length || 0), 0)} ejercicios
                   </span>
                 </div>
               </div>
               <div className="mt-6 flex items-center gap-2">
                 <button onClick={() => {
                    setSchedule(t.schedule || {}); setRoutineTitle(t.title); setRoutineDesc(t.description); setCurrentTemplateId(t.id); setViewMode('template_edit')
                 }} className="btn-secondary flex-1 py-2">Editar</button>
                 <button onClick={() => { setShowAssignModal(t.id); setAssignSelected([]) }} className="btn-primary flex-1 py-2">Asignar</button>
                 <button onClick={() => handleDeleteTemplate(t.id)} className="btn-ghost p-2 text-red-500 hover:bg-red-50 rounded-lg">
                   <X className="w-4 h-4"/>
                 </button>
               </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Editor Info Block */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {viewMode === 'athletes' ? (
              <div className="card">
                <label className="label">Atleta</label>
                <div className="relative mt-1">
                  <select
                    id="select-athlete"
                    className="input appearance-none pr-8"
                    value={selectedAthlete}
                    onChange={e => setSelectedAthlete(e.target.value)}
                  >
                    <option value="">Seleccionar atleta...</option>
                    {athletes.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
                </div>
                {selectedAthleteData && (
                  <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {selectedAthleteData.name[0]}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">{selectedAthleteData.name}</p>
                      <p className="text-[10px] text-gray-500">{selectedAthleteData.goal}</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="card flex flex-col justify-center">
                 <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                     <FileText className="w-5 h-5" />
                   </div>
                   <div>
                     <p className="text-sm font-medium text-gray-900">Modo de Edición</p>
                     <p className="text-xs text-gray-500">Editando plantilla base</p>
                   </div>
                 </div>
              </div>
            )}

            <div className="card">
              <label className="label">Título</label>
              <input className="input mt-1" value={routineTitle}
                     onChange={e => setRoutineTitle(e.target.value)} />
              <label className="label mt-3">Descripción</label>
              <input className="input mt-1" value={routineDesc}
                     onChange={e => setRoutineDesc(e.target.value)} />
            </div>

            <div className="card">
              <label className="label">Enfoque del {selectedDay}</label>
              <input className="input mt-1"
                     placeholder="ej. Pecho y Bíceps"
                     value={currentDay.focus}
                     onChange={e => updateDay({ ...currentDay, focus: e.target.value })} />
              <div className="mt-3 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-gray-500" />
                <p className="text-xs text-gray-500">
                  {currentDay.exercises.length} ejercicio{currentDay.exercises.length !== 1 ? 's' : ''} asignados
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="lg:col-span-1 flex lg:block gap-2 lg:space-y-1 overflow-x-auto pb-1 -mx-1 px-1">
              <p className="label px-2 hidden lg:block">Día de la semana</p>
              {DAYS.map(day => {
                const dayData = schedule[day]
                const count   = dayData?.exercises?.length ?? 0
                return (
                  <button
                    key={day}
                    id={`btn-day-${day}`}
                    onClick={() => setSelectedDay(day)}
                    className={clsx(
                      'lg:w-full shrink-0 flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all',
                      selectedDay === day
                        ? 'text-blue-600 bg-blue-50 border border-blue-200'
                        : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-transparent'
                    )}
                  >
                    <span>{day}</span>
                    {count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <div className="lg:col-span-3 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-semibold text-gray-900">{selectedDay}</h2>
                  {currentDay.focus && <p className="text-xs text-gray-500 mt-0.5">🎯 {currentDay.focus}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {currentDay.exercises.length > 0 && (
                    <>
                      <button type="button" onClick={() => setCopyOpen(o => !o)} className="btn-secondary px-3 py-2 text-xs">
                        <CopyPlus className="w-4 h-4" /> Copiar día
                      </button>
                      <button type="button" onClick={clearDay}
                        className={clsx('px-3 py-2 text-xs rounded-xl font-semibold flex items-center gap-1.5 border transition-colors',
                          clearConfirm ? 'bg-red-500 text-white border-red-500' : 'bg-white text-red-600 border-red-200 hover:bg-red-50')}>
                        <Trash2 className="w-4 h-4" /> {clearConfirm ? '¿Seguro? Toca otra vez' : 'Vaciar día'}
                      </button>
                    </>
                  )}
                  <button
                    id="btn-add-exercise"
                    onClick={() => setShowPicker(true)}
                    className="btn-primary"
                    disabled={viewMode === 'athletes' && !selectedAthlete}
                  >
                    <Plus className="w-4 h-4" />
                    Agregar ejercicio
                  </button>
                </div>
              </div>

              {copyOpen && (
                <div className="card fade-in">
                  <p className="text-sm font-semibold text-gray-900">Copiar {selectedDay} a…</p>
                  <p className="text-xs text-gray-500 mt-0.5">Reemplaza lo que ya haya en los días elegidos.</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {DAYS.filter(d => d !== selectedDay).map(d => {
                      const on = copyTargets.includes(d)
                      return (
                        <button key={d} type="button" onClick={() => setCopyTargets(t => on ? t.filter(x => x !== d) : [...t, d])}
                          className={clsx('px-3 py-2 rounded-xl text-xs font-semibold border transition-colors',
                            on ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200')}>
                          {d}
                        </button>
                      )
                    })}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button type="button" onClick={copyDay} disabled={copyTargets.length === 0} className="btn-primary text-sm disabled:opacity-40">Copiar</button>
                    <button type="button" onClick={() => { setCopyOpen(false); setCopyTargets([]) }} className="btn-ghost text-sm">Cancelar</button>
                  </div>
                </div>
              )}

              {viewMode === 'athletes' && !selectedAthlete ? (
                <div className="card flex flex-col items-center justify-center py-16 gap-3 text-gray-500">
                  <Dumbbell className="w-12 h-12 opacity-20" />
                  <p className="text-sm">Selecciona un atleta para editar su rutina</p>
                </div>
              ) : loading ? (
                <div className="card flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : currentDay.exercises.length === 0 ? (
                <div className="card border-dashed border-gray-300 flex flex-col items-center justify-center py-16 gap-3 text-gray-500 hover:border-brand-500/40 hover:text-gray-500 transition-colors cursor-pointer"
                     onClick={() => setShowPicker(true)}>
                  <Plus className="w-8 h-8 opacity-30" />
                  <p className="text-sm">Haz clic para agregar ejercicios al {selectedDay}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {currentDay.exercises.map((item, idx) => (
                    <RoutineExerciseRow
                      key={`${item.exerciseId}-${idx}`}
                      item={item}
                      index={idx}
                      exercise={exerciseMap[item.exerciseId]}
                      total={currentDay.exercises.length}
                      onChange={(u) => updateExercise(idx, u)}
                      onRemove={() => removeExercise(idx)}
                      onMove={(dir) => moveExercise(idx, dir)}
                      onDuplicate={() => duplicateExercise(idx)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {saveError && (
        <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /> {saveError}
        </div>
      )}

      {viewMode === 'athletes' && selectedAthlete && !loading && (
        <div className="pt-2">
          <button type="button" onClick={deleteWholeRoutine} disabled={saving}
            className={clsx('text-xs font-semibold px-3 py-2 rounded-xl border transition-colors',
              deleteRoutineConfirm ? 'bg-red-500 text-white border-red-500' : 'text-red-600 border-red-200 hover:bg-red-50')}>
            {deleteRoutineConfirm ? '¿Seguro? Se borra TODA la rutina del atleta' : 'Eliminar rutina completa'}
          </button>
        </div>
      )}

      {/* Undo toast */}
      {undoItem && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 flex items-center gap-3 bg-gray-900 text-white pl-4 pr-2 py-2 rounded-2xl shadow-xl fade-in">
          <span className="text-sm">Ejercicio quitado</span>
          <button type="button" onClick={undoRemove} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/15 text-sm font-semibold active:scale-95">
            <Undo2 className="w-4 h-4" /> Deshacer
          </button>
        </div>
      )}

      {/* Unsaved changes bar */}
      {dirty && (
        <div className="fixed bottom-0 left-0 right-0 md:left-64 z-40 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 flex items-center justify-between gap-3"
             style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-2 text-sm text-amber-700 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /> Cambios sin guardar
          </div>
          <button type="button" onClick={handleSaveRoutine} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar rutina
          </button>
        </div>
      )}

      {showPicker && (
        <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />
      )}
      
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm" onClick={() => setShowAssignModal(null)}>
          <div className="w-full max-w-md bg-white border border-gray-300 rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="font-semibold text-gray-900">Asignar a Atletas</h3>
              <button onClick={() => setShowAssignModal(null)} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-2">
               {athletes.length === 0 ? (
                 <p className="text-sm text-gray-500 text-center py-4">No tienes atletas.</p>
               ) : athletes.map(a => (
                 <label key={a.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-pointer">
                   <input type="checkbox" className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500" 
                          checked={assignSelected.includes(a.id)}
                          onChange={e => {
                            if (e.target.checked) setAssignSelected(s => [...s, a.id])
                            else setAssignSelected(s => s.filter(id => id !== a.id))
                          }} />
                   <span className="text-sm font-medium text-gray-900">{a.name}</span>
                 </label>
               ))}
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
              <button onClick={() => setShowAssignModal(null)} className="btn-ghost">Cancelar</button>
              <button onClick={handleAssignTemplate} disabled={assignSelected.length === 0 || assigning} className="btn-primary">
                {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Asignar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
