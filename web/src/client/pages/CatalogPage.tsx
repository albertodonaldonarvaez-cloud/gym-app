import { useState, useEffect, useRef } from 'react'
import { Search, X, ChevronRight, Dumbbell } from 'lucide-react'
import { getExercises } from '../clientApi'
import type { Exercise } from '../clientApi'

const MUSCLES = ['Todos','Pecho','Espalda','Hombros','Biceps','Triceps','Piernas','Gluteos','Abdomen','Cardio']

export default function CatalogPage() {
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [search, setSearch] = useState('')
  const [muscle, setMuscle] = useState('Todos')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Exercise | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = (s: string, m: string, p: number) => {
    setLoading(true)
    getExercises({
      search: s || undefined,
      muscle: m !== 'Todos' ? m : undefined,
      page: p, limit: 20
    }).then(res => {
      setExercises(res.data ?? [])
      setTotalPages(res.pages ?? 1)
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setPage(1)
      load(search, muscle, 1)
    }, 300)
  }, [search, muscle])

  useEffect(() => { load(search, muscle, page) }, [page])

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="px-4 pt-5 pb-3 bg-[#F2F2F7] sticky top-0 z-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-3">Catalogo</h1>
        {/* Search */}
        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2.5 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio..."
            className="flex-1 outline-none text-sm text-gray-800 bg-transparent"
          />
          {search && <button onClick={() => setSearch('')}><X className="w-4 h-4 text-gray-400" /></button>}
        </div>
        {/* Muscle filter */}
        <div className="flex gap-2 overflow-x-auto pb-1 mt-3 no-scrollbar">
          {MUSCLES.map(m => (
            <button key={m} onClick={() => setMuscle(m)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                muscle === m ? 'bg-[#007AFF] text-white' : 'bg-white text-gray-600'
              }`}>
              {m}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-2 pb-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />
          ))
        ) : exercises.length === 0 ? (
          <div className="text-center py-12">
            <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500">Sin resultados</p>
          </div>
        ) : (
          exercises.map(ex => (
            <button key={ex.id} onClick={() => setSelected(ex)}
              className="w-full bg-white rounded-xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform text-left">
              <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden flex-shrink-0">
                {ex.mediaUrl
                  ? <img src={ex.mediaUrl} alt={ex.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center"><Dumbbell className="w-6 h-6 text-gray-300" /></div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm truncate">{ex.name}</p>
                <p className="text-xs text-gray-400 truncate">{ex.muscleGroup || ex.category} · {ex.equipment}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))
        )}
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-4 pt-2">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-4 py-2 bg-white rounded-xl text-sm text-[#007AFF] disabled:opacity-40 shadow-sm font-medium">
              Anterior
            </button>
            <span className="py-2 text-sm text-gray-500">{page} / {totalPages}</span>
            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-white rounded-xl text-sm text-[#007AFF] disabled:opacity-40 shadow-sm font-medium">
              Siguiente
            </button>
          </div>
        )}
      </div>

      {/* Exercise detail sheet */}
      {selected && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/50" onClick={() => setSelected(null)}>
          <div className="mt-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-lg">{selected.name}</h3>
              <button onClick={() => setSelected(null)} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>
            {selected.mediaUrl && (
              <div className="mx-4 mt-4 rounded-2xl bg-gray-100 overflow-hidden h-52">
                <img src={selected.mediaUrl} alt={selected.name} className="w-full h-full object-contain" />
              </div>
            )}
            <div className="px-5 py-4 space-y-3">
              <div className="flex gap-2 flex-wrap">
                {selected.muscleGroup && <span className="bg-[#007AFF]/10 text-[#007AFF] text-xs px-3 py-1 rounded-full font-medium">{selected.muscleGroup}</span>}
                {selected.equipment && <span className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full font-medium">{selected.equipment}</span>}
              </div>
              {selected.instructions && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-1">Instrucciones</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{selected.instructions}</p>
                </div>
              )}
              <div className="flex gap-4 text-center pt-2 pb-4">
                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{selected.defaultSets ?? '–'}</p>
                  <p className="text-xs text-gray-400">Series</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-xl p-3">
                  <p className="text-lg font-bold text-gray-900">{selected.defaultReps ?? '–'}</p>
                  <p className="text-xs text-gray-400">Reps</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
