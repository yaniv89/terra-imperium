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
        return sockets
    return build


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
    items = []
    for name, fn in ROLES:
        items.append((name, grounded(name, fn), None))
        items.append((name + '-damaged', grounded(name + '-damaged', damaged(fn)), None))
    for name, fn in STAGES:
        items.append((name, grounded(name, fn), None))
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
