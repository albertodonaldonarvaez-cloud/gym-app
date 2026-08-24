import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Check, Timer, Plus, Minus, Flame } from 'lucide-react'
import { addPendingSet, flushPendingSets, getUser } from '../clientApi'
import type { RoutineExercise } from '../clientApi'

interface WorkoutState {
  exercises: RoutineExercise[]
  dayName: string
  focus: string
}

interface LoggedSet {
  weightKg: number
  reps: number
  rpe?: number
  done: boolean
}

type ExerciseLogs = Record<number, LoggedSet[]>  // exerciseIndex -> sets[]

export default function WorkoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state as WorkoutState | null

  const [currentIdx, setCurrentIdx] = useState(0)
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogs>({})
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [restSecs, setRestSecs] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [sessionId] = useState(() => `ws_${Date.now()}`)
  const restRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const exercises = state?.exercises ?? []
  const current = exercises[currentIdx]
  const currentLogs = exerciseLogs[currentIdx] ?? []
  const user = getUser()

  // Prefill weight from last logged set or target
  useEffect(() => {
    if (!current) return
    const prevSets = exerciseLogs[currentIdx]
    if (prevSets && prevSets.length > 0) {
      setWeight(String(prevSets[prevSets.length - 1].weightKg))
      setReps(String(prevSets[prevSets.length - 1].reps))
    } else {
      setWeight(String(current.targetWeightKg ?? ''))
      setReps(String(current.reps ?? 10))
    }
  }, [currentIdx, current])

  // Rest timer
  useEffect(() => {
    if (isResting && restSecs > 0) {
      restRef.current = setTimeout(() => setRestSecs(s => s - 1), 1000)
    } else if (restSecs === 0 && isResting) {
      setIsResting(false)
      if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    }
    return () => { if (restRef.current) clearTimeout(restRef.current) }
  }, [isResting, restSecs])

  const logSet = useCallback(() => {
    if (!current || !weight || !reps) return
    const w = parseFloat(weight)
    const r = parseInt(reps)
    if (isNaN(w) || isNaN(r)) return

    const newSet: LoggedSet = { weightKg: w, reps: r, done: true }
    setExerciseLogs(prev => ({
      ...prev,
      [currentIdx]: [...(prev[currentIdx] ?? []), newSet]
    }))

    // Save to pending queue
    addPendingSet({
      exerciseId: current.exerciseId,
      exerciseName: current.name ?? current.exerciseId,
      weightKg: w, reps: r,
      setNumber: (exerciseLogs[currentIdx]?.length ?? 0) + 1,
      sessionId, dayName: state?.dayName ?? '',
    })

    // Start rest timer (90s default)
    setRestSecs(90)
    setIsResting(true)
  }, [current, weight, reps, currentIdx, exerciseLogs, sessionId, state])

  const finishWorkout = async () => {
    await flushPendingSets()
    navigate('/client', { replace: true })
  }

  const setsLogged = currentLogs.length
  const setsTarget = current?.sets ?? 3
  const progress = exercises.length > 0 ? (currentIdx / exercises.length) : 0

  if (!state || exercises.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7]">
        <div className="text-center p-8">
          <p className="text-gray-600 mb-4">No hay ejercicios para mostrar</p>
          <button onClick={() => navigate('/client')} className="bg-[#007AFF] text-white px-6 py-3 rounded-xl font-semibold">
            Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Progress bar */}
      <div className="h-1 bg-gray-700">
        <div className="h-full bg-[#007AFF] transition-all duration-500" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <button onClick={() => currentIdx > 0 ? setCurrentIdx(i => i - 1) : navigate('/client')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium">{state?.focus ?? state?.dayName ?? 'Entrenamiento'}</p>
          <p className="text-sm font-semibold">{currentIdx + 1} de {exercises.length}</p>
        </div>
        <button onClick={finishWorkout}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Exercise name */}
      <div className="px-5 pb-2">
        <h2 className="text-xl font-bold">{current?.name ?? current?.exerciseId ?? 'Ejercicio'}</h2>
        {current?.muscleGroup && <p className="text-sm text-gray-400 mt-0.5">{current.muscleGroup}</p>}
      </div>

      {/* GIF / media */}
      <div className="mx-4 rounded-2xl bg-gray-800 overflow-hidden" style={{ height: '200px' }}>
        {current?.mediaUrl ? (
          <img src={current.mediaUrl} alt={current.name} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Flame className="w-16 h-16 text-gray-600" />
          </div>
        )}
      </div>

      {/* Rest timer overlay */}
      {isResting && (
        <div className="mx-4 mt-3 bg-[#007AFF]/20 border border-[#007AFF]/40 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-5 h-5 text-[#007AFF]" />
            <span className="text-[#007AFF] font-semibold">Descanso</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-[#007AFF]">{restSecs}s</span>
            <button onClick={() => { setIsResting(false); setRestSecs(0) }}
              className="text-xs bg-[#007AFF] text-white px-3 py-1.5 rounded-xl font-semibold active:scale-95 transition-transform">
              Saltar
            </button>
          </div>
        </div>
      )}

      {/* Series logged */}
      <div className="mx-4 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-gray-400 font-medium">Series: {setsLogged}/{setsTarget}</p>
          <div className="flex gap-1">
            {Array.from({ length: setsTarget }).map((_, i) => (
              <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                i < setsLogged ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-400'
              }`}>
                {i < setsLogged ? <Check className="w-3 h-3" /> : i + 1}
              </div>
            ))}
          </div>
        </div>
        {currentLogs.length > 0 && (
          <div className="space-y-1.5 mb-3">
            {currentLogs.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2">
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
                <span className="text-sm font-medium">Serie {i + 1}</span>
                <span className="text-sm text-gray-400 ml-auto">{s.weightKg} kg x {s.reps} reps</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Input row */}
      <div className="mx-4 mt-2 bg-gray-800 rounded-2xl p-4">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">Peso (kg)</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setWeight(w => String(Math.max(0, parseFloat(w || '0') - 2.5)))}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:scale-95 transition-transform">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
                inputMode="decimal"
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2 outline-none border-none min-w-0" />
              <button onClick={() => setWeight(w => String(parseFloat(w || '0') + 2.5))}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 font-medium block mb-1.5">Reps</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setReps(r => String(Math.max(1, parseInt(r || '0') - 1)))}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:scale-95 transition-transform">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" value={reps} onChange={e => setReps(e.target.value)}
                inputMode="numeric"
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2 outline-none border-none min-w-0" />
              <button onClick={() => setReps(r => String(parseInt(r || '0') + 1))}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:scale-95 transition-transform">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <button onClick={logSet}
          className="w-full bg-[#34C759] text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform text-base">
          <Check className="w-5 h-5" />
          Registrar Serie {setsLogged + 1}
        </button>
      </div>

      {/* Nav buttons */}
      <div className="flex gap-3 px-4 mt-4 mb-4">
        <button onClick={() => setShowInstructions(!showInstructions)}
          className="flex-1 border border-gray-600 text-gray-300 py-3 rounded-xl text-sm font-medium active:bg-gray-800 transition-colors">
          Instrucciones
        </button>
        {currentIdx < exercises.length - 1 ? (
          <button onClick={() => setCurrentIdx(i => i + 1)}
            className="flex-1 bg-[#007AFF] text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
            Siguiente <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={finishWorkout}
            className="flex-1 bg-green-500 text-white py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1 active:scale-95 transition-transform">
            Terminar <Check className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Instructions sheet */}
      {showInstructions && current?.instructions && (
        <div className="mx-4 mb-4 bg-gray-800 rounded-2xl p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-2">Instrucciones</h4>
          <p className="text-sm text-gray-400 leading-relaxed">{current.instructions}</p>
        </div>
      )}
    </div>
  )
}
