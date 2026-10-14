# scripts/blender/ti_figure.py
# The shared parts of the unit quality pass of 2026-10-13 (first done by hand in
# build_bronze_infantry.py, then lifted here for build_bronze_ranged.py and build_bronze_worker.py):
#   - start(): the canonical rig of ti_units.py and the flat palette
#   - tube / box / raw / vertical: one mesh object per part, registered in `meshes`
#   - legs(), arms(), fist(), head(), beard(), headcloth(), tufted_hem(): the parts people share
#     (shaped head with eyes and brows, fists that close round what the hand holds, sandals), after
#     the reference sheets plans/art/concepts/oct13 (design reference only)
#   - reach(), bake_rest(): pose an arm to a point and make that the rest pose
#   - fix_normals(): consistent outward normals
#   - bake_shade(): ambient occlusion and a ground-to-head gradient in COLOR_0 (the battle shader
#     shades Team cloth and skin with it: src/battle/render/gltfUnitLoader.js)
#   - export_glb(): the GLB with COLOR_0; preview(): workbench stills for a first look
# Added for the Classical foot units (2026-10-14, build_classical_*.py; they export the rest pose only):
#   - torso(), skirt(), strips() (pteruges), greaves(), boots, hair(), ridge() (a crest), helmet(),
#     oval_shield(), finish_rest()
# Blender Z up, the front faces -Y, a standing person is 1 tall.
import bpy, bmesh, math, random, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import ti_units as u

arm = None
meshes = []
PALETTE = {'Hair': '2B201A', 'Leather': '6A3D27', 'Metal': 'C9994F', 'Wood': '7A5636', 'Cloth': 'EADFC6'}


def start(colors=None, ready=True):
    """An empty scene, the palette (PALETTE plus `colors`) and the canonical rig."""
    global arm
    bpy.ops.wm.read_factory_settings(use_empty=True)
    meshes.clear()
    facing.clear()
    radial.clear()
    colors = colors or {}
    u.COLORS.update(PALETTE)
    u.COLORS.update({k: v if isinstance(v, str) else v[0] for k, v in colors.items()})
    u.palette()
    u.set_colors({k: v for k, v in colors.items() if not isinstance(v, str)})  # (hex, roughness, metallic)
    arm = u.rig(ready=ready)
    return arm


def tube(name, rings, mat, sides=8, caps=(True, True), attachment=False):
    """Rings of (centre, (rx, ry) or r, weight) joined into a tube; caps close the first / last ring.
    For a vertical tube rx is the half width (X) and ry the half depth (Y); vertex 0 faces -Y."""
    verts, faces, vw = [], [], []
    n = len(rings)
    for i, (centre, rad, wt) in enumerate(rings):
        c = Vector(centre)
        d = Vector(rings[min(n - 1, i + 1)][0]) - Vector(rings[max(0, i - 1)][0])
        d.normalize()
        a0 = Vector((0, -1, 0))
        a0 -= d * a0.dot(d)
        if a0.length < .05:
            a0 = Vector((1, 0, 0))
            a0 -= d * a0.dot(d)
        a0.normalize()
        a1 = d.cross(a0).normalized()
        rx, ry = (rad, rad) if isinstance(rad, (int, float)) else rad
        w = {wt: 1} if isinstance(wt, str) else wt
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append(tuple(c + a0 * math.cos(a) * ry + a1 * math.sin(a) * rx))
            vw.append(w)
        if i:
            for j in range(sides):
                p, q = (i - 1) * sides + j, (i - 1) * sides + (j + 1) % sides
                faces += [(p, q, i * sides + (j + 1) % sides), (p, i * sides + (j + 1) % sides, i * sides + j)]
    for end, on in ((0, caps[0]), (n - 1, caps[1])):
        if not on:
            continue
        idx = len(verts)
        verts.append(tuple(rings[end][0]))
        vw.append(vw[end * sides])
        for j in range(sides):
            p, q = end * sides + j, end * sides + (j + 1) % sides
            faces.append((idx, q, p) if end == 0 else (idx, p, q))
    ob = u.mesh_obj(name, verts, faces, mat, weights=vw, arm=arm, attachment=attachment)
    meshes.append(ob)
    return ob


def box(name, centre, size, mat, bone, attachment=False):
    ob = u.box(name, centre, size, mat, bone, arm, attachment)
    meshes.append(ob)
    return ob


def raw(name, verts, faces, mat, bone, attachment=False):
    ob = u.mesh_obj(name, verts, faces, mat, bone, attachment, arm=arm)
    meshes.append(ob)
    return ob


def vertical(zs, cy, radii, weights, cx=0):
    """Rings up the Z axis: zs, the centre's Y per ring (or one number), (rx, ry) per ring."""
    cys = cy if isinstance(cy, (list, tuple)) else [cy] * len(zs)
    ws = weights if isinstance(weights, (list, tuple)) else [weights] * len(zs)
    return [((cx, cys[i], zs[i]), radii[i], ws[i]) for i in range(len(zs))]


def legs(laces=True, boots=None):
    """Bare legs and feet in leather sandals (laced up the calf or not); `boots` is a material for
    closed ankle boots instead of the sandals."""
    for side, s in (('L', 1), ('R', -1)):
        L, S, F = 'Leg_' + side, 'Shin_' + side, 'Foot_' + side
        if boots:
            tube('BodyLeg_' + side, [
                ((s * .061, 0, .470), (.053, .050), L), ((s * .070, -.003, .320), (.040, .039), L), ((s * .071, -.012, .268), (.034, .036), {L: .6, S: .4}),
                ((s * .071, -.014, .250), (.033, .036), {L: .4, S: .6}), ((s * .073, .004, .200), (.039, .040), S),
                ((s * .074, .005, .120), (.028, .029), S)], 'Skin', 7, caps=(False, False))
            tube('Boot_' + side, [((s * .074, .005, .138), (.035, .036), S), ((s * .074, .005, .122), (.035, .036), S), ((s * .074, .004, .060), (.027, .030), F),
                                  ((s * .074, .010, .004), (.030, .036), F)], boots, 7, caps=(False, True))
            tube('BootFoot_' + side, [((s * .074, .020, .030), (.026, .030), F), ((s * .074, -.050, .028), (.036, .028), F),
                                      ((s * .074, -.112, .016), (.029, .016), F)], boots, 6)
            continue
        tube('BodyLeg_' + side, [
            ((s * .061, 0, .470), (.053, .050), L), ((s * .070, -.003, .320), (.040, .039), L), ((s * .071, -.012, .268), (.034, .036), {L: .6, S: .4}),
            ((s * .071, -.014, .250), (.033, .036), {L: .4, S: .6}), ((s * .073, .004, .200), (.039, .040), S),
            ((s * .074, .005, .095), (.026, .027), S),
            ((s * .074, .001, .050), (.021, .023), F)], 'Skin', 7, caps=(False, False))
        tube('BodyFoot_' + side, [
            ((s * .074, .020, .028), (.021, .022), F), ((s * .074, -.045, .027), (.033, .024), F), ((s * .074, -.108, .017), (.028, .012), F)], 'Skin', 6)
        box('SandalSole_' + side, (s * .074, -.042, .007), (.072, .146, .014), 'Leather', F)
        tube('SandalToeStrap_' + side, [((s * .074 - .037, -.072, .020), .009, F), ((s * .074, -.072, .043), .009, F),
                                        ((s * .074 + .037, -.072, .020), .009, F)], 'Leather', 4)
        tube('SandalAnkle_' + side, [((s * .074, .002, .052), (.026, .029), F), ((s * .074, .002, .070), (.025, .028), F)],
             'Leather', 8, caps=(False, False))
        if laces:
            tube('SandalLace_' + side, [((s * .074, .006, .111), .033, S), ((s * .074, .006, .125), .033, S)],
                 'Leather', 8, caps=(False, False))


def arms(sleeve=None, shoulder=None):
    """Bare arms; `sleeve` is a material for a short sleeve, `shoulder` one for a cap over the
    shoulder (Skin for a bare deltoid). Returns {side: (shoulder, elbow, wrist)}."""
    bone = arm.data.bones
    out = {}
    for side, s in (('L', 1), ('R', -1)):
        A, FA, H = 'Arm_' + side, 'Forearm_' + side, 'Hand_' + side
        sh, el, wr = bone[A].head_local.copy(), bone[FA].head_local.copy(), bone[H].head_local.copy()
        out[side] = (sh, el, wr)
        tube('BodyArm_' + side, [
            (tuple(sh), (.043, .040), A), (tuple(sh.lerp(el, .55)), (.039, .036), A),
            (tuple(el), (.032, .032), {A: .5, FA: .5}), (tuple(el.lerp(wr, .30)), (.035, .032), FA),
            (tuple(el.lerp(wr, .75)), (.027, .026), FA), (tuple(wr), (.022, .024), H)], 'Skin', 7, caps=(False, False))
        if sleeve:
            tube('short-sleeve-' + side, [(tuple(sh.lerp(el, -.05)), (.050, .046), A), (tuple(sh.lerp(el, .30)), (.049, .044), A),
                                          (tuple(sh.lerp(el, .52)), (.047, .043), A)], sleeve, 6, caps=(True, False))
        if shoulder:
            top = sh + Vector((s * .004, 0, .012))
            tube('Shoulder_' + side, [(tuple(top + Vector((-s * .030, 0, .012))), (.036, .042), 'Chest'), (tuple(top), (.047, .045), A),
                                      (tuple(top.lerp(el, .22)), (.046, .043), A)], shoulder, 6, caps=(True, False))
    return out


def fist(side, grip, axis=(0, 0, 1), half=.027):
    """A closed fist at `grip` round a shaft that runs along `axis`."""
    H = 'Hand_' + side
    wr = arm.data.bones[H].head_local.copy()
    grip = Vector(grip)
    ax = Vector(axis).normalized()
    tube('BodyHand_' + side, [(tuple(wr), (.022, .024), H),
                              (tuple(grip), (.027, .030), H), (tuple(grip + (grip - wr).normalized() * .016), (.018, .024), H)], 'Skin', 6)
    c = grip + Vector((0, -.004, 0))
    tube('Fingers_' + side, [(tuple(c - ax * half), (.024, .024), H), (tuple(c + ax * half), (.024, .024), H)], 'Skin', 6)


def head(ears=True):
    """Neck and a shaped head: jaw, cheeks, brow, nose, ears, eyes and eyebrows (`ears` off under a
    helmet that covers them)."""
    tube('BodyNeck', vertical([.770, .815, .850], [0, -.002, -.004], [(.044, .040), (.036, .034), (.037, .036)], 'Neck'), 'Skin', 6, caps=(False, False))
    tube('BodyHead', vertical([.838, .850, .868, .892, .920, .950, .990],
                              [-.026, -.017, -.012, -.009, -.007, -.005, -.002],
                              [(.016, .016), (.036, .036), (.047, .047), (.055, .053), (.058, .055), (.058, .056), (.034, .033)],
                              'Head'), 'Skin', 10)
    raw('FaceNose', [(-.014, -.060, .932), (.014, -.060, .932), (-.015, -.064, .896), (.015, -.064, .896), (0, -.084, .902)],
        [(0, 1, 4), (0, 4, 2), (1, 3, 4), (2, 4, 3), (0, 2, 3), (0, 3, 1)], 'Skin', 'Head')
    for s in (-1, 1):
        if ears:
            tube(f'Ear_{s}', [((s * .056, .002, .900), (.010, .012), 'Head'), ((s * .064, .004, .918), (.010, .015), 'Head'),
                              ((s * .056, .002, .938), (.010, .011), 'Head')], 'Skin', 4)
        box(f'FaceEye_{s}', (s * .024, -.0585, .924), (.012, .008, .007), 'Hair', 'Head')
        box(f'FaceBrow_{s}', (s * .025, -.0600, .940), (.026, .010, .008), 'Hair', 'Head')


def beard():
    """A short full beard: a dark shell round the jaw and chin, up to under the nose."""
    b = tube('Beard', vertical([.834, .847, .868, .894], [-.031, -.022, -.016, -.012],
                               [(.014, .015), (.039, .039), (.051, .050), (.0585, .0555)], 'Head'), 'Hair', 8, caps=(True, False))
    for j in (3, 4, 5):  # the back of the jaw stays clear of the neck
        b.data.vertices[3 * 8 + j].co.z -= .014
    for j, drop in ((0, .022), (1, .014), (7, .014)):  # the mouth and the cheeks stay bare
        b.data.vertices[3 * 8 + j].co.z -= drop
    return b


def headcloth(band, tail=True):
    """A linen headcloth (a low dome, a flap down the neck) under a band of the material `band`."""
    if tail:
        tube('HeadclothTail', vertical([.842, .880, .920, .950], [.026, .016, .008, .004], [(.056, .036), (.064, .052), (.066, .058), (.065, .059)], 'Head'),
             'Cloth', 8, caps=(True, False))
    tube('LinenHeadcloth', vertical([.944, .966, .990, 1.006], -.003, [(.066, .062), (.063, .059), (.047, .044), (.018, .018)], 'Head'),
         'Cloth', 10, caps=(True, True))
    tube('Headband', vertical([.945, .966], -.003, [(.0705, .0665), (.0690, .0650)], 'Head'), band, 10, caps=(False, False))


def tufted_hem(name='KiltHem'):
    """The pale tufted hem of the kilt (the spearman's): every second point hangs lower."""
    hem = tube(name, vertical([.300, .318, .336], 0, [(.141, .103), (.140, .101), (.138, .0995)], 'Hips'), 'Cloth', 12, caps=(False, False))
    for i in range(12):
        if i % 2:
            hem.data.vertices[i].co.z -= .014
    return hem


# ---- Classical parts (2026-10-14) ----------------------------------------------------------------
# (z, half width, half depth) up the trunk and down the skirt: what every garment wraps
TORSO = [(.535, .092, .064), (.575, .089, .063), (.615, .090, .065), (.655, .101, .071), (.695, .117, .077),
         (.735, .132, .080), (.762, .128, .074), (.790, .072, .050)]
SKIRT = [(.335, .136, .098), (.385, .129, .093), (.450, .117, .085), (.515, .101, .073), (.548, .090, .064)]
facing = {}   # open sheets: {object name: the way it faces}, for fix_normals
radial = set()  # objects made of loose sheets round the body: every face points away from the Z axis


def radius_at(z, profile):
    """(half width, half depth) of a (z, rx, ry) profile at height z (the first span carries on below it)."""
    for (z0, x0, y0), (z1, x1, y1) in zip(profile, profile[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    return profile[-1][1], profile[-1][2]


def torso(name, mat, grow=0, chest=0, sides=10, profile=TORSO):
    """The trunk from the waist to the collar as one tube (a tunic, a corselet, a cuirass, bare skin).
    `grow` widens it over what it covers; `chest` pushes the front of the chest rings forward."""
    ob = tube(name, [((0, 0, z), (rx + grow, ry + grow), 'Spine' if z < .66 else 'Chest') for z, rx, ry in profile], mat, sides, caps=(False, True))
    if chest:
        for i, (z, _, _) in enumerate(profile):
            if .68 < z < .75:
                for j in (sides - 1, 0, 1):
                    ob.data.vertices[i * sides + j].co.y -= chest
    return ob


def skirt(name, mat, low=.335, top=.548, grow=0, sides=10, bone='Hips'):
    """A tunic's skirt or a kilt from `top` down to `low`."""
    zs = [low] + [z for z, _, _ in SKIRT if low + .02 < z < top - .01] + [top]
    return tube(name, [((0, 0, z), tuple(r + grow for r in radius_at(z, SKIRT)), bone) for z in zs], mat, sides, caps=(False, False))


def band(name, mat, z0, z1, grow, profile=TORSO, bone='Spine', sides=10, bulge=.004):
    """A belt or a sash round the trunk (or the skirt) between two heights, a little proud in the middle."""
    zs = [z0, (z0 + z1) / 2, z1]
    rs = [tuple(r + grow + (bulge if i == 1 else 0) for r in radius_at(z, profile)) for i, z in enumerate(zs)]
    return tube(name, vertical(zs, 0, rs, bone), mat, sides, caps=(False, False))


def strips(name, mat, top, bottom, n=12, grow=.008, gap=.26, phase=0., flare=.004, bone='Hips'):
    """A row of hanging strips round the skirt (pteruges): n sheets from `top` down to `bottom`."""
    verts, faces = [], []
    for k in range(n):
        a0, a1 = 2 * math.pi * (k + phase + gap / 2) / n, 2 * math.pi * (k + phase + 1 - gap / 2) / n
        for z, g in ((top, grow), (bottom, grow + flare)):
            rx, ry = radius_at(z, SKIRT)
            verts += [((rx + g) * math.sin(a), -(ry + g) * math.cos(a), z) for a in (a0, a1)]
        b = k * 4
        faces += [(b, b + 1, b + 3), (b, b + 3, b + 2)]
    radial.add(name)
    return raw(name, verts, faces, mat, bone)


def slab(name, corners, mat, bone, depth=.008, attachment=False):
    """A thin flat piece (a sash end, a flap, a plank) from four corners given clockwise seen from
    the front; `depth` is its thickness towards the back (+Y)."""
    verts = [tuple(c) for c in corners] + [(c[0], c[1] + depth, c[2]) for c in corners]
    faces = [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)]
    return raw(name, verts, faces, mat, bone, attachment)


def greaves(mat='Metal'):
    """Shin guards from the ankle to over the knee."""
    for side, s in (('L', 1), ('R', -1)):
        L, S = 'Leg_' + side, 'Shin_' + side
        tube('Greave_' + side, [((s * .074, .005, .098), (.031, .032), S), ((s * .073, .003, .200), (.045, .046), S),
                                ((s * .071, -.014, .256), (.040, .044), {L: .4, S: .6}), ((s * .071, -.013, .284), (.033, .040), L)],
             mat, 7, caps=(False, False))


def hair(mat='Hair', crown=True):
    """Short hair: the nape and, with `crown`, the top of the head (a bare head, a headband)."""
    tube('HairNape', vertical([.868, .888, .920, .950], [.018, .014, .008, .004], [(.046, .040), (.061, .052), (.064, .057), (.063, .058)], 'Head'),
         mat, 8, caps=(True, False))
    if crown:
        tube('HairCrown', vertical([.944, .966, .990, 1.004], -.003, [(.0635, .0605), (.062, .058), (.046, .043), (.016, .016)], 'Head'),
             mat, 10, caps=(False, True))


def headband(mat, z=.955, height=.024):
    """A band round the brow (over hair() or a cap)."""
    return tube('Headband', vertical([z - height / 2, z + height / 2], -.003, [(.0690, .0655), (.0675, .0640)], 'Head'), mat, 10, caps=(False, False))


def ridge(name, stations, mat, bone='Head', half=(.014, .018), attachment=False):
    """A crest or a fin standing in the YZ plane: stations of (y, z of its foot, z of its top);
    `half` is its half thickness at the foot and at the top."""
    verts, faces = [], []
    for y, z0, z1 in stations:
        verts += [(-half[0], y, z0), (half[0], y, z0), (half[1], y, z1), (-half[1], y, z1)]
    for i in range(len(stations) - 1):
        a, b = i * 4, i * 4 + 4
        for k in range(4):
            faces += [(a + k, a + (k + 1) % 4, b + (k + 1) % 4), (a + k, b + (k + 1) % 4, b + k)]
    e = (len(stations) - 1) * 4
    faces += [(0, 1, 2), (0, 2, 3), (e, e + 2, e + 1), (e, e + 3, e + 2)]
    return raw(name, verts, faces, mat, bone, attachment)


def helmet(mat='Metal', cheeks=True, neck=True, name='Helmet', peak=1.036):
    """A bowl helmet with a flared rim, and with them a neck guard over the nape and the ears and
    two cheek pieces. `peak` is its top."""
    k = (peak - .944) / .092
    tube(name, vertical([.944, .952, .966, .944 + .051 * k, .944 + .076 * k, peak], -.003,
                        [(.070, .066), (.0745, .070), (.069, .065), (.058, .055), (.036, .034), (.008, .008)], 'Head'), mat, 10, caps=(True, True))
    if neck:
        tube(name + 'Neck', vertical([.872, .905, .948], [.024, .013, .004], [(.060, .044), (.066, .056), (.068, .062)], 'Head'), mat, 8, caps=(True, False))
    if cheeks:
        for s in (-1, 1):
            box(f'CheekPiece_{s}', (s * .0575, -.035, .900), (.012, .044, .078), mat, 'Head')


def back_quiver(mat='Leather', binding='Wood', arrows=4, strap='Leather'):
    """A slanted quiver on the back (Prop_Back) with fletched arrows, its strap across the chest
    (the Bronze archer's, build_bronze_ranged.py)."""
    P = 'Prop_Back'
    qb, qt = Vector((.052, .122, .560)), Vector((-.080, .116, .850))
    qa = (qt - qb).normalized()
    tube('back-quiver', [(tuple(qb), .029, P), (tuple(qb.lerp(qt, .5)), .036, P), (tuple(qt), .041, P), (tuple(qt - qa * .014), .031, P)], mat, 8, attachment=True)
    tube('quiver-binding', [(tuple(qt - qa * .050), .044, P), (tuple(qt - qa * .026), .045, P)], binding, 8, caps=(False, False), attachment=True)
    side_a = qa.cross(Vector((0, 1, 0))).normalized()
    side_b = qa.cross(side_a).normalized()
    for n in range(arrows):
        a = n * 2 * math.pi / arrows + .6
        off = side_a * math.cos(a) * .019 + side_b * math.sin(a) * .019
        tip = qt + off * 2.1 + qa * (.100 + .014 * (n % 3))
        tube(f'arrow-shaft-{n}', [(tuple(qt + off - qa * .020), .0036, P), (tuple(tip), .0036, P)], 'Wood', 3, attachment=True)
        flat = (.0145, .0035) if n % 2 else (.0035, .0145)
        tube(f'arrow-fletching-{n}', [(tuple(tip - qa * .062), flat, P), (tuple(tip - qa * .008), flat, P)], 'Cloth', 4, attachment=True)
    if strap:
        line = [((-.074, .096, .796), 'Chest'), ((-.086, .000, .806), 'Chest'), ((-.062, -.084, .756), 'Chest'), ((.000, -.101, .688), 'Chest'),
                ((.056, -.070, .615), 'Spine'), ((.103, -.012, .562), 'Spine'), ((.062, .078, .566), 'Spine')]
        tube('diagonal-quiver-strap', [(p, (.013, .0055), w) for p, w in line], strap, 4)


def oval_shield(centre, rx, rz, n=14, rim='Metal', back='Wood', prop='Prop_L', dome=.036, boss=None, spine=None, face='Emblem'):
    """A domed oval (or round) shield on the left hand's socket: its face the squad's emblem (UVs
    across its own box), a rim, a back and a grip; `boss` and `spine` are materials for a centre
    boss and a rib from top to bottom."""
    cx, cy, cz = centre
    ang = [2 * math.pi * j / n for j in range(n)]
    ix, iz = rx - .016, rz - .016
    fv = [(cx, cy - dome, cz)]
    for fx, fz, depth in ((rx * .55, rz * .55, -dome * .78), (ix, iz, -.012)):
        fv += [(cx + fx * math.cos(a), cy + depth, cz + fz * math.sin(a)) for a in ang]
    ff = [(0, 1 + (j + 1) % n, 1 + j) for j in range(n)]
    for j in range(n):
        a, b = 1 + j, 1 + (j + 1) % n
        ff += [(a, b, b + n), (a, b + n, a + n)]
    ob = raw('ShieldFace', fv, ff, face, prop, True)
    uv = ob.data.uv_layers.active.data
    for poly in ob.data.polygons:
        for li in poly.loop_indices:
            co = ob.data.vertices[ob.data.loops[li].vertex_index].co
            uv[li].uv = ((co.x - cx) / (rx * 2) + .5, (co.z - cz) / (rz * 2) + .5)
    rv, rf = [], []
    for a in ang:
        for dx, dz, depth in ((ix, iz, -.012), (rx + .002, rz + .002, -.012), (rx + .002, rz + .002, .012), (ix, iz, .016)):
            rv.append((cx + dx * math.cos(a), cy + depth, cz + dz * math.sin(a)))
    for j in range(n):
        for k in range(3):
            a, b = j * 4 + k, j * 4 + k + 1
            c, d = ((j + 1) % n) * 4 + k + 1, ((j + 1) % n) * 4 + k
            rf += [(a, b, c), (a, c, d)]
    raw('ShieldRim', rv, rf, rim, prop, True)
    bv = [(cx, cy + .010, cz)] + [(cx + ix * math.cos(a), cy + .016, cz + iz * math.sin(a)) for a in ang]
    raw('ShieldBack', bv, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)], back, prop, True)
    tube('ShieldGrip', [((cx - .060, cy + .020, cz + .033), .010, prop), ((cx, cy + .040, cz + .033), .011, prop), ((cx + .060, cy + .020, cz + .033), .010, prop)],
         'Leather', 4, attachment=True)
    facing.update({'ShieldFace': (0, -1, 0), 'ShieldBack': (0, 1, 0)})
    if spine:
        tube('ShieldSpine', [((cx, cy - .016, cz - rz * .86), (.012, .007), prop), ((cx, cy - dome * .80, cz - rz * .45), (.013, .008), prop),
                             ((cx, cy - dome - .004, cz), (.014, .009), prop), ((cx, cy - dome * .80, cz + rz * .45), (.013, .008), prop),
                             ((cx, cy - .016, cz + rz * .86), (.012, .007), prop)], spine, 4, attachment=True)
    if boss:
        tube('ShieldBoss', [((cx, cy - dome + .006, cz), (.046, .040), prop), ((cx, cy - dome - .014, cz), (.035, .030), prop),
                            ((cx, cy - dome - .026, cz), (.010, .012), prop)], boss, 6, attachment=True)
    return ob


def reach(side, wrist, pole=(.6, .1, -1)):
    """Pose one arm so its wrist sits at `wrist` (two-bone reach, the elbow towards `pole`)."""
    A, FA = arm.pose.bones['Arm_' + side], arm.pose.bones['Forearm_' + side]
    S = arm.data.bones['Arm_' + side].head_local.copy()
    l1 = (arm.data.bones['Forearm_' + side].head_local - S).length
    l2 = (arm.data.bones['Hand_' + side].head_local - arm.data.bones['Forearm_' + side].head_local).length
    W = Vector(wrist)
    d = W - S
    L = min(d.length, (l1 + l2) * .999)
    dn = d.normalized()
    a = (l1 * l1 - l2 * l2 + L * L) / (2 * L)
    h = math.sqrt(max(0, l1 * l1 - a * a))
    pl = Vector(pole)
    pl = (pl - dn * pl.dot(dn)).normalized()
    E = S + dn * a + pl * h
    for pb, src, dst in ((A, S, E), (FA, E, S + dn * L)):
        pb.matrix = Matrix.Translation(src) @ (dst - src).to_track_quat('Y', 'Z').to_matrix().to_4x4()
        bpy.context.view_layer.update()


def bake_rest():
    """Make the current pose the rest pose: the meshes keep the posed shape, the weights stay
    (as ti_units.bake_rest_pose, for a pose set by matrices)."""
    bpy.context.view_layer.update()
    for ob in meshes:
        mod = next((m for m in ob.modifiers if m.type == 'ARMATURE'), None)
        if not mod:
            continue
        bpy.ops.object.select_all(action='DESELECT')
        bpy.context.view_layer.objects.active = ob
        ob.select_set(True)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    for ob in meshes:
        mod = ob.modifiers.new('CanonicalRig', 'ARMATURE')
        mod.object = arm


def fix_normals(open_facing=None, around=()):
    """Every part's faces point outward. `open_facing`: {object name: the way an open sheet faces};
    `around`: names of objects made of loose sheets round the body (each face away from the Z axis)."""
    open_facing = open_facing or {}
    for ob in meshes:
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        want = open_facing.get(ob.name)
        if ob.name in around:
            bm.normal_update()
            flip = [f for f in bm.faces if f.normal.dot(Vector((f.calc_center_median().x, f.calc_center_median().y, 0))) < 0]
            if flip:
                bmesh.ops.reverse_faces(bm, faces=flip)
        elif want:
            total = Vector((0, 0, 0))
            for f in bm.faces:
                total += f.normal * f.calc_area()
            if total.dot(Vector(want)) < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces)
        else:
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            # an open tube has no inside to tell: make its faces point away from its own axis
            centre = sum((v.co for v in bm.verts), Vector((0, 0, 0))) / len(bm.verts)
            bm.normal_update()
            out = sum(f.normal.dot(f.calc_center_median() - centre) * f.calc_area() for f in bm.faces)
            if out < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces)
        bm.to_mesh(ob.data)
        bm.free()
        ob.data.update()


def bake_shade(seed=11, reach=.11, strength=.62):
    """Ambient occlusion times a ground-to-head gradient, greyscale, into COLOR_0. Returns its range."""
    random.seed(seed)
    tv, tf = [], []
    for ob in meshes:
        o = len(tv)
        tv += [ob.matrix_world @ v.co for v in ob.data.vertices]
        tf += [tuple(o + i for i in p.vertices) for p in ob.data.polygons]
    bvh = BVHTree.FromPolygons(tv, tf)
    dirs = []
    while len(dirs) < 40:
        d = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
        if 0.05 < d.length <= 1:
            dirs.append(d.normalized())
    lo, hi = 1, 0
    for ob in meshes:
        me = ob.data
        layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        cache = {}
        for poly in me.polygons:
            for li in poly.loop_indices:
                vi = me.loops[li].vertex_index
                if vi not in cache:
                    p = ob.matrix_world @ me.vertices[vi].co
                    nrm = (ob.matrix_world.to_3x3() @ me.vertices[vi].normal).normalized()
                    hits = weight = 0.0
                    for d in dirs:
                        k = d.dot(nrm)
                        if k <= .05:
                            continue
                        weight += k
                        hit = bvh.ray_cast(p + nrm * .004, d, reach)
                        if hit[0] is not None:
                            hits += k * (1 - hit[3] / reach * .5)
                    ao = 1 - strength * (hits / weight if weight else 0)
                    ground = .86 + .14 * min(1, max(0, p.z / .55))  # darker towards the feet
                    cache[vi] = max(.42, min(1, ao * ground))
                v = cache[vi]
                layer.data[li].color = (v, v, v, 1)
                lo, hi = min(lo, v), max(hi, v)
        me.color_attributes.active_color = layer
        me.color_attributes.render_color_index = 0
    return [round(lo, 3), round(hi, 3)]


def normalize_weights():
    for ob in meshes:
        for vertex in ob.data.vertices:
            total = sum(g.weight for g in vertex.groups)
            if total and abs(total - 1) > .000001:
                for g in vertex.groups:
                    ob.vertex_groups[g.group].add([vertex.index], g.weight / total, 'REPLACE')


def export_glb(path, animations=True, extra=()):
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for o in extra:
        o.select_set(True)
    for o in meshes:
        o.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True,
                              export_skins=True, export_animations=animations, export_animation_mode='ACTIONS', export_force_sampling=True,
                              export_frame_range=False, export_cameras=False, export_lights=False, export_extras=True,
                              export_materials='EXPORT', export_image_format='NONE', export_optimize_animation_size=False,
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)


def finish_rest(uid, look, budget=2000, rig_name='UnitRig', notes=None):
    """The end of a rest pose builder (no clips: the Classical units, whose march and arm swing are
    the vertex rig's): normals, baked shade, the root empty named after the unit, the GLB, its
    options file and a report in art-build/units/<uid>/. TI_PREVIEW=1 also writes stills."""
    out = u.out_dir(uid)
    fix_normals(facing, radial)
    shade = bake_shade()
    normalize_weights()
    tris = u.triangles(meshes)
    assert tris <= budget, (tris, sorted(((u.triangles([o]), o.name) for o in meshes), reverse=True)[:24])
    arm.name = rig_name
    root = u.assemble(uid, [arm])
    bpy.context.scene.render.fps = 20
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{uid}.blend'))
    export_glb(out / f'{uid}.glb', animations=False, extra=[root])
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    report = {'id': uid, 'triangles': tris, 'budget': budget, 'objects': len(meshes), 'materials': mats,
              'colors': {k: u.COLORS[k] for k in mats if k in u.COLORS}, 'textures': 0, 'mounted': False,
              'bones': [b.name for b in arm.data.bones], 'pose': 'rest pose only, no clips', 'front': 'Blender -Y, glTF +Z',
              'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
              'shade_range': shade, 'look': look, **(notes or {}), 'by_object': {o.name: u.triangles([o]) for o in meshes}}
    (out / 'source-report.json').write_text(json.dumps(report, indent=2))
    opts = {'enabled': True, 'quadruped': False, 'triangleBudget': 3000,
            'tags': {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}}
    (out / f'{uid}.json').write_text(json.dumps(opts, indent=2) + '\n')
    if os.environ.get('TI_PREVIEW'):
        preview(out, uid, size=(560, 720), team='2F6FD0')
    print('FINISHED', out, 'TRIANGLES', tris, 'SHADE', shade, flush=True)
    return tris


def preview(out, uid, shots=None, size=(700, 900), team=None):
    """Workbench stills (flat colours, baked shade ignored) for a first look: front, back, the game's
    high three-quarter view. `shots`: [(name, action, frame)] extra poses from the front quarter."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = size
    if team:  # stills only: show the Team and Emblem surfaces in a side's colour (call after the export)
        for tag in ('Team', 'Emblem'):
            if tag in bpy.data.materials:
                bpy.data.materials[tag].diffuse_color = (*(u.linear(int(team[i:i + 2], 16) / 255) for i in (0, 2, 4)), 1)
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('W')
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 1.45
    scene.camera = cam
    arm.hide_viewport = arm.hide_render = True
    views = {'front': (0.5, -3, .9), 'back': (-0.5, 3, .9), 'game': (1.6, -1.9, 2.6), 'gameback': (-1.6, 1.9, 2.6)}
    jobs = [(k, 'Idle', 1, v) for k, v in views.items()] + [(n, a, f, views['game']) for n, a, f in (shots or [])]
    clips = bool(arm.animation_data and len(bpy.data.actions))  # a rest pose file has none
    for name, action, frame, loc in jobs:
        if clips:
            arm.animation_data.action = bpy.data.actions[action]
        scene.frame_set(frame)
        cam.location = loc
        cam.rotation_euler = (Vector((0, 0, .52)) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'preview-{uid}-{name}.png')
        bpy.ops.render.render(write_still=True)
    if clips:
        arm.animation_data.action = bpy.data.actions['Idle']
    scene.frame_set(1)
