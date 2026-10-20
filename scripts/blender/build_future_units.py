# scripts/blender/build_future_units.py
# The Future age's base units (eight-ages plan U83), a plausible near-future look on ti_future.py (exo-suits with
# glowing seams on ti_figure.py; hover vehicles with the hover clips):
#   future-infantry   Exo-Infantry: a powered exo-suit, a closed helmet with a visor, a bulky rifle in both hands
#   future-ranged     Railgun Team: a long railgun on a low bipod mount, the gunner kneeling at it, the loader
#                     standing with a power cell (the team clips of ti_mounted_clips.atgm)
#   future-cavalry    Hover Tank: a low wedge hull on four hover pads, a flat turret with a long twin-rail gun
#   future-siege      Plasma Artillery: a hover sled with a heavy emitter cannon raised on a turntable
#   future-support    Shield Projector: a hover sled with a mast and a ring emitter over it (Fire: a pulse)
#   future-general    a hover command skiff with a rail and a sensor mast flying the emblem pennant, the general
#                     standing at the rail in a long coat over a light suit
#   future-raider     a light hover skimmer with a pintle gun and a gunner in a light suit standing at it
#   future-mercenary  a contractor in a light suit without a helmet, a hood, a carbine
#   future-air        Drone Swarm: seven small quad-rotor drones in a loose cloud on one rig (static)
#   future-settler    a hover cargo sled with the household under a Team cover and a walker beside it (static)
#   future-worker     a worker in a light exo-frame and a hard hat with a sledgehammer (the worker clips)
#   blender -b --factory-startup -P scripts/blender/build_future_units.py -- <class>
# Of no real army or model. Outputs go to art-build/units/future-<class>/; copy to src/assets/units/.
import json
import math
import os
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_future as T  # noqa: E402

KIND = (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['infantry'])[0]
UID = 'future-' + KIND
TAGS = {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}
HV = T.HOVER


def machine_json(clips):
    out = u.out_dir(UID)
    (out / f'{UID}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000, 'tags': TAGS}, indent=2) + '\n')
    tm.mark_machine(UID)
    import ti_vehicle_clips as VC
    VC.write_options(UID, *clips)


def finish_machine(parts, look, author, centre=(0, 0, .5), scale=2.8):
    C = {}
    tris = F.finish_unit(UID, parts, {'role': look, 'notes': 'Eight-ages plan U83 (2026-10-20), build_future_units.py on ti_future.py.'},
                         centre=centre, scale=scale, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: C.setdefault('r', author()), 'vehicle'))
    machine_json(C['r'])
    print('TRIS', UID, tris)
    assert tris <= 4000, tris


def hull_rig(prefix, turret=None, barrel=None):
    bones = [('Hull', (0, 0, HV + .1), (0, 0, HV + .3), None)]
    if turret:
        bones.append(('Turret', turret, (turret[0], turret[1], turret[2] + .2), 'Hull'))
    if barrel:
        bones.append(('Barrel', barrel, (barrel[0], barrel[1] - .2, barrel[2]), 'Turret'))
    return u.make_armature(f'{prefix}Rig', bones)


def light_suit(hood=False):
    """A light suit (no plates on the limbs): the undersuit, a Team vest with a glowing seam, a belt."""
    F.legs(boots='Boot', hose='Under')
    F.combat_boots('Boot', top=.180)
    F.arms(long='Under', pad=.006)
    F.head()
    F.hair(crown=False)
    F.torso('Undersuit', 'Under', grow=.006, chest=.004)
    F.torso('Vest', 'Team', grow=.016, chest=.012, sides=10)
    F.band('Seam', 'Glow', .640, .650, grow=.024, bone='Chest', sides=10)
    F.band('Belt', 'Armor', .510, .540, grow=.018, bone='Spine', sides=10)
    if hood:
        F.hood('Hood', 'Cloth', sides=10, tail=False)


# ---- foot ---------------------------------------------------------------------------------------------------

if __name__ != '__main__':  # imported for its helpers (build_signature_late.py): build nothing
    pass
elif KIND == 'infantry':
    arm = F.start(T.COLORS, ready=True)
    T.exo_suit()
    GRIP = (-.074, -.184, .596)
    F.hold('R', GRIP, pole=(-1, .6, -.5))
    F.hold('L', (GRIP[0] + .004, GRIP[1] - .002, GRIP[2] + .190), pole=(1, -.2, -.9))
    F.bake_rest()
    g = F.fist('R', None, (0, 0, 1), half=.024, mat='Glove')
    F.fist('L', None, (0, 0, 1), half=.024, mat='Glove')
    F.assault_rifle(g, body='Gun', optic='Glow', below=.200, above=.440)
    F.finish_rest(UID, 'Exo-Infantry: a powered exo-suit of graphite plates over a dark undersuit with thin cyan glowing seams, a Team chest plate, a power '
                  'pack, a closed helmet with a dark visor band, a bulky rifle with a glowing sight held upright in both hands', notes={'role': 'infantry'},
                  clips=FC.clips_hook(UID, FC.Kit('gun', two_hands=True)))

elif KIND == 'mercenary':
    arm = F.start(T.COLORS, ready=True)
    light_suit(hood=True)
    F.beard()
    F.hold('R', (-.150, -.150, .560), pole=(-1, .4, -.5))
    F.hold('L', (.062, -.122, .705), pole=(1, .2, -.8))
    F.bake_rest()
    g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
    F.fist('L', None, (0, 1, 0), half=.018, mat='Glove')
    F.assault_rifle(g, body='Gun', optic='Glow', below=.130, above=.330)
    F.finish_rest(UID, 'Mercenary (future): a contractor in a light suit, a Team vest with a glowing seam, a grey hood over the head, a beard, a short '
                  'carbine with a glowing sight upright in the right fist', notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'},
                  clips=FC.clips_hook(UID, FC.Kit('gun')))

elif KIND == 'worker':
    import ti_worker_clips as W
    arm = F.start(T.COLORS, ready=True)
    light_suit()
    for side, s in (('L', 1), ('R', -1)):  # the exo-frame: struts down the legs and the back
        F.box('Strut_' + side, (s * .100, .010, .300), (.012, .012, .300), 'Plate', 'Leg_' + side)
    F.box('Spine', (0, .100, .640), (.030, .020, .260), 'Plate', 'Chest')
    F.hard_hat('HardHat', 'Plate')
    HX, HY = 0., -.182
    F.hold('R', (HX, HY, .630), pole=(-1, .5, -.6))
    F.hold('L', (HX, HY, .684), pole=(1, .5, -.6))
    F.bake_rest()
    F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
    F.fist('L', None, (0, 0, 1), half=.022, mat='Glove')
    P = 'Prop_R'
    F.tube('HammerShaft', [((HX, HY, .070), .0125, P), ((HX, HY, .725), .0110, P)], 'Gun', 5, attachment=True)
    F.box('HammerHead', (HX, HY, .042), (.132, .046, .050), 'Plate', P, True)
    W.finish_worker(UID, 'Worker (future): a light suit with a Team vest and a glowing seam, an exo-frame of struts down the legs and the back, a pale hard hat, '
                    'leaning on a sledgehammer stood on its head; work tools in the clips',
                    'modern', 'sledge', held_frame=(Vector((0, 0, -1)), Vector((1, 0, 0))), build_tool='Held', notes={'role': 'worker'})

elif KIND == 'ranged':
    F.start(T.COLORS, rig=False)
    x, y, z = 0, -.22, .30
    rig = u.make_armature('RailRig', [('Hull', (x, y, z), (x, y, z + .1), None)])
    for k, (dx, dy) in enumerate([(.14, -.16), (-.14, -.16), (0, .16)]):
        u.tube(f'RailLeg{k}', [(x, y, z - .02), (x + dx, y + dy, .01)], [.012, .010], 'Gun', ['Hull'] * 2, 4, rig)
    u.box('RailMount', (x, y, z + .02), (.10, .10, .06), 'Armor', 'Hull', rig)
    u.tube('RailBody', [(x, y + .26, z + .07), (x, y - .05, z + .07), (x, y - .62, z + .07)], [(.05, .045), (.045, .04), (.03, .03)], 'Armor', ['Hull'] * 3, 6, rig)
    for sx in (-1, 1):  # the two rails, a glowing gap between them
        u.box(f'Rail{sx}', (x + sx * .03, y - .42, z + .07), (.012, .44, .03), 'Plate', 'Hull', rig)
    u.box('RailGlow', (x, y - .42, z + .07), (.008, .44, .012), 'Glow', 'Hull', rig)
    u.box('RailBand', (x, y + .02, z + .07), (.11, .06, .10), 'Team', 'Hull', rig)
    u.box('RailCell', (x + .07, y + .14, z + .06), (.06, .10, .07), 'Gun', 'Hull', rig)
    parts = [rig]
    AT_G = Vector((.010, .120, -.210))
    parts.append(F.figure('Gunner'))
    T.exo_suit(pack=False)
    F.pose({'Leg_L': (-85, 0, 0), 'Shin_L': (85, 0, 0), 'Leg_R': (-8, 0, 0), 'Shin_R': (98, 0, 0), 'Spine': (18, 0, 0), 'Chest': (10, 0, 0)})
    F.hold('R', Vector((-.050, -.040, .380)) - AT_G, pole=(-1, .3, -.8))
    F.hold('L', Vector((.050, -.080, .380)) - AT_G, pole=(1, .3, -.8))
    F.bake_rest()
    F.place(AT_G)
    F.fist('R', None, (0, 1, 0), half=.016, mat='Glove')
    F.fist('L', None, (0, 1, 0), half=.016, mat='Glove')
    parts.append(F.figure('Loader'))
    T.exo_suit()
    F.hold('R', (-.168, -.120, .560), pole=(-1, .5, -.4))
    F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
    F.bake_rest()
    F.place((.42, .32, 0), yaw=-25)
    g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
    F.fist('L', None, (0, 1, 0), half=.020, mat='Glove')
    F.prefix = ''  # the clips look the carried cell up by these names
    F.box('SpareTube', (g.x, g.y - .036, g.z - .100), (.060, .090, .110), 'Gun', 'Prop_R', True)
    F.box('SpareCap', (g.x, g.y - .036, g.z - .040), (.064, .094, .010), 'Glow', 'Prop_R', True)
    F.box('SpareCapLow', (g.x, g.y - .036, g.z - .010), (.012, .030, .012), 'Plate', 'Prop_R', True)
    F.prefix = 'Loader'
    F.normalize_weights()
    tris = F.finish_unit(UID, parts, {'role': 'ranged', 'look': 'Railgun team: a long twin-rail gun with a glowing gap between the rails on a low tripod, a Team '
                                                                 'band, the gunner kneeling at it in an exo-suit, the loader standing with a power cell',
                                      'notes': 'Eight-ages plan U83; the team clips of ti_mounted_clips.atgm.'},
                         open_facing=dict(F.facing), centre=(.15, 0, .5), scale=1.9, mode='NLA_TRACKS',
                         clips=MC.hook(UID, lambda: MC.atgm(parts[0], parts[1], parts[2], tube='RailBody'), 'atgm', {'ortho': 1.9, 'aim': (.05, -.05, .30)}))
    assert tris <= 4000, tris

# ---- hover machines ------------------------------------------------------------------------------------------

elif KIND == 'cavalry':
    F.start(T.COLORS, rig=False)
    TOP = HV + .28 * 1.3
    rig = hull_rig('Hover', turret=(0, .12, TOP), barrel=(0, -.30, TOP + .11))
    T.hover_hull('Hover', rig, length=1.90, width=.96, height=.28, nose=.40)
    # a low wedge turret with a bustle, a mantlet, a hatch, a sensor mast and the commander's sight
    tm.side_profile('HoverTurret', [(-.30, TOP), (.50, TOP), (.56, TOP + .12), (.40, TOP + .20), (-.12, TOP + .21), (-.34, TOP + .10)],
                    -.32, .32, 'Plate', 'Turret', rig)
    tm.side_profile('HoverTurretCheek', [(-.26, TOP + .02), (.10, TOP + .02), (.10, TOP + .16), (-.18, TOP + .16)], -.38, .38, 'Armor', 'Turret', rig)
    u.box('HoverTurretBand', (0, .30, TOP + .14), (.66, .10, .06), 'Team', 'Turret', rig)
    u.box('HoverHatch', (.12, .18, TOP + .215), (.14, .14, .02), 'Armor', 'Turret', rig)
    u.box('HoverSight', (-.16, .00, TOP + .25), (.10, .10, .08), 'Visor', 'Turret', rig)
    u.tube('HoverMast', [(.22, .42, TOP + .20), (.22, .44, TOP + .52)], [.010, .006], 'Gun', ['Turret'] * 2, 4, rig)
    u.box('HoverMantlet', (0, -.30, TOP + .11), (.20, .08, .12), 'Armor', 'Barrel', rig)
    for sx in (-1, 1):  # the twin rails from the mantlet, a glowing gap between them
        u.box(f'HoverRail{sx}', (sx * .035, -.76, TOP + .11), (.024, .84, .045), 'Gun', 'Barrel', rig)
    u.box('HoverRailGlow', (0, -.76, TOP + .11), (.012, .80, .016), 'Glow', 'Barrel', rig)
    u.box('HoverMuzzle', (0, -1.18, TOP + .11), (.10, .04, .06), 'Armor', 'Barrel', rig)
    parts = [rig]
    finish_machine(parts, 'Hover tank: a stepped graphite hull on four glowing hover pods, armour panels with a Team panel and a glowing seam a side, an engine '
                          'block with glowing vents, a low wedge turret with a bustle, a Team band, a sight and a mast, a long twin-rail gun from its mantlet',
                   lambda: T.hover_clips(UID, parts, bore=(0, -1, 0)))

elif KIND in ('siege', 'support'):
    F.start(T.COLORS, rig=False)
    TOP = HV + .26 * 1.3
    turret = (0, .15, TOP)
    rig = hull_rig('Sled', turret=turret, barrel=(0, .05, TOP + .25) if KIND == 'siege' else None)
    T.hover_hull('Sled', rig, length=1.70, width=.88, height=.26, nose=.34)
    u.tube('SledRing', [(0, .15, TOP - .02), (0, .15, TOP + .06)], [.22, .20], 'Plate', ['Turret'] * 2, 10, rig)
    if KIND == 'siege':
        el = math.radians(35)

        def at(d):
            return (0, .05 - d * math.cos(el), TOP + .25 + d * math.sin(el))
        u.box('SledCradle', (0, .15, TOP + .14), (.30, .34, .18), 'Plate', 'Turret', rig)
        u.tube('PlasmaBarrel', [at(-.25), at(.10), at(.70), at(.95)], [(.10, .10), (.085, .085), (.07, .07), (.09, .09)], 'Armor', ['Barrel'] * 4, 8, rig)
        for k, d in enumerate((.25, .45, .65)):
            u.tube(f'PlasmaCoil{k}', [at(d), at(d + .05)], [.10, .10], 'Glow', ['Barrel'] * 2, 8, rig)
        u.tube('PlasmaMouth', [at(.95), at(.96)], [.06, .06], 'Glow', ['Barrel'] * 2, 8, rig)
        u.tube('PlasmaBand', [at(-.10), at(.0)], [.11, .11], 'Team', ['Barrel'] * 2, 8, rig)
        parts = [rig]
        finish_machine(parts, 'Plasma artillery: a graphite hover sled on four glowing pads with a Team stripe, a heavy emitter cannon raised on a turntable, '
                              'three glowing coils round its barrel and a glowing mouth, a Team band',
                       lambda: T.hover_clips(UID, parts, bore=(0, -math.cos(el), math.sin(el)), fire=[(1, {}), (7, {}), (8, {'recoil': .14, 'pitch': -1.6, 'bob': .01, 'ease': 'out'}),
                                                                                                 (11, {'recoil': .10, 'pitch': .5}), (20, {}), (30, {})]))
    else:
        u.tube('ShieldMast', [(0, .15, TOP + .06), (0, .15, TOP + .77)], [.035, .025], 'Plate', ['Turret'] * 2, 6, rig)
        for k in range(12):  # the emitter: an open hoop of twelve glowing segments, arms to the mast
            a0, a1 = 2 * math.pi * k / 12, 2 * math.pi * (k + 1) / 12
            u.tube(f'ShieldRing{k}', [(.26 * math.cos(a0), .15 + .26 * math.sin(a0), TOP + .79), (.26 * math.cos(a1), .15 + .26 * math.sin(a1), TOP + .79)],
                   [.022, .022], 'Glow', ['Turret'] * 2, 5, rig)
        for k in range(3):
            a0 = 2 * math.pi * k / 3
            u.tube(f'ShieldArm{k}', [(0, .15, TOP + .77), (.25 * math.cos(a0), .15 + .25 * math.sin(a0), TOP + .79)], [.010, .010], 'Plate', ['Turret'] * 2, 4, rig)
        u.box('ShieldGenerator', (0, .15, TOP + .16), (.34, .30, .20), 'Armor', 'Turret', rig)
        u.box('ShieldBand', (0, .15, TOP + .16), (.36, .10, .21), 'Team', 'Turret', rig)
        for sx in (-1, 1):
            u.tube(f'ShieldEmitter{sx}', [(sx * .22, -.48, TOP - .02), (sx * .22, -.48, TOP + .18)], [.04, .03], 'Glow', ['Hull'] * 2, 6, rig)
        parts = [rig]
        pulse = [(1, {}), (7, {}), (8, {'bob': .03, 'ease': 'out'}), (14, {'bob': -.01}), (22, {}), (30, {})]
        finish_machine(parts, 'Shield projector: a graphite hover sled on four glowing pads with a Team stripe, a generator with a Team band on a turntable, a mast '
                              'with a glowing ring emitter over it, two glowing emitters at the front', lambda: T.hover_clips(UID, parts, fire=pulse))

elif KIND in ('general', 'raider'):
    F.start(dict(T.COLORS, Coat='2E3238', Emblem='E6D6AF'), rig=False)
    gun = KIND == 'raider'
    rig = hull_rig('Skiff', turret=(0, .10, HV + .22) if gun else None, barrel=(0, .05, HV + .77) if gun else None)
    T.hover_hull('Skiff', rig, length=1.40, width=.76, height=.20, deck=False, nose=.26)
    FL = HV + .20  # the open deck
    u.box('SkiffDeck', (0, .05, FL + .005), (.66, 1.0, .02), 'Plate', 'Hull', rig)
    for sx in (-1, 1):
        u.tube(f'SkiffRail{sx}', [(sx * .34, -.36, FL), (sx * .34, -.36, FL + .34), (sx * .34, .46, FL + .34), (sx * .34, .46, FL)],
               [.012] * 4, 'Plate', ['Hull'] * 4, 4, rig)
    u.box('SkiffConsole', (0, -.42, FL + .14), (.40, .10, .26), 'Armor', 'Hull', rig)
    u.box('SkiffScreen', (0, -.40, FL + .25), (.30, .02, .08), 'Glow', 'Hull', rig)
    crew = F.figure('Commander' if not gun else 'Gunner')
    light_suit()
    if not gun:
        F.coat_skirts('CoatSkirt', 'Coat', 'Coat', low=.300, grow=.016, flare=.020, open_deg=40)
        F.lathe('Cap', [(0, 1.034), (.060, 1.030), (.088, 1.012), (.090, .990), (.076, .962), (0, .962)], 'Armor', sides=12, sy=1.04)
        F.tube('CapBand', F.vertical([.960, .984], -.002, [(.0790, .0800), (.0770, .0780)], 'Head'), 'Glow', 12, caps=(False, False))
        F.reach('R', (-.190, -.040, .560), pole=(-.3, 1, .1))
        F.reach('L', (.190, -.030, .520), pole=(.3, 1, .1))
        F.bake_rest()
        F.fist('R', None, (0, 1, 0), half=.020, mat='Glove')
        F.fist('L', None, (0, 1, 0), half=.020, mat='Glove')
        F.place((0, .10, HV + .21), 0)
        u.tube('SkiffMast', [(-.26, .45, HV + .21), (-.26, .46, 1.75)], [.012, .006], 'Plate', ['Hull'] * 2, 4, rig)
        v = [(-.24, .46, 1.70), (-.24, .46, 1.52), (-.24, .76, 1.62)]
        p = u.mesh_obj('SkiffPennant', v, [(0, 1, 2), (0, 2, 1)], 'Emblem', 'Hull', arm=rig)
        uv = p.data.uv_layers.active
        for poly in p.data.polygons:
            for li in poly.loop_indices:
                co = p.data.vertices[p.data.loops[li].vertex_index].co
                uv.data[li].uv = ((co.y - .46) / .3, (co.z - 1.52) / .18)
        parts = [rig, crew]
        look = ('General (future): a graphite hover command skiff on four glowing pads with a rail, a Team stripe and a sensor mast flying the emblem pennant, '
                'the general standing at the rail in a long dark coat over a light suit, a peaked cap with a glowing band')
        order = [(1, {}), (6, {'r': {'Arm_R': (-40, 0, 20), 'Forearm_R': (-40, 0, 0)}, 'plant': 1}),
                 (12, {'r': {'Arm_R': (-78, 0, 12), 'Forearm_R': (-12, 0, 0), 'Chest': (4, 0, -8)}, 'plant': 1, 'ease': 'in'}), (25, {})]
        finish_machine(parts, look, lambda: T.hover_clips(UID, parts, crews=[(crew, order, 'thrown')], fire=[(1, {}), (25, {}), (30, {})]))
    else:
        F.combat_helmet('Helmet', 'Plate', band='Glow', nvg=None, strap=None)
        F.pose({'Spine': (10, 0, 0), 'Chest': (6, 0, 0), 'Head': (-10, 0, 0)})
        F.reach('L', (.090, -.24, .55), pole=(1, .2, -.8))  # on the gun's grips
        F.reach('R', (-.090, -.24, .55), pole=(-1, .2, -.8))
        F.bake_rest()
        F.fist('L', None, (0, 0, 1), half=.016, mat='Glove')
        F.fist('R', None, (0, 0, 1), half=.016, mat='Glove')
        F.place((0, .40, HV + .21), 0)
        u.tube('SkiffPintle', [(0, .10, HV + .21), (0, .10, HV + .74)], [.025, .02], 'Plate', ['Turret'] * 2, 6, rig)
        u.tube('SkiffGun', [(0, .20, HV + .77), (0, -.06, HV + .78), (0, -.44, HV + .79)], [.035, .025, .018], 'Gun', ['Barrel'] * 3, 6, rig)
        u.box('SkiffGunGlow', (0, -.20, HV + .805), (.010, .40, .010), 'Glow', 'Barrel', rig)
        u.box('SkiffGunShield', (0, -.02, HV + .80), (.22, .02, .14), 'Plate', 'Turret', rig)
        parts = [rig, crew]
        finish_machine(parts, 'Raider (future): a light graphite hover skimmer on four glowing pads with a rail and a Team stripe, a pintle gun with a glowing '
                              'rail and a small shield, a gunner in a light suit and helmet standing at it',
                       lambda: T.hover_clips(UID, parts, crews=[(crew, None, 'thrown')], bore=(0, -1, 0),
                                             fire=[(1, {}), (7, {})] + [(8 + 3 * i, {'recoil': .03, 'pitch': -.3, 'ease': 'out'}) for i in range(5)] + [(26, {}), (30, {})]))

elif KIND == 'air':
    import build_units_modern as md
    import build_units_bronze_signature as lib
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')
    lib.reset()
    rig = u.make_armature('SwarmRig', [('Hull', (0, 0, .14), (0, -.2, .14), None)])
    spots = [(0, -.25, .14), (-.28, -.05, .20), (.28, -.05, .20), (-.14, .22, .10), (.14, .22, .10), (0, .02, .30), (0, .42, .18)]
    for k, (x, y, z) in enumerate(spots):
        u.box(f'Drone{k}Body', (x, y, z), (.07, .09, .03), 'Cloth', 'Hull', rig)
        u.box(f'Drone{k}Eye', (x, y - .047, z), (.03, .006, .014), 'Leather', 'Hull', rig)
        u.box(f'Drone{k}Team', (x, y, z + .016), (.04, .05, .004), 'Team', 'Hull', rig)
        for sx in (-1, 1):
            for sy in (-1, 1):
                u.tube(f'Drone{k}Arm{sx}{sy}', [(x, y, z), (x + sx * .07, y + sy * .07, z + .005)], [.006, .006], 'Cloth', ['Hull'] * 2, 4, rig)
                u.tube(f'Drone{k}Rotor{sx}{sy}', [(x + sx * .07, y + sy * .07, z + .008), (x + sx * .07, y + sy * .07, z + .012)], [.04, .04], 'Metal', ['Hull'] * 2, 8, rig)
    md.finish(UID, [rig], {'Skin': 'C99472', 'Cloth': '3A3E44', 'Leather': '4FE0F0', 'Metal': ('8A9096', .35, .7), 'Wood': '4A4038'},
              {'role': 'air', 'look': 'Drone swarm: seven small graphite quad-rotor drones in a loose cloud, each with a glowing eye and a Team top'},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))

elif KIND == 'settler':
    import build_units_settler as S
    F.start(dict(T.COLORS, **{k: v for k, v in S.COLORS.items() if k not in T.COLORS}), rig=False)
    rig = hull_rig('Cargo')
    F.use(rig)
    T.hover_hull('Cargo', rig, length=1.40, width=.74, height=.22, deck=False, nose=.26, team=False)
    u.box('CargoLoad', (0, .05, HV + .36), (.60, .90, .28), 'Team', 'Hull', rig)
    u.box('CargoLoadTop', (-.06, .00, HV + .58), (.40, .50, .12), 'Team', 'Hull', rig)
    for k, y in enumerate((-.20, .30)):
        u.box(f'CargoStrap{k}', (0, y, HV + .52), (.62, .02, .02), 'Plate', 'Hull', rig)
    u.box('CargoTow', (0, -.80, HV + .14), (.06, .20, .03), 'Plate', 'Hull', rig)
    man = F.figure('Man')
    F.LITE = True
    light_suit()
    F.reach('R', (-.120, -.250, .620), pole=(-1, .3, -.5))
    F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
    F.bake_rest()
    F.fist('R', None, (0, 1, 0), half=.016, mat='Glove')
    F.fist('L', None, (0, 1, 0), half=.016, mat='Glove')
    F.place((.10, -1.10, 0), 0)
    tris = F.finish_unit(UID, [rig, man], {'role': 'A settler household on the move (future): a graphite hover cargo sled on four glowing pads with the household '
                                                    'under a Team cover, towed by a walker in a light suit', 'notes': 'Eight-ages plan U83.'},
                         centre=(0, 0, .5), scale=2.8)
    print('SETTLER', UID, tris, flush=True)
else:
    raise SystemExit('unknown class ' + KIND)
