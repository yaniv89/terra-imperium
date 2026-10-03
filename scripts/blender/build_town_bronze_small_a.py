# scripts/blender/build_town_bronze_small_a.py
# Bronze Age `town-small-a` (plans/model-brief-for-claude.md, section 4; art spec section 3), built
# from the approved 2D sheet plans/art/towns/bronze/town-small-a/approval.png: six flat-roofed,
# lime-washed mud-brick houses round an open 8 m centre, a three-stage stepped tower at the
# north-east with a team flag, a well at the south-west, reed shades, ladders and jars, on an
# irregular packed-earth patch 40 m across.
#
#   python scripts/blender/build_town_bronze_small_a.py <out_dir> [atlas_px]
#
# Writes <out_dir>/town-small-a.blend and <out_dir>/town-small-a.glb: one object `town-small-a`
# with children LOD0, LOD1, LOD2 sharing one baked atlas set (base colour with AO, normal, packed
# cavity/roughness/metalness) and three materials, Town, Ground (alpha-cut) and Team.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402

NAME = 'town-small-a'
G = 0.03                 # ground patch top (0.3 m)
STOREY = 0.42            # a 3.2 m storey raised 1.3x
PARAPET = 0.05
FRINGE_V = 0.05          # the atlas strip (v 0 to 0.05) that holds the ground's alpha-cut edge

PROC = ['mudwall', 'mudwall_bare', 'roof', 'timber', 'door', 'dark', 'thatch', 'reed', 'stone',
        'terracotta', 'water', 'team_cloth', 'earth', 'earth_fringe', 'earth_square']
TO_FINAL = {'earth': 'Ground', 'earth_fringe': 'Ground', 'earth_square': 'Ground', 'team_cloth': 'Team'}


def make_materials():
    tm.mat_mudwall('mudwall')
    tm.mat_mudwall('mudwall_bare', wash='#cdb48a', wash_cover=0.38)
    tm.mat_simple('roof', ['#b89a6c', '#c8ab7c', '#a8895c'], scale=14.0, bump=0.3, dirt=False)
    tm.mat_simple('timber', ['#4f3a26', '#6b4f33', '#5a432c'], scale=8.0, stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 8.0}, bump=0.4)
    tm.mat_simple('door', ['#3a2a1c', '#4d3824', '#33251a'], scale=6.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 3.0}, bump=0.5)
    tm.mat_simple('dark', ['#1d1712', '#2a2119'], scale=10.0, bump=0.0)
    tm.mat_simple('thatch', ['#8c7444', '#b39558', '#cdb070', '#9b7f48'], scale=12.0, stripes={'dir': 'X', 'scale': 160.0, 'distortion': 10.0}, bump=0.6)
    tm.mat_simple('reed', ['#9c8350', '#b99c62', '#8a7244'], scale=20.0, stripes={'dir': 'Y', 'scale': 140.0, 'distortion': 6.0}, bump=0.5)
    tm.mat_simple('stone', ['#8a8070', '#a39a88', '#7a7062'], scale=26.0, bump=0.6)
    tm.mat_simple('terracotta', ['#8f4f2c', '#a8623a', '#b8784c'], scale=18.0, bump=0.2)
    tm.mat_simple('water', ['#1b2a2e', '#24363a'], scale=10.0, rough=0.2, bump=0.0)
    tm.mat_team('team_cloth')
    tm.mat_earth('earth')
    tm.mat_earth('earth_fringe')
    tm.mat_earth('earth_square', colors=('#aa8b60', '#c2a374', '#cbb083', '#a3845a'))


# ---- the ground patch ---------------------------------------------------------------------------

def ground_patch(ms, rng):
    """An irregular ellipse 4.0 x 3.7 units, 0.03 high; its outer band is the alpha-cut fringe."""
    n = 96
    rx, ry = 1.98, 1.84
    phases = [rng.uniform(0, 2 * math.pi) for _ in range(4)]

    def wobble(a):
        return 1 + 0.025 * math.sin(3 * a + phases[0]) + 0.018 * math.sin(7 * a + phases[1]) + 0.012 * math.sin(13 * a + phases[2])
    outer, inner = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        w = wobble(a)
        outer.append((rx * w * math.cos(a), ry * w * math.sin(a)))
        inner.append((0.93 * rx * w * math.cos(a), 0.93 * ry * w * math.sin(a)))
    # top: a fan inside the inner ring (earth) and the band between (fringe)
    bm = bmesh.new()
    top_in = [bm.verts.new((x, y, G)) for x, y in inner]
    bm.faces.new(top_in)
    ms.add(bm, 'earth', lod=2)
    bm = bmesh.new()
    vi = [bm.verts.new((x, y, G)) for x, y in inner]
    vo = [bm.verts.new((x, y, G * 0.4)) for x, y in outer]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vo[i], vo[j], vi[j], vi[i]))
    # a short skirt down to the ground so the side never shows a gap
    vb = [bm.verts.new((x, y, 0.0)) for x, y in outer]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vb[i], vb[j], vo[j], vo[i]))
    ms.add(bm, 'earth_fringe', lod=2)
    # the free centre: an 8 m square of trodden, lighter earth
    ms.quad_strip('earth_square', [(-0.42, -0.42, G + 0.004), (0.42, -0.42, G + 0.004), (0.42, 0.42, G + 0.004), (-0.42, 0.42, G + 0.004)], lod=1)
    # worn paths from the centre to each door
    return n


# ---- houses -------------------------------------------------------------------------------------

def jar(ms, f, x, y, s=1.0, mat='terracotta'):
    p = [(0.0, 0.0), (0.018 * s, 0.002), (0.03 * s, 0.025 * s), (0.032 * s, 0.045 * s), (0.02 * s, 0.07 * s), (0.014 * s, 0.078 * s), (0.016 * s, 0.084 * s), (0.0, 0.084 * s)]
    ms.lathe(mat, [(r, z + G) for r, z in p], at=(x, y, 0), segs=9, lod=0, frame=f)


def ladder(ms, f, x, y, h, yaw=0.0, lean=14.0):
    """A ladder whose foot is at (x, y) leaning toward local +Y by `lean` degrees."""
    lf = f @ Matrix.Translation(Vector((x, y, G))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(-lean), 4, 'X')
    length = h / math.cos(math.radians(lean))
    for sx in (-0.03, 0.03):
        ms.box('timber', (0.012, 0.012, length + 0.04), at=(sx, 0, 0), lod=0, frame=lf)
    k = int(length / 0.055)
    for i in range(1, k + 1):
        ms.box('timber', (0.07, 0.008, 0.008), at=(0, 0, i * 0.055), lod=0, frame=lf)


def pergola(ms, f, x, y, z, w, d, mat='thatch', lod=1, post_h=0.16):
    for sx in (-w / 2 + 0.02, w / 2 - 0.02):
        for sy in (-d / 2 + 0.02, d / 2 - 0.02):
            ms.box('timber', (0.014, 0.014, post_h), at=(x + sx, y + sy, z), lod=lod, frame=f)
    ms.box('timber', (w, 0.016, 0.014), at=(x, y - d / 2 + 0.02, z + post_h), lod=lod, frame=f)
    ms.box('timber', (w, 0.016, 0.014), at=(x, y + d / 2 - 0.02, z + post_h), lod=lod, frame=f)
    ms.box(mat, (w + 0.04, d + 0.04, 0.018), at=(x, y, z + post_h + 0.012), lod=lod, frame=f)


def front_shade(ms, f, x, y, w, depth=0.16, z=0.24, mat='thatch'):
    """A lean-to shade over a door: two posts in front and a sloping reed mat."""
    for sx in (-w / 2 + 0.015, w / 2 - 0.015):
        ms.box('timber', (0.014, 0.014, z - 0.02), at=(x + sx, y - depth, G), lod=0, frame=f)
    pts_f = f @ Matrix.Translation(Vector((x, y - depth / 2, G + z))) @ Matrix.Rotation(math.radians(-12), 4, 'X')
    ms.box(mat, (w, depth + 0.04, 0.012), at=(0, 0, 0), lod=0, frame=pts_f)


def house(ms, rng, x, y, w, d, storeys=1, wall='mudwall', roof_items=(), front=None, upper=None, ladder_side=None, jars=4):
    """A flat-roofed mud-brick house. Its local -Y is the front (the door faces the town centre)."""
    yaw = tm.facing_centre(x, y)
    f = tm.house_frame(x, y, yaw)
    h = STOREY
    # walls (the LOD2 block), roof slab, parapet
    ms.box(wall, (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.006)
    ms.box('roof', (w - 0.03, d - 0.03, 0.012), at=(0, 0, G + h), lod=2, frame=f)
    for (px, py, pw, pd) in ((0, -d / 2 + 0.012, w, 0.024), (0, d / 2 - 0.012, w, 0.024), (-w / 2 + 0.012, 0, 0.024, d - 0.048), (w / 2 - 0.012, 0, 0.024, d - 0.048)):
        ms.box(wall, (pw, pd, PARAPET), at=(px, py, G + h), lod=1, frame=f, bevel=0.004)
    # beam ends under the parapet on the front and the sides the camera sees
    for i in range(5):
        bx = -w / 2 + w * (i + 0.5) / 5
        ms.cyl('timber', 0.011, 0.011, 0.05, at=(bx, -d / 2 + 0.01, G + h - 0.045), rot=(90, 0, 0), segs=6, lod=0, frame=f)
    for i in range(4):
        by = -d / 2 + d * (i + 0.5) / 4
        for sx in (-1, 1):
            ms.cyl('timber', 0.011, 0.011, 0.05, at=(sx * (w / 2 - 0.01), by, G + h - 0.045), rot=(0, sx * 90, 0), segs=6, lod=0, frame=f)
    # door, lintel, windows
    dx = rng.uniform(-w * 0.2, w * 0.2)
    ms.box('door', (0.1, 0.012, 0.2), at=(dx, -d / 2 - 0.002, G), lod=1, frame=f)
    ms.box('timber', (0.14, 0.02, 0.018), at=(dx, -d / 2 - 0.004, G + 0.2), lod=0, frame=f)
    for wx in (dx - 0.22, dx + 0.22):
        if abs(wx) < w / 2 - 0.06:
            ms.box('dark', (0.045, 0.01, 0.04), at=(wx, -d / 2 - 0.002, G + 0.26), lod=0, frame=f)
    ms.box('dark', (0.045, 0.01, 0.04), at=(w / 2 + 0.001, rng.uniform(-d * 0.2, d * 0.2), G + 0.27), rot_z=90, lod=0, frame=f)
    top = G + h
    if storeys == 2:
        uw, ud, uh = w * 0.55, d * 0.6, STOREY * 0.85
        ux, uy = (upper or (w * 0.2, d * 0.18))
        ms.box(wall, (uw, ud, uh), at=(ux, uy, top), lod=2, frame=f, bevel=0.006)
        ms.box('roof', (uw - 0.03, ud - 0.03, 0.012), at=(ux, uy, top + uh), lod=2, frame=f)
        for (px, py, pw, pd) in ((0, -ud / 2 + 0.012, uw, 0.024), (0, ud / 2 - 0.012, uw, 0.024), (-uw / 2 + 0.012, 0, 0.024, ud - 0.048), (uw / 2 - 0.012, 0, 0.024, ud - 0.048)):
            ms.box(wall, (pw, pd, PARAPET), at=(ux + px, uy + py, top + uh), lod=1, frame=f, bevel=0.004)
        ms.box('door', (0.085, 0.012, 0.17), at=(ux - uw * 0.15, uy - ud / 2 - 0.002, top), lod=0, frame=f)
        ladder(ms, f, ux + uw * 0.3, uy - ud / 2 - 0.09, uh + 0.02, lean=16)
    # roof items: vents, a pergola, jars, a reed mat
    for item in roof_items:
        kind, ix, iy = item
        if kind == 'vent':
            ms.box('mudwall_bare', (0.07, 0.07, 0.07), at=(ix, iy, top), lod=1, frame=f, bevel=0.005)
            ms.box('dark', (0.04, 0.012, 0.03), at=(ix, iy - 0.035, top + 0.03), lod=0, frame=f)
        elif kind == 'pergola':
            pergola(ms, f, ix, iy, top, 0.32, 0.26)
        elif kind == 'mat':
            ms.box('reed', (0.2, 0.14, 0.008), at=(ix, iy, top + 0.012), lod=0, frame=f)
        elif kind == 'jars':
            jar(ms, f, ix, iy - G + top, 0.8)
    if front == 'shade':
        front_shade(ms, f, dx, -d / 2, 0.3)
    elif front == 'team':
        front_shade(ms, f, dx, -d / 2, 0.28, mat='team_cloth', depth=0.18, z=0.26)
    if ladder_side:
        ladder(ms, f, ladder_side * (w / 2 + 0.1), -d * 0.1, h + 0.03, yaw=ladder_side * 90, lean=17)
    # jars along the front wall
    for i in range(jars):
        jx = rng.uniform(-w / 2 + 0.04, w / 2 - 0.04)
        if abs(jx - dx) < 0.09:
            continue
        jar(ms, f, jx, -d / 2 - 0.04 - rng.uniform(0, 0.03), rng.uniform(0.75, 1.1))
    return f


# ---- the landmark: a three-stage stepped tower with a stair and a team flag ---------------------

def stepped_tower(ms, x, y):
    yaw = tm.facing_centre(x, y)
    f = tm.house_frame(x, y, yaw)
    tiers = [(1.0, 0.95, 0.60), (0.66, 0.62, 0.50), (0.36, 0.36, 0.46)]
    z = G
    offs = [(0, 0), (0.08, 0.1), (0.1, 0.16)]
    for i, ((w, d, h), (ox, oy)) in enumerate(zip(tiers, offs)):
        ms.box('mudwall', (w, d, h), at=(ox, oy, z), lod=2, frame=f, bevel=0.008, taper=0.96)
        ms.box('roof', (w * 0.96 - 0.03, d * 0.96 - 0.03, 0.012), at=(ox, oy, z + h), lod=2, frame=f)
        ww, dd = w * 0.96, d * 0.96
        for (px, py, pw, pd) in ((0, -dd / 2 + 0.012, ww, 0.024), (0, dd / 2 - 0.012, ww, 0.024), (-ww / 2 + 0.012, 0, 0.024, dd - 0.048), (ww / 2 - 0.012, 0, 0.024, dd - 0.048)):
            ms.box('mudwall', (pw, pd, PARAPET), at=(ox + px, oy + py, z + h), lod=1, frame=f, bevel=0.004)
        for k in range(6):
            bx = ox - w / 2 + w * (k + 0.5) / 6
            ms.cyl('timber', 0.012, 0.012, 0.05, at=(bx, oy - d / 2 + 0.012, z + h - 0.05), rot=(90, 0, 0), segs=6, lod=0, frame=f)
        z += h
    # the stair: up the front of the first stage, then a short flight to the second
    steps = 9
    for s in range(steps):
        sz = G + (s + 1) * (tiers[0][2] / steps)
        ms.box('mudwall', (0.2, 0.06, sz - G), at=(-0.22, -0.95 / 2 - 0.03 - (steps - 1 - s) * 0.06, G), lod=1, frame=f)
    ms.box('mudwall', (0.05, 0.6, 0.06), at=(-0.345, -0.95 / 2 - 0.27, G), lod=1, frame=f)
    steps2 = 7
    t1top = G + tiers[0][2]
    for s in range(steps2):
        sz = t1top + (s + 1) * (tiers[1][2] / steps2)
        ms.box('mudwall', (0.15, 0.05, sz - t1top), at=(-0.1, 0.1 - 0.62 / 2 - 0.025 - (steps2 - 1 - s) * 0.05, t1top), lod=1, frame=f)
    # doors and windows
    ms.box('door', (0.12, 0.012, 0.22), at=(0.18, -0.95 / 2 * 0.96 - 0.004, G), lod=1, frame=f)
    ms.box('door', (0.1, 0.012, 0.18), at=(0.1, 0.16 - 0.36 / 2 - 0.004, G + 0.60 + 0.50), lod=1, frame=f)
    ms.box('door', (0.09, 0.012, 0.16), at=(0.22, 0.1 - 0.62 / 2 - 0.004, G + 0.60), lod=0, frame=f)
    for wx in (-0.3, 0.38):
        ms.box('dark', (0.05, 0.01, 0.045), at=(wx, -0.95 / 2 * 0.96 - 0.004, G + 0.38), lod=0, frame=f)
    # a reed shade on the first terrace and jars by the base
    pergola(ms, f, 0.33, -0.25, G + 0.6, 0.26, 0.22, lod=1, post_h=0.14)
    # the flag on the top stage: a timber pole and a grey team pennant
    top = G + 0.60 + 0.50 + 0.46
    pole_h = 2.08 - top
    ms.cyl('timber', 0.012, 0.009, pole_h, at=(0.1 - 0.08, 0.16 + 0.06, top), segs=6, lod=1, frame=f)
    bm = bmesh.new()
    cols, rows = 6, 2
    grid = [[bm.verts.new((0.0, 0.0, 0.0)) for _ in range(cols + 1)] for _ in range(rows + 1)]
    for r in range(rows + 1):
        for c in range(cols + 1):
            u = c / cols
            grid[r][c].co = Vector((0.012 + 0.2 * u, 0.02 * math.sin(u * math.pi * 1.6), -0.12 * r / rows * (1 - 0.35 * u)))
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    # give the pennant a back face so it is closed and visible from both sides
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    flag_at = f @ Matrix.Translation(Vector((0.1 - 0.08, 0.16 + 0.06, top + pole_h - 0.005))) @ Matrix.Rotation(math.radians(-150), 4, 'Z')
    ms.add(bm, 'team_cloth', lod=1, matrix=flag_at)
    return f


def well(ms, x, y):
    f = tm.house_frame(x, y, 20)
    ms.cyl('stone', 0.11, 0.11, 0.09, at=(0, 0, G), segs=14, lod=1, frame=f)
    ms.cyl('stone', 0.125, 0.12, 0.025, at=(0, 0, G + 0.09), segs=14, lod=0, frame=f)
    ms.cyl('water', 0.085, 0.085, 0.005, at=(0, 0, G + 0.112), segs=14, lod=0, frame=f, caps=True)
    for sx in (-0.13, 0.13):
        ms.box('timber', (0.018, 0.018, 0.22), at=(sx, 0, G), lod=0, frame=f)
    ms.box('timber', (0.3, 0.016, 0.016), at=(0, 0, G + 0.22), lod=0, frame=f)
    ms.cyl('timber', 0.025, 0.02, 0.035, at=(0.02, 0, G + 0.15), segs=8, lod=0, frame=f)
    ms.box('rope' if False else 'reed', (0.004, 0.004, 0.07), at=(0.02, 0, G + 0.185), lod=0, frame=f)


def props(ms, rng):
    """Woodpiles, baskets and jars between the houses."""
    f = Matrix.Identity(4)
    for (x, y, n) in ((-0.55, 1.05, 3), (1.05, -0.45, 3), (-1.25, 0.25, 2), (0.45, -1.15, 3), (-0.35, -0.75, 2)):
        for i in range(n):
            jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05), rng.uniform(0.7, 1.1))
    for (x, y, yaw) in ((-0.7, -1.45, 30), (1.4, 0.75, -60)):
        wf = tm.house_frame(x, y, yaw)
        for k in range(5):
            ms.cyl('timber', 0.012, 0.012, 0.16, at=(-0.05 + (k % 3) * 0.026, 0, G + 0.012 + (k // 3) * 0.022), rot=(0, 90, 0), segs=6, lod=0, frame=wf)
    for (x, y) in ((0.6, 0.55), (-0.6, -0.55), (1.15, 0.45)):
        ms.cyl('reed', 0.028, 0.034, 0.04, at=(x, y, G), segs=8, lod=0)


def build_lod(ms, lod):
    obj = ms.build('LOD%d' % lod, lod, PROC)
    return obj


def fringe_uvs(obj, n):
    """Lay the ground fringe (and skirt) faces into the atlas strip v 0..FRINGE_V, u around the
    ring; squeeze every other island into v FRINGE_V+0.01..1."""
    me = obj.data
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv.active
    fr = PROC.index('earth_fringe')
    for face in bm.faces:
        if face.material_index != fr:
            for loop in face.loops:
                loop[uv].uv.y = FRINGE_V + 0.01 + loop[uv].uv.y * (1 - FRINGE_V - 0.01)
            continue
        for loop in face.loops:
            co = loop.vert.co
            a = (math.atan2(co.y, co.x) / (2 * math.pi)) % 1.0
            # outer edge (z near 0.4 G or 0) at v=0.004, inner edge (z == G) at v=FRINGE_V-0.004
            t = 1.0 if co.z > G * 0.9 else 0.0
            loop[uv].uv = (0.005 + 0.99 * a, 0.004 + (FRINGE_V - 0.008) * t)
    # faces that wrap past u = 1 get their small-u corners moved past 1 (the atlas strip repeats)
    for face in bm.faces:
        if face.material_index != fr:
            continue
        us = [l[uv].uv.x for l in face.loops]
        if max(us) - min(us) > 0.5:
            for l in face.loops:
                if l[uv].uv.x < 0.5:
                    l[uv].uv.x += 0.99
    bm.to_mesh(me)
    bm.free()


def fringe_alpha(size, rng):
    """Alpha for the fringe strip: a hard, ragged cut (alpha-test, never blended)."""
    a = np.ones((size, size), dtype=np.float32)
    rows = int(FRINGE_V * size)
    u = (np.arange(size) + 0.5) / size
    # a 1D ragged threshold along u: sums of sines plus fine noise
    thr = 0.42 + 0.14 * np.sin(u * 2 * np.pi * 23 + rng.uniform(0, 6)) + 0.09 * np.sin(u * 2 * np.pi * 71 + rng.uniform(0, 6))
    thr += np.array([rng.uniform(-0.08, 0.08) for _ in range(size)], dtype=np.float32)
    thr = np.convolve(thr, np.ones(5) / 5, mode='same')
    # the bottom `rows` numpy rows hold v 0..FRINGE_V (rows run top to bottom)
    rr = np.arange(size - rows, size)
    v = 1 - (rr + 0.5) / size
    t = np.clip((v - 0.004) / (FRINGE_V - 0.008), 0, 1)
    a[size - rows:, :] = (t[:, None] > thr[None, :]).astype(np.float32)
    return a


def build(out_dir, atlas=2048):
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rng = tm.seeded(2000)
    make_materials()
    ms = tm.Mesher()
    n = ground_patch(ms, rng)
    # the ring of houses (Blender -Y is south, the front); the tower at the north-east
    house(ms, rng, -1.08, 0.78, 0.78, 0.62, roof_items=[('pergola', -0.12, 0.08), ('vent', 0.24, -0.12)], ladder_side=-1, jars=3)
    house(ms, rng, -0.18, 1.32, 0.66, 0.54, roof_items=[('vent', -0.18, 0.05), ('mat', 0.12, 0.02)], front='shade', jars=3)
    stepped_tower(ms, 0.82, 1.0)
    house(ms, rng, 1.38, 0.02, 0.62, 0.74, roof_items=[('pergola', 0.0, 0.1)], front='shade', ladder_side=1, jars=4)
    house(ms, rng, 0.98, -0.98, 0.7, 0.6, storeys=2, upper=(0.14, 0.12), roof_items=[('vent', -0.22, -0.12)], jars=3)
    house(ms, rng, -0.12, -1.36, 0.8, 0.62, roof_items=[('pergola', 0.18, 0.06), ('jars', -0.2, -0.1)], front='team', jars=4)
    house(ms, rng, -1.46, -0.3, 0.66, 0.8, storeys=2, upper=(0.1, 0.16), roof_items=[('vent', -0.16, -0.2), ('mat', 0.12, -0.2)], ladder_side=1, jars=3)
    well(ms, -0.98, -1.06)
    props(ms, rng)

    lod0 = build_lod(ms, 0)
    tm.smart_uv(lod0)
    fringe_uvs(lod0, n)
    print('LOD0 triangles', tm.triangles(lod0))
    maps = tm.bake_atlas(lod0, size=atlas, ao_samples=48)
    ao = maps['ao'][..., 0:1]
    base = maps['color'].copy()
    base[..., :3] = base[..., :3] * (0.35 + 0.65 * ao)
    base[..., 3] = fringe_alpha(atlas, rng)
    normal = maps['normal'].copy()
    normal[..., 3] = 1.0
    packed = np.zeros_like(base)
    packed[..., 0] = ao[..., 0]
    packed[..., 1] = maps['rough'][..., 0]
    packed[..., 2] = 0.0
    packed[..., 3] = 1.0
    img_base = tm.image_from_array('town-small-a_base', base, 'WEBP')
    img_norm = tm.image_from_array('town-small-a_normal', normal, 'WEBP', non_color=True)
    img_pack = tm.image_from_array('town-small-a_orm', packed, 'WEBP', non_color=True)
    town = tm.final_material('Town', img_base, img_norm, img_pack)
    ground = tm.final_material('Ground', img_base, img_norm, img_pack, alpha_mask=True)
    team = tm.final_material('Team', img_base, img_norm, img_pack)
    finals = {'Town': town, 'Ground': ground, 'Team': team}

    lods = [lod0]
    for lod in (1, 2):
        o = build_lod(ms, lod)
        tm.transfer_uvs(lod0, o)
        lods.append(o)

    # swap the procedural materials for the three final ones. Mesh.materials.clear() would reset
    # every face to slot 0, so overwrite the first three slots in place and pop the rest.
    order = ['Town', 'Ground', 'Team']
    for o in lods:
        me = o.data
        remap = [order.index(TO_FINAL.get(m.name, 'Town')) for m in me.materials]
        for p in me.polygons:
            p.material_index = remap[p.material_index]
            p.use_smooth = False
        for k, name in enumerate(order):
            me.materials[k] = finals[name]
        while len(me.materials) > len(order):
            me.materials.pop(index=len(me.materials) - 1)

    root = bpy.data.objects.new(NAME, None)
    scene.collection.objects.link(root)
    for o in lods:
        o.parent = root
    for m in [m for m in bpy.data.materials if m.name in PROC]:
        bpy.data.materials.remove(m)
    counts = {o.name: tm.triangles(o) for o in lods}
    print('triangles', counts)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, NAME + '.blend'))
    tm.export_glb(os.path.join(out_dir, NAME + '.glb'), [root] + lods)
    print('wrote', os.path.join(out_dir, NAME + '.glb'))
    return counts


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    build(argv[0] if argv else 'build/map', int(argv[1]) if len(argv) > 1 else 2048)
    sys.stdout.flush()
    os._exit(0)  # bpy can crash while tearing down packed images; the files are already written
