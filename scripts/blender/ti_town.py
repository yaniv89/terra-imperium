# scripts/blender/ti_town.py
# Shared parts for the Bronze Age towns (plans/model-brief-for-claude.md, section 4; art spec
# section 3): flat-roofed lime-washed mud-brick houses with parapets, beam ends, doors, ladders,
# outside stairs, porticoes, reed shades, jars, crates and baskets, a well, and the irregular
# packed-earth patch with its alpha-cut edge; plus `build_town`, which bakes the atlas, builds the
# LODs and exports. A variant file only lays its houses and landmark out (build_town_bronze_*.py).
# Scale: 1 unit = 10 m, heights raised 1.3x, the front (south) facing Blender -Y.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402

G = 0.03                 # ground patch top (0.3 m)
STOREY = 0.42            # a 3.2 m storey raised 1.3x
PARAPET = 0.05
FRINGE_V = 0.05          # the atlas strip (v 0 to 0.05) that holds the ground's alpha-cut edge
LANDMARK_TOP = 1.6       # the small town's 16 m landmark (flag tip), at the sheet's scale

PROC = ['mudwall', 'mudwall_bare', 'pylon', 'roof', 'timber', 'painted', 'door', 'dark', 'thatch', 'reed',
        'stone', 'terracotta', 'water', 'brick', 'log', 'limewash', 'plaster', 'linen', 'bronze', 'ash', 'team_cloth', 'earth',
        'earth_fringe', 'earth_square']
TO_FINAL = {'earth': 'Ground', 'earth_fringe': 'Ground', 'earth_square': 'Ground', 'team_cloth': 'Team'}
EARTH = ('#ad7c4b', '#c4925c', '#cf9f68', '#a47144')


def make_materials():
    tm.mat_mudwall('mudwall', wash='#dccaa6', brick='#9c6a40', mortar='#7d5a3a', wash_cover=0.64)
    tm.mat_mudwall('mudwall_bare', wash='#cdb48a', brick='#a4703f', wash_cover=0.36)
    tm.mat_mudwall('pylon', wash='#c99a62', brick='#b07a48', mortar='#8a603c', wash_cover=0.72)
    tm.mat_simple('roof', ['#b8966a', '#c8a678', '#a8875a'], scale=14.0, bump=0.3, dirt=False)
    tm.mat_simple('timber', ['#4f3a26', '#6b4f33', '#5a432c'], scale=8.0, stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 8.0}, bump=0.4)
    tm.mat_simple('painted', ['#b89058', '#c9a266', '#a98049'], scale=10.0, stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 4.0}, bump=0.3)
    tm.mat_simple('door', ['#3a2a1c', '#4d3824', '#33251a'], scale=6.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 3.0}, bump=0.5)
    tm.mat_simple('dark', ['#1d1712', '#2a2119'], scale=10.0, bump=0.0)
    tm.mat_simple('thatch', ['#8c7444', '#b39558', '#cdb070', '#9b7f48'], scale=12.0, stripes={'dir': 'X', 'scale': 160.0, 'distortion': 10.0}, bump=0.6)
    tm.mat_simple('reed', ['#9c8350', '#b99c62', '#8a7244'], scale=20.0, stripes={'dir': 'Y', 'scale': 140.0, 'distortion': 6.0}, bump=0.5)
    tm.mat_simple('stone', ['#8a8070', '#a39a88', '#7a7062'], scale=26.0, bump=0.6)
    tm.mat_simple('terracotta', ['#8f4f2c', '#a8623a', '#b8784c'], scale=18.0, bump=0.2)
    tm.mat_simple('water', ['#1b2a2e', '#24363a'], scale=10.0, rough=0.2, bump=0.0)
    # the wall rings: big sun-dried bricks, mostly bare, and a worn lime wash at the foot
    tm.mat_mudwall('brick', wash='#e6c48f', brick='#d9a466', brick2='#c48f55', mortar='#94683e', wash_cover=0.32,
                   bond=(0.075, 0.024, 0.0035))
    tm.mat_mudwall('limewash', wash='#f0e9dc', brick='#d9a466', brick2='#c48f55', mortar='#94683e', wash_cover=0.6,
                   bond=(0.075, 0.024, 0.0035))
    # palisade logs: lighter than the beams and doors, the grain running up the log
    tm.mat_simple('log', ['#7d5c3c', '#957250', '#6c4e33'], scale=10.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 6.0}, bump=0.4)
    tm.mat_simple('plaster', ['#d6c7a6', '#e2d6bb', '#cdbd9a'], scale=18.0, bump=0.25, dirt=True)
    tm.mat_simple('linen', ['#c9c2b2', '#d8d2c4', '#bbb3a1'], scale=26.0, rough=0.9, bump=0.25,
                  stripes={'dir': 'Y', 'scale': 30.0, 'distortion': 2.0})
    tm.mat_simple('bronze', ['#7a5a26', '#a07834', '#5e4520'], scale=30.0, rough=0.45, bump=0.3)
    tm.mat_simple('ash', ['#231e1a', '#3a312a', '#4c4036'], scale=30.0, bump=0.3)
    tm.mat_team('team_cloth')
    tm.mat_earth('earth', colors=EARTH)
    tm.mat_earth('earth_fringe', colors=EARTH)
    tm.mat_earth('earth_square', colors=('#b48555', '#c89a64', '#d1a76f', '#ad7d4e'))


# ---- the ground patch ---------------------------------------------------------------------------

def ground_patch(ms, rng, rx=1.98, ry=1.84, square=0.42, power=2.0):
    """An irregular ellipse, 0.03 high; its outer band is the alpha-cut fringe. A `power` above 2
    squares it off (a superellipse, the camp's rough rectangle); `square` None leaves no centre."""
    n = 96
    phases = [rng.uniform(0, 2 * math.pi) for _ in range(4)]

    def wobble(a):
        return 1 + 0.025 * math.sin(3 * a + phases[0]) + 0.018 * math.sin(7 * a + phases[1]) + 0.012 * math.sin(13 * a + phases[2])
    outer, inner = [], []
    for i in range(n):
        a = 2 * math.pi * i / n
        w = wobble(a)
        c, sn = math.cos(a), math.sin(a)
        c, sn = math.copysign(abs(c) ** (2 / power), c), math.copysign(abs(sn) ** (2 / power), sn)
        outer.append((rx * w * c, ry * w * sn))
        inner.append((0.93 * rx * w * c, 0.93 * ry * w * sn))
    bm = bmesh.new()
    bm.faces.new([bm.verts.new((x, y, G)) for x, y in inner])
    ms.add(bm, 'earth', lod=2)
    bm = bmesh.new()
    vi = [bm.verts.new((x, y, G)) for x, y in inner]
    vo = [bm.verts.new((x, y, G * 0.4)) for x, y in outer]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vo[i], vo[j], vi[j], vi[i]))
    ms.add(bm, 'earth_fringe', lod=2)
    bm = bmesh.new()  # a short skirt so the side never gaps (too small to see at the LOD2 zoom)
    vo = [bm.verts.new((x, y, G * 0.4)) for x, y in outer]
    vb = [bm.verts.new((x, y, 0.0)) for x, y in outer]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vb[i], vb[j], vo[j], vo[i]))
    ms.add(bm, 'earth_fringe', lod=1)
    # the free centre (8 m): trodden, slightly lighter earth
    if square is None:
        return
    s = square
    ms.quad_strip('earth_square', [(-s, -s, G + 0.004), (s, -s, G + 0.004), (s, s, G + 0.004), (-s, s, G + 0.004)], lod=1)


# ---- small things -------------------------------------------------------------------------------

def jar(ms, f, x, y, s=1.0, z=G, mat='terracotta'):
    p = [(0.0, 0.0), (0.018 * s, 0.002), (0.03 * s, 0.025 * s), (0.032 * s, 0.045 * s), (0.02 * s, 0.07 * s), (0.014 * s, 0.078 * s), (0.016 * s, 0.084 * s), (0.0, 0.084 * s)]
    ms.lathe(mat, [(r, zz + z) for r, zz in p], at=(x, y, 0), segs=9, lod=0, frame=f)


def crate(ms, f, x, y, s=1.0, yaw=0.0, z=G):
    ms.box('timber', (0.06 * s, 0.05 * s, 0.045 * s), at=(x, y, z), rot_z=yaw, lod=0, frame=f, bevel=0.003)


def basket(ms, f, x, y, s=1.0, z=G):
    ms.cyl('reed', 0.026 * s, 0.032 * s, 0.035 * s, at=(x, y, z), segs=8, lod=0, frame=f)


def clutter(ms, f, x, y, rng, n=4):
    """A heap of jars, crates and baskets around (x, y) in frame f."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.5:
            jar(ms, f, px, py, rng.uniform(0.7, 1.1))
        elif r < 0.8:
            crate(ms, f, px, py, rng.uniform(0.8, 1.1), rng.uniform(-20, 20))
        else:
            basket(ms, f, px, py, rng.uniform(0.8, 1.1))


def woodpile(ms, f, x, y, yaw=0.0):
    wf = f @ tm.house_frame(x, y, yaw)
    for k in range(5):
        ms.cyl('timber', 0.012, 0.012, 0.16, at=(-0.05 + (k % 3) * 0.026, 0, G + 0.012 + (k // 3) * 0.022), rot=(0, 90, 0), segs=6, lod=0, frame=wf)


def rack(ms, f, x, y, yaw=0.0):
    """A drying rack: two A-frames and a pole with cloth-coloured reeds hanging."""
    rf = f @ tm.house_frame(x, y, yaw)
    for sx in (-0.08, 0.08):
        ms.box('timber', (0.01, 0.01, 0.13), at=(sx, 0, G), lod=0, frame=rf)
    ms.box('timber', (0.18, 0.01, 0.01), at=(0, 0, G + 0.125), lod=0, frame=rf)
    ms.box('reed', (0.14, 0.006, 0.06), at=(0, 0, G + 0.065), lod=0, frame=rf)


def ladder(ms, f, x, y, h, yaw=0.0, lean=14.0, z=G):
    """A ladder whose foot is at (x, y) leaning toward local +Y by `lean` degrees."""
    lf = f @ Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(-lean), 4, 'X')
    length = h / math.cos(math.radians(lean))
    for sx in (-0.03, 0.03):
        ms.box('timber', (0.012, 0.012, length + 0.04), at=(sx, 0, 0), lod=0, frame=lf)
    for i in range(1, int(length / 0.055) + 1):
        ms.box('timber', (0.07, 0.008, 0.008), at=(0, 0, i * 0.055), lod=0, frame=lf)


def pergola(ms, f, x, y, z, w, d, mat='thatch', lod=1, post_h=0.16):
    for sx in (-w / 2 + 0.02, w / 2 - 0.02):
        for sy in (-d / 2 + 0.02, d / 2 - 0.02):
            ms.box('timber', (0.014, 0.014, post_h), at=(x + sx, y + sy, z), lod=lod, frame=f)
    ms.box('timber', (w, 0.016, 0.014), at=(x, y - d / 2 + 0.02, z + post_h), lod=lod, frame=f)
    ms.box('timber', (w, 0.016, 0.014), at=(x, y + d / 2 - 0.02, z + post_h), lod=lod, frame=f)
    ms.box(mat, (w + 0.04, d + 0.04, 0.018), at=(x, y, z + post_h + 0.012), lod=lod, frame=f)


def front_shade(ms, f, x, y, w, depth=0.16, z=0.24, mat='thatch'):
    """A lean-to shade over a door: two posts in front and a sloping mat (reed or team cloth)."""
    for sx in (-w / 2 + 0.015, w / 2 - 0.015):
        ms.box('timber', (0.014, 0.014, z - 0.02), at=(x + sx, y - depth, G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y - depth / 2, G + z))) @ Matrix.Rotation(math.radians(-12), 4, 'X')
    ms.box(mat, (w, depth + 0.04, 0.012), at=(0, 0, 0), lod=0, frame=pf)


def outside_stair(ms, f, side, w, d, h, wall='mudwall', along=-1):
    """Steps up the outside of a side wall to the roof (side -1 west, +1 east of the house's local
    frame), climbing toward the front (along -1) or the back (+1), with a low parapet."""
    steps = 9
    run = min(d - 0.08, 0.5)
    sw = 0.13
    x = side * (w / 2 + sw / 2)
    for s in range(steps):
        sz = (s + 1) * (h / steps)
        y = along * (-run / 2 + run * (s + 0.5) / steps) * -1
        ms.box(wall, (sw, run / steps + 0.002, sz), at=(x, y, G), lod=1, frame=f)
    ms.box(wall, (0.025, run, 0.05), at=(x + side * (sw / 2 - 0.012), 0, G + h * 0.55), lod=0, frame=f)


def portico(ms, f, w, d, h, columns=4, depth=0.22):
    """A columned porch across the front: timber columns with flared capitals, a beam, a roof
    slab with a parapet (Egyptian house porches, art spec variant b)."""
    y = -d / 2 - depth
    for i in range(columns):
        cx = -w / 2 + 0.06 + (w - 0.12) * i / (columns - 1)
        ms.cyl('painted', 0.022, 0.018, h - 0.04, at=(cx, y + 0.03, G), segs=8, lod=1, frame=f)
        ms.cyl('painted', 0.02, 0.034, 0.035, at=(cx, y + 0.03, G + h - 0.075), segs=8, lod=0, frame=f)
    ms.box('timber', (w, 0.04, 0.03), at=(0, y + 0.03, G + h - 0.04), lod=1, frame=f)
    ms.box('roof', (w, depth + 0.04, 0.025), at=(0, -d / 2 - depth / 2 + 0.01, G + h - 0.01), lod=1, frame=f)
    ms.box('mudwall', (w, 0.024, PARAPET * 0.8), at=(0, y + 0.012, G + h + 0.015), lod=0, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def _parapet(ms, f, wall, x, y, w, d, z):
    for (px, py, pw, pd) in ((0, -d / 2 + 0.012, w, 0.024), (0, d / 2 - 0.012, w, 0.024), (-w / 2 + 0.012, 0, 0.024, d - 0.048), (w / 2 - 0.012, 0, 0.024, d - 0.048)):
        ms.box(wall, (pw, pd, PARAPET), at=(x + px, y + py, z), lod=1, frame=f, bevel=0.004)


def house(ms, rng, x, y, w, d, storeys=1, wall='mudwall', roof_items=(), front=None, upper=None,
          ladder_side=None, stair_side=None, porch=False, jars=4, heap=None, yaw=None, yard=0.0):
    """A flat-roofed mud-brick house. Its local -Y is the front: by default the door faces the
    town centre; `yaw` (degrees) turns it another way (0 faces the camera, south)."""
    yaw = tm.facing_centre(x, y) if yaw is None else yaw
    f = tm.house_frame(x, y, yaw)
    h = STOREY
    ms.box(wall, (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.006)
    ms.box('roof', (w - 0.03, d - 0.03, 0.012), at=(0, 0, G + h), lod=2, frame=f)
    _parapet(ms, f, wall, 0, 0, w, d, G + h)
    for i in range(5):  # beam ends under the parapet on the front and the sides
        bx = -w / 2 + w * (i + 0.5) / 5
        ms.cyl('timber', 0.011, 0.011, 0.05, at=(bx, -d / 2 + 0.01, G + h - 0.045), rot=(90, 0, 0), segs=6, lod=0, frame=f)
    for i in range(4):
        by = -d / 2 + d * (i + 0.5) / 4
        for sx in (-1, 1):
            ms.cyl('timber', 0.011, 0.011, 0.05, at=(sx * (w / 2 - 0.01), by, G + h - 0.045), rot=(0, sx * 90, 0), segs=6, lod=0, frame=f)
    dx = rng.uniform(-w * 0.2, w * 0.2)
    ms.box('door', (0.1, 0.012, 0.2), at=(dx, -d / 2 - 0.002, G), lod=1, frame=f)
    ms.box('timber', (0.14, 0.02, 0.018), at=(dx, -d / 2 - 0.004, G + 0.2), lod=0, frame=f)
    for wx in (dx - 0.22, dx + 0.22):
        if abs(wx) < w / 2 - 0.06:
            ms.box('dark', (0.045, 0.01, 0.04), at=(wx, -d / 2 - 0.002, G + 0.26), lod=0, frame=f)
    for sx in (-1, 1):  # small high windows on both sides and the back
        ms.box('dark', (0.045, 0.01, 0.04), at=(sx * (w / 2 + 0.001), rng.uniform(-d * 0.2, d * 0.2), G + 0.27), rot_z=90, lod=0, frame=f)
    ms.box('dark', (0.045, 0.01, 0.04), at=(rng.uniform(-w * 0.25, w * 0.25), d / 2 + 0.002, G + 0.28), lod=0, frame=f)
    top = G + h
    if storeys == 2:
        uw, ud, uh = w * 0.55, d * 0.6, STOREY * 0.85
        ux, uy = (upper or (w * 0.2, d * 0.18))
        ms.box(wall, (uw, ud, uh), at=(ux, uy, top), lod=2, frame=f, bevel=0.006)
        ms.box('roof', (uw - 0.03, ud - 0.03, 0.012), at=(ux, uy, top + uh), lod=2, frame=f)
        _parapet(ms, f, wall, ux, uy, uw, ud, top + uh)
        ms.box('door', (0.085, 0.012, 0.17), at=(ux - uw * 0.15, uy - ud / 2 - 0.002, top), lod=0, frame=f)
        ladder(ms, f, ux + uw * 0.3, uy - ud / 2 - 0.09, uh + 0.02, lean=16, z=top)
    for kind, ix, iy in roof_items:
        if kind == 'vent':
            ms.box('mudwall_bare', (0.07, 0.07, 0.07), at=(ix, iy, top), lod=1, frame=f, bevel=0.005)
            ms.box('dark', (0.04, 0.012, 0.03), at=(ix, iy - 0.035, top + 0.03), lod=0, frame=f)
        elif kind == 'pergola':
            pergola(ms, f, ix, iy, top, 0.32, 0.26)
        elif kind == 'mat':
            ms.box('reed', (0.2, 0.14, 0.008), at=(ix, iy, top + 0.012), lod=0, frame=f)
        elif kind == 'jars':
            for k in range(3):
                jar(ms, f, ix + 0.04 * k, iy + rng.uniform(-0.02, 0.02), 0.75, z=top)
        elif kind == 'crates':
            crate(ms, f, ix, iy, 1.0, 10, z=top)
            crate(ms, f, ix + 0.07, iy + 0.01, 0.9, -15, z=top)
    if front == 'shade':
        front_shade(ms, f, dx, -d / 2, 0.3)
    elif front == 'team':
        front_shade(ms, f, dx, -d / 2, 0.28, mat='team_cloth', depth=0.18, z=0.26)
    if porch:
        portico(ms, f, w, d, h)
    if ladder_side:
        ladder(ms, f, ladder_side * (w / 2 + 0.1), -d * 0.1, h + 0.03, yaw=ladder_side * 90, lean=17)
    if stair_side:
        outside_stair(ms, f, stair_side, w, d, h, wall=wall)
    for _ in range(jars):  # jars, crates and baskets along the front wall
        jx = rng.uniform(-w / 2 + 0.04, w / 2 - 0.04)
        if abs(jx - dx) < 0.09:
            continue
        if rng.random() < 0.7:
            jar(ms, f, jx, -d / 2 - 0.04 - rng.uniform(0, 0.03), rng.uniform(0.75, 1.1))
        else:
            crate(ms, f, jx, -d / 2 - 0.045, rng.uniform(0.8, 1.0), rng.uniform(-15, 15))
    if heap:
        clutter(ms, f, heap[0], heap[1], rng, 5)
    if yard > 0:  # a walled yard behind the house (toward the town's edge), with stores in it
        yh = 0.13
        ms.box(wall, (0.03, yard, yh), at=(-w / 2 + 0.015, d / 2 + yard / 2, G), lod=1, frame=f)
        ms.box(wall, (0.03, yard, yh), at=(w / 2 - 0.015, d / 2 + yard / 2, G), lod=1, frame=f)
        ms.box(wall, (w, 0.03, yh), at=(0, d / 2 + yard - 0.015, G), lod=1, frame=f)
        ms.box('roof', (w - 0.06, yard - 0.03, 0.006), at=(0, d / 2 + yard / 2 - 0.015, G), lod=1, frame=f)
        clutter(ms, f, rng.uniform(-w / 4, w / 4), d / 2 + yard / 2, rng, 3)
    return f


def well(ms, x, y, yaw=20):
    f = tm.house_frame(x, y, yaw)
    ms.cyl('stone', 0.11, 0.11, 0.09, at=(0, 0, G), segs=14, lod=1, frame=f)
    ms.cyl('stone', 0.125, 0.12, 0.025, at=(0, 0, G + 0.09), segs=14, lod=0, frame=f)
    ms.cyl('water', 0.085, 0.085, 0.005, at=(0, 0, G + 0.112), segs=14, lod=0, frame=f)
    for sx in (-0.13, 0.13):
        ms.box('timber', (0.018, 0.018, 0.22), at=(sx, 0, G), lod=0, frame=f)
    ms.box('timber', (0.3, 0.016, 0.016), at=(0, 0, G + 0.22), lod=0, frame=f)
    ms.cyl('timber', 0.025, 0.02, 0.035, at=(0.02, 0, G + 0.15), segs=8, lod=0, frame=f)
    ms.box('reed', (0.004, 0.004, 0.07), at=(0.02, 0, G + 0.185), lod=0, frame=f)
    return f


def pennant(ms, f, x, y, z, yaw=-150, lod=1, w=0.2, h=0.12):
    """A grey team pennant (closed, two-sided) hanging from a pole top at (x, y, z) in frame f."""
    bm = bmesh.new()
    cols, rows = 6, 2
    grid = [[bm.verts.new((0.0, 0.0, 0.0)) for _ in range(cols + 1)] for _ in range(rows + 1)]
    for r in range(rows + 1):
        for c in range(cols + 1):
            u = c / cols
            grid[r][c].co = Vector((0.012 + w * u, 0.02 * math.sin(u * math.pi * 1.6), -h * r / rows * (1 - 0.35 * u)))
    for r in range(rows):
        for c in range(cols):
            bm.faces.new((grid[r][c], grid[r][c + 1], grid[r + 1][c + 1], grid[r + 1][c]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    ms.add(bm, 'team_cloth', lod=lod, matrix=f @ Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z'))


# ---- atlas, LODs, export ------------------------------------------------------------------------

SPACING = 12.0  # build_file lays the objects of a file this far apart in x for the one bake


def fringe_uvs(obj):
    """Lay the ground fringe (and skirt) faces into the atlas strip v 0..FRINGE_V, u around the
    ring (around each object's own origin); squeeze every other island into v FRINGE_V+0.01..1."""
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
        top = max(lp.vert.co.z for lp in face.loops)
        for loop in face.loops:
            co = loop.vert.co
            x = co.x - SPACING * round(co.x / SPACING)
            a = (math.atan2(co.y, x) / (2 * math.pi)) % 1.0
            t = 1.0 if co.z > top - 0.002 else 0.0  # the high (solid) edge at the strip's top, the low edge at its foot
            loop[uv].uv = (0.005 + 0.99 * a, 0.004 + (FRINGE_V - 0.008) * t)
    for face in bm.faces:  # faces that wrap past u = 1 continue past 1 (the strip repeats)
        if face.material_index != fr:
            continue
        us = [lp[uv].uv.x for lp in face.loops]
        if max(us) - min(us) > 0.5:
            for lp in face.loops:
                if lp[uv].uv.x < 0.5:
                    lp[uv].uv.x += 0.99
    bm.to_mesh(me)
    bm.free()


def fringe_alpha(size, rng):
    """Alpha for the fringe strip: a hard, ragged cut (alpha-test, never blended)."""
    a = np.ones((size, size), dtype=np.float32)
    rows = int(FRINGE_V * size)
    u = (np.arange(size) + 0.5) / size
    thr = 0.42 + 0.14 * np.sin(u * 2 * np.pi * 23 + rng.uniform(0, 6)) + 0.09 * np.sin(u * 2 * np.pi * 71 + rng.uniform(0, 6))
    thr += np.array([rng.uniform(-0.08, 0.08) for _ in range(size)], dtype=np.float32)
    thr = np.convolve(thr, np.ones(5) / 5, mode='same')
    rr = np.arange(size - rows, size)  # the bottom numpy rows hold v 0..FRINGE_V
    v = 1 - (rr + 0.5) / size
    t = np.clip((v - 0.004) / (FRINGE_V - 0.008), 0, 1)
    a[size - rows:, :] = (t[:, None] > thr[None, :]).astype(np.float32)
    return a


def _split_faces(src, keep_index, name):
    """A copy of `src` holding only the faces whose 'item' attribute equals keep_index."""
    me = src.data.copy()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(me)
    layer = bm.faces.layers.int.get('item')
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f[layer] != keep_index], context='FACES')
    bm.to_mesh(me)
    bm.free()
    return obj


def _tag_item(obj, index):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    layer = bm.faces.layers.int.get('item') or bm.faces.layers.int.new('item')
    for f in bm.faces:
        f[layer] = index
    bm.to_mesh(obj.data)
    bm.free()


def _join(objs, name):
    for o in bpy.context.scene.objects:
        o.select_set(o in objs)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    objs[0].name = name
    return objs[0]


def build_file(file_name, items, out_dir, atlas=2048, seed=2000, write=True):
    """Build several objects into one GLB that shares ONE baked atlas set (model brief: one atlas
    set per file). `items` is a list of (object name, layout, ground) where `layout(ms, rng)` adds
    the object's parts around the origin and `ground` (a dict for ground_patch, or None) gives it
    an alpha-cut earth patch. Every object gets LOD0, LOD1 and LOD2 children."""
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    rng = tm.seeded(seed)
    make_materials()
    meshers = []
    for k, (obj_name, layout, ground) in enumerate(items):
        ms = tm.Mesher()
        if ground is not None:
            ground_patch(ms, rng, **ground)
        layout(ms, rng)
        meshers.append(ms)
    # LOD0 of every object, placed side by side, joined for one unwrap and one bake
    spacing = SPACING
    parts0 = []
    for k, ms in enumerate(meshers):
        o = ms.build('_lod0_%d' % k, 0, PROC)
        o.location.x = k * spacing
        bpy.context.view_layer.update()
        o.data.transform(o.matrix_world)
        o.matrix_world = Matrix.Identity(4)
        _tag_item(o, k)
        parts0.append(o)
    joined = _join(parts0, '_lod0') if len(parts0) > 1 else parts0[0]
    tm.smart_uv(joined)
    fringe_uvs(joined)
    print('LOD0 triangles (all objects)', tm.triangles(joined))
    maps = tm.bake_atlas(joined, size=atlas, ao_samples=48)
    ao = maps['ao'][..., 0:1]
    base = maps['color'].copy()
    base[..., :3] = base[..., :3] * (0.35 + 0.65 * ao)
    base[..., 3] = fringe_alpha(atlas, rng)
    normal = maps['normal'].copy()
    normal[..., 3] = 1.0
    packed = np.zeros_like(base)
    packed[..., 0] = ao[..., 0]
    packed[..., 1] = maps['rough'][..., 0]
    packed[..., 3] = 1.0
    img_base = tm.image_from_array(file_name + '_base', base, 'WEBP')
    img_norm = tm.image_from_array(file_name + '_normal', normal, 'WEBP', non_color=True)
    img_pack = tm.image_from_array(file_name + '_orm', packed, 'WEBP', non_color=True)
    finals = {
        'Town': tm.final_material('Town', img_base, img_norm, img_pack),
        'Ground': tm.final_material('Ground', img_base, img_norm, img_pack, alpha_mask=True),
        'Team': tm.final_material('Team', img_base, img_norm, img_pack),
    }
    order = ['Town', 'Ground', 'Team']
    roots, exported, counts = [], [], {}
    shift = Matrix.Identity(4)
    for k, ((obj_name, _layout, _ground), ms) in enumerate(zip(items, meshers)):
        lod0 = _split_faces(joined, k, 'LOD0')
        lods = [lod0]
        for lod in (1, 2):
            o = ms.build('LOD%d' % lod, lod, PROC)
            o.data.transform(Matrix.Translation(Vector((k * spacing, 0, 0))))
            tm.transfer_uvs(lod0, o)
            lods.append(o)
        shift = Matrix.Translation(Vector((-k * spacing, 0, 0)))
        for o in lods:
            o.data.transform(shift)
            me = o.data
            remap = [order.index(TO_FINAL.get(m.name, 'Town')) for m in me.materials]
            for p in me.polygons:
                p.material_index = remap[p.material_index]
                p.use_smooth = False
            # Mesh.materials.clear() would reset every face to slot 0: overwrite in place, pop the rest
            for j, mname in enumerate(order):
                me.materials[j] = finals[mname]
            while len(me.materials) > len(order):
                me.materials.pop(index=len(me.materials) - 1)
            if 'item' in me.attributes:
                me.attributes.remove(me.attributes['item'])
        root = bpy.data.objects.new(obj_name, None)
        scene.collection.objects.link(root)
        root.location.x = k * 3.0  # spaced apart in the file; the game reads each object's own origin
        for o in lods:
            o.parent = root
        roots.append(root)
        exported += [root] + lods
        counts[obj_name] = {'LOD%d' % i: tm.triangles(o) for i, o in enumerate(lods)}
    bpy.data.objects.remove(joined)
    for m in [m for m in bpy.data.materials if m.name in PROC]:
        bpy.data.materials.remove(m)
    print('triangles', counts)
    if write:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, file_name + '.blend'))
        tm.export_glb(os.path.join(out_dir, file_name + '.glb'), exported)
        print('wrote', os.path.join(out_dir, file_name + '.glb'))
    return counts


def build_town(name, layout, out_dir, atlas=2048, seed=2000, ground=None):
    """One town: its object (with the earth patch) alone in <out_dir>/<name>.glb."""
    return build_file(name, [(name, layout, ground or {})], out_dir, atlas=atlas, seed=seed)


def main(name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    build_town(name, layout, argv[0] if argv else 'build/map', int(argv[1]) if len(argv) > 1 else 2048, ground=ground)
    sys.stdout.flush()
    os._exit(0)  # bpy can crash while tearing down packed images; the files are already written


def main_file(file_name, items):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    build_file(file_name, items, argv[0] if argv else 'build/map', int(argv[1]) if len(argv) > 1 else 2048)
    sys.stdout.flush()
    os._exit(0)
