# scripts/blender/build_stone_worker.py
# Stone Age worker (eight-ages plan U80, 2026-10-20): the Bronze worker (build_bronze_worker.py, kept below) in
# Stone dress: a hide kilt, long hair under a Team band instead of the linen headcloth, a stone-headed mattock and
# the stone tool style of ti_worker_clips.py (knapped axe and pick heads, a flint sickle, a wooden maul).
# Original notes of the Bronze worker follow.
#
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
#   - the right arm in the ready pose with the mattock upright like a staff (a stout handle, the
#     bronze head above his own); the left forearm up across the chest, the fist on the rope
#   - Deposit also tips the basket over the shoulder (Prop_Back); its old keys stay
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/bronze-worker/; copy the GLB to src/assets/units/bronze-worker.glb.
import bpy, sys, os, math, json
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402

UID = 'stone-worker'
OUT = u.out_dir(UID)
arm = F.start({'Wood': '7A5636', 'Stone': '8E8A82', 'Flint': ('5A5A5E', .55, 0.), 'Leather': '5E3A26', 'Cloth': 'A88A62', 'Skin': 'B98258', 'Hair': '2A1E16'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical

# ---- the mattock's line: upright like a staff, its butt on the ground, the bronze head above the man's own ----
# Upright and narrow on purpose: the far detail level keeps long thin parts (soldierLod.js lockShafts:
# longer than 0.25 with the middle side of its box under 0.06), so the handle and the head each
# qualify and survive; a slanted handle or a broad blade does not.
HAND_R = Vector((-.223, -.137, .604))
shaft = Vector((0, 0, 1))
HEAD = Vector((HAND_R.x, HAND_R.y, 1.062))
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
                          [(.134, .097), (.128, .092), (.116, .084), (.100, .072), (.090, .064)], 'Hips'), 'Cloth', 10, caps=(False, False))
raw('KiltFrontFold', [(-.060, -.094, .338), (-.012, -.102, .328), (-.016, -.076, .530), (-.050, -.070, .530),
                      (-.060, -.086, .338), (-.012, -.094, .328), (-.016, -.068, .530), (-.050, -.062, .530)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Cloth', 'Hips')
tube('KiltBelt', vertical([.522, .543, .566], 0, [(.101, .073), (.105, .077), (.093, .067)], 'Spine'), 'Team', 10, caps=(False, False))
raw('SashEnd', [(.030, -.080, .532), (.070, -.071, .532), (.078, -.094, .395), (.026, -.102, .395), (.030, -.074, .532), (.070, -.065, .532), (.078, -.086, .395), (.026, -.094, .395)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Team', 'Spine')

# ---- headcloth with a neck flap and a Team band, a short beard, the kilt's tufted hem ----------------------
F.headband('Team')
F.hair()
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

# ---- the mattock (Prop_R): a stout handle, bronze socket, a long narrow head (blade to the front, pick behind) ----
P = 'Prop_R'
back = Vector((0, 1, 0))
tube('MattockHandle', [((HAND_R.x, HAND_R.y, .030), .0125, P), (tuple(HEAD + shaft * .030), .0115, P)], 'Wood', 6, attachment=True)
# rings are (thickness, width) here: the head runs front to back
tube('MattockHead', [(tuple(HEAD + back * .160 - shaft * .016), (.005, .005), P), (tuple(HEAD + back * .035), (.019, .020), P),
                     (tuple(HEAD - back * .035), (.019, .023), P), (tuple(HEAD - back * .120 - shaft * .006), (.012, .024), P),
                     (tuple(HEAD - back * .185 - shaft * .020), (.004, .024), P)], 'Stone', 4, attachment=True)
tube('MattockSocket', [(tuple(HEAD - shaft * .032), .024, P), (tuple(HEAD + shaft * .032), .021, P)], 'Leather', 6, attachment=True)  # (a rawhide lashing)

# ---- the left hand comes up to the basket rope on the chest: posed, then made the rest pose ------------------
F.reach('L', (.108, -.112, .722))
F.bake_rest()

meshes = F.meshes
F.fix_normals()
shade_range = F.bake_shade()

# ---- work tools and clips (2026-10-14, ti_worker_clips.py): the mattock moves from Prop_R to its own
# bone Tool_Held (same shape, same rest pose); a bronze axe, pick, sickle and a wooden mallet on
# Tool_Axe, Tool_Pick, Tool_Sickle and Tool_Hammer, hidden (scale 0) but in the clips that use them.
# The twelve clips are authored anew (planted feet, two hands on the axe and the pick, contacts held two
# frames); the old keys of 2026-10-07 are gone.
tool_frames, tools = W.setup_tools('stone')
clips = W.author('basket', tool_frames, W.tool_frame(Vector((0, 0, 1))))
scene = bpy.context.scene
scene.render.fps = 20
floor = u.ground_actions(arm, meshes)
arm.animation_data.action = bpy.data.actions['Idle']
scene.frame_set(1)
for track in arm.animation_data.nla_tracks:
    track.mute = True
arm['archetype'] = 'Worker'
arm['attachments'] = ('Basket/BasketBinding/BasketLoad/BasketStrap: Prop_Back; BasketHandle: Chest to Hand_L; Mattock: Tool_Held; '
                      'WorkAxeHaft/WorkAxeHead: Tool_Axe; WorkPickHaft/WorkPickHead: Tool_Pick; WorkSickleGrip/WorkSickleBlade: Tool_Sickle; WorkHammerHandle/WorkHammerHead: Tool_Hammer')

# ---- export ------------------------------------------------------------------------------------------
F.normalize_weights()
count = u.triangles(meshes)
assert count <= 2000, count
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{UID}.blend'))
F.export_glb(OUT / f'{UID}.glb')
(OUT / 'clips.json').write_text(json.dumps({'fps': 20, 'clips': clips}, indent=2))
(OUT / f'{UID}.json').write_text(W.options(clips))
(OUT / 'floor-correction.json').write_text(json.dumps(floor, indent=2))
(OUT / 'palette.json').write_text(json.dumps(u.COLORS, indent=2))
(OUT / 'source-report.json').write_text(json.dumps({
    'id': UID, 'triangles': count, 'budget': 2000, 'objects': len(meshes), 'bones': list(arm.data.bones.keys()), 'fps': 20,
    'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
    'shade_range': shade_range, 'body_H': 1, 'body_front': 'Blender -Y, glTF +Z', 'attachments_separate': True,
    'clip_list_source': 'plans/ART-MODELS-PLAN.md Worker; plans/ART-PRODUCTION-PLAN.md S8',
    'by_object': {o.name: u.triangles([o]) for o in meshes}}, indent=2))
if os.environ.get('TI_PREVIEW'):
    F.preview(OUT, UID, [('chop', 'Chop', 17), ('deposit', 'Deposit', 16), ('mine', 'Mine', 15)])
if os.environ.get('TI_SHEETS'):  # contact sheets of every clip from the battle camera (TI_SHEETS=side: from the side too)
    W.render_sheets(u.REPO / 'plans' / 'art-pilot' / 'worker-clips', UID, clips, arm)
    if os.environ.get('TI_SHEETS') == 'side':
        W.render_sheets(u.REPO / 'plans' / 'art-pilot' / 'worker-clips', UID, clips, arm, view='side')
print('FINISHED', OUT, 'TRIANGLES', count, 'SHADE', shade_range, flush=True)
