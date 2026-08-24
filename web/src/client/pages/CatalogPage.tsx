import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronRight, Dumbbell } from 'lucide-react'
import { getExercises } from '../clientApi'
import type { Exercise } from '../clientApi'

const MUSCLES = [
  { label: 'Todos', val: '' },
  { label: 'Pecho', val: 'Pecho' },
  { label: 'Espalda', val: 'Espalda' },
  { label: 'Hombros', val: 'Hombros' },
  { label: 'Biceps', val: 'Biceps' },
  { label: 'Triceps', val: 'Triceps' },
  { label: 'Piernas', val: 'Piernas' },
  { label: 'Gluteos', val: 'Gluteos' },
  { label: 'Abdomen', val: 'Abdomen' },
]

function ExerciseSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm">
      <div className="w-14 h-14 rounded-xl bg-gray-200 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-200 rounded-lg w-3/4" />
        <div className="h-3 bg-gray-100 rounded-lg w-1/2" />
      </div>
    </div>
  )
}

export default function CatalogPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Exercise | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = (s: string, m: string, p: number) => {
    setLoading(true)
    getExercises({ search: s || undefined, muscle: m || undefined, page: p, limit: 20 })
      .then(res => {
        setExercises(res.data ?? [])
        setTotalPages(res.pages ?? 1)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { setPage(1); load(search, muscle, 1) }, 300)
  }, [search, muscle])

  useEffect(() => { load(search, muscle, page) }, [page])

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Sticky header */}
      <div className="bg-[#F2F2F7] sticky top-0 z-10 px-4 pt-5 pb-3 space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Catalogo</h1>
        <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="flex-1 outline-none text-sm text-gray-800 bg-transparent placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center active:scale-90 transition-transform">
              <X className="w-3 h-3 text-gray-500" />
            </button>
          )}
        </div>
        {/* Muscle chips */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {MUSCLES.map(m => (
            <button
              key={m.val}
              onClick={() => setMuscle(m.val)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                muscle === m.val ? 'bg-[#007AFF] text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="px-4 pb-6 space-y-2">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <ExerciseSkeleton key={i} />)
          : exercises.length === 0
          ? (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <Dumbbell className="w-8 h-8 text-gray-300" />
              </div>
              <p className="font-semibold text-gray-600">Sin resultados</p>
              <p className="text-sm text-gray-400 mt-1">Intenta otra busqueda</p>
            </div>
          )
          : exercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => setSelected(ex)}
              className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {ex.mediaUrl
                  ? <img src={ex.mediaUrl} alt={ex.name} className="w-full h-full object-cover" loading="lazy" />
                  : <div className="w-full h-full flex items-center justify-center"><Dumbbell className="w-6 h-6 text-gray-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{ex.name}</p>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{ex.muscleGroup || ex.category}</p>
                {ex.equipment && <p className="text-xs text-gray-300 truncate">{ex.equipment}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))
        }

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 pt-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-5 py-2.5 bg-white rounded-xl text-sm text-[#007AFF] disabled:opacity-30 shadow-sm font-semibold active:scale-95 transition-transform"
            >
              Anterior
            </button>
            <span className="text-sm text-gray-500 font-medium">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2.5 bg-white rounded-xl text-sm text-[#007AFF] disabled:opacity-30 shadow-sm font-semibold active:scale-95 transition-transform"
            >
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Exercise detail bottom sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col" onClick={() => setSelected(null)}
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div
            className="mt-auto bg-white rounded-t-3xl overflow-hidden"
            style={{ maxHeight: '88vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-start justify-between px-5 pb-3">
              <div>
                <h3 className="font-bold text-gray-900 text-xl leading-tight">{selected.name}</h3>
                {selected.muscleGroup && (
                  <p className="text-sm text-gray-500 mt-0.5">{selected.muscleGroup}</p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto scroll-ios no-scrollbar" style={{ maxHeight: 'calc(88vh - 120px)' }}>
              {selected.mediaUrl && (
                <div className="mx-4 rounded-2xl bg-gray-100 overflow-hidden" style={{ height: '220px' }}>
                  <img src={selected.mediaUrl} alt={selected.name} className="w-full h-full object-contain" />
                </div>
              )}
              <div className="px-5 py-4 space-y-4">
                <div className="flex gap-2 flex-wrap">
                  {selected.muscleGroup && (
                    <span className="bg-[#007AFF]/10 text-[#007AFF] text-xs px-3 py-1 rounded-full font-semibold">{selected.muscleGroup}</span>
                  )}
                  {selected.equipment && (
                    <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">{selected.equipment}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selected.defaultSets ?? '–'}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Series</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selected.defaultReps ?? '–'}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Repeticiones</p>
                  </div>
                </div>
                {selected.instructions && (
                  <div>
                    <p className="text-sm font-bold text-gray-700 mb-2">Instrucciones</p>
                    <p className="text-sm text-gray-500 leading-relaxed">{selected.instructions}</p>
                  </div>
                )}
                <div className="h-4" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
