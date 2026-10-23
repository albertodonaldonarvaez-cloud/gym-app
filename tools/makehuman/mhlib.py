"""Utilidades para leer la malla base y los targets de MakeHuman (CC0)."""
import os, numpy as np
ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
NBODY = 13380


def load_base():
    """Devuelve (V[N,3] metros, tris[M,3], joints{nombre: centro}) con la malla de cuerpo (primeros 13380 vertices)."""
    verts, groups, cur, faces_by_group = [], {}, None, {}
    with open(os.path.join(DATA, '3dobjs', 'base.obj'), 'r', encoding='utf-8') as f:
        for ln in f:
            if ln.startswith('v '):
                verts.append([float(t) for t in ln.split()[1:4]])
            elif ln.startswith('g '):
                cur = ln.split()[1]; faces_by_group.setdefault(cur, [])
            elif ln.startswith('f '):
                faces_by_group[cur].append([int(t.split('/')[0]) - 1 for t in ln.split()[1:]])
    V = np.array(verts) * 0.1
    tris = []
    for q in faces_by_group['body']:
        for k in range(1, len(q) - 1): tris.append([q[0], q[k], q[k + 1]])
    tris = np.array(tris, np.int64)
    joints = {}
    for g, fl in faces_by_group.items():
        if g.startswith('joint-') and fl:
            ids = sorted({i for q in fl for i in q}); joints[g] = V[ids].mean(0)
    return V, tris, joints


_cache = {}


def target(path, n=NBODY):
    """Lee targets/<path>.target -> delta denso (n,3) en metros. Devuelve ceros si el archivo no existe."""
    if path in _cache: return _cache[path]
    fn = os.path.join(DATA, 'targets', path + '.target')
    d = np.zeros((n, 3))
    if not os.path.exists(fn):
        raise FileNotFoundError(fn)
    with open(fn, 'r') as f:
        for ln in f:
            if ln.startswith('#') or not ln.strip(): continue
            t = ln.split()
            i = int(t[0])
            if i < n: d[i] = [float(t[1]), float(t[2]), float(t[3])]
    d *= 0.1
    _cache[path] = d
    return d
