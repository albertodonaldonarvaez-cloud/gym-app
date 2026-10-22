"""Exporta el cuerpo a un binario compacto 'GYMBODY1' para la web.
Formato: MAGIC(8) | uint32 jsonLen | json | blob.  Offsets del json son relativos al inicio del blob (alineados a 4)."""
import bpy, numpy as np, json, struct, sys, importlib, os
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
import morphs
importlib.reload(B); importlib.reload(morphs)

DELTA_SCALE = 1e-4          # metros por unidad int16 (precision 0.1 mm)
MIN_DELTA = 3e-4            # descarta cambios menores a 0.3 mm
MAT = dict(Skin='Skin', Head='Skin', Hands='Skin', EyeWhite='White', Iris='Dark', Brows='Hair', Lips='Lip', HairM='Hair', HairF='Hair')
PART_ORDER = ['Skin', 'Head', 'Hands', 'EyeWhite', 'Iris', 'Brows', 'Lips', 'HairM', 'HairF']


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


def export_body(path, derived=True):
    blob = Blob(); parts = []; skin_data = {}
    for name in PART_ORDER:
        ob = bpy.data.objects[name]
        co, Pv, Nv = morphs.mesh_arrays(ob)
        K = morphs.compute_keys(Pv, Nv, is_head_part=name in morphs.HEAD_PARTS)
        tri = tris_of(ob)
        assert len(Pv) < 65536
        entry = dict(name=name, mat=MAT[name], nv=int(len(Pv)), nt=int(len(tri)),
                     pos=blob.add(Pv.astype(np.float32)), idx=blob.add(tri.astype(np.uint16).ravel()), keys=[])
        total = 0
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
        if name == 'Skin': skin_data = dict(P=Pv, tri=tri)
    P0 = B.P()
    if derived:
        Pv, tri = skin_data['P'], skin_data['tri']
        def make(name, mat, keep, inflate, show):
            ok = keep(Pv)
            fm = ok[tri].all(1); ft = tri[fm]
            used = np.unique(ft); remap = -np.ones(len(Pv), dtype=np.int64); remap[used] = np.arange(len(used))
            return dict(name=name, mat=mat, derived='Skin', nv=int(len(used)), nt=int(len(ft)), inflate=inflate, show=show,
                        src=blob.add(used.astype(np.uint16)), idx=blob.add(remap[ft].astype(np.uint16).ravel()))
        parts.append(make('Shorts', 'Shorts', lambda P: (P[:, 1] >= 0.71) & (P[:, 1] <= 1.01) & (np.abs(P[:, 0]) <= 0.185), 0.006, 'always'))
        rx = lambda y: B.torso_at(P0, y)[0]
        parts.append(make('TopF', 'Top', lambda P: (P[:, 1] >= 1.18) & (P[:, 1] <= 1.31) & (np.abs(P[:, 0]) <= rx(P[:, 1]) + 0.004), 0.006, 'female'))
    head = dict(version=1, deltaScale=DELTA_SCALE, parts=parts, topY=B.TOP_Y, legLen=B.LEG_LEN)
    hj = json.dumps(head, separators=(',', ':')).encode()
    pad = (-(8 + 4 + len(hj))) % 4
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'wb') as f:
        f.write(b'GYMBODY1'); f.write(struct.pack('<I', len(hj) + pad)); f.write(hj + b' ' * pad); f.write(blob.bytes())
    return os.path.getsize(path), {p['name']: p.get('entries', 0) for p in parts}
