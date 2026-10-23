import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Modelo corporal paramétrico y anatómico, 100% procedural (sin assets externos,
// sin licencias de terceros). Cada parte del cuerpo (torso, brazo, pierna) es un
// "loft" de anillos elípticos de alta resolución. Sobre esa base se aplican campos
// de desplazamiento por músculo (pectoral, dorsal, trapecio, abdomen, glúteos,
// cuádriceps, isquios, gemelos…) cuya forma se precalcula una sola vez; los
// sliders solo cambian las amplitudes, por eso es rápido aun en teléfonos.
//
// Proporciones basadas en Drillis & Contini (1966) y el canon de 7.5 cabezas:
// hombro 0.82H, cadera 0.53H, rodilla 0.29H, húmero 0.19H, antebrazo 0.15H.
// Unidades: metros. Altura base 1.75 m; el slider de altura escala el conjunto.
// ─────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female'
export type ZoneKey = 'chest' | 'back' | 'delts' | 'arms' | 'abs' | 'glutes' | 'quads' | 'calves'

export interface BodyParams {
  gender: Gender
  skin: number
  heightCm: number
  fat: number
  muscle: number
  shoulders: number
  chest: number
  waist: number
  hips: number
  arms: number
  legs: number
  armLen: number // largo de brazos (50 = proporcional)
  legLen: number // largo de piernas (50 = proporcional)
  zChest: number; zBack: number; zDelts: number; zArms: number
  zAbs: number; zGlutes: number; zQuads: number; zCalves: number
  // Rasgos del rostro (50 = neutro)
  faceW: number; jaw: number; nose: number; lips: number; eyes: number
  // Estilo
  hair: HairStyle; hairColor: string; eyeColor: string
  top: TopStyle; bottom: BottomStyle; shoes: ShoeStyle
  topColor: string; bottomColor: string; accentColor: string; shoeColor: string
}

export type HairStyle = 'short' | 'buzz' | 'long' | 'ponytail' | 'bun' | 'curly' | 'bald'
export type TopStyle = 'none' | 'bra' | 'tank'
export type BottomStyle = 'shorts' | 'leggings' | 'boxer'
export type ShoeStyle = 'sneakers' | 'none'

export const HAIR_OPTIONS: { id: HairStyle; label: string }[] = [
  { id: 'short', label: 'Corto' }, { id: 'buzz', label: 'Rapado' }, { id: 'long', label: 'Largo' },
  { id: 'ponytail', label: 'Coleta' }, { id: 'bun', label: 'Chongo' }, { id: 'curly', label: 'Rizado' }, { id: 'bald', label: 'Sin pelo' },
]
export const TOP_OPTIONS: { id: TopStyle; label: string }[] = [{ id: 'none', label: 'Sin top' }, { id: 'bra', label: 'Top deportivo' }, { id: 'tank', label: 'Playera' }]
export const BOTTOM_OPTIONS: { id: BottomStyle; label: string }[] = [{ id: 'shorts', label: 'Short' }, { id: 'leggings', label: 'Leggings' }, { id: 'boxer', label: 'Bóxer' }]
export const SHOE_OPTIONS: { id: ShoeStyle; label: string }[] = [{ id: 'sneakers', label: 'Tenis' }, { id: 'none', label: 'Descalzo' }]
export const HAIR_COLORS = ['#17110d', '#3a2a20', '#6b4a2f', '#a9743d', '#d8b26a', '#b4332a', '#8a8d92', '#efe7d4']
export const EYE_COLORS = ['#3b2a1d', '#5a3d2b', '#2f6f9f', '#4f8a5b', '#7a7f86', '#1c1c1c']
export const CLOTH_COLORS = ['#00a8e8', '#27407a', '#111827', '#e11d48', '#16a34a', '#f59e0b', '#7c3aed', '#f3f4f6']
export const STYLE_KEYS = ['hair', 'hairColor', 'eyeColor', 'top', 'bottom', 'shoes', 'topColor', 'bottomColor', 'accentColor', 'shoeColor', 'skin', 'heightCm', 'faceW', 'jaw', 'nose', 'lips', 'eyes'] as const

export const SKIN_TONES = ['#f6d5bd', '#ecc4a3', '#d9a47c', '#b97a54', '#8a5535', '#5e3a24']
export const HEIGHT_MIN = 140
export const HEIGHT_MAX = 210

export const ZONES: { key: ZoneKey; field: keyof BodyParams; label: string; hint: string; yaw: number }[] = [
  { key: 'chest', field: 'zChest', label: 'Pecho', hint: 'Pectoral mayor', yaw: 0 },
  { key: 'back', field: 'zBack', label: 'Espalda', hint: 'Dorsales y trapecio', yaw: Math.PI },
  { key: 'delts', field: 'zDelts', label: 'Hombros', hint: 'Deltoides', yaw: Math.PI * 0.35 },
  { key: 'arms', field: 'zArms', label: 'Brazos', hint: 'Bíceps, tríceps, antebrazo', yaw: Math.PI * 0.4 },
  { key: 'abs', field: 'zAbs', label: 'Abdomen', hint: 'Recto abdominal y oblicuos', yaw: 0 },
  { key: 'glutes', field: 'zGlutes', label: 'Glúteos', hint: 'Glúteo mayor', yaw: Math.PI },
  { key: 'quads', field: 'zQuads', label: 'Muslos', hint: 'Cuádriceps e isquios', yaw: Math.PI * 0.3 },
  { key: 'calves', field: 'zCalves', label: 'Pantorrillas', hint: 'Gemelos y sóleo', yaw: Math.PI },
]

export const defaultParams = (gender: Gender = 'male'): BodyParams => ({
  gender,
  skin: 1,
  heightCm: gender === 'male' ? 175 : 164,
  fat: gender === 'male' ? 35 : 30,
  muscle: gender === 'male' ? 30 : 22,
  shoulders: 50, chest: 50, waist: 50, hips: 50, arms: 50, legs: 50,
  armLen: 50, legLen: 50,
  zChest: 50, zBack: 50, zDelts: 50, zArms: 50, zAbs: 50, zGlutes: 50, zQuads: 50, zCalves: 50,
  faceW: 50, jaw: 50, nose: 50, lips: 50, eyes: 50,
  hair: gender === 'male' ? 'short' : 'long', hairColor: '#3a2a20', eyeColor: '#5a3d2b',
  top: gender === 'male' ? 'none' : 'bra', bottom: gender === 'male' ? 'shorts' : 'leggings', shoes: 'sneakers',
  topColor: '#00a8e8', bottomColor: '#27407a', accentColor: '#f3f4f6', shoeColor: '#f3f4f6',
})

/** Completa campos faltantes (registros guardados antes de agregar nuevas opciones). */
export function normalizeParams(p: Partial<BodyParams>): BodyParams {
  const base = defaultParams(p.gender === 'female' ? 'female' : 'male')
  const out = { ...base } as Record<string, unknown>
  for (const k of Object.keys(base) as (keyof BodyParams)[]) {
    const v = p[k]
    if (v !== undefined && v !== null) out[k] = v
  }
  return out as unknown as BodyParams
}

/** Cambia de género conservando lo personalizado: solo cambia el peinado/ropa si aún eran los de fábrica. */
export function switchGender(p: BodyParams, g: Gender): BodyParams {
  if (p.gender === g) return p
  const o = defaultParams(p.gender), n = defaultParams(g)
  const q = { ...p, gender: g } as BodyParams
  for (const k of ['hair', 'top', 'bottom'] as const) if (p[k] === o[k]) (q as unknown as Record<string, unknown>)[k] = n[k]
  return q
}

export interface Preset { id: string; label: string; values: Partial<BodyParams> }
export const PRESETS: Preset[] = [
  { id: 'slim', label: 'Delgado', values: { fat: 10, muscle: 12 } },
  { id: 'average', label: 'Promedio', values: {} },
  { id: 'athletic', label: 'Atlético', values: { fat: 16, muscle: 55, shoulders: 58, waist: 40, zAbs: 60, zChest: 55, zBack: 58 } },
  { id: 'strong', label: 'Fuerte', values: { fat: 42, muscle: 72, shoulders: 62, arms: 58, waist: 60, zBack: 62, zQuads: 62, zGlutes: 58 } },
  { id: 'bodybuilder', label: 'Culturista', values: { fat: 6, muscle: 100, shoulders: 78, arms: 70, waist: 30, legs: 62, zChest: 72, zBack: 82, zDelts: 78, zArms: 72, zAbs: 70, zQuads: 72, zCalves: 62, zGlutes: 62 } },
  { id: 'curvy', label: 'Curvy', values: { fat: 50, muscle: 24, hips: 68, chest: 66, waist: 38, zGlutes: 70 } },
  { id: 'overweight', label: 'Sobrepeso', values: { fat: 82, muscle: 12, waist: 76, hips: 62 } },
]
export function applyPreset(base: BodyParams, preset: Preset): BodyParams {
  const keep: Record<string, unknown> = {}
  for (const k of STYLE_KEYS) keep[k] = base[k]
  return { ...defaultParams(base.gender), ...keep, ...preset.values } as BodyParams
}

// ── Estimaciones visuales (orientativas, no son una medición clínica) ────────
export const estFatPct = (p: BodyParams) =>
  Math.round((p.gender === 'male' ? 8 : 15) + (p.fat / 100) * 37)
export const fatLabel = (p: BodyParams) =>
  p.fat < 15 ? 'Muy definido' : p.fat < 35 ? 'Atlético' : p.fat < 55 ? 'Promedio' : p.fat < 78 ? 'Con sobrepeso' : 'Obesidad'
export const muscleLabel = (p: BodyParams) =>
  p.muscle < 15 ? 'Bajo' : p.muscle < 40 ? 'Moderado' : p.muscle < 70 ? 'Alto' : 'Muy alto'

// ── Estado numérico de render (interpolable para animar) ─────────────────────
const NUM_KEYS = [
  'g', 'heightCm', 'fat', 'muscle', 'shoulders', 'chest', 'waist', 'hips', 'arms', 'legs', 'armLen', 'legLen',
  'zChest', 'zBack', 'zDelts', 'zArms', 'zAbs', 'zGlutes', 'zQuads', 'zCalves', 'r', 'gr', 'b', 'hl',
  'faceW', 'jaw', 'nose', 'lips', 'eyes',
] as const
type NumKey = (typeof NUM_KEYS)[number]
export interface StyleState {
  hair: HairStyle; hairColor: string; eyeColor: string
  top: TopStyle; bottom: BottomStyle; shoes: ShoeStyle
  topColor: string; bottomColor: string; accentColor: string; shoeColor: string
}
export type RenderState = Record<NumKey, number> & { hlKey: ZoneKey | ''; style: StyleState; styleSig: string }

export function toRender(p: BodyParams, highlight: ZoneKey | '' = ''): RenderState {
  const c = new THREE.Color(SKIN_TONES[Math.min(Math.max(p.skin, 0), SKIN_TONES.length - 1)])
  return {
    g: p.gender === 'female' ? 1 : 0,
    heightCm: p.heightCm, fat: p.fat, muscle: p.muscle,
    shoulders: p.shoulders, chest: p.chest, waist: p.waist, hips: p.hips, arms: p.arms, legs: p.legs,
    armLen: p.armLen, legLen: p.legLen,
    zChest: p.zChest, zBack: p.zBack, zDelts: p.zDelts, zArms: p.zArms,
    zAbs: p.zAbs, zGlutes: p.zGlutes, zQuads: p.zQuads, zCalves: p.zCalves,
    r: c.r, gr: c.g, b: c.b,
    faceW: p.faceW, jaw: p.jaw, nose: p.nose, lips: p.lips, eyes: p.eyes,
    hl: highlight ? 1 : 0, hlKey: highlight,
    style: styleOf(p), styleSig: styleSigOf(p),
  }
}
const styleOf = (p: BodyParams): StyleState => ({
  hair: p.hair, hairColor: p.hairColor, eyeColor: p.eyeColor, top: p.top, bottom: p.bottom, shoes: p.shoes,
  topColor: p.topColor, bottomColor: p.bottomColor, accentColor: p.accentColor, shoeColor: p.shoeColor,
})
const styleSigOf = (p: BodyParams) => JSON.stringify(styleOf(p))

const SCALE: Partial<Record<NumKey, number>> = { g: 1, heightCm: 70, r: 1, gr: 1, b: 1, hl: 1 }
export function renderDistance(a: RenderState, b: RenderState): number {
  if (a.styleSig !== b.styleSig) return 1
  let d = 0
  for (const k of NUM_KEYS) d = Math.max(d, Math.abs(a[k] - b[k]) / (SCALE[k] ?? 100))
  return d
}
export function lerpInto(cur: RenderState, target: RenderState, k: number) {
  for (const key of NUM_KEYS) cur[key] += (target[key] - cur[key]) * k
  cur.style = target.style; cur.styleSig = target.styleSig
  if (target.hlKey) cur.hlKey = target.hlKey
  else if (cur.hl < 0.02) cur.hlKey = ''
}

// ── Utilidades matemáticas ───────────────────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2))
const norm = (v: number) => (v - 50) / 50

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
}
function sample(tab: number[][], x: number, k: number): number {
  const n = tab.length
  if (x <= tab[0][0]) return tab[0][k]
  if (x >= tab[n - 1][0]) return tab[n - 1][k]
  let i = 0
  while (i < n - 2 && x > tab[i + 1][0]) i++
  const u = (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0])
  return catmull(tab[Math.max(i - 1, 0)][k], tab[i][k], tab[i + 1][k], tab[Math.min(i + 2, n - 1)][k], u)
}

// ── Tablas base ──────────────────────────────────────────────────────────────
const TORSO_M = [
  [0.86, 0.150, 0.100], [0.93, 0.160, 0.105], [1.00, 0.150, 0.098], [1.07, 0.142, 0.090],
  [1.15, 0.152, 0.098], [1.24, 0.172, 0.110], [1.32, 0.188, 0.100], [1.38, 0.196, 0.080],
  [1.41, 0.150, 0.070], [1.44, 0.095, 0.060], [1.47, 0.060, 0.054], [1.51, 0.052, 0.052], [1.55, 0.050, 0.052],
]
const TORSO_F = [
  [0.86, 0.146, 0.098], [0.93, 0.172, 0.112], [1.00, 0.148, 0.096], [1.07, 0.122, 0.082],
  [1.15, 0.132, 0.090], [1.24, 0.150, 0.104], [1.32, 0.162, 0.092], [1.38, 0.170, 0.074],
  [1.41, 0.130, 0.064], [1.44, 0.085, 0.055], [1.47, 0.052, 0.049], [1.51, 0.046, 0.047], [1.55, 0.045, 0.047],
]
const ARM = [
  [0, 0.056], [0.06, 0.054], [0.16, 0.047], [0.24, 0.041], [0.28, 0.037],
  [0.33, 0.040], [0.42, 0.035], [0.53, 0.030], [0.58, 0.029],
]
const LEG = [
  [0, 0.088], [0.08, 0.089], [0.20, 0.080], [0.32, 0.066], [0.40, 0.054], [0.44, 0.050],
  [0.50, 0.052], [0.58, 0.056], [0.66, 0.046], [0.76, 0.034], [0.86, 0.031],
]

const FAT_K = 1.9
const MUS_Z = 2.2 // amplitud global de los músculos
const DETAIL_K = 1.8 // qué tanto se marcan surcos/definición
const ARM_LEN = 0.58
const LEG_LEN = 0.86
const LEG_TOP_Y = 0.93
const SHOULDER_Y = 1.37
const TORSO_Y0 = 0.86
const TORSO_Y1 = 1.55
const TOP_Y = 1.753

const N_TORSO = 110, SEG_TORSO = 56
const N_ARM = 44, SEG_ARM = 36
const N_LEG = 64, SEG_LEG = 40

// ── Definición anatómica de músculos ─────────────────────────────────────────
type Kind = 'mass' | 'detail' | 'bone'
type Group = ZoneKey | 'hams' | 'none'
interface MDef {
  z: Group; k: Kind
  th: number // ángulo central en grados (90 = frente, 270 = espalda, 0 = lado externo)
  c: number // coordenada a lo largo del miembro (y en torso, distancia d en brazo/pierna)
  wth: number; wc: number // anchos (grados / metros)
  amp: number // amplitud en metros (negativa = surco)
  p?: number // exponente (>2 = bordes más marcados)
  fF?: number // factor en mujer (1 = igual que hombre)
}
const mirrorTh = (th: number) => (((180 - th) % 360) + 360) % 360
/** Define el músculo y su espejo (lado izquierdo/derecho). */
const S = (d: MDef): MDef[] => {
  const m = mirrorTh(d.th)
  return Math.abs(m - d.th) < 0.5 ? [d] : [d, { ...d, th: m }]
}
const ROWS_ABS = [1.165, 1.11, 1.055, 1.0]

const TORSO_DEFS: MDef[] = [
  // Pectoral mayor: porción clavicular, esternal y costal (abanico hacia la axila)
  ...S({ z: 'chest', k: 'mass', th: 64, c: 1.295, wth: 20, wc: 0.045, amp: 0.016, fF: 0.55 }),
  ...S({ z: 'chest', k: 'mass', th: 60, c: 1.245, wth: 24, wc: 0.05, amp: 0.024, p: 2.2, fF: 0.55 }),
  ...S({ z: 'chest', k: 'mass', th: 30, c: 1.275, wth: 16, wc: 0.045, amp: 0.012, fF: 0.55 }),
  { z: 'chest', k: 'detail', th: 90, c: 1.255, wth: 3.5, wc: 0.075, amp: -0.011 }, // surco esternal
  ...S({ z: 'chest', k: 'detail', th: 62, c: 1.19, wth: 26, wc: 0.011, amp: -0.008 }), // borde inferior del pectoral
  // Serrato anterior (dedos sobre las costillas)
  ...S({ z: 'abs', k: 'detail', th: 30, c: 1.185, wth: 7, wc: 0.013, amp: 0.007 }),
  ...S({ z: 'abs', k: 'detail', th: 30, c: 1.145, wth: 7, wc: 0.013, amp: 0.007 }),
  ...S({ z: 'abs', k: 'detail', th: 30, c: 1.105, wth: 7, wc: 0.013, amp: 0.007 }),
  // Recto abdominal: masa + bloques ("six-pack") + línea alba + oblicuos + ombligo
  ...S({ z: 'abs', k: 'mass', th: 84, c: 1.08, wth: 9, wc: 0.095, amp: 0.013, p: 3 }),
  ...ROWS_ABS.flatMap(c => S({ z: 'abs', k: 'detail', th: 84, c, wth: 7, wc: 0.021, amp: 0.0085, p: 2.4 })),
  { z: 'abs', k: 'detail', th: 90, c: 1.085, wth: 2.6, wc: 0.10, amp: -0.007 },
  ...S({ z: 'abs', k: 'mass', th: 52, c: 1.07, wth: 17, wc: 0.065, amp: 0.011 }),
  { z: 'abs', k: 'detail', th: 90, c: 1.03, wth: 4, wc: 0.012, amp: -0.008 },
  // Espalda: trapecio, romboides/redondos, dorsal ancho (V-taper), erectores y surco espinal
  ...S({ z: 'back', k: 'mass', th: 238, c: 1.405, wth: 30, wc: 0.05, amp: 0.018, fF: 0.7 }),
  ...S({ z: 'back', k: 'mass', th: 262, c: 1.31, wth: 20, wc: 0.07, amp: 0.014, fF: 0.7 }),
  ...S({ z: 'back', k: 'mass', th: 244, c: 1.32, wth: 15, wc: 0.05, amp: 0.014, fF: 0.8 }),
  ...S({ z: 'back', k: 'detail', th: 236, c: 1.32, wth: 3, wc: 0.055, amp: -0.006 }),
  ...S({ z: 'back', k: 'mass', th: 218, c: 1.17, wth: 26, wc: 0.095, amp: 0.022, fF: 0.7 }),
  ...S({ z: 'back', k: 'mass', th: 188, c: 1.2, wth: 13, wc: 0.07, amp: 0.013, fF: 0.7 }),
  { z: 'back', k: 'detail', th: 270, c: 1.17, wth: 2.6, wc: 0.27, amp: -0.009 },
  ...S({ z: 'back', k: 'mass', th: 262, c: 1.03, wth: 7, wc: 0.12, amp: 0.010 }),
  // Glúteo mayor/medio, pliegue glúteo y surco
  ...S({ z: 'glutes', k: 'mass', th: 248, c: 0.925, wth: 21, wc: 0.065, amp: 0.030, fF: 1.25 }),
  ...S({ z: 'glutes', k: 'mass', th: 238, c: 0.99, wth: 15, wc: 0.04, amp: 0.010 }),
  ...S({ z: 'glutes', k: 'detail', th: 258, c: 0.875, wth: 19, wc: 0.010, amp: -0.010 }),
  { z: 'glutes', k: 'detail', th: 270, c: 0.915, wth: 2.6, wc: 0.075, amp: -0.009 },
  // Huesos visibles con poca grasa: clavículas, hueco supraesternal, crestas ilíacas
  ...S({ z: 'none', k: 'bone', th: 76, c: 1.38, wth: 20, wc: 0.011, amp: 0.007 }),
  { z: 'none', k: 'bone', th: 90, c: 1.405, wth: 7, wc: 0.012, amp: -0.006 },
  ...S({ z: 'none', k: 'bone', th: 54, c: 0.91, wth: 12, wc: 0.02, amp: 0.007 }),
]

const ARM_DEFS: MDef[] = [
  // Deltoides: cabeza anterior, lateral (casquete) y posterior
  { z: 'delts', k: 'mass', th: 70, c: 0.075, wth: 36, wc: 0.075, amp: 0.018 },
  { z: 'delts', k: 'mass', th: 5, c: 0.065, wth: 36, wc: 0.075, amp: 0.022 },
  { z: 'delts', k: 'mass', th: 300, c: 0.075, wth: 36, wc: 0.075, amp: 0.018 },
  { z: 'delts', k: 'detail', th: 38, c: 0.10, wth: 3, wc: 0.07, amp: -0.004 },
  { z: 'delts', k: 'detail', th: 335, c: 0.10, wth: 3, wc: 0.07, amp: -0.004 },
  // Bíceps/braquial, tríceps (herradura), antebrazo
  { z: 'arms', k: 'mass', th: 96, c: 0.175, wth: 32, wc: 0.075, amp: 0.018 },
  { z: 'arms', k: 'mass', th: 38, c: 0.20, wth: 20, wc: 0.05, amp: 0.007 },
  { z: 'arms', k: 'mass', th: 258, c: 0.15, wth: 26, wc: 0.08, amp: 0.019 },
  { z: 'arms', k: 'mass', th: 322, c: 0.135, wth: 20, wc: 0.06, amp: 0.014 },
  { z: 'arms', k: 'detail', th: 290, c: 0.14, wth: 3, wc: 0.07, amp: -0.006 },
  { z: 'arms', k: 'mass', th: 15, c: 0.34, wth: 28, wc: 0.065, amp: 0.011 },
  { z: 'arms', k: 'mass', th: 105, c: 0.37, wth: 34, wc: 0.075, amp: 0.007 },
  { z: 'arms', k: 'mass', th: 285, c: 0.37, wth: 34, wc: 0.075, amp: 0.007 },
  { z: 'none', k: 'bone', th: 270, c: 0.285, wth: 22, wc: 0.018, amp: 0.006 }, // olécranon
]

const LEG_DEFS: MDef[] = [
  // Cuádriceps: recto femoral, vasto lateral (barrido externo) y vasto medial (gota)
  { z: 'quads', k: 'mass', th: 88, c: 0.2, wth: 19, wc: 0.1, amp: 0.018 },
  { z: 'quads', k: 'mass', th: 34, c: 0.22, wth: 24, wc: 0.115, amp: 0.022 },
  { z: 'quads', k: 'mass', th: 142, c: 0.33, wth: 21, wc: 0.06, amp: 0.022 },
  { z: 'quads', k: 'detail', th: 62, c: 0.21, wth: 3, wc: 0.14, amp: -0.007 },
  { z: 'quads', k: 'detail', th: 118, c: 0.22, wth: 3, wc: 0.11, amp: -0.007 },
  { z: 'quads', k: 'mass', th: 172, c: 0.14, wth: 20, wc: 0.09, amp: 0.010 }, // aductores
  // Isquiotibiales: bíceps femoral y semitendinoso
  { z: 'hams', k: 'mass', th: 296, c: 0.2, wth: 25, wc: 0.12, amp: 0.018 },
  { z: 'hams', k: 'mass', th: 244, c: 0.2, wth: 22, wc: 0.12, amp: 0.016 },
  { z: 'hams', k: 'detail', th: 270, c: 0.2, wth: 3, wc: 0.13, amp: -0.007 },
  // Pantorrilla: gemelo medial (más bajo y voluminoso) y lateral (más alto), sóleo, tibial anterior
  { z: 'calves', k: 'mass', th: 236, c: 0.555, wth: 23, wc: 0.065, amp: 0.024 },
  { z: 'calves', k: 'mass', th: 304, c: 0.525, wth: 21, wc: 0.06, amp: 0.019 },
  { z: 'calves', k: 'detail', th: 270, c: 0.54, wth: 3, wc: 0.07, amp: -0.007 },
  { z: 'calves', k: 'mass', th: 270, c: 0.66, wth: 34, wc: 0.06, amp: 0.008 },
  { z: 'calves', k: 'mass', th: 78, c: 0.58, wth: 15, wc: 0.09, amp: 0.008 },
  // Huesos: rótula, cresta tibial, maléolos
  { z: 'none', k: 'bone', th: 90, c: 0.435, wth: 20, wc: 0.028, amp: 0.009 },
  { z: 'none', k: 'bone', th: 90, c: 0.62, wth: 7, wc: 0.09, amp: 0.004 },
  { z: 'none', k: 'bone', th: 0, c: 0.80, wth: 22, wc: 0.02, amp: 0.005 },
  { z: 'none', k: 'bone', th: 180, c: 0.80, wth: 22, wc: 0.02, amp: 0.005 },
]

// ── Pesos precalculados (esparcidos) de cada músculo sobre la malla ───────────
interface Sparse { idx: Uint32Array; val: Float32Array }
interface PartCache { defs: MDef[]; sparse: Sparse[]; seg: number; n: number }

function buildPart(defs: MDef[], cs: number[], seg: number): PartCache {
  const n = cs.length
  const sparse = defs.map(d => {
    const p = d.p ?? 2
    const idx: number[] = []
    const val: number[] = []
    for (let i = 0; i < n; i++) {
      const dc = Math.abs((cs[i] - d.c) / d.wc)
      if (dc > 2.6) continue
      for (let j = 0; j < seg; j++) {
        const a = (j / seg) * 360
        const dth = Math.abs((((a - d.th) % 360) + 540) % 360 - 180) / d.wth
        if (dth > 2.6) continue
        const w = Math.exp(-(dc ** p + dth ** p))
        if (w > 0.004) { idx.push(i * seg + j); val.push(w) }
      }
    }
    return { idx: Uint32Array.from(idx), val: Float32Array.from(val) }
  })
  return { defs, sparse, seg, n }
}

let _torso: PartCache | null = null, _arm: PartCache | null = null, _leg: PartCache | null = null
const torsoY = (i: number) => TORSO_Y0 + ((TORSO_Y1 - TORSO_Y0) * i) / (N_TORSO - 1)
const armD = (i: number) => (ARM_LEN * i) / (N_ARM - 1)
const legD = (i: number) => (LEG_LEN * i) / (N_LEG - 1)
const torsoPart = () => (_torso ??= buildPart(TORSO_DEFS, Array.from({ length: N_TORSO }, (_, i) => torsoY(i)), SEG_TORSO))
const armPart = () => (_arm ??= buildPart(ARM_DEFS, Array.from({ length: N_ARM }, (_, i) => armD(i)), SEG_ARM))
const legPart = () => (_leg ??= buildPart(LEG_DEFS, Array.from({ length: N_LEG }, (_, i) => legD(i)), SEG_LEG))

const ZONE_FIELD: Record<ZoneKey, NumKey> = {
  chest: 'zChest', back: 'zBack', delts: 'zDelts', arms: 'zArms', abs: 'zAbs', glutes: 'zGlutes', quads: 'zQuads', calves: 'zCalves',
}
function zoneLevel(s: RenderState, z: Group): number {
  if (z === 'none') return 1
  if (z === 'hams') return (zoneLevel(s, 'quads') + zoneLevel(s, 'glutes')) / 2
  return clamp(s.muscle / 100 + (s[ZONE_FIELD[z]] - 50) / 100, 0, 1)
}

interface Surface { disp: Float32Array; ao: Float32Array; tint: Float32Array | null }

/** Suma los campos de todos los músculos según los sliders actuales. */
function computeSurface(part: PartCache, s: RenderState): Surface {
  const size = part.n * part.seg
  const disp = new Float32Array(size)
  const ao = new Float32Array(size).fill(1)
  const fat = s.fat / 100
  const definition = clamp(1 - fat * 1.3, 0, 1)
  const showTint = s.hl > 0.01 && s.hlKey
  const tint = showTint ? new Float32Array(size) : null
  const lvlCache = new Map<Group, number>()
  const level = (z: Group) => {
    let v = lvlCache.get(z)
    if (v === undefined) { v = zoneLevel(s, z); lvlCache.set(z, v) }
    return v
  }
  for (let k = 0; k < part.defs.length; k++) {
    const d = part.defs[k]
    const gender = lerp(1, d.fF ?? 1, s.g)
    let a = d.amp
    if (d.k === 'mass') a *= level(d.z) * MUS_Z * gender * (1 - 0.3 * fat)
    else if (d.k === 'detail') a *= (0.3 + 0.7 * level(d.z)) * definition * DETAIL_K * gender
    else a *= 1 - 0.85 * fat
    if (a === 0) continue
    const { idx, val } = part.sparse[k]
    const shade = d.k !== 'mass'
    for (let m = 0; m < idx.length; m++) {
      const v = idx[m]
      const add = a * val[m]
      disp[v] += add
      if (shade) ao[v] += add * 16
    }
    if (tint && d.k === 'mass' && (d.z === s.hlKey || (s.hlKey === 'quads' && d.z === 'hams'))) {
      for (let m = 0; m < idx.length; m++) tint[idx[m]] += val[m]
    }
  }
  for (let v = 0; v < size; v++) ao[v] = clamp(ao[v], 0.62, 1.06)
  if (tint) for (let v = 0; v < size; v++) tint[v] = Math.min(tint[v], 1) * 0.55 * s.hl
  return { disp, ao, tint }
}

// ── Torso base (siluetas por altura) ─────────────────────────────────────────
interface Ring { y: number; rx: number; rz: number; cx: number; cz: number }

function torsoAt(s: RenderState, y: number): { rx: number; rz: number; cz: number } {
  const g = s.g, gM = 1 - g, gF = g
  const f = (s.fat / 100) * FAT_K, m = (s.muscle / 100) * 1.4
  const sh = norm(s.shoulders), ch = norm(s.chest), wa = norm(s.waist), hi = norm(s.hips)

  let rx = lerp(sample(TORSO_M, y, 1), sample(TORSO_F, y, 1), g)
  let rz = lerp(sample(TORSO_M, y, 2), sample(TORSO_F, y, 2), g)
  let cz = 0

  const belly = bump(y, 1.06, 0.10)
  const hipB = bump(y, 0.93, 0.09)
  const ribs = bump(y, 1.17, 0.09)
  const chestB = bump(y, 1.26, 0.08)
  const bustB = bump(y, 1.22, 0.06)
  const shoulderB = bump(y, 1.36, 0.06)
  const waistB = bump(y, 1.07, 0.08)
  const neckB = bump(y, 1.50, 0.05)

  rx += f * ((0.050 * gM + 0.035 * gF) * belly + (0.030 * gM + 0.028 * gF) * hipB + 0.018 * ribs + 0.008 + 0.012 * neckB)
  rz += f * ((0.060 * gM + 0.040 * gF) * belly + (0.020 * gM + 0.030 * gF) * hipB + 0.015 * ribs + 0.008 + 0.012 * neckB)
  cz += f * (0.030 * gM + 0.018 * gF) * belly

  rx += m * ((0.020 * gM + 0.010 * gF) * shoulderB + (0.012 * gM + 0.006 * gF) * ribs + 0.010 * gM * neckB)
  rz += m * ((0.008 * gM + 0.004 * gF) * chestB + 0.006 * bump(y, 1.0, 0.12) + 0.008 * gM * neckB)

  rx += sh * 0.032 * shoulderB
  rx += wa * 0.035 * waistB; rz += wa * 0.025 * waistB
  rx += hi * 0.030 * hipB; rz += hi * 0.026 * hipB
  rz += ch * (0.014 * gM + 0.022 * gF) * (gM * chestB + gF * bustB)
  cz += ch * (0.004 * gM + 0.020 * gF) * (gM * chestB + gF * bustB)

  cz += gF * 0.012 * bustB
  rz += gF * 0.006 * bustB

  return { rx: Math.max(rx, 0.02), rz: Math.max(rz, 0.02), cz }
}

function armRadius(s: RenderState, d: number): number {
  const g = s.g
  const f = (s.fat / 100) * FAT_K, ar = norm(s.arms)
  let r = sample(ARM, d, 1) * lerp(1, 0.86, g)
  r += f * (1 + 0.2 * g) * (0.016 * bump(d, 0.2, 0.14) + 0.008 * bump(d, 0.4, 0.1))
  r += ar * 0.012 * (bump(d, 0.18, 0.14) + 0.5 * bump(d, 0.38, 0.1))
  return Math.max(r, 0.015)
}
function legRadius(s: RenderState, d: number): number {
  const g = s.g, gM = 1 - g, gF = g
  const f = (s.fat / 100) * FAT_K, lg = norm(s.legs)
  const thighFat = 0.7 * gM + 1.15 * gF
  let r = sample(LEG, d, 1)
  r += f * (0.034 * thighFat * bump(d, 0.16, 0.14) + 0.010 * bump(d, 0.58, 0.09))
  r += lg * (0.026 * bump(d, 0.20, 0.18) + 0.012 * bump(d, 0.58, 0.09))
  return Math.max(r, 0.02)
}

// ── Loft con desplazamiento y colores (sombreado de surcos / resalte de zona) ─
const COS: Record<number, Float32Array> = {}
const SIN: Record<number, Float32Array> = {}
function trig(seg: number) {
  if (!COS[seg]) {
    COS[seg] = new Float32Array(seg); SIN[seg] = new Float32Array(seg)
    for (let j = 0; j < seg; j++) { COS[seg][j] = Math.cos((j / seg) * Math.PI * 2); SIN[seg][j] = Math.sin((j / seg) * Math.PI * 2) }
  }
}

interface LoftOpts {
  surf?: Surface; i0?: number; i1?: number; inflate?: number
  capStart?: boolean; capEnd?: boolean; colors?: boolean
}
function loft(rings: Ring[], seg: number, o: LoftOpts = {}): THREE.BufferGeometry {
  trig(seg)
  const c = COS[seg], sn = SIN[seg]
  const i0 = o.i0 ?? 0, i1 = o.i1 ?? rings.length - 1
  const n = i1 - i0 + 1
  const flip = rings[i0].y > rings[i1].y
  const nv = n * seg + 2
  const pos = new Float32Array(nv * 3)
  const col = o.colors ? new Float32Array(nv * 3).fill(1) : null
  const inflate = o.inflate ?? 0
  let v = 0
  for (let i = i0; i <= i1; i++) {
    const r = rings[i]
    for (let j = 0; j < seg; j++, v++) {
      const k = i * seg + j
      const dl = (o.surf ? o.surf.disp[k] : 0) + inflate
      pos[v * 3] = r.cx + (r.rx + dl) * c[j]
      pos[v * 3 + 1] = r.y
      pos[v * 3 + 2] = r.cz + (r.rz + dl) * sn[j]
      if (col && o.surf) {
        const ao = o.surf.ao[k]
        const t = o.surf.tint ? o.surf.tint[k] : 0
        col[v * 3] = ao * (1 - t) + 0.30 * t
        col[v * 3 + 1] = ao * (1 - t) + 0.95 * t
        col[v * 3 + 2] = ao * (1 - t) + 1.55 * t
      }
    }
  }
  const idx: number[] = []
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg
      const a = i * seg + j, b = i * seg + j2, cc = (i + 1) * seg + j, d = (i + 1) * seg + j2
      if (!flip) idx.push(a, cc, b, b, cc, d)
      else idx.push(a, b, cc, b, d, cc)
    }
  }
  const addCap = (ringLocal: number, ringGlobal: number, facesUp: boolean) => {
    const r = rings[ringGlobal]
    const center = v++
    pos[center * 3] = r.cx; pos[center * 3 + 1] = r.y; pos[center * 3 + 2] = r.cz
    for (let j = 0; j < seg; j++) {
      const a = ringLocal * seg + j, b = ringLocal * seg + ((j + 1) % seg)
      if (facesUp) idx.push(center, b, a)
      else idx.push(center, a, b)
    }
  }
  if (o.capStart) addCap(0, i0, flip)
  if (o.capEnd) addCap(n - 1, i1, !flip)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, v * 3), 3))
  if (col) geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, v * 3), 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

// ── Materiales ───────────────────────────────────────────────────────────────
export interface BodyMaterials {
  skin: THREE.MeshPhysicalMaterial
  skinFlat: THREE.MeshStandardMaterial
  shorts: THREE.MeshStandardMaterial
  top: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
  white: THREE.MeshStandardMaterial
  lip: THREE.MeshStandardMaterial
  eye: THREE.MeshStandardMaterial
  cloth: THREE.MeshStandardMaterial
  shoe: THREE.MeshStandardMaterial
  sole: THREE.MeshStandardMaterial
}
export function createMaterials(): BodyMaterials {
  return {
    // Piel con un leve brillo tipo "gimnasio" y borde suave (sheen) para que no se vea de plástico
    skin: new THREE.MeshPhysicalMaterial({
      color: SKIN_TONES[1], roughness: 0.55, metalness: 0, vertexColors: true,
      clearcoat: 0.08, clearcoatRoughness: 0.5, sheen: 0.3, sheenRoughness: 0.6, sheenColor: new THREE.Color('#ffc9ad'),
    }),
    skinFlat: new THREE.MeshStandardMaterial({ color: SKIN_TONES[1], roughness: 0.58, metalness: 0 }),
    shorts: new THREE.MeshStandardMaterial({ color: '#27407a', roughness: 0.8, metalness: 0 }),
    top: new THREE.MeshStandardMaterial({ color: '#00a8e8', roughness: 0.75, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: '#3a2a20', roughness: 0.62, metalness: 0.05, side: THREE.DoubleSide }),
    dark: new THREE.MeshStandardMaterial({ color: '#0b0d12', roughness: 0.3, metalness: 0 }),
    white: new THREE.MeshStandardMaterial({ color: '#f6f6f4', roughness: 0.25, metalness: 0 }),
    lip: new THREE.MeshStandardMaterial({ color: '#b86b63', roughness: 0.5, metalness: 0 }),
    eye: new THREE.MeshStandardMaterial({ color: '#5a3d2b', roughness: 0.2, metalness: 0 }),
    // Prenda con color por vértice (color principal + color de acento en cintura/ribetes)
    cloth: new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.82, metalness: 0, vertexColors: true }),
    shoe: new THREE.MeshStandardMaterial({ color: '#f3f4f6', roughness: 0.6, metalness: 0 }),
    sole: new THREE.MeshStandardMaterial({ color: '#e9ecef', roughness: 0.7, metalness: 0 }),
  }
}
export function disposeMaterials(m: BodyMaterials) { Object.values(m).forEach(x => x.dispose()) }
export function setSkinColor(m: BodyMaterials, s: RenderState) {
  m.skin.color.setRGB(s.r, s.gr, s.b)
  m.skinFlat.color.setRGB(s.r, s.gr, s.b)
}
/** Aplica los colores de estilo (pelo, ojos, tenis) a los materiales. */
export function setStyleColors(m: BodyMaterials, st: StyleState) {
  m.hair.color.set(st.hairColor); m.eye.color.set(st.eyeColor); m.shoe.color.set(st.shoeColor)
}

function ell(mat: THREE.Material, rx: number, ry: number, rz: number, x: number, y: number, z: number, w = 20, h = 14) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, w, h), mat)
  mesh.scale.set(rx, ry, rz)
  mesh.position.set(x, y, z)
  return mesh
}

// ── Cabeza: cráneo + mandíbula + orejas + nariz + ojos + cabello ─────────────
function buildHead(s: RenderState, mats: BodyMaterials): THREE.Group {
  const head = new THREE.Group()
  const g = s.g, f = s.fat / 100
  const k = lerp(1, 0.94, g)
  const cheek = 1 + f * 0.16
  const cy = 1.655
  head.add(ell(mats.skinFlat, 0.082 * k * cheek, 0.098 * k, 0.098 * k, 0, cy, 0, 28, 20)) // cráneo
  head.add(ell(mats.skinFlat, lerp(0.068, 0.060, g) * cheek, 0.074 * k, 0.083 * k, 0, cy - 0.065, 0.014, 24, 16)) // mandíbula
  head.add(ell(mats.skinFlat, lerp(0.034, 0.027, g) * cheek, 0.026 * k, 0.03 * k, 0, cy - 0.108, 0.052, 16, 12)) // mentón
  if (f > 0.5) head.add(ell(mats.skinFlat, 0.045 * f, 0.025 * f, 0.04 * f, 0, cy - 0.105, 0.02, 16, 12)) // papada
  for (const sx of [-1, 1]) {
    head.add(ell(mats.skinFlat, 0.012, 0.028, 0.016, sx * 0.083 * k * cheek, cy - 0.01, -0.004, 12, 10)) // orejas
    head.add(ell(mats.white, 0.0105, 0.0075, 0.006, sx * 0.032 * k, cy + 0.016, 0.089 * k, 12, 8)) // esclerótica
    head.add(ell(mats.dark, 0.0058, 0.0058, 0.005, sx * 0.032 * k, cy + 0.016, 0.0945 * k, 10, 8)) // iris
    head.add(ell(mats.hair, 0.017, 0.0035, 0.006, sx * 0.032 * k, cy + 0.034, 0.088 * k, 10, 6)) // ceja
  }
  head.add(ell(mats.skinFlat, 0.011, 0.02, 0.015, 0, cy - 0.022, 0.099 * k, 12, 10)) // nariz
  head.add(ell(mats.lip, 0.021, 0.004, 0.007, 0, cy - 0.066, 0.092 * k, 12, 6)) // boca
  // Cabello corto (hombre) / melena larga (mujer)
  head.add(ell(mats.hair, 0.088 * k * cheek, 0.1, 0.108 * k, 0, cy + 0.028, -0.014, 26, 16))
  if (g > 0.02) {
    const ry = 0.17
    head.add(ell(mats.hair, 0.092 * g + 0.03, ry * g, 0.07 + 0.02 * g, 0, 1.72 - ry * g, -0.05, 22, 14))
  }
  return head
}

// ── Mano y pie ───────────────────────────────────────────────────────────────
function buildHand(mats: BodyMaterials): THREE.Group {
  const h = new THREE.Group()
  h.add(ell(mats.skinFlat, 0.031, 0.04, 0.016, 0, -0.045, 0, 14, 10)) // palma
  h.add(ell(mats.skinFlat, 0.029, 0.045, 0.0125, 0, -0.1, 0, 14, 10)) // dedos
  const thumb = ell(mats.skinFlat, 0.011, 0.032, 0.011, 0.03, -0.055, 0.004, 10, 8)
  thumb.rotation.z = 0.35
  h.add(thumb)
  return h
}
function buildFoot(mats: BodyMaterials): THREE.Group {
  const f = new THREE.Group()
  f.add(ell(mats.skinFlat, 0.037, 0.032, 0.07, 0, 0, 0.03, 16, 12)) // talón + empeine
  f.add(ell(mats.skinFlat, 0.043, 0.02, 0.05, 0, -0.01, 0.1, 16, 10)) // antepié
  return f
}

// ── Construcción del cuerpo ──────────────────────────────────────────────────
export function buildBody(s: RenderState, mats: BodyMaterials): THREE.Group {
  const root = new THREE.Group()
  const upper = new THREE.Group()
  const g = s.g, gM = 1 - g

  const fa = 0.88 + (s.armLen / 100) * 0.24
  const fl = 0.88 + (s.legLen / 100) * 0.24
  const dY = (fl - 1) * LEG_LEN
  upper.position.y = dY

  // Torso + cuello con músculos
  const tPart = torsoPart()
  const tSurf = computeSurface(tPart, s)
  const tRings: Ring[] = []
  for (let i = 0; i < N_TORSO; i++) {
    const y = torsoY(i)
    const t = torsoAt(s, y)
    tRings.push({ y, rx: t.rx, rz: t.rz, cx: 0, cz: t.cz })
  }
  upper.add(new THREE.Mesh(loft(tRings, SEG_TORSO, { surf: tSurf, colors: true, capStart: true, capEnd: true }), mats.skin))

  const idxOfY = (y: number) => Math.round(((y - TORSO_Y0) / (TORSO_Y1 - TORSO_Y0)) * (N_TORSO - 1))
  // Ropa que sigue la superficie real (incluye glúteos/músculos)
  upper.add(new THREE.Mesh(loft(tRings, SEG_TORSO, { surf: tSurf, i0: 0, i1: idxOfY(1.01), inflate: 0.006 }), mats.shorts))
  if (g > 0.5) upper.add(new THREE.Mesh(loft(tRings, SEG_TORSO, { surf: tSurf, i0: idxOfY(1.18), i1: idxOfY(1.31), inflate: 0.006 }), mats.top))

  upper.add(buildHead(s, mats))

  // Hombros y brazos (geometría compartida, el izquierdo es el espejo)
  const sx = torsoAt(s, 1.36).rx - 0.004
  const aPart = armPart()
  const aSurf = computeSurface(aPart, s)
  const aRings: Ring[] = []
  for (let i = 0; i < N_ARM; i++) {
    const d = armD(i), r = armRadius(s, d)
    aRings.push({ y: -d * fa, rx: r, rz: r * 1.05, cx: 0, cz: 0 })
  }
  const armGeo = loft(aRings, SEG_ARM, { surf: aSurf, colors: true, capStart: true, capEnd: true })
  const armLength = ARM_LEN * fa
  const makeArm = (side: 1 | -1) => {
    const wrap = new THREE.Group()
    wrap.position.set(side * sx, SHOULDER_Y, 0)
    wrap.scale.x = side
    const arm = new THREE.Group()
    arm.rotation.z = 0.16
    arm.add(new THREE.Mesh(armGeo, mats.skin))
    const hand = buildHand(mats)
    hand.position.set(0, -armLength + 0.012, 0)
    arm.add(hand)
    wrap.add(arm)
    return wrap
  }
  upper.add(makeArm(1), makeArm(-1))
  const deltoid = 0.050 + norm(s.shoulders) * 0.006 + zoneLevel(s, 'delts') * 0.012 * (0.5 + 0.5 * gM)
  upper.add(ell(mats.skinFlat, deltoid, deltoid * 1.12, deltoid * 0.95, sx, SHOULDER_Y - 0.012, 0))
  upper.add(ell(mats.skinFlat, deltoid, deltoid * 1.12, deltoid * 0.95, -sx, SHOULDER_Y - 0.012, 0))

  // Piernas (geometría compartida, la izquierda es el espejo)
  const lPart = legPart()
  const lSurf = computeSurface(lPart, s)
  const lRings: Ring[] = []
  for (let i = 0; i < N_LEG; i++) {
    const d = legD(i), r = legRadius(s, d)
    lRings.push({ y: -d * fl, rx: r, rz: r * 1.04, cx: 0, cz: 0 })
  }
  const legGeo = loft(lRings, SEG_LEG, { surf: lSurf, colors: true, capEnd: true })
  const shortsEnd = Math.round((0.22 / LEG_LEN) * (N_LEG - 1))
  const shortLeg = loft(lRings, SEG_LEG, { surf: lSurf, i0: 0, i1: shortsEnd, inflate: 0.006 })
  const makeLeg = (side: 1 | -1) => {
    const wrap = new THREE.Group()
    wrap.position.set(side * 0.082, LEG_TOP_Y + dY, 0)
    wrap.scale.x = side
    const leg = new THREE.Group()
    leg.rotation.z = 0.035
    leg.add(new THREE.Mesh(legGeo, mats.skin))
    leg.add(new THREE.Mesh(shortLeg, mats.shorts))
    const foot = buildFoot(mats)
    foot.position.set(0, -(LEG_LEN * fl) - 0.028, 0)
    leg.add(foot)
    wrap.add(leg)
    return wrap
  }

  root.add(upper)
  root.add(makeLeg(1), makeLeg(-1))
  root.scale.setScalar((s.heightCm / 100) / (TOP_Y + dY))
  return root
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
}
