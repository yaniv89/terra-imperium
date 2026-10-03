# scripts/blender/render_previews.py
# Preview renders of a unit .blend (unit art brief v3, 7.4 and addendum B): the game camera at
# several sizes in blue and orange, a turnaround from the battle camera, a map-camera check on
# three terrains, and one frame per clip.
#
#   python scripts/blender/render_previews.py <unit.blend> <out_dir> [quick]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402


def unit_objects():
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm)
    return arm, mesh


def set_clip(arm, name, frame):
    for track in arm.animation_data.nla_tracks:
        track.mute = track.name != name
    bpy.context.scene.frame_set(frame)


def render(scene, path):
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def ground_plane(color, size=6.0):
    me = bpy.data.meshes.new('ground')
    me.from_pydata([(-size, -size, 0), (size, -size, 0), (size, size, 0), (-size, size, 0)], [], [(0, 1, 2, 3)])
    ob = bpy.data.objects.new('ground', me)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new('ground_mat')
    mat.use_nodes = True
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*ti.srgb_to_linear(ti.hex_rgb(color)), 1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 1.0
    me.materials.append(mat)
    return ob


def main(blend, out_dir, quick=False):
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    arm, mesh = unit_objects()
    unit = mesh.name
    ti.setup_render(scene, samples=24 if quick else 64)
    ti.setup_lights(scene)
    target = Vector((0, 0, 0.5))
    yaw = arm.rotation_euler.z

    # 1. hero at the game camera: 150, 60 and 40 px tall figure, blue and orange (brief 2, step 2)
    set_clip(arm, 'Idle', 1)
    for color, label in ((ti.TEAM_BLUE, 'blue'), (ti.TEAM_ORANGE, 'orange')):
        ti.tint_team(color)
        for px in ((150,) if quick else (300, 150, 60, 40)):
            cam = ti.setup_camera(scene, target, ti.BATTLE_CAM_DIR, 1.3, px / 1.0, aspect=1.0)
            render(scene, os.path.join(out_dir, '%s_hero_%s_%d.png' % (unit, label, px)))
            bpy.data.objects.remove(cam)
    ti.tint_team(ti.TEAM_BLUE)

    # 2. the 8 sprite directions at the battle camera (direction 0 faces -Y, then 45 deg ccw)
    if not quick:
        cam = ti.setup_camera(scene, target, ti.BATTLE_CAM_DIR, 1.3, 150)
        for d in range(8):
            arm.rotation_euler.z = yaw + math.radians(45 * d)
            render(scene, os.path.join(out_dir, '%s_dir%d.png' % (unit, d)))
        arm.rotation_euler.z = yaw
        bpy.data.objects.remove(cam)

    # 3. map-camera check (addendum B): from the south, 55 deg up, sun upper left, three terrains
    set_clip(arm, 'Idle', 1)
    ti.setup_lights(scene, sun_dir=ti.MAP_SUN_DIR)
    for terrain, color in (('grass', '#6f8f3e'), ('desert', '#d9c27a'), ('snow', '#eef2f4')):
        g = ground_plane(color)
        scene.render.film_transparent = False
        for px in ((95,) if quick else (95, 24)):
            cam = ti.setup_camera(scene, Vector((0, 0, 0.45)), ti.MAP_CAM_DIR, 1.1, px / 1.0)
            render(scene, os.path.join(out_dir, '%s_map_%s_%d.png' % (unit, terrain, px)))
            bpy.data.objects.remove(cam)
        bpy.data.objects.remove(g)
    scene.render.film_transparent = True
    ti.setup_lights(scene)

    # 4. one key frame per clip at the battle camera (the sharpest pose of each)
    if not quick:
        cam = ti.setup_camera(scene, target, ti.BATTLE_CAM_DIR, 1.5, 120)
        picks = {'Idle': 1, 'IdleAlt': 14, 'Walk': 7, 'Run': 5, 'Charge': 5, 'Attack': 10, 'Attack2': 14, 'Block': 8,
                 'Hit': 3, 'Death': 36, 'DeathAlt': 36, 'Victory': 20, 'Rout': 5}
        for name, frame in picks.items():
            if name in [t.name for t in arm.animation_data.nla_tracks]:
                set_clip(arm, name, frame)
                render(scene, os.path.join(out_dir, '%s_clip_%s.png' % (unit, name)))
        bpy.data.objects.remove(cam)
    ti.reset_team()
    if not quick:
        contact_sheets(unit, out_dir)
    print('previews in', out_dir)


def contact_sheets(unit, out_dir):
    """One image per group so a review needs five looks, not forty."""
    import numpy as np

    def load(name):
        im = bpy.data.images.load(os.path.join(out_dir, name))
        w, h = im.size
        a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
        bpy.data.images.remove(im)
        return a

    def sheet(files, out, cols, bg=(0.45, 0.45, 0.45, 1)):
        ims = [load(f) for f in files]
        cw = max(i.shape[1] for i in ims)
        ch = max(i.shape[0] for i in ims)
        rows = (len(ims) + cols - 1) // cols
        canvas = np.zeros((rows * ch, cols * cw, 4), dtype=np.float32)
        canvas[...] = bg
        for k, im in enumerate(ims):
            r, c = divmod(k, cols)
            h, w = im.shape[:2]
            a = im[..., 3:4]
            region = canvas[r * ch:r * ch + h, c * cw:c * cw + w]
            region[..., :3] = im[..., :3] * a + region[..., :3] * (1 - a)
        img = bpy.data.images.new('sheet', cols * cw, rows * ch, alpha=True)
        img.pixels = canvas[::-1].ravel().tolist()
        img.filepath_raw = os.path.join(out_dir, out)
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
    clips = ['Idle', 'IdleAlt', 'Walk', 'Run', 'Charge', 'Attack', 'Attack2', 'Block', 'Hit', 'Death', 'DeathAlt', 'Victory', 'Rout']
    sheet(['%s_dir%d.png' % (unit, d) for d in range(8)], 'sheet_dirs.png', 4)
    sheet(['%s_clip_%s.png' % (unit, c) for c in clips if os.path.exists(os.path.join(out_dir, '%s_clip_%s.png' % (unit, c)))], 'sheet_clips.png', 5)
    sheet(['%s_hero_blue_300.png' % unit, '%s_hero_orange_300.png' % unit], 'sheet_hero.png', 2)
    sheet(['%s_map_%s_95.png' % (unit, t) for t in ('grass', 'desert', 'snow')] + ['%s_map_%s_24.png' % (unit, t) for t in ('grass', 'desert', 'snow')], 'sheet_map.png', 3)
    sheet(['%s_hero_blue_%d.png' % (unit, p) for p in (150, 60, 40)] + ['%s_hero_orange_%d.png' % (unit, p) for p in (150, 60, 40)], 'sheet_small.png', 3)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    main(argv[0], argv[1], quick=(len(argv) > 2 and argv[2] == 'quick'))
