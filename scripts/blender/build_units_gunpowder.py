# scripts/blender/build_units_gunpowder.py
# The Gunpowder base units and general of plans/ART-MODELS-PLAN.md 4.2 and 4.3 (the age of pike and
# shot to the Napoleonic line, Wave 5 in the production order), on the shared person rig and body
# (ti_units.py), the horse (ti_mounts.py) and the part libraries of build_units_bronze_signature.py,
# build_units_classical.py and build_units_kingdoms.py, in the base units' look (faceted, flat colours:
# Team, Skin, Emblem, Metal, Wood, Leather, Cloth; readable at 30 px). Culture-neutral (plan 4.4).
#   gunpowder-infantry  Line infantry (musketeers): a long Team coat with turnbacks, white cross belts,
#                       a tricorne, gaiters, a musket with a fixed bayonet at the shoulder
#   gunpowder-ranged    Riflemen: a short Team jacket, a round hat with a turned-up brim, a rifle at
#                       the ready, a powder horn and a cartridge pouch
#   gunpowder-cavalry   Dragoons: a brass helmet with a horsehair crest, a Team coat, high boots, a
#                       sabre drawn, a carbine slung, a horse with a Team saddle cloth and holsters
#   gunpowder-siege     Field cannon: a bronze gun on a two-wheeled carriage with a trail, a rammer
#                       and a ball pile, three crew in Team coats and caps (no limber: one footprint)
#   gunpowder-support   Sappers: a gabion on the back, a shovel, a fuse coil, a leather apron, a cap
#   gunpowder-worker    Laborer: a shirt and Team waistcoat, a broad hat, a shovel, a wheelbarrow
#   gunpowder-general   a mounted officer in a bicorne with a plume, a Team coat with epaulettes and a
#                       sash, sabre drawn; a colour bearer on foot with the squad's Emblem colour
#   blender -b --factory-startup -P scripts/blender/build_units_gunpowder.py -- [id ...]
# Writes art-build/units/gunpowder/<id>/<id>.(blend|glb), <id>.json and report.json; rest pose only.
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'gunpowder')
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_kingdoms as kb  # noqa: E402

os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'gunpowder')
IRON = ('4A4A4E', .45, .7)
STEEL = ('A3A6A8', .35, .8)
BRASS = ('B8913E', .5, .8)


# ---- dress -------------------------------------------------------------------------------------------

def long_coat(arm, mat='Team', low=.26, turnbacks='Cloth'):
    """A long-skirted coat: the skirts to the knee, open at the front and turned back (Cloth flaps)."""
    lib.ring('CoatSkirt', arm, [low, .38, .48, .537], [(.142, .105), (.132, .095), (.108, .078), (.092, .064)], mat, ['Hips'] * 4, 10)
    lib.top(arm, mat, name='Coat')
    for sx in (-1, 1):  # the turnbacks: two light flaps at the back of the skirt
        u.box(f'Turnback{sx}', (sx * .05, .085, .36), (.06, .02, .16), turnbacks, 'Hips', arm)
    lib.ring('CoatCollar', arm, [.77, .80], [(.08, .06), (.07, .055)], mat, ['Chest'] * 2, 8)


def short_jacket(arm, mat='Team'):
    lib.ring('JacketTail', arm, [.44, .50, .537], [(.112, .08), (.104, .075), (.092, .064)], mat, ['Hips'] * 3, 8)
    lib.top(arm, mat, name='Jacket')
    for k, z in enumerate((.56, .62, .68, .73)):  # the buttons down the front
        u.box(f'Button{k}', (0, -.08 if z < .65 else -.088, z), (.014, .01, .014), 'Metal', 'Spine' if z < .62 else 'Chest', arm)


def cross_belts(arm, mat='Cloth'):
    u.tube('BeltA', [(.11, -.078, .77), (0, -.09, .64), (-.10, -.08, .48)], [(.016, .006)] * 3, mat, ['Chest', 'Spine', 'Hips'], 4, arm)
    u.tube('BeltB', [(-.11, -.078, .77), (0, -.092, .64), (.10, -.08, .48)], [(.016, .006)] * 3, mat, ['Chest', 'Spine', 'Hips'], 4, arm)
    u.box('BeltPlate', (0, -.095, .64), (.03, .01, .03), 'Metal', 'Spine', arm)
    u.box('CartridgeBox', (-.10, .07, .47), (.10, .05, .07), 'Leather', 'Hips', arm)


def breeches_gaiters(arm, gaiter='Cloth', breeches='Cloth'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Breech_{side}', [(sign * .061, 0, .47), (sign * .066, -.003, .34), (sign * .068, -.002, .26)], [(.058, .055), (.047, .045), (.044, .042)], breeches, ['Hips', 'Leg_' + side, 'Leg_' + side], 6, arm)
        u.tube(f'Gaiter_{side}', [(sign * .072, -.004, .25), (sign * .073, -.004, .16), (sign * .074, -.006, .04)], [(.042, .04), (.04, .038), (.036, .036)], gaiter, ['Shin_' + side] * 3, 6, arm)
        u.box(f'Shoe_{side}', (sign * .074, -.04, .015), (.07, .14, .03), 'Leather', 'Foot_' + side, arm)


def boots(arm, mat='Leather'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Boot_{side}', [(sign * .072, -.004, .30), (sign * .073, -.004, .16), (sign * .074, -.006, .04)], [(.05, .048), (.042, .04), (.038, .038)], mat, ['Shin_' + side] * 3, 6, arm)
        u.box(f'BootFoot_{side}', (sign * .074, -.042, .016), (.072, .15, .032), mat, 'Foot_' + side, arm)


def tricorne(arm, mat='Leather'):
    """A cocked hat: a low crown and a brim turned up into three points (front and the two back sides)."""
    u.tube('HatCrown', [(0, 0, .95), (0, 0, 1.0), (0, 0, 1.03)], [(.068, .064), (.064, .06), (.05, .046)], mat, ['Head'] * 3, 8, arm)
    pts = [(0, -.115), (.11, .06), (-.11, .06)]
    for k in range(3):  # three brim walls between the points, raised
        (x0, y0), (x1, y1) = pts[k], pts[(k + 1) % 3]
        v = [(x0, y0, .955), (x1, y1, .955), (x1 * .85, y1 * .85, 1.015), (x0 * .85, y0 * .85, 1.015)]
        u.mesh_obj(f'HatBrim{k}', v, [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], mat, 'Head', arm=arm)
    u.box('Cockade', (.045, -.07, .99), (.025, .012, .025), 'Cloth', 'Head', arm)


def round_hat(arm, mat='Leather'):
    u.tube('RoundHat', [(0, 0, .95), (0, 0, 1.02), (0, 0, 1.055)], [(.066, .062), (.062, .058), (.056, .052)], mat, ['Head'] * 3, 8, arm)
    u.tube('RoundBrim', [(0, 0, .948), (0, 0, .958)], [(.105, .1), (.105, .1)], mat, ['Head'] * 2, 10, arm)
    u.box('BrimTurn', (.08, 0, .99), (.012, .12, .07), mat, 'Head', arm)  # one side turned up
    u.box('HatPlume', (.082, -.01, 1.05), (.012, .02, .06), 'Cloth', 'Head', arm)


def dragoon_helmet(arm, mat='Metal'):
    u.tube('DragoonHelm', [(0, .004, .93), (0, .004, .975), (0, .008, 1.02), (0, .01, 1.04)], [(.072, .068), (.07, .066), (.05, .048), (.03, .03)], mat, ['Head'] * 4, 8, arm)
    u.box('HelmPeak', (0, -.08, .935), (.10, .04, .012), 'Leather', 'Head', arm)
    u.tube('HorseTail', [(0, -.02, 1.045), (0, .06, 1.05), (0, .12, .95), (0, .13, .82)], [(.012, .02), (.014, .028), (.012, .022), (.006, .012)], 'Wood', ['Head'] * 4, 4, arm)


def bicorne(arm, mat='Leather'):
    """A bicorne worn athwart, a Team cockade and a white plume."""
    v = [(-.15, 0, .97), (.15, 0, .97), (.06, 0, 1.08), (-.06, 0, 1.08), (0, -.04, 1.04), (0, .04, 1.04)]
    f = [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (1, 0, 5), (2, 1, 5), (3, 2, 5), (0, 3, 5)]
    u.mesh_obj('Bicorne', v, f, mat, 'Head', arm=arm)
    u.tube('BicorneBand', [(0, 0, .94), (0, 0, .975)], [(.066, .062), (.066, .062)], mat, ['Head'] * 2, 8, arm)
    u.box('BicorneCockade', (.07, -.03, 1.0), (.03, .012, .03), 'Team', 'Head', arm)
    u.tube('Plume', [(.07, -.02, 1.02), (.06, -.01, 1.1), (.04, 0, 1.15)], [.02, .022, .004], 'Cloth', ['Head'] * 3, 5, arm)


def forage_cap(arm, mat='Team'):
    u.tube('ForageCap', [(0, -.003, .945), (0, 0, .985), (0, 0, 1.01)], [(.067, .06), (.068, .062), (.05, .046)], mat, ['Head'] * 3, 8, arm)


def epaulettes(arm, mat='Metal'):
    for sx in (-1, 1):
        u.box(f'Epaulette{sx}', (sx * .11, 0, .785), (.07, .07, .025), mat, 'Chest', arm)


def waistcoat(arm, mat='Team'):
    lib.ring('Waistcoat', arm, [.50, .60, .70, .76], [(.10, .072), (.092, .067), (.116, .08), (.122, .076)], mat, ['Spine', 'Spine', 'Chest', 'Chest'], 8)


def officer_sash(arm, mat='Cloth'):
    u.tube('Sash', [(0, 0, .49), (0, 0, .53)], [(.104, .076), (.102, .074)], mat, ['Spine'] * 2, 8, arm)
    u.box('SashKnot', (-.09, -.05, .47), (.03, .02, .07), mat, 'Hips', arm)


# ---- weapons and gear ----------------------------------------------------------------------------

def musket(arm, bayonet=True, length=.78):
    """A musket at the shoulder, upright in the right hand: a wooden stock, the iron barrel above it,
    the lock, and a socket bayonet."""
    w = lib.hand(arm)
    x, y = w.x, w.y
    u.tube('MusketStock', [(x, y + .015, w.z - .22), (x, y + .008, w.z - .05), (x, y, w.z + length * .55)], [(.016, .03), (.014, .02), (.011, .012)], 'Wood', ['Prop_R'] * 3, 5, arm, attachment=True)
    u.tube('MusketBarrel', [(x, y - .006, w.z + .02), (x, y - .006, w.z + length * .62)], [.007, .007], 'Metal', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('MusketLock', (x - .012, y, w.z - .02), (.008, .04, .03), 'Metal', 'Prop_R', arm, True)
    if bayonet:
        u.tube('Bayonet', [(x, y - .012, w.z + length * .6), (x, y - .014, w.z + length * .6 + .22)], [.005, .001], 'Metal', ['Prop_R'] * 2, 4, arm, attachment=True)


def rifle_ready(arm, length=.62):
    """A rifle held across the body at the ready: the butt at the right hip, the muzzle up and left."""
    w = lib.hand(arm)
    a = (w.x + .02, w.y + .02, w.z - .12); b = (w.x - .28, w.y - .14, w.z + .42)
    u.tube('RifleStock', [a, ((a[0] * .7 + b[0] * .3), (a[1] * .7 + b[1] * .3), (a[2] * .7 + b[2] * .3)), b], [(.017, .03), (.013, .016), (.011, .011)], 'Wood', ['Prop_R'] * 3, 5, arm, attachment=True)
    u.tube('RifleBarrel', [((a[0] * .6 + b[0] * .4), (a[1] * .6 + b[1] * .4) - .008, (a[2] * .6 + b[2] * .4) + .008), (b[0] - .02, b[1] - .018, b[2] + .04)], [.007, .007], 'Metal', ['Prop_R'] * 2, 5, arm, attachment=True)


def powder_horn(arm):
    u.tube('PowderHorn', [(.11, .03, .50), (.13, -.02, .46), (.12, -.07, .43)], [.024, .02, .006], 'Cloth', ['Hips'] * 3, 6, arm)
    u.tube('HornCord', [(-.11, -.07, .77), (0, -.09, .62), (.11, -.02, .5)], [(.008, .004)] * 3, 'Leather', ['Chest', 'Spine', 'Hips'], 4, arm)


def carbine_slung(arm):
    u.tube('Carbine', [(.12, .10, .40), (-.10, .12, .80)], [.012, .009], 'Wood', ['Hips', 'Chest'], 4, arm)
    u.tube('CarbineBarrel', [(-.02, .11, .64), (-.12, .125, .84)], [.006, .006], 'Metal', ['Chest'] * 2, 4, arm)


def sabre(arm, length=.42):
    """A curved sabre in the right hand, point up and forward, a stirrup hilt."""
    w = lib.hand(arm)
    u.tube('SabreGrip', [(w.x, w.y - .01, w.z - .05), (w.x, w.y - .01, w.z + .04)], [.012, .012], 'Leather', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('SabreGuard', (w.x + .02, w.y - .01, w.z), (.012, .02, .1), 'Metal', 'Prop_R', arm, True)
    v = [(w.x - .012, w.y - .01, w.z + .05), (w.x + .012, w.y - .01, w.z + .05), (w.x + .01, w.y - .05, w.z + length * .6), (w.x - .004, w.y - .11, w.z + length),
         (w.x - .014, w.y - .04, w.z + length * .6), (w.x, w.y - .03, w.z + length * .4), (w.x, w.y - .01, w.z + length * .4)]
    f = [(0, 1, 5), (1, 2, 5), (2, 3, 5), (3, 4, 5), (4, 0, 5), (1, 0, 6), (2, 1, 6), (3, 2, 6), (4, 3, 6), (0, 4, 6)]
    u.mesh_obj('SabreBlade', v, f, 'Metal', 'Prop_R', True, arm=arm)


def scabbard(arm):
    u.tube('Scabbard', [(.10, -.02, .50), (.13, .04, .22)], [.014, .012], 'Metal', ['Hips'] * 2, 5, arm)


def gabion(arm):
    """A wicker gabion slung on the back: an open basket of stakes and woven bands."""
    u.tube('Gabion', [(0, .17, .48), (0, .17, .58), (0, .17, .74), (0, .17, .84)], [(.11, .1), (.115, .105), (.115, .105), (.11, .1)], 'Wood', ['Chest'] * 4, 8, arm)
    for k, z in enumerate((.52, .66, .80)):
        lib.ring(f'GabionBand{k}', arm, [z - .008, z + .008], [(.12, .11), (.12, .11)], 'Leather', ['Chest'] * 2, 8)


def fuse_coil(arm):
    u.tube('FuseCoil', [(-.12, -.03, .47), (-.13, -.05, .44), (-.12, -.06, .41)], [.03, .034, .03], 'Cloth', ['Hips'] * 3, 6, arm)


def apron(arm):
    u.box('Apron', (0, -.085, .40), (.18, .02, .26), 'Leather', 'Hips', arm)


def wheelbarrow(arm):
    """A wooden barrow at the right side, its handles by the hand, the wheel ahead."""
    w = lib.hand(arm)
    x = w.x + .03
    u.box('BarrowTray', (x, w.y - .30, .22), (.20, .30, .09), 'Wood', 'Prop_R', arm, True)
    for sx in (-1, 1):
        u.tube(f'BarrowHandle{sx}', [(x + sx * .08, w.y + .02, w.z - .02), (x + sx * .07, w.y - .45, .14)], [.01, .01], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    tm.wheel('BarrowWheel', arm, 'Prop_R', x, w.y - .50, .08, .08, spokes=4, rim='Metal')


# ---- the field gun -------------------------------------------------------------------------------

def field_gun(prefix='Gun', mat='Wood', metal='Leather', bronze='Metal'):
    """A field gun facing -Y: two spoked wheels on the axle at Y = 0, the cheeks of the carriage, the
    trail sloping back to the ground at +Y, the bronze barrel on its trunnions with the muzzle forward,
    a rammer and a pile of balls (iron: Leather, the darkest tag; the bronze barrel is Metal). A rigid armature (Hull, Wheel_L, Wheel_R) like ti_mounts.frame."""
    r = .30; ax = .24
    rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, 0, r), (0, 0, r + .2), None),
                                           ('Wheel_L', (ax, 0, r), (ax + .06, 0, r), 'Hull'),
                                           ('Wheel_R', (-ax, 0, r), (-ax - .06, 0, r), 'Hull')])
    u.tube(f'{prefix}Axle', [(-ax - .04, 0, r), (ax + .04, 0, r)], [.024, .024], mat, ['Hull'] * 2, 5, rig)
    for side, sx in [('L', 1), ('R', -1)]:
        tm.wheel(f'{prefix}Wheel{side}', rig, f'Wheel_{side}', sx * ax, 0, r, r, spokes=10, rim=metal)
    for sx in (-1, 1):  # the cheeks: from over the axle back to the trail
        u.tube(f'{prefix}Cheek{sx}', [(sx * .09, -.12, r + .08), (sx * .09, .25, r + .02), (sx * .05, .95, .04)], [(.03, .05), (.03, .045), (.026, .035)], mat, ['Hull'] * 3, 4, rig)
    u.box(f'{prefix}TrailEnd', (0, .98, .03), (.16, .1, .05), metal, 'Hull', rig)
    u.box(f'{prefix}Transom', (0, .30, r - .02), (.20, .05, .05), mat, 'Hull', rig)
    # the barrel: breech with a cascabel at the back, the muzzle swell at the front
    z = r + .17
    u.tube(f'{prefix}Barrel', [(0, .30, z), (0, .26, z), (0, .10, z), (0, -.30, z + .01), (0, -.62, z + .02), (0, -.66, z + .02)],
           [.02, .075, .07, .055, .05, .058], bronze, ['Hull'] * 6, 10, rig)
    u.tube(f'{prefix}Trunnions', [(-.09, -.02, z - .01), (.09, -.02, z - .01)], [.02, .02], bronze, ['Hull'] * 2, 6, rig)
    u.box(f'{prefix}Quoin', (0, .24, z - .09), (.08, .14, .05), mat, 'Hull', rig)
    # the rammer and sponge lying on the trail, a pile of balls by the wheel
    u.tube(f'{prefix}Rammer', [(.13, -.1, .03), (.13, .85, .03)], [.012, .012], mat, ['Hull'] * 2, 4, rig)
    u.tube(f'{prefix}RammerHead', [(.13, -.13, .03), (.13, -.08, .03)], [.03, .03], 'Cloth', ['Hull'] * 2, 6, rig)
    for k, (bx, by, bz) in enumerate([(-.42, .2, .04), (-.48, .26, .04), (-.42, .3, .04), (-.45, .25, .1)]):
        u.tube(f'{prefix}Ball{k}', [(bx, by, bz - .035), (bx, by, bz + .035)], [.03, .03], metal, ['Hull'] * 2, 6, rig)
    crew = [(-.62, .1, 0, 90), (.55, -.25, 0, -90), (.25, 1.15, 0, 180)]
    return [rig], {'rig': rig, 'crew': crew}


def gun_crew(prefix, at, yaw, tool=None):
    """A gunner in a Team coat and a forage cap (u.crew's lite body), a rammer or a linstock."""
    c, _ = u.crew(prefix, at, lite=True, head=None, yaw=yaw)
    forage_cap(c)
    for side, sign in [('L', 1), ('R', -1)]:  # trousers over the lite legs
        u.tube(f'{prefix}Trouser_{side}', [(sign * .061, 0, .40), (sign * .068, -.002, .24), (sign * .073, 0, .06)], [(.056, .052), (.046, .044), (.038, .038)], 'Cloth', ['Leg_' + side, 'Leg_' + side, 'Shin_' + side], 5, c)
    lib.ring(f'{prefix}Coat', c, [.33, .45, .537], [(.135, .1), (.12, .085), (.096, .068)], 'Team', ['Hips'] * 3, 6)
    if tool == 'linstock':
        w = lib.hand(c)
        u.tube(f'{prefix}Linstock', [(w.x, w.y, w.z - .3), (w.x, w.y - .02, w.z + .35)], [.01, .009], 'Wood', ['Prop_R'] * 2, 4, c, attachment=True)
        u.tube(f'{prefix}Match', [(w.x, w.y - .02, w.z + .35), (w.x, w.y - .03, w.z + .40)], [.012, .008], 'Cloth', ['Prop_R'] * 2, 4, c, attachment=True)
    elif tool == 'rammer':
        w = lib.hand(c)
        u.tube(f'{prefix}Ram', [(w.x, w.y, .06), (w.x, w.y - .01, w.z + .5)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, c, attachment=True)
        u.tube(f'{prefix}RamHead', [(w.x, w.y - .01, w.z + .5), (w.x, w.y - .01, w.z + .56)], [.03, .03], 'Cloth', ['Prop_R'] * 2, 6, c, attachment=True)
    return c


# ---- the units -----------------------------------------------------------------------------------------

PERSON_OPTS = cl.PERSON_OPTS


def g_infantry():
    arm = cl.person([long_coat, cross_belts, breeches_gaiters, tricorne, scabbard, musket])
    return [arm], {'Skin': 'C99472', 'Cloth': 'E8E2D2', 'Leather': '2A2420', 'Metal': IRON, 'Wood': '6A4A30'}, \
        'Line infantry: a long Team coat with turnbacks, white cross belts, a tricorne, gaiters, a musket with a fixed bayonet at the shoulder', PERSON_OPTS


def g_ranged():
    arm = cl.person([short_jacket, (lib.belt, 'Leather', .52), (lib.trousers, 'Cloth'), boots, round_hat, powder_horn, rifle_ready])
    u.box('Pouch', (-.10, -.06, .47), (.08, .04, .06), 'Leather', 'Hips', arm)
    return [arm], {'Skin': 'C99472', 'Cloth': '6E6448', 'Leather': '2E2620', 'Metal': IRON, 'Wood': '5A3E28'}, \
        'Riflemen: a short Team jacket, a round hat with a turned-up brim, a rifle at the ready, a powder horn and a cartridge pouch', PERSON_OPTS


def g_cavalry():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    cl.saddle_cloth(horse, 'Team')
    s = u.MOUNTS['horse']['seat']
    for sx in (-1, 1):  # the holsters at the pommel
        u.box(f'Holster{sx}', (sx * .12, s[1] - .2, s[2] - .06), (.05, .06, .12), 'Wood', 'Mount_Spine', horse)
    r = cl.rider([(long_coat, 'Team', {'low': .34}), (lib.belt, 'Cloth', .52), boots, dragoon_helmet, carbine_slung], [sabre])
    return [horse, r], {'Skin': 'C99472', 'Cloth': 'E8E2D2', 'Leather': '6B4530', 'Metal': BRASS, 'Wood': '2A2420'}, \
        'Dragoons: a brass helmet with a horsehair crest, a Team coat, high boots, a sabre drawn, a carbine slung, a horse with a Team saddle cloth and holsters', dict(budget=2600, mounted=True)


def g_siege():
    parts, info = field_gun()
    for i, ((x, y, z, yaw), tool) in enumerate(zip(info['crew'], ('rammer', 'linstock', None))):
        parts.append(gun_crew(f'Crew{i}', (x, y, z), yaw, tool))
    return parts, {'Skin': 'C99472', 'Cloth': 'D9CFB4', 'Leather': '2E2A28', 'Metal': ('A8823C', .55, .75), 'Wood': '6E5236'}, \
        'Field cannon: a bronze gun on a two-wheeled carriage with a trail, a rammer and a pile of balls, three crew in Team coats and forage caps (one with a rammer, one with a linstock)', dict(budget=3200, mounted=False)


def g_support():
    arm = cl.person([short_jacket, apron, (lib.belt, 'Leather', .52), (lib.trousers, 'Cloth'), boots, (forage_cap, 'Cloth'), gabion, fuse_coil, kb.shovel])
    return [arm], {'Skin': 'C99472', 'Cloth': '8A7A5A', 'Leather': '5E4030', 'Metal': IRON, 'Wood': 'A0784E'}, \
        'Sappers: a wicker gabion on the back, a shovel, a fuse coil, a leather apron, a Team jacket and a cap', PERSON_OPTS


def g_worker():
    arm = cl.person([(lib.top, 'Cloth', {'name': 'Shirt'}), waistcoat,
                     (lib.trousers, 'Leather'), boots, (round_hat, 'Wood'), wheelbarrow])
    w = lib.hand(arm, 'L')
    u.tube('Shovel', [(w.x, w.y, w.z - .3), (w.x, w.y - .01, w.z + .35)], [.011, .01], 'Wood', ['Prop_L'] * 2, 4, arm, attachment=True)
    u.box('ShovelBlade', (w.x, w.y, w.z - .36), (.09, .015, .11), 'Metal', 'Prop_L', arm, True)
    return [arm], {'Skin': 'C99472', 'Cloth': 'E2D8C0', 'Leather': '6A5A44', 'Metal': IRON, 'Wood': '7A5A3A'}, \
        'Laborer: a shirt and a Team waistcoat, a broad hat, a shovel, a wheelbarrow', PERSON_OPTS


def g_general():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    cl.saddle_cloth(horse, 'Team')
    r = cl.rider([(long_coat, 'Team', {'low': .34}), officer_sash, epaulettes, boots, bicorne, (cl.seated_cloak, 'Team')], [sabre], name='Commander')
    bearer, _ = u.crew('Bearer', (.50, -.05, 0), head=None)
    tricorne(bearer)
    cl.banner(bearer, 1.7, w_=.30, h_=.30)
    return [horse, r, bearer], {'Skin': 'C99472', 'Cloth': 'F0EBDD', 'Leather': '2A2420', 'Metal': BRASS, 'Wood': '3F2E22'}, \
        'Gunpowder general: a mounted officer in a plumed bicorne, a Team coat with epaulettes and a sash, a Team cloak, sabre drawn, on a horse in a Team saddle cloth; a colour bearer on foot with the squad emblem colour', dict(budget=3000, mounted=True)


BUILDERS = {'gunpowder-infantry': g_infantry, 'gunpowder-ranged': g_ranged, 'gunpowder-cavalry': g_cavalry, 'gunpowder-siege': g_siege,
            'gunpowder-support': g_support, 'gunpowder-worker': g_worker, 'gunpowder-general': g_general}


def build(uid):
    lib.reset()
    parts, colors, look, opts = BUILDERS[uid]()
    lib.finish(uid, parts, colors, {'role': uid.split('-')[1], 'look': look}, opts['budget'], opts['mounted'])


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
