# scripts/blender/build_classical_ranged.py
# Classical ranged (composite archer), quality pass of 2026-10-14, to the standard of the Bronze archer
# (build_bronze_ranged.py) on the shared parts of ti_figure.py; replaces b_ranged of build_units_classical.py:
#   blender -b --factory-startup -P scripts/blender/build_classical_ranged.py
# Same contract as that builder: the canonical rig under a root empty named after the unit, flat
# material colours, the Team and Skin tags, and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). The look follows
# plans/art/concepts/oct13/units-classical-set.png (design reference only):
#   - a pointed felt cap, its tip bent forward, with a neck flap and a Team band; a short dark beard
#   - a dark leather corselet with shoulder pieces over a pale tunic with short sleeves, a row of
#     leather strips over the skirt, a Team sash at the waist (weighted to the Spine)
#   - closed leather boots (the Bronze archer wears sandals and a kilt)
#   - a short recurved composite bow upright in the left fist: limbs that sweep back and tips that
#     bend forward again, a pale horn belly at the grip, a string you can see; an arrow in the right fist
#   - a slanted quiver on the back with fletched arrows, its strap across the chest
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/classical-ranged/; copy the GLB to src/assets/units/classical-ranged.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'classical-ranged'
arm = F.start({'Skin': 'C99472', 'Cloth': 'EDE4CE', 'Felt': 'C8AE7C', 'Leather': '5C3823', 'Hide': '8A5A36', 'Metal': ('D2A24C', .36, .65),
               'Wood': '7C3F22', 'Horn': 'E6D9B8', 'Hair': '2B201A'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
GRIP = Vector((.222, -.132, .606))
ARROW_HAND = Vector((-.219, -.137, .605))

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Hide')
F.arms(sleeve='Cloth', shoulder='Leather')
F.fist('L', GRIP, (0, 0, 1))
F.fist('R', ARROW_HAND, (0, 1, 0), half=.020)
F.head()
F.beard()

# ---- tunic, corselet, sash ---------------------------------------------------------------------------
F.skirt('TunicSkirt', 'Cloth', low=.350)
F.strips('CorseletStrips', 'Leather', .548, .440, n=10, grow=.010, gap=.22)
F.torso('LeatherCorselet', 'Leather', grow=.008, chest=.006)
tube('TunicCollar', vertical([.784, .806, .822], 0, [(.062, .052), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 6, caps=(False, False))
F.band('Sash', 'Team', .530, .580, grow=.013, bone='Spine')
box('SashKnot', (-.040, -.084, .556), (.042, .022, .040), 'Team', 'Spine')
F.slab('SashEnd', [(-.062, -.089, .548), (-.030, -.091, .548), (-.022, -.108, .440), (-.062, -.106, .440)], 'Team', 'Spine')

# ---- the pointed felt cap -------------------------------------------------------------------------------
tube('FeltCapFlap', vertical([.850, .884, .920, .950], [.026, .016, .008, .004], [(.056, .036), (.064, .052), (.066, .058), (.065, .059)], 'Head'),
     'Felt', 8, caps=(True, False))
tube('FeltCap', vertical([.944, .962, .992, 1.030, 1.070, 1.098], [-.003, -.003, -.003, -.004, -.018, -.056],
                         [(.0665, .0625), (.066, .062), (.058, .055), (.042, .040), (.026, .025), (.005, .005)], 'Head'),
     'Felt', 10, caps=(True, True))
F.headband('Team', z=.958, height=.028)

# ---- the composite bow (the left hand's attachment): recurved, upright through the fist ------------------
P = 'Prop_L'
LEN = .76
BACK = Vector((-math.sin(math.radians(12)), math.cos(math.radians(12)), 0))  # from the belly to the string
SWEEP = [(0, 0), (.20, .030), (.45, .066), (.68, .084), (.84, .078), (.94, .056), (1, .030)]  # (share of a limb, how far back)


def sweep(s):
    for (s0, d0), (s1, d1) in zip(SWEEP, SWEEP[1:]):
        if s <= s1:
            return d0 + (d1 - d0) * (s - s0) / (s1 - s0)
    return SWEEP[-1][1]


N = 10
bow = []
for i in range(N + 1):
    t = i / N
    s = abs(t - .5) * 2
    p = GRIP + Vector((0, 0, (t - .5) * LEN)) + BACK * sweep(s)
    bow.append((tuple(p), .0145 - .0075 * s, P))
tube('composite-bow', bow, 'Wood', 5, attachment=True)
tube('bow-grip', [((GRIP.x, GRIP.y, GRIP.z - .042), .0165, P), ((GRIP.x, GRIP.y, GRIP.z + .042), .0165, P)], 'Horn', 6, caps=(False, False), attachment=True)
top, bottom = Vector(bow[-1][0]), Vector(bow[0][0])
for name, tip, up in (('bow-tip-top', top, 1), ('bow-tip-bottom', bottom, -1)):
    tube(name, [(tuple(tip - Vector((0, 0, up * .050)) + BACK * (sweep(.87) - sweep(1))), .0090, P), (tuple(tip + Vector((0, 0, up * .012)) - BACK * .006), .0075, P)],
         'Horn', 4, attachment=True)
tube('bow-string', [(tuple(bottom), .0034, P), (tuple(top), .0034, P)], 'Horn', 3, attachment=True)

# ---- the arrow in the right hand: nock at the wrist, the point ahead ---------------------------------------
P = 'Prop_R'
ax, az = ARROW_HAND.x, ARROW_HAND.z
tube('nocked-arrow-shaft', [((ax, -.108, az), .0040, P), ((ax, -.505, az), .0040, P)], 'Hide', 4, attachment=True)
tube('nocked-arrow-head', [((ax, -.500, az), (.011, .004), P), ((ax, -.548, az), (.0012, .0012), P)], 'Metal', 4, attachment=True)
tube('nocked-arrow-fletching', [((ax, -.170, az), (.004, .015), P), ((ax, -.222, az), (.004, .011), P)], 'Horn', 4, attachment=True)

# ---- the quiver on the back -----------------------------------------------------------------------------------
F.back_quiver('Hide', 'Leather', arrows=3, strap='Hide')

F.finish_rest(UID, 'Composite archers: a pointed felt cap with a neck flap and a Team band, beard, dark leather corselet with shoulder pieces over a pale tunic, '
              'leather strips over the skirt, a Team waist sash, closed boots, a short recurved composite bow with horn tips and a visible string, an arrow in the right hand, back quiver',
              notes={'role': 'ranged', 'bow_length_H': LEN},
              clips=FC.clips_hook(UID, FC.Kit('bow', side='L', arrow=('nocked-arrow-shaft', 'nocked-arrow-head', 'nocked-arrow-fletching'), quiver='back')))
