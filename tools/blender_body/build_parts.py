import bpy, bmesh, numpy as np, math, sys, importlib
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
import build_base as bb
importlib.reload(B); importlib.reload(bb)
from build_base import Soup, ellipsoid, loft, limb_to_world, j2b, make_object, remesh_object, P0


def rotz(a):
    c, s = math.cos(a), math.sin(a)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


def head_soup():
    s = Soup(); cy = 1.655
    def E(c, r, nu=32, nv=20, rot=None):
        V, F = ellipsoid(c, r, nu, nv, rot); s.add(V, F)
    E((0, cy, 0), (0.082, 0.098, 0.098), 40, 26)                 # craneo
    E((0, cy - 0.065, 0.014), (0.068, 0.074, 0.083), 36, 22)       # mandibula
    E((0, cy - 0.108, 0.052), (0.034, 0.026, 0.030), 24, 16)       # menton
    E((0, cy - 0.015, 0.055), (0.062, 0.062, 0.05), 28, 18)        # pomulos / cara
    for sx in (-1, 1):
        E((sx * 0.083, cy - 0.01, -0.004), (0.012, 0.028, 0.016), 16, 12)   # orejas
    E((0, cy - 0.022, 0.099), (0.011, 0.020, 0.015), 18, 12)       # nariz
    E((0, cy - 0.034, 0.104), (0.0085, 0.008, 0.008), 14, 10)      # punta nariz
    return s


def hand_soup(side):
    """Mano relajada (palma + dedos fusionados con leve curva + pulgar), coordenadas locales del brazo."""
    s = Soup()
    def E(c, r, nu=24, nv=14, rot=None):
        V, F = ellipsoid(c, r, nu, nv, rot); s.add(V, F)
    E((0, -0.040, 0), (0.0315, 0.042, 0.0135))                  # palma
    E((0, -0.100, 0.004), (0.0285, 0.056, 0.0112))              # dedos
    E((0, -0.146, 0.009), (0.0245, 0.030, 0.0098))              # puntas
    E((0.027, -0.058, 0.008), (0.0112, 0.032, 0.0105), 16, 10, rotz(0.50))   # pulgar base
    E((0.038, -0.088, 0.013), (0.0098, 0.024, 0.0095), 16, 10, rotz(0.30))   # pulgar punta
    V, F = s.arrays()
    return V, F


def place_hand(V, F, p, side):
    sx = B.shoulder_x(p)
    local = V.copy(); local[:, 1] += -B.ARM_LEN + 0.026
    return limb_to_world(local, F, (side * sx, B.SHOULDER_Y), side, B.ARM_TILT)


def make_parts(col, voxel_head=0.0055, voxel_hand=0.0042):
    parts = {}
    hs = head_soup(); V, F = hs.arrays()
    ob = make_object('Head', V, F, col); remesh_object(ob, voxel_head, 8); parts['Head'] = ob
    soup = Soup()
    for side in (1, -1):
        Vh, Fh = hand_soup(side); Vw, Fw = place_hand(Vh, Fh, P0, side); soup.add(Vw, Fw)
    V, F = soup.arrays(); ob = make_object('Hands', V, F, col); remesh_object(ob, voxel_hand, 8); parts['Hands'] = ob

    def single(name, c, r, nu=20, nv=14, rot=None):
        V, F = ellipsoid(c, r, nu, nv, rot); ob = make_object(name, V, F, col)
        for p_ in ob.data.polygons: p_.use_smooth = True
        parts[name] = ob
    cy = 1.655
    # ojos (esclerotica + iris), cejas, labios
    s = Soup()
    for sx in (-1, 1):
        V, F = ellipsoid((sx * 0.032, cy + 0.016, 0.089), (0.0105, 0.0075, 0.006), 14, 10); s.add(V, F)
    V, F = s.arrays(); ob = make_object('EyeWhite', V, F, col); [setattr(p_, 'use_smooth', True) for p_ in ob.data.polygons]; parts['EyeWhite'] = ob
    s = Soup()
    for sx in (-1, 1):
        V, F = ellipsoid((sx * 0.032, cy + 0.016, 0.0925), (0.0058, 0.0058, 0.0045), 12, 8); s.add(V, F)
    V, F = s.arrays(); ob = make_object('Iris', V, F, col); [setattr(p_, 'use_smooth', True) for p_ in ob.data.polygons]; parts['Iris'] = ob
    s = Soup()
    for sx in (-1, 1):
        V, F = ellipsoid((sx * 0.032, cy + 0.034, 0.088), (0.017, 0.0035, 0.006), 14, 8, rotz(sx * -0.12)); s.add(V, F)
    V, F = s.arrays(); ob = make_object('Brows', V, F, col); [setattr(p_, 'use_smooth', True) for p_ in ob.data.polygons]; parts['Brows'] = ob
    single('Lips', (0, cy - 0.066, 0.092), (0.021, 0.0045, 0.007), 16, 8)
    # cabello: corto (hombre) y melena larga (mujer)
    single('HairM', (0, cy + 0.034, -0.026), (0.0968, 0.098, 0.1155), 36, 22)
    s = Soup()
    V, F = ellipsoid((0, 1.55, -0.055), (0.122, 0.17, 0.092), 36, 22); s.add(V, F)
    V, F = ellipsoid((0, cy + 0.034, -0.026), (0.0968, 0.098, 0.1155), 36, 22); s.add(V, F)
    V, F = s.arrays(); ob = make_object('HairF', V, F, col); [setattr(p_, 'use_smooth', True) for p_ in ob.data.polygons]; parts['HairF'] = ob
    return parts


def build_scene(voxel_body=0.0115):
    """Reconstruye toda la escena base desde cero (reproducible)."""
    if bpy.context.window is not None:      # Blender con interfaz: escena aparte para no tocar la del usuario
        sc = bpy.data.scenes.get('GymBody') or bpy.data.scenes.new('GymBody')
        bpy.context.window.scene = sc
    else:                                   # modo --background: se usa la escena por defecto
        sc = bpy.context.scene
    for o in list(sc.objects): bpy.data.objects.remove(o, do_unlink=True)
    for m in list(bpy.data.meshes):
        if m.users == 0: bpy.data.meshes.remove(m)
    col = sc.collection
    V, F = bb.build_soup().arrays()
    skin = make_object('Skin', V, F, col)
    remesh_object(skin, voxel_body, 14)
    parts = make_parts(col)
    parts['Skin'] = skin
    return parts
