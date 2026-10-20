# scripts/blender/build_information_units.py
# The Information age's new base units (eight-ages plan U82; the other eight classes are the present-day files
# renamed in U81): Rocket Artillery, SAM Battery and Strike Drones, of no real army or model:
#   information-siege    a three-axle truck with a rocket launcher pod of twelve tubes raised over its bed (Turret
#                        and Barrel bones), stabiliser legs down, a crewman at the control box behind the truck
#   information-support  a three-axle truck with four missile canisters raised on a turntable and a flat radar
#                        panel, a crewman at the controls behind the truck
#   information-air      a strike drone: a slim fuselage with a bulged sensor nose, long straight wings, a V tail, a
#                        pusher propeller, two small missiles; static (the battle flies it), as the jet
#   blender -b --factory-startup -P scripts/blender/build_information_units.py -- <siege|support|air>
# The trucks are built on ti_mounts.wheeled with the cab of build_units_modern.truck_cab and the anti-air truck's
# clips (ti_vehicle_clips.aa_truck: Idle, Move, Fire a ripple, Hit, Death, Wreck); the crewmen are ti_figure.py
# present-day soldiers (modern_soldier, LITE). Outputs go to art-build/units/<id>/; copy to src/assets/units/.
import json
import math
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
import build_units_modern as md  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402

os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')  # (build_units_modern points it at units/modern on import)
KIND = (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['siege'])[0]
assert KIND in ('siege', 'support', 'air'), KIND
UID = 'information-' + KIND
SAND = '8C8A72'
TAGS = {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}


def truck(prefix, turret_at):
    """A three-axle military truck facing -Y, its bed open behind the cab, stabiliser legs down at the back."""
    parts, info = tm.wheeled(prefix, axles=(-.52, .22, .5), track=.66, wheel_r=.15, wheel_w=.09, frame_z=.3, frame_len=1.45, turret_at=turret_at)
    rig = info['rig']
    W = .78
    md.truck_cab(prefix, rig, -.78, -.18, W, .3, .5)
    u.box(f'{prefix}Bed', (0, .33, .37), (W, .98, .06), 'Cloth', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Stabiliser{sx}', (sx * (W / 2 + .1), .72, .22), (.2, .05, .04), 'Metal', 'Hull', rig)
        u.box(f'{prefix}StabFoot{sx}', (sx * (W / 2 + .18), .72, .06), (.06, .08, .14), 'Metal', 'Hull', rig)
        u.box(f'{prefix}Mudguard{sx}', (sx * .33, .36, .33), (.12, .5, .02), 'Leather', 'Hull', rig)
        u.box(f'{prefix}BedStripe{sx}', (sx * (W / 2 + .003), .33, .38), (.006, .9, .04), 'Team', 'Hull', rig)
    return parts, info


def crewman(at, yaw, hands):
    """A present-day crewman (LITE): both fists reached to `hands` (his own space)."""
    rig = F.figure('Crew')
    F.LITE = True
    F.modern_soldier(radio=False, pouches=2)
    F.reach('L', hands[0], pole=(1, .3, -.6))
    F.reach('R', hands[1], pole=(-1, .3, -.6))
    F.bake_rest()
    F.fist('L', None, (0, 1, 0), half=.016, mat='Glove')
    F.fist('R', None, (0, 1, 0), half=.016, mat='Glove')
    F.place(at, yaw)
    return rig


def rocket_pod(prefix, rig):
    """A launcher pod of twelve tubes (three rows of four) on the turntable, raised 40 degrees."""
    u.tube(f'{prefix}Ring', [(0, .40, .40), (0, .40, .48)], [.20, .18], 'Cloth', ['Turret'] * 2, 10, rig)
    u.box(f'{prefix}Cradle', (0, .40, .54), (.30, .30, .12), 'Cloth', 'Turret', rig)
    el = math.radians(40)
    base = (0, .48, .62)

    def at(d, x=0, z=0):
        return (base[0] + x, base[1] - d * math.cos(el) - z * math.sin(el), base[2] + d * math.sin(el) + z * math.cos(el))
    # the pod: twelve tubes along the bore in three rows of four, a Team band round the bundle
    for r in range(3):
        for k in range(4):
            x, z = -.165 + .11 * k, -.10 + .10 * r
            u.tube(f'{prefix}Tube{r}{k}', [at(-.05, x, z), at(.62, x, z)], [.050, .050], 'Cloth', ['Barrel'] * 2, 6, rig)
            u.tube(f'{prefix}Mouth{r}{k}', [at(.62, x, z), at(.625, x, z)], [.036, .036], 'Leather', ['Barrel'] * 2, 6, rig)
    for sz in (-1, 1):
        u.tube(f'{prefix}Band{sz}', [at(.06, 0, sz * .16), at(.16, 0, sz * .16)], [(.24, .012), (.24, .012)], 'Team', ['Barrel'] * 2, 4, rig)


def sam_pod(prefix, rig):
    """Four missile canisters (two by two) raised 55 degrees on the turntable, a flat radar panel behind them."""
    u.tube(f'{prefix}Ring', [(0, .40, .40), (0, .40, .48)], [.20, .18], 'Cloth', ['Turret'] * 2, 10, rig)
    u.box(f'{prefix}Cradle', (0, .44, .56), (.34, .26, .14), 'Cloth', 'Turret', rig)
    u.box(f'{prefix}Radar', (0, .70, .92), (.30, .03, .24), 'Metal', 'Turret', rig)
    u.tube(f'{prefix}RadarPost', [(0, .68, .60), (0, .69, .80)], [.025, .02], 'Metal', ['Turret'] * 2, 5, rig)
    el = math.radians(55)
    for sx in (-1, 1):
        for sz in (0, 1):
            x0, y0, z0 = sx * .09, .52 + .02 * sz, .66 + .13 * sz
            a = (x0, y0 + .30 * math.cos(el), z0 - .30 * math.sin(el))
            b = (x0, y0 - .50 * math.cos(el), z0 + .50 * math.sin(el))
            u.tube(f'{prefix}Canister{sx}{sz}', [a, b], [.058, .058], 'Cloth', ['Barrel'] * 2, 8, rig)
            u.tube(f'{prefix}Cap{sx}{sz}', [b, (b[0], b[1] - .02 * math.cos(el), b[2] + .02 * math.sin(el))], [.062, .062], 'Team', ['Barrel'] * 2, 8, rig)


def finish_truck(parts, look):
    CLIPS = {}
    tris = F.finish_unit(UID, parts, {'role': look, 'notes': 'Eight-ages plan U82 (2026-10-20), build_information_units.py.'},
                         centre=(0, .1, .6), scale=2.8, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: CLIPS.setdefault('r', VC.aa_truck(parts)), 'vehicle'))
    out = u.out_dir(UID)
    (out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000, 'tags': TAGS}, indent=2) + '\n')
    tm.mark_machine(UID)
    VC.write_options(UID, *CLIPS['r'])
    print('TRIS', UID, tris)
    assert tris <= 4000, tris


def drone(prefix='Drone', length=1.0, span=1.9):
    L = length / 2
    zc = .14
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, zc), (0, -.2, zc), None)])
    u.tube(f'{prefix}Fuselage', [(0, -L, zc - .01), (0, -L + .06, zc + .01), (0, -L + .22, zc + .02), (0, L - .25, zc + .02), (0, L - .06, zc + .01), (0, L, zc)],
           [(.03, .03), (.06, .065), (.06, .06), (.05, .05), (.03, .03), (.015, .015)], 'Cloth', ['Hull'] * 6, 10, rig)
    u.tube(f'{prefix}Sensor', [(0, -L + .14, zc - .05), (0, -L + .14, zc - .09)], [.035, .035], 'Leather', ['Hull'] * 2, 8, rig)
    for sx in (-1, 1):
        u.tube(f'{prefix}Wing{sx}', [(sx * .03, -.02, zc + .04), (sx * span / 4, -.01, zc + .045), (sx * span / 2, 0, zc + .05)],
               [(.09, .010), (.075, .009), (.05, .007)], 'Cloth', ['Hull'] * 3, 4, rig)
        u.box(f'{prefix}WingTip{sx}', (sx * (span / 2 - .04), 0, zc + .05), (.08, .05, .012), 'Team', 'Hull', rig)
        u.tube(f'{prefix}Tail{sx}', [(sx * .01, L - .12, zc + .03), (sx * .20, L - .06, zc + .16)], [(.05, .006), (.03, .005)], 'Team', ['Hull'] * 2, 4, rig)
        u.tube(f'{prefix}Missile{sx}', [(sx * .30, -.10, zc + .01), (sx * .30, .18, zc + .01)], [.016, .016], 'Metal', ['Hull'] * 2, 6, rig)
        u.box(f'{prefix}Pylon{sx}', (sx * .30, .04, zc + .03), (.01, .10, .03), 'Cloth', 'Hull', rig)
    u.tube(f'{prefix}Hub', [(0, L, zc), (0, L + .03, zc)], [.016, .008], 'Leather', ['Hull'] * 2, 6, rig)
    for k in range(3):
        a = math.radians(90 + 120 * k)
        u.tube(f'{prefix}Blade{k}', [(0, L + .015, zc), (math.cos(a) * .12, L + .015, zc + math.sin(a) * .12)], [(.016, .004), (.008, .003)], 'Leather', ['Hull'] * 2, 4, rig)
    return [rig]


if KIND == 'siege':
    F.start({'Skin': 'C99472', 'Hair': '2E241C', 'Uniform': '3C4134', 'Boot': '26231F', 'Sole': '161514', 'Pad': '2C2D29', 'Helmet': '8E8668',
             'Gear': '2A2A27', 'Pouch': '8A7650', 'Glove': '302D28', 'Cloth': SAND, 'Leather': '25262A', 'Metal': md.GUNMETAL, 'Wood': '4A4038'}, rig=False)
    parts, info = truck('Mlrs', (0, .40, .48))
    rocket_pod('Mlrs', info['rig'])
    u.box('MlrsControlBox', (.25, .86, .40), (.16, .06, .14), 'Leather', 'Hull', info['rig'])  # at the tailgate
    tm.enlarge(info['rig'], (1.2, 1.55))
    parts.append(crewman((.30, 1.58, 0), 0, ((.07, -.20, .58), (-.07, -.20, .58))))  # behind the truck, facing it
    finish_truck(parts, 'Rocket artillery: a sand three-axle truck with a launcher pod of twelve tubes raised over its bed, Team bands on the pod and the bed, '
                        'stabiliser legs down; a crewman in a light tan helmet and Team plate carrier at the control box behind the truck')
elif KIND == 'support':
    F.start({'Skin': 'C99472', 'Hair': '2E241C', 'Uniform': '3C4134', 'Boot': '26231F', 'Sole': '161514', 'Pad': '2C2D29', 'Helmet': '8E8668',
             'Gear': '2A2A27', 'Pouch': '8A7650', 'Glove': '302D28', 'Cloth': SAND, 'Leather': '25262A', 'Metal': md.GUNMETAL, 'Wood': '4A4038'}, rig=False)
    parts, info = truck('Sam', (0, .40, .48))
    sam_pod('Sam', info['rig'])
    u.box('SamControlBox', (.25, .86, .40), (.16, .06, .14), 'Leather', 'Hull', info['rig'])  # at the tailgate
    tm.enlarge(info['rig'], (1.2, 1.55))
    parts.append(crewman((.30, 1.58, 0), 0, ((.07, -.20, .58), (-.07, -.20, .58))))  # behind the truck, facing it
    finish_truck(parts, 'SAM battery: a sand three-axle truck with four missile canisters raised on a turntable (Team caps) and a flat radar panel, Team '
                        'bands on the bed; a crewman in a light tan helmet and Team plate carrier at the controls behind the truck')
else:
    lib.reset()
    parts = drone()
    md.finish(UID, parts, {'Skin': 'C99472', 'Cloth': '9AA0A6', 'Leather': '2C3036', 'Metal': ('B8BCC0', .35, .7), 'Wood': '4A4038'},
              {'role': 'air', 'look': 'Strike drone: a slim grey fuselage with a sensor ball under the nose, long straight wings with Team tips, a Team V '
                                      'tail, a pusher propeller, a small missile under each wing'},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))
