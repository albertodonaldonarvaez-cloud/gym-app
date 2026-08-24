import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, ChevronRight, WifiOff, RotateCcw, Calendar, Zap } from 'lucide-react'
import { getRoutineOfflineFirst, getCachedRoutine, getUser } from '../clientApi'
import type { WeeklyRoutine, DaySchedule } from '../clientApi'

// Normalize day names ignoring accents and case
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

const DAYS_ES: Record<string, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miercoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sabado',
  sunday: 'Domingo', monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miercoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sabado',
}
const TODAY_IDX = new Date().getDay() // 0=Sunday
const TODAY_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][TODAY_IDX]
const TODAY_ES = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'][TODAY_IDX]

function getDayLabel(key: string): string {
  return DAYS_ES[norm(key)] ?? key
}

function getTodaySchedule(routine: WeeklyRoutine | null): DaySchedule | null {
  if (!routine?.schedule) return null
  for (const [key, day] of Object.entries(routine.schedule)) {
    const n = norm(key)
    if (n === TODAY_ES || n === TODAY_EN) return day
  }
  return null
}

function DaySkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden animate-pulse">
      <div className="h-28 bg-gradient-to-r from-gray-200 to-gray-100" />
      <div className="p-4 space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
        <div className="h-12 bg-gray-200 rounded-xl" />
      </div>
    </div>
  )
}

export default function HomePage() {
  const navigate = useNavigate()
  const user = getUser()
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null)
  const [loading, setLoading] = useState(true)
  const [offline, setOffline] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    // Show cache immediately
    const cached = getCachedRoutine()
    if (cached && !showRefresh) { setRoutine(cached); setLoading(false) }

    try {
      const fresh = await getRoutineOfflineFirst()
      if (fresh) { setRoutine(fresh); setOffline(false) }
      else if (!cached) setOffline(true)
    } catch {
      setOffline(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const today = getTodaySchedule(routine)
  const userName = user?.name?.split(' ')[0] ?? 'Atleta'

  const startWorkout = () => {
    if (!today) return
    navigate('/client/workout', {
      state: { exercises: today.exercises, dayName: today.dayName || TODAY_ES, focus: today.focus }
    })
  }

  const MUSCLE_COLORS: Record<string, string> = {
    pecho: 'text-red-500', espalda: 'text-blue-500', hombros: 'text-purple-500',
    piernas: 'text-green-600', gluteos: 'text-pink-500', biceps: 'text-orange-500',
    triceps: 'text-yellow-600', abdomen: 'text-teal-500',
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">
            {new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^\w/, c => c.toUpperCase())}
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Hola, {userName} 👋</h1>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
            offline ? 'bg-orange-100' : 'bg-[#007AFF]/10'
          } ${refreshing ? 'animate-spin' : 'active:scale-90'}`}
        >
          {offline
            ? <WifiOff className="w-4 h-4 text-orange-500" />
            : <RotateCcw className={`w-4 h-4 text-[#007AFF] ${refreshing ? 'opacity-50' : ''}`} />
          }
        </button>
      </div>

      {offline && (
        <div className="mx-4 mb-3 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center gap-2">
          <WifiOff className="w-4 h-4 text-orange-500 flex-shrink-0" />
          <p className="text-sm text-orange-700">Modo offline &mdash; mostrando rutina guardada</p>
        </div>
      )}

      <div className="px-4 space-y-4 pb-6">
        {loading ? (
          <DaySkeleton />
        ) : !routine ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 text-lg">Sin rutina asignada</p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              Tu entrenador todavia no te ha asignado una rutina semanal
            </p>
          </div>
        ) : (
          <>
            {/* Today's workout card */}
            {today ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Gradient header */}
                <div className="bg-gradient-to-br from-[#007AFF] to-[#5856D0] px-5 py-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-blue-200" fill="currentColor" />
                    <p className="text-blue-100 text-sm font-medium">Entrenamiento de hoy</p>
                  </div>
                  <h2 className="text-white text-xl font-bold">{today.focus || today.dayName || 'Hoy'}</h2>
                  <p className="text-blue-200 text-sm mt-1 font-medium">
                    {today.exercises?.length ?? 0} ejercicios
                  </p>
                </div>

                {/* Exercise list preview */}
                <div className="px-4 pt-3 pb-2 space-y-1">
                  {(today.exercises ?? []).map((ex, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      {ex.mediaUrl ? (
                        <img src={ex.mediaUrl} alt="" className="w-11 h-11 rounded-xl object-cover bg-gray-100 flex-shrink-0" />
                      ) : (
                        <div className={`w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0`}>
                          <Dumbbell className={`w-5 h-5 ${MUSCLE_COLORS[norm(ex.muscleGroup ?? '')] ?? 'text-gray-400'}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{ex.name ?? ex.exerciseId}</p>
                        <p className="text-xs text-gray-400">
                          {ex.sets} series x {ex.reps} reps
                          {ex.targetWeightKg ? ` · ${ex.targetWeightKg} kg` : ''}
                        </p>
                      </div>
                      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                        <span className="text-[10px] font-bold text-gray-500">{i + 1}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="px-4 pb-4 pt-1">
                  <button
                    onClick={startWorkout}
                    className="w-full bg-[#007AFF] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-base shadow-md shadow-blue-200"
                  >
                    <Zap className="w-5 h-5" fill="currentColor" />
                    Iniciar Entrenamiento
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
                <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Calendar className="w-8 h-8 text-green-500" />
                </div>
                <p className="font-bold text-gray-700 text-lg">Dia de descanso</p>
                <p className="text-sm text-gray-400 mt-1">No hay entrenamiento programado para hoy. Descansa y recuperate.</p>
              </div>
            )}

            {/* Weekly overview */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2">
                <h3 className="font-bold text-gray-800 text-base">Esta semana</h3>
              </div>
              <div className="px-4 pb-4 space-y-1.5">
                {Object.entries(routine.schedule ?? {}).map(([key, day]) => {
                  const isToday = norm(key) === TODAY_ES || norm(key) === TODAY_EN
                  return (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-xl ${
                      isToday ? 'bg-[#007AFF]/10' : 'bg-gray-50'
                    }`}>
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isToday ? 'bg-[#007AFF]' : 'bg-gray-300'}`} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isToday ? 'text-[#007AFF]' : 'text-gray-700'}`}>
                          {getDayLabel(key)}
                        </p>
                        <p className="text-xs text-gray-400 truncate">
                          {day.focus || 'Entrenamiento'} &middot; {day.exercises?.length ?? 0} ejercicios
                        </p>
                      </div>
                      {isToday && (
                        <span className="text-[10px] bg-[#007AFF] text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">HOY</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
