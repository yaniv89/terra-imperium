"""Review sheet of a battle building file's three states (manifest row MD13; read only).
blender -b --factory-startup -P scripts/blender/render_rts_states.py -- rts-<age>.glb OUT.png [COLS] [LOD] [TILE_W] [ROLES]
One tile per role: the whole building, `<role>-damaged` and `<role>-ruined` side by side at one
scale on battlefield-green ground, the Team material tinted red as a side's colour would be, with
the camera of the other kit proofs (render_kit_contact.py). TILE_W 844 is the phone screen's
width; a small TILE_W (281) with LOD 1 shows the states at about battle zoom.
"""
import os
import sys

import bpy
import numpy as np
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(args[0]), os.path.abspath(args[1])
cols = int(args[2]) if len(args) > 2 else 2
lod = args[3] if len(args) > 3 else '0'
tile_w = int(args[4]) if len(args) > 4 else 844
only = [r for r in args[5].split(',') if r] if len(args) > 5 else []
tile_h = round(tile_w * 280 / 844)
STATES = ('', '-damaged', '-ruined')

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
roots = {o.name: o for o in scene.objects if o.type == 'EMPTY' and o.parent is None and any(c.type == 'MESH' for c in o.children)}
roles = [n for n in roots if n + '-damaged' in roots and (not only or n in only)]  # a culture skin has no -ruined
team = bpy.data.materials.get('Team')
if team:  # the side's colour over the grey cloth
    nt = team.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    link = bsdf.inputs['Base Color'].links[0]
    mix = nt.nodes.new('ShaderNodeMix')
    mix.data_type, mix.blend_type = 'RGBA', 'MULTIPLY'
    mix.inputs['Factor'].default_value = 1.0
    mix.inputs[7].default_value = (0.86, 0.05, 0.05, 1.0)
    nt.links.new(link.from_socket, mix.inputs[6])
    nt.links.new(mix.outputs[2], bsdf.inputs['Base Color'])
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'
    prefs.get_devices()
    for dev in prefs.devices:
        dev.use = dev.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception:
    pass
scene.world = bpy.data.worlds.new('proof')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes.get('Background')
bg.inputs['Color'].default_value = (.65, .69, .74, 1)
bg.inputs['Strength'].default_value = .6
for loc, power, size in [((3, -4, 6), 600, 5), ((-4, -1, 3), 400, 4)]:
    bpy.ops.object.light_add(type='AREA', location=loc)
    bpy.context.object.data.energy = power
    bpy.context.object.data.size = size
bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, -0.002))
ground = bpy.context.object
gm = bpy.data.materials.new('field')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.21, 0.27, 0.09, 1)  # battlefield grass
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
ground.data.materials.append(gm)
bpy.ops.object.camera_add(location=(2.6, -3.8, 2.7))
cam = bpy.context.object
cam.rotation_euler = (Vector((0, 0, 0)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
scene.camera = cam
rot = cam.rotation_euler.to_matrix()
right, up, fwd = rot @ Vector((1, 0, 0)), rot @ Vector((0, 1, 0)), rot @ Vector((0, 0, -1))
offset = cam.location.copy()
scene.render.resolution_x, scene.render.resolution_y = tile_w, tile_h
scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
meshes = [c for r in roots.values() for c in r.children if c.type == 'MESH']
tmp = os.path.join(os.path.dirname(out), '_tiles', os.path.splitext(os.path.basename(out))[0])
os.makedirs(tmp, exist_ok=True)
tiles = []
for role in roles:
    trio = [roots.get(role + s) for s in STATES]
    whole = [c for c in trio[0].children if c.type == 'MESH' and c.name.split('.')[0] == 'LOD' + lod]
    xs = [v.co.x for c in whole for v in c.data.vertices]
    step = (max(xs) - min(xs)) * 1.12 + 0.15
    shown = []
    for k, r in enumerate(trio):
        if r is None:
            continue
        r.location = ((k - 1) * step, 0, 0)
        shown += [c for c in r.children if c.type == 'MESH' and c.name.split('.')[0] == 'LOD' + lod]
    for c in meshes:
        c.hide_render = c not in shown
    bpy.context.view_layer.update()
    pts = [c.matrix_world @ v.co for c in shown for v in c.data.vertices]
    px, py = [p.dot(right) for p in pts], [p.dot(up) for p in pts]
    centre = right * ((max(px) + min(px)) / 2) + up * ((max(py) + min(py)) / 2) + fwd * (sum(p.dot(fwd) for p in pts) / len(pts))
    cam.location = centre + offset
    cam.data.ortho_scale = max(max(px) - min(px), (max(py) - min(py)) * tile_w / tile_h) * 1.08
    path = os.path.join(tmp, role + '.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    tiles.append(path)


def read(p):
    img = bpy.data.images.load(p, check_existing=False)
    w, h = img.size
    a = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(img)
    return a


arrs = [read(p) for p in tiles]
for a in arrs:  # a thin dark frame round every tile
    a[:2, :, :3] = a[-2:, :, :3] = a[:, :2, :3] = a[:, -2:, :3] = 0.05
blank = np.zeros_like(arrs[0])
blank[..., 3] = 1
while len(arrs) % cols:
    arrs.append(blank)
grid = np.concatenate([np.concatenate(arrs[i:i + cols], axis=1) for i in range(0, len(arrs), cols)], axis=0)
h, w = grid.shape[:2]
img = bpy.data.images.new('sheet', w, h, alpha=True)
img.pixels = grid[::-1].ravel()
img.filepath_raw = out
img.file_format = 'PNG'
img.save()
print('STATES', out, roles, flush=True)
sys.stdout.flush()
os._exit(0)
