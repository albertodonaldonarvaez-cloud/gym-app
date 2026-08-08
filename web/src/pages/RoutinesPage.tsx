import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  getAthletes, getExercises, getRoutineForAthlete, saveRoutine
} from '../api'
import type { Athlete, Exercise, RoutineDay, RoutineExercise } from '../api'
import {
  ChevronDown, Search, Plus, X, Save, Loader2, Dumbbell,
  ChevronUp, GripVertical, Info, SlidersHorizontal
} from 'lucide-react'
import clsx from 'clsx'

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

          {/* Preview panel */}
          {hoveredEx && (
            <div className="w-56 border-l border-gray-200 p-4 flex flex-col gap-3 slide-in overflow-hidden">
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
function RoutineExerciseRow({
  item, index, exercise, onChange, onRemove
}: {
  item: RoutineExercise
  index: number
  exercise?: Exercise
  onChange: (updated: RoutineExercise) => void
  onRemove: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const imgUrl = exercise?.imageUrls?.[0] ?? exercise?.mediaUrl ?? ''

  return (
    <div className={clsx(
      'border border-gray-200 rounded-xl overflow-hidden transition-all',
      'hover:border-gray-300 bg-gray-50'
    )}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical className="w-4 h-4 text-gray-400 cursor-grab shrink-0" />
        <span className="w-5 h-5 rounded-md bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center shrink-0">
          {index + 1}
        </span>

        {/* Thumbnail */}
        <div className="w-8 h-8 rounded-lg overflow-hidden bg-gray-100 shrink-0">
          {imgUrl ? (
            <img src={imgUrl} alt="" className="w-full h-full object-cover"
                 onError={e => { e.currentTarget.style.display='none' }} />
          ) : <Dumbbell className="w-4 h-4 text-gray-500 m-auto mt-1.5" />}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">
            {item.name || exercise?.name || 'Ejercicio'}
          </p>
          {exercise && (
            <p className="text-xs text-gray-500 truncate">
              {exercise.muscleGroup || exercise.targetMuscle} · {exercise.equipment}
            </p>
          )}
        </div>

        {/* Quick params */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">S</span>
            <input type="number" min={1} max={20}
                   className="w-10 bg-gray-100 border border-gray-300 rounded-lg px-1.5 py-1 text-xs text-center text-gray-900 focus:outline-none focus:border-brand-500"
                   value={item.sets}
                   onChange={e => onChange({...item, sets: Number(e.target.value)})} />
          </div>
          <span className="text-gray-400">×</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">R</span>
            <input type="number" min={1} max={100}
                   className="w-10 bg-gray-100 border border-gray-300 rounded-lg px-1.5 py-1 text-xs text-center text-gray-900 focus:outline-none focus:border-brand-500"
                   value={item.reps}
                   onChange={e => onChange({...item, reps: Number(e.target.value)})} />
          </div>
        </div>

        <button onClick={() => setExpanded(!expanded)} className="btn-ghost p-1.5">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <SlidersHorizontal className="w-3.5 h-3.5" />}
        </button>
        <button onClick={onRemove} className="btn-ghost p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Expanded params */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-200 grid grid-cols-3 gap-3 fade-in">
          <div>
            <label className="label text-[10px]">Peso objetivo (kg)</label>
            <input type="number" min={0} className="input py-1.5 text-xs"
                   value={item.targetWeightKg ?? ''}
                   placeholder="0"
                   onChange={e => onChange({...item, targetWeightKg: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label text-[10px]">RPE (1-10)</label>
            <input type="number" min={1} max={10} className="input py-1.5 text-xs"
                   value={item.rpe ?? ''}
                   placeholder="7"
                   onChange={e => onChange({...item, rpe: Number(e.target.value)})} />
          </div>
          <div>
            <label className="label text-[10px]">Notas</label>
            <input type="text" className="input py-1.5 text-xs"
                   value={item.notes ?? ''}
                   placeholder="e.g. Foco en excéntrica"
                   onChange={e => onChange({...item, notes: e.target.value})} />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RoutinesPage() {
  const [searchParams] = useSearchParams()
  const [athletes, setAthletes]   = useState<Athlete[]>([])
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

  useEffect(() => {
    getAthletes().then(setAthletes).catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedAthlete) return
    setLoading(true)
    getRoutineForAthlete(selectedAthlete)
      .then(r => {
        setSchedule(r.schedule ?? {})
        setRoutineTitle(r.title)
        setRoutineDesc(r.description)
      })
      .catch(() => setSchedule({}))
      .finally(() => setLoading(false))
  }, [selectedAthlete])

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
    updateDay({ ...currentDay, exercises: currentDay.exercises.filter((_, i) => i !== idx) })
  }

  const handleSave = async () => {
    if (!selectedAthlete) return
    setSaving(true)
    try {
      await saveRoutine(selectedAthlete, { title: routineTitle, description: routineDesc, schedule })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch { /* ignore */ }
    finally { setSaving(false) }
  }

  const selectedAthleteData = athletes.find(a => a.id === selectedAthlete)

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Creador de Rutinas</h1>
          <p className="text-gray-500 text-sm mt-1">Diseña y asigna planes de entrenamiento</p>
        </div>
        {selectedAthlete && (
          <button id="btn-save-routine" onClick={handleSave} disabled={saving}
                  className={clsx('btn-primary', saved && 'bg-emerald-600 hover:bg-emerald-500')}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saved ? '¡Guardado!' : saving ? 'Guardando...' : 'Guardar Rutina'}
          </button>
        )}
      </div>

      {/* Athlete + routine info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-brand-500/8 border border-blue-200">
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

        <div className="card">
          <label className="label">Título de la rutina</label>
          <input className="input mt-1" value={routineTitle}
                 onChange={e => setRoutineTitle(e.target.value)} />
          <label className="label mt-3">Descripción</label>
          <input className="input mt-1" value={routineDesc}
                 onChange={e => setRoutineDesc(e.target.value)} />
        </div>

        <div className="card">
          <label className="label">Enfoque del día</label>
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
        {/* Days sidebar */}
        <div className="lg:col-span-1 space-y-1">
          <p className="label px-2">Día de la semana</p>
          {DAYS.map(day => {
            const dayData = schedule[day]
            const count   = dayData?.exercises?.length ?? 0
            return (
              <button
                key={day}
                id={`btn-day-${day}`}
                onClick={() => setSelectedDay(day)}
                className={clsx(
                  'w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-medium transition-all',
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

        {/* Exercise editor */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-gray-900">{selectedDay}</h2>
              {currentDay.focus && <p className="text-xs text-gray-500 mt-0.5">🎯 {currentDay.focus}</p>}
            </div>
            <button
              id="btn-add-exercise"
              onClick={() => setShowPicker(true)}
              className="btn-primary"
              disabled={!selectedAthlete}
            >
              <Plus className="w-4 h-4" />
              Agregar ejercicio
            </button>
          </div>

          {!selectedAthlete ? (
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
                  onChange={(u) => updateExercise(idx, u)}
                  onRemove={() => removeExercise(idx)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {showPicker && (
        <ExercisePicker onSelect={addExercise} onClose={() => setShowPicker(false)} />
      )}
    </div>
  )
}
