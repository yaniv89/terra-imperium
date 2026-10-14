# scripts/blender/build_modern_ranged.py
# Modern ranged (an anti-tank guided missile team of two), quality pass of 2026-10-14 on the shared
# parts of ti_figure.py; replaces m_ranged of build_units_modern.py:
#   blender -b --factory-startup -P scripts/blender/build_modern_ranged.py
# Same contract as that builder: three rigs under a root empty named after the unit: the tripod
# launcher (AtgmRig with its one Hull bone and its parts AtgmLeg0-2, AtgmHead, AtgmTube, AtgmBand,
# AtgmSight, AtgmEyepiece, built by build_units_modern.atgm_launcher, unchanged), the gunner
# (GunnerRig) and the loader (LoaderRig, with the SpareTube and SpareCap on his right hand); flat
# material colours, the Team and Skin tags; rest pose only (no clips). Only the two people are redone,
# dressed as the rifleman (build_modern_infantry.py, ti_figure.modern_soldier):
#   - light tan combat helmets with Team cover bands, Team plate carriers with pouches, dark olive
#     uniforms, knee pads, gloves and high boots
#   - the gunner kneeling on his right knee behind the launcher, leaning in, the right hand on the
#     sight and the left on the launch tube
#   - the loader standing at the gunner's right with a spare missile tube upright in his right fist
#     (upright: the far detail level keeps its outline), the left arm at his side
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Budget: two people and a light launcher, not a machine (modern-ranged.json has no footprint), so
# the rule is the two-person one: under 4,000 triangles.
# Outputs go to art-build/units/modern-ranged/; copy the GLB to src/assets/units/modern-ranged.glb.
import sys, math
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import build_units_modern as md  # noqa: E402

UID = 'modern-ranged'
F.start({'Skin': 'C99472', 'Hair': '2E241C', 'Uniform': '3C4134', 'Boot': '26231F', 'Sole': '161514', 'Pad': '2C2D29', 'Helmet': '8E8668',
         'Gear': '2A2A27', 'Pouch': '8A7650', 'Glove': '302D28',
         # the launcher's own materials, as build_units_modern.py coloured them
         'Cloth': md.OLIVE, 'Leather': md.BLACK, 'Metal': md.GUNMETAL}, rig=False)
parts = [md.atgm_launcher('Atgm', (0, -.22, .42))]

# ---- the gunner: kneeling on the right knee, leaning in, hands on the sight and the tube ------------------------
AT_G = Vector((.010, .120, -.210))
parts.append(F.figure('Gunner'))
F.modern_soldier(radio=False, pouches=2)
F.pose({'Leg_L': (-85, 0, 0), 'Shin_L': (85, 0, 0), 'Leg_R': (-8, 0, 0), 'Shin_R': (98, 0, 0), 'Spine': (16, 0, 0), 'Chest': (8, 0, 0)})
F.hold('R', Vector((-.050, -.060, .540)) - AT_G, pole=(-1, .3, -.8))
F.hold('L', Vector((.052, -.040, .505)) - AT_G, pole=(1, .3, -.8))
F.bake_rest()
F.place(AT_G)
F.fist('R', None, (0, 1, 0), half=.020, mat='Glove')
F.fist('L', None, (0, 1, 0), half=.020, mat='Glove')

# ---- the loader: standing, a spare missile tube upright in the right fist -----------------------------------------
parts.append(F.figure('Loader'))
F.modern_soldier()
F.hold('R', (-.168, -.120, .560), pole=(-1, .5, -.4))
F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
F.bake_rest()
F.place((.42, .32, 0), yaw=-25)
g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
F.fist('L', None, (0, 1, 0), half=.020, mat='Glove')
F.prefix = ''  # the spare tube keeps its old names
P = 'Prop_R'
F.tube('SpareTube', [((g.x, g.y - .036, .250), .040, P), ((g.x, g.y - .036, .930), .040, P)], 'Cloth', 8, attachment=True)
F.tube('SpareCap', [((g.x, g.y - .036, .926), .045, P), ((g.x, g.y - .036, .962), .045, P)], 'Leather', 8, attachment=True)
F.tube('SpareCapLow', [((g.x, g.y - .036, .218), .045, P), ((g.x, g.y - .036, .254), .045, P)], 'Leather', 8, attachment=True)
F.prefix = 'Loader'

F.normalize_weights()
tris = F.finish_unit(UID, parts, {
    'role': 'ranged',
    'look': 'ATGM team: the gunner kneeling behind a tripod guided-missile launcher, leaning in with his hands on the sight and the tube, the loader standing '
            'with a spare missile tube upright; light tan helmets with Team bands, Team plate carriers with pouches, dark olive uniforms, knee pads, gloves, high boots',
    'pose': 'rest pose only; the vertex rig walks the legs and swings the arms',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py: the two figures redone, the launcher (AtgmRig) unchanged. Budget: two people and a light launcher, '
             'not a machine (no footprint in modern-ranged.json): under 4,000.'},
    open_facing=dict(F.facing), centre=(.15, 0, .5), scale=1.9)
assert tris <= 4000, tris
