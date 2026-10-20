"""Kit objects as the battle camera sees them, at a set size on screen (read only).
blender -b --factory-startup -P scripts/blender/render_kit_zoom.py -- OUT.png PX_PER_UNIT LOD COLS [--person] [--turn DEG] [--ground R,G,B] [--headroom UNITS] [--mag N] [--only NAME,NAME] FILE.glb [FILE.glb ...]

Every root object (an empty with LOD0..LOD2 children) of the unpacked files stands on a grass plane
in a grid, seen along the battle's own camera direction (BattleRenderer.js ISO_DIR = (1, 1.25, 1),
orthographic). PX_PER_UNIT is how many pixels one model unit covers:
  nodes on a phone (844x390, 18 tiles of height, 2.75 tiles per unit) at zoom 1: 59.6
  worker loads at the figure scale (5.278 tiles per unit) at zoom 1: 114.4
OUT.png is the true size; OUT@Nx.png the same pixels enlarged N times (nearest neighbour) so a
reviewer can see what the phone shows. `--person` stands a plain 1.8 m figure with each object:
a `load-*` object sits on its back (WORKER_LOAD_BACK in src/battle/art/workerLoads.js), a
`barrow-*` object stands ahead of it; `--turn` turns each figure (200 shows its back).
`--ground` is the ground colour (linear RGB; a shoal wants water: 0.05,0.16,0.2), `--headroom`
adds height to the picture for tall objects (trees), `--mag 1` writes no enlarged copy.
"""
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector

args = sys.argv[sys.argv.index('--') + 1:]
person = '--person' in args
ground_rgb = (0.17, 0.24, 0.09)
if '--ground' in args:
    ground_rgb = tuple(float(v) for v in args[args.index('--ground') + 1].split(','))
    del args[args.index('--ground'):args.index('--ground') + 2]
headroom = 0.0
if '--headroom' in args:
    headroom = float(args[args.index('--headroom') + 1])
    del args[args.index('--headroom'):args.index('--headroom') + 2]
turn = 0.0
if '--turn' in args:
    turn = math.radians(float(args[args.index('--turn') + 1]))
    del args[args.index('--turn'):args.index('--turn') + 2]
mag = 4
if '--mag' in args:
    mag = int(args[args.index('--mag') + 1])
    del args[args.index('--mag'):args.index('--mag') + 2]
only = None  # --only a,b: just these objects (by name) of each file
if '--only' in args:
    only = set(args[args.index('--only') + 1].split(','))
    del args[args.index('--only'):args.index('--only') + 2]
args = [a for a in args if a != '--person']
out, px_per_unit, lod, cols = os.path.abspath(args[0]), float(args[1]), args[2], int(args[3])
files = [os.path.abspath(a) for a in args[4:]]

# where a load sits on the figure and where the figure stands behind a barrow (model units, 10 m)
BACK_Y, BACK_Z = 0.022, 0.095
BARROW_Y = 0.115

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
roots = []
for f in files:
    before = set(scene.objects)
    bpy.ops.import_scene.gltf(filepath=f)
    new = [o for o in scene.objects if o not in before]
    found = sorted([o for o in new if o.type == 'EMPTY' and o.parent is None and any(c.type == 'MESH' for c in o.children)],
                   key=lambda r: r.location.x)
    if only:
        drop = [o for o in found if o.name.split('.')[0] not in only]
        found = [o for o in found if o.name.split('.')[0] in only]
        for o in drop:
            for c in list(o.children_recursive) + [o]:
                bpy.data.objects.remove(c, do_unlink=True)
    roots += found
for o in scene.objects:
    if o.type == 'MESH' and o.parent is not None and o.parent.type == 'EMPTY':
        o.hide_render = not o.name.startswith('LOD' + lod)
for o in scene.objects:  # a wheel follows its level
    if o.type == 'MESH' and o.parent is not None and o.parent.type == 'MESH':
        o.hide_render = o.parent.hide_render

view = Vector((1, -1, 1.25)).normalized()          # ISO_DIR in Blender axes (glTF +Z is Blender -Y)
right = Vector((1, 1, 0)).normalized()
deep = Vector((-1, 1, 0)).normalized()
rows = math.ceil(len(roots) / cols)
step = 0.62 if not person else 0.36
row_step = (0.62 if not person else 0.42) / 0.662
for k, r in enumerate(roots):
    c, w = k % cols, k // cols
    at = right * ((c - (cols - 1) / 2) * step) + deep * (((rows - 1) / 2 - w) * row_step)
    if person:
        spin = Matrix.Rotation(turn, 3, 'Z')
        r.rotation_mode = 'XYZ'
        r.rotation_euler = (0, 0, turn)
        body = bpy.data.materials.get('_figure') or bpy.data.materials.new('_figure')
        body.diffuse_color = (0.16, 0.3, 0.62, 1)
        body.use_nodes = True
        body.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.16, 0.3, 0.62, 1)
        skin = bpy.data.materials.get('_skin') or bpy.data.materials.new('_skin')
        skin.use_nodes = True
        skin.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.62, 0.42, 0.3, 1)
        for (radius, depth, z, m) in [(0.016, 0.085, 0.0425, body), (0.024, 0.065, 0.1175, body)]:
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=radius, depth=depth, location=at + Vector((0, 0, z)))
            bpy.context.object.data.materials.append(m)
        bpy.ops.mesh.primitive_uv_sphere_add(segments=8, ring_count=6, radius=0.015, location=at + Vector((0, 0, 0.165)))
        bpy.context.object.data.materials.append(skin)
        if r.name.startswith('load-'):
            r.location = at + spin @ Vector((0, BACK_Y, BACK_Z))
        else:
            r.location = at + spin @ Vector((0, -BARROW_Y, 0))
    else:
        r.location = at
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0))
ground = bpy.context.object
gm = bpy.data.materials.new('_ground')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*ground_rgb, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
ground.data.materials.append(gm)

scene.render.engine = 'CYCLES'
scene.cycles.samples = 24
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception:
    pass
scene.world = bpy.data.worlds.new('zoom')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (0.8, 0.85, 0.9, 1)
bg.inputs['Strength'].default_value = 0.6
bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), 0, math.radians(-35)))
bpy.context.object.data.energy = 2.2
bpy.context.object.data.angle = math.radians(3)

bpy.ops.object.camera_add(location=view * 20)
cam = bpy.context.object
cam.rotation_euler = (-view).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
scene.camera = cam
width_units = cols * step + 0.1
height_units = rows * row_step * 0.662 + (0.3 if not person else 0.24) + headroom
w_px, h_px = int(round(width_units * px_per_unit)), int(round(height_units * px_per_unit))
cam.data.ortho_scale = max(w_px, h_px) / px_per_unit
up = cam.rotation_euler.to_matrix() @ Vector((0, 1, 0))
cam.location += up * ((0.05 if not person else 0.06) + headroom / 2)
scene.render.resolution_x, scene.render.resolution_y = w_px, h_px
scene.render.resolution_percentage = 100
scene.render.filter_size = 1.0
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = out
bpy.ops.render.render(write_still=True)

img = bpy.data.images.load(out, check_existing=False)
w, h = img.size
a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
if mag > 1:
    big = np.repeat(np.repeat(a, mag, axis=0), mag, axis=1)
    o2 = bpy.data.images.new('big', w * mag, h * mag, alpha=True)
    o2.pixels = big.ravel()
    o2.filepath_raw = out[:-4] + '@%dx.png' % mag
    o2.file_format = 'PNG'
    o2.save()
print('ZOOM', out, w, h, [r.name for r in roots], flush=True)
sys.stdout.flush()
os._exit(0)
