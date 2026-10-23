import sys, numpy as np
sys.path.insert(0, r'c:\Users\donal\Downloads\gym app\tools\makehuman')
import mhlib as M
V, T, J = M.load_base()
print('verts', len(V), 'tris', len(T), 'used', len(np.unique(T)))
print('bbox min', V[:13380].min(0), 'max', V[:13380].max(0))
for k in ['joint-l-eye', 'joint-r-eye', 'joint-l-ankle', 'joint-l-upper-leg', 'joint-pelvis', 'joint-l-knee', 'joint-neck', 'joint-head', 'joint-l-shoulder', 'joint-l-elbow', 'joint-l-hand', 'joint-spine-1']:
    print(k, J.get(k))
i = V[:13380, 2].argmax(); print('max z vert', V[i])
print([k for k in J][:80])
