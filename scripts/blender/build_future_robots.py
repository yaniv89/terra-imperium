# scripts/blender/build_future_robots.py
# The Future robot variants (eight-ages plan U84, KTD17: the Future roster switched to machines by Autonomous
# Warfare), src/assets/units/future-robot-<class>.glb, on ti_future.py's colours. Robots have no skin (their
# JSON carries no skin tag, so the battle never tints them by people) and a glowing optic instead of a face:
#   future-robot-infantry  Combat Android: a slim graphite humanoid with a ribbed torso, a Team chest plate, a
#                          sensor head with one glowing optic band, a rifle upright in both hands (foot clips)
#   future-robot-ranged    Hunter-Killer: a heavier android with a shoulder cannon and a long rifle (foot clips)
#   future-robot-cavalry   Mech Walker: a four-legged walker on the horse rig (ti_units.quadruped bones: its
#                          gait, the mounted clips of ti_mounted_clips), an armoured body with a sensor head and
#                          a twin cannon, piloted by an android seated in its open cockpit
#   future-robot-siege     Siege Automaton: the walker heavier, a mortar tube raised on its back
#   future-robot-support   Repair Swarm: a hover sled with a crane arm and four small repair drones (hover clips)
#   future-robot-air       Sentinel Drones: three drones with ducted rotors and a sensor ball each (static)
#   blender -b --factory-startup -P scripts/blender/build_future_robots.py -- <class>
# Outputs go to art-build/units/future-robot-<class>/; copy to src/assets/units/.
import json
import math
import os
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_future as T  # noqa: E402

KIND = (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['infantry'])[0]
UID = 'future-robot-' + KIND
COLORS = dict(T.COLORS, Skin='5A6068', Under='2A2E34', Boot='3A3E44', Glove='3A3E44')
HV = T.HOVER


def drop_skin_tag():
    p = u.out_dir(UID) / f'{UID}.json'
    o = json.loads(p.read_text())
    if 'tags' in o:
        o['tags'].pop('skin', None)
    o['robot'] = True
    p.write_text(json.dumps(o, indent=2) + '\n')


def android(heavy=False):
    """A graphite humanoid on the current rig: segmented limbs, a ribbed torso under a Team chest plate, a
    sensor head with a glowing optic band and an antenna stub; no skin, no face."""
    g = .012 if heavy else 0
    F.legs(boots='Boot', hose='Under')
    F.combat_boots('Boot', top=.150)
    F.arms(long='Under', pad=.006 + g)
    F.head(ears=False)
    F.torso('Frame', 'Under', grow=.004, chest=.002)
    for k in range(3):  # the ribs
        F.band(f'Rib{k}', 'Armor', .560 + .040 * k, .576 + .040 * k, grow=.012 + g, bone='Spine' if k < 2 else 'Chest', sides=8)
    F.torso('ChestPlate', 'Team', grow=.016 + g, chest=.018 + g, sides=8)
    F.band('Core', 'Glow', .700, .712, grow=.024 + g, bone='Chest', sides=8)
    F.band('Pelvis', 'Armor', .470, .520, grow=.016 + g, bone='Hips', sides=8)
    for side, s in (('L', 1), ('R', -1)):
        F.box('Knee_' + side, (s * .074, -.046, .250), (.050, .020, .050), 'Plate', 'Shin_' + side)
        F.box('ShinGuard_' + side, (s * .074, -.040, .150), (.050, .016, .100), 'Armor', 'Shin_' + side)
        F.box('Shoulder_' + side, (s * .150, -.004, .770), (.070 + g, .090 + g, .045), 'Plate', 'Arm_' + side)
    F.lathe('Head', [(0, 1.000), (.050, .995), (.072, .960), (.076, .910), (.066, .870), (.040, .856), (0, .856)], 'Armor', sides=10)
    F.box('Optic', (0, -.074, .930), (.120, .012, .020), 'Glow', 'Head')
    F.tube('Antenna', [((.050, .020, .990), .006, 'Head'), ((.060, .030, 1.050), .004, 'Head')], 'Plate', 4)


def finish_foot(look, role):
    F.finish_rest(UID, look, notes={'role': role, 'robot': True}, clips=FC.clips_hook(UID, FC.Kit('gun', two_hands=True)))
    drop_skin_tag()


def walker(prefix='Mech', heavy=False):
    """A four-legged walker on the horse rig: the quadruped's own meshes removed, armour on the same bones."""
    arm, meshes = u.quadruped(prefix, 'horse', (0, 0, 0), coat='Armor', dark='Under')
    for m in meshes:
        bpy.data.objects.remove(m, do_unlink=True)
    F.use(arm)
    B = arm.data.bones
    S, N, H = 'Mount_Spine', 'Mount_Neck', 'Mount_Head'
    sp = B[S].head_local
    zt = sp.z
    w = .28 if heavy else .25
    F.tube('Body', [((0, .44, zt + .02), (w * .75, .14), S), ((0, .24, zt + .08), (w, .20), S), ((0, -.24, zt + .08), (w, .20), S), ((0, -.46, zt + .04), (w * .8, .15), S)],
           'Armor', 8)
    for sx in (-1, 1):
        F.box(f'SidePlate{sx}', (sx * (w + .006), 0, zt + .08), (.014, .56, .20), 'Team', S)
        F.box(f'SideSeam{sx}', (sx * (w + .010), 0, zt - .07), (.006, .64, .014), 'Glow', S)
    # the open cockpit round the pilot's seat: a cowl in front, low walls at the sides and the back
    ry = B['Rider'].head_local.y
    rz = B['Rider'].head_local.z
    F.box('Cowl', (0, ry - .20, rz - .02), (w * 1.4, .06, .20), 'Plate', S)
    F.box('CowlGlass', (0, ry - .232, rz + .05), (w * 1.1, .006, .06), 'Glow', S)
    for sx in (-1, 1):
        F.box(f'CockpitWall{sx}', (sx * w * .72, ry + .02, rz - .04), (.03, .40, .14), 'Plate', S)
    F.box('CockpitBack', (0, ry + .22, rz - .02), (w * 1.4, .04, .18), 'Plate', S)
    hx, hy, hz = B[H].head_local
    F.box('SensorHead', (0, hy - .04, hz), (.16, .18, .10), 'Plate', H)
    F.box('SensorOptic', (0, hy - .135, hz + .01), (.13, .012, .025), 'Glow', H)
    nx, ny, nz = B[N].head_local
    F.tube('NeckFrame', [((0, ny, nz), .05, N), ((0, hy, hz), .045, N)], 'Under', 6)
    F.tube('TailSensor', [((0, .40, zt + .05), .03, 'Mount_Tail'), ((0, .52, zt + .12), .02, 'Mount_Tail')], 'Plate', 5)
    for end in ('Front', 'Hind'):
        for side in ('L', 'R'):
            up, lo = f'Mount_Leg{end}_{side}', f'Mount_Shin{end}_{side}'
            a, k, f = B[up].head_local, B[lo].head_local, B[lo].tail_local
            F.tube(f'Thigh{end}{side}', [(tuple(a), (.06, .07), up), (tuple(k), (.045, .05), up)], 'Plate', 6)
            F.tube(f'Knee{end}{side}', [((k.x - .04, k.y, k.z), .040, lo), ((k.x + .04, k.y, k.z), .040, lo)], 'Glow' if heavy else 'Armor', 8)
            F.tube(f'Shin{end}{side}', [(tuple(k), (.04, .045), lo), ((f.x, f.y, .08), (.035, .04), lo)], 'Under', 6)
            F.box(f'Foot{end}{side}', (f.x, f.y - .02, .025), (.10, .14, .05), 'Armor', lo)
    return arm


def pilot(heavy=False):
    rider = F.figure('Rider')
    F.LITE = True
    android(heavy=heavy)
    F.astride(right=(-.200, -.160, .640), left=(.200, -.160, .640))
    F.fist('R', None, (0, 1, 0), half=.016)
    gl = F.fist('L', None, (0, 1, 0), half=.016)
    return rider, gl


if KIND in ('infantry', 'ranged'):
    arm = F.start(COLORS, ready=True)
    android(heavy=KIND == 'ranged')
    GRIP = (-.074, -.184, .596)
    F.hold('R', GRIP, pole=(-1, .6, -.5))
    F.hold('L', (GRIP[0] + .004, GRIP[1] - .002, GRIP[2] + .190), pole=(1, -.2, -.9))
    F.bake_rest()
    g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
    F.fist('L', None, (0, 0, 1), half=.022, mat='Glove')
    if KIND == 'infantry':
        F.assault_rifle(g, body='Gun', optic='Glow', below=.200, above=.440)
        finish_foot('Combat Android: a slim graphite humanoid robot with segmented limbs, a ribbed torso under a Team chest plate, a glowing core band, a '
                    'sensor head with one glowing optic band and an antenna, a rifle with a glowing sight held upright in both hands', 'infantry (robot)')
    else:
        F.assault_rifle(g, body='Gun', optic='Glow', below=.260, above=.600)
        F.box('ShoulderMount', (.160, .040, .820), (.060, .080, .050), 'Armor', 'Chest')
        F.tube('ShoulderCannon', [((.170, .120, .860), (.040, .040), 'Chest'), ((.170, -.200, .860), (.030, .030), 'Chest')], 'Gun', 6)
        F.box('CannonGlow', (.170, -.205, .860), (.030, .006, .030), 'Glow', 'Chest')
        finish_foot('Hunter-Killer: a heavier graphite android with a ribbed torso under a Team chest plate, a sensor head with a glowing optic band, a '
                    'cannon on its left shoulder and a long rifle with a glowing sight upright in both hands', 'ranged (robot)')

elif KIND in ('cavalry', 'siege'):
    F.start(COLORS, rig=False)
    heavy = KIND == 'siege'
    mech = walker(heavy=heavy)
    S = 'Mount_Spine'
    zt = mech.data.bones[S].head_local.z
    if heavy:
        F.tube('MortarBase', [((0, .18, zt + .23), .10, S), ((0, .18, zt + .30), .09, S)], 'Plate', 8)
        F.tube('Mortar', [((0, .26, zt + .26), .075, S), ((0, -.02, zt + .62), .065, S)], 'Gun', 8)
        F.tube('MortarGlow', [((0, -.01, zt + .605), .068, S), ((0, -.02, zt + .62), .068, S)], 'Glow', 8)
        F.box('MortarBand', (0, .14, zt + .38), (.17, .06, .10), 'Team', S)
    else:
        for sx in (-1, 1):
            F.tube(f'Cannon{sx}', [((sx * .10, -.30, zt + .12), .030, S), ((sx * .10, -.80, zt + .12), .022, S)], 'Gun', 6)
            F.box(f'CannonGlow{sx}', (sx * .10, -.805, zt + .12), (.024, .006, .024), 'Glow', S)
    rider, gl = pilot()
    tm.reins(mech, F.SEAT + gl, mat='Under', sag=.02)  # the control cables (the mounted clips' rein bone)
    parts = [mech, rider]
    look = ('Siege Automaton: a heavy four-legged graphite walker with Team side plates and glowing knee joints, a sensor head, a mortar tube raised on '
            'its back with a Team band, an android at its controls') if heavy else \
           ('Mech Walker: a four-legged graphite walker on armoured legs with Team side plates and a glowing seam, a sensor head with a glowing optic, '
            'a twin cannon under its chin, piloted by a graphite android seated in its open cockpit')
    tris = F.finish_unit(UID, parts, {'role': look, 'notes': 'Eight-ages plan U84 (2026-10-20): the horse rig\'s bones with mechanical meshes; the mounted clips.'},
                         centre=(0, -.1, .85), scale=2.7, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: MC.mounted(mech, rider, 'hand'), 'mounted'))
    drop_skin_tag()
    print('TRIS', UID, tris)
    assert tris <= 5000, tris

elif KIND == 'support':
    F.start(COLORS, rig=False)
    TOP = HV + .24 * 1.3
    rig = u.make_armature('RepairRig', [('Hull', (0, 0, HV + .1), (0, 0, HV + .3), None)])
    T.hover_hull('Repair', rig, length=1.60, width=.84, height=.24, nose=.32)
    u.tube('CraneBase', [(0, .30, TOP), (0, .30, TOP + .10)], [.10, .09], 'Plate', ['Hull'] * 2, 8, rig)
    u.tube('CraneArm', [(0, .30, TOP + .10), (0, .05, TOP + .55), (0, -.40, TOP + .60)], [.035, .030, .025], 'Armor', ['Hull'] * 3, 6, rig)
    u.tube('CraneTool', [(0, -.40, TOP + .60), (0, -.42, TOP + .45)], [.020, .010], 'Glow', ['Hull'] * 2, 5, rig)
    for k, (x, y, z) in enumerate([(-.40, -.30, TOP + .45), (.42, -.10, TOP + .55), (-.36, .40, TOP + .62), (.38, .50, TOP + .40)]):
        u.box(f'RepairDrone{k}', (x, y, z), (.07, .08, .03), 'Armor', 'Hull', rig)
        u.box(f'RepairDroneEye{k}', (x, y - .042, z), (.03, .006, .014), 'Glow', 'Hull', rig)
        for sx in (-1, 1):
            u.tube(f'RepairDroneRotor{k}{sx}', [(x + sx * .06, y, z + .01), (x + sx * .06, y, z + .015)], [.035, .035], 'Plate', ['Hull'] * 2, 8, rig)
    parts = [rig]
    C = {}
    tris = F.finish_unit(UID, parts, {'role': 'Repair Swarm: a graphite hover sled on four glowing pods with a Team panel, a crane arm with a glowing tool, '
                                               'and four small repair drones hovering round it with glowing eyes', 'notes': 'Eight-ages plan U84; hover clips.'},
                         centre=(0, 0, .5), scale=2.8, mode='NLA_TRACKS',
                         clips=MC.hook(UID, lambda: C.setdefault('r', T.hover_clips(UID, parts, fire=[(1, {}), (7, {}), (8, {'bob': .02, 'ease': 'out'}), (16, {}), (30, {})])), 'vehicle'))
    out = u.out_dir(UID)
    (out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000,
                                                 'tags': {'team': '(^|\\s)Team(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}, 'robot': True}, indent=2) + '\n')
    tm.mark_machine(UID)
    import ti_vehicle_clips as VC
    VC.write_options(UID, *C['r'])
    print('TRIS', UID, tris)
    assert tris <= 4000, tris

elif KIND == 'air':
    import build_units_modern as md
    import build_units_bronze_signature as lib
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')
    lib.reset()
    rig = u.make_armature('SentinelRig', [('Hull', (0, 0, .16), (0, -.2, .16), None)])
    for k, (x, y, z) in enumerate([(0, -.22, .16), (-.30, .16, .24), (.30, .16, .12)]):
        u.tube(f'Sentinel{k}Body', [(x, y + .10, z), (x, y - .10, z)], [(.06, .05), (.05, .04)], 'Cloth', ['Hull'] * 2, 8, rig)
        u.tube(f'Sentinel{k}Eye', [(x, y - .06, z - .04), (x, y - .06, z - .08)], [.03, .03], 'Leather', ['Hull'] * 2, 8, rig)
        u.box(f'Sentinel{k}Team', (x, y, z + .05), (.06, .12, .01), 'Team', 'Hull', rig)
        for sx in (-1, 1):
            u.tube(f'Sentinel{k}Duct{sx}', [(x + sx * .14, y, z - .015), (x + sx * .14, y, z + .025)], [.075, .075], 'Metal', ['Hull'] * 2, 12, rig)
            u.tube(f'Sentinel{k}Fan{sx}', [(x + sx * .14, y, z), (x + sx * .14, y, z + .006)], [.065, .065], 'Leather', ['Hull'] * 2, 12, rig)
            u.tube(f'Sentinel{k}Strut{sx}', [(x, y, z), (x + sx * .08, y, z)], [.012, .012], 'Cloth', ['Hull'] * 2, 4, rig)
    md.finish(UID, [rig], {'Skin': 'C99472', 'Cloth': '3A3E44', 'Leather': '4FE0F0', 'Metal': ('5A6068', .35, .7), 'Wood': '4A4038'},
              {'role': 'air', 'look': 'Sentinel Drones: three graphite drones on twin ducted rotors with Team tops and glowing sensor balls'},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False, 'robot': True}))
    drop_skin_tag()
else:
    raise SystemExit('unknown class ' + KIND)
