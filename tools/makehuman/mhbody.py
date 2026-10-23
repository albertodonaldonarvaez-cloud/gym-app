"""Construye el cuerpo GymAura a partir de la base de MakeHuman (CC0): estado base + morph keys en coordenadas JS (x izq-der, y arriba, z al frente)."""
import numpy as np
import mhlib as M

ETH = ['african', 'asian', 'caucasian']
LV = ['min', 'average', 'max']


def lvl_w(v):
    """Pesos MakeHuman de un parametro 0..1 -> (min, average, max)."""
    mn = max(0.0, 1 - 2 * v); mx = max(0.0, 2 * v - 1)
    return {'min': mn, 'average': 1 - mn - mx, 'max': mx}


def macro(g, mu, wt):
    """Delta (respecto a base.obj) del macro: genero g (0 hombre .. 1 mujer), musculo mu, peso wt en 0..1. Joven, etnia 1/3 cada una."""
    d = np.zeros((M.NBODY, 3))
    for e in ETH:
        d += (1 / 3) * ((1 - g) * M.target(f'macrodetails/{e}-male-young') + g * M.target(f'macrodetails/{e}-female-young'))
    wm, ww = lvl_w(mu), lvl_w(wt)
    for gname, gw in (('male', 1 - g), ('female', g)):
        if gw < 1e-6: continue
        for m in LV:
            if wm[m] < 1e-6: continue
            for w in LV:
                if ww[w] < 1e-6: continue
                d += gw * wm[m] * ww[w] * M.target(f'macrodetails/universal-{gname}-young-{m}muscle-{w}weight')
    return d


def T(name): return M.target(name)


def LR(name):
    """Suma de los targets izquierdo y derecho."""
    return M.target('armslegs/l-' + name) + M.target('armslegs/r-' + name)


def pm(prefix, scale=1.0):
    """Devuelve (key+, key-) para un par decr/incr."""
    return M.target(prefix + '-incr') * scale, -M.target(prefix + '-decr') * scale


def build():
    """Devuelve (P0, keys) con P0 posiciones base (hombre joven promedio) y keys {nombre: delta (N,3)} en metros."""
    V, tris, J = M.load_base()
    Vb = V[:M.NBODY]
    m0 = macro(0.0, 0.5, 0.5)
    P0 = Vb + m0
    K = {}
    # --- macro ---
    K['gender'] = macro(1.0, 0.5, 0.5) - m0
    for g, gn in ((0.0, 'm'), (1.0, 'f')):
        mid = macro(g, 0.5, 0.5)
        K[f'mus_{gn}+'] = macro(g, 1.0, 0.5) - mid
        K[f'mus_{gn}-'] = macro(g, 0.0, 0.5) - mid
        K[f'wt_{gn}+'] = macro(g, 0.5, 1.0) - mid
        K[f'wt_{gn}-'] = macro(g, 0.5, 0.0) - mid
    # --- torso / zonas ---
    K['pec+'], K['pec-'] = pm('torso/torso-muscle-pectoral')
    K['dorsi+'], K['dorsi-'] = pm('torso/torso-muscle-dorsi')
    K['vshape+'], K['vshape-'] = pm('torso/torso-vshape')
    K['bust+'], K['bust-'] = pm('measure/measure-bust-circ')
    K['frontchest+'], K['frontchest-'] = pm('measure/measure-frontchest-dist')
    K['shoulderw+'], K['shoulderw-'] = pm('measure/measure-shoulder-dist')
    K['waist+'], K['waist-'] = pm('measure/measure-waist-circ')
    K['hips+'], K['hips-'] = pm('measure/measure-hips-circ')
    K['abs+'], K['abs-'] = pm('stomach/stomach-tone')
    K['belly+'], K['belly-'] = pm('stomach/stomach-pregnant')
    K['glutes+'], K['glutes-'] = pm('buttocks/buttocks-volume')
    K['neck+'], K['neck-'] = pm('measure/measure-neck-circ')
    # --- brazos / piernas (L+R) ---
    for nm, key in (('upperarm-shoulder-muscle', 'delt'), ('upperarm-muscle', 'bicep'), ('lowerarm-muscle', 'forearm'),
                    ('upperleg-muscle', 'quad'), ('lowerleg-muscle', 'calfm'), ('upperarm-fat', 'armfat'), ('upperleg-fat', 'legfat')):
        K[key + '+'] = LR(nm + '-incr'); K[key + '-'] = -LR(nm + '-decr')
    K['armc+'], K['armc-'] = pm('measure/measure-upperarm-circ')
    K['thigh+'], K['thigh-'] = pm('measure/measure-thigh-circ')
    K['calfc+'], K['calfc-'] = pm('measure/measure-calf-circ')
    ua, ua_ = pm('measure/measure-upperarm-length'); la, la_ = pm('measure/measure-lowerarm-length')
    K['armLen+'], K['armLen-'] = ua + la, ua_ + la_
    ul, ul_ = pm('measure/measure-upperleg-height'); ll, ll_ = pm('measure/measure-lowerleg-height')
    K['legLen+'], K['legLen-'] = ul + ll, ul_ + ll_
    # --- cara ---
    K['face_w+'], K['face_w-'] = pm('head/head-scale-horiz')
    K['head_round'] = T('head/head-round'); K['head_square'] = T('head/head-square')
    K['jaw+'], K['jaw-'] = pm('chin/chin-width')
    K['chin+'], K['chin-'] = pm('chin/chin-prominent')
    K['nose+'] = T('nose/nose-scale-vert-incr') + T('nose/nose-volume-incr') + T('nose/nose-width1-incr')
    K['nose-'] = -(T('nose/nose-scale-vert-decr') + T('nose/nose-volume-decr') + T('nose/nose-width1-decr'))
    K['lips+'] = T('mouth/mouth-upperlip-volume-incr') + T('mouth/mouth-lowerlip-volume-incr')
    K['lips-'] = -(T('mouth/mouth-upperlip-volume-decr') + T('mouth/mouth-lowerlip-volume-decr'))
    K['eyes+'] = T('eyes/l-eye-scale-incr') + T('eyes/r-eye-scale-incr')
    K['eyes-'] = -(T('eyes/l-eye-scale-decr') + T('eyes/r-eye-scale-decr'))
    K['cheek+'] = T('cheek/l-cheek-bones-incr') + T('cheek/r-cheek-bones-incr') + T('cheek/l-cheek-volume-incr') + T('cheek/r-cheek-volume-incr')
    K['cheek-'] = -(T('cheek/l-cheek-bones-decr') + T('cheek/r-cheek-bones-decr') + T('cheek/l-cheek-volume-decr') + T('cheek/r-cheek-volume-decr'))
    return V, tris, J, P0, K
