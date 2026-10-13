# scripts/blender/build_worker_loads.py
# What a battle worker carries (manifest rows MD07, AN15, AN16 as changed on 13 October: four
# resources, food, wood, stone and gold; no ore load). Original work for Terra Imperium, CC0-1.0.
# One file, src/assets/battle/props/worker-loads.glb, in the kit pipeline of the nature files
# (ti_town.build_file: one baked 512 atlas, the Town material, LOD0..LOD2 per object):
#   load-logs, load-stone, load-gold, load-food          a load on a worker's back
#   barrow-empty, barrow-logs, barrow-stone, barrow-gold, barrow-food   a one-wheel barrow
#
#   blender -b --factory-startup -P scripts/blender/build_worker_loads.py -- <out_dir>
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

for _n in ('produce_red', 'sack_dark'):
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    tm.mat_simple('produce_red', ['#b3261e', '#d43a2c', '#8f1d18'], scale=30.0, rough=0.6, bump=0.1)
    tm.mat_simple('sack_dark', ['#4a3626', '#5c4530', '#3a2a1e'], scale=30.0, bump=0.5)


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
FILES = {FILE: ITEMS}  # the shape build_nature.py uses (art previews read it)


def split_wheel(lod_obj):
    """Move the wheel's faces of one barrow level into a child mesh `wheel` whose origin is the axle."""
    axle = Vector((0, WHEEL_Y, WHEEL_Z))

    def is_wheel(face):
        c = face.calc_center_median()
        return abs(c.x) <= WHEEL_W / 2 + 0.0045 and math.hypot(c.y - axle.y, c.z - axle.z) <= WHEEL_R + 0.002

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


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'worker-loads')
    tm.transfer_uvs = material_transfer
    counts = tt.build_file(FILE, [(name, fn, None) for name, fn in ITEMS], out_dir, atlas=512, seed=SEED0, write=False)
    scene = bpy.context.scene
    exported, wheels = [], {}
    for root in [o for o in scene.objects if o.type == 'EMPTY' and o.parent is None]:
        exported.append(root)
        for lod in sorted([c for c in root.children if c.type == 'MESH'], key=lambda o: o.name):
            exported.append(lod)
            if root.name.startswith('barrow-'):
                wheel = split_wheel(lod)
                exported.append(wheel)
                wheels.setdefault(root.name, []).append(tm.triangles(wheel))
    for name, c in counts.items():  # the wheel is part of the level it hangs from
        for i in range(3):
            assert c['LOD%d' % i] <= BUDGET[i], (name, c)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, FILE + '.blend'))
    tm.export_glb(os.path.join(out_dir, FILE + '.glb'), exported)
    import json
    report = {'file': FILE + '.glb', 'scale': '1 unit = 10 m, true size; carried at 5.278 tiles a unit', 'atlas': 512, 'seed': SEED0,
              'budget': BUDGET, 'triangles_with_wheel': counts, 'wheel_triangles': wheels, 'license': 'CC0-1.0, original work'}
    with open(os.path.join(out_dir, 'report-worker-loads.json'), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('WORKER_LOADS_BUILT', counts, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
