# scripts/blender/build_units_modern_signature.py
# The 10 Modern signature units of plans/ART-MODELS-PLAN.md 4.5 (one per people whose peak is the Modern
# age), on the person rig, the camel and the tracked rig (ti_units.py, ti_mounts.py), with the part
# libraries of the earlier ages and build_units_modern.py, in the base units' look (faceted, flat colours:
# Team, Skin, Emblem, Metal, Wood, Leather, Cloth; readable at 30 px). Original procedural geometry.
#   kingdom-of-israel  Merkava main battle tank: low hull with the engine in front, a long wedge turret set
#                      far back, a long smoothbore gun, side skirts, slat armour at the turret's back
#   marcomannia        LT vz. 38 light tank: a small riveted hull, four big road wheels, a small turret
#                      with a 37 mm gun
#   kindah             Arab Revolt camel riflemen (infantry): headcloth and cord, robe, bandolier, rifle
#   illyria            Albanian Kachak riflemen (ranged): white felt plis cap, wool jacket, bandolier, rifle
#   dacia              Romanian mountain troops (infantry): the big mountain beret with an edelweiss badge,
#                      wool tunic, rifle, rucksack
#   nuragi             Brigata Sassari infantry: WWI grey-green, the Adrian helmet, red-and-white collar
#                      badges, rifle with bayonet, puttees
#   noricum            Kaiserschuetzen mountain riflemen: the mountain cap with a feather, wool uniform,
#                      rifle, a rope coil and an ice axe
#   rygir              Norwegian ski infantry: wool uniform, round cap, rifle, long skis on the back
#   d-mt               Ethiopian rifle infantry (Adwa, 1896): white shamma with a Team border, cartridge
#                      belt, rifle, a tall felt hat, bare feet
#   dorset             Canadian Ranger riflemen (ranged): hooded anorak with a fur ruff, red armband, rifle,
#                      snow goggles, mukluks
#   blender -b --factory-startup -P scripts/blender/build_units_modern_signature.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json) and report.json; rest pose only.
import bpy, sys, os, math, json  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_classical_signature as cs  # noqa: E402
import build_units_gunpowder as gp  # noqa: E402
import build_units_modern as md  # noqa: E402
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'signature')

IRON = ('4A4A4E', .45, .7)
STEEL = ('8A8E90', .35, .7)


# ---- parts -----------------------------------------------------------------------------------------

def rifle(arm):
    """A bolt-action rifle at the shoulder (wooden furniture, no bayonet)."""
    gp.musket(arm, bayonet=False, length=.72)


def rifle_bayonet(arm):
    gp.musket(arm, bayonet=True, length=.72)


def bandolier(arm, mat='Leather'):
    u.tube('Bandolier', [(.12, -.075, .78), (0, -.095, .63), (-.11, -.08, .49)], [(.022, .008)] * 3, mat, ['Chest', 'Spine', 'Hips'], 4, arm)
    for k in range(4):
        t = .2 + .2 * k
        x, y, z = .12 - .23 * t, -.075 - .02 * math.sin(math.pi * t), .78 - .29 * t
        u.box(f'Clip{k}', (x, y - .012, z), (.03, .015, .03), 'Metal', 'Chest' if z > .68 else 'Spine', arm)


def cartridge_belt(arm, mat='Leather'):
    lib.ring('CartridgeBelt', arm, [.49, .54], [(.112, .08), (.11, .078)], mat, ['Hips'] * 2, 10)


def plis(arm, mat='Cloth'):
    """The Albanian plis: a small white felt skullcap."""
    u.tube('Plis', [(0, 0, .975), (0, 0, 1.01), (0, 0, 1.03)], [(.064, .058), (.062, .056), (.05, .046)], mat, ['Head'] * 3, 10, arm)


def xhamadan(arm, mat='Team'):
    """A short wool jacket (open waistcoat over the shirt) with dark braid edges."""
    lib.ring('Xhamadan', arm, [.56, .64, .70, .76], [(.105, .076), (.1, .074), (.122, .084), (.126, .082)], mat, ['Spine', 'Spine', 'Chest', 'Chest'], 8)
    for sx in (-1, 1):
        u.box(f'Braid{sx}', (sx * .035, -.084, .66), (.012, .01, .2), 'Leather', 'Spine', arm)


def tirq(arm, mat='Cloth'):
    """Tight white felt trousers with black braid down the sides."""
    md.cargo_trousers(arm, mat, pads=None)
    for side, sign in [('L', 1), ('R', -1)]:
        u.box(f'TirqBraid_{side}', (sign * .118, -.002, .32), (.008, .02, .26), 'Leather', 'Leg_' + side, arm)


def mountain_beret(arm, mat='Leather', badge='Cloth'):
    """The vanatori de munte's big beret, pulled down to one side, a white edelweiss badge."""
    u.tube('MountainBeret', [(0, 0, .955), (-.02, -.005, .99), (-.05, -.01, 1.015)], [(.072, .068), (.10, .092), (.07, .064)], mat, ['Head'] * 3, 10, arm)
    u.box('Edelweiss', (.05, -.06, .985), (.03, .012, .03), badge, 'Head', arm)


def wool_tunic(arm, mat='Team'):
    lib.ring('TunicSkirt', arm, [.42, .48, .537], [(.12, .086), (.112, .08), (.096, .068)], mat, ['Hips'] * 3, 8)
    lib.top(arm, mat, name='Tunic')
    md.sleeves(arm, mat)
    md.yoke(arm, mat)
    md.hide_skin(arm, legs=False)
    for k, z in enumerate((.57, .64, .71)):
        u.box(f'TunicButton{k}', (0, -.087, z), (.014, .01, .014), 'Metal', 'Spine' if z < .65 else 'Chest', arm)


def puttees(arm, mat='Cloth'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Puttee_{side}', [(sign * .073, -.004, .25), (sign * .073, -.004, .15), (sign * .074, -.006, .05)], [(.043, .041), (.041, .039), (.037, .037)], mat, ['Shin_' + side] * 3, 6, arm)


def adrian_helmet(arm, mat='Cloth'):
    """The WWI Adrian helmet: a rounded bowl, a fore and aft brim, a crest along the top."""
    u.tube('Adrian', [(0, .004, .945), (0, 0, .985), (0, 0, 1.02), (0, 0, 1.04)], [(.076, .08), (.072, .076), (.056, .058), (.026, .026)], mat, ['Head'] * 4, 10, arm)
    u.tube('AdrianBrim', [(0, 0, .937), (0, 0, .947)], [(.094, .118), (.092, .116)], mat, ['Head'] * 2, 10, arm)
    u.box('AdrianCrest', (0, 0, 1.042), (.014, .12, .025), mat, 'Head', arm)


def collar_badges(arm, mat='Emblem'):
    for sx in (-1, 1):
        u.box(f'CollarBadge{sx}', (sx * .045, -.06, .79), (.03, .012, .025), mat, 'Chest', arm)


def mountain_cap(arm, mat='Cloth', feather='Leather'):
    """The Austrian mountain cap (Bergmuetze): a soft peaked cap with a feather at the side."""
    u.tube('BergCap', [(0, 0, .945), (0, 0, .99), (0, -.005, 1.025)], [(.066, .062), (.068, .064), (.062, .058)], mat, ['Head'] * 3, 10, arm)
    u.box('BergPeak', (0, -.075, .955), (.09, .05, .012), mat, 'Head', arm)
    u.tube('Feather', [(.06, .02, 1.0), (.075, .06, 1.07), (.08, .1, 1.12)], [.012, .01, .003], feather, ['Head'] * 3, 4, arm)
    u.box('CapEdelweiss', (-.062, -.02, .99), (.012, .025, .025), 'Cloth', 'Head', arm)


def rope_coil(arm, mat='Cloth'):
    """A climbing rope coiled across the body from the left shoulder to the right hip."""
    for k in range(2):
        d = .02 * k
        u.tube(f'Rope{k}', [(.13, -.06 - d, .79), (0, -.1 - d, .66), (-.12, -.07 - d, .48), (-.13, .06, .5), (0, .1 + d, .66), (.13, .06 + d, .79)],
               [.014] * 6, mat, ['Chest', 'Spine', 'Hips', 'Hips', 'Spine', 'Chest'], 4, arm)


def ice_axe(arm):
    w = lib.hand(arm, 'L')
    u.tube('IceAxeShaft', [(w.x, w.y, w.z - .32), (w.x, w.y - .01, w.z + .22)], [.011, .01], 'Wood', ['Prop_L'] * 2, 4, arm, attachment=True)
    u.box('IceAxeHead', (w.x, w.y - .01, w.z + .24), (.016, .17, .025), 'Metal', 'Prop_L', arm, True)


def round_cap(arm, mat='Team'):
    """A round wool cap with a short peak (the Norwegian field cap)."""
    u.tube('RoundCap', [(0, 0, .945), (0, 0, .99), (0, 0, 1.02), (0, 0, 1.035)], [(.068, .064), (.07, .066), (.06, .056), (.03, .03)], mat, ['Head'] * 4, 10, arm)
    u.box('RoundCapPeak', (0, -.074, .953), (.085, .04, .012), mat, 'Head', arm)


def skis(arm, mat='Wood'):
    """A pair of long skis strapped upright on the back, the tips curled over the head, two poles."""
    for k, sx in enumerate((-.05, .05)):
        u.tube(f'Ski{k}', [(sx, .13, .12), (sx, .13, 1.18), (sx, .10, 1.26)], [(.03, .008), (.03, .008), (.025, .008)], mat, ['Chest'] * 3, 4, arm)
    u.tube('SkiPole', [(.12, .12, .2), (.08, .12, 1.15)], [.008, .007], 'Metal', ['Chest'] * 2, 4, arm)
    u.box('SkiStrap', (0, .135, .7), (.16, .02, .03), 'Leather', 'Chest', arm)


def shamma(arm, mat='Cloth', border='Team'):
    """The Ethiopian shamma: a white cotton cloak wrapped over the shoulders, with a wide coloured border."""
    lib.ring('Shamma', arm, [.36, .48, .60, .72, .79], [(.15, .11), (.14, .1), (.13, .094), (.15, .1), (.12, .08)], mat, ['Hips', 'Hips', 'Spine', 'Chest', 'Chest'], 10)
    lib.ring('ShammaBorder', arm, [.36, .42], [(.152, .112), (.148, .108)], border, ['Hips'] * 2, 10)
    md.sleeves(arm, mat)
    md.hide_skin(arm, legs=False)


def jodhpurs(arm, mat='Cloth'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Jodhpur_{side}', [(sign * .061, 0, .47), (sign * .068, -.003, .33), (sign * .072, 0, .2), (sign * .074, .004, .1)], [(.058, .055), (.052, .05), (.04, .039), (.032, .032)], mat,
               ['Leg_' + side, 'Leg_' + side, 'Shin_' + side, 'Shin_' + side], 6, arm)
    md.hide_skin(arm, arms=False)


def tall_felt_hat(arm, mat='Leather'):
    u.tube('TallHat', [(0, 0, .94), (0, 0, 1.0), (0, 0, 1.08), (0, 0, 1.11)], [(.068, .064), (.064, .06), (.058, .054), (.05, .046)], mat, ['Head'] * 4, 10, arm)
    u.tube('TallHatBrim', [(0, 0, .94), (0, 0, .95)], [(.09, .086), (.09, .086)], mat, ['Head'] * 2, 10, arm)


def anorak(arm, mat='Team', ruff='Cloth'):
    """A long hooded anorak with a fur ruff round the face and a kangaroo pocket."""
    lib.ring('AnorakSkirt', arm, [.36, .45, .537], [(.13, .095), (.12, .087), (.104, .072)], mat, ['Hips'] * 3, 8)
    lib.top(arm, mat, name='Anorak')
    md.sleeves(arm, mat)
    md.yoke(arm, mat)
    md.hide_skin(arm, legs=False)
    u.box('KangarooPocket', (0, -.09, .5), (.13, .02, .07), mat, 'Hips', arm)
    u.tube('Hood', [(0, .03, .86), (0, .015, .93), (0, .005, 1.0), (0, .01, 1.05)], [(.085, .085), (.088, .084), (.08, .076), (.05, .048)], mat, ['Head'] * 4, 10, arm)
    u.tube('FurRuff', [(0, -.045, .87), (0, -.06, .95), (0, -.05, 1.03)], [(.085, .03), (.09, .03), (.075, .028)], ruff, ['Head'] * 3, 8, arm)


def armband(arm, mat='Emblem'):
    sh = arm.data.bones['Arm_L'].head_local; el = arm.data.bones['Forearm_L'].head_local
    a = sh.lerp(el, .45); b = sh.lerp(el, .62)
    u.tube('Armband', [tuple(a), tuple(b)], [(.05, .047), (.049, .046)], mat, ['Arm_L'] * 2, 6, arm)


def snow_goggles(arm, mat='Leather'):
    u.box('SnowGoggles', (0, -.075, .93), (.11, .025, .028), mat, 'Head', arm)


def mukluks(arm, mat='Cloth'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Mukluk_{side}', [(sign * .073, -.004, .26), (sign * .074, -.005, .12), (sign * .074, -.006, .035)], [(.05, .048), (.046, .044), (.042, .042)], mat, ['Shin_' + side] * 3, 6, arm)
        u.box(f'MuklukFoot_{side}', (sign * .074, -.048, .027), (.084, .17, .054), mat, 'Foot_' + side, arm)


def C(skin, **k):
    return {'Skin': skin, **k}


FOOT = {
    'illyria': dict(name='Albanian Kachak riflemen', role='ranged', colors=C('C99472', Cloth='EAE4D6', Leather='2A2420', Metal=IRON, Wood='5A3E28'),
                    parts=[(lib.top, 'Cloth', {'name': 'Shirt'}), (md.sleeves, 'Cloth'), (md.yoke, 'Cloth'), xhamadan, tirq, md.combat_boots, bandolier, (lib.belt, 'Leather', .52), plis, (gp.rifle_ready,)],
                    look='white felt plis cap, a Team wool jacket with black braid, white braided trousers, bandolier, a rifle at the ready'),
    'dacia': dict(name='Romanian mountain troops (vanatori de munte)', role='infantry', colors=C('C99472', Cloth='6A6650', Leather='2A2622', Metal=IRON, Wood='5A3E28'),
                  parts=[wool_tunic, (md.cargo_trousers, 'Cloth', {'pads': None}), puttees, md.combat_boots, (lib.belt, 'Leather', .52), mountain_beret, (lib.pack, 'Cloth'), rifle],
                  look='the big black mountain beret with an edelweiss badge, a Team wool tunic, puttees, a rucksack, a rifle at the shoulder'),
    'nuragi': dict(name='Brigata Sassari infantry', role='infantry', colors=C('C99472', Cloth='6E7560', Leather='3A2E26', Metal=IRON, Wood='5A3E28', Emblem='E8E2D6'),
                   parts=[wool_tunic, (md.cargo_trousers, 'Cloth', {'pads': None}), (puttees, 'Cloth'), md.combat_boots, cartridge_belt, adrian_helmet, collar_badges, (lib.pack, 'Leather'), rifle_bayonet],
                   look='WWI grey-green, a Team tunic with red-and-white collar badges (the emblem colour), the Adrian steel helmet, puttees, a rifle with a fixed bayonet'),
    'noricum': dict(name='Kaiserschuetzen mountain riflemen', role='infantry', colors=C('D9AE88', Cloth='7A7C72', Leather='2E2620', Metal=STEEL, Wood='6A4A30'),
                    parts=[wool_tunic, (md.cargo_trousers, 'Cloth', {'pads': None}), puttees, md.combat_boots, (lib.belt, 'Leather', .52), mountain_cap, rope_coil, ice_axe, rifle],
                    look='the mountain cap with a black feather and an edelweiss, a Team wool tunic, a climbing rope coiled across the body, an ice axe, a rifle'),
    'rygir': dict(name='Norwegian ski infantry', role='infantry', colors=C('E0B898', Cloth='6A6650', Leather='2E2620', Metal=STEEL, Wood='B08A5A'),
                  parts=[wool_tunic, (md.cargo_trousers, 'Cloth', {'pads': None}), md.combat_boots, (lib.belt, 'Leather', .52), round_cap, skis, rifle],
                  look='a Team wool uniform and round field cap, long skis and a pole strapped on the back, a rifle'),
    'd-mt': dict(name='Ethiopian rifle infantry (Adwa, 1896)', role='infantry', colors=C('7A4E34', Cloth='F0EDE4', Leather='5E4030', Metal=IRON, Wood='5A3E28'),
                 covered='top', parts=[shamma, jodhpurs, cartridge_belt, bandolier, tall_felt_hat, rifle],
                 look='a white shamma with a wide Team border, white jodhpurs, bare feet, a cartridge belt and bandolier, a tall felt hat, a rifle'),
    'dorset': dict(name='Canadian Ranger riflemen', role='ranged', colors=C('B07A58', Cloth='E2DCD0', Leather='2A2420', Metal=IRON, Wood='6A4A30', Emblem='C8302A'),
                   parts=[anorak, (md.cargo_trousers, 'Leather', {'pads': None}), mukluks, armband, snow_goggles, (gp.rifle_ready,)],
                   look='a Team hooded anorak with a fur ruff, a red armband (the emblem colour), snow goggles, mukluks, a Lee-Enfield at the ready'),
}

KINDAH = dict(name='Arab Revolt camel riflemen', role='infantry', colors=C('A8724E', Cloth='E8E0CC', Leather='9A7650', Wood='5A3E28', Metal=IRON),
              look='a white headcloth held by a black cord, a Team robe and a light cloak, a bandolier, a Lee-Enfield held upright, on a dromedary with a Team saddle cloth')


def agal(arm, mat='Leather'):
    lib.ring('Agal', arm, [.985, 1.005], [(.07, .064), (.07, .064)], mat, ['Head'] * 2, 10)


def build_kindah():
    camel, _ = tm.camel('Camel', coat='Leather', dark='Wood')
    cs.pack_saddle(camel)
    dress = [(cs.tunic, 'Team', {'low': .36}), (cl.seated_cloak, 'Cloth'), (lib.headcloth, 'Cloth', {'tail': True}), agal, bandolier]
    r = cl.rider(dress, [rifle], at=cl.seat_offset('camel'), pose=cs.WIDE_SEAT)
    return [camel, r]


def build_merkava():
    parts, info = tm.tank('Tank', hull_len=1.62, hull_w=.80, deck_w=1.10, hull_z=(.12, .32), wheels=6, wheel_r=.095, turret_at=(0, .2), turret_z=.36,
                          turret_h=.17, turret_len=1.02, turret_w=.70, gun_len=1.08, gun_r=.032, wedge=.36, turret_top=.8, engine_front=True, glacis=.42)
    rig = info['rig']
    tz = .36; ty = .2 + .51
    for k in range(6):  # the slat armour cage at the turret's back (chains in life; bars here)
        x = -.3 + .12 * k
        u.box(f'Slat{k}', (x, ty + .16, tz + .1), (.012, .012, .2), 'Leather', 'Turret', rig)
    u.box('SlatRail', (0, ty + .16, tz + .2), (.66, .014, .014), 'Leather', 'Turret', rig)
    u.box('SlatRailLow', (0, ty + .16, tz + .02), (.66, .014, .014), 'Leather', 'Turret', rig)
    u.box('RearDoor', (0, .82, .26), (.22, .02, .14), 'Metal', 'Hull', rig)
    return parts


def build_ltvz38():
    parts, info = tm.tank('Tank', hull_len=1.18, hull_w=.62, deck_w=.80, track_w=.2, hull_z=(.14, .40), wheels=4, wheel_r=.14, turret_at=(0, -.02), turret_z=.45,
                          turret_h=.2, turret_len=.50, turret_w=.46, gun_len=.48, gun_r=.02, wedge=.12, turret_top=.9, skirts=False, rivets=True, glacis=.2,
                          basket=False, track_top=.32)
    rig = info['rig']
    for sx in (-1, 1):  # the return rollers above the big road wheels and the driver's visor
        for k in range(2):
            u.tube(f'Roller{sx}{k}', [(sx * .41 - .02, -.15 + .3 * k, .3), (sx * .41 + .02, -.15 + .3 * k, .3)], [.035, .035], 'Metal', [f'Track_{"L" if sx > 0 else "R"}'] * 2, 6, rig)
    u.box('Visor', (-.12, -.5, .47), (.16, .03, .06), 'Leather', 'Hull', rig)
    u.tube('HullMG', [(.12, -.52, .44), (.12, -.66, .44)], [.014, .012], 'Leather', ['Hull'] * 2, 5, rig)
    for k in range(6):
        u.box(f'TurretRivet{k}', (-.2 + .08 * k, -.27, .58), (.018, .012, .018), 'Metal', 'Turret', rig)
    return parts


TANKS = {
    'kingdom-of-israel': dict(name='Merkava main battle tank', build=build_merkava, colors=C('C99472', Cloth='9A8E6E', Leather='2C2A26', Metal=('5A5A54', .45, .6), Wood='4A4038'),
                              look='the Merkava: a low hull with the engine in front, a long wedge turret set far back, a long smoothbore gun, side skirts (Team stripe), slat armour at the turret\'s back, in sand grey'),
    'marcomannia': dict(name='LT vz. 38 light tank', build=build_ltvz38, colors=C('C99472', Cloth='5C6248', Leather='2A2A28', Metal=('4A4C48', .45, .6), Wood='4A4038'),
                        look='the LT vz. 38: a small riveted hull, four big road wheels with return rollers, a small turret with a 37 mm gun and a hull machine gun, a Team stripe along the deck and the turret'),
}


def build(model):
    lib.reset()
    if model in FOOT:
        spec = FOOT[model]
        arm = lib.person(spec)
        lib.finish(model, [arm], spec['colors'], {'name': spec['name'], 'role': spec['role'], 'look': spec['look'], 'rig': 'person'}, lib.PERSON_BUDGET, False)
        return
    if model == 'kindah':
        parts = build_kindah()
        bpy.context.view_layer.update()
        height = round(cs.measured_height() * cs.MOUNTED_SCALE, 3)
        lib.finish(model, parts, KINDAH['colors'], {'name': KINDAH['name'], 'role': 'infantry', 'rig': 'camel', 'look': KINDAH['look'], 'height': height}, 3000, True)
        path = u.out_dir(model) / f'{model}.json'
        opts = json.loads(path.read_text()); opts['height'] = height
        path.write_text(json.dumps(opts, indent=2) + '\n')
        return
    spec = TANKS[model]
    parts = spec['build']()
    height = md.true_height()
    lib.finish(model, parts, spec['colors'], {'name': spec['name'], 'role': 'cavalry', 'rig': 'tank', 'look': spec['look'], 'height': height}, 3000, False)
    path = u.out_dir(model) / f'{model}.json'
    opts = json.loads(path.read_text()); opts['height'] = height
    path.write_text(json.dumps(opts, indent=2) + '\n')


ALL = list(TANKS) + ['kindah'] + list(FOOT)
if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or ALL
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
