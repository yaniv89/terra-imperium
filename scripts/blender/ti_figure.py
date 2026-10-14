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
# Second pass (the rest of the Bronze set, 2026-10-14): files with several rigs (a chariot's crew,
# a rider on a horse, a ram's pushers):
#   - start(rig=False) then figure(name) per person (its parts are named <name><part>), use(rig) for
#     a machine's or an animal's armature, place() to stand the figure where it belongs
#   - bronze_torso(), kilt(seated=), shawl(), sash(), hair_nape(), cap(): the clothes the set shares
#   - pose() with reach() and bake_rest() work on the current figure only (a seated rider or driver)
#   - adopt(): meshes built with ti_units helpers (an animal, a car) join the shade bake
#   - finish_unit(): normals, COLOR_0, the root empty, the .blend, the GLB and report.json
#   (BRONZE_TORSO, bronze_torso() and sheet() are this pass's trunk and thin sheet; the Classical
#   TORSO, torso() and slab() below are the other agent's)
# Added for the Classical foot units (2026-10-14, build_classical_*.py; they export the rest pose only):
#   - torso(), skirt(), strips() (pteruges), greaves(), boots, hair(), ridge() (a crest), helmet(),
#     oval_shield(), finish_rest()
# Added for the Kingdoms foot units (2026-10-14, build_kingdoms_*.py; rest pose only): legs(hose=),
#   arms(long=, pad=, cuff=), quilted torso() and skirt() (ribs, quilt()), lathe(), kettle_hat(),
#   mail_coif(), hood(), tabard(), straw_hat(), self_bow(), hip_sword()
# Added for the Gunpowder foot units (2026-10-14, build_gunpowder_*.py; rest pose only): sweep(),
#   tricorne(), round_hat(), fur_cap(), coat_skirts() (Team skirts on the Spine, lined), cross_belts(),
#   gaiters(), queue(), neck_stock(), musket() (upright, socket bayonet); fix_normals() takes `inward`
# Added for the Modern foot units (2026-10-14, build_modern_*.py; rest pose only): hold() (a fist to an
#   exact point), fist(mat=) for gloves, combat_boots(), cargo_trousers() (pockets, knee pads),
#   combat_helmet(), plate_carrier() (pouches, radio and antenna), chest_rig(), hi_vis_vest(), hard_hat(),
#   ball_cap() with a headset, sunglasses(), assault_rifle() (upright, muzzle up), modern_soldier()
# Added for the Classical mounted units (2026-10-14, build_classical_cavalry/general/raider.py): SEAT,
#   ASTRIDE and astride() (a rider posed on the fine horse), seat_weights() and skirt(seated=) /
#   strips(seated=) (garments that follow the thighs), scale_coat() (overlapping scalloped rows),
#   cloak() (a thick shell from the shoulders down the back), pointing_hand(), phrygian_cap(),
#   turn() (rotate parts about a point: a shield held to the side)
# Blender Z up, the front faces -Y, a standing person is 1 tall.
import bpy, bmesh, math, random, json, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import ti_units as u

arm = None
meshes = []
prefix = ''   # put before every part's name (a file with several people)
loose = set()  # adopted meshes: shaded, but their faces stay as authored
bright = set()  # parts that take no baked shade (a flame)
LITE = False  # crew(lite=True): fewer sides on the head, arms, fists and clothes (four pushers on a machine)
PALETTE = {'Hair': '2B201A', 'Leather': '6A3D27', 'Metal': 'C9994F', 'Wood': '7A5636', 'Cloth': 'EADFC6'}


def start(colors=None, ready=True, rig=True):
    """An empty scene, the palette (PALETTE plus `colors`; a colour is 'RRGGBB' or (hex, roughness,
    metallic)) and the canonical rig (rig=False: none yet, a file of several rigs calls figure() and use())."""
    global arm, prefix
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = 20
    meshes.clear()
    loose.clear()
    bright.clear()
    facing.clear()
    radial.clear()
    inward.clear()
    prefix = ''
    arm = None
    colors = colors or {}
    u.COLORS.update(PALETTE)
    u.COLORS.update({k: v if isinstance(v, str) else v[0] for k, v in colors.items()})
    u.palette()
    u.set_colors({k: v for k, v in colors.items() if not isinstance(v, str)})  # (hex, roughness, metallic)
    if rig:
        arm = u.rig(ready=ready)
    return arm


def figure(name, ready=True):
    """A new person on the canonical rig, named <name>Rig; its parts are named <name><part>."""
    global arm, prefix, LITE
    LITE = False
    bpy.ops.object.select_all(action='DESELECT')
    arm = u.rig(ready=ready)
    arm.name = name + 'Rig'
    prefix = name
    bpy.ops.object.select_all(action='DESELECT')
    return arm


def use(rig, name=''):
    """Make another armature (a car, an animal) the one new parts hang from."""
    global arm, prefix
    arm = rig
    prefix = name
    return rig


def place(at=(0, 0, 0), yaw=0):
    """Stand the current figure at `at`, turned `yaw` degrees."""
    arm.location = at
    arm.rotation_euler = (0, 0, math.radians(yaw))
    bpy.context.view_layer.update()


def own():
    """The current rig's parts."""
    return [o for o in meshes if o.parent == arm]


def adopt(objects):
    """Meshes built outside this module (ti_units.quadruped, a car): they take the baked shade."""
    for o in objects:
        if o.type == 'MESH' and o not in meshes:
            meshes.append(o)
            loose.add(o.name)


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
    ob = u.mesh_obj(prefix + name, verts, faces, mat, weights=vw, arm=arm, attachment=attachment)
    meshes.append(ob)
    return ob


def box(name, centre, size, mat, bone, attachment=False):
    ob = u.box(prefix + name, centre, size, mat, bone, arm, attachment)
    meshes.append(ob)
    return ob


def raw(name, verts, faces, mat, bone=None, attachment=False, weights=None):
    ob = u.mesh_obj(prefix + name, verts, faces, mat, bone, attachment, weights=weights, arm=arm)
    meshes.append(ob)
    return ob


def sheet(name, a, b, c, d, thick, mat, bone, attachment=False):
    """A thin closed sheet over the quad a, b, c, d (a hanging cloth end, a banner, a strap); the
    Classical slab() takes four corners and a depth towards the back instead."""
    a, b, c, d = (Vector(p) for p in (a, b, c, d))
    n = (b - a).cross(d - a).normalized() * thick
    v = [tuple(p) for p in (a, b, c, d)] + [tuple(p - n) for p in (a, b, c, d)]
    f = [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)]
    return raw(name, v, f, mat, bone, attachment)


def vertical(zs, cy, radii, weights, cx=0):
    """Rings up the Z axis: zs, the centre's Y per ring (or one number), (rx, ry) per ring."""
    cys = cy if isinstance(cy, (list, tuple)) else [cy] * len(zs)
    ws = weights if isinstance(weights, (list, tuple)) else [weights] * len(zs)
    return [((cx, cys[i], zs[i]), radii[i], ws[i]) for i in range(len(zs))]


def legs(laces=True, straps=True, simple=False, boots=None, hose=None):
    """Bare legs and feet in leather sandals (laced up the calf or not; straps=False: a crew
    member whose feet are hardly seen keeps the sole only; simple=True: legs hidden in a car, one
    plain tube, a foot and a sole); `boots` is a material for closed ankle boots instead of the sandals.
    `hose` (with boots): the legs in wool hose of that material instead of bare skin, or a pair
    (left, right) for parti-coloured hose."""
    for side, s in (('L', 1), ('R', -1)):
        L, S, F = 'Leg_' + side, 'Shin_' + side, 'Foot_' + side
        leg = (hose if isinstance(hose, str) else hose[0 if side == 'L' else 1]) if hose else 'Skin'
        if simple:
            tube('BodyLeg_' + side, [((s * .061, 0, .470), (.052, .049), L), ((s * .071, -.010, .262), (.035, .036), {L: .5, S: .5}),
                                     ((s * .074, .002, .060), (.024, .025), F)], 'Skin', 6, caps=(False, True))
            box('BodyFoot_' + side, (s * .074, -.040, .028), (.050, .120, .036), 'Skin', F)
            box('SandalSole_' + side, (s * .074, -.042, .007), (.068, .140, .014), 'Leather', F)
            continue
        if boots:
            tube('BodyLeg_' + side, [
                ((s * .061, 0, .470), (.053, .050), L), ((s * .070, -.003, .320), (.040, .039), L), ((s * .071, -.012, .268), (.034, .036), {L: .6, S: .4}),
                ((s * .071, -.014, .250), (.033, .036), {L: .4, S: .6}), ((s * .073, .004, .200), (.039, .040), S),
                ((s * .074, .005, .120), (.028, .029), S)], leg, 7, caps=(False, False))
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
        if not straps:
            continue
        tube('SandalToeStrap_' + side, [((s * .074 - .037, -.072, .020), .009, F), ((s * .074, -.072, .043), .009, F),
                                        ((s * .074 + .037, -.072, .020), .009, F)], 'Leather', 4)
        tube('SandalAnkle_' + side, [((s * .074, .002, .052), (.026, .029), F), ((s * .074, .002, .070), (.025, .028), F)],
             'Leather', 8, caps=(False, False))
        if laces:
            tube('SandalLace_' + side, [((s * .074, .006, .111), .033, S), ((s * .074, .006, .125), .033, S)],
                 'Leather', 8, caps=(False, False))


def arms(sleeve=None, shoulder=None, long=None, pad=0., cuff=None):
    """Bare arms; `sleeve` is a material for a short sleeve, `shoulder` one for a cap over the
    shoulder (Skin for a bare deltoid). `long`: the whole arm in a sleeve of that material to the
    wrist (a padded sleeve with `pad`, wider by that much; `cuff`: a band of that material at the
    wrist). Returns {side: (shoulder, elbow, wrist)}."""
    bone = arm.data.bones
    out = {}
    for side, s in (('L', 1), ('R', -1)):
        A, FA, H = 'Arm_' + side, 'Forearm_' + side, 'Hand_' + side
        sh, el, wr = bone[A].head_local.copy(), bone[FA].head_local.copy(), bone[H].head_local.copy()
        out[side] = (sh, el, wr)
        p = pad if long else 0
        tube('BodyArm_' + side, [
            (tuple(sh), (.043 + p, .040 + p), A), (tuple(sh.lerp(el, .55)), (.039 + p, .036 + p), A),
            (tuple(el), (.032 + p, .032 + p), {A: .5, FA: .5}), (tuple(el.lerp(wr, .30)), (.035 + p, .032 + p), FA),
            (tuple(el.lerp(wr, .75)), (.027 + p * .7, .026 + p * .7), FA), (tuple(wr), (.022 + p * .4, .024 + p * .4), H)],
             long or 'Skin', 6 if LITE else 7, caps=(False, False))
        if cuff:
            tube('Cuff_' + side, [(tuple(el.lerp(wr, .80)), (.030 + p * .6, .030 + p * .6), FA), (tuple(el.lerp(wr, .98)), (.027 + p * .5, .028 + p * .5), FA)],
                 cuff, 6, caps=(False, False))
        if sleeve:
            tube('short-sleeve-' + side, [(tuple(sh.lerp(el, -.05)), (.050, .046), A), (tuple(sh.lerp(el, .30)), (.049, .044), A),
                                          (tuple(sh.lerp(el, .52)), (.047, .043), A)], sleeve, 6, caps=(True, False))
        if shoulder:
            top = sh + Vector((s * .004, 0, .012))
            tube('Shoulder_' + side, [(tuple(top + Vector((-s * .030, 0, .012))), (.036, .042), 'Chest'), (tuple(top), (.047, .045), A),
                                      (tuple(top.lerp(el, .22)), (.046, .043), A)], shoulder, 6, caps=(True, False))
    return out


def wrist(side):
    return arm.data.bones['Hand_' + side].head_local.copy()


def grip_point(side, out=.034):
    """Where the fist closes: a little past the wrist along the forearm."""
    el, wr = arm.data.bones['Forearm_' + side].head_local, arm.data.bones['Hand_' + side].head_local
    return wr + (wr - el).normalized() * out


def fist(side, grip=None, axis=(0, 0, 1), half=.027, mat='Skin'):
    """A closed fist at `grip` (default: grip_point) round a shaft that runs along `axis`. Returns the grip.
    `mat`: a glove instead of the bare hand."""
    H = 'Hand_' + side
    wr = arm.data.bones[H].head_local.copy()
    grip = Vector(grip) if grip is not None else grip_point(side)
    ax = Vector(axis).normalized()
    tube('BodyHand_' + side, [(tuple(wr), (.022, .024), H),
                              (tuple(grip), (.027, .030), H), (tuple(grip + (grip - wr).normalized() * .016), (.018, .024), H)], mat, 4 if LITE else 6)
    c = grip + Vector((0, -.004, 0))
    if not LITE:  # (a lite fist is the hand's own knuckle ring)
        tube('Fingers_' + side, [(tuple(c - ax * half), (.024, .024), H), (tuple(c + ax * half), (.024, .024), H)], mat, 6)
    return grip


def head(ears=True):
    """Neck and a shaped head: jaw, cheeks, brow, nose, ears, eyes and eyebrows (`ears` off under a
    helmet that covers them)."""
    tube('BodyNeck', vertical([.770, .815, .850], [0, -.002, -.004], [(.044, .040), (.036, .034), (.037, .036)], 'Neck'), 'Skin', 6, caps=(False, False))
    tube('BodyHead', vertical([.838, .850, .868, .892, .920, .950, .990],
                              [-.026, -.017, -.012, -.009, -.007, -.005, -.002],
                              [(.016, .016), (.036, .036), (.047, .047), (.055, .053), (.058, .055), (.058, .056), (.034, .033)],
                              'Head'), 'Skin', 8 if LITE else 10)
    raw('FaceNose', [(-.014, -.060, .932), (.014, -.060, .932), (-.015, -.064, .896), (.015, -.064, .896), (0, -.084, .902)],
        [(0, 1, 4), (0, 4, 2), (1, 3, 4), (2, 4, 3), (0, 2, 3), (0, 3, 1)], 'Skin', 'Head')
    for s in (-1, 1):
        if not ears:
            pass
        elif LITE:
            box(f'Ear_{s}', (s * .059, .003, .918), (.012, .018, .032), 'Skin', 'Head')
        else:
            tube(f'Ear_{s}', [((s * .056, .002, .900), (.010, .012), 'Head'), ((s * .064, .004, .918), (.010, .015), 'Head'),
                              ((s * .056, .002, .938), (.010, .011), 'Head')], 'Skin', 4)
        box(f'FaceEye_{s}', (s * .024, -.0585, .924), (.012, .008, .007), 'Hair', 'Head')
        if not LITE:
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


def headcloth(band, tail=True, cloth='Cloth'):
    """A linen headcloth (a low dome, a flap down the neck) under a band of the material `band`."""
    if tail:
        tube('HeadclothTail', vertical([.842, .880, .920, .950], [.026, .016, .008, .004], [(.056, .036), (.064, .052), (.066, .058), (.065, .059)], 'Head'),
             cloth, 8, caps=(True, False))
    tube('LinenHeadcloth', vertical([.944, .966, .990, 1.006], -.003, [(.066, .062), (.063, .059), (.047, .044), (.018, .018)], 'Head'),
         cloth, 8 if LITE else 10, caps=(True, True))
    tube('Headband', vertical([.945, .966], -.003, [(.0705, .0665), (.0690, .0650)], 'Head'), band, 8 if LITE else 10, caps=(False, False))


def tufted_hem(name='KiltHem'):
    """The pale tufted hem of the kilt (the spearman's): every second point hangs lower."""
    hem = tube(name, vertical([.300, .318, .336], 0, [(.141, .103), (.140, .101), (.138, .0995)], 'Hips'), 'Cloth', 12, caps=(False, False))
    for i in range(12):
        if i % 2:
            hem.data.vertices[i].co.z -= .014
    return hem


BRONZE_TORSO = [(.525, .094, .066), (.575, .090, .064), (.615, .091, .066), (.655, .102, .072), (.695, .118, .078),
         (.735, .132, .081), (.762, .128, .075), (.790, .072, .050)]


def torso_radius(z, profile=BRONZE_TORSO):
    for (z0, x0, y0), (z1, x1, y1) in zip(profile, profile[1:]):
        if z <= z1:
            t = max(0, (z - z0) / (z1 - z0))
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    return profile[-1][1], profile[-1][2]


def bronze_torso(name, mat, profile=BRONZE_TORSO, sides=10, chest=False, grow=0):
    """This pass's trunk from the waist to the neck (a tunic, a jerkin, bare skin with chest=True)."""
    ob = tube(name, [((0, 0, z), (rx + grow, ry + grow), 'Spine' if z < .66 else 'Chest') for z, rx, ry in profile], mat, sides, caps=(False, True))
    if chest:  # the front of the upper rings stands a little proud
        for ring in (3, 4):
            for j in (sides - 1, 0, 1):
                ob.data.vertices[ring * sides + j].co.y -= .007
    return ob


def reweight(ob, indices, weights):
    for g in ob.vertex_groups:
        g.remove(list(indices))
    for b, w in weights.items():
        (ob.vertex_groups.get(b) or ob.vertex_groups.new(name=b)).add(list(indices), w, 'REPLACE')


def kilt(name='Kilt', mat='Team', seated=False, sides=10):
    """The knee-length kilt. seated=True: its lower rings follow the thighs (a rider, a driver)."""
    zs = [.335, .385, .450, .515, .548]
    ob = tube(name, vertical(zs, 0, [(.136, .098), (.129, .093), (.117, .085), (.101, .073), (.090, .064)], 'Hips'), mat, sides, caps=(False, False))
    if seated:
        for ring, share in ((0, .85), (1, .7), (2, .4)):
            for j in range(sides):
                v = ob.data.vertices[ring * sides + j]
                side = 'L' if v.co.x > .02 else 'R' if v.co.x < -.02 else None
                if side:
                    reweight(ob, [v.index], {'Leg_' + side: share, 'Hips': 1 - share})
                else:
                    reweight(ob, [v.index], {'Leg_L': share / 2, 'Leg_R': share / 2, 'Hips': 1 - share})
    return ob


def shawl(name='TeamShawl', mat='Team', profile=BRONZE_TORSO, sides=10, end=True, bands=((.630, .085), (.690, .085), (.745, .068))):
    """A broad band over the left shoulder, across the chest and the back (the archer's), its end
    down the back: the side's colour where the battle draws it (Spine and Chest)."""
    sv, sf, sw = [], [], []
    for k, (mid, slope) in enumerate(bands):
        for j in range(sides):
            a = 2 * math.pi * j / sides
            z = mid + slope * math.sin(a)
            rx, ry = torso_radius(z, profile)
            grow = .013 + (.004 if k == 1 else 0)
            sv.append(((rx + grow) * math.sin(a), -(ry + grow) * math.cos(a), z))
            sw.append({'Spine' if z < .64 else 'Chest': 1})
        if k:
            for j in range(sides):
                p, q = (k - 1) * sides + j, (k - 1) * sides + (j + 1) % sides
                sf += [(p, q, k * sides + (j + 1) % sides), (p, k * sides + (j + 1) % sides, k * sides + j)]
    ob = raw(name, sv, sf, mat, weights=sw)
    if end:
        sheet(name + 'End', (.050, .078, .790), (.112, .070, .775), (.118, .100, .640), (.052, .106, .632), .009, mat, 'Chest')
    return ob


def sash(name='Sash', mat='Team', end=True, knot=True):
    """A waist sash on the Spine bone (so the battle dyes it), a knot and a hanging end at the front."""
    ob = tube(name, vertical([.512, .543, .574], 0, [(.103, .075), (.106, .078), (.092, .066)], 'Spine'), mat, 8 if LITE else 10, caps=(False, False))
    if end:
        sheet(name + 'End', (.030, -.079, .530), (.066, -.070, .530), (.072, -.092, .405), (.026, -.100, .405), .007, mat, 'Spine')
    if knot:
        box(name + 'Knot', (.048, -.080, .540), (.046, .020, .040), mat, 'Spine')
    return ob


def hair_nape(name='HairNape'):
    """Dark hair down the back of the head, under a cap or a headcloth."""
    return tube(name, vertical([.868, .888, .920, .950], [.018, .014, .008, .004], [(.046, .040), (.061, .052), (.064, .057), (.063, .058)], 'Head'),
                'Hair', 8, caps=(True, False))


def cap(name='BronzeCap', mat='Metal', attachment=True, height=1.106):
    """The pointed bronze cap (the spearman's)."""
    k = (height - .944) / (1.106 - .944)
    zs = [.944, .951, .964] + [.964 + (z - .964) * k for z in (1.000, 1.040, 1.078, 1.106)]
    return tube(name, vertical(zs, -.003, [(.070, .065), (.074, .069), (.068, .063), (.056, .052), (.038, .036), (.018, .017), (.003, .003)], 'Head'),
                mat, 10, caps=(True, True), attachment=attachment)


def round_shield(centre, radius, bone='Prop_L', n=14, rim='Metal', back='Wood'):
    """A domed round shield facing -Y (the spearman's): its face is the squad's Emblem, a bronze rim,
    a wooden back, a leather grip. Parts: ShieldFace, ShieldBronzeRim, ShieldBack, ShieldGrip.
    Give fix_normals SHIELD_FACING for the two open discs."""
    cx, cy, cz = centre
    R = radius
    ang = [2 * math.pi * j / n for j in range(n)]
    fv = [(cx, cy - .036, cz)]
    for r, depth in ((R * .5, -.028), (R - .018, -.012)):
        fv += [(cx + r * math.cos(a), cy + depth, cz + r * math.sin(a)) for a in ang]
    ff = [(0, 1 + (j + 1) % n, 1 + j) for j in range(n)]
    for j in range(n):
        a, b = 1 + j, 1 + (j + 1) % n
        ff += [(a, b, b + n), (a, b + n, a + n)]
    face = raw('ShieldFace', fv, ff, 'Emblem', bone, True)
    uv = face.data.uv_layers.active.data
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            uv[li].uv = ((co.x - cx) / (R * 2) + .5, (co.z - cz) / (R * 2) + .5)
    rv, rf = [], []
    for a in ang:
        for r, depth in ((R - .018, -.012), (R + .002, -.012), (R + .002, .012), (R - .018, .016)):
            rv.append((cx + r * math.cos(a), cy + depth, cz + r * math.sin(a)))
    for j in range(n):
        for k in range(3):
            a, b = j * 4 + k, j * 4 + k + 1
            c, d = ((j + 1) % n) * 4 + k + 1, ((j + 1) % n) * 4 + k
            rf += [(a, b, c), (a, c, d)]
    raw('ShieldBronzeRim', rv, rf, rim, bone, True)
    bv = [(cx, cy + .010, cz)] + [(cx + (R - .018) * math.cos(a), cy + .016, cz + (R - .018) * math.sin(a)) for a in ang]
    raw('ShieldBack', bv, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)], back, bone, True)
    tube('ShieldGrip', [((cx - .060, cy + .020, cz), .010, bone), ((cx, cy + .040, cz), .011, bone), ((cx + .060, cy + .020, cz), .010, bone)],
         'Leather', 4, attachment=True)
    return face


def shield_facing():
    return {prefix + 'ShieldFace': (0, -1, 0), prefix + 'ShieldBack': (0, 1, 0)}


def crew(name, headgear='headcloth', accent='shawl', band='Team', bearded=True, straps=True, laces=False, bare=False, seated=False, tunic='Cloth', simple=False, lite=False):
    """A dressed person of the set on a rig of their own (<name>Rig): kilt with its pale hem, a linen
    tunic (bare=True: a bare chest), a leather belt, the side's colour as a chest shawl or a waist
    sash, a headcloth under a band (`band`) or the pointed bronze cap. Pose it, bake_rest(), place()
    it, then give it fists and what it holds. simple=True: a crew member standing in a car (plain
    legs, no hem). lite=True: a lighter figure for a machine's crew (LITE: fewer sides, no shoulder
    caps, brows or headcloth flap, plain ears), until the next figure()."""
    global LITE
    rig = figure(name)
    LITE = lite
    sides = 8 if lite else 10
    legs(laces=laces, straps=straps, simple=simple)
    arms(shoulder=None if lite else 'Skin')
    head()
    if bearded:
        beard()
    kilt('Kilt', 'Team', seated=seated, sides=sides)
    if not seated and not simple:
        tufted_hem()
    if bare:
        bronze_torso('BodyTorso', 'Skin', chest=True, grow=-.004, sides=sides)
    else:
        bronze_torso('Tunic', tunic, sides=sides)
    if accent == 'shawl':
        tube('Belt', vertical([.520, .548], 0, [(.103, .076), (.101, .074)], 'Spine'), 'Leather', 10, caps=(False, False))
        shawl('Shawl', 'Team')
    else:
        sash('Sash', 'Team', end=not lite, knot=not lite)
    if headgear == 'headcloth':
        headcloth(band, tail=not lite)
    else:
        hair_nape()
        cap()
    return rig


def pose(rotations):
    """Turn bones of the current figure ({bone: (x, y, z) degrees}, world axes) before bake_rest()."""
    for b, angles in rotations.items():
        u.rotate_world(arm, b, angles)
    bpy.context.view_layer.update()


# ---- Classical parts (2026-10-14) ----------------------------------------------------------------
# (z, half width, half depth) up the trunk and down the skirt: what every garment wraps
TORSO = [(.535, .092, .064), (.575, .089, .063), (.615, .090, .065), (.655, .101, .071), (.695, .117, .077),
         (.735, .132, .080), (.762, .128, .074), (.790, .072, .050)]
SKIRT = [(.335, .136, .098), (.385, .129, .093), (.450, .117, .085), (.515, .101, .073), (.548, .090, .064)]
facing = {}   # open sheets: {object name: the way it faces}, for fix_normals
radial = set()  # objects made of loose sheets round the body: every face points away from the Z axis
inward = set()  # sheets seen from inside (a coat skirt's lining): every face points towards the Z axis


def radius_at(z, profile):
    """(half width, half depth) of a (z, rx, ry) profile at height z (the first span carries on below it)."""
    for (z0, x0, y0), (z1, x1, y1) in zip(profile, profile[1:]):
        if z <= z1:
            t = (z - z0) / (z1 - z0)
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    return profile[-1][1], profile[-1][2]


def quilt(ob, rings, sides, depth):
    """Quilted channels: every second column of a tube's rings drawn in towards its axis by `depth`
    (a share of the radius), so a padded coat shows ribs in its facets at no cost in triangles."""
    for i in range(rings):
        for j in range(1, sides, 2):
            v = ob.data.vertices[i * sides + j].co
            v.x, v.y = v.x * (1 - depth), v.y * (1 - depth)


def torso(name, mat, grow=0, chest=0, sides=10, profile=TORSO, ribs=0):
    """The trunk from the waist to the collar as one tube (a tunic, a corselet, a cuirass, bare skin).
    `grow` widens it over what it covers; `chest` pushes the front of the chest rings forward;
    `ribs` quilts it (a padded coat, quilt())."""
    ob = tube(name, [((0, 0, z), (rx + grow, ry + grow), 'Spine' if z < .66 else 'Chest') for z, rx, ry in profile], mat, sides, caps=(False, True))
    if chest:
        for i, (z, _, _) in enumerate(profile):
            if .68 < z < .75:
                for j in (sides - 1, 0, 1):
                    ob.data.vertices[i * sides + j].co.y -= chest
    if ribs:
        quilt(ob, len(profile) - 1, sides, ribs)
    return ob


def skirt(name, mat, low=.335, top=.548, grow=0, sides=10, bone='Hips', ribs=0, flare=0, seated=False):
    """A tunic's skirt or a kilt from `top` down to `low` (`flare`: the lowest ring that much wider;
    `ribs` quilts it; `seated`: its lower part follows the thighs, seat_weights())."""
    zs = [low] + [z for z, _, _ in SKIRT if low + .02 < z < top - .01] + [top]
    ob = tube(name, [((0, 0, z), tuple(r + grow + (flare if i == 0 else 0) for r in radius_at(z, SKIRT)), bone) for i, z in enumerate(zs)],
              mat, sides, caps=(False, False))
    if ribs:
        quilt(ob, len(zs), sides, ribs)
    if seated:
        seat_weights(ob)
    return ob


def seat_weights(ob, top=.52, low=.335, share=.85, bone='Hips'):
    """A garment below the waist of a seated figure: each vertex under `top` follows the thigh on its
    side by a share that grows to `share` at `low` (the kilt(seated=True) rule, by height)."""
    for v in ob.data.vertices:
        if v.co.z >= top:
            continue
        s = share * min(1, (top - v.co.z) / (top - low))
        side = 'L' if v.co.x > .02 else 'R' if v.co.x < -.02 else None
        reweight(ob, [v.index], {'Leg_' + side: s, bone: 1 - s} if side else {'Leg_L': s / 2, 'Leg_R': s / 2, bone: 1 - s})


def band(name, mat, z0, z1, grow, profile=TORSO, bone='Spine', sides=10, bulge=.004):
    """A belt or a sash round the trunk (or the skirt) between two heights, a little proud in the middle."""
    zs = [z0, (z0 + z1) / 2, z1]
    rs = [tuple(r + grow + (bulge if i == 1 else 0) for r in radius_at(z, profile)) for i, z in enumerate(zs)]
    return tube(name, vertical(zs, 0, rs, bone), mat, sides, caps=(False, False))


def strips(name, mat, top, bottom, n=12, grow=.008, gap=.26, phase=0., flare=.004, bone='Hips', seated=False):
    """A row of hanging strips round the skirt (pteruges): n sheets from `top` down to `bottom`
    (`seated`: they follow the thighs, seat_weights())."""
    if seated:
        ob = strips(name, mat, top, bottom, n, grow, gap, phase, flare, bone)
        seat_weights(ob, top=top + .01)
        return ob
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


# ---- Kingdoms (medieval) parts (2026-10-14, build_kingdoms_*.py) ---------------------------------------
# What tells the medieval foot from the Classical at a glance: wool hose and ankle boots instead of
# bare legs and sandals (legs(hose=)), long padded sleeves (arms(long=, pad=)), quilted coats (ribs),
# a Team tabard over the chest with panels front and back, broad-brimmed kettle hats over mail coifs,
# hoods with a shoulder cape and a long tail, the tall self bow.

def lathe(name, profile, mat, bone='Head', sides=10, sy=.94, cy=-.003, cx=0, attachment=False, weights=None):
    """A surface of revolution round a vertical axis through (cx, cy): `profile` is (r, z) points in
    order, r 0 a pole that closes that end; `sy` squashes it front to back. Vertex 0 of a ring faces -Y."""
    verts, faces, vw, rows = [], [], [], []
    for k, (r, z) in enumerate(profile):
        w = weights[k] if weights else bone
        w = {w: 1} if isinstance(w, str) else w
        if r < 1e-6:
            rows.append([len(verts)])
            verts.append((cx, cy, z))
            vw.append(w)
            continue
        row = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            row.append(len(verts))
            verts.append((cx + r * math.sin(a), cy - r * sy * math.cos(a), z))
            vw.append(w)
        rows.append(row)
    for a, b in zip(rows, rows[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        for j in range(sides):
            q = (j + 1) % sides
            if len(a) == 1:
                faces.append((a[0], b[q], b[j]))
            elif len(b) == 1:
                faces.append((a[j], a[q], b[0]))
            else:
                faces += [(a[j], a[q], b[q]), (a[j], b[q], b[j])]
    return raw(name, verts, faces, mat, attachment=attachment, weights=vw)


def kettle_hat(name='KettleHat', mat='Metal', brim=.126, droop=.032, top=1.042, comb=True, sides=12):
    """The medieval kettle hat (the pikeman's): a round steel bowl and a broad brim sloping down all
    round, a low comb from the brow to the nape."""
    lathe(name, [(0, top), (.032, top - .007), (.055, top - .024), (.069, .992), (.074, .966), (.076, .954),
                 (brim, .956 - droop), (brim + .004, .940 - droop), (.074, .932), (0, .936)], mat, sides=sides)
    if comb:
        ridge(name + 'Comb', [(-.066, top - .052, top - .040), (-.034, top - .014, top - .001), (.034, top - .014, top - .001),
                              (.066, top - .052, top - .040)], mat, half=(.009, .007))


def mail_coif(name='MailCoif', mat='Mail', sides=10, cape=.190):
    """A mail hood under a helmet: a short cape over the shoulders (Chest), round the neck and the
    head, the face left open (the front of the head rings drawn back behind it)."""
    rings = [(.752, cape, .108, .004, 'Chest'), (.790, .118, .086, .002, 'Chest'), (.828, .072, .066, -.004, 'Neck'),
             (.864, .068, .066, -.005, 'Head'), (.904, .069, .067, -.004, 'Head'), (.944, .067, .065, -.003, 'Head'), (.972, .054, .052, -.002, 'Head')]
    ob = tube(name, [((0, cy, z), (rx, ry), w) for z, rx, ry, cy, w in rings], mat, sides, caps=(False, True))
    for i, (z, *_rest) in enumerate(rings):
        if z > .85:
            ob.data.vertices[i * sides].co.y = -.020
            for j in (1, sides - 1):
                ob.data.vertices[i * sides + j].co.y *= .80
    return ob


def hood(name='Hood', mat='Cloth', sides=10, cape=.234, low=.700, dags=.020, tail=True):
    """A medieval hood (chaperon): a shoulder cape with a pointed (dagged) edge down to `low`
    (Chest), the hood round the head with the face open, a point at the back and a long tail
    (liripipe) down the back. In Team it is the side's colour seen from above."""
    rings = [(low, cape, .148, .010, 'Chest'), (low + .046, cape - .010, .138, .008, 'Chest'), (.796, .162, .114, .004, 'Chest'),
             (.836, .090, .078, 0, 'Neck'), (.866, .073, .071, .003, 'Head'), (.905, .076, .074, .006, 'Head'), (.946, .075, .073, .008, 'Head'),
             (.986, .063, .063, .014, 'Head'), (1.014, .038, .042, .030, 'Head'), (1.034, .008, .010, .056, 'Head')]
    ob = tube(name, [((0, cy, z), (rx, ry), w) for z, rx, ry, cy, w in rings], mat, sides, caps=(False, True))
    for j in range(0, sides, 2):
        ob.data.vertices[j].co.z -= dags
    for i, (z, *_rest) in enumerate(rings):
        if .85 < z < 1.0:
            ob.data.vertices[i * sides].co.y = -.024
            for j in (1, sides - 1):
                ob.data.vertices[i * sides + j].co.y *= .82
    if tail:
        tube(name + 'Tail', [((0, .062, 1.030), .014, 'Head'), ((0, .104, .960), .015, 'Head'), ((0, .150, .860), .014, 'Chest'),
                             ((.006, .172, .760), .012, 'Chest'), ((.010, .172, .690), .007, 'Chest')], mat, 6)
    return ob


def tabard(name='Tabard', mat='Team', low=.400, grow=.016, width=(.078, .094), sides=10, chest=.008, ribs=0):
    """A sleeveless surcoat on the trunk (Spine and Chest: the battle dyes it) and a panel hanging
    to `low` in front and at the back (weighted to the Spine too, so it stays the side's colour),
    the sides open over the coat below."""
    top = torso(name, mat, grow=grow, chest=chest, sides=sides, ribs=ribs)
    zt = .548
    for k, s in (('Front', -1), ('Back', 1)):
        rt = max(radius_at(zt, TORSO)[1], radius_at(zt, SKIRT)[1]) + grow + .002
        rb = radius_at(low, SKIRT)[1] + grow + .006
        w0, w1 = width
        slab(name + k, [(-w0, s * rt, zt + .012), (w0, s * rt, zt + .012), (w1, s * rb, low), (-w1, s * rb, low)], mat, 'Spine', depth=.007)
    return top


def straw_hat(name='StrawHat', mat='Straw', band='Team', brim=.136, sides=12):
    """A peasant's round straw hat: a rounded crown, a broad flat brim, a band (Head: Team draws)."""
    lathe(name, [(0, 1.062), (.036, 1.054), (.060, 1.028), (.071, .994), (.073, .966), (brim, .948), (brim + .004, .940),
                 (.072, .946), (0, .950)], mat, sides=sides)
    if band:
        tube(name + 'Band', vertical([.963, .988], -.003, [(.0775, .073), (.0765, .072)], 'Head'), band, sides, caps=(False, False))


def self_bow(grip, length, prop='Prop_L', mat='Wood', string='Cloth', tips='Horn', brace=.050, back=(0, 1, 0), thick=(.0150, .0068), n=12):
    """A tall self bow (the longbow) upright through the fist at `grip`: one long even bend, its tips
    `brace` towards the string side (`back`), horn nocks, a straight string. Parts: longbow,
    longbow-grip, longbow-nock-top/-bottom, longbow-string. Returns (top, bottom) of the string."""
    g, b = Vector(grip), Vector(back).normalized()
    ring = []
    for i in range(n + 1):
        t = i / n
        s = abs(t - .5) * 2
        ring.append((tuple(g + Vector((0, 0, (t - .5) * length)) + b * brace * s * s), thick[0] - (thick[0] - thick[1]) * s, prop))
    tube('longbow', ring, mat, 5, attachment=True)
    tube('longbow-grip', [((g.x, g.y, g.z - .045), .0175, prop), ((g.x, g.y, g.z + .045), .0175, prop)], 'Leather', 6, caps=(False, False), attachment=True)
    top, bottom = Vector(ring[-1][0]), Vector(ring[0][0])
    for nm, tip, up in (('longbow-nock-top', top, 1), ('longbow-nock-bottom', bottom, -1)):
        tube(nm, [(tuple(tip - Vector((0, 0, up * .040))), .0085, prop), (tuple(tip + Vector((0, 0, up * .012))), .0055, prop)], tips, 4, attachment=True)
    tube('longbow-string', [(tuple(bottom + b * .004), .0030, prop), (tuple(top + b * .004), .0030, prop)], string, 3, attachment=True)
    return top, bottom


def hip_sword(name='Sword', side='L', mat='Metal', scabbard='Leather', grip='Leather', length=.42, tip=None):
    """A sword in its scabbard at the hip, hanging back from the belt (Hips): the cross guard and
    the pommel stand up in front of the hip. `tip`: the scabbard's end (the left side's; a rider's
    sword slants back along the horse's flank)."""
    s = 1 if side == 'L' else -1
    top, mid, low = Vector((s * .112, -.040, .538)), Vector((s * .128, .000, .420)), Vector((s * .140, .040, .538 - length))
    if tip:
        low = Vector((s * tip[0], tip[1], tip[2]))
        mid = top.lerp(low, .45) + Vector((s * .008, 0, 0))
    tube(name + 'Scabbard', [(tuple(top), (.016, .010), 'Hips'), (tuple(mid), (.016, .010), 'Hips'), (tuple(low), (.010, .007), 'Hips')], scabbard, 4)
    ax = (top - mid).normalized()
    box(name + 'Guard', tuple(top + ax * .008), (.016, .080, .012), mat, 'Hips')
    tube(name + 'Grip', [(tuple(top + ax * .012), .010, 'Hips'), (tuple(top + ax * .082), .009, 'Hips')], grip, 5, caps=(False, False))
    tube(name + 'Pommel', [(tuple(top + ax * .080), .008, 'Hips'), (tuple(top + ax * .092), .016, 'Hips'), (tuple(top + ax * .104), .006, 'Hips')], mat, 6)


# ---- Gunpowder (about 1750) parts (2026-10-14, build_gunpowder_*.py) ------------------------------------
# What tells the Gunpowder foot from the Kingdoms at a glance: cocked felt hats (the tricorne) and round
# hats instead of steel, a Team coat whose long skirts are lined in a light colour (coat_skirts(),
# weighted to the Spine so the battle dyes them like the coat), white cross belts, breeches and
# gaiters, the flintlock musket with its socket bayonet held upright at the order.

def sweep(name, rows, mat, bone='Head', closed=True, attachment=False):
    """Rows of points round a vertical axis (every row the same count, point 0 of each at the same
    angle) joined row to row; closed=True joins the last row back to the first (a closed section
    swept round: a hat's brim)."""
    n = len(rows[0])
    verts = [tuple(p) for row in rows for p in row]
    pairs = list(zip(range(len(rows) - 1), range(1, len(rows)))) + ([(len(rows) - 1, 0)] if closed else [])
    faces = []
    for a, b in pairs:
        for j in range(n):
            q = (j + 1) % n
            faces += [(a * n + j, a * n + q, b * n + q), (a * n + j, b * n + q, b * n + j)]
    return raw(name, verts, faces, mat, bone, attachment)


def tricorne(name='Tricorne', mat='Felt', lace='Cloth', cockade='Team', brim=.130, inner=.084, wall=.046, base=.950, top=1.028, sides=18):
    """The cocked hat of the line: a low round crown and a broad brim turned up into three walls,
    the points at the front and at the two back corners, the walls highest mid-side, a pale lace
    edging along their tops and a cockade (`cockade`; Head: Team draws) on the left front wall."""
    def plan(j):
        a = 2 * math.pi * j / sides
        phi = (math.degrees(a) % 120) - 60
        return a, min(brim, inner / math.cos(math.radians(phi))), abs(phi) / 60

    def at(a, r, z):
        return (r * math.sin(a), -r * math.cos(a) * .97 - .004, z)
    rows, edge = [[], [], [], []], [[], []]
    for j in range(sides):
        a, R, pt = plan(j)
        h = base + wall * (1 - .40 * pt)
        rows[0].append(at(a, .070, base + .010))
        rows[1].append(at(a, R * .97, base - .006))
        rows[2].append(at(a, R, h))
        rows[3].append(at(a, R - .020, h - .002))
        edge[0].append(at(a, R + .0015, h + .0035))
        edge[1].append(at(a, R - .0215, h + .0015))
    sweep(name + 'Brim', rows, mat)
    sweep(name + 'Lace', edge, lace, closed=False)
    facing[prefix + name + 'Lace'] = (0, 0, 1)
    lathe(name + 'Crown', [(0, top), (.040, top - .004), (.061, top - .020), (.069, base + .030), (.071, base + .004), (0, base + .004)], mat, sides=10)
    if cockade:
        a, R, _ = plan(sides // 6 - 1)
        n = Vector((math.sin(a), -math.cos(a), 0))
        p = Vector(at(a, R, base + .024))
        tube(name + 'Cockade', [(tuple(p - n * .004), .017, 'Head'), (tuple(p + n * .006), .017, 'Head')], cockade, 6)


def round_hat(name='RoundHat', mat='Felt', band='Team', brim=.122, crown=1.052, up=0., sides=12):
    """A round felt hat: a low crown with a flat top, a broad brim, a band (Head: Team draws).
    `up`: the left side of the brim hooked up against the crown by that much."""
    ob = lathe(name, [(0, crown), (.056, crown - .002), (.065, crown - .014), (.068, .968), (.071, .956), (brim, .950), (brim + .004, .942),
                      (.071, .946), (0, .950)], mat, sides=sides)
    if up:
        for v in ob.data.vertices:
            r = math.hypot(v.co.x, v.co.y + .003)
            if r > .075 and v.co.x > .01:
                k = (r - .071) / (brim - .071) * (v.co.x / r)
                v.co.z += up * k
                v.co.x -= up * .45 * k
    if band:
        tube(name + 'Band', vertical([.958, .980], -.003, [(.0725, .0685), (.0715, .0675)], 'Head'), band, sides, caps=(False, False))
    return ob


def fur_cap(name='Bearskin', mat='Fur', plate='Brass', height=1.165, sides=10):
    """A tall fur cap (the sappers'): a tapering drum of fur over the head, a brass plate on its front."""
    lathe(name, [(0, height), (.044, height - .006), (.074, height - .040), (.084, 1.060), (.080, .990), (.074, .948), (0, .950)], mat, sides=sides)
    if plate:
        sheet(name + 'Plate', (-.036, -.083, .990), (.036, -.083, .990), (.026, -.084, 1.068), (-.026, -.084, 1.068), .006, plate, 'Head')


def coat_skirts(name='CoatSkirt', mat='Team', lining='Cloth', low=.360, top=.556, grow=.016, flare=.026, open_deg=56, cols=12, bone='Spine'):
    """The skirts of a long coat from the waist to `low`, round the sides and the back, open in front
    (`open_deg` either side of the front left bare), weighted to `bone` (the Spine: the battle dyes
    them with the coat, where skirts on the hips would draw as plain cloth), lined in `lining`: the
    lining reaches a little further forward, so its edge shows like turned-back skirts."""
    zs = [top, top - (top - low) * .45, low]
    a0 = math.radians(open_deg)
    for part, mat_, g0, extra in ((name, mat, grow, 0), (name + 'Lining', lining, grow - .006, .14)):
        verts = []
        for z in zs:
            t = (top - z) / (top - low)
            rx, ry = (max(p, q) for p, q in zip(radius_at(z, SKIRT), radius_at(z, TORSO)))
            g = g0 + flare * t
            for i in range(cols + 1):
                a = a0 - extra + (2 * math.pi - 2 * (a0 - extra)) * i / cols
                verts.append(((rx + g) * math.sin(a), -(ry + g) * math.cos(a), z))
        faces = []
        for r in range(len(zs) - 1):
            for i in range(cols):
                p, q = r * (cols + 1) + i, (r + 1) * (cols + 1) + i
                faces += [(p, p + 1, q + 1), (p, q + 1, q)]
        raw(part, verts, faces, mat_, bone)
        (radial if part == name else inward).add(prefix + part)


def cross_belts(name='CrossBelt', mat='Cloth', plate='Brass', low=.520, high=.796, width=.028, grow=.020, chest=.010, sides=16, which='LR'):
    """Two pale belts, each from one shoulder across the chest to the other hip and round the back
    (Spine and Chest), crossing in front over a brass plate: the line's white X. `which`: 'L' only the
    belt from the left shoulder, 'R' only the one from the right (a single shoulder strap)."""
    mid, slope = (low + high) / 2, (high - low) / 2
    for k, sgn, g0 in [b for b in (('L', 1, grow), ('R', -1, grow + .003)) if b[0] in which]:
        verts, w = [], []
        for half in (-1, 1):
            for j in range(sides):
                a = 2 * math.pi * j / sides
                z = mid + sgn * slope * math.sin(a) + half * width / 2
                rx, ry = radius_at(z, TORSO)
                g = g0 + (chest if .67 < z < .76 and math.cos(a) > .7 else 0)
                verts.append(((rx + g) * math.sin(a), -(ry + g) * math.cos(a), z))
                w.append({'Spine' if z < .66 else 'Chest': 1})
        faces = []
        for j in range(sides):
            q = (j + 1) % sides
            faces += [(j, q, sides + q), (j, sides + q, sides + j)]
        raw(f'{name}_{k}', verts, faces, mat, weights=w)
        radial.add(prefix + f'{name}_{k}')
    if plate:
        ry = radius_at(mid, TORSO)[1]
        box(name + 'Plate', (0, -(ry + grow + .008), mid), (.032, .008, .038), plate, 'Spine')


def drop(*names):
    """Remove parts made by a shared helper that end up hidden (the ankle boots under gaiters)."""
    for nm in names:
        ob = bpy.data.objects.get(prefix + nm)
        if ob:
            meshes.remove(ob)
            bpy.data.objects.remove(ob, do_unlink=True)


def gaiters(mat='Gaiter', top=.300, sides=7):
    """Cloth gaiters from over the shoe to above the knee (over legs(boots=...); they hide the boot
    tubes, which are dropped)."""
    drop('Boot_L', 'Boot_R')
    for side, s in (('L', 1), ('R', -1)):
        L, S, F = 'Leg_' + side, 'Shin_' + side, 'Foot_' + side
        tube('Gaiter_' + side, [((s * .074, .006, .022), (.035, .044), F), ((s * .074, .004, .075), (.032, .034), {S: .5, F: .5}),
                                ((s * .073, .004, .200), (.045, .046), S), ((s * .071, -.012, .256), (.040, .043), {L: .4, S: .6}),
                                ((s * .070, -.006, top), (.046, .046), L)], mat, sides, caps=(False, False))


def queue(mat='Hair', ribbon='Felt', curls=True):
    """The soldier's hair of the age: the nape, a short plaited queue down the neck tied with a black
    ribbon, and a rolled curl over each ear."""
    hair(mat, crown=False)
    tube('Queue', [((0, .052, .912), .015, 'Head'), ((0, .068, .866), .013, 'Head'), ((0, .076, .812), .009, 'Neck')], mat, 5)
    tube('QueueRibbon', [((0, .061, .894), .017, 'Head'), ((0, .065, .876), .017, 'Head')], ribbon, 5, caps=(False, False))
    if curls:
        for s in (-1, 1):
            tube(f'Curl_{s}', [((s * .060, -.012, .913), .011, 'Head'), ((s * .060, .024, .913), .011, 'Head')], mat, 5)


def neck_stock(mat='Felt'):
    """The black stock round the neck above the coat."""
    return tube('NeckStock', vertical([.784, .806, .826], [0, -.002, -.003], [(.062, .054), (.048, .044), (.042, .040)], ['Chest', 'Neck', 'Neck']), mat, 8, caps=(False, False))


def musket(grip, butt=.012, length=.860, bayonet=.230, prop='Prop_R', wood='Wood', metal='Metal', lock='Metal', name='Musket'):
    """A flintlock musket upright through the fist at `grip`, its butt `butt` above the ground (order
    arms): a stock with a deep butt, a slim wrist and a fore-stock, the barrel on its front (-Y), the
    lock on its right, a socket bayonet above the muzzle (bayonet=0: none). Every part is upright and
    thin, so the far detail level keeps them. Parts <name>Stock, <name>Barrel, <name>Lock, Bayonet."""
    x, y = grip.x, grip.y
    z0, z1 = butt, butt + length
    tube(name + 'Stock', [((x, y + .004, z0), (.010, .023), prop), ((x, y + .003, z0 + .17), (.010, .015), prop), ((x, y, z0 + .23), (.008, .010), prop),
                          ((x, y - .002, z0 + .29), (.010, .013), prop), ((x, y - .002, z1 - .07), (.007, .009), prop)], wood, 6, attachment=True)
    tube(name + 'Barrel', [((x, y - .012, z0 + .26), .0065, prop), ((x, y - .012, z1), .0065, prop)], metal, 5, attachment=True)
    box(name + 'Lock', (x - .011, y - .004, z0 + .285), (.006, .030, .024), lock, prop, True)
    if bayonet:
        tube('BayonetSocket', [((x, y - .012, z1 - .035), .0090, prop), ((x, y - .012, z1 + .004), .0090, prop)], metal, 5, attachment=True)
        tube('Bayonet', [((x, y - .022, z1 + .004), (.0028, .0085), prop), ((x, y - .022, z1 + bayonet * .5), (.0024, .0070), prop),
                         ((x, y - .022, z1 + bayonet), (.0008, .0008), prop)], metal, 4, attachment=True)
    return z1


# ---- Modern (present day) parts (2026-10-14, build_modern_*.py) --------------------------------------------
# What tells the present-day foot from every earlier age at 20 px: a low rounded combat helmet, a bulky
# plate carrier with pouches (Team: Spine and Chest) over a dark uniform with long sleeves, gloves, knee
# pads and high boots, a radio antenna standing over the shoulder, and the short assault rifle held
# upright, muzzle up (upright and thin, so the far detail level keeps it). No camouflage pattern, no
# insignia, no flags: flat colours only.

def hold(side, grip, pole=(.6, .1, -1), out=.034, steps=5):
    """Pose one arm so that its fist (grip_point: `out` past the wrist along the forearm) closes at
    `grip`; reach() places the wrist, this corrects for the fist."""
    want = Vector(grip)
    target = want.copy()
    for _ in range(steps):
        reach(side, target, pole)
        el, wr = arm.pose.bones['Forearm_' + side].head, arm.pose.bones['Hand_' + side].head
        target += want - (wr + (wr - el).normalized() * out)


def combat_boots(mat='Boot', sole='Sole', top=.180):
    """High laced combat boots over legs(boots=mat): the shaft to mid-calf and a thick sole."""
    for side, s in (('L', 1), ('R', -1)):
        S, Fo = 'Shin_' + side, 'Foot_' + side
        tube('BootShaft_' + side, [((s * .074, .004, .112), (.036, .037), S), ((s * .074, .004, top), (.043, .044), S)], mat, 7, caps=(False, False))
        box('BootSole_' + side, (s * .074, -.040, .009), (.064, .142, .018), sole, Fo)


def cargo_trousers(mat, pads='Pad', pockets=True, seat=True):
    """Over legs(hose=mat): the seat of the trousers, cargo pockets on the thighs, knee pads (`pads`:
    their material, None for none)."""
    if seat:
        skirt('TrouserSeat', mat, low=.450, grow=-.014, sides=10)
    for side, s in (('L', 1), ('R', -1)):
        L, S = 'Leg_' + side, 'Shin_' + side
        if pockets:
            box('Pocket_' + side, (s * .113, -.006, .350), (.026, .068, .082), mat, L)
        if pads:
            box('KneePad_' + side, (s * .071, -.056, .262), (.060, .026, .068), pads, S)


def combat_helmet(name='Helmet', mat='Helmet', band='Team', nvg='Gear', strap='Gear', sides=12):
    """The present-day combat helmet: a low rounded shell, the rim higher over the brow and lower over
    the ears and the nape, a cover band (`band`; Head: Team draws), a night-sight mount on the front and
    the chin straps."""
    ob = lathe(name, [(0, 1.052), (.036, 1.047), (.060, 1.028), (.074, .998), (.080, .968), (.0815, .946), (.0835, .936), (.075, .932), (0, .936)],
               mat, sides=sides, sy=1.04)
    for v in ob.data.vertices:
        if v.co.z < .95:
            k = (v.co.y + .003) / .086  # -1 at the brow, 1 at the nape
            v.co.z -= .020 * max(0, k) + .012 * (1 - abs(k)) - .006 * max(0, -k)
    if band:
        tube(name + 'Band', vertical([.958, .992], -.003, [(.0835, .0870), (.0785, .0820)], 'Head'), band, sides, caps=(False, False))
    if nvg:
        box(name + 'Mount', (0, -.087, .978), (.032, .012, .030), nvg, 'Head')
    if strap:
        for s in (-1, 1):
            box(f'{name}Strap_{s}', (s * .066, -.010, .900), (.008, .012, .064), strap, 'Head')
    return ob


def plate_carrier(name='Carrier', mat='Team', pouch='Pouch', gear='Gear', grow=.020, low=.556, high=.752, pouches=3, admin=True, radio=True, back=True):
    """A plate carrier over the shirt (Spine and Chest: the battle dyes it): a squared shell from the
    waist to under the arms closing in onto the shirt at both ends, magazine pouches across the front,
    an admin pouch on the chest, a radio with a tall antenna at the back left (thin and upright: it
    survives the far detail level), a back panel."""
    zs = [low - .012] + [z for z, _, _ in TORSO if low < z < high] + [low, high]
    zs = sorted(set(zs)) + [high + .026]
    rings = []
    for z in zs:
        rx, ry = radius_at(z, TORSO)
        g = .004 if z < low or z > high else grow
        rings.append(((0, 0, z), (rx + g, ry + g), 'Spine' if z < .66 else 'Chest'))
    ob = tube(name, rings, mat, 8, caps=(False, False))
    for i in range(len(rings)):  # square the section: plates front and back
        for j in (1, 7, 3, 5):
            v = ob.data.vertices[i * 8 + j].co
            v.x *= 1.16
            v.y *= 1.30
    radial.add(prefix + name)
    yf = radius_at(.600, TORSO)[1] + grow
    xs = [(k - (pouches - 1) / 2) * .056 for k in range(pouches)]
    for k, x in enumerate(xs):
        box(f'MagPouch{k}', (x, -(yf + .016), .600), (.050, .032, .078), pouch, 'Spine')
        box(f'MagFlap{k}', (x, -(yf + .019), .644), (.052, .036, .014), gear, 'Spine')
    if admin:
        box('AdminPouch', (.036, -(radius_at(.705, TORSO)[1] + grow + .012), .705), (.064, .024, .052), pouch, 'Chest')
    if back:
        box('Hydration', (0, radius_at(.630, TORSO)[1] + grow + .013, .630), (.140, .026, .130), pouch, 'Spine')
    if radio:
        yb = radius_at(.700, TORSO)[1] + grow + .016
        box('Radio', (.076, yb, .700), (.050, .036, .110), gear, 'Chest')
        tube('RadioAntenna', [((.090, yb + .004, .750), .0055, 'Chest'), ((.098, yb + .010, 1.080), .0035, 'Chest')], gear, 4)
    return ob


def chest_rig(name='ChestRig', mat='Team', pouch='Pouch', low=.560, high=.700, pouches=3):
    """A light chest rig (the contractor's): a panel across the front of the chest with pouches on it and
    X straps over the shoulders and round the back (Spine and Chest: the battle dyes it)."""
    yb, yt = radius_at(low, TORSO)[1] + .016, radius_at(high, TORSO)[1] + .018
    slab(name, [(-.100, -yt, high), (.100, -yt, high), (.096, -yb, low), (-.096, -yb, low)], mat, 'Spine', depth=.014)
    for k in range(pouches):
        x = (k - (pouches - 1) / 2) * .060
        box(f'RigPouch{k}', (x, -(yb + .016), .592), (.044, .024, .060), pouch, 'Spine')
    cross_belts(name + 'Strap', mat, plate=None, low=low + .010, high=.800, width=.026, grow=.016, chest=.006)


def hi_vis_vest(name='HiVis', mat='Team', stripe='Reflect', low=.505, high=.770, grow=.012):
    """A high-visibility vest (Spine and Chest: the battle dyes it) with pale reflective bands round the
    body and up the front over the shoulders."""
    rings = [((0, 0, z), tuple(r + grow for r in radius_at(z, TORSO)), 'Spine' if z < .66 else 'Chest')
             for z in sorted({low, high} | {z for z, _, _ in TORSO if low < z < high})]
    rings.append(((0, 0, high + .024), tuple(r + .004 for r in radius_at(high + .024, TORSO)), 'Chest'))
    tube(name, rings, mat, 10, caps=(False, False))
    for k, z in enumerate((.575, .650)):
        band(f'{name}Stripe{k}', stripe, z - .011, z + .011, grow + .004, sides=10, bulge=.001)
    for s in (-1, 1):
        y0, y1 = radius_at(low + .01, TORSO)[1] + grow + .004, radius_at(.735, TORSO)[1] + grow + .004
        slab(f'{name}Brace_{s}', [(s * .040, -y1, .740), (s * .062, -y1, .740), (s * .062, -y0, low + .010), (s * .040, -y0, low + .010)], stripe, 'Spine', depth=.004)


def hard_hat(name='HardHat', mat='HardHat', sides=12):
    """A builder's hard hat: a high rounded shell, a ridge from the brow to the nape, a brim all round
    with a peak at the front."""
    lathe(name, [(0, 1.060), (.036, 1.054), (.060, 1.032), (.071, 1.002), (.074, .972), (.075, .958), (0, .960)], mat, sides=sides)
    rows = []
    for r0, z, peak in ((.071, .966, 0), (1, .956, 1), (1, .948, 1), (.071, .954, 0)):
        row = []
        for j in range(sides):
            a = 2 * math.pi * j / sides
            r = r0 if not peak else .088 + .030 * max(0, math.cos(a)) ** 2
            row.append((r * math.sin(a), -r * math.cos(a) - .003, z))
        rows.append(row)
    sweep(name + 'Brim', rows, mat)
    ridge(name + 'Ridge', [(-.066, 1.020, 1.032), (-.030, 1.050, 1.068), (.030, 1.050, 1.068), (.062, 1.020, 1.032)], mat, half=(.012, .010))


def ball_cap(name='BallCap', mat='Cap', headset='Gear', sides=10):
    """A ball cap with a long bill (`mat`), a headset over it: ear cups, a band over the crown, a boom
    microphone to the mouth."""
    lathe(name, [(0, 1.034), (.034, 1.030), (.056, 1.012), (.066, .986), (.068, .958), (.069, .950), (0, .952)], mat, sides=sides)
    sheet('CapBill', (-.054, -.058, .958), (.054, -.058, .958), (.050, -.132, .944), (-.050, -.132, .944), .008, mat, 'Head')
    if headset:
        for s in (-1, 1):
            box(f'HeadsetCup{s}', (s * .066, .002, .918), (.024, .044, .050), headset, 'Head')
        tube('HeadsetBand', [((-.070, .002, .940), .0055, 'Head'), ((-.064, .002, 1.004), .0055, 'Head'), ((0, .002, 1.044), .0055, 'Head'),
                             ((.064, .002, 1.004), .0055, 'Head'), ((.070, .002, .940), .0055, 'Head')], headset, 4)
        tube('HeadsetMic', [((.074, -.012, .906), .0040, 'Head'), ((.052, -.062, .884), .0040, 'Head'), ((.020, -.074, .884), .0060, 'Head')], headset, 4)


def sunglasses(name='Sunglasses', mat='Gear'):
    box(name, (0, -.0615, .926), (.104, .010, .020), mat, 'Head')


def assault_rifle(grip, prop='Prop_R', body='Gun', metal='Metal', optic='Gear', below=.180, above=.400, name='Rifle'):
    """A short assault rifle upright, muzzle up, its pistol grip in the fist at `grip`: the stock below
    the fist, the receiver, the handguard and the barrel above; the magazine stands forward (-Y), the
    optic on the receiver's top towards the face (+Y). The body is one thin upright piece (the far
    detail level keeps it). Parts <name>Body, <name>Mag, <name>Optic, <name>Muzzle, <name>Grip."""
    x, y, z = grip.x, grip.y + .018, grip.z
    tube(name + 'Body', [((x, y + .002, z - below), (.011, .022), prop), ((x, y + .001, z - below + .080), (.010, .018), prop),
                         ((x, y, z - .030), (.012, .017), prop), ((x, y, z + .130), (.013, .019), prop), ((x, y, z + .150), (.015, .017), prop),
                         ((x, y, z + .330), (.014, .016), prop), ((x, y, z + .345), (.007, .007), prop), ((x, y, z + above), (.0065, .0065), prop)],
         body, 6, attachment=True)
    tube(name + 'Muzzle', [((x, y, z + above - .004), .0090, prop), ((x, y, z + above + .040), .0085, prop)], metal, 6, attachment=True)
    tube(name + 'Mag', [((x, y - .018, z + .100), (.010, .016), prop), ((x, y - .040, z + .060), (.010, .017), prop), ((x, y - .052, z + .020), (.010, .016), prop)],
         body, 4, attachment=True)
    box(name + 'Optic', (x, y + .030, z + .070), (.020, .022, .060), optic, prop, True)
    box(name + 'Grip', (x, y - .022, z - .004), (.016, .026, .040), body, prop, True)
    return Vector((x, y, z))


def modern_soldier(uniform='Uniform', boots='Boot', pads='Pad', carrier='Team', helmet='Helmet', helmet_band='Team', radio=True, pouches=3):
    """A present-day soldier on the current rig: dark uniform with long sleeves and cargo trousers,
    knee pads, high boots, the Team plate carrier with its pouches, a belt, the combat helmet with a
    Team band. Pose the arms, bake_rest(), then fists (gloves) and what they hold."""
    legs(boots=boots, hose=uniform)
    combat_boots(boots)
    arms(long=uniform, pad=.008)
    head()
    hair(crown=False)
    cargo_trousers(uniform, pads)
    torso('Shirt', uniform, grow=.006, chest=.004)
    band('Belt', 'Gear', .528, .552, grow=.014, bone='Spine')
    plate_carrier('Carrier', carrier, radio=radio, pouches=pouches)
    combat_helmet('Helmet', helmet, helmet_band)


def reach(side, wrist, pole=(.6, .1, -1)):
    """Pose one arm so its wrist sits at `wrist` (two-bone reach, the elbow towards `pole`)."""
    A, FA = arm.pose.bones['Arm_' + side], arm.pose.bones['Forearm_' + side]
    bpy.context.view_layer.update()
    S = A.head.copy()
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
    mine = own()
    for ob in mine:
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
    for ob in mine:
        mod = ob.modifiers.new('CanonicalRig', 'ARMATURE')
        mod.object = arm
    bpy.ops.object.select_all(action='DESELECT')


def fix_normals(open_facing=None, around=()):
    """Every part's faces point outward. `open_facing`: {object name: the way an open sheet faces};
    `around`: names of objects made of loose sheets round the body (each face away from the Z axis)."""
    open_facing = open_facing or {}
    for ob in meshes:
        if ob.name in loose:
            continue
        bm = bmesh.new()
        bm.from_mesh(ob.data)
        want = open_facing.get(ob.name)
        if ob.name in around or ob.name in inward:
            bm.normal_update()
            sign = -1 if ob.name in inward else 1
            flip = [f for f in bm.faces if sign * f.normal.dot(Vector((f.calc_center_median().x, f.calc_center_median().y, 0))) < 0]
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
        lift = .012 if ob.name in loose else .004  # two-sided sheets and hand-wound parts start their rays further out
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
                        hit = bvh.ray_cast(p + nrm * lift, d, reach)
                        if hit[0] is not None:
                            hits += k * (1 - hit[3] / reach * .5)
                    ao = 1 - strength * (hits / weight if weight else 0)
                    ground = .86 + .14 * min(1, max(0, p.z / .55))  # darker towards the feet
                    cache[vi] = 1 if ob.name in bright else max(.42, min(1, ao * ground))
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


def export_scene(path, animations=False, mode='ACTIONS'):
    """Every rig, mesh and empty of the scene as one GLB with COLOR_0 (a unit of several rigs)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.context.scene.objects:
        if o.type in ('MESH', 'ARMATURE', 'EMPTY'):
            o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(path), export_format='GLB', use_selection=True, export_yup=True, export_skins=True,
                              export_animations=animations, export_animation_mode=mode, export_force_sampling=True, export_frame_range=False,
                              export_cameras=False, export_lights=False, export_extras=True, export_materials='EXPORT', export_image_format='NONE',
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)


def preview_scene(out, uid, centre=(0, 0, .6), scale=2.4):
    """Workbench stills of the whole file (flat colours): front quarter, back quarter, the game's view, a side."""
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_cavity = True
    scene.render.resolution_x, scene.render.resolution_y = 900, 900
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('W')
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam'))
    scene.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = scale
    scene.camera = cam
    for o in scene.objects:
        if o.type == 'ARMATURE':
            o.hide_viewport = o.hide_render = True
    c = Vector(centre)
    for name, off in {'front': (1.2, -3, .9), 'back': (-1.2, 3, .9), 'game': (2.2, -2.6, 3.4), 'side': (4, 0, .4)}.items():
        cam.location = c + Vector(off)
        cam.rotation_euler = (c - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(out / f'preview-{uid}-{name}.png')
        bpy.ops.render.render(write_still=True)
    for o in scene.objects:
        if o.type == 'ARMATURE':
            o.hide_viewport = o.hide_render = False
    bpy.data.objects.remove(cam, do_unlink=True)


def finish_unit(uid, parts, notes, open_facing=None, animations=False, mode='ACTIONS', centre=(0, 0, .6), scale=2.4):
    """A unit of several rigs: every mesh of the scene shaded (COLOR_0), one root empty named `uid`
    over `parts`, then <uid>.blend, <uid>.glb and report.json in art-build/units/<uid>/. Returns the triangles."""
    import json
    import os
    adopt([o for o in bpy.context.scene.objects if o.type == 'MESH'])
    for o in meshes:
        for p in o.data.polygons:
            p.use_smooth = False
    fix_normals(open_facing)
    shade = bake_shade()
    root = u.assemble(uid, parts)
    out = u.out_dir(uid)
    tris = u.scene_triangles()
    if os.environ.get('TI_PREVIEW'):
        preview_scene(out, uid, centre, scale)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(out / f'{uid}.blend'))
    export_scene(out / f'{uid}.glb', animations, mode)
    rigs = {o.name: [b.name for b in o.data.bones] for o in bpy.context.scene.objects if o.type == 'ARMATURE'}
    mats = sorted({s.material.name for o in meshes for s in o.material_slots if s.material})
    by_rig = {}
    for o in meshes:
        k = o.parent.name if o.parent else '-'
        by_rig[k] = by_rig.get(k, 0) + u.triangles([o])
    report = {'id': uid, 'triangles': tris, 'by_rig': by_rig, 'rigs': rigs, 'materials': mats, 'textures': 0,
              'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
              'shade_range': shade, 'person_height_H': 1, 'front': 'Blender -Y, glTF +Z', **notes}
    (out / 'report.json').write_text(json.dumps(report, indent=2))
    print(f'BUILT {uid} triangles={tris} by_rig={by_rig} shade={shade} root={root.name}', flush=True)
    return tris


# ---- Classical mounted parts (2026-10-14, build_classical_cavalry/general/raider.py) ------------------
SEAT = Vector((0, -.07, .345))  # a rider's rig on the fine horse's back (ti_mounts.fine_horse)
ASTRIDE = {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0)}


def astride(right=None, left=None, seat=SEAT, right_pole=(-.8, .3, -1), left_pole=(.8, .2, -1), extra=None):
    """Seat the current figure on a horse: the legs astride (ASTRIDE, `extra` bones too), each given
    wrist reached to its point, the pose baked into the rest pose, the rig placed on `seat`."""
    pose({**ASTRIDE, **(extra or {})})
    if right is not None:
        reach('R', right, right_pole)
    if left is not None:
        reach('L', left, left_pole)
    bake_rest()
    place(seat)


def scale_coat(name='ScaleCoat', mat='Metal', low=.505, high=.785, rows=5, sides=12, grow=.013, scallop=.014, profile=TORSO):
    """A coat of scales over the trunk: `rows` bands from `high` down to `low`, each overlapping the
    one below, its lower edge scalloped (every second point lower) and set half a scale round from
    the row above, so the facets read as scales from the battle's height. Spine and Chest bones."""
    step = (high - low) / rows
    verts, faces, vw = [], [], []
    for r in range(rows):
        z1 = high - r * step
        z0 = z1 - step * 1.35
        off = math.pi / sides * (r % 2)
        base = len(verts)
        for k, (z, out) in enumerate(((z1, 0), (z0, .007))):
            for j in range(sides):
                a = 2 * math.pi * j / sides + off
                rx, ry = radius_at(z, profile)
                zz = z - (scallop if k and j % 2 else 0)
                g = grow + out + r * .0015
                verts.append(((rx + g) * math.sin(a), -(ry + g) * math.cos(a), zz))
                vw.append({'Spine' if zz < .66 else 'Chest': 1})
        for j in range(sides):
            q = (j + 1) % sides
            faces += [(base + j, base + q, base + sides + q), (base + j, base + sides + q, base + sides + j)]
    return raw(name, verts, faces, mat, weights=vw)


def cloak(name='Cloak', mat='Team', top=.792, low=.46, rows=4, k=7, arc=(150, 85), width=(.118, .200), depth=(.074, .090),
          back=(.004, .150), thick=.012, split=.66, bones=('Chest', 'Spine')):
    """A cloak as a thick shell from the shoulders down the back: each row an arc round the back
    (`arc` degrees either side of +Y at the top and at the foot), wider and further back as it falls.
    Chest above `split`, Spine below (the battle dyes both); `bones` names those two (a helmet's
    mantling: ('Head', 'Head'))."""
    verts, vw = [], []
    for i in range(rows):
        t = i / (rows - 1)
        z = top + (low - top) * t
        a_deg = arc[0] + (arc[1] - arc[0]) * t
        rx, ry, cy = (width[0] + (width[1] - width[0]) * t, depth[0] + (depth[1] - depth[0]) * t, back[0] + (back[1] - back[0]) * t)
        for shell in (0, 1):
            for j in range(k):
                a = math.radians(-a_deg + 2 * a_deg * j / (k - 1))
                d = thick * shell
                verts.append(((rx - d) * math.sin(a), cy + (ry - d) * math.cos(a), z))
                vw.append({bones[0] if z > split else bones[1]: 1})
    faces = []
    row = 2 * k
    for i in range(rows - 1):
        for shell in (0, 1):
            for j in range(k - 1):
                a, b = i * row + shell * k + j, i * row + shell * k + j + 1
                c, d = a + row, b + row
                faces += [(a, b, d), (a, d, c)] if shell == 0 else [(a, d, b), (a, c, d)]
        for j in (0, k - 1):  # the two side edges
            o, n_ = i * row + j, i * row + k + j
            faces += [(o, n_, n_ + row), (o, n_ + row, o + row)] if j == 0 else [(o, n_ + row, n_), (o, o + row, n_ + row)]
    for i in (0, rows - 1):  # the top and the hem
        for j in range(k - 1):
            o, n_ = i * row + j, i * row + k + j
            faces += [(o, o + 1, n_ + 1), (o, n_ + 1, n_)] if i == 0 else [(o, n_ + 1, o + 1), (o, n_, n_ + 1)]
    return raw(name, verts, faces, mat, weights=vw)


def pointing_hand(side, mat='Skin'):
    """An open hand pointing along the forearm: the palm, the index finger out, the thumb along it.
    Returns the fingertip."""
    H = 'Hand_' + side
    el, wr = arm.data.bones['Forearm_' + side].head_local.copy(), arm.data.bones[H].head_local.copy()
    d = (wr - el).normalized()
    tube('BodyHand_' + side, [(tuple(wr), (.022, .024), H), (tuple(wr + d * .045), (.026, .013), H), (tuple(wr + d * .068), (.020, .011), H)], mat, 6)
    tube('IndexFinger_' + side, [(tuple(wr + d * .062), .0075, H), (tuple(wr + d * .115), .006, H)], mat, 4)
    up = Vector((0, 0, 1))
    tube('Thumb_' + side, [(tuple(wr + d * .030 + up * .012), .007, H), (tuple(wr + d * .068 + up * .016), .006, H)], mat, 4)
    return wr + d * .115


def phrygian_cap(name='PhrygianCap', mat='Team', sides=10, tip=True):
    """The soft felt cap of the steppe and Thrace: a high crown whose tip falls forward over the brow."""
    lathe(name, [(0, .936), (.0705, .936), (.0735, .952), (.073, .995), (.064, 1.040), (.044, 1.072), (0, 1.082)], mat, sides=sides, cy=.002)
    if tip:
        tube(name + 'Tip', [((0, .008, 1.060), .042, 'Head'), ((0, -.016, 1.112), .033, 'Head'), ((0, -.062, 1.124), .021, 'Head'),
                            ((0, -.100, 1.092), .007, 'Head')], mat, 6)


def turn(objects, centre, degrees, axis='Z'):
    """Rotate parts' meshes about a point (a shield turned to face the side)."""
    c = Vector(centre)
    m = Matrix.Translation(c) @ Matrix.Rotation(math.radians(degrees), 4, axis) @ Matrix.Translation(-c)
    for o in objects:
        o.data.transform(m)
        o.data.update()


# ---- Kingdoms mounted parts (2026-10-14, build_kingdoms_cavalry/general/raider.py) ------------------
# What tells the medieval horseman from the Classical: the closed great helm with its Team torse and
# mantling, mail all over with steel knees and shoulders, a Team surcoat whose flaps lie over the lap
# and the saddle's cantle, the heater shield, stirrups and the high war saddle (ti_mounts.war_saddle).

def shell(name, grid, thick, mat, bone, attachment=False):
    """A thick cloth from a grid of points (rows of the same count): the grid is one face, the other
    is `thick` behind it along each point's normal, the edges closed. Returns the mesh (closed, so
    fix_normals makes it point outward)."""
    rows, cols = len(grid), len(grid[0])
    P = [[Vector(p) for p in row] for row in grid]
    verts = [p for row in P for p in row]
    n = [None] * (rows * cols)
    for r in range(rows):
        for c in range(cols):
            du = P[r][min(cols - 1, c + 1)] - P[r][max(0, c - 1)]
            dv = P[min(rows - 1, r + 1)][c] - P[max(0, r - 1)][c]
            n[r * cols + c] = du.cross(dv).normalized()
    v = [tuple(p) for p in verts] + [tuple(p - n[i] * thick) for i, p in enumerate(verts)]
    off = rows * cols
    f = []
    for r in range(rows - 1):
        for c in range(cols - 1):
            a, b, d, e = r * cols + c, r * cols + c + 1, (r + 1) * cols + c + 1, (r + 1) * cols + c
            f += [(a, b, d), (a, d, e), (off + a, off + d, off + b), (off + a, off + e, off + d)]
    edge = [r * cols for r in range(rows)][::-1] + list(range(cols)) + [r * cols + cols - 1 for r in range(rows)] + \
        [(rows - 1) * cols + c for c in range(cols)][::-1]
    loop = []
    for k in edge:
        if not loop or loop[-1] != k:
            loop.append(k)
    if loop[0] == loop[-1]:
        loop.pop()
    for k in range(len(loop)):
        a, b = loop[k], loop[(k + 1) % len(loop)]
        f += [(a, off + b, b), (a, off + a, off + b)]
    return raw(name, v, f, mat, bone, attachment)


def great_helm(name='GreatHelm', mat='Metal', slit='Slit', trim='Brass', torse='Team', mantling='Team', sides=10):
    """The closed great helm of the knights: a flat-topped drum over the whole head (drop the face's
    nose, eyes and brows under it), two eye slits, a brass cross down the face; on its crown a Team
    torse (a twisted wreath) and a Team mantling hanging from the crown down the back to the
    shoulders with a dagged edge (all on Head: the battle dyes them)."""
    lathe(name, [(0, 1.040), (.056, 1.040), (.070, 1.031), (.077, 1.000), (.078, .946), (.077, .892), (.073, .852), (.066, .834)], mat,
          sides=sides, sy=1.0, cy=-.006)
    for s in (-1, 1):
        box(f'{name}Slit_{s}', (s * .031, -.083, .949), (.040, .010, .011), slit, 'Head')
    box(name + 'Cross', (0, -.085, .935), (.014, .008, .176), trim, 'Head')
    box(name + 'Brow', (0, -.083, .968), (.100, .008, .012), trim, 'Head')
    if torse:
        ob = tube(name + 'Torse', vertical([1.024, 1.036, 1.050], -.006, [(.074, .074), (.077, .077), (.066, .066)], 'Head'), torse, 10, caps=(False, True))
        for j in range(0, 10, 2):  # the twist: every second point of the middle ring proud
            v = ob.data.vertices[10 + j].co
            v.x, v.y = v.x * 1.06, (v.y + .006) * 1.06 - .006
    if mantling:
        ob = cloak(name + 'Mantling', mantling, top=1.030, low=.800, rows=3, k=5, arc=(70, 96), width=(.072, .118), depth=(.074, .104),
                   back=(-.006, .040), thick=.008, bones=('Head', 'Head'))
        for j in range(5):  # a dagged edge: every second point of the hem higher
            if j % 2:
                for shell_ in (0, 1):
                    ob.data.vertices[2 * 2 * 5 + shell_ * 5 + j].co.z += .030


def poleyns(mat='Metal'):
    """Steel knee cops over hose or mail: a small dome on the front of each knee (Leg and Shin)."""
    for side, s in (('L', 1), ('R', -1)):
        w = {'Leg_' + side: .5, 'Shin_' + side: .5}
        tube('Poleyn_' + side, [((s * .071, -.028, .262), (.044, .040), w), ((s * .071, -.050, .262), (.038, .034), w), ((s * .071, -.064, .262), (.014, .012), w)],
             mat, 6, caps=(False, True))


def surcoat_flaps(name='Surcoat', mat='Team', front=True, back=True, thick=.008):
    """The skirts of a seated rider's surcoat as two flaps on the Spine (so the battle dyes them): the
    front one over the lap and the saddle's pommel, the back one over the cantle onto the horse's
    back. Points in the figure's own space; build them before astride() (the Spine does not move)."""
    out = []
    if front:
        out.append(shell(name + 'Front', [[(-.090, -.094, .556), (0, -.102, .560), (.090, -.094, .556)],
                                          [(-.122, -.138, .470), (0, -.150, .540), (.122, -.138, .470)],
                                          [(-.140, -.172, .430), (0, -.190, .492), (.140, -.172, .430)]], thick, mat, 'Spine'))
    if back:
        out.append(shell(name + 'Back', [[(-.090, .072, .558), (0, .080, .560), (.090, .072, .558)],
                                         [(-.104, .160, .526), (0, .172, .532), (.104, .160, .526)],
                                         [(-.118, .226, .436), (0, .240, .430), (.118, .226, .436)]], thick, mat, 'Spine'))
    return out


def heater_shield(centre, w, h, prop='Prop_L', face='Emblem', back='Wood', rim='Metal', curve=.024, name='Shield', grip='Leather'):
    """The medieval heater shield facing -Y: a straight top, the sides falling to a point, curved
    round the arm (`curve`); its face the squad's Emblem (UVs across its own box), a wooden back, a
    steel edge and a grip. Parts <name>Face, <name>Back, <name>Rim, <name>Grip. Returns the face's and
    the back's names (for fix_normals' open_facing)."""
    cx, cy, cz = centre
    outline = [(-.5, .50), (-.25, .53), (0, .54), (.25, .53), (.5, .50), (.5, .18), (.46, -.06), (.36, -.26), (.20, -.42), (0, -.50),
               (-.20, -.42), (-.36, -.26), (-.46, -.06), (-.5, .18)]

    def at(x, z, dy, grow=0):
        k = 1 + grow
        X, Z = x * w * k, z * h * k
        return (cx + X, cy + dy - curve * (1 - (2 * x) ** 2), cz + Z)
    fv = [(cx, cy - curve - .004, cz)] + [at(x, z, 0) for x, z in outline]
    n = len(outline)
    ff = [(0, 1 + (j + 1) % n, 1 + j) for j in range(n)]
    fob = raw(name + 'Face', fv, ff, face, prop, True)
    uv = fob.data.uv_layers.active.data
    for poly in fob.data.polygons:
        for li in poly.loop_indices:
            co = fob.data.vertices[fob.data.loops[li].vertex_index].co
            uv[li].uv = ((co.x - cx) / w + .5, (co.z - cz) / (h * 1.08) + .5)
    bv = [(cx, cy - curve + .014, cz)] + [at(x, z, .012) for x, z in outline]
    raw(name + 'Back', bv, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)], back, prop, True)
    rv = []
    for x, z in outline:
        rv += [at(x, z, -.004, .025), at(x, z, .014, .025)]
    rf = []
    for j in range(n):
        a, b = 2 * j, 2 * ((j + 1) % n)
        rf += [(a, b, b + 1), (a, b + 1, a + 1)]
    raw(name + 'Rim', rv, rf, rim, prop, True)
    tube(name + 'Grip', [((cx - .055, cy + .020, cz + .02), .010, prop), ((cx, cy + .038, cz + .02), .011, prop), ((cx + .055, cy + .020, cz + .02), .010, prop)],
         grip, 4, attachment=True)
    return prefix + name + 'Face', prefix + name + 'Back'
