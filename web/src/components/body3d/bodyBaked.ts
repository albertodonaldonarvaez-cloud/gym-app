import * as THREE from 'three'
import type { BodyMaterials, RenderState, ZoneKey } from './bodyModel'

// Cuerpo modelado en Blender ("GYMBODY1"): malla base + morph targets esparcidos (int16).
// En cada cambio de slider se mezclan los targets activos en CPU y se recalculan normales:
// es mucho más ligero que reconstruir la malla y conserva el modelado de Blender.

export const BAKED_URL = '/models/gymbody.bin?v=1'

interface KeyData { n: string; c: number; idx: Uint16Array; val: Int16Array }
interface PartData {
  name: string; mat: string; nv: number; nt: number
  base?: Float32Array; index: Uint16Array; keys: KeyData[]
  derived?: string; src?: Uint16Array; inflate?: number; show?: string
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
  if (magic !== 'GYMBODY1') throw new Error('formato inválido')
  const jsonLen = new DataView(buf).getUint32(8, true)
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 12, jsonLen)))
  const blob = 12 + jsonLen
  const parts: PartData[] = head.parts.map((p: any) => {
    const part: PartData = {
      name: p.name, mat: p.mat, nv: p.nv, nt: p.nt,
      index: new Uint16Array(buf, blob + p.idx, p.nt * 3), keys: [],
    }
    if (p.derived) {
      part.derived = p.derived; part.inflate = p.inflate; part.show = p.show
      part.src = new Uint16Array(buf, blob + p.src, p.nv)
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
}

export class BakedInstance {
  readonly group = new THREE.Group()
  private items = new Map<string, Item>()
  private lastHl = ''

  constructor(private data: BakedBody, mats: BodyMaterials) {
    const matMap: Record<string, THREE.Material> = {
      Skin: mats.skin, Shorts: mats.shorts, Top: mats.top, Hair: mats.hair, Dark: mats.dark, White: mats.white, Lip: mats.lip,
    }
    for (const part of data.parts) {
      const geo = new THREE.BufferGeometry()
      const pos = new Float32Array(part.nv * 3)
      if (part.base) pos.set(part.base)
      const posAttr = new THREE.BufferAttribute(pos, 3); posAttr.setUsage(THREE.DynamicDrawUsage)
      geo.setAttribute('position', posAttr)
      geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(part.nv * 3), 3).setUsage(THREE.DynamicDrawUsage))
      geo.setIndex(new THREE.BufferAttribute(part.index, 1))
      const item: Item = { part, geo, pos, mesh: null as unknown as THREE.Mesh }
      if (part.mat === 'Skin') {
        item.colors = new Float32Array(part.nv * 3).fill(1)
        geo.setAttribute('color', new THREE.BufferAttribute(item.colors, 3).setUsage(THREE.DynamicDrawUsage))
      }
      item.mesh = new THREE.Mesh(geo, matMap[part.mat])
      item.mesh.frustumCulled = false
      this.group.add(item.mesh)
      this.items.set(part.name, item)
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
    // 1) piezas con morph targets
    for (const item of this.items.values()) {
      const { part, pos, geo } = item
      if (part.derived) continue
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
    }
    // 2) ropa derivada de la piel (sigue el cuerpo, 6 mm hacia afuera)
    const skin = this.items.get('Skin')
    if (skin) {
      const sp = skin.pos, sn = skin.geo.attributes.normal.array as Float32Array
      for (const item of this.items.values()) {
        const { part, pos, geo } = item
        if (!part.derived) continue
        const nor = geo.attributes.normal.array as Float32Array
        const inf = part.inflate ?? 0.006
        for (let i = 0; i < part.nv; i++) {
          const s3 = part.src![i] * 3, d = i * 3
          nor[d] = sn[s3]; nor[d + 1] = sn[s3 + 1]; nor[d + 2] = sn[s3 + 2]
          pos[d] = sp[s3] + sn[s3] * inf; pos[d + 1] = sp[s3 + 1] + sn[s3 + 1] * inf; pos[d + 2] = sp[s3 + 2] + sn[s3 + 2] * inf
        }
        geo.attributes.position.needsUpdate = true
        geo.attributes.normal.needsUpdate = true
      }
    }
    // 3) visibilidad según género
    const female = s.g >= 0.5
    for (const item of this.items.values()) {
      const n = item.part.name
      if (n === 'HairM') item.mesh.visible = !female
      else if (n === 'HairF') item.mesh.visible = female
      else if (item.part.show === 'female') item.mesh.visible = female
    }
    // 4) resalte de la zona muscular activa
    const hlKey = s.hl > 0.02 ? s.hlKey : ''
    const sig = hlKey ? `${hlKey}:${s.hl.toFixed(2)}` : ''
    if (sig !== this.lastHl) {
      this.lastHl = sig
      for (const item of this.items.values()) {
        if (!item.colors) continue
        const mask = hlKey && item.part.name === 'Skin' ? this.maskFor(item, hlKey as ZoneKey) : null
        const c = item.colors
        if (!mask) { c.fill(1) } else {
          for (let v = 0; v < mask.length; v++) {
            const t = mask[v] * s.hl * 0.55
            c[v * 3] = 1 - t + 0.30 * t; c[v * 3 + 1] = 1 - t + 0.95 * t; c[v * 3 + 2] = 1 - t + 1.55 * t
          }
        }
        item.geo.attributes.color.needsUpdate = true
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
