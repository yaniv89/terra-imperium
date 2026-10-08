# scripts/blender/build_units_modern.py
# The Modern base units and general of plans/ART-MODELS-PLAN.md 4.2 and 4.3 (Wave 6 in the user's
# numbering: the ages in order), on the shared person rig and body (ti_units.py), the part libraries of
# the earlier ages and the vehicle rigs of ti_mounts.py (tank: Hull, Track_L/R, Turret, Barrel; wheeled:
# Hull, Wheel_*, optional Turret and Barrel; jet: Hull). Faceted, flat colours: Team, Skin, Emblem,
# Metal, Wood, Leather, Cloth; readable at 30 px. Culture-neutral (plan 4.4).
#   modern-infantry  Rifle infantry: a helmet with a Team band, a Team plate carrier with pouches, an
#                    olive combat uniform with sleeves, knee pads, boots, an assault rifle at the ready
#   modern-ranged    ATGM team: the gunner kneeling behind a tripod missile launcher, the loader
#                    standing with a spare missile tube
#   modern-cavalry   Tank: a main battle tank (tracked rig), side skirts and turret stripe in Team
#   modern-siege     Artillery: a towed 155 mm howitzer in the firing position (split trails spread,
#                    muzzle brake, a shield), three crew with a shell and a rammer
#   modern-support   Anti-air battery: a three-axle truck with a twin anti-aircraft gun mount on the bed
#   modern-worker    Engineer: overalls, a hard hat, a tool bag, a sledgehammer
#   modern-general   General: an open command car with a radio mast and an Emblem pennant, a driver
#                    and an officer standing in a peaked cap
#   modern-air       Fighter jet: a generic twin-tail multirole fighter, gear up, Team fins, missiles
#   blender -b --factory-startup -P scripts/blender/build_units_modern.py -- [id ...]
# Writes art-build/units/modern/<id>/<id>.(blend|glb), <id>.json and report.json; rest pose only.
# Vehicles carry their true height (H, a person = 1) in the JSON, so they keep the people's scale.
import bpy, sys, os, math, json  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'modern')
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_gunpowder as gp  # noqa: E402

os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'modern')
OLIVE = '5F6444'
GUNMETAL = ('3E4144', .45, .6)
STEEL = ('8A8E90', .35, .7)
BLACK = '25262A'
KNEEL = {'r': {'Leg_L': (-85, 0, 0), 'Shin_L': (85, 0, 0), 'Leg_R': (-8, 0, 0), 'Shin_R': (98, 0, 0)}}


# ---- dress -----------------------------------------------------------------------------------------

def sleeves(arm, mat='Cloth', cuff=True):
    """Long sleeves over the arms, to the wrist (the earlier ages' tops leave the arms bare)."""
    for side in 'LR':
        sh = arm.data.bones['Arm_' + side].head_local; el = arm.data.bones['Forearm_' + side].head_local
        wr = arm.data.bones['Hand_' + side].head_local
        pts = [sh, sh.lerp(el, .5), el, el.lerp(wr, .55), wr.lerp(el, .12)]
        ws = ['Arm_' + side, 'Arm_' + side, {'Arm_' + side: .5, 'Forearm_' + side: .5}, 'Forearm_' + side, 'Forearm_' + side]
        u.tube(f'Sleeve_{side}', [tuple(p) for p in pts], [(.05, .046), (.046, .042), (.039, .038), (.037, .036), (.031, .031) if cuff else (.028, .028)], mat, ws, 6, arm)


def hide_skin(arm, legs=True, arms=True):
    """Drop the body's faces under long sleeves and trousers (fewer triangles, no skin poking through
    at the knees and shoulders). Run after dressing; the body mesh is the armature's master body."""
    body = next((o for o in bpy.data.objects if o.type == 'MESH' and o.parent == arm and o.get('master_body')), None)
    if body is None:
        return

    def inside(c):
        if legs and .1 < c.z < .45 and abs(c.x) < .13:
            return True
        return arms and abs(c.x) > .12 and .618 < c.z < .80
    u.drop_faces(body, inside)


def yoke(arm, mat='Cloth'):
    """The shoulders of a long-sleeved top, closing the gap between the body ring and the sleeves."""
    lib.ring('Yoke', arm, [.735, .775, .80], [(.142, .082), (.148, .078), (.09, .058)], mat, ['Chest'] * 3, 8)


def combat_shirt(arm, mat='Cloth'):
    lib.top(arm, mat, name='Shirt')
    sleeves(arm, mat)
    yoke(arm, mat)
    lib.ring('Collar', arm, [.77, .81], [(.075, .058), (.068, .054)], mat, ['Chest'] * 2, 8)
    hide_skin(arm, legs=False)


def cargo_trousers(arm, mat='Cloth', pads='Leather'):
    lib.trousers(arm, mat)
    hide_skin(arm, arms=False)
    lib.ring('Seat', arm, [.43, .50, .54], [(.112, .08), (.106, .076), (.096, .068)], mat, ['Hips'] * 3, 8)
    for side, sign in [('L', 1), ('R', -1)]:
        u.box(f'Pocket_{side}', (sign * .105, -.01, .33), (.03, .07, .08), mat, 'Leg_' + side, arm)
        if pads:
            u.box(f'KneePad_{side}', (sign * .072, -.045, .255), (.06, .03, .07), pads, 'Shin_' + side, arm)


def combat_boots(arm, mat='Leather'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Boot_{side}', [(sign * .073, -.004, .17), (sign * .074, -.005, .09), (sign * .074, -.006, .035)], [(.042, .04), (.04, .038), (.038, .038)], mat, ['Shin_' + side] * 3, 6, arm)
        u.box(f'BootSole_{side}', (sign * .074, -.048, .027), (.08, .165, .054), mat, 'Foot_' + side, arm)


def helmet(arm, mat='Cloth', band='Team', goggles=False):
    """A modern combat helmet: a low rounded shell with a flared rim, a cover band (Team)."""
    u.tube('Helmet', [(0, .004, .925), (0, .002, .945), (0, 0, .99), (0, 0, 1.03), (0, 0, 1.05)],
           [(.083, .088), (.08, .084), (.075, .078), (.058, .06), (.024, .024)], mat, ['Head'] * 5, 10, arm)
    if band:
        lib.ring('HelmetBand', arm, [.955, .978], [(.081, .084), (.079, .082)], band, ['Head'] * 2, 10)
    if goggles:
        u.box('Goggles', (0, -.07, 1.0), (.11, .03, .03), 'Leather', 'Head', arm)


def plate_carrier(arm, mat='Team', pouch='Cloth'):
    """A plate carrier over the shirt (front and back plates, shoulder straps) with magazine pouches."""
    lib.ring('Carrier', arm, [.53, .60, .68, .745], [(.112, .082), (.108, .08), (.124, .088), (.126, .084)], mat, ['Spine', 'Spine', 'Chest', 'Chest'], 8)
    for k, x in enumerate((-.06, 0, .06)):
        u.box(f'MagPouch{k}', (x, -.092, .585), (.05, .03, .07), pouch, 'Spine', arm)
    u.box('Radio', (.07, .1, .66), (.05, .04, .1), 'Leather', 'Chest', arm)
    u.box('Hydration', (0, .1, .6), (.11, .03, .14), pouch, 'Spine', arm)


def webbing_belt(arm, mat='Leather'):
    lib.belt(arm, mat, .52)
    for sx in (-1, 1):
        u.box(f'BeltPouch{sx}', (sx * .1, -.04, .5), (.04, .05, .06), 'Cloth', 'Hips', arm)


def assault_rifle(arm, mat='Leather'):
    """A carbine at the ready, low across the body: the stock at the right shoulder, the muzzle down
    and forward; a magazine and an optic."""
    w = lib.hand(arm); wl = lib.hand(arm, 'L')
    a = (w.x + .02, w.y + .1, w.z + .06); b = (wl.x + .02, wl.y - .2, wl.z - .02)
    u.tube('RifleBody', [a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2), b], [(.02, .03), (.018, .026), (.012, .014)], mat, ['Prop_R'] * 3, 5, arm, attachment=True)
    mx, my, mz = (a[0] * .55 + b[0] * .45, a[1] * .55 + b[1] * .45, a[2] * .55 + b[2] * .45 - .05)
    u.box('RifleMag', (mx, my, mz), (.018, .03, .07), mat, 'Prop_R', arm, True)
    u.box('RifleOptic', (mx, my + .02, mz + .085), (.016, .05, .025), 'Metal', 'Prop_R', arm, True)
    u.tube('RifleMuzzle', [b, (b[0] + (b[0] - a[0]) * .18, b[1] + (b[1] - a[1]) * .18, b[2] + (b[2] - a[2]) * .18)], [.007, .007], 'Metal', ['Prop_R'] * 2, 5, arm, attachment=True)


def hard_hat(arm, mat='Team'):
    u.tube('HardHat', [(0, 0, .935), (0, 0, .975), (0, 0, 1.02), (0, 0, 1.045)], [(.076, .07), (.074, .069), (.064, .06), (.03, .03)], mat, ['Head'] * 4, 10, arm)
    u.tube('HardHatBrim', [(0, -.008, .935), (0, -.008, .945)], [(.092, .098), (.09, .096)], mat, ['Head'] * 2, 10, arm)
    u.box('HardHatRidge', (0, 0, 1.035), (.02, .13, .02), mat, 'Head', arm)


def overalls(arm, mat='Cloth', vest='Team'):
    lib.top(arm, mat, name='Overall')
    sleeves(arm, mat)
    yoke(arm, mat)
    lib.trousers(arm, mat)
    hide_skin(arm)
    lib.ring('OverallSeat', arm, [.43, .50, .54], [(.112, .08), (.106, .076), (.096, .068)], mat, ['Hips'] * 3, 8)
    lib.ring('HiVis', arm, [.56, .64, .70, .75], [(.103, .074), (.1, .072), (.12, .082), (.124, .08)], vest, ['Spine', 'Spine', 'Chest', 'Chest'], 8)
    for k, z in enumerate((.6, .69)):
        lib.ring(f'HiVisStripe{k}', arm, [z - .008, z + .008], [(.106 if z < .65 else .122, .078)] * 2, 'Cloth', ['Spine' if z < .65 else 'Chest'] * 2, 8)


def tool_bag(arm):
    u.box('ToolBag', (-.12, -.01, .43), (.07, .14, .1), 'Leather', 'Hips', arm)
    u.box('ToolBagHandle', (-.12, -.01, .5), (.012, .1, .03), 'Leather', 'Hips', arm)
    for k in range(3):
        u.box(f'Tool{k}', (-.12, -.04 + k * .03, .5), (.012, .012, .06), 'Metal', 'Hips', arm)


def sledgehammer(arm):
    w = lib.hand(arm)
    u.tube('HammerShaft', [(w.x, w.y, w.z - .32), (w.x, w.y - .01, w.z + .32)], [.012, .011], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('HammerHead', (w.x, w.y - .01, w.z + .34), (.05, .13, .05), 'Metal', 'Prop_R', arm, True)


def peaked_cap(arm, mat='Cloth', band='Team'):
    u.tube('PeakedCap', [(0, 0, .945), (0, 0, .985), (0, -.01, 1.02), (0, -.01, 1.03)], [(.066, .062), (.068, .064), (.088, .082), (.06, .056)], mat, ['Head'] * 4, 10, arm)
    lib.ring('CapBand', arm, [.955, .98], [(.068, .064), (.069, .065)], band, ['Head'] * 2, 10)
    u.box('CapPeak', (0, -.075, .955), (.10, .05, .012), 'Leather', 'Head', arm)


def service_jacket(arm, mat='Cloth'):
    lib.ring('JacketSkirt', arm, [.40, .48, .537], [(.12, .085), (.112, .08), (.096, .068)], mat, ['Hips'] * 3, 8)
    lib.top(arm, mat, name='Jacket')
    sleeves(arm, mat)
    yoke(arm, mat)
    hide_skin(arm, legs=False)
    gp.epaulettes(arm, 'Team')
    u.box('Ribbons', (.05, -.083, .70), (.05, .01, .025), 'Team', 'Chest', arm)


def beret(arm, mat='Team'):
    u.tube('Beret', [(0, 0, .955), (.012, -.005, .99), (.03, -.01, 1.01)], [(.07, .066), (.076, .07), (.05, .046)], mat, ['Head'] * 3, 10, arm)


# ---- vehicles and guns -----------------------------------------------------------------------------

def howitzer(prefix='How'):
    """A towed 155 mm howitzer in the firing position facing -Y: two big wheels on the axle, the split
    trails spread back to their spades, the cradle and a long barrel with a muzzle brake (raised) on the
    Turret and Barrel bones, a small shield, a ready-round rack."""
    parts, info = tm.wheeled(prefix, axles=(.06,), track=.58, wheel_r=.2, wheel_w=.1, frame_z=.3, frame_len=.5, turret_at=(0, .06, .34))
    rig = info['rig']
    zt = .48
    for sx in (-1, 1):  # the split trails: spread at 25 degrees, spades at the ends
        a = math.radians(24) * sx
        ex, ey = math.sin(a) * 1.05, .1 + math.cos(a) * 1.05
        u.tube(f'{prefix}Trail{sx}', [(sx * .1, .12, .3), (ex * .55, ey * .55 + .05, .17), (ex, ey, .05)], [(.04, .05), (.035, .045), (.03, .035)], 'Cloth', ['Hull'] * 3, 6, rig)
        u.box(f'{prefix}Spade{sx}', (ex, ey + .03, .04), (.16, .03, .1), 'Metal', 'Hull', rig)
        u.box(f'{prefix}Shield{sx}', (sx * .2, -.12, .52), (.18, .025, .26), 'Cloth', 'Turret', rig)
    u.box(f'{prefix}Saddle', (0, .06, .42), (.24, .3, .16), 'Cloth', 'Turret', rig)
    el = math.radians(28)
    def at(d):
        return (0, .06 - d * math.cos(el), zt + d * math.sin(el))
    u.box(f'{prefix}Cradle', at(.1), (.14, .34, .1), 'Cloth', 'Barrel', rig)
    u.tube(f'{prefix}Barrel', [at(-.25), at(-.05), at(.4), at(1.05)], [.06, .055, .042, .036], 'Cloth', ['Barrel'] * 4, 8, rig)
    u.tube(f'{prefix}MuzzleBrake', [at(1.05), at(1.15)], [.055, .055], 'Metal', ['Barrel'] * 2, 8, rig)
    for sx in (-1, 1):
        u.tube(f'{prefix}Recuperator{sx}', [(sx * .045, at(-.1)[1], at(-.1)[2] + .06), (sx * .045, at(.35)[1], at(.35)[2] + .06)], [.022, .022], 'Metal', ['Barrel'] * 2, 6, rig)
    for k in range(3):  # ready rounds on the ground by the left trail
        u.tube(f'{prefix}Shell{k}', [(.45 + k * .06, .55, .03), (.45 + k * .06, .55, .30)], [.03, .03], 'Emblem' if k == 0 else 'Metal', ['Hull'] * 2, 6, rig)
    crew = [(-.5, .15, 0, 90), (.48, .05, 0, -90), (-.1, 1.05, 0, 180)]
    return parts, {**info, 'crew': crew}


def crewman(prefix, at, yaw, tool=None):
    """A gunner in a helmet, olive shirt with sleeves, a Team vest, trousers and boots (lite body)."""
    c, _ = u.crew(prefix, at, lite=True, head=None, yaw=yaw)
    helmet(c)
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'{prefix}Trouser_{side}', [(sign * .061, 0, .40), (sign * .068, -.002, .24), (sign * .073, 0, .06)], [(.056, .052), (.046, .044), (.038, .038)], 'Cloth', ['Leg_' + side, 'Leg_' + side, 'Shin_' + side], 5, c)
    lib.ring(f'{prefix}Vest', c, [.40, .53, .62, .70, .75], [(.13, .095), (.105, .075), (.11, .078), (.128, .084), (.124, .08)], 'Team', ['Hips', 'Spine', 'Spine', 'Chest', 'Chest'], 6)
    sleeves(c, 'Cloth')
    w = lib.hand(c)
    if tool == 'shell':
        u.tube(f'{prefix}Shell', [(w.x - .1, w.y - .02, w.z), (w.x + .1, w.y - .02, w.z + .05)], [.035, .03], 'Metal', ['Prop_R'] * 2, 6, c, attachment=True)
    elif tool == 'rammer':
        u.tube(f'{prefix}Ram', [(w.x, w.y, .06), (w.x, w.y - .01, w.z + .55)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, c, attachment=True)
        u.tube(f'{prefix}RamHead', [(w.x, w.y - .01, w.z + .55), (w.x, w.y - .01, w.z + .6)], [.034, .034], 'Leather', ['Prop_R'] * 2, 6, c, attachment=True)
    elif tool == 'binoculars':
        u.box(f'{prefix}Binoculars', (w.x + .05, w.y - .02, w.z + .02), (.08, .05, .04), 'Leather', 'Prop_R', c, True)
    return c


def truck_cab(prefix, rig, y0, y1, w, z0, h, body='Cloth', glass='Leather', team='Team'):
    """A truck cab from y0 (front) to y1: bonnet, cab box with windows, a roof, Team doors."""
    tm.side_profile(f'{prefix}Bonnet', [(y0, z0), (y0 + .3, z0), (y0 + .3, z0 + h * .55), (y0 + .02, z0 + h * .5)], -w / 2 + .04, w / 2 - .04, body, 'Hull', rig)
    tm.side_profile(f'{prefix}Cab', [(y0 + .3, z0), (y1, z0), (y1, z0 + h), (y0 + .4, z0 + h), (y0 + .3, z0 + h * .58)], -w / 2, w / 2, body, 'Hull', rig)
    u.box(f'{prefix}Windscreen', (0, y0 + .345, z0 + h * .8), (w - .06, .01, h * .3), glass, 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Door{sx}', (sx * (w / 2 + .004), (y0 + .3 + y1) / 2 + .02, z0 + h * .42), (.008, (y1 - y0 - .3) * .8, h * .5), team, 'Hull', rig)
        u.box(f'{prefix}SideWindow{sx}', (sx * (w / 2 + .004), (y0 + .3 + y1) / 2 + .02, z0 + h * .8), (.008, (y1 - y0 - .3) * .7, h * .22), glass, 'Hull', rig)
        u.box(f'{prefix}Mirror{sx}', (sx * (w / 2 + .05), y0 + .36, z0 + h * .75), (.02, .02, .06), glass, 'Hull', rig)
        u.box(f'{prefix}Headlight{sx}', (sx * (w / 2 - .1), y0 - .005, z0 + h * .32), (.07, .012, .05), 'Metal', 'Hull', rig)
    u.box(f'{prefix}Bumper', (0, y0 - .02, z0 + .02), (w + .04, .04, .06), glass, 'Hull', rig)


def aa_truck(prefix='AA'):
    """A three-axle truck with a twin anti-aircraft gun mount on its bed (Turret and Barrel bones),
    the guns raised; a gunner seated in the mount."""
    parts, info = tm.wheeled(prefix, axles=(-.52, .22, .5), track=.66, wheel_r=.15, wheel_w=.09, frame_z=.3, frame_len=1.45, turret_at=(0, .32, .48))
    rig = info['rig']
    W = .78
    truck_cab(prefix, rig, -.78, -.18, W, .3, .5)
    u.box(f'{prefix}Bed', (0, .33, .37), (W, .98, .06), 'Cloth', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}BedSide{sx}', (sx * (W / 2 - .01), .33, .45), (.02, .98, .1), 'Cloth', 'Hull', rig)
        u.box(f'{prefix}Stabiliser{sx}', (sx * (W / 2 + .1), .62, .22), (.2, .05, .04), 'Metal', 'Hull', rig)
        u.box(f'{prefix}StabFoot{sx}', (sx * (W / 2 + .18), .62, .06), (.06, .08, .14), 'Metal', 'Hull', rig)
        u.box(f'{prefix}Mudguard{sx}', (sx * .33, .36, .33), (.12, .5, .02), 'Leather', 'Hull', rig)
    u.box(f'{prefix}BedTail', (0, .82, .45), (W, .02, .1), 'Team', 'Hull', rig)
    u.tube(f'{prefix}Ring', [(0, .32, .40), (0, .32, .50)], [.22, .2], 'Cloth', ['Turret'] * 2, 10, rig)
    u.box(f'{prefix}Mount', (0, .32, .62), (.34, .3, .22), 'Cloth', 'Turret', rig)
    u.box(f'{prefix}Radar', (0, .45, .82), (.22, .03, .14), 'Metal', 'Turret', rig)
    u.tube(f'{prefix}RadarPost', [(0, .43, .72), (0, .43, .78)], [.02, .02], 'Metal', ['Turret'] * 2, 5, rig)
    el = math.radians(38)
    for sx in (-1, 1):
        base = (sx * .13, .26, .66)
        def at(d):
            return (base[0], base[1] - d * math.cos(el), base[2] + d * math.sin(el))
        u.box(f'{prefix}Cradle{sx}', at(.08), (.08, .3, .1), 'Cloth', 'Barrel', rig)
        u.tube(f'{prefix}Gun{sx}', [at(-.06), at(.25), at(.78)], [.03, .022, .018], 'Leather', ['Barrel'] * 3, 6, rig)
        u.tube(f'{prefix}Flash{sx}', [at(.78), at(.84)], [.026, .026], 'Leather', ['Barrel'] * 2, 6, rig)
        u.box(f'{prefix}AmmoBox{sx}', (sx * .2, .36, .6), (.06, .2, .14), 'Metal', 'Barrel', rig)
    return parts, info


def command_car(prefix='Car'):
    """An open command car facing -Y: a low body on four wheels, a fold-down windscreen, spare wheel,
    jerrycans, a radio set and a tall whip mast with an Emblem pennant."""
    parts, info = tm.wheeled(prefix, axles=(-.36, .34), track=.6, wheel_r=.14, wheel_w=.09, frame_z=.24, frame_len=1.0)
    rig = info['rig']
    W = .7
    tm.side_profile(f'{prefix}Body', [(-.58, .26), (.6, .26), (.6, .46), (-.18, .46), (-.3, .44), (-.58, .42)], -W / 2, W / 2, 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Grille', (0, -.585, .36), (.36, .012, .14), 'Leather', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Wing{sx}', (sx * (W / 2 + .03), -.36, .38), (.08, .34, .02), 'Cloth', 'Hull', rig)
        u.box(f'{prefix}Wing2{sx}', (sx * (W / 2 + .03), .34, .38), (.08, .32, .02), 'Cloth', 'Hull', rig)
        u.box(f'{prefix}Light{sx}', (sx * .22, -.588, .42), (.06, .012, .05), 'Metal', 'Hull', rig)
        u.box(f'{prefix}DoorStar{sx}', (sx * (W / 2 + .003), .08, .37), (.006, .14, .1), 'Team', 'Hull', rig)
    u.box(f'{prefix}Windscreen', (0, -.18, .58), (W - .04, .02, .22), 'Metal', 'Hull', rig)
    u.box(f'{prefix}Glass', (0, -.19, .59), (W - .1, .01, .16), 'Leather', 'Hull', rig)
    u.box(f'{prefix}SeatFront', (0, -.02, .5), (W - .08, .16, .08), 'Leather', 'Hull', rig)
    u.box(f'{prefix}SeatBack', (0, .06, .58), (W - .08, .04, .16), 'Leather', 'Hull', rig)
    u.tube(f'{prefix}Spare', [(0, .6, .40), (0, .66, .40)], [.13, .13], 'Leather', ['Hull'] * 2, 10, rig)
    u.box(f'{prefix}Jerrycan', (.24, .5, .52), (.1, .12, .14), 'Cloth', 'Hull', rig)
    u.box(f'{prefix}Radio', (-.2, .42, .55), (.2, .16, .16), 'Metal', 'Hull', rig)
    u.tube(f'{prefix}Mast', [(-.28, .48, .6), (-.28, .5, 1.75)], [.012, .005], 'Leather', ['Hull'] * 2, 4, rig)
    v = [(-.28, .5, 1.70), (-.28, .5, 1.52), (-.28, .8, 1.62)]
    p = u.mesh_obj(f'{prefix}Pennant', v, [(0, 1, 2), (0, 2, 1)], 'Emblem', 'Hull', arm=rig)
    uv = p.data.uv_layers.active
    for poly in p.data.polygons:
        for li in poly.loop_indices:
            co = p.data.vertices[p.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.y - .5) / .3, (co.z - 1.52) / .18)
    return parts, {**info, 'floor': .46, 'driver': (.16, -.06), 'officer': (-.12, .26)}


# ---- the units ---------------------------------------------------------------------------------------

PERSON_OPTS = dict(budget=1500, mounted=False)
INF_COLORS = {'Skin': 'C99472', 'Cloth': OLIVE, 'Leather': BLACK, 'Metal': GUNMETAL, 'Wood': '4A4038'}


def m_infantry():
    arm = cl.person([combat_shirt, cargo_trousers, combat_boots, webbing_belt, plate_carrier, helmet, assault_rifle], covered='top')
    return [arm], INF_COLORS, \
        'Rifle infantry: a helmet with a Team band, a Team plate carrier with magazine pouches, an olive combat uniform with sleeves, knee pads, boots, an assault rifle at the ready', PERSON_OPTS


def atgm_launcher(prefix, at):
    """A tripod guided-missile launcher facing -Y: three splayed legs, the traverse head, the sight
    and thermal box, the launch tube (Team band)."""
    x, y, z = at
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (x, y, z), (x, y, z + .1), None)])
    for k, (dx, dy) in enumerate([(0, -.18), (.15, .12), (-.15, .12)]):
        u.tube(f'{prefix}Leg{k}', [(x, y, z - .02), (x + dx, y + dy, .01)], [.012, .01], 'Leather', ['Hull'] * 2, 4, rig)
    u.tube(f'{prefix}Head', [(x, y, z - .04), (x, y, z + .03)], [.04, .04], 'Metal', ['Hull'] * 2, 6, rig)
    u.tube(f'{prefix}Tube', [(x, y + .26, z + .09), (x, y - .1, z + .085), (x, y - .42, z + .08)], [.042, .04, .042], 'Cloth', ['Hull'] * 3, 8, rig)
    u.tube(f'{prefix}Band', [(x, y - .3, z + .08), (x, y - .25, z + .08)], [.046, .046], 'Team', ['Hull'] * 2, 8, rig)
    u.box(f'{prefix}Sight', (x - .075, y + .02, z + .08), (.07, .16, .1), 'Metal', 'Hull', rig)
    u.box(f'{prefix}Eyepiece', (x - .075, y + .12, z + .1), (.03, .05, .03), 'Leather', 'Hull', rig)
    return rig


def m_ranged():
    launcher = atgm_launcher('Atgm', (0, -.22, .42))
    gunner = cl.rider([combat_shirt, (cargo_trousers, 'Cloth', {'pads': 'Leather'}), combat_boots, plate_carrier, helmet], [], at=(.04, .08, -.21), name='Gunner', pose=KNEEL)
    loader = cl.person([combat_shirt, cargo_trousers, combat_boots, webbing_belt, plate_carrier, helmet], name='Loader')
    w = lib.hand(loader); wl = lib.hand(loader, 'L')
    u.tube('SpareTube', [(wl.x + .02, wl.y - .02, wl.z - .02), (w.x - .02, w.y + .1, w.z + .3)], [.04, .04], 'Cloth', ['Prop_R'] * 2, 8, loader, attachment=True)
    u.tube('SpareCap', [(w.x - .02, w.y + .1, w.z + .3), (w.x - .02, w.y + .11, w.z + .33)], [.044, .044], 'Leather', ['Prop_R'] * 2, 8, loader, attachment=True)
    loader.location = (.42, .32, 0); loader.rotation_euler = (0, 0, math.radians(-25))
    return [launcher, gunner, loader], INF_COLORS, \
        'ATGM team: the gunner kneeling behind a tripod guided-missile launcher with its sight, the loader standing with a spare missile tube; helmets, Team plate carriers, olive uniforms', dict(budget=3000, mounted=False)


def m_cavalry():
    parts, info = tm.tank('Tank')
    return parts, {'Skin': 'C99472', 'Cloth': OLIVE, 'Leather': '2A2A28', 'Metal': GUNMETAL, 'Wood': '4A4038'}, \
        'Tank: a main battle tank on the tracked rig: tracks with six road wheels, side skirts with a Team stripe, a low angular turret with a Team band, a long gun with a fume extractor, the commander\'s cupola and open hatch, the loader\'s machine gun, a stowage basket', dict(budget=3000, mounted=False, vehicle=True)


def m_siege():
    parts, info = howitzer()
    for i, ((x, y, z, yaw), tool) in enumerate(zip(info['crew'], ('shell', 'binoculars', 'rammer'))):
        parts.append(crewman(f'Crew{i}', (x, y, z), yaw, tool))
    return parts, {'Skin': 'C99472', 'Cloth': OLIVE, 'Leather': '2A2A28', 'Metal': GUNMETAL, 'Wood': '6E5236', 'Emblem': 'C8A040'}, \
        'Artillery: a towed 155 mm howitzer in the firing position (split trails spread to their spades, a long barrel raised with a muzzle brake, a small shield, ready rounds), three crew in helmets and Team vests with a shell, binoculars and a rammer', dict(budget=3200, mounted=False, vehicle=True)


def m_support():
    parts, info = aa_truck()
    gunner = crewman('Gunner', (0, .52, .28), 180)
    parts.append(gunner)
    return parts, {'Skin': 'C99472', 'Cloth': OLIVE, 'Leather': '2A2A28', 'Metal': GUNMETAL, 'Wood': '4A4038'}, \
        'Anti-air battery: a three-axle truck (Team doors and tailboard) with a twin 35 mm anti-aircraft gun mount on its bed, the guns raised, a radar panel, stabiliser legs out, a gunner at the mount', dict(budget=3000, mounted=False, vehicle=True)


def m_worker():
    arm = cl.person([overalls, combat_boots, (lib.belt, 'Leather', .52), hard_hat, tool_bag, sledgehammer], covered='top')
    return [arm], {'Skin': 'C99472', 'Cloth': '4E5A66', 'Leather': '2E2620', 'Metal': STEEL, 'Wood': '8A6A44'}, \
        'Engineer: blue-grey overalls under a Team high-visibility vest with light stripes, a Team hard hat, a tool bag, a sledgehammer, boots', PERSON_OPTS


def m_general():
    parts, info = command_car()
    fz = info['floor'] - .12
    dx, dy = info['driver']
    driver = cl.rider([combat_shirt, (cargo_trousers, 'Cloth', {'pads': None}), combat_boots, (beret, 'Leather')], [], at=(dx, dy, fz - .14), name='Driver')
    ox_, oy = info['officer']
    officer = cl.person([service_jacket, (cargo_trousers, 'Cloth', {'pads': None}), combat_boots, (lib.belt, 'Leather', .52), peaked_cap], name='Commander')
    w = lib.hand(officer)
    u.box('MapCase', (w.x, w.y - .02, w.z), (.03, .14, .1), 'Leather', 'Prop_R', officer, True)
    officer.location = (ox_, oy, fz)
    return [*parts, driver, officer], {'Skin': 'C99472', 'Cloth': OLIVE, 'Leather': '2A2A28', 'Metal': GUNMETAL, 'Wood': '4A4038'}, \
        'Modern general: an open command car (Team door marks) with a radio set and a tall whip mast flying the squad emblem colour, a driver in a beret and the general standing in a peaked cap and service jacket with Team epaulettes', dict(budget=2950, mounted=False, vehicle=True)


def m_air():
    parts, info = tm.jet('Jet')
    return parts, {'Skin': 'C99472', 'Cloth': '8C939A', 'Leather': '2C3036', 'Metal': ('B8BCC0', .35, .7), 'Wood': '4A4038'}, \
        'Fighter jet: a generic twin-tail multirole fighter, gear up: a pointed radome, a tinted bubble canopy, side intakes, swept wings with emblem roundels and a missile under each, twin canted fins in Team colour, two nozzles', dict(budget=3000, mounted=False, vehicle=True, json={'segment': False})


BUILDERS = {'modern-infantry': m_infantry, 'modern-ranged': m_ranged, 'modern-cavalry': m_cavalry, 'modern-siege': m_siege,
            'modern-support': m_support, 'modern-worker': m_worker, 'modern-general': m_general, 'modern-air': m_air}


def true_height():
    """The model's height in H (a person = 1): the highest vertex of every mesh."""
    bpy.context.view_layer.update()
    deps = bpy.context.evaluated_depsgraph_get()
    top = 0.0
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(deps); me = ev.to_mesh()
        top = max([top] + [(o.matrix_world @ v.co).z for v in me.vertices])
        ev.to_mesh_clear()
    return round(top, 3)


def finish(uid, parts, colors, notes, opts):
    """lib.finish, then a vehicle's JSON gets its true height (so its crew keeps the people's scale)."""
    h = round(true_height() * opts.get('scale', 1), 3) if opts.get('vehicle') else None
    lib.finish(uid, parts, colors, notes, opts['budget'], opts['mounted'])
    if h:
        out = u.out_dir(uid) / f'{uid}.json'
        o = json.loads(out.read_text())
        o['height'] = h
        o.update(opts.get('json', {}))
        out.write_text(json.dumps(o, indent=2) + '\n')


def build(uid):
    lib.reset()
    parts, colors, look, opts = BUILDERS[uid]()
    finish(uid, parts, colors, {'role': uid.split('-')[1], 'look': look}, opts)


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
