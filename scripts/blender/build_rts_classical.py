# scripts/blender/build_rts_classical.py
# The Classical battle buildings, src/assets/battle/rts/rts-classical.glb (plans/ART-MODELS-PLAN.md
# section 5; src/assets/battle/rts/README.md): the 13 roles of a battle economy, each with a
# `<role>-damaged` sibling and its sockets, plus the four construction stages, in the Classical town
# kit's look (ti_classical.py: cream plaster on cut-stone footings, terracotta tile gable roofs,
# marble columns, courtyard walls) so a battle's buildings match the Classical towns on the map.
# The structure, sockets, damage and grounding are build_rts_bronze.py's (imported); the Bronze
# helpers that only differ in material (the mine, the construction stages) are reused with their
# materials swapped. One atlas for the file, LOD0..LOD2 per object.
#   blender -b --factory-startup -P scripts/blender/build_rts_classical.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_classical as tc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
from ti_town import G  # noqa: E402

WORLD = rb.WORLD
beam, flag_pole, sack, spear_rack, target, stone_blocks, trough, shed_roof = rb.beam, rb.flag_pole, rb.sack, rb.spear_rack, rb.target, rb.stone_blocks, rb.trough, rb.shed_roof


def remat(layout, mapping):
    """Run a layout, then rename the materials of its parts (a Bronze helper in Classical stone)."""
    def build(ms, rng):
        sockets = layout(ms, rng)
        ms.parts[:] = [(bm, mapping.get(mat, mat), lod, only) for bm, mat, lod, only in ms.parts]
        return sockets
    build.__doc__ = layout.__doc__
    return build


def columns(ms, f, xs, y, h, r=0.022, z=G):
    for x in xs:
        ms.cyl('marble', r, r * 0.85, h, at=(x, y, z), segs=8, lod=1, frame=f)
        ms.box('marble', (r * 2.6, r * 2.6, 0.016), at=(x, y, z + h - 0.016), lod=0, frame=f)


def portico(ms, f, w, y, h, n=6, depth=0.16):
    """A row of columns in front of a wall face at local y with a tiled lean-to roof over them."""
    xs = [-w / 2 + 0.04 + (w - 0.08) * i / (n - 1) for i in range(n)]
    columns(ms, f, xs, y - depth, h)
    ms.box('marble', (w, 0.05, 0.03), at=(0, y - depth, G + h), lod=1, frame=f)
    slope = math.atan2(0.05, depth)
    from mathutils import Matrix
    rf = f @ Matrix.Translation(Vector((0, y - depth / 2, G + h + 0.05))) @ Matrix.Rotation(slope, 4, 'X')
    ms.box('tile', (w + 0.06, depth / math.cos(slope) + 0.06, 0.02), at=(0, 0, 0), lod=2, frame=rf)


def palisade(ms, rng, half, gap=0.16):
    """A square stake palisade round a camp, a gate gap at the front (south)."""
    pts = []
    n = int(2 * half / 0.07)
    for i in range(n + 1):
        x = -half + 2 * half * i / n
        if abs(x) > gap:
            pts.append((x, -half))
        pts.append((x, half))
    for i in range(1, n):
        y = -half + 2 * half * i / n
        pts.append((-half, y)); pts.append((half, y))
    tb.stakes(ms, rng, pts, h=(0.2, 0.28))


# ---- the roles ------------------------------------------------------------------------------------

def expedition_camp(ms, rng):
    """22 x 22 m: rows of leather tents round a command tent, a standard, a fire, stacked supplies,
    a square stake palisade with a gate at the front."""
    tb.tent(ms, 0, 0.32, w=0.52, d=0.66, h=0.42)
    tt.front_shade(ms, WORLD, 0, -0.02, 0.44, depth=0.2, z=0.3, mat='team_cloth')
    for x in (-0.66, -0.36, 0.36, 0.66):
        for y in (0.6, -0.1):
            tb.tent(ms, x, y, w=0.24, d=0.36, h=0.22, yaw=0)
    tb.fire_ring(ms, rng, 0, -0.4)
    for k in range(5):
        tt.jar(ms, WORLD, -0.36 + rng.uniform(-0.05, 0.05), -0.62 + rng.uniform(-0.05, 0.05), rng.uniform(1.2, 1.5))
    tt.crate(ms, WORLD, -0.18, -0.66, 1.4, 10)
    for k in range(4):
        sack(ms, 0.26 + 0.06 * k, -0.64 + 0.02 * (k % 2), 1.1)
    palisade(ms, rng, 0.96)
    top = flag_pole(ms, -0.26, -0.4, 0.82, w=0.26, fh=0.18)
    return {'socket-door': (0, -0.2, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (-0.2, -0.7, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.32, 0.3), 'socket-fire-2': (-0.66, 0.6, 0.15), 'socket-fire-3': (0.66, 0.6, 0.15), 'socket-fire-4': (0.36, -0.1, 0.15), 'socket-smoke-1': (0, -0.4, 0.1)}


def town_hall(ms, rng):
    """20 x 20 m: the keep, a two-storey basilica hall with its gable to the front behind a marble
    portico, inside a walled court with a gate, a well and banners."""
    f = tc.roman_house(ms, rng, 0, 0.28, 1.0, 1.08, storeys=2, yaw=0, rise=0.26, gable_front=True)
    portico(ms, f, 1.0, -0.54, 0.54, n=6, depth=0.15)
    tc.court_wall(ms, -0.95, -0.92, 0.95, -0.92, h=0.2, gaps=((0.5, 0.36),))
    tc.court_wall(ms, -0.95, -0.92, -0.95, 0.92, h=0.2)
    tc.court_wall(ms, 0.95, -0.92, 0.95, 0.92, h=0.2)
    tc.court_wall(ms, -0.95, 0.92, 0.95, 0.92, h=0.2)
    for sx in (-1, 1):
        ms.box('ashlar', (0.12, 0.12, 0.34), at=(sx * 0.22, -0.92, G), lod=2, bevel=0.005)
        tb.banner(ms, WORLD, sx * 0.22, -0.99, G + 0.32, w=0.08, h=0.2)
    tt.well(ms, -0.6, -0.45)
    tc.cypress(ms, 0.65, -0.55)
    tc.cypress(ms, 0.75, 0.6)
    top = flag_pole(ms, -0.7, 0.65, 1.05, w=0.24, fh=0.15)
    return {'socket-door': (0, -0.95, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (0.35, -0.98, 0), 'socket-banner': top,
            'socket-fire-1': (-0.2, 0.3, 0.85), 'socket-fire-2': (0.2, 0.0, 0.85), 'socket-fire-3': (0, -0.6, 0.55), 'socket-fire-4': (-0.6, -0.6, 0.2), 'socket-smoke-1': (0, 0.3, 1.0)}


def food_depot(ms, rng):
    """10 x 10 m: a horreum (a buttressed granary on a raised stone floor), amphorae and sacks at
    its door, a measuring table."""
    f = tc.roman_house(ms, rng, 0, 0.16, 0.78, 0.46, yaw=0, rise=0.14, h=0.4)
    for k in range(5):
        ms.box('ashlar', (0.05, 0.05, 0.36), at=(-0.36 + 0.18 * k, -0.07 - 0.016, G), lod=1, frame=f)
    for k in range(6):
        tt.jar(ms, WORLD, -0.32 + 0.06 * k + rng.uniform(-0.01, 0.01), -0.26 + 0.03 * (k % 2), 1.25)
    for k in range(3):
        sack(ms, 0.18 + 0.06 * k, -0.34, 1.0)
    ms.box('timber', (0.16, 0.1, 0.07), at=(0.3, -0.38, G), lod=1, bevel=0.004)
    return {'socket-door': (0, -0.48, 0), 'socket-rally': (0, -0.8, 0), 'socket-drop': (-0.1, -0.42, 0),
            'socket-fire-1': (-0.25, 0.16, 0.45), 'socket-fire-2': (0.25, 0.16, 0.45), 'socket-fire-3': (0, 0.16, 0.55), 'socket-fire-4': (0.3, -0.38, 0.1), 'socket-smoke-1': (0, 0.16, 0.6)}


def materials_yard(ms, rng):
    """10 x 10 m: a walled yard with stacked timber, squared stone blocks and a treadwheel crane
    lifting a block."""
    tc.court_wall(ms, -0.48, -0.48, -0.48, 0.48, h=0.12)
    tc.court_wall(ms, -0.48, 0.48, 0.48, 0.48, h=0.12)
    tc.court_wall(ms, 0.48, 0.48, 0.48, -0.48, h=0.12)
    tc.court_wall(ms, -0.48, -0.48, 0.48, -0.48, h=0.12, gaps=((0.5, 0.3),))
    ms.box('log', (0.13, 0.46, 0.05), at=(-0.26, 0.0, G), lod=2)
    tb.log_bundle(ms, -0.26, 0.16, 0, length=0.44)
    tb.log_bundle(ms, -0.26, -0.16, 0, length=0.36)
    stone_blocks(ms, 0.22, 0.28, rng)
    # the treadwheel crane: an A-frame jib, a big wheel at its foot, a block on the rope
    for sx in (-0.07, 0.07):
        beam(ms, 'timber', (0.18 + sx, -0.22, G), (0.18, -0.05, G + 0.55), r=0.012)
    beam(ms, 'timber', (0.18, 0.12, G), (0.18, -0.05, G + 0.55), r=0.012)
    ms.cyl('timber', 0.13, 0.13, 0.05, at=(0.36, 0.02, G + 0.13), rot=(0, 90, 0), segs=12, lod=1)
    beam(ms, 'linen', (0.18, -0.05, G + 0.55), (0.18, -0.05, G + 0.2), r=0.004, segs=4, lod=0)
    ms.box('ashlar', (0.09, 0.07, 0.07), at=(0.18, -0.05, G + 0.13), lod=0, bevel=0.004)
    for k in range(3):
        tt.basket(ms, WORLD, -0.02 + 0.05 * k, -0.36, 1.1)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -0.85, 0), 'socket-drop': (0, -0.38, 0),
            'socket-fire-1': (-0.26, 0.16, 0.12), 'socket-fire-2': (-0.26, -0.16, 0.12), 'socket-fire-3': (0.18, -0.05, 0.5), 'socket-fire-4': (0.22, 0.28, 0.15), 'socket-smoke-1': (-0.26, 0, 0.2)}


def trade_post(ms, rng):
    """14 x 14 m: a market stoa at the back, stalls under team awnings, a balance on a stone table."""
    tc.stoa(ms, rng, 0, 0.42, 1.2, depth=0.38, yaw=0, columns=7)
    for x, y in [(-0.45, -0.18), (0.45, -0.18), (-0.25, -0.52)]:
        tb.stall(ms, x, y, rng, yaw=0)
    f = tm.house_frame(0.18, -0.4, 0)
    ms.box('ashlar', (0.2, 0.1, 0.08), at=(0, 0, G), lod=1, frame=f, bevel=0.004)
    ms.box('timber', (0.016, 0.016, 0.14), at=(0, 0, G + 0.08), lod=1, frame=f)
    ms.box('timber', (0.2, 0.012, 0.012), at=(0, 0, G + 0.22), lod=0, frame=f)
    for sx in (-0.09, 0.09):
        ms.cyl('bronze', 0.03, 0.035, 0.012, at=(sx, 0, G + 0.15), segs=8, lod=0, frame=f)
    top = flag_pole(ms, -0.66, 0.1, 0.7)
    return {'socket-door': (0, -0.68, 0), 'socket-rally': (0, -1.0, 0), 'socket-drop': (0.18, -0.55, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.42, 0.42), 'socket-fire-2': (-0.45, -0.18, 0.25), 'socket-fire-3': (0.45, -0.18, 0.25), 'socket-fire-4': (-0.25, -0.52, 0.25), 'socket-smoke-1': (0, 0.42, 0.5)}


def farm_plot(ms, rng):
    """14 x 14 m: four beds of ripe wheat inside a dry-stone wall with a gate, a row of vines on the
    north edge, a tiled field shelter and amphorae."""
    tc.court_wall(ms, -0.68, -0.68, -0.68, 0.68, h=0.08, t=0.05)
    tc.court_wall(ms, -0.68, 0.68, 0.68, 0.68, h=0.08, t=0.05)
    tc.court_wall(ms, 0.68, 0.68, 0.68, -0.68, h=0.08, t=0.05)
    tc.court_wall(ms, -0.68, -0.68, 0.68, -0.68, h=0.08, t=0.05, gaps=((0.5, 0.24),))
    for x in (-0.46, -0.16, 0.16, 0.46):
        tb.crop_bed(ms, 'barley', x, -0.06, 0.24, 0.9, rng.uniform(0.07, 0.085), rng)
    ms.box('vine', (1.2, 0.06, 0.08), at=(0, 0.56, G + 0.02), lod=2, taper=0.6)
    for k in range(6):
        ms.cyl('log', 0.008, 0.007, 0.12, at=(-0.55 + 0.22 * k, 0.56, G), segs=5, lod=1)
    f = tm.house_frame(0.5, -0.55, 0)
    for sx in (-0.08, 0.08):
        ms.box('timber', (0.02, 0.02, 0.14), at=(sx, 0, G), lod=1, frame=f)
    tc.gable_roof(ms, f, 0.22, 0.14, G + 0.14, 0.05, lod=1)
    tt.jar(ms, WORLD, 0.42, -0.58, 1.1)
    tt.basket(ms, WORLD, 0.55, -0.6, 1.1)
    return {'socket-door': (0, -0.7, 0), 'socket-rally': (0, -0.95, 0), 'socket-drop': (0, -0.6, 0),
            'socket-fire-1': (-0.46, 0.3, 0.08), 'socket-fire-2': (0.16, -0.3, 0.08), 'socket-fire-3': (0.46, 0.4, 0.08), 'socket-fire-4': (-0.16, -0.2, 0.08), 'socket-smoke-1': (0, 0, 0.1)}


# the Bronze mine with a stone-built adit and a tiled smelting shed
mine = remat(rb.mine, {'reed': 'tile', 'pylon': 'ashlar'})


def barracks(ms, rng):
    """16 x 12 m: a long tiled barrack block with a colonnaded front and a team awning, spear racks,
    drill posts (pali) and a standard."""
    f = tc.roman_house(ms, rng, 0, 0.26, 1.4, 0.44, yaw=0, rise=0.14, h=0.4)
    portico(ms, f, 1.4, -0.22, 0.34, n=8, depth=0.14)
    spear_rack(ms, -0.5, -0.32)
    spear_rack(ms, 0.5, -0.32)
    for k in range(4):
        ms.cyl('timber', 0.022, 0.02, 0.2, at=(-0.3 + 0.2 * k, -0.52, G), segs=6, lod=1)
    top = flag_pole(ms, 0.76, -0.52, 0.78)
    return {'socket-door': (0, -0.15, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.4, 0.26, 0.47), 'socket-fire-2': (0.1, 0.26, 0.5), 'socket-fire-3': (0.5, 0.26, 0.47), 'socket-fire-4': (-0.5, -0.32, 0.1), 'socket-smoke-1': (0, 0.26, 0.62)}


def shooting_range(ms, rng):
    """16 x 12 m: a yard with three straw targets before a plastered back wall, a tiled shed for
    the bows and a shooting line."""
    tc.court_wall(ms, -0.8, 0.58, 0.8, 0.58, h=0.24, t=0.05)
    for x in (-0.05, 0.3, 0.65):
        target(ms, x, 0.42)
    tc.roman_house(ms, rng, -0.52, 0.3, 0.46, 0.3, yaw=0, rise=0.1, h=0.26)
    beam(ms, 'timber', (-0.25, -0.42, G + 0.018), (0.55, -0.42, G + 0.018), r=0.018, lod=1)
    f = tm.house_frame(-0.5, -0.1, 0)
    ms.box('timber', (0.2, 0.03, 0.12), at=(0, 0, G), lod=1, frame=f)
    for k in range(3):
        ms.cyl('timber', 0.018, 0.022, 0.14, at=(-0.06 + 0.06 * k, 0, G + 0.04), rot=(12, 0, 0), segs=6, lod=0, frame=f)
    top = flag_pole(ms, 0.76, -0.45, 0.6)
    return {'socket-door': (0, -0.55, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.52, 0.3, 0.3), 'socket-fire-2': (0.3, 0.42, 0.2), 'socket-fire-3': (-0.05, 0.42, 0.2), 'socket-fire-4': (0.65, 0.42, 0.2), 'socket-smoke-1': (-0.52, 0.3, 0.45)}


def stable(ms, rng):
    """20 x 16 m: a long stable with a plastered back wall and a tiled lean-to roof on posts, stall
    partitions, a fenced paddock with stone troughs and hay."""
    shed_roof(ms, 0, 0.45, 1.6, 0.5, 0.36, 0.48, mat='tile')
    ms.box('cream', (1.6, 0.04, 0.44), at=(0, 0.7, G), lod=2)
    for sx in (-1, 1):
        ms.box('cream', (0.04, 0.5, 0.38), at=(sx * 0.8, 0.45, G), lod=2)
    for k in range(4):
        ms.box('timber', (0.02, 0.36, 0.16), at=(-0.6 + 0.4 * k, 0.48, G), lod=1)
    tb.rail_fence(ms, [(-0.15, -0.78), (-0.95, -0.78), (-0.95, 0.15), (-0.82, 0.15)], h=0.12, step=0.22)
    tb.rail_fence(ms, [(0.82, 0.15), (0.95, 0.15), (0.95, -0.78), (0.15, -0.78)], h=0.12, step=0.22)
    for x, y, yaw in [(-0.5, -0.1, 0), (0.45, 0.05, 90)]:
        f = tm.house_frame(x, y, yaw)
        ms.box('ashlar', (0.24, 0.08, 0.05), at=(0, 0, G), lod=1, frame=f, bevel=0.004)
        ms.box('shallows', (0.21, 0.055, 0.004), at=(0, 0, G + 0.044), lod=0, frame=f)
    for x, y in [(0.55, -0.45), (0.68, -0.38), (-0.6, -0.55)]:
        ms.sphere('reed', 0.07, at=(x, y, G), scale=(1.2, 1, 0.8), u=8, v=5, cut_below=0.0, lod=1)
    top = flag_pole(ms, -0.88, -0.7, 0.62)
    return {'socket-door': (0, -0.8, 0), 'socket-rally': (0, -1.2, 0), 'socket-banner': top,
            'socket-fire-1': (-0.5, 0.45, 0.45), 'socket-fire-2': (0.5, 0.45, 0.45), 'socket-fire-3': (0, 0.45, 0.45), 'socket-fire-4': (0.6, -0.42, 0.08), 'socket-smoke-1': (0, 0.45, 0.6)}


def siege_workshop(ms, rng):
    """20 x 16 m: a tall timber gantry with a lifting boom over a ballista half built on trestles
    (stock, spring frame, wheels lying by), a workbench, timber and a tiled store."""
    for sx in (-0.55, 0.55):
        for sy in (-0.25, 0.35):
            ms.box('timber', (0.045, 0.045, 1.05), at=(sx, sy, G), lod=2)
        ms.box('timber', (0.05, 0.66, 0.05), at=(sx, 0.05, G + 1.02), lod=2)
    for sy in (-0.25, 0.35):
        ms.box('timber', (1.16, 0.05, 0.05), at=(0, sy, G + 1.02), lod=2)
    beam(ms, 'timber', (-0.55, -0.25, G + 0.5), (-0.55, 0.35, G + 1.0), r=0.014)
    beam(ms, 'linen', (0.05, 0.05, G + 1.02), (0.05, 0.05, G + 0.5), r=0.005, segs=4, lod=0)
    # the ballista on trestles: the stock, the spring frame with two sinew bundles, one arm fitted
    for sx in (-0.25, 0.25):
        ms.box('timber', (0.05, 0.2, 0.16), at=(sx, 0.05, G), lod=1)
    ms.box('timber', (0.7, 0.08, 0.06), at=(0, 0.05, G + 0.16), lod=2, bevel=0.004)
    ms.box('timber', (0.06, 0.36, 0.05), at=(-0.36, 0.05, G + 0.22), lod=1)
    for sy in (-0.07, 0.17):
        ms.cyl('linen', 0.035, 0.035, 0.26, at=(-0.36, sy, G + 0.12), segs=8, lod=1)
        ms.cyl('bronze', 0.045, 0.045, 0.03, at=(-0.36, sy, G + 0.37), segs=8, lod=0)
    beam(ms, 'timber', (-0.36, 0.17, G + 0.25), (-0.2, 0.42, G + 0.26), r=0.014)
    for sx in (-0.2, 0.15):
        ms.cyl('timber', 0.1, 0.1, 0.03, at=(sx, -0.45, G), segs=12, lod=1)
    ms.box('timber', (0.3, 0.12, 0.09), at=(0.6, -0.5, G), lod=1, bevel=0.004)
    tb.log_bundle(ms, -0.75, -0.45, 90, length=0.36)
    tc.roman_house(ms, rng, 0.6, 0.62, 0.55, 0.3, yaw=0, rise=0.1, h=0.26)
    top = flag_pole(ms, -0.86, 0.6, 0.7)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -1.1, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.05, 1.05), 'socket-fire-2': (0.6, 0.62, 0.35), 'socket-fire-3': (-0.75, -0.45, 0.12), 'socket-fire-4': (0.2, 0.05, 0.25), 'socket-smoke-1': (0, 0.05, 1.1)}


def aid_post(ms, rng):
    """12 x 12 m: a leather hospital tent with a team front shade, stretchers, water jars and a
    marble basin."""
    tb.tent(ms, 0, 0.18, w=0.52, d=0.62, h=0.38)
    tt.front_shade(ms, WORLD, 0, -0.13, 0.38, depth=0.18, z=0.26, mat='team_cloth')
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
    ms.cyl('marble', 0.06, 0.05, 0.06, at=(-0.32, 0.36, G), segs=10, lod=1)
    ms.cyl('water', 0.048, 0.048, 0.004, at=(-0.32, 0.36, G + 0.06), segs=10, lod=0)
    top = flag_pole(ms, 0.3, -0.5, 0.6)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.8, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.18, 0.3), 'socket-fire-2': (-0.36, -0.25, 0.06), 'socket-fire-3': (0.36, -0.25, 0.06), 'socket-fire-4': (0.35, 0.35, 0.1), 'socket-smoke-1': (0, 0.18, 0.4)}


def tower(ms, rng):
    """8 x 8 m, 14 m: a square ashlar tower on a battered footing, slit windows, a fighting top
    with merlons under a tiled pyramid roof on corner posts, a team pennant."""
    w, h = 0.56, 1.0
    ms.box('ashlar', (w + 0.08, w + 0.08, 0.12), at=(0, 0, G), lod=2, bevel=0.005, taper=0.92)
    ms.box('cream', (w, w, h), at=(0, 0, G + 0.1), lod=2, bevel=0.004)
    ms.box('ashlar', (w + 0.06, w + 0.06, 0.05), at=(0, 0, G + 0.1 + h), lod=2)
    for k in range(4):
        a = k * math.pi / 2
        for z in (0.4, 0.75):
            ms.box('dark', (0.03, 0.012, 0.09), at=(math.sin(a) * (w / 2 + 0.004), -math.cos(a) * (w / 2 + 0.004), G + z), rot_z=math.degrees(a), lod=0)
    top_z = G + 0.15 + h
    for i in range(4):
        for j in range(3):
            t = -w / 2 + 0.05 + (w - 0.1) * j / 2
            for (x, y) in [(t, -w / 2), (t, w / 2), (-w / 2, t), (w / 2, t)][i:i + 1]:
                ms.box('ashlar', (0.07, 0.07, 0.08), at=(x, y, top_z), lod=1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.03, 0.03, 0.22), at=(sx * (w / 2 - 0.03), sy * (w / 2 - 0.03), top_z), lod=1)
    tc.hip_roof(ms, WORLD, w, w, top_z + 0.22, 0.2, over=0.06, curl=0.0, ornaments=False)
    ms.box('door', (0.12, 0.012, 0.22), at=(0, -w / 2 - 0.004, G + 0.1), lod=1)
    top = flag_pole(ms, 0.2, 0.2, 1.62, w=0.16, fh=0.1)
    return {'socket-door': (0, -0.32, 0), 'socket-rally': (0, -0.65, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0, 1.25), 'socket-fire-2': (-0.15, -0.2, 0.6), 'socket-fire-3': (0.15, 0.2, 0.9), 'socket-fire-4': (0, -0.26, 0.3), 'socket-smoke-1': (0, 0, 1.45)}


# the construction stages in cut stone and plaster: the Bronze stages with their materials swapped
STAGE_MATS = {'mudwall': 'ashlar', 'mudwall_bare': 'cream', 'roof': 'tile', 'reed': 'timber'}
STAGES = [(n, remat(fn, STAGE_MATS)) for n, fn in rb.STAGES]

ROLES = [('expedition-camp', expedition_camp), ('town-hall', town_hall), ('food-depot', food_depot), ('materials-yard', materials_yard),
         ('trade-post', trade_post), ('farm-plot', farm_plot), ('mine', mine), ('barracks', barracks), ('range', shooting_range),
         ('stable', stable), ('siege-workshop', siege_workshop), ('aid-post', aid_post), ('tower', tower)]
# the damaged state's rubble is of the building's own stone
DAMAGE_MATS = {'mudwall': 'ashlar', 'pylon': 'ashlar'}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-classical')
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    only = [a for a in os.environ.get('ONLY', '').split(',') if a]
    items = []
    for name, fn in ROLES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
        items.append((name + '-damaged', rb.grounded(name + '-damaged', remat(rb.damaged(fn), DAMAGE_MATS)), None))
    for name, fn in STAGES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
    counts = tt.build_file('rts-classical', items, out_dir, atlas=atlas, seed=3200, write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)
    exported = [o for o in scene.objects if o.type in ('MESH', 'EMPTY')]
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-classical.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-classical.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-classical.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_CLASSICAL_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
