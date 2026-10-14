import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Camera, Loader2, Lock, Trash2, X, Plus, AlertCircle, ShieldCheck } from 'lucide-react'
import SecureImage from './SecureImage'

const BASE = import.meta.env.VITE_API_URL ?? ''
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` })

interface Photo { id: string; label: string; createdAt: string }

const LABELS = ['Frente', 'Perfil', 'Espalda', 'Otra']

/** Resize + recompress on the device so big phone photos upload fast on poor connections. */
async function compress(file: File, maxSide = 1600, quality = 0.85): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, maxSide / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((res, rej) =>
      canvas.toBlob(b => (b ? res(b) : rej(new Error('compress'))), 'image/jpeg', quality))
  } catch { return file }
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' })

interface Props {
  /** 'owner' = the athlete manages their own photos; 'coach' = read-only view of an athlete's photos */
  mode: 'owner' | 'coach'
  athleteId?: string
}

export default function BodyPhotosManager({ mode, athleteId }: Props) {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [label, setLabel] = useState('Frente')
  const [error, setError] = useState('')
  const [viewing, setViewing] = useState<Photo | null>(null)
  const [confirmDel, setConfirmDel] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const listUrl = mode === 'owner'
    ? `${BASE}/api/v1/user/body-photos`
    : `${BASE}/api/v1/coach/athletes/${athleteId}/body-photos`

  const load = () =>
    fetch(listUrl, { headers: auth() })
      .then(r => (r.ok ? r.json() : []))
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false))

  useEffect(() => { load() }, [listUrl])

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(''); setUploading(true)
    try {
      const blob = await compress(file)
      const fd = new FormData()
      fd.append('photo', blob, 'foto.jpg')
      fd.append('label', label)
      const r = await fetch(`${BASE}/api/v1/user/body-photos`, { method: 'POST', headers: auth(), body: fd })
      if (!r.ok) {
        const d = await r.json().catch(() => null)
        throw new Error(d?.error || 'No se pudo subir la foto')
      }
      await load()
    } catch (err: any) {
      setError(err.message || 'No se pudo subir la foto. Revisa tu conexión.')
    } finally { setUploading(false) }
  }

  const remove = async () => {
    if (!viewing) return
    const r = await fetch(`${BASE}/api/v1/user/body-photos/${viewing.id}`, { method: 'DELETE', headers: auth() })
    if (r.ok) { setPhotos(p => p.filter(x => x.id !== viewing.id)); setViewing(null); setConfirmDel(false) }
    else setError('No se pudo eliminar la foto')
  }

  return (
    <div className="space-y-3">
      {mode === 'owner' && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 border border-blue-100">
          <ShieldCheck className="w-4 h-4 text-[#007AFF] shrink-0 mt-0.5" />
          <p className="text-xs text-blue-900 leading-relaxed">
            <b>Es opcional y privado.</b> Solo tú, tu coach y el administrador pueden verlas. Puedes borrarlas cuando quieras.{' '}
            <Link to="/terms" target="_blank" className="underline font-medium">Ver términos</Link>
          </p>
        </div>
      )}

      {mode === 'owner' && (
        <div className="space-y-2.5">
          <div className="flex gap-1.5 flex-wrap">
            {LABELS.map(l => (
              <button key={l} type="button" onClick={() => setLabel(l)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  label === l ? 'bg-[#007AFF] text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'
                }`}>{l}</button>
            ))}
          </div>
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-medium text-sm flex items-center justify-center gap-2 active:bg-gray-50 disabled:opacity-50 transition-colors">
            {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo…</> : <><Camera className="w-4 h-4" /> Agregar foto ({label})</>}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPick} />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 text-red-600 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>
      ) : photos.length === 0 ? (
        <div className="text-center py-6">
          <Lock className="w-7 h-7 text-gray-300 mx-auto mb-1.5" />
          <p className="text-sm text-gray-400">
            {mode === 'owner' ? 'Aún no has subido fotos de progreso' : 'El atleta no ha subido fotos de progreso'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map(p => (
            <button key={p.id} type="button" onClick={() => { setViewing(p); setConfirmDel(false) }}
              className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100 active:scale-95 transition-transform">
              <SecureImage path={`/api/v1/body-photos/${p.id}/file`} className="w-full h-full object-cover" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pt-4 pb-1">
                <p className="text-[10px] font-semibold text-white leading-tight">{p.label || 'Foto'}</p>
                <p className="text-[9px] text-white/80">{fmt(p.createdAt)}</p>
              </div>
            </button>
          ))}
          {mode === 'owner' && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 active:bg-gray-50">
              <Plus className="w-6 h-6" />
            </button>
          )}
        </div>
      )}

      {/* Lightbox */}
      {viewing && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex flex-col" onClick={() => setViewing(null)}>
          <div className="flex items-center justify-between p-4 text-white" onClick={e => e.stopPropagation()}>
            <div>
              <p className="font-semibold text-sm">{viewing.label || 'Foto'}</p>
              <p className="text-xs text-white/60">{fmt(viewing.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              {mode === 'owner' && (confirmDel ? (
                <button onClick={remove} className="px-3 py-2 rounded-xl bg-red-500 text-white text-xs font-bold">Confirmar eliminar</button>
              ) : (
                <button onClick={() => setConfirmDel(true)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                  <Trash2 className="w-4 h-4" />
                </button>
              ))}
              <button onClick={() => setViewing(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex items-center justify-center p-4 pt-0" onClick={e => e.stopPropagation()}>
            <SecureImage path={`/api/v1/body-photos/${viewing.id}/file`} className="max-w-full max-h-full object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}
