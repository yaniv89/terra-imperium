# scripts/blender/build_classical_mercenary.py
# Classical mercenary (a hired band's look, drawn for mercenary squads of the infantry class), quality
# pass of 2026-10-14 on the shared parts of ti_figure.py; replaces build_mercenary of
# build_units_classical_irregular.py:
#   blender -b --factory-startup -P scripts/blender/build_classical_mercenary.py
# Same contract as that builder: the canonical rig (MercenaryRig) under a root empty named after the
# unit, flat material colours, the Team, Skin and Emblem tags, the old object names (Mail, Belt, Sash,
# CoinPouch, Crest, SwordBlade, ShieldFace, ShieldSpine, ShieldBoss), and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged).
# He must not be taken for the swordsman (build_classical_swordsman.py: gold bronze, white linen, a
# tall Team crest), so he is iron and dark wool:
#   - a grey iron mail shirt to the hips with doubled shoulder capes over a dark wool tunic
#   - a tall pointed iron helmet with cheek pieces and a black horsehair tail from its knob; a beard
#   - an ochre sash across the chest with a coin pouch at the hip (his pay), a leather belt, and under
#     it a Team waist sash with a hanging end (weighted to the Spine: the hirer's colour)
#   - iron greaves, sandals
#   - a long narrow oval shield with a rawhide rim, a wooden spine and an iron boss, its face the Emblem
#   - a curved single-edged sword held upright in the right fist
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/classical-mercenary/; copy the GLB to src/assets/units/classical-mercenary.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'classical-mercenary'
arm = F.start({'Skin': 'B9805C', 'Cloth': '4A4438', 'Leather': '4E3020', 'Rawhide': '8A6A44', 'Metal': ('9A9DA2', .5, .7), 'Wood': '6A4A30',
               'Ochre': 'D0A038', 'Plume': '241E1C', 'Hair': '2B201A'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=False)
F.greaves('Metal')
F.arms(shoulder='Metal')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head(ears=False)
F.beard()

# ---- dark tunic, mail shirt, belt, sashes, coin pouch -------------------------------------------------------
F.skirt('Tunic', 'Cloth', low=.352, top=.470, sides=8)
mail = F.skirt('MailSkirt', 'Metal', low=.432, grow=.009, sides=12)
for j in range(12):  # a dagged lower edge
    if j % 2:
        mail.data.vertices[j].co.z += .020
F.torso('Mail', 'Metal', grow=.008, chest=.008)
tube('TunicCollar', vertical([.784, .806, .822], 0, [(.062, .052), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 6, caps=(False, False))
F.band('TeamSash', 'Team', .512, .566, grow=.014, bone='Spine')
F.slab('TeamSashEnd', [(-.066, -.092, .540), (-.030, -.094, .540), (-.020, -.112, .408), (-.066, -.110, .408)], 'Team', 'Spine')
tube('Belt', vertical([.562, .586], 0, [tuple(r + .016 for r in F.radius_at(z, F.TORSO)) for z in (.562, .586)], 'Spine'), 'Leather', 10, caps=(False, False))

line = [((.092, .074, .790), 'Chest'), ((.096, .000, .810), 'Chest'), ((.070, -.088, .758), 'Chest'), ((.000, -.106, .690), 'Chest'),
        ((-.060, -.090, .628), 'Spine'), ((-.110, -.016, .600), 'Spine'), ((-.070, .082, .640), 'Spine')]
tube('Sash', [(p, (.022, .007), w) for p, w in line], 'Ochre', 4)
tube('CoinPouch', [((-.124, -.034, .520), (.024, .020), 'Hips'), ((-.130, -.036, .478), (.036, .030), 'Hips'), ((-.126, -.034, .440), (.024, .020), 'Hips')], 'Rawhide', 5)

# ---- the pointed helmet and its horsehair tail --------------------------------------------------------------
F.helmet('Metal', peak=1.070)

F.ridge('Crest', [(-.008, 1.056, 1.100), (.040, 1.036, 1.106), (.082, .980, 1.070), (.106, .900, .990), (.112, .840, .880)], 'Plume', 'Head', half=(.012, .020))

# ---- the curved sword (the right hand's attachment), upright, its edge to the front ---------------------------
x, y, P = HAND_R.x, HAND_R.y, 'Prop_R'
tube('SwordPommel', [((x, y + .006, .556), .006, P), ((x, y + .012, .566), .015, P), ((x, y + .004, .576), .008, P)], 'Metal', 5, attachment=True)
tube('SwordGrip', [((x, y, .570), .011, P), ((x, y, .642), .011, P)], 'Wood', 5, caps=(False, False), attachment=True)
box('SwordGuard', (x, y - .004, .647), (.020, .050, .014), 'Metal', P, True)
# rings are (thickness, width front to back): the blade swells and leans forward towards the point
tube('SwordBlade', [((x, y, .652), (.006, .015), P), ((x, y + .004, .780), (.006, .015), P), ((x, y - .006, .900), (.005, .023), P),
                    ((x, y - .014, .985), (.004, .020), P), ((x, y - .028, 1.040), (.002, .002), P)], 'Metal', 4, attachment=True)

# ---- the long shield (the left hand's attachment): rawhide rim, wooden spine, iron boss ------------------------
F.oval_shield((.238, -.170, .570), .142, .285, n=12, rim='Rawhide', boss='Metal', spine='Wood', dome=.030)

F.finish_rest(UID, 'Mercenary: a grey iron mail shirt with shoulder capes over a dark wool tunic, a tall pointed iron helmet with cheek pieces and a black horsehair tail, beard, '
              'an ochre sash with a coin pouch, a Team waist sash, iron greaves, a long narrow oval shield (Emblem) with a rawhide rim, wooden spine and iron boss, a curved sword held upright',
              rig_name='MercenaryRig', notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'},
              clips=FC.clips_hook(UID, FC.Kit('sword', shield=True)))
