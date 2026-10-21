# scripts/blender/render_age_banner.py (eight-ages plan U94): run in Blender per age; the towns and units are unpacked first (gltfpack -noq).
# Render one age banner (U94): the age's big town behind a rank of its units, low warm light, a sky tint per age.
#   -- <town.glb> <out.webp> <sky_hex> <unit.glb>[,<unit.glb>...] [unit_scale]
import math
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
town, out, sky = argv[0], argv[1], argv[2]
units = [u for u in (argv[3].split(',') if len(argv) > 3 else []) if u]
uscale = float(argv[4]) if len(argv) > 4 else .5

for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc = bpy.context.scene


def imp(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]


for o in imp(town):  # LOD0 only
    if o.type == 'MESH' and not (o.name.startswith('LOD0') or (o.parent and o.parent.name.startswith('LOD0'))):
        o.hide_render = True
        o.hide_set(True)
# a rank of units in front of the gate, facing the camera
n = 0
for k, u in enumerate(units):
    for j in range(3 if 'cavalry' not in u and 'siege' not in u else 1):
        objs = imp(u)
        roots = [o for o in objs if o.parent is None]
        for r in roots:
            r.scale = (uscale, uscale, uscale)
            r.location = (-1.2 + 0.8 * n, -4.6, 0)
            r.rotation_euler = (0, 0, math.radians(180 + 15 * (n % 3 - 1)))
        for o in objs:
            if o.type == 'MESH' and ('LOD1' in o.name or 'LOD2' in o.name):
                o.hide_render = True
        n += 1
# a ground plane to the horizon in a darker shade of the sky
bpy.ops.mesh.primitive_plane_add(size=400, location=(0, 0, -0.01))
gp = bpy.context.active_object
gm = bpy.data.materials.new('BannerGround')
gm.use_nodes = True
hb = sky.lstrip('#')
gr = tuple(int(hb[i:i + 2], 16) / 255 * .55 for i in (0, 2, 4))
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (gr[0] ** 2.2, gr[1] ** 2.2, gr[2] ** 2.2, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
gp.data.materials.append(gm)
# light and sky
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sc.collection.objects.link(sun)
sun.data.energy = 3.5
sun.rotation_euler = (math.radians(55), 0, math.radians(-35))
world = sc.world or bpy.data.worlds.new('World')
sc.world = world
world.use_nodes = True
bg = world.node_tree.nodes.get('Background')
h = sky.lstrip('#')
rgb = tuple(int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
bg.inputs['Color'].default_value = (rgb[0] ** 2.2, rgb[1] ** 2.2, rgb[2] ** 2.2, 1)
bg.inputs['Strength'].default_value = 1.2
# camera: low, looking over the units at the town
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
sc.collection.objects.link(cam)
cam.location = (1.6, -8.6, 1.15)
d = Vector((0, 0.8, .55)) - cam.location
cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
cam.data.lens = 30
sc.camera = cam
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 960, 320, 100
sc.render.image_settings.file_format = 'WEBP'
sc.render.image_settings.quality = 78
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
print('BANNER', out, flush=True)
