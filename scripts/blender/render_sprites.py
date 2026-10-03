# scripts/blender/render_sprites.py
# Sprite sheets per unit art brief v3 section 7.2: every clip, 8 directions (direction 0 faces
# Blender -Y, then 45 degrees counter-clockwise seen from above), every second frame (15 fps),
# the game camera and light, transparent background, a colour sheet (WebP) and a mask sheet (PNG:
# red = Team, green = Skin and Hair) rendered as an AOV in the same pass, plus the sprites JSON.
#
#   python scripts/blender/render_sprites.py <unit.blend> <out_dir> [Clip,Clip,...] [samples]
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402

CELL, PPM, ANCHOR = 192, 150, (96, 180)
CLIPS = {'Idle': (48, True), 'IdleAlt': (48, True), 'Walk': (24, True), 'Run': (16, True), 'Charge': (16, True),
         'Attack': (24, True), 'Attack2': (30, True), 'Block': (24, False), 'Hit': (10, False), 'Death': (36, False),
         'DeathAlt': (36, False), 'Victory': (40, True), 'Rout': (16, True)}
# 0-based sprite frame indices of the brief's contact / impact frames (source frame // 2)
MARKS = {'Attack': ('contactFrame', 4), 'Attack2': ('contactFrame', 6), 'Block': ('impactFrame', 3)}
MAX_SHEET_W = 4096


def add_mask_aov(scene):
    vl = scene.view_layers[0]
    if 'mask' not in [a.name for a in vl.aovs]:
        aov = vl.aovs.add()
        aov.name = 'mask'
        aov.type = 'COLOR'
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        if any(n.type == 'OUTPUT_AOV' for n in nt.nodes):
            continue
        node = nt.nodes.new('ShaderNodeOutputAOV')
        node.name = 'mask'
        node.aov_name = 'mask'
        color = (1, 0, 0, 1) if m.name == 'Team' else (0, 1, 0, 1) if m.name in ('Skin', 'Hair') else (0, 0, 0, 1)
        node.inputs['Color'].default_value = color


def setup_compositor(scene, out_dir):
    scene.use_nodes = True
    nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    fo = nt.nodes.new('CompositorNodeOutputFile')
    fo.base_path = out_dir
    fo.format.file_format = 'OPEN_EXR'
    fo.format.color_depth = '16'
    fo.file_slots.clear()
    fo.file_slots.new('mask')
    # alpha-multiplied mask so it stays inside the colour pass's silhouette
    alpha = nt.nodes.new('CompositorNodeSetAlpha')
    nt.links.new(rl.outputs['mask'], alpha.inputs['Image'])
    nt.links.new(rl.outputs['Alpha'], alpha.inputs['Alpha'])
    nt.links.new(alpha.outputs['Image'], fo.inputs['mask'])
    return fo


def load_rgba(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return arr


def save_png(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels = arr[::-1].ravel().tolist()
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def save_webp(arr, path, quality=85):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.pixels = arr[::-1].ravel().tolist()
    img.filepath_raw = path
    img.file_format = 'WEBP'
    scene = bpy.context.scene
    settings = scene.render.image_settings
    prev = (settings.file_format, settings.color_mode, settings.quality)
    settings.file_format, settings.color_mode, settings.quality = 'WEBP', 'RGBA', quality
    img.save_render(path, scene=scene)
    settings.file_format, settings.color_mode, settings.quality = prev
    bpy.data.images.remove(img)


def main(blend, out_dir, only=None, samples=32):
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, '_frames')
    os.makedirs(tmp, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    mesh = next(o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm)
    unit = mesh.name
    ti.setup_render(scene, samples=samples)
    ti.setup_lights(scene)
    add_mask_aov(scene)
    fo = setup_compositor(scene, tmp)
    # the cell: CELL px square at PPM px/m; the anchor (feet) at ANCHOR from the top-left, so the
    # camera target sits (CELL/2 - ANCHOR.x, ANCHOR.y - CELL/2) px off the figure's feet in screen
    # space. With an orthographic camera that is a shift along the camera's right and up axes.
    cam = ti.setup_camera(scene, Vector((0, 0, 0)), ti.BATTLE_CAM_DIR, CELL / PPM, PPM)
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
    dx = (CELL / 2 - ANCHOR[0]) / PPM
    dy = (ANCHOR[1] - CELL / 2) / PPM
    # the feet (world origin) must land at the anchor: move the camera the opposite way
    cam.location = cam.location - right * dx + up * dy
    tracks = {t.name: t for t in arm.animation_data.nla_tracks}
    for t in tracks.values():
        t.mute = True
    yaw0 = arm.rotation_euler.z
    sprites = {
        'unit': unit, 'cell': [CELL, CELL], 'anchor': list(ANCHOR), 'pixelsPerMetre': PPM, 'directions': 8,
        'direction0': 'facing Blender -Y (glTF +Z)', 'directionOrder': 'counter-clockwise seen from above, 45 degrees each',
        'camera': {'type': 'orthographic', 'elevationDeg': 41.5, 'azimuthDeg': 45}, 'fps': 15,
        'mask': {'r': 'team', 'g': 'skin', 'b': 'unused'}, 'skinBase': '#D9A07A', 'variants': ['A'], 'variantBActions': [],
        'actions': {}
    }
    for name, (frames, loop) in CLIPS.items():
        if only and name not in only:
            continue
        if name not in tracks:
            continue
        arm.animation_data.action = tracks[name].strips[0].action
        sampled = list(range(1, frames + 1, 2))
        cols = min(len(sampled), MAX_SHEET_W // CELL)
        blocks = math.ceil(len(sampled) / cols)
        sheet = np.zeros((blocks * 8 * CELL, cols * CELL, 4), dtype=np.float32)
        mask = np.zeros_like(sheet)
        for d in range(8):
            arm.rotation_euler.z = yaw0 + math.radians(45 * d)
            for k, f in enumerate(sampled):
                scene.frame_set(f)
                color_path = os.path.join(tmp, 'c_%s_%d_%03d.png' % (name, d, f))
                scene.render.filepath = color_path
                fo.file_slots[0].path = 'm_%s_%d_%03d_' % (name, d, f)
                bpy.ops.render.render(write_still=True)
                col = load_rgba(color_path)
                mask_path = os.path.join(tmp, 'm_%s_%d_%03d_%04d.exr' % (name, d, f, f))
                msk = load_rgba(mask_path)
                block, c = divmod(k, cols)
                r0 = (block * 8 + d) * CELL
                sheet[r0:r0 + CELL, c * CELL:(c + 1) * CELL] = col
                m = np.clip(msk, 0, 1)
                m[..., 2] = 0
                m[..., 3] = col[..., 3]
                mask[r0:r0 + CELL, c * CELL:(c + 1) * CELL] = m
                os.remove(color_path)
                os.remove(mask_path)
        arm.rotation_euler.z = yaw0
        color_file = '%s_%s.webp' % (unit, name)
        mask_file = '%s_%s_mask.png' % (unit, name)
        save_webp(sheet, os.path.join(out_dir, color_file))
        save_png(mask, os.path.join(out_dir, mask_file))
        entry = {'file': color_file, 'mask': mask_file, 'frames': len(sampled), 'loop': loop, 'columns': cols, 'rowBlocks': blocks}
        if name in MARKS:
            entry[MARKS[name][0]] = MARKS[name][1]
        if not loop:
            entry['holdLast'] = True
        sprites['actions'][name] = entry
        print('sheet', name, sheet.shape, 'bytes', os.path.getsize(os.path.join(out_dir, color_file)) + os.path.getsize(os.path.join(out_dir, mask_file)))
    with open(os.path.join(out_dir, '%s.sprites.json' % unit), 'w') as f:
        json.dump(sprites, f, indent=2)
    total = sum(os.path.getsize(os.path.join(out_dir, f)) for f in os.listdir(out_dir) if f.endswith(('.webp', '.png')))
    print('total sprite bytes', total)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    only = argv[2].split(',') if len(argv) > 2 and argv[2] else None
    main(argv[0], argv[1], only, int(argv[3]) if len(argv) > 3 else 32)
