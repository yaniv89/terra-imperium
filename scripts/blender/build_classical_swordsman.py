# scripts/blender/build_classical_swordsman.py
# Classical infantry (swordsman), quality pass of 2026-10-14, to the standard of the Bronze spearman
# (build_bronze_infantry.py) on the shared parts of ti_figure.py:
#   blender -b --factory-startup -P scripts/blender/build_classical_swordsman.py
# (build_classical_infantry.py is an older pilot on another pipeline, ti_blender.py, and is left as it
# was; this file replaces b_infantry of build_units_classical.py.)
# Same contract as that builder: the canonical rig of ti_units.py under a root empty named after the
# unit, flat material colours, the Team, Skin and Emblem tags, rest pose only (no clips: the vertex rig
# marches the legs and swings the arms). The look follows plans/art/concepts/oct13/units-classical-set.png
# (design reference only):
#   - a shaped head with eyes and brows under a bronze helmet with a flared rim, cheek pieces, a neck
#     guard and a tall Team crest from the brow to the nape (the Team colour seen from above)
#   - a bronze muscled cuirass with shoulder guards over a white tunic with short sleeves, two rows of
#     dark leather pteruges, a Team sash knotted at the waist (weighted to the Spine so it stays Team)
#   - bronze greaves, sandals, a scabbard at the left hip
#   - a big domed oval shield with a bronze rim, its plain face the squad's Emblem
#   - a short iron sword held upright in the right fist (upright so the far detail level keeps it)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/classical-infantry/; copy the GLB to src/assets/units/classical-infantry.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402

UID = 'classical-infantry'
arm = F.start({'Skin': 'C99472', 'Cloth': 'F0E8D4', 'Leather': '5A3624', 'Metal': ('D2A24C', .36, .65), 'Iron': ('C9CCD0', .32, .75),
               'Wood': '5A4130', 'Hair': '2B201A'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=False)
F.greaves('Metal')
F.arms(sleeve='Cloth', shoulder='Metal')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head(ears=False)

# ---- tunic, pteruges, cuirass, sash ------------------------------------------------------------------
F.skirt('TunicSkirt', 'Cloth', low=.362)
F.strips('Pteruges', 'Leather', .505, .394, n=10, grow=.007)
F.strips('PterugesUpper', 'Leather', .548, .462, n=10, grow=.013, phase=.5)
cuirass = F.torso('Cuirass', 'Metal', grow=.008, chest=.011)
for j in range(10):  # the flange at the waist
    v = cuirass.data.vertices[j].co
    v.x, v.y = v.x * 1.07, v.y * 1.07
tube('TunicCollar', vertical([.784, .806, .822], 0, [(.062, .052), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 6, caps=(False, False))
F.band('Sash', 'Team', .556, .604, grow=.012, bone='Spine')
box('SashKnot', (-.030, -.085, .580), (.044, .022, .040), 'Team', 'Spine')
F.slab('SashEnd', [(-.052, -.090, .570), (-.022, -.092, .570), (-.012, -.110, .452), (-.050, -.108, .452)], 'Team', 'Spine')
F.slab('SashEnd2', [(-.034, -.094, .566), (-.008, -.093, .566), (.014, -.110, .478), (-.018, -.112, .478)], 'Team', 'Spine')
tube('Scabbard', [((.112, -.012, .540), (.016, .010), 'Hips'), ((.136, .012, .420), (.015, .009), 'Hips'), ((.152, .034, .320), (.008, .006), 'Hips')], 'Leather', 4)

# ---- helmet and crest -----------------------------------------------------------------------------------
F.helmet('Metal')
F.ridge('Crest', [(-.074, .972, 1.018), (-.046, .996, 1.092), (0, 1.026, 1.128), (.046, .998, 1.116), (.078, .952, 1.074),
                  (.100, .900, 1.006), (.106, .862, .910)], 'Team', 'Head', half=(.014, .026))

# ---- the sword (the right hand's attachment), upright ----------------------------------------------------
x, y, P = HAND_R.x, HAND_R.y, 'Prop_R'
tube('SwordPommel', [((x, y, .552), .006, P), ((x, y, .563), .016, P), ((x, y, .574), .008, P)], 'Metal', 5, attachment=True)
tube('SwordGrip', [((x, y, .570), .011, P), ((x, y, .642), .011, P)], 'Wood', 5, caps=(False, False), attachment=True)
box('SwordGuard', (x, y, .647), (.066, .020, .014), 'Metal', P, True)
tube('SwordBlade', [((x, y, .652), (.019, .006), P), ((x, y, .800), (.017, .006), P), ((x, y, .935), (.025, .005), P),
                    ((x, y, 1.040), (.002, .002), P)], 'Iron', 4, attachment=True)

# ---- the shield (the left hand's attachment) ----------------------------------------------------------------
F.oval_shield((.238, -.170, .585), .165, .262, n=14)

F.finish_rest(UID, 'Swordsmen: bronze muscled cuirass with shoulder guards over a white tunic, leather pteruges, a Team crest and waist sash, '
              'bronze helmet with cheek pieces and neck guard, greaves, a big oval shield (Emblem) with a bronze rim, a short iron sword held upright',
              notes={'role': 'infantry', 'sword_length_H': .388, 'shield_H': [.33, .524]})
