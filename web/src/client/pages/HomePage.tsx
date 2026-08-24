import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Dumbbell, Flame, ChevronRight, Wifi, WifiOff } from 'lucide-react'
import { getRoutineOfflineFirst, getUser, getCachedRoutine } from '../clientApi'
import type { WeeklyRoutine, DaySchedule } from '../clientApi'

const DAY_MAP: Record<string, string> = {
  'monday':'Lunes','tuesday':'Martes','wednesday':'Miercoles',
  'thursday':'Jueves','friday':'Viernes','saturday':'Sabado','sunday':'Domingo',
  'lunes':'Lunes','martes':'Martes','miercoles':'Miercoles',
  'jueves':'Jueves','viernes':'Viernes','sabado':'Sabado','domingo':'Domingo'
}

function getTodayKey(): string {
  const days = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado']
  return days[new Date().getDay()]
}

function getTodaySchedule(routine: WeeklyRoutine | null): DaySchedule | null {
  if (!routine?.schedule) return null
  const today = getTodayKey()
  const schedule = routine.schedule
  // Try exact match first, then mapped
  for (const key of Object.keys(schedule)) {
    const norm = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (norm === today || DAY_MAP[norm]?.toLowerCase() === today) {
      return schedule[key]
    }
  }
  return null
}

export default function HomePage() {
  const navigate = useNavigate()
  const user = getUser()
  const [routine, setRoutine] = useState<WeeklyRoutine | null>(null)
  const [loading, setLoading] = useState(true)
  const [isOffline, setIsOffline] = useState(false)

  useEffect(() => {
    // Show cached first immediately
    const cached = getCachedRoutine()
    if (cached) { setRoutine(cached); setLoading(false) }

    // Then fetch fresh
    getRoutineOfflineFirst().then(r => {
      if (r) { setRoutine(r); setLoading(false) }
      else if (!cached) setLoading(false)
    }).catch(() => {
      setIsOffline(true)
      if (!cached) setLoading(false)
    })
  }, [])

  const today = getTodaySchedule(routine)
  const todayName = getTodayKey()
  const todayLabel = DAY_MAP[todayName] ?? todayName

  const startWorkout = () => {
    if (!today) return
    const state = { exercises: today.exercises, dayName: today.dayName || todayLabel, focus: today.focus }
    navigate('/client/workout', { state })
  }

  return (
    <div className="min-h-screen bg-[#F2F2F7]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      {/* Header */}
      <div className="px-5 pt-6 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500 font-medium">{todayLabel}</p>
            <h1 className="text-2xl font-bold text-gray-900">
              Hola, {user?.name?.split(' ')[0] ?? 'Atleta'} 👋
            </h1>
          </div>
          <div className={`p-2 rounded-full ${isOffline ? 'bg-orange-100' : 'bg-green-100'}`}>
            {isOffline ? <WifiOff className="w-5 h-5 text-orange-500" /> : <Wifi className="w-5 h-5 text-green-500" />}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#007AFF]/20 animate-pulse" />
          <p className="text-gray-400 text-sm">Cargando rutina...</p>
        </div>
      ) : !routine ? (
        <div className="mx-4 mt-4 bg-white rounded-2xl p-6 text-center shadow-sm">
          <Dumbbell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-700">Sin rutina asignada</p>
          <p className="text-sm text-gray-400 mt-1">Tu entrenador aun no te ha asignado una rutina</p>
        </div>
      ) : (
        <div className="px-4 space-y-4 pb-6">
          {/* Workout card for today */}
          {today ? (
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-[#007AFF] to-[#5856D0] p-5">
                <p className="text-blue-100 text-sm font-medium mb-1">Entrenamiento de hoy</p>
                <h2 className="text-white text-xl font-bold">{today.focus || today.dayName || todayLabel}</h2>
                <p className="text-blue-200 text-sm mt-1">{today.exercises?.length ?? 0} ejercicios</p>
              </div>
              <div className="p-4 space-y-2">
                {(today.exercises ?? []).slice(0, 4).map((ex, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    <div className="w-8 h-8 rounded-xl bg-[#007AFF]/10 flex items-center justify-center text-xs font-bold text-[#007AFF]">
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-800">{ex.name || ex.exerciseId}</p>
                      <p className="text-xs text-gray-400">{ex.sets} series x {ex.reps} reps{ex.targetWeightKg ? ` · ${ex.targetWeightKg}kg` : ''}</p>
                    </div>
                    {ex.mediaUrl && (
                      <img src={ex.mediaUrl} alt={ex.name} className="w-10 h-10 rounded-lg object-cover" />
                    )}
                  </div>
                ))}
                {(today.exercises?.length ?? 0) > 4 && (
                  <p className="text-xs text-gray-400 text-center pt-1">+{(today.exercises?.length ?? 0) - 4} ejercicios mas</p>
                )}
              </div>
              <div className="p-4 pt-0">
                <button
                  onClick={startWorkout}
                  className="w-full bg-[#007AFF] text-white font-semibold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-base"
                >
                  <Dumbbell className="w-5 h-5" />
                  Iniciar Entrenamiento
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-6 text-center shadow-sm">
              <Flame className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="font-semibold text-gray-700">Dia de descanso</p>
              <p className="text-sm text-gray-400 mt-1">No hay entrenamiento programado para hoy</p>
            </div>
          )}

          {/* Weekly overview */}
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <h3 className="font-semibold text-gray-800 mb-3">Esta semana</h3>
            <div className="space-y-2">
              {Object.entries(routine.schedule ?? {}).map(([key, day]) => {
                const normKey = key.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                const isToday = normKey === todayName || DAY_MAP[normKey]?.toLowerCase() === todayName
                return (
                  <div key={key} className={`flex items-center gap-3 p-3 rounded-xl ${isToday ? 'bg-[#007AFF]/10' : 'bg-gray-50'}`}>
                    <div className={`w-2 h-2 rounded-full ${isToday ? 'bg-[#007AFF]' : 'bg-gray-300'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${isToday ? 'text-[#007AFF]' : 'text-gray-700'}`}>
                        {DAY_MAP[normKey] ?? key}
                      </p>
                      <p className="text-xs text-gray-400">{day.focus || 'Entrenamiento'} · {day.exercises?.length ?? 0} ejercicios</p>
                    </div>
                    {isToday && <span className="text-xs bg-[#007AFF] text-white px-2 py-0.5 rounded-full font-medium">Hoy</span>}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
