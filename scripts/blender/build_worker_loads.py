# scripts/blender/build_worker_loads.py
# What a battle worker carries (manifest rows MD07, AN15, AN16 as changed on 13 October: four
# resources, food, wood, stone and gold; no ore load). Original work for Terra Imperium, CC0-1.0.
# Two files in src/assets/battle/props/, in the kit pipeline of the nature files (ti_town.build_file:
# one baked 512 atlas a file, the Town material, LOD0..LOD2 per object), the SAME nine names in each:
#   load-logs, load-stone, load-gold, load-food          a load on a worker's back
#   barrow-empty, barrow-logs, barrow-stone, barrow-gold, barrow-food   a one-wheel barrow
#   worker-loads.glb          Bronze to Gunpowder: logs, a roped block, a sack of gold, a wicker
#                             basket, a timber barrow
#   worker-loads-modern.glb   Modern: sawn planks, concrete blocks and a cement bag, a steel case of
#                             gold bars, a blue plastic crate, a green steel barrow on a rubber tyre
# The age picks the file, the resource the object (src/battle/art/workerLoads.js).
#
#   blender -b --factory-startup -P scripts/blender/build_worker_loads.py -- <out_dir> [file,file]
#
# SCALE. 1 unit = 10 m like every kit, true size: a 1.8 m person is 0.18 units. The battle draws
# kits at 2.75 tiles a unit but a soldier at 0.95 tiles for those 1.8 m (unitModels.js
# ART_UNIT_WORLD), 1.92 times true size. So a load carried by a worker is drawn at the FIGURE
# scale, 0.95 / 0.18 = 5.278 tiles a unit (src/battle/art/workerLoads.js LOAD_TILES_PER_UNIT),
# not at 2.75. The loads are also cut a little big for a real back (a 1.0 m log, a 0.5 m block):
# on a phone a worker is 20 px tall and a true-size load would be 5 px.
#
# ORIGINS. Front is Blender -Y (glTF +Z), as in every kit.
#   load-*    the origin is where the load meets the worker's back: bottom centre of the load,
#             against the back. Everything is at y >= 0 (behind the back) and z >= 0. Place it
#             0.095 units up and 0.022 units behind the worker's centre (waist height, 0.95 m).
#   barrow-*  the origin is on the ground under the tray; the wheel is ahead (-Y), the handles
#             reach back to y = +0.125 where the worker's hands are: stand the worker 0.115 units
#             behind the origin.
# WHEEL. Every barrow level has a child mesh named `wheel` (wheel, wheel.001 ... in the file) whose
# own origin is the axle, the axle along its local X: spin it about X. The game's kit loader
# (kitLoader.js bakeBundle) merges a level's children, so the barrow draws whole today.
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
from build_nature import material_transfer  # noqa: E402

FILE = 'worker-loads'
SEED0 = 7700
BUDGET = (800, 200, 50)  # plans/art/TRIANGLE-BUDGET.md, prop row; the wheel counts toward it
WHEEL_Y, WHEEL_Z, WHEEL_R, WHEEL_W = -0.085, 0.026, 0.026, 0.012

for _n in ('produce_red', 'sack_dark', 'steel', 'steel_dark', 'rubber', 'paint_green', 'plastic_blue', 'concrete', 'lumber', 'paper_sack'):
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    tm.mat_simple('produce_red', ['#b3261e', '#d43a2c', '#8f1d18'], scale=30.0, rough=0.6, bump=0.1)
    tm.mat_simple('sack_dark', ['#4a3626', '#5c4530', '#3a2a1e'], scale=30.0, bump=0.5)
    # the Modern set: machine-made surfaces, flatter and cleaner than the first set's
    tm.mat_simple('steel', ['#8d959c', '#a4acb3', '#767e85'], scale=40.0, rough=0.5, bump=0.05)
    tm.mat_simple('steel_dark', ['#353d45', '#434c55', '#2a3138'], scale=40.0, rough=0.55, bump=0.05)
    tm.mat_simple('rubber', ['#1b1b1d', '#262629', '#131314'], scale=60.0, rough=0.95, bump=0.2)
    tm.mat_simple('paint_green', ['#2c6a3c', '#357a46', '#255b33'], scale=30.0, rough=0.6, bump=0.05)
    tm.mat_simple('plastic_blue', ['#1d5cab', '#2a70c4', '#174d92'], scale=40.0, rough=0.5, bump=0.0)
    tm.mat_simple('concrete', ['#a3a39d', '#b4b4ae', '#93938d'], scale=60.0, bump=0.3)
    tm.mat_simple('lumber', ['#d8b67c', '#e6c890', '#c8a46a'], scale=8.0, stripes={'dir': 'X', 'scale': 120.0, 'distortion': 2.0}, bump=0.15)
    tm.mat_simple('paper_sack', ['#b9a784', '#c9b896', '#a89673'], scale=30.0, bump=0.3)


if not any(n == 'worker-loads' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('worker-loads', make_materials))


def open_box(ms, mat, size, at, rot_z=0.0, lod=2, only=None):
    """A box without its bottom face (10 triangles): the far level's tray and loads."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.5], context='FACES')
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    return ms.add(bm, mat, lod, tm.Mesher._m(at, rot_z), only=only)


def tent(ms, mat, at, rx, ry, h, lod=2, only=(2,)):
    """Four triangles to a point: a heap at the far level."""
    x, y, z = at
    bm = bmesh.new()
    base = [bm.verts.new((x + sx * rx, y + sy * ry, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    top = bm.verts.new((x, y, z + h))
    for i in range(4):
        bm.faces.new((base[i], base[(i + 1) % 4], top))
    return ms.add(bm, mat, lod, only=only)


def strap(ms, p0, p1, w=0.004, lod=0):
    tn.limb(ms, 'reed', p0, p1, w / 2, w / 2, segs=4, lod=lod, caps=False)


def heap(ms, mat, at, r, rng, squash=0.7, far=True, sub=2):
    """A rounded heap (gold, produce): a faceted dome, plainer at the lower levels."""
    seed = rng.randrange(1 << 30)
    tn.blob(ms, mat, at, r, (1, 1, squash), random.Random(seed), 0.14, sub, lod=0, only=(0,), cut=-0.15 * r)
    tn.blob(ms, mat, at, r, (1, 1, squash), random.Random(seed), 0.1, 1, lod=2 if far else 1, only=(1, 2) if far else (1,), cut=-0.15 * r)


def sack(ms, mat, at, r, h, lod=1, yaw=0.0, lean=0.0):
    """A filled sack standing on its base: bulging sides, a gathered neck."""
    f = Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(yaw), 4, 'Z') @ Matrix.Rotation(math.radians(lean), 4, 'X')
    ms.lathe(mat, [(r * 0.8, 0), (r, h * 0.3), (r * 0.92, h * 0.68), (r * 0.42, h * 0.88), (r * 0.5, h)], segs=8, lod=0, frame=f)
    if lod >= 1:
        ms.cyl(mat, r * 0.95, r * 0.6, h * 0.92, segs=5, lod=lod, frame=f, only=tuple(range(1, lod + 1)))


# ---- loads on the back ---------------------------------------------------------------------------

def frame(ms, w=0.02, h=0.075):
    """The carrying frame: two uprights against the back and a foot board."""
    for sx in (-1, 1):
        tn.limb(ms, 'log', (sx * w, 0.004, 0), (sx * w, 0.004, h), 0.0035, 0.003, segs=4, lod=1, caps=False)
    ms.box('log', (w * 2.6, 0.03, 0.005), at=(0, 0.018, 0), lod=0)


def load_logs(ms, rng):
    """Three short logs across the back on a frame: a wide dark bar with pale round ends."""
    frame(ms)
    for k, (y, z) in enumerate([(0.022, 0.02), (0.022, 0.05), (0.048, 0.035)]):
        r, half = 0.0145, 0.052 + 0.004 * (k == 1)
        tn.log(ms, (-half, y, z), (half, y, z), r, segs=8, lod=0, only=(0,))
        tn.log(ms, (-half, y, z), (half, y, z), r, segs=5, lod=1, only=(1,))
        tn.log(ms, (-half, y, z), (half, y, z), r * 1.08, segs=4, lod=2, only=(2,))
    for sx in (-0.028, 0.028):  # the lashings
        strap(ms, (sx, 0.004, 0.006), (sx, 0.066, 0.034))
        strap(ms, (sx, 0.066, 0.034), (sx, 0.004, 0.068))


def load_stone(ms, rng):
    """A sawn block in a rope sling with a smaller one on top: a pale square lump."""
    frame(ms, w=0.018, h=0.06)
    ms.box('quarry_cut', (0.058, 0.046, 0.042), at=(0, 0.031, 0.006), rot_z=3, lod=2, bevel=0.004)
    ms.box('quarry_cut', (0.036, 0.032, 0.026), at=(0.004, 0.028, 0.048), rot_z=-14, lod=2, bevel=0.003)
    for sx in (-0.016, 0.016):  # the sling
        strap(ms, (sx, 0.005, 0.004), (sx, 0.057, 0.004))
        strap(ms, (sx, 0.057, 0.004), (sx, 0.057, 0.05))
        strap(ms, (sx, 0.057, 0.05), (sx, 0.005, 0.05))


def load_gold(ms, rng):
    """A small heavy dark sack, open, heaped with bright yellow: a round dark base, a yellow cap."""
    sack_open(ms, (0, 0.032, 0), 0.03, 0.045, rng, far=True)
    for sx in (-1, 1):  # the shoulder ropes
        strap(ms, (sx * 0.02, 0.003, 0.062), (sx * 0.018, 0.022, 0.03))


def sack_open(ms, at, r, h, rng, far=True, lod=2, sub=2):
    """An open dark sack of gold: the sack and the yellow heap in its mouth."""
    x, y, z = at
    ms.lathe('sack_dark', [(r * 0.78, 0), (r, h * 0.35), (r * 0.95, h * 0.8), (r * 0.8, h)], at=at, segs=9, lod=0)
    ms.cyl('sack_dark', r * 0.95, r * 0.82, h, at=at, segs=5, lod=lod, only=tuple(range(1, lod + 1)), caps=False)
    heap(ms, 'gold_bright', (x, y, z + h * 0.92), r * 0.84, rng, squash=0.75, far=far and lod == 2, sub=sub)
    for k in range(3):  # nuggets that will not fit
        a = 2.1 * k + 0.5
        tn.blob(ms, 'gold_bright', (x + math.cos(a) * r * 0.5, y + math.sin(a) * r * 0.5, z + h * 1.22), r * 0.3, (1, 1, 0.9), rng, 0.2, 1, lod=0)


def load_food(ms, rng):
    """A tall wicker basket of produce: a tan cone standing high, green and red on top."""
    basket(ms, (0, 0.03, 0), 0.021, 0.03, 0.07, rng)
    for sx in (-1, 1):
        strap(ms, (sx * 0.02, 0.003, 0.07), (sx * 0.02, 0.014, 0.02))


def basket(ms, at, r0, r1, h, rng, lod=2):
    x, y, z = at
    ms.lathe('thatch', [(r0, 0), (r0 * 1.12, h * 0.3), (r1, h * 0.93), (r1 * 1.07, h)], at=at, segs=10, lod=0)
    ms.cyl('thatch', r0 * 1.05, r1, h, at=at, segs=6, lod=lod, only=tuple(range(1, lod + 1)), caps=False)
    for zz in (h * 0.32, h * 0.66):  # the woven bands
        ms.cyl('reed', r0 + (r1 - r0) * zz / h + 0.002, r0 + (r1 - r0) * (zz + 0.004) / h + 0.002, 0.004, at=(x, y, z + zz), segs=10, lod=0, caps=False)
    heap(ms, 'leaf', (x - r1 * 0.2, y, z + h * 0.98), r1 * 0.8, rng, squash=0.8, far=False)
    for k, (dx, dy, rr) in enumerate([(0.5, -0.3, 0.42), (0.35, 0.5, 0.36), (-0.45, 0.55, 0.3)]):
        seed = rng.randrange(1 << 30)
        p = (x + dx * r1, y + dy * r1, z + h * 1.1)
        tn.blob(ms, 'produce_red', p, rr * r1, (1, 1, 1), random.Random(seed), 0.08, 1, lod=0 if k else 1)
    if lod == 2:  # the far level: a green point and a red one over the basket
        tent(ms, 'leaf', (x - r1 * 0.25, y, z + h), r1 * 0.75, r1 * 0.95, r1 * 0.8)
        tent(ms, 'produce_red', (x + r1 * 0.55, y, z + h), r1 * 0.45, r1 * 0.6, r1 * 0.85)


# ---- the barrow ------------------------------------------------------------------------------------

def barrow(ms, rng):
    """A timber wheelbarrow: one plank wheel between two shafts that run back as the handles, a
    tray of boards over them and two legs under the back of the tray."""
    # the wheel (split into the child `wheel` after the bake): a plank disc, a hub, two battens
    wy, wz, r, w = WHEEL_Y, WHEEL_Z, WHEEL_R, WHEEL_W
    for lod, segs in ((0, 14), (1, 8), (2, 4)):
        ms.cyl('timber', r, r, w, at=(-w / 2, wy, wz), rot=(0, 90, 0), segs=segs, lod=lod, only=(lod,))
    ms.cyl('dark', 0.006, 0.006, w + 0.008, at=(-w / 2 - 0.004, wy, wz), rot=(0, 90, 0), segs=6, lod=0)
    for sx in (-1, 1):
        ms.box('log', (0.0015, r * 1.7, 0.006), at=(sx * (w / 2 + 0.0006), wy, wz - 0.003), lod=0)
        ms.box('log', (0.0015, 0.006, r * 1.7), at=(sx * (w / 2 + 0.0006), wy, wz - r * 0.85), lod=0)
    # the shafts: from the axle, under the tray, out to the handles
    for sx in (-1, 1):
        a, b, c = (sx * 0.017, wy, wz), (sx * 0.03, 0.03, 0.036), (sx * 0.036, 0.125, 0.062)
        tn.limb(ms, 'log', a, b, 0.0042, 0.0042, segs=4, lod=1, caps=False)
        tn.limb(ms, 'log', b, c, 0.0042, 0.0036, segs=4, lod=1, caps=False)
        ms.quad_strip('log', [(sx * 0.03 - 0.004, -0.04, 0.035), (sx * 0.03 + 0.004, -0.04, 0.035), (sx * 0.036 + 0.004, 0.125, 0.063), (sx * 0.036 - 0.004, 0.125, 0.063)], lod=2)
        ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, (2,))
        tn.limb(ms, 'log', (sx * 0.03, 0.04, 0.036), (sx * 0.033, 0.046, -0.004), 0.004, 0.0035, segs=4, lod=0, caps=False)  # a leg
    # the tray: a floor and four boards, the front one raked
    ms.box('log', (0.076, 0.105, 0.006), at=(0, 0, 0.036), lod=1)
    for sx in (-1, 1):
        ms.box('log', (0.005, 0.105, 0.03), at=(sx * 0.0385, 0, 0.04), lod=1, bevel=0.001)
    ms.box('log', (0.082, 0.005, 0.03), at=(0, 0.053, 0.04), lod=1, bevel=0.001)
    ms.box('log', (0.082, 0.005, 0.034), at=(0, -0.053, 0.04), lod=1, bevel=0.001)
    for y in (-0.03, 0.03):  # battens under the floor
        ms.box('timber', (0.07, 0.008, 0.004), at=(0, y, 0.032), lod=0)
    open_box(ms, 'log', (0.082, 0.11, 0.036), at=(0, 0, 0.036), lod=2, only=(2,))


TRAY_Z = 0.042


def barrow_empty(ms, rng):
    barrow(ms, rng)


def barrow_logs(ms, rng):
    """Logs laid along the tray and standing well over it, their pale ends to the front."""
    barrow(ms, rng)
    spots = [(-0.021, 0.014, 0), (0.008, 0.015, 0), (0.03, 0.0125, 0), (-0.008, 0.014, 1), (0.019, 0.013, 1)]
    for k, (x, r, row) in enumerate(spots):
        z = TRAY_Z + 0.014 + row * 0.024
        a, b = (x, -0.066 - 0.004 * row, z), (x, 0.062, z + 0.004)
        tn.log(ms, a, b, r, segs=8, lod=0, only=(0,))
        tn.log(ms, a, b, r, segs=4, lod=1, only=(1,))
    for x, z in ((-0.017, TRAY_Z + 0.02), (0.019, TRAY_Z + 0.022)):
        tn.log(ms, (x, -0.068, z), (x, 0.062, z), 0.021, segs=4, lod=2, only=(2,))
    strap(ms, (-0.04, 0.0, 0.07), (0.0, 0.0, 0.098))
    strap(ms, (0.0, 0.0, 0.098), (0.04, 0.0, 0.07))


def barrow_stone(ms, rng):
    """Three sawn blocks: two in the tray, one across them."""
    barrow(ms, rng)
    ms.box('quarry_cut', (0.05, 0.044, 0.036), at=(-0.008, -0.026, TRAY_Z), rot_z=4, lod=1, bevel=0.004)
    ms.box('quarry_cut', (0.054, 0.04, 0.034), at=(0.004, 0.026, TRAY_Z), rot_z=-6, lod=1, bevel=0.004)
    ms.box('quarry_cut', (0.04, 0.046, 0.028), at=(0.002, 0.0, TRAY_Z + 0.036), rot_z=24, lod=1, bevel=0.003)
    open_box(ms, 'quarry_cut', (0.058, 0.09, 0.05), at=(0, 0, TRAY_Z + 0.012), lod=2, only=(2,))


def barrow_gold(ms, rng):
    """Two open sacks of gold and loose nuggets between them: dark sacks, yellow heaps."""
    barrow(ms, rng)
    sack_open(ms, (-0.006, -0.026, TRAY_Z), 0.026, 0.036, rng, lod=1, sub=1)
    sack_open(ms, (0.006, 0.026, TRAY_Z), 0.025, 0.034, rng, lod=1, sub=1)
    for k, (x, y) in enumerate([(0.026, -0.004), (-0.026, 0.004), (0.0, 0.0)]):
        tn.blob(ms, 'gold_bright', (x, y, TRAY_Z + 0.014), 0.011, (1, 1, 0.9), rng, 0.2, 1, lod=0)
    open_box(ms, 'sack_dark', (0.056, 0.09, 0.03), at=(0, 0, TRAY_Z), lod=2, only=(2,))
    tent(ms, 'gold_bright', (0, 0, TRAY_Z + 0.03), 0.026, 0.042, 0.022)


def barrow_food(ms, rng):
    """A pale grain sack, a basket of produce and loose greens: pale, tan, green and red."""
    barrow(ms, rng)
    sack(ms, 'linen', (-0.008, 0.028, TRAY_Z), 0.026, 0.05, lod=2, lean=-8)
    basket(ms, (0.008, -0.026, TRAY_Z), 0.019, 0.026, 0.04, rng, lod=1)
    tn.blob(ms, 'leaf', (-0.024, -0.03, TRAY_Z + 0.012), 0.015, (1, 1, 0.8), rng, 0.14, 1, lod=0)
    tn.blob(ms, 'produce_red', (0.028, 0.008, TRAY_Z + 0.012), 0.011, (1, 1, 1), rng, 0.08, 1, lod=0)
    tent(ms, 'leaf', (0.004, -0.026, TRAY_Z + 0.02), 0.03, 0.026, 0.034)


ITEMS = [('load-logs', load_logs), ('load-stone', load_stone), ('load-gold', load_gold), ('load-food', load_food),
         ('barrow-empty', barrow_empty), ('barrow-logs', barrow_logs), ('barrow-stone', barrow_stone),
         ('barrow-gold', barrow_gold), ('barrow-food', barrow_food)]


# ---- the Modern set (worker-loads-modern.glb) ---------------------------------------------------
# The same nine names for a present-day worker: sawn timber, concrete blocks and a cement bag, a
# steel strongbox of ingots, a blue plastic crate, and a green steel wheelbarrow on a rubber tyre.
# Told from the timber-and-wicker set by its straight machine-made shapes and its colours (pale
# sawn planks, flat grey concrete, blue plastic, green paint, black rubber); told from each other
# by the resource's own colour, as in the first set: pale wood, grey, yellow, green and red.

M_WHEEL = {'y': -0.08, 'z': 0.021, 'r': 0.021, 'w': 0.015}
M_TRAY_Z = 0.036


def pack_frame(ms, w=0.02, h=0.07):
    """An aluminium pack frame: two tubes against the back, a shelf under the load."""
    for sx in (-1, 1):
        tn.limb(ms, 'steel', (sx * w, 0.004, 0), (sx * w, 0.004, h), 0.003, 0.003, segs=4, lod=1, caps=False)
    ms.box('steel', (w * 2.5, 0.032, 0.004), at=(0, 0.019, 0), lod=0)


def band(ms, x, y, z, d, h, axis='x', mat='steel_dark', lod=0):
    """A strap round a bundle: a thin box a little bigger than the bundle's section."""
    size = (0.005, d + 0.004, h + 0.004) if axis == 'x' else (d + 0.004, 0.005, h + 0.004)
    ms.box(mat, size, at=(x, y, z - 0.002), lod=lod)


def timber(ms, x, y, z, length, rows, along='x', far_lod=2):
    """Sawn planks stacked square: `rows` is how many planks in each layer from the bottom.
    LOD1 is one slab a layer, LOD2 one box the size of the stack."""
    pw, ph = 0.017, 0.012
    top = z
    for row, n in enumerate(rows):
        for k in range(n):
            off = (k - (n - 1) / 2) * (pw + 0.0015) + (0.003 if row % 2 else 0)
            size = (length, pw, ph) if along == 'x' else (pw, length, ph)
            at = (x, y + off, z + row * (ph + 0.001)) if along == 'x' else (x + off, y, z + row * (ph + 0.001))
            ms.box('lumber', size, at=at, lod=0)
        rw = n * (pw + 0.0015) - 0.0015
        shift = 0.003 if row % 2 else 0
        open_box(ms, 'lumber', (length, rw, ph) if along == 'x' else (rw, length, ph),
                 at=(x, y + shift, z + row * (ph + 0.001)) if along == 'x' else (x + shift, y, z + row * (ph + 0.001)), lod=1, only=(1,))
        top = z + (row + 1) * (ph + 0.001)
    wide = max(rows) * (pw + 0.0015)
    size = (length, wide, top - z) if along == 'x' else (wide, length, top - z)
    open_box(ms, 'lumber', size, at=(x, y, z), lod=far_lod, only=(2,))
    return wide, top - z


def cinder_block(ms, x, y, z, yaw=0.0, lod=2):
    """A hollow concrete block, 0.6 m long: flat pale grey, two dark cores in its top."""
    ms.box('concrete', (0.062, 0.034, 0.03), at=(x, y, z), rot_z=yaw, lod=lod, bevel=0.002)
    f = tm.Mesher._m((x, y, z), yaw)
    for sx in (-1, 1):
        ms.box('dark', (0.019, 0.019, 0.0012), at=(sx * 0.015, 0, 0.0295), lod=0, frame=f)


def cement_bag(ms, x, y, z, yaw=0.0, lod=1):
    ms.box('paper_sack', (0.05, 0.034, 0.017), at=(x, y, z), rot_z=yaw, lod=lod, bevel=0.005)
    ms.box('steel_dark', (0.012, 0.0345, 0.0172), at=(x, y, z), rot_z=yaw, lod=0)  # the printed band, no letters


def ingot(ms, x, y, z, yaw=0.0, lod=1, s=1.0):
    ms.box('gold_bright', (0.024 * s, 0.012 * s, 0.009 * s), at=(x, y, z), rot_z=yaw, lod=lod, taper=0.72)


def strongbox(ms, x, y, z, yaw=0.0, lod=2):
    """An open steel case of gold bars: a dark box, pale steel edges, the lid standing open behind,
    yellow bars stacked over the rim."""
    f = tm.Mesher._m((x, y, z), yaw)
    w, d, h = 0.056, 0.04, 0.024
    ms.box('steel_dark', (w, d, h), lod=lod, bevel=0.002, frame=f)
    ms.box('steel_dark', (w, 0.004, 0.02), at=(0, d / 2 + 0.002, h - 0.002), lod=1, frame=f)  # the lid
    for sx in (-1, 1):
        ms.box('steel', (0.004, d + 0.002, h + 0.001), at=(sx * (w / 2 - 0.004), 0, 0), lod=0, frame=f)
    for k, (ix, iy, iz, yw) in enumerate([(-0.013, -0.008, 0, 0), (0.014, -0.008, 0, 0), (-0.013, 0.008, 0, 0), (0.014, 0.008, 0, 0), (-0.006, 0.0, 0.011, 90), (0.01, 0.0, 0.011, 90), (0.002, 0.0, 0.022, 0)]):
        m = f @ tm.Mesher._m((ix, iy, h + iz), yw)
        ms.box('gold_bright', (0.026, 0.014, 0.011), lod=0, taper=0.72, frame=m)
    ms.box('gold_bright', (w * 0.86, d * 0.8, 0.024), at=(0, -0.001, h), lod=lod, taper=0.6, frame=f)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], lod, tuple(range(1, lod + 1)))


def crate(ms, x, y, z, rng, yaw=0.0, lod=2, full=True):
    """A blue plastic crate with slotted sides, heaped with greens and red fruit."""
    f = tm.Mesher._m((x, y, z), yaw)
    w, d, h = 0.056, 0.04, 0.03
    ms.box('plastic_blue', (w, d, h), lod=lod, bevel=0.002, frame=f)
    ms.box('plastic_blue', (w + 0.004, d + 0.004, 0.005), at=(0, 0, h - 0.004), lod=0, frame=f)  # the rim
    for sy in (-1, 1):
        for k in range(4):
            ms.box('dark', (0.008, 0.0008, 0.014), at=((k - 1.5) * 0.012, sy * (d / 2 + 0.0002), 0.007), lod=0, frame=f)
    if full:
        p = f @ Vector((-0.008, 0, h))
        heap(ms, 'leaf', (p.x, p.y, p.z), 0.022, rng, squash=0.7, far=False, sub=1)
        for k, (dx, dy) in enumerate([(0.017, -0.008), (0.014, 0.01), (-0.02, 0.012)]):
            q = f @ Vector((dx, dy, h + 0.007))
            tn.blob(ms, 'produce_red', (q.x, q.y, q.z), 0.0095, (1, 1, 1), rng, 0.08, 1, lod=0 if k else 1)
        if lod == 2:
            g, r = f @ Vector((-0.01, 0, h)), f @ Vector((0.017, 0, h))
            tent(ms, 'leaf', (g.x, g.y, g.z), 0.017, 0.018, 0.018)
            tent(ms, 'produce_red', (r.x, r.y, r.z), 0.01, 0.012, 0.016)


def m_load_logs(ms, rng):
    """A strapped bundle of sawn planks across the back: a pale square-ended slab."""
    pack_frame(ms)
    wide, high = timber(ms, 0, 0.034, 0.008, 0.125, (3, 3, 2))
    for sx in (-0.036, 0.036):
        band(ms, sx, 0.034, 0.008, wide, high)


def m_load_stone(ms, rng):
    """Two concrete blocks and a cement bag on a pack frame: flat grey bricks, a tan bag."""
    pack_frame(ms, h=0.06)
    cinder_block(ms, 0, 0.026, 0.005)
    cinder_block(ms, 0.002, 0.026, 0.036, yaw=4)
    cement_bag(ms, 0, 0.028, 0.067, yaw=-5, lod=2)
    for sx in (-0.018, 0.018):
        band(ms, sx, 0.026, 0.005, 0.034, 0.062, mat='plastic_blue')


def m_load_gold(ms, rng):
    """An open steel case of gold bars: a dark box under a yellow stack."""
    pack_frame(ms, h=0.05)
    strongbox(ms, 0, 0.028, 0.005)


def m_load_food(ms, rng):
    """A blue plastic crate of produce on a pack frame."""
    pack_frame(ms, h=0.05)
    crate(ms, 0, 0.03, 0.005, rng)


def m_barrow(ms, rng):
    """A steel wheelbarrow: a green pressed tray, a tube frame that runs from the axle back to
    two black grips, tube legs, one fat rubber tyre on a pale hub."""
    wy, wz, r, w = M_WHEEL['y'], M_WHEEL['z'], M_WHEEL['r'], M_WHEEL['w']
    for lod, segs in ((0, 14), (1, 8), (2, 4)):
        ms.cyl('rubber', r, r, w, at=(-w / 2, wy, wz), rot=(0, 90, 0), segs=segs, lod=lod, only=(lod,))
    ms.cyl('steel', r * 0.52, r * 0.52, w + 0.003, at=(-w / 2 - 0.0015, wy, wz), rot=(0, 90, 0), segs=8, lod=0)
    ms.cyl('steel', r * 0.52, r * 0.52, w + 0.002, at=(-w / 2 - 0.001, wy, wz), rot=(0, 90, 0), segs=5, lod=1, only=(1,))
    for sx in (-1, 1):
        a, b, c = (sx * 0.014, wy, wz), (sx * 0.028, 0.02, 0.032), (sx * 0.034, 0.12, 0.062)
        tn.limb(ms, 'steel', a, b, 0.0032, 0.0032, segs=5, lod=0, caps=False)
        tn.limb(ms, 'steel', b, c, 0.0032, 0.0032, segs=5, lod=0, caps=False)
        tn.limb(ms, 'steel', a, b, 0.0034, 0.0034, segs=3, lod=1, only=(1,), caps=False)
        tn.limb(ms, 'steel', b, c, 0.0034, 0.0034, segs=3, lod=1, only=(1,), caps=False)
        tn.limb(ms, 'rubber', (sx * 0.0335, 0.112, 0.0596), (sx * 0.0345, 0.13, 0.065), 0.0045, 0.0045, segs=5, lod=0)  # a grip
        ms.quad_strip('steel', [(sx * 0.028 - 0.004, -0.03, 0.031), (sx * 0.028 + 0.004, -0.03, 0.031), (sx * 0.034 + 0.004, 0.125, 0.063), (sx * 0.034 - 0.004, 0.125, 0.063)], lod=2)
        ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, (2,))
        tn.limb(ms, 'steel', (sx * 0.029, 0.03, 0.033), (sx * 0.034, 0.05, -0.003), 0.003, 0.003, segs=4, lod=0, caps=False)  # a leg
    tn.limb(ms, 'steel', (-0.034, 0.05, 0.001), (0.034, 0.05, 0.001), 0.003, 0.003, segs=4, lod=0, caps=False)  # the legs' foot bar
    tub(ms, 'paint_green', bottom=(0.05, 0.07), top=(0.084, 0.116), z0=0.03, z1=0.064, wall=0.003)


def tub(ms, mat, bottom, top, z0, z1, wall):
    """A pressed steel tray, wider at the rim: outside, rim, inside and floor at LOD0 and LOD1,
    a closed tapered box at LOD2."""
    def ring(w, d, z):
        return [(-w / 2, -d / 2, z), (w / 2, -d / 2, z), (w / 2, d / 2, z), (-w / 2, d / 2, z)]
    bm = bmesh.new()
    ob, ot = [bm.verts.new(p) for p in ring(bottom[0], bottom[1], z0)], [bm.verts.new(p) for p in ring(top[0], top[1], z1)]
    it = [bm.verts.new(p) for p in ring(top[0] - 2 * wall, top[1] - 2 * wall, z1)]
    ib = [bm.verts.new(p) for p in ring(bottom[0] - 2 * wall, bottom[1] - 2 * wall, z0 + wall)]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))   # outside
        bm.faces.new((ot[i], ot[j], it[j], it[i]))   # rim
        bm.faces.new((it[i], it[j], ib[j], ib[i]))   # inside
    bm.faces.new(ib)
    bm.faces.new(list(reversed(ob)))
    ms.add(bm, mat, 1)
    far = bmesh.new()
    fb, ft = [far.verts.new(p) for p in ring(bottom[0], bottom[1], z0)], [far.verts.new(p) for p in ring(top[0], top[1], z1)]
    for i in range(4):
        j = (i + 1) % 4
        far.faces.new((fb[i], fb[j], ft[j], ft[i]))
    far.faces.new(ft)
    ms.add(far, mat, 2, only=(2,))


def m_barrow_empty(ms, rng):
    m_barrow(ms, rng)


def m_barrow_logs(ms, rng):
    """Sawn planks along the tray, their square pale ends over the wheel."""
    m_barrow(ms, rng)
    timber(ms, 0, -0.004, M_TRAY_Z + 0.012, 0.135, (2, 3, 3, 2), along='y')
    band(ms, 0, 0.012, M_TRAY_Z + 0.012, 0.056, 0.052, axis='y')


def m_barrow_stone(ms, rng):
    """Concrete blocks and a cement bag."""
    m_barrow(ms, rng)
    cinder_block(ms, -0.004, -0.02, M_TRAY_Z + 0.004, yaw=90, lod=1)
    cinder_block(ms, 0.002, 0.024, M_TRAY_Z + 0.008, yaw=6, lod=1)
    cinder_block(ms, 0.0, 0.0, M_TRAY_Z + 0.036, yaw=-18, lod=1)
    cement_bag(ms, 0.004, -0.03, M_TRAY_Z + 0.034, yaw=80, lod=1)
    open_box(ms, 'concrete', (0.054, 0.084, 0.05), at=(0, 0, M_TRAY_Z + 0.014), lod=2, only=(2,))


def m_barrow_gold(ms, rng):
    """The open strongbox and a second stack of bars."""
    m_barrow(ms, rng)
    strongbox(ms, 0, 0.018, M_TRAY_Z + 0.006, yaw=0, lod=1)
    for k, (x, y, z, yaw) in enumerate([(-0.012, -0.03, 0, 8), (0.013, -0.031, 0, -6), (0.0, -0.03, 0.009, 2)]):
        ingot(ms, x, y, M_TRAY_Z + 0.022 + z, yaw, lod=0)
    open_box(ms, 'steel_dark', (0.056, 0.086, 0.028), at=(0, 0, M_TRAY_Z + 0.006), lod=2, only=(2,))
    tent(ms, 'gold_bright', (0, 0, M_TRAY_Z + 0.034), 0.026, 0.04, 0.02)


def m_barrow_food(ms, rng):
    """A blue crate of produce and a white woven sack."""
    m_barrow(ms, rng)
    crate(ms, 0.0, -0.022, M_TRAY_Z + 0.014, rng, yaw=90, lod=1)
    sack(ms, 'linen', (0.0, 0.03, M_TRAY_Z + 0.006), 0.025, 0.05, lod=1, lean=-6)
    open_box(ms, 'plastic_blue', (0.04, 0.056, 0.03), at=(0, -0.022, M_TRAY_Z + 0.014), lod=2, only=(2,))
    tent(ms, 'leaf', (0, -0.022, M_TRAY_Z + 0.044), 0.018, 0.024, 0.018)


MODERN_ITEMS = [('load-logs', m_load_logs), ('load-stone', m_load_stone), ('load-gold', m_load_gold), ('load-food', m_load_food),
                ('barrow-empty', m_barrow_empty), ('barrow-logs', m_barrow_logs), ('barrow-stone', m_barrow_stone),
                ('barrow-gold', m_barrow_gold), ('barrow-food', m_barrow_food)]

# file -> its objects (the shape build_nature.py uses; a file's seed is SEED0 + 17 x its place here)
FILES = {FILE: ITEMS, FILE + '-modern': MODERN_ITEMS}
WHEELS = {FILE: {'y': WHEEL_Y, 'z': WHEEL_Z, 'r': WHEEL_R, 'w': WHEEL_W}, FILE + '-modern': M_WHEEL}


def split_wheel(lod_obj, wh):
    """Move the wheel's faces of one barrow level into a child mesh `wheel` whose origin is the axle."""
    axle = Vector((0, wh['y'], wh['z']))

    def is_wheel(face):
        c = face.calc_center_median()
        return abs(c.x) <= wh['w'] / 2 + 0.0045 and math.hypot(c.y - axle.y, c.z - axle.z) <= wh['r'] + 0.002

    me = lod_obj.data.copy()
    for mesh, keep in ((me, True), (lod_obj.data, False)):
        bm = bmesh.new()
        bm.from_mesh(mesh)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if is_wheel(f) != keep], context='FACES')
        bm.to_mesh(mesh)
        bm.free()
    me.transform(Matrix.Translation(-axle))
    wheel = bpy.data.objects.new('wheel', me)
    bpy.context.scene.collection.objects.link(wheel)
    wheel.parent = lod_obj
    wheel.location = axle
    return wheel


def build(name, out_dir):
    import json
    counts = tt.build_file(name, [(obj, fn, None) for obj, fn in FILES[name]], out_dir, atlas=512, seed=SEED0 + 17 * list(FILES).index(name), write=False)
    scene = bpy.context.scene
    exported, wheels = [], {}
    for root in [o for o in scene.objects if o.type == 'EMPTY' and o.parent is None]:
        exported.append(root)
        for lod in sorted([c for c in root.children if c.type == 'MESH'], key=lambda o: o.name):
            exported.append(lod)
            if root.name.startswith('barrow-'):
                wheel = split_wheel(lod, WHEELS[name])
                assert len(wheel.data.polygons) > 0, (name, root.name, lod.name, 'no wheel faces')
                exported.append(wheel)
                wheels.setdefault(root.name, []).append(tm.triangles(wheel))
    for obj, c in counts.items():  # the wheel is part of the level it hangs from
        for i in range(3):
            assert c['LOD%d' % i] <= BUDGET[i], (name, obj, c)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, name + '.blend'))
    tm.export_glb(os.path.join(out_dir, name + '.glb'), exported)
    report = {'file': name + '.glb', 'scale': '1 unit = 10 m, true size; carried at 5.278 tiles a unit', 'atlas': 512,
              'seed': SEED0 + 17 * list(FILES).index(name), 'budget': BUDGET, 'triangles_with_wheel': counts, 'wheel_triangles': wheels,
              'license': 'CC0-1.0, original work'}
    with open(os.path.join(out_dir, 'report-%s.json' % name), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('WORKER_LOADS_BUILT', name, counts, flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'worker-loads')
    only = argv[1].split(',') if len(argv) > 1 else list(FILES)
    tm.transfer_uvs = material_transfer
    for name in only:
        build(name, out_dir)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
