"""Definiciones anatomicas compartidas (port 1:1 del modelo procedural de la web).
Coordenadas "JS": x derecha(+) del cuerpo, y arriba, z frente. Se convierten a Blender al crear mallas."""
import numpy as np

FAT_K = 1.9
MUS_Z = 2.2
DETAIL_K = 1.8
ARM_LEN = 0.58
LEG_LEN = 0.86
LEG_TOP_Y = 0.93
SHOULDER_Y = 1.37
TORSO_Y0 = 0.86
TORSO_Y1 = 1.55
TOP_Y = 1.753
ARM_TILT = 0.16
LEG_TILT = 0.035
LEG_X = 0.090

TORSO_M = np.array([
    [0.86, 0.158, 0.100], [0.93, 0.170, 0.105], [1.00, 0.152, 0.098], [1.07, 0.142, 0.090],
    [1.15, 0.152, 0.098], [1.24, 0.172, 0.110], [1.32, 0.188, 0.100], [1.38, 0.196, 0.080],
    [1.41, 0.158, 0.074], [1.44, 0.118, 0.070], [1.47, 0.088, 0.066], [1.51, 0.062, 0.060], [1.55, 0.052, 0.056]])
TORSO_F = np.array([
    [0.86, 0.158, 0.098], [0.93, 0.182, 0.112], [1.00, 0.150, 0.096], [1.07, 0.122, 0.082],
    [1.15, 0.132, 0.090], [1.24, 0.150, 0.104], [1.32, 0.162, 0.092], [1.38, 0.170, 0.074],
    [1.41, 0.136, 0.068], [1.44, 0.100, 0.062], [1.47, 0.068, 0.057], [1.51, 0.052, 0.052], [1.55, 0.046, 0.048]])
ARM = np.array([[0, 0.056], [0.06, 0.054], [0.16, 0.047], [0.24, 0.041], [0.28, 0.037],
                [0.33, 0.040], [0.42, 0.035], [0.53, 0.030], [0.58, 0.029]])
LEG = np.array([[0, 0.082], [0.08, 0.088], [0.20, 0.082], [0.32, 0.066], [0.40, 0.054], [0.44, 0.050],
                [0.50, 0.052], [0.58, 0.056], [0.66, 0.046], [0.76, 0.034], [0.86, 0.031]])


def lerp(a, b, t): return a + (b - a) * t
def bump(x, c, w): return np.exp(-(((x - c) / w) ** 2))
def norm(v): return (v - 50.0) / 50.0
def smooth01(x): x = np.clip(x, 0, 1); return x * x * (3 - 2 * x)


def sample(tab, x, k):
    x = np.asarray(x, float); n = len(tab); xs = tab[:, 0]
    i = np.clip(np.searchsorted(xs, x, side='right') - 1, 0, n - 2)
    u = np.clip((x - xs[i]) / (xs[i + 1] - xs[i]), 0, 1)
    p0 = tab[np.maximum(i - 1, 0), k]; p1 = tab[i, k]; p2 = tab[i + 1, k]; p3 = tab[np.minimum(i + 2, n - 1), k]
    return 0.5 * (2 * p1 + (-p0 + p2) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (-p0 + 3 * p1 - 3 * p2 + p3) * u ** 3)


def P(**kw):
    d = dict(g=0.0, fat=0.0, muscle=0.0, shoulders=50.0, chest=50.0, waist=50.0, hips=50.0, arms=50.0, legs=50.0)
    d.update(kw)
    return d


def torso_at(p, y):
    """Radios (rx, rz) y desplazamiento frontal cz del torso a la altura y (vectorizado)."""
    y = np.asarray(y, float)
    g = p['g']; gM = 1 - g; gF = g
    f = (p['fat'] / 100) * FAT_K; m = (p['muscle'] / 100) * 1.4
    sh = norm(p['shoulders']); ch = norm(p['chest']); wa = norm(p['waist']); hi = norm(p['hips'])
    rx = lerp(sample(TORSO_M, y, 1), sample(TORSO_F, y, 1), g)
    rz = lerp(sample(TORSO_M, y, 2), sample(TORSO_F, y, 2), g)
    cz = np.zeros_like(y)
    belly = bump(y, 1.06, 0.10); hipB = bump(y, 0.93, 0.09); ribs = bump(y, 1.17, 0.09)
    chestB = bump(y, 1.26, 0.08); bustB = bump(y, 1.22, 0.06); shoulderB = bump(y, 1.36, 0.06)
    waistB = bump(y, 1.07, 0.08); neckB = bump(y, 1.50, 0.05)
    rx = rx + f * ((0.050 * gM + 0.035 * gF) * belly + (0.030 * gM + 0.028 * gF) * hipB + 0.018 * ribs + 0.008 + 0.012 * neckB)
    rz = rz + f * ((0.060 * gM + 0.040 * gF) * belly + (0.020 * gM + 0.030 * gF) * hipB + 0.015 * ribs + 0.008 + 0.012 * neckB)
    cz = cz + f * (0.030 * gM + 0.018 * gF) * belly
    rx = rx + m * ((0.020 * gM + 0.010 * gF) * shoulderB + (0.012 * gM + 0.006 * gF) * ribs + 0.010 * gM * neckB)
    rz = rz + m * ((0.008 * gM + 0.004 * gF) * chestB + 0.006 * bump(y, 1.0, 0.12) + 0.008 * gM * neckB)
    rx = rx + sh * 0.032 * shoulderB
    rx = rx + wa * 0.035 * waistB; rz = rz + wa * 0.025 * waistB
    rx = rx + hi * 0.030 * hipB; rz = rz + hi * 0.026 * hipB
    rz = rz + ch * (0.014 * gM + 0.022 * gF) * (gM * chestB + gF * bustB)
    cz = cz + ch * (0.004 * gM + 0.020 * gF) * (gM * chestB + gF * bustB)
    cz = cz + gF * 0.012 * bustB
    rz = rz + gF * 0.006 * bustB
    return np.maximum(rx, 0.02), np.maximum(rz, 0.02), cz


def arm_radius(p, d):
    d = np.asarray(d, float)
    g = p['g']; f = (p['fat'] / 100) * FAT_K; ar = norm(p['arms'])
    r = sample(ARM, d, 1) * lerp(1, 0.86, g)
    r = r + f * (1 + 0.2 * g) * (0.016 * bump(d, 0.2, 0.14) + 0.008 * bump(d, 0.4, 0.1))
    r = r + ar * 0.012 * (bump(d, 0.18, 0.14) + 0.5 * bump(d, 0.38, 0.1))
    return np.maximum(r, 0.015)


def leg_radius(p, d):
    d = np.asarray(d, float)
    g = p['g']; gM = 1 - g; gF = g
    f = (p['fat'] / 100) * FAT_K; lg = norm(p['legs'])
    thigh = 0.7 * gM + 1.15 * gF
    r = sample(LEG, d, 1)
    r = r + f * (0.034 * thigh * bump(d, 0.16, 0.14) + 0.010 * bump(d, 0.58, 0.09))
    r = r + lg * (0.026 * bump(d, 0.20, 0.18) + 0.012 * bump(d, 0.58, 0.09))
    return np.maximum(r, 0.02)


def shoulder_x(p):
    return float(torso_at(p, 1.36)[0]) - 0.004


# --------------------------------------------------------------------------- musculos
def _mirror_th(th): return ((180 - th) % 360 + 360) % 360


def S(**d):
    m = _mirror_th(d['th'])
    return [d] if abs(m - d['th']) < 0.5 else [d, dict(d, th=m)]


def D(z, k, th, c, wth, wc, amp, p=2, fF=1.0):
    return dict(z=z, k=k, th=th, c=c, wth=wth, wc=wc, amp=amp, p=p, fF=fF)


ROWS_ABS = [1.165, 1.11, 1.055, 1.0]
TORSO_DEFS = []
def _add(L, *items):
    for it in items: L.extend(it)
_add(TORSO_DEFS,
     S(**D('chest', 'mass', 64, 1.295, 20, 0.045, 0.016, fF=0.55)),
     S(**D('chest', 'mass', 60, 1.245, 24, 0.05, 0.024, 2.2, 0.55)),
     S(**D('chest', 'mass', 30, 1.275, 16, 0.045, 0.012, fF=0.55)),
     [D('chest', 'detail', 90, 1.255, 3.5, 0.075, -0.011)],
     S(**D('chest', 'detail', 62, 1.19, 26, 0.011, -0.008)),
     S(**D('abs', 'detail', 30, 1.185, 7, 0.013, 0.007)),
     S(**D('abs', 'detail', 30, 1.145, 7, 0.013, 0.007)),
     S(**D('abs', 'detail', 30, 1.105, 7, 0.013, 0.007)),
     S(**D('abs', 'mass', 84, 1.08, 9, 0.095, 0.013, 3)))
for _c in ROWS_ABS:
    _add(TORSO_DEFS, S(**D('abs', 'detail', 84, _c, 7, 0.021, 0.0085, 2.4)))
_add(TORSO_DEFS,
     [D('abs', 'detail', 90, 1.085, 2.6, 0.10, -0.007)],
     S(**D('abs', 'mass', 52, 1.07, 17, 0.065, 0.011)),
     [D('abs', 'detail', 90, 1.03, 4, 0.012, -0.008)],
     S(**D('back', 'mass', 238, 1.405, 30, 0.05, 0.018, fF=0.7)),
     S(**D('back', 'mass', 262, 1.31, 20, 0.07, 0.014, fF=0.7)),
     S(**D('back', 'mass', 244, 1.32, 15, 0.05, 0.014, fF=0.8)),
     S(**D('back', 'detail', 236, 1.32, 3, 0.055, -0.006)),
     S(**D('back', 'mass', 218, 1.17, 26, 0.095, 0.022, fF=0.7)),
     S(**D('back', 'mass', 188, 1.2, 13, 0.07, 0.013, fF=0.7)),
     [D('back', 'detail', 270, 1.17, 2.6, 0.27, -0.009)],
     S(**D('back', 'mass', 262, 1.03, 7, 0.12, 0.010)),
     S(**D('glutes', 'mass', 248, 0.925, 21, 0.065, 0.030, fF=1.25)),
     S(**D('glutes', 'mass', 238, 0.99, 15, 0.04, 0.010)),
     S(**D('glutes', 'detail', 258, 0.875, 19, 0.010, -0.010)),
     [D('glutes', 'detail', 270, 0.915, 2.6, 0.075, -0.009)],
     S(**D('none', 'bone', 76, 1.38, 20, 0.011, 0.007)),
     [D('none', 'bone', 90, 1.405, 7, 0.012, -0.006)],
     S(**D('none', 'bone', 54, 0.91, 12, 0.02, 0.007)))

ARM_DEFS = [
    D('delts', 'mass', 70, 0.075, 36, 0.075, 0.018), D('delts', 'mass', 5, 0.065, 36, 0.075, 0.022),
    D('delts', 'mass', 300, 0.075, 36, 0.075, 0.018),
    D('delts', 'detail', 38, 0.10, 3, 0.07, -0.004), D('delts', 'detail', 335, 0.10, 3, 0.07, -0.004),
    D('arms', 'mass', 96, 0.175, 32, 0.075, 0.018), D('arms', 'mass', 38, 0.20, 20, 0.05, 0.007),
    D('arms', 'mass', 258, 0.15, 26, 0.08, 0.019), D('arms', 'mass', 322, 0.135, 20, 0.06, 0.014),
    D('arms', 'detail', 290, 0.14, 3, 0.07, -0.006),
    D('arms', 'mass', 15, 0.34, 28, 0.065, 0.011), D('arms', 'mass', 105, 0.37, 34, 0.075, 0.007),
    D('arms', 'mass', 285, 0.37, 34, 0.075, 0.007), D('none', 'bone', 270, 0.285, 22, 0.018, 0.006),
]
LEG_DEFS = [
    D('quads', 'mass', 88, 0.2, 19, 0.1, 0.018), D('quads', 'mass', 34, 0.22, 24, 0.115, 0.022),
    D('quads', 'mass', 142, 0.33, 21, 0.06, 0.022),
    D('quads', 'detail', 62, 0.21, 3, 0.14, -0.007), D('quads', 'detail', 118, 0.22, 3, 0.11, -0.007),
    D('quads', 'mass', 172, 0.14, 20, 0.09, 0.005),
    D('hams', 'mass', 296, 0.2, 25, 0.12, 0.018), D('hams', 'mass', 244, 0.2, 22, 0.12, 0.016),
    D('hams', 'detail', 270, 0.2, 3, 0.13, -0.007),
    D('calves', 'mass', 236, 0.555, 23, 0.065, 0.024), D('calves', 'mass', 304, 0.525, 21, 0.06, 0.019),
    D('calves', 'detail', 270, 0.54, 3, 0.07, -0.007),
    D('calves', 'mass', 270, 0.66, 34, 0.06, 0.008), D('calves', 'mass', 78, 0.58, 15, 0.09, 0.008),
    D('none', 'bone', 90, 0.435, 20, 0.028, 0.009), D('none', 'bone', 90, 0.62, 7, 0.09, 0.004),
    D('none', 'bone', 0, 0.80, 22, 0.02, 0.005), D('none', 'bone', 180, 0.80, 22, 0.02, 0.005),
]
ZONE_FF = dict(chest=0.55, back=0.72, abs=1.0, glutes=1.25, delts=1.0, arms=1.0, quads=1.0, hams=1.0, calves=1.0, none=1.0)


def field(defs, c, th_deg, widen_detail=1.0):
    """Suma por (zona, tipo) de amp*peso para cada punto (c, th). Devuelve dict -> array."""
    out = {}
    c = np.asarray(c, float); th = np.asarray(th_deg, float)
    for d in defs:
        p = d['p']
        wm = 1.0 if d['k'] == 'mass' else widen_detail
        dc = np.abs((c - d['c']) / (d['wc'] * wm))
        dth = np.abs(((th - d['th']) % 360 + 540) % 360 - 180) / (d['wth'] * wm)
        w = np.exp(-(dc ** p + dth ** p))
        w[(dc > 2.6) | (dth > 2.6)] = 0
        key = (d['z'], d['k'])
        out[key] = out.get(key, 0) + d['amp'] * w
    return out
