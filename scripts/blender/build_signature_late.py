# scripts/blender/build_signature_late.py
# The late signature units (eight-ages plan U86, the U85 list approved by the user: Appendix D with six changes), one
# GLB with its clips per unit, src/assets/units/signature/<people>-<age>.glb, built on the late base kits:
#   foot     present-day soldiers (ti_figure.modern_soldier) or exo-suits (ti_future.exo_suit), the foot clips
#   tank     a tracked rig of ti_mounts.tank with the base tank clips (ti_vehicle_clips.tank)
#   wheeled  an eight- or six-wheeled armoured car with a turret and a commander in the hatch (aa_truck clips)
#   truck    the Information rocket or missile truck (build_information_units.py)
#   field    a light pack howitzer with three crew (ti_vehicle_clips.howitzer)
#   jet, heli, drones  static aircraft (build_units_modern.finish)
#   hover    a hover craft with its rider (ti_future.hover_clips); sled: a hover sled with a weapon or an emitter
#   walker   a four-legged walker on the horse rig with an android pilot (the mounted clips)
# Generic unit types of no named weapon model; the people's flavour is in colours, headgear and shapes.
#   blender -b --factory-startup -P scripts/blender/build_signature_late.py -- <key>
# Outputs go to art-build/units/<key>/; copy the GLB and JSON to src/assets/units/signature/.
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
import ti_foot_clips as FC  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
import ti_future as T  # noqa: E402
import build_units_modern as md  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_information_units as BI  # noqa: E402
import build_future_units as FU  # noqa: E402
import build_future_robots as RB  # noqa: E402

os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')
KEY = (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['kemet-information'])[0]
TAGS = {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}
SOLDIER = {'Skin': 'C99472', 'Hair': '2E241C', 'Uniform': '3C4134', 'Boot': '26231F', 'Sole': '161514', 'Pad': '2C2D29', 'Helmet': '8E8668',
           'Gear': '2A2A27', 'Pouch': '8A7650', 'Glove': '302D28', 'Gun': '27282A', 'Metal': ('5A5D60', .4, .7), 'Wood': '6A4A30',
           'Cloth': '6A6E5A', 'Leather': '2A2A28', 'Beret': '6A1E22', 'Hat': '6A6650', 'Vest': 'E07A20', 'Reflect': 'DCE0E0'}


def for_all(uid):
    """Point every helper module's UID at this unit (their finish functions write art-build/units/<UID>)."""
    for mod in (BI, FU, RB):
        mod.UID = uid


def write_json(uid, extra=None, skin=True):
    p = u.out_dir(uid) / f'{uid}.json'
    o = json.loads(p.read_text()) if p.exists() else {'enabled': True, 'quadruped': False, 'triangleBudget': 6000}
    o['tags'] = {k: v for k, v in TAGS.items() if skin or k != 'skin'}
    o.update(extra or {})
    p.write_text(json.dumps(o, indent=2) + '\n')


# ---- foot --------------------------------------------------------------------------------------------

def beret(mat='Beret'):
    F.lathe('Beret', [(0, 1.024), (.060, 1.020), (.086, .996), (.084, .968), (.072, .952), (0, .952)], mat, sides=12, sy=1.04, cx=-.012)


def boonie(mat='Hat'):
    F.lathe('Boonie', [(0, 1.020), (.064, 1.014), (.078, .978), (.080, .960), (.130, .948), (.132, .940), (.078, .946), (0, .950)], mat, sides=12)


def slouch(mat='Hat'):
    F.lathe('Slouch', [(0, 1.040), (.056, 1.034), (.076, 1.000), (.080, .966), (.150, .952), (.152, .942), (.078, .948), (0, .952)], mat, sides=12)
    F.box('SlouchPin', (.122, 0, .985), (.010, .110, .060), mat, 'Head')


def hard_hat(mat='Vest'):
    F.hard_hat('HardHat', mat)


def foot_info(uid, r):
    arm = F.start(dict(SOLDIER, **r.get('colors', {})), ready=True)
    head = r.get('head', 'helmet')
    # ti_figure.modern_soldier without its helmet (the recipe chooses the headgear)
    F.legs(boots='Boot', hose='Uniform')
    F.combat_boots('Boot')
    F.arms(long='Uniform', pad=.008)
    F.head()
    F.hair(crown=False)
    F.cargo_trousers('Uniform', 'Pad')
    F.torso('Shirt', 'Uniform', grow=.006, chest=.004)
    F.band('Belt', 'Gear', .528, .552, grow=.014, bone='Spine')
    F.plate_carrier('Carrier', 'Team', radio=r.get('radio', True), pouches=2)
    if head == 'helmet':
        F.combat_helmet('Helmet', 'Helmet', 'Team')
    elif head == 'beret':
        beret()
    elif head == 'boonie':
        boonie()
    elif head == 'slouch':
        slouch()
    elif head == 'hardhat':
        hard_hat()
        F.hi_vis_vest('HiVis', 'Vest', 'Reflect')
    tool = r.get('tool')
    if tool:  # an engineer's long tool upright in the right fist (a mine detector, a shovel)
        F.hold('R', (-.150, -.150, .560), pole=(-1, .4, -.5))
        F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
        F.bake_rest()
        g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
        F.fist('L', None, (0, 1, 0), half=.020, mat='Glove')
        F.tube('ToolShaft', [((g.x, g.y, .060), .010, 'Prop_R'), ((g.x, g.y, .760), .010, 'Prop_R')], 'Gun' if tool == 'detector' else 'Wood', 5, attachment=True)
        if tool == 'detector':
            F.box('ToolHead', (g.x, g.y - .060, .030), (.090, .140, .016), 'Gun', 'Prop_R', True)
            F.box('ToolBox', (g.x, g.y + .010, .600), (.040, .060, .060), 'Vest', 'Prop_R', True)
        else:
            F.box('ToolHead', (g.x, g.y, .030), (.090, .020, .110), 'Metal', 'Prop_R', True)
        kit = FC.Kit('spear')
    else:
        GRIP = (-.074, -.174, .596)
        F.hold('R', GRIP, pole=(-1, .6, -.5))
        F.hold('L', (GRIP[0] + .004, GRIP[1] - .002, GRIP[2] + .190), pole=(1, -.2, -.9))
        F.bake_rest()
        g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
        F.fist('L', None, (0, 0, 1), half=.022, mat='Glove')
        F.assault_rifle(g)
        kit = FC.Kit('gun', two_hands=True)
    F.finish_rest(uid, r['look'], budget=3000, rig_name='SignatureRig', notes={'name': r['name'], 'role': r['role'], 'signature': True,
                                                                               'recipe': 'build_signature_late.foot_info (U86)'},
                  clips=FC.clips_hook(uid, kit))


def foot_future(uid, r):
    arm = F.start(dict(T.COLORS, **r.get('colors', {})), ready=True)
    T.exo_suit(heavy=r.get('heavy', False))
    crest = r.get('crest')
    if crest:  # a crest on the helmet: a ridge, a pair of horns or a fan
        if crest == 'horns':
            for s in (-1, 1):
                F.tube(f'Horn{s}', [((s * .05, -.02, 1.02), .012, 'Head'), ((s * .11, -.04, 1.10), .004, 'Head')], 'Glow', 5)
        elif crest == 'fan':
            F.box('Crest', (0, .02, 1.07), (.010, .14, .07), 'Crest', 'Head')
        else:
            F.box('Crest', (0, 0, 1.06), (.016, .16, .03), 'Crest', 'Head')
    GRIP = (-.074, -.184, .596)
    F.hold('R', GRIP, pole=(-1, .6, -.5))
    F.hold('L', (GRIP[0] + .004, GRIP[1] - .002, GRIP[2] + .190), pole=(1, -.2, -.9))
    F.bake_rest()
    g = F.fist('R', None, (0, 0, 1), half=.024, mat='Glove')
    F.fist('L', None, (0, 0, 1), half=.024, mat='Glove')
    long = r.get('long', False)
    F.assault_rifle(g, body='Gun', optic='Glow', below=.240 if long else .200, above=.640 if long else .440)
    if r.get('shield'):
        F.box('ShieldSlab', (.190, -.120, .420), (.020, .220, .420), 'Plate', 'Forearm_L')
        F.box('ShieldGlow', (.202, -.120, .420), (.006, .200, .012), 'Glow', 'Forearm_L')
    F.finish_rest(uid, r['look'], budget=3000, rig_name='SignatureRig', notes={'name': r['name'], 'role': r['role'], 'signature': True,
                                                                               'recipe': 'build_signature_late.foot_future (U86)'},
                  clips=FC.clips_hook(uid, FC.Kit('gun', two_hands=True)))


# ---- vehicles ----------------------------------------------------------------------------------------

def tank(uid, r):
    lib.reset()
    parts, info = tm.tank('Tank', **r['tank'])
    tm.enlarge(info['rig'], r.get('enlarge', (1.07, 1.5)))
    st = {}

    def clips():
        st['table'], st['order'] = VC.tank(parts)
        return st['table']
    lib.finish(uid, parts, r['colors'], {'name': r['name'], 'role': r['role'], 'rig': 'tank', 'look': r['look'], 'signature': True,
                                         'recipe': 'build_signature_late.tank (U86)'}, 5000, False, clips=clips)
    tm.mark_machine(uid)
    VC.write_options(uid, st['table'], st['order'])


def wheeled(uid, r):
    F.start(dict(SOLDIER, Cloth=r['hull'], Leather='25262A', Metal=md.GUNMETAL), rig=False)
    axles = r.get('axles', (-.55, -.18, .18, .55))
    parts, info = tm.wheeled('Car', axles=axles, track=.66, wheel_r=.15, wheel_w=.09, frame_z=.3, frame_len=1.4, turret_at=(0, .05, .62))
    rig = info['rig']
    tm.side_profile('CarHull', [(-.78, .36), (-.55, .26), (.7, .26), (.78, .4), (.78, .6), (-.48, .62), (-.78, .5)], -.38, .38, 'Cloth', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'CarStripe{sx}', (sx * .385, .05, .5), (.008, 1.1, .05), 'Team', 'Hull', rig)
    tm.side_profile('CarTurret', [(-.25, .62), (.32, .62), (.32, .78), (-.15, .80)], -.26, .26, 'Cloth', 'Turret', rig)
    u.tube('CarGun', [(0, -.2, .72), (0, -.2 - r.get('gun', .9), .72)], [.03, .024], 'Leather', ['Barrel'] * 2, 6, rig)
    tm.enlarge(rig, (1.2, 1.5))
    parts.append(BI.crewman((.0, .25, .60), 0, ((.06, -.2, .58), (-.06, -.2, .58))))
    for_all(uid)
    BI.finish_truck(parts, r['look'])
    write_json(uid)


def truck(uid, r):
    F.start(dict(SOLDIER, Cloth=r['hull'], Leather='25262A', Metal=md.GUNMETAL), rig=False)
    prefix = 'Mlrs' if r['pod'] == 'rocket' else 'Sam'
    parts, info = BI.truck(prefix, (0, .40, .48))
    (BI.rocket_pod if r['pod'] == 'rocket' else BI.sam_pod)(prefix, info['rig'])
    u.box(prefix + 'ControlBox', (.25, .86, .40), (.16, .06, .14), 'Leather', 'Hull', info['rig'])
    tm.enlarge(info['rig'], (1.2, 1.55))
    parts.append(BI.crewman((.30, 1.58, 0), 0, ((.07, -.20, .58), (-.07, -.20, .58))))
    for_all(uid)
    BI.finish_truck(parts, r['look'])
    write_json(uid)


def field(uid, r):
    F.start(dict(SOLDIER, Cloth=r['hull'], Leather='25262A', Metal=md.GUNMETAL, Emblem='C8A040'), rig=False)
    parts, info = tm.wheeled('How', axles=(.06,), track=.5, wheel_r=.16, wheel_w=.07, frame_z=.28, frame_len=.4, turret_at=(0, .06, .34))
    rig = info['rig']
    el = math.radians(30)

    def at(d):
        return (0, .06 - d * math.cos(el), .46 + d * math.sin(el))
    for sx in (-1, 1):
        u.tube(f'HowTrail{sx}', [(sx * .08, .12, .28), (sx * .3, .8, .04)], [.03, .025], 'Cloth', ['Hull'] * 2, 6, rig)
    u.box('HowShield', (0, -.10, .40), (.36, .02, .22), 'Cloth', 'Turret', rig)
    u.tube('HowBarrel', [at(-.15), at(.55)], [.04, .03], 'Cloth', ['Barrel'] * 2, 8, rig)
    tm.enlarge(rig, 1.35)
    if r.get('mule'):  # the mule's pack saddle and the gun's spare wheel, unloaded beside the gun
        u.box('PackSaddle', (.75, .55, .02), (.30, .40, .16), 'Leather', 'Hull', rig)
        u.tube('SpareWheel', [(.75, -.2, .02), (.75, -.2, .06)], [.16, .16], 'Leather', ['Hull'] * 2, 10, rig)
    crew = []
    for k, (x, y, yaw) in enumerate(((-.62, .2, 90), (.6, .1, -90), (-.1, 1.05, 180))):  # lighter crew (LITE, no carrier): the 4,000 cap
        F.figure(f'Crew{k}')
        F.LITE = True
        F.legs(boots='Boot', hose='Uniform')
        F.arms(long='Uniform', pad=.004)
        F.head(ears=False)
        F.torso('Shirt', 'Uniform', grow=.006, chest=.004, sides=8)
        F.band('Belt', 'Team', .520, .548, grow=.018, bone='Spine', sides=8)
        F.combat_helmet('Helmet', 'Helmet', 'Team', nvg=None, strap=None, sides=8)
        F.reach('L', (.06, -.2, .58), pole=(1, .3, -.6))
        F.reach('R', (-.06, -.2, .58), pole=(-1, .3, -.6))
        F.bake_rest()
        F.fist('L', None, (0, 1, 0), half=.016)
        F.fist('R', None, (0, 1, 0), half=.016)
        F.place((x, y, 0), yaw)
        crew.append(F.arm)
    parts += crew
    C = {}
    tris = F.finish_unit(uid, parts, {'role': r['look'], 'notes': 'build_signature_late.field (U86)'}, centre=(0, .3, .6), scale=2.6,
                         mode='NLA_TRACKS', clips=MC.hook(uid, lambda: C.setdefault('r', VC.howitzer(parts)), 'vehicle'))
    write_json(uid)
    tm.mark_machine(uid)
    VC.write_options(uid, *C['r'])
    assert tris <= 4000, tris


def jet(uid, r):
    lib.reset()
    parts, info = tm.jet('Jet', **r.get('jet', {}))
    md.finish(uid, parts, r['colors'], {'role': 'air', 'look': r['look'], 'name': r['name'], 'signature': True},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))


def heli(uid, r):
    lib.reset()
    zc = .30
    rig = u.make_armature('HeliRig', [('Hull', (0, 0, zc), (0, -.2, zc), None)])
    u.tube('HeliBody', [(0, -.55, zc), (0, -.45, zc + .04), (0, -.1, zc + .05), (0, .2, zc + .03), (0, .9, zc + .05), (0, 1.1, zc + .08)],
           [(.05, .06), (.09, .11), (.10, .12), (.09, .10), (.03, .03), (.025, .03)], 'Cloth', ['Hull'] * 6, 8, rig)
    u.tube('HeliCanopy', [(0, -.52, zc + .06), (0, -.40, zc + .14), (0, -.12, zc + .15), (0, .02, zc + .10)], [.01, (.055, .05), (.06, .05), .02], 'Leather', ['Hull'] * 4, 8, rig)
    for sx in (-1, 1):
        u.box(f'HeliStub{sx}', (sx * .22, .0, zc - .02), (.26, .12, .02), 'Cloth', 'Hull', rig)
        u.tube(f'HeliPod{sx}', [(sx * .30, -.12, zc - .06), (sx * .30, .14, zc - .06)], [.035, .035], 'Metal', ['Hull'] * 2, 8, rig)
    u.tube('HeliMast', [(0, -.1, zc + .14), (0, -.1, zc + .24)], [.025, .02], 'Metal', ['Hull'] * 2, 6, rig)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        u.tube(f'HeliBlade{k}', [(0, -.1, zc + .24), (math.cos(a) * .85, -.1 + math.sin(a) * .85, zc + .23)], [(.03, .004), (.02, .003)], 'Leather', ['Hull'] * 2, 4, rig)
    u.box('HeliFin', (0, 1.05, zc + .14), (.01, .14, .2), 'Team', 'Hull', rig)
    u.tube('HeliTailRotor', [(.03, 1.08, zc + .16), (.04, 1.08, zc + .16)], [.12, .12], 'Leather', ['Hull'] * 2, 8, rig)
    md.finish(uid, [rig], r['colors'], {'role': 'air', 'look': r['look'], 'name': r['name'], 'signature': True},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))


def drones(uid, r):
    lib.reset()
    rig = u.make_armature('SwarmRig', [('Hull', (0, 0, .14), (0, -.2, .14), None)])
    winged = r.get('winged', False)
    for k, (x, y, z) in enumerate(((0, -.3, .14), (-.32, -.02, .22), (.32, -.02, .22), (-.16, .28, .10), (.16, .28, .10), (0, .02, .32))):
        if winged:  # a gliding hunter: a body and two long swept wings
            u.tube(f'D{k}Body', [(x, y - .08, z), (x, y + .08, z)], [.02, .012], 'Cloth', ['Hull'] * 2, 6, rig)
            for sx in (-1, 1):
                u.tube(f'D{k}Wing{sx}', [(x, y, z), (x + sx * .16, y + .05, z + .02)], [(.04, .004), (.015, .003)], 'Cloth', ['Hull'] * 2, 4, rig)
            u.box(f'D{k}Eye', (x, y - .085, z), (.012, .006, .01), 'Leather', 'Hull', rig)
        else:  # a quad-rotor with a dragon-scale body
            u.box(f'D{k}Body', (x, y, z), (.07, .10, .03), 'Cloth', 'Hull', rig)
            u.box(f'D{k}Team', (x, y, z + .016), (.04, .05, .004), 'Team', 'Hull', rig)
            for sx in (-1, 1):
                for sy in (-1, 1):
                    u.tube(f'D{k}Rotor{sx}{sy}', [(x + sx * .07, y + sy * .07, z + .008), (x + sx * .07, y + sy * .07, z + .012)], [.04, .04], 'Metal', ['Hull'] * 2, 8, rig)
    md.finish(uid, [rig], r['colors'], {'role': 'air', 'look': r['look'], 'name': r['name'], 'signature': True},
              dict(budget=3000, mounted=False, fit_height=True, json={'segment': False}))


def hover(uid, r):
    F.start(dict(T.COLORS, **r.get('colors', {})), rig=False)
    HV = T.HOVER
    rig = FU.hull_rig('Skiff', turret=(0, .10, HV + .22), barrel=(0, .05, HV + .77))
    T.hover_hull('Skiff', rig, length=1.5, width=.78, height=.20, deck=False, nose=.32)
    FL = HV + .20
    u.box('SkiffDeck', (0, .05, FL + .005), (.68, 1.1, .02), 'Plate', 'Hull', rig)
    prow = r.get('prow')
    if prow == 'falcon':  # a gilded falcon head on the prow
        u.tube('Prow', [(0, -.62, FL), (0, -.72, FL + .30)], [.06, .04], 'Gold', ['Hull'] * 2, 6, rig)
        u.box('ProwBeak', (0, -.80, FL + .26), (.04, .08, .03), 'Gold', 'Hull', rig, )
    elif prow == 'horse':
        u.tube('Prow', [(0, -.62, FL), (0, -.70, FL + .34)], [.05, .035], 'Plate', ['Hull'] * 2, 6, rig)
        u.box('ProwMane', (0, -.66, FL + .26), (.02, .08, .12), 'Team', 'Hull', rig)
    elif prow == 'outrigger':
        for sx in (-1, 1):
            u.tube(f'Outrigger{sx}', [(sx * .62, -.45, HV - .02), (sx * .62, .55, HV - .02)], [.05, .05], 'Plate', ['Hull'] * 2, 8, rig)
            u.box(f'Boom{sx}', (sx * .45, .05, HV + .05), (.35, .04, .03), 'Armor', 'Hull', rig)
    u.tube('SkiffPintle', [(0, .10, FL), (0, .10, HV + .74)], [.025, .02], 'Plate', ['Turret'] * 2, 6, rig)
    u.tube('SkiffGun', [(0, .20, HV + .77), (0, -.44, HV + .79)], [.035, .018], 'Gun', ['Barrel'] * 2, 6, rig)
    u.box('SkiffGunGlow', (0, -.20, HV + .805), (.010, .40, .010), 'Glow', 'Barrel', rig)
    crew = F.figure('Gunner')
    FU.light_suit()
    F.combat_helmet('Helmet', 'Plate', band='Glow', nvg=None, strap=None)
    F.pose({'Spine': (10, 0, 0), 'Chest': (6, 0, 0), 'Head': (-10, 0, 0)})
    F.reach('L', (.090, -.24, .55), pole=(1, .2, -.8))
    F.reach('R', (-.090, -.24, .55), pole=(-1, .2, -.8))
    F.bake_rest()
    F.fist('L', None, (0, 0, 1), half=.016, mat='Glove')
    F.fist('R', None, (0, 0, 1), half=.016, mat='Glove')
    F.place((0, .40, HV + .21), 0)
    parts = [rig, crew]
    for_all(uid)
    FU.finish_machine(parts, r['look'], lambda: T.hover_clips(uid, parts, crews=[(crew, None, 'thrown')], bore=(0, -1, 0)))


def sled(uid, r):
    F.start(dict(T.COLORS, **r.get('colors', {})), rig=False)
    HV = T.HOVER
    TOP = HV + .26 * 1.3
    gun = r['emit'] == 'lance'
    rig = FU.hull_rig('Sled', turret=(0, .15, TOP), barrel=(0, .05, TOP + .25) if gun else None)
    T.hover_hull('Sled', rig, length=1.7, width=.88, height=.26, nose=.34)
    u.tube('SledRing', [(0, .15, TOP - .02), (0, .15, TOP + .06)], [.22, .20], 'Plate', ['Turret'] * 2, 10, rig)
    if gun:  # a sun-lance: a long gilded emitter with a mirror dish at its back
        el = math.radians(30)

        def at(d):
            return (0, .05 - d * math.cos(el), TOP + .25 + d * math.sin(el))
        u.tube('Lance', [at(-.2), at(1.0)], [.07, .04], 'Gold', ['Barrel'] * 2, 8, rig)
        u.tube('LanceTip', [at(1.0), at(1.05)], [.05, .05], 'Glow', ['Barrel'] * 2, 8, rig)
        u.tube('Mirror', [at(-.24), at(-.20)], [.24, .24], 'Gold', ['Barrel'] * 2, 12, rig)
        author = lambda: T.hover_clips(uid, parts, bore=(0, -math.cos(el), math.sin(el)))  # noqa: E731
    else:  # an oak-leaf shield emitter: a mast with a ring of leaf-shaped glowing plates
        u.tube('Mast', [(0, .15, TOP + .06), (0, .15, TOP + .80)], [.035, .025], 'Plate', ['Turret'] * 2, 6, rig)
        for k in range(8):
            a = 2 * math.pi * k / 8
            u.box(f'Leaf{k}', (.24 * math.cos(a), .15 + .24 * math.sin(a), TOP + .80), (.10, .05, .02), 'Glow', 'Turret', rig)
        author = lambda: T.hover_clips(uid, parts, fire=[(1, {}), (7, {}), (8, {'bob': .03, 'ease': 'out'}), (14, {}), (30, {})])  # noqa: E731
    parts = [rig]
    for_all(uid)
    FU.finish_machine(parts, r['look'], author)


def walker(uid, r):
    F.start(dict(RB.COLORS, **r.get('colors', {})), rig=False)
    for_all(uid)
    mech = RB.walker(heavy=True)
    S = 'Mount_Spine'
    zt = mech.data.bones[S].head_local.z
    hx, hy, hz = mech.data.bones['Mount_Head'].head_local
    F.use(mech)
    F.tube('RhinoHorn', [((0, hy - .14, hz + .02), .04, 'Mount_Head'), ((0, hy - .26, hz + .14), .005, 'Mount_Head')], 'Gold', 6)
    F.tube('RhinoHorn2', [((0, hy - .05, hz + .06), .025, 'Mount_Head'), ((0, hy - .10, hz + .14), .004, 'Mount_Head')], 'Gold', 5)
    rider, gl = RB.pilot()
    tm.reins(mech, F.SEAT + gl, mat='Under', sag=.02)
    parts = [mech, rider]
    tris = F.finish_unit(uid, parts, {'role': r['look'], 'notes': 'build_signature_late.walker (U86)'}, centre=(0, -.1, .85), scale=2.7,
                         mode='NLA_TRACKS', clips=MC.hook(uid, lambda: MC.mounted(mech, rider, 'hand'), 'mounted'))
    write_json(uid, {'quadruped': True, 'triangleBudget': 5000}, skin=False)
    assert tris <= 5000, tris


# ---- the list (eight-ages plan U85, Appendix D with the user's six changes) ------------------------------------

def tk(hull_len, turret_len, gun_len, wheels=7, **k):
    return dict(hull_len=hull_len, turret_len=turret_len, gun_len=gun_len, wheels=wheels, **k)


SAND, OLIVE, GREEN, GREY = 'B5A584', '5E6646', '4E5A3E', '7C8084'
RECIPES = {
    # Information: foot
    'tartessos-information': ('foot_info', dict(name='Spanish mountain infantry', role='infantry', head='helmet', colors={'Uniform': '6E7262', 'Helmet': '5E6252'},
                                                look='Mountain infantryman: a grey-green helmet, a Team plate carrier, a grey-green uniform for the high sierra, knee pads, high boots, an assault rifle upright')),
    'ulaid-information': ('foot_info', dict(name='Irish ranger company', role='infantry', head='boonie', colors={'Uniform': '545A44', 'Hat': '545A44'},
                                            look='Ranger: an olive bush hat, a Team plate carrier, an olive uniform, knee pads, high boots, an assault rifle upright')),
    'kemet-information': ('foot_info', dict(name='Egyptian paratroopers', role='infantry', head='beret', colors={'Uniform': 'B8A47C', 'Beret': '6A1E22'},
                                            look='Paratrooper: a maroon beret, a Team plate carrier, a desert-tan uniform, knee pads, high boots, an assault rifle upright')),
    'lusitania-information': ('foot_info', dict(name='Portuguese commandos', role='infantry', head='beret', colors={'Uniform': '4E5A3E', 'Beret': 'A82A24'},
                                                look='Commando: a red beret, a Team plate carrier, a green uniform, knee pads, high boots, an assault rifle upright')),
    'wahgi-information': ('foot_info', dict(name='Papua New Guinea light infantry', role='infantry', head='boonie', colors={'Skin': '6E4A32', 'Uniform': '3E5034', 'Hat': '3E5034'},
                                            look='Light infantryman: a green bush hat, a Team plate carrier, a jungle-green uniform, knee pads, high boots, an assault rifle upright')),
    'tondo-information': ('foot_info', dict(name='Philippine scout rangers', role='infantry', head='beret', colors={'Skin': 'B07A58', 'Uniform': '4A5440', 'Beret': '1E1E20'},
                                            look='Scout ranger: a black beret, a Team plate carrier, an olive uniform, knee pads, high boots, an assault rifle upright')),
    'gunditjmara-information': ('foot_info', dict(name='Australian Indigenous surveillance patrol', role='infantry', head='slouch', colors={'Skin': '5E3E2A', 'Uniform': '8A7A56', 'Hat': '6A6044'},
                                                  look='Surveillance patrolman: a slouch hat pinned up at the side, a Team plate carrier, a khaki uniform for the dry north, high boots, an assault rifle upright')),
    'bau-information': ('foot_info', dict(name='Fijian infantry', role='infantry', head='helmet', colors={'Skin': '6A4632', 'Uniform': '4A5440'},
                                          look='Infantryman: a tan helmet, a Team plate carrier, an olive uniform, knee pads, high boots, an assault rifle upright')),
    'dvaravati-information': ('foot_info', dict(name='Royal Thai marines', role='infantry', head='beret', colors={'Skin': 'B98258', 'Uniform': '3E4A3A', 'Beret': '1E2A4E'},
                                                look='Marine: a navy-blue beret, a Team plate carrier, a dark green uniform, knee pads, high boots, an assault rifle upright')),
    'muisca-information': ('foot_info', dict(name='Colombian demining engineers', role='support', head='helmet', tool='detector', radio=False, colors={'Skin': 'B07A58', 'Uniform': '4E5A3E', 'Helmet': '4E5A3E'},
                                             look='Demining engineer: a helmet, a Team blast vest, a green uniform, a mine detector on its shaft in the right fist, the left hand at the side')),
    'teotihuacan-information': ('foot_info', dict(name='Mexican disaster-relief engineers', role='support', head='hardhat', tool='shovel', radio=False, colors={'Skin': 'B07A58', 'Uniform': '4A5440', 'Vest': 'E07A20'},
                                                  look='Relief engineer: an orange hard hat, an orange high-visibility vest, an olive uniform, a shovel upright in the right fist')),
    # Information: vehicles
    'yamatai-information': ('tank', dict(name='Japanese armoured regiment', role='cavalry', tank=tk(1.6, .80, 1.0, wedge=.28, turret_w=.68),
                                         colors={'Skin': 'C99472', 'Cloth': '5A5E48', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                         look='a compact angular main battle tank with a low wedge turret, side skirts with a Team stripe, olive')),
    'kuru-information': ('tank', dict(name='Indian armoured regiment', role='cavalry', tank=tk(1.75, .86, 1.05),
                                      colors={'Skin': 'C99472', 'Cloth': 'A89870', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                      look='a main battle tank in desert sand with a large turret, side skirts with a Team stripe')),
    'cherusci-information': ('tank', dict(name='German panzer battalion', role='cavalry', tank=tk(1.75, .9, 1.1, wedge=.10, turret_h=.24),
                                          colors={'Skin': 'C99472', 'Cloth': '4A5040', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                          look='a main battle tank with a tall boxy turret with flat faces, dark green, a Team stripe on its skirts')),
    'brigantes-information': ('tank', dict(name='British armoured regiment', role='cavalry', tank=tk(1.85, .95, 1.05, turret_h=.18, wheels=6),
                                           colors={'Skin': 'C99472', 'Cloth': '5A6048', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                           look='a long flat main battle tank with a low slab-sided turret, green, a Team stripe on its skirts')),
    'hopewell-information': ('tank', dict(name='American armoured cavalry', role='cavalry', tank=tk(1.8, .95, 1.05, turret_w=.78, turret_h=.22),
                                          colors={'Skin': 'C99472', 'Cloth': 'A49A7A', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                          look='a heavy main battle tank with a wide flat turret and a long gun, tan, a Team stripe on its skirts')),
    'gojoseon-information': ('tank', dict(name='Korean self-propelled artillery', role='siege', tank=tk(1.7, 1.0, 1.4, turret_h=.30, turret_w=.74, skirts=False, gun_r=.045),
                                          colors={'Skin': 'C99472', 'Cloth': '5A6048', 'Leather': '2A2A28', 'Metal': md.GUNMETAL, 'Wood': '4A4038'},
                                          look='a self-propelled howitzer: a tracked hull under a tall boxy turret with a long gun and a muzzle brake, green, a Team band')),
    'rasenna-information': ('wheeled', dict(name='Italian wheeled tank destroyers', role='cavalry', hull=OLIVE, gun=1.05,
                                            look='Wheeled tank destroyer: an eight-wheeled armoured car with a turret and a long gun, olive, a Team stripe, the commander in the hatch')),
    'khoekhoe-information': ('wheeled', dict(name='Southern African armoured cars', role='cavalry', hull=SAND, gun=.7, axles=(-.5, 0, .5),
                                             look='Armoured car: a six-wheeled armoured car with a turret and a medium gun, sand, a Team stripe, the commander in the hatch')),
    'tupinamba-information': ('truck', dict(name='Brazilian rocket artillery', role='siege', hull='5A6048', pod='rocket',
                                            look='Rocket artillery: a green three-axle truck with a twelve-tube launcher pod raised, Team bands, a crewman at the controls')),
    'zhou-information': ('truck', dict(name='Chinese air-defence missile battery', role='support', hull='6A7058', pod='sam',
                                       look='Air-defence missile battery: a green truck with four missile canisters raised on a turntable and a radar panel, a crewman at the controls')),
    'diaguita-information': ('field', dict(name='Andean mule-borne mountain artillery', role='siege', hull='5A5E48', mule=True,
                                           look='Mountain artillery: a light pack howitzer with a small shield, the mule pack saddle unloaded beside it, three crew')),
    'geats-information': ('jet', dict(name='Swedish multirole fighters', role='air', jet=dict(length=1.8, span=1.3),
                                      colors={'Skin': 'C99472', 'Cloth': '8C939A', 'Leather': '2C3036', 'Metal': ('B8BCC0', .35, .7), 'Wood': '4A4038'},
                                      look='a light single-engine delta-wing fighter with canards, grey, Team fins')),
    'arverni-information': ('heli', dict(name='French attack helicopter squadron', role='air',
                                         colors={'Skin': 'C99472', 'Cloth': '5A5E50', 'Leather': '22262A', 'Metal': ('8A9096', .35, .7), 'Wood': '4A4038'},
                                         look='an attack helicopter: a slim fuselage with a tandem canopy, stub wings with rocket pods, a four-bladed rotor, a Team fin')),
    # Future
    'akkad-future': ('foot_future', dict(name='Lugal exo-guard', role='infantry', crest='horns', colors={'Plate': 'B8963E', 'Crest': 'B8963E'},
                                         look='Lugal exo-guard: an exo-suit with gilded plates, a closed helmet with glowing horns, a bulky rifle upright')),
    'yamatai-future': ('foot_future', dict(name='Ashigaru exo-infantry', role='infantry', crest='fan', colors={'Plate': '8A2A24', 'Crest': 'C8A040'},
                                           look='Ashigaru exo-infantry: an exo-suit with red lacquer plates, a helmet with a gilded fan crest, a bulky rifle upright')),
    'nok-future': ('foot_future', dict(name='Nok terracotta exo-guard', role='infantry', crest='ridge', colors={'Skin': '6A4632', 'Plate': 'B0623A', 'Crest': 'B0623A'},
                                       look='Terracotta exo-guard: an exo-suit with terracotta plates, a ridged helmet, a bulky rifle upright')),
    'saudeleur-future': ('foot_future', dict(name='Nan Madol shield wall', role='support', heavy=True, shield=True, colors={'Skin': '8A5A3A', 'Plate': '3A3A3C'},
                                             look='Shield-wall trooper: a heavy exo-suit of dark basalt plates, a tall slab shield with a glowing seam on the left arm, a rifle')),
    'kuru-future': ('foot_future', dict(name='Agni railgun teams', role='ranged', long=True, colors={'Glow': 'F0A040'},
                                        look='Agni railgunner: an exo-suit with fire-orange glowing seams, a long railgun upright')),
    'chaco-future': ('foot_future', dict(name='Skywatch railgunners', role='ranged', long=True, crest='ridge', colors={'Plate': 'A88A64', 'Crest': '6A8AA8'},
                                         look='Skywatch railgunner: an exo-suit with sandstone plates, a sky-blue helmet ridge, a long railgun upright')),
    'cucuteni-future': ('foot_future', dict(name='Trypillian sentinel teams', role='ranged', long=True, colors={'Plate': 'D8C8A8', 'Glow': 'C84A30'},
                                            look='Sentinel: an exo-suit with pale plates and spiral red glowing seams, a long rifle upright')),
    'kemet-future': ('hover', dict(name='Horus hover chariots', role='cavalry', prow='falcon', colors={'Gold': 'C8A040', 'Armor': '2E3A4A'},
                                   look='Horus hover chariot: a hover craft with a gilded falcon-head prow, a pintle gun and its gunner')),
    'punt-future': ('hover', dict(name='Incense-coast hover raiders', role='cavalry', colors={'Armor': 'A88A64', 'Plate': 'C8B898'},
                                  look='Hover raider: a sand-coloured hover craft with a pintle gun and its gunner')),
    'lapita-future': ('hover', dict(name='Wave-skimmer hover craft', role='cavalry', prow='outrigger', colors={'Armor': '2A5A6A', 'Plate': '4A8A9A'},
                                    look='Wave-skimmer: a sea-blue hover craft with twin outriggers, a pintle gun and its gunner')),
    'botai-future': ('hover', dict(name='Steppe hover cavalry', role='cavalry', prow='horse', colors={'Armor': '3A3A34', 'Plate': '6A6450'},
                                   look='Steppe hover rider: a dark hover craft with a horse-head prow and a Team mane, a pintle gun and its rider')),
    'mapungubwe-future': ('walker', dict(name='Golden-rhino walkers', role='cavalry', colors={'Armor': 'B8963E', 'Plate': 'C8A84E', 'Gold': 'E0C060'},
                                         look='Golden-rhino walker: a heavy four-legged gilded walker with two rhino horns on its sensor head, an android pilot')),
    'shang-future': ('drones', dict(name='Bronze-dragon drone swarm', role='air', colors={'Skin': 'C99472', 'Cloth': '8A6A30', 'Leather': '4FE0F0', 'Metal': ('B8963E', .35, .7), 'Wood': '4A4038'},
                                    look='Bronze-dragon drone swarm: six bronze quad-rotor drones with Team tops')),
    'caral-future': ('drones', dict(name='Condor hunter drones', role='air', winged=True, colors={'Skin': 'C99472', 'Cloth': '2A2C30', 'Leather': 'E0E0D8', 'Metal': ('8A9096', .35, .7), 'Wood': '4A4038'},
                                    look='Condor hunter drones: six black gliding drones with long swept wings and pale eyes')),
    'saba-future': ('sled', dict(name='Sun-lance artillery', role='siege', emit='lance', colors={'Gold': 'C8A040'},
                                 look='Sun-lance artillery: a hover sled with a long gilded emitter and a mirror dish raised on a turntable')),
    'arverni-future': ('sled', dict(name='Oak-shield projectors', role='support', emit='oak', colors={'Glow': '7AE07A'},
                                    look='Oak-shield projector: a hover sled with a mast crowned by a ring of glowing green oak-leaf plates')),
}

BUILD = {'foot_info': foot_info, 'foot_future': foot_future, 'tank': tank, 'wheeled': wheeled, 'truck': truck, 'field': field, 'jet': jet,
         'heli': heli, 'drones': drones, 'hover': hover, 'sled': sled, 'walker': walker}

if __name__ == '__main__':
    kind, recipe = RECIPES[KEY]
    BUILD[kind](KEY, recipe)
    sys.stdout.flush()
