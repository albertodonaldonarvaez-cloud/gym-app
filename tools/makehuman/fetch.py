import json, os, urllib.request, sys
H = {'User-Agent': 'x'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u, headers=H)).read()
tree = json.loads(get('https://api.github.com/repos/makehumancommunity/makehuman/git/trees/master?recursive=1'))
out = os.path.dirname(os.path.abspath(__file__))
want_dirs = ['macrodetails', 'measure', 'torso', 'armslegs', 'buttocks', 'stomach', 'hip', 'neck', 'head', 'nose', 'mouth', 'chin', 'eyes', 'forehead', 'cheek', 'ears', 'breast', 'pelvis', 'eyebrows', 'genitals']
n = 0
listing = []
for e in tree['tree']:
    p = e['path']
    if e['type'] != 'blob': continue
    if p == 'makehuman/data/3dobjs/base.obj':
        pass
    elif p.startswith('makehuman/data/targets/') and p.endswith('.target'):
        parts = p.split('/')
        if parts[3] not in want_dirs: continue
    else:
        continue
    listing.append(p)
    dst = os.path.join(out, 'data', p.replace('makehuman/data/', ''))
    if os.path.exists(dst): continue
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, 'wb').write(get('https://raw.githubusercontent.com/makehumancommunity/makehuman/master/' + p))
    n += 1
open(os.path.join(out, 'listing.txt'), 'w').write('\n'.join(listing))
print('downloaded', n, 'of', len(listing))
