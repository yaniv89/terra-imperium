# scripts/blender/build_kingdoms_ranged.py
# Kingdoms ranged (longbowman), quality pass of 2026-10-14, to the standard of the Bronze and Classical
# archers on the shared parts of ti_figure.py; replaces k_ranged of build_units_kingdoms.py:
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_ranged.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). The look follows
# plans/art/concepts/oct13/units-kingdoms-set.png (design reference only):
#   - a Team hood with a dagged shoulder cape and a long tail down the back (Head and Chest: the side's
#     colour seen from above), the face open, a short beard
#   - a quilted wool jack to mid-thigh with long padded sleeves, a leather belt, wool hose and ankle boots
#   - the tall self bow (the longbow, as tall as the man) upright in the left fist: one even bend, horn
#     nocks, a straight string; the Classical archer's bow is short and recurved
#   - an arrow in the right fist, an arrow bag at the right hip with fletchings standing out of it,
#     a short sword at the left hip
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/kingdoms-ranged/; copy the GLB to src/assets/units/kingdoms-ranged.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'kingdoms-ranged'
arm = F.start({'Skin': 'C99472', 'Wool': '6E6A46', 'Hose': '4A3F33', 'Cloth': 'E4DAC2', 'Leather': '5A3824', 'Metal': ('A9ADB2', .35, .8),
               'Wood': '5E3A1E', 'Horn': 'E6D9B8', 'Hair': '3A2A1E'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
GRIP = Vector((.222, -.132, .606))
ARROW_HAND = Vector((-.219, -.137, .605))

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose='Hose')
F.arms(long='Wool', pad=.006, cuff='Leather')
F.fist('L', GRIP, (0, 0, 1))
F.fist('R', ARROW_HAND, (0, 1, 0), half=.020)
F.head()
F.beard()

# ---- the jack, belt, sword, arrow bag ---------------------------------------------------------------------
F.skirt('JackSkirt', 'Wool', low=.392, grow=.010, sides=12, ribs=.06, flare=.006)
F.torso('Jack', 'Wool', grow=.008, chest=.008, sides=12, ribs=.05)
F.band('Belt', 'Leather', .532, .556, grow=.020, bone='Spine', bulge=.002)
box('BeltBuckle', (0, -.091, .544), (.028, .012, .026), 'Metal', 'Spine')
F.hip_sword('Sword', 'L', length=.34)
tube('ArrowBag', [((-.128, -.020, .552), (.030, .024), 'Hips'), ((-.140, -.006, .470), (.040, .032), 'Hips'), ((-.138, .006, .395), (.030, .026), 'Hips')], 'Leather', 6)
for n in range(4):
    a = n * math.pi / 2 + .4
    base = Vector((-.128 + .014 * math.cos(a), -.020 + .012 * math.sin(a), .540))
    tip = base + Vector((-.006, -.014, .110 + .012 * (n % 2)))
    tube(f'arrow-shaft-{n}', [(tuple(base), .0035, 'Hips'), (tuple(tip), .0035, 'Hips')], 'Wood', 3)
    flat = (.013, .003) if n % 2 else (.003, .013)
    tube(f'arrow-fletching-{n}', [(tuple(tip - (tip - base).normalized() * .055), flat, 'Hips'), (tuple(tip), flat, 'Hips')], 'Cloth', 4)

# ---- the Team hood ----------------------------------------------------------------------------------------
F.hood('Hood', 'Team', cape=.224, low=.712)

# ---- the longbow (the left hand's attachment): as tall as the man, upright through the fist -----------------
BACK = Vector((-math.sin(math.radians(12)), math.cos(math.radians(12)), 0))
F.self_bow(GRIP, 1.02, brace=.052, back=BACK, thick=(.0175, .0080))

# ---- the arrow in the right hand: nock at the wrist, the point ahead -------------------------------------------
P = 'Prop_R'
ax, az = ARROW_HAND.x, ARROW_HAND.z
tube('nocked-arrow-shaft', [((ax, -.108, az), .0040, P), ((ax, -.540, az), .0040, P)], 'Wood', 4, attachment=True)
tube('nocked-arrow-head', [((ax, -.535, az), (.008, .004), P), ((ax, -.585, az), (.0012, .0012), P)], 'Metal', 4, attachment=True)
tube('nocked-arrow-fletching', [((ax, -.170, az), (.004, .015), P), ((ax, -.228, az), (.004, .011), P)], 'Cloth', 4, attachment=True)

F.finish_rest(UID, 'Longbowmen: a Team hood with a dagged shoulder cape and a long tail, beard, a quilted wool jack with padded sleeves, hose and ankle boots, '
              'a tall self bow as tall as the man with horn nocks and a visible string, an arrow in the right hand, an arrow bag at the hip, a short sword',
              notes={'role': 'ranged', 'bow_length_H': 1.02},
              clips=FC.clips_hook(UID, FC.Kit('bow', side='L', arrow=('nocked-arrow-shaft', 'nocked-arrow-head', 'nocked-arrow-fletching'), quiver='hip')))
