import sys, numpy as np
sys.path.insert(0, r'c:\Users\donal\Downloads\gym app\tools\makehuman')
import mhbody
V, T, J, P0, K = mhbody.build()
def hgt(P): return P[:, 1].max() - P[:, 1].min()
print('male base h', hgt(P0), 'ymin', P0[:, 1].min())
print('female h', hgt(P0 + K['gender']))
print('male max mus', hgt(P0 + K['mus_m+']), 'wt+', hgt(P0 + K['wt_m+']))
for k, d in K.items():
    m = np.abs(d).max(1)
    print(f'{k:12s} verts>0.3mm {int((m > 3e-4).sum()):6d} max {m.max()*1000:6.1f}mm  dy_top {d[P0[:,1].argmax(),1]*1000:6.1f}')
