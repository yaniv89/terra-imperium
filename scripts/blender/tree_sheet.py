# scripts/blender/tree_sheet.py
# Contact sheet of a vegetation kit (plans/art-pilot/md05-trees/): every tree of the file, species
# by species and small to large, at LOD0 (front row), LOD1 and LOD2 (the rows behind), the kit's
# other objects in front and a 1.8 m figure for scale, seen from the battle camera's height
# (41.5 degrees). Writes <out>.png (large) and <out>-phone.png (the same view at a quarter of the
# size: about what a phone shows at battle zoom 1).
#   blender -b --factory-startup -P scripts/blender/tree_sheet.py -- <file.glb, not packed> <out without .png>
import math
import os
import re
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
src, out = os.path.abspath(argv[0]), os.path.abspath(argv[1])
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
roots = {o.name: o for o in scene.objects if o.type == 'EMPTY' and o.parent is None}


def tree_key(name):
    m = re.match(r'^tree-([sml])(?:-(\d+))?$', name)
    return (int(m.group(2) or 1), 'sml'.index(m.group(1))) if m else None


trees = sorted((n for n in roots if tree_key(n)), key=tree_key)
others = [n for n in ('stump', 'felled', 'log-pile', 'bush', 'rock-s', 'rock-m', 'grass-tuft') if n in roots]
others += sorted(n for n in roots if n not in trees and n not in others)


def level(root, lod):
    return next(c for c in root.children if c.name.startswith('LOD%d' % lod))


# x places: species side by side with a gap between them
xs, x, last = {}, 0.0, None
for n in trees:
    sp, size = tree_key(n)
    if last is not None and sp != last:
        x += 0.35
    x += (0.55, 0.7, 0.9)[size]
    xs[n] = x
    last = sp
width = x + 0.6
ROW = 1.75
for n in trees:
    r = roots[n]
    r.location = (0, 0, 0)
    for lod in (0, 1, 2):
        o = level(r, lod)
        o.parent = None
        o.location = (xs[n], lod * ROW, 0)
ox = 0.5
for n in others:
    r = roots[n]
    o = level(r, 0)
    o.parent = None
    o.location = (ox, -1.25, 0)
    ox += 0.8
    for lod in (1, 2):
        level(r, lod).hide_render = True

# ground and a 1.8 m figure
bpy.ops.mesh.primitive_plane_add(size=1, location=(width / 2, ROW, -0.001))
ground = bpy.context.object
ground.scale = (width + 6, 14, 1)
gm = bpy.data.materials.new('SheetGround')
gm.use_nodes = True
gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.19, 0.3, 0.08, 1)
gm.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
ground.data.materials.append(gm)
fm = bpy.data.materials.new('SheetFigure')
fm.use_nodes = True
fm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.5, 0.5, 0.52, 1)
for lod in (0, 1, 2):
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.022, depth=0.18, location=(0.1, lod * ROW, 0.09))
    bpy.context.object.data.materials.append(fm)

sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN'))
sun.data.energy = 3.2
sun.data.angle = math.radians(4)
sun.rotation_euler = (math.radians(52), 0, math.radians(-38))
scene.collection.objects.link(sun)
world = bpy.data.worlds.new('World')
world.use_nodes = True
world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.75, 0.82, 0.9, 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.55
scene.world = world

cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
scene.collection.objects.link(cam)
target = Vector((width / 2, ROW * 0.72, 0.3))
elev = math.radians(41.5)
cam.location = target + Vector((0, -math.cos(elev), math.sin(elev))) * 30
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
cam.data.type = 'ORTHO'
W = 2000
H = int(W * 4.9 / max(width + 0.4, 4.9 * 1.2))
cam.data.ortho_scale = width + 0.4
scene.camera = cam
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 12
scene.cycles.use_denoising = False
scene.render.threads_mode = 'FIXED'
scene.render.threads = 4
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'
for name, pct in (('', 100), ('-phone', 25)):
    scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = W, max(H, 700), pct
    scene.render.filepath = out + name + '.png'
    bpy.ops.render.render(write_still=True)
print('SHEET', out, trees, flush=True)
os._exit(0)
