# scripts/blender/render_glb_top.py
# An 844x390 orthographic three-quarter render of a map model GLB's LOD0 (the close view's angle,
# north up), on the standard light of plans/ART-MODELS-PLAN.md 2.4. For before/after proofs of a
# town or kit file; packed (meshopt) files cannot be imported, so render the unpacked build.
#   blender -b --factory-startup -P scripts/blender/render_glb_top.py -- <model.glb> <out.png> [half_width_units]
import bpy, sys, math
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
src, out = args[0], args[1]
half = float(args[2]) if len(args) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
# a file without LOD levels (a kit export) renders whole
has_lods = any(o.name.startswith('LOD0') for o in bpy.context.scene.objects)
for o in bpy.context.scene.objects:
    if o.type == 'MESH':
        chain = [o]
        while chain[-1].parent:
            chain.append(chain[-1].parent)
        keep = any(p.name.startswith('LOD0') for p in chain)
        o.hide_render = has_lods and not keep
pts = [o.matrix_world @ Vector(c) for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render for c in o.bound_box]
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
span = half or max(max(p.x for p in pts) - min(p.x for p in pts), max(p.y for p in pts) - min(p.y for p in pts)) / 2
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE' if 'BLENDER_EEVEE' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x, scene.render.resolution_y = 844, 390
scene.render.film_transparent = False
world = bpy.data.worlds.new('W'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (0.78, 0.85, 0.93, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 0.8
sun = bpy.data.objects.new('Sun', bpy.data.lights.new('Sun', 'SUN')); scene.collection.objects.link(sun)
sun.data.energy = 3.2; sun.data.color = (1.0, 0.906, 0.76); sun.rotation_euler = (math.radians(50), 0, math.radians(35))
cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = span * 3.4  # the whole ground and the tallest landmark fit 844x390
tilt = math.radians(50)
# glTF import: Y up becomes Z up, the model's south (+Z glTF) is Blender -Y: look from the south
cam.location = (cx, cy - 30 * math.sin(tilt), 30 * math.cos(tilt))
cam.rotation_euler = (tilt, 0, 0)
scene.render.filepath = out
bpy.ops.render.render(write_still=True)
