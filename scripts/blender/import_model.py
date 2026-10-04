# scripts/blender/import_model.py
# Bring a finished 3D model (a GLB or .blend made elsewhere) into the game's map-model format
# (plans/model-brief-for-claude.md): one root object named `name` with LOD0 (the model as given,
# cut to the budget if above it), LOD1 and LOD2 (decimated copies), the base sitting on the ground
# at the origin, the front facing Blender -Y, materials renamed to Town / Ground / Team (a material
# or object whose name holds "team", "flag" or "banner" becomes Team; "ground" becomes Ground),
# textures exported as WebP. Optional uniform scale so the footprint (the larger of width and
# depth) matches `footprint` units.
#
#   python scripts/blender/import_model.py <in.glb|in.blend> <out.glb> <name> <kind> [footprint]
#   kind: landmark | house | town | walls  (sets the triangle budgets)
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

BUDGETS = {'town': (60000, 10000, 1500), 'landmark': (15000, 3000, 500), 'walls': (12000, 2500, 400),
           'house': (2500, 600, 120), 'improvement': (8000, 1500, 300)}


def tris(o):
    o.data.calc_loop_triangles()
    return len(o.data.loop_triangles)


def material_role(name):
    n = (name or '').lower()
    if any(k in n for k in ('team', 'flag', 'banner')):
        return 'Team'
    if 'ground' in n:
        return 'Ground'
    return 'Town'


def load(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if path.endswith('.blend'):
        with bpy.data.libraries.load(path) as (src, dst):
            dst.objects = src.objects
        for o in dst.objects:
            if o is not None and o.type == 'MESH':
                bpy.context.scene.collection.objects.link(o)
    else:
        bpy.ops.import_scene.gltf(filepath=path)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not meshes:
        raise SystemExit('no meshes in ' + path)
    # objects named team/flag/banner: their materials become Team
    for o in meshes:
        if material_role(o.name) == 'Team':
            for slot in o.material_slots:
                if slot.material:
                    slot.material.name = 'team_' + slot.material.name
    for o in bpy.context.scene.objects:
        o.select_set(o.type == 'MESH')
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.parent_clear(type='CLEAR_KEEP_TRANSFORM')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    if len(meshes) > 1:
        bpy.ops.object.join()
    for o in [o for o in bpy.context.scene.objects if o.type != 'MESH']:
        bpy.data.objects.remove(o)
    return bpy.context.view_layer.objects.active


def normalise(o, footprint=None):
    """Origin at the centre of the footprint, base on the ground, optional uniform scale."""
    vs = [v.co for v in o.data.vertices]
    lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    s = 1.0
    if footprint:
        s = footprint / max(hi.x - lo.x, hi.y - lo.y)
    centre = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
    o.data.transform(Matrix.Scale(s, 4) @ Matrix.Translation(-centre))
    return s


def merge_materials(o):
    """Rename and merge materials into Town / Ground / Team slots, in that order."""
    me = o.data
    order = ['Town', 'Ground', 'Team']
    roles = [material_role(m.name if m else '') for m in me.materials]
    keep = {}
    for m, role in zip(me.materials, roles):
        if role not in keep and m is not None:
            keep[role] = m
    for role, m in keep.items():
        m.name = role
    slots = [r for r in order if r in keep]
    remap = [slots.index(r) if r in slots else 0 for r in roles]
    for p in me.polygons:
        p.material_index = remap[p.material_index] if p.material_index < len(remap) else 0
    for j, r in enumerate(slots):
        me.materials[j] = keep[r]
    while len(me.materials) > len(slots):
        me.materials.pop(index=len(me.materials) - 1)


def decimated(src, name, target):
    o = src.copy()
    o.data = src.data.copy()
    o.name = name
    bpy.context.scene.collection.objects.link(o)
    n = tris(o)
    if n > target:
        mod = o.modifiers.new('dec', 'DECIMATE')
        mod.decimate_type = 'COLLAPSE'
        mod.ratio = max(0.01, target / n * 0.97)
        mod.use_collapse_triangulate = True
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return o


def main(src, out, name, kind, footprint=None):
    budget = BUDGETS[kind]
    o = load(src)
    scale = normalise(o, footprint)
    merge_materials(o)
    lod0 = decimated(o, 'LOD0', budget[0])
    lod1 = decimated(o, 'LOD1', budget[1])
    lod2 = decimated(o, 'LOD2', budget[2])
    bpy.data.objects.remove(o)
    root = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(root)
    for c in (lod0, lod1, lod2):
        c.parent = root
        for p in c.data.polygons:
            p.use_smooth = False
    bpy.ops.object.select_all(action='DESELECT')
    for c in (root, lod0, lod1, lod2):
        c.select_set(True)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_apply=True,
                              export_cameras=False, export_lights=False, export_image_format='WEBP',
                              export_image_quality=90, export_yup=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.splitext(out)[0] + '.blend')
    print('imported', name, 'scale', round(scale, 4), {c.name: tris(c) for c in (lod0, lod1, lod2)},
          'size', [round(v, 2) for v in lod0.dimensions])


if __name__ == '__main__':
    a = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(a[0], a[1], a[2], a[3], float(a[4]) if len(a) > 4 else None)
    sys.stdout.flush()
    os._exit(0)
