# scripts/blender/build_rts_bronze.py
# The Bronze battle buildings, src/assets/battle/rts/rts-bronze.glb (plans/ART-MODELS-PLAN.md
# section 5; src/assets/battle/rts/README.md): the 13 roles of a Bronze battle economy, each with a
# `<role>-damaged` sibling (drawn under 70% HP) and its sockets, built from the Bronze town kit
# (ti_town.py houses, jars and ladders; ti_bronze.py granaries, tents, stalls, the watch tower) so a
# battle's buildings match the towns on the map. One 2048 atlas for the file (Town, Team; no ground
# plate: the battlefield is the ground), LOD0..LOD2 per object.
#   blender -b --factory-startup -P scripts/blender/build_rts_bronze.py -- [out_dir] [atlas_px]
# Scale 1 unit = 10 m, the entrance faces Blender -Y, origin at the footprint centre on Z = 0. The
# game fits each object's footprint to the building's tiles, so the plan's metres set proportions.
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

WORLD = tm.house_frame(0, 0, 0)


# ---- small parts ------------------------------------------------------------------------------------

def beam(ms, mat, p0, p1, r=0.012, segs=6, lod=1):
    """A round timber from p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r, radius2=r * 0.9, depth=d.length)
    bmesh.ops.translate(bm, vec=(0, 0, d.length / 2), verts=bm.verts)
    m = Matrix.Translation(p0) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    ms.add(bm, mat, lod, m)


def flag_pole(ms, x, y, h, w=0.2, fh=0.12, yaw=-150):
    """A pole with a team pennant at its top (the socket-banner point)."""
    ms.cyl('timber', 0.014, 0.011, h, at=(x, y, G), segs=6, lod=2)
    tt.pennant(ms, WORLD, x, y, G + h - 0.005, yaw=yaw, lod=2, w=w, h=fh)
    return (x, y, G + h)


def sack(ms, x, y, s=1.0, z=G):
    ms.sphere('linen', 0.035 * s, at=(x, y, z + 0.028 * s), scale=(1, 0.9, 1.15), u=8, v=5, lod=0)


def spear_rack(ms, x, y, yaw=0.0, n=6):
    f = tm.house_frame(x, y, yaw)
    for sx in (-0.13, 0.13):
        ms.box('timber', (0.014, 0.05, 0.1), at=(sx, 0, G), lod=1, frame=f)
    ms.box('timber', (0.3, 0.014, 0.014), at=(0, 0, G + 0.1), lod=1, frame=f)
    for k in range(n):
        lx = -0.11 + 0.22 * k / (n - 1)
        top = f @ Vector((lx, 0.05, G + 0.3))
        bot = f @ Vector((lx, -0.03, G))
        beam(ms, 'timber', bot, top, r=0.005, segs=4, lod=0)
        beam(ms, 'bronze', top, top + (top - bot).normalized() * 0.03, r=0.008, segs=4, lod=0)


def target(ms, x, y):
    """An archery target: a reed bale on a timber trestle, a team-coloured centre."""
    f = tm.house_frame(x, y, 0)
    for sx in (-0.07, 0.07):
        beam(ms, 'timber', f @ Vector((sx, 0.06, G)), f @ Vector((sx, 0, G + 0.2)), r=0.009, lod=1)
    ms.cyl('reed', 0.09, 0.09, 0.05, at=(0, 0.01, G + 0.17), rot=(90, 0, 0), segs=10, lod=1, frame=f)
    ms.cyl('team_cloth', 0.035, 0.035, 0.006, at=(0, -0.042, G + 0.17), rot=(90, 0, 0), segs=8, lod=1, frame=f)


def stone_blocks(ms, x, y, rng, rows=3):
    for r in range(rows):
        for k in range(rows - r):
            ms.box('stone', (0.09, 0.07, 0.055), at=(x - 0.05 * (rows - r - 1) + 0.1 * k, y + rng.uniform(-0.01, 0.01), G + 0.055 * r), rot_z=rng.uniform(-6, 6), lod=2 if r == 0 else 0, bevel=0.004)


def trough(ms, x, y, yaw=0.0):
    f = tm.house_frame(x, y, yaw)
    ms.box('timber', (0.24, 0.08, 0.05), at=(0, 0, G), lod=1, frame=f, bevel=0.004)
    ms.box('shallows', (0.21, 0.055, 0.004), at=(0, 0, G + 0.044), lod=0, frame=f)


def low_wall(ms, pts, h=0.16, t=0.04, wall='mudwall', lod=2):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        ms.box(wall, (length + t, t, h), at=((x0 + x1) / 2, (y0 + y1) / 2, G), rot_z=math.degrees(math.atan2(y1 - y0, x1 - x0)), lod=lod, bevel=0.004)


def shed_roof(ms, x, y, w, d, h_front, h_back, mat='thatch', lod=2):
    """A lean-to roof on posts: a sloping slab, front lower than back."""
    for sx in (-w / 2 + 0.02, 0, w / 2 - 0.02):
        ms.box('timber', (0.022, 0.022, h_front), at=(x + sx, y - d / 2 + 0.02, G), lod=1)
        ms.box('timber', (0.022, 0.022, h_back), at=(x + sx, y + d / 2 - 0.02, G), lod=1)
    slope = math.degrees(math.atan2(h_back - h_front, d))
    f = Matrix.Translation(Vector((x, y, G + (h_front + h_back) / 2 + 0.012))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(mat, (w + 0.08, d / math.cos(math.radians(slope)) + 0.08, 0.03), at=(0, 0, 0), lod=lod, frame=f)


# ---- the roles ------------------------------------------------------------------------------------
# Each returns its sockets: {name: (x, y, z)} (z from the ground before the G shift).

def expedition_camp(ms, rng):
    """22 x 22 m: a ring of linen tents round a command tent, a standard, a fire, stacked supplies,
    a half-built stake palisade at the back."""
    tb.tent(ms, 0, 0.3, w=0.5, d=0.66, h=0.4)
    tt.front_shade(ms, WORLD, 0, -0.03, 0.42, depth=0.2, z=0.28, mat='team_cloth')
    for x, y in [(-0.72, 0.55), (0.72, 0.55), (-0.86, -0.08), (0.86, -0.08), (-0.6, -0.7), (0.6, -0.7)]:
        tb.tent(ms, x, y, yaw=tm.facing_centre(x, y))
    tb.fire_ring(ms, rng, 0, -0.42)
    for k in range(6):
        tt.jar(ms, WORLD, -0.3 + rng.uniform(-0.06, 0.06), -0.84 + rng.uniform(-0.05, 0.05), rng.uniform(1.2, 1.6))
    tt.crate(ms, WORLD, -0.16, -0.9, 1.4, 10)
    tt.crate(ms, WORLD, -0.1, -0.8, 1.2, -15)
    for k in range(4):
        sack(ms, 0.24 + 0.06 * k, -0.86 + 0.02 * (k % 2), 1.1)
    tb.log_bundle(ms, 0.36, 0.95, 90, length=0.42)
    back = [(-1.0 + 0.07 * i, 1.04 + rng.uniform(-0.01, 0.01)) for i in range(29) if not 12 <= i <= 16]
    tb.stakes(ms, rng, back, h=(0.24, 0.36))
    top = flag_pole(ms, -0.28, -0.42, 0.78, w=0.26, fh=0.16)
    return {'socket-door': (0, -0.2, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (-0.2, -0.95, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.3, 0.3), 'socket-fire-2': (-0.72, 0.55, 0.18), 'socket-fire-3': (0.72, 0.55, 0.18), 'socket-fire-4': (0.6, -0.7, 0.18), 'socket-smoke-1': (0, -0.42, 0.1)}


def town_hall(ms, rng):
    """20 x 20 m: the keep, a two-storey mud-brick hall behind a walled court with a pylon gate,
    a corner watch tower, banners and a well."""
    tt.house(ms, rng, 0, 0.32, 1.05, 0.7, storeys=2, yaw=0, upper=(0.18, 0.08), front='team', jars=3, roof_items=(('vent', -0.3, 0.1),))
    tb.watch_tower(ms, 0.72, 0.62, h=1.05, w=0.34)
    court = [(-0.25, -0.86), (-0.95, -0.86), (-0.95, 0.9), (0.95, 0.9), (0.95, -0.86), (0.25, -0.86)]
    low_wall(ms, court, h=0.2, t=0.05)
    for sx in (-1, 1):
        ms.box('pylon', (0.16, 0.14, 0.38), at=(sx * 0.25, -0.86, G), lod=2, bevel=0.006, taper=0.9)
        tb.banner(ms, WORLD, sx * 0.25, -0.93, G + 0.36, w=0.08, h=0.2)
    tt.well(ms, -0.55, -0.4)
    tt.clutter(ms, WORLD, 0.55, -0.55, rng, 5)
    top = flag_pole(ms, -0.7, 0.62, 1.05, w=0.24, fh=0.15)
    return {'socket-door': (0, -0.95, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (0.3, -0.98, 0), 'socket-banner': top,
            'socket-fire-1': (-0.3, 0.32, 0.45), 'socket-fire-2': (0.25, 0.4, 0.82), 'socket-fire-3': (0.72, 0.62, 1.1), 'socket-fire-4': (-0.55, -0.6, 0.2), 'socket-smoke-1': (0, 0.32, 0.9)}


def food_depot(ms, rng):
    """10 x 10 m: three domed granaries on a platform, jars, baskets and sacks, a measuring stall."""
    tb.granaries(ms, 0, 0.18, n=3, r=0.13, h=0.36, yaw=0)
    tb.stall(ms, 0.2, -0.3, rng, yaw=0, w=0.28, d=0.18)
    tt.clutter(ms, WORLD, -0.28, -0.3, rng, 5)
    for k in range(3):
        sack(ms, -0.05 + 0.05 * k, -0.42, 1.0)
    return {'socket-door': (0, -0.48, 0), 'socket-rally': (0, -0.8, 0), 'socket-drop': (-0.1, -0.45, 0),
            'socket-fire-1': (-0.28, 0.18, 0.4), 'socket-fire-2': (0, 0.18, 0.4), 'socket-fire-3': (0.28, 0.18, 0.4), 'socket-fire-4': (0.2, -0.3, 0.2), 'socket-smoke-1': (0, 0.18, 0.5)}


def materials_yard(ms, rng):
    """10 x 10 m: a fenced open yard with stacked logs, cut stone blocks and sheerlegs lifting a block."""
    tb.rail_fence(ms, [(-0.1, -0.48), (-0.48, -0.48), (-0.48, 0.48), (0.48, 0.48), (0.48, -0.48), (0.1, -0.48)], h=0.1, step=0.16)
    ms.box('log', (0.13, 0.46, 0.05), at=(-0.24, 0.0, G), lod=2)  # the timber stack's base, kept at every LOD
    tb.log_bundle(ms, -0.24, 0.16, 0, length=0.44)
    tb.log_bundle(ms, -0.24, -0.16, 0, length=0.36)
    stone_blocks(ms, 0.2, 0.25, rng)
    for p in [(0.12, -0.2), (0.32, -0.2), (0.22, 0.02)]:
        beam(ms, 'timber', (p[0], p[1], G), (0.22, -0.13, G + 0.46), r=0.012)
    beam(ms, 'reed', (0.22, -0.13, G + 0.46), (0.22, -0.13, G + 0.2), r=0.004, segs=4, lod=0)
    ms.box('stone', (0.08, 0.07, 0.06), at=(0.22, -0.13, G + 0.14), lod=0, bevel=0.004)
    for k in range(3):
        tt.basket(ms, WORLD, -0.02 + 0.05 * k, -0.36, 1.1)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -0.85, 0), 'socket-drop': (0, -0.4, 0),
            'socket-fire-1': (-0.24, 0.16, 0.12), 'socket-fire-2': (-0.24, -0.16, 0.12), 'socket-fire-3': (0.22, -0.13, 0.4), 'socket-fire-4': (0.2, 0.25, 0.15), 'socket-smoke-1': (-0.24, 0, 0.2)}


def trade_post(ms, rng):
    """14 x 14 m: market stalls with team awnings round a balance scale, a storehouse behind."""
    tt.house(ms, rng, 0, 0.45, 0.8, 0.36, yaw=0, front='shade', jars=2)
    for x, y in [(-0.46, -0.1), (0.46, -0.1), (-0.3, -0.5)]:
        tb.stall(ms, x, y, rng)
    f = tm.house_frame(0.15, -0.35, 0)  # the balance: a post, a beam, two pans
    ms.box('timber', (0.016, 0.016, 0.16), at=(0, 0, G), lod=1, frame=f)
    ms.box('timber', (0.2, 0.012, 0.012), at=(0, 0, G + 0.16), lod=0, frame=f)
    for sx in (-0.09, 0.09):
        ms.cyl('bronze', 0.03, 0.035, 0.012, at=(sx, 0, G + 0.09), segs=8, lod=0, frame=f)
    tt.clutter(ms, WORLD, 0.45, -0.5, rng, 4)
    top = flag_pole(ms, -0.6, 0.45, 0.66)
    return {'socket-door': (0, -0.68, 0), 'socket-rally': (0, -1.0, 0), 'socket-drop': (0.15, -0.55, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.45, 0.45), 'socket-fire-2': (-0.46, -0.1, 0.25), 'socket-fire-3': (0.46, -0.1, 0.25), 'socket-fire-4': (-0.3, -0.5, 0.25), 'socket-smoke-1': (0, 0.45, 0.5)}


def farm_plot(ms, rng):
    """14 x 14 m: four beds of ripe barley in a split-rail fence with a gate, a reed shade and jars."""
    tb.rail_fence(ms, [(-0.12, -0.68), (-0.68, -0.68), (-0.68, 0.68), (0.68, 0.68), (0.68, -0.68), (0.12, -0.68)], h=0.1, step=0.2)
    for i, x in enumerate((-0.47, -0.16, 0.16, 0.47)):
        tb.crop_bed(ms, 'barley', x, 0.04, 0.24, 1.1, rng.uniform(0.07, 0.085), rng)
    tt.pergola(ms, WORLD, 0.5, -0.56, G, 0.2, 0.14, mat='reed', post_h=0.12)
    tt.jar(ms, WORLD, 0.45, -0.58, 1.1)
    tt.basket(ms, WORLD, 0.53, -0.55, 1.1)
    return {'socket-door': (0, -0.7, 0), 'socket-rally': (0, -0.95, 0), 'socket-drop': (0, -0.6, 0),
            'socket-fire-1': (-0.47, 0.3, 0.08), 'socket-fire-2': (0.16, -0.3, 0.08), 'socket-fire-3': (0.47, 0.4, 0.08), 'socket-fire-4': (-0.16, -0.2, 0.08), 'socket-smoke-1': (0, 0, 0.1)}


def mine(ms, rng):
    """12 x 12 m: an adit in a rock face with a timber frame, a spoil heap, ore baskets, a copper
    smelting hearth and a reed shade."""
    ms.sphere('stone', 0.42, at=(0, 0.26, G - 0.02), scale=(1.35, 1.0, 1.15), u=7, v=4, cut_below=0.0, lod=2)  # a faceted rock face
    ms.sphere('stone', 0.2, at=(-0.36, 0.38, G - 0.02), scale=(1.2, 1.0, 1.2), u=6, v=4, cut_below=0.0, lod=1)
    ms.sphere('stone', 0.16, at=(0.36, 0.42, G - 0.02), scale=(1.1, 1.2, 1.0), u=6, v=4, cut_below=0.0, lod=1)
    for k in range(5):  # loose boulders
        ms.sphere('stone', rng.uniform(0.025, 0.045), at=(rng.uniform(-0.5, 0.5), rng.uniform(-0.05, 0.1), G), scale=(1.2, 1, 0.8), u=6, v=4, lod=0)
    f = tm.house_frame(0, -0.13, 0)
    for sx in (-0.09, 0.09):
        ms.box('timber', (0.03, 0.03, 0.24), at=(sx, 0, G), lod=1, frame=f)
    ms.box('timber', (0.26, 0.04, 0.035), at=(0, 0, G + 0.24), lod=1, frame=f)
    ms.box('dark', (0.15, 0.02, 0.22), at=(0, 0.012, G), lod=1, frame=f)
    ms.sphere('mud', 0.16, at=(0.36, -0.3, G - 0.01), scale=(1.3, 1.0, 0.55), u=8, v=5, cut_below=0.0, lod=2)
    for k in range(4):
        tt.basket(ms, WORLD, -0.22 + 0.06 * k, -0.34 + 0.02 * (k % 2), 1.2)
        ms.sphere('stone', 0.018, at=(-0.22 + 0.06 * k, -0.34 + 0.02 * (k % 2), G + 0.045), scale=(1, 1, 0.8), u=6, v=4, lod=0)
    ms.cyl('pylon', 0.07, 0.055, 0.13, at=(-0.36, -0.12, G), segs=10, lod=1)
    ms.cyl('ash', 0.045, 0.045, 0.005, at=(-0.36, -0.12, G + 0.13), segs=10, lod=0)
    tt.pergola(ms, WORLD, -0.36, -0.12, G, 0.22, 0.2, mat='reed', post_h=0.2)
    tt.ladder(ms, WORLD, 0.25, 0.05, 0.3, yaw=0, lean=24)
    return {'socket-door': (0, -0.2, 0), 'socket-rally': (0, -0.75, 0), 'socket-drop': (-0.1, -0.3, 0),
            'socket-fire-1': (-0.36, -0.12, 0.15), 'socket-fire-2': (0, -0.15, 0.26), 'socket-fire-3': (0.36, -0.3, 0.08), 'socket-fire-4': (-0.2, -0.34, 0.05), 'socket-smoke-1': (-0.36, -0.12, 0.3)}


def barracks(ms, rng):
    """16 x 12 m: a long mud-brick hall with a team awning, spear racks and drill posts in front."""
    tt.house(ms, rng, 0, 0.22, 1.35, 0.56, yaw=0, front='team', jars=3, roof_items=(('mat', 0.3, 0.05), ('vent', -0.4, 0.05)))
    spear_rack(ms, -0.45, -0.3)
    spear_rack(ms, 0.45, -0.3)
    for k in range(3):
        ms.cyl('timber', 0.022, 0.02, 0.2, at=(-0.2 + 0.2 * k, -0.48, G), segs=6, lod=1)
    top = flag_pole(ms, 0.74, -0.5, 0.75)
    return {'socket-door': (0, -0.15, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.4, 0.22, 0.47), 'socket-fire-2': (0.1, 0.22, 0.47), 'socket-fire-3': (0.5, 0.22, 0.47), 'socket-fire-4': (-0.45, -0.3, 0.1), 'socket-smoke-1': (0, 0.22, 0.6)}


def shooting_range(ms, rng):
    """16 x 12 m: a yard with three reed targets on trestles, a mud-brick back wall, a reed-roofed
    shed with quivers and a shooting line of logs."""
    low_wall(ms, [(-0.8, 0.58), (0.8, 0.58)], h=0.22, t=0.05)
    for x in (-0.05, 0.3, 0.65):
        target(ms, x, 0.42)
    tb.hut(ms, -0.5, 0.28, w=0.5, d=0.32, wall_h=0.2, top=0.36)
    beam(ms, 'timber', (-0.25, -0.42, G + 0.018), (0.55, -0.42, G + 0.018), r=0.018, lod=1)  # the shooting line
    f = tm.house_frame(-0.5, -0.1, 0)  # a quiver rack
    ms.box('timber', (0.2, 0.03, 0.12), at=(0, 0, G), lod=1, frame=f)
    for k in range(3):
        ms.cyl('timber', 0.018, 0.022, 0.14, at=(-0.06 + 0.06 * k, 0, G + 0.04), rot=(12, 0, 0), segs=6, lod=0, frame=f)
    top = flag_pole(ms, 0.76, -0.45, 0.6)
    return {'socket-door': (0, -0.55, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.5, 0.28, 0.3), 'socket-fire-2': (0.3, 0.42, 0.2), 'socket-fire-3': (-0.05, 0.42, 0.2), 'socket-fire-4': (0.65, 0.42, 0.2), 'socket-smoke-1': (-0.5, 0.28, 0.45)}


def stable(ms, rng):
    """20 x 16 m: a long thatched shed open at the front with a reed back wall, a fenced paddock,
    water troughs and hay."""
    shed_roof(ms, 0, 0.45, 1.6, 0.5, 0.36, 0.48)
    ms.box('reed', (1.6, 0.03, 0.42), at=(0, 0.7, G), lod=2)
    for sx in (-1, 1):
        ms.box('reed', (0.03, 0.5, 0.36), at=(sx * 0.8, 0.45, G), lod=2)
    for k in range(4):  # stall partitions
        ms.box('timber', (0.02, 0.36, 0.16), at=(-0.6 + 0.4 * k, 0.48, G), lod=1)
    tb.rail_fence(ms, [(-0.15, -0.78), (-0.95, -0.78), (-0.95, 0.15), (-0.82, 0.15)], h=0.12, step=0.22)
    tb.rail_fence(ms, [(0.82, 0.15), (0.95, 0.15), (0.95, -0.78), (0.15, -0.78)], h=0.12, step=0.22)
    trough(ms, -0.5, -0.1)
    trough(ms, 0.45, 0.05, 90)
    for x, y in [(0.55, -0.45), (0.68, -0.38), (-0.6, -0.55)]:
        ms.sphere('reed', 0.07, at=(x, y, G), scale=(1.2, 1, 0.8), u=8, v=5, cut_below=0.0, lod=1)
    top = flag_pole(ms, -0.88, -0.7, 0.62)
    return {'socket-door': (0, -0.8, 0), 'socket-rally': (0, -1.2, 0), 'socket-banner': top,
            'socket-fire-1': (-0.5, 0.45, 0.45), 'socket-fire-2': (0.5, 0.45, 0.45), 'socket-fire-3': (0, 0.45, 0.45), 'socket-fire-4': (0.6, -0.42, 0.08), 'socket-smoke-1': (0, 0.45, 0.6)}


def siege_workshop(ms, rng):
    """20 x 16 m: a tall timber gantry with a lifting boom, a ram half built on trestles with its
    solid wheels, a workbench, log piles and a reed-roofed store."""
    for sx in (-0.55, 0.55):
        for sy in (-0.25, 0.35):
            ms.box('timber', (0.045, 0.045, 1.05), at=(sx, sy, G), lod=2)
        ms.box('timber', (0.05, 0.66, 0.05), at=(sx, 0.05, G + 1.02), lod=2)
    for sy in (-0.25, 0.35):
        ms.box('timber', (1.16, 0.05, 0.05), at=(0, sy, G + 1.02), lod=2)
    beam(ms, 'timber', (-0.55, -0.25, G + 0.5), (-0.55, 0.35, G + 1.0), r=0.014)
    beam(ms, 'timber', (0.55, -0.25, G + 0.5), (0.55, 0.35, G + 1.0), r=0.014)
    beam(ms, 'reed', (0.05, 0.05, G + 1.02), (0.05, 0.05, G + 0.5), r=0.005, segs=4, lod=0)
    beam(ms, 'timber', (-0.5, 0.05, G + 0.2), (0.6, 0.05, G + 0.2), r=0.055, segs=10, lod=2)  # the ram beam
    ms.cyl('bronze', 0.06, 0.06, 0.06, at=(-0.52, 0.05, G + 0.2), rot=(0, 90, 0), segs=10, lod=1)
    for sx in (-0.3, 0.35):
        ms.box('timber', (0.04, 0.18, 0.16), at=(sx, 0.05, G), lod=1)
    for sx, sy in [(-0.2, -0.45), (0.15, -0.45)]:
        ms.cyl('timber', 0.1, 0.1, 0.035, at=(sx, sy, G), segs=12, lod=1)
    ms.box('timber', (0.3, 0.12, 0.09), at=(0.6, -0.5, G), lod=1, bevel=0.004)
    tb.log_bundle(ms, -0.75, -0.45, 90, length=0.36)
    tb.hut(ms, 0.6, 0.62, w=0.55, d=0.3, wall_h=0.2, top=0.36)
    top = flag_pole(ms, -0.86, 0.6, 0.7)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -1.1, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.05, 1.05), 'socket-fire-2': (0.6, 0.62, 0.35), 'socket-fire-3': (-0.75, -0.45, 0.12), 'socket-fire-4': (0.2, 0.05, 0.25), 'socket-smoke-1': (0, 0.05, 1.1)}


def aid_post(ms, rng):
    """12 x 12 m: a linen tent with a team pennant, stretchers, water jars and a basin."""
    tb.tent(ms, 0, 0.18, w=0.5, d=0.62, h=0.36)
    tt.front_shade(ms, WORLD, 0, -0.13, 0.36, depth=0.18, z=0.24, mat='team_cloth')
    for x in (-0.36, 0.36):
        f = tm.house_frame(x, -0.25, 90)
        for sy in (-0.06, 0.06):
            ms.box('timber', (0.36, 0.014, 0.014), at=(0, sy, G + 0.05), lod=0, frame=f)
        ms.box('linen', (0.28, 0.11, 0.008), at=(0, 0, G + 0.052), lod=1, frame=f)
        for sx in (-0.12, 0.12):
            for sy in (-0.06, 0.06):
                ms.box('timber', (0.012, 0.012, 0.05), at=(sx, sy, G), lod=0, frame=f)
    for k in range(4):
        tt.jar(ms, WORLD, 0.32 + 0.05 * (k % 2), 0.32 + 0.05 * (k // 2), 1.3)
    ms.cyl('pylon', 0.06, 0.05, 0.05, at=(-0.32, 0.36, G), segs=10, lod=1)
    ms.cyl('water', 0.048, 0.048, 0.004, at=(-0.32, 0.36, G + 0.05), segs=10, lod=0)
    top = flag_pole(ms, 0.3, -0.5, 0.6)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.8, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.18, 0.3), 'socket-fire-2': (-0.36, -0.25, 0.06), 'socket-fire-3': (0.36, -0.25, 0.06), 'socket-fire-4': (0.35, 0.35, 0.1), 'socket-smoke-1': (0, 0.18, 0.4)}


def tower(ms, rng):
    """8 x 8 m, 14 m: a battered mud-brick watch tower with slits, merlons, a reed-roofed look-out
    and a team pennant."""
    tb.watch_tower(ms, 0, 0, h=1.1, w=0.62)
    top = flag_pole(ms, 0.2, 0.2, 1.48, w=0.16, fh=0.1)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.65, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0, 1.15), 'socket-fire-2': (-0.15, -0.2, 0.6), 'socket-fire-3': (0.15, 0.2, 0.9), 'socket-fire-4': (0, -0.24, 0.3), 'socket-smoke-1': (0, 0, 1.3)}


# ---- construction stages ----------------------------------------------------------------------------
# `construction-stage-0` .. `-3` (src/assets/battle/rts/README.md): one square footprint (10 x 10 m
# here; the game fits it to the building going up), drawn by build progress 0-24, 25-49, 50-74 and
# 75-100%. A mud-brick house rising inside a pole scaffold, as the towns' houses are built.

HALF = 0.42  # half the wall square; stakes and stacks reach out to about 0.5


def _string_line(ms, p0, p1):
    beam(ms, 'linen', (p0[0], p0[1], G + 0.05), (p1[0], p1[1], G + 0.05), r=0.0025, segs=3, lod=0)


def _brick_stack(ms, x, y, rng, layers=4, yaw=0.0):
    f = tm.house_frame(x, y, yaw)
    for k in range(layers):
        ms.box('mudwall_bare', (0.15, 0.1, 0.022), at=(0, 0, G + 0.022 * k), rot_z=rng.uniform(-4, 4), lod=0, frame=f)
    ms.parts.append(_solid_stack(f, layers))


def _solid_stack(f, layers):
    """The stack as one block for LOD1 and LOD2."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=(0.15, 0.1, 0.022 * layers), verts=bm.verts)
    bmesh.ops.transform(bm, matrix=f @ Matrix.Translation(Vector((0, 0, G))), verts=bm.verts)
    return (bm, 'mudwall_bare', 2, (1, 2))


def _mud_pit(ms, x, y):
    ms.cyl('mud', 0.11, 0.1, 0.012, at=(x, y, G - 0.004), segs=10, lod=1)
    beam(ms, 'timber', (x + 0.02, y, G + 0.004), (x + 0.16, y + 0.02, G + 0.03), r=0.006, segs=4, lod=0)


def _walls(ms, h, door=True, lod=2):
    """The four mud-brick walls of the rising house, `h` high, a door gap at the front."""
    t = 0.05
    if door:
        for sx in (-1, 1):
            ms.box('mudwall', (HALF - 0.08, t, h), at=(sx * (HALF + 0.08) / 2, -HALF + t / 2, G), lod=lod, bevel=0.003)
    else:
        ms.box('mudwall', (2 * HALF, t, h), at=(0, -HALF + t / 2, G), lod=lod, bevel=0.003)
    ms.box('mudwall', (2 * HALF, t, h), at=(0, HALF - t / 2, G), lod=lod, bevel=0.003)
    for sx in (-1, 1):
        ms.box('mudwall', (t, 2 * HALF - 2 * t, h), at=(sx * (HALF - t / 2), 0, G), lod=lod, bevel=0.003)


def _scaffold(ms, h, rng, decks=1):
    """Poles at the corners and mid-sides, lashed ledgers, and reed-mat decks at `decks` levels."""
    out = HALF + 0.07
    posts = [(sx * out, sy * out) for sx in (-1, 1) for sy in (-1, 1)] + [(0, out), (out, 0), (-out, 0)]
    for x, y in posts:
        lean = rng.uniform(-2.5, 2.5)
        beam(ms, 'timber', (x, y, G), (x + lean * 0.002, y, G + h), r=0.01, segs=5, lod=1)
    for k in range(1, decks + 1):
        z = G + h * k / (decks + 0.6)
        for sy in (-1, 1):
            beam(ms, 'timber', (-out, sy * out, z), (out, sy * out, z), r=0.007, segs=4, lod=1)
        for sx in (-1, 1):
            beam(ms, 'timber', (sx * out, -out, z), (sx * out, out, z), r=0.007, segs=4, lod=1)
        ms.box('reed', (2 * out, 0.07, 0.008), at=(0, out - 0.035, z + 0.007), lod=1)
        ms.box('reed', (0.07, 2 * out - 0.14, 0.008), at=(out - 0.035, 0, z + 0.007), lod=0)


def construction_stage_0(ms, rng):
    """Foundation: corner stakes and string lines, a dug footing trench, a mud pit, brick stacks."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('timber', 0.008, 0.006, 0.07, at=(sx * HALF, sy * HALF, G - 0.005), segs=5, lod=1)
    corners = [(-HALF, -HALF), (HALF, -HALF), (HALF, HALF), (-HALF, HALF), (-HALF, -HALF)]
    for a, b in zip(corners, corners[1:]):
        _string_line(ms, a, b)
    t = 0.06
    for sy in (-1, 1):
        ms.box('mud', (2 * HALF, t, 0.012), at=(0, sy * (HALF - t / 2), G - 0.006), lod=2)
    for sx in (-1, 1):
        ms.box('mud', (t, 2 * HALF - 2 * t, 0.012), at=(sx * (HALF - t / 2), 0, G - 0.006), lod=2)
    for sy in (-1, 1):  # the first course of stones in the trench
        for k in range(7):
            ms.box('stone', (0.1, 0.05, 0.03), at=(-HALF + 0.07 + 0.12 * k, sy * (HALF - t / 2), G), rot_z=rng.uniform(-6, 6), lod=0, bevel=0.003)
    _mud_pit(ms, 0.1, 0.05)
    _brick_stack(ms, -0.2, -0.15, rng, 4)
    _brick_stack(ms, 0.25, -0.22, rng, 3, 20)
    tt.basket(ms, WORLD, -0.05, -0.25, 1.2)
    tt.jar(ms, WORLD, 0.32, 0.2, 1.2)


def construction_stage_1(ms, rng):
    """33%: knee-high walls, the door frame up, bricks drying in rows, the mud pit."""
    _walls(ms, 0.12)
    for sx in (-1, 1):
        ms.box('timber', (0.025, 0.04, 0.26), at=(sx * 0.07, -HALF + 0.025, G), lod=1)
    ms.box('timber', (0.2, 0.04, 0.025), at=(0, -HALF + 0.025, G + 0.26), lod=1)
    for r in range(3):  # bricks drying flat inside
        for k in range(4):
            ms.box('mudwall_bare', (0.06, 0.04, 0.015), at=(-0.2 + 0.08 * k, 0.1 + 0.07 * r, G), lod=0)
    _brick_stack(ms, 0.2, -0.05, rng, 4)
    _mud_pit(ms, -0.2, -0.15)
    tt.ladder(ms, WORLD, HALF + 0.05, 0.1, 0.18, yaw=90, lean=18)
    tt.basket(ms, WORLD, -0.3, 0.3, 1.2)


def construction_stage_2(ms, rng):
    """66%: walls at full height inside a pole scaffold with one reed-mat deck and a ladder."""
    h = 0.34
    _walls(ms, h)
    ms.box('timber', (0.2, 0.05, 0.03), at=(0, -HALF + 0.025, G + 0.27), lod=1)
    _scaffold(ms, h + 0.1, rng, decks=1)
    tt.ladder(ms, WORLD, -0.2, -HALF - 0.14, h * 0.8, yaw=0, lean=16)
    _brick_stack(ms, 0.28, -0.6, rng, 4)
    _mud_pit(ms, -0.4, -0.62)
    tt.basket(ms, WORLD, 0.05, -0.62, 1.2)


def construction_stage_3(ms, rng):
    """Near complete: full walls, roof beams laid across with half the reed-and-mud roof on, the
    scaffold with two decks, a parapet begun."""
    h = 0.42
    _walls(ms, h)
    ms.box('timber', (0.2, 0.05, 0.03), at=(0, -HALF + 0.025, G + 0.27), lod=1)
    ms.box('door', (0.13, 0.01, 0.24), at=(0, -HALF - 0.002, G), lod=1)
    for k in range(9):  # roof beams, ends poking out of the front wall
        x = -HALF + 0.05 + (2 * HALF - 0.1) * k / 8
        beam(ms, 'timber', (x, -HALF - 0.03, G + h - 0.02), (x, HALF + 0.03, G + h - 0.02), r=0.012, segs=5, lod=1 if k % 2 == 0 else 0)
    ms.box('reed', (2 * HALF - 0.04, HALF, 0.012), at=(0, HALF / 2 - 0.02, G + h - 0.008), lod=2)
    ms.box('roof', (2 * HALF - 0.04, HALF * 0.7, 0.02), at=(0, HALF * 0.62, G + h + 0.004), lod=1)
    ms.box('mudwall', (2 * HALF, 0.05, 0.05), at=(0, HALF - 0.025, G + h), lod=1)
    _scaffold(ms, h + 0.12, rng, decks=2)
    tt.ladder(ms, WORLD, 0.25, -HALF - 0.14, h, yaw=0, lean=16)
    _brick_stack(ms, -0.32, -0.62, rng, 3)
    tt.jar(ms, WORLD, 0.42, -0.6, 1.2)


STAGES = [('construction-stage-0', construction_stage_0), ('construction-stage-1', construction_stage_1),
          ('construction-stage-2', construction_stage_2), ('construction-stage-3', construction_stage_3)]


ROLES = [('expedition-camp', expedition_camp), ('town-hall', town_hall), ('food-depot', food_depot), ('materials-yard', materials_yard),
         ('trade-post', trade_post), ('farm-plot', farm_plot), ('mine', mine), ('barracks', barracks), ('range', shooting_range),
         ('stable', stable), ('siege-workshop', siege_workshop), ('aid-post', aid_post), ('tower', tower)]


# ---- damage, grounding, sockets ------------------------------------------------------------------

def _bounds(bm):
    xs = [v.co.x for v in bm.verts]; ys = [v.co.y for v in bm.verts]; zs = [v.co.z for v in bm.verts]
    return (min(xs), min(ys), min(zs)), (max(xs), max(ys), max(zs))


def damaged(layout):
    """The `-damaged` state (30 to 70% HP): the same building with a part of its upper works and
    cloth fallen (dropped at random), rubble heaps of its own wall material, scorched patches and
    fallen beams. Same origin and footprint."""
    def build(ms, rng):
        sockets = layout(ms, rng)
        parts = [p for p in ms.parts]
        boxes = [_bounds(p[0]) for p in parts]
        ztop = max(b[1][2] for b in boxes)
        lo = (min(b[0][0] for b in boxes), min(b[0][1] for b in boxes))
        hi = (max(b[1][0] for b in boxes), max(b[1][1] for b in boxes))
        keep = []
        for (bm, mat, lod, only), ((x0, y0, z0), (x1, y1, z1)) in zip(parts, boxes):
            size = max(x1 - x0, y1 - y0, z1 - z0)
            drop = 0.0
            if mat == 'team_cloth':
                drop = 0.55
            elif z0 > 0.45 * ztop and size < 0.6:
                drop = 0.42
            elif size < 0.06:
                drop = 0.22
            if rng.random() < drop:
                bm.free()
            else:
                keep.append((bm, mat, lod, only))
        ms.parts[:] = keep
        walls = [m for _, m, _, _ in keep if m in ('mudwall', 'pylon', 'stone', 'reed', 'linen')] or ['mudwall']
        cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
        w, d = hi[0] - lo[0], hi[1] - lo[1]
        for k in range(10):  # rubble
            x, y = cx + rng.uniform(-0.42, 0.42) * w, cy + rng.uniform(-0.42, 0.42) * d
            r = rng.uniform(0.06, 0.11) * max(0.6, min(w, d))
            ms.sphere(rng.choice(walls), r, at=(x, y, G - 0.005), scale=(1.3, 1.0, 0.6), u=7, v=4, cut_below=0.0, lod=1 if k < 4 else 0)
        for k in range(4):  # scorched ground and ash
            x, y = cx + rng.uniform(-0.4, 0.4) * w, cy + rng.uniform(-0.4, 0.4) * d
            ms.cyl('ash', rng.uniform(0.1, 0.2), rng.uniform(0.09, 0.17), 0.006, at=(x, y, G), segs=9, lod=1)
        for k in range(3):  # fallen charred beams
            x, y = cx + rng.uniform(-0.35, 0.35) * w, cy + rng.uniform(-0.35, 0.35) * d
            a = rng.uniform(0, math.pi)
            L = rng.uniform(0.18, 0.32)
            beam(ms, 'ash' if k else 'timber', (x - math.cos(a) * L / 2, y - math.sin(a) * L / 2, G + 0.012), (x + math.cos(a) * L / 2, y + math.sin(a) * L / 2, G + 0.03), r=0.013, lod=0)
        _breach(ms, layout.__doc__ or '')
        return sockets
    return build


def _breach(ms, key):
    """What makes the damaged state read at a glance (manifest row MD13): one corner of the main
    body has collapsed (every part is cut by one sloping plane through that corner, the cuts closed
    in ash), the walls and roofs are blotched with soot, and the fallen corner lies as heaps on a
    scorch mark. Run last, on its own random stream (seeded from the layout's description), so the
    shared stream, and with it every other object of the file, stays as it was."""
    import zlib
    rng = tm.seeded(zlib.crc32(('breach:' + key).encode()))
    parts = [p for p in ms.parts if len(p[0].verts)]
    boxes = [_bounds(p[0]) for p in parts]
    hard = [(b, p) for b, p in zip(boxes, parts) if tt.TO_FINAL.get(p[1]) is None]
    if not hard:
        return
    lo = [min(b[0][k] for b in boxes) for k in range(3)]
    hi = [max(b[1][k] for b in boxes) for k in range(3)]
    (m0, m1), _main = max(hard, key=lambda bp: (bp[0][1][0] - bp[0][0][0]) * (bp[0][1][1] - bp[0][0][1]) * (bp[0][1][2] - bp[0][0][2]))
    if (m1[0] - m0[0]) * (m1[1] - m0[1]) < 0.2 * (hi[0] - lo[0]) * (hi[1] - lo[1]):
        m0, m1 = lo, hi  # no main body (a yard, a camp, a field): a corner of the whole plot
    ux, uy, uh = m1[0] - m0[0], m1[1] - m0[1], m1[2] - G
    sx = rng.choice((-1, 1))
    sy = -1 if rng.random() < 0.75 else 1  # mostly a front corner: the camera looks at the front
    # the plane cuts everything beyond the corner too, so the corner must look out of the plot: where
    # the main body has more of the building on one side (a second house, a yard), take the other
    gx = (m0[0] - lo[0], hi[0] - m1[0])
    if abs(gx[0] - gx[1]) > 0.15:
        sx = -1 if gx[0] < gx[1] else 1
    corner = Vector((m1[0] if sx > 0 else m0[0], m1[1] if sy > 0 else m0[1], m1[2]))
    bite = rng.uniform(0.22, 0.3)   # the share of each top edge that is gone, halved
    drop = rng.uniform(0.6, 0.85) * uh
    co = Vector((corner.x - sx * bite * ux, corner.y - sy * bite * uy, corner.z))
    no = Vector((sx / ux, sy / uy, 2 * bite / max(drop, 0.02))).normalized()
    out = []
    for (bm, mat, lod, only), ((x0, y0, z0), (x1, y1, z1)) in zip(parts, boxes):
        # only the main body and what stands on or against it falls; the yard's things stay
        on_it = x1 > m0[0] - 0.12 and x0 < m1[0] + 0.12 and y1 > m0[1] - 0.12 and y0 < m1[1] + 0.12
        caps = _cut(bm, co, no) if on_it else []
        if not bm.faces:
            bm.free()
            continue
        big = max(x1 - x0, y1 - y0, z1 - z0) >= 0.15
        if caps:
            out.append((_take(bm, caps), 'ash', lod, only))
        if big and tt.TO_FINAL.get(mat) is None and mat != 'ash' and not mat.startswith('burnt'):
            mat = tt.charred(mat, 0.8)
        if bm.faces:
            out.append((bm, mat, lod, only))
    ms.parts[:] = out
    r = 0.5 * max(0.5, min(1.2, max(ux, uy)))
    px, py = corner.x - sx * bite * ux * 0.5, corner.y - sy * bite * uy * 0.5
    ms.quad_strip('ash', [(px + math.cos(6.2832 * i / 7) * r * rng.uniform(0.75, 1.0), py + math.sin(6.2832 * i / 7) * r * rng.uniform(0.75, 1.0), G + 0.007) for i in range(7)], lod=2)
    stuff = [m for _bm, m, _lod, _only in out if m.startswith('burnt80_')][:1] or ['ash']
    for k in range(4):
        _heap(ms, stuff[0] if k % 2 else stuff[0].replace('burnt80_', '', 1), px + rng.uniform(-0.7, 0.7) * r, py + rng.uniform(-0.7, 0.7) * r,
              rng.uniform(0.06, 0.1) * max(0.7, min(1.4, max(ux, uy))), rng.uniform(0.05, 0.085), rng, 1 if k < 2 else 0)


# ---- the ruined state ------------------------------------------------------------------------------
# `<role>-ruined` (manifest row MD13): what is left when the building is destroyed. Built from the
# role's OWN parts so every age's wreck stays in its age's stuff: every part is cut off at knee to
# waist height by a tilted plane (so the stumps are jagged), big blocks are hollowed into a burnt-out
# shell with an ash floor, the stuff is charred (ti_town.charred), all team cloth is gone, what
# stood low (racks, troughs, stalls, blocks) is left broken where it was, and the wreck lies on a
# scorch mark with heaps of its own wall stuff and burnt beams. Same origin and footprint as the
# whole building. Budget: the validator's `ruin` (1,200 / 300 / 80 triangles).

RUIN_BUDGET = (1200, 300, 80)
# triangles for the cut walls and for the low leftovers, per LOD; the rest is the scorch, heaps and beams
RUIN_WALLS = (600, 140, 48)
RUIN_PROPS = (270, 50, 10)
# the share of the building's height its stumps keep (default: knee to waist height, 1.1 to 1.9 m)
RUIN_CUT = {'tower': 0.3}
# roles whose big rounded masses are rock, not walls: broken down to half their height, sooted
RUIN_ROCK = ('mine',)
# stuff that burns: cloth is cut lower than walls, crops and thatch are left as black as cut walls
RUIN_CLOTH = ('linen', 'sail', 'canvas', 'camo', 'cloth')
RUIN_CROPS = ('barley', 'flax', 'wheat', 'rye', 'potato', 'veg', 'thatch', 'reed', 'turf', 'leaf', 'hedge')
RUIN_FIELD = ('barley', 'flax', 'wheat', 'rye', 'potato', 'veg', 'tilled')  # crop beds: trampled flat as well


def _tris(bm):
    return sum(len(f.verts) - 2 for f in bm.faces)


def _cut(bm, co, no):
    """Cut away everything above the plane (co, no) and close the cut. Returns the closing faces,
    turned to face up."""
    res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, clear_outer=True)
    edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge)]
    if not edges or not bm.faces:
        return []
    caps = bmesh.ops.holes_fill(bm, edges=edges, sides=0)['faces']
    for f in caps:
        f.normal_update()
        if f.normal.z < 0:
            f.normal_flip()
    return caps


def _take(bm, faces):
    """Move `faces` out of `bm` into a bmesh of their own (the ash caps are their own material)."""
    out = bmesh.new()
    for f in faces:
        out.faces.new([out.verts.new(v.co) for v in f.verts])
    out.normal_update()
    bmesh.ops.delete(bm, geom=faces, context='FACES')
    return out


def _no_floor(bm):
    """Drop the faces lying on the ground, never seen (the ruin budget is small)."""
    flat = [f for f in bm.faces if all(v.co.z < G + 0.003 for v in f.verts)]
    if flat:
        bmesh.ops.delete(bm, geom=flat, context='FACES')


def _heap(ms, mat, x, y, r, h, rng, lod, only=None, sides=5):
    """A rubble heap: a ragged ring on the ground rising to a smaller ragged top, no floor.
    sides 5 = 13 triangles; `peak` (LOD2) is a 4-triangle pyramid."""
    bm = bmesh.new()
    a0 = rng.uniform(0, 6.28)
    base = [bm.verts.new((x + math.cos(a0 + 6.2832 * i / sides) * r * rng.uniform(0.8, 1.2),
                          y + math.sin(a0 + 6.2832 * i / sides) * r * rng.uniform(0.8, 1.2), G)) for i in range(sides)]
    ox, oy = rng.uniform(-0.2, 0.2) * r, rng.uniform(-0.2, 0.2) * r
    if sides == 4:
        apex = bm.verts.new((x + ox, y + oy, G + h))
        for i in range(sides):
            bm.faces.new((base[i], base[(i + 1) % sides], apex))
    else:
        top = [bm.verts.new((x + ox + math.cos(a0 + 6.2832 * i / sides) * r * 0.42, y + oy + math.sin(a0 + 6.2832 * i / sides) * r * 0.42,
                             G + h * rng.uniform(0.7, 1.0))) for i in range(sides)]
        for i in range(sides):
            j = (i + 1) % sides
            bm.faces.new((base[i], base[j], top[j], top[i]))
        bm.faces.new(top)
    bm.normal_update()
    ms.add(bm, mat, lod, only=only)


def ruined(role, layout):
    """The `-ruined` state of `layout` (see above). Its own random stream (seeded from the role's
    name), so adding it does not move a single part of the whole or damaged buildings."""
    import zlib

    def build(ms, _rng):
        rng = tm.seeded(zlib.crc32(('ruin:' + role).encode()))
        src = layout(ms, rng) or {}
        parts = [p for p in ms.parts if len(p[0].verts)]
        ms.parts[:] = []
        boxes = [_bounds(p[0]) for p in parts]
        ztop = max(b[1][2] for b in boxes) - G
        lo = (min(b[0][0] for b in boxes), min(b[0][1] for b in boxes))
        hi = (max(b[1][0] for b in boxes), max(b[1][1] for b in boxes))
        cx, cy = (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2
        w, d = hi[0] - lo[0], hi[1] - lo[1]
        stump = RUIN_CUT[role] * ztop if role in RUIN_CUT else min(0.19, max(0.11, 0.3 * ztop))
        # the candidates: every part once (a bevelled block's plain twin stands in for it), no team cloth
        cands, skip = [], None
        for (bm, mat, lod, only), box in zip(parts, boxes):
            twin = skip is not None and all(abs(a - b) < 0.02 for p, q in zip(box, skip) for a, b in zip(p, q))
            skip = None
            if twin or tt.TO_FINAL.get(mat) == 'Team':
                continue
            if only is not None and 0 not in (only if isinstance(only, tuple) else (only,)):
                skip = box
            cands.append((bm, mat, box))
        posts = [k for k, (_bm, _mat, ((x0, y0, z0), (x1, y1, z1))) in enumerate(cands) if max(x1 - x0, y1 - y0) < 0.1 and z1 - z0 > 3 * stump and z0 < G + 0.05]
        tall = set() if role in RUIN_CUT else set(rng.sample(posts, min(2, len(posts))))  # one or two posts still stand, burnt
        walls, props = [], []
        for k, (bm0, mat, ((x0, y0, z0), (x1, y1, z1))) in enumerate(cands):
            dx, dy = x1 - x0, y1 - y0
            if max(dx, dy, z1 - z0) < 0.035 or (role in RUIN_ROCK and mat == 'dark'):  # (the adit's black mouth: fallen in)
                continue
            rock = role in RUIN_ROCK and len(bm0.verts) >= 16 and max(dx, dy) > 0.25 and z1 - z0 > 0.12
            h = min(0.5, stump * rng.uniform(1.9, 3.0)) if k in tall else stump * rng.uniform(0.6, 1.3)
            if rock:
                h = 0.45 * ztop * rng.uniform(0.85, 1.1)
            elif any(t in mat for t in RUIN_CLOTH):
                h *= 0.45  # cloth burns away: a tent leaves a low charred skirt
            half = 0.5 * math.hypot(dx, dy)
            slope = min(0.3 if rock else 0.5, (h - 0.03) / max(half, 0.02)) * rng.uniform(0.55, 1.0)
            a = rng.uniform(0, 2 * math.pi)
            co, no = Vector(((x0 + x1) / 2, (y0 + y1) / 2, G + h)), Vector((-slope * math.cos(a), -slope * math.sin(a), 1.0)).normalized()
            bm = bm0.copy()
            caps = _cut(bm, co, no)
            was_cut = bool(caps) or len(bm.verts) != len(bm0.verts)
            if not bm.faces or (not was_cut and not rock and rng.random() < 0.25):  # all above the cut, or lost
                bm.free()
                continue
            field = any(t in mat for t in RUIN_FIELD)
            if field:  # a crop bed: trampled flat and burnt
                flat = rng.uniform(0.2, 0.5)
                for v in bm.verts:
                    v.co.z = G + (v.co.z - G) * flat
            keep = 0.62 if rock else 0.3 if field else 0.4 if was_cut or any(t in mat for t in RUIN_CROPS) else 0.55
            cmat = mat if mat.endswith('_fringe') else tt.charred(mat, keep)
            # a big block becomes a shell: a rim of wall round a sunken ash floor
            shell = None
            if not rock and len(caps) == 1 and len(caps[0].verts) <= 8 and min(dx, dy) > 0.16 and h > 0.07:
                shell = bm.copy()
                shell.faces.ensure_lookup_table()
                cap = max(shell.faces, key=lambda f: (round(f.normal.z, 2), f.calc_area()) if all(abs((v.co - co).dot(no)) < 1e-4 for v in f.verts) else (-2, 0))
                bmesh.ops.inset_region(shell, faces=[cap], thickness=min(0.045, 0.22 * min(dx, dy)), depth=0.0, use_even_offset=True, use_boundary=True)
                for v in cap.verts:
                    v.co.z = max(G + 0.012, v.co.z - 0.07)
                floor = _take(shell, [cap])
                _no_floor(shell)
                shell = (shell, floor)
            top = _take(bm, caps) if caps else None
            _no_floor(bm)
            if not bm.faces:
                bm.free()
                continue
            zs = [v.co.z for v in bm.verts]
            peak = max(bm.verts, key=lambda v: v.co.z).co.copy()
            item = {'bm': bm, 'top': top, 'shell': shell, 'mat': cmat, 'top_mat': cmat if rock else 'ash', 'own': mat, 'box': ((x0, y0), (x1, y1)), 'peak': peak,
                    'cut': was_cut, 'rose': z1 - G, 'imp': max(dx, dy) * (0.3 + min(dx, dy)) * (0.4 + max(zs) - G)}
            (walls if (was_cut or rock) and (max(dx, dy) >= 0.22 or dx * dy >= 0.03) else props).append(item)

        # fit the walls and the leftovers into their shares of the budget, biggest first
        def fit(items, share, cap_tris):
            used = [0, 0, 0]
            kept = []
            for it in sorted(items, key=lambda i: -i['imp']):
                plain = _tris(it['bm']) + (_tris(it['top']) if it['top'] else 0)
                hollow = _tris(it['shell'][0]) + _tris(it['shell'][1]) if it['shell'] else None
                if plain > cap_tris:
                    continue
                lv_h, lv_p = [], []
                for lod in (0, 1, 2):
                    if hollow is not None and lod < 2 and used[lod] + hollow <= share[lod]:
                        lv_h.append(lod)
                        used[lod] += hollow
                    elif used[lod] + plain <= share[lod]:
                        lv_p.append(lod)
                        used[lod] += plain
                if lv_h:
                    ms.parts.append((it['shell'][0], it['mat'], max(lv_h), tuple(lv_h)))
                    ms.parts.append((it['shell'][1], 'ash', max(lv_h), tuple(lv_h)))
                if lv_p:
                    ms.parts.append((it['bm'], it['mat'], max(lv_p), tuple(lv_p)))
                    if it['top']:
                        ms.parts.append((it['top'], it['top_mat'], max(lv_p), tuple(lv_p)))
                if lv_h or lv_p:
                    kept.append(it)
            return kept
        standing = fit(walls, RUIN_WALLS, 110)
        fit(props, RUIN_PROPS, 44)

        # the scorch mark under it all
        n = 9
        ring = []
        for i in range(n):
            t = 2 * math.pi * i / n
            k = rng.uniform(0.84, 1.0)
            ring.append((cx + 0.5 * w * k * math.cos(t) * 1.12, cy + 0.5 * d * k * math.sin(t) * 1.12, G + 0.005))
        ms.quad_strip('ash', ring, lod=2)
        # a broken tooth of wall on the highest corner of the biggest stumps
        for k, it in enumerate([s for s in standing if s['cut'] and s['rose'] > 1.6 * stump][:3]):
            p = it['peak']
            (x0, y0), (x1, y1) = it['box']
            tx, ty = p.x + (0.03 if p.x < (x0 + x1) / 2 else -0.03), p.y + (0.03 if p.y < (y0 + y1) / 2 else -0.03)
            ms.box(it['mat'], (0.07, 0.07, rng.uniform(0.08, 0.16) + 0.03), at=(tx, ty, p.z - 0.03), rot_z=rng.uniform(-12, 12), lod=1 if k == 0 else 0, taper=0.55)
        # heaps of the building's own stuff along what stands, half of them charred
        stuff = [s['own'] for s in standing[:3] if tt.TO_FINAL.get(s['own']) != 'Ground'] or ['ash']
        scale = max(0.7, min(1.5, min(w, d)))
        for k in range(9):
            if standing and k < 7:
                (x0, y0), (x1, y1) = standing[k % min(4, len(standing))]['box']
                side = rng.randrange(4)
                x = rng.uniform(x0, x1) if side < 2 else (x0 - 0.03 if side == 2 else x1 + 0.03)
                y = rng.uniform(y0, y1) if side >= 2 else (y0 - 0.03 if side == 0 else y1 + 0.03)
            else:
                x, y = cx + rng.uniform(-0.38, 0.38) * w, cy + rng.uniform(-0.38, 0.38) * d
            x, y = min(hi[0] - 0.04, max(lo[0] + 0.04, x)), min(hi[1] - 0.04, max(lo[1] + 0.04, y))
            own = rng.choice(stuff)
            mat = own if own == 'ash' or k % 2 == 0 else tt.charred(own, 0.4)
            r, hh = rng.uniform(0.07, 0.11) * scale, rng.uniform(0.045, 0.08) * scale
            if k < 2:
                _heap(ms, mat, x, y, r, hh, rng, 1, only=(0, 1))
                _heap(ms, mat, x, y, r, hh, rng, 2, only=(2,), sides=4)
            else:
                _heap(ms, mat, x, y, r, hh, rng, 1 if k < 4 else 0)
        # burnt beams: three still leaning on the stumps, the rest lying where the roof fell
        for k in range(7):
            x, y = cx + rng.uniform(-0.36, 0.36) * w, cy + rng.uniform(-0.36, 0.36) * d
            a = rng.uniform(0, 2 * math.pi)
            L = rng.uniform(0.22, 0.38) * scale
            z1 = G + (min(0.34, stump * rng.uniform(1.1, 1.9)) if k < 3 else 0.03)
            beam(ms, 'ash', (x - math.cos(a) * L / 2, y - math.sin(a) * L / 2, G + 0.012), (x + math.cos(a) * L / 2, y + math.sin(a) * L / 2, z1), r=0.017, segs=4, lod=1 if k in (0, 3) else 0)
        if role in RUIN_ROCK:  # the adit has fallen in: its mouth choked with rock, its frame lying broken
            mx, my = src.get('socket-door', (cx, lo[1] + 0.1, 0))[:2]
            rock_stuff = standing[0]['mat'] if standing else 'ash'
            for k in range(4):
                _heap(ms, rock_stuff, mx + rng.uniform(-0.1, 0.1), my + rng.uniform(-0.02, 0.1), rng.uniform(0.09, 0.13), rng.uniform(0.1, 0.17), rng, 1 if k < 2 else 0)
            for k in range(3):
                a = rng.uniform(-0.6, 0.6)
                beam(ms, tt.charred('timber', 0.4), (mx - 0.14 + 0.14 * k, my - 0.09, G + 0.012), (mx - 0.14 + 0.14 * k + math.sin(a) * 0.2, my + 0.06, G + rng.uniform(0.12, 0.26)), r=0.02, segs=4, lod=1 if k == 0 else 0)
        if role == 'farm-plot':  # the fence lies broken round the field, the rows burnt through in patches
            for k in range(6):
                t = rng.uniform(-0.4, 0.4)
                x, y = (cx + t * w, lo[1] if k % 4 == 0 else hi[1]) if k % 4 < 2 else (lo[0] if k % 4 == 2 else hi[0], cy + t * d)
                a, L = rng.uniform(0, math.pi), rng.uniform(0.2, 0.32)
                beam(ms, tt.charred('timber', 0.55), (x - math.cos(a) * L / 2, y - math.sin(a) * L / 2, G + 0.012), (x + math.cos(a) * L / 2, y + math.sin(a) * L / 2, G + rng.choice((0.02, 0.02, 0.1))), r=0.012, segs=4, lod=0)
            for k in range(3):
                x, y, r = cx + rng.uniform(-0.3, 0.3) * w, cy + rng.uniform(-0.3, 0.3) * d, rng.uniform(0.13, 0.2) * min(w, d)
                ms.quad_strip('ash', [(x + math.cos(6.2832 * i / 6) * r * rng.uniform(0.7, 1.0), y + math.sin(6.2832 * i / 6) * r * rng.uniform(0.7, 1.0), G + 0.046) for i in range(6)], lod=1 if k == 0 else 0)
        for bm0, _mat, _lod, _only in parts:
            bm0.free()
        used = [sum(_tris(bm) for bm, _m, lod, only in ms.parts if lod >= lv and (only is None or lv in only)) for lv in (0, 1, 2)]
        assert all(u <= b for u, b in zip(used, RUIN_BUDGET)), (role, used)
        print('ruin', role, used, 'walls', len(standing), flush=True)
        # the fires and the smoke stay, brought down onto the wreck
        return {k: (x, y, min(z, stump)) for k, (x, y, z) in src.items() if k.startswith('socket-fire') or k.startswith('socket-smoke')}
    return build


def ruined_items(roles):
    """The `<role>-ruined` items of a file, to be added AFTER its other items."""
    return [(name + '-ruined', grounded(name + '-ruined', ruined(name, fn)), None) for name, fn in roles]


SOCKETS = {}


def grounded(name, layout):
    """Run a layout and move every part down by G: no ground plate, the footprint sits on Z = 0."""
    def build(ms, rng):
        SOCKETS[name] = layout(ms, rng) or {}
        for bm, _mat, _lod, _only in ms.parts:
            bmesh.ops.translate(bm, vec=(0, 0, -G), verts=bm.verts)
    return build


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-bronze')
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    only = [a for a in os.environ.get('ONLY', '').split(',') if a]
    items = []
    for name, fn in ROLES:
        if only and name not in only:
            continue
        items.append((name, grounded(name, fn), None))
        items.append((name + '-damaged', grounded(name + '-damaged', damaged(fn)), None))
    for name, fn in STAGES:
        if only and name not in only:
            continue
        items.append((name, grounded(name, fn), None))
    items += ruined_items([(n, fn) for n, fn in ROLES if not only or n in only])  # last: nothing before them moves
    counts = tt.build_file('rts-bronze', items, out_dir, atlas=atlas, seed=3100, write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.name in {n for n, _, _ in items}]
    empties = []
    for root in roots:
        for sname, (x, y, z) in SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)  # faces -Y: units come out toward the front
            empties.append(e)
    exported = [o for o in scene.objects if o.type in ('MESH', 'EMPTY')]
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-bronze.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-bronze.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-bronze.glb', 'triangles': counts, 'sockets': SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_BRONZE_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)  # bpy can crash while tearing down packed images; the files are already written


if __name__ == '__main__':
    main()
