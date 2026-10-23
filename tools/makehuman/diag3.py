import sys, json, numpy as np
sys.path.insert(0, r'c:\Users\donal\Downloads\gym app\tools\makehuman')
import mhbody, mhlib as M
V, T, J, P0, K = mhbody.build()
W = json.load(open(r'c:\Users\donal\Downloads\gym app\tools\makehuman\data\rigs\default_weights.mhw'))['weights']
print(sorted(W.keys()))
bones = sorted(W.keys()); n = M.NBODY
Wm = np.zeros((n, len(bones)))
for j, b in enumerate(bones):
    for i, w in W[b]:
        if i < n: Wm[i, j] = w
dom = np.array(bones)[Wm.argmax(1)]
y0 = P0[:, 1].min()
print('ymin', y0, 'top', P0[:, 1].max() - y0)
for k in ['joint-pelvis', 'joint-spine-1', 'joint-spine-2', 'joint-spine-3', 'joint-spine-4', 'joint-neck', 'joint-head', 'joint-l-shoulder', 'joint-l-clavicle', 'joint-l-elbow', 'joint-l-hand', 'joint-l-knee', 'joint-l-ankle', 'joint-l-upper-leg']:
    print(k, np.round(J[k] - [0, y0, 0], 3))
# perfil del torso: ancho (x) por y para vertices dominados por huesos de torso
torso = np.array([d.startswith(('spine', 'pelvis', 'clavicle', 'breast', 'shoulder', 'neck')) for d in dom])
for y in np.arange(0.70, 1.62, 0.04):
    sel = torso & (np.abs(P0[:, 1] - y0 - y) < 0.02)
    if sel.sum(): print(f'y={y:.2f} n={sel.sum():4d} halfx={np.abs(P0[sel,0]).max():.3f} zmax={P0[sel,2].max():.3f} zmin={P0[sel,2].min():.3f}')
print({d: int((dom == d).sum()) for d in sorted(set(dom))})
