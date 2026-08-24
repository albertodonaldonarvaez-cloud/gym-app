// GymAura Client API
const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

export const getToken = () => localStorage.getItem('gymaura_token') ?? ''
export const getUser = (): AuthUser | null => {
  try { return JSON.parse(localStorage.getItem('gymaura_user') ?? 'null') } catch { return null }
}
export const setAuth = (token: string, user: AuthUser) => {
  localStorage.setItem('gymaura_token', token)
  localStorage.setItem('gymaura_user', JSON.stringify(user))
}
export const clearAuth = () => {
  localStorage.removeItem('gymaura_token')
  localStorage.removeItem('gymaura_user')
}
const authHeader = () => ({
  'Authorization': `Bearer ${getToken()}`,
  'Content-Type': 'application/json'
})

export interface AuthUser { id: string; name: string; email: string; role: string }
export interface RoutineExercise {
  exerciseId: string; name?: string; sets: number; reps: number
  targetWeightKg?: number; rpe?: number; notes?: string
  mediaUrl?: string; instructions?: string; muscleGroup?: string
}
export interface DaySchedule { dayName: string; focus: string; exercises: RoutineExercise[] }
export interface WeeklyRoutine { id?: string; title?: string; schedule: Record<string, DaySchedule> }
export interface Exercise {
  id: string; name: string; category: string; muscleGroup: string; equipment: string
  instructions: string; mediaUrl: string | null; defaultSets: number; defaultReps: number
}
export interface SetLog {
  exerciseId: string; exerciseName: string; weightKg: number; reps: number
  setNumber: number; rpe?: number; sessionId?: string; dayName?: string; restSeconds?: number
}
export interface WorkoutHistoryEntry {
  id: string; createdAt: string; exerciseName: string; exerciseId: string
  setNumber: number; weightKg: number; reps: number; rpe?: number; notes?: string
}

export async function login(email: string, password: string) {
  const r = await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  if (!r.ok) throw new Error('Credenciales incorrectas')
  return r.json() as Promise<{ token: string; user: AuthUser }>
}

export async function getCurrentRoutine(): Promise<WeeklyRoutine> {
  const r = await fetch(`${BASE}/api/v1/routines/current-week`, { headers: authHeader() })
  if (!r.ok) throw new Error('Error obteniendo rutina')
  return r.json()
}

export async function getRoutineMeta() {
  const r = await fetch(`${BASE}/api/v1/routines/current-week/meta`, { headers: authHeader() })
  if (!r.ok) throw new Error('meta error')
  return r.json() as Promise<{ id: string | null; updatedAt: number | null }>
}

export async function getExercises(params?: {
  page?: number; limit?: number; search?: string; muscle?: string
}) {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.search) q.set('search', params.search)
  if (params?.muscle) q.set('muscle', params.muscle)
  const r = await fetch(`${BASE}/api/exercises?${q}`, { headers: authHeader() })
  if (!r.ok) throw new Error('Error ejercicios')
  return r.json() as Promise<{ data: Exercise[]; total: number; pages: number }>
}

export async function getLastPerformance(exerciseId: string) {
  try {
    const r = await fetch(`${BASE}/api/v1/exercises/${exerciseId}/last-performance`, { headers: authHeader() })
    if (!r.ok) return null
    return r.json() as Promise<{ weightKg: number; reps: number } | null>
  } catch { return null }
}

export async function syncSets(sets: SetLog[]) {
  if (sets.length === 0) return
  const r = await fetch(`${BASE}/api/v1/workouts/sync`, {
    method: 'POST', headers: authHeader(), body: JSON.stringify({ sets })
  })
  if (!r.ok) throw new Error(`Sync failed: ${r.status}`)
}

export async function getWorkoutHistory(): Promise<WorkoutHistoryEntry[]> {
  const r = await fetch(`${BASE}/api/v1/user/workout-history`, { headers: authHeader() })
  if (!r.ok) return []
  const data = await r.json()
  return Array.isArray(data) ? data : (data.sets ?? data.logs ?? [])
}

// ─── Offline cache ───
const ROUTINE_KEY = 'gymaura_routine_cache'
const ROUTINE_META_KEY = 'gymaura_routine_meta'

export function getCachedRoutine(): WeeklyRoutine | null {
  try { return JSON.parse(localStorage.getItem(ROUTINE_KEY) ?? 'null') } catch { return null }
}
export function setCachedRoutine(r: WeeklyRoutine, meta?: { id: string; updatedAt: number }) {
  localStorage.setItem(ROUTINE_KEY, JSON.stringify(r))
  if (meta) localStorage.setItem(ROUTINE_META_KEY, JSON.stringify(meta))
}
export function getCachedMeta() {
  try { return JSON.parse(localStorage.getItem(ROUTINE_META_KEY) ?? 'null') as { id: string; updatedAt: number } | null } catch { return null }
}

export async function getRoutineOfflineFirst(): Promise<WeeklyRoutine | null> {
  const cached = getCachedRoutine()
  try {
    const meta = await getRoutineMeta()
    if (!meta.id) return cached
    const cachedMeta = getCachedMeta()
    const changed = !cachedMeta || cachedMeta.id !== meta.id ||
      (!!meta.updatedAt && cachedMeta.updatedAt < meta.updatedAt)
    if (changed) {
      const fresh = await getCurrentRoutine()
      setCachedRoutine(fresh, { id: meta.id, updatedAt: meta.updatedAt ?? Date.now() })
      return fresh
    }
    return cached
  } catch { return cached }
}

// ─── Pending sets queue (offline) ───
const PENDING_KEY = 'gymaura_pending_sets'
export function getPendingSets(): SetLog[] {
  try { return JSON.parse(localStorage.getItem(PENDING_KEY) ?? '[]') } catch { return [] }
}
export function addPendingSet(s: SetLog) {
  const sets = getPendingSets(); sets.push(s)
  localStorage.setItem(PENDING_KEY, JSON.stringify(sets))
}
export function clearPendingSets() { localStorage.removeItem(PENDING_KEY) }
export async function flushPendingSets() {
  const sets = getPendingSets()
  if (sets.length === 0) return
  await syncSets(sets)
  clearPendingSets()
}
