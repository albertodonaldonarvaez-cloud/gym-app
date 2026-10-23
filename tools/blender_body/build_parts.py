import bpy, bmesh, numpy as np, math, sys, importlib
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
import build_base as bb
importlib.reload(B); importlib.reload(bb)
from build_base import Soup, ellipsoid, limb_to_world, j2b, make_object, remesh_object, P0

CY = 1.648  # centro del craneo


def rotz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def signed_volume(V, F):
    F = np.asarray(F); a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    return float(np.einsum('ij,ij->i', a, np.cross(b, c)).sum() / 6)


def tube(points, radii, seg=14):
    """Tubo de radio variable a lo largo de una polilinea, con puntas redondeadas (solido cerrado)."""
    pts = np.asarray(points, float); rad = np.asarray(radii, float); n = len(pts)
    tan = np.gradient(pts, axis=0); tan /= np.linalg.norm(tan, axis=1)[:, None]
    ref = np.array([0, 0, 1.0]) if abs(tan[0][2]) < 0.9 else np.array([1.0, 0, 0])
    nrm = np.cross(tan[0], ref); nrm /= np.linalg.norm(nrm)
    V = []; a = np.arange(seg) / seg * 2 * np.pi
    for i in range(n):
        nrm = nrm - tan[i] * np.dot(nrm, tan[i]); nrm /= np.linalg.norm(nrm)
        bn = np.cross(tan[i], nrm)
        for t in a: V.append(pts[i] + rad[i] * (math.cos(t) * nrm + math.sin(t) * bn))
    V.append(pts[0] - tan[0] * rad[0] * 0.8); V.append(pts[-1] + tan[-1] * rad[-1] * 0.8)
    V = np.array(V); F = []
    for i in range(n - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            A, Bv, C, D_ = i * seg + j, i * seg + j2, (i + 1) * seg + j, (i + 1) * seg + j2
            F += [(A, C, Bv), (Bv, C, D_)]
    for j in range(seg):
        j2 = (j + 1) % seg
        F.append((n * seg, j2, j)); F.append((n * seg + 1, (n - 1) * seg + j, (n - 1) * seg + j2))
    if signed_volume(V, F) < 0: F = [(a_, c_, b_) for a_, b_, c_ in F]
    return V, F


def head_soup():
    """Cabeza: perfil suave (craneo + cara + mandibula) + orejas y nariz. El relieve facial se aplica despues."""
    s = Soup()
    prof = np.array([  # y relativo a CY, rx, rz, cz
        [-0.124, 0.016, 0.022, 0.050], [-0.116, 0.030, 0.034, 0.047], [-0.104, 0.043, 0.046, 0.042],
        [-0.088, 0.058, 0.066, 0.032], [-0.066, 0.068, 0.084, 0.018], [-0.040, 0.073, 0.094, 0.006],
        [-0.012, 0.079, 0.100, -0.002], [0.020, 0.082, 0.103, -0.006], [0.050, 0.079, 0.101, -0.008],
        [0.076, 0.066, 0.089, -0.010], [0.093, 0.048, 0.068, -0.011], [0.103, 0.026, 0.040, -0.011], [0.108, 0.008, 0.016, -0.011]])
    ys = np.linspace(prof[0, 0], prof[-1, 0], 56)
    rx = np.interp(ys, prof[:, 0], prof[:, 1]); rz = np.interp(ys, prof[:, 0], prof[:, 2]); cz = np.interp(ys, prof[:, 0], prof[:, 3])
    # suavizado del perfil
    k = np.ones(5) / 5
    pad = lambda a_: np.pad(a_, 2, mode='edge')
    rx, rz, cz = [np.convolve(pad(a_), k, mode='valid') for a_ in (rx, rz, cz)]
    from build_base import loft
    V, F = loft(np.stack([CY + ys, rx, rz, np.zeros_like(ys), cz], 1), 56); s.add(V, F)
    def E(c, r, nu=24, nv=14, rot=None):
        V, F = ellipsoid(c, r, nu, nv, rot); s.add(V, F)
    for sx in (-1, 1):
        E((sx * 0.0825, CY - 0.012, -0.010), (0.013, 0.030, 0.017), 18, 12)    # orejas
        E((sx * 0.0105, CY - 0.034, 0.097), (0.0070, 0.0075, 0.0075), 14, 10)  # alas de la nariz
    E((0, CY - 0.002, 0.099), (0.0062, 0.022, 0.010), 14, 10)                  # puente nasal
    E((0, CY - 0.024, 0.099), (0.010, 0.019, 0.014), 18, 12)                   # nariz
    E((0, CY - 0.035, 0.105), (0.0080, 0.0075, 0.0085), 14, 10)                # punta
    return s


FACE_RELIEF = [  # centro (x, y_rel, z), radios, amplitud (m) a lo largo de la normal; espejo en x
    ((0.0, 0.036, 0.090), (0.050, 0.009, 0.020), 0.0070),     # arco superciliar
    ((0.041, 0.034, 0.084), (0.020, 0.010, 0.020), 0.0045),
    ((0.032, 0.016, 0.090), (0.017, 0.013, 0.020), -0.0055),  # cuenca del ojo
    ((0.046, -0.016, 0.079), (0.021, 0.014, 0.022), 0.0060),  # pomulo
    ((0.070, 0.022, 0.050), (0.016, 0.024, 0.030), -0.0040),  # sien
    ((0.034, -0.050, 0.071), (0.017, 0.022, 0.019), -0.0040), # debajo del pomulo
    ((0.0, -0.063, 0.085), (0.034, 0.026, 0.024), 0.0040),    # zona de la boca
    ((0.0, -0.106, 0.057), (0.018, 0.016, 0.016), 0.0030),    # menton
]


def apply_face_relief(ob):
    import morphs
    importlib.reload(morphs)
    co, Pv, Nv = morphs.mesh_arrays(ob)
    d = np.zeros(len(Pv))
    for (cx, cy_, cz_), (rx_, ry_, rz_), amp in FACE_RELIEF:
        for sx in ((1, -1) if cx != 0 else (1,)):
            c = np.array([sx * cx, CY + cy_, cz_])
            q = ((Pv[:, 0] - c[0]) / rx_) ** 2 + ((Pv[:, 1] - c[1]) / ry_) ** 2 + ((Pv[:, 2] - c[2]) / rz_) ** 2
            d += amp * np.exp(-q)
    newP = Pv + Nv * d[:, None]
    ob.data.vertices.foreach_set('co', morphs.j2b_vec(newP).ravel()); ob.data.update()


def hand_soup():
    """Mano relajada con 4 dedos de forma suave + pulgar (coordenadas locales: origen en la muñeca, -y hacia los dedos)."""
    s = Soup()
    V, F = ellipsoid((0, -0.040, 0), (0.0315, 0.042, 0.0135), 28, 16); s.add(V, F)
    specs = [(-0.0245, 0.072, 0.9, 0.0070), (-0.0082, 0.082, 1.0, 0.0073), (0.0082, 0.078, 0.95, 0.0070), (0.0245, 0.062, 0.8, 0.0062)]
    for fx, L, k, r0 in specs:
        ts = np.array([0, 0.30, 0.58, 0.82, 1.0])
        pts = [(fx + 0.0 * t, -0.074 - L * t, 0.002 + 0.018 * k * t ** 2) for t in ts]
        rad = [r0 * 1.05, r0, r0 * 0.9, r0 * 0.78, r0 * 0.60]
        V, F = tube(pts, rad, 12); s.add(V, F)
    pts = [(0.026, -0.052, 0.008), (0.039, -0.070, 0.014), (0.047, -0.094, 0.020), (0.049, -0.114, 0.026)]
    V, F = tube(pts, [0.0112, 0.0095, 0.0078, 0.0062], 12); s.add(V, F)
    return s


def place_hand(V, F, p, side):
    sx = B.shoulder_x(p)
    local = V.copy(); local[:, 1] += -B.ARM_LEN + 0.026
    return limb_to_world(local, F, (side * sx, B.SHOULDER_Y), side, B.ARM_TILT)


def cut_face(V, F, hairline=0.074):
    """Quita los triangulos que cubririan la cara y alisa el borde para una linea de cabello limpia."""
    F = np.asarray(F); c = V[F].mean(1)
    face = (c[:, 2] > 0.0) & (c[:, 1] < CY + hairline + 0.12 * c[:, 2]) & (np.abs(c[:, 0]) < 0.075)
    F = F[~face]
    # aristas de borde (usadas por un solo triangulo)
    e = np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1)
    key = e[:, 0].astype(np.int64) * (len(V) + 1) + e[:, 1]
    uniq, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    bmask = cnt[inv] == 1
    be = e[bmask]
    if len(be):
        nbr = {}
        for a_, b_ in be: nbr.setdefault(int(a_), []).append(int(b_)); nbr.setdefault(int(b_), []).append(int(a_))
        V = V.copy()
        for _ in range(14):
            Vn = V.copy()
            for v, ns in nbr.items(): Vn[v] = 0.5 * V[v] + 0.5 * V[ns].mean(0)
            V = Vn
    return V, [tuple(f) for f in F]


def hair_soups():
    out = {}
    def S_(items, cut=True):
        s = Soup()
        for c, r in items:
            V, F = ellipsoid(c, r, 60, 40); s.add(V, F)
        V, F = s.arrays()
        if cut: V, F = cut_face(V, F)
        return V, F
    out['short'] = S_([((0, CY + 0.034, -0.026), (0.0968, 0.098, 0.1155)), ((0, CY - 0.012, -0.058), (0.086, 0.068, 0.066))])
    out['buzz'] = S_([((0, CY + 0.006, -0.002), (0.0868, 0.1032, 0.1032))], True)
    out['long'] = S_([((0, CY + 0.034, -0.026), (0.0968, 0.098, 0.1155)), ((0, 1.55, -0.055), (0.122, 0.17, 0.092))])
    out['curly'] = S_([((0, CY + 0.04, -0.012), (0.125, 0.122, 0.13))])
    V, F = S_([((0, CY + 0.034, -0.026), (0.0968, 0.098, 0.1155))])
    s = Soup(); s.add(V, F)
    tv, tf = tube([(0, CY + 0.045, -0.095), (0, CY + 0.005, -0.150), (0, CY - 0.07, -0.165), (0, CY - 0.16, -0.150)],
                  [0.028, 0.030, 0.026, 0.012], 14)
    s.add(tv, tf); out['ponytail'] = s.arrays()
    s = Soup(); s.add(V, F)
    bv, bf = ellipsoid((0, CY + 0.125, -0.045), (0.046, 0.042, 0.046), 24, 16); s.add(bv, bf); out['bun'] = s.arrays()
    return out


def shoe_soups():
    """Tenis (suela + capellada) para ambos pies, en coordenadas locales del tobillo."""
    upper, sole = Soup(), Soup()
    def U(c, r, nu=24, nv=14, rot=None): V, F = ellipsoid(c, r, nu, nv, rot); upper.add(V, F)
    def O(c, r, nu=24, nv=12): V, F = ellipsoid(c, r, nu, nv); sole.add(V, F)
    U((0, -0.030, 0.030), (0.046, 0.040, 0.088))      # cuerpo
    U((0, -0.040, 0.105), (0.046, 0.030, 0.064))      # puntera
    U((0, -0.006, -0.008), (0.038, 0.026, 0.044))     # cuello / talon
    O((0, -0.066, 0.052), (0.050, 0.013, 0.122), 28, 14)   # suela
    O((0, -0.060, 0.050), (0.052, 0.009, 0.126), 28, 12)
    return upper, sole


def place_shoes(soup, side):
    V, F = soup.arrays(); V = V.copy(); V[:, 1] += -B.LEG_LEN
    return limb_to_world(V, F, (side * B.LEG_X, B.LEG_TOP_Y), side, B.LEG_TILT)


def make_parts(col, voxel_head=0.0050, voxel_hand=0.0032):
    parts = {}
    def smooth(ob):
        for p_ in ob.data.polygons: p_.use_smooth = True
        return ob
    V, F = head_soup().arrays(); ob = make_object('Head', V, F, col); remesh_object(ob, voxel_head, 14); apply_face_relief(ob); parts['Head'] = ob
    soup = Soup()
    for side in (1, -1):
        Vh, Fh = hand_soup().arrays(); Vw, Fw = place_hand(Vh, Fh, P0, side); soup.add(Vw, Fw)
    V, F = soup.arrays(); ob = make_object('Hands', V, F, col); remesh_object(ob, voxel_hand, 8); parts['Hands'] = ob

    def pair(name, c, r, nu=14, nv=10, rot=None, xsym=True):
        s = Soup()
        for sx in ((-1, 1) if xsym else (1,)):
            V, F = ellipsoid((sx * c[0], c[1], c[2]), r, nu, nv, rot(sx) if callable(rot) else rot); s.add(V, F)
        V, F = s.arrays(); parts[name] = smooth(make_object(name, V, F, col))
    pair('EyeWhite', (0.032, CY + 0.016, 0.084), (0.0108, 0.0078, 0.0066))
    pair('Iris', (0.032, CY + 0.016, 0.0885), (0.0062, 0.0062, 0.0034))
    pair('Pupil', (0.032, CY + 0.016, 0.0912), (0.0030, 0.0030, 0.0016), 10, 8)
    pair('Brows', (0.032, CY + 0.034, 0.086), (0.017, 0.0036, 0.006), 14, 8, rot=lambda sx: rotz(sx * -0.12))
    s = Soup()
    V, F = ellipsoid((0, CY - 0.062, 0.092), (0.020, 0.0046, 0.0075), 18, 8); s.add(V, F)
    V, F = ellipsoid((0, CY - 0.071, 0.091), (0.018, 0.0058, 0.0078), 18, 8); s.add(V, F)
    V, F = s.arrays(); parts['Lips'] = smooth(make_object('Lips', V, F, col))
    for style, (V, F) in hair_soups().items():
        parts['Hair_' + style] = smooth(make_object('Hair_' + style, V, F, col))
    up, so = shoe_soups(); su, ss = Soup(), Soup()
    for side in (1, -1):
        V, F = place_shoes(up, side); su.add(V, F)
        V, F = place_shoes(so, side); ss.add(V, F)
    V, F = su.arrays(); ob = make_object('ShoeUpper', V, F, col); remesh_object(ob, 0.0065, 6); parts['ShoeUpper'] = ob
    V, F = ss.arrays(); ob = make_object('ShoeSole', V, F, col); remesh_object(ob, 0.0065, 6); parts['ShoeSole'] = ob
    return parts


def build_scene(voxel_body=0.0100):
    """Reconstruye toda la escena base desde cero (reproducible)."""
    if bpy.context.window is not None:
        sc = bpy.data.scenes.get('GymBody') or bpy.data.scenes.new('GymBody')
        bpy.context.window.scene = sc
    else:
        sc = bpy.context.scene
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)
    col = sc.collection
    V, F = bb.build_soup().arrays()
    skin = make_object('Skin', V, F, col)
    remesh_object(skin, voxel_body, 16)
    parts = make_parts(col)
    parts['Skin'] = skin
    for ob in parts.values():
        for p in ob.data.polygons: p.use_smooth = True
    return parts
