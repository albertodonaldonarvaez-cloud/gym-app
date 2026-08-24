import { useEffect, useState } from 'react'
import { getWorkoutHistory } from '../clientApi'
import type { WorkoutHistoryEntry } from '../clientApi'
import { Calendar, ChevronDown, ChevronUp, Dumbbell } from 'lucide-react'

interface DayGroup {
  label: string
  dateKey: string
  entries: WorkoutHistoryEntry[]
  totalVolume: number
}

function groupByDay(entries: WorkoutHistoryEntry[]): DayGroup[] {
  const map = new Map<string, WorkoutHistoryEntry[]>()
  for (const e of entries) {
    const key = new Date(e.createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' })
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] > a[0] ? 1 : -1)
    .map(([key, es]) => ({
      dateKey: key,
      label: new Date(es[0].createdAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }),
      entries: es,
      totalVolume: es.reduce((acc, e) => acc + (e.weightKg * e.reps), 0)
    }))
}

function groupByExercise(entries: WorkoutHistoryEntry[]) {
  const map = new Map<string, WorkoutHistoryEntry[]>()
  for (const e of entries) {
    const key = e.exerciseName || e.exerciseId
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(e)
  }
  return Array.from(map.entries()).map(([name, sets]) => ({ name, sets: sets.sort((a,b) => a.setNumber - b.setNumber) }))
}

export default function HistoryPage() {
  const [groups, setGroups] = useState<DayGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    getWorkoutHistory().then(data => {
      setGroups(groupByDay(data ?? []))
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toggle = (key: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-2xl font-bold text-gray-900">Historial</h1>
        <p className="text-sm text-gray-400 mt-0.5">Tus entrenamientos registrados</p>
      </div>

      <div className="px-4 space-y-3 pb-8">
        {loading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl h-20 animate-pulse" />
          ))
        ) : groups.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-14 h-14 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-600">Sin historial todavia</p>
            <p className="text-sm text-gray-400 mt-1">Registra un entrenamiento para verlo aqui</p>
          </div>
        ) : (
          groups.map(day => {
            const isOpen = expanded.has(day.dateKey)
            const byEx = groupByExercise(day.entries)
            return (
              <div key={day.dateKey} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                <button className="w-full px-4 py-4 flex items-center justify-between active:bg-gray-50 transition-colors"
                  onClick={() => toggle(day.dateKey)}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#007AFF]/10 flex items-center justify-center">
                      <Dumbbell className="w-5 h-5 text-[#007AFF]" />
                    </div>
                    <div className="text-left">
                      <p className="font-semibold text-gray-800 text-sm capitalize">{day.label}</p>
                      <p className="text-xs text-gray-400">{byEx.length} ejercicios · {Math.round(day.totalVolume)} kg vol.</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-50">
                    {byEx.map(({ name, sets }) => (
                      <div key={name} className="pt-3">
                        <p className="text-sm font-semibold text-gray-700 mb-2">{name}</p>
                        <div className="space-y-1">
                          {sets.map((s, i) => (
                            <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                              <span className="w-5 h-5 rounded-full bg-[#007AFF] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{s.setNumber}</span>
                              <span className="text-sm text-gray-700 font-medium">{s.weightKg} kg x {s.reps} reps</span>
                              {s.rpe && <span className="ml-auto text-xs text-gray-400">RPE {s.rpe}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
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
