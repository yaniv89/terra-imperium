# scripts/blender/build_modern20_vehicles.py
# The 20th-century Modern general and raider (eight-ages plan U81), both on an open four-wheeled field car (the
# wheeled rig of ti_mounts.wheeled: Hull, Wheel_*, and for the raider a Turret and Barrel for its gun) with the
# vehicle clips of ti_vehicle_clips (command_car, technical), the crews on ti_figure.py in ti_modern20.py dress:
#   modern-general  the car with its windscreen up, a radio set and a tall whip mast flying the emblem pennant; a
#                   driver in a steel helmet seated at the wheel, the general standing in the back in a peaked
#                   cap and a belted service tunic, a map case in his right hand
#   modern-raider   the car stripped for reconnaissance, the windscreen folded flat, a machine gun on a pintle
#                   behind the front seats with a small shield and an ammunition box, jerrycans; a gunner in a
#                   steel helmet standing in the back with both hands on the gun
#   blender -b --factory-startup -P scripts/blender/build_modern20_vehicles.py -- <modern-general|modern-raider>
# The car is an open tub (a floor, seats, low sides, a solid bonnet), built at its drawn size (about 2.7 m long
# against a 1.8 m man, two thirds of a real field car's 3.4 m with room for full-size people), so the seated
# driver's legs sit inside it under the dashboard. Of no real army or model.
# Outputs go to art-build/units/<id>/; copy the GLBs to src/assets/units/.
import json
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
import ti_modern20 as M  # noqa: E402

UID = (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['modern-general'])[0]
assert UID in ('modern-general', 'modern-raider'), UID
GENERAL = UID == 'modern-general'
F.start(dict(M.COLORS, Cloth='5B5E3E', Seat='3A3226', Tyre='1E1E1E', Emblem='E6D6AF'), rig=False)

L0, L1 = -.74, .70          # nose and tail (front is -Y)
W = .86                      # width over the body
FLOOR, SEAT, SIDE = .30, .44, .60
BONNET = (-.74, -.20)        # the bonnet's length; the dashboard and windscreen at its back
WHEEL_R = .17


def open_car(prefix='Car', gun=False):
    parts, info = tm.wheeled(prefix, axles=(-.46, .42), track=.74, wheel_r=WHEEL_R, wheel_w=.10, frame_z=.24, frame_len=1.3,
                             tyre='Tyre', metal='Gun', turret_at=(0, .26, .62) if gun else None)
    rig = info['rig']
    b0, b1 = BONNET
    # the bonnet: solid, flat-topped, a little lower than the sides; the grille at its nose
    tm.side_profile(f'{prefix}Bonnet', [(b0, .26), (b1, .26), (b1, .56), (b0 + .04, .55), (b0, .50)], -W / 2 + .10, W / 2 - .10, 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Grille', (0, b0 - .004, .40), (W - .34, .012, .18), 'Gun', 'Hull', rig)
    # the tub: a floor, a front bulkhead (the dashboard), two low sides, the tail; open above
    u.box(f'{prefix}Floor', (0, (b1 + L1) / 2, FLOOR - .03), (W, L1 - b1, .04), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Dash', (0, b1 + .02, .41), (W, .04, .30), 'Cloth', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Side{sx}', (sx * (W / 2 - .015), (b1 + L1) / 2, .41), (.03, L1 - b1, .30), 'Cloth', 'Hull', rig)
        u.box(f'{prefix}DoorMark{sx}', (sx * (W / 2 + .003), .02, .44), (.006, .16, .12), 'Team', 'Hull', rig)
        u.box(f'{prefix}Light{sx}', (sx * .24, b0 + .02, .52), (.08, .06, .07), 'Gun', 'Hull', rig)
        for y in (-.46, .42):  # flat wings over the wheels
            u.box(f'{prefix}Wing{sx}{int(y * 100)}', (sx * (W / 2 + .05), y, .42), (.10, .40, .02), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Tail', (0, L1 - .015, .41), (W, .03, .30), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}TailMark', (0, L1 + .003, .44), (.20, .006, .12), 'Team', 'Hull', rig)
    # the seats: a bench in front, the back bench
    u.box(f'{prefix}SeatFront', (0, .00, SEAT - .05), (W - .10, .22, .10), 'Seat', 'Hull', rig)
    u.box(f'{prefix}SeatFrontBack', (0, .12, SEAT + .07), (W - .10, .04, .20), 'Seat', 'Hull', rig)
    u.tube(f'{prefix}Wheel', [(.20, b1 + .10, .58), (.20, b1 + .12, .60)], [.09, .09], 'Gun', ['Hull'] * 2, 10, rig)
    u.tube(f'{prefix}Column', [(.20, b1 + .02, .46), (.20, b1 + .11, .59)], [.012, .012], 'Gun', ['Hull'] * 2, 5, rig)
    u.tube(f'{prefix}Spare', [(0, L1, .44), (0, L1 + .07, .44)], [.15, .15], 'Tyre', ['Hull'] * 2, 10, rig)
    if gun:  # the windscreen folded flat on the bonnet
        u.box(f'{prefix}Windscreen', (0, b1 - .14, .57), (W - .12, .24, .02), 'Gun', 'Hull', rig)
    else:  # the windscreen up in its frame
        u.box(f'{prefix}Windscreen', (0, b1 + .01, .72), (W - .10, .02, .24), 'Gun', 'Hull', rig)
        u.box(f'{prefix}Glass', (0, b1 + .005, .72), (W - .18, .01, .18), 'Glass', 'Hull', rig)
    return parts, info


if GENERAL:
    parts, info = open_car()
    rig = info['rig']
    u.box('CarRadio', (-.22, .52, SEAT + .02), (.22, .18, .18), 'Gun', 'Hull', rig)
    u.tube('CarMast', [(-.30, .58, SEAT + .10), (-.30, .60, 1.85)], [.012, .005], 'Gun', ['Hull'] * 2, 4, rig)
    v = [(-.30, .60, 1.80), (-.30, .60, 1.62), (-.30, .90, 1.72)]
    p = u.mesh_obj('CarPennant', v, [(0, 1, 2), (0, 2, 1)], 'Emblem', 'Hull', arm=rig)
    uv = p.data.uv_layers.active
    for poly in p.data.polygons:
        for li in poly.loop_indices:
            co = p.data.vertices[p.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.y - .6) / .3, (co.z - 1.62) / .18)
    for k in range(2):
        u.box(f'CarJerrycan{k}', (.22, .46 + .1 * k, FLOOR + .08), (.08, .08, .16), 'Cloth', 'Hull', rig)
else:
    parts, info = open_car(gun=True)
    rig = info['rig']
    u.tube('Pintle', [(0, .26, FLOOR), (0, .26, .80)], [.028, .022], 'Gun', ['Turret'] * 2, 6, rig)
    u.box('GunShield', (0, .10, .86), (.22, .02, .14), 'Gun', 'Turret', rig)
    u.tube('MGBarrel', [(0, .34, .84), (0, .10, .86), (0, -.30, .87)], [.032, .020, .015], 'Gun', ['Barrel'] * 3, 6, rig)
    u.box('AmmoCan', (.08, .30, .80), (.05, .09, .06), 'Cloth', 'Barrel', rig)
    for sx in (-1, 1):
        u.box(f'GunGrip{sx}', (sx * .04, .40, .84), (.016, .03, .05), 'Gun', 'Barrel', rig)
    for k in range(2):
        u.box(f'CarJerrycan{k}', (-.26 + .1 * k, .58, FLOOR + .08), (.08, .10, .16), 'Cloth', 'Hull', rig)


def soldier(name, lite=True):
    rig = F.figure(name)
    F.LITE = lite
    F.legs(boots='Boot', hose='Uniform')
    F.gaiters('Gaiter', top=.200, sides=5)
    F.arms(long='Wool', pad=.004)
    F.head(ears=False)
    F.skirt('TunicSkirt', 'Wool', low=.440, grow=.012, sides=6, flare=.006)
    F.torso('Tunic', 'Wool', grow=.008, chest=.006, sides=8)
    F.band('Belt', 'Team', .520, .548, grow=.020, bone='Spine', sides=8)
    return rig


if GENERAL:
    # the driver: seated on the front bench, his thighs level, his shins down to the floor under the dashboard,
    # both hands on the wheel; posed in his own space, then set down so his seat is on the bench
    d = soldier('Driver')
    F.cross_belts('Brace', 'Team', plate=None, low=.530, high=.800, width=.020, grow=.016, sides=12)
    M.steel_helmet(strap=None)
    F.pose({'Leg_L': (-88, 0, 0), 'Shin_L': (84, 0, 0), 'Leg_R': (-88, 0, 0), 'Shin_R': (84, 0, 0), 'Spine': (-4, 0, 0)})
    HIP = .470  # the hip joints' height standing; seated, the seat of the trousers about .05 under them
    DZ = SEAT - (HIP - .05)
    wheel = Vector((-.20 + .20, BONNET[1] + .11 - .02, .59 - DZ))  # the wheel in his space (he sits at x .20)
    F.reach('L', wheel + Vector((.07, .02, 0)), pole=(1, .3, -.6))
    F.reach('R', wheel + Vector((-.07, .02, 0)), pole=(-1, .3, -.6))
    F.bake_rest()
    F.fist('L', None, (1, 0, 0), half=.016)
    F.fist('R', None, (1, 0, 0), half=.016)
    F.place((.20, .02, DZ), 0)
    parts.append(d)
    # the general: standing in the back, a peaked cap, a belted service tunic, a map case in the right hand
    g = soldier('Commander', lite=False)
    F.box('ServiceBelt', (0, -.118, .534), (.050, .010, .030), 'Metal', 'Spine')
    F.lathe('Cap', [(0, 1.034), (.060, 1.030), (.088, 1.012), (.090, .990), (.076, .962), (0, .962)], 'Wool', sides=12, sy=1.04)
    F.tube('CapBand', F.vertical([.960, .984], -.002, [(.0790, .0800), (.0770, .0780)], 'Head'), 'Team', 12, caps=(False, False))
    F.box('CapPeak', (0, -.086, .962), (.096, .046, .008), 'Leather', 'Head')
    F.reach('R', (-.190, -.040, .560), pole=(-.3, 1, .1))
    F.reach('L', (.190, -.030, .520), pole=(.3, 1, .1))
    F.bake_rest()
    w = F.fist('R', None, (0, 1, 0), half=.020)
    F.fist('L', None, (0, 1, 0), half=.020)
    F.box('MapCase', (w.x, w.y, w.z - .07), (.03, .16, .12), 'Leather', 'Prop_R', True)
    F.place((-.18, .40, FLOOR), 0)
    parts.append(g)
else:
    # the gunner: standing on the floor in the back, both hands on the gun's grips
    gn = soldier('Gunner')
    F.cross_belts('Brace', 'Team', plate=None, low=.530, high=.800, width=.020, grow=.016, sides=12)
    M.steel_helmet(strap=None)
    F.pose({'Spine': (10, 0, 0), 'Chest': (6, 0, 0), 'Head': (-10, 0, 0)})
    GY = .58  # where he stands
    F.reach('L', (.040, .40 - GY - .02, .84 - FLOOR), pole=(1, .2, -.8))
    F.reach('R', (-.040, .40 - GY - .02, .84 - FLOOR), pole=(-1, .2, -.8))
    F.bake_rest()
    F.fist('L', None, (0, 0, 1), half=.016)
    F.fist('R', None, (0, 0, 1), half=.016)
    F.place((0, GY, FLOOR), 0)
    parts.append(gn)

CLIPS = {}
author = VC.command_car if GENERAL else VC.technical
look = ('General (20th century): an open olive field car with Team door marks, the windscreen up, a radio set and a tall whip mast flying the emblem '
        'pennant; a driver in a steel helmet seated at the wheel, the general standing in the back in a peaked cap and a belted tunic with a map case') if GENERAL else \
       ('Raider (20th century): the open olive field car stripped for reconnaissance, the windscreen folded flat, a machine gun on a pintle with a small '
        'shield and an ammunition box, jerrycans, Team door marks; a gunner in a steel helmet standing in the back with both hands on the gun')
tris = F.finish_unit(UID, parts, {'role': look, 'notes': 'Eight-ages plan U81 (2026-10-20): crews on ti_figure.py, the car an open tub at its drawn size.'},
                     centre=(0, 0, .6), scale=2.6, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: CLIPS.setdefault('r', author(parts)), 'vehicle'))
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
VC.write_options(UID, *CLIPS['r'])
print('TRIS', UID, tris)
assert tris <= 4000, tris
