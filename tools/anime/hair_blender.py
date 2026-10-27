"""Genera mechones de cabello estilo anime en Blender (modo headless) -> OBJ en espacio 'esfera unitaria' de la cabeza.
x = lateral, y = arriba, z = frente.  La esfera unitaria se ajusta despues a la cabeza real en export_mh.py.
Uso:  blender --background --factory-startup --python tools/anime/hair_blender.py
"""
import bpy, bmesh, math, os, random
from mathutils import Vector

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)))
STEPS = 14


def lock(root_dir, length, width, d0, bend=0.0, side_bend=0.0, thick=0.10, tip_curl=0.0, taper_pow=0.85, root_in=0.965):
    """Un mechon: cinta aplanada que nace en la esfera y termina en punta. Devuelve (verts, quads)."""
    root = Vector(root_dir).normalized() * root_in
    d = Vector(d0).normalized()
    pts = [root.copy()]
    ds = length / STEPS
    for i in range(1, STEPS + 1):
        t = i / STEPS
        dd = d + Vector((side_bend * t, -bend * t * t, 0.0)) + Vector((0, 0, 0))
        dd += Vector((0, tip_curl * (t ** 3), 0))
        dd.normalize()
        pts.append(pts[-1] + dd * ds)
    verts, faces = [], []
    rows = []
    for i, c in enumerate(pts):
        t = i / STEPS
        T = (pts[min(i + 1, STEPS)] - pts[max(i - 1, 0)]).normalized()
        n = c.normalized() if c.length > 1e-6 else Vector((0, 1, 0))
        S = T.cross(n)
        if S.length < 1e-5: S = Vector((1, 0, 0))
        S.normalize()
        # perfil: ancho maximo ~35% del largo y punta fina
        w = width * (math.sin(math.pi * min(1.0, 0.12 + 0.88 * (1 - t)) ) ** taper_pow if False else 1.0)
        prof = (1 - t) ** taper_pow * (0.55 + 0.45 * math.sin(min(t * 3.0, math.pi / 2)))
        w = width * prof
        base = len(verts)
        verts += [tuple(c - S * w), tuple(c + n * (thick * width * 1.2 * (1 - t * 0.6))), tuple(c + S * w)]
        rows.append(base)
    for r0, r1 in zip(rows[:-1], rows[1:]):
        faces.append((r0, r0 + 1, r1 + 1, r1))
        faces.append((r0 + 1, r0 + 2, r1 + 2, r1 + 1))
    return verts, faces


def build(locks):
    me = bpy.data.meshes.new('hair'); ob = bpy.data.objects.new('hair', me)
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new()
    for verts, faces in locks:
        vs = [bm.verts.new(v) for v in verts]
        for f in faces:
            try: bm.faces.new([vs[i] for i in f])
            except ValueError: pass
    bm.normal_update(); bm.to_mesh(me); bm.free()
    sub = ob.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg)
    m2 = ev.to_mesh()
    V = [tuple(v.co) for v in m2.vertices]
    F = [tuple(p.vertices) for p in m2.polygons]
    ev.to_mesh_clear(); bpy.data.objects.remove(ob); bpy.data.meshes.remove(me)
    return V, F


def write_obj(name, V, F):
    with open(os.path.join(OUT, f'hair_{name}.obj'), 'w') as f:
        for v in V: f.write(f'v {v[0]:.5f} {v[1]:.5f} {v[2]:.5f}\n')
        for p in F: f.write('f ' + ' '.join(str(i + 1) for i in p) + '\n')
    print(name, len(V), 'verts', len(F), 'faces')


def sph(theta_deg, phi_deg):
    """theta: angulo desde +y (0 = coronilla); phi: azimut desde +z (frente) hacia +x."""
    t, p = math.radians(theta_deg), math.radians(phi_deg)
    return (math.sin(t) * math.sin(p), math.cos(t), math.sin(t) * math.cos(p))


def tdown(theta_deg, phi_deg, out=0.25, side=0.0):
    """Direccion tangente a la esfera hacia abajo (sigue la curvatura del craneo) + un poco hacia afuera."""
    t, p = math.radians(theta_deg), math.radians(phi_deg)
    tan = Vector((math.cos(t) * math.sin(p), -math.sin(t), math.cos(t) * math.cos(p)))
    nrm = Vector(sph(theta_deg, phi_deg))
    sd = Vector((math.cos(p), 0, -math.sin(p)))
    return tuple(tan + nrm * out + sd * side)


def bangs(rng, n=8, length=0.60):
    out = []
    for i in range(n):
        u = i / (n - 1) * 2 - 1                      # -1..1 a lo ancho de la frente
        phi = u * 62
        root = sph(50 + 9 * abs(u), phi)
        ln = length * (0.78 + 0.22 * (1 - abs(u))) * rng.uniform(0.92, 1.08)
        # caen hacia adelante-abajo y se abren hacia los lados
        d0 = tdown(50 + 9 * abs(u), phi, out=0.30, side=u * 0.25)
        out.append(lock(root, ln, 0.31 * rng.uniform(0.9, 1.1), d0, bend=0.10, side_bend=u * 0.25, tip_curl=0.05))
    return out


def side_locks(rng, length=1.15):
    out = []
    for s in (-1, 1):
        for k, (th, ph) in enumerate(((66, 80), (74, 96))):
            root = sph(th, s * ph)
            out.append(lock(root, length * (1.0 - 0.2 * k), 0.24, tdown(th, s * ph, out=0.25), bend=0.05, side_bend=-s * 0.1, tip_curl=0.05))
    return out


def back_short(rng):
    out = []
    for i in range(14):
        phi = 180 + (i / 13 * 2 - 1) * 118
        th = 80 + rng.uniform(-5, 7)
        root = sph(th, phi)
        d0 = tdown(th, phi, out=0.35)
        out.append(lock(root, 0.70 * rng.uniform(0.85, 1.1), 0.30, d0, bend=0.35, tip_curl=0.3))
    return out


def back_long(rng):
    out = []
    for i in range(15):
        phi = 180 + (i / 14 * 2 - 1) * 122
        th = 84 + rng.uniform(-5, 6)
        root = sph(th, phi)
        d0 = tdown(th, phi, out=0.18)
        out.append(lock(root, 2.55 * rng.uniform(0.88, 1.08), 0.30, d0, bend=0.15, tip_curl=0.25))
    return out


def spikes(rng):
    out = []
    # coronilla: puas hacia arriba/atras, estilo shonen
    rings = [(18, 4, 0), (34, 7, 20), (50, 8, 10)]
    for th, n, off in rings:
        for i in range(n):
            phi = off + i * 360 / n + rng.uniform(-8, 8)
            root = sph(th, phi)
            d0 = (math.sin(math.radians(phi)) * 0.8, 1.0 + 0.2 * (th < 30), math.cos(math.radians(phi)) * 0.8 - 0.25)
            out.append(lock(root, rng.uniform(0.85, 1.25) * (1.0 if th < 45 else 0.8), 0.24, d0, bend=-0.25, tip_curl=0.0, thick=0.12))
    return out


def ponytail(rng):
    out = []
    root = sph(72, 180)
    for k, dx in enumerate((-0.12, 0.0, 0.12)):
        out.append(lock(root, 2.1 - 0.15 * abs(dx) * 4, 0.20, (dx, -0.55, -1.0), bend=0.8, tip_curl=0.35, root_in=0.96))
    return out


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    rng = random.Random(7)
    sets = {
        'short': bangs(rng) + side_locks(rng) + back_short(rng),
        'long': bangs(rng) + side_locks(rng) + back_long(rng),
        'curly': spikes(rng) + bangs(rng, 5, 0.65),
        'ponytail': bangs(rng) + side_locks(rng) + back_short(rng) + ponytail(rng),
        'bun': bangs(rng) + side_locks(rng) + back_short(rng),
    }
    for name, locks in sets.items():
        V, F = build(locks)
        write_obj(name, V, F)


main()
