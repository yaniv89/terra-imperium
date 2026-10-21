# scripts/blender/build_buildings_stone.py
# The Stone tier's building landmarks in the close view (U28's tier 0 of seven building lines; buildingModels.js
# BUILDING_MODEL_IDS): src/assets/map/buildings/<id>.glb, one root named after the id with LOD0..LOD2 children,
# materials Town and Team, the format of the other tiers' landmarks. Made from the Stone battle kit's parts
# (ti_stone.py, build_rts_stone.py) so a city's landmark and its battle building look alike:
#   storage_pits    the Storage Pit of the battle economy: a smokehouse, lidded pits, a raised granary
#   warrior_lodge   the Warrior Lodge: a great round lodge, spear and shield racks, drill posts
#   stone_circle    a ring of standing stones on a low bank, the tall gate pair, an altar stone and fire
#   tablet_house    a daub house under thatch where clay tokens and tablets dry on shelves (proto-writing)
#   canoe_landing   dugouts pulled up on the front (+z, the water side of a naval landmark), paddles, a
#                   fish rack, net poles, a hide shelter and a mooring post
#   trail_cairns    a trodden trail with cairns along it, a waymark pole, a rest lean-to and a pole stack
# Each stands on its own footprint (no Ground plate), 1 unit = 10 m, front to Blender -Y, within the landmark
# budget (15,000 / 3,000 / 500).
#   blender -b --factory-startup -P scripts/blender/build_buildings_stone.py -- <out_dir> [id,id...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_stone as ts  # noqa: E402
import build_rts_stone as rs  # noqa: E402
from ti_town import G  # noqa: E402

BUDGET = (14800, 2950, 490)


def stone_circle(ms, rng):
    n = 10
    for k in range(n):
        a = 2 * math.pi * k / n + math.pi / 2
        gate = k in (0, n - 1)
        ts.standing_stone(ms, 0.44 * math.cos(a), 0.44 * math.sin(a), h=0.3 if gate else rng.uniform(0.2, 0.26), w=0.085 if gate else 0.075,
                          yaw=math.degrees(a) + 90, lean=rng.uniform(-4, 4), bevel=0.006)
    pts = [(0.56 * math.cos(2 * math.pi * k / 24), 0.56 * math.sin(2 * math.pi * k / 24)) for k in range(25)]
    ts.earth_bank(ms, pts, w=0.08, h=0.035)
    ms.box('fieldstone', (0.16, 0.08, 0.05), at=(0, 0.08, G), lod=2, bevel=0.006)  # the altar stone
    ts.fire_pit(ms, rng, 0.0, -0.12, r=0.06, n=7)
    ts.totem(ms, 0.2, 0.2, h=0.5)
    for k in range(3):
        ts.pot(ms, -0.12 + 0.06 * k, 0.16, 1.1)


def tablet_house(ms, rng):
    f = ts.frame(0, 0.1, 0)
    ms.box('daub', (0.62, 0.42, 0.2), at=(0, 0, G), lod=2, frame=f, bevel=0.005)
    rs.hip_roof(ms, f, 0.62, 0.42, G + 0.2, 0.22, 'thatch_st', ov=0.05, hip=0.7, lod=2)
    ms.box('dark', (0.1, 0.02, 0.14), at=(0, -0.215, G), lod=1, frame=f)
    ms.box('ochre', (0.5, 0.004, 0.03), at=(0, -0.212, G + 0.15), lod=0, frame=f)  # a painted band over the door
    # the drying shelves before the house: two planks on posts, tablets and tokens laid out in rows
    for k, x in enumerate((-0.32, 0.2)):
        sf = ts.frame(x, -0.32, 0)
        for sx in (-1, 1):
            ms.cyl('pole', 0.008, 0.008, 0.09, at=(sx * 0.1, 0, G), segs=5, lod=1, frame=sf, caps=False)
        ms.box('pole', (0.24, 0.09, 0.012), at=(0, 0, G + 0.09), lod=2, frame=sf)
        for i in range(5):
            for j in range(2):
                ms.box('mud', (0.03, 0.024, 0.008), at=(-0.09 + 0.045 * i, -0.02 + 0.04 * j, G + 0.102), lod=0, frame=sf)
    ms.box('hide', (0.2, 0.14, 0.005), at=(-0.05, -0.55, G), rot_z=8, lod=1)  # the scribe's mat
    for k in range(6):  # clay tokens on the mat
        ms.sphere('mud', 0.008, at=(-0.1 + 0.02 * k, -0.55 + rng.uniform(-0.03, 0.03), G + 0.01), u=5, v=3, lod=0)
    ts.pot(ms, 0.08, -0.52, 1.3)
    ts.basket(ms, 0.32, 0.38, 1.2)
    ts.totem(ms, 0.4, 0.28, h=0.5)


def dugout(ms, x, y, yaw, L=0.55, W=0.075, H=0.05):
    f = ts.frame(x, y, yaw)
    ms.box('log', (L, W, H), at=(0, 0, G), lod=2, frame=f, taper=0.85)
    ms.box('dark', (L * 0.8, W * 0.6, 0.004), at=(0, 0, G + H - 0.002), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('log', (0.06, W * 0.7, H * 0.8), at=(sx * (L / 2 + 0.02), 0, G), lod=1, frame=f, taper=0.5)


def canoe_landing(ms, rng):
    ms.box('mud', (1.3, 0.34, 0.004), at=(0, -0.36, G), lod=2)  # the trodden landing on the front (water) side
    dugout(ms, -0.32, -0.42, 8)
    dugout(ms, 0.28, -0.38, -6, L=0.6)
    for k in range(3):  # paddles leaning on a log
        ms.box('pole', (0.012, 0.012, 0.2), at=(0.62 + 0.03 * k, -0.2, G), rot_z=20, lod=0)
    ms.cyl('log', 0.022, 0.022, 0.3, at=(0.55, -0.2, G + 0.022), rot=(0, 90, 0), segs=6, lod=1)
    ts.drying_rack(ms, -0.4, 0.12, 0, w=0.32, h=0.18, hang='hide', n=4)
    for sx in (-1, 1):  # net poles
        ms.cyl('pole', 0.008, 0.008, 0.22, at=(0.15 + sx * 0.12, 0.05, G), segs=5, lod=1)
    ms.box('wattle', (0.24, 0.006, 0.16), at=(0.15, 0.05, G + 0.04), lod=1)
    ts.hide_tent(ms, 0.4, 0.28, w=0.26, d=0.3, h=0.2, yaw=180)
    ts.totem(ms, -0.62, -0.24, h=0.5)  # the mooring post with the side's pennant
    ts.fire_pit(ms, rng, -0.05, 0.3, r=0.05, n=7)


def trail_cairns(ms, rng):
    ms.box('mud', (1.4, 0.16, 0.004), at=(0, 0, G), rot_z=8, lod=2)  # the trail
    for k, x in enumerate((-0.55, 0.0, 0.55)):
        y = 0.16 if k % 2 == 0 else -0.16
        ts.rock(ms, 'fieldstone', x, y, 0.07, rng, squash=0.8, lod=2)
        for j in range(5):
            a = 2 * math.pi * j / 5
            ts.rock(ms, 'fieldstone', x + 0.06 * math.cos(a), y + 0.06 * math.sin(a), 0.035, rng, lod=1)
        ts.rock(ms, 'chalk', x, y, 0.035, rng, z=G + 0.08, lod=1)
    ts.totem(ms, 0.25, 0.3, h=0.55)  # the waymark pole
    rs_lean = getattr(ts, 'lean_to', None)
    if rs_lean:
        rs_lean(ms, -0.3, 0.36, 180)
    else:
        ts.hide_tent(ms, -0.3, 0.36, w=0.24, d=0.28, h=0.18, yaw=180)
    ts.fire_pit(ms, rng, -0.3, 0.1, r=0.05, n=7)
    ts.pole_stack(ms, 0.45, -0.34, yaw=10, L=0.36, n=6)
    for k in range(2):
        ts.basket(ms, -0.1 + 0.06 * k, 0.34, 1.2)


LAYOUTS = {'storage_pits': rs.food_depot, 'warrior_lodge': rs.barracks, 'stone_circle': stone_circle,
           'tablet_house': tablet_house, 'canoe_landing': canoe_landing, 'trail_cairns': trail_cairns}


def _levels(p):
    _bm, _mat, maxlod, only = p
    return only if only is not None else tuple(i for i in (0, 1, 2) if i <= maxlod)


def trim(ms, lod, budget):
    shown = [p for p in ms.parts if lod in _levels(p)]
    total = sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in shown)
    if total <= budget:
        return
    ratio = (budget - 20) / total
    rest = []
    for p in ms.parts:
        bm, mat, maxlod, _only = p
        lv = _levels(p)
        if lod not in lv:
            rest.append(p)
            continue
        others = tuple(i for i in lv if i != lod)
        if others:
            rest.append((bm.copy(), mat, maxlod, others))
        me = bpy.data.meshes.new('_trim')
        bm.to_mesh(me)
        ob = bpy.data.objects.new('_trim', me)
        bpy.context.collection.objects.link(ob)
        mod = ob.modifiers.new('budget', 'DECIMATE')
        mod.ratio = max(0.02, ratio)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        reduced = bmesh.new()
        reduced.from_mesh(ev.to_mesh())
        ev.to_mesh_clear()
        rest.append((reduced, mat, maxlod, (lod,)))
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)
        bm.free()
    ms.parts[:] = rest


def landmark(layout):
    def run(ms, rng):
        layout(ms, rng)
        for lod, b in enumerate(BUDGET):
            trim(ms, lod, b)
        for bm, _m, _l, _o in ms.parts:  # nothing under the ground
            for v in bm.verts:
                if v.co.z < 0:
                    v.co.z = 0.0
    return run


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = os.path.abspath(argv[0])
    ids = argv[1].split(',') if len(argv) > 1 else list(LAYOUTS)
    os.makedirs(out_dir, exist_ok=True)
    for k, bid in enumerate(ids):
        print('BUILT', bid, tt.build_file(bid, [(bid, landmark(LAYOUTS[bid]), None)], out_dir, atlas=1024, seed=9300 + list(LAYOUTS).index(bid)), flush=True)
    sys.stdout.flush()
    os._exit(0)
