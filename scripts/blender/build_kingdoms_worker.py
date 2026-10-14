# scripts/blender/build_kingdoms_worker.py
# Kingdoms worker (villager), quality pass of 2026-10-14, to the standard of the Bronze and Classical
# labourers on the shared parts of ti_figure.py; replaces k_worker of build_units_kingdoms.py:
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_worker.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old object names of the axe (AxeHaft, AxeHead),
# rest pose only (no clips). The look follows plans/art/concepts/oct13/units-kingdoms-set.png
# (design reference only):
#   - a round straw hat with a broad brim and a Team band, a short beard
#   - a Team tunic over the chest and the back (Spine and Chest) with a brown wool skirt to the knee,
#     linen shirt sleeves to the wrist, a leather belt with a pouch, wool hose and ankle boots
#   - a bundle of firewood on the back, the sticks standing above the head and tied with two ropes,
#     on two straps, the left fist on the strap
#   - a felling axe held upright like a staff, its iron head above the man's own head (upright so the
#     far detail level keeps it)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/kingdoms-worker/; copy the GLB to src/assets/units/kingdoms-worker.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402

UID = 'kingdoms-worker'
arm = F.start({'Skin': 'C99472', 'Cloth': 'E2D8BE', 'Wool': '6B5038', 'Hose': '4E4436', 'Leather': '553623', 'Straw': 'D2B46A',
               'Wood': '8E6A44', 'Bark': '5E4630', 'Rope': 'B89E6A', 'Metal': ('7C8086', .45, .75), 'Hair': '3A2A1E'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))
STRAP_L = [Vector((.070, .100, .792)), Vector((.086, .004, .812)), Vector((.088, -.070, .748)), HAND_L]

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose='Hose')
F.arms(long='Cloth', pad=.003, shoulder='Cloth')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (STRAP_L[3] - STRAP_L[2]).normalized(), half=.022)
F.head()
F.beard()
F.hair(crown=False)

# ---- tunic, skirt, belt, pouch -------------------------------------------------------------------------
F.skirt('TunicSkirt', 'Wool', low=.330, grow=.008, sides=10, flare=.008)
F.torso('Tunic', 'Team', grow=.006, chest=.006)
tube('TunicCollar', vertical([.784, .806, .822], 0, [(.062, .052), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 6, caps=(False, False))
F.band('Belt', 'Leather', .532, .556, grow=.012, bone='Spine', bulge=.002)
tube('BeltPouch', [((.112, -.050, .530), (.026, .016), 'Hips'), ((.118, -.054, .490), (.032, .020), 'Hips'), ((.114, -.050, .456), (.022, .014), 'Hips')], 'Leather', 6)

# ---- the straw hat with a Team band -------------------------------------------------------------------
F.straw_hat()

# ---- the firewood on the back (Prop_Back): sticks above the head, two rope ties, two straps ------------------
P = 'Prop_Back'
cx, cy = 0, .172
for k in range(7):
    a = 2 * math.pi * k / 7
    r = 0 if k == 0 else .044
    x, y = cx + r * math.cos(a) * 1.2, cy + r * math.sin(a) * .7
    lo, hi = .470 + .020 * (k % 3), 1.040 + .030 * ((k * 2) % 3)
    lean = .012 * math.cos(a)
    tube(f'Firewood{k}', [((x - lean, y, lo), .015, P), ((x + lean, y, hi), .013, P)], 'Bark' if k % 2 else 'Wood', 5, attachment=True)
for k, z in enumerate((.600, .900)):
    tube(f'FirewoodTie{k}', [((cx, cy, z - .012), (.078, .052), P), ((cx, cy, z + .012), (.078, .052), P)], 'Rope', 8, caps=(False, False), attachment=True)
tube('BundleStrap_L', [(tuple(p), .0085, w) for p, w in zip(STRAP_L, ['Chest', 'Chest', 'Chest', 'Hand_L'])] +
     [(tuple(HAND_L + (STRAP_L[3] - STRAP_L[2]).normalized() * .050), .0075, 'Hand_L')], 'Leather', 4, attachment=True)
tube('BundleStrap_R', [((-.070, .100, .792), .0085, 'Chest'), ((-.086, .004, .812), .0085, 'Chest'), ((-.088, -.074, .748), .0085, 'Chest'),
                       ((-.094, -.064, .650), .0085, 'Chest'), ((-.090, .080, .600), .0085, 'Spine')], 'Leather', 4, attachment=True)

# ---- the felling axe (Prop_R): upright like a staff, the head above the man's head ------------------------------
P = 'Prop_R'
x, y, top = HAND_R.x, HAND_R.y, 1.050
tube('AxeHaft', [((x, y, .030), .0125, P), ((x, y, top + .030), .0110, P)], 'Wood', 6, attachment=True)
# rings are (height, thickness) for a part along Y: the head runs from the eye at the back to a flared bit at the front
tube('AxeHead', [((x, y + .030, top), (.030, .020), P), ((x, y - .010, top), (.034, .017), P), ((x, y - .060, top - .004), (.056, .007), P),
                 ((x, y - .102, top - .006), (.088, .004), P), ((x, y - .110, top - .006), (.084, .002), P)], 'Metal', 4, attachment=True)

# ---- the left hand comes up to the strap on the chest: posed, then made the rest pose -------------------------
F.reach('L', (.108, -.112, .722))
F.bake_rest()

# ---- work tools and clips (2026-10-14, ti_worker_clips.py): the staff axe moves from Prop_R to its own bone
# Tool_Held (same shape, same rest pose); a steel axe (a short felling axe held at the end of its haft),
# pick, sickle and hammer on Tool_Axe, Tool_Pick, Tool_Sickle and Tool_Hammer, hidden (scale 0) but in the
# clips that use them. The GLB now carries clips; Idle frame 1 is the rest pose above.
W.finish_worker(UID, 'Villager: a round straw hat with a Team band, beard, a Team tunic over a brown wool skirt, linen sleeves, belt and pouch, hose and ankle boots, '
                'a bundle of firewood on the back with the left fist on its strap, a felling axe held upright like a staff; steel work tools in the clips',
                'steel', 'basket', notes={'role': 'worker'})
