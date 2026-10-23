"""Exporta el cuerpo a un binario compacto 'GYMBODY2' para la web.
Formato: MAGIC(8) | uint32 jsonLen | json | blob.  Offsets del json relativos al inicio del blob (alineados a 4)."""
import bpy, numpy as np, json, struct, sys, importlib, os
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
import morphs
importlib.reload(B); importlib.reload(morphs)

DELTA_SCALE = 1e-4          # metros por unidad int16 (precision 0.1 mm)
MIN_DELTA = 3e-4            # descarta cambios menores a 0.3 mm
HAIRS = ['short', 'buzz', 'long', 'ponytail', 'bun', 'curly']
PART_MAT = dict(Skin='Skin', Head='Skin', Hands='Skin', EyeWhite='White', Iris='Eye', Pupil='Dark', Brows='Hair', Lips='Lip',
                ShoeUpper='Shoe', ShoeSole='Sole')
PART_MAT.update({'Hair_' + h: 'Hair' for h in HAIRS})
PART_VIS = {'ShoeUpper': 'shoes:sneakers', 'ShoeSole': 'shoes:sneakers'}
PART_VIS.update({'Hair_' + h: 'hair:' + h for h in HAIRS})
STATIC = {'ShoeUpper', 'ShoeSole'}
PART_ORDER = ['Skin', 'Head', 'Hands', 'EyeWhite', 'Iris', 'Pupil', 'Brows', 'Lips'] + ['Hair_' + h for h in HAIRS] + ['ShoeUpper', 'ShoeSole']


class Blob:
    def __init__(self): self.chunks = []; self.n = 0
    def add(self, arr):
        a = np.ascontiguousarray(arr); raw = a.tobytes()
        pad = (-len(raw)) % 4; off = self.n
        self.chunks.append(raw + b'\0' * pad); self.n += len(raw) + pad
        return off
    def bytes(self): return b''.join(self.chunks)


def tris_of(ob):
    me = ob.data; me.calc_loop_triangles()
    t = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('vertices', t)
    return t.reshape(-1, 3)


# ---------------------------------------------------------------- prendas derivadas de la piel
def clip_garment(P, tri, vmask, ylo, yhi):
    """Recorta la piel entre dos planos y devuelve vertices como interpolacion de 2 vertices de piel (bordes rectos)."""
    tri = tri[vmask[tri].all(1)]
    y = P[:, 1]
    ty = y[tri]
    inside = (ty.min(1) >= ylo) & (ty.max(1) <= yhi)
    cross = ((ty.max(1) > ylo) & (ty.min(1) < ylo)) | ((ty.max(1) > yhi) & (ty.min(1) < yhi))
    cross &= ~inside
    # filtro: para que tengan algo dentro
    polys = [[(int(a), int(a), 0.0) for a in t] for t in tri[inside]]

    def yval(d): i, j, t = d; return (1 - t) * y[i] + t * y[j]
    def clip(poly, plane, keep_above):
        out = []
        n = len(poly)
        for k in range(n):
            a, b = poly[k], poly[(k + 1) % n]
            ya, yb = yval(a) - plane, yval(b) - plane
            if not keep_above: ya, yb = -ya, -yb
            ina, inb = ya >= 0, yb >= 0
            if ina: out.append(a)
            if ina != inb:
                u = ya / (ya - yb)
                # interpolar descriptor a -> b (ambos pueden ser vertices originales o de borde)
                out.append(('mix', a, b, u))
        return out
    def resolve(poly):
        """Convierte descriptores 'mix' en (i,j,t) cuando a y b comparten una arista original."""
        res = []
        for d in poly:
            if d[0] == 'mix':
                _, a, b, u = d
                # a y b son de la forma (i,j,t); el punto cortado esta sobre la arista original entre sus vertices base
                ai, aj, at = a; bi, bj, bt = b
                if at == 0.0 and bt == 0.0:
                    res.append((ai, bi, u))
                else:
                    # arista ya recortada: re-expresar sobre la arista original base
                    base = {ai, aj, bi, bj}
                    i, j = sorted(base)[0], sorted(base)[-1]
                    va = (1 - at) * y[ai] + at * y[aj]; vb = (1 - bt) * y[bi] + bt * y[bj]
                    yy = (1 - u) * va + u * vb
                    t2 = (yy - y[i]) / (y[j] - y[i]) if y[j] != y[i] else 0.0
                    res.append((i, j, float(np.clip(t2, 0, 1))))
            else: res.append(d)
        return res
    for t in tri[cross]:
        poly = [(int(a), int(a), 0.0) for a in t]
        for plane, above in ((ylo, True), (yhi, False)):
            if len(poly) < 3: break
            poly = resolve(clip(poly, plane, above))
        if len(poly) >= 3: polys.append(poly)
    # tabla de vertices unica
    table, keys, faces = [], {}, []
    def vid(d):
        i, j, t = d
        if t == 0.0 or i == j: key = (i,); desc = (i, i, 0.0)
        elif t == 1.0: key = (j,); desc = (j, j, 0.0)
        else:
            if i > j: i, j, t = j, i, 1 - t
            key = (i, j, round(t, 4)); desc = (i, j, t)
        if key not in keys: keys[key] = len(table); table.append(desc)
        return keys[key]
    for poly in polys:
        ids = [vid(d) for d in poly]
        for k in range(1, len(ids) - 1): faces.append((ids[0], ids[k], ids[k + 1]))
    tb = np.array(table)
    src = tb[:, :2].astype(np.uint16); w = tb[:, 2].astype(np.float32)
    return src, w, np.array(faces, dtype=np.int64)


def angdiff(a, b): return np.abs(((a - b) % 360 + 540) % 360 - 180)


def garments(Ps):
    """Cada prenda se divide en franjas (color principal / acento) con bordes rectos."""
    P0 = B.P()
    rx = lambda y: B.torso_at(P0, np.clip(y, B.TORSO_Y0, B.TORSO_Y1))[0]
    torso_mask = lambda P: (np.abs(P[:, 0]) <= rx(P[:, 1]) + 0.004) | (P[:, 1] < 0.86)
    legs_mask = lambda P: (np.abs(P[:, 0]) <= 0.19) & (P[:, 1] <= 1.02)
    def tank_mask(P):
        x, y = np.abs(P[:, 0]), P[:, 1]
        return ((x <= rx(y) + 0.004) & (y <= 1.31)) | ((y > 1.31) & (x >= 0.058) & (x <= 0.118) & (y <= 1.43))
    flat = lambda v: (lambda P: np.full(len(P), v))
    return [
        dict(name='G_bra', slot='top', opt='bra', mask=torso_mask, infl=flat(0.0055),
             segs=[(1.185, 1.205, True), (1.205, 1.295, False), (1.295, 1.315, True)]),
        dict(name='G_tank', slot='top', opt='tank', mask=tank_mask, infl=flat(0.0055),
             segs=[(0.985, 1.012, True), (1.012, 1.43, False)]),
        dict(name='G_shorts', slot='bottom', opt='shorts', mask=legs_mask,
             infl=lambda P: 0.006 + np.clip(0.82 - P[:, 1], 0, None) * 0.10,
             segs=[(0.640, 0.668, True), (0.668, 0.972, False), (0.972, 1.010, True)]),
        dict(name='G_leggings', slot='bottom', opt='leggings', mask=legs_mask, infl=flat(0.0035),
             segs=[(0.075, 0.100, True), (0.100, 0.968, False), (0.968, 1.010, True)]),
        dict(name='G_boxer', slot='bottom', opt='boxer', mask=legs_mask, infl=flat(0.006),
             segs=[(0.720, 0.975, False), (0.975, 1.010, True)]),
    ]


def export_body(path):
    blob = Blob(); parts = []; skin = None
    for name in PART_ORDER:
        ob = bpy.data.objects[name]
        co, Pv, Nv = morphs.mesh_arrays(ob)
        tri = tris_of(ob)
        assert len(Pv) < 65536, name
        entry = dict(name=name, mat=PART_MAT[name], nv=int(len(Pv)), nt=int(len(tri)), vis=PART_VIS.get(name, ''),
                     pos=blob.add(Pv.astype(np.float32)), idx=blob.add(tri.astype(np.uint16).ravel()), keys=[])
        total = 0
        if name not in STATIC:
            K = morphs.compute_keys(Pv, Nv, is_head_part=morphs.is_head(name))
            for kname, d in K.items():
                mask = np.abs(d).max(1) > MIN_DELTA
                cnt = int(mask.sum())
                if cnt == 0: continue
                ids = np.nonzero(mask)[0].astype(np.uint16)
                q = np.clip(np.round(d[mask] / DELTA_SCALE), -32767, 32767).astype(np.int16)
                entry['keys'].append(dict(n=kname, c=cnt, io=blob.add(ids), vo=blob.add(q.ravel())))
                total += cnt
        entry['entries'] = total
        parts.append(entry)
        if name == 'Skin': skin = (Pv, tri)
    Pv, tri = skin
    for g in garments(Pv):
        vm = g['mask'](Pv)
        for si, (ylo, yhi, accent) in enumerate(g['segs']):
            src, w, faces = clip_garment(Pv, tri, vm, ylo, yhi)
            if len(faces) == 0: continue
            Pd = (1 - w[:, None]) * Pv[src[:, 0]] + w[:, None] * Pv[src[:, 1]]
            infl = g['infl'](Pd).astype(np.float32)
            parts.append(dict(name=f"{g['name']}_{si}", mat='Cloth', derived='Skin', vis=f"{g['slot']}:{g['opt']}", accent=int(accent),
                              nv=int(len(src)), nt=int(len(faces)), src=blob.add(src.ravel()), w=blob.add(w), infl=blob.add(infl),
                              idx=blob.add(faces.astype(np.uint16).ravel())))
    head = dict(version=2, deltaScale=DELTA_SCALE, parts=parts, topY=B.TOP_Y, legLen=B.LEG_LEN)
    hj = json.dumps(head, separators=(',', ':')).encode()
    pad = (-(8 + 4 + len(hj))) % 4
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'GYMBODY2'); f.write(struct.pack('<I', len(hj) + pad)); f.write(hj + b' ' * pad); f.write(blob.bytes())
    return os.path.getsize(path), {p['name']: p.get('entries', p['nv']) for p in parts}
