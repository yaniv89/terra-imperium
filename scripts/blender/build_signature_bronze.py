# scripts/blender/build_signature_bronze.py
# The Bronze signature units on the quality-pass figure with authored clips (2026-10-20, ti_signature.py),
# one recipe per people from the look lines of build_units_bronze_signature.py (FOOT; its chariots stay on
# that builder). Outputs go to art-build/units/signature/<model>/; copy each GLB to
# src/assets/units/signature/ and merge its "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_bronze.py -- [model ...]
# The parts the kit has no word for (boar-tusk helmets, crested cones, long horns, feather crowns and plume
# fans, fringes, wrap kilts, dhotis, tapa, packs, lassos, slings, the dagger-axe, the mandolin dagger, shaped
# shields: figure-eight, tower, pelta, oxhide, notched caetra, mask and boss faces) are the small helpers
# below, passed as the recipe's `extras`. A recipe with no kit dress and no armour gets the bare skin trunk.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_signature as S  # noqa: E402
import ti_figure as F  # noqa: E402
from mathutils import Vector as V  # noqa: E402

BRONZE = ('C2995A', .4, .6)
COPPER = ('B8733F', .4, .65)
# materials the helpers use (flat colours; a recipe overrides any of them)
EXTRA = {'Bone': 'EAE2CC', 'Felt': '8A6A4A', 'Trews': '9A5038', 'Hide': 'A88A62', 'Fur': '5E4632', 'Stone': ('8C8780', .8, 0.),
         'Sack': 'B8A47C', 'Feather': 'F2EEE4', 'Ink': '2E3A52', 'Tapa': 'B88A5A', 'Bark': '7A5E40', 'Plume': '1C1A1A',
         'Plume2': 'E08A28', 'Paint': 'C8302A', 'Paint2': 'E8C030', 'Lacquer': '8A2A1E', 'Stripe': 'A84A32'}
P_R, P_L = 'Prop_R', 'Prop_L'


# ---- small part helpers -------------------------------------------------------------------------------------

def bare_torso():
    """The bare skin trunk under a garment of a recipe's own (the kit's kilt makes its own)."""
    F.bronze_torso('BareTorso', 'Skin', chest=True)


def ring_on(name, bone, t, r, width, mat, sides=6):
    """A ring round a limb bone at `t` along it (an armlet, a bracelet, a tattoo band, a wrist guard)."""
    b = F.arm.data.bones[bone]
    h, e = b.head_local, b.tail_local
    p, d = h.lerp(e, t), (e - h).normalized()
    F.tube(name, [(tuple(p - d * width / 2), r, bone), (tuple(p + d * width / 2), r, bone)], mat, sides, caps=(False, False))


def armlets(mat='Bone', upper=True, wrists=0, wrist_mat=None):
    for s in 'LR':
        if upper:
            ring_on(f'Armlet_{s}', 'Arm_' + s, .42, .044, .022, mat)
        for k in range(wrists):
            ring_on(f'Bangle_{s}{k}', 'Forearm_' + s, .66 + k * .09, .031, .012, wrist_mat or mat)


def tattoo_bands(mat='Ink'):
    for s in 'LR':
        ring_on(f'TattooThigh_{s}', 'Leg_' + s, .42, .050, .050, mat, 7)
        ring_on(f'TattooArm_{s}', 'Forearm_' + s, .40, .034, .040, mat)


def prism(name, pts, x, thick, mat, bone, attachment=True):
    """A flat convex plate in the YZ plane (a blade seen from the side), `thick` across X."""
    n = len(pts)
    v = [(x - thick / 2, y, z) for y, z in pts] + [(x + thick / 2, y, z) for y, z in pts]
    f = [(0, j, j + 1) for j in range(1, n - 1)] + [(n, n + j + 1, n + j) for j in range(1, n - 1)]
    for j in range(n):
        q = (j + 1) % n
        f += [(j, n + j, n + q), (j, n + q, q)]
    return F.raw(name, v, f, mat, bone, attachment)


def fringe(name='Fringe', mat='Cloth', top=.345, bottom=.290, n=14):
    """Hanging strips round a hem (the fringed Mesopotamian kilt)."""
    F.strips(name, mat, top, bottom, n=n, grow=.010, gap=.22, flare=.006)


def skirt_wrap(name, mat, low, flap=None, flap_mat=None):
    """A wrapped kilt from the waist to `low`, a flap hanging at the front (its lower end `flap`)."""
    F.skirt(name, mat, low=low, top=.548, sides=10)
    if flap:
        F.slab(name + 'Flap', [(-.045, -.086, .530), (.045, -.086, .530), (.040, -.108, flap), (-.040, -.108, flap)], flap_mat or mat, 'Hips', depth=.006)


def belt(mat='Leather', z0=.500, z1=.528, grow=.012, bone='Hips'):
    F.band('Belt', mat, z0, z1, grow, profile=F.SKIRT, bone=bone)


def cloak(mat='Hide', low=.40, name='Cape', width=(.118, .200)):
    F.cloak(name, mat, low=low, width=width)


# ---- headgear -------------------------------------------------------------------------------------------------

def boar_tusk(crest=None, cheeks=True, knob='Leather', plume=None):
    """The Aegean boar's-tusk helmet: a leather cap in rows of pale tusk plates, a knob on top."""
    F.lathe('TuskCap', [(0, 1.056), (.030, 1.050), (.052, 1.028), (.066, .992), (.071, .958), (.072, .938)], 'Leather', sides=10)
    for i, (z, rx, ry) in enumerate([(.952, .0755, .0715), (.985, .0705, .0665), (1.016, .0585, .0555)]):
        ob = F.tube(f'TuskRow{i}', F.vertical([z - .012, z + .012], -.003, [(rx, ry), (rx - .007, ry - .007)], 'Head'), 'Bone', 12, caps=(False, False))
        F.quilt(ob, 2, 12, .07)
    F.tube('TuskKnob', [((0, -.003, 1.048), .014, 'Head'), ((0, -.003, 1.078), .010, 'Head'), ((0, -.003, 1.086), .004, 'Head')], knob, 6)
    if cheeks:
        for s in (-1, 1):
            F.box(f'TuskCheek_{s}', (s * .060, -.030, .898), (.012, .040, .074), 'Bone', 'Head')
    if crest:
        F.ridge('Crest', [(-.050, 1.020, 1.070), (-.012, 1.060, 1.140), (.040, 1.050, 1.130), (.086, .975, 1.050)], crest, 'Head', half=(.010, .020))
    if plume:
        F.tube('KnobPlume', [((0, -.003, 1.080), (.010, .006), 'Head'), ((0, .040, 1.100), (.018, .006), 'Head'), ((0, .090, 1.050), (.004, .002), 'Head')], plume, 4)


def cone_helm(mat='Metal', crest='Team', peak=1.140):
    """The Urartian tall conical bronze helmet, a crest arching over it from the brow to the nape."""
    F.lathe('ConeHelm', [(0, peak), (.016, peak - .040), (.040, 1.045), (.062, .990), (.072, .956), (.076, .945), (.076, .934)], mat, sides=10)
    F.box('ConeBrow', (0, -.074, .942), (.090, .006, .016), mat, 'Head')
    if crest:
        F.ridge('Crest', [(-.040, 1.040, 1.080), (-.016, 1.090, 1.170), (.020, 1.090, 1.180), (.058, 1.010, 1.120), (.088, .940, 1.000)], crest, 'Head', half=(.009, .018))


def long_horns(mat='Metal'):
    """Long lyre horns rising from the helmet (the Southwest Iberian stelae)."""
    for s in (-1, 1):
        F.tube(f'Horn_{s}', [((s * .052, -.004, .995), .015, 'Head'), ((s * .105, -.012, 1.030), .013, 'Head'), ((s * .140, -.022, 1.100), .009, 'Head'),
                             ((s * .128, -.040, 1.180), .002, 'Head')], mat, 6)


def shang_crown():
    """The Shang helmet's plume tube on top and a Team tassel from it."""
    F.tube('PlumeTube', [((0, -.003, 1.030), .011, 'Head'), ((0, -.003, 1.072), .009, 'Head')], 'Metal', 6)
    F.tube('Tassel', [((0, -.003, 1.070), .014, 'Head'), ((0, .040, 1.120), .018, 'Head'), ((0, .090, 1.090), .006, 'Head')], 'Team', 5)


def skullcap(mat='Leather', top=1.004):
    F.lathe('Skullcap', [(0, top), (.040, top - .006), (.062, top - .030), (.069, .952), (.070, .938)], mat, sides=10)


def plume(name, base, tip, w, mat, bend=(0, 0, 0)):
    """A flat feather or plume from `base` to `tip`, `w` its half width (seen from the front)."""
    a, b = V(base), V(tip)
    m = a.lerp(b, .55) + V(bend)
    F.tube(name, [(tuple(a), (w * .35, .004), 'Head'), (tuple(m), (w, .005), 'Head'), (tuple(b), (.002, .002), 'Head')], mat, 4)


def kerma_feathers():
    skullcap('Leather')
    plume('Ostrich_L', (.022, .040, .990), (.060, .110, 1.190), .020, 'Feather', (0, -.010, 0))
    plume('Ostrich_R', (-.022, .040, .990), (-.050, .120, 1.160), .020, 'Feather', (0, -.010, 0))


def libu_feather_lock():
    plume('LibuFeather', (.010, .040, .985), (.020, .055, 1.215), .018, 'Feather')
    F.box('LibuFeatherTip', (.020, .053, 1.205), (.030, .006, .040), 'Ink', 'Head')
    F.tube('SideLock', [((-.058, -.012, .950), .016, 'Head'), ((-.068, -.016, .880), .015, 'Head'), ((-.066, -.018, .800), .009, 'Head')], 'Hair', 5)


def plume_fan():
    """The Wahgi headdress: a fan of dark and orange plumes standing behind the head."""
    F.headband('Team', z=.952, height=.028)
    for i in range(7):
        a = math.radians(-60 + 120 * i / 6)
        base = (math.sin(a) * .050, .030 + math.cos(a) * .020, .975)
        tip = (math.sin(a) * .170, .090, 1.215 - abs(math.sin(a)) * .060)
        plume(f'Plume{i}', base, tip, .022, 'Plume2' if i % 3 == 0 else 'Plume')


def face_paint():
    """Painted face: red over the cheeks and jaw, a yellow band over the brow."""
    F.tube('PaintJaw', F.vertical([.866, .884, .904], [-.011, -.009, -.008], [(.049, .049), (.0545, .0525), (.0575, .0545)], 'Head'), 'Paint', 10, caps=(False, False))
    F.tube('PaintBrow', F.vertical([.944, .956], -.005, [(.0595, .0575), (.0590, .0570)], 'Head'), 'Paint2', 10, caps=(False, False))


def fur_cap():
    F.lathe('FurCap', [(0, 1.050), (.044, 1.044), (.072, 1.012), (.082, .970), (.084, .940), (.082, .926)], 'Fur', sides=10)
    for s in (-1, 1):
        F.box(f'EarFlap_{s}', (s * .071, .004, .893), (.020, .052, .072), 'Fur', 'Head')


def topknot(mat='Hair'):
    F.tube('Topknot', [((0, .006, .990), .024, 'Head'), ((0, .006, 1.030), .026, 'Head'), ((0, .006, 1.054), .010, 'Head')], mat, 6)
    F.box('TopknotPin', (0, .006, 1.030), (.090, .008, .008), 'Metal', 'Head')


def hair_bun(mat='Hair'):
    F.tube('HairBun', [((0, .052, .955), .020, 'Head'), ((0, .074, .945), .030, 'Head'), ((0, .094, .940), .012, 'Head')], mat, 6)
    F.headband('Cloth', z=.958, height=.014)


def minoan_locks(mat='Hair'):
    for i, x in enumerate((-.040, 0, .040)):
        F.tube(f'Lock{i}', [((x, .050, .940), .014, 'Head'), ((x * 1.2, .068, .870), .013, 'Head'), ((x * 1.3, .072, .790), .006, {'Head': .5, 'Chest': .5})], mat, 5)


def braid(mat='Hair'):
    F.tube('Braid', [((0, .055, .920), .016, 'Head'), ((0, .072, .840), .015, {'Head': .6, 'Chest': .4}), ((0, .090, .720), .010, 'Chest')], mat, 5)


def goatee(mat='Hair'):
    F.tube('Goatee', [((0, -.040, .862), (.020, .016), 'Head'), ((0, -.052, .815), (.014, .012), 'Head'), ((0, -.050, .760), .003, 'Head')], mat, 6)


# ---- kit and gear --------------------------------------------------------------------------------------------

def pack():
    """A trader's leather pack on the back with a bedroll over it."""
    F.box('Pack', (0, .128, .655), (.190, .080, .200), 'Leather', 'Chest')
    F.tube('Bedroll', [((-.110, .118, .790), .034, 'Chest'), ((.110, .118, .790), .034, 'Chest')], 'Cloth', 6)


def cylinder_seal():
    F.tube('SealCord', [((.040, -.084, .520), .003, 'Hips'), ((.052, -.090, .470), .003, 'Hips')], 'Leather', 3)
    F.tube('Seal', [((.054, -.092, .468), .010, 'Hips'), ((.054, -.092, .432), .010, 'Hips')], 'Stone', 6)


def ingot_sack():
    F.lathe('IngotSack', [(0, .360), (.040, .372), (.052, .420), (.042, .470), (.016, .492), (.014, .510), (0, .514)], 'Sack', bone='Hips', sides=8, sy=.75, cx=.138, cy=.030)
    F.lathe('Ingot', [(0, .512), (.032, .510), (.030, .522), (0, .528)], 'Metal', bone='Hips', sides=8, sy=.8, cx=.138, cy=.030)


def lasso():
    """A coiled rope at the left hip."""
    for k, (dx, r) in enumerate(((0, .068), (.008, .060))):
        pts = []
        for i in range(13):
            a = 2 * math.pi * i / 12 + .3
            pts.append(((.150 + dx, .010 + r * math.cos(a), .420 + r * math.sin(a)), .0065, 'Hips'))
        F.tube(f'Lasso{k}', pts, 'Cloth', 4, caps=(False, False))


def waist_dagger(x=.035, mat='Metal'):
    F.tube('DaggerGrip', [((x, -.098, .540), .010, 'Hips'), ((x + .018, -.096, .590), .010, 'Hips'), ((x + .022, -.095, .604), .016, 'Hips')], 'Wood', 5)
    F.tube('DaggerSheath', [((x, -.096, .530), (.016, .008), 'Hips'), ((x - .022, -.100, .420), (.006, .005), 'Hips')], 'Leather', 4)


def hip_club():
    F.tube('HipClub', [((.120, .060, .600), .011, 'Hips'), ((.130, .062, .420), .016, 'Hips'), ((.138, .064, .330), .030, 'Hips'), ((.140, .065, .300), .012, 'Hips')], 'Wood', 6)


def back_javelins():
    for k, dx in enumerate((0, .030)):
        a, b = V((.120 + dx, .100, .330)), V((-.090 + dx, .120, 1.180))
        F.tube(f'SpareJavelin{k}', [(tuple(a), .006, 'Chest'), (tuple(b), .005, 'Chest')], 'Wood', 4)
        F.tube(f'SpareJavelinHead{k}', [(tuple(b), (.012, .004), 'Chest'), (tuple(b + (b - a).normalized() * .070), .001, 'Chest')], 'Metal', 4)


def sling_and_pouch():
    F.tube('Sling', [((-.060, -.090, .525), .004, 'Hips'), ((-.085, -.102, .420), .004, 'Hips'), ((-.080, -.104, .330), .004, 'Hips')], 'Cloth', 3)
    F.box('SlingCradle', (-.080, -.106, .320), (.030, .010, .040), 'Leather', 'Hips')
    F.lathe('StonePouch', [(0, .400), (.034, .410), (.040, .450), (.024, .490), (.010, .505), (0, .506)], 'Sack', bone='Hips', sides=8, sy=.8, cx=.135, cy=.000)


def tunic_stripe(mat='Stripe'):
    F.band('TunicStripe', mat, .380, .410, .006, profile=F.SKIRT, bone='Hips')


# ---- weapons that change the kit's ------------------------------------------------------------------------------

def dagger_axe():
    """The Shang ge: the kit spear's head and socket off, a bronze blade at right angles near the top."""
    F.drop('SpearHead', 'SpearSocket')
    x, y = S.HAND_R.x, S.HAND_R.y
    top = .040 + 1.9 / 1.75 - .150
    F.tube('GeCap', [((x, y, top - .010), .012, P_R), ((x, y, top + .030), .010, P_R), ((x, y, top + .040), .004, P_R)], 'Metal', 6, attachment=True)
    prism('GeBlade', [(y + .040, top + .006), (y + .040, top - .030), (y - .010, top - .060), (y - .190, top - .040), (y - .215, top - .022), (y - .190, top - .002),
                      (y - .010, top + .018)], x, .008, 'Metal', P_R)


def wooden_staff():
    F.drop('SpearHead', 'SpearSocket')
    x, y = S.HAND_R.x, S.HAND_R.y
    top = .040 + 1.75 / 1.75 - .150
    F.tube('StaffKnob', [((x, y, top - .010), .012, P_R), ((x, y, top + .020), .020, P_R), ((x, y, top + .046), .006, P_R)], 'Wood', 6, attachment=True)


def mandolin_blade():
    """The Liaoning bronze dagger: a lute-shaped blade with a waist and a spine."""
    F.drop('SwordBlade')
    x, y = S.HAND_R.x, S.HAND_R.y
    rings = [(.652, .006, .014), (.700, .007, .030), (.760, .007, .033), (.795, .006, .017), (.830, .006, .022), (.900, .005, .013), (.950, .0015, .0015)]
    F.tube('MandolinBlade', [((x, y, z), (rx, ry), P_R) for z, rx, ry in rings], 'Metal', 4, attachment=True)


def hammer_butt():
    x, y = S.HAND_R.x, S.HAND_R.y
    top = .560 + .55
    F.box('AxeHammer', (x, y + .040, top - .060), (.026, .060, .036), 'Metal', P_R, True)


# ---- shaped shields (the kit's small round one is the placeholder: its parts go, these take its place) --------

SHIELD_PARTS = ('ShieldFace', 'ShieldBronzeRim', 'ShieldRim', 'ShieldBack', 'ShieldGrip')


def shaped_shield(outline, cz, cx=.232, cy=-.170, dome=.030, origin=(0, 0), rim='Wood', back='Wood', curve=0.):
    """A shield of any star-shaped outline ((x, z) offsets from (cx, cz)) on the left fist: its face the
    squad's Emblem, domed towards `origin`, `curve` bending its edges back (a tower shield's), a rim band,
    a back and a grip."""
    F.drop(*SHIELD_PARTS)
    hw = max(abs(x) for x, _ in outline) or 1

    def bend(x):
        return curve * (x / hw) ** 2
    n = len(outline)
    ox, oz = origin
    inner = [(ox + (x - ox) * .55, oz + (z - oz) * .55) for x, z in outline]
    fv = [(cx + ox, cy - dome, cz + oz)] + [(cx + x, cy - dome * .78 + bend(x), cz + z) for x, z in inner] + [(cx + x, cy - .012 + bend(x), cz + z) for x, z in outline]
    ff = [(0, 1 + (j + 1) % n, 1 + j) for j in range(n)]
    for j in range(n):
        a, b = 1 + j, 1 + (j + 1) % n
        ff += [(a, b, b + n), (a, b + n, a + n)]
    face = F.raw('ShieldFace', fv, ff, 'Emblem', P_L, True)
    xs, zs = [x for x, _ in outline], [z for _, z in outline]
    w, h = max(xs) - min(xs), max(zs) - min(zs)
    uv = face.data.uv_layers.active.data
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            uv[li].uv = ((co.x - cx - min(xs)) / w, (co.z - cz - min(zs)) / h)
    rv, rf = [], []
    for x, z in outline:
        d = math.hypot(x - ox, z - oz) or 1
        gx, gz = x + (x - ox) / d * .010, z + (z - oz) / d * .010
        rv += [(cx + gx, cy - .015 + bend(x), cz + gz), (cx + gx, cy + .012 + bend(x), cz + gz)]
    for j in range(n):
        a, b = 2 * j, 2 * ((j + 1) % n)
        rf += [(a, b, b + 1), (a, b + 1, a + 1)]
    F.raw('ShieldRim', rv, rf, rim, P_L, True)
    bv = [(cx + ox, cy + .016, cz + oz)] + [(cx + x, cy + .012 + bend(x), cz + z) for x, z in outline]
    F.raw('ShieldBack', bv, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)], back, P_L, True)
    F.tube('ShieldGrip', [((cx - .060, cy + .022, .612), .010, P_L), ((cx - .007, cy + .042, .612), .011, P_L), ((cx + .050, cy + .022, .612), .010, P_L)],
           'Leather', 4, attachment=True)
    F.facing.update({'ShieldFace': (0, -1, 0), 'ShieldBack': (0, 1, 0)})
    return face


def circle(r, n=20, notch=0.):
    """A round outline; `notch` cuts a V into its foot (the Herzsprung caetra) that deep (a share of r)."""
    pts = []
    for j in range(n):
        a = 2 * math.pi * j / n
        k = 1.
        if notch:
            off = abs(((a - 1.5 * math.pi + math.pi) % (2 * math.pi)) - math.pi)
            if off < .45:
                k = 1 - notch * (1 - off / .45)
        pts.append((r * k * math.cos(a), r * k * math.sin(a)))
    return pts


def boss(cz, cx=.232, cy=-.170, dome=.030, r=.050, mat='Metal', name='ShieldBoss'):
    F.tube(name, [((cx, cy - dome + .006, cz), (r, r * .95), P_L), ((cx, cy - dome - .016, cz), (r * .72, r * .7), P_L),
                  ((cx, cy - dome - .030, cz), (r * .2, r * .2), P_L)], mat, 8, attachment=True)


def figure_eight():
    out = []
    for j in range(24):
        t = 2 * math.pi * j / 24
        out.append((.160 * math.sin(t) * (1 - .40 * math.exp(-math.cos(t) ** 2 / .05)), .330 * math.cos(t)))
    shaped_shield(out, .560, dome=.050, rim='Leather', back='Hide', curve=.030)
    F.tube('FigureEightRib', [((.232, -.222, .260), (.010, .008), P_L), ((.232, -.226, .560), (.012, .010), P_L), ((.232, -.222, .860), (.010, .008), P_L)],
           'Leather', 4, attachment=True)


def tower():
    W, H = .175, .420
    pts = [(-W, -H), (0, -H - .006), (W, -H), (W, -.200), (W, .050), (W, .250)]
    base = H - W * .9
    pts += [(W * math.cos(math.radians(a)), base + W * .9 * math.sin(math.radians(a))) for a in (30, 60, 90, 120, 150)]
    pts += [(-W, .250), (-W, .050), (-W, -.200)]
    shaped_shield(pts, .500, dome=.030, rim='Leather', back='Hide', curve=.080)


def pelta():
    """The crescent wicker pelta: a round foot, two horns, a shallow notch between them."""
    W, H = .200, .130
    foot = [(W * math.sin(math.radians(a)), -H * math.cos(math.radians(a))) for a in range(-110, 111, 20)]  # left horn, round the foot, right horn
    tip = W * math.sin(math.radians(110))
    top = [(tip * t, .34 * H - .50 * H * (1 - t * t)) for t in (.6, .2, -.2, -.6)]  # the notch, right to left
    shaped_shield(foot + top, .610, dome=.024, origin=(0, -.050), rim='Wood', back='Wood')


def oxhide():
    out = []
    for j in range(16):
        t = 2 * math.pi * j / 16
        k = 1 + .13 * math.cos(4 * t)
        out.append((.150 * k * math.cos(t), .185 * k * math.sin(t)))
    shaped_shield(out, .600, dome=.020, rim='Leather', back='Hide')


def caetra():
    shaped_shield(circle(.175, 22, notch=.35), .612, dome=.032, rim='Metal', back='Wood')
    boss(.612, r=.038, dome=.032)


def urartu_shield():
    shaped_shield(circle(.205, 20), .600, dome=.034, rim='Metal', back='Wood')
    boss(.600, r=.060, dome=.034)
    F.tube('ShieldRing', [((.232 + .135 * math.cos(a), -.192, .600 + .135 * math.sin(a)), .006, P_L) for a in [2 * math.pi * i / 12 for i in range(13)]],
           'Metal', 4, caps=(False, False), attachment=True)


def shang_shield():
    W, H = .160, .245
    pts = [(-W, -H), (0, -H), (W, -H), (W, 0), (W * 1.04, H * .8), (W * .5, H * 1.02), (0, H * 1.04), (-W * .5, H * 1.02), (-W * 1.04, H * .8), (-W, 0)]
    shaped_shield(pts, .580, dome=.026, rim='Lacquer', back='Wood')


def mask_shield():
    """A round shield bearing the Sanxingdui bronze mask: a broad face, jutting eyes, wide ears."""
    cz, cy = .600, -.170 - .034
    shaped_shield(circle(.210, 20), cz, dome=.034, rim='Metal', back='Wood')
    F.box('MaskFace', (.232, cy - .006, cz), (.120, .010, .130), 'Metal', P_L, True)
    for s in (-1, 1):
        F.tube(f'MaskEye_{s}', [((.232 + s * .030, cy - .010, cz + .025), (.020, .010), P_L), ((.232 + s * .030, cy - .045, cz + .025), (.010, .006), P_L)], 'Metal', 5, attachment=True)
        F.box(f'MaskEar_{s}', (.232 + s * .078, cy - .004, cz + .015), (.040, .008, .060), 'Metal', P_L, True)
    F.box('MaskMouth', (.232, cy - .013, cz - .040), (.070, .006, .010), 'Hair', P_L, True)


# ---- recipes ----------------------------------------------------------------------------------------------------

def unit(**r):
    """A recipe with the shared extra palette; one with no dress (its own wrap, loincloth or apron) and no
    armour gets the bare skin trunk (the kit's kilt makes its own)."""
    r['colors'] = {**EXTRA, **r.get('colors', {})}
    if r.get('dress', 'kilt') == 'none' and not r.get('armour'):
        r['extras'] = [bare_torso] + list(r.get('extras', []))
    return r


RECIPES = {
    'mari': unit(name='Mari spear guard', role='infantry', colors={'Skin': 'C08A63', 'Cloth': 'EFE8D8', 'Metal': BRONZE, 'Wood': '4A3626', 'Hair': '2A1E16'},
                 legs='sandals', dress='kilt', team='sash', head=('helmet', {'peak': 1.090, 'cheeks': True}),
                 weapon=('spear', {'length': 2.4}), shield=('rect', {}),
                 look='Mari spear guard: a white fleeced kaunakes kilt, bare chest, a long beard, a tall bronze helm with cheek flaps, a long spear and a tall body shield (Emblem), a Team waist sash'),
    'akkad': unit(name='Sharur-bearing spearmen', role='infantry', colors={'Skin': 'BE8660', 'Cloth': 'E2D3AE', 'Metal': BRONZE, 'Hair': '2A1E16'},
                  legs='bare', dress='kilt', team='sash', head=('helmet', {'peak': 1.050, 'cheeks': False}),
                  weapon=('spear', {'length': 2.3, 'head': 'broad'}), shield=('round', {'size': .9}),
                  look='Akkadian spearman: a fringed kilt, bare chest, a beard, a bronze helmet, a broad-bladed spear and a round shield (Emblem), a Team waist sash'),
    'elam': unit(name='Elamite archers', role='ranged', colors={'Skin': 'B07A55', 'Cloth': 'D8C9A4', 'Leather': '6E4A30', 'Hair': '241A14'},
                 legs='sandals', dress='robe', team='top', head=('headband', {'mat': 'Cloth'}),
                 weapon=('bow', {'length': .95, 'recurve': .02}),
                 look='Elamite archer: a long fringed robe with a Team top, a headband, a beard, a big self bow and a quiver'),
    'kanesh': unit(name='Old Assyrian karum caravan guards', role='infantry',
                   colors={'Skin': 'C08A63', 'Cloth': 'C9B58C', 'Leather': '7A5236', 'Metal': BRONZE, 'Felt': '7E5E40', 'Hair': '2A1E16'},
                   legs='sandals', dress='tunic', team='sash', head=('cap', {'mat': 'Felt', 'height': 1.160}),
                   weapon=('spear', {'length': 2.0}), extras=[pack, cylinder_seal, lambda: fringe('TunicFringe', 'Leather', .370, .325, 12)],
                   look='Old Assyrian caravan guard: a fringed travelling tunic, a tall pointed felt cap, a beard, a spear, a leather pack and bedroll, a cylinder seal at the belt, a Team sash'),
    'phrygia': unit(name='Phrygian peltasts', role='ranged', colors={'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Wood': '6A4A30', 'Trews': '8E4A34'},
                    legs=('hose', 'Trews'), dress='trousers', team=None, head=('phrygian', {'mat': 'Team'}),
                    weapon=('javelin', {'length': 1.6, 'head': 'narrow'}), shield=('small', {}), extras=[pelta],
                    look='Phrygian peltast: a Team Phrygian cap with its peak bent forward, patterned trousers and a short tunic, a javelin, a crescent pelta shield (Emblem)'),
    'urartu': unit(name='Urartian fortress spearmen', role='infantry', colors={'Skin': 'C49070', 'Cloth': 'D9CDA8', 'Metal': BRONZE, 'Leather': '5E4030'},
                   legs='sandals', dress='kilt', armour='leather', team='sash', head=None, beard=True,
                   weapon=('spear', {'length': 2.5}), shield=('small', {}), extras=[cone_helm, urartu_shield, belt],
                   look='Urartian spearman: a tall conical bronze helmet with a Team crest arching over it, a leather corselet over a kilt, a long spear, a round bronze-rimmed shield with a big boss (Emblem)'),
    'colchis': unit(name='Colchian oxhide-shield spearmen', role='infantry', colors={'Skin': 'C99472', 'Leather': '8B5A34', 'Wood': '6C4A2E', 'Metal': BRONZE, 'Hide': 'C8B090'},
                    legs=('boots', 'Leather'), dress='tunic', team='top', head=('helmet', {'mat': 'Wood', 'peak': 1.010, 'cheeks': False, 'neck': False}),
                    weapon=('spear', {'length': 1.8}), shield=('small', {}), extras=[oxhide, lambda: F.hip_sword(length=.34)],
                    look='Colchian spearman: a Team tunic, a low wooden helmet, leather boots, a short spear, a small raw-oxhide shield (Emblem), a short sword at the hip'),
    'magan': unit(name='Maganite copper-spear guards', role='infantry', colors={'Skin': 'A86E48', 'Metal': COPPER, 'Cloth': 'D8CBA6', 'Hair': '1E1610'},
                  legs='bare', dress='kilt', team='sash', head=None, hair='full', beard=True,
                  weapon=('spear', {'length': 2.2, 'head': 'broad'}), shield=('round', {'size': 1.05, 'rim': 'Metal'}), extras=[ingot_sack],
                  look='Maganite guard: bare-headed and bearded, bare chest, a short kilt, a copper broad-bladed spear and a big copper-rimmed round shield (Emblem), a sack of copper ingots at the hip'),
    'dilmun': unit(name='Dilmun copper-spear guards', role='ranged', colors={'Skin': 'B07A55', 'Metal': COPPER, 'Cloth': 'F0E8D4', 'Hair': '241A14'},
                   legs='sandals', dress='none', team=None, head=('headcloth', {'band': 'Team'}), beard=False,
                   weapon=('javelin', {'length': 1.6}), shield=('small', {'rim': 'Metal'}),
                   extras=[lambda: skirt_wrap('WrapKilt', 'Cloth', .400, flap=.360), back_javelins],
                   look='Dilmun guard: a short wrapped kilt, a white headcloth under a Team band, copper javelins (two more on the back), a small round shield (Emblem)'),
    'kerma': unit(name='Kerma long-bow archers', role='ranged', colors={'Skin': '6E4630', 'Leather': '5C3D26', 'Cloth': 'EEE6D2', 'Hair': '1A1410'},
                  legs='bare', dress='kilt', dress_mat='Leather', team='sash', head=None, beard=False,
                  weapon=('bow', {'length': 1.15}), extras=[kerma_feathers, lambda: ring_on('WristGuard', 'Forearm_L', .55, .034, .080, 'Bone')],
                  look='Kerma archer: bare chest, a leather kilt, a leather skullcap with two ostrich plumes, a very long self bow, an ivory wrist guard, a Team sash'),
    'libu': unit(name='Libu feather-cloaked javelinmen', role='infantry', colors={'Skin': 'C8946E', 'Leather': '8A6040', 'Cloth': 'ECE3CC', 'Wood': '4A3626', 'Hair': '1E1610',
                                                                                    'Hide': '9A6A40'},
                 legs='bare', dress='kilt', team='sash', head=None, hair='full', beard=True,
                 weapon=('javelin', {'length': 1.7, 'head': 'narrow'}),
                 extras=[libu_feather_lock, lambda: cloak('Hide', low=.120, name='LongCloak', width=(.122, .230)), tattoo_bands],
                 look='Libu javelinman: a tall feather in the hair, a side-lock, a long open leather cloak to the ankle, tattooed arms and thighs, a short kilt, a javelin, a Team sash'),
    'keftiu': unit(name='Minoan figure-eight-shield spearmen', role='infantry', colors={'Skin': 'C48A62', 'Cloth': 'EFE6CF', 'Leather': '7A5236', 'Metal': BRONZE, 'Hair': '1E1610'},
                   legs='bare', dress='kilt', team='sash', head=None, hair='nape', beard=False,
                   weapon=('spear', {'length': 2.7}), shield=('small', {}),
                   extras=[lambda: boar_tusk(cheeks=False, plume='Team'), minoan_locks, figure_eight, lambda: belt('Metal', .490, .512, .016),
                           lambda: F.hip_sword(length=.40)],
                   look='Minoan spearman: a boar-tusk helmet with a Team plume, long locks down the back, clean-shaven, a waist-cinched kilt with a bronze belt, a long spear, a tall figure-eight shield (Emblem), a sword at the hip'),
    'ahhiyawa': unit(name='Mycenaean boar-tusk helmet spearmen', role='infantry', colors={'Skin': 'C99472', 'Cloth': 'EFE6CF', 'Leather': '6E4A30', 'Metal': BRONZE, 'Hair': '2A1E16'},
                     legs='sandals', dress='tunic', armour='leather', team='shawl', head=None, beard=True,
                     weapon=('spear', {'length': 2.9}), shield=('small', {}),
                     extras=[lambda: boar_tusk(crest='Hair', cheeks=True), tower, lambda: F.greaves('Metal')],
                     look='Mycenaean spearman: a boar-tusk helmet with cheek guards and a black horsehair crest, a leather corselet and a Team shawl, bronze greaves, a very long spear, a tall tower shield (Emblem)'),
    'tartessos': unit(name='Tartessian horned-helmet warriors', role='infantry', colors={'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Metal': BRONZE, 'Wood': '5A4130'},
                      legs='sandals', dress='tunic', team='sash', head=('helmet', {'peak': 1.030, 'cheeks': False, 'neck': False}), beard=True,
                      weapon=('spear', {'length': 2.0}), shield=('small', {}), extras=[long_horns, caetra, lambda: F.hip_sword(length=.40)],
                      look='Tartessian warrior: a bronze helmet with long lyre horns, a tunic, a spear, a round caetra with a V-notch and a boss (Emblem), a sword at the hip, a Team sash'),
    'cucuteni': unit(name='Cucuteni copper-axe warriors', role='infantry', colors={'Skin': 'CDA07C', 'Leather': '7E5A3A', 'Metal': COPPER, 'Cloth': 'D7C8A2', 'Hair': '3A2A1C',
                                                                                     'Hide': 'B09068'},
                     legs='bare', dress='tunic', dress_mat='Leather', team='sash', head=None, hair='full', beard=True,
                     weapon=('axe', {'length': .55}), shield=('oval', {'size': .85, 'rim': 'Leather', 'back': 'Hide'}),
                     extras=[hammer_butt, lambda: cloak('Hide', low=.340, name='HideCloak')],
                     look='Cucuteni warrior: Copper Age, bare-headed and bearded, a leather tunic, a hide cloak, a copper hammer-axe, an oval hide shield (Emblem), a Team sash'),
    'botai': unit(name='Botai horse-corral hunters', role='infantry', colors={'Skin': 'CDA07C', 'Leather': '80603F', 'Cloth': 'C8B68F', 'Hide': '9A7A52', 'Fur': '5A4430'},
                  legs=('hose', 'Hide', 'Fur'), sleeves='Leather', dress='robe', dress_mat='Leather', team='sash', head=None, beard=True,
                  weapon=('spear', {'length': 1.5, 'mat': 'Stone'}), extras=[fur_cap, lasso],
                  look='Botai hunter: a long hide coat with sleeves, hide leggings and fur boots, a fur cap with ear flaps, a short stone-tipped spear, a coiled lasso at the hip, a Team sash'),
    'meluhha': unit(name='Meluhhan bowmen', role='ranged', colors={'Skin': 'A87250', 'Cloth': 'EDE4CC', 'Metal': COPPER, 'Wood': '3E2C20', 'Hair': '1A120C'},
                    legs='bare', dress='kilt', team='shawl', head=None, hair='full', beard=True,
                    weapon=('bow', {'length': .90}), extras=[hair_bun, lambda: armlets('Bone', wrists=2), lambda: waist_dagger(.045)],
                    look='Meluhhan bowman: a white cloth kilt, a Team shawl over the left shoulder, a hair bun and fillet, a trimmed beard, shell armlets and bangles, a bow, a copper dagger at the waist'),
    'saurashtra': unit(name='Saurashtran sea-trader guards', role='infantry', colors={'Skin': 'A06A48', 'Cloth': 'EEE5CF', 'Metal': BRONZE, 'Hair': '1A120C', 'Leather': '6A4630'},
                       legs='bare', dress='none', team=None, head=('turban', {'mat': 'Team'}), beard=True,
                       weapon=('sword', {'length': .42}), shield=('small', {'size': 1.1}),
                       extras=[lambda: skirt_wrap('Dhoti', 'Cloth', .190, flap=.220), lambda: belt('Leather', .505, .535), lambda: armlets('Metal', upper=False, wrists=3),
                               lambda: boss(.612, cx=.225, cy=-.160, dome=.036, r=.040)],
                       look='Saurashtran guard: a long belted dhoti, bare chest, a Team turban, a beard, coiled bronze bracelets, a bronze sword and a small bossed round shield (Emblem)'),
    'shang': unit(name='Shang dagger-axe warriors', role='infantry', colors={'Skin': 'D2A47E', 'Leather': '5E2E22', 'Metal': BRONZE, 'Cloth': 'D8CBA6', 'Lacquer': '7A2418', 'Hair': '1A1410'},
                  legs='sandals', dress='tunic', armour='leather', armour_mat='Lacquer', team='sash', head=('helmet', {'peak': 1.040, 'cheeks': True}), beard=False,
                  weapon=('spear', {'length': 1.9}), shield=('small', {}), extras=[dagger_axe, shang_crown, shang_shield],
                  look='Shang warrior: a bronze helmet with a plume tube and a Team tassel, a red lacquered leather vest, a bronze dagger-axe (ge), a tall rectangular tiger shield (Emblem), a Team sash'),
    'shu': unit(name='Shu spearmen of Sanxingdui', role='infantry', colors={'Skin': 'D2A47E', 'Cloth': 'CDBF9B', 'Metal': BRONZE, 'Hair': '1A1410'},
                legs='bare', dress='tunic', team='top', head=('headband', {'mat': 'Cloth'}), hair='full', beard=False,
                weapon=('spear', {'length': 2.6}), shield=('small', {}), extras=[braid, mask_shield],
                look='Shu spearman: a plain Team tunic, a headband and a long braid down the back, a long spear, a round shield bearing the Sanxingdui bronze mask (Emblem)'),
    'gojoseon': unit(name='Gojoseon mandolin-dagger warriors', role='infantry', colors={'Skin': 'D2A47E', 'Cloth': 'F0EADA', 'Metal': BRONZE, 'Wood': '2E241C', 'Leather': '4A3426',
                                                                                         'Hair': '14100C'},
                     legs=('boots', 'Leather'), sleeves='Cloth', dress='tunic', team='sash', head=None, hair='full', beard=True,
                     weapon=('sword', {'length': .32}), shield=('small', {'size': .85, 'rim': 'Wood'}), extras=[mandolin_blade, topknot],
                     look='Gojoseon warrior: a long-sleeved white tunic with a Team belt-sash, leather boots, a topknot with a pin, a bronze mandolin-shaped dagger, a small round shield (Emblem)'),
    'van-lang': unit(name='Van Lang bronze-drum archers', role='ranged', colors={'Skin': 'B98258', 'Cloth': 'EDE4CC', 'Wood': '5A4130', 'Feather': 'D8C8A0', 'Hair': '1A1410'},
                     legs='bare', dress='none', team=None, head=('feathers', {'n': 9, 'tall': .22, 'mat': 'Feather', 'band': 'Team'}), hair='full', beard=False,
                     weapon=('bow', {'length': .82, 'recurve': .03}), extras=[lambda: skirt_wrap('Loincloth', 'Cloth', .440, flap=.300), tattoo_bands],
                     look='Van Lang archer: a tall feather crown on a Team band (the Dong Son drums), a loincloth with a long front flap, tattooed arms and thighs, a bow (the roster\'s crossbow: no crossbow clips yet)'),
    'tichitt': unit(name='Tichitt stone-village archers', role='ranged', colors={'Skin': '7A4E34', 'Leather': '7E5A3A', 'Cloth': 'DCCFAE', 'Hide': 'A08060', 'Hair': '1A1410'},
                    legs='sandals', dress='tunic', team='shawl', head=('cap', {'mat': 'Leather', 'height': 1.030}), beard=True,
                    weapon=('bow', {'length': .88}), extras=[lambda: cloak('Hide', low=.500, name='HideCloak')],
                    look='Tichitt archer: a low leather cap, a tunic with a Team shawl, a light hide cloak, a bow and a quiver'),
    'punt': unit(name='Puntite dagger guards', role='ranged', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Leather': 'A37A4A', 'Metal': BRONZE, 'Wood': '2E241C', 'Hide': 'C89A4E',
                                                                    'Hair': '1A1410'},
                 legs='bare', dress='kilt', team='sash', head=None, hair='full', beard=False,
                 weapon=('javelin', {'length': 1.6}),
                 extras=[goatee, lambda: cloak('Hide', low=.520, name='SkinCape'), lambda: waist_dagger(-.020),
                         lambda: F.sheet('SashEnd', (.040, -.082, .530), (.075, -.074, .530), (.085, -.096, .300), (.040, -.104, .300), .007, 'Team', 'Spine')],
                 look='Puntite guard: a kilt with a long Team sash end, a long pointed beard, an animal-skin cape, a dagger in the waistband, a javelin'),
    'caral': unit(name='Caral temple-city guards', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'E9DFC4', 'Wood': '5A4130', 'Hair': '1A1410'},
                  legs='bare', dress='tunic', team='top', head=('headband', {'mat': 'Stripe'}), hair='full', beard=False,
                  weapon=('spear', {'length': 1.75, 'mat': 'Wood'}), extras=[wooden_staff, sling_and_pouch, tunic_stripe],
                  look='Caral guard: a woven cotton tunic with a Team top and a red stripe, a red headband, a wooden staff, a sling and a pouch of stones at the belt'),
    'lapita': unit(name='Lapita canoe spearmen', role='infantry', colors={'Skin': '9C6A48', 'Cloth': 'D9C7A0', 'Wood': '5A4130', 'Hair': '1A1410', 'Tapa': 'C09868'},
                   legs='bare', dress='none', team='sash', head=None, hair='full', beard=True,
                   weapon=('spear', {'length': 2.3, 'mat': 'Wood', 'head': 'narrow'}),
                   extras=[lambda: skirt_wrap('Tapa', 'Tapa', .360), lambda: F.band('TapaBand', 'Ink', .385, .410, .006, profile=F.SKIRT, bone='Hips'),
                           lambda: armlets('Bone'), hip_club],
                   look='Lapita spearman: a tapa-cloth kilt with a dark dentate band, shell armlets, a wood-pointed spear, a war club at the hip, a Team sash'),
    'wahgi': unit(name='Wahgi bamboo-arrow archers', role='ranged', colors={'Skin': '6E4630', 'Cloth': 'E8D9B0', 'Leather': '6B4A30', 'Bark': '7A5E40', 'Hair': '14100C'},
                  legs='bare', dress='none', team=None, head=None, hair='full', beard=True,
                  weapon=('bow', {'length': 1.05}),
                  extras=[plume_fan, face_paint, lambda: skirt_wrap('Apron', 'Cloth', .450, flap=.300), lambda: cloak('Bark', low=.420, name='BarkCape')],
                  look='Wahgi archer: a fan of black and orange plumes on a Team headband, a red and yellow painted face, a woven apron, a bark cape, a long bow'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        S.foot(m, RECIPES[m])
