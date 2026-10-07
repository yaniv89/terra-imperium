# scripts/blender/build_units_bronze_signature.py
# The 34 Bronze signature units of plans/ART-MODELS-PLAN.md 4.5 (Wave 2), one per people, on the
# shared person rig and body (ti_units.py) and the mount and chariot rigs (ti_mounts.py), in the
# base units' look (faceted, flat colours: Team, Skin, Emblem, Metal, Wood, Leather, Cloth; readable
# at 30 px). Each people's look line from the roster is built from a small library of garments,
# headgear, weapons, shields and kit below; the file is src/assets/units/signature/<model>.glb with
# its <model>.json bake options. Original procedural geometry, no outside assets.
#   blender -b --factory-startup -P scripts/blender/build_units_bronze_signature.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb) and report.json; rest pose only (the
# vertex rig walks, trots and swings, as for the base units).
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402

if __name__ == '__main__':
    os.environ.setdefault('TI_UNITS_OUT', str(u.REPO / 'art-build' / 'units' / 'signature'))
PERSON_BUDGET, MOUNTED_BUDGET = 1500, 3900


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 20
    u.palette()


# ---- garments ---------------------------------------------------------------------------------------

def ring(name, arm, zs, rs, mat, bones, sides=8):
    return u.tube(name, [(0, 0, z) for z in zs], rs, mat, bones, sides, arm)


def kilt(arm, mat='Team', low=.33, name='Kilt'):
    ring(name, arm, [low, (low + .45) / 2, .50, .537], [(.132, .095), (.125, .088), (.104, .075), (.089, .061)], mat, ['Hips'] * 4, 10)


def fringe(arm, mat, z, n=12, length=.07):
    """Hanging strips round the kilt's hem (the fringed Mesopotamian kilt and robe)."""
    for k in range(n):
        a = 2 * math.pi * k / n
        u.box(f'Fringe{k}', (.128 * math.cos(a), .09 * math.sin(a), z - length / 2), (.03, .012, length), mat, 'Hips', arm)


def kaunakes(arm, mat='Cloth'):
    """The fleeced kaunakes skirt of the Mari statues: three flaring tiers to the shin."""
    for i, (z0, z1, r0, r1) in enumerate([(.53, .40, (.09, .065), (.13, .10)), (.42, .29, (.12, .09), (.15, .115)), (.31, .16, (.14, .105), (.165, .125))]):
        ring(f'Fleece{i}', arm, [z1, z1 + .015, z0], [r1, (r1[0] - .01, r1[1] - .01), r0], mat, ['Hips'] * 3, 10)


def robe(arm, mat='Team', name='Robe'):
    ring(name, arm, [.05, .22, .42, .56, .70, .77, .79], [(.15, .12), (.14, .11), (.128, .095), (.10, .07), (.128, .075), (.135, .075), (.11, .063)], mat,
         ['Hips', 'Hips', 'Hips', 'Spine', 'Chest', 'Chest', 'Chest'], 10)


def top(arm, mat='Cloth', name='Top'):
    ring(name, arm, [.53, .60, .68, .745, .775], [(.094, .066), (.087, .063), (.112, .077), (.133, .079), (.112, .066)], mat, ['Spine', 'Spine', 'Chest', 'Chest', 'Chest'], 8)


def trousers(arm, mat='Team'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Trouser_{side}', [(sign * .061, 0, .47), (sign * .066, -.003, .30), (sign * .071, 0, .19), (sign * .074, .004, .07)], [(.058, .055), (.046, .044), (.044, .041), (.034, .034)], mat,
               ['Leg_' + side, 'Leg_' + side, 'Shin_' + side, 'Shin_' + side], 6, arm)


def cloak(arm, mat='Leather', low=.30, name='Cloak'):
    """A cloak from the shoulders down the back (both faces drawn)."""
    rows = [[(-.13, .04, .785), (0, .06, .795), (.13, .04, .785)], [(-.16, .12, .58), (0, .14, .58), (.16, .12, .58)], [(-.17, .14, low), (0, .17, low), (.17, .14, low)]]
    v = [p for r in rows for p in r]; f = []
    for i in range(2):
        for j in range(2):
            a = 3 * i + j; b = a + 1; c = a + 4; d = a + 3
            f += [(a, b, c), (a, c, d), (a, c, b), (a, d, c)]
    u.mesh_obj(name, v, f, mat, None, arm=arm, weights=[{'Chest': 1}] * 3 + [{'Spine': 1}] * 3 + [{'Hips': 1}] * 3)


def sash(arm, mat='Cloth'):
    u.tube('Sash', [(.10, -.07, .76), (0, -.085, .64), (-.10, -.075, .50)], [(.022, .008)] * 3, mat, ['Chest', 'Spine', 'Hips'], 4, arm)


def belt(arm, mat='Leather', z=.52):
    ring('Belt', arm, [z - .014, z + .014], [(.098, .07), (.096, .069)], mat, ['Hips'] * 2, 8)


def greaves(arm, mat='Metal'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Greave_{side}', [(sign * .073, -.008, .095), (sign * .073, -.01, .17), (sign * .072, -.012, .245)], [(.03, .031), (.041, .038), (.035, .034)], mat, ['Shin_' + side] * 3, 6, arm)


def sandals(arm, mat='Leather'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.box(f'Sandal_{side}', (sign * .074, -.042, .008), (.066, .134, .016), mat, 'Foot_' + side, arm)


def armlets(arm, mat='Cloth', wrists=False):
    for side, sign in [('L', 1), ('R', -1)]:
        a = arm.data.bones['Arm_' + side]; h, t = a.head_local, a.tail_local; p = h.lerp(t, .45)
        u.tube(f'Armlet_{side}', [tuple(p + (t - h).normalized() * -.012), tuple(p + (t - h).normalized() * .012)], [.043, .043], mat, ['Arm_' + side] * 2, 6, arm)
        if wrists:
            f = arm.data.bones['Forearm_' + side]; h2, t2 = f.head_local, f.tail_local; q = h2.lerp(t2, .8)
            u.tube(f'Bracelet_{side}', [tuple(q + (t2 - h2).normalized() * -.02), tuple(q + (t2 - h2).normalized() * .02)], [.034, .034], mat, ['Forearm_' + side] * 2, 6, arm)


def wrist_guard(arm, mat='Leather'):
    f = arm.data.bones['Forearm_L']; h, t = f.head_local, f.tail_local
    u.tube('WristGuard', [tuple(h.lerp(t, .45)), tuple(h.lerp(t, .9))], [.036, .033], mat, ['Forearm_L'] * 2, 6, arm)


def beard(arm, mat='Wood', long=False):
    u.tube('Beard', [(0, -.045, .885), (0, -.06, .85), (0, -.06, .80 if long else .83)], [(.045, .03), (.04, .028), (.018, .015)], mat, ['Head'] * 3, 6, arm)


def tattoo_bands(arm, mat='Team'):
    for side, sign in [('L', 1), ('R', -1)]:
        u.tube(f'Tattoo_{side}', [(sign * .072, -.01, .30), (sign * .072, -.012, .36)], [.05, .05], mat, ['Leg_' + side] * 2, 6, arm)


# ---- headgear ---------------------------------------------------------------------------------------

def cap(arm, mat, peak=1.04, name='Cap', crest=None, low=.935, r=(.068, .061)):
    """A conical or domed cap or helmet (peak height), optional crest (a front-to-back ridge)."""
    u.tube(name, [(0, -.004, low), (0, -.003, low + .02), (0, 0, (low + peak) / 2 + .03), (0, 0, peak - .01), (0, 0, peak)], [r, (r[0] - .001, r[1] - .001), (.042, .038), (.012, .012), (.002, .002)], mat, ['Head'] * 5, 8, arm)
    if crest:
        u.tube('Crest', [(0, -.07, peak - .05), (0, -.02, peak + .045), (0, .05, peak + .03), (0, .10, peak - .08)], [(.008, .02), (.01, .03), (.01, .03), (.006, .015)], crest, ['Head'] * 4, 4, arm)


def cheek_flaps(arm, mat='Metal'):
    for sign in (-1, 1):
        u.box(f'Cheek{sign}', (sign * .062, -.02, .905), (.016, .05, .07), mat, 'Head', arm)


def horns(arm, mat='Cloth', z=.985):
    for sign in (-1, 1):
        u.tube(f'Horn{sign}', [(sign * .05, -.005, z), (sign * .11, -.01, z + .04), (sign * .13, -.02, z + .12)], [.016, .012, .003], mat, ['Head'] * 3, 5, arm)


def boar_tusk(arm, mat='Cloth', metal='Leather'):
    """The boar's-tusk helmet: rows of pale tusk plates on a leather cap, a knob at the top."""
    cap(arm, metal, peak=1.045, name='TuskCap')
    for i, (z, rx, ry) in enumerate([(.95, .071, .064), (.982, .062, .056), (1.012, .047, .043)]):
        ring(f'TuskRow{i}', arm, [z - .012, z + .012], [(rx, ry), (rx - .006, ry - .006)], mat, ['Head'] * 2, 10)
    cheek_flaps(arm, mat)


def phrygian(arm, mat='Team'):
    """The Phrygian cap, its peak bent forward."""
    u.tube('PhrygianCap', [(0, -.004, .935), (0, 0, .98), (0, .01, 1.03), (0, -.03, 1.075), (0, -.08, 1.07)], [(.068, .061), (.062, .055), (.045, .042), (.026, .024), (.008, .008)], mat, ['Head'] * 5, 8, arm)


def headband(arm, mat='Team', z=.97):
    ring('Headband', arm, [z - .01, z + .01], [(.064, .057), (.063, .056)], mat, ['Head'] * 2, 8)


def headcloth(arm, mat='Cloth', tail=False):
    u.tube('Headcloth', [(0, -.003, .952), (0, 0, .99), (0, 0, 1.012)], [(.066, .058), (.06, .051), (.032, .03)], mat, ['Head'] * 3, 6, arm)
    if tail:
        u.tube('HeadclothTail', [(0, .05, .96), (0, .10, .90), (0, .12, .83)], [.03, .025, .012], mat, ['Head'] * 3, 4, arm)


def feathers(arm, mat='Cloth', n=7, tall=.11, spread=1.0, z=1.0):
    for k in range(n):
        a = math.pi * (k / max(1, n - 1)) * spread + math.pi * (1 - spread) / 2
        x, y = .058 * math.cos(a), -.05 * math.sin(a)
        u.box(f'Feather{k}', (x, y, z + tall / 2 - .02), (.016, .008, tall), mat, 'Head', arm)


def single_feather(arm, mat='Cloth'):
    u.tube('Feather', [(.02, .03, .99), (.03, .04, 1.08), (.03, .03, 1.16)], [(.012, .004), (.02, .006), (.004, .002)], mat, ['Head'] * 3, 4, arm)


def side_lock(arm, mat='Wood'):
    u.tube('SideLock', [(.06, -.01, .95), (.072, -.015, .88), (.068, -.02, .82)], [.016, .014, .008], mat, ['Head'] * 3, 4, arm)


def hair_knot(arm, mat='Wood', top=True):
    at = (0, .01, 1.02) if top else (0, .05, .975)
    u.tube('HairKnot', [at, (at[0], at[1], at[2] + .035), (at[0], at[1], at[2] + .05)], [.025, .03, .01], mat, ['Head'] * 3, 6, arm)


def hair(arm, mat='Wood'):
    u.tube('Hair', [(0, .006, .93), (0, .004, .975), (0, 0, 1.006)], [(.064, .058), (.062, .055), (.034, .03)], mat, ['Head'] * 3, 6, arm)


# ---- weapons (right hand, Prop_R) and shields (left arm, Prop_L) --------------------------------------

def hand(arm, side='R'):
    return arm.data.bones['Hand_' + side].head_local


def spear(arm, top=1.32, mat='Metal', head=.12, low=.07, shaft='Wood', side='R'):
    w = hand(arm, side); b = 'Prop_' + side
    u.tube('SpearShaft', [(w.x, w.y, low), (w.x, w.y - .006, top)], [.009, .008], shaft, [b] * 2, 4, arm, attachment=True)
    u.tube('SpearHead', [(w.x, w.y - .006, top - .01), (w.x, w.y - .006, top + head * .35), (w.x, w.y - .006, top + head)], [(.006, .02), (.006, .024), (.001, .001)], mat, [b] * 3, 4, arm, attachment=True)


def javelins(arm, n=2, mat='Metal'):
    w = hand(arm)
    for k in range(n):
        dx = (k - (n - 1) / 2) * .03
        u.tube(f'Javelin{k}', [(w.x + dx, w.y + .04, w.z - .25), (w.x + dx, w.y - .05, w.z + .55)], [.006, .005], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
        u.tube(f'JavelinHead{k}', [(w.x + dx, w.y - .05, w.z + .55), (w.x + dx, w.y - .056, w.z + .62)], [.011, .001], mat, ['Prop_R'] * 2, 4, arm, attachment=True)


def dagger_axe(arm):
    """The Shang ge: a long haft with a bronze blade set at right angles, pointing forward."""
    w = hand(arm); top = 1.18
    u.tube('GeShaft', [(w.x, w.y, .10), (w.x, w.y - .006, top)], [.01, .009], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    v = [(w.x, w.y - .01, top - .02), (w.x, w.y - .01, top - .08), (w.x, w.y - .19, top - .055), (w.x, w.y - .21, top - .045)]
    u.mesh_obj('GeBlade', v + [(w.x + .006, y, z) for _, y, z in v], [(0, 1, 2), (0, 2, 3), (4, 6, 5), (4, 7, 6), (0, 4, 5), (0, 5, 1), (1, 5, 6), (1, 6, 2), (3, 7, 4), (3, 4, 0)], 'Metal', 'Prop_R', True, arm=arm)


def axe(arm, length=.48, mat='Metal'):
    w = hand(arm)
    u.tube('AxeHaft', [(w.x, w.y + .04, w.z - .08), (w.x, w.y - .08, w.z + length)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.box('AxeHead', (w.x, w.y - .12, w.z + length - .04), (.02, .12, .07), mat, 'Prop_R', arm, True)


def mace(arm, length=.42, side='R', name='Mace'):
    w = hand(arm, side); b = 'Prop_' + side
    u.tube(name + 'Haft', [(w.x, w.y + .04, w.z - .06), (w.x, w.y - .08, w.z + length)], [.01, .009], 'Wood', [b] * 2, 4, arm, attachment=True)
    u.tube(name + 'Head', [(w.x, w.y - .075, w.z + length - .04), (w.x, w.y - .09, w.z + length + .02), (w.x, w.y - .095, w.z + length + .045)], [.026, .032, .01], 'Metal', [b] * 3, 6, arm, attachment=True)


def sharur(arm):
    """Akkad's sharur in the off hand: a tall staff crowned by a winged mace head."""
    w = hand(arm, 'L')
    u.tube('SharurStaff', [(w.x, w.y, .08), (w.x, w.y - .005, 1.12)], [.011, .01], 'Wood', ['Prop_L'] * 2, 4, arm, attachment=True)
    u.tube('SharurHead', [(w.x, w.y - .005, 1.10), (w.x, w.y - .005, 1.15), (w.x, w.y - .005, 1.19)], [.03, .04, .01], 'Metal', ['Prop_L'] * 3, 6, arm, attachment=True)
    for sign in (-1, 1):
        u.box(f'SharurWing{sign}', (w.x + sign * .05, w.y - .005, 1.15), (.06, .012, .03), 'Metal', 'Prop_L', arm, True)


def sword(arm, length=.40, side='R'):
    w = hand(arm, side); b = 'Prop_' + side
    u.tube('SwordGrip', [(w.x, w.y - .01, w.z - .05), (w.x, w.y - .01, w.z + .04)], [.012, .012], 'Wood', [b] * 2, 5, arm, attachment=True)
    u.box('SwordGuard', (w.x, w.y - .01, w.z + .045), (.06, .02, .014), 'Metal', b, arm, True)
    v = [(w.x - .016, w.y - .01, w.z + .05), (w.x + .016, w.y - .01, w.z + .05), (w.x + .012, w.y - .01, w.z + length - .06), (w.x, w.y - .01, w.z + length), (w.x - .012, w.y - .01, w.z + length - .06), (w.x, w.y - .02, w.z + length / 2), (w.x, w.y, w.z + length / 2)]
    u.mesh_obj('SwordBlade', v, [(0, 1, 5), (1, 2, 5), (2, 3, 5), (3, 4, 5), (4, 0, 5), (1, 0, 6), (2, 1, 6), (3, 2, 6), (4, 3, 6), (0, 4, 6)], 'Metal', b, True, arm=arm)


def staff(arm, top=1.12):
    w = hand(arm)
    u.tube('Staff', [(w.x, w.y, .04), (w.x, w.y - .004, top)], [.012, .011], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)


def club(arm):
    w = hand(arm)
    u.tube('Club', [(w.x, w.y + .03, w.z - .06), (w.x, w.y - .06, w.z + .22), (w.x, w.y - .1, w.z + .38)], [.014, .026, .036], 'Wood', ['Prop_R'] * 3, 6, arm, attachment=True)


def belt_dagger(arm, mat='Metal', at=(-.07, -.085, .50)):
    x, y, z = at
    u.tube('BeltDagger', [(x, y, z + .05), (x, y - .006, z - .02), (x, y - .006, z - .10)], [.012, .012, .002], mat, ['Hips'] * 3, 4, arm)


def bow(arm, height=.80, recurve=.07, side='L'):
    """A self bow in the hand, string toward the body."""
    w = hand(arm, side); b = 'Prop_' + side; pts = []; n = 7
    for i in range(n):
        t = i / (n - 1); z = w.z - height / 2 + height * t; y = w.y - .04 - recurve * math.sin(math.pi * t)
        pts.append((w.x + .01, y, z))
    u.tube('Bow', pts, [.006, .009, .011, .012, .011, .009, .006], 'Wood', [b] * n, 4, arm, attachment=True)
    u.tube('BowString', [pts[0], (w.x + .01, w.y + .02, w.z), pts[-1]], [.003] * 3, 'Cloth', [b] * 3, 3, arm, attachment=True)


def crossbow(arm):
    """A crossbow held level before the chest: a stock from the right hand, a bow across its tip."""
    wr = hand(arm, 'R'); wl = hand(arm, 'L')
    u.box('CrossbowStock', ((wr.x + wl.x) / 2, wr.y - .12, wr.z + .02), (.03, .34, .035), 'Wood', 'Prop_R', arm, True)
    u.tube('CrossbowBow', [(-.20, wr.y - .27, wr.z + .03), (0, wr.y - .30, wr.z + .04), (.20, wr.y - .27, wr.z + .03)], [.008, .012, .008], 'Wood', ['Prop_R'] * 3, 4, arm, attachment=True)
    u.tube('CrossbowString', [(-.20, wr.y - .27, wr.z + .03), (0, wr.y - .18, wr.z + .04), (.20, wr.y - .27, wr.z + .03)], [.003] * 3, 'Cloth', ['Prop_R'] * 3, 3, arm, attachment=True)


def sling(arm):
    w = hand(arm)
    u.tube('Sling', [(w.x, w.y, w.z), (w.x + .01, w.y + .01, w.z - .15), (w.x, w.y + .02, w.z - .25)], [.004, .004, .02], 'Leather', ['Prop_R'] * 3, 4, arm, attachment=True)


def lasso(arm):
    """A coiled rope at the right hip."""
    n = 10; pts = [(-.13 + .05 * math.cos(2 * math.pi * k / n), -.02, .45 + .06 * math.sin(2 * math.pi * k / n)) for k in range(n + 1)]
    u.tube('Lasso', pts, [.007] * (n + 1), 'Leather', ['Hips'] * (n + 1), 4, arm)


SHIELD_AT = (.225, -.160, .610)


def shield_face(arm, name, outline, mat='Emblem'):
    """A flat shield face from an outline in the XZ plane (centred on SHIELD_AT), its UVs the outline's box."""
    cx, cy, cz = SHIELD_AT
    xs = [p[0] for p in outline]; zs = [p[1] for p in outline]
    verts = [(cx, cy - .022, cz)] + [(cx + x, cy - .007, cz + z) for x, z in outline]; n = len(outline)
    face = u.mesh_obj(name, verts, [(0, j + 1, (j + 1) % n + 1) for j in range(n)] + [(0, (j + 1) % n + 1, j + 1) for j in range(n)], mat, 'Prop_L', True, arm=arm)
    uv = face.data.uv_layers.active
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - cx - min(xs)) / (max(xs) - min(xs)), (co.z - cz - min(zs)) / (max(zs) - min(zs)))
    u.box(name + 'Grip', (cx, cy + .015, cz), (.03, .02, .12), 'Wood', 'Prop_L', arm, True)
    return face


def shield(arm, kind='round', size=.17, mat='Emblem'):
    def ellipse(rx, rz, n=14, z0=0):
        return [(rx * math.cos(2 * math.pi * j / n), z0 + rz * math.sin(2 * math.pi * j / n)) for j in range(n)]
    if kind == 'round':
        shield_face(arm, 'Shield', ellipse(size, size))
    elif kind == 'figure8':
        # two lobes and a waist: the Aegean figure-of-eight shield, tall
        pts = []
        for j in range(24):
            a = 2 * math.pi * j / 24; z = .30 * math.sin(a); waist = .55 + .45 * abs(math.sin(a * 2)) ** .5
            pts.append((.16 * math.cos(a) * (waist if abs(z) < .2 else 1), z))
        shield_face(arm, 'Shield', pts)
    elif kind == 'tower':
        pts = [(-.13, -.33), (.13, -.33), (.14, .1), (.12, .30), (0, .34), (-.12, .30), (-.14, .1)]
        shield_face(arm, 'Shield', pts)
    elif kind == 'crescent':
        # the pelta: a disc with a bite out of the top
        pts = [(.16 * math.cos(a), .16 * math.sin(a)) for a in [math.radians(d) for d in range(30, 330, 30)]][::-1]
        pts = [(x, z) for x, z in [(.16 * math.cos(math.radians(d)), .16 * math.sin(math.radians(d))) for d in range(-150, 151, 30)]] + [(.06, .1), (-.06, .1)]
        pts = [(x, z) for x, z in pts]
        shield_face(arm, 'Shield', [(z, -x) for x, z in pts])
    elif kind == 'oxhide':
        shield_face(arm, 'Shield', [(-.10, -.14), (.10, -.15), (.12, 0), (.10, .14), (-.10, .15), (-.12, 0)])
    elif kind == 'rect':
        shield_face(arm, 'Shield', [(-.12, -.22), (.12, -.22), (.12, .22), (-.12, .22)])
    cx, cy, cz = SHIELD_AT
    if kind == 'round':
        u.tube('ShieldBoss', [(cx, cy - .022, cz), (cx, cy - .05, cz)], [.04, .01], 'Metal', ['Prop_L'] * 2, 6, arm, attachment=True)


# ---- back kit ----------------------------------------------------------------------------------------

def quiver(arm, hip=False):
    if hip:
        u.tube('Quiver', [(.12, .02, .36), (.135, .03, .58)], [.03, .036], 'Leather', ['Hips'] * 2, 5, arm)
        u.tube('QuiverArrows', [(.135, .03, .58), (.14, .03, .64)], [.024, .018], 'Wood', ['Hips'] * 2, 4, arm)
    else:
        u.tube('Quiver', [(-.06, .08, .48), (.05, .09, .78)], [.034, .04], 'Leather', ['Chest'] * 2, 5, arm)
        u.tube('QuiverArrows', [(.05, .09, .78), (.07, .09, .86)], [.028, .02], 'Wood', ['Chest'] * 2, 4, arm)


def pack(arm, mat='Leather'):
    u.box('Pack', (0, .10, .64), (.20, .09, .20), mat, 'Chest', arm)


def hip_bag(arm, mat='Cloth', name='HipBag'):
    u.tube(name, [(-.12, -.04, .47), (-.13, -.05, .41), (-.12, -.04, .35)], [.03, .048, .028], mat, ['Hips'] * 3, 6, arm)


def seal(arm):
    u.tube('CylinderSeal', [(.11, -.06, .48), (.11, -.06, .43)], [.014, .014], 'Metal', ['Hips'] * 2, 6, arm)


# ---- a person ----------------------------------------------------------------------------------------

def person(spec):
    """A dressed foot soldier from `spec` (keys below), the body's hidden skin dropped."""
    arm, body = u.build_body(ready=True, lite=False, modest=False); arm.name = 'SignatureRig'; body.name = 'SignatureBody'
    covered = spec.get('covered', 'top')  # top: the torso and hips are clothed; hips: only the hips; robe: down to the ankle
    if covered == 'robe':
        u.drop_faces(body, lambda c: .1 < c.z < .745 and abs(c.x) < .15)
    elif covered == 'top':
        u.drop_faces(body, lambda c: .35 < c.z < .745 and abs(c.x) < (.145 if c.z > .535 else .15))
    else:
        u.drop_faces(body, lambda c: .36 < c.z < .50 and abs(c.x) < .14)
    for step in spec['parts']:
        fn, *args = step if isinstance(step, tuple) else (step,)
        kw = args[-1] if args and isinstance(args[-1], dict) else {}
        pos = args[:-1] if kw else args
        fn(arm, *pos, **kw)
    return arm


# ---- the roster: 26 foot and 8 chariot units ---------------------------------------------------------
# colours: Team stays grey (the side's colour); the rest per people. Shield faces are the squad's Emblem.
BRONZE = ('C2995A', .4, .6)
COPPER = ('B8733F', .4, .65)
P = person
FOOT = {
    'mari': dict(name='Mari spear guard', role='infantry', colors={'Skin': 'C08A63', 'Cloth': 'EFE8D8', 'Metal': BRONZE, 'Wood': '4A3626'}, covered='hips',
                 parts=[kaunakes, (cap, 'Metal', {'peak': 1.09, 'name': 'TallHelm'}), cheek_flaps, (beard, 'Wood', {'long': True}), (spear, {'top': 1.40}), (shield, 'rect'), sandals],
                 look='fleeced kaunakes skirt, bare chest, long spear, tall bronze helm with cheek flaps (Mari statues)'),
    'akkad': dict(name='Sharur-bearing spearmen', role='infantry', colors={'Skin': 'BE8660', 'Cloth': 'E2D3AE', 'Metal': BRONZE}, covered='hips',
                  parts=[(kilt, 'Team'), (fringe, 'Cloth', .345), (cap, 'Metal', {'peak': 1.05}), beard, (spear, {'top': 1.34}), sharur, belt],
                  look='fringed kilt, bronze helmet, long spear, the winged sharur mace-standard in the off hand'),
    'elam': dict(name='Elamite archers', role='ranged', colors={'Skin': 'B07A55', 'Cloth': 'D8C9A4', 'Leather': '6E4A30'}, covered='robe',
                 parts=[(robe, 'Team'), (fringe, 'Cloth', .085, {'n': 14, 'length': .05}), (headband, 'Cloth'), beard, (bow, {'height': .95, 'recurve': .09}), (quiver, {'hip': True})],
                 look='long fringed robe, headband, big self bow, quiver on the hip (Elam reliefs)'),
    'kanesh': dict(name='Old Assyrian karum caravan guards', role='infantry', colors={'Skin': 'C08A63', 'Cloth': 'C9B58C', 'Leather': '7A5236', 'Metal': BRONZE}, covered='top',
                   parts=[(kilt, 'Team', {'low': .38}), (top, 'Cloth'), (cap, 'Cloth', {'peak': 1.09, 'name': 'FeltCap', 'r': (.066, .059)}), beard, (spear, {'top': 1.26}), pack, seal, sandals],
                   look='short kilt, pointed felt cap, spear, a leather pack, a trader\'s cylinder seal at the belt'),
    'phrygia': dict(name='Phrygian peltasts', role='ranged', colors={'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Wood': '6A4A30'}, covered='top',
                    parts=[(trousers, 'Team'), (top, 'Cloth'), (kilt, 'Cloth', {'low': .40, 'name': 'Tunic'}), (phrygian, 'Team'), (javelins, 3), (shield, 'crescent')],
                    look='Phrygian cap with the forward-bent peak, trousers, javelin bundle, crescent wicker shield'),
    'urartu': dict(name='Urartian fortress spearmen', role='infantry', colors={'Skin': 'C49070', 'Cloth': 'D9CDA8', 'Metal': BRONZE}, covered='top',
                   parts=[(kilt, 'Team', {'low': .36}), (top, 'Leather'), belt, (cap, 'Metal', {'peak': 1.08, 'crest': 'Team'}), (spear, {'top': 1.36}), (shield, 'round', {'size': .18}), sandals],
                   look='conical bronze helm with a crest, round shield with the horned-god boss, long spear, a short belt'),
    'colchis': dict(name='Colchian oxhide-shield spearmen', role='infantry', colors={'Skin': 'C99472', 'Leather': '8B5A34', 'Wood': '6C4A2E', 'Metal': BRONZE}, covered='top',
                    parts=[(kilt, 'Team', {'low': .37}), (top, 'Cloth'), (cap, 'Wood', {'peak': 1.03, 'name': 'WoodenHelm'}), (spear, {'top': 1.1}), (shield, 'oxhide'), (belt_dagger, {'at': (-.08, -.085, .49)})],
                    look='wooden helmet, small raw-oxhide shield, short spear, short sword'),
    'magan': dict(name='Maganite copper-spear guards', role='infantry', colors={'Skin': 'A86E48', 'Metal': COPPER, 'Cloth': 'D8CBA6'}, covered='hips',
                  parts=[(kilt, 'Team', {'low': .38}), (spear, {'top': 1.3}), (shield, 'round', {'size': .15}), (hip_bag, 'Cloth', {'name': 'IngotSack'}), hair],
                  look='bare chest, copper spear and round shield, a sack of copper ingots'),
    'dilmun': dict(name='Dilmun copper-spear guards', role='ranged', colors={'Skin': 'B07A55', 'Metal': COPPER, 'Cloth': 'E8DEC6'}, covered='hips',
                   parts=[(kilt, 'Team', {'low': .38}), (headcloth, 'Cloth'), (javelins, 2), (shield, 'round', {'size': .14}), sandals],
                   look='short wrapped kilt, headcloth, copper javelins (the ranged role), round shield'),
    'kerma': dict(name='Kerma long-bow archers', role='ranged', colors={'Skin': '6E4630', 'Leather': '5C3D26', 'Cloth': 'EEE6D2'}, covered='hips',
                  parts=[(kilt, 'Team', {'low': .40}), (cap, 'Leather', {'peak': 1.0, 'name': 'LeatherCap'}), (feathers, 'Cloth', {'n': 3, 'tall': .12, 'spread': .4}), (bow, {'height': 1.15, 'recurve': .06}), wrist_guard, quiver],
                  look='bare chest, leather cap with feathers, very long self bow, wrist guard'),
    'libu': dict(name='Libu feather-cloaked javelinmen', role='infantry', colors={'Skin': 'C8946E', 'Leather': '8A6040', 'Cloth': 'ECE3CC', 'Wood': '4A3626'}, covered='hips',
                 parts=[(kilt, 'Team', {'low': .40}), (cloak, 'Leather', {'low': .12, 'name': 'LongCloak'}), (single_feather, 'Cloth'), side_lock, (javelins, 2)],
                 look='tall feather in the hair, long leather cloak, a pair of javelins, side-lock hairstyle (Egyptian reliefs)'),
    'keftiu': dict(name='Minoan figure-eight-shield spearmen', role='infantry', colors={'Skin': 'C48A62', 'Cloth': 'EFE6CF', 'Leather': '7A5236', 'Metal': BRONZE}, covered='hips',
                   parts=[(kilt, 'Team', {'low': .40}), (belt, 'Metal', .50), (boar_tusk, 'Cloth'), (spear, {'top': 1.4}), (shield, 'figure8'), (sword, {'length': .30, 'side': 'R'})],
                   look='boar-tusk helmet, figure-eight shield, long spear, waist-cinched kilt, bronze sword'),
    'ahhiyawa': dict(name='Mycenaean boar-tusk helmet spearmen', role='infantry', colors={'Skin': 'C99472', 'Cloth': 'EFE6CF', 'Leather': '6E4A30', 'Metal': BRONZE}, covered='top',
                     parts=[(kilt, 'Team', {'low': .37}), (top, 'Leather'), (boar_tusk, 'Cloth'), (spear, {'top': 1.42}), (shield, 'tower'), greaves],
                     look='boar-tusk helmet, tower shield, long spear, bronze greaves (Mycenaean frescoes)'),
    'tartessos': dict(name='Tartessian horned-helmet warriors', role='infantry', colors={'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Metal': BRONZE, 'Wood': '5A4130'}, covered='top',
                      parts=[(kilt, 'Team', {'low': .36}), (top, 'Cloth'), (cap, 'Metal', {'peak': 1.02, 'name': 'Helm'}), (horns, 'Metal'), (spear, {'top': 1.3}), (shield, 'round', {'size': .16}), (belt_dagger, {'at': (-.08, -.085, .50)})],
                      look='horned bronze helmet, round caetra shield, spear, sword (Southwest Iberian stelae)'),
    'cucuteni': dict(name='Cucuteni copper-axe warriors', role='infantry', colors={'Skin': 'CDA07C', 'Leather': '7E5A3A', 'Metal': COPPER, 'Cloth': 'D7C8A2'}, covered='top',
                     parts=[(kilt, 'Team', {'low': .34}), (top, 'Leather'), (cloak, 'Leather', {'low': .32, 'name': 'HideCloak'}), hair, (axe, {'length': .5}), (shield, 'oxhide')],
                     look='Copper Age: copper hammer-axe, hide shield, hide cloak'),
    'botai': dict(name='Botai horse-corral hunters', role='infantry', colors={'Skin': 'CDA07C', 'Leather': '80603F', 'Cloth': 'C8B68F', 'Metal': ('8C8780', .8, 0)}, covered='top',
                  parts=[(robe, 'Leather', {'name': 'HideCoat'}), (trousers, 'Team'), (cap, 'Leather', {'peak': 1.03, 'name': 'FurCap', 'r': (.072, .066)}), (spear, {'top': 1.15, 'mat': 'Metal'}), lasso],
                  look='hide coat, lasso, short stone-tipped spear; on foot'),
    'meluhha': dict(name='Meluhhan bowmen', role='ranged', colors={'Skin': 'A87250', 'Cloth': 'EDE4CC', 'Metal': COPPER, 'Wood': '3E2C20'}, covered='hips',
                    parts=[(kilt, 'Team', {'low': .38}), (armlets, 'Cloth', {'wrists': True}), (hair_knot, 'Wood', {'top': False}), hair, bow, quiver, belt_dagger],
                    look='Harappan: cloth kilt, shell armlets, bow, copper dagger, hair bun'),
    'saurashtra': dict(name='Saurashtran sea-trader guards', role='infantry', colors={'Skin': 'A06A48', 'Cloth': 'EEE5CF', 'Metal': BRONZE}, covered='hips',
                       parts=[(kilt, 'Team', {'low': .26, 'name': 'Dhoti'}), belt, (armlets, 'Metal', {'wrists': True}), hair, (sword, {'length': .42}), (shield, 'round', {'size': .16})],
                       look='belted dhoti, sword and round shield, coil-wire bracelets'),
    'shang': dict(name='Shang dagger-axe warriors', role='infantry', colors={'Skin': 'D2A47E', 'Leather': '5E2E22', 'Metal': BRONZE, 'Cloth': 'D8CBA6'}, covered='top',
                  parts=[(kilt, 'Team', {'low': .36}), (top, 'Leather', {'name': 'LacquerVest'}), (cap, 'Metal', {'peak': 1.03, 'name': 'Helm'}), dagger_axe, (shield, 'rect')],
                  look='bronze dagger-axe (ge), bronze helmet, lacquered leather vest, tiger-pattern shield (the Emblem face)'),
    'shu': dict(name='Shu spearmen of Sanxingdui', role='infantry', colors={'Skin': 'D2A47E', 'Cloth': 'CDBF9B', 'Metal': BRONZE}, covered='top',
                parts=[(kilt, 'Team', {'low': .34}), (top, 'Team', {'name': 'Tunic'}), headband, hair, (spear, {'top': 1.38}), (shield, 'round', {'size': .19})],
                look='plain tunic, long spear, round shield bearing the Sanxingdui mask motif (the Emblem face)'),
    'gojoseon': dict(name='Gojoseon mandolin-dagger warriors', role='infantry', colors={'Skin': 'D2A47E', 'Cloth': 'E6DDC5', 'Metal': BRONZE, 'Wood': '2E241C'}, covered='top',
                     parts=[(kilt, 'Team', {'low': .30, 'name': 'Tunic'}), (top, 'Team'), belt, (hair_knot, 'Wood'), (sword, {'length': .30}), (shield, 'round', {'size': .13})],
                     look='belted tunic, topknot, bronze mandolin-shaped dagger, small round shield'),
    'van-lang': dict(name='Van Lang bronze-drum archers', role='ranged', colors={'Skin': 'B98258', 'Cloth': 'EDE4CC', 'Wood': '5A4130'}, covered='hips',
                     parts=[(kilt, 'Team', {'low': .42, 'name': 'Loincloth'}), (feathers, 'Cloth', {'n': 9, 'tall': .16}), (headband, 'Team'), tattoo_bands, crossbow, (quiver, {'hip': True})],
                     look='feather headdress, loincloth, crossbow, tattooed skin (Dong Son drum art)'),
    'tichitt': dict(name='Tichitt stone-village archers', role='ranged', colors={'Skin': '7A4E34', 'Leather': '7E5A3A', 'Cloth': 'DCCFAE'}, covered='top',
                    parts=[(kilt, 'Team', {'low': .38}), (cloak, 'Leather', {'low': .42, 'name': 'HideCloak'}), (cap, 'Leather', {'peak': 1.0, 'name': 'LeatherCap'}), bow, quiver],
                    look='leather cap, bow, quiver, light hide cloak'),
    'punt': dict(name='Puntite dagger guards', role='ranged', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Leather': 'A37A4A', 'Metal': BRONZE, 'Wood': '2E241C'}, covered='hips',
                 parts=[(kilt, 'Team', {'low': .36}), sash, (cloak, 'Leather', {'low': .40, 'name': 'SkinCape'}), (beard, 'Wood', {'long': True}), hair, (javelins, 2), (belt_dagger, {'at': (-.02, -.09, .50)})],
                 look='kilt with a long sash, pointed beard, dagger in the waistband, animal-skin cape; javelins (the ranged role)'),
    'caral': dict(name='Caral temple-city guards', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'E9DFC4', 'Wood': '5A4130'}, covered='top',
                  parts=[(kilt, 'Team', {'low': .30, 'name': 'Tunic'}), (top, 'Team'), (headband, 'Cloth'), hair, sling, (hip_bag, 'Cloth', {'name': 'StonePouch'})],
                  look='woven cotton tunic, headband, sling and a pouch of stones'),
    'lapita': dict(name='Lapita canoe spearmen', role='infantry', colors={'Skin': '9C6A48', 'Cloth': 'D9C7A0', 'Wood': '5A4130'}, covered='hips',
                   parts=[(kilt, 'Team', {'low': .36, 'name': 'Tapa'}), (armlets, 'Cloth'), hair, (spear, {'top': 1.3, 'mat': 'Wood'}), (mace, {'side': 'L', 'name': 'Club', 'length': .32})],
                   look='tapa kilt, shell armlets, spear, wooden club'),
    'wahgi': dict(name='Wahgi bamboo-arrow archers', role='ranged', colors={'Skin': '6E4630', 'Cloth': 'E8D9B0', 'Leather': '6B4A30', 'Team': 'BFBFBF'}, covered='hips',
                  parts=[(kilt, 'Team', {'low': .40, 'name': 'Apron'}), (cloak, 'Leather', {'low': .45, 'name': 'BarkCape'}), (feathers, 'Team', {'n': 9, 'tall': .2}), (bow, {'height': 1.05}), (headband, 'Cloth')],
                  look='feather headdress, bark cape, long bow, painted face'),
}

CHARIOTS = {
    'ugarit': dict(name='Ugaritic maryannu chariot crews', crew=['driver', 'bowman', 'javelin'], helm='conical', colors={'Leather': '8C5A34', 'Metal': BRONZE, 'Cloth': 'D9C7A0'},
                   barding='Metal', look='armoured chariot with a bowman, a javelin man and a driver, scale-covered horses, conical helms'),
    'kemet': dict(name='Chariot archers', crew=['driver', 'bowman'], helm='headcloth', crest='Cloth', colors={'Leather': 'A87B52', 'Cloth': 'F1EAD8', 'Metal': BRONZE},
                  look='two-horse light chariot, driver and archer, ostrich-plume horse crests, linen corselets'),
    'garamantes': dict(name='Garamantian war chariot', horses=4, crew=['driver', 'spearman'], helm='headcloth', colors={'Leather': '7A5236', 'Cloth': 'B08A5E'}, sides='Leather',
                       look='four-horse light chariot, driver and spearman, hide-covered sides'),
    'oxus': dict(name='Oxus cart-borne spearmen', crew=['driver', 'spearman'], helm='cap', colors={'Leather': '9A7048', 'Metal': BRONZE}, spokes=4, wheel_rim='Metal',
                 look='small two-wheel cart with bronze-rimmed wheels, driver and spearman, bronze axe'),
    'andronovo': dict(name='Andronovo spoke-wheel charioteers', crew=['driver', 'spearman'], helm='cap', colors={'Leather': '8A6A48', 'Cloth': 'CDB98F'}, spokes=10, sides='Leather',
                      look='two-horse light chariot with many-spoked wheels, driver and spearman (Sintashta burials)'),
    'kuru': dict(name='Kuru chariot-warriors', crew=['driver', 'bowman'], helm='headcloth', banner=True, beard=True, colors={'Leather': '9A6238', 'Cloth': 'EFE6D0'},
                 look='epic-age chariot with a banner, driver and long-bearded bowman'),
    'zhou': dict(name='Zhou chariot lords', heavy=True, crew=['driver', 'lord', 'halberd'], helm='cap', colors={'Leather': '6E4A30', 'Metal': BRONZE, 'Cloth': 'D8CBA6'}, banner=True,
                 look='four-horse chariot with a lord, halberdier and driver, bronze fittings'),
}


def crew_member(prefix, at, role, helm, beard_on=False):
    head = {'conical': 'cap', 'cap': 'cap', 'headcloth': 'headcloth'}.get(helm, 'headcloth')
    arm, meshes = u.crew(prefix, at, lite=True, head=head)
    if helm == 'conical':
        cap(arm, 'Metal', peak=1.07, name=prefix + 'Helm')
    if beard_on:
        beard(arm, 'Wood', long=True)
    w = arm.data.bones['Hand_R'].head_local
    if role == 'bowman':
        bow(arm, height=.78)
    elif role in ('spearman', 'javelin'):
        top = 1.15 if role == 'javelin' else 1.30
        u.tube(prefix + 'Spear', [(w.x, w.y, w.z - .3), (w.x, w.y - .01, top)], [.008, .007], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
        u.tube(prefix + 'SpearHead', [(w.x, w.y - .01, top), (w.x, w.y - .012, top + .09)], [(.006, .02), .001], 'Metal', ['Prop_R'] * 2, 4, arm, attachment=True)
    elif role == 'halberd':
        u.tube(prefix + 'Haft', [(w.x, w.y, w.z - .3), (w.x, w.y - .01, 1.35)], [.009, .008], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
        u.box(prefix + 'Blade', (w.x, w.y - .08, 1.30), (.012, .16, .05), 'Metal', 'Prop_R', arm, True)
    elif role == 'lord':
        cloak(arm, 'Team', low=.36, name=prefix + 'Cloak')
    return arm


def build_chariot(model, spec):
    parts, info = tm.chariot(heavy=spec.get('heavy', False), horses=spec.get('horses'), car='Team', sides=spec.get('sides', 'Cloth'),
                             spokes=spec.get('spokes'), wheel_rim=spec.get('wheel_rim'), crest=spec.get('crest'), barding=spec.get('barding'))
    floor = info['floor']; n = len(spec['crew'])
    xs = [(i - (n - 1) / 2) * (info['width'] / max(2, n + .2)) for i in range(n)]
    for i, (role, x) in enumerate(zip(spec['crew'], xs)):
        parts.append(crew_member(f'Crew{i}', (x, info['cy'] + .02, floor), role, spec.get('helm', 'headcloth'), beard_on=spec.get('beard') and role != 'driver'))
    if spec.get('banner'):
        rig = info['rig']; bx = info['width'] / 2 - .03; by = info['cy'] + info['depth'] / 2 - .06
        u.tube('BannerPole', [(bx, by, floor), (bx, by, floor + 1.25)], [.01, .008], 'Wood', ['Hull'] * 2, 4, rig)
        x0, x1, z0, z1, y = bx, bx + .22, floor + .95, floor + 1.2, by
        b = u.mesh_obj('Banner', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', 'Hull', arm=rig)
        uv = b.data.uv_layers.active
        for poly in b.data.polygons:
            for li in poly.loop_indices:
                co = b.data.vertices[b.data.loops[li].vertex_index].co
                uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    return parts


# ---- budget, finish ----------------------------------------------------------------------------------

def fit_budget(limit):
    """Decimate the heaviest meshes (weights kept) until the file is within `limit` triangles."""
    tris = u.scene_triangles()
    if tris <= limit:
        return tris
    meshes = sorted([o for o in bpy.context.scene.objects if o.type == 'MESH' and len(o.data.polygons) > 40], key=lambda o: -len(o.data.polygons))
    ratio = max(.4, (limit - 40) / tris)
    for ob in meshes:
        bpy.ops.object.select_all(action='DESELECT'); bpy.context.view_layer.objects.active = ob; ob.select_set(True)
        mods = [m for m in ob.modifiers if m.type == 'ARMATURE']
        dec = ob.modifiers.new('Budget', 'DECIMATE'); dec.ratio = ratio
        # apply the decimate before the armature (it is last; move it first)
        while ob.modifiers.find('Budget') > 0:
            bpy.ops.object.modifier_move_up(modifier='Budget')
        bpy.ops.object.modifier_apply(modifier='Budget')
        if u.scene_triangles() <= limit:
            break
    return u.scene_triangles()


def finish(model, parts, colors, notes, budget, mounted):
    u.set_colors({'Team': 'BFBFBF', 'Emblem': 'E6D6AF', **colors})
    tris = fit_budget(budget)
    root = u.assemble(model, parts)
    out = u.out_dir(model)
    meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    for o in meshes:
        for p in o.data.polygons:
            p.use_smooth = False
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{model}.blend'))
    u.export_unit(out / f'{model}.glb', animations=False)
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    report = {'id': model, 'triangles': tris, 'materials': mats, 'colors': colors, 'textures': 0, 'mounted': mounted,
              'pose': 'rest pose only; clips and VAT with Wave 0b (ART-MODELS-PLAN D5)', 'front': 'Blender -Y, glTF +Z', **notes}
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    opts = {'enabled': True, 'quadruped': mounted, 'triangleBudget': 4000 if mounted else 3000,
            'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}
    (out / f'{model}.json').write_text(json.dumps(opts, indent=2) + '\n')
    print(f'BUILT {model} triangles={tris} root={root.name}', flush=True)


def build(model):
    reset()
    if model in FOOT:
        spec = FOOT[model]
        arm = person(spec)
        sandals_on = any(p is sandals or (isinstance(p, tuple) and p[0] is sandals) for p in spec['parts'])
        finish(model, [arm], spec['colors'], {'name': spec['name'], 'role': spec['role'], 'look': spec['look'], 'sandals': sandals_on}, PERSON_BUDGET, False)
    else:
        spec = CHARIOTS[model]
        parts = build_chariot(model, spec)
        finish(model, parts, spec['colors'], {'name': spec['name'], 'role': 'cavalry', 'rig': 'chariot-heavy' if spec.get('heavy') else 'chariot-light', 'look': spec['look']}, MOUNTED_BUDGET, True)


ALL = list(FOOT) + list(CHARIOTS)
if __name__ == '__main__':  # the part library above is imported by the later ages' unit builders
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or ALL
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
