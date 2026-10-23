import * as THREE from 'three'
import type { BodyMaterials, RenderState, ZoneKey } from './bodyModel'
import { setStyleColors } from './bodyModel'

// Cuerpo modelado en Blender ("GYMBODY2"): malla base + morph targets esparcidos (int16) + prendas
// derivadas de la piel. En cada cambio de slider se mezclan los targets activos en CPU, se recalculan
// normales y un sombreado de pliegues (curvatura) que da volumen a los músculos.

export const BAKED_URL = '/models/gymbody.bin?v=2'

interface KeyData { n: string; c: number; idx: Uint16Array; val: Int16Array }
interface PartData {
  name: string; mat: string; nv: number; nt: number; vis: string
  base?: Float32Array; index: Uint16Array; keys: KeyData[]
  derived?: string; src?: Uint16Array; w?: Float32Array; infl?: Float32Array; accent?: boolean
}
export interface BakedBody { parts: PartData[]; deltaScale: number; topY: number; legLen: number }

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
      part.src = new Uint16Array(buf, blob + p.src, p.nv * 2)
      part.w = new Float32Array(buf, blob + p.w, p.nv)
      part.infl = new Float32Array(buf, blob + p.infl, p.nv)
      part.accent = !!p.accent
    } else {
      part.base = new Float32Array(buf, blob + p.pos, p.nv * 3)
      part.keys = p.keys.map((k: any) => ({
        n: k.n, c: k.c, idx: new Uint16Array(buf, blob + k.io, k.c), val: new Int16Array(buf, blob + k.vo, k.c * 3),
      }))
    }
    return part
  })
  return { parts, deltaScale: head.deltaScale, topY: head.topY, legLen: head.legLen }
}

// ── Sliders → peso de cada morph target (misma lógica que tools/blender_body/morphs.py) ──
const ZONE_LIST: ZoneKey[] = ['chest', 'back', 'delts', 'arms', 'abs', 'glutes', 'quads', 'calves']
const ZONE_FIELD: Record<ZoneKey, 'zChest' | 'zBack' | 'zDelts' | 'zArms' | 'zAbs' | 'zGlutes' | 'zQuads' | 'zCalves'> = {
  chest: 'zChest', back: 'zBack', delts: 'zDelts', arms: 'zArms', abs: 'zAbs', glutes: 'zGlutes', quads: 'zQuads', calves: 'zCalves',
}
const ZONE_FF: Record<string, number> = { chest: 0.55, back: 0.72, abs: 1, glutes: 1.25, delts: 1, arms: 1, quads: 1, hams: 1, calves: 1 }
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export function influences(s: RenderState): Record<string, number> {
  const g = s.g, fat = s.fat / 100, mus = s.muscle / 100
  const nrm = (v: number) => (v - 50) / 50
  const out: Record<string, number> = {
    gender: g, fat_m: fat * (1 - g), fat_f: fat * g, muscle_gen: mus * (1 - 0.5 * g),
    shoulders: nrm(s.shoulders), waist: nrm(s.waist), hips: nrm(s.hips),
    chest_m: nrm(s.chest) * (1 - g), chest_f: nrm(s.chest) * g,
    arms: nrm(s.arms), legs: nrm(s.legs), armLen: nrm(s.armLen), legLen: nrm(s.legLen),
    bone: 1 - 0.85 * fat,
    face_w: nrm(s.faceW), jaw: nrm(s.jaw), nose: nrm(s.nose), lips: nrm(s.lips), eyes: nrm(s.eyes),
  }
  const lvl: Record<string, number> = {}
  for (const z of ZONE_LIST) lvl[z] = clamp(mus + (s[ZONE_FIELD[z]] - 50) / 100, 0, 1)
  lvl.hams = (lvl.quads + lvl.glutes) / 2
  const definition = clamp(1 - fat * 1.3, 0, 1)
  for (const z of [...ZONE_LIST, 'hams']) {
    const ff = 1 + (ZONE_FF[z] - 1) * g
    out['mass_' + z] = lvl[z] * ff * (1 - 0.3 * fat)
    out['detail_' + z] = (0.3 + 0.7 * lvl[z]) * definition * ff
  }
  return out
}

interface Item {
  part: PartData
  mesh: THREE.Mesh
  geo: THREE.BufferGeometry
  pos: Float32Array
  colors?: Float32Array
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

  constructor(private data: BakedBody, private mats: BodyMaterials) {
    const matMap: Record<string, THREE.Material> = {
      Skin: mats.skin, Hair: mats.hair, Dark: mats.dark, White: mats.white, Lip: mats.lip, Eye: mats.eye,
      Cloth: mats.cloth, Shoe: mats.shoe, Sole: mats.sole,
    }
    for (const part of data.parts) {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(part.nv * 3)
      if (part.base) pos.set(part.base)
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage))
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.nv * 3), 3).setUsage(THREE.DynamicDrawUsage))
      geo.setIndex(new THREE.BufferAttribute(part.index, 1))
      const item: Item = { part, geo, pos, mesh: null as unknown as THREE.Mesh, lastSig: '' }
      if (part.mat === 'Skin' || part.mat === 'Cloth') {
        item.colors = new Float32Array(part.nv * 3).fill(1)
        geo.setAttribute('color', new THREE.BufferAttribute(item.colors, 3).setUsage(THREE.DynamicDrawUsage))
      }
      if (part.mat === 'Skin') this.buildAdjacency(item)
      item.mesh = new THREE.Mesh(geo, matMap[part.mat])
      item.mesh.frustumCulled = false
      this.group.add(item.mesh)
      this.items.set(part.name, item)
    }
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
    item.aoK = (part.name === 'Skin' ? 1 : part.name === 'Head' ? 0.45 : 0.35) * 0.0056 / (L * L)
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
    const names = zone === 'quads' ? ['mass_quads', 'mass_hams'] : [`mass_${zone}`]
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

    // 1) visibilidad según el estilo elegido (peinado, ropa, calzado)
    for (const item of this.items.values()) {
      const vis = item.part.vis
      if (!vis) { item.mesh.visible = true; continue }
      const [k, v] = vis.split(':')
      item.mesh.visible = (st as unknown as Record<string, string>)[k] === v
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
      if (item.ao) { this.computeAO(item); if (part.name === 'Skin') skinChanged = true }
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
          const a = ao[v]
          c[v * 3] = a * (1 - t + 0.30 * t); c[v * 3 + 1] = a * (1 - t + 0.95 * t); c[v * 3 + 2] = a * (1 - t + 1.55 * t)
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
        const main = this.color(slot === 'top' ? st.topColor : st.bottomColor), acc = this.color(st.accentColor)
        const src = part.src!, w = part.w!, inf = part.infl!
        const cc = part.accent ? acc : main
        for (let i = 0; i < part.nv; i++) {
          const a = src[i * 2] * 3, b = src[i * 2 + 1] * 3, t = w[i], u = 1 - t, d = i * 3
          let nx = u * sn[a] + t * sn[b], ny = u * sn[a + 1] + t * sn[b + 1], nz = u * sn[a + 2] + t * sn[b + 2]
          const nl = 1 / (Math.hypot(nx, ny, nz) || 1); nx *= nl; ny *= nl; nz *= nl
          nor[d] = nx; nor[d + 1] = ny; nor[d + 2] = nz
          const o = inf[i]
          pos[d] = u * sp[a] + t * sp[b] + nx * o
          pos[d + 1] = u * sp[a + 1] + t * sp[b + 1] + ny * o
          pos[d + 2] = u * sp[a + 2] + t * sp[b + 2] + nz * o
          const shade = 0.9 + 0.1 * (u * sao[a / 3] + t * sao[b / 3])
          col[d] = cc.r * shade; col[d + 1] = cc.g * shade; col[d + 2] = cc.b * shade
        }
        geo.attributes.position.needsUpdate = true
        geo.attributes.normal.needsUpdate = true
        geo.attributes.color.needsUpdate = true
      }
    }

    // 5) escala por altura (el piso queda en y = 0)
    const dY = 0.12 * infl.legLen * this.data.legLen
    this.group.scale.setScalar((s.heightCm / 100) / (this.data.topY + dY))
  }

  dispose() {
    for (const item of this.items.values()) item.geo.dispose()
    this.items.clear()
  }
}
