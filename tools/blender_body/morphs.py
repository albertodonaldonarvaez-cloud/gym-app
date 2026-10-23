"""Genera los morph targets (shape keys) como CAMPOS DE POSICION: sirven para cualquier malla
(piel, cabeza, manos, cabello, ropa) porque solo dependen de la posicion de cada vertice."""
import bpy, bmesh, numpy as np, math, sys, importlib
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
importlib.reload(B)
from bodydefs import P, smooth01, torso_at, arm_radius, leg_radius

P0 = B.P()
SX0 = B.shoulder_x(P0)
CA, SA = math.cos(B.ARM_TILT), math.sin(B.ARM_TILT)
CL, SL = math.cos(B.LEG_TILT), math.sin(B.LEG_TILT)
ZONES = ['chest', 'back', 'delts', 'arms', 'abs', 'glutes', 'quads', 'hams', 'calves']
HEAD_PARTS = {'Head', 'EyeWhite', 'Iris', 'Pupil', 'Brows', 'Lips'}


def is_head(name): return name in HEAD_PARTS or name.startswith('Hair_')
HEAD_C = np.array([0.0, 1.628, 0.0])
WIDEN_DETAIL = 1.1


def b2j_pos(co):  # Blender (x, y, z) -> JS (x, y=z, z=-y)
    return np.stack([co[:, 0], co[:, 2], -co[:, 1]], 1)


def j2b_vec(v):
    return np.stack([v[:, 0], -v[:, 2], v[:, 1]], 1)


def frames(Pv):
    x, y, z = Pv[:, 0], Pv[:, 1], Pv[:, 2]
    arm, leg = {}, {}
    for side in (1, -1):
        px = x * side
        rx_, ry_ = px - SX0, y - B.SHOULDER_Y
        xl = rx_ * CA + ry_ * SA; yl = -rx_ * SA + ry_ * CA
        d = -yl; perp = np.hypot(xl, z)
        th = np.degrees(np.arctan2(z / 1.05, xl)) % 360
        R = arm_radius(P0, np.clip(d, 0, B.ARM_LEN))
        Rm = np.where(d > 0.5, np.maximum(R, 0.045), R)
        wmem = np.clip((1.7 * Rm - perp) / (0.7 * Rm), 0, 1) * np.clip((d + 0.02) / 0.07, 0, 1)
        arm[side] = dict(d=d, th=th, xl=xl, z=z, w=wmem * np.clip((B.ARM_LEN + 0.04 - d) / 0.04, 0, 1), wext=wmem)
        rx_, ry_ = px - B.LEG_X, y - B.LEG_TOP_Y
        xl = rx_ * CL + ry_ * SL; yl = -rx_ * SL + ry_ * CL
        d = -yl; perp = np.hypot(xl, z)
        th = np.degrees(np.arctan2(z / 1.04, xl)) % 360
        R = leg_radius(P0, np.clip(d, 0, B.LEG_LEN))
        w = np.clip((1.7 * R - perp) / (0.7 * R), 0, 1) * np.clip((d - 0.03) / 0.08, 0, 1) * np.clip((B.LEG_LEN + 0.04 - d) / 0.04, 0, 1)
        Rl = np.where(d > 0.8, np.maximum(R, 0.05), R)
        wl_ext = np.clip((1.7 * Rl - perp) / (0.7 * Rl), 0, 1) * np.clip((d - 0.03) / 0.08, 0, 1)
        leg[side] = dict(d=d, th=th, xl=xl, z=z, w=w, wext=wl_ext)
    return arm, leg


def compute_keys(Pv, Nv, is_head_part=False):
    """Pv, Nv: posiciones y normales (N,3) en coordenadas JS. Devuelve {nombre: delta (N,3) JS}."""
    N = len(Pv); x, y, z = Pv[:, 0], Pv[:, 1], Pv[:, 2]
    arm, leg = frames(Pv)
    wAT = np.clip(arm[1]['w'] + arm[-1]['w'], 0, 1)
    wLT = np.clip(leg[1]['w'] + leg[-1]['w'], 0, 1)
    wAx = np.clip(arm[1]['wext'] + arm[-1]['wext'], 0, 1)
    wLx = np.clip(leg[1]['wext'] + leg[-1]['wext'], 0, 1)
    wT = np.clip(1 - np.maximum(wAT, wAx) - np.maximum(wLT, wLx), 0, 1) * np.clip((1.60 - y) / 0.05, 0, 1) * smooth01((y - 0.80) / 0.10)
    wHead = np.ones(N) if is_head_part else smooth01((y - 1.50) / 0.10)
    yc = np.clip(y, B.TORSO_Y0, B.TORSO_Y1)
    rx0, rz0, cz0 = torso_at(P0, yc)
    th_t = np.degrees(np.arctan2((z - cz0) / rz0, x / rx0)) % 360
    K = {}

    def torso_delta(pa, pb):
        ra, za, ca = torso_at(pa, yc); rb, zb, cb = torso_at(pb, yc)
        d = np.zeros((N, 3))
        d[:, 0] = x * (rb / ra - 1)
        d[:, 2] = (cb - ca) + (z - ca) * (zb / za - 1)
        return d * wT[:, None]

    def limb_delta(frm, rad_fn, pa, pb, ang, wkey='w'):
        d = np.zeros((N, 3))
        for side in (1, -1):
            f = frm[side]
            dc = np.clip(f['d'], 0, B.ARM_LEN if rad_fn is arm_radius else B.LEG_LEN)
            ratio = rad_fn(pb, dc) / rad_fn(pa, dc) - 1
            dxl = f['xl'] * ratio; dzl = f['z'] * ratio
            c, s = ang
            d[:, 0] += f[wkey] * side * dxl * c
            d[:, 1] += f[wkey] * dxl * s
            d[:, 2] += f[wkey] * dzl
        return d

    def shift_arms(pa, pb):
        dsx = B.shoulder_x(pb) - B.shoulder_x(pa)
        d = np.zeros((N, 3))
        for side in (1, -1): d[:, 0] += arm[side]['wext'] * side * dsx
        return d

    def head_scale(sx_=0.0, sz_=0.0, uniform=0.0):
        d = np.zeros((N, 3))
        d[:, 0] = x * sx_ * wHead + (x - HEAD_C[0]) * uniform * wHead
        d[:, 1] = (y - HEAD_C[1]) * uniform * wHead
        d[:, 2] = z * sz_ * wHead + (z - HEAD_C[2]) * uniform * wHead
        return d

    def full(pa, pb):
        return (torso_delta(pa, pb) + limb_delta(arm, arm_radius, pa, pb, (CA, SA)) +
                limb_delta(leg, leg_radius, pa, pb, (CL, SL)) + shift_arms(pa, pb))

    M = P0
    F = dict(M, fat=100.0)
    K['fat_m'] = full(M, F) + head_scale(sx_=0.16)
    Fm = P(g=1.0); Ff = P(g=1.0, fat=100.0)
    K['fat_f'] = full(Fm, Ff) + head_scale(sx_=0.16)
    K['gender'] = full(M, Fm) + head_scale(uniform=-0.06)
    K['muscle_gen'] = full(M, dict(M, muscle=100.0))
    K['shoulders'] = torso_delta(M, dict(M, shoulders=100.0)) + shift_arms(M, dict(M, shoulders=100.0))
    K['waist'] = torso_delta(M, dict(M, waist=100.0))
    K['hips'] = torso_delta(M, dict(M, hips=100.0))
    K['chest_m'] = torso_delta(M, dict(M, chest=100.0))
    K['chest_f'] = torso_delta(Fm, dict(Fm, chest=100.0))
    K['arms'] = limb_delta(arm, arm_radius, M, dict(M, arms=100.0), (CA, SA))
    K['legs'] = limb_delta(leg, leg_radius, M, dict(M, legs=100.0), (CL, SL))

    # longitud de piernas / brazos (deformaciones lineales: -1 = mas cortas, +1 = mas largas)
    fl = 1.12
    dY = (fl - 1) * B.LEG_LEN
    dy = dY - (fl - 1) * np.clip(B.LEG_TOP_Y - y, 0, B.LEG_LEN)
    ll = np.zeros((N, 3)); ll[:, 1] = dy
    K['legLen'] = ll
    fa = 1.12
    al = np.zeros((N, 3))
    for side in (1, -1):
        f = arm[side]; d = f['d']
        dn = np.where(d <= B.ARM_LEN, d * fa, d + (fa - 1) * B.ARM_LEN)
        dyl = -(dn - d)                      # cambio en y local
        al[:, 0] += f['wext'] * side * (-dyl * SA)
        al[:, 1] += f['wext'] * (dyl * CA)
    K['armLen'] = al

    # ---------------- rasgos del rostro (solo piezas de la cabeza) ----------------
    if is_head_part:
        cy = HEAD_C[1]
        K['face_w'] = np.stack([x * 0.10, np.zeros(N), np.zeros(N)], 1)
        wj = smooth01((cy - 0.015 - y) / 0.05)
        K['jaw'] = np.stack([x * 0.20 * wj, np.zeros(N), np.zeros(N)], 1)
        nc = np.array([0.0, cy - 0.026, 0.10])
        wn = np.exp(-(((x - nc[0]) / 0.030) ** 2 + ((y - nc[1]) / 0.034) ** 2 + ((z - nc[2]) / 0.030) ** 2))
        K['nose'] = (Pv - nc) * 0.5 * wn[:, None]
        lc = np.array([0.0, cy - 0.066, 0.092])
        wl = np.exp(-(((x - lc[0]) / 0.034) ** 2 + ((y - lc[1]) / 0.016) ** 2 + ((z - lc[2]) / 0.022) ** 2))
        K['lips'] = np.stack([np.zeros(N), (y - lc[1]) * 0.7 * wl, (z - lc[2]) * 0.45 * wl + 0.003 * wl], 1)
        side = np.where(x >= 0, 1.0, -1.0)
        ec = np.stack([side * 0.032, np.full(N, cy + 0.016), np.full(N, 0.088)], 1)
        we = np.exp(-(np.linalg.norm(Pv - ec, axis=1) / 0.020) ** 2)
        K['eyes'] = (Pv - ec) * 0.35 * we[:, None]

    # ---------------- musculos (campos anatomicos) ----------------
    acc = {}
    def add(key, arr): acc[key] = acc.get(key, 0) + arr
    f = B.field(B.TORSO_DEFS, yc, th_t, WIDEN_DETAIL)
    for k, v in f.items(): add(k, v * wT)
    norm_l = 1.0 / np.maximum(1.0, leg[1]['w'] + leg[-1]['w'])
    norm_a = 1.0 / np.maximum(1.0, arm[1]['w'] + arm[-1]['w'])
    for side in (1, -1):
        fr = arm[side]; ff = B.field(B.ARM_DEFS, np.clip(fr['d'], -0.02, B.ARM_LEN), fr['th'], WIDEN_DETAIL)
        for k, v in ff.items(): add(k, v * fr['w'] * norm_a)
        fr = leg[side]; ff = B.field(B.LEG_DEFS, np.clip(fr['d'], 0, B.LEG_LEN), fr['th'], WIDEN_DETAIL)
        for k, v in ff.items(): add(k, v * fr['w'] * norm_l)
    for z_ in ZONES:
        K['mass_' + z_] = Nv * (acc.get((z_, 'mass'), 0) * B.MUS_Z * np.ones(N))[:, None]
        K['detail_' + z_] = Nv * (acc.get((z_, 'detail'), 0) * B.DETAIL_K * np.ones(N))[:, None]
    K['bone'] = Nv * (acc.get(('none', 'bone'), 0) * np.ones(N))[:, None]
    return K


def mesh_arrays(ob):
    me = ob.data
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    nr = np.empty(n * 3); me.vertex_normals.foreach_get('vector', nr); nr = nr.reshape(n, 3)
    Pv = b2j_pos(co)
    Nv = np.stack([nr[:, 0], nr[:, 2], -nr[:, 1]], 1)
    return co, Pv, Nv


def add_shape_keys(ob, min_delta=2e-5):
    co, Pv, Nv = mesh_arrays(ob)
    K = compute_keys(Pv, Nv, is_head_part=ob.name in HEAD_PARTS)
    if ob.data.shape_keys: ob.shape_key_clear()
    ob.shape_key_add(name='Basis', from_mix=False)
    kept = []
    for name, d in K.items():
        if np.abs(d).max() < min_delta: continue
        sk = ob.shape_key_add(name=name, from_mix=False)
        sk.slider_min = -1.0; sk.slider_max = 1.0
        sk.data.foreach_set('co', (co + j2b_vec(d)).ravel())
        kept.append((name, int((np.abs(d).max(1) > min_delta).sum()), float(np.abs(d).max())))
    return kept


# ------------------------------------------------------------------ parametros -> influencias
ZONE_FIELD = dict(chest='zChest', back='zBack', delts='zDelts', arms='zArms', abs='zAbs', glutes='zGlutes', quads='zQuads', calves='zCalves')
DEFAULTS = dict(gender='male', heightCm=175, fat=35, muscle=30, shoulders=50, chest=50, waist=50, hips=50, arms=50, legs=50,
                armLen=50, legLen=50, zChest=50, zBack=50, zDelts=50, zArms=50, zAbs=50, zGlutes=50, zQuads=50, zCalves=50)


def influences(p):
    """Misma logica que usara la web: sliders -> peso de cada morph target."""
    p = dict(DEFAULTS, **p)
    g = 1.0 if p['gender'] == 'female' else 0.0
    fat = p['fat'] / 100.0; mus = p['muscle'] / 100.0
    nrm = lambda v: (v - 50.0) / 50.0
    out = dict(gender=g, fat_m=fat * (1 - g), fat_f=fat * g, muscle_gen=mus * (1 - 0.5 * g),
               shoulders=nrm(p['shoulders']), waist=nrm(p['waist']), hips=nrm(p['hips']),
               chest_m=nrm(p['chest']) * (1 - g), chest_f=nrm(p['chest']) * g,
               arms=nrm(p['arms']), legs=nrm(p['legs']), armLen=nrm(p['armLen']), legLen=nrm(p['legLen']))
    lvl = lambda z: min(1.0, max(0.0, mus + (p[ZONE_FIELD[z]] - 50.0) / 100.0))
    levels = {z: lvl(z) for z in ZONE_FIELD}
    levels['hams'] = (levels['quads'] + levels['glutes']) / 2
    definition = min(1.0, max(0.0, 1 - fat * 1.3))
    for z in ZONES:
        ff = 1 + (B.ZONE_FF[z] - 1) * g
        out['mass_' + z] = levels[z] * ff * (1 - 0.3 * fat)
        out['detail_' + z] = (0.3 + 0.7 * levels[z]) * definition * ff
    out['bone'] = 1 - 0.85 * fat
    return out


def apply_values(objs, vals):
    for ob in objs:
        sk = ob.data.shape_keys
        if not sk: continue
        for kb in sk.key_blocks:
            if kb.name == 'Basis': continue
            kb.value = vals.get(kb.name, 0.0)
