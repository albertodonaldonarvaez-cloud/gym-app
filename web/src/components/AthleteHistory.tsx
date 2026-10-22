import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Clock, Dumbbell, History as HistoryIcon, Loader2, Search, Trophy, Weight } from 'lucide-react'

const BASE = import.meta.env.VITE_API_URL ?? ''

interface SetRow { n: number; weightKg: number; reps: number; rpe: number | null }
interface ExerciseInSession { exerciseId: string; name: string; sets: SetRow[]; volume: number; topWeight: number }
interface Session {
  id: string; date: string; dayName: string; durationSeconds: number | null
  totalSets: number; volume: number; exercises: ExerciseInSession[]
}
interface Record_ {
  exerciseId: string; name: string; bestWeight: number; best1RM: number
  sessions: number; lastDate: string
  series: { date: string; topWeight: number; volume: number; sets: number }[]
}

const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })
const dateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })
const duration = (s: number | null) => {
  if (!s) return null
  const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60)
  return h > 0 ? `${h} h ${m} min` : `${m} min`
}
const kg = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

/** Gráfica simple (SVG) de la evolución del peso máximo por sesión. */
function WeightChart({ series }: { series: Record_['series'] }) {
  if (series.length < 2) {
    return <p className="text-xs text-gray-400 py-3">Se necesitan al menos 2 sesiones para ver la gráfica.</p>
  }
  const W = 320, H = 110, pad = 8
  const ws = series.map(s => s.topWeight)
  const min = Math.min(...ws), max = Math.max(...ws)
  const span = max - min || 1
  const pts = series.map((s, i) => {
    const x = pad + (i / (series.length - 1)) * (W - pad * 2)
    const y = H - pad - ((s.topWeight - min) / span) * (H - pad * 2 - 14)
    return [x, y] as const
  })
  const line = pts.map(p => p.join(',')).join(' ')
  const area = `${pad},${H - pad} ${line} ${W - pad},${H - pad}`
  const gain = series[series.length - 1].topWeight - series[0].topWeight
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-28">
        <defs>
          <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#007AFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#007AFF" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#hg)" />
        <polyline points={line} fill="none" stroke="#007AFF" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#fff" stroke="#007AFF" strokeWidth="2" />)}
        <text x={pts[0][0]} y={pts[0][1] - 8} fontSize="10" fill="#6b7280" textAnchor="start">{kg(series[0].topWeight)}</text>
        <text x={pts[pts.length - 1][0]} y={pts[pts.length - 1][1] - 8} fontSize="10" fill="#111827" fontWeight="700" textAnchor="end">{kg(series[series.length - 1].topWeight)} kg</text>
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400">
        <span>{dateShort(series[0].date)}</span>
        <span className={gain >= 0 ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
          {gain >= 0 ? '+' : ''}{kg(gain)} kg en total
        </span>
        <span>{dateShort(series[series.length - 1].date)}</span>
      </div>
    </div>
  )
}

export default function AthleteHistory({ athleteId }: { athleteId: string }) {
  const [data, setData] = useState<{ sessions: Session[]; records: Record_[] } | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'sessions' | 'exercises'>('sessions')
  const [openSession, setOpenSession] = useState<string | null>(null)
  const [openExercise, setOpenExercise] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [shown, setShown] = useState(10)

  useEffect(() => {
    setData(null); setError('')
    fetch(`${BASE}/api/v1/coach/athletes/${athleteId}/history`, {
      headers: { Authorization: `Bearer ${localStorage.getItem('gymaura_token')}` },
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(d => { setData(d); if (d.sessions[0]) setOpenSession(d.sessions[0].id) })
      .catch(() => setError('No se pudo cargar el historial del atleta.'))
  }, [athleteId])

  const records = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.records ?? []).filter(r => !q || r.name.toLowerCase().includes(q))
  }, [data, query])

  if (error) return <p className="text-sm text-red-500 py-6 text-center">{error}</p>
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-gray-400 animate-spin" /></div>

  if (data.sessions.length === 0) {
    return (
      <div className="text-center py-10">
        <HistoryIcon className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="font-medium text-gray-600">Aún no hay entrenamientos registrados</p>
        <p className="text-sm text-gray-400 mt-1">Aparecerán aquí cuando el atleta registre sus series.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex p-1 bg-gray-100 rounded-xl mb-4 w-full sm:w-auto sm:inline-flex">
        {([['sessions', `Sesiones (${data.sessions.length})`], ['exercises', `Por ejercicio (${data.records.length})`]] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === k ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'sessions' ? (
        <div className="space-y-2">
          {data.sessions.slice(0, shown).map(s => {
            const open = openSession === s.id
            return (
              <div key={s.id} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                <button type="button" onClick={() => setOpenSession(open ? null : s.id)}
                  className="w-full flex items-center gap-3 p-3.5 text-left">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Dumbbell className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 capitalize truncate">
                      {dateLong(s.date)}{s.dayName && <span className="font-normal text-gray-500 normal-case"> · {s.dayName}</span>}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                      <span>{s.exercises.length} ejercicios</span>
                      <span>{s.totalSets} series</span>
                      <span>{Math.round(s.volume).toLocaleString('es-MX')} kg de volumen</span>
                      {duration(s.durationSeconds) && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{duration(s.durationSeconds)}</span>}
                    </p>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                </button>
                {open && (
                  <div className="border-t border-gray-100 divide-y divide-gray-100 fade-in">
                    {s.exercises.map(ex => (
                      <div key={ex.exerciseId} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-2 mb-2">
                          <p className="text-sm font-semibold text-gray-900">{ex.name}</p>
                          <p className="text-[11px] text-gray-400 shrink-0">Máx. {kg(ex.topWeight)} kg</p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {ex.sets.map(st => (
                            <span key={st.n} className="px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-700">
                              <span className="text-gray-400 mr-1">S{st.n}</span>
                              <b className="text-gray-900">{kg(st.weightKg)}</b> kg × <b className="text-gray-900">{st.reps}</b>
                              {st.rpe ? <span className="text-gray-400"> · RPE {st.rpe}</span> : null}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {shown < data.sessions.length && (
            <button type="button" onClick={() => setShown(n => n + 10)}
              className="w-full py-3 rounded-xl bg-gray-50 text-sm font-semibold text-gray-600 hover:bg-gray-100">
              Ver más ({data.sessions.length - shown} restantes)
            </button>
          )}
        </div>
      ) : (
        <div>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar ejercicio…"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 text-sm text-gray-900 outline-none focus:bg-white focus:border-blue-300" />
          </div>
          <div className="space-y-2">
            {records.length === 0 && <p className="text-sm text-gray-400 text-center py-6">Sin resultados</p>}
            {records.map(r => {
              const open = openExercise === r.exerciseId
              return (
                <div key={r.exerciseId} className="border border-gray-200 rounded-2xl overflow-hidden bg-white">
                  <button type="button" onClick={() => setOpenExercise(open ? null : r.exerciseId)}
                    className="w-full flex items-center gap-3 p-3.5 text-left">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{r.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5 flex flex-wrap gap-x-3">
                        <span className="flex items-center gap-1"><Weight className="w-3 h-3" />Mejor: <b className="text-gray-800">{kg(r.bestWeight)} kg</b></span>
                        <span>1RM est. <b className="text-gray-800">{kg(r.best1RM)} kg</b></span>
                        <span>{r.sessions} sesión{r.sessions !== 1 ? 'es' : ''}</span>
                      </p>
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} />
                  </button>
                  {open && (
                    <div className="border-t border-gray-100 p-4 fade-in">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Peso máximo por sesión</p>
                      <WeightChart series={r.series} />
                      <div className="mt-3 divide-y divide-gray-100">
                        {[...r.series].reverse().slice(0, 8).map((p, i) => (
                          <div key={i} className="flex items-center justify-between py-2 text-xs">
                            <span className="text-gray-500 capitalize">{dateShort(p.date)}</span>
                            <span className="text-gray-700"><b className="text-gray-900">{kg(p.topWeight)} kg</b> máx · {p.sets} series · {p.volume.toLocaleString('es-MX')} kg vol.</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-3">1RM estimado con la fórmula de Epley: peso × (1 + reps/30).</p>
        </div>
      )}
    </div>
  )
}
