import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, ChevronRight, ChevronDown, WifiOff, RotateCcw, Calendar, Zap, Play, X } from 'lucide-react'
import {
  getRoutineOfflineFirst, getCachedRoutine, getUser,
  getActiveWorkout, saveActiveWorkout, clearActiveWorkout,
} from '../clientApi'
import type { WeeklyRoutine, DaySchedule, ActiveWorkoutSnapshot } from '../clientApi'

// Normalize day names ignoring accents and case
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

const DAYS_ES: Record<string, string> = {
  domingo: 'Domingo', lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado',
  sunday: 'Domingo', monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
  thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado',
}
const TODAY_IDX = new Date().getDay() // 0=Sunday
const TODAY_EN = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][TODAY_IDX]
const TODAY_ES = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'][TODAY_IDX]

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
        {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded-xl" />)}
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
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkoutSnapshot | null>(() => getActiveWorkout())
  const [expandedDay, setExpandedDay] = useState<string | null>(null)

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    else setLoading(true)

    setActiveWorkout(getActiveWorkout())

    // Show cache immediately
    const cached = getCachedRoutine()
    if (cached && !showRefresh) { setRoutine(cached); setLoading(false) }

    try {
      const fresh = await getRoutineOfflineFirst()
      if (fresh) { setRoutine(fresh); setOffline(!navigator.onLine) }
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

  const startDayWorkout = (day: DaySchedule | null, fallbackDayName: string) => {
    if (!day || !day.exercises?.length) return
    const cur = getActiveWorkout()
    const loggedCount = cur ? Object.values(cur.exerciseLogs).reduce((a, s) => a + s.length, 0) : 0
    if (cur && loggedCount > 0) {
      if (!window.confirm(`Tienes un entrenamiento en curso (${cur.focus || cur.dayName || 'Sesión'}) con ${loggedCount} series registradas. ¿Iniciar uno nuevo en su lugar?`)) {
        return
      }
    }
    const snap: ActiveWorkoutSnapshot = {
      exercises: day.exercises,
      dayName: day.dayName || fallbackDayName,
      focus: day.focus || '',
      currentIdx: 0,
      exerciseLogs: {},
      sessionId: `ws_${Date.now()}`,
      startedAt: Date.now(),
      completedExercises: [],
    }
    saveActiveWorkout(snap)
    setActiveWorkout(snap)
    navigate('/client/workout', {
      state: { exercises: snap.exercises, dayName: snap.dayName, focus: snap.focus }
    })
  }

  const activeLoggedSets = activeWorkout
    ? Object.values(activeWorkout.exerciseLogs).reduce((a, s) => a + s.length, 0)
    : 0
  const activeTargetSets = activeWorkout
    ? activeWorkout.exercises.reduce((a, e) => a + (e.sets || 3), 0)
    : 0

  const MUSCLE_COLORS: Record<string, string> = {
    pecho: 'text-red-500', espalda: 'text-blue-500', hombros: 'text-purple-500',
    piernas: 'text-green-600', cuadriceps: 'text-green-600', isquiotibiales: 'text-emerald-600',
    gluteos: 'text-pink-500', biceps: 'text-orange-500',
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
          aria-label="Actualizar rutina"
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
        {/* Active workout resume banner */}
        {activeWorkout && (
          <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-2xl p-4 text-white shadow-md shadow-emerald-500/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                  Entrenamiento en curso
                </p>
                <h3 className="text-base font-bold mt-0.5">
                  {activeWorkout.focus || getDayLabel(activeWorkout.dayName) || 'Sesión activa'}
                </h3>
                <p className="text-xs text-emerald-100 mt-0.5">
                  {activeLoggedSets} / {activeTargetSets} series completadas
                </p>
              </div>
              <button
                type="button"
                aria-label="Descartar entrenamiento en curso"
                onClick={() => {
                  if (activeLoggedSets === 0 || window.confirm('¿Descartar el entrenamiento en curso?')) {
                    clearActiveWorkout()
                    setActiveWorkout(null)
                  }
                }}
                className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center active:scale-90"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => navigate('/client/workout')}
              className="mt-3 w-full bg-white text-emerald-700 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
            >
              <Play className="w-4 h-4" fill="currentColor" />
              Continuar entrenamiento
            </button>
          </div>
        )}

        {loading ? (
          <DaySkeleton />
        ) : !routine ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Dumbbell className="w-8 h-8 text-gray-300" />
            </div>
            <p className="font-bold text-gray-700 text-lg">Sin rutina asignada</p>
            <p className="text-sm text-gray-400 mt-1 leading-relaxed">
              Tu entrenador todavía no te ha asignado una rutina semanal
            </p>
          </div>
        ) : (
          <>
            {/* Today's workout card */}
            {today && (today.exercises?.length ?? 0) > 0 ? (
              <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
                {/* Gradient header */}
                <div className="bg-gradient-to-br from-[#007AFF] to-[#5856D0] px-5 py-5">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-blue-200" fill="currentColor" />
                    <p className="text-blue-100 text-sm font-medium">Entrenamiento de hoy</p>
                  </div>
                  <h2 className="text-white text-xl font-bold">{today.focus || getDayLabel(today.dayName) || 'Hoy'}</h2>
                  <p className="text-blue-200 text-sm mt-1 font-medium">
                    {today.exercises?.length ?? 0} ejercicios
                  </p>
                </div>

                {/* Exercise list preview */}
                <div className="px-4 pt-3 pb-2 space-y-1">
                  {(today.exercises ?? []).map((ex, i) => (
                    <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                      {ex.mediaUrl ? (
                        <img src={ex.mediaUrl} alt="" className="w-11 h-11 rounded-xl object-contain bg-slate-50 flex-shrink-0" />
                      ) : (
                        <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                          <Dumbbell className={`w-5 h-5 ${MUSCLE_COLORS[norm(ex.muscleGroup ?? '')] ?? 'text-gray-400'}`} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{ex.name ?? ex.exerciseId}</p>
                        <p className="text-xs text-gray-400">
                          {ex.sets} series &times; {ex.reps} reps
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
                    onClick={() => startDayWorkout(today, TODAY_ES)}
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
                <p className="font-bold text-gray-700 text-lg">Día de descanso</p>
                <p className="text-sm text-gray-400 mt-1">No hay entrenamiento programado para hoy. Puedes elegir otro día abajo si deseas adelantar.</p>
              </div>
            )}

            {/* Weekly overview (interactive: tap any day to preview & train) */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
                <h3 className="font-bold text-gray-800 text-base">Esta semana</h3>
                <span className="text-[11px] text-gray-400">Toca un día para ver o entrenar</span>
              </div>
              <div className="px-4 pb-4 space-y-2">
                {Object.entries(routine.schedule ?? {}).map(([key, day]) => {
                  const isToday = norm(key) === TODAY_ES || norm(key) === TODAY_EN
                  const count = day.exercises?.length ?? 0
                  const isOpen = expandedDay === key
                  return (
                    <div key={key} className={`rounded-xl overflow-hidden transition-colors ${
                      isToday ? 'bg-[#007AFF]/10' : 'bg-gray-50'
                    }`}>
                      <button
                        type="button"
                        onClick={() => count > 0 && setExpandedDay(isOpen ? null : key)}
                        className="w-full flex items-center gap-3 p-3 text-left"
                      >
                        <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${isToday ? 'bg-[#007AFF]' : count > 0 ? 'bg-gray-400' : 'bg-gray-300'}`} />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold ${isToday ? 'text-[#007AFF]' : 'text-gray-700'}`}>
                            {getDayLabel(key)}
                          </p>
                          <p className="text-xs text-gray-400 truncate">
                            {day.focus || (count > 0 ? 'Entrenamiento' : 'Descanso')} &middot; {count} ejercicio{count === 1 ? '' : 's'}
                          </p>
                        </div>
                        {isToday && (
                          <span className="text-[10px] bg-[#007AFF] text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0">HOY</span>
                        )}
                        {count > 0 && (
                          <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                        )}
                      </button>

                      {isOpen && count > 0 && (
                        <div className="px-3 pb-3 pt-1 border-t border-black/5 space-y-2">
                          <div className="space-y-1">
                            {day.exercises.map((ex, i) => (
                              <div key={i} className="flex items-center justify-between text-xs text-gray-600 py-1">
                                <span className="truncate pr-2 font-medium">{i + 1}. {ex.name ?? ex.exerciseId}</span>
                                <span className="text-gray-400 shrink-0">{ex.sets}&times;{ex.reps}</span>
                              </div>
                            ))}
                          </div>
                          <button
                            type="button"
                            onClick={() => startDayWorkout(day, getDayLabel(key))}
                            className="w-full py-2.5 rounded-xl bg-[#007AFF] text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-[0.98] transition-transform"
                          >
                            <Play className="w-3.5 h-3.5" fill="currentColor" />
                            Entrenar este día
                          </button>
                        </div>
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
