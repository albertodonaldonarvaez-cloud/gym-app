"""Uso:  blender --background --python tools/blender_body/run_export.py
Reconstruye el cuerpo y escribe web/public/models/gymbody.bin"""
import bpy, sys, os, gzip, importlib
TOOLS = os.path.dirname(os.path.abspath(__file__))
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs, build_base, build_parts, morphs, export_gymbody
for m in (bodydefs, build_base, build_parts, morphs, export_gymbody): importlib.reload(m)

parts = build_parts.build_scene()
for ob in parts.values():
    for p in ob.data.polygons: p.use_smooth = True
out = os.path.normpath(os.path.join(TOOLS, '..', '..', 'web', 'public', 'models', 'gymbody.bin'))
size, ent = export_gymbody.export_body(out)
print('GYMBODY bytes', size, 'gzip', len(gzip.compress(open(out, 'rb').read(), 9)))
print('verts', {k: len(o.data.vertices) for k, o in parts.items()})
