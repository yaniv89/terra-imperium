# scripts/blender/render_map_previews.py
# Previews of a map model from the game's own camera (plans/model-brief-for-claude.md, section 7):
# an 844 x 390 frame at zoom k 10, 40 and 150, on grass green and on a strong nation blue, with
# the LOD the game shows at that k; plus front, top and three-quarter views on the concept's grey
# so the model can be laid next to the 2D sheet.
#
#   python scripts/blender/render_map_previews.py <model.blend> <out_dir> [concept.png]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402

FRAME = (844, 390)
PX_PER_UNIT_AT_K = 2.25  # a 40 m (4 unit) town is 90 px wide at k 10
GRASS = '#6a8a3c'
BLUE = '#3B82F6'
CONCEPT_GREY = '#7F7F7F'
MAP_SUN = Vector((-0.55, -0.35, 0.76)).normalized()  # upper left of the screen, the camera in the south


def elevation_at(k):
    """55 degrees at k 10 down to 30 at k 200, linear in log k (the brief's tilt)."""
    t = min(1.0, max(0.0, math.log(k / 10) / math.log(20)))
    return 55 - 25 * t


def lod_at(k):
    return 2 if k < 20 else 1 if k < 40 else 0


def show_lod(root, lod):
    for c in root.children:
        c.hide_render = c.name != 'LOD%d' % lod


def ortho_cam(scene, target, direction, width_units, res):
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    cam.location = Vector(target) + direction.normalized() * 30
    cam.rotation_mode = 'QUATERNION'
    cam.rotation_quaternion = (Vector(target) - cam.location).to_track_quat('-Z', 'Y')
    cam_data.ortho_scale = width_units
    cam_data.clip_end = 100
    scene.render.resolution_x, scene.render.resolution_y = res
    scene.camera = cam
    return cam


def plane(color, z=-0.001, size=60):
    me = bpy.data.meshes.new('bg')
    me.from_pydata([(-size, -size, z), (size, -size, z), (size, size, z), (-size, size, z)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('bg', me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('bg')
    mat.use_nodes = True
    b = mat.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*ti.srgb_to_linear(ti.hex_rgb(color)), 1)
    b.inputs['Roughness'].default_value = 1.0
    me.materials.append(mat)
    return ob


def render(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def main(blend, out_dir, concept=None):
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    root = next(o for o in bpy.data.objects if o.type == 'EMPTY')
    name = root.name
    ti.setup_render(scene, samples=48, transparent=False)
    sun = ti.setup_lights(scene, sun_dir=MAP_SUN)
    sun.data.use_shadow = False  # the game has no real-time shadows: only the baked AO shows
    target = Vector((0, 0, 0.35))

    # 1. the game camera at k 10, 40, 150 on grass and on nation blue
    for bg_name, color in (('grass', GRASS), ('blue', BLUE)):
        bg = plane(color)
        for k in (10, 40, 150):
            show_lod(root, lod_at(k))
            e = math.radians(elevation_at(k))
            cam = ortho_cam(scene, target, Vector((0, -math.cos(e), math.sin(e))), FRAME[0] / (PX_PER_UNIT_AT_K * k), FRAME)
            render(scene, os.path.join(out_dir, '%s_k%d_%s.png' % (name, k, bg_name)))
            bpy.data.objects.remove(cam)
        bpy.data.objects.remove(bg)

    # 2. views to lay next to the concept: front (eye level, from the south), top, beauty
    show_lod(root, 0)
    bg = plane(CONCEPT_GREY)
    views = {
        'front': Vector((0, -1, 0.12)),
        'top': Vector((0, -0.0001, 1)),
        'beauty': Vector((-0.5, -0.5, 0.7071)),
    }
    for vname, d in views.items():
        aim = Vector((0, 0, {'front': 0.95, 'top': 0.0, 'beauty': 0.3}[vname]))
        cam = ortho_cam(scene, aim, d, 4.6, (1024, 560 if vname == 'front' else 760))
        render(scene, os.path.join(out_dir, '%s_view_%s.png' % (name, vname)))
        bpy.data.objects.remove(cam)
    bpy.data.objects.remove(bg)

    # 3. one contact sheet of the game-camera renders and one of the model against the concept
    sheet(out_dir, ['%s_k%d_%s.png' % (name, k, b) for b in ('grass', 'blue') for k in (10, 40, 150)], 'sheet_game_camera.png', 3)
    parts = ['%s_view_beauty.png' % name, '%s_view_top.png' % name]
    sheet(out_dir, parts, 'sheet_views.png', 2)
    if concept:
        compare(out_dir, concept, name)
    print('previews in', out_dir)
    sys.stdout.flush()
    os._exit(0)


def load(path):
    im = bpy.data.images.load(path)
    w, h = im.size
    a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1].copy()
    bpy.data.images.remove(im)
    return a


def save(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new('out', w, h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr[::-1]).ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def sheet(out_dir, files, out, cols, gap=6):
    ims = [load(os.path.join(out_dir, f)) for f in files]
    cw = max(i.shape[1] for i in ims)
    ch = max(i.shape[0] for i in ims)
    rows = (len(ims) + cols - 1) // cols
    canvas = np.ones((rows * ch + gap * (rows - 1), cols * cw + gap * (cols - 1), 4), dtype=np.float32)
    canvas[..., :3] = 0.12
    for k, im in enumerate(ims):
        r, c = divmod(k, cols)
        y, x = r * (ch + gap), c * (cw + gap)
        canvas[y:y + im.shape[0], x:x + im.shape[1]] = im
    save(canvas, os.path.join(out_dir, out))


def compare(out_dir, concept, name):
    """The concept sheet's beauty panel beside the model's beauty view, same height."""
    c = load(concept)
    h, w = c.shape[:2]
    # the sheet's beauty panel: bottom-left, about x 0.01-0.345, y 0.46-0.98 of the sheet
    panel = c[int(h * 0.495):int(h * 0.975), int(w * 0.008):int(w * 0.345)]
    m = load(os.path.join(out_dir, '%s_view_beauty.png' % name))
    # nearest-neighbour scale the model render to the panel height
    th = panel.shape[0]
    scale = th / m.shape[0]
    tw = int(m.shape[1] * scale)
    yi = (np.arange(th) / scale).astype(int).clip(0, m.shape[0] - 1)
    xi = (np.arange(tw) / scale).astype(int).clip(0, m.shape[1] - 1)
    ms = m[yi][:, xi]
    canvas = np.ones((th, panel.shape[1] + 8 + tw, 4), dtype=np.float32)
    canvas[..., :3] = 0.12
    canvas[:, :panel.shape[1]] = panel
    canvas[:, panel.shape[1] + 8:] = ms
    save(canvas, os.path.join(out_dir, 'sheet_concept_vs_model.png'))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(argv[0], argv[1], argv[2] if len(argv) > 2 else None)
