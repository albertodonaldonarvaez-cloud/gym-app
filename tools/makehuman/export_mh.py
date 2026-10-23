"""Exporta el cuerpo basado en MakeHuman (CC0) al binario 'GYMBODY2' de la web (mismo contenedor que antes)."""
import sys, os, json, struct, numpy as np
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mhlib as M, mhbody

OUT = os.path.join(HERE, '..', '..', 'web', 'public', 'models', 'gymbody.bin')
DELTA_SCALE = 1e-4
MIN_DELTA = 2e-4


class Blob:
    def __init__(self): self.chunks = []; self.n = 0
    def add(self, arr):
        a = np.ascontiguousarray(arr); raw = a.tobytes(); pad = (-len(raw)) % 4; off = self.n
        self.chunks.append(raw + b'\0' * pad); self.n += len(raw) + pad
        return off
    def bytes(self): return b''.join(self.chunks)


def vertex_normals(P, tris):
    n = np.zeros_like(P)
    fn = np.cross(P[tris[:, 1]] - P[tris[:, 0]], P[tris[:, 2]] - P[tris[:, 0]])
    for k in range(3): np.add.at(n, tris[:, k], fn)
    return n / np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-12)


# ---------------------------------------------------------------- recorte de prendas
def clip_poly(poly, cv3, val, above):
    cv = lambda w: w[0] * cv3[0] + w[1] * cv3[1] + w[2] * cv3[2] - val
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
    tri = tri[vmask[tri].all(1)]
    cur = np.arange(len(tri)); polys = []
    for nrm, val, above in planes:
        nrm = np.asarray(nrm, float); proj = P @ nrm; newp = []
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


# ---------------------------------------------------------------- geometria auxiliar
def uv_sphere(c, r, nu=28, nv=18, cap=None):
    """Esfera (o casquete frontal +z si cap = angulo en rad) centrada en c."""
    pts, ids = [], []
    vmax = np.pi if cap is None else cap
    for j in range(nv + 1):
        th = vmax * j / nv
        for i in range(nu):
            ph = 2 * np.pi * i / nu
            pts.append([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)])
    pts = np.array(pts) * r + c
    tris = []
    for j in range(nv):
        for i in range(nu):
            a = j * nu + i; b = j * nu + (i + 1) % nu; c2 = (j + 1) * nu + i; d = (j + 1) * nu + (i + 1) % nu
            tris += [[a, c2, b], [b, c2, d]]
    return pts, np.array(tris, np.int64)


def to_uint16_tris(t): return t.astype(np.uint16).ravel()


def main():
    V, tris, J, P0, K = mhbody.build()
    n = M.NBODY
    y0 = P0[:, 1].min()
    shift = np.array([0.0, -y0, 0.0])
    P0 = P0 + shift
    top = float(P0[:, 1].max())
    m0_ = P0 - shift - V[:M.NBODY]
    def morphed(v):
        sel = np.linalg.norm(V[:M.NBODY] - v, axis=1) < 0.03
        return v + (m0_[sel].mean(0) if sel.any() else 0) + shift
    J = {k: morphed(v) for k, v in J.items()}
    # huesos dominantes (clasificacion de regiones)
    W = json.load(open(os.path.join(M.DATA, 'rigs', 'default_weights.mhw')))['weights']
    bones = sorted(W.keys()); Wm = np.zeros((n, len(bones)))
    for j, b in enumerate(bones):
        for i, w in W[b]:
            if i < n: Wm[i, j] = w
    dom = np.array(bones)[Wm.argmax(1)]
    isb = lambda *pre: np.array([d.startswith(pre) for d in dom])
    ol = np.nonzero(isb('oris'))[0]
    mc = np.median(P0[ol], axis=0)
    ok = (np.abs(P0[ol, 0] - mc[0]) < 0.031) & (np.abs(P0[ol, 1] - mc[1]) < 0.0105)
    lips = ol[ok].astype(np.uint16)

    # ---- pose natural: bajar los brazos ~25 grados alrededor del hombro (mezcla por pesos de huesos)
    ARM_DROP = np.radians(25.0)
    for side, suf, sgn in (('L', '.L', 1.0), ('R', '.R', -1.0)):
        wa = np.zeros(M.NBODY)
        for j, b in enumerate(bones):
            if not b.endswith(suf): continue
            if b.startswith(('upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal')): wa += Wm[:, j]
            elif b.startswith('shoulder'): wa += 0.6 * Wm[:, j]
        wa = np.clip(wa, 0, 1)
        c = J['joint-l-shoulder'] if sgn > 0 else J['joint-r-shoulder']
        th = -ARM_DROP * sgn
        R = np.array([[np.cos(th), -np.sin(th), 0], [np.sin(th), np.cos(th), 0], [0, 0, 1]])
        P0 = P0 + wa[:, None] * ((P0 - c) @ R.T + c - P0)
        for kn in K:
            K[kn] = K[kn] + wa[:, None] * (K[kn] @ R.T - K[kn])
        for jn in list(J):
            if jn.startswith('joint-' + side.lower() + '-') and any(t in jn for t in ('elbow', 'hand', 'finger', 'wrist')):
                J[jn] = c + (J[jn] - c) @ R.T
    print('lips', len(ol), '->', len(lips), 'mouth', np.round(mc, 3))
    blob = Blob(); parts = []
    nrm0 = vertex_normals(P0, tris)

    # ---- piel
    def keyed(name, mat, base, keydict, tris_, vis='', per_vertex=None):
        entry = dict(name=name, mat=mat, nv=int(len(base)), nt=int(len(tris_)), vis=vis,
                     pos=blob.add(base.astype(np.float32)), idx=blob.add(to_uint16_tris(tris_)), keys=[])
        total = 0
        for kn, d in keydict.items():
            m = np.abs(d).max(1) > MIN_DELTA
            c = int(m.sum())
            if c == 0: continue
            ids = np.nonzero(m)[0].astype(np.uint16)
            q = np.clip(np.round(d[m] / DELTA_SCALE), -32767, 32767).astype(np.int16)
            entry['keys'].append(dict(n=kn, c=c, io=blob.add(ids), vo=blob.add(q.ravel())))
            total += c
        entry['entries'] = total
        parts.append(entry)

    keyed('Skin', 'Skin', P0, K, tris)

    # ---- partes que siguen a la piel (ojos, cejas...): deltas de los vertices cercanos
    def follow_keys(pts, radius=0.03, rigid=False):
        out = {}
        for kn, d in K.items():
            if not kn.startswith(('face_w', 'head_', 'jaw', 'chin', 'nose', 'lips', 'eyes', 'cheek', 'gender', 'mus_', 'wt_')): continue
            acc = np.zeros((len(pts), 3))
            for s in range(0, len(pts), 256):
                blk = pts[s:s + 256]
                dist = np.linalg.norm(blk[:, None, :] - P0[None, :, :], axis=2)
                if rigid:
                    sel = dist.min(0) < radius  # vertices cercanos a toda la pieza
                    acc[s:s + 256] = d[sel].mean(0) if sel.any() else 0
                else:
                    idx = np.argsort(dist, axis=1)[:, :4]
                    w = 1.0 / (np.take_along_axis(dist, idx, 1) + 2e-3); w /= w.sum(1, keepdims=True)
                    acc[s:s + 256] = (d[idx] * w[..., None]).sum(1)
            out[kn] = acc
        return out

    for side, jn in ((1, 'joint-l-eye'), (-1, 'joint-r-eye')): pass
    eye_c = [J['joint-l-eye'], J['joint-r-eye']]
    EYE_R = 0.0118
    def eye_part(name, mat, cap, rr):
        pts_all, tri_all = [], []; off = 0
        for c in eye_c:
            p, t = uv_sphere(c, rr, cap=cap); pts_all.append(p); tri_all.append(t + off); off += len(p)
        pts = np.concatenate(pts_all); tr = np.concatenate(tri_all)
        # una traslacion rigida por ojo
        keys = {}
        for kn, d in K.items():
            if not kn.startswith(('face_w', 'head_', 'jaw', 'chin', 'nose', 'lips', 'eyes', 'cheek', 'gender', 'mus_', 'wt_')): continue
            acc = np.zeros((len(pts), 3)); o = 0
            for c in eye_c:
                sel = np.linalg.norm(P0 - c, axis=1) < 0.03
                cnt = len(pts_all[0]); acc[o:o + cnt] = d[sel].mean(0); o += cnt
            keys[kn] = acc
        keyed(name, mat, pts, keys, tr)
    eye_part('EyeWhite', 'White', None, EYE_R)
    eye_part('Iris', 'Eye', 0.52, EYE_R * 1.003)
    eye_part('Pupil', 'Dark', 0.22, EYE_R * 1.006)

    # ---- prendas derivadas de la piel
    def region_mask(Pref):
        x, y = np.abs(Pref[:, 0]), Pref[:, 1]
        legs = (x <= 0.30) & (y <= 1.10)
        arms = isb('upperarm', 'lowerarm', 'wrist', 'finger', 'metacarpal')
        head = isb('head', 'jaw', 'oris', 'oculi', 'orbic', 'levator', 'risorius', 'special', 'tongue', 'eye', 'neck03')
        torso = ~arms & ~head & (y > 0.80)
        headb = isb('head', 'jaw', 'oris', 'oculi', 'orbic', 'levator', 'risorius', 'special', 'tongue', 'eye', 'neck03')
        return {'torso': torso, 'legs': legs & ~arms & ~head, 'any': np.ones(len(Pref), bool), 'upper': ~arms & ~headb, 'nohead': ~headb,
                'head': head | (y > 1.45), 'feet': (y <= 0.20) & (x <= 0.30)}

    Pm = P0
    Pf = P0 + K['gender']
    masks_m, masks_f = region_mask(Pm), region_mask(Pf)

    def derived(name, vis, ref, mask, regions, infl_fn, accent=False, mat='Cloth'):
        Pref, masks = (Pf, masks_f) if ref == 'f' else (Pm, masks_m)
        src, w, faces = merge_regions([clip_regions(Pref, tris, masks[mask], planes) for planes in regions])
        if len(faces) == 0:
            print('  (vacio)', name); return
        Pd = sum(w[:, k:k + 1] * Pref[src[:, k]] for k in range(3))
        infl = np.asarray(infl_fn(Pd), np.float32) * np.ones(len(Pd), np.float32)
        parts.append(dict(name=name, mat=mat, derived='Skin', vis=vis, accent=int(accent), nv=int(len(src)), nt=int(len(faces)),
                          src=blob.add(src.ravel()), w=blob.add(w.ravel()), infl=blob.add(infl), idx=blob.add(to_uint16_tris(faces))))

    flat = lambda v: (lambda P: v)
    # Landmarks (base masculina): cintura 1.10, pecho 1.26, hombros 1.38, entrepierna ~0.82, cadera 0.90, rodilla 0.45, tobillo 0.074
    G = {}
    def garment(gname, slot, opt, ref, pieces, infl):
        for i, (mask, regions, accent) in enumerate(pieces):
            derived(f'{gname}_{i}', f'{slot}:{opt}', ref, mask, regions, infl, accent)

    # NOTA: las dos primeras son planos inclinados para cada lado: sgn*x + 0.9*y <= c  (se aplican ambos)
    ARM2 = [((-1, -0.9, 0.0), -(0.090 + 0.9 * 1.33), True), ((1, -0.9, 0.0), -(0.090 + 0.9 * 1.33), True)]
    # |x| <= 0.2 abajo de la axila
    SIDE = [((1, 0, 0), 0.20, False), ((-1, 0, 0), 0.20, False)]
    BRA_ARM = [((-1, -0.9, 0.0), -(0.076 + 0.9 * 1.30), True), ((1, -0.9, 0.0), -(0.076 + 0.9 * 1.30), True)]
    garment('G_bra', 'top', 'bra', 'f', [
        ('upper', [Yp(1.085, 1.105) + SIDE + BRA_ARM], True), ('upper', [Yp(1.105, 1.265) + SIDE + BRA_ARM], False),
        ('upper', [Yp(1.264, 1.285) + SIDE + BRA_ARM], True),
        ('nohead', [Yp(1.284, 1.46) + Xr(0.058, 0.085), Yp(1.284, 1.46) + Xr(-0.085, -0.058)], False)], flat(0.0045))
    garment('G_tank', 'top', 'tank', 'm', [
        ('upper', [Yp(0.985, 1.010) + SIDE], True),
        ('upper', [Yp(1.010, 1.330) + SIDE + ARM2], False),
        ('nohead', [Yp(1.329, 1.46) + Xr(0.058, 0.092), Yp(1.329, 1.46) + Xr(-0.092, -0.058)], False)], flat(0.0045))
    garment('G_shorts', 'bottom', 'shorts', 'm', [
        ('legs', [Yp(0.665, 0.690)], True), ('legs', [Yp(0.690, 0.960)], False), ('legs', [Yp(0.960, 1.000)], True)],
        lambda P: 0.0045 + np.clip(0.8 - P[:, 1], 0, None) * 0.02)
    garment('G_leggings', 'bottom', 'leggings', 'm', [
        ('legs', [Yp(0.045, 0.980)], False), ('legs', [Yp(0.980, 1.025)], True)], flat(0.0025))
    garment('G_boxer', 'bottom', 'boxer', 'm', [
        ('legs', [Yp(0.650, 0.960)], False), ('legs', [Yp(0.960, 1.000)], True)], flat(0.0045))



    # ---------------- tenis: casco lofteado alrededor del pie (rigido, sigue al pie) ----------------
    fz = np.array([-0.05, -0.03, -0.01, 0.01, 0.03, 0.05, 0.07, 0.09, 0.11, 0.13, 0.15, 0.17, 0.19, 0.21])
    ftop_z = [-0.060, -0.045, 0.00, 0.045, 0.075, 0.095, 0.115, 0.135, 0.155, 0.175, 0.195, 0.215, 0.228]
    ftop_h = [0.050, 0.086, 0.092, 0.092, 0.098, 0.082, 0.068, 0.058, 0.050, 0.043, 0.038, 0.031, 0.020]
    footsel = (P0[:, 1] < 0.095) & (P0[:, 0] > 0.10)
    def foot_profile(z):
        s_ = footsel & (np.abs(P0[:, 2] - z) < 0.012)
        if s_.sum() < 3:
            return None
        return float(P0[s_, 0].min()), float(P0[s_, 0].max())
    def shoe_mesh(grow, ybot, hscale, hfix, pw, collar):
        zs = np.concatenate([[-0.062], np.arange(-0.050, 0.216, 0.012), [0.226, 0.232]])
        taper = np.ones(len(zs)); taper[0] = 0.0; taper[1] = 0.80; taper[-1] = 0.0; taper[-2] = 0.55; taper[-3] = 0.88
        NR = 24
        prof = []
        for z in zs:
            zc_ = float(np.clip(z, -0.045, 0.205))
            pr = foot_profile(zc_)
            prof.append(pr)
        pts_side = []; faces_side = []
        for k, z in enumerate(zs):
            xmn, xmx = prof[k]
            xc = (xmn + xmx) / 2; hw = (xmx - xmn) / 2 + grow
            ht = hfix if hfix is not None else float(np.interp(z, ftop_z, ftop_h)) * hscale
            for i in range(NR):
                ph = 2 * np.pi * i / NR
                u, v = np.cos(ph), np.sin(ph)
                su = np.sign(u) * abs(u) ** (2 / pw); sv = np.sign(v) * abs(v) ** (2 / pw)
                x = xc + hw * su * taper[k]
                y = ybot + (ht - ybot) * (0.5 + 0.5 * sv * (1.0 if taper[k] > 0.5 else 0.6 + 0.8 * taper[k])) if True else 0
                if taper[k] == 0.0: y = ybot + (ht - ybot) * 0.5
                pts_side.append([x, y, z])
        pts_side = np.array(pts_side)
        for k in range(len(zs) - 1):
            for i in range(NR):
                a = k * NR + i; b = k * NR + (i + 1) % NR; c2 = (k + 1) * NR + i; d = (k + 1) * NR + (i + 1) % NR
                ang = 2 * np.pi * (i + 0.5) / NR
                if collar and zs[k] < 0.040 and np.sin(ang) > 0.55 and zs[k] > -0.058: continue
                if collar and zs[k + 1] < 0.040 and np.sin(ang) > 0.55 and zs[k] > -0.058: continue
                faces_side += [[a, c2, b], [b, c2, d]]
        faces_side = np.array(faces_side, np.int64)
        # ambos pies (el izquierdo en +x, el derecho espejado)
        L = pts_side.copy(); R_ = pts_side.copy(); R_[:, 0] *= -1
        pts = np.concatenate([L, R_]); fr = np.concatenate([faces_side, faces_side[:, ::-1] + len(L)])
        vol = np.einsum('ij,ij->i', pts[fr[:, 0]], np.cross(pts[fr[:, 1]], pts[fr[:, 2]])).sum()
        if vol < 0: fr = fr[:, ::-1]
        # recoger solo los vertices usados
        return pts, fr

    def foot_follow(name, mat, pts, fr, vis):
        keys = {}
        selL = footsel & (P0[:, 0] > 0); selR = footsel & (P0[:, 0] < 0)
        # footsel solo toma x>0.10; para el pie derecho usar el espejo
        selR = (P0[:, 1] < 0.095) & (P0[:, 0] < -0.10)
        left = pts[:, 0] > 0
        for kn, d in K.items():
            dl = d[selL].mean(0); dr = d[selR].mean(0)
            if max(np.abs(dl).max(), np.abs(dr).max()) < 2e-4: continue
            keys[kn] = np.where(left[:, None], dl[None, :], dr[None, :])
        keyed(name, mat, pts, keys, fr, vis=vis)
    pts, fr = shoe_mesh(0.0065, -0.004, 1.0, None, 3.2, True)
    foot_follow('ShoeUpper', 'Shoe', pts, fr, 'shoes:sneakers')
    pts, fr = shoe_mesh(0.0085, -0.007, 1.0, 0.015, 5.5, False)
    foot_follow('ShoeSole', 'Sole', pts, fr, 'shoes:sneakers')

    # ---------------- cabello y cejas ----------------
    EY = float(eye_c[0][1])
    hairline = lambda c: [((0, 1, -0.5), c, True)]
    def hair_infl(base, top=0.0, y0=1.62):
        return lambda P: base + top * np.clip((P[:, 1] - y0) / 0.10, 0, 1)
    def hair(name, regions, infl, mask='any'):
        derived('Hair_' + name, 'hair:' + name, 'm', mask, regions, infl, mat='Hair')
    NOEAR = lambda c: [hairline(c) + [((0, 1, 0), 1.665, True)], hairline(c) + [((0, 1, 0), 1.665, False), ((1, 0, 0), 0.071, False), ((-1, 0, 0), 0.071, False)]]
    CAP = hairline(1.6125)
    hair('short', NOEAR(1.6125), hair_infl(0.006, 0.012))
    hair('buzz', [hairline(1.620)], hair_infl(0.0022, 0.0015))
    hair('curly', [hairline(1.585)], lambda P: 0.014 + 0.026 * np.clip((P[:, 1] - 1.58) / 0.10, 0, 1) + 0.011 * (0.5 + 0.5 * np.sin(P[:, 0] * 230 + 1.3) * np.sin(P[:, 1] * 210) * np.sin(P[:, 2] * 240 + 0.7)))
    hair('long', [hairline(1.600),
                  [((0, 0, -1), 0.0, True), ((-1.2, 1, 0), 1.20, True), ((1.2, 1, 0), 1.20, True), ((0, 1, 0), 1.60, False), ((1, 0, 0), 0.125, False), ((-1, 0, 0), 0.125, False)],
                  [((0, 0, -1), -0.02, True)] + Yp(1.30, 1.50) + Xr(0.062, 0.115), [((0, 0, -1), -0.02, True)] + Yp(1.30, 1.50) + Xr(-0.115, -0.062)],
         lambda P: 0.007 + 0.014 * np.clip((P[:, 1] - 1.62) / 0.1, 0, 1) + 0.010 * np.clip((1.55 - P[:, 1]) / 0.3, 0, 1))
    hair('ponytail', NOEAR(1.6125), hair_infl(0.006, 0.012))
    hair('bun', NOEAR(1.6125), hair_infl(0.006, 0.012))

    # piezas rigidas que siguen a la cabeza (coleta y mono)
    headsel = np.linalg.norm(P0 - np.array([0.0, 1.62, 0.0]), axis=1) < 0.12
    def head_follow(name, mat, pts, tr, vis):
        keys = {}
        for kn, d in K.items():
            if not kn.startswith(('face_w', 'head_', 'jaw', 'chin', 'gender', 'mus_', 'wt_', 'legLen', 'cheek')): continue
            keys[kn] = np.tile(d[headsel].mean(0), (len(pts), 1))
        keyed(name, mat, pts, keys, tr, vis=vis)
    def capsule(a, b, r0, r1, nu=18, nv=14):
        a = np.asarray(a, float); b = np.asarray(b, float); ax = b - a; L = np.linalg.norm(ax); ax /= L
        u = np.cross(ax, [1, 0, 0]); u /= np.linalg.norm(u); v = np.cross(ax, u)
        pts = []
        for j in range(nv + 1):
            t = j / nv; r = r0 + (r1 - r0) * np.sin(t * np.pi * 0.5) ** 0.9 if False else r0 + (r1 - r0) * t
            r *= np.sin(np.pi * (0.12 + 0.88 * t)) ** 0.35 if t > 0.88 else 1.0
            for i in range(nu):
                ph = 2 * np.pi * i / nu
                pts.append(a + ax * L * t + (np.cos(ph) * u + np.sin(ph) * v) * r)
        pts = np.array(pts); tris_ = []
        for j in range(nv):
            for i in range(nu):
                a_ = j * nu + i; b_ = j * nu + (i + 1) % nu; c_ = (j + 1) * nu + i; d_ = (j + 1) * nu + (i + 1) % nu
                tris_ += [[a_, c_, b_], [b_, c_, d_]]
        return pts, np.array(tris_, np.int64)
    pts, tr = capsule([0.0, 1.655, -0.082], [0.0, 1.43, -0.16], 0.030, 0.012)
    head_follow('Hair_ponytail_tail', 'Hair', pts, tr, 'hair:ponytail')
    pts, tr = uv_sphere(np.array([0.0, 1.715, -0.050]), 0.046, nu=24, nv=16)
    head_follow('Hair_bun_ball', 'Hair', pts, tr, 'hair:bun')

    # cejas: cinta pegada a la superficie del rostro
    def surface_pts(P):
        """Coordenadas baricentricas exactas (en proyeccion x,y) de cada punto sobre la cara frontal de la malla."""
        fr = (P0[:, 2] > 0.05) & (P0[:, 1] > 1.5)
        ft = tris[fr[tris].all(1)]
        a = P0[ft[:, 0], :2]; b = P0[ft[:, 1], :2]; c = P0[ft[:, 2], :2]
        out_src, out_w = [], []
        for p in P:
            v0 = b - a; v1 = c - a; v2 = p[:2] - a
            den = v0[:, 0] * v1[:, 1] - v1[:, 0] * v0[:, 1]
            den = np.where(np.abs(den) < 1e-12, 1e-12, den)
            u = (v2[:, 0] * v1[:, 1] - v1[:, 0] * v2[:, 1]) / den
            v = (v0[:, 0] * v2[:, 1] - v2[:, 0] * v0[:, 1]) / den
            ok = (u >= -1e-6) & (v >= -1e-6) & (u + v <= 1 + 1e-6)
            idx = np.nonzero(ok)[0]
            if len(idx) == 0: raise RuntimeError('sin triangulo para ' + str(p))
            # si hay varios (pliegues) quedarse con el mas adelantado
            zs = [(1 - u[i] - v[i]) * P0[ft[i, 0], 2] + u[i] * P0[ft[i, 1], 2] + v[i] * P0[ft[i, 2], 2] for i in idx]
            i = idx[int(np.argmax(zs))]
            out_src.append(ft[i]); out_w.append([1 - u[i] - v[i], u[i], v[i]])
        return np.array(out_src, np.uint16), np.array(out_w, np.float32)
    brow_pts, brow_tris = [], []
    for sgn in (1, -1):
        ring = []
        for k in range(13):
            t = k / 12; x = 0.014 + t * 0.050
            ycen = EY + 0.027 + 0.010 * np.sin(np.pi * min(t * 1.25, 1.0)) - 0.012 * t * t
            hw = 0.0042 * (1 - 0.55 * t) + 0.0012
            ring.append(((sgn * x, ycen + hw), (sgn * x, ycen - hw)))
        base = len(brow_pts)
        for a_, b_ in ring: brow_pts += [(a_[0], a_[1], 0.0), (b_[0], b_[1], 0.0)]
        for k in range(12):
            i = base + 2 * k
            brow_tris += [[i, i + 2, i + 1], [i + 1, i + 2, i + 3]] if sgn > 0 else [[i, i + 1, i + 2], [i + 1, i + 3, i + 2]]
    bp = np.array(brow_pts)
    bsrc, bw = surface_pts(bp)
    bsrc3 = np.concatenate([bsrc], axis=1)
    parts.append(dict(name='Brows', mat='Brow', derived='Skin', vis='', accent=0, nv=int(len(bp)), nt=int(len(brow_tris)),
                      src=blob.add(bsrc3.ravel()), w=blob.add(bw.ravel()), infl=blob.add(np.full(len(bp), 0.0022, np.float32)),
                      idx=blob.add(to_uint16_tris(np.array(brow_tris, np.int64)))))

    head = dict(version=3, deltaScale=DELTA_SCALE, parts=parts, topY=top, legLen=0.0, headY=float(J['joint-head'][1]),
                eyeY=float(eye_c[0][1]), lips=blob.add(lips), nlips=int(len(lips)),
                eyes=[[float(v) for v in c] for c in eye_c])
    hj = json.dumps(head, separators=(',', ':')).encode()
    pad = (-(8 + 4 + len(hj))) % 4
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'wb') as f:
        f.write(b'GYMBODY2'); f.write(struct.pack('<I', len(hj) + pad)); f.write(hj + b' ' * pad); f.write(blob.bytes())
    print('escrito', os.path.getsize(OUT) / 1e6, 'MB; top', top)
    for p in parts: print(f"{p['name']:14s} nv={p['nv']:6d} nt={p['nt']:6d} keys={len(p.get('keys', []))}")


if __name__ == '__main__':
    main()





