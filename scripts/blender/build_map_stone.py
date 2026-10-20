# scripts/blender/build_map_stone.py
# The Stone Age close-view map art (eight-ages plan U90) and its raid landing (U91), on the town kit
# (ti_town.build_file: one baked 1024 atlas per file, LOD0..LOD2 under a root named after the file,
# materials Town / Team / Ground), parts in ti_stone_map.py:
#   improvements/farm-stone           digging-stick garden beds in rings of pulled stones, a round
#                                     wattle-and-daub hut, a raised store, stumps of the cleared wood
#   improvements/camp-stone           a hunting camp: two hide tents and a lean-to round a fire,
#                                     hides on frames, meat on drying racks, a heap of bones and tusks
#   improvements/fishing_boats-stone  a beach strip (its Ground, the shoreline the game turns to the
#                                     coast) with fish racks, a net on poles, a hide shelter and a
#                                     canoe pulled up; two dugout canoes with paddlers and a stake
#                                     weir out on the water
#   improvements/pasture-stone        early herders (H-25 follow-up, C1's deferred art): a corral of
#                                     piled thorn brush with goats, sheep and small early cattle, more
#                                     grazing outside, a herder's lean-to by a fire, a hollow-log trough
#   improvements/mine-stone           a flint mine: chalk spoil rings round open shafts, notched log
#                                     ladders, a knapping floor with nodules, flakes and antler picks
#   improvements/fort-stone           a palisade of pointed stakes on an earth bank with its ditch,
#                                     a gate of two tall posts, round huts, a watch platform, a totem
#   outposts/outpost-stone            hide tents and a lean-to round a fire pit, a loaded travois,
#                                     baskets, stakes, a pole with the Team pennant, the `smoke` socket
#   ships/warship-stone               the Stone fleet: two big dugouts lashed as a double canoe with a
#                                     deck, eight paddlers, a Team pennant at the stern (24 m)
#   battle/props/landing-stone        two dugouts beached side by side, paddles, a log to step down,
#                                     a `socket-door` at the bow (the code's landing-<band> shape)
# Each improvement stands on its own round earth Ground patch inside the 50 m circle (fishing boats
# on a beach strip), 8,000 / 1,500 / 300 triangles (plans/art/TRIANGLE-BUDGET.md).
#   blender -b --factory-startup -P scripts/blender/build_map_stone.py -- <out_dir> [farm camp ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_stone_map as ts  # noqa: E402
from ti_town import G  # noqa: E402

WORLD = tm.house_frame(0, 0, 0)
DISC = dict(rx=2.37, ry=2.37, square=None, mat='earth', n=32)


# ---- farm ----------------------------------------------------------------------------------------

def farm(ms, rng):
    # the homestead at the back right: a round hut, a raised store on four posts, a quern
    ts.round_hut(ms, 0.95, 0.95, r=0.32, wall=0.18, top=0.58)
    f = tm.house_frame(1.55, 0.55, 15)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('timber', 0.012, 0.011, 0.14, at=(sx * 0.09, sy * 0.07, G), segs=5, lod=1, frame=f)
    ms.box('timber', (0.22, 0.18, 0.02), at=(0, 0, G + 0.14), lod=2, frame=f)
    ms.box('thatch', (0.26, 0.22, 0.12), at=(0, 0, G + 0.16), lod=2, frame=f, taper=0.15)
    ms.box('st_daub', (0.18, 0.14, 0.06), at=(0, 0, G + 0.155), lod=1, frame=f)
    tn.blob(ms, 'stone', (0.55, 0.5, G), 0.05, (1.4, 1.0, 0.35), rng, 0.15, 1, lod=0, cut=0.0)  # the quern
    tn.blob(ms, 'rock', (0.55, 0.5, G + 0.018), 0.022, (1.0, 1.0, 0.7), rng, 0.15, 1, lod=0)
    ts.basket(ms, 0.66, 0.42, 1.2)
    ts.basket(ms, 0.5, 0.38, 1.0)
    ts.digging_sticks(ms, 0.7, 0.66, 3)
    smoke = bo_fire(ms, rng, 0.35, 0.85)
    # the garden beds: small irregular plots in the cleared wood, ripening grain and green sprouts
    beds = [(-1.1, 0.75, 0.62, 0.42, 8, 'barley'), (-0.35, 1.25, 0.5, 0.36, -12, 'st_sprout'),
            (-1.35, 0.05, 0.5, 0.48, 4, 'st_sprout'), (-0.55, 0.2, 0.58, 0.44, -6, 'barley'),
            (0.25, -0.15, 0.6, 0.4, 10, 'st_sprout'), (-0.95, -0.72, 0.6, 0.42, -14, 'barley'),
            (-0.1, -0.85, 0.52, 0.44, 6, 'st_sprout'), (0.75, -0.75, 0.56, 0.4, 18, 'barley'),
            (1.05, -0.1, 0.42, 0.42, -4, 'st_sprout')]
    for x, y, w, d, yaw, crop in beds:
        ts.garden_bed(ms, rng, x, y, w, d, yaw, crop=crop, mounds=(max(3, round(w / 0.13)), max(2, round(d / 0.13))))
    # stumps of the cleared wood between the plots, a burnt patch, two trees left standing
    for x, y in ((-0.2, 0.68), (0.55, 0.25), (-1.6, -0.5), (0.45, -1.35), (-0.5, -1.4), (1.5, -0.6), (-1.75, 0.65), (0.15, 1.55)):
        ts.stump(ms, x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.04, 0.04), r=rng.uniform(0.02, 0.03))
    ts.tree(ms, rng, -1.65, 1.2, h=0.55, crown=0.18)
    ts.tree(ms, rng, 1.85, -0.2, h=0.5, crown=0.16)
    ts.tree(ms, rng, 1.35, -1.45, h=0.46, crown=0.15, leaf='foliage_dark')
    # a wattle fence round the gardens keeps the deer out, open by the hut
    ts.wattle_fence(ms, rng, 2.02, 105, 345, step=6.0, h=0.11, gaps=((168, 178),))
    return smoke


def beast(ms, rng, x, y, yaw, kind='goat'):
    """A small grazing animal of boxes: goat, sheep (white fleece) or early cattle (bigger, horned)."""
    s = {'goat': 1.0, 'sheep': 1.0, 'cattle': 1.45}[kind]
    body = {'goat': 'hide', 'sheep': 'linen', 'cattle': 'op_hide_dark' if rng.random() < 0.6 else 'hide'}[kind]
    f = tm.house_frame(x, y, yaw)
    ms.box(body, (0.1 * s, 0.045 * s, 0.045 * s), at=(0, 0, G + 0.04 * s), lod=1, frame=f)
    head_down = rng.random() < 0.5  # grazing
    hz = G + (0.03 if head_down else 0.065) * s
    ms.box(body if kind != 'sheep' else 'dark', (0.04 * s, 0.03 * s, 0.03 * s), at=(0.065 * s, 0, hz), lod=1, frame=f)
    if kind == 'cattle':
        for sy in (-1, 1):
            ms.box('horn', (0.006, 0.03, 0.006), at=(0.07 * s, sy * 0.022, hz + 0.028 * s), rot_z=sy * 20, lod=0, frame=f)
    for lx in (-0.035 * s, 0.035 * s):
        for ly in (-0.014 * s, 0.014 * s):
            ms.box('dark', (0.01 * s, 0.01 * s, 0.04 * s), at=(lx, ly, G), lod=0, frame=f)


def brush_ring(ms, rng, cx, cy, r, gate_a=270.0, gate_w=24.0, h=0.09):
    """A corral of piled thorn brush: low heaps of branches round a circle, open at the gate."""
    n = max(10, int(2 * math.pi * r / 0.11))
    for k in range(n):
        a = 360.0 * k / n
        if abs(((a - gate_a + 180) % 360) - 180) < gate_w:
            continue
        x, y = cx + r * math.cos(math.radians(a)), cy + r * math.sin(math.radians(a))
        tn.blob(ms, 'foliage_dark' if k % 3 else 'bark', (x, y, G), 0.06, (1.2, 0.8, h / 0.06 * 0.8), rng, 0.3, 1, lod=1 if k % 2 else 2, cut=0.0)
        if k % 2 == 0:
            ms.cyl('bark', 0.006, 0.004, 0.12, at=(x, y, G + 0.02), rot=(rng.uniform(-60, 60), rng.uniform(-60, 60), 0), segs=4, lod=0)


def pasture(ms, rng):
    # trodden ground in the corral, the brush ring round it, the gate to the south-east
    ms.cyl('mud', 0.78, 0.78, 0.003, at=(-0.25, 0.25, G), segs=24, lod=2)
    brush_ring(ms, rng, -0.25, 0.25, 0.82, gate_a=300.0)
    kinds = ['goat', 'goat', 'sheep', 'sheep', 'sheep', 'cattle', 'cattle', 'goat']
    for k, kind in enumerate(kinds):
        a, r = rng.uniform(0, 2 * math.pi), 0.6 * math.sqrt(rng.random())
        beast(ms, rng, -0.25 + r * math.cos(a), 0.25 + r * math.sin(a), rng.uniform(0, 360), kind)
    # the herd outside on the grass, the herder's lean-to by a fire, a hollow-log trough, a salt stone
    for k in range(7):
        a = math.radians(rng.uniform(-80, 20))
        r = rng.uniform(1.25, 1.9)
        beast(ms, rng, r * math.cos(a), r * math.sin(a), rng.uniform(0, 360), ('goat', 'sheep', 'cattle')[k % 3])
    ts.lean_to(ms, 1.15, 0.95, 200)
    smoke = bo_fire(ms, rng, 0.95, 0.6)
    f = tm.house_frame(0.55, -0.55, 35)
    ms.box('log', (0.32, 0.07, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box('water', (0.27, 0.045, 0.004), at=(0, 0, G + 0.048), lod=0, frame=f)
    ts.cairn(ms, rng, 0.2, -0.85, r=0.05, h=0.06)
    ts.basket(ms, 1.3, 0.62, 1.1)
    ts.hide_frame(ms, 1.45, 1.1, 210)
    for x, y in ((-1.6, -0.6), (1.75, -0.9), (-0.9, -1.6), (1.6, 1.45)):
        ts.tree(ms, rng, x, y, h=rng.uniform(0.45, 0.55), crown=0.16, leaf='foliage' if x < 0 else 'foliage_dark')
    return smoke


def mine(ms, rng):
    # three open shafts in the chalk, each in a ring of white spoil, one with its notched log ladder
    for k, (x, y, r) in enumerate(((-0.55, 0.45, 0.2), (0.45, 0.6, 0.17), (0.05, -0.15, 0.22))):
        ms.sphere('limewash', r * 1.9, at=(x, y, G - 0.02), scale=(1.0, 1.0, 0.18), u=12, v=4, cut_below=0.0, lod=2)
        ms.cyl('dark', r * 0.62, r * 0.62, 0.006, at=(x, y, G + r * 1.9 * 0.18 - 0.004), segs=12, lod=2)
        for j in range(5):  # flint nodules in the spoil
            a = rng.uniform(0, 2 * math.pi)
            tn.blob(ms, 'st_flint', (x + r * 1.3 * math.cos(a), y + r * 1.3 * math.sin(a), G + 0.02), 0.022, (1.2, 1.0, 0.8), rng, 0.25, 1, lod=0)
        if k != 1:
            f = tm.house_frame(x, y, rng.uniform(0, 360))
            ms.cyl('timber', 0.014, 0.012, 0.34, at=(0, 0, G - 0.04), rot=(24, 0, 0), segs=6, lod=1, frame=f)
            for j in range(4):
                ms.box('dark', (0.02, 0.008, 0.006), at=(0, -0.02 - 0.03 * j, G + 0.06 + 0.07 * j), lod=0, frame=f)
    # the knapping floor: a hide spread with nodules, flakes and cores, the anvil stone, antler picks
    f = tm.house_frame(-0.85, -0.65, 12)
    ms.box('hide', (0.36, 0.28, 0.006), at=(0, 0, G), lod=1, frame=f)
    for j in range(12):
        ms.box('st_flint', (0.022, 0.014, 0.006), at=(rng.uniform(-0.15, 0.15), rng.uniform(-0.11, 0.11), G + 0.006), rot_z=rng.uniform(0, 180), lod=0, frame=f)
    tn.blob(ms, 'stone', (-0.75, -0.55, G), 0.04, (1.2, 1.0, 0.7), rng, 0.2, 1, lod=0)
    for j in range(3):
        ms.cyl('horn', 0.008, 0.005, 0.12, at=(-0.45 + 0.05 * j, -0.85, G + 0.008), rot=(0, 80, 20 * j), segs=4, lod=0)
    ts.lean_to(ms, -1.25, -0.25, 70, w=0.36, d=0.22, h=0.22)
    smoke = bo_fire(ms, rng, -1.0, 0.1)
    for j in range(4):
        ts.basket(ms, 0.55 + 0.08 * j, -0.6 + 0.03 * (j % 2), 1.2)
    for x, y in ((1.5, -0.8), (-1.6, 1.0), (1.4, 1.35), (-0.2, 1.7)):
        ts.tree(ms, rng, x, y, h=rng.uniform(0.45, 0.55), crown=0.16, leaf='foliage_dark' if y > 0 else 'foliage')
    for x, y in ((0.9, 0.0), (-0.3, 1.1), (1.0, -1.3)):
        ts.stump(ms, x, y)
    return smoke


def bo_fire(ms, rng, x, y):
    return ts.fire_pit(ms, rng, x, y, r=0.09)


# ---- camp ----------------------------------------------------------------------------------------

def camp(ms, rng):
    ts.cone_tent(ms, -0.75, 0.55, 0.38, 0.62, 'op_hide')
    ts.cone_tent(ms, 0.6, 0.75, 0.34, 0.56, 'op_hide_dark')
    ts.lean_to(ms, -0.05, 1.15, 4, w=0.5, d=0.3, h=0.28)
    smoke = ts.fire_pit(ms, rng, 0.0, 0.05, r=0.1, tripod=True)
    for k in range(4):  # log seats round the fire
        a = 2 * math.pi * k / 4 + 0.3
        p = Vector((0.28 * math.cos(a), 0.05 + 0.26 * math.sin(a), G + 0.02))
        d = Vector((-math.sin(a), math.cos(a), 0)) * 0.08
        tn.limb(ms, 'bark', p - d, p + d, 0.02, 0.02, segs=5, lod=0)
    # hides stretched on frames and meat on racks at the front
    ts.hide_frame(ms, -0.65, -0.55, 12, w=0.24, h=0.24)
    ts.hide_frame(ms, -0.3, -0.75, -6, w=0.2, h=0.22, mat='hide')
    ts.drying_rack(ms, 0.55, -0.5, -20, w=0.46, h=0.22)
    ts.drying_rack(ms, 0.75, -0.05, 70, w=0.36, h=0.2)
    ts.bone_heap(ms, rng, 1.05, 0.35, s=1.2)
    # spears leaning on a forked rack, a pile of firewood, baskets
    f = tm.house_frame(-1.05, 0.0, 70)
    for sx in (-0.1, 0.1):
        ms.cyl('timber', 0.008, 0.007, 0.16, at=(sx, 0, G), segs=4, lod=1, frame=f)
    tn.limb(ms, 'timber', f @ Vector((-0.13, 0, G + 0.15)), f @ Vector((0.13, 0, G + 0.15)), 0.006, 0.006, segs=4, lod=1)
    for k in range(5):
        p = f @ Vector((-0.09 + 0.045 * k, 0.07, G))
        q = f @ Vector((-0.09 + 0.045 * k, -0.02, G + 0.3))
        tn.limb(ms, 'timber', p, q, 0.004, 0.004, segs=4, lod=0)
        tn.limb(ms, 'st_flint', q, q + (q - p).normalized() * 0.03, 0.007, 0.0, segs=4, lod=0)
    tb.log_bundle(ms, -0.35, 0.3, 30, length=0.36)
    for x, y in ((-0.95, 0.35), (-0.9, 0.48), (0.25, 0.6)):
        ts.basket(ms, x, y, 1.3)
    for x, y, h, c in ((-1.7, 1.0, 0.55, 0.18), (1.6, 1.2, 0.5, 0.17), (-1.85, -0.6, 0.48, 0.16), (1.8, -0.75, 0.52, 0.17), (0.3, 1.85, 0.5, 0.16), (-0.6, -1.7, 0.46, 0.15)):
        ts.tree(ms, rng, x, y, h=h, crown=c, leaf='foliage_dark' if x < 0 else 'foliage')
    ts.pole_pennant(ms, 1.25, 0.95, 1.05)
    return smoke


# ---- fishing boats -------------------------------------------------------------------------------

def fishing_boats(ms, rng):
    # the beach strip: the Ground patch shifted to the back (land side), as the Bronze file's
    first = len(ms.parts)
    tt.ground_patch(ms, rng, rx=2.36, ry=0.82, square=None, power=3.0, mat='earth', n=32)
    for bm, *_ in ms.parts[first:]:
        bmesh.ops.translate(bm, vec=(0, 0.25, 0), verts=bm.verts)
    # on the beach: fish racks, a net on poles, a hide shelter, a fire and a canoe pulled up
    ts.drying_rack(ms, -0.75, 0.55, 4, w=0.44, h=0.2, fish=True, n=7)
    ts.drying_rack(ms, -0.2, 0.7, -8, w=0.38, h=0.18, fish=True, n=6)
    ts.net_on_poles(ms, 0.55, 0.62, 6, w=0.4, h=0.17)
    ts.lean_to(ms, 1.25, 0.6, -10, w=0.44, d=0.28, h=0.26)
    smoke = ts.fire_pit(ms, rng, 0.85, 0.2, r=0.08)
    ts.dugout(ms, tm.house_frame(-1.35, 0.25, 72), L=0.55, W=0.08, H=0.05, z=G)
    tn.limb(ms, 'timber', (-1.2, 0.05, G + 0.005), (-1.0, 0.12, G + 0.005), 0.004, 0.004, segs=4, lod=0)
    for x, y in ((-0.5, 0.2), (-0.38, 0.18)):
        ts.basket(ms, x, y, 1.2)
    # on the water: two dugouts with paddlers, a stake weir
    for x, y, yaw, crew in ((-0.35, -0.55, 18, 2), (0.6, -0.75, -24, 1)):
        f = tm.house_frame(x, y, yaw)
        ts.dugout(ms, f, L=0.6, W=0.085, H=0.05, z=0.0)
        for k in range(crew):
            ts.paddler(ms, f, 0.1 - 0.17 * k, 0.012, side=1 if k % 2 == 0 else -1)
    for k in range(13):
        a = math.radians(200 + 11 * k)
        x, y = 1.55 + 0.55 * math.cos(a), -0.15 + 0.6 * math.sin(a)
        if y > 0.05:
            continue
        ms.cyl('log', 0.011, 0.009, 0.1, at=(x, y, -0.02), segs=4, lod=0 if k % 2 else 1, caps=False)
    return smoke


# ---- fort ----------------------------------------------------------------------------------------

def fort(ms, rng):
    R = 1.62
    gate = 270  # the front, -Y
    # the outer ditch, then the earth bank thrown up from it, the palisade along its crest
    tb.sweep(ms, 'st_tilled', [(R + 0.42, G + 0.002), (R + 0.3, G - 0.004), (R + 0.2, G + 0.002)], gate + 9, gate + 351, 30, lod=1)
    for nseg, only in ((36, (0, 1)), (14, (2,))):
        tb.sweep(ms, 'mud', [(R + 0.2, G), (R + 0.06, G + 0.08), (R - 0.06, G + 0.08), (R - 0.18, G)], gate + 7, gate + 353, nseg, lod=2, only=only, chunk=60.0 if only != (2,) else 360.0)
    ts.palisade_ring(ms, rng, R, 0.4, gate, 14, z=G + 0.07, wall_lod1=24, wall_lod2=10)
    # the gate: two tall posts and a lintel with the Team hide, a totem beside it
    for sx in (-1, 1):
        x = R * math.cos(math.radians(gate + sx * 7.5))
        y = R * math.sin(math.radians(gate + sx * 7.5))
        ms.cyl('log', 0.03, 0.026, 0.62, at=(x, y, G), segs=6, lod=2)
    ms.box('log', (0.5, 0.05, 0.05), at=(0, -R, G + 0.56), lod=2)
    ms.box('team_cloth', (0.22, 0.012, 0.14), at=(0, -R - 0.03, G + 0.42), lod=1)
    ts.totem(ms, 0.36, -R + 0.25, h=0.7, team=False)
    # inside: round huts, a long hut, a fire, a watch platform by the back
    ts.round_hut(ms, -0.6, 0.55, r=0.3, wall=0.18, top=0.56)
    ts.round_hut(ms, 0.55, 0.65, r=0.28, wall=0.17, top=0.52, yaw=-30)
    ts.round_hut(ms, -0.75, -0.45, r=0.26, wall=0.16, top=0.5, yaw=40)
    smoke = ts.fire_pit(ms, rng, 0.05, -0.2, r=0.09)
    f = tm.house_frame(0.85, -0.35, 20)  # the watch platform: four posts, a deck, a ladder
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('log', 0.018, 0.016, 0.62, at=(sx * 0.11, sy * 0.11, G), segs=5, lod=2 if sx == sy else 1, frame=f)
    ms.box('timber', (0.3, 0.3, 0.03), at=(0, 0, G + 0.55), lod=2, frame=f)
    ms.box('op_hide', (0.32, 0.32, 0.1), at=(0, 0, G + 0.66), lod=1, frame=f, taper=0.2)
    tt.ladder(ms, f, 0, -0.22, 0.55, lean=16)
    ts.pole_pennant(ms, 0.85, -0.35, 0.95)
    tb.log_bundle(ms, -0.15, 0.3, 80, length=0.36)
    ts.bone_heap(ms, rng, 0.5, 0.15)
    for x, y in ((-0.3, -0.6), (-0.2, -0.68)):
        ts.basket(ms, x, y, 1.3)
    return smoke


# ---- outpost -------------------------------------------------------------------------------------

def outpost(ms, rng):
    ts.cone_tent(ms, -0.8, 0.5, 0.4, 0.64, 'op_hide')
    ts.cone_tent(ms, 0.72, 0.62, 0.34, 0.56, 'op_hide_dark')
    ts.lean_to(ms, -0.05, 1.12, 4, w=0.5, d=0.3, h=0.28)
    ms.box('team_cloth', (0.36, 0.08, 0.012), at=(0, 0, G + 0.27), lod=1, frame=tm.house_frame(-0.05, 0.98, 4))  # a Team hide on the ridge
    smoke = ts.fire_pit(ms, rng, 0.02, -0.2)
    # the travois at the front right: two long poles dragging, a hide bundle lashed on a frame
    f = tm.house_frame(1.0, -0.62, 25)
    for sx in (-1, 1):
        tn.limb(ms, 'timber', f @ Vector((sx * 0.05, -0.42, G + 0.2)), f @ Vector((sx * 0.17, 0.4, G)), 0.01, 0.009, segs=5, lod=2)
    for yy in (-0.05, 0.15):
        tn.limb(ms, 'timber', f @ Vector((-0.15, yy, G + 0.08 - yy * 0.25)), f @ Vector((0.15, yy, G + 0.08 - yy * 0.25)), 0.007, 0.007, segs=4, lod=1)
    ms.sphere('op_hide', 0.13, at=(0, 0.06, G + 0.08), scale=(1.0, 1.3, 0.55), u=8, v=4, lod=1, frame=f)
    ms.sphere('hide_pale', 0.06, at=(0.03, -0.08, G + 0.13), scale=(1, 1, 0.8), u=6, v=4, lod=0, frame=f)
    # supplies at the front left: baskets, hide bundles, firewood, a bone heap
    for k in range(5):
        ts.basket(ms, -0.72 + rng.uniform(-0.09, 0.09), -0.78 + rng.uniform(-0.07, 0.07), rng.uniform(1.2, 1.6))
    bo_sacks(ms)
    tb.log_bundle(ms, -0.32, 0.25, 70, length=0.42)
    ts.bone_heap(ms, rng, -0.4, -0.95, s=0.9)
    ts.hide_frame(ms, 0.45, -0.75, -10, w=0.2, h=0.2)
    ts.stakes_arc(ms, rng, 1.72, 20, 165, 6.5, cy=0.05, gaps=((84, 96),))
    ts.pole_pennant(ms, 1.45, 0.3, 1.2)
    return smoke


def bo_sacks(ms):
    import build_map_outposts as bo
    bo.sacks(ms, -1.0, -0.5, 3, 'op_hide', 1.2)


# ---- warship: the double canoe -------------------------------------------------------------------

def warship(ms, rng):
    L, W, H = 2.3, 0.2, 0.13
    for sx in (-1, 1):
        f = tm.house_frame(sx * 0.2, 0, 0)
        ts.dugout(ms, f, L=L, W=W, H=H, z=0.0)
        ms.box('st_ochre', (0.03, 0.06, 0.08), at=(0, -L / 2 + 0.03, H * 1.1), lod=1, frame=f, taper=0.5)  # a carved bow head
        for k in range(4):  # paddlers on the outer side
            ts.paddler(ms, f, -0.62 + 0.36 * k, H * 0.45, side=sx, s=2.4, lod=1 if k % 2 == 0 else 0)
    # cross poles lashing the hulls and a deck between them
    for yy in (-0.7, -0.25, 0.25, 0.7):
        tn.limb(ms, 'timber', (-0.32, yy, H * 0.98), (0.32, yy, H * 0.98), 0.012, 0.012, segs=5, lod=1)
    ms.box('timber', (0.24, 0.9, 0.018), at=(0, 0.0, H * 0.98), lod=2)
    ms.sphere('op_hide', 0.09, at=(0, 0.2, H + 0.015), scale=(1.0, 1.6, 0.6), u=8, v=4, lod=1, cut_below=0)  # cargo under hides
    for k in range(3):
        tt.jar(ms, WORLD, -0.05 + 0.05 * k, -0.15, 1.6, z=H + 0.01, mat='terracotta')
    ms.cyl('timber', 0.012, 0.01, 0.62, at=(0, 0.48, H), segs=5, lod=2)
    tt.pennant(ms, WORLD, 0, 0.48, H + 0.6, yaw=90, lod=1, w=0.3, h=0.18)
    ms.add(bo_slab(0.3, 0.18), 'team_cloth', 2, matrix=Matrix.Translation(Vector((0, 0.48, H + 0.6))) @ Matrix.Rotation(math.radians(90), 4, 'Z'), only=(2,))
    for k in range(6):  # spears stowed on the deck
        tn.limb(ms, 'timber', (-0.08 + 0.03 * k, -0.42, H + 0.03), (-0.08 + 0.03 * k, 0.05, H + 0.03), 0.004, 0.004, segs=3, lod=0)


def bo_slab(w, h):
    import build_map_outposts as bo
    return bo._slab(w, h)


# ---- landing (battle prop): two dugouts beached ----------------------------------------------------

def landing(ms, rng):
    L, W, H = 1.6, 0.17, 0.11
    for sx, dy in ((-1, 0.08), (1, -0.04)):
        f = tm.house_frame(sx * 0.17, 0.12 + dy, sx * 2)
        ts.dugout(ms, f, L=L, W=W, H=H, z=0.0)
        for k in range(5):  # paddles laid across, the crew is ashore
            yy = -0.45 + 0.24 * k
            tn.limb(ms, 'timber', f @ Vector((-0.12, yy, H * 0.95)), f @ Vector((0.14, yy + 0.05, H * 0.95)), 0.006, 0.006, segs=4, lod=1 if k % 2 == 0 else 0)
        ms.box('st_ochre', (0.025, 0.05, 0.07), at=(0, -L / 2 + 0.03, H * 1.08), lod=1, frame=f, taper=0.5)
        ms.sphere('op_hide', 0.06, at=(0, 0.35, H * 0.7), scale=(1.0, 1.5, 0.7), u=6, v=4, lod=1, frame=f)
    # a log laid to step down at the bows, a Team hide on a short pole at the stern
    tn.limb(ms, 'log', (-0.3, -0.83, 0.02), (0.3, -0.83, 0.02), 0.022, 0.02, segs=6, lod=2)
    ms.cyl('timber', 0.009, 0.008, 0.4, at=(-0.17, 0.85, 0.05), segs=5, lod=2)
    tt.pennant(ms, WORLD, -0.17, 0.85, 0.44, yaw=90, lod=1, w=0.16, h=0.1)


# ---- build -----------------------------------------------------------------------------------------

IMPROVEMENTS = {'farm': farm, 'camp': camp, 'fishing_boats': fishing_boats, 'fort': fort, 'pasture': pasture, 'mine': mine}
SEEDS = {'farm': 9101, 'camp': 9102, 'fishing_boats': 9103, 'fort': 9104, 'outpost': 9105, 'warship': 9106, 'landing': 9107, 'pasture': 9108, 'mine': 9109}


def with_socket(name, layout, ground, out_dir, seed, socket_name, socket_at=None, budgets=None):
    """Build `name` with an empty socket child (the outposts' `smoke`, the landing's `socket-door`)."""
    got = {}

    def run(ms, rng):
        got['at'] = layout(ms, rng)
        ts.on_ground(ms)
        if budgets:
            for lod, b in zip((0, 1, 2), budgets):
                ts.trim(ms, lod, b)
            ts.on_ground(ms)

    counts = tt.build_file(name, [(name, run, ground)], out_dir, atlas=1024, seed=seed, write=False)
    root = bpy.data.objects[name]
    sock = bpy.data.objects.new(socket_name, None)
    bpy.context.scene.collection.objects.link(sock)
    sock.parent = root
    sock.location = Vector(socket_at or got['at'])
    lods = [c for c in root.children if c.type == 'MESH']
    tm.export_glb(os.path.join(out_dir, name + '.glb'), [root, sock] + lods)
    print('STONE_BUILT', name, counts, flush=True)


def build(item, out_dir):
    if item in IMPROVEMENTS:
        name = '%s-stone' % item
        ground = None if item == 'fishing_boats' else DISC
        counts = tt.build_file(name, [(name, ts.budgeted(IMPROVEMENTS[item]), ground)], out_dir, atlas=1024, seed=SEEDS[item])
        print('STONE_BUILT', name, counts, flush=True)
    elif item == 'outpost':
        with_socket('outpost-stone', outpost, dict(rx=2.0, ry=1.85, square=None, power=3.0, mat='earth', n=32), out_dir, SEEDS[item], 'smoke', budgets=(7600, 1400, 280))
    elif item == 'warship':
        def run(ms, rng):
            warship(ms, rng)
            ts.on_ground(ms)
            for lod, b in zip((0, 1, 2), (11000, 2800, 380)):
                ts.trim(ms, lod, b)
            ts.on_ground(ms)
        counts = tt.build_file('warship-stone', [('warship-stone', run, None)], out_dir, atlas=1024, seed=SEEDS[item])
        print('STONE_BUILT warship-stone', counts, flush=True)
    elif item == 'landing':
        with_socket('landing-stone', landing, None, out_dir, SEEDS[item], 'socket-door', socket_at=(0, -0.86, 0), budgets=(7600, 1900, 380))


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    for it in (argv[1:] or list(IMPROVEMENTS) + ['outpost', 'warship', 'landing']):
        build(it, out)
    sys.stdout.flush()
    os._exit(0)
