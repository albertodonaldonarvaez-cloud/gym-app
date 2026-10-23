import * as THREE from 'three'

// Shaders procedurales (sin texturas): se calculan con la posición del vértice en el espacio del objeto.
// Cada material recibe un detalle fino de relieve (bump) y, en la piel, un brillo subdérmico en los bordes.

const NOISE = /* glsl */ `
varying vec3 vObj;
float gHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float gNoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(gHash(i), gHash(i + vec3(1,0,0)), f.x), mix(gHash(i + vec3(0,1,0)), gHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(gHash(i + vec3(0,0,1)), gHash(i + vec3(1,0,1)), f.x), mix(gHash(i + vec3(0,1,1)), gHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float gFbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 3; i++){ s += a * gNoise(p); p *= 2.03; a *= 0.5; } return s; }
vec3 gBump(vec3 N, vec3 pos, float h, float k){
  vec3 dpdx = dFdx(pos), dpdy = dFdy(pos);
  float dhx = dFdx(h), dhy = dFdy(h);
  vec3 r1 = cross(dpdy, N), r2 = cross(N, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
  return normalize(abs(det) * N - grad * k);
}
`

type Kind = 'skin' | 'cloth' | 'hair' | 'shoe'

const HEIGHT: Record<Kind, string> = {
  // poros y micro-relieve de la piel
  skin: 'float h = gFbm(vObj * 420.0) * 0.8 + gNoise(vObj * 1500.0) * 0.35;',
  // trama del tejido + arrugas suaves en dirección vertical
  cloth: `float weave = sin(vObj.x * 1100.0) * sin(vObj.y * 1100.0) * 0.35 + sin(vObj.z * 1100.0) * sin(vObj.y * 1100.0) * 0.2;
          float fold = gFbm(vec3(vObj.x * 12.0, vObj.y * 30.0, vObj.z * 12.0)) * 3.0;
          float h = weave * 0.45 + fold;`,
  // hebras: franjas alrededor de la cabeza con variación
  hair: `float ang = atan(vObj.x, vObj.z + 0.04);
         float strand = sin(ang * 85.0 + gFbm(vObj * 22.0) * 7.0) * 0.5 + 0.5;
         float h = strand * 1.2 + gNoise(vObj * 700.0) * 0.3;`,
  shoe: 'float h = gFbm(vObj * 600.0) * 0.5;',
}
// Intensidad del relieve (independiente del zoom): ~ 0.15 rad / pendiente del patrón
const STRENGTH: Record<Kind, string> = { skin: '0.00022', cloth: '0.00022', hair: '0.00022', shoe: '0.0003' }

export function enhanceMaterial(mat: THREE.Material, kind: Kind) {
  mat.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObj;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObj = position;')
    let frag = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE}`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { ${HEIGHT[kind]}
    normal = gBump(normal, -vViewPosition, h, ${STRENGTH[kind]}); }`)
    if (kind === 'skin') {
      // Brillo subdérmico: los bordes iluminados dejan pasar un tono cálido (dispersión de la luz en la piel)
      frag = frag.replace('#include <opaque_fragment>', `
  { float fr = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 2.2);
    outgoingLight += vec3(0.55, 0.16, 0.09) * fr * 0.30 * diffuseColor.rgb; }
  #include <opaque_fragment>`)
    }
    if (kind === 'hair') {
      frag = frag.replace('#include <color_fragment>', `#include <color_fragment>
  { float ang2 = atan(vObj.x, vObj.z + 0.04);
    float s2 = sin(ang2 * 85.0 + gFbm(vObj * 22.0) * 7.0) * 0.5 + 0.5;
    diffuseColor.rgb *= 0.74 + 0.5 * s2 + 0.18 * gNoise(vObj * 90.0); }`)
    }
    shader.fragmentShader = frag
  }
  mat.customProgramCacheKey = () => `gym-${kind}`
  mat.needsUpdate = true
}
