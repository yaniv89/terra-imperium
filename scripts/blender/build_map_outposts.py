# scripts/blender/build_map_outposts.py
# The map's outpost camps (playtest audit I055, art item MD02): the settlement stage before a city,
# drawn in the close view where an outpost stands (src/components/map/closeView/outpostModels.js),
# one file per age band:
#   outpost-bronze    ancient: a conical hide tent, a hide ridge tent and a linen ridge tent round a
#                     stone fire ring, a two-wheeled ox cart with a lashed load, jars, crates, sacks
#                     and a bundle of logs, an arc of sharpened stakes behind, a pole with a Team pennant
#   outpost-kingdoms  middle: a canvas bell tent and two canvas wall tents, a four-wheeled wagon with
#                     a hooped canvas cover and a tethered horse, barrels, crates and sacks, a post and
#                     rail fence behind, the fire pit with a cooking tripod, the pole and pennant
#   outpost-modern    modern: two dome tents and a frame tent with a Team fly, a small pickup truck,
#                     jerry cans and crates, a ring fire pit, a line of steel fence posts with wire, a
#                     steel flagpole with the Team pennant
# Each object stands on its own round earth Ground patch inside the 50 m circle, as the tile
# improvements do (1 unit = 10 m, heights raised 1.3x, front to Blender -Y), materials Town / Team /
# Ground, one baked atlas per file, LOD0..LOD2 under a root named after the file (budget 8,000 /
# 1,500 / 300, the improvements' row of plans/art/TRIANGLE-BUDGET.md), plus an empty `smoke` over
# the fire pit (a socket for a later smoke effect; the game reads only the LOD children).
#   blender -b --factory-startup -P scripts/blender/build_map_outposts.py -- <out_dir> [bronze kingdoms modern]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
from ti_town import G  # noqa: E402

NEW = ['op_hide', 'op_hide_dark', 'op_canvas', 'op_ox', 'op_horse', 'op_ember', 'op_tent_olive', 'op_tent_tan',
       'op_paint', 'op_tyre', 'op_glass', 'op_steel', 'op_jerry']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    s = tm.mat_simple
    s('op_hide', ['#8a6440', '#9c7450', '#7a5636', '#a98258'], scale=18.0, bump=0.4)
    s('op_hide_dark', ['#5e4128', '#6e4c30', '#523822'], scale=18.0, bump=0.4)
    s('op_canvas', ['#ddd6c4', '#e8e2d2', '#cfc7b2'], scale=24.0, rough=0.9, bump=0.2, stripes={'dir': 'Z', 'scale': 40.0, 'distortion': 1.0})
    s('op_ox', ['#7e4e2e', '#8e5c38', '#6a4026'], scale=20.0, bump=0.3)
    s('op_horse', ['#5a3a22', '#6a442a', '#4c311d'], scale=20.0, bump=0.3)
    s('op_ember', ['#d8682a', '#f09a3a', '#b8451e'], scale=30.0, bump=0.0)
    s('op_tent_olive', ['#5c6638', '#68723f', '#525c32'], scale=20.0, rough=0.7, bump=0.15)
    s('op_tent_tan', ['#b49a6a', '#c4aa78', '#a68c5e'], scale=20.0, rough=0.7, bump=0.15)
    s('op_paint', ['#56603c', '#626c44', '#4c5636'], scale=12.0, rough=0.5, bump=0.1)
    s('op_tyre', ['#1f1f1f', '#2a2a2a'], scale=20.0, bump=0.2)
    s('op_glass', ['#2d3d4e', '#3e5468'], scale=10.0, rough=0.3, bump=0.0)
    s('op_steel', ['#7f868c', '#959ca2', '#6f757b'], scale=18.0, rough=0.5, bump=0.15)
    s('op_jerry', ['#4e5a34', '#5a663c'], scale=20.0, bump=0.1)


if not any(n == 'outposts' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('outposts', make_materials))

GROUND = dict(rx=2.0, ry=1.85, square=None, power=3.0, mat='earth', n=32)
WORLD = tm.house_frame(0, 0, 0)


# ---- shared parts --------------------------------------------------------------------------------

def ridge_tent(ms, x, y, yaw, w, d, h, mat, lod=2, poles=True):
    """An A-frame tent: its ridge along local Y, the dark door on the front gable (-Y)."""
    f = tm.house_frame(x, y, yaw)
    bm = bmesh.new()
    ov = 0.03
    v = [bm.verts.new((px, py, G)) for px, py in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2))]
    r0, r1 = bm.verts.new((0, -d / 2 - ov, G + h)), bm.verts.new((0, d / 2 + ov, G + h))
    bm.faces.new((v[0], v[3], r1, r0))
    bm.faces.new((v[2], v[1], r0, r1))
    bm.faces.new((v[3], v[2], r1))
    bm.faces.new((v[1], v[0], r0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f)
    bm = bmesh.new()
    o = [bm.verts.new((-w * 0.2, -d / 2 - 0.006, G)), bm.verts.new((w * 0.2, -d / 2 - 0.006, G)), bm.verts.new((0, -d / 2 - 0.006, G + h * 0.7))]
    bm.faces.new((o[0], o[1], o[2]))
    ms.add(bm, 'dark', 1, matrix=f)
    if poles:
        for sy in (-d / 2 - ov, d / 2 + ov):
            ms.cyl('timber', 0.012, 0.01, h + 0.07, at=(0, sy, G), segs=5, lod=1, frame=f)
        for sx in (-1, 1):  # guy ropes' pegs
            for sy in (-d / 2 - 0.06, d / 2 + 0.06):
                ms.box('timber', (0.016, 0.016, 0.04), at=(sx * (w / 2 + 0.08), sy, G), lod=0, frame=f)


def cone_tent(ms, x, y, r, h, mat, poles=6, lod=2):
    """A conical tent of hides on a ring of poles whose tips cross above the smoke hole."""
    f = tm.house_frame(x, y, 0)
    ms.cyl(mat, r, r * 0.08, h, at=(0, 0, G), segs=10, lod=lod, frame=f)
    for i in range(poles):
        a = 2 * math.pi * (i + 0.5) / poles
        tip = Vector((math.cos(a) * 0.03, math.sin(a) * 0.03, G + h + 0.1))
        base = Vector((math.cos(a) * r * 0.86, math.sin(a) * r * 0.86, G))
        d = tip - base
        rot = d.to_track_quat('Z', 'Y').to_euler()
        ms.cyl('timber', 0.009, 0.007, d.length, at=tuple(base), rot=(math.degrees(rot.x), math.degrees(rot.y), math.degrees(rot.z)), segs=4, lod=1 if i % 2 == 0 else 0, frame=f)
    bm = bmesh.new()  # the door flap at the front
    dz = h * 0.42
    o = [bm.verts.new((-r * 0.22, -r * 0.97 - 0.004, G)), bm.verts.new((r * 0.22, -r * 0.97 - 0.004, G)), bm.verts.new((0, -r * 0.6 - 0.004, G + dz))]
    bm.faces.new((o[0], o[1], o[2]))
    ms.add(bm, 'dark', 1, matrix=f)


def fire_pit(ms, rng, x, y, r=0.11, tripod=False):
    """A ring of stones round ash, a few charred logs and the embers. Returns the smoke socket point."""
    f = tm.house_frame(x, y, 0)
    ms.cyl('ash', r * 0.86, r * 0.8, 0.01, at=(0, 0, G), segs=12, lod=1, frame=f)
    for i in range(10):
        a = 2 * math.pi * i / 10
        ms.sphere('stone', 0.032, at=(r * math.cos(a), r * math.sin(a), G + 0.01), scale=(1.1, 0.9, 0.7), u=6, v=4, lod=0, frame=f)
    ms.cyl('stone', r * 1.15, r * 1.05, 0.03, at=(0, 0, G), segs=10, lod=1, frame=f, caps=False, only=(1,))  # the ring at LOD1
    for k in range(3):
        ms.cyl('timber', 0.012, 0.012, 0.15, at=(-0.07, 0, G + 0.014), rot=(0, 82, 0), segs=5, lod=1, frame=f @ tm.house_frame(0, 0, 60 * k + 15))
    ms.sphere('op_ember', 0.05, at=(0, 0, G + 0.012), scale=(1, 1, 0.5), u=8, v=4, lod=1, frame=f)
    if tripod:
        for k in range(3):
            a = 2 * math.pi * k / 3
            base = Vector((math.cos(a) * 0.13, math.sin(a) * 0.13, G))
            tip = Vector((0, 0, G + 0.22))
            d = tip - base
            rot = d.to_track_quat('Z', 'Y').to_euler()
            ms.cyl('timber', 0.008, 0.007, d.length, at=tuple(base), rot=tuple(math.degrees(v) for v in rot), segs=4, lod=0, frame=f)
        ms.cyl('dark', 0.045, 0.035, 0.05, at=(0, 0, G + 0.09), segs=8, lod=0, frame=f)  # the pot
    return (x, y, G + 0.06)


def sacks(ms, x, y, n=3, mat='linen', s=1.0):
    for k in range(n):
        ms.sphere(mat, 0.045 * s, at=(x + 0.07 * k * s, y + 0.025 * (k % 2), G + 0.035 * s), scale=(1, 0.85, 1.15), u=8, v=5, lod=1 if k == 0 else 0)


def barrel(ms, x, y, s=1.0):
    ms.lathe('timber', [(0.0, G), (0.045 * s, G), (0.052 * s, G + 0.05 * s), (0.045 * s, G + 0.1 * s), (0.0, G + 0.1 * s)], at=(x, y, 0), segs=9, lod=0)


def wheel(ms, f, x, y, r, w=0.03, mat='timber', segs=10, lod=1):
    """A wheel on an axle along X: its centre at (x, y, r)."""
    ms.cyl(mat, r, r, w, at=(x - w / 2, y, r), rot=(0, 90, 0), segs=segs, lod=lod, frame=f)


def stakes_arc(ms, rng, r, a0, a1, step, cy=0.0, gaps=()):
    """Sharpened stakes along a circle (degrees, 0 east, 90 north), skipping the angles in `gaps`."""
    pts = []
    a = a0
    while a <= a1:
        if not any(g0 <= a <= g1 for g0, g1 in gaps):
            pts.append((r * math.cos(math.radians(a)) + rng.uniform(-0.01, 0.01), cy + r * 0.92 * math.sin(math.radians(a)) + rng.uniform(-0.01, 0.01)))
        a += step
    for i, (x, y) in enumerate(pts):  # every other stake drops out of LOD1 (the budget)
        sh = rng.uniform(0.3, 0.46)
        r = rng.uniform(0.016, 0.021)
        f = tm.house_frame(x, y, rng.uniform(0, 360)) @ Matrix.Rotation(math.radians(rng.uniform(-4, 4)), 4, 'X')
        ms.cyl('log', r, r * 0.92, sh, at=(0, 0, G - 0.01), segs=5, lod=1 if i % 2 == 0 else 0, frame=f, caps=False)
        ms.cyl('log', r * 0.92, 0.0, 0.05, at=(0, 0, G - 0.01 + sh), segs=5, lod=1 if i % 2 == 0 else 0, frame=f, caps=False)


def _slab(w, h):
    """A thin flag slab from the pole (x 0) out to w, hanging from z 0 down to -h, tapering."""
    bm = bmesh.new()
    t = 0.004
    pts = [(0.012, -t, 0), (0.012 + w, -t, -h * 0.2), (0.012 + w, -t, -h * 0.65), (0.012, -t, -h)]
    a = [bm.verts.new(p) for p in pts]
    b = [bm.verts.new((p[0], t, p[2])) for p in pts]
    bm.faces.new(a)
    bm.faces.new(list(reversed(b)))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((a[i], b[i], b[j], a[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


def pole_pennant(ms, x, y, h, mat='timber', w=0.32, ht=0.2, lod=2):
    ms.cyl(mat, 0.02, 0.015, h, at=(x, y, G), segs=5, lod=lod, caps=False)
    tt.pennant(ms, WORLD, x, y, G + h - 0.01, yaw=-160, lod=1, w=w, h=ht)
    # LOD2: the pennant as one flat slab (the cloth's waves cost 50 triangles unseen at that zoom)
    ms.add(_slab(w, ht), 'team_cloth', 2, matrix=WORLD @ Matrix.Translation(Vector((x, y, G + h - 0.01))) @ Matrix.Rotation(math.radians(-160), 4, 'Z'), only=(2,))
    for k in range(4):
        a = 2 * math.pi * k / 4
        ms.sphere('stone', 0.035, at=(x + 0.05 * math.cos(a), y + 0.05 * math.sin(a), G + 0.012), scale=(1.1, 1, 0.8), u=6, v=4, lod=0)


def quadruped(ms, x, y, yaw, mat, horns=False, s=1.0):
    """A draught animal as a few blocks: barrel, neck and head to the front (-Y), four legs."""
    f = tm.house_frame(x, y, yaw)
    leg = 0.11 * s
    ms.box(mat, (0.13 * s, 0.34 * s, 0.13 * s), at=(0, 0, leg), lod=2, frame=f, bevel=0.02 * s)
    ms.box(mat, (0.07 * s, 0.12 * s, 0.08 * s), at=(0, -0.2 * s, leg + 0.07 * s), lod=1, frame=f)
    ms.box(mat, (0.07 * s, 0.13 * s, 0.07 * s), at=(0, -0.29 * s, leg + 0.06 * s), lod=1, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box(mat, (0.035 * s, 0.035 * s, leg + 0.01), at=(sx * 0.045 * s, sy * 0.13 * s, 0), lod=1, frame=f)
    if horns:
        for sx in (-1, 1):
            ms.cyl('linen', 0.01 * s, 0.003, 0.08 * s, at=(sx * 0.03 * s, -0.31 * s, leg + 0.125 * s), rot=(20, sx * 60, 0), segs=4, lod=0, frame=f)
    else:  # a mane
        ms.box('op_hide_dark', (0.02 * s, 0.12 * s, 0.03 * s), at=(0, -0.2 * s, leg + 0.15 * s), lod=0, frame=f)


# ---- ancient: hides and linen, an ox cart --------------------------------------------------------

def outpost_bronze(ms, rng):
    cone_tent(ms, -0.8, 0.5, 0.42, 0.66, 'op_hide')
    ridge_tent(ms, 0.72, 0.62, -8, 0.62, 0.82, 0.5, 'op_hide_dark')
    ridge_tent(ms, -0.05, 1.12, 4, 0.52, 0.7, 0.44, 'linen')
    ms.box('team_cloth', (0.07, 0.8, 0.014), at=(0, 0, G + 0.435), lod=1, frame=tm.house_frame(-0.05, 1.12, 4))  # a Team fly on the ridge
    smoke = fire_pit(ms, rng, 0.02, -0.2)
    # the ox cart at the front right, the ox ahead of it, both turned toward the viewer's left
    f = tm.house_frame(1.02, -0.72, 25)
    bed = 0.17
    ms.box('timber', (0.3, 0.42, 0.03), at=(0, 0.1, bed), lod=2, frame=f)
    for sx in (-1, 1):
        ms.box('timber', (0.015, 0.42, 0.06), at=(sx * 0.15, 0.1, bed + 0.03), lod=1, frame=f)
        wheel(ms, f, sx * 0.19, 0.12, 0.15, w=0.035, segs=10)
        ms.box('timber', (0.022, 0.42, 0.02), at=(sx * 0.07, -0.3, bed + 0.01), lod=1, frame=f)  # shafts to the yoke
    ms.sphere('op_hide', 0.16, at=(0, 0.14, bed + 0.03), scale=(0.95, 1.25, 0.75), u=8, v=4, lod=2, frame=f, cut_below=0)
    ms.sphere('linen', 0.07, at=(0.06, -0.05, bed + 0.03), scale=(1, 1, 1.1), u=8, v=5, lod=0, frame=f)
    tt.jar(ms, f, -0.07, -0.05, 2.0, z=bed + 0.03)
    for k in range(2):
        ms.box('reed', (0.31, 0.015, 0.012), at=(0, 0.06 + 0.14 * k, bed + 0.15), lod=0, frame=f)
    ms.box('timber', (0.24, 0.025, 0.025), at=(0, -0.5, 0.25), lod=0, frame=f)  # the yoke
    ox = f @ Vector((0, -0.62, 0))
    quadruped(ms, ox.x, ox.y, 25, 'op_ox', horns=True)
    # supplies at the front left: jars, crates, sacks and a bundle of logs
    for k in range(6):
        tt.jar(ms, WORLD, -0.72 + rng.uniform(-0.09, 0.09), -0.78 + rng.uniform(-0.07, 0.07), rng.uniform(2.0, 2.6))
    tt.crate(ms, WORLD, -0.48, -0.9, 2.4, 12)
    tt.crate(ms, WORLD, -0.44, -0.74, 2.0, -10)
    sacks(ms, -1.0, -0.5, 3, 'linen', 1.2)
    tb.log_bundle(ms, -0.32, 0.25, 70, length=0.42)
    # sharpened stakes along the back, open at the front
    stakes_arc(ms, rng, 1.72, 20, 165, 6.5, cy=0.05, gaps=((84, 96),))
    pole_pennant(ms, 1.45, 0.3, 1.25)
    return smoke


# ---- middle: canvas tents, a covered wagon -------------------------------------------------------

def bell_tent(ms, x, y, r, wall, h, mat):
    f = tm.house_frame(x, y, 0)
    ms.cyl(mat, r, r, wall, at=(0, 0, G), segs=10, lod=2, frame=f, caps=False)
    ms.cyl(mat, r * 1.04, 0.02, h - wall, at=(0, 0, G + wall), segs=10, lod=2, frame=f)
    ms.cyl('timber', 0.012, 0.01, h + 0.16, at=(0, 0, G), segs=5, lod=1, frame=f)
    tt.pennant(ms, f, 0, 0, G + h + 0.15, yaw=-150, lod=1, w=0.16, h=0.09)  # a Team streamer on the pole
    ms.box('dark', (r * 0.45, 0.01, wall * 0.95), at=(0, -r - 0.002, G), lod=1, frame=f)
    for i in range(8):  # pegs round the hem
        a = 2 * math.pi * (i + 0.5) / 8
        ms.box('timber', (0.014, 0.014, 0.035), at=(math.cos(a) * (r + 0.1), math.sin(a) * (r + 0.1), G), lod=0, frame=f)


def wall_tent(ms, x, y, yaw, w, d, wall, h, mat):
    """A canvas wall tent: straight walls and a gabled roof, the flap open at the front."""
    f = tm.house_frame(x, y, yaw)
    ms.box(mat, (w, d, wall), at=(0, 0, G), lod=2, frame=f)
    bm = bmesh.new()
    ov = 0.03
    a = [bm.verts.new(p) for p in ((-w / 2 - ov, -d / 2 - ov, G + wall), (w / 2 + ov, -d / 2 - ov, G + wall), (w / 2 + ov, d / 2 + ov, G + wall), (-w / 2 - ov, d / 2 + ov, G + wall))]
    r0, r1 = bm.verts.new((0, -d / 2 - ov, G + h)), bm.verts.new((0, d / 2 + ov, G + h))
    bm.faces.new((a[0], a[3], r1, r0))
    bm.faces.new((a[2], a[1], r0, r1))
    g0 = [bm.verts.new((-w / 2, -d / 2, G + wall)), bm.verts.new((w / 2, -d / 2, G + wall)), bm.verts.new((0, -d / 2, G + h))]
    g1 = [bm.verts.new((w / 2, d / 2, G + wall)), bm.verts.new((-w / 2, d / 2, G + wall)), bm.verts.new((0, d / 2, G + h))]
    bm.faces.new(g0)
    bm.faces.new(g1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, 2, matrix=f)
    ms.box('dark', (w * 0.3, 0.01, wall * 0.95), at=(0, -d / 2 - 0.002, G), lod=1, frame=f)
    for sy in (-d / 2 - ov, d / 2 + ov):
        ms.cyl('timber', 0.012, 0.01, h + 0.06, at=(0, sy, G), segs=5, lod=1, frame=f)


def half_tube(ms, mat, f, y0, y1, z, r, segs=7, lod=2):
    """A hooped cover: half a tube along local Y from y0 to y1 at height z, closed at the back."""
    bm = bmesh.new()
    ring = lambda y: [bm.verts.new((r * math.cos(math.pi * i / segs), y, z + r * 0.9 * math.sin(math.pi * i / segs))) for i in range(segs + 1)]
    a, b = ring(y0), ring(y1)
    for i in range(segs):
        bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
    bm.faces.new(list(reversed(b)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f)
    bm = bmesh.new()  # the dark opening at the front
    a = [bm.verts.new((r * 0.92 * math.cos(math.pi * i / segs), y0 + 0.002, z + r * 0.8 * math.sin(math.pi * i / segs))) for i in range(segs + 1)]
    bm.faces.new(a)
    ms.add(bm, 'dark', 1, matrix=f)


def outpost_kingdoms(ms, rng):
    bell_tent(ms, -0.8, 0.5, 0.36, 0.14, 0.62, 'op_canvas')
    wall_tent(ms, 0.72, 0.64, -6, 0.5, 0.72, 0.16, 0.44, 'op_canvas')
    wall_tent(ms, -0.02, 1.12, 3, 0.46, 0.64, 0.15, 0.42, 'op_canvas')
    smoke = fire_pit(ms, rng, 0.02, -0.2, tripod=True)
    # the covered wagon at the front right, its horse in front of the tongue
    f = tm.house_frame(1.0, -0.62, 25)
    bed = 0.17
    ms.box('timber', (0.3, 0.6, 0.04), at=(0, 0.05, bed), lod=2, frame=f)
    for sx in (-1, 1):
        ms.box('timber', (0.015, 0.6, 0.07), at=(sx * 0.15, 0.05, bed + 0.04), lod=1, frame=f)
        for wy in (-0.17, 0.27):
            wheel(ms, f, sx * 0.19, wy, 0.13 if wy < 0 else 0.15, w=0.03, segs=10)
    half_tube(ms, 'op_canvas', f, -0.2, 0.32, bed + 0.1, 0.16)
    ms.box('timber', (0.02, 0.36, 0.02), at=(0, -0.42, bed - 0.04), lod=1, frame=f)  # the tongue
    horse = f @ Vector((0, -0.78, 0))
    quadruped(ms, horse.x, horse.y, 25, 'op_horse', horns=False, s=1.1)
    # supplies at the front left: barrels, crates, sacks; logs by the fire
    for k, (bx, by) in enumerate(((-0.8, -0.72), (-0.68, -0.82), (-0.92, -0.84))):
        barrel(ms, bx, by, 1.3)
    tt.crate(ms, WORLD, -0.48, -0.88, 2.4, 12)
    tt.crate(ms, WORLD, -0.46, -0.88, 2.0, 12, z=G + 0.11)
    sacks(ms, -1.02, -0.5, 3, 'op_tent_tan', 1.2)
    tb.log_bundle(ms, -0.32, 0.25, 70, length=0.42)
    # a post and rail fence along the back, open at the front
    posts = []
    for a in range(20, 170, 9):
        if 84 <= a <= 96:
            continue
        posts.append((1.72 * math.cos(math.radians(a)), 0.05 + 1.72 * 0.92 * math.sin(math.radians(a)), a))
    for i, (px, py, a) in enumerate(posts):
        ms.box('log', (0.035, 0.035, 0.24), at=(px, py, G), lod=1, frame=WORLD)
        if i + 1 < len(posts) and posts[i + 1][2] - a < 10:
            nx, ny, _ = posts[i + 1]
            ln = math.hypot(nx - px, ny - py)
            yaw = math.degrees(math.atan2(ny - py, nx - px))
            for z in (0.09, 0.19):
                ms.box('log', (ln, 0.018, 0.02), at=((px + nx) / 2, (py + ny) / 2, G + z), rot_z=yaw, lod=1 if z > 0.1 and i % 2 == 0 else 0)
    pole_pennant(ms, 1.45, 0.3, 1.25)
    return smoke


# ---- modern: dome tents, a pickup truck ----------------------------------------------------------

def dome_tent(ms, x, y, yaw, r, h, mat, fly=None):
    f = tm.house_frame(x, y, yaw)
    ms.sphere(mat, r, at=(0, 0, G), scale=(1, 1.3, h / r), u=12, v=6, lod=0, frame=f, cut_below=0)
    ms.sphere(mat, r, at=(0, 0, G), scale=(1, 1.3, h / r), u=8, v=4, lod=2, frame=f, cut_below=0, only=(1, 2))
    ms.box('dark', (r * 0.5, 0.01, h * 0.55), at=(0, -r * 1.25, G), lod=1, frame=f, taper=0.4)
    if fly:
        ms.sphere(fly, r * 0.75, at=(0, 0, G + h * 0.25), scale=(1.1, 1.3, h / r * 0.98), u=10, v=4, lod=1, frame=f, cut_below=r * 0.45)


def pickup(ms, x, y, yaw):
    f = tm.house_frame(x, y, yaw)
    z0 = 0.07
    ms.box('op_paint', (0.2, 0.5, 0.06), at=(0, 0, z0), lod=2, frame=f)  # chassis and body sides
    ms.box('op_paint', (0.2, 0.2, 0.09), at=(0, -0.15, z0 + 0.06), lod=2, frame=f, bevel=0.01)  # the bonnet and cab
    ms.box('op_paint', (0.19, 0.14, 0.08), at=(0, -0.08, z0 + 0.15), lod=2, frame=f, taper=0.85)
    ms.box('op_glass', (0.17, 0.01, 0.06), at=(0, -0.152, z0 + 0.155), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('op_paint', (0.012, 0.28, 0.06), at=(sx * 0.094, 0.11, z0 + 0.06), lod=1, frame=f)  # the bed's sides
        for wy in (-0.16, 0.16):
            wheel(ms, f, sx * 0.1, wy, 0.055, w=0.035, mat='op_tyre', segs=10)
    # the load: crates and jerry cans under a Team tarp
    ms.box('team_cloth', (0.17, 0.22, 0.07), at=(0, 0.12, z0 + 0.06), lod=1, frame=f, taper=0.85)


def jerry(ms, x, y, yaw=0):
    ms.box('op_jerry', (0.05, 0.022, 0.07), at=(x, y, G), rot_z=yaw, lod=0)


def outpost_modern(ms, rng):
    dome_tent(ms, -0.82, 0.5, 15, 0.34, 0.34, 'op_tent_olive', fly='op_tent_tan')
    dome_tent(ms, 0.75, 0.62, -12, 0.32, 0.32, 'op_tent_tan', fly='op_tent_olive')
    # the frame tent at the back: a big canvas hall with a Team fly over the ridge
    wall_tent(ms, -0.02, 1.12, 3, 0.62, 0.62, 0.17, 0.42, 'op_canvas')
    f = tm.house_frame(-0.02, 1.12, 3)
    ms.box('team_cloth', (0.12, 0.7, 0.012), at=(0, 0, G + 0.415), lod=1, frame=f)
    smoke = fire_pit(ms, rng, 0.02, -0.2)
    for k in range(4):  # folding stools round the fire
        a = 2 * math.pi * k / 4 + 0.4
        ms.box('op_tent_olive', (0.05, 0.05, 0.05), at=(0.02 + 0.26 * math.cos(a), -0.2 + 0.24 * math.sin(a), G), lod=0)
    pickup(ms, 1.0, -0.72, 25)
    # supplies at the front left: crates, jerry cans and sacks; a water tank
    for k in range(5):
        jerry(ms, -0.72 + 0.06 * k, -0.92, rng.uniform(-8, 8))
    tt.crate(ms, WORLD, -0.5, -0.74, 2.5, 8)
    tt.crate(ms, WORLD, -0.5, -0.74, 2.2, 14, z=G + 0.112)
    tt.crate(ms, WORLD, -0.78, -0.72, 2.3, -6)
    sacks(ms, -1.04, -0.5, 3, 'op_tent_tan', 1.2)
    ms.cyl('op_steel', 0.1, 0.1, 0.18, at=(-0.36, 0.22, G), segs=12, lod=1)  # the water tank
    # steel fence posts and wire along the back, open at the front
    posts = [(1.72 * math.cos(math.radians(a)), 0.05 + 1.72 * 0.92 * math.sin(math.radians(a)), a) for a in range(20, 170, 10) if not 84 <= a <= 96]
    for i, (px, py, a) in enumerate(posts):
        ms.box('op_steel', (0.02, 0.02, 0.22), at=(px, py, G), lod=1)
        if i + 1 < len(posts) and posts[i + 1][2] - a < 11:
            nx, ny, _ = posts[i + 1]
            ln = math.hypot(nx - px, ny - py)
            yaw = math.degrees(math.atan2(ny - py, nx - px))
            for z in (0.08, 0.15, 0.21):
                ms.box('dark', (ln, 0.005, 0.005), at=((px + nx) / 2, (py + ny) / 2, G + z), rot_z=yaw, lod=0)
    pole_pennant(ms, 1.45, 0.3, 1.35, mat='op_steel')
    return smoke


ITEMS = {'bronze': outpost_bronze, 'kingdoms': outpost_kingdoms, 'modern': outpost_modern}
SEEDS = {'bronze': 7310, 'kingdoms': 7320, 'modern': 7330}


def build(age, out_dir):
    name = 'outpost-%s' % age
    socket = {}

    def layout(ms, rng):
        socket['at'] = ITEMS[age](ms, rng)

    counts = tt.build_file(name, [(name, layout, GROUND)], out_dir, atlas=1024, seed=SEEDS[age], write=False)
    root = bpy.data.objects[name]
    smoke = bpy.data.objects.new('smoke', None)  # the smoke socket over the fire pit
    bpy.context.scene.collection.objects.link(smoke)
    smoke.parent = root
    smoke.location = Vector(socket['at'])
    lods = [c for c in root.children if c.type == 'MESH']
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + '.blend'))
    tm.export_glb(os.path.join(out_dir, name + '.glb'), [root, smoke] + lods)
    print('OUTPOST_BUILT', name, counts, flush=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    for age in (argv[1:] or list(ITEMS)):
        build(age, out)
    sys.stdout.flush()
    os._exit(0)
