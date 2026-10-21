# scripts/blender/build_modern20_siege.py
# The 20th-century Modern siege unit (eight-ages plan U81: Artillery), a generic mid-century field howitzer
# with three gunners in olive wool (ti_modern20.py, LITE figures), on the wheeled rig of ti_mounts.wheeled
# (Hull, Wheel_*, Turret, Barrel) with the howitzer clips of ti_vehicle_clips.howitzer (Idle, Move, Fire: the
# loader swings a shell in, the rammer drives it home, the observer watches, all cover up for the shot; Hit,
# Death, Wreck):
#   blender -b --factory-startup -P scripts/blender/build_modern20_siege.py
#   - the gun: two big wheels with solid tyres, split trails spread to their spades, a tall flat shield, a
#     short barrel raised on its cradle with the recuperator over it, a Team band round the barrel, ready rounds
#   - the loader at the left with a shell in both hands, the observer at the right with binoculars, the
#     rammer at the trail with the staff upright
# Of no real army or model. Outputs go to art-build/units/modern-siege/; copy the GLB to src/assets/units/.
import json
import math
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

UID = 'modern-siege'
F.start(dict(M.COLORS, Cloth='585C40', Emblem='C8A040'), rig=False)


def field_howitzer(prefix='How'):
    """A field howitzer in the firing position facing -Y (the 155 mm of build_units_modern.howitzer cut down
    to a mid-century gun: a shorter barrel, no muzzle brake, a tall flat shield)."""
    parts, info = tm.wheeled(prefix, axles=(.06,), track=.56, wheel_r=.2, wheel_w=.09, frame_z=.3, frame_len=.5, turret_at=(0, .06, .34),
                             tyre='Leather', metal='Gun')
    rig = info['rig']
    zt = .48
    for sx in (-1, 1):  # the split trails
        a = math.radians(22) * sx
        ex, ey = math.sin(a) * .95, .1 + math.cos(a) * .95
        u.tube(f'{prefix}Trail{sx}', [(sx * .1, .12, .3), (ex * .55, ey * .55 + .05, .17), (ex, ey, .05)], [(.035, .045), (.032, .04), (.028, .032)], 'Cloth', ['Hull'] * 3, 6, rig)
        u.box(f'{prefix}Spade{sx}', (ex, ey + .03, .04), (.14, .03, .09), 'Gun', 'Hull', rig)
        u.box(f'{prefix}Shield{sx}', (sx * .2, -.12, .40), (.20, .022, .40), 'Cloth', 'Turret', rig)
    u.box(f'{prefix}Saddle', (0, .06, .42), (.22, .28, .14), 'Cloth', 'Turret', rig)
    el = math.radians(26)

    def at(d):
        return (0, .06 - d * math.cos(el), zt + d * math.sin(el))
    u.box(f'{prefix}Cradle', at(.08), (.13, .32, .09), 'Cloth', 'Barrel', rig)
    u.tube(f'{prefix}Barrel', [at(-.22), at(-.05), at(.35), at(.72)], [.055, .05, .040, .036], 'Cloth', ['Barrel'] * 4, 8, rig)
    u.tube(f'{prefix}Band', [at(.42), at(.50)], [.045, .045], 'Team', ['Barrel'] * 2, 8, rig)
    u.tube(f'{prefix}Recuperator', [(0, at(-.1)[1], at(-.1)[2] + .06), (0, at(.32)[1], at(.32)[2] + .06)], [.024, .024], 'Gun', ['Barrel'] * 2, 6, rig)
    for k in range(3):  # ready rounds by the left trail
        u.tube(f'{prefix}Shell{k}', [(.42 + k * .055, .55, .03), (.42 + k * .055, .55, .24)], [.026, .026], 'Emblem' if k == 0 else 'Metal', ['Hull'] * 2, 6, rig)
    return parts, info


parts, info = field_howitzer()
tm.enlarge(info['rig'], 1.62)  # two thirds of real size against a 1.8 m man (unitScale.test.js: a gun at least 4.7 m)


def gunner(name, lean=0):
    rig = F.figure(name)
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
    if lean:
        F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    return rig


# the loader at the left wheel: a shell held in both hands before the chest, nose up
r0 = gunner('Crew0', lean=6)
SH = Vector((0, -.215, .640))
F.hold('L', SH + Vector((.050, .004, -.040)), pole=(1, .2, -.8))
F.hold('R', SH + Vector((-.050, .004, .020)), pole=(-1, .2, -.8))
F.bake_rest()
F.fist('L', None, (0, 0, 1), half=.018)
F.fist('R', None, (0, 0, 1), half=.018)
F.tube('Shell', [((0, SH.y, SH.z - .12), .030, 'Prop_R'), ((0, SH.y, SH.z + .08), .028, 'Prop_R'), ((0, SH.y, SH.z + .14), .004, 'Prop_R')], 'Metal', 6, attachment=True)
F.place((-.82, .22, 0), 90)
parts.append(r0)

# the observer at the right wheel: binoculars up at his eyes
r1 = gunner('Crew1')
F.hold('L', (.030, -.120, .900), pole=(1, -.2, -.6))
F.hold('R', (-.030, -.120, .900), pole=(-1, -.2, -.6))
F.bake_rest()
F.fist('L', None, (1, 0, 0), half=.016)
F.fist('R', None, (1, 0, 0), half=.016)
F.box('Binoculars', (0, -.112, .912), (.080, .050, .036), 'Leather', 'Prop_R', True)
F.place((.78, .06, 0), -90)
parts.append(r1)

# the rammer at the trail, facing the gun, the staff upright in both fists
r2 = gunner('Crew2', lean=8)
GR = Vector((-.180, -.150, .600))
F.hold('R', GR, pole=(-1, .6, -.5))
F.hold('L', GR + Vector((.004, -.002, .190)), pole=(1, -.2, -.9))
F.bake_rest()
g = F.fist('R', None, (0, 0, 1), half=.020)
F.fist('L', None, (0, 0, 1), half=.020)
F.tube('Ram', [((g.x, g.y, .04), .010, 'Prop_R'), ((g.x, g.y, 1.20), .009, 'Prop_R')], 'Wood', 5, attachment=True)
F.tube('RamHead', [((g.x, g.y, 1.20), .030, 'Prop_R'), ((g.x, g.y, 1.26), .030, 'Prop_R')], 'Leather', 6, attachment=True)
F.place((-.15, 1.25, 0), 180)
parts.append(r2)

CLIPS = {}
tris = F.finish_unit(UID, parts, {
    'role': 'Artillery (20th century): a field howitzer with two big wheels, split trails, a tall flat shield and a short raised barrel with a Team band, '
            'ready rounds; three gunners in round steel helmets, olive wool tunics and Team webbing: a loader with a shell, an observer with binoculars, '
            'a rammer with the staff upright',
    'notes': 'Eight-ages plan U81: the gun cut down from build_units_modern.howitzer; the crew ti_figure.py LITE figures in ti_modern20.py dress.'},
    centre=(0, .3, .6), scale=2.6, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: CLIPS.setdefault('r', VC.howitzer(parts)), 'vehicle'))
out = u.out_dir(UID)
(out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                             'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}, indent=2) + '\n')
tm.mark_machine(UID)
VC.write_options(UID, *CLIPS['r'])
print('TRIS', tris)
assert tris <= 4000, tris  # a machine: 4,000 hard (unitScale.test.js checks it)
