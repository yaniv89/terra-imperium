# scripts/blender/build_classical_worker.py
# Classical worker (labourer), quality pass of 2026-10-14, to the standard of the Bronze labourer
# (build_bronze_worker.py) on the shared parts of ti_figure.py; replaces b_worker of build_units_classical.py:
#   blender -b --factory-startup -P scripts/blender/build_classical_worker.py
# Same contract as that builder: the canonical rig under a root empty named after the unit, flat
# material colours, the Team and Skin tags, the old object names for the tools (PickHaft, PickHead,
# Basket, BasketLoad), rest pose only (no clips). The look follows
# plans/art/concepts/oct13/units-classical-set.png (design reference only):
#   - a civilian in a long belted sleeveless tunic (the Bronze labourer is bare chested in a kilt),
#     dark hair and a short beard, a Team headband, a Team neckcloth and a Team waist sash with a
#     hanging end (head, chest and spine: the three places the game draws the Team colour)
#   - a tall wicker pannier of earth square on the back on two straps, the left fist on its strap
#   - a pick held upright like a staff: a stout handle and a long narrow iron head, a point to the
#     front and to the back, above the man's own head (upright so the far detail level keeps it)
#   - plain sandals; baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/classical-worker/; copy the GLB to src/assets/units/classical-worker.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402

UID = 'classical-worker'
arm = F.start({'Skin': 'C99472', 'Cloth': 'EEE5CF', 'Leather': '5E3A26', 'Wood': '8E6638', 'Wicker': 'B58C48', 'Earth': '6B4E34',
               'Metal': ('6F7278', .5, .7), 'Hair': '2B201A'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))
STRAP_L = [Vector((.070, .096, .792)), Vector((.086, .004, .812)), Vector((.088, -.070, .748)), HAND_L]

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=False)
F.arms(shoulder='Skin')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (STRAP_L[3] - STRAP_L[2]).normalized(), half=.022)
F.head()
F.beard()
F.hair()
F.headband('Team', z=.957, height=.028)

# ---- the long tunic, belt, sash, neckcloth -------------------------------------------------------------
F.skirt('Tunic', 'Cloth', low=.292)
F.torso('TunicTop', 'Cloth', grow=.004, chest=.006)
F.band('Sash', 'Team', .524, .578, grow=.011, bone='Spine')
box('SashKnot', (.040, -.082, .552), (.044, .022, .040), 'Team', 'Spine')
F.slab('SashEnd', [(.024, -.088, .544), (.060, -.086, .544), (.066, -.104, .410), (.022, -.106, .410)], 'Team', 'Spine')
tube('Neckcloth', vertical([.776, .800, .822], [-.004, -.002, 0], [(.074, .060), (.060, .050), (.045, .041)], ['Chest', 'Chest', 'Chest']), 'Team', 8, caps=(False, False))

# ---- the pannier on the back (Prop_Back): wicker wall, rim, bands, a heap of earth, two straps ---------------
P = 'Prop_Back'
cx, cy, z0, z1, n = 0, .158, .545, .830, 10
verts, faces = [], []
for radius, z in [(.056, z0), (.104, z1), (.090, z1), (.050, z0 + .020)]:
    for j in range(n):
        a = 2 * math.pi * j / n
        verts.append((cx + radius * math.cos(a), cy + radius * .80 * math.sin(a), z))
for ring in (0, 1, 2):
    for j in range(n):
        faces.append((ring * n + j, ring * n + (j + 1) % n, (ring + 1) * n + (j + 1) % n, (ring + 1) * n + j))
faces.append(tuple(range(3 * n, 4 * n)))
faces.append(tuple(reversed(range(0, n))))
raw('Basket', verts, faces, 'Wicker', P, True)
for k, (z, radius) in enumerate([(z0 + .090, .072), (z0 + .200, .091), (z1 - .008, .106)]):
    tube(f'BasketBand{k}', [((cx, cy, z - .010), (radius, radius * .80), P), ((cx, cy, z + .010), (radius + .003, (radius + .003) * .80), P)],
         'Leather', n, caps=(False, False), attachment=True)
tube('BasketLoad', [((cx, cy, z1 - .030), (.084, .066), P), ((cx - .008, cy + .004, z1 + .020), (.060, .048), P),
                    ((cx + .006, cy - .004, z1 + .048), (.022, .020), P)], 'Earth', 6, attachment=True)
tube('BasketStrap_L', [(tuple(p), .0085, w) for p, w in zip(STRAP_L, ['Chest', 'Chest', 'Chest', 'Hand_L'])] +
     [(tuple(HAND_L + (STRAP_L[3] - STRAP_L[2]).normalized() * .050), .0075, 'Hand_L')], 'Leather', 4, attachment=True)
tube('BasketStrap_R', [((-.070, .096, .792), .0085, 'Chest'), ((-.086, .004, .812), .0085, 'Chest'), ((-.088, -.074, .748), .0085, 'Chest'),
                       ((-.094, -.064, .650), .0085, 'Chest'), ((-.090, .070, .600), .0085, 'Spine')], 'Leather', 4, attachment=True)

# ---- the pick (Prop_R): upright, a long narrow iron head with a point to the front and to the back -----------
P = 'Prop_R'
x, y, top = HAND_R.x, HAND_R.y, 1.070
tube('PickHaft', [((x, y, .030), .0125, P), ((x, y, top + .034), .0115, P)], 'Wood', 6, attachment=True)
# rings are (thickness, height) here: the head runs front to back and droops to both points
tube('PickHead', [((x, y - .175, top - .036), (.005, .005), P), ((x, y - .105, top - .008), (.014, .016), P), ((x, y - .030, top), (.019, .021), P),
                  ((x, y + .030, top), (.019, .021), P), ((x, y + .105, top - .008), (.014, .016), P), ((x, y + .175, top - .036), (.005, .005), P)],
     'Metal', 4, attachment=True)

# ---- the left hand comes up to the strap on the chest: posed, then made the rest pose -------------------------
F.reach('L', (.108, -.112, .722))
F.bake_rest()

# ---- work tools and clips (2026-10-14, ti_worker_clips.py): the staff pick moves from Prop_R to its own bone
# Tool_Held (same shape, same rest pose); an iron axe, pick, sickle and hammer on Tool_Axe, Tool_Pick,
# Tool_Sickle and Tool_Hammer, hidden (scale 0) but in the clips that use them; the twelve clips of the
# Bronze labourer's set. The GLB now carries clips; Idle frame 1 is the rest pose above.
W.finish_worker(UID, 'Laborer: a long belted sleeveless tunic, dark hair and beard, a Team headband, neckcloth and waist sash, a tall wicker pannier of earth '
                'on the back with the left fist on its strap, a pick held upright like a staff; iron work tools in the clips',
                'iron', 'basket', notes={'role': 'worker'})
