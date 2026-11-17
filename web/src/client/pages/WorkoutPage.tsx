import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { X, ChevronLeft, Check, Clock, Plus, Minus, Info, Trophy, List, SkipForward, Trash2 } from 'lucide-react'
import {
  addPendingSet, flushPendingSets, getLastPerformance,
  getActiveWorkout, saveActiveWorkout, clearActiveWorkout,
} from '../clientApi'
import type { RoutineExercise, ActiveWorkoutSnapshot } from '../clientApi'

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
  return m > 0 ? `${m}:${sec.toString().padStart(2, '0')}` : `${sec}s`
}

/** Pitido suave con Web Audio API al terminar el descanso (funciona también en iOS Safari). */
function playRestBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime
    for (const [offset, freq] of [[0, 660], [0.16, 880]] as const) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, now + offset)
      gain.gain.setValueAtTime(0.0001, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.16, now + offset + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.14)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.15)
    }
    setTimeout(() => { ctx.close().catch(() => {}) }, 500)
  } catch { /* audio blocked or unavailable */ }
}

export default function WorkoutPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const navState = location.state as WorkoutState | null

  const [initial] = useState<ActiveWorkoutSnapshot | null>(() => {
    const saved = getActiveWorkout()
    if (saved) return saved
    if (navState?.exercises?.length) {
      return {
        exercises: navState.exercises,
        dayName: navState.dayName || '',
        focus: navState.focus || '',
        currentIdx: 0,
        exerciseLogs: {},
        sessionId: `ws_${Date.now()}`,
        startedAt: Date.now(),
        completedExercises: [],
      }
    }
    return null
  })

  const exercises = initial?.exercises ?? []
  const dayName = initial?.dayName ?? ''
  const focus = initial?.focus ?? ''
  const [sessionId] = useState(() => initial?.sessionId ?? `ws_${Date.now()}`)
  const [startedAt] = useState(() => initial?.startedAt ?? Date.now())

  const [currentIdx, setCurrentIdx] = useState(() => Math.min(initial?.currentIdx ?? 0, Math.max(0, exercises.length - 1)))
  const [exerciseLogs, setExerciseLogs] = useState<ExerciseLogs>(() => initial?.exerciseLogs ?? {})
  const [completedExercises, setCompletedExercises] = useState<Set<number>>(() => new Set(initial?.completedExercises ?? []))
  const [weight, setWeight] = useState('')
  const [reps, setReps] = useState('')
  const [restSecs, setRestSecs] = useState(0)
  const [isResting, setIsResting] = useState(false)
  const [showInfo, setShowInfo] = useState(false)
  const [showExerciseList, setShowExerciseList] = useState(false)
  const [showExitDialog, setShowExitDialog] = useState(false)
  const [lastPerf, setLastPerf] = useState<{ weightKg: number; reps: number } | null>(null)
  const [finishing, setFinishing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const current = exercises[currentIdx]
  const currentLogs = exerciseLogs[currentIdx] ?? []
  const setsTarget = current?.sets ?? 3

  // Persistir sesión en curso en localStorage
  useEffect(() => {
    if (exercises.length === 0) return
    saveActiveWorkout({
      exercises,
      dayName,
      focus,
      currentIdx,
      exerciseLogs,
      sessionId,
      startedAt,
      completedExercises: Array.from(completedExercises),
    })
  }, [exercises, dayName, focus, currentIdx, exerciseLogs, sessionId, startedAt, completedExercises])

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
    const plan = current.setDetails?.[prev?.length ?? 0]
    if (plan) {
      setReps(String(plan.reps))
      setWeight(String(plan.weightKg ?? prev?.[prev.length - 1]?.weightKg ?? lastPerf?.weightKg ?? current.targetWeightKg ?? ''))
    } else if (prev && prev.length > 0) {
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
            playRestBeep()
            return 0
          }
          return s - 1
        })
      }, 1000)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isResting])

  const adjustRest = (delta: number) => {
    setRestSecs(s => {
      const next = Math.min(600, s + delta)
      if (next <= 0) {
        if (timerRef.current) clearInterval(timerRef.current)
        setIsResting(false)
        return 0
      }
      return next
    })
  }

  // Auto-mark exercise as done when sets complete
  useEffect(() => {
    const logs = exerciseLogs[currentIdx] ?? []
    if (logs.length >= setsTarget && !completedExercises.has(currentIdx)) {
      setCompletedExercises(prev => new Set(prev).add(currentIdx))
    }
  }, [exerciseLogs, currentIdx, setsTarget])

  const logSet = useCallback(() => {
    if (!current || !weight || !reps) return
    const w = parseFloat(weight.replace(',', '.'))
    const r = parseInt(reps)
    if (isNaN(w) || isNaN(r) || w < 0 || r < 1) return

    const newSet: LoggedSet = { weightKg: w, reps: r, done: true }
    const newLogs = [...(exerciseLogs[currentIdx] ?? []), newSet]
    setExerciseLogs(prev => ({ ...prev, [currentIdx]: newLogs }))

    addPendingSet({
      exerciseId: current.exerciseId,
      exerciseName: current.name ?? current.exerciseId,
      weightKg: w, reps: r,
      setNumber: newLogs.length,
      sessionId, dayName,
    })

    // Try to sync immediately (non-blocking)
    flushPendingSets().catch(() => {})

    const nextPlan = current.setDetails?.[newLogs.length]
    if (nextPlan) {
      setReps(String(nextPlan.reps))
      if (nextPlan.weightKg !== undefined) setWeight(String(nextPlan.weightKg))
    }
    if (navigator.vibrate) navigator.vibrate(50)
    setRestSecs(current.restSeconds ?? 90)
    setIsResting(true)
    setShowInfo(false)
  }, [current, weight, reps, currentIdx, exerciseLogs, sessionId, dayName])

  const totalSetsLogged = Object.values(exerciseLogs).reduce((a, sets) => a + sets.length, 0)

  const finishWorkout = async () => {
    setFinishing(true)
    try {
      await flushPendingSets({ sessionId, dayName, durationSeconds: Math.round((Date.now() - startedAt) / 1000) })
    } catch {}
    clearActiveWorkout()
    navigate('/client', { replace: true })
  }

  const discardWorkout = () => {
    clearActiveWorkout()
    navigate('/client', { replace: true })
  }

  const handleCloseTap = () => {
    if (totalSetsLogged > 0) {
      setShowExitDialog(true)
    } else {
      discardWorkout()
    }
  }

  const goToExercise = (idx: number) => {
    if (isResting && timerRef.current) { clearInterval(timerRef.current); setIsResting(false) }
    setShowInfo(false)
    setShowExerciseList(false)
    setCurrentIdx(idx)
  }

  // Find next incomplete exercise
  const findNextIncomplete = () => {
    for (let i = 0; i < exercises.length; i++) {
      const idx = (currentIdx + 1 + i) % exercises.length
      const logs = exerciseLogs[idx] ?? []
      if (logs.length < (exercises[idx]?.sets ?? 3)) return idx
    }
    return -1
  }

  const skipToNext = () => {
    const next = findNextIncomplete()
    if (next >= 0) goToExercise(next)
  }

  if (exercises.length === 0) {
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
  const allComplete = exercises.every((_, i) => (exerciseLogs[i]?.length ?? 0) >= (exercises[i]?.sets ?? 3))
  const progress = exercises.reduce((acc, _, i) => {
    const logs = exerciseLogs[i]?.length ?? 0
    const target = exercises[i]?.sets ?? 3
    return acc + Math.min(logs / target, 1)
  }, 0) / exercises.length

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col overflow-hidden select-none"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>

      {/* Progress bar */}
      <div className="h-1 bg-gray-700 flex-shrink-0">
        <div className="h-full bg-[#007AFF] transition-all duration-700 ease-out"
          style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <button onClick={() => currentIdx > 0 ? goToExercise(currentIdx - 1) : navigate('/client')}
          title={currentIdx > 0 ? 'Ejercicio anterior' : 'Volver al inicio (pausa el entrenamiento)'}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-white/10 active:bg-white/20 transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-xs text-gray-400 font-medium">{focus || dayName || 'Entrenamiento'}</p>
          <p className="text-sm font-bold">
            {currentIdx + 1}<span className="text-gray-500 font-normal"> / {exercises.length}</span>
            <span className="text-gray-500 ml-2 text-xs">{totalSetsLogged} series totales</span>
          </p>
        </div>
        <div className="flex gap-1.5">
          <button onClick={() => setShowExerciseList(!showExerciseList)}
            aria-label="Lista de ejercicios"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${showExerciseList ? 'bg-[#007AFF]/30 text-[#007AFF]' : 'bg-white/10 active:bg-white/20'}`}>
            <List className="w-5 h-5" />
          </button>
          <button onClick={handleCloseTap}
            aria-label="Salir o terminar entrenamiento"
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${finishing ? 'bg-green-500/20' : 'bg-white/10 active:bg-white/20'}`}>
            {finishing ? <Check className="w-5 h-5 text-green-400" /> : <X className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Exercise list drawer */}
      {showExerciseList && (
        <div className="mx-4 mb-3 bg-gray-800 rounded-2xl overflow-hidden flex-shrink-0 max-h-60 overflow-y-auto">
          {exercises.map((ex, i) => {
            const logs = exerciseLogs[i] ?? []
            const target = ex.sets ?? 3
            const isDone = logs.length >= target
            const isCurrent = i === currentIdx
            return (
              <button key={i} onClick={() => goToExercise(i)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-gray-700/50 last:border-0 ${
                  isCurrent ? 'bg-[#007AFF]/20' : 'active:bg-gray-700/50'
                }`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
                  isDone ? 'bg-[#34C759] text-white' : isCurrent ? 'bg-[#007AFF] text-white' : 'bg-gray-700 text-gray-400'
                }`}>
                  {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${isDone ? 'text-green-400' : 'text-white'}`}>
                    {ex.name ?? ex.exerciseId}
                  </p>
                  <p className="text-xs text-gray-400">{logs.length}/{target} series</p>
                </div>
                {isDone && <span className="text-xs text-green-500 font-medium">✓ Hecho</span>}
                {!isDone && !isCurrent && <span className="text-xs text-gray-500">Pendiente</span>}
              </button>
            )
          })}
        </div>
      )}

      {/* Exercise done banner */}
      {completedExercises.has(currentIdx) && (
        <div className="mx-4 mb-2 bg-green-500/20 border border-green-500/30 rounded-2xl px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-semibold text-sm">¡Ejercicio completado!</span>
          </div>
          {!allComplete && (
            <button onClick={skipToNext}
              className="flex items-center gap-1 text-xs bg-green-500 text-white px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform">
              <SkipForward className="w-3.5 h-3.5" />
              Siguiente
            </button>
          )}
        </div>
      )}

      {/* Exercise name + muscle */}
      <div className="px-5 pb-3 flex-shrink-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold leading-tight">{current?.name ?? current?.exerciseId ?? 'Ejercicio'}</h2>
            {current?.muscleGroup && (
              <p className="text-sm text-gray-400 mt-0.5 capitalize">{current.muscleGroup}</p>
            )}
          </div>
          <button onClick={() => setShowInfo(!showInfo)}
            aria-label="Ver instrucciones"
            className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${showInfo ? 'bg-[#007AFF]/30 text-[#007AFF]' : 'bg-white/10 text-gray-400'}`}>
            <Info className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* GIF / Image */}
      <div className="mx-4 rounded-2xl bg-gray-800 overflow-hidden flex-shrink-0" style={{ height: '160px' }}>
        {current?.mediaUrl ? (
          <img src={current.mediaUrl} alt={current.name ?? ''} className="w-full h-full object-contain p-1" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2">
            <Trophy className="w-12 h-12 text-gray-600" />
            <p className="text-gray-600 text-xs">Sin imagen</p>
          </div>
        )}
      </div>

      {/* Instructions (collapsible) */}
      {showInfo && (current?.instructions || current?.notes) && (
        <div className="mx-4 mt-2 bg-gray-800/80 rounded-2xl p-4 flex-shrink-0 max-h-36 overflow-y-auto space-y-2">
          {current.notes && (
            <p className="text-xs text-blue-300 font-medium">Nota del coach: {current.notes}</p>
          )}
          {current.instructions && (
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-line">{current.instructions}</p>
          )}
        </div>
      )}

      {/* Rest timer */}
      {isResting && (
        <div className="mx-4 mt-3 bg-[#007AFF]/20 border border-[#007AFF]/30 rounded-2xl px-4 py-3 flex items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#007AFF]" />
            <span className="text-[#007AFF] font-semibold text-sm">Descanso</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => adjustRest(-15)}
              className="px-2 py-1 rounded-lg bg-white/10 text-xs font-semibold text-gray-200 active:scale-95">
              -15s
            </button>
            <span className="text-xl font-bold text-[#007AFF] tabular-nums min-w-[3.2rem] text-center">{formatTime(restSecs)}</span>
            <button onClick={() => adjustRest(15)}
              className="px-2 py-1 rounded-lg bg-white/10 text-xs font-semibold text-gray-200 active:scale-95">
              +15s
            </button>
            <button onClick={() => { if (timerRef.current) clearInterval(timerRef.current); setIsResting(false); setRestSecs(0) }}
              className="text-xs bg-[#007AFF] text-white px-3 py-1.5 rounded-lg font-bold active:scale-95 transition-transform ml-1">
              Saltar
            </button>
          </div>
        </div>
      )}

      {/* Last performance + series dots */}
      <div className="mx-4 mt-3 flex items-center justify-between flex-shrink-0">
        <div className="text-xs text-gray-400">
          {lastPerf
            ? <span>Anterior: <span className="text-gray-200 font-semibold">{lastPerf.weightKg}kg x {lastPerf.reps}</span></span>
            : <span className="text-gray-500">Sin registro previo</span>
          }
        </div>
        <div className="flex gap-1.5 items-center">
          <span className="text-xs text-gray-400 mr-1">{setsLogged}/{setsTarget}</span>
          {Array.from({ length: setsTarget }).map((_, i) => (
            <div key={i} className={`rounded-full transition-all ${
              i < setsLogged
                ? 'w-6 h-6 bg-[#34C759] flex items-center justify-center'
                : i === setsLogged
                ? 'w-3 h-3 bg-[#007AFF] animate-pulse'
                : 'w-2.5 h-2.5 bg-gray-700'
            }`}>
              {i < setsLogged && <Check className="w-3 h-3 text-white" />}
            </div>
          ))}
        </div>
      </div>

      {/* Logged sets mini list */}
      {currentLogs.length > 0 && (
        <div className="mx-4 mt-2 space-y-1 flex-shrink-0 max-h-28 overflow-y-auto">
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
              <button onPointerDown={e => { e.preventDefault(); setWeight(w => String(Math.max(0, Math.round((parseFloat(w || '0') - 2.5) * 10) / 10))) }}
                className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" inputMode="decimal" value={weight}
                onChange={e => setWeight(e.target.value)}
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2.5 outline-none border-none min-w-0 w-0" />
              <button onPointerDown={e => { e.preventDefault(); setWeight(w => String(Math.round((parseFloat(w || '0') + 2.5) * 10) / 10)) }}
                className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
          {/* Reps */}
          <div>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">Reps</p>
            <div className="flex items-center gap-1.5">
              <button onPointerDown={e => { e.preventDefault(); setReps(r => String(Math.max(1, parseInt(r || '1') - 1))) }}
                className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Minus className="w-4 h-4" />
              </button>
              <input type="number" inputMode="numeric" value={reps}
                onChange={e => setReps(e.target.value)}
                className="flex-1 bg-gray-700 text-center text-white font-bold text-lg rounded-xl py-2.5 outline-none border-none min-w-0 w-0" />
              <button onPointerDown={e => { e.preventDefault(); setReps(r => String(parseInt(r || '0') + 1)) }}
                className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center active:bg-gray-600 transition-colors flex-shrink-0">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <button onClick={logSet}
          className={`w-full text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.97] transition-transform text-base shadow-lg ${
            setsLogged >= setsTarget
              ? 'bg-orange-500 shadow-orange-900/40'
              : 'bg-[#34C759] shadow-green-900/40'
          }`}>
          <Check className="w-5 h-5" />
          {setsLogged >= setsTarget ? `Serie extra ${setsLogged + 1}` : `Registrar Serie ${setsLogged + 1} / ${setsTarget}`}
        </button>
      </div>

      {/* Next / Skip / Finish */}
      <div className="flex gap-2 px-4 mb-3 flex-shrink-0">
        {completedExercises.has(currentIdx) && !allComplete && (
          <button onClick={skipToNext}
            className="flex-1 bg-[#007AFF] text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform text-sm shadow-lg shadow-blue-900/40">
            <SkipForward className="w-4 h-4" />
            Siguiente ejercicio
          </button>
        )}
        {!completedExercises.has(currentIdx) && exercises.length > 1 && (
          <button onClick={skipToNext}
            className="flex-1 bg-gray-800 text-white py-3.5 rounded-2xl font-semibold flex items-center justify-center gap-1.5 active:bg-gray-700 transition-colors text-sm">
            <SkipForward className="w-4 h-4" /> Saltar (máquina ocupada)
          </button>
        )}
        {allComplete && (
          <button onClick={finishWorkout} disabled={finishing}
            className="flex-1 bg-[#007AFF] text-white py-3.5 rounded-2xl font-bold flex items-center justify-center gap-1.5 active:scale-[0.97] transition-transform text-sm shadow-lg shadow-blue-900/40 disabled:opacity-60">
            {finishing ? 'Guardando...' : <><Trophy className="w-4 h-4" /> Terminar Entrenamiento</>}
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
                  ? 'w-2.5 h-2.5 bg-[#34C759]'
                  : logs.length > 0
                  ? 'w-2.5 h-2.5 bg-yellow-500'
                  : 'w-2 h-2 bg-gray-600'
              }`} />
          )
        })}
      </div>

      {/* Exit / Discard confirmation dialog */}
      {showExitDialog && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
             onClick={() => setShowExitDialog(false)}>
          <div className="w-full max-w-sm bg-gray-800 border border-gray-700 rounded-3xl p-5 space-y-3"
               onClick={e => e.stopPropagation()}>
            <div>
              <h3 className="text-lg font-bold text-white">¿Qué quieres hacer con esta sesión?</h3>
              <p className="text-xs text-gray-400 mt-1">
                Llevas {totalSetsLogged} serie{totalSetsLogged === 1 ? '' : 's'} registrada{totalSetsLogged === 1 ? '' : 's'}. Puedes guardarla en tu historial o descartarla.
              </p>
            </div>
            <button
              onClick={finishWorkout}
              disabled={finishing}
              className="w-full py-3.5 rounded-2xl bg-[#007AFF] text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              <Trophy className="w-4 h-4" />
              {finishing ? 'Guardando...' : 'Guardar y terminar entrenamiento'}
            </button>
            <button
              onClick={() => setShowExitDialog(false)}
              className="w-full py-3.5 rounded-2xl bg-gray-700 text-white font-semibold text-sm active:scale-[0.98]"
            >
              Seguir entrenando
            </button>
            <button
              onClick={discardWorkout}
              className="w-full py-3 rounded-2xl bg-red-500/15 text-red-400 font-semibold text-sm flex items-center justify-center gap-2 active:bg-red-500/25"
            >
              <Trash2 className="w-4 h-4" />
              Descartar entrenamiento en curso
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
