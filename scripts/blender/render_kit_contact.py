"""Proof contact sheet of a kit file's objects (read only, never saves the source).
blender -b -t 8 -P scripts/blender/render_kit_contact.py -- SOURCE.(blend|glb) OUT.png [COLS] [LOD]
Each root object (an empty with LOD0..LOD2 children) is framed alone on its chosen LOD with the
civic proofs' camera (render_civic_bronze.py): 844x390 tiles, ortho, two area lights, Cycles.
"""
import os, sys
import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(args[0]), os.path.abspath(args[1])
cols = int(args[2]) if len(args) > 2 else 2
lod = args[3] if len(args) > 3 else '0'
if src.endswith('.blend'):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
roots = sorted([o for o in scene.objects if o.type == 'EMPTY' and o.parent is None and any(c.type == 'MESH' for c in o.children)], key=lambda r: r.name)
for r in roots:
    r.location = (0, 0, 0)
bpy.context.view_layer.update()
scene.render.engine = 'CYCLES'; scene.cycles.samples = 16
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences; prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices: d.use = d.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception:
    pass
scene.world = bpy.data.worlds.new('proof'); scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background'); bg.inputs['Color'].default_value = (.65, .69, .74, 1); bg.inputs['Strength'].default_value = .6
for loc, power, size in [((3, -4, 6), 600, 5), ((-4, -1, 3), 400, 4)]:
    bpy.ops.object.light_add(type='AREA', location=loc); bpy.context.object.data.energy = power; bpy.context.object.data.size = size
bpy.ops.object.camera_add(location=(2.6, -3.8, 2.7)); cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.type = 'ORTHO'; scene.camera = cam
rot = cam.rotation_euler.to_matrix(); right = rot @ Vector((1, 0, 0)); up = rot @ Vector((0, 1, 0)); fwd = rot @ Vector((0, 0, -1)); offset = cam.location.copy()
scene.render.resolution_x, scene.render.resolution_y = 844, 390; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'; scene.render.image_settings.file_format = 'PNG'
meshes = [c for r in roots for c in r.children if c.type == 'MESH']
tiles = []
tmp = os.path.join(os.path.dirname(out), '_tiles'); os.makedirs(tmp, exist_ok=True)
for r in roots:
    shown = [c for c in r.children if c.type == 'MESH' and c.name.split('.')[0] == 'LOD' + lod]
    for c in meshes:
        c.hide_render = c not in shown
    pts = [c.matrix_world @ v.co for c in shown for v in c.data.vertices]
    pts = [p for p in pts if p.length <= 3.0] or pts
    xs = [p.dot(right) for p in pts]; ys = [p.dot(up) for p in pts]
    centre = right * ((max(xs) + min(xs)) / 2) + up * ((max(ys) + min(ys)) / 2) + fwd * (sum(p.dot(fwd) for p in pts) / len(pts))
    cam.location = centre + offset; cam.data.ortho_scale = max(max(xs) - min(xs), (max(ys) - min(ys)) * 844 / 390) * 1.3
    path = os.path.join(tmp, r.name + '.png'); scene.render.filepath = path; bpy.ops.render.render(write_still=True); tiles.append(path)


def read(p):
    img = bpy.data.images.load(p, check_existing=False); w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy(); bpy.data.images.remove(img); return a


arrs = [read(p) for p in tiles]
blank = np.zeros_like(arrs[0]); blank[..., 3] = 1
while len(arrs) % cols:
    arrs.append(blank)
grid = np.concatenate([np.concatenate(arrs[i:i + cols], axis=1) for i in range(0, len(arrs), cols)], axis=0)
h, w = grid.shape[:2]
img = bpy.data.images.new('contact', w, h, alpha=True); img.pixels = grid[::-1].ravel(); img.filepath_raw = out; img.file_format = 'PNG'; img.save()
print('CONTACT', out, [os.path.basename(t) for t in tiles], flush=True)
sys.stdout.flush(); os._exit(0)
