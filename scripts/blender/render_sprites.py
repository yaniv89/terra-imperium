# scripts/blender/render_sprites.py
# Sprite sheets per unit art brief v3 section 7.2: every clip, 8 directions (direction 0 faces
# Blender -Y, then 45 degrees counter-clockwise seen from above), every second frame (15 fps),
# the game camera and light, transparent background, a colour sheet (WebP) and a mask sheet (PNG:
# red = Team, green = Skin and Hair) rendered as an AOV in the same pass, plus the sprites JSON.
#
#   python scripts/blender/render_sprites.py <unit.blend> <out_dir> [Clip,Clip,...] [samples]
import json
import argparse
import glob
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402
from build_lods import actions_for, play_action, unit_meshes  # noqa: E402

CELL, PPM, ANCHOR = 192, 150, (96, 180)
CLIPS = {'Idle': (48, True), 'IdleAlt': (48, True), 'Walk': (24, True), 'Run': (16, True), 'Charge': (16, True),
         'Attack': (24, True), 'Attack2': (30, True), 'Block': (24, False), 'Hit': (10, False), 'Death': (36, False),
         'DeathAlt': (36, False), 'Victory': (40, True), 'Rout': (16, True)}
# 0-based sprite frame indices of the brief's contact / impact frames (source frame // 2)
# First sampled frame at/after the source event; Attack10 samples at11, Attack2 at13,
# Block8 at9. This avoids triggering damage before the authored contact.
MARKS = {'Attack': ('contactFrame', 5), 'Attack2': ('contactFrame', 6), 'Block': ('impactFrame', 4)}
VARIANT_B_ACTIONS = {'Idle', 'IdleAlt', 'Walk', 'Run', 'Attack', 'Death'}
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
        node = next((n for n in nt.nodes if n.type == 'OUTPUT_AOV' and n.aov_name == 'mask'), None) or nt.nodes.new('ShaderNodeOutputAOV')
        node.name = 'mask'
        node.aov_name = 'mask'
        color = (1, 0, 0, 1) if m.name == 'Team' else (0, 1, 0, 1) if m.name in ('Skin', 'Hair') else (0, 0, 0, 1)
        node.inputs['Color'].default_value = color


def setup_compositor(scene, out_dir):
    modern = hasattr(scene, 'compositing_node_group')
    if modern:
        scene.compositing_node_group = bpy.data.node_groups.new('unit_sprite_compositor', 'CompositorNodeTree')
        nt = scene.compositing_node_group
        nt.interface.new_socket(name='Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    else:
        scene.use_nodes = True
        nt = scene.node_tree
    nt.nodes.clear()
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('NodeGroupOutput' if modern else 'CompositorNodeComposite')
    nt.links.new(rl.outputs['Image'], comp.inputs['Image'])
    fo = nt.nodes.new('CompositorNodeOutputFile')
    if modern:
        fo.directory = out_dir
        fo.file_output_items.clear()
        fo.file_output_items.new('RGBA', 'mask')
    else:
        fo.base_path = out_dir
        fo.file_slots.clear()
        fo.file_slots.new('mask')
    fo.format.file_format = 'OPEN_EXR'
    fo.format.color_depth = '16'
    # alpha-multiplied mask so it stays inside the colour pass's silhouette
    alpha = nt.nodes.new('CompositorNodeSetAlpha')
    nt.links.new(rl.outputs['mask'], alpha.inputs['Image'])
    nt.links.new(rl.outputs['Alpha'], alpha.inputs['Alpha'])
    nt.links.new(alpha.outputs['Image'], fo.inputs['mask'])
    return fo


def load_rgba(path):
    img = bpy.data.images.load(path)
    # PNG has already received its display transform. Read actual file channel values;
    # mask EXR is also data, not a colour texture.
    img.colorspace_settings.name = 'Non-Color'
    img.alpha_mode = 'STRAIGHT'
    w, h = img.size
    arr = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]
    bpy.data.images.remove(img)
    return arr


def save_png(arr, path):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    img.colorspace_settings.name = 'Non-Color'
    img.pixels = arr[::-1].ravel().tolist()
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def save_webp(arr, path, quality=85):
    h, w = arr.shape[:2]
    img = bpy.data.images.new(os.path.basename(path), w, h, alpha=True)
    linear = arr.copy()
    rgb = linear[..., :3]
    linear[..., :3] = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    img.pixels = linear[::-1].ravel().tolist()
    img.filepath_raw = path
    img.file_format = 'WEBP'
    scene = bpy.context.scene
    settings = scene.render.image_settings
    prev = (settings.file_format, settings.color_mode, settings.quality)
    view = scene.view_settings
    previous_view = (view.view_transform, view.look, view.exposure, view.gamma)
    # Apply just sRGB encoding when assembling frames, never Filmic a second time.
    view.view_transform, view.look, view.exposure, view.gamma = 'Standard', 'None', 0, 1
    settings.file_format, settings.color_mode, settings.quality = 'WEBP', 'RGBA', quality
    img.save_render(path, scene=scene)
    settings.file_format, settings.color_mode, settings.quality = prev
    view.view_transform, view.look, view.exposure, view.gamma = previous_view
    bpy.data.images.remove(img)


def main(blend, out_dir, only=None, samples=32, directions=None, frame_limit=None):
    blend, out_dir = map(os.path.abspath, (blend, out_dir))
    os.makedirs(out_dir, exist_ok=True)
    tmp = os.path.join(out_dir, '_frames')
    os.makedirs(tmp, exist_ok=True)
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    meshes = unit_meshes(arm)
    if not meshes:
        raise ValueError('No variant A LOD0 unit meshes')
    unit = os.path.splitext(os.path.basename(blend))[0].removesuffix('_lods')
    for obj in scene.objects:
        if obj.type == 'MESH':
            obj.hide_render = obj not in meshes
    directions = list(range(8)) if directions is None else directions
    if not directions or any(d not in range(8) for d in directions):
        raise ValueError('Directions must be indices 0 through 7')
    if frame_limit is not None and frame_limit < 1:
        raise ValueError('Frame limit must be positive')
    ti.setup_render(scene, samples=samples)
    ti.setup_lights(scene)
    add_mask_aov(scene)
    fo = setup_compositor(scene, tmp)
    # the cell: CELL px square at PPM px/m; the anchor (feet) at ANCHOR from the top-left, so the
    # camera target sits (CELL/2 - ANCHOR.x, ANCHOR.y - CELL/2) px off the figure's feet in screen
    # space. With an orthographic camera that is a shift along the camera's right and up axes.
    cam = ti.setup_camera(scene, Vector((0, 0, 0)), ti.BATTLE_CAM_DIR, CELL / PPM, PPM)
    bpy.context.view_layer.update()
    right = cam.matrix_world.to_3x3() @ Vector((1, 0, 0))
    up = cam.matrix_world.to_3x3() @ Vector((0, 1, 0))
    dx = (CELL / 2 - ANCHOR[0]) / PPM
    dy = (ANCHOR[1] - CELL / 2) / PPM
    # the feet (world origin) must land at the anchor: move the camera the opposite way
    cam.location = cam.location - right * dx + up * dy
    actions = actions_for(arm)
    requested = set(only or CLIPS)
    missing = requested - set(actions)
    unknown = requested - set(CLIPS)
    if missing or unknown:
        raise ValueError('Missing/unknown requested actions: ' + ', '.join(sorted(missing | unknown)))
    yaw0 = arm.rotation_euler.z
    sprites = {
        'unit': unit, 'cell': [CELL, CELL], 'anchor': list(ANCHOR), 'pixelsPerMetre': PPM, 'directions': len(directions),
        'directionIndices': directions, 'complete': only is None and frame_limit is None and directions == list(range(8)),
        'direction0': 'facing Blender -Y (glTF +Z)', 'directionOrder': 'counter-clockwise seen from above, 45 degrees each',
        'camera': {'type': 'orthographic', 'elevationDeg': 41.5, 'azimuthDeg': 45}, 'fps': 15,
        'mask': {'r': 'team', 'g': 'skin', 'b': 'unused'}, 'skinBase': '#D9A07A', 'variants': ['A'], 'variantBActions': [],
        'actions': {}
    }
    for name, (frames, loop) in CLIPS.items():
        if only and name not in only:
            continue
        sampled = list(range(1, frames + 1, 2))
        if frame_limit is not None:
            sampled = sampled[:frame_limit]
        cols = min(len(sampled), MAX_SHEET_W // CELL)
        blocks = math.ceil(len(sampled) / cols)
        sheet = np.zeros((blocks * len(directions) * CELL, cols * CELL, 4), dtype=np.float32)
        mask = np.zeros_like(sheet)
        for row, d in enumerate(directions):
            arm.rotation_euler.z = yaw0 + math.radians(45 * d)
            for k, f in enumerate(sampled):
                play_action(arm, actions[name], f)
                color_path = os.path.join(tmp, 'c_%s_%d_%03d.png' % (name, d, f))
                scene.render.filepath = color_path
                prefix = 'm_%s_%d_%03d_' % (name, d, f)
                if hasattr(fo, 'file_output_items'):
                    fo.file_name = prefix
                else:
                    fo.file_slots[0].path = prefix
                bpy.ops.render.render(write_still=True)
                col = load_rgba(color_path)
                paths = glob.glob(os.path.join(tmp, prefix + '*.exr'))
                if len(paths) != 1:
                    raise ValueError('Expected one mask AOV output, found %s' % paths)
                mask_path = paths[0]
                msk = load_rgba(mask_path)
                block, c = divmod(k, cols)
                r0 = (block * len(directions) + row) * CELL
                sheet[r0:r0 + CELL, c * CELL:(c + 1) * CELL] = col
                m = np.clip(msk, 0, 1)
                m[..., 2] = 0
                m[..., :2] = np.minimum(m[..., :2], col[..., 3:4])
                m[..., 3] = col[..., 3]
                mask[r0:r0 + CELL, c * CELL:(c + 1) * CELL] = m
                os.remove(color_path)
                os.remove(mask_path)
        arm.rotation_euler.z = yaw0
        color_file = '%s_%s.webp' % (unit, name)
        mask_file = '%s_%s_mask.png' % (unit, name)
        save_webp(sheet, os.path.join(out_dir, color_file))
        save_png(mask, os.path.join(out_dir, mask_file))
        entry = {'file': color_file, 'mask': mask_file, 'frames': len(sampled), 'loop': loop, 'columns': cols, 'rowBlocks': blocks, 'sourceFrames': sampled}
        if name in MARKS and MARKS[name][1] < len(sampled):
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
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('blend')
    parser.add_argument('out_dir')
    parser.add_argument('clips', nargs='?', default=None)
    parser.add_argument('samples', nargs='?', type=int, default=32)
    parser.add_argument('--directions', help='Comma-separated direction indices for partial smoke rendering')
    parser.add_argument('--frame-limit', type=int, help='Partial smoke render; metadata complete=false')
    args = parser.parse_args(argv)
    main(args.blend, args.out_dir, args.clips.split(',') if args.clips else None, args.samples,
         [int(d) for d in args.directions.split(',')] if args.directions else None, args.frame_limit)
