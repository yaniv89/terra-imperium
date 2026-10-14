# scripts/blender/build_gunpowder_support.py
# Gunpowder support (sappers, about 1750), quality pass of 2026-10-14 on the shared parts of
# ti_figure.py; replaces g_support of build_units_gunpowder.py:
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_support.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the gabion (Gabion, GabionBand0-2),
# the shovel (ShovelHaft, ShovelBlade), the apron and the belt; rest pose only (no clips). He must not
# be taken for the line infantryman (build_gunpowder_infantry.py), so he wears the sapper's marks. The
# look follows plans/art/concepts/oct13/units-gunpowder-set.png (design reference only):
#   - a tall black fur cap with a brass plate, a full beard (the sappers' privilege)
#   - a Team coat with short skirts on the Spine lined in white, plain sleeves with white cuffs, one
#     white shoulder belt, a pale buff leather apron from the waist to the knee, buff breeches and
#     black gaiters
#   - a wicker gabion on his back (Prop_Back) standing above his head: an open basket of woven bands
#     and stakes poking above the rim, on two shoulder straps; the left fist on a strap
#   - a spade upright in the right fist, its blade by the ground (upright and thin, so the far detail
#     level keeps it)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/gunpowder-support/; copy the GLB to src/assets/units/gunpowder-support.glb.
import sys, math
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402

UID = 'gunpowder-support'
arm = F.start({'Skin': 'C99472', 'Hair': '2B201A', 'Fur': '24201D', 'Cloth': 'EEEAE0', 'Buff': 'D6CBAE', 'Apron': 'E2D6B8', 'Wool': '6E6A60',
               'Gaiter': '2A2724', 'Shoe': '1F1C1A', 'Leather': '553623', 'Wicker': '6E5234', 'WickerDark': '3E2E1E', 'Withy': 'B8955C',
               'Metal': ('7C8086', .45, .75), 'Brass': ('C9A04E', .4, .7), 'Wood': '8A6440'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Shoe', hose='Buff')
F.gaiters('Gaiter')
F.arms(long='Wool', pad=.004, cuff='Cloth')
F.head()
F.beard()
F.hair(crown=False)

# ---- coat, apron, belts ------------------------------------------------------------------------------
F.torso('Coat', 'Team', grow=.010, chest=.010, sides=10)
F.coat_skirts('CoatSkirt', 'Team', 'Cloth', low=.410, grow=.016, flare=.016, open_deg=62, cols=10)
F.neck_stock('Fur')
F.band('Belt', 'Leather', .532, .556, grow=.020, bone='Spine', bulge=.002)
F.cross_belts('ShoulderBelt', 'Cloth', plate=None, which='L')
F.slab('Apron', [(-.100, -.098, .548), (.100, -.098, .548), (.112, -.112, .330), (-.112, -.112, .330)], 'Apron', 'Hips', depth=.008)

# ---- the fur cap ----------------------------------------------------------------------------------------
F.fur_cap('Bearskin', 'Fur', 'Brass')

# ---- the gabion on the back (Prop_Back) -------------------------------------------------------------------------
P = 'Prop_Back'
GY, Z0, Z1, R = .214, .470, .990, (.124, .112)
g = tube('Gabion', vertical([Z0, Z0 + .13, Z0 + .26, Z0 + .39, Z1], GY, [R] * 5, P), 'Wicker', 12, caps=(True, False), attachment=True)
F.quilt(g, 5, 12, .10)
F.lathe('GabionInside', [(R[0] - .008, Z1 - .030), (0, Z1 - .030)], 'WickerDark', bone=P, sides=12, sy=R[1] / R[0], cy=GY, attachment=True)
F.facing['GabionInside'] = (0, 0, 1)
for k in range(5):  # light woven withies between darker courses
    z = Z0 + .040 + (Z1 - Z0 - .070) * k / 4
    tube(f'GabionBand{k}', vertical([z - .022, z + .022], GY, [(R[0] + .004, R[1] + .004)] * 2, P), 'Withy', 12, caps=(False, False), attachment=True)
for k in range(6):
    a = 2 * math.pi * (k + .5) / 6
    x, y = R[0] * .96 * math.sin(a), GY - R[1] * .96 * math.cos(a)
    tube(f'GabionStake{k}', [((x, y, Z1 - .060), .0075, P), ((x, y, Z1 + .060 + .012 * (k % 2)), .0055, P)], 'Wood', 4, attachment=True)
for s, side in ((1, 'L'), (-1, 'R')):
    tube(f'GabionStrap_{side}', [((s * .074, .160, .640), (.014, .005), 'Chest'), ((s * .082, .090, .812), (.014, .005), 'Chest'),
                                 ((s * .090, .000, .818), (.014, .005), 'Chest'), ((s * .096, -.082, .748), (.014, .005), 'Chest'),
                                 ((s * .100, -.090, .640), (.014, .005), 'Spine')], 'Leather', 4)

# ---- the left fist on its strap: posed, then made the rest pose ---------------------------------------------------
F.reach('L', (.104, -.128, .706))
F.bake_rest()
F.fist('R', None, (0, 0, 1))
F.fist('L', None, (0, 0, 1), half=.022)

# ---- the spade (the right hand's attachment), upright, its blade by the ground --------------------------------------
P = 'Prop_R'
gp = F.grip_point('R')
x, y = gp.x, gp.y
tube('ShovelHaft', [((x, y, .150), .0115, P), ((x, y, .880), .0105, P)], 'Wood', 5, attachment=True)
tube('ShovelGrip', [((x - .036, y, .890), .010, P), ((x + .036, y, .890), .010, P)], 'Wood', 5, attachment=True)
tube('ShovelSocket', [((x, y, .118), .016, P), ((x, y, .170), .013, P)], 'Metal', 5, caps=(False, False), attachment=True)
F.sheet('ShovelBlade', (x - .050, y + .006, .130), (x + .050, y + .006, .130), (x + .044, y - .004, .010), (x - .044, y - .004, .010), .012, 'Metal', P, True)

F.finish_rest(UID, 'Sappers: a tall black fur cap with a brass plate, a full beard, a Team coat with short white-lined skirts, a white shoulder belt, a buff leather apron, '
              'black gaiters, a wicker gabion on the back standing above the head with stakes over its rim, a spade upright with its blade by the ground',
              notes={'role': 'support'})
