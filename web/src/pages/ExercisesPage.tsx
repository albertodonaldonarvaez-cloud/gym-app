import { useEffect, useState, useCallback } from 'react'
import { getExercises } from '../api'
import type { Exercise } from '../api'
import {
  Search, Dumbbell, ChevronLeft, ChevronRight, Filter, X,
  ImageOff, Loader2, ChevronDown, PlayCircle
} from 'lucide-react'
import clsx from 'clsx'

const CATEGORIES = ['Fuerza','Cardio','Estiramiento','Pliométricos','Powerlifting','Halterofilia','Strongman']
const MUSCLES    = ['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Isquiotibiales','Glúteos','Abdomen','Gemelos','Antebrazos','Abductores','Aductores']

function ExerciseCard({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  const [imgIdx, setImgIdx] = useState(0)
  const [imgError, setImgError] = useState(false)
  const imgs = exercise.imageUrls?.length ? exercise.imageUrls : exercise.mediaUrl ? [exercise.mediaUrl] : []

  return (
    <div
      id={`ex-card-${exercise.id}`}
      onClick={onClick}
      className="card p-0 overflow-hidden cursor-pointer group hover:border-brand-500/30 hover:shadow-lg hover:shadow-brand-500/5 transition-all duration-300 fade-in"
    >
      {/* Image */}
      <div className="relative aspect-video bg-gray-100 overflow-hidden">
        {imgs.length > 0 && !imgError ? (
          <>
            <img
              src={imgs[imgIdx]}
              alt={exercise.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => {
                if (imgIdx < imgs.length - 1) setImgIdx(i => i+1)
                else setImgError(true)
              }}
            />
            {imgs.length > 1 && (
              <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {imgs.map((_, i) => (
                  <button key={i}
                    onClick={e => { e.stopPropagation(); setImgIdx(i) }}
                    className={clsx(
                      'w-1.5 h-1.5 rounded-full transition-colors',
                      i === imgIdx ? 'bg-white' : 'bg-white/40'
                    )}
                  />
                ))}
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <PlayCircle className="w-6 h-6 text-gray-900/80 drop-shadow" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageOff className="w-8 h-8 opacity-30" />
            <span className="text-xs opacity-50">Sin imagen</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-gray-900 text-sm leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
          {exercise.name}
        </h3>
        <div className="flex flex-wrap gap-1">
          <span className="badge-purple">{exercise.muscleGroup || exercise.targetMuscle}</span>
          <span className="badge-gray">{exercise.equipment}</span>
        </div>
        <p className="text-xs text-gray-500 font-medium">{exercise.category}</p>
      </div>
    </div>
  )
}

function ExerciseModal({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const [imgIdx, setImgIdx] = useState(0)
  const imgs = exercise.imageUrls?.length ? exercise.imageUrls : exercise.mediaUrl ? [exercise.mediaUrl] : []
  const instructions = exercise.instructions?.split('\n').filter(Boolean) ?? []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-2xl bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Image */}
        <div className="relative aspect-video bg-gray-100">
          {imgs.length > 0 && imgs[imgIdx] ? (
            <img src={imgs[imgIdx]} alt={exercise.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageOff className="w-12 h-12 opacity-20" />
            </div>
          )}
          <button onClick={onClose} id="btn-close-modal"
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 hover:bg-gray-900/40 text-gray-900 transition-colors">
            <X className="w-4 h-4" />
          </button>
          {imgs.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
              <button onClick={() => setImgIdx(i => Math.max(0, i-1))}
                      className="p-1 rounded-full bg-white/80 text-gray-900 hover:bg-gray-900/40">
                <ChevronLeft className="w-3 h-3" />
              </button>
              <span className="text-xs text-gray-900/70 bg-white/80 px-2 py-0.5 rounded-full">
                {imgIdx+1}/{imgs.length}
              </span>
              <button onClick={() => setImgIdx(i => Math.min(imgs.length-1, i+1))}
                      className="p-1 rounded-full bg-white/80 text-gray-900 hover:bg-gray-900/40">
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{exercise.name}</h2>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="badge-purple">{exercise.muscleGroup || exercise.targetMuscle}</span>
              <span className="badge-gray">{exercise.equipment}</span>
              <span className="badge-blue">{exercise.category}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gray-100 text-center">
              <p className="text-2xl font-bold text-blue-600">{exercise.defaultSets}</p>
              <p className="text-xs text-gray-500 mt-0.5">Series sugeridas</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-100 text-center">
              <p className="text-2xl font-bold text-violet-600">{exercise.defaultReps}</p>
              <p className="text-xs text-gray-500 mt-0.5">Reps sugeridas</p>
            </div>
          </div>

          {instructions.length > 0 && (
            <div>
              <p className="label mb-3">Instrucciones</p>
              <ol className="space-y-2">
                {instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-gray-500">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-blue-50 text-blue-600 text-xs font-bold flex items-center justify-center mt-0.5">
                      {i+1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ExercisesPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [total, setTotal]       = useState(0)
  const [pages, setPages]       = useState(1)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [category, setCategory] = useState('')
  const [muscle, setMuscle]     = useState('')
  const [equipment, setEquipment] = useState('')
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async (p = 1) => {
    setLoading(true)
    try {
      const res = await getExercises({ search, category, muscle_group: muscle, page: p, limit: 24 })
      if (Array.isArray(res)) {
        setExercises(res as unknown as Exercise[])
        setTotal((res as unknown as Exercise[]).length)
        setPages(1)
      } else {
        setExercises(res.data)
        setTotal(res.total)
        setPages(res.pages)
      }
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [search, category, muscle])

  useEffect(() => { setPage(1); load(1) }, [load])

  const activeFilters = [category, muscle, equipment].filter(Boolean).length

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Catálogo de Ejercicios</h1>
        <p className="text-gray-500 text-sm mt-1">
          {total.toLocaleString()} ejercicios disponibles · Free Exercise DB
        </p>
      </div>

      {/* Search + filters */}
      <div className="card space-y-4">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              id="main-exercise-search"
              className="input pl-9"
              placeholder="Buscar por nombre, músculo o equipamiento..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button
            id="btn-toggle-filters"
            onClick={() => setShowFilters(!showFilters)}
            className={clsx('btn-secondary relative', showFilters && 'border-brand-500/40 text-blue-600')}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFilters > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-brand-500 text-gray-900 text-[9px] font-bold flex items-center justify-center">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 border-t border-gray-200 fade-in">
            {/* Category */}
            <div>
              <label className="label">Categoría</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={category}
                        onChange={e => setCategory(e.target.value)}>
                  <option value="">Todas</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
            </div>
            {/* Muscle */}
            <div>
              <label className="label">Músculo principal</label>
              <div className="relative">
                <select className="input appearance-none pr-8" value={muscle}
                        onChange={e => setMuscle(e.target.value)}>
                  <option value="">Todos</option>
                  {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
            </div>
            {/* Clear */}
            <div className="flex items-end">
              {activeFilters > 0 && (
                <button onClick={() => { setCategory(''); setMuscle(''); setEquipment('') }}
                        className="btn-ghost text-red-600 hover:text-red-300 hover:bg-red-50">
                  <X className="w-3.5 h-3.5" />
                  Limpiar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick muscle chips */}
        <div className="flex flex-wrap gap-2 pt-1">
          {['Pecho','Espalda','Hombros','Piernas','Bíceps','Tríceps','Abdomen','Cardio'].map(chip => (
            <button key={chip}
                    onClick={() => setMuscle(muscle === chip ? '' : chip)}
                    className={clsx(
                      'px-3 py-1 rounded-full text-xs font-medium transition-all',
                      muscle === chip
                        ? 'bg-brand-500 text-gray-900'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900'
                    )}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          Cargando ejercicios...
        </div>
      ) : exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
          <Dumbbell className="w-12 h-12 opacity-20" />
          <p>Sin resultados para tu búsqueda</p>
          <button onClick={() => { setSearch(''); setCategory(''); setMuscle('') }}
                  className="btn-ghost text-sm">
            Limpiar búsqueda
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {exercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onClick={() => setSelected(ex)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button className="btn-secondary py-2 px-4" disabled={page === 1}
                  onClick={() => { setPage(p => p-1); load(page-1) }}>
            <ChevronLeft className="w-4 h-4" />
            Anterior
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(7, pages) }, (_, i) => {
              const p = i + Math.max(1, page - 3)
              if (p > pages) return null
              return (
                <button key={p}
                        onClick={() => { setPage(p); load(p) }}
                        className={clsx(
                          'w-9 h-9 rounded-lg text-sm font-medium transition-all',
                          p === page ? 'bg-brand-600 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
                        )}>
                  {p}
                </button>
              )
            })}
          </div>
          <button className="btn-secondary py-2 px-4" disabled={page === pages}
                  onClick={() => { setPage(p => p+1); load(page+1) }}>
            Siguiente
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Exercise detail modal */}
      {selected && <ExerciseModal exercise={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
