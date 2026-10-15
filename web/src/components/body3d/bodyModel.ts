import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────────────────────
// Modelo corporal paramétrico. Todo se genera por código (sin assets externos):
// cada parte del cuerpo es un "loft" de anillos elípticos cuyo radio depende de
// los deslizadores (grasa, músculo, hombros, cintura…). Hombre↔Mujer se mezcla
// con un factor continuo `g` para poder animar la transformación.
// Unidades: metros. Altura base = 1.75 m (se escala con el slider de altura).
// ─────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female'

export interface BodyParams {
  gender: Gender
  skin: number // índice en SKIN_TONES
  heightCm: number // 140–210
  fat: number // 0–100
  muscle: number // 0–100
  shoulders: number // 0–100 (50 = neutro)
  chest: number
  waist: number
  hips: number
  arms: number
  legs: number
}

export const SKIN_TONES = ['#f6d5bd', '#ecc4a3', '#d9a47c', '#b97a54', '#8a5535', '#5e3a24']

export const defaultParams = (gender: Gender = 'male'): BodyParams => ({
  gender,
  skin: 1,
  heightCm: gender === 'male' ? 175 : 164,
  fat: gender === 'male' ? 35 : 30,
  muscle: gender === 'male' ? 30 : 22,
  shoulders: 50, chest: 50, waist: 50, hips: 50, arms: 50, legs: 50,
})

export const HEIGHT_MIN = 140
export const HEIGHT_MAX = 210

// ── Estimaciones visuales (orientativas, no son una medición clínica) ────────
export const estFatPct = (p: BodyParams) =>
  Math.round((p.gender === 'male' ? 8 : 15) + (p.fat / 100) * 37)

export const fatLabel = (p: BodyParams) =>
  p.fat < 15 ? 'Muy definido' : p.fat < 35 ? 'Atlético' : p.fat < 55 ? 'Promedio' : p.fat < 78 ? 'Con sobrepeso' : 'Obesidad'

export const muscleLabel = (p: BodyParams) =>
  p.muscle < 15 ? 'Bajo' : p.muscle < 40 ? 'Moderado' : p.muscle < 70 ? 'Alto' : 'Muy alto'

// ── Estado numérico de render (interpolable para animar) ─────────────────────
export interface RenderState {
  g: number // 0 = hombre, 1 = mujer
  heightCm: number
  fat: number; muscle: number
  shoulders: number; chest: number; waist: number; hips: number; arms: number; legs: number
  r: number; gr: number; b: number // color de piel (0–1)
}

export function toRender(p: BodyParams): RenderState {
  const c = new THREE.Color(SKIN_TONES[Math.min(Math.max(p.skin, 0), SKIN_TONES.length - 1)])
  return {
    g: p.gender === 'female' ? 1 : 0,
    heightCm: p.heightCm, fat: p.fat, muscle: p.muscle,
    shoulders: p.shoulders, chest: p.chest, waist: p.waist, hips: p.hips, arms: p.arms, legs: p.legs,
    r: c.r, gr: c.g, b: c.b,
  }
}

const KEYS: (keyof RenderState)[] = ['g', 'heightCm', 'fat', 'muscle', 'shoulders', 'chest', 'waist', 'hips', 'arms', 'legs', 'r', 'gr', 'b']
const SCALE: Record<string, number> = { g: 1, heightCm: 70, fat: 100, muscle: 100, shoulders: 100, chest: 100, waist: 100, hips: 100, arms: 100, legs: 100, r: 1, gr: 1, b: 1 }

export function renderDistance(a: RenderState, b: RenderState): number {
  let d = 0
  for (const k of KEYS) d = Math.max(d, Math.abs(a[k] - b[k]) / SCALE[k])
  return d
}
export function lerpInto(cur: RenderState, target: RenderState, k: number) {
  for (const key of KEYS) cur[key] += (target[key] - cur[key]) * k
}

// ── Utilidades matemáticas ───────────────────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const bump = (x: number, c: number, w: number) => Math.exp(-(((x - c) / w) ** 2))
const norm = (v: number) => (v - 50) / 50 // 0..100 → -1..1

function catmull(p0: number, p1: number, p2: number, p3: number, u: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u * u * u)
}
/** Interpola la columna `k` de una tabla [x, v1, v2…] en la posición x (Catmull-Rom). */
function sample(tab: number[][], x: number, k: number): number {
  const n = tab.length
  if (x <= tab[0][0]) return tab[0][k]
  if (x >= tab[n - 1][0]) return tab[n - 1][k]
  let i = 0
  while (i < n - 2 && x > tab[i + 1][0]) i++
  const u = (x - tab[i][0]) / (tab[i + 1][0] - tab[i][0])
  const p0 = tab[Math.max(i - 1, 0)][k], p1 = tab[i][k], p2 = tab[i + 1][k], p3 = tab[Math.min(i + 2, n - 1)][k]
  return catmull(p0, p1, p2, p3, u)
}

// ── Tablas base: [y, radio X, radio Z] del torso + cuello ────────────────────
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
// Brazo: [distancia desde el hombro, radio]
const ARM = [
  [0, 0.056], [0.06, 0.054], [0.16, 0.047], [0.24, 0.041], [0.28, 0.037],
  [0.33, 0.040], [0.42, 0.034], [0.53, 0.027], [0.58, 0.025],
]
// Pierna: [distancia desde la cadera, radio]
const LEG = [
  [0, 0.088], [0.08, 0.089], [0.20, 0.080], [0.32, 0.066], [0.40, 0.054], [0.44, 0.050],
  [0.50, 0.052], [0.58, 0.056], [0.66, 0.046], [0.76, 0.034], [0.84, 0.031],
]
// Qué tanto se nota cada slider (se calibró visualmente)
const FAT_K = 1.9
const MUS_K = 1.7
const ARM_LEN = 0.58
const LEG_LEN = 0.84
const LEG_TOP_Y = 0.90
const SHOULDER_Y = 1.37
const TORSO_Y0 = 0.86
const TORSO_Y1 = 1.55

interface Ring { y: number; rx: number; rz: number; cx: number; cz: number }

/** Dimensiones del torso a una altura y, con todos los deslizadores aplicados. */
function torsoAt(s: RenderState, y: number): { rx: number; rz: number; cz: number } {
  const g = s.g, gM = 1 - g, gF = g
  const f = (s.fat / 100) * FAT_K, m = (s.muscle / 100) * MUS_K
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

  // Grasa: vientre en hombres, caderas en mujeres
  rx += f * ((0.050 * gM + 0.035 * gF) * belly + (0.030 * gM + 0.045 * gF) * hipB + 0.018 * ribs + 0.008 + 0.012 * neckB)
  rz += f * ((0.060 * gM + 0.040 * gF) * belly + (0.020 * gM + 0.030 * gF) * hipB + 0.015 * ribs + 0.008 + 0.012 * neckB)
  cz += f * (0.030 * gM + 0.018 * gF) * belly

  // Músculo: hombros/trapecio, dorsales, pecho, cuello
  rx += m * ((0.032 * gM + 0.018 * gF) * shoulderB + (0.020 * gM + 0.010 * gF) * ribs + 0.012 * gM * neckB)
  rz += m * ((0.026 * gM + 0.012 * gF) * chestB + 0.008 * bump(y, 1.0, 0.12) + 0.010 * gM * neckB)

  // Ajustes finos
  rx += sh * 0.032 * shoulderB
  rx += wa * 0.035 * waistB; rz += wa * 0.025 * waistB
  rx += hi * 0.040 * hipB; rz += hi * 0.030 * hipB
  rz += ch * (0.014 * gM + 0.022 * gF) * (gM * chestB + gF * bustB)
  cz += ch * (0.004 * gM + 0.020 * gF) * (gM * chestB + gF * bustB)

  // Busto base en mujeres
  cz += gF * 0.012 * bustB
  rz += gF * 0.006 * bustB

  return { rx: Math.max(rx, 0.02), rz: Math.max(rz, 0.02), cz }
}

function torsoRings(s: RenderState, y0: number, y1: number, n: number, inflate = 0): Ring[] {
  const rings: Ring[] = []
  for (let i = 0; i < n; i++) {
    const y = y0 + ((y1 - y0) * i) / (n - 1)
    const t = torsoAt(s, y)
    rings.push({ y, rx: t.rx + inflate, rz: t.rz + inflate, cx: 0, cz: t.cz })
  }
  return rings
}

function armRadius(s: RenderState, d: number): number {
  const g = s.g, gM = 1 - g, gF = g
  const f = (s.fat / 100) * FAT_K, m = (s.muscle / 100) * MUS_K, ar = norm(s.arms)
  let r = sample(ARM, d, 1) * lerp(1, 0.86, g)
  r += f * (1 + 0.2 * gF) * (0.016 * bump(d, 0.2, 0.14) + 0.008 * bump(d, 0.4, 0.1))
  r += m * ((0.014 * gM + 0.007 * gF) * bump(d, 0.17, 0.08) + 0.007 * bump(d, 0.38, 0.08))
  r += ar * 0.012 * (bump(d, 0.18, 0.14) + 0.5 * bump(d, 0.38, 0.1))
  return Math.max(r, 0.015)
}

function legRadius(s: RenderState, d: number): number {
  const g = s.g, gM = 1 - g, gF = g
  const f = (s.fat / 100) * FAT_K, m = (s.muscle / 100) * MUS_K, lg = norm(s.legs)
  const thighFat = 0.7 * gM + 1.15 * gF
  let r = sample(LEG, d, 1)
  r += f * (0.034 * thighFat * bump(d, 0.16, 0.14) + 0.010 * bump(d, 0.58, 0.09))
  r += m * (0.022 * (gM + 0.65 * gF) * bump(d, 0.20, 0.13) + 0.014 * bump(d, 0.58, 0.08))
  r += lg * (0.026 * bump(d, 0.20, 0.18) + 0.012 * bump(d, 0.58, 0.09))
  return Math.max(r, 0.02)
}

/** Anillos de un miembro que cuelga hacia abajo (y local negativa). */
function limbRings(radiusAt: (d: number) => number, len: number, n: number, d0 = 0, d1 = len, inflate = 0, zStretch = 1): Ring[] {
  const rings: Ring[] = []
  for (let i = 0; i < n; i++) {
    const d = d0 + ((d1 - d0) * i) / (n - 1)
    const r = radiusAt(d) + inflate
    rings.push({ y: -d, rx: r, rz: r * zStretch, cx: 0, cz: 0 })
  }
  return rings
}

// ── Geometría por "loft" de anillos elípticos ────────────────────────────────
function loftGeometry(input: Ring[], seg = 28, capStart = false, capEnd = false): THREE.BufferGeometry {
  const rings = input[0].y <= input[input.length - 1].y ? input : [...input].reverse() // y ascendente
  const n = rings.length
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i < n; i++) {
    const r = rings[i]
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2
      pos.push(r.cx + r.rx * Math.cos(a), r.y, r.cz + r.rz * Math.sin(a))
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let j = 0; j < seg; j++) {
      const j2 = (j + 1) % seg
      const a = i * seg + j, b = i * seg + j2, c = (i + 1) * seg + j, d = (i + 1) * seg + j2
      idx.push(a, c, b, b, c, d)
    }
  }
  const addCap = (ringIndex: number, up: boolean) => {
    const r = rings[ringIndex]
    const center = pos.length / 3
    pos.push(r.cx, r.y, r.cz)
    for (let j = 0; j < seg; j++) {
      const a = ringIndex * seg + j, b = ringIndex * seg + ((j + 1) % seg)
      if (up) idx.push(center, b, a)
      else idx.push(center, a, b)
    }
  }
  if (capStart) addCap(0, false)
  if (capEnd) addCap(n - 1, true)

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  return geo
}

export interface BodyMaterials {
  skin: THREE.MeshStandardMaterial
  shorts: THREE.MeshStandardMaterial
  top: THREE.MeshStandardMaterial
  hair: THREE.MeshStandardMaterial
  dark: THREE.MeshStandardMaterial
}

export function createMaterials(): BodyMaterials {
  return {
    skin: new THREE.MeshStandardMaterial({ color: SKIN_TONES[1], roughness: 0.62, metalness: 0 }),
    shorts: new THREE.MeshStandardMaterial({ color: '#27407a', roughness: 0.8, metalness: 0 }),
    top: new THREE.MeshStandardMaterial({ color: '#00a8e8', roughness: 0.75, metalness: 0 }),
    hair: new THREE.MeshStandardMaterial({ color: '#3b2a20', roughness: 0.85, metalness: 0 }),
    dark: new THREE.MeshStandardMaterial({ color: '#1b1f2a', roughness: 0.5, metalness: 0 }),
  }
}

export function disposeMaterials(m: BodyMaterials) {
  Object.values(m).forEach(x => x.dispose())
}

function sphere(mat: THREE.Material, rx: number, ry: number, rz: number, x: number, y: number, z: number, w = 20, h = 14) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, w, h), mat)
  mesh.scale.set(rx, ry, rz)
  mesh.position.set(x, y, z)
  return mesh
}

/** Construye el cuerpo completo. Debe llamarse de nuevo cuando cambian los parámetros. */
export function buildBody(s: RenderState, mats: BodyMaterials): THREE.Group {
  const root = new THREE.Group()
  const body = new THREE.Group()
  const g = s.g, gM = 1 - g
  const f = (s.fat / 100) * FAT_K, m = (s.muscle / 100) * MUS_K

  // Torso + cuello
  body.add(new THREE.Mesh(loftGeometry(torsoRings(s, TORSO_Y0, TORSO_Y1, 52), 32, true, true), mats.skin))

  // Ropa: short (ambos) y top deportivo (mujer, aparece con g)
  body.add(new THREE.Mesh(loftGeometry(torsoRings(s, 0.86, 1.01, 10, 0.007), 32, false, false), mats.shorts))
  if (g > 0.5) {
    body.add(new THREE.Mesh(loftGeometry(torsoRings(s, 1.18, 1.31, 12, 0.006), 32, false, false), mats.top))
  }

  // Cabeza (mejillas crecen con la grasa)
  const hx = lerp(0.088, 0.082, g) * (1 + f * 0.12)
  const hy = lerp(0.112, 0.106, g)
  const hz = lerp(0.098, 0.093, g) * (1 + f * 0.06)
  const headY = 1.635
  body.add(sphere(mats.skin, hx, hy, hz, 0, headY, 0.002, 28, 20))
  // Ojos y nariz (rostro minimalista)
  const eyeZ = hz * 0.93
  body.add(sphere(mats.dark, 0.0085, 0.0085, 0.006, -0.032, headY + 0.012, eyeZ))
  body.add(sphere(mats.dark, 0.0085, 0.0085, 0.006, 0.032, headY + 0.012, eyeZ))
  body.add(sphere(mats.skin, 0.011, 0.014, 0.014, 0, headY - 0.012, hz * 0.99))
  // Cabello: gorra corta + melena que aparece con el factor mujer
  body.add(sphere(mats.hair, hx * 1.1, 0.098, hz * 1.14, 0, headY + 0.03, -0.016, 24, 16))
  if (g > 0.02) {
    const hairRy = 0.16
    const hair = sphere(mats.hair, hx * 1.08, hairRy * g, 0.07 + 0.02 * g, 0, 1.70 - hairRy * g, -0.045, 20, 14)
    body.add(hair)
  }

  // Hombros (deltoides)
  const sx = torsoAt(s, 1.36).rx - 0.004
  const deltoid = 0.060 + norm(s.shoulders) * 0.010 + m * 0.014 * (0.4 + 0.6 * gM)

  const armRings = limbRings(d => armRadius(s, d), ARM_LEN, 22)
  const armGeo = loftGeometry(armRings, 20, true, true)
  const makeArm = (side: 1 | -1) => {
    const grp = new THREE.Group()
    grp.position.set(side * sx, SHOULDER_Y, 0)
    grp.rotation.z = side * 0.16
    grp.add(new THREE.Mesh(armGeo, mats.skin))
    // Mano
    grp.add(sphere(mats.skin, 0.030, 0.085, 0.019, 0, -(ARM_LEN + 0.075), 0, 16, 12))
    return grp
  }
  body.add(makeArm(1), makeArm(-1))
  body.add(sphere(mats.skin, deltoid, deltoid * 1.1, deltoid, sx, SHOULDER_Y - 0.01, 0))
  body.add(sphere(mats.skin, deltoid, deltoid * 1.1, deltoid, -sx, SHOULDER_Y - 0.01, 0))

  // Piernas
  const legGeo = loftGeometry(limbRings(d => legRadius(s, d), LEG_LEN, 28, 0, LEG_LEN, 0, 1.04), 24, false, true)
  const shortLeg = loftGeometry(limbRings(d => legRadius(s, d), LEG_LEN, 8, 0, 0.22, 0.007, 1.04), 24, false, false)
  const makeLeg = (side: 1 | -1) => {
    const grp = new THREE.Group()
    grp.position.set(side * 0.082, LEG_TOP_Y, 0)
    grp.rotation.z = side * 0.035
    grp.add(new THREE.Mesh(legGeo, mats.skin))
    grp.add(new THREE.Mesh(shortLeg, mats.shorts))
    // Pie
    grp.add(sphere(mats.skin, 0.042, 0.032, 0.105, 0, -(LEG_LEN + 0.005), 0.04, 16, 12))
    return grp
  }
  body.add(makeLeg(1), makeLeg(-1))

  // Escala por altura (el piso queda en y = 0)
  const sc = s.heightCm / 175
  body.scale.setScalar(sc)
  root.add(body)
  return root
}

export function disposeGroup(group: THREE.Object3D) {
  group.traverse(o => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) mesh.geometry.dispose()
  })
}
