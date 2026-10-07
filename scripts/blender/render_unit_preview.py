# scripts/blender/render_unit_preview.py
# An 844x390 preview of a unit .blend on the standard light (plans/ART-MODELS-PLAN.md 2.4: sun
# #FFE7C2, sky #E3EEF8, bounce #5A503F), orthographic from the battle camera's side, fitted to the
# model; transparent background. Based on the Codex preview script of 2026-10-07.
#   blender -b --factory-startup -P scripts/blender/render_unit_preview.py -- <unit.blend> [out.png] [front] [object=<root>]
# `front` turns the camera to look at the model's front three-quarter (default: the battle view);
# `object=` renders one object of a kit file (its LOD0).
import bpy, sys, json
from pathlib import Path
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
source = Path(args[0]).resolve()
out = Path(args[1]).resolve() if len(args) > 1 else source.parent / 'preview.png'
front = 'front' in args[2:]
only = next((a.split('=', 1)[1] for a in args[2:] if a.startswith('object=')), None)
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
if only:  # one object of a kit file (rts-bronze.glb's roles): its LOD0 only, moved to the origin
    root = bpy.data.objects[only]
    for o in scene.objects:
        if o.type == 'MESH':
            keep = o.parent == root and o.name.startswith('LOD0')
            o.hide_render = not keep
            o.hide_set(not keep)
    root.location = (0, 0, 0)
    bpy.context.view_layer.update()
for a in bpy.data.objects:
    if a.type == 'ARMATURE' and a.animation_data:
        idle = bpy.data.actions.get('Idle')
        if idle:
            a.animation_data.action = idle
scene.frame_set(1)
scene.render.engine = 'CYCLES'; scene.cycles.samples = 48; scene.cycles.use_denoising = True
try:
    prefs = bpy.context.preferences.addons['cycles'].preferences
    prefs.compute_device_type = 'OPTIX'; prefs.get_devices()
    for d in prefs.devices:
        d.use = d.type == 'OPTIX'
    scene.cycles.device = 'GPU'
except Exception:  # no GPU: CPU render
    scene.cycles.device = 'CPU'
scene.render.resolution_x = 844; scene.render.resolution_y = 390; scene.render.resolution_percentage = 100
scene.view_settings.view_transform = 'AgX'; scene.view_settings.exposure = .55


def hexc(h):
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4))


world = bpy.data.worlds.new('Preview sky'); world.use_nodes = True; scene.world = world
world.node_tree.nodes['Background'].inputs['Color'].default_value = (*hexc('E3EEF8'), 1)
world.node_tree.nodes['Background'].inputs['Strength'].default_value = .65


def light(name, kind, pos, power, color, size=1):
    data = bpy.data.lights.new(name, kind); data.energy = power; data.color = color
    if kind == 'AREA':
        data.shape = 'DISK'; data.size = size
    ob = bpy.data.objects.new(name, data); scene.collection.objects.link(ob); ob.location = pos
    ob.rotation_euler = (-Vector(pos)).to_track_quat('-Z', 'Y').to_euler()


light('Sun', 'SUN', (3, -4, 6), 3.2, hexc('FFE7C2'))
light('Bounce', 'AREA', (-2, 3, -1.5), 120, hexc('5A503F'), 6)
light('Fill', 'AREA', (-3, -2, 3), 120, hexc('E3EEF8'), 4)
pts = [o.matrix_world @ Vector(c) for o in scene.objects if o.type == 'MESH' and o.visible_get() for c in o.bound_box]
lo = Vector(tuple(min(p[i] for p in pts) for i in range(3))); hi = Vector(tuple(max(p[i] for p in pts) for i in range(3)))
target = (lo + hi) / 2
cam = bpy.data.objects.new('PreviewCamera', bpy.data.cameras.new('PreviewCamera')); scene.collection.objects.link(cam)
cam.location = target + (Vector((2.6, -4.2, 2.6)) if front else Vector((3.4, 3.0, 2.8)))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler(); cam.data.type = 'ORTHO'
basis = cam.rotation_euler.to_matrix(); q = [basis.transposed() @ (p - target) for p in pts]
cam.data.ortho_scale = max(max(p.x for p in q) - min(p.x for p in q), (max(p.y for p in q) - min(p.y for p in q)) * 844 / 390) * 1.12
scene.camera = cam; scene.render.film_transparent = True; scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = str(out)
bpy.ops.render.render(write_still=True)
(out.parent / (out.stem + '-settings.json')).write_text(json.dumps({'resolution': [844, 390], 'engine': 'Cycles', 'device': scene.cycles.device, 'source': source.name, 'view': 'front' if front else 'battle'}, indent=2))
print('PREVIEW', out, flush=True)
