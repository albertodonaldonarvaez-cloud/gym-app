import { useEffect, useState } from 'react'
import { ImageOff, Loader2 } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

/** Loads an image that requires the Authorization header (private files). */
export default function SecureImage({
  path, alt = '', className = '', onClick,
}: { path: string; alt?: string; className?: string; onClick?: () => void }) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    setSrc(null); setError(false)
    fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(b => { if (cancelled) return; url = URL.createObjectURL(b); setSrc(url) })
      .catch(() => { if (!cancelled) setError(true) })
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url) }
  }, [path])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
        <ImageOff className="w-6 h-6" />
      </div>
    )
  }
  if (!src) {
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    )
  }
  return <img src={src} alt={alt} className={className} onClick={onClick} draggable={false} />
}
