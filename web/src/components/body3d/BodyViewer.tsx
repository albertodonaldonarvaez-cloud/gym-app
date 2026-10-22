import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { AlertTriangle } from 'lucide-react'
import {
  buildBody, createMaterials, disposeGroup, disposeMaterials, lerpInto, renderDistance, setSkinColor, toRender,
} from './bodyModel'
import type { BodyParams, RenderState, ZoneKey } from './bodyModel'
import { BakedInstance, loadBakedBody } from './bodyBaked'

interface Props {
  params: BodyParams
  /** Ángulo controlado desde fuera (para sincronizar varios visores). */
  yaw?: number
  onYawChange?: (yaw: number) => void
  /** Zona muscular a resaltar mientras se edita su slider. */
  highlight?: ZoneKey | ''
  className?: string
}

function makeShadowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')!
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  grad.addColorStop(0, 'rgba(15,35,70,0.38)')
  grad.addColorStop(1, 'rgba(15,35,70,0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(c)
}

export default function BodyViewer({ params, yaw, onYawChange, highlight = '', className = '' }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const targetRef = useRef<RenderState>(toRender(params))
  const yawTargetRef = useRef<number | undefined>(yaw)
  const onYawRef = useRef(onYawChange)
  const [unsupported, setUnsupported] = useState(false)

  // Mantener refs al día sin recrear la escena
  targetRef.current = toRender(params, highlight)
  yawTargetRef.current = yaw
  onYawRef.current = onYawChange

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' })
    } catch {
      setUnsupported(true)
      return
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab'
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50)
    camera.position.set(0, 0.98, 4.9)
    camera.lookAt(0, 0.92, 0)

    // Iluminación suave tipo estudio
    scene.add(new THREE.HemisphereLight('#ffffff', '#b8c8de', 1.15))
    const key = new THREE.DirectionalLight('#ffffff', 1.9)
    key.position.set(2.2, 3.2, 3.5)
    scene.add(key)
    const rim = new THREE.DirectionalLight('#9fd4ff', 0.9)
    rim.position.set(-3, 2, -3)
    scene.add(rim)

    // Plataforma + sombra suave
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.52, 0.025, 48),
      new THREE.MeshStandardMaterial({ color: '#e4edf8', roughness: 0.9 }),
    )
    platform.position.y = -0.0125
    scene.add(platform)
    const shadowTex = makeShadowTexture()
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.y = 0.002
    scene.add(shadow)

    const mats = createMaterials()
    const pivot = new THREE.Group()
    scene.add(pivot)

    const cur: RenderState = { ...targetRef.current, hl: 0, hlKey: '' }
    let bodyGroup: THREE.Group | null = null
    let inst: BakedInstance | null = null
    let procFallback = false
    let disposed = false
    let needsBuild = true
    let needsRender = true
    let yawNow = yawTargetRef.current ?? 0.35
    let dragging = false
    let lastX = 0
    let lastTick = performance.now()
    let raf = 0
    let userTouched = false
    const t0 = performance.now()

    // Modelo de Blender (morph targets). Si no está disponible, se usa el modelo procedural de respaldo.
    loadBakedBody()
      .then(data => { if (disposed) return; inst = new BakedInstance(data, mats); pivot.add(inst.group); needsBuild = true })
      .catch(() => { if (disposed) return; procFallback = true; needsBuild = true })

    const rebuild = () => {
      setSkinColor(mats, cur)
      if (inst) { inst.update(cur); return }
      if (!procFallback) return // esperando el modelo
      if (bodyGroup) { pivot.remove(bodyGroup); disposeGroup(bodyGroup) }
      bodyGroup = buildBody(cur, mats)
      pivot.add(bodyGroup)
    }

    const resize = () => {
      const w = mount.clientWidth || 300
      const h = mount.clientHeight || 400
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // En contenedores angostos alejamos la cámara para que no se recorte
      const baseDist = 4.9
      camera.position.z = camera.aspect < 0.72 ? baseDist * (0.72 / camera.aspect) ** 0.6 : baseDist
      camera.updateProjectionMatrix()
      needsRender = true
    }
    const ro = new ResizeObserver(resize)
    ro.observe(mount)
    resize()

    const el = renderer.domElement
    const down = (e: PointerEvent) => {
      dragging = true; userTouched = true; lastX = e.clientX
      el.setPointerCapture(e.pointerId); el.style.cursor = 'grabbing'
    }
    const move = (e: PointerEvent) => {
      if (!dragging) return
      yawNow += (e.clientX - lastX) * 0.012
      lastX = e.clientX
      onYawRef.current?.(yawNow)
      needsRender = true
    }
    const up = (e: PointerEvent) => {
      dragging = false; el.style.cursor = 'grab'
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    }
    el.addEventListener('pointerdown', down)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const dt = Math.min((now - lastTick) / 1000, 0.1)
      lastTick = now

      // Animar hacia los parámetros objetivo
      const target = targetRef.current
      if (renderDistance(cur, target) > 0.0008) {
        lerpInto(cur, target, 1 - Math.exp(-dt * 11))
        needsBuild = true
      } else if (renderDistance(cur, target) > 0) {
        Object.assign(cur, target)
        needsBuild = true
      }
      if (needsBuild) { rebuild(); needsBuild = false; needsRender = true }

      // Rotación: controlada desde fuera, o giro automático suave los primeros segundos
      const yt = yawTargetRef.current
      if (!dragging && yt !== undefined && Math.abs(yt - yawNow) > 0.0005) {
        yawNow += (yt - yawNow) * (1 - Math.exp(-dt * 9))
        needsRender = true
      } else if (!dragging && yt === undefined && !userTouched && now - t0 < 6000) {
        yawNow += dt * 0.6
        needsRender = true
      }
      pivot.rotation.y = yawNow

      if (needsRender) { renderer.render(scene, camera); needsRender = false }
    }
    raf = requestAnimationFrame(tick)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      if (inst) inst.dispose()
      ro.disconnect()
      el.removeEventListener('pointerdown', down)
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      if (bodyGroup) disposeGroup(bodyGroup)
      platform.geometry.dispose(); (platform.material as THREE.Material).dispose()
      shadow.geometry.dispose(); (shadow.material as THREE.Material).dispose(); shadowTex.dispose()
      disposeMaterials(mats)
      renderer.dispose()
      renderer.forceContextLoss()
      if (el.parentNode === mount) mount.removeChild(el)
    }
  }, [])

  if (unsupported) {
    return (
      <div className={`flex flex-col items-center justify-center gap-2 text-center p-6 bg-gray-50 ${className}`}>
        <AlertTriangle className="w-6 h-6 text-amber-500" />
        <p className="text-sm text-gray-500">Tu dispositivo no soporta gráficos 3D (WebGL).</p>
      </div>
    )
  }
  return <div ref={mountRef} className={className} />
}
