# scripts/blender/validate_unit.py
# The automated checks of unit art brief v3 section 8 for one unit .blend and its exported GLB.
# Writes <out_dir>/<unit>.validation.json and exits non-zero when a check fails.
#
#   python scripts/blender/validate_unit.py <unit.blend> <unit.glb> <out_dir>
import colorsys
import argparse
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_blender as ti  # noqa: E402
from build_lods import actions_for, play_action, triangle_count, unit_meshes  # noqa: E402

ARCHETYPE_A = {'Idle': 48, 'IdleAlt': 48, 'Walk': 24, 'Run': 16, 'Charge': 16, 'Attack': 24, 'Attack2': 30, 'Block': 24,
               'Hit': 10, 'Death': 36, 'DeathAlt': 36, 'Victory': 40, 'Rout': 16}
LOOPS = {'Idle', 'IdleAlt', 'Walk', 'Run', 'Charge', 'Attack', 'Attack2', 'Victory', 'Rout'}
RESERVED = ('team', 'tabard', 'tunic', 'surcoat', 'banner', 'flag', 'cloak', 'cape', 'livery', 'plume', 'crest', 'emblem', 'heraldry', 'insignia', 'decal')
SKIN_WORDS = ('skin', 'flesh', 'face')
PEOPLE = {'height': 1.0, 'footprint': (0.5, 0.4), 'tris': (1, 8000)}


def hue_deg(rgb):
    h, s, v = colorsys.rgb_to_hsv(*rgb)
    return h * 360, s, v


def evaluated_mesh(obj, depsgraph):
    ev = obj.evaluated_get(depsgraph)
    me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return verts


def check_blend(blend, report, height=1.0, lod=0, legacy=False, game_scale=None):
    bpy.ops.wm.open_mainfile(filepath=blend)
    scene = bpy.context.scene
    arm = next(o for o in bpy.context.scene.objects if o.type == 'ARMATURE')
    meshes = unit_meshes(arm, lod=lod)
    if not meshes:
        raise ValueError('No variant A LOD%d meshes bound to the armature' % lod)
    mesh = meshes[0]
    if len(meshes) != 1:
        raise ValueError('Unit validator currently requires one joined mesh per variant and LOD')
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            obj.hide_render = obj not in meshes
    for obj in meshes:
        obj.hide_set(False)
    me = mesh.data
    checks = report['checks']

    tris = triangle_count(me)
    report['triangles'] = tris
    limit = 1500 if lod == 1 or legacy else 8000
    report['lod'] = lod
    report['triangle_budget'] = limit
    report['authoring_height_m'] = height
    report['game_scale'] = game_scale
    checks['triangles_in_budget'] = (800 if legacy else 1) <= tris <= limit

    actions = actions_for(arm)
    missing_actions = sorted(set(ARCHETYPE_A) - set(actions))
    report['missing_clips'] = missing_actions
    if missing_actions:
        checks['clips_present_and_sized'] = False
    required_pose_actions = {'Idle', 'Walk'}
    if not required_pose_actions <= set(actions):
        raise ValueError('Cannot inspect poses: missing ' + ', '.join(sorted(required_pose_actions - set(actions))))

    def play(name, frame):
        play_action(arm, actions[name], frame)
    # rest pose = Idle frame 1
    play('Idle', 1)
    dg = bpy.context.evaluated_depsgraph_get()
    verts = evaluated_mesh(mesh, dg)
    # height to the top of the head (the helmet ridge is allowed above 1.0)
    required = set(ti.REQUIRED_BONES)
    missing = sorted(required - set(arm.data.bones.keys()))
    report['missing_bones'] = missing
    checks['bone_names'] = not missing
    if missing:
        raise ValueError('Cannot inspect poses: missing bones ' + ', '.join(missing))
    head = arm.data.bones['head']
    head_top = (arm.matrix_world @ head.tail_local).z
    zs = [v.z for v in verts]
    xs = [v.x for v in verts]
    ys = [v.y for v in verts]
    report['height_head_top'] = round(head_top, 4)
    report['height_max'] = round(max(zs), 4)
    report['min_z'] = round(min(zs), 4)
    checks['head_top_1m' if height == 1.0 else 'head_top_in_spec'] = abs(head_top - height) <= height * 0.05
    checks['feet_on_ground'] = -0.01 <= min(zs) <= 0.015
    # footprint without the weapon's reach forward: measure body-only vertices (not weapon/shield groups)
    gi = {vg.index: vg.name for vg in mesh.vertex_groups}
    body_x = [verts[v.index].x for v in me.vertices if all(gi[g.group] not in ('weapon', 'shield') for g in v.groups)]
    body_y = [verts[v.index].y for v in me.vertices if all(gi[g.group] not in ('weapon', 'shield') for g in v.groups)]
    fw = max(body_x) - min(body_x)
    fd = max(body_y) - min(body_y)
    report['footprint'] = [round(fw, 3), round(fd, 3)]
    checks['footprint'] = fw <= PEOPLE['footprint'][0] * 1.05 and fd <= PEOPLE['footprint'][1] * 1.05 + 0.1
    # facing -Y: the feet point to -Y (foot tail y < head y)
    foot = arm.data.bones['foot.L']
    checks['facing_minus_y'] = foot.tail_local.y < foot.head_local.y - 0.05
    checks['transforms_applied'] = all(abs(s - 1) < 1e-6 for obj in (mesh, arm) for s in obj.scale) and all(abs(v) < 1e-6 for obj in (mesh, arm) for v in (*obj.location, *obj.rotation_euler))

    # rig names, weights
    bones = {b.name for b in arm.data.bones}
    missing = [b for b in ti.REQUIRED_BONES if b not in bones]
    report['missing_bones'] = missing
    checks['bone_names'] = not missing
    checks['no_x_bones_in_game_model'] = not any(gi[g.group].startswith('x_') for v in me.vertices for g in v.groups)
    checks['every_vertex_weighted'] = all(len(v.groups) >= 1 and abs(sum(g.weight for g in v.groups) - 1.0) < 0.01 and all(gi[g.group] in bones for g in v.groups if g.weight > 0) for v in me.vertices)
    influences = [len([g for g in v.groups if g.weight > 1e-6]) for v in me.vertices]
    report['max_bone_influences'] = max(influences, default=0)
    checks['rigid_weights' if lod == 1 or legacy else 'smooth_weights_max_four'] = all(n == 1 if lod == 1 or legacy else 1 <= n <= 4 for n in influences)
    checks['authored_at_30fps'] = abs(scene.render.fps / scene.render.fps_base - 30) < 1e-6
    report['uv_layers'] = len(me.uv_layers)
    report['vertex_color_layers'] = len(me.color_attributes)
    if not legacy:
        checks['one_uv_map'] = len(me.uv_layers) == 1
        checks['no_vertex_colours'] = len(me.color_attributes) == 0

    # clips
    report['clips'] = {}
    all_clips_ok = True
    for name, frames in ARCHETYPE_A.items():
        a = actions.get(name)
        if not a:
            report['clips'][name] = 'missing'
            all_clips_ok = False
            continue
        n = int(a.frame_end - a.frame_start + 1)
        info = {'frames': n}
        ok = n == frames
        if name in LOOPS:
            # seamless: the pose one frame past the end equals frame 1
            play(name, 1)
            p1 = [(pb.rotation_quaternion.copy(), pb.location.copy()) for pb in arm.pose.bones]
            play(name, frames + 1)
            p2 = [(pb.rotation_quaternion.copy(), pb.location.copy()) for pb in arm.pose.bones]
            diff = max(max(min((q1 - q2).magnitude, (q1 + q2).magnitude) for (q1, _), (q2, _) in zip(p1, p2)), max((l1 - l2).length for (_, l1), (_, l2) in zip(p1, p2)))
            info['loop_gap'] = round(diff, 5)
            ok = ok and diff < 1e-3
        report['clips'][name] = info
        all_clips_ok = all_clips_ok and ok
    checks['clips_present_and_sized'] = all_clips_ok

    # Idle frame 1 not a T-pose: upper arms hang (mostly down)
    play('Idle', 1)
    pb = arm.pose.bones['upper_arm.L']
    dirn = (arm.matrix_world @ pb.tail) - (arm.matrix_world @ pb.head)
    checks['idle_not_tpose'] = dirn.normalized().z < -0.7

    # no vertex below the ground in any frame, feet pinned during contact frames of Walk
    below = 0.0
    lows = {}
    for name, frames in ARCHETYPE_A.items():
        if name not in actions:
            continue
        for f in range(1, frames + 1):
            play(name, f)
            dg = bpy.context.evaluated_depsgraph_get()
            vs = evaluated_mesh(mesh, dg)
            low = min(v.z for v in vs)
            if low < lows.get(name, (0, 0))[0]:
                lows[name] = (round(low, 4), f)
            below = min(below, low)
    report['lowest_vertex_any_frame'] = round(below, 4)
    report['lowest_vertex_per_clip'] = lows
    checks['nothing_below_ground'] = below >= -0.01
    # in-place walk: the planted foot must move backward at the clip's ground speed, so the
    # feet don't skate when the game moves the unit (brief 6.1: infantry walk 1.6 m/s)
    for clip, frames, speed in (('Walk', (1, 13), 1.6), ('Run', (1, 9), 2.6)):
        speeds, residuals = [], []
        for f0, foot in zip(frames, ('foot.L', 'foot.R')):
            play(clip, f0)
            a0 = (arm.matrix_world @ arm.pose.bones[foot].tail).copy()
            play(clip, f0 + 2)
            a1 = (arm.matrix_world @ arm.pose.bones[foot].tail).copy()
            dt = 2 / (scene.render.fps / scene.render.fps_base)
            speeds.append((a1.y - a0.y) / dt)
            travel = (a1 - a0) * (game_scale or 1.0) - Vector((0, speed * dt, 0))
            residuals.append(travel.length)
        report[clip.lower() + '_ground_speed_m_s'] = [round(v, 3) for v in speeds]
        report[clip.lower() + '_game_ground_speed_m_s'] = [round(v * game_scale, 3) for v in speeds] if game_scale is not None else None
        report[clip.lower() + '_contact_drift_m'] = [round(v, 4) for v in residuals]
        if legacy:
            checks[clip.lower() + '_feet_match_ground_speed'] = all(0.9 <= v <= 2.0 for v in speeds)
        elif game_scale is not None:
            checks[clip.lower() + '_feet_match_ground_speed'] = all(abs(v * game_scale - speed) <= speed * 0.05 for v in speeds)
            checks[clip.lower() + '_contact_drift_under_1cm'] = all(v < 0.01 for v in residuals)
        else:
            report.setdefault('omitted_checks', []).extend([clip.lower() + '_feet_match_ground_speed', clip.lower() + '_contact_drift_under_1cm'])

    # materials
    names = [m.name for m in me.materials]
    report['materials'] = names
    report['used_materials'] = sorted({names[p.material_index] for p in me.polygons if p.material_index < len(names)})
    checks['team_present'] = 'Team' in names
    checks['no_emblem'] = 'Emblem' not in names
    bad_words = []
    for n in names + [mesh.name, arm.name] + [b.name for b in arm.data.bones]:
        low = n.lower()
        if n != 'Team' and any(w in low for w in RESERVED):
            bad_words.append(n)
        if n != 'Skin' and any(w in low for w in SKIN_WORDS):
            bad_words.append(n)
    report['reserved_word_names'] = bad_words
    checks['no_reserved_words'] = not bad_words
    strong = []
    for m in me.materials:
        if m.name == 'Team':
            continue
        bsdf = next((node for node in m.node_tree.nodes if node.type == 'BSDF_PRINCIPLED'), None) if m.use_nodes else None
        c = bsdf.inputs['Base Color'].default_value[:3] if bsdf else m.diffuse_color[:3]
        srgb = tuple((v * 12.92) if v <= 0.0031308 else 1.055 * v ** (1 / 2.4) - 0.055 for v in c)
        h, s, v = hue_deg(srgb)
        for ref in (217, 25):  # hues of #3B82F6 and #F97316
            if min(abs(h - ref), 360 - abs(h - ref)) <= 20 and s > 0.6 and v > 0.7:
                strong.append(m.name)
    report['strong_team_hues_outside_team'] = strong
    checks['no_strong_blue_or_orange'] = not strong
    textures = {}
    for material in me.materials:
        if material and material.use_nodes:
            for node in material.node_tree.nodes:
                if node.type == 'TEX_IMAGE' and node.image:
                    textures[node.image.name] = list(node.image.size)
    report['textures'] = textures
    checks['textures_within_2k'] = all(max(size) <= 2048 for size in textures.values())
    if not legacy:
        checks['textured_model'] = bool(textures)
    play('Idle', 1)
    return arm, mesh


def team_coverage(blend_arm, out_dir, report):
    """Render Idle frame 1 at the game camera, direction 0, with Team as white emission and
    everything else black: coverage = white pixels / opaque pixels."""
    scene = bpy.context.scene
    for m in bpy.data.materials:
        if not m.use_nodes:
            continue
        nt = m.node_tree
        nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial')
        em = nt.nodes.new('ShaderNodeEmission')
        em.inputs['Color'].default_value = (1, 1, 1, 1) if m.name == 'Team' else (0, 0, 0, 1)
        em.inputs['Strength'].default_value = 1.0
        nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 16
    scene.cycles.use_denoising = False
    scene.render.film_transparent = True
    scene.view_settings.view_transform = 'Standard'
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    # no lights: emission only
    for o in [o for o in scene.objects if o.type == 'LIGHT']:
        bpy.data.objects.remove(o)
    world = scene.world or bpy.data.worlds.new('World')
    scene.world = world
    world.use_nodes = True
    for node in world.node_tree.nodes:
        if node.type == 'BACKGROUND':
            node.inputs['Strength'].default_value = 0.0
    cam = ti.setup_camera(scene, Vector((0, 0, 0.5)), ti.BATTLE_CAM_DIR, 1.3, 300)
    path = os.path.join(out_dir, 'team_mask.png')
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    img = bpy.data.images.load(path)
    px = img.pixels[:]
    n = len(px) // 4
    opaque = team = 0
    for i in range(n):
        a = px[i * 4 + 3]
        if a > 0.5:
            opaque += 1
            if px[i * 4] > 0.5:
                team += 1
    cov = team / max(1, opaque)
    report['team_coverage'] = round(cov, 4)
    report['checks']['team_coverage_15_to_30'] = 0.15 <= cov <= 0.30
    bpy.data.objects.remove(cam)


def check_glb(glb, report):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=glb)
    names = {a.name for a in bpy.data.actions}
    # the importer names actions "<Action>" or "<Action>_rig"; accept either prefix form
    found = {n.split('_')[0] if n.split('_')[0] in ARCHETYPE_A else n for n in names}
    report['glb_actions'] = sorted(found)
    bones = set()
    for o in bpy.data.objects:
        if o.type == 'ARMATURE':
            bones |= {b.name for b in o.data.bones}
    mats = {m.name for m in bpy.data.materials}
    report['glb_bones_ok'] = [b for b in ti.REQUIRED_BONES if b not in bones]
    report['glb_materials'] = sorted(mats)
    report['checks']['glb_round_trip'] = (not report['glb_bones_ok']) and set(report.get('used_materials', report.get('materials', ['Team']))) <= mats and all(a in found for a in ARCHETYPE_A)
    # Blender 5.2's importer creates an Icosphere custom bone display mesh.
    # It is a UI helper, not geometry contained in the delivered GLB.
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.find_armature()]
    report['glb_triangles'] = sum(triangle_count(o.data) for o in meshes)
    report['checks']['glb_triangle_budget'] = 0 < report['glb_triangles'] <= report.get('triangle_budget', 8000)
    report['checks']['glb_no_helper_bones'] = not any(name.startswith('x_') for name in bones)
    report['glb_bytes'] = os.path.getsize(glb)


def main(blend, glb, out_dir, height=1.0, lod=0, legacy=False, skip_team_render=False, game_scale=None):
    blend, glb, out_dir = map(os.path.abspath, (blend, glb, out_dir))
    os.makedirs(out_dir, exist_ok=True)
    unit = os.path.splitext(os.path.basename(blend))[0]
    report = {'unit': unit, 'checks': {}}
    try:
        check_blend(blend, report, height=height, lod=lod, legacy=legacy, game_scale=game_scale)
        if not skip_team_render:
            team_coverage(None, out_dir, report)
        else:
            report.setdefault('omitted_checks', []).append('team_coverage_15_to_30')
        check_glb(glb, report)
    except Exception as error:
        report['error'] = '%s: %s' % (type(error).__name__, error)
        report['checks']['validation_completed'] = False
    report['checks_passed'] = all(report['checks'].values())
    report['complete'] = not bool(report.get('omitted_checks'))
    report['passed'] = report['checks_passed'] and report['complete']
    path = os.path.join(out_dir, unit + '.validation.json')
    with open(path, 'w') as f:
        json.dump(report, f, indent=2)
    print(json.dumps(report, indent=2))
    print('PASSED' if report['passed'] else 'FAILED', path)
    sys.exit(0 if report['passed'] else 1)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    parser = argparse.ArgumentParser(description='Validate a classical infantry blend and GLB against the authoritative model brief')
    parser.add_argument('blend')
    parser.add_argument('glb')
    parser.add_argument('out_dir')
    parser.add_argument('--height', type=float, default=1.0)
    parser.add_argument('--game-scale', type=float, default=None, help='World metres per authoring metre (latest brief: 1.8)')
    parser.add_argument('--lod', type=int, choices=(0, 1), default=0)
    parser.add_argument('--legacy', action='store_true', help='Old 800-1500 triangle rigid model contract')
    parser.add_argument('--skip-team-render', action='store_true', help='Partial smoke validation only')
    args = parser.parse_args(argv)
    main(args.blend, args.glb, args.out_dir, args.height, args.lod, args.legacy, args.skip_team_render, args.game_scale if args.game_scale is not None else 1.0 if args.legacy else None)
