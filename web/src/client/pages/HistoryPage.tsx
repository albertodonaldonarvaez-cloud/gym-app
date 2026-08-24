import { useEffect, useState, useCallback } from 'react'
import { getWorkoutHistory } from '../clientApi'
import type { WorkoutHistoryEntry } from '../clientApi'
import { Calendar, ChevronDown, ChevronUp, Dumbbell, RotateCcw } from 'lucide-react'

interface ExGroup { name: string; sets: WorkoutHistoryEntry[] }
interface DayGroup {
  dateKey: string; label: string; subLabel: string
  exercises: ExGroup[]; totalVolume: number; totalSets: number
}

function groupByDay(entries: WorkoutHistoryEntry[]): DayGroup[] {
  const map = new Map<string, WorkoutHistoryEntry[]>()
  for (const e of entries) {
    const d = new Date(e.createdAt)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries())
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([key, es]) => {
      const d = new Date(es[0].createdAt)
      const exMap = new Map<string, WorkoutHistoryEntry[]>()
      for (const e of es) {
        const n = e.exerciseName || e.exerciseId || 'Ejercicio'
        if (!exMap.has(n)) exMap.set(n, [])
        exMap.get(n)!.push(e)
      }
      return {
        dateKey: key,
        label: d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase()),
        subLabel: d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }),
        exercises: Array.from(exMap.entries()).map(([name, sets]) => ({
          name, sets: sets.sort((a,b) => a.setNumber - b.setNumber)
        })),
        totalVolume: es.reduce((acc, e) => acc + (e.weightKg * e.reps), 0),
        totalSets: es.length,
      }
    })
}

export default function HistoryPage() {
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      const data = await getWorkoutHistory()
      setGroups(groupByDay(data ?? []))
      // Auto-expand first day
      if (data && data.length > 0) {
        const firstKey = groupByDay(data)[0]?.dateKey
        if (firstKey) setExpanded(new Set([firstKey]))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando historial')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-3 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
          {!loading && groups.length > 0 && (
            <p className="text-sm text-gray-400 mt-0.5">{groups.length} dias de entrenamiento</p>
          )}
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className={`w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm active:scale-90 transition-all ${refreshing ? 'animate-spin' : ''}`}
        >
          <RotateCcw className="w-4 h-4 text-gray-500" />
        </button>
      </div>

      <div className="px-4 space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse shadow-sm" />
          ))
        ) : error ? (
          <div className="text-center py-12 bg-white rounded-2xl shadow-sm">
            <p className="text-red-500 font-semibold">{error}</p>
            <button onClick={() => load()} className="mt-3 text-sm text-[#007AFF] font-medium">Reintentar</button>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-gray-700">Sin historial todavia</p>
            <p className="text-sm text-gray-400 mt-1 px-6 leading-relaxed">
              Registra un entrenamiento desde la pantalla de inicio para verlo aqui
            </p>
          </div>
        ) : (
          groups.map(day => {
            const isOpen = expanded.has(day.dateKey)
            return (
              <div key={day.dateKey} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Day header */}
                <button
                  className="w-full px-4 py-4 flex items-center gap-3 active:bg-gray-50 transition-colors"
                  onClick={() => toggle(day.dateKey)}
                >
                  <div className="w-11 h-11 rounded-2xl bg-[#007AFF]/10 flex items-center justify-center flex-shrink-0">
                    <Dumbbell className="w-5 h-5 text-[#007AFF]" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="font-bold text-gray-800 text-sm capitalize truncate">{day.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {day.exercises.length} ejercicios &middot; {day.totalSets} series &middot; {Math.round(day.totalVolume).toLocaleString()} kg vol.
                    </p>
                  </div>
                  {isOpen
                    ? <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    : <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
                  }
                </button>

                {/* Expanded exercises */}
                {isOpen && (
                  <div className="border-t border-gray-50 px-4 pb-4 space-y-3 pt-3">
                    {day.exercises.map(({ name, sets }) => (
                      <div key={name}>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">{name}</p>
                        <div className="space-y-1.5">
                          {sets.map((s, i) => (
                            <div key={i} className="flex items-center gap-2.5 bg-gray-50 rounded-xl px-3 py-2.5">
                              <div className="w-6 h-6 rounded-full bg-[#007AFF] text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                                {s.setNumber}
                              </div>
                              <span className="text-sm font-semibold text-gray-800">
                                {s.weightKg} kg &times; {s.reps} reps
                              </span>
                              {s.rpe != null && s.rpe > 0 && (
                                <span className="ml-auto text-xs text-gray-400 font-medium">RPE {s.rpe}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                    {/* Day summary */}
                    <div className="flex gap-3 pt-2">
                      <div className="flex-1 bg-[#007AFF]/5 rounded-xl p-3 text-center">
                        <p className="text-base font-bold text-[#007AFF]">{day.totalSets}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">SERIES</p>
                      </div>
                      <div className="flex-1 bg-[#34C759]/5 rounded-xl p-3 text-center">
                        <p className="text-base font-bold text-[#34C759]">{Math.round(day.totalVolume).toLocaleString()}</p>
                        <p className="text-[10px] text-gray-400 font-medium mt-0.5">KG VOLUMEN</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
