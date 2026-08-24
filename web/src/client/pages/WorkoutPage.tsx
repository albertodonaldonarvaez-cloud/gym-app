import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, ChevronLeft, ChevronRight, Check, Clock, Plus, Minus, Info, Trophy } from 'lucide-react'
import { addPendingSet, flushPendingSets, getLastPerformance } from '../clientApi'
import type { RoutineExercise } from '../clientApi'

interface WorkoutState {
  exercises: RoutineExercise[]
  dayName: string
  focus: string
}

interface LoggedSet { weightKg: number; reps: number; done: boolean }
type ExerciseLogs = Record<number, LoggedSet[]>

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return m > 0 ? `${m}:${sec.toString().padStart(2,'0')}` : `${sec}s`
}

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
  const [showInfo, setShowInfo] = useState(false)
  const [lastPerf, setLastPerf] = useState<{ weightKg: number; reps: number } | null>(null)
  const [sessionId] = useState(() => `ws_${Date.now()}`)
  const [finishing, setFinishing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const exercises = state?.exercises ?? []
  const current = exercises[currentIdx]
  const currentLogs = exerciseLogs[currentIdx] ?? []

  // Load last performance when exercise changes
  useEffect(() => {
    if (!current?.exerciseId) return
    setLastPerf(null)
    getLastPerformance(current.exerciseId).then(setLastPerf)
  }, [currentIdx, current?.exerciseId])

  // Prefill weight/reps
  useEffect(() => {
    if (!current) return
    const prev = exerciseLogs[currentIdx]
    if (prev && prev.length > 0) {
      const last = prev[prev.length - 1]
      setWeight(String(last.weightKg))
      setReps(String(last.reps))
    } else if (lastPerf) {
      setWeight(String(lastPerf.weightKg))
      setReps(String(lastPerf.reps))
    } else {
      setWeight(String(current.targetWeightKg ?? ''))
      setReps(String(current.reps ?? 10))
    }
  }, [currentIdx, lastPerf])

  // Rest timer
  useEffect(() => {
    if (isResting) {
      timerRef.current = setInterval(() => {
        setRestSecs(s => {
          if (s <= 1) {
            clearInterval(timerRef.current!)
            setIsResting(false)
            if (navigator.vibrate) navigator.vibrate([200, 100, 200])
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isResting])

  const logSet = useCallback(() => {
    if (!current || !weight || !reps) return
    const w = parseFloat(weight.replace(',', '.'))
    const r = parseInt(reps)
    if (isNaN(w) || isNaN(r) || w < 0 || r < 1) return

    const newSet: LoggedSet = { weightKg: w, reps: r, done: true }
    setExerciseLogs(prev => ({
      ...prev, [currentIdx]: [...(prev[currentIdx] ?? []), newSet]
    }))

    addPendingSet({
      exerciseId: current.exerciseId,
      exerciseName: current.name ?? current.exerciseId,
      weightKg: w, reps: r,
      setNumber: (exerciseLogs[currentIdx]?.length ?? 0) + 1,
      sessionId, dayName: state?.dayName ?? '',
    })

    if (navigator.vibrate) navigator.vibrate(50)
    setRestSecs(90)
    setIsResting(true)
    setShowInfo(false)
  }, [current, weight, reps, currentIdx, exerciseLogs, sessionId, state])

  const totalSetsLogged = Object.values(exerciseLogs).reduce((a, sets) => a + sets.length, 0)

  const finishWorkout = async () => {
    setFinishing(true)
    try { await flushPendingSets() } catch {}
    navigate('/client', { replace: true })
  }

  const goToExercise = (idx: number) => {
    if (isResting) { clearInterval(timerRef.current!); setIsResting(false) }
    setShowInfo(false)
    setCurrentIdx(idx)
  }

  if (!state || exercises.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center p-8">
          <p className="text-gray-400 mb-6 text-lg">Sin ejercicios</p>
          <button onClick={() => navigate('/client')}
            className="bg-[#007AFF] text-white px-8 py-4 rounded-2xl font-bold text-base">
            Volver
          </button>
        </div>
      </div>
    )
  }

  const setsLogged = currentLogs.length
  const setsTarget = current?.sets ?? 3
  const progress = (currentIdx + (setsLogged / Math.max(setsTarget, 1)) * 0.9) / exercises.length

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-700 flex-shrink-0">
        <div className="h-full bg-[#007AFF] transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => currentIdx > 0 ? goToExercise(currentIdx - 1) : navigate('/client')}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium">{state?.focus || state?.dayName || 'Entrenamiento'}</p>
          <p className="text-sm font-bold">
            {currentIdx + 1}<span className="text-gray-500 font-normal"> / {exercises.length}</span>
          </p>
        </div>
        <button onClick={finishWorkout}
          className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${finishing ? 'bg-green-500/20' : 'bg-white/10 active:bg-white/20'}`}>
          {finishing ? <Check className="w-5 h-5 text-green-400" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Exercise name + muscle */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold leading-tight">{current?.name ?? current?.exerciseId ?? 'Ejercicio'}</h2>
            {current?.muscleGroup && (
              <p className="text-sm text-gray-400 mt-0.5 capitalize">{current.muscleGroup}</p>
            )}
          </div>
          <button onClick={() => setShowInfo(!showInfo)}
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${showInfo ? 'bg-[#007AFF]/30 text-[#007AFF]' : 'bg-white/10 text-gray-400'}`}>
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GIF */}
      <div className="mx-4 rounded-2xl bg-gray-800 overflow-hidden flex-shrink-0" style={{ height: '190px' }}>
        {current?.mediaUrl ? (
          <img src={current.mediaUrl} alt={current.name ?? ''} className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Trophy className="w-12 h-12 text-gray-600" />
            <p className="text-gray-600 text-xs">Sin imagen</p>
          </div>
        )}
      </div>

      {/* Instructions (collapsible) */}
      {showInfo && current?.instructions && (
        <div className="mx-4 mt-2 bg-gray-800/80 rounded-2xl p-4 flex-shrink-0">
          <p className="text-xs text-gray-400 leading-relaxed">{current.instructions}</p>
        </div>
      )}

      {/* Rest timer */}
      {isResting && (
        <div className="mx-4 mt-3 bg-[#007AFF]/20 border border-[#007AFF]/30 rounded-2xl px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#007AFF]" />
            <span className="text-[#007AFF] font-semibold text-sm">Descansando</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-[#007AFF] tabular-nums">{formatTime(restSecs)}</span>
            <button onClick={() => { clearInterval(timerRef.current!); setIsResting(false); setRestSecs(0) }}
              className="text-xs bg-[#007AFF] text-white px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform">
              Saltar
            </button>
          </div>
        </div>
      )}

      {/* Last performance + series dots */}
      <div className="mx-4 mt-3 flex items-center justify-between flex-shrink-0">
        <div className="text-xs text-gray-500">
          {lastPerf
            ? <span>Anterior: <span className="text-gray-300 font-semibold">{lastPerf.weightKg}kg x {lastPerf.reps}</span></span>
            : <span className="text-gray-600">Sin registro previo</span>
          }
        </div>
        <div className="flex gap-1.5 items-center">
          {Array.from({ length: setsTarget }).map((_, i) => (
            <div key={i} className={`rounded-full transition-all ${
              i < setsLogged
                ? 'w-6 h-6 bg-[#34C759] flex items-center justify-center'
                : 'w-2.5 h-2.5 bg-gray-700'
            }`}>
              {i < setsLogged && <Check className="w-3 h-3 text-white" />}
            </div>
          ))}
        </div>
      </div>

      {/* Logged sets mini list */}
      {currentLogs.length > 0 && (
        <div className="mx-4 mt-2 space-y-1 flex-shrink-0">
          {currentLogs.map((s, i) => (
            <div key={i} className="flex items-center gap-2 bg-gray-800/60 rounded-xl px-3 py-2">
              <div className="w-5 h-5 rounded-full bg-[#34C759] flex items-center justify-center flex-shrink-0">
                <Check className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-400">Serie {i + 1}</span>
              <span className="text-sm font-bold text-white ml-auto">{s.weightKg} kg &times; {s.reps}</span>
            </div>
          ))}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Input + log button */}
      <div className="mx-4 mb-3 bg-gray-800 rounded-2xl p-4 flex-shrink-0">
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Weight */}
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Peso (kg)</p>
            <div className="flex items-center gap-1.5">
              <button onPointerDown={e => { e.preventDefault(); setWeight(w => String(Math.max(0, Math.round((parseFloat(w||'0') - 2.5)*10)/10))) }}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" inputMode="decimal" value={weight}
                onChange={e => setWeight(e.target.value)}
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2 outline-none border-none min-w-0 w-0" />
              <button onPointerDown={e => { e.preventDefault(); setWeight(w => String(Math.round((parseFloat(w||'0') + 2.5)*10)/10)) }}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Reps */}
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Reps</p>
            <div className="flex items-center gap-1.5">
              <button onPointerDown={e => { e.preventDefault(); setReps(r => String(Math.max(1, parseInt(r||'1') - 1))) }}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" inputMode="numeric" value={reps}
                onChange={e => setReps(e.target.value)}
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2 outline-none border-none min-w-0 w-0" />
              <button onPointerDown={e => { e.preventDefault(); setReps(r => String(parseInt(r||'0') + 1)) }}
                className="w-9 h-9 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <button onClick={logSet}
          className="w-full bg-[#34C759] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform text-base shadow-lg shadow-green-900/40">
          <Check className="w-5 h-5" />
          Registrar Serie {setsLogged + 1}
        </button>
      </div>

      {/* Next / Finish */}
      <div className="flex gap-3 px-4 mb-3 flex-shrink-0">
        {currentIdx < exercises.length - 1 ? (
          <button onClick={() => goToExercise(currentIdx + 1)}
            className="flex-1 bg-gray-800 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-1.5 active:bg-gray-700 transition-colors text-sm">
            Siguiente ejercicio <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button onClick={finishWorkout} disabled={finishing}
            className="flex-1 bg-[#007AFF] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform text-sm shadow-lg shadow-blue-900/40 disabled:opacity-60">
            {finishing ? 'Guardando...' : <><Check className="w-4 h-4" /> Terminar Entrenamiento</>}
          </button>
        )}
      </div>

      {/* Exercise dots navigation */}
      <div className="flex gap-1.5 justify-center pb-4 flex-shrink-0">
        {exercises.map((_, i) => {
          const logs = exerciseLogs[i] ?? []
          const isComplete = logs.length >= (exercises[i]?.sets ?? 3)
          return (
            <button key={i} onClick={() => goToExercise(i)}
              className={`rounded-full transition-all active:scale-90 ${
                i === currentIdx
                  ? 'w-5 h-2 bg-[#007AFF]'
                  : isComplete
                  ? 'w-2 h-2 bg-[#34C759]'
                  : 'w-2 h-2 bg-gray-600'
              }`} />
          )
        })}
      </div>
    </div>
  )
}
