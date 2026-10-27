import * as THREE from 'three'
import type { BodyMaterials, RenderState, ZoneKey } from './bodyModel'
import { setStyleColors } from './bodyModel'

// Cuerpo basado en MakeHuman (CC0, "GYMBODY2"): malla base + morph targets esparcidos (int16) + prendas
// derivadas de la piel. En cada cambio de slider se mezclan los targets activos en CPU, se recalculan
// normales y un sombreado de pliegues (curvatura) que da volumen a los músculos.

export const BAKED_URL = '/models/gymbody.bin?v=6'

/** Rampa de sombreado de 4 tonos: da el aspecto de cel-shading (anime). */
function makeGradient(v: number[] = [190, 220, 244, 255]): THREE.DataTexture {
  const data = new Uint8Array(v.flatMap(x => [x, x, x, 255]))
  const t = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat)
  t.minFilter = t.magFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.needsUpdate = true
  return t
}
/** Pinta un ojo estilo anime (esclera, iris con degradado, pupila, brillos y párpado) en un canvas. */
function paintEye(cv: HTMLCanvasElement, color: string) {
  const S = 512
  cv.width = cv.height = S
  const g = cv.getContext('2d')!
  g.clearRect(0, 0, S, S)
  const c = S / 2, EX = 205, EY = 195
  const base = new THREE.Color(color)
  const dark = base.clone().multiplyScalar(0.38).getStyle()
  const mid = base.getStyle()
  const light = base.clone().lerp(new THREE.Color('#ffffff'), 0.5).getStyle()
  // esclera (con sombra suave arriba)
  g.save(); g.beginPath(); g.ellipse(c, c, EX, EY, 0, 0, Math.PI * 2); g.clip()
  let gr = g.createLinearGradient(0, c - EY, 0, c + EY)
  gr.addColorStop(0, '#c9d2e4'); gr.addColorStop(0.28, '#ffffff'); gr.addColorStop(1, '#ffffff')
  g.fillStyle = gr; g.fillRect(0, 0, S, S)
  // iris
  const ix = c, iy = c + 4, rx = 132, ry = 172
  gr = g.createLinearGradient(0, iy - ry, 0, iy + ry)
  gr.addColorStop(0, dark); gr.addColorStop(0.45, mid); gr.addColorStop(1, light)
  g.fillStyle = gr; g.beginPath(); g.ellipse(ix, iy, rx, ry, 0, 0, Math.PI * 2); g.fill()
  g.lineWidth = 9; g.strokeStyle = dark; g.stroke()
  // brillo inferior del iris
  g.fillStyle = 'rgba(255,255,255,0.28)'; g.beginPath(); g.ellipse(ix, iy + ry * 0.55, rx * 0.62, ry * 0.26, 0, 0, Math.PI * 2); g.fill()
  // pupila
  g.fillStyle = '#140c18'; g.beginPath(); g.ellipse(ix, iy - 4, 58, 92, 0, 0, Math.PI * 2); g.fill()
  // reflejos
  g.fillStyle = '#ffffff'
  g.beginPath(); g.ellipse(ix - 46, iy - 78, 38, 40, 0, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.ellipse(ix + 52, iy + 70, 17, 18, 0, 0, Math.PI * 2); g.fill()
  g.restore()
  // párpado superior grueso con colita hacia afuera (u crece hacia el lado exterior)
  g.strokeStyle = '#1d1222'; g.lineCap = 'round'; g.lineJoin = 'round'
  g.lineWidth = 26
  g.beginPath(); g.ellipse(c, c, EX + 6, EY + 6, 0, Math.PI * 1.04, Math.PI * 1.97); g.stroke()
  g.lineWidth = 15
  g.beginPath(); g.moveTo(c + EX - 4, c - 70); g.quadraticCurveTo(c + EX + 36, c - 92, c + EX + 52, c - 128); g.stroke()
  // pestaña inferior fina
  g.lineWidth = 7
  g.beginPath(); g.ellipse(c, c, EX - 6, EY - 6, 0, Math.PI * 0.12, Math.PI * 0.88); g.stroke()
}

const OUTLINED = new Set(['Skin', 'Cloth', 'Hair', 'Shoe', 'Sole'])
const OUTLINE_W = 0.0016

interface KeyData { n: string; c: number; idx: Uint16Array; val: Int16Array }
interface PartData {
  name: string; mat: string; nv: number; nt: number; vis: string
  base?: Float32Array; index: Uint16Array; keys: KeyData[]
  derived?: string; src?: Uint16Array; w?: Float32Array; infl?: Float32Array; accent?: boolean; uv?: Float32Array
}
export interface BakedBody { parts: PartData[]; deltaScale: number; topY: number; legLen: number; headY: number; lips: Uint16Array }

let cache: Promise<BakedBody> | null = null

export function loadBakedBody(url = BAKED_URL): Promise<BakedBody> {
  if (!cache) {
    cache = fetch(url)
      .then(r => { if (!r.ok) throw new Error('modelo no disponible'); return r.arrayBuffer() })
      .then(parseBaked)
      .catch(e => { cache = null; throw e })
  }
  return cache
}

function parseBaked(buf: ArrayBuffer): BakedBody {
  const magic = new TextDecoder().decode(new Uint8Array(buf, 0, 8))
  if (magic !== 'GYMBODY2') throw new Error('formato inválido')
  const jsonLen = new DataView(buf).getUint32(8, true)
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, jsonLen)))
  const blob = 12 + jsonLen
  const parts: PartData[] = head.parts.map((p: any) => {
    const part: PartData = {
      name: p.name, mat: p.mat, nv: p.nv, nt: p.nt, vis: p.vis || '',
      index: new Uint16Array(buf, blob + p.idx, p.nt * 3), keys: [],
    }
    if (p.derived) {
      part.derived = p.derived
      part.src = new Uint16Array(buf, blob + p.src, p.nv * 3)
      part.w = new Float32Array(buf, blob + p.w, p.nv * 3)
      part.infl = new Float32Array(buf, blob + p.infl, p.nv)
      part.accent = !!p.accent
      if (p.uv !== undefined) part.uv = new Float32Array(buf, blob + p.uv, p.nv * 2)
    } else {
      part.base = new Float32Array(buf, blob + p.pos, p.nv * 3)
      part.keys = p.keys.map((k: any) => ({
        n: k.n, c: k.c, idx: new Uint16Array(buf, blob + k.io, k.c), val: new Int16Array(buf, blob + k.vo, k.c * 3),
      }))
    }
    return part
  })
  const lips = head.nlips ? new Uint16Array(buf, blob + head.lips, head.nlips) : new Uint16Array(0)
  return { parts, deltaScale: head.deltaScale, topY: head.topY, legLen: head.legLen, headY: head.headY ?? 1.5, lips }
}

// ── Sliders → peso de cada morph target (claves ± de MakeHuman) ──
// Targets que definen cada zona muscular (para resaltarla en el editor)
const ZONE_KEYS: Record<ZoneKey, string[]> = {
  chest: ['pec+', 'bust+'], back: ['dorsi+', 'vshape+'], delts: ['delt+'], arms: ['bicep+', 'forearm+'],
  abs: ['abs+', 'abs-'], glutes: ['glutes+'], quads: ['quad+', 'thigh+'], calves: ['calfm+'],
}
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function influences(s: RenderState): Record<string, number> {
  const g = s.g, fat = s.fat / 100, mus = s.muscle / 100
  const nrm = (v: number) => (v - 50) / 50
  const out: Record<string, number> = {}
  const sgn = (k: string, v: number, mul = 1) => { out[k + '+'] = (out[k + '+'] ?? 0) + Math.max(v, 0) * mul; out[k + '-'] = (out[k + '-'] ?? 0) + Math.max(-v, 0) * mul }
  // Macro: género, músculo y peso (interpolación MakeHuman por tramos)
  out.gender = g
  const mu = 0.12 + 0.88 * mus, wt = 0.2 + 0.8 * fat
  for (const [gn, gw] of [['m', 1 - g], ['f', g]] as const) {
    out[`mus_${gn}+`] = Math.max(0, mu - 0.5) * 2.7 * gw; out[`mus_${gn}-`] = Math.max(0, 0.5 - mu) * 2 * gw
    out[`wt_${gn}+`] = Math.max(0, wt - 0.5) * 2 * gw; out[`wt_${gn}-`] = Math.max(0, 0.5 - wt) * 2 * gw
  }
  // Zonas musculares
  const z = (f: keyof RenderState) => nrm(s[f] as number)
  sgn('pec', z('zChest')); sgn('dorsi', z('zBack')); sgn('delt', z('zDelts'), 1.2)
  sgn('bicep', z('zArms')); sgn('forearm', z('zArms'), 0.6)
  sgn('abs', z('zAbs')); sgn('glutes', z('zGlutes'), 1.2)
  sgn('quad', z('zQuads')); sgn('calfm', z('zCalves'), 0.6)
  // Forma general
  sgn('shoulderw', nrm(s.shoulders), 0.9); sgn('vshape', nrm(s.shoulders), 0.5)
  sgn('waist', nrm(s.waist)); sgn('hips', nrm(s.hips))
  sgn('frontchest', nrm(s.chest), 0.8); sgn('bust', nrm(s.chest) * g, 0.8)
  sgn('armc', nrm(s.arms), 0.9); sgn('thigh', nrm(s.legs), 0.9); sgn('calfc', nrm(s.legs), 0.5)
  sgn('armLen', nrm(s.armLen), 0.8); sgn('legLen', nrm(s.legLen), 0.55)
  // Rostro
  sgn('face_w', nrm(s.faceW), 0.9); sgn('jaw', nrm(s.jaw)); sgn('nose', nrm(s.nose)); sgn('lips', nrm(s.lips)); sgn('eyes', nrm(s.eyes))
  sgn('cheek', fat - 0.4, 0.8)
  return out
}

interface Item {
  part: PartData
  mesh: THREE.Mesh
  outline?: THREE.Mesh
  geo: THREE.BufferGeometry
  pos: Float32Array
  colors?: Float32Array
  tone?: Float32Array
  masks?: Partial<Record<ZoneKey, Float32Array>>
  lastSig: string
  adjStart?: Uint32Array; adjIdx?: Uint32Array; aoK?: number; ao?: Float32Array
}

export class BakedInstance {
  readonly group = new THREE.Group()
  private items = new Map<string, Item>()
  private lastHl = ''
  private colorCache = new Map<string, THREE.Color>()
  private lastStyleSig = ''

  private eyeCanvas = document.createElement('canvas')
  private eyeTex = new THREE.CanvasTexture(this.eyeCanvas)
  private eyeMat = new THREE.MeshBasicMaterial({ map: this.eyeTex, alphaTest: 0.4, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 })
  private eyeColor = ''
  private grad = makeGradient()
  private gradSkin = makeGradient([128, 182, 230, 255])
  private toon: Record<string, THREE.MeshToonMaterial> = {}
  private outlineMat = (() => {
    const m = new THREE.MeshBasicMaterial({ color: '#46283a', side: THREE.BackSide })
    m.onBeforeCompile = sh => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${OUTLINE_W};`)
    }
    return m
  })()

  constructor(private data: BakedBody, private mats: BodyMaterials) {
    this.eyeTex.colorSpace = THREE.SRGBColorSpace
    const B = (c: string, lvl = 1) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -lvl * 2, polygonOffsetUnits: -lvl * 4 }) as unknown as THREE.MeshToonMaterial
    const T = (o: THREE.MeshToonMaterialParameters) => new THREE.MeshToonMaterial({ gradientMap: this.grad, ...o })
    this.toon = {
      Skin: T({ vertexColors: true, gradientMap: this.gradSkin }), Cloth: T({ vertexColors: true }), Hair: T({ vertexColors: true, side: THREE.DoubleSide }),
      Brow: T({ vertexColors: true }), Dark: B('#1d1222', 4), White: B('#ffffff', 1), Eye: B('#5a3d2b', 2), Shine: B('#ffffff', 6), EyeTex: this.eyeMat as unknown as THREE.MeshToonMaterial,
      EyeLight: B('#9a7a60', 3), Lip: T({ color: '#d98a86' }), Shoe: T({ color: '#f3f4f6' }), Sole: T({ color: '#f4f5f7' }),
    }
    const matMap: Record<string, THREE.Material> = this.toon
    for (const part of data.parts) {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(part.nv * 3)
      if (part.base) pos.set(part.base)
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.nv * 3), 3).setUsage(THREE.DynamicDrawUsage))
      geo.setIndex(new THREE.BufferAttribute(part.index, 1))
      if (part.uv) geo.setAttribute('uv', new THREE.BufferAttribute(part.uv, 2))
      const item: Item = { part, geo, pos, mesh: null as unknown as THREE.Mesh, lastSig: '' }
      if (part.mat === 'Skin' || part.mat === 'Cloth' || part.mat === 'Hair' || part.mat === 'Brow' || part.derived) {
        item.colors = new Float32Array(part.nv * 3).fill(1)
        geo.setAttribute('color', new THREE.BufferAttribute(item.colors, 3).setUsage(THREE.DynamicDrawUsage))
      }
      if (part.mat === 'Skin') { this.buildAdjacency(item); this.buildTone(item) }
      item.mesh = new THREE.Mesh(geo, matMap[part.mat])
      item.mesh.frustumCulled = false
      this.group.add(item.mesh)
      if (OUTLINED.has(part.mat)) {
        item.outline = new THREE.Mesh(geo, this.outlineMat)
        item.outline.frustumCulled = false
        this.group.add(item.outline)
      }
      this.items.set(part.name, item)
    }
    const sk0 = this.items.get('Skin'); if (sk0) this.measure(sk0.pos)
    // Los pies/zapatos estáticos necesitan normales desde el inicio
    for (const it of this.items.values()) if (!it.part.derived && it.part.keys.length === 0) { it.geo.computeVertexNormals() }
  }

  private color(hex: string): THREE.Color {
    let c = this.colorCache.get(hex)
    if (!c) { c = new THREE.Color(hex); this.colorCache.set(hex, c) }
    return c
  }

  /** Vecinos por vértice (CSR) para estimar la curvatura y oscurecer los pliegues. */
  private buildAdjacency(item: Item) {
    const { part } = item, n = part.nv, ix = part.index
    const deg = new Uint32Array(n + 1)
    for (let t = 0; t < ix.length; t += 3) {
      deg[ix[t] + 1] += 2; deg[ix[t + 1] + 1] += 2; deg[ix[t + 2] + 1] += 2
    }
    for (let i = 0; i < n; i++) deg[i + 1] += deg[i]
    const fill = new Uint32Array(n)
    const adj = new Uint32Array(deg[n])
    const push = (a: number, b: number) => { adj[deg[a] + fill[a]++] = b }
    for (let t = 0; t < ix.length; t += 3) {
      const a = ix[t], b = ix[t + 1], c = ix[t + 2]
      push(a, b); push(a, c); push(b, a); push(b, c); push(c, a); push(c, b)
    }
    item.adjStart = deg; item.adjIdx = adj; item.ao = new Float32Array(n).fill(1)
    // Longitud media de arista -> escala de la curvatura
    const base = part.base!; let sum = 0, cnt = 0
    for (let t = 0; t < Math.min(ix.length, 3000); t += 3) {
      const a = ix[t] * 3, b = ix[t + 1] * 3
      sum += Math.hypot(base[a] - base[b], base[a + 1] - base[b + 1], base[a + 2] - base[b + 2]); cnt++
    }
    const L = sum / Math.max(cnt, 1)
    item.aoK = 0.0030 / (L * L)
  }

  /** Detalles de color de la piel que siguen al cuerpo: labios. */
  private buildTone(item: Item) {
    const { part } = item, n = part.nv
    const tone = new Float32Array(n * 3).fill(1)
    for (const v of this.data.lips) { tone[v * 3] = 1.0; tone[v * 3 + 1] = 0.66; tone[v * 3 + 2] = 0.68 }
    item.tone = tone
  }

  private computeAO(item: Item) {
    const { pos, geo, adjStart, adjIdx, ao, aoK } = item
    if (!adjStart || !adjIdx || !ao) return
    const nor = geo.attributes.normal.array as Float32Array
    const n = item.part.nv, k = aoK!
    for (let v = 0; v < n; v++) {
      const s = adjStart[v], e = adjStart[v + 1]
      let sx = 0, sy = 0, sz = 0
      for (let j = s; j < e; j++) { const p = adjIdx[j] * 3; sx += pos[p]; sy += pos[p + 1]; sz += pos[p + 2] }
      const c = 1 / Math.max(e - s, 1), v3 = v * 3
      const d = (sx * c - pos[v3]) * nor[v3] + (sy * c - pos[v3 + 1]) * nor[v3 + 1] + (sz * c - pos[v3 + 2]) * nor[v3 + 2]
      const a = 1 - k * d
      ao[v] = a < 0.55 ? 0.55 : a > 1.04 ? 1.04 : a
    }
  }

  private maskFor(item: Item, zone: ZoneKey): Float32Array | null {
    item.masks ??= {}
    if (item.masks[zone]) return item.masks[zone]!
    const names = ZONE_KEYS[zone]
    const mask = new Float32Array(item.part.nv)
    let max = 0
    for (const k of item.part.keys) {
      if (!names.includes(k.n)) continue
      for (let i = 0; i < k.c; i++) {
        const m = Math.hypot(k.val[i * 3], k.val[i * 3 + 1], k.val[i * 3 + 2])
        const v = k.idx[i]
        if (m > mask[v]) mask[v] = m
        if (m > max) max = m
      }
    }
    if (max === 0) return null
    for (let v = 0; v < mask.length; v++) mask[v] = Math.min(1, Math.sqrt(mask[v] / (max * 0.55)))
    item.masks[zone] = mask
    return mask
  }

  update(s: RenderState) {
    const infl = influences(s)
    const sc = this.data.deltaScale
    const st = s.style
    setStyleColors(this.mats, st)
    const tn = this.toon
    tn.Skin.color.copy(this.mats.skin.color)
    tn.Hair.color.set(st.hairColor); tn.Hair.emissive.set(st.hairColor).multiplyScalar(0.22); tn.Brow.color.set(st.hairColor).multiplyScalar(0.75)
    if (st.eyeColor !== this.eyeColor) { this.eyeColor = st.eyeColor; paintEye(this.eyeCanvas, st.eyeColor); this.eyeTex.needsUpdate = true }
    tn.Eye.color.set(st.eyeColor); tn.EyeLight.color.set(st.eyeColor).lerp(new THREE.Color('#ffffff'), 0.42)
    tn.Shoe.color.set(st.shoeColor)

    // 1) visibilidad según el estilo elegido (peinado, ropa, calzado)
    for (const item of this.items.values()) {
      const vis = item.part.vis
      if (!vis) { item.mesh.visible = true; continue }
      const [k, v] = vis.split(':')
      item.mesh.visible = (st as unknown as Record<string, string>)[k] === v
      if (item.outline) item.outline.visible = item.mesh.visible
    }

    // 2) piezas con morph targets (solo se recalculan si cambiaron sus pesos)
    let skinChanged = false
    for (const item of this.items.values()) {
      const { part, pos, geo } = item
      if (part.derived || !item.mesh.visible || part.keys.length === 0) continue
      let sig = ''
      for (const k of part.keys) { const w = infl[k.n]; sig += (w && Math.abs(w) > 1e-4 ? w.toFixed(4) : '0') + ',' }
      if (sig === item.lastSig) continue
      item.lastSig = sig
      pos.set(part.base!)
      for (const k of part.keys) {
        const w = infl[k.n]
        if (!w || Math.abs(w) < 1e-4) continue
        const f = w * sc
        const { idx, val, c } = k
        for (let i = 0; i < c; i++) {
          const v = idx[i] * 3, d = i * 3
          pos[v] += val[d] * f; pos[v + 1] += val[d + 1] * f; pos[v + 2] += val[d + 2] * f
        }
      }
      geo.attributes.position.needsUpdate = true
      geo.computeVertexNormals()
      if (item.ao) { this.computeAO(item); if (part.name === 'Skin') { skinChanged = true; this.measure(pos) } }
      this.lastHl = '\0' // fuerza actualizar colores
    }

    // 3) colores de piel: sombreado de pliegues + resalte de la zona muscular activa
    const hlKey = s.hl > 0.02 ? s.hlKey : ''
    const sig = (hlKey ? `${hlKey}:${s.hl.toFixed(2)}` : '') + '|' + (skinChanged ? 'c' : '')
    if (sig !== this.lastHl || skinChanged) {
      this.lastHl = sig
      for (const item of this.items.values()) {
        if (!item.colors || item.part.mat !== 'Skin' || !item.ao) continue
        const mask = hlKey && item.part.name === 'Skin' ? this.maskFor(item, hlKey as ZoneKey) : null
        const c = item.colors, ao = item.ao
        for (let v = 0, n = ao.length; v < n; v++) {
          const t = mask ? mask[v] * s.hl * 0.55 : 0
          const a = 0.62 + 0.38 * ao[v], tn = item.tone!
          c[v * 3] = a * tn[v * 3] * (1 - t + 0.30 * t); c[v * 3 + 1] = a * tn[v * 3 + 1] * (1 - t + 0.95 * t); c[v * 3 + 2] = a * tn[v * 3 + 2] * (1 - t + 1.55 * t)
        }
        item.geo.attributes.color.needsUpdate = true
      }
    }

    // 4) prendas derivadas de la piel (siguen el cuerpo; bordes rectos, color principal + acento)
    const skin = this.items.get('Skin')
    const needDerived = skinChanged || s.styleSig !== this.lastStyleSig
    this.lastStyleSig = s.styleSig
    if (skin && needDerived) {
      const sp = skin.pos, sn = skin.geo.attributes.normal.array as Float32Array, sao = skin.ao!
      for (const item of this.items.values()) {
        const { part, pos, geo } = item
        if (!part.derived || !item.mesh.visible) continue
        const nor = geo.attributes.normal.array as Float32Array
        const col = item.colors!
        const slot = part.vis.split(':')[0]
        const main = this.color(slot === 'top' ? st.topColor : slot === 'shoes' ? st.shoeColor : st.bottomColor), acc = this.color(slot === 'shoes' ? '#f4f5f7' : st.accentColor)
        const src = part.src!, w = part.w!, inf = part.infl!
        const cc = part.mat !== 'Cloth' ? this.color('#ffffff') : part.accent ? acc : main
        for (let i = 0; i < part.nv; i++) {
          const k = i * 3, a = src[k] * 3, b = src[k + 1] * 3, c2 = src[k + 2] * 3
          const w0 = w[k], w1 = w[k + 1], w2 = w[k + 2], d = i * 3
          let nx = w0 * sn[a] + w1 * sn[b] + w2 * sn[c2], ny = w0 * sn[a + 1] + w1 * sn[b + 1] + w2 * sn[c2 + 1], nz = w0 * sn[a + 2] + w1 * sn[b + 2] + w2 * sn[c2 + 2]
          const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl
          nor[d] = nx; nor[d + 1] = ny; nor[d + 2] = nz
          const o = inf[i]
          pos[d] = w0 * sp[a] + w1 * sp[b] + w2 * sp[c2] + nx * o
          pos[d + 1] = w0 * sp[a + 1] + w1 * sp[b + 1] + w2 * sp[c2 + 1] + ny * o
          pos[d + 2] = w0 * sp[a + 2] + w1 * sp[b + 2] + w2 * sp[c2 + 2] + nz * o
          const shade = part.mat === 'Cloth' ? 0.92 + 0.08 * (w0 * sao[src[k]] + w1 * sao[src[k + 1]] + w2 * sao[src[k + 2]]) : 1
          col[d] = cc.r * shade; col[d + 1] = cc.g * shade; col[d + 2] = cc.b * shade
        }
        geo.attributes.position.needsUpdate = true
        geo.attributes.normal.needsUpdate = true
        geo.attributes.color.needsUpdate = true
      }
    }

    // 5) escala por altura (el piso queda en y = 0 y la estatura es exacta)
    const sc2 = (s.heightCm / 100) / Math.max(this.maxY - this.minY, 0.5)
    this.group.scale.setScalar(sc2)
    this.group.position.y = -this.minY * sc2
  }

  private minY = 0
  private maxY = 1.73
  private measure(pos: Float32Array) {
    let lo = Infinity, hi = -Infinity
    for (let i = 1; i < pos.length; i += 3) { const y = pos[i]; if (y < lo) lo = y; if (y > hi) hi = y }
    this.minY = lo; this.maxY = hi
  }

  dispose() {
    for (const item of this.items.values()) item.geo.dispose()
    this.items.clear()
    Object.values(this.toon).forEach(m => m.dispose()); this.outlineMat.dispose(); this.eyeMat.dispose(); this.eyeTex.dispose(); this.grad.dispose(); this.gradSkin.dispose()
  }
}



