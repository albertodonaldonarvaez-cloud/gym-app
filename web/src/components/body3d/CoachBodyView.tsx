import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import BodyProgress from './BodyProgress'
import { fetchScans } from './bodyApi'
import type { BodyScan } from './bodyApi'

/** Vista de solo lectura para el coach: avatar 3D y evolución del atleta. */
export default function CoachBodyView({ athleteId }: { athleteId: string }) {
  const [scans, setScans] = useState<BodyScan[] | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    setScans(null); setError(false)
    fetchScans(athleteId).then(setScans).catch(() => setError(true))
  }, [athleteId])

  if (error) return <p className="text-sm text-red-500 py-4 text-center">No se pudo cargar el avatar del atleta.</p>
  if (!scans) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
  return <BodyProgress scans={scans} readOnly />
}
