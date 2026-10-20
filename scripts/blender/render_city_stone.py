# scripts/blender/render_city_stone.py
# Review stills of the Stone city kit (build_city_stone.py): every object of each file laid out in a
# grid with its name, one image per file and level, for the art review (audits/stone-city/).
#   blender -b --factory-startup -P scripts/blender/render_city_stone.py -- <out_dir> <file.glb>... [--lod 0,2]
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:]
lods = [0]
if '--lod' in argv:
    i = argv.index('--lod')
    lods = [int(x) for x in argv[i + 1].split(',')]
    argv = argv[:i] + argv[i + 2:]
out_dir = os.path.abspath(argv[0])
os.makedirs(out_dir, exist_ok=True)

for path in argv[1:]:
    for lod in lods:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(path))
        roots = sorted([o for o in bpy.context.scene.objects if o.parent is None and o.type == 'EMPTY'], key=lambda o: o.name)
        for r in roots:
            for c in r.children:
                c.hide_render = not c.name.startswith('LOD%d' % lod)
        bpy.context.view_layer.update()

        def extent(r):
            pts = [c.matrix_world @ Vector(b) for c in r.children if not c.hide_render for b in c.bound_box]
            lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
            hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
            return lo, hi
        sizes = [extent(r) for r in roots]
        cell = max(max(hi.x - lo.x, hi.y - lo.y) for lo, hi in sizes) * 1.25
        cols = math.ceil(math.sqrt(len(roots) * 1.6))
        for k, (r, (lo, hi)) in enumerate(zip(roots, sizes)):
            cx, cy = (lo.x + hi.x) / 2 - r.location.x, (lo.y + hi.y) / 2 - r.location.y
            r.location = Vector(((k % cols) * cell - cx, -(k // cols) * cell - cy, 0))
            bpy.ops.object.text_add(location=((k % cols) * cell - cell * 0.42, -(k // cols) * cell - cell * 0.5, 0.01))
            t = bpy.context.object
            t.data.body = r.name
            t.data.size = cell * 0.075
            m = bpy.data.materials.new('label')
            m.use_nodes = True
            m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.02, 0.02, 0.02, 1)
            t.data.materials.append(m)
        rows = math.ceil(len(roots) / cols)
        bpy.ops.mesh.primitive_plane_add(size=1, location=((cols - 1) * cell / 2, -(rows - 1) * cell / 2, -0.002))
        g = bpy.context.object
        g.scale = (cols * cell + cell, rows * cell + cell, 1)
        gm = bpy.data.materials.new('ground')
        gm.use_nodes = True
        gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.42, 0.45, 0.32, 1)
        g.data.materials.append(gm)
        scene = bpy.context.scene
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 24
        scene.cycles.device = 'CPU'
        scene.world = bpy.data.worlds.new('sky')
        scene.world.use_nodes = True
        bg = scene.world.node_tree.nodes['Background']
        bg.inputs['Color'].default_value = (0.7, 0.76, 0.85, 1)
        bg.inputs['Strength'].default_value = 0.7
        bpy.ops.object.light_add(type='SUN', rotation=(math.radians(50), math.radians(10), math.radians(-35)))
        bpy.context.object.data.energy = 3.5
        centre = Vector(((cols - 1) * cell / 2, -(rows - 1) * cell / 2, 0.2))
        bpy.ops.object.camera_add(location=centre + Vector((0, -12, 9)))
        cam = bpy.context.object
        cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = max(cols * cell, rows * cell * 1.9) * 1.08
        scene.camera = cam
        scene.render.resolution_x = 1600
        scene.render.resolution_y = 1000
        scene.view_settings.view_transform = 'AgX'
        name = os.path.splitext(os.path.basename(path))[0]
        scene.render.filepath = os.path.join(out_dir, '%s-lod%d.png' % (name, lod))
        bpy.ops.render.render(write_still=True)
        print('RENDERED', scene.render.filepath, flush=True)
sys.stdout.flush()
os._exit(0)
