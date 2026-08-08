// API base URL — in Docker uses env var, in dev uses Vite proxy
const BASE = import.meta.env.VITE_API_URL ?? ''

// ─── Types ────────────────────────────────────────────────────────────────────
export interface LoginResponse {
  token: string
  user: { id: string; name: string; email: string; role: string }
}

export interface Athlete {
  id: string
  name: string
  email: string
  goal: string
  weightKg: number
  heightCm: number
  avatar: string
}

export interface Exercise {
  id: string
  name: string
  category: string
  targetMuscle: string
  muscleGroup: string
  equipment: string
  instructions: string
  defaultSets: number
  defaultReps: number
  mediaUrl: string | null
  imageUrls: string[]
  icon: string
}

export interface ExercisesResponse {
  data: Exercise[]
  total: number
  page: number
  pages: number
}

export interface RoutineDay {
  dayName: string
  focus: string
  exercises: RoutineExercise[]
}

export interface RoutineExercise {
  exerciseId: string
  sets: number
  reps: number
  targetWeightKg?: number
  rpe?: number
  notes?: string
  name?: string
  mediaUrl?: string
  muscleGroup?: string
}

export interface RoutinePlan {
  id: string
  title: string
  description: string
  schedule: Record<string, RoutineDay>
}

export interface SetLog {
  id: string
  exerciseId: string
  exerciseName: string
  weightKg: number
  reps: number
  rpe: number
  setNumber: number
  createdAt: string
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────
const getHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('gymaura_token') ?? ''}`,
})

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? 'Error desconocido')
  }
  return res.json()
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const login = (email: string, password: string) =>
  fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  }).then(r => handleResponse<LoginResponse>(r))

// ─── Athletes ─────────────────────────────────────────────────────────────────
export const getAthletes = () =>
  fetch(`${BASE}/api/coach/clients`, { headers: getHeaders() })
    .then(r => handleResponse<Athlete[]>(r))

// ─── Exercises ────────────────────────────────────────────────────────────────
export const getExercises = (params?: {
  search?: string
  category?: string
  muscle_group?: string
  page?: number
  limit?: number
}) => {
  const qs = new URLSearchParams()
  if (params?.search)       qs.set('search', params.search)
  if (params?.category)     qs.set('category', params.category)
  if (params?.muscle_group) qs.set('muscle_group', params.muscle_group)
  if (params?.page)         qs.set('page', String(params.page))
  if (params?.limit)        qs.set('limit', String(params.limit))
  return fetch(`${BASE}/api/exercises?${qs}`, { headers: getHeaders() })
    .then(r => handleResponse<ExercisesResponse>(r))
}

// ─── Routine Plans ────────────────────────────────────────────────────────────
export const getRoutineForAthlete = (athleteId: string) =>
  fetch(`${BASE}/api/routines/${athleteId}`, { headers: getHeaders() })
    .then(r => handleResponse<RoutinePlan>(r))

export const saveRoutine = (athleteId: string, data: {
  title: string
  description: string
  schedule: Record<string, RoutineDay>
}) =>
  fetch(`${BASE}/api/routines/${athleteId}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(data),
  }).then(r => handleResponse<RoutinePlan>(r))

// ─── Workout history ──────────────────────────────────────────────────────────
export const getWorkoutHistory = (athleteId: string) =>
  fetch(`${BASE}/api/v1/user/workout-history?athleteId=${athleteId}`, { headers: getHeaders() })
    .then(r => handleResponse<SetLog[]>(r))

// ─── Admin Types ──────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string
  name: string
  email: string
  role: string
  avatar: string
  goal: string
  weightKg: number
  heightCm: number
  coachId: string | null
  createdAt: string
  coach?: { id: string; name: string; email: string } | null
}

export interface AdminStats {
  totalUsers: number
  totalCoaches: number
  totalClients: number
  totalExercises: number
  unassigned: number
}

// ─── Admin API ────────────────────────────────────────────────────────────────
export const getAdminStats = () =>
  fetch(`${BASE}/api/admin/stats`, { headers: getHeaders() })
    .then(r => handleResponse<AdminStats>(r))

export const getAdminUsers = (params?: { role?: string; search?: string }) => {
  const qs = new URLSearchParams()
  if (params?.role && params.role !== 'ALL') qs.set('role', params.role)
  if (params?.search) qs.set('search', params.search)
  return fetch(`${BASE}/api/admin/users?${qs}`, { headers: getHeaders() })
    .then(r => handleResponse<AdminUser[]>(r))
}

export const createAdminUser = (data: { email: string; password: string; name: string; role: string; coachId?: string; goal?: string; weightKg?: number; heightCm?: number }) =>
  fetch(`${BASE}/api/admin/users`, { method: 'POST', headers: getHeaders(), body: JSON.stringify(data) })
    .then(r => handleResponse<{ id: string; email: string; name: string; role: string }>(r))

export const updateAdminUser = (id: string, data: Record<string, unknown>) =>
  fetch(`${BASE}/api/admin/users/${id}`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify(data) })
    .then(r => handleResponse<{ id: string; email: string; name: string; role: string }>(r))

export const deleteAdminUser = (id: string) =>
  fetch(`${BASE}/api/admin/users/${id}`, { method: 'DELETE', headers: getHeaders() })
    .then(r => handleResponse<{ ok: boolean }>(r))

export const assignCoach = (clientId: string, coachId: string) =>
  fetch(`${BASE}/api/admin/assign`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ clientId, coachId }) })
    .then(r => handleResponse<{ id: string; name: string; coachId: string }>(r))

export const unassignCoach = (clientId: string) =>
  fetch(`${BASE}/api/admin/unassign`, { method: 'PUT', headers: getHeaders(), body: JSON.stringify({ clientId }) })
    .then(r => handleResponse<{ id: string; name: string; coachId: null }>(r))
