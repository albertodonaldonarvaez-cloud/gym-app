import { useEffect, useState, useCallback } from 'react'
import { getExercises } from '../api'
import type { Exercise } from '../api'
import {
  Search, Dumbbell, ChevronLeft, ChevronRight, Filter, X,
  ImageOff, Loader2, ChevronDown, PlayCircle, Plus, Edit2, Trash2, Video
} from 'lucide-react'
import clsx from 'clsx'
import { useAuth } from '../AuthContext'

const CATEGORIES = ['Fuerza','Cardio','Estiramiento','Pliométricos','Powerlifting','Halterofilia','Strongman']
const MUSCLES    = ['Pecho','Espalda','Hombros','Bíceps','Tríceps','Cuádriceps','Isquiotibiales','Glúteos','Abdomen','Gemelos','Antebrazos','Abductores','Aductores']

const BASE = import.meta.env.VITE_API_URL ?? ''

function getEmbedUrl(url?: string | null): string | null {
  if (!url) return null
  const ytMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/))([a-zA-Z0-9_-]{11})/)
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`
  
  const tkMatch = url.match(/tiktok\.com\/.*video\/(\d+)/)
  if (tkMatch) return `https://www.tiktok.com/embed/v2/${tkMatch[1]}`
  
  return null
}

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
        {imgs.length > 0 && !imgError && !getEmbedUrl(imgs[0]) ? (
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
        ) : getEmbedUrl(exercise.mediaUrl) ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400 bg-gray-200">
            <Video className="w-8 h-8 opacity-50" />
            <span className="text-xs opacity-70">Video disponible</span>
          </div>
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

function ExerciseModal({ exercise, onClose, onEdit, onDelete, canEdit }: { exercise: Exercise; onClose: () => void; onEdit?: () => void; onDelete?: () => void; canEdit?: boolean }) {
  const [imgIdx, setImgIdx] = useState(0)
  const imgs = exercise.imageUrls?.length ? exercise.imageUrls : exercise.mediaUrl && !getEmbedUrl(exercise.mediaUrl) ? [exercise.mediaUrl] : []
  const instructions = exercise.instructions?.split('\n').filter(Boolean) ?? []
  
  const embedUrl = getEmbedUrl(exercise.mediaUrl)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/40 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-2xl bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
           onClick={e => e.stopPropagation()}>
        {/* Header / Media */}
        <div className="relative aspect-video bg-gray-100">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          ) : imgs.length > 0 && imgs[imgIdx] ? (
            <img src={imgs[imgIdx]} alt={exercise.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <ImageOff className="w-12 h-12 opacity-20" />
            </div>
          )}
          
          <button onClick={onClose} id="btn-close-modal"
                  className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/80 hover:bg-gray-900/40 text-gray-900 transition-colors z-10">
            <X className="w-4 h-4" />
          </button>
          
          {!embedUrl && imgs.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
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
          <div className="flex justify-between items-start gap-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{exercise.name}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                <span className="badge-purple">{exercise.muscleGroup || exercise.targetMuscle}</span>
                <span className="badge-gray">{exercise.equipment}</span>
                <span className="badge-blue">{exercise.category}</span>
              </div>
            </div>
            
            {canEdit && (
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={onEdit} className="btn-secondary px-3 py-1.5 text-sm text-blue-600 border-blue-200 hover:bg-blue-50">
                  <Edit2 className="w-4 h-4" />
                  Editar
                </button>
                <button onClick={onDelete} className="btn-secondary px-3 py-1.5 text-sm text-red-600 border-red-200 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-gray-100 text-center">
              <p className="text-2xl font-bold text-blue-600">{exercise.defaultSets || '-'}</p>
              <p className="text-xs text-gray-500 mt-0.5">Series sugeridas</p>
            </div>
            <div className="p-3 rounded-xl bg-gray-100 text-center">
              <p className="text-2xl font-bold text-violet-600">{exercise.defaultReps || '-'}</p>
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

function ExerciseFormModal({ 
  exercise, 
  onClose, 
  onSaved 
}: { 
  exercise?: Exercise | null; 
  onClose: () => void;
  onSaved: () => void;
}) {
  const { token } = useAuth()
  const isEdit = !!exercise
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const [form, setForm] = useState({
    name: exercise?.name || '',
    category: exercise?.category || CATEGORIES[0],
    muscleGroup: exercise?.muscleGroup || exercise?.targetMuscle || MUSCLES[0],
    equipment: exercise?.equipment || '',
    defaultSets: exercise?.defaultSets || 3,
    defaultReps: exercise?.defaultReps || 10,
    mediaUrl: exercise?.mediaUrl || '',
    instructions: exercise?.instructions || ''
  })
  
  const [previewUrl, setPreviewUrl] = useState<string | null>(getEmbedUrl(form.mediaUrl))

  useEffect(() => {
    setPreviewUrl(getEmbedUrl(form.mediaUrl))
  }, [form.mediaUrl])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    if (!form.name.trim()) {
      setError('El nombre es requerido')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const url = isEdit ? `${BASE}/api/exercises/${exercise.id}` : `${BASE}/api/exercises`
      const method = isEdit ? 'PUT' : 'POST'
      
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(form)
      })
      
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Error al guardar ejercicio')
      }
      
      onSaved()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
         onClick={onClose}>
      <div className="w-full max-w-xl bg-white border border-gray-300 rounded-2xl shadow-2xl overflow-hidden max-h-[95vh] flex flex-col"
           onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900">
            {isEdit ? 'Editar Ejercicio' : 'Nuevo Ejercicio'}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          
          <form id="exercise-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Nombre *</label>
              <input 
                className="input" 
                value={form.name} 
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej. Press de Banca"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Categoría</label>
                <select 
                  className="input" 
                  value={form.category} 
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Músculo principal</label>
                <select 
                  className="input" 
                  value={form.muscleGroup} 
                  onChange={e => setForm(f => ({ ...f, muscleGroup: e.target.value }))}
                >
                  {MUSCLES.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>
            
            <div>
              <label className="label">Equipo</label>
              <input 
                className="input"
                list="equipments"
                value={form.equipment} 
                onChange={e => setForm(f => ({ ...f, equipment: e.target.value }))}
                placeholder="Ej. Barra, Mancuernas..."
              />
              <datalist id="equipments">
                {['Barra', 'Mancuernas', 'Máquina', 'Peso Corporal', 'Cables', 'Bandas', 'Kettlebell'].map(eq => (
                  <option key={eq} value={eq} />
                ))}
              </datalist>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Series default</label>
                <input 
                  type="number" 
                  min="1"
                  className="input" 
                  value={form.defaultSets} 
                  onChange={e => setForm(f => ({ ...f, defaultSets: parseInt(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className="label">Reps default</label>
                <input 
                  type="number" 
                  min="1"
                  className="input" 
                  value={form.defaultReps} 
                  onChange={e => setForm(f => ({ ...f, defaultReps: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
            
            <div>
              <label className="label">URL del video</label>
              <input 
                className="input" 
                value={form.mediaUrl} 
                onChange={e => setForm(f => ({ ...f, mediaUrl: e.target.value }))}
                placeholder="https://www.tiktok.com/... o YouTube URL"
              />
              {previewUrl && (
                <div className="mt-3 aspect-video bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                  <iframe
                    src={previewUrl}
                    className="w-full h-full"
                    allowFullScreen
                  />
                </div>
              )}
            </div>
            
            <div>
              <label className="label">Instrucciones</label>
              <textarea 
                className="input min-h-[100px] resize-y" 
                value={form.instructions} 
                onChange={e => setForm(f => ({ ...f, instructions: e.target.value }))}
                placeholder="1. Paso uno&#10;2. Paso dos..."
              />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary px-5" disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="exercise-form" className="btn-primary px-5" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? 'Guardar Cambios' : 'Crear Ejercicio'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExercisesPage() {
  const { user, token } = useAuth()
  const isCoach = user?.role === 'COACH' || user?.role === 'ADMIN'

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
  
  // Modals state
  const [showForm, setShowForm] = useState(false)
  const [editExercise, setEditExercise] = useState<Exercise | null>(null)

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

  const handleDelete = async (ex: Exercise) => {
    if (!token || !window.confirm(`¿Estás seguro de eliminar el ejercicio "${ex.name}"?`)) return
    try {
      const res = await fetch(`${BASE}/api/exercises/${ex.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error('Error al eliminar')
      setSelected(null)
      load(page)
    } catch (err) {
      alert('Error al eliminar el ejercicio.')
    }
  }

  const activeFilters = [category, muscle, equipment].filter(Boolean).length

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Catálogo de Ejercicios</h1>
          <p className="text-gray-500 text-sm mt-1">
            {total.toLocaleString()} ejercicios disponibles
          </p>
        </div>
        
        {isCoach && (
          <button 
            onClick={() => { setEditExercise(null); setShowForm(true); }}
            className="btn-primary shadow-lg shadow-brand-500/20 shrink-0"
          >
            <Plus className="w-4 h-4 mr-1" />
            Nuevo Ejercicio
          </button>
        )}
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
      {selected && (
        <ExerciseModal 
          exercise={selected} 
          onClose={() => setSelected(null)} 
          canEdit={isCoach && (selected as any).coachId === user?.id || isCoach} 
          onEdit={() => {
            setEditExercise(selected)
            setSelected(null)
            setShowForm(true)
          }}
          onDelete={() => handleDelete(selected)}
        />
      )}
      
      {/* Create/Edit Form Modal */}
      {showForm && (
        <ExerciseFormModal
          exercise={editExercise}
          onClose={() => {
            setShowForm(false)
            setEditExercise(null)
          }}
          onSaved={() => {
            setShowForm(false)
            setEditExercise(null)
            load(page) // Refresh list
          }}
        />
      )}
    </div>
  )
}
