import bpy, bmesh, numpy as np, sys, importlib, os
TOOLS = r"c:\Users\donal\Downloads\gym app\tools\blender_body"
if TOOLS not in sys.path: sys.path.insert(0, TOOLS)
import bodydefs as B
import morphs
importlib.reload(B); importlib.reload(morphs)

MATS = {
    'Skin': (0.93, 0.77, 0.64), 'Shorts': (0.153, 0.251, 0.478), 'Top': (0.0, 0.659, 0.910),
    'Hair': (0.2, 0.14, 0.105), 'Dark': (0.10, 0.12, 0.16), 'White': (0.96, 0.96, 0.96), 'Lip': (0.72, 0.42, 0.39),
}
ASSIGN = dict(Skin='Skin', Head='Skin', Hands='Skin', EyeWhite='White', Iris='Dark', Brows='Hair', Lips='Lip',
              HairM='Hair', HairF='Hair', Shorts='Shorts', TopF='Top')


def region_copy(skin, name, keep, inflate):
    ob = skin.copy(); ob.data = skin.data.copy(); ob.name = name
    bpy.context.scene.collection.objects.link(ob)
    bm = bmesh.new(); bm.from_mesh(ob.data)
    bm.verts.ensure_lookup_table(); bm.faces.ensure_lookup_table()
    bad = [f for f in bm.faces if not all(keep(v.co) for v in f.verts)]
    bmesh.ops.delete(bm, geom=bad, context='FACES')
    loose = [v for v in bm.verts if not v.link_faces]
    bmesh.ops.delete(bm, geom=loose, context='VERTS')
    bm.normal_update()
    layers = list(bm.verts.layers.shape.values())
    for v in bm.verts:
        off = v.normal * inflate
        v.co += off
        for lay in layers: v[lay] += off
    bm.to_mesh(ob.data); bm.free()
    for p in ob.data.polygons: p.use_smooth = True
    return ob


def make_clothes(skin):
    P0 = B.P()
    shorts = region_copy(skin, 'Shorts', lambda c: 0.71 <= c[2] <= 1.01 and abs(c[0]) <= 0.185, 0.006)
    def top_keep(c):
        y = c[2]
        if not (1.18 <= y <= 1.31): return False
        rx = float(B.torso_at(P0, y)[0])
        return abs(c[0]) <= rx + 0.004
    top = region_copy(skin, 'TopF', top_keep, 0.006)
    return shorts, top


def setup_materials(objs):
    mats = {}
    for n, rgb in MATS.items():
        m = bpy.data.materials.get(n) or bpy.data.materials.new(n)
        m.use_nodes = True
        bsdf = next(nd for nd in m.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
        bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.6
        mats[n] = m
    for ob in objs:
        ob.data.materials.clear(); ob.data.materials.append(mats[ASSIGN[ob.name]])


def export_glb(objs, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    for o in bpy.context.scene.objects: o.select_set(False)
    for o in objs:
        o.hide_viewport = False; o.hide_set(False); o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    props = {p.identifier for p in bpy.ops.export_scene.gltf.get_rna_type().properties}
    kw = dict(filepath=path, export_format='GLB', use_selection=True, export_apply=False, export_yup=True,
              export_cameras=False, export_lights=False)
    for k, v in (('export_morph', True), ('export_morph_normal', True), ('export_morph_tangent', False),
                 ('export_try_sparse_sk', True), ('export_try_omit_sparse_sk', True), ('export_animations', False),
                 ('export_skins', False), ('export_image_format', 'NONE'), ('export_vertex_color', 'NONE')):
        if k in props: kw[k] = v
    bpy.ops.export_scene.gltf(**kw)
    return os.path.getsize(path)
