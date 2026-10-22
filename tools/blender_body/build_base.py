import bpy, bmesh, numpy as np, sys, importlib, math
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
importlib.reload(B)

P0 = B.P()  # varon neutro, magro, sin musculo


def j2b(V):  # JS (x, y arriba, z frente)  ->  Blender (x, y = -z, z = y)   [frente = -Y]
    V = np.asarray(V, float)
    return np.stack([V[:, 0], -V[:, 2], V[:, 1]], 1)


class Soup:
    """Acumula triangulos de varias cascaras cerradas."""
    def __init__(self): self.V = []; self.F = []; self.n = 0
    def add(self, V, F):
        V = np.asarray(V, float); self.V.append(V)
        self.F.extend([(a + self.n, b + self.n, c + self.n) for a, b, c in F]); self.n += len(V)
    def arrays(self): return np.concatenate(self.V), self.F


def loft(rings, seg, flip=False):
    """rings: array (n,5) [y, rx, rz, cx, cz] con y ascendente. Devuelve V, F cerrados con tapas."""
    r = np.asarray(rings, float); n = len(r)
    a = np.arange(seg) / seg * 2 * np.pi
    V = np.zeros((n * seg + 2, 3))
    for i in range(n):
        V[i * seg:(i + 1) * seg, 0] = r[i, 3] + r[i, 1] * np.cos(a)
        V[i * seg:(i + 1) * seg, 1] = r[i, 0]
        V[i * seg:(i + 1) * seg, 2] = r[i, 4] + r[i, 2] * np.sin(a)
    V[-2] = [r[0, 3], r[0, 0], r[0, 4]]; V[-1] = [r[-1, 3], r[-1, 0], r[-1, 4]]
    F = []
    for i in range(n - 1):
        for j in range(seg):
            j2 = (j + 1) % seg
            A, Bv, C, Dv = i * seg + j, i * seg + j2, (i + 1) * seg + j, (i + 1) * seg + j2
            F += [(A, C, Bv), (Bv, C, Dv)]
    for j in range(seg):
        j2 = (j + 1) % seg
        F.append((n * seg, j, j2))                        # tapa inferior (normal -y)
        F.append((n * seg + 1, (n - 1) * seg + j2, (n - 1) * seg + j))  # tapa superior
    if flip: F = [(a_, c_, b_) for a_, b_, c_ in F]
    return V, F


def ellipsoid(c, r, nu=24, nv=14, rot=None):
    u = np.linspace(0, 2 * np.pi, nu, endpoint=False); v = np.linspace(0, np.pi, nv)
    V = [[0, 1, 0]]
    for vv in v[1:-1]:
        for uu in u: V.append([np.sin(vv) * np.cos(uu), np.cos(vv), np.sin(vv) * np.sin(uu)])
    V.append([0, -1, 0]); V = np.array(V) * np.asarray(r)
    if rot is not None: V = V @ np.asarray(rot).T
    V = V + np.asarray(c)
    F = []
    for j in range(nu):
        F.append((0, 1 + (j + 1) % nu, 1 + j))
    for i in range(nv - 3):
        for j in range(nu):
            a = 1 + i * nu + j; b = 1 + i * nu + (j + 1) % nu; c2 = a + nu; d = b + nu
            F += [(a, b, c2), (b, d, c2)]
    last = len(V) - 1
    for j in range(nu):
        F.append((last, 1 + (nv - 3) * nu + j, 1 + (nv - 3) * nu + (j + 1) % nu))
    return V, F


def limb_to_world(V, F, pivot, side, tilt):
    c, s = math.cos(tilt), math.sin(tilt)
    xl, yl, zl = V[:, 0], V[:, 1], V[:, 2]
    W = np.stack([pivot[0] + side * (xl * c - yl * s), pivot[1] + (xl * s + yl * c), zl], 1)
    if side < 0: F = [(a, c_, b) for a, b, c_ in F]
    return W, F


def build_soup(p=P0):
    soup = Soup()
    # torso + cuello (y ascendente)
    ys = np.linspace(B.TORSO_Y0, B.TORSO_Y1, 90)
    rx, rz, cz = B.torso_at(p, ys)
    V, F = loft(np.stack([ys, rx, rz, np.zeros_like(ys), cz], 1), 56); soup.add(V, F)
    sx = B.shoulder_x(p)
    # brazos
    d = np.linspace(B.ARM_LEN, 0, 60); r = B.arm_radius(p, d)
    rings = np.stack([-d, r, r * 1.05, np.zeros_like(d), np.zeros_like(d)], 1)
    for side in (1, -1):
        V, F = loft(rings, 36)
        V, F = limb_to_world(V, F, (side * sx, B.SHOULDER_Y), side, B.ARM_TILT); soup.add(V, F)
    # deltoides (esfera hombro)
    dl = 0.050
    for side in (1, -1):
        V, F = ellipsoid((side * sx, B.SHOULDER_Y - 0.012, 0), (dl, dl * 1.12, dl * 0.95)); soup.add(V, F)
    # piernas + pies
    d = np.linspace(B.LEG_LEN, 0, 80); r = B.leg_radius(p, d)
    rings = np.stack([-d, r, r * 1.04, np.zeros_like(d), np.zeros_like(d)], 1)
    for side in (1, -1):
        V, F = loft(rings, 40)
        V, F = limb_to_world(V, F, (side * B.LEG_X, B.LEG_TOP_Y), side, B.LEG_TILT); soup.add(V, F)
        for (rr, cc) in (((0.037, 0.032, 0.07), (0, -(B.LEG_LEN) - 0.028, 0.03)), ((0.043, 0.02, 0.05), (0, -(B.LEG_LEN) - 0.038, 0.10))):
            V, F = ellipsoid(cc, rr, 20, 12); V, F = limb_to_world(V, F, (side * B.LEG_X, B.LEG_TOP_Y), side, B.LEG_TILT); soup.add(V, F)
    return soup


def make_object(name, V, F, collection):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in j2b(V)], [], F); me.update()
    ob = bpy.data.objects.new(name, me); collection.objects.link(ob)
    return ob


def remesh_object(ob, voxel, smooth_iters=12):
    """Fusiona las cascaras en una piel continua (Remesh voxel) y la suaviza."""
    mod = ob.modifiers.new('rm', 'REMESH'); mod.mode = 'VOXEL'; mod.voxel_size = voxel; mod.adaptivity = 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    ob.modifiers.remove(mod)
    old = ob.data; ob.data = me; bpy.data.meshes.remove(old)
    # Suavizado Taubin (lambda/mu): quita los escalones del voxel sin encoger el volumen
    n = len(me.vertices)
    co = np.empty(n * 3); me.vertices.foreach_get('co', co); co = co.reshape(n, 3)
    ed = np.empty(len(me.edges) * 2, dtype=np.int64); me.edges.foreach_get('vertices', ed); ed = ed.reshape(-1, 2)
    a_, b_ = ed[:, 0], ed[:, 1]
    deg = np.bincount(np.concatenate([a_, b_]), minlength=n).astype(float)[:, None]
    def lap(c):
        acc = np.zeros_like(c)
        np.add.at(acc, a_, c[b_]); np.add.at(acc, b_, c[a_])
        return acc / np.maximum(deg, 1) - c
    for _ in range(smooth_iters):
        co = co + 0.5 * lap(co)
        co = co - 0.53 * lap(co)
    me.vertices.foreach_set('co', co.ravel()); me.update()
    for p in me.polygons: p.use_smooth = True
    return ob
