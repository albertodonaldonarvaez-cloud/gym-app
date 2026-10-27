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
    ok = (np.abs(P0[ol, 0] - mc[0]) < 0.024) & (np.abs(P0[ol, 1] - mc[1]) < 0.0075)
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

    # ---- estilo anime: cabeza ~10% mas grande, nariz/boca/menton pequenos (se hornea en la base)
    HS, NY = 1.10, 1.43
    hb = np.zeros(M.NBODY)
    for j, b in enumerate(bones):
        if b.startswith(('head', 'jaw', 'oris', 'oculi', 'orbic', 'levator', 'risorius', 'special', 'tongue', 'eye', 'neck03')): hb += Wm[:, j]
        elif b.startswith('neck02'): hb += 0.5 * Wm[:, j]
    hb = np.clip(hb, 0, 1)
    hc = np.array([0.0, NY, 0.01])
    P0 = P0 + hb[:, None] * (P0 - hc) * (HS - 1)
    for kn in K: K[kn] = K[kn] * (1 + (HS - 1) * hb[:, None])
    for jn in ('joint-l-eye', 'joint-r-eye', 'joint-head'): J[jn] = hc + (J[jn] - hc) * HS
    P0 = P0 + 0.9 * K['nose-'] + 0.85 * K['lips-'] + 0.55 * K['jaw-'] + 0.35 * K['chin-']
    H = lambda c: NY + HS * (c - NY)
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
    NAPE = [((0, 0, -1), 0.03, True), ((0, 1, 0), H(1.575), True), ((1, 0, 0), 0.075, False), ((-1, 0, 0), 0.075, False)]
    NOEAR = lambda c: [NAPE, hairline(c) + [((0, 1, 0), H(1.665), True)], hairline(c) + [((0, 1, 0), H(1.665), False), ((1, 0, 0), 0.078, False), ((-1, 0, 0), 0.078, False)]]
    # casquete fino (base de los mechones)
    hair('short', NOEAR(H(1.6275)), hair_infl(0.005, 0.006, H(1.62)))
    hair('buzz', [hairline(H(1.620))], hair_infl(0.0022, 0.0015, H(1.62)))
    hair('curly', [hairline(H(1.600))], hair_infl(0.006, 0.006, H(1.60)))
    hair('long', NOEAR(H(1.6275)), hair_infl(0.005, 0.006, H(1.62)))
    hair('ponytail', NOEAR(H(1.6275)), hair_infl(0.005, 0.006, H(1.62)))
    hair('bun', NOEAR(H(1.6275)), hair_infl(0.005, 0.006, H(1.62)))

    # elipsoide del craneo (los mechones de Blender se definen en una esfera unitaria)
    hv = np.nonzero(isb('head', 'jaw') & (P0[:, 1] > H(1.60)))[0]
    xs, ys, zs_ = P0[hv, 0], P0[hv, 1], P0[hv, 2]
    RX = (xs.max() - xs.min()) / 2 + 0.010
    RZ = (zs_.max() - zs_.min()) / 2 + 0.008
    RY = 0.120
    CH = np.array([0.0, ys.max() - RY + 0.002, (zs_.max() + zs_.min()) / 2])
    print('craneo', np.round(CH, 3), np.round([RX, RY, RZ], 3))
    headsel = np.linalg.norm(P0 - CH, axis=1) < 0.14
    def head_follow(name, mat, pts, tr, vis):
        keys = {}
        for kn, d in K.items():
            if not kn.startswith(('face_w', 'head_', 'jaw', 'chin', 'gender', 'mus_', 'wt_', 'legLen', 'cheek')): continue
            keys[kn] = np.tile(d[headsel].mean(0), (len(pts), 1))
        keyed(name, mat, pts, keys, tr, vis=vis)
    def load_obj(fn):
        vs, fs = [], []
        for ln in open(fn):
            if ln.startswith('v '): vs.append([float(t) for t in ln.split()[1:4]])
            elif ln.startswith('f '):
                q = [int(t.split('/')[0]) - 1 for t in ln.split()[1:]]
                for k in range(1, len(q) - 1): fs.append([q[0], q[k], q[k + 1]])
        return np.array(vs), np.array(fs, np.int64)
    ANIME = os.path.join(HERE, '..', 'anime')
    for style in ('short', 'long', 'curly', 'ponytail', 'bun'):
        u, f = load_obj(os.path.join(ANIME, f'hair_{style}.obj'))
        pts = CH + u * np.array([RX, RY, RZ])
        assert len(pts) < 65536
        head_follow(f'Hair_{style}_locks', 'Hair', pts, f, f'hair:{style}')
    pts, tr = uv_sphere(CH + np.array([0.0, RY * 0.92, -RZ * 0.55]), 0.050, nu=24, nv=16)
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
            ycen = EY + 0.031 + 0.008 * np.sin(np.pi * min(t * 1.25, 1.0)) - 0.012 * t * t
            hw = 0.0046 * (1 - 0.5 * t) + 0.0012
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
                      src=blob.add(bsrc3.ravel()), w=blob.add(bw.ravel()), infl=blob.add(np.full(len(bp), 0.0035, np.float32)),
                      idx=blob.add(to_uint16_tris(np.array(brow_tris, np.int64)))))


    # ---------------- ojos anime: capas planas pegadas a la cara ----------------
    def patch(cx, cy, a, b, r0=0.0, a0=0.0, a1=360.0, nr=4, ns=28, dy=0.0):
        pts, tri = [], []
        n_a = ns if (a1 - a0) >= 359 else max(6, int(ns * (a1 - a0) / 360) + 1)
        closed = (a1 - a0) >= 359
        for j in range(nr + 1):
            r = r0 + (1 - r0) * j / nr
            for i in range(n_a if not closed else ns):
                ang = np.radians(a0 + (a1 - a0) * i / (ns if closed else n_a - 1))
                pts.append((cx + a * r * np.cos(ang), cy + dy + b * r * np.sin(ang)))
        W = ns if closed else n_a
        for j in range(nr):
            for i in range(W):
                i2 = (i + 1) % W if closed else i + 1
                if not closed and i2 >= W: continue
                p0, p1, p2, p3 = j * W + i, j * W + i2, (j + 1) * W + i, (j + 1) * W + i2
                tri += [[p0, p2, p1], [p1, p2, p3]]
        return np.array(pts), np.array(tri, np.int64)

    # un solo plano por ojo con UV (la textura del ojo anime se pinta en la web con el color elegido)
    ex, ey_ = float(abs(eye_c[0][0])), float(eye_c[0][1])
    WH, HH = 0.0250, 0.0250            # semiancho / semialto del plano del ojo
    G = 18
    P2, UV, T2, o = [], [], [], 0
    for sgn in (1, -1):
        for iy in range(G + 1):
            for ix in range(G + 1):
                u, v = ix / G, iy / G
                P2.append((sgn * (ex + 0.001 + (u * 2 - 1) * WH), ey_ + (v * 2 - 1) * HH))
                UV.append((u, v))
        for iy in range(G):
            for ix in range(G):
                a = o + iy * (G + 1) + ix; b = a + 1; c = a + (G + 1); d = c + 1
                tri = [[a, b, d], [a, d, c]]
                if sgn < 0: tri = [t[::-1] for t in tri]
                T2 += tri
        o += (G + 1) ** 2
    P2 = np.array(P2); UV = np.array(UV, np.float32); T2 = np.array(T2, np.int64)
    src, w = surface_pts(np.column_stack([P2, np.zeros(len(P2))]))
    parts.append(dict(name='EyeTex', mat='EyeTex', derived='Skin', vis='', accent=0, nv=int(len(P2)), nt=int(len(T2)),
                      src=blob.add(src.ravel()), w=blob.add(w.ravel()), infl=blob.add(np.full(len(P2), 0.0022, np.float32)),
                      uv=blob.add(UV.ravel()), idx=blob.add(to_uint16_tris(T2))))

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





