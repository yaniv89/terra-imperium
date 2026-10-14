# scripts/blender/ti_trees.py
# The battle's trees since 14 October (manifest rows MD05 and MD14, plans/art-pilot/md05-trees/LOG.md):
# two to four species per climate kit, each at three sizes. The complaint they answer: one species
# everywhere in flat-shaded shards, crowns floating on thin sticks, woods that turn into a spiky
# dark mass. So every tree here has
#   a sturdy trunk   one tube with a flared foot, 0.5 to 1 m across on a large tree, bare for the
#                    lower third or more so it shows from the battle camera (41 degrees up)
#   a soft crown     a few large rounded clumps (icospheres, barely jittered) whose faces export
#                    with smoothed normals (ti_town.SMOOTH), in a lighter leaf colour per species
#   far levels       LOD1 is the trunk and one rounded mass the size of the crown, LOD2 the same
#                    from 20 faces: a wood seen from far is separate soft balls, not shards
# Sizes: index 0 small, 1 medium, 2 large. Scale 1 unit = 10 m. Budget 600 / 150 / 150 triangles
# (validate_model.py `tree`); these use about 300 to 520 / 30 to 110 / 26 to 50.
# build_nature.py lays them into the kits; ti_nature.py keeps the older shapes (the stump, the
# felled trunk, bushes, rocks, and the trees the conifer, tropical and cold builder still calls).
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------
# Crowns: a hue of their own per species, so mixed woods show their mix from far, but all in the
# temperate oak's value range (about 0.4 to 0.47 in luminance) and saturated: the game's bright
# sun washes a pale grey-green crown out to white at far zoom (14 October tone pass).
LEAVES = {
    'oak_leaf': ['#44742a', '#538434', '#61923c', '#3a6624'],
    'beech_leaf': ['#4a8a2e', '#56963a', '#3f7e28'],
    'birch_leaf': ['#6e8c2c', '#7a9836', '#628024'],
    'olive_crown': ['#587a3e', '#648648', '#4c6e36'],
    'stonepine_crown': ['#43702e', '#508038', '#5e8e40'],
    'cypress_crown': ['#31573a', '#3c6844', '#2a4c32'],
    'acacia_crown': ['#66802c', '#728c36', '#5a7426'],
    'tamarisk_crown': ['#5a7a3c', '#668646', '#4e6e34'],
    'tamarisk_bloom': ['#a05a64', '#ae6a72', '#904e58'],
    'poplar_crown': ['#548a30', '#60963a', '#4a7e2a'],
    'elm_crown': ['#5e7a2e', '#6a8638', '#526e28'],
    'saxaul_crown': ['#7a7a2a', '#868634', '#6c6c22'],
    'pine_crown': ['#3f7040', '#4c804a', '#5a8e54'],
    'fir_crown': ['#2f6048', '#3a7054', '#28543e'],
    'spruce_crown': ['#30603e', '#3a6c48', '#2a5636'],
    'jungle_crown': ['#3a7e34', '#448a3c', '#34722e'],
    'larch_crown': ['#b07e22', '#bc8a2c', '#a0701c'],
    'dwarf_birch_crown': ['#b08a26', '#bc9630', '#a07c20'],
    'tundra_crown': ['#9a3c32', '#a84a3c', '#8a342c'],
}
# Flat leaves (fronds) and bark.
FLAT = {
    'date_frond': (['#78a84e', '#84b458', '#6c9c46'], None),
    'coco_frond': (['#4c8834', '#58943c', '#427e2e'], None),
    'banana_leaf': (['#62a038', '#6eac42', '#58962f'], None),
    'dates': (['#b8782c', '#c88a38', '#a46824'], None),
    'coconut': (['#6a4a2a', '#7a5a34', '#5a3e22'], None),
    'banana_stem': (['#b8b04a', '#c8c058', '#a49c3e'], {'dir': 'Z', 'scale': 40.0, 'distortion': 3.0}),
    'bark_oak': (['#5a4430', '#6c543c', '#4a3828'], {'dir': 'Z', 'scale': 60.0, 'distortion': 8.0}),
    'bark_beech': (['#8e8c82', '#a09e94', '#7c7a70'], {'dir': 'Z', 'scale': 40.0, 'distortion': 6.0}),
    'bark_olive': (['#6e6252', '#80725e', '#5c5244'], {'dir': 'Z', 'scale': 50.0, 'distortion': 14.0}),
    'bark_red': (['#a8643c', '#ba7648', '#925432'], {'dir': 'Z', 'scale': 50.0, 'distortion': 8.0}),
    'bark_palm': (['#8a7250', '#9c845e', '#786244'], {'dir': 'Z', 'scale': 110.0, 'distortion': 1.0}),
    'bark_saxaul': (['#aa9a7a', '#bcae8e', '#908266'], {'dir': 'Z', 'scale': 50.0, 'distortion': 14.0}),
    'bark_jungle': (['#6a5238', '#7c6244', '#5a442e'], {'dir': 'Z', 'scale': 60.0, 'distortion': 8.0}),
    'bark_dark': (['#4e4034', '#5e4e40', '#40342a'], {'dir': 'Z', 'scale': 60.0, 'distortion': 8.0}),
    'steppe_grass': (['#b8a65e', '#cab870', '#a4924e', '#d4c480'], {'dir': 'Z', 'scale': 120.0, 'distortion': 4.0}),
}
for _n in list(LEAVES) + list(FLAT):
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.SMOOTH.update(LEAVES)
# Fronds too: smooth, and (build_nature.soft_crown_uvs) a far frond takes its colour from a lit
# full-size frond, not one in the crown's shade, which drew far palms near black.
tt.SMOOTH.update(['date_frond', 'coco_frond', 'banana_leaf'])


def make_materials():
    for name, colors in LEAVES.items():
        tm.mat_simple(name, colors, scale=12.0, bump=0.5)
    for name, (colors, stripes) in FLAT.items():
        tm.mat_simple(name, colors, scale=12.0, stripes=stripes, bump=0.5)


if not any(n == 'trees' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('trees', make_materials))


# ---- parts --------------------------------------------------------------------------------------

def tube(ms, mat, pts, radii, segs=7, lod=0, only=None, cap=True):
    """One round piece through `pts` with a radius at each (a trunk, a limb): a ring per point,
    the first ring level on the ground. 2 * segs triangles a section, and the cap."""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        d = Vector((0, 0, 1)) if i == 0 else (pts[min(i + 1, len(pts) - 1)] - pts[i - 1]).normalized()
        q = d.to_track_quat('Z', 'Y').to_matrix()
        rings.append([bm.verts.new(p + q @ Vector((radii[i] * math.cos(2 * math.pi * k / segs), radii[i] * math.sin(2 * math.pi * k / segs), 0)))
                      for k in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for k in range(segs):
            j = (k + 1) % segs
            bm.faces.new((a[k], a[j], b[j], b[k]))
    if cap:
        bm.faces.new(rings[-1])
    bm.normal_update()
    return ms.add(bm, mat, lod, only=only)


def clump(ms, leaf, at, radii, rng=None, jitter=0.07, detail=2, lod=0, only=None, taper=0.0, yaw=0.0):
    """One rounded leaf mass: an icosphere (80 faces at detail 2, 20 at 1) or, at detail 'uv', an
    eight-sided sphere of four rows (48 triangles, rounder than 20 faces once smoothed) with
    half-axes `radii`, barely jittered so it stays round; `taper` draws its top in (a spire, a
    fir's tier)."""
    bm = bmesh.new()
    if detail == 'uv':
        bmesh.ops.create_uvsphere(bm, u_segments=8, v_segments=4, radius=1.0)
    else:
        bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    for v in bm.verts:
        if rng is not None and jitter:
            v.co *= 1.0 + rng.uniform(-jitter, jitter)
        if taper:
            k = 1.0 - taper * (v.co.z + 1.0) / 2.0
            v.co.x *= k
            v.co.y *= k
    m = Matrix.Translation(Vector(at)) @ Matrix.Rotation(yaw, 4, 'Z') @ Matrix.Diagonal(Vector((radii[0], radii[1], radii[2], 1.0)))
    return ms.add(bm, leaf, lod, m, only=only)


def crown(ms, leaf, clumps, rng, mid_detail=2, taper=0.0, far_scale=0.94, hull=None):
    """A crown from `clumps` [((x, y, z), (rx, ry, rz), taper, material or None)]: every clump at
    LOD0; at LOD1 and LOD2 one mass filling the clumps' bounds (48 and 20 triangles; 20 and 20 for
    a small tree, mid_detail 1). LOD1 was 80 until the zoom 1 budget pass (14 October): the game
    draws thousands of trees at that level."""
    if mid_detail == 2:
        mid_detail = 'uv'
    for at, radii, tp, mat in clumps:
        clump(ms, mat or leaf, at, radii, rng, 0.07, 2, lod=0, only=(0,), taper=tp, yaw=rng.uniform(0, 6.28))
    part = [c for c in clumps if c[3] is None] if hull is None else hull
    lo = [min(c[0][i] - c[1][i] for c in part) for i in range(3)]
    hi = [max(c[0][i] + c[1][i] for c in part) for i in range(3)]
    centre = [(lo[i] + hi[i]) / 2 for i in range(3)]
    half = [(hi[i] - lo[i]) / 2 * far_scale for i in range(3)]
    clump(ms, leaf, centre, half, random.Random(rng.randrange(1 << 30)), 0.05 if mid_detail == 'uv' else 0.0, mid_detail, lod=1, only=(1,), taper=taper)
    clump(ms, leaf, centre, half, None, 0, 1, lod=2, only=(2,), taper=taper)
    return centre, half


def trunk(ms, bark, pts, radii, segs=7, far=1.25):
    """A trunk at three levels: every ring at LOD0, a four-sided post at LOD1 (8 triangles), a
    three-sided post at LOD2; the far ones thicker by `far`, so they still show."""
    tube(ms, bark, pts, radii, segs, lod=0, only=(0,))
    tube(ms, bark, [pts[0], pts[-1]], [radii[0] * 1.1, radii[-1] * 1.25], 4, lod=1, only=(1,), cap=False)
    tube(ms, bark, [pts[0], pts[-1]], [radii[0] * far, radii[-1] * far * 1.3], 3, lod=2, only=(2,), cap=False)


def stem_points(top, r, flare=1.5, lean_curve=0.5, into=None, into_r=0.45):
    """A trunk's points and radii from the ground to `top`: a flared foot, a waist, the top, and
    (when `into` is given) a last thin length up into the crown."""
    top = Vector(top)
    pts = [Vector((0, 0, -0.008)), Vector((top.x * 0.06, top.y * 0.06, top.z * 0.1)),
           Vector((top.x * lean_curve, top.y * lean_curve, top.z * 0.55)), top]
    radii = [r * flare, r * 1.05, r * 0.9, r * 0.72]
    if into is not None:
        pts.append(Vector(into))
        radii.append(r * into_r)
    return pts, radii


def frond(ms, mat, base, angle, length, width, rise=0.25, droop=0.5, segs=3, lod=0, only=None):
    """A palm frond: a flat arching leaf from `base` out along `angle`, both faces drawn.
    4 * segs triangles."""
    base = Vector(base)
    out = Vector((math.cos(angle), math.sin(angle), 0))
    side = Vector((-out.y, out.x, 0))
    prof = [0.4, 1.0, 0.85, 0.5, 0.15]
    top, under = bmesh.new(), None
    rows = []
    for k in range(segs + 1):
        t = k / segs
        p = base + out * (length * t) + Vector((0, 0, length * (rise * math.sin(math.pi * min(1.0, t * 1.2)) - droop * t * t)))
        w = width * (prof[min(len(prof) - 1, round(t * (len(prof) - 1)))] if k < segs else 0.12)
        rows.append((top.verts.new(p - side * w / 2), top.verts.new(p + side * w / 2)))
    for (a0, a1), (b0, b1) in zip(rows, rows[1:]):
        top.faces.new((a0, a1, b1, b0))
    top.normal_update()
    under = top.copy()
    bmesh.ops.reverse_faces(under, faces=under.faces)
    # the underside a little below, or the ambient-occlusion bake finds each side shut by the other
    bmesh.ops.translate(under, vec=(0, 0, -0.004), verts=under.verts)
    ms.add(top, mat, lod, only=only)
    ms.add(under, mat, lod, only=only)


# ---- tree forms -----------------------------------------------------------------------------------

def broad_tree(ms, rng, h, r, t, bark, leaf, n=4, squash=0.82, lean=0.0, sweep=0.0, limbs=2, trunk_to=0.5, mid_detail=2, segs=7, top_mat=None):
    """A broad tree (oak, beech, olive, elm, a jungle giant): a trunk bare to `trunk_to` of the
    height, then limbs into a crown of n clumps, a ring of n - 1 and one on top. `lean` tips the
    trunk, `sweep` pushes the crown downwind of it."""
    cx = lean * h + sweep * r
    cz = h - r * squash * 1.02
    top = Vector((lean * h, 0, trunk_to * h))
    pts, radii = stem_points(top, t, into=(cx * 0.9 + top.x * 0.1, 0, cz))
    trunk(ms, bark, pts, radii, segs)
    clumps = []
    for k in range(n - 1):
        a = 2 * math.pi * k / (n - 1) + rng.uniform(-0.3, 0.3)
        rr = r * rng.uniform(0.56, 0.66)
        at = (cx + math.cos(a) * r * 0.5, math.sin(a) * r * 0.5, cz - r * squash * 0.12 + rng.uniform(-0.1, 0.08) * r)
        clumps.append((at, (rr, rr, rr * squash), 0.0, None))
        if k < limbs:
            tube(ms, bark, [(top.x, 0, top.z * 0.9), (at[0] * 0.85 + top.x * 0.15, at[1] * 0.85, at[2] - rr * squash * 0.35)], [t * 0.5, t * 0.26], 4, lod=0, only=(0,), cap=False)
    rr = r * 0.62
    clumps.append(((cx + sweep * r * 0.25, 0, h - rr * squash), (rr, rr, rr * squash), 0.0, top_mat))
    crown(ms, leaf, clumps, rng, mid_detail, hull=clumps)


def column_tree(ms, rng, h, r, t, bark, leaf, n=4, bare=0.16, profile=None, taper=0.3, tip=0.7, mid_detail=2, segs=6, wobble=0.1, hull_taper=0.45):
    """A column (cypress, poplar, birch) or a cone (fir, spruce, larch): clumps stacked up the
    trunk, each `profile(share of the height)` wide and drawn in toward its top."""
    profile = profile or (lambda s: 1.0 - 0.55 * s)
    z0 = bare * h
    pts, radii = stem_points((0, 0, z0 + (h - z0) * 0.5), t, flare=1.4)
    trunk(ms, bark, pts, radii, segs)
    step = (h - z0) / n
    clumps = []
    for k in range(n):
        s = (k + 0.5) / n
        rr = r * profile(s)
        at = (rng.uniform(-wobble, wobble) * r, rng.uniform(-wobble, wobble) * r, z0 + step * (k + 0.5))
        clumps.append((at, (rr, rr, step * 0.78), tip if k == n - 1 else taper, None))
    lo, hi = z0 + step * 0.5 - step * 0.78, h
    hull = [((0, 0, (lo + hi) / 2), (r * max(profile(0.5 / n), profile(0.5)), r * max(profile(0.5 / n), profile(0.5)), (hi - lo) / 2), 0.0, None)]
    crown(ms, leaf, clumps, rng, mid_detail, taper=hull_taper, far_scale=1.0, hull=hull)


def umbrella_tree(ms, rng, h, r, t, bark, leaf, n=5, thick=0.36, lean=0.05, trunk_to=0.66, forks=3, mid_detail=2, segs=7):
    """A flat-crowned tree (stone pine, umbrella thorn): a tall bare trunk forking under a wide
    low crown, a ring of n - 1 clumps and one in the middle."""
    top = Vector((lean * h, 0, trunk_to * h))
    cz = h - r * thick * 0.95
    pts, radii = stem_points(top, t)
    trunk(ms, bark, pts, radii, segs)
    clumps = []
    for k in range(n - 1):
        a = 2 * math.pi * k / (n - 1) + rng.uniform(-0.25, 0.25)
        rr = r * rng.uniform(0.5, 0.58)
        at = (top.x + math.cos(a) * r * 0.52, math.sin(a) * r * 0.52, cz + rng.uniform(-0.06, 0.04) * r)
        clumps.append((at, (rr, rr, r * thick * 0.9), 0.0, None))
        if k < forks:
            tube(ms, bark, [(top.x, 0, top.z * 0.96), (top.x + math.cos(a) * r * 0.45, math.sin(a) * r * 0.45, cz - r * thick * 0.3)], [t * 0.62, t * 0.3], 5, lod=0, only=(0,), cap=False)
    clumps.append(((top.x, 0, h - r * thick * 1.05), (r * 0.6, r * 0.6, r * thick * 1.05), 0.0, None))
    # the far levels keep one fork as the trunk's last length, so the crown never floats
    tube(ms, bark, [top, (top.x, 0, cz)], [t * 0.8, t * 0.5], 4, lod=1, only=(1,), cap=False)
    tube(ms, bark, [top, (top.x, 0, cz)], [t * 1.0, t * 0.7], 3, lod=2, only=(2,), cap=False)
    crown(ms, leaf, clumps, rng, mid_detail, far_scale=0.96)


def palm_tree(ms, rng, h, f, t, bark='bark_palm', leaf='date_frond', fronds=10, width=0.07, droop=0.55, rise=0.3, fruit='dates', bend=0.1, segs=7):
    """A palm: a thick curving trunk and a head of arching fronds, fruit under the crown."""
    b = bend * h
    pts = [Vector((0, 0, -0.008))] + [Vector((b * (k / 4) ** 2, 0, h * k / 4)) for k in range(1, 5)]
    radii = [t * 1.45, t * 1.05, t * 0.95, t * 0.88, t * 0.8]
    trunk(ms, bark, pts, radii, segs, far=1.3)
    top = pts[-1]
    for k in range(fronds):
        a = 2 * math.pi * k / fronds + rng.uniform(-0.15, 0.15)
        up = rng.uniform(0.75, 1.15)
        frond(ms, leaf, top, a, f * rng.uniform(0.9, 1.08), width, rise * up, droop, 3, lod=0, only=(0,))
    for k in range(5):
        frond(ms, leaf, top, 2 * math.pi * k / 5 + 0.3, f, width * 1.7, rise, droop, 2, lod=1, only=(1,))
    for k in range(5):
        frond(ms, leaf, top, 2 * math.pi * k / 5 + 0.3, f, width * 1.9, rise, droop, 2, lod=2, only=(2,))
    if fruit:
        for k in range(3):
            a = 2 * math.pi * k / 3 + 0.5
            clump(ms, fruit, (top.x + math.cos(a) * t * 1.3, math.sin(a) * t * 1.3, top.z - t * 1.6), (t * 0.8, t * 0.8, t * 1.3), None, 0, 1, lod=0, only=(0,))
    clump(ms, leaf, (top.x, 0, top.z), (t * 1.5, t * 1.5, t * 1.3), None, 0, 1, lod=0, only=(0,))  # the crown's heart


def shrub_tree(ms, rng, h, r, t, bark, leaf, stems=4, ball=0.42, squash=0.8, top_mat=None, mid_detail=1, kink=0.25):
    """A shrub that stands for a tree (saxaul, tamarisk, a tundra bush): crooked stems splaying
    from one foot, a clump on each and one on top."""
    clumps = []
    for k in range(stems):
        a = 2 * math.pi * k / stems + rng.uniform(-0.35, 0.35)
        out = r * rng.uniform(0.5, 0.7)
        zt = h * rng.uniform(0.55, 0.72)
        end = Vector((math.cos(a) * out, math.sin(a) * out, zt))
        elbow = Vector((math.cos(a + kink) * out * 0.55, math.sin(a + kink) * out * 0.55, zt * 0.42))
        tube(ms, bark, [(0, 0, -0.008), elbow, end], [t * 1.15, t * 0.8, t * 0.45], 5, lod=0, only=(0,), cap=False)
        if k < 3:
            tube(ms, bark, [(0, 0, -0.008), end], [t * 1.3, t * 0.6], 3, lod=1, only=(1,), cap=False)
        rr = r * ball * rng.uniform(0.9, 1.1)
        clumps.append(((end.x, end.y, end.z + rr * squash * 0.3), (rr, rr, rr * squash), 0.0, top_mat if (top_mat and k % 2) else None))
    rr = r * ball * 1.1
    clumps.append(((0, 0, h - rr * squash), (rr, rr, rr * squash), 0.0, top_mat))
    tube(ms, bark, [(0, 0, -0.008), (0, 0, h * 0.5)], [t * 2.0, t * 1.2], 3, lod=2, only=(2,), cap=False)
    crown(ms, leaf, clumps, rng, mid_detail, far_scale=0.9, hull=clumps)


def buttress(ms, bark, t, h, fins=4, lod=0):
    """Buttress roots: thin fins from the trunk down to the ground (a jungle giant's foot)."""
    for k in range(fins):
        a = 2 * math.pi * k / fins + 0.4
        out, side = Vector((math.cos(a), math.sin(a), 0)), Vector((-math.sin(a), math.cos(a), 0)) * t * 0.22
        bm = bmesh.new()
        pts = [out * t * 0.7 + Vector((0, 0, h)), out * t * 3.0, out * t * 0.7]
        for s in (1, -1):
            vs = [bm.verts.new(p + side * s) for p in pts]
            bm.faces.new(vs if s == 1 else list(reversed(vs)))
        ridge = [bm.verts.new(pts[0] + side), bm.verts.new(pts[0] - side), bm.verts.new(pts[1] - side), bm.verts.new(pts[1] + side)]
        bm.faces.new(ridge)
        bm.normal_update()
        ms.add(bm, bark, lod, only=(lod,))


# ---- species: f(ms, rng, size) with size 0 small, 1 medium, 2 large -----------------------------

def _p(size, *values):
    return values[size]


# temperate
def oak(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.42, 0.6, 0.8), _p(i, 0.18, 0.27, 0.36), _p(i, 0.028, 0.04, 0.052), 'bark_oak', 'oak_leaf', n=_p(i, 3, 4, 5), squash=0.74, limbs=_p(i, 1, 2, 3), trunk_to=0.46, mid_detail=_p(i, 1, 2, 2))


def beech(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.48, 0.7, 0.92), _p(i, 0.14, 0.2, 0.26), _p(i, 0.022, 0.032, 0.042), 'bark_beech', 'beech_leaf', n=_p(i, 3, 4, 5), squash=1.25, limbs=_p(i, 1, 2, 2), trunk_to=0.42, mid_detail=_p(i, 1, 2, 2))


def birch(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.45, 0.66, 0.86), _p(i, 0.105, 0.14, 0.175), _p(i, 0.016, 0.021, 0.027), 'birch', 'birch_leaf', n=_p(i, 3, 3, 4), bare=0.36,
                profile=lambda s: 0.62 + 0.38 * math.sin(math.pi * (0.2 + 0.7 * s)), taper=0.15, tip=0.45, mid_detail=_p(i, 1, 2, 2), wobble=0.22, hull_taper=0.2)


# mediterranean
def olive(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.32, 0.44, 0.58), _p(i, 0.16, 0.22, 0.29), _p(i, 0.03, 0.042, 0.055), 'bark_olive', 'olive_crown', n=_p(i, 3, 4, 5), squash=0.72, lean=0.1, limbs=_p(i, 2, 2, 3), trunk_to=0.42, mid_detail=_p(i, 1, 2, 2))


def stone_pine(ms, rng, i):
    umbrella_tree(ms, rng, _p(i, 0.44, 0.64, 0.86), _p(i, 0.2, 0.29, 0.38), _p(i, 0.022, 0.032, 0.042), 'bark_red', 'stonepine_crown', n=_p(i, 4, 5, 6), thick=0.27, forks=_p(i, 2, 3, 3), mid_detail=_p(i, 1, 2, 2))


def cypress(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.5, 0.74, 0.98), _p(i, 0.07, 0.095, 0.12), _p(i, 0.018, 0.024, 0.03), 'bark_dark', 'cypress_crown', n=_p(i, 3, 4, 4), bare=0.1,
                profile=lambda s: 1.0 - 0.6 * s * s, taper=0.2, tip=0.8, mid_detail=_p(i, 1, 2, 2), wobble=0.06, hull_taper=0.55)


# desert
def date_palm(ms, rng, i):
    palm_tree(ms, rng, _p(i, 0.4, 0.6, 0.82), _p(i, 0.2, 0.26, 0.32), _p(i, 0.026, 0.032, 0.038), fronds=_p(i, 8, 10, 12), width=_p(i, 0.06, 0.075, 0.09), fruit='dates' if i else None)


def acacia(ms, rng, i):
    umbrella_tree(ms, rng, _p(i, 0.34, 0.5, 0.66), _p(i, 0.19, 0.28, 0.38), _p(i, 0.02, 0.028, 0.036), 'bark_oak', 'acacia_crown', n=_p(i, 4, 5, 6), thick=0.26, lean=0.12, trunk_to=0.6, forks=_p(i, 2, 3, 4), mid_detail=_p(i, 1, 2, 2))


def tamarisk(ms, rng, i):
    shrub_tree(ms, rng, _p(i, 0.22, 0.32, 0.44), _p(i, 0.13, 0.19, 0.26), _p(i, 0.011, 0.015, 0.019), 'bark_dark', 'tamarisk_crown', stems=_p(i, 3, 4, 5), ball=0.5, squash=1.0, top_mat='tamarisk_bloom', mid_detail=_p(i, 1, 1, 2))


# steppe
def poplar(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.5, 0.74, 0.98), _p(i, 0.09, 0.12, 0.15), _p(i, 0.02, 0.027, 0.034), 'bark_beech', 'poplar_crown', n=_p(i, 3, 4, 4), bare=0.14,
                profile=lambda s: 0.8 + 0.2 * math.sin(math.pi * (0.1 + 0.6 * s)) - 0.35 * s * s, taper=0.15, tip=0.65, mid_detail=_p(i, 1, 2, 2), wobble=0.1, hull_taper=0.4)


def elm(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.34, 0.48, 0.64), _p(i, 0.17, 0.24, 0.31), _p(i, 0.026, 0.036, 0.046), 'bark_oak', 'elm_crown', n=_p(i, 3, 4, 5), squash=0.66, lean=0.17, sweep=0.45, limbs=_p(i, 1, 2, 2), trunk_to=0.5, mid_detail=_p(i, 1, 2, 2))


def saxaul(ms, rng, i):
    shrub_tree(ms, rng, _p(i, 0.2, 0.29, 0.4), _p(i, 0.13, 0.19, 0.26), _p(i, 0.012, 0.016, 0.02), 'bark_saxaul', 'saxaul_crown', stems=_p(i, 3, 4, 5), ball=0.4, squash=0.8, mid_detail=_p(i, 1, 1, 2), kink=0.6)


# conifer (spruce, Scots pine, fir; until 14 October the kit was spruces only, built by
# build_vegetation_remaining.py)
def spruce(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.42, 0.64, 0.88), _p(i, 0.11, 0.145, 0.18), _p(i, 0.018, 0.024, 0.03), 'bark_dark', 'spruce_crown', n=_p(i, 3, 4, 5), bare=0.1,
                profile=lambda s: 1.0 - 0.85 * s, taper=0.5, tip=0.92, mid_detail=_p(i, 1, 2, 2), wobble=0.03, hull_taper=0.88)


def scots_pine(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.46, 0.68, 0.9), _p(i, 0.13, 0.18, 0.23), _p(i, 0.02, 0.028, 0.036), 'bark_red', 'pine_crown', n=_p(i, 3, 4, 5), squash=0.62, lean=0.05, limbs=_p(i, 1, 2, 3), trunk_to=0.62, mid_detail=_p(i, 1, 2, 2))


def fir(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.46, 0.68, 0.92), _p(i, 0.13, 0.17, 0.21), _p(i, 0.02, 0.027, 0.034), 'bark_dark', 'fir_crown', n=_p(i, 3, 4, 5), bare=0.14,
                profile=lambda s: 1.0 - 0.8 * s, taper=0.6, tip=0.9, mid_detail=_p(i, 1, 2, 2), wobble=0.04, hull_taper=0.85)


# tropical (the kit's own trees are a small broadleaf, a palm and a rainforest tree)
def coconut_palm(ms, rng, i):
    palm_tree(ms, rng, _p(i, 0.5, 0.74, 0.98), _p(i, 0.22, 0.28, 0.34), _p(i, 0.02, 0.025, 0.03), leaf='coco_frond', fronds=_p(i, 8, 9, 10), width=_p(i, 0.07, 0.085, 0.1), droop=0.7, rise=0.35, fruit='coconut' if i else None, bend=0.2)


def jungle_giant(ms, rng, i):
    h, t = _p(i, 0.5, 0.74, 0.98), _p(i, 0.028, 0.04, 0.052)
    broad_tree(ms, rng, h, _p(i, 0.18, 0.26, 0.34), t, 'bark_jungle', 'jungle_crown', n=_p(i, 3, 4, 5), squash=0.8, limbs=_p(i, 1, 2, 2), trunk_to=0.55, mid_detail=_p(i, 1, 2, 2))
    buttress(ms, 'bark_jungle', t, h * 0.2, fins=_p(i, 3, 4, 4))


def banana(ms, rng, i):
    palm_tree(ms, rng, _p(i, 0.16, 0.22, 0.3), _p(i, 0.16, 0.22, 0.28), _p(i, 0.018, 0.024, 0.03), bark='banana_stem', leaf='banana_leaf', fronds=_p(i, 5, 6, 7), width=_p(i, 0.09, 0.12, 0.15), droop=0.55, rise=0.5, fruit=None, bend=0.05, segs=6)


# cold (the kit's own trees are wind-bent dwarf trees)
def larch(ms, rng, i):
    column_tree(ms, rng, _p(i, 0.36, 0.54, 0.72), _p(i, 0.11, 0.145, 0.18), _p(i, 0.017, 0.023, 0.029), 'bark_dark', 'larch_crown', n=_p(i, 3, 4, 5), bare=0.2,
                profile=lambda s: 1.0 - 0.75 * s, taper=0.55, tip=0.9, mid_detail=_p(i, 1, 2, 2), wobble=0.08, hull_taper=0.8)


def dwarf_birch(ms, rng, i):
    broad_tree(ms, rng, _p(i, 0.24, 0.34, 0.46), _p(i, 0.1, 0.14, 0.18), _p(i, 0.014, 0.019, 0.024), 'birch', 'dwarf_birch_crown', n=_p(i, 3, 4, 4), squash=0.95, lean=0.08, limbs=_p(i, 1, 2, 2), trunk_to=0.42, mid_detail=_p(i, 1, 1, 2))


def tundra_shrub(ms, rng, i):
    shrub_tree(ms, rng, _p(i, 0.1, 0.14, 0.19), _p(i, 0.1, 0.15, 0.2), _p(i, 0.008, 0.01, 0.012), 'bark_dark', 'tundra_crown', stems=_p(i, 3, 4, 5), ball=0.5, squash=0.7, mid_detail=1)


def tall_grass(ms, rng, h=0.1, mat='steppe_grass', blades=11):
    """A tall steppe grass tuft (feather grass, 1 m): a sheaf of long blades bending out."""
    for k in range(blades):
        a = 2 * math.pi * k / blades + rng.uniform(-0.3, 0.3)
        lean = rng.uniform(0.2, 0.55) * h
        hh = h * rng.uniform(0.7, 1.1)
        mid = (math.cos(a) * lean * 0.35, math.sin(a) * lean * 0.35, hh * 0.6)
        tube(ms, mat, [(math.cos(a) * 0.008, math.sin(a) * 0.008, -0.002), mid, (math.cos(a) * lean, math.sin(a) * lean, hh)], [0.008, 0.006, 0.0], 3, lod=0, only=(0,), cap=False)
    for k in range(4):
        a = 2 * math.pi * k / 4 + 0.4
        tube(ms, mat, [(0, 0, -0.002), (math.cos(a) * h * 0.4, math.sin(a) * h * 0.4, h * 0.95)], [0.016, 0.0], 3, lod=2, only=(1, 2), cap=False)
