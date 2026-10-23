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
def clip_poly(poly, corner_vals, val, above):
    """poly: pesos (w0,w1,w2) respecto a las esquinas del triangulo original; recorta contra un plano."""
    cv = lambda w: w[0] * corner_vals[0] + w[1] * corner_vals[1] + w[2] * corner_vals[2] - val
    out = []; n = len(poly)
    for k in range(n):
        a, b = poly[k], poly[(k + 1) % n]
        ca, cb = cv(a), cv(b)
        if not above: ca, cb = -ca, -cb
        ina, inb = ca >= 0, cb >= 0
        if ina: out.append(a)
        if ina != inb:
            u = ca / (ca - cb)
            out.append(tuple(a[i] + u * (b[i] - a[i]) for i in range(3)))
    return out


def clip_regions(P, tri, vmask, planes):
    """Recorta la piel con varios planos (axis, valor, conservar_arriba). Cada vertice nuevo es una mezcla de hasta 3 vertices de piel."""
    tri = tri[vmask[tri].all(1)]
    cur = np.arange(len(tri)); polys = []
    for nrm, val, above in planes:
        nrm = np.asarray(nrm, float)
        proj = P @ nrm
        newp = []
        for ti, poly in polys:
            q = clip_poly(poly, proj[tri[ti]], val, above)
            if len(q) >= 3: newp.append((ti, q))
        if len(cur):
            c = proj[tri[cur]] - val
            if not above: c = -c
            inside = (c >= 0).all(1); outside = (c < 0).all(1)
            for ti in cur[~inside & ~outside]:
                q = clip_poly([(1, 0, 0), (0, 1, 0), (0, 0, 1)], proj[tri[ti]], val, above)
                if len(q) >= 3: newp.append((ti, q))
            cur = cur[inside]
        polys = newp
    table, keys, faces = [], {}, []
    def vid(ti, w):
        pairs = tuple(sorted((int(tri[ti][k]), round(float(w[k]), 4)) for k in range(3) if w[k] > 1e-4))
        if pairs not in keys: keys[pairs] = len(table); table.append(pairs)
        return keys[pairs]
    for ti in cur: faces.append(tuple(vid(ti, w) for w in ((1, 0, 0), (0, 1, 0), (0, 0, 1))))
    for ti, poly in polys:
        ids = [vid(ti, w) for w in poly]
        for k in range(1, len(ids) - 1): faces.append((ids[0], ids[k], ids[k + 1]))
    nv = len(table)
    src = np.zeros((nv, 3), np.uint16); w = np.zeros((nv, 3), np.float32)
    for i, pairs in enumerate(table):
        vs = [p_[0] for p_ in pairs]; ws = [p_[1] for p_ in pairs]; tot = sum(ws); ws = [x / tot for x in ws]
        while len(vs) < 3: vs.append(vs[0]); ws.append(0.0)
        src[i] = vs[:3]; w[i] = ws[:3]
    return src, w, np.array(faces, np.int64).reshape(-1, 3)


def merge_regions(items):
    srcs, ws, fs, off = [], [], [], 0
    for src, w, f in items:
        if len(f) == 0: continue
        srcs.append(src); ws.append(w); fs.append(f + off); off += len(src)
    if not srcs: return np.zeros((0, 3), np.uint16), np.zeros((0, 3), np.float32), np.zeros((0, 3), np.int64)
    return np.concatenate(srcs), np.concatenate(ws), np.concatenate(fs)


def Yp(lo, hi): return [((0, 1, 0), lo, True), ((0, 1, 0), hi, False)]
def Xr(lo, hi): return [((1, 0, 0), lo, True), ((1, 0, 0), hi, False)]

# Panel lateral de los leggings: plano inclinado que sigue el contorno externo de la pierna (~2.6 cm de ancho)
STRIPE_N, STRIPE_OFF = 0.0314, 0.1268
RIGHT_PANEL = [((1, -STRIPE_N, 0), STRIPE_OFF, True)]
LEFT_PANEL = [((-1, -STRIPE_N, 0), STRIPE_OFF, True)]
RIGHT_INNER = [((1, -STRIPE_N, 0), STRIPE_OFF, False)]
LEFT_INNER = [((-1, -STRIPE_N, 0), STRIPE_OFF, False)]


def garments(Ps):
    """Cada prenda son piezas (principal / acento) con bordes rectos recortados por planos."""
    flat = lambda v: (lambda P: np.full(len(P), v))
    S = lambda regions, mask, accent=False: dict(regions=regions, mask=mask, accent=accent)
    return [
        dict(name='G_bra', slot='top', opt='bra', infl=flat(0.0055), pieces=[
            S([Yp(1.185, 1.205)], 'torso', True), S([Yp(1.205, 1.295)], 'torso'), S([Yp(1.295, 1.315)], 'torso', True),
            S([Yp(1.314, 1.43) + Xr(0.060, 0.090), Yp(1.314, 1.43) + Xr(-0.090, -0.060)], 'torso')]),
        dict(name='G_tank', slot='top', opt='tank', infl=flat(0.0055), pieces=[
            S([Yp(0.985, 1.012)], 'torso', True), S([Yp(1.012, 1.30)], 'torso'),
            S([Yp(1.299, 1.43) + Xr(0.058, 0.098), Yp(1.299, 1.43) + Xr(-0.098, -0.058)], 'torso')]),
        dict(name='G_shorts', slot='bottom', opt='shorts', infl=lambda P: 0.006 + np.clip(0.82 - P[:, 1], 0, None) * 0.10, pieces=[
            S([Yp(0.640, 0.668)], 'legs', True), S([Yp(0.668, 0.972)], 'legs'), S([Yp(0.972, 1.010)], 'legs', True)]),
        dict(name='G_leggings', slot='bottom', opt='leggings', infl=flat(0.0035), pieces=[
            S([Yp(0.075, 0.100)], 'legs', True), S([Yp(0.968, 1.010)], 'legs', True),
            S([Yp(0.100, 0.968) + RIGHT_INNER + LEFT_INNER], 'legs'),
            S([Yp(0.90, 0.968) + RIGHT_PANEL, Yp(0.90, 0.968) + LEFT_PANEL], 'legs'),
            S([Yp(0.100, 0.90) + RIGHT_PANEL, Yp(0.100, 0.90) + LEFT_PANEL], 'legs', True)]),
        dict(name='G_boxer', slot='bottom', opt='boxer', infl=flat(0.006), pieces=[
            S([Yp(0.720, 0.975)], 'legs'), S([Yp(0.975, 1.010)], 'legs', True)]),
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
    P0 = B.P()
    rx = lambda y: B.torso_at(P0, np.clip(y, B.TORSO_Y0, B.TORSO_Y1))[0]
    masks = {'torso': (np.abs(Pv[:, 0]) <= rx(Pv[:, 1]) + 0.004) | (Pv[:, 1] < 0.86),
             'legs': (np.abs(Pv[:, 0]) <= 0.19) & (Pv[:, 1] <= 1.02)}
    for g in garments(Pv):
        for si, pc in enumerate(g['pieces']):
            src, w, faces = merge_regions([clip_regions(Pv, tri, masks[pc['mask']], planes) for planes in pc['regions']])
            if len(faces) == 0: continue
            Pd = sum(w[:, k:k + 1] * Pv[src[:, k]] for k in range(3))
            infl = g['infl'](Pd).astype(np.float32)
            parts.append(dict(name=f"{g['name']}_{si}", mat='Cloth', derived='Skin', vis=f"{g['slot']}:{g['opt']}", accent=int(pc['accent']),
                              nv=int(len(src)), nt=int(len(faces)), src=blob.add(src.ravel()), w=blob.add(w.ravel()), infl=blob.add(infl),
                              idx=blob.add(faces.astype(np.uint16).ravel())))
    head = dict(version=2, deltaScale=DELTA_SCALE, parts=parts, topY=B.TOP_Y, legLen=B.LEG_LEN, headY=float(morphs.HEAD_C[1]))
    hj = json.dumps(head, separators=(',', ':')).encode()
    pad = (-(8 + 4 + len(hj))) % 4
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'GYMBODY2'); f.write(struct.pack('<I', len(hj) + pad)); f.write(hj + b' ' * pad); f.write(blob.bytes())
    return os.path.getsize(path), {p['name']: p.get('entries', p['nv']) for p in parts}
