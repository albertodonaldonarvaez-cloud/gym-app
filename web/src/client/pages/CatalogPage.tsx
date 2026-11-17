import { useState, useEffect } from 'react'
import { Search, X, ChevronRight, ChevronLeft, Dumbbell } from 'lucide-react'
import { getExercises } from '../clientApi'
import type { Exercise } from '../clientApi'

const MUSCLES: { label: string; val: string; isCategory?: boolean }[] = [
  { label: 'Todos', val: '' },
  { label: 'Pecho', val: 'Pecho' },
  { label: 'Espalda', val: 'Espalda' },
  { label: 'Hombros', val: 'Hombros' },
  { label: 'Piernas', val: 'Piernas' },
  { label: 'Cuádriceps', val: 'Cuádriceps' },
  { label: 'Isquiotibiales', val: 'Isquiotibiales' },
  { label: 'Glúteos', val: 'Glúteos' },
  { label: 'Bíceps', val: 'Bíceps' },
  { label: 'Tríceps', val: 'Tríceps' },
  { label: 'Abdomen', val: 'Abdomen' },
  { label: 'Gemelos', val: 'Gemelos' },
  { label: 'Cardio', val: 'Cardio' },
  { label: 'Estiramiento', val: 'Estiramiento', isCategory: true },
]

const EQUIPMENTS = [
  { label: 'Todo equipo', val: '' },
  { label: 'Peso Corporal', val: 'Peso Corporal' },
  { label: 'Mancuernas', val: 'Mancuernas' },
  { label: 'Barra', val: 'Barra' },
  { label: 'Máquina', val: 'Máquina' },
  { label: 'Polea / Cable', val: 'Polea / Cable' },
  { label: 'Kettlebell', val: 'Kettlebell' },
  { label: 'Bandas Elásticas', val: 'Bandas Elásticas' },
]

function getImgs(ex: Exercise): string[] {
  const arr = ex.imageUrls?.length ? ex.imageUrls : ex.mediaUrl ? [ex.mediaUrl] : []
  return arr.filter(Boolean)
}

function parseSteps(raw?: string | null): string[] {
  if (!raw) return []
  const cleaned = raw.trim()
  if (!cleaned) return []
  const lines = cleaned.includes('\n')
    ? cleaned.split('\n')
    : cleaned.split(/\.\s+(?=[A-ZÁÉÍÓÚÑ¿])/).map((s, i, a) => (i < a.length - 1 && !s.endsWith('.') ? s + '.' : s))
  return lines.map(s => s.replace(/^\s*(?:\d+[.):\-]\s*)+/, '').trim()).filter(Boolean)
}

function ExerciseThumb({ ex }: { ex: Exercise }) {
  const imgs = getImgs(ex)
  const [idx, setIdx] = useState(0)
  const [failed, setFailed] = useState(false)
  const src = imgs[idx]
  const isGif = !!src && /\.gif(\?|$)/i.test(src)

  if (!src || failed) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <Dumbbell className="w-6 h-6 text-gray-300" />
      </div>
    )
  }

  return (
    <div className="relative w-full h-full">
      <img
        src={src}
        alt={ex.name}
        loading="lazy"
        className="w-full h-full object-contain p-1"
        onError={() => {
          if (idx < imgs.length - 1) setIdx(i => i + 1)
          else setFailed(true)
        }}
      />
      {isGif && (
        <span className="absolute bottom-0.5 right-0.5 px-1 rounded bg-[#007AFF]/90 text-white text-[8px] font-bold">
          GIF
        </span>
      )}
    </div>
  )
}

function ExerciseSkeleton() {
  return (
    <div className="animate-pulse flex items-center gap-3 bg-white rounded-2xl p-3 shadow-sm">
      <div className="w-16 h-16 rounded-xl bg-gray-200 flex-shrink-0" />
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
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [muscle, setMuscle] = useState('')
  const [category, setCategory] = useState('')
  const [equipment, setEquipment] = useState('')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Exercise | null>(null)
  const [detailImgIdx, setDetailImgIdx] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 280)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    let active = true
    setLoading(true)
    getExercises({
      search: debouncedSearch || undefined,
      muscle: muscle || undefined,
      category: category || undefined,
      equipment: equipment || undefined,
      page,
      limit: 24,
    })
      .then(res => {
        if (!active) return
        setExercises(res.data ?? [])
        setTotal(res.total ?? 0)
        setTotalPages(res.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [debouncedSearch, muscle, category, equipment, page])

  const selectMuscleChip = (m: { val: string; isCategory?: boolean }) => {
    setPage(1)
    if (m.isCategory) {
      setCategory(m.val)
      setMuscle('')
    } else {
      setCategory('')
      setMuscle(m.val)
    }
  }

  const openDetail = (ex: Exercise) => {
    setDetailImgIdx(0)
    setSelected(ex)
  }

  const detailImgs = selected ? getImgs(selected) : []
  const detailSteps = selected ? parseSteps(selected.instructions) : []

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Sticky header */}
      <div className="bg-[#F2F2F7]/95 backdrop-blur-md sticky top-0 z-10 px-4 pt-5 pb-3 space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold text-gray-900">Catálogo</h1>
          <span className="text-xs font-semibold text-gray-500">
            {total.toLocaleString()} ejercicios
          </span>
        </div>

        <div className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar ejercicio, músculo o equipo..."
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
          {MUSCLES.map(m => {
            const isSelected = m.isCategory ? category === m.val : (!category && muscle === m.val)
            return (
              <button
                key={m.label}
                onClick={() => selectMuscleChip(m)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                  isSelected ? 'bg-[#007AFF] text-white shadow-sm' : 'bg-white text-gray-600 shadow-sm'
                }`}
              >
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Equipment chips */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {EQUIPMENTS.map(eq => (
            <button
              key={eq.label}
              onClick={() => { setEquipment(eq.val); setPage(1) }}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 ${
                equipment === eq.val
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-white/80 text-gray-500 border border-gray-200/80'
              }`}
            >
              {eq.label}
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
              <p className="text-sm text-gray-400 mt-1">Intenta otra búsqueda o limpia los filtros</p>
              {(search || muscle || category || equipment) && (
                <button
                  onClick={() => { setSearch(''); setMuscle(''); setCategory(''); setEquipment(''); setPage(1) }}
                  className="mt-3 px-4 py-2 rounded-xl bg-white text-[#007AFF] text-xs font-semibold shadow-sm"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )
          : exercises.map(ex => (
            <button
              key={ex.id}
              onClick={() => openDetail(ex)}
              className="w-full bg-white rounded-2xl p-3 flex items-center gap-3 shadow-sm active:scale-[0.98] transition-transform text-left"
            >
              <div className="w-16 h-16 rounded-xl bg-slate-50 border border-gray-100 overflow-hidden flex-shrink-0">
                <ExerciseThumb ex={ex} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 text-sm line-clamp-2 leading-snug">{ex.name}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span className="text-[11px] font-medium text-[#007AFF] bg-[#007AFF]/10 px-2 py-0.5 rounded-full">
                    {ex.muscleGroup || ex.category}
                  </span>
                  {ex.equipment && (
                    <span className="text-[11px] text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {ex.equipment}
                    </span>
                  )}
                </div>
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
            style={{ maxHeight: '90vh', paddingBottom: 'env(safe-area-inset-bottom)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>
            {/* Header */}
            <div className="flex items-start justify-between px-5 pb-3 gap-2">
              <div className="min-w-0">
                <h3 className="font-bold text-gray-900 text-lg leading-tight">{selected.name}</h3>
                {selected.muscleGroup && (
                  <p className="text-xs text-gray-500 mt-0.5">{selected.muscleGroup} · {selected.category}</p>
                )}
              </div>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-90 transition-transform flex-shrink-0"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            </div>

            <div className="overflow-y-auto scroll-ios no-scrollbar" style={{ maxHeight: 'calc(90vh - 120px)' }}>
              {detailImgs.length > 0 && (
                <div className="relative mx-4 rounded-2xl bg-slate-50 border border-gray-100 overflow-hidden" style={{ height: '240px' }}>
                  <img
                    src={detailImgs[detailImgIdx]}
                    alt={selected.name}
                    className="w-full h-full object-contain p-2"
                    onError={() => {
                      if (detailImgIdx < detailImgs.length - 1) setDetailImgIdx(i => i + 1)
                    }}
                  />
                  {detailImgs.length > 1 && (
                    <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-white/90 backdrop-blur px-2.5 py-1 rounded-full shadow-sm border border-gray-200">
                      <button
                        type="button"
                        onClick={() => setDetailImgIdx(i => Math.max(0, i - 1))}
                        disabled={detailImgIdx === 0}
                        className="p-0.5 text-gray-700 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="text-[11px] font-semibold text-gray-700">
                        {detailImgIdx + 1} / {detailImgs.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDetailImgIdx(i => Math.min(detailImgs.length - 1, i + 1))}
                        disabled={detailImgIdx === detailImgs.length - 1}
                        className="p-0.5 text-gray-700 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  )}
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
                  {selected.category && (
                    <span className="bg-violet-50 text-violet-600 text-xs px-3 py-1 rounded-full font-medium">{selected.category}</span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-2xl p-3.5 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selected.defaultSets ?? '–'}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Series sugeridas</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-3.5 text-center">
                    <p className="text-2xl font-bold text-gray-900">{selected.defaultReps ?? '–'}</p>
                    <p className="text-xs text-gray-500 font-medium mt-0.5">Repeticiones</p>
                  </div>
                </div>

                {detailSteps.length > 0 && (
                  <div>
                    <p className="text-sm font-bold text-gray-800 mb-2.5">Instrucciones paso a paso</p>
                    <ol className="space-y-2.5">
                      {detailSteps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-sm text-gray-600 leading-relaxed">
                          <span className="shrink-0 w-5 h-5 rounded-full bg-[#007AFF]/10 text-[#007AFF] text-xs font-bold flex items-center justify-center mt-0.5">
                            {i + 1}
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
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
