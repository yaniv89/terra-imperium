# scripts/blender/build_modern20_support.py
# The 20th-century Modern support unit (eight-ages plan U81: AA Guns), a generic mid-century two-axle cargo
# truck with a single anti-aircraft autocannon on a pedestal in its bed and a gunner standing at it, on the
# wheeled rig of ti_mounts.wheeled (Hull, Wheel_*, Turret, Barrel) with the anti-air truck's clips
# (ti_vehicle_clips.aa_truck: Idle, Move, Fire a burst, Hit, Death, Wreck):
#   blender -b --factory-startup -P scripts/blender/build_modern20_support.py
#   - an olive truck: a long bonnet with a grille, an open cab with a folded canvas top, Team doors, an open
#     bed with drop sides, round mudguards
#   - the gun: a pedestal, a small shield, one long barrel raised with a flash hider, ammunition clips
#   - the gunner in olive wool and a steel helmet standing at the gun (ti_modern20.py, LITE)
# Of no real army or model. Outputs go to art-build/units/modern-support/; copy the GLB to src/assets/units/.
import json
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
import ti_modern20 as M  # noqa: E402

UID = 'modern-support'
F.start(dict(M.COLORS, Cloth='585C40', Glass='2A3036'), rig=False)


def aa_truck(prefix='AA'):
    parts, info = tm.wheeled(prefix, axles=(-.40, .40), track=.62, wheel_r=.15, wheel_w=.08, frame_z=.28, frame_len=1.30, turret_at=(0, .36, .46),
                             tyre='Leather', metal='Gun')
    rig = info['rig']
    W = .70
    y0, y1, z0, h = -.72, -.14, .28, .44
    tm.side_profile(f'{prefix}Bonnet', [(y0, z0), (y0 + .36, z0), (y0 + .36, z0 + h * .62), (y0 + .02, z0 + h * .56)], -W / 2 + .08, W / 2 - .08, 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Grille', (0, y0 - .004, z0 + h * .30), (W - .22, .012, h * .44), 'Gun', 'Hull', rig)
    tm.side_profile(f'{prefix}Cab', [(y0 + .36, z0), (y1, z0), (y1, z0 + h * .62), (y0 + .40, z0 + h * .62)], -W / 2, W / 2, 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Windscreen', (0, y0 + .40, z0 + h * .80), (W - .08, .012, h * .32), 'Glass', 'Hull', rig)
    u.box(f'{prefix}CanvasTop', (0, y1 - .06, z0 + h * .70), (W - .04, .10, .07), 'Canvas', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Door{sx}', (sx * (W / 2 + .004), (y0 + .36 + y1) / 2, z0 + h * .36), (.008, (y1 - y0 - .36) * .8, h * .40), 'Team', 'Hull', rig)
        u.box(f'{prefix}Headlight{sx}', (sx * (W / 2 - .12), y0 + .10, z0 + h * .66), (.06, .06, .06), 'Gun', 'Hull', rig)
        for y in (-.40, .40):  # round mudguards over each wheel
            u.tube(f'{prefix}Guard{sx}{int(y * 10)}', [(sx * .31, y - .19, .30), (sx * .31, y - .12, .38), (sx * .31, y + .12, .38), (sx * .31, y + .19, .30)],
                   [(.06, .012)] * 4, 'Cloth', ['Hull'] * 4, 4, rig)
        u.box(f'{prefix}BedSide{sx}', (sx * (W / 2 - .01), .34, .40), (.02, .86, .10), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Bed', (0, .34, .33), (W, .86, .05), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}BedTail', (0, .77, .40), (W, .02, .10), 'Team', 'Hull', rig)
    # the gun on its pedestal (Turret), the barrel raised (Barrel)
    u.tube(f'{prefix}Pedestal', [(0, .36, .36), (0, .36, .56)], [.07, .05], 'Gun', ['Turret'] * 2, 8, rig)
    u.box(f'{prefix}Mount', (0, .34, .62), (.16, .22, .12), 'Cloth', 'Turret', rig)
    u.box(f'{prefix}Shield', (0, .22, .70), (.30, .02, .20), 'Cloth', 'Turret', rig)
    el = math.radians(40)
    base = (0, .30, .66)

    def at(d):
        return (base[0], base[1] - d * math.cos(el), base[2] + d * math.sin(el))
    u.box(f'{prefix}Cradle', at(.06), (.07, .26, .08), 'Gun', 'Barrel', rig)
    u.tube(f'{prefix}Gun', [at(-.10), at(.20), at(.72)], [.028, .020, .016], 'Gun', ['Barrel'] * 3, 6, rig)
    u.tube(f'{prefix}Flash', [at(.72), at(.78)], [.024, .020], 'Gun', ['Barrel'] * 2, 6, rig)
    u.box(f'{prefix}Clip', (0, at(.0)[1], at(.0)[2] + .07), (.03, .10, .06), 'Metal', 'Barrel', rig)
    u.tube(f'{prefix}Band', [at(.30), at(.38)], [.030, .030], 'Team', ['Barrel'] * 2, 6, rig)
    return parts, info


parts, info = aa_truck()
tm.enlarge(info['rig'], (1.5, 1.5))  # wider than one H (unitPipeline.test.js)

# the gunner, standing on the bed behind the gun, hands up on the cradle's handles
rig = F.figure('Gunner')
F.LITE = True
F.legs(boots='Boot', hose='Uniform')
F.gaiters('Gaiter', top=.200, sides=5)
F.arms(long='Wool', pad=.004)
F.head(ears=False)
F.skirt('TunicSkirt', 'Wool', low=.440, grow=.012, sides=6, flare=.006)
F.torso('Tunic', 'Wool', grow=.008, chest=.006, sides=8)
F.band('Belt', 'Team', .520, .548, grow=.020, bone='Spine', sides=8)
F.cross_belts('Brace', 'Team', plate=None, low=.530, high=.800, width=.020, grow=.016, sides=12)
M.steel_helmet(strap=None)
F.pose({'Spine': (16, 0, 0), 'Chest': (8, 0, 0), 'Head': (-16, 0, 0)})
F.reach('L', (.080, -.380, .640), pole=(1, .2, -.8))
F.reach('R', (-.080, -.380, .640), pole=(-1, .2, -.8))
F.bake_rest()
F.fist('L', None, (0, 0, 1), half=.016)
F.fist('R', None, (0, 0, 1), half=.016)
F.place((0, .86, .54), 0)
parts.append(rig)

CLIPS = {}
tris = F.finish_unit(UID, parts, {
    'role': 'AA gun (20th century): a two-axle olive cargo truck with a long bonnet, an open cab with a canvas top and Team doors, an open bed with a single '
            'anti-aircraft autocannon on a pedestal behind a small shield, the barrel raised with a Team band; a gunner in a steel helmet and olive wool at the gun',
    'notes': 'Eight-ages plan U81; the clips of ti_vehicle_clips.aa_truck.'},
    centre=(0, .1, .6), scale=2.6, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: CLIPS.setdefault('r', VC.aa_truck(parts)), 'vehicle'))
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
VC.write_options(UID, *CLIPS['r'])
print('TRIS', tris)
assert tris <= 4000, tris
