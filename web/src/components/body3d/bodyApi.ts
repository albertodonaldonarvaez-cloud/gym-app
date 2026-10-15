import type { BodyParams } from './bodyModel'

const BASE = import.meta.env.VITE_API_URL ?? ''
const headers = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('gymaura_token')}`,
})

export interface BodyScan {
  id: string
  label: string
  createdAt: string
  params: BodyParams
}

/** Sin athleteId = mis registros. Con athleteId = vista del coach (solo lectura). */
export async function fetchScans(athleteId?: string): Promise<BodyScan[]> {
  const url = athleteId
    ? `${BASE}/api/v1/coach/athletes/${athleteId}/body-scans`
    : `${BASE}/api/v1/user/body-scans`
  const r = await fetch(url, { headers: headers() })
  if (!r.ok) throw new Error('No se pudieron cargar los registros')
  return r.json()
}

export async function saveScan(params: BodyParams, label: string): Promise<BodyScan> {
  const r = await fetch(`${BASE}/api/v1/user/body-scans`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ params, label }),
  })
  const d = await r.json().catch(() => null)
  if (!r.ok) throw new Error(d?.error || 'No se pudo guardar')
  return d
}

export async function deleteScan(id: string): Promise<void> {
  const r = await fetch(`${BASE}/api/v1/user/body-scans/${id}`, { method: 'DELETE', headers: headers() })
  if (!r.ok) throw new Error('No se pudo eliminar')
}
