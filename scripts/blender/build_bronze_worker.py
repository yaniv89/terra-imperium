# scripts/blender/build_bronze_worker.py
# Bronze worker (labourer), quality pass of 2026-10-13 (after the spearman, build_bronze_infantry.py):
#   blender -b --factory-startup -P scripts/blender/build_bronze_worker.py
# Same contract as the first worker (Codex, 2026-10-07): the canonical rig, flat material colours,
# the Team and Skin tags, the tools as separate attachment objects (Basket, BasketBinding*,
# BasketHandle, MattockHandle, MattockHead, MattockSocket) and the twelve clips of the Worker list
# (Idle, Walk, Run, Carry, Chop, Mine, Harvest, Build, Repair, Deposit, Hit, Death) with their keys.
# What changed:
#   - the body parts of ti_figure.py: shaped head with eyes and brows, closed fists, plain sandals
#   - a civilian: bare chest and shoulders, a wrapped kilt with a fold, a Team waist sash with a
#     hanging end, a linen headcloth with a neck flap under a Team headband
#   - the basket rides high on the back and the left shoulder (Prop_Back), heaped with stone, on two
#     ropes; the left fist holds the left rope (BasketHandle); a short dark beard
#     (the look follows plans/art/concepts/oct13/units-bronze-set.png, design reference only)
#   - the arms in the ready pose: the mattock stands on its head in front, the right fist on the handle
#   - Deposit also tips the basket over the shoulder (Prop_Back); its old keys stay
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/bronze-worker/; copy the GLB to src/assets/units/bronze-worker.glb.
import bpy, sys, os, math, json
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402

UID = 'bronze-worker'
OUT = u.out_dir(UID)
arm = F.start({'Wood': '9A7443', 'Stone': '8E8A82', 'Leather': '5E3A26'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical

# ---- the mattock's line: its head on the ground ahead, the handle up through the right fist ----------
HAND_R = Vector((-.223, -.137, .604))
HEAD = Vector((-.265, -.270, .052))
shaft = (HAND_R - HEAD).normalized()
HAND_L = Vector((.225, -.130, .608))
ROPE_L = [Vector((.100, .100, .790)), Vector((.084, .004, .812)), Vector((.086, -.070, .748)), HAND_L]

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=False)
F.arms(shoulder='Skin')
F.fist('R', HAND_R, shaft)
F.fist('L', HAND_L, (ROPE_L[3] - ROPE_L[2]).normalized(), half=.022)
F.head()
profile = [(.535, .088, .060), (.600, .086, .060), (.655, .098, .068), (.700, .114, .075), (.740, .129, .078),
           (.765, .125, .072), (.790, .072, .050)]
torso = tube('BodyTorso', [((0, 0, z), (rx, ry), 'Spine' if z < .66 else 'Chest') for z, rx, ry in profile], 'Skin', 10, caps=(False, True))
for ring in (3, 4):  # a chest: the front of the upper rings stands a little proud
    for j in (9, 0, 1):
        torso.data.vertices[ring * 10 + j].co.y -= .007

# ---- kilt, fold, sash -----------------------------------------------------------------------------
tube('TeamKilt', vertical([.335, .385, .450, .515, .548], 0,
                          [(.134, .097), (.128, .092), (.116, .084), (.100, .072), (.090, .064)], 'Hips'), 'Team', 10, caps=(False, False))
raw('KiltFrontFold', [(-.060, -.094, .338), (-.012, -.102, .328), (-.016, -.076, .530), (-.050, -.070, .530),
                      (-.060, -.086, .338), (-.012, -.094, .328), (-.016, -.068, .530), (-.050, -.062, .530)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Team', 'Hips')
tube('KiltBelt', vertical([.522, .543, .566], 0, [(.101, .073), (.105, .077), (.093, .067)], 'Spine'), 'Team', 10, caps=(False, False))
raw('SashEnd', [(.030, -.080, .532), (.070, -.071, .532), (.078, -.094, .395), (.026, -.102, .395), (.030, -.074, .532), (.070, -.065, .532), (.078, -.086, .395), (.026, -.094, .395)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Team', 'Spine')

# ---- headcloth with a neck flap and a Team band, a short beard, the kilt's tufted hem ----------------------
F.headcloth('Team')
F.beard()
F.tufted_hem()

# ---- the basket on the back (Prop_Back): wicker wall, rim, leather bindings, a heap of stone -----------
P = 'Prop_Back'
cx, cy, z0, z1, n = .070, .172, .610, .850, 10
verts, faces = [], []
for radius, z in [(.060, z0), (.100, z1), (.086, z1), (.052, z0 + .020)]:
    for j in range(n):
        a = 2 * math.pi * j / n
        verts.append((cx + radius * math.cos(a), cy + radius * .84 * math.sin(a), z))
for ring in (0, 1, 2):
    for j in range(n):
        faces.append((ring * n + j, ring * n + (j + 1) % n, (ring + 1) * n + (j + 1) % n, (ring + 1) * n + j))
faces.append(tuple(range(3 * n, 4 * n)))
faces.append(tuple(reversed(range(0, n))))
raw('Basket', verts, faces, 'Wood', P, True)
for k, (z, radius) in enumerate([(z0 + .070, .075), (z0 + .170, .0925)]):
    tube(f'BasketBinding{k}', [((cx, cy, z - .009), (radius, radius * .84), P), ((cx, cy, z + .009), (radius + .003, (radius + .003) * .84), P)],
         'Leather', n, caps=(False, False), attachment=True)
tube('BasketLoad', [((cx, cy, z1 - .030), (.080, .067), P), ((cx - .008, cy + .004, z1 + .012), (.056, .046), P),
                    ((cx + .006, cy - .004, z1 + .034), (.022, .020), P)], 'Stone', 6, attachment=True)
tube('BasketHandle', [(tuple(p), .0085, w) for p, w in zip(ROPE_L, ['Chest', 'Chest', 'Chest', 'Hand_L'])] +
     [(tuple(HAND_L + (ROPE_L[3] - ROPE_L[2]).normalized() * .050), .0075, 'Hand_L')], 'Leather', 4, attachment=True)
tube('BasketStrap', [((-.020, .112, .800), .0085, 'Chest'), ((-.084, .004, .812), .0085, 'Chest'), ((-.086, -.072, .748), .0085, 'Chest'),
                     ((-.092, -.062, .650), .0085, 'Chest'), ((-.100, .060, .610), .0085, 'Spine')], 'Leather', 4, attachment=True)

# ---- the mattock (Prop_R): wooden handle, bronze socket, a broad blade with a pick at the back ---------
P = 'Prop_R'
fwd = Vector((0, -1, 0))
fwd = (fwd - shaft * fwd.dot(shaft)).normalized()
tube('MattockHandle', [(tuple(HEAD - shaft * .022), .0135, P), (tuple(HAND_R + shaft * .080), .0110, P)], 'Wood', 6, attachment=True)
tube('MattockHead', [(tuple(HEAD - fwd * .095), (.005, .005), P), (tuple(HEAD - fwd * .024), (.024, .018), P), (tuple(HEAD + fwd * .024), (.030, .018), P),
                     (tuple(HEAD + fwd * .090 - shaft * .008), (.052, .011), P), (tuple(HEAD + fwd * .150 - shaft * .030), (.062, .004), P)],
     'Metal', 4, attachment=True)
tube('MattockSocket', [(tuple(HEAD - shaft * .026), .024, P), (tuple(HEAD + shaft * .030), .020, P)], 'Metal', 6, attachment=True)

meshes = F.meshes
F.fix_normals()
shade_range = F.bake_shade()

# ---- clips: the Worker list of plans/ART-MODELS-PLAN.md and plans/ART-PRODUCTION-PLAN.md S8 (kept) ------
clips = {}


def add(name, period, keys, loop=False):
    action = u.make_action(arm, name, period, keys, loop)
    # Loop endpoints are included: period intervals at 20 fps, closed samples 1..period + 1.
    if loop:
        action.frame_end = period + 1
    clips[name] = {'frames': period + 1 if loop else period, 'fps': 20, 'loop': loop, 'period_intervals': period if loop else None}
    return action


rest = {}
breath = {'r': {'Chest': (0, 0, -1), 'Head': (0, 0, 2)}}
add('Idle', 40, [(1, rest), (21, breath), (41, rest)], True)
for name, period, amplitude in [('Walk', 20, 19), ('Run', 14, 30), ('Carry', 24, 14)]:
    def gait(sign):
        a = amplitude * sign
        return {'r': {'Leg_L': (-a, 0, 0), 'Leg_R': (a, 0, 0), 'Shin_L': (8 if sign == 1 else 23, 0, 0), 'Shin_R': (23 if sign == 1 else 8, 0, 0),
                      'Arm_L': ((2 if name == 'Carry' else 7) * sign, 0, 0), 'Arm_R': (-6 * sign, 0, 0),
                      'Forearm_L': (-3 if name == 'Carry' else 0, 0, 0), 'Chest': (5 if name == 'Carry' else 0, 0, 0)}}
    add(name, period, [(1, gait(1)), (1 + period // 2, gait(-1)), (period + 1, gait(1))], True)
add('Chop', 32, [(1, {}), (9, {'r': {'Arm_R': (-98, 0, -9), 'Forearm_R': (-22, 0, 0), 'Prop_R': (100, 0, 0), 'Head': (-8, 0, 0)}}),
                 (19, {'r': {'Chest': (14, 0, 6), 'Arm_R': (-9, 0, 0), 'Forearm_R': (6, 0, 0), 'Prop_R': (-12, 0, 0)}}), (33, {})], True)
add('Mine', 28, [(1, {'r': {'Chest': (8, 0, 0), 'Arm_R': (-20, 0, 0), 'Prop_R': (15, 0, 0)}}),
                 (9, {'r': {'Chest': (8, 0, -8), 'Arm_R': (-55, 0, 0), 'Forearm_R': (-14, 0, 0), 'Prop_R': (45, 0, 0)}}),
                 (17, {'r': {'Chest': (13, 0, 5), 'Arm_R': (-10, 0, 0), 'Forearm_R': (5, 0, 0), 'Prop_R': (0, 0, 0)}}),
                 (29, {'r': {'Chest': (8, 0, 0), 'Arm_R': (-20, 0, 0), 'Prop_R': (15, 0, 0)}})], True)
add('Harvest', 36, [(1, {}), (10, {'r': {'Chest': (23, 0, -7), 'Head': (-9, 0, 0), 'Arm_R': (-22, 0, 0), 'Forearm_R': (25, 0, 0)}}),
                    (22, {'r': {'Chest': (23, 0, 9), 'Arm_R': (-14, 0, 0), 'Forearm_R': (28, 0, 0), 'Prop_R': (25, 0, 0)}}), (37, {})], True)
for name, period, lift in [('Build', 24, 55), ('Repair', 20, 35)]:
    add(name, period, [(1, {'r': {'Arm_R': (-20, 0, 0), 'Forearm_R': (10, 0, 0)}}),
                       (1 + period // 3, {'r': {'Arm_R': (-lift, 0, -6), 'Forearm_R': (-18, 0, 0), 'Prop_R': (55, 0, 0)}}),
                       (1 + 2 * period // 3, {'r': {'Arm_R': (-20, 0, 0), 'Forearm_R': (20, 0, 0), 'Prop_R': (10, 0, 0), 'Chest': (4, 0, 3)}}),
                       (period + 1, {'r': {'Arm_R': (-20, 0, 0), 'Forearm_R': (10, 0, 0)}})], True)
# Deposit: the old keys (the left arm lifts, Prop_L tips) plus the basket itself tipping over the shoulder.
add('Deposit', 30, [(1, {}), (9, {'r': {'Arm_L': (-42, 0, 0), 'Forearm_L': (12, 0, 0), 'Prop_L': (0, 0, -15), 'Chest': (6, 0, -7), 'Prop_Back': (10, 0, 0)}}),
                    (18, {'r': {'Arm_L': (-42, 0, 0), 'Forearm_L': (12, 0, 0), 'Prop_L': (70, 0, -15), 'Chest': (6, 0, -7), 'Prop_Back': (40, 0, 0)}}),
                    (25, {'r': {'Arm_L': (-42, 0, 0), 'Forearm_L': (12, 0, 0), 'Prop_L': (0, 0, -15), 'Prop_Back': (8, 0, 0)}}), (30, {})])
add('Hit', 8, [(1, {}), (4, {'r': {'Chest': (-13, 0, -9), 'Head': (-9, 0, 0), 'Hips': (-4, 0, 0)}}), (8, {})])
add('Death', 30, [(1, {}), (9, {'r': {'Chest': (-12, 0, 12), 'Leg_L': (20, 0, 0), 'Shin_L': (30, 0, 0)}}),
                  (20, {'r': {'Root': (-60, 0, 12), 'Chest': (-8, 0, 0)}, 't': {'Root': (0, .13, .12)}}),
                  (30, {'r': {'Root': (-87, 0, 12), 'Chest': (-5, 0, 0), 'Arm_R': (0, 0, 15), 'Arm_L': (0, 0, -15)}, 't': {'Root': (0, .10, .10)}})])
scene = bpy.context.scene
scene.render.fps = 20
floor = u.ground_actions(arm, meshes)
arm.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)
for track in arm.animation_data.nla_tracks:
    track.mute = True
arm['archetype'] = 'Worker'
arm['attachments'] = 'Basket/BasketBinding/BasketLoad/BasketStrap: Prop_Back; BasketHandle: Chest to Hand_L; Mattock: Prop_R'

# ---- export ------------------------------------------------------------------------------------------
F.normalize_weights()
count = u.triangles(meshes)
assert count <= 2000, count
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{UID}.blend'))
F.export_glb(OUT / f'{UID}.glb')
(OUT / 'clips.json').write_text(json.dumps({'fps': 20, 'clips': clips, 'events': {
    'Chop': {'contact_frame': 19}, 'Mine': {'contact_frame': 17}, 'Harvest': {'cut_frame': 22}, 'Build': {'contact_frame': 17},
    'Repair': {'contact_frame': 14}, 'Deposit': {'pour_frame': 18}, 'Death': {'settle_frame': 30}}, 'runtime_animation_playback': 'pending VAT integration'}, indent=2))
(OUT / 'floor-correction.json').write_text(json.dumps(floor, indent=2))
(OUT / 'palette.json').write_text(json.dumps(u.COLORS, indent=2))
(OUT / 'source-report.json').write_text(json.dumps({
    'id': UID, 'triangles': count, 'budget': 2000, 'objects': len(meshes), 'bones': list(arm.data.bones.keys()), 'fps': 20,
    'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
    'shade_range': shade_range, 'body_H': 1, 'body_front': 'Blender -Y, glTF +Z', 'attachments_separate': True,
    'clip_list_source': 'plans/ART-MODELS-PLAN.md Worker; plans/ART-PRODUCTION-PLAN.md S8',
    'by_object': {o.name: u.triangles([o]) for o in meshes}}, indent=2))
if os.environ.get('TI_PREVIEW'):
    F.preview(OUT, UID, [('chop', 'Chop', 9), ('deposit', 'Deposit', 18), ('mine', 'Mine', 17)])
print('FINISHED', OUT, 'TRIANGLES', count, 'SHADE', shade_range, flush=True)
