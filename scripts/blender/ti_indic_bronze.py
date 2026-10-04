# scripts/blender/ti_indic_bronze.py
# The Indic kit for the Bronze Age (art spec section 3b: a town is layout x kit), from the sheets
# in plans/art/kits/indic/bronze/: houses.png, street.png, roofscape.png, materials.png and the two
# landmarks. Harappan towns of the Indus valley: baked-brick houses on low paved plinths, rooms
# round an open courtyard (a tree, a grey awning on timber posts, a stair up to the flat roof),
# flat mud-plaster roofs edged with brick, reed screens and hatches on the roofs, a door under a
# cloth awning, and a covered brick drain with an inspection pit along every house front. Poor
# houses are one room behind a walled yard with a reed lean-to; rich houses add a second storey
# corner and a small bathing pool in the court.
# Landmarks: the Great Bath (a sunken pool with steps at both ends inside brick galleries and
# corner towers on a raised plinth) and the granary (a brick plinth with a front stair carrying
# timber storage bays and a slatted ventilation storey under a flat reed roof).
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `inb_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['inb_brick', 'inb_fired', 'inb_plaster', 'inb_paving', 'inb_timber', 'inb_reed', 'inb_drain', 'inb_water',
       'inb_poolbrick', 'inb_earth', 'inb_earth_fringe', 'inb_earth_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'inb_earth': 'Ground', 'inb_earth_fringe': 'Ground', 'inb_earth_square': 'Ground'})
if 'inb_earth_fringe' not in tt.FRINGES:
    tt.FRINGES.append('inb_earth_fringe')


def mat_paving(name, stone, mortar, slab):
    """Stone slabs laid flat (a brick bond on the ground plane), varied slab tones, worn joints."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = slab[0]
    br.inputs['Row Height'].default_value = slab[1]
    br.inputs['Mortar Size'].default_value = 0.003
    br.inputs['Color1'].default_value = tm._srgb(stone[0])
    br.inputs['Color2'].default_value = tm._srgb(stone[1])
    br.inputs['Mortar'].default_value = tm._srgb(mortar)
    br.offset = 0.5
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    patch = tm._noise(nt, 6.0, 4.0, 0.6)
    tint = tm._ramp(nt, patch.outputs['Fac'], [(0.35, stone[1]), (0.65, stone[2])])
    col = tm._mix(nt, 0.35, br.outputs['Color'], tint.outputs['Color'], 'OVERLAY')
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    tm._bump(nt, bsdf, br.outputs['Fac'], 0.35, 0.003)
    return mat


EARTH = ('#8c6a45', '#a07b52', '#94724a', '#7e5f3e')  # sheet 4: packed earth street


def make_materials():
    # walls (sheet 1: baked brick, the houses a warm tan-orange with patches of mud plaster left)
    tm.mat_mudwall('inb_brick', wash='#c4a072', brick='#bd7c4a', brick2='#b2703f', mortar='#c49a6e', wash_cover=0.18,
                   bond=(0.075, 0.026, 0.0045))
    # the landmarks' fired brick (pinker, light mortar), and the pool's watertight green-grey brick
    tm.mat_mudwall('inb_fired', wash='#c79a76', brick='#bf7a55', brick2='#ad6a47', mortar='#d2b08c', wash_cover=0.0,
                   bond=(0.07, 0.024, 0.0045))
    tm.mat_mudwall('inb_poolbrick', wash='#55706a', brick='#4f6a62', brick2='#425a53', mortar='#7b8a80', wash_cover=0.0,
                   bond=(0.045, 0.015, 0.0025))
    # sheet 2: mud plaster (roofs and yards)
    tm.mat_simple('inb_plaster', ['#b39060', '#c6a272', '#d2b083', '#bb9767'], scale=22.0, bump=0.4)
    mat_paving('inb_paving', stone=('#cdb48c', '#bea37b', '#d9c39d'), mortar='#9c8466', slab=(0.07, 0.05))
    # sheet 3: dark timber; sheet 7: reed mat; sheet 5: stone drain lining; sheet 6: water
    tm.mat_simple('inb_timber', ['#2c231b', '#45372a', '#3a2d22', '#544332'], scale=8.0,
                  stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 5.0}, bump=0.4)
    tm.mat_simple('inb_reed', ['#8a6e40', '#a88b54', '#c3a468', '#97794a'], scale=14.0,
                  stripes={'dir': 'X', 'scale': 160.0, 'distortion': 4.0}, bump=0.6)
    tm.mat_simple('inb_drain', ['#5f5d56', '#77756c', '#8a877d', '#5a5e4c'], scale=24.0, bump=0.7)
    tm.mat_simple('inb_water', ['#2c6862', '#3a7c75', '#4b8d84'], scale=10.0, rough=0.15, bump=0.0)
    for n in ('inb_earth', 'inb_earth_fringe'):
        tm.mat_earth(n, colors=EARTH)
    tm.mat_earth('inb_earth_square', colors=('#9c7a52', '#b08c62', '#bb9a6e', '#977450'))


if not any(n == 'indic_bronze' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('indic_bronze', make_materials))

EARTH_GROUND = dict(mat='inb_earth')  # merge into a town's ground dict


def obox(ms, mat, size, at=(0, 0, 0), frame=None, lod=2, only=None, rot_z=0.0):
    """A plain box (base at `at`) shown only at the LODs in `only`: a stand-in for LOD1 or LOD2."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = tm.Mesher._m(at, rot_z)
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, lod, m, only=only)


def rect(ms, f, mat, x0, x1, y0, y1, z, h, lod=2, bevel=0.0):
    """A box over x0..x1, y0..y1 from z up h in frame f."""
    ms.box(mat, (x1 - x0, y1 - y0, h), at=((x0 + x1) / 2, (y0 + y1) / 2, z), lod=lod, frame=f, bevel=bevel)


# ---- building parts -----------------------------------------------------------------------------

def block(ms, f, x0, x1, y0, y1, z, h, wall='inb_brick', lod=1, parapet=0.028):
    """A flat-roofed brick room block: brick walls, a mud-plaster roof inside a brick parapet."""
    rect(ms, f, wall, x0, x1, y0, y1, z, h, lod=lod, bevel=0.004)
    t = 0.014
    rect(ms, f, 'inb_plaster', x0 + t, x1 - t, y0 + t, y1 - t, z + h, 0.004, lod=lod)
    if parapet:
        for (a, b, c, e) in ((x0, x1, y0, y0 + t), (x0, x1, y1 - t, y1), (x0, x0 + t, y0 + t, y1 - t), (x1 - t, x1, y0 + t, y1 - t)):
            rect(ms, f, wall, a, b, c, e, z + h, parapet, lod=0)
    return z + h


def door(ms, f, x, y, z, w=0.075, h=0.15, steps=True):
    """A plank door in the wall face at y (the wall's front), a timber lintel and a brick step."""
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, z), lod=1, frame=f)
    ms.box('inb_timber', (w + 0.04, 0.018, 0.016), at=(x, y - 0.007, z + h), lod=0, frame=f)
    if steps:
        ms.box('inb_paving', (w + 0.05, 0.04, 0.014), at=(x, y - 0.024, z - 0.014), lod=0, frame=f)


def window(ms, f, x, y, z, face=-1, along='x'):
    """A small dark window slit in a wall face (along x: a front or back face; along y: a side)."""
    if along == 'x':
        ms.box('dark', (0.032, 0.01, 0.034), at=(x, y + face * 0.004, z), lod=0, frame=f)
    else:
        ms.box('dark', (0.01, 0.032, 0.034), at=(x + face * 0.004, y, z), lod=0, frame=f)


def awning(ms, f, x, y, w, z, depth=0.11, mat='team_cloth', posts=True):
    """A cloth awning sloping out from a wall at y (the wall's front face) over x, on two timber
    poles (the sheets' grey door awnings and court awnings)."""
    if posts:
        for sx in (-w / 2 + 0.01, w / 2 - 0.01):
            ms.cyl('inb_timber', 0.007, 0.007, z - 0.02 - G, at=(x + sx, y - depth, G), segs=5, lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y - depth / 2, z))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box(mat, (w, depth + 0.02, 0.008), at=(0, 0, 0), lod=1, frame=pf)
    ms.box(mat, (w, 0.005, 0.024), at=(x, y - depth - 0.006, z - 0.044), lod=0, frame=f)  # the valance


def tree(ms, f, x, y, z=G, s=1.0, lod=1):
    """A neem or pipal tree: a dark trunk and a round crown in two lumps."""
    ms.cyl('inb_timber', 0.012 * s, 0.009 * s, 0.15 * s, at=(x, y, z), segs=6, lod=lod, frame=f)
    ms.sphere('leaf', 0.085 * s, at=(x, y, z + 0.2 * s), scale=(1, 1, 0.8), u=8, v=5, lod=lod, frame=f)
    ms.sphere('leaf', 0.06 * s, at=(x + 0.05 * s, y - 0.025 * s, z + 0.15 * s), scale=(1, 1, 0.8), u=7, v=4, lod=0, frame=f)


def jar(ms, f, x, y, s=1.0, z=G):
    tt.jar(ms, f, x, y, s, z=z, mat='terracotta')


def bits(ms, f, x, y, rng, n=4, z=G):
    """A heap of storage jars, baskets and grain sacks round (x, y) in frame f."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.06, 0.06), y + rng.uniform(-0.045, 0.045)
        r = rng.random()
        if r < 0.5:
            jar(ms, f, px, py, rng.uniform(0.8, 1.15), z=z)
        elif r < 0.75:
            tt.basket(ms, f, px, py, rng.uniform(0.9, 1.2), z=z)
        else:
            ms.sphere('linen', 0.03, at=(px, py, z + 0.02), scale=(1.1, 0.9, 0.75), u=7, v=5, lod=0, frame=f)  # a sack


def reed_screen(ms, f, x, y, z, w=0.16, d=0.1, h=0.08, lod=0):
    """A roof shelter: four timber poles and a flat reed mat (the sheets' rooftop screens)."""
    for sx in (-w / 2 + 0.008, w / 2 - 0.008):
        for sy in (-d / 2 + 0.008, d / 2 - 0.008):
            ms.box('inb_timber', (0.01, 0.01, h), at=(x + sx, y + sy, z), lod=lod, frame=f)
    ms.box('inb_reed', (w + 0.02, d + 0.02, 0.01), at=(x, y, z + h), lod=1 if lod == 0 else lod, frame=f)


def hatch(ms, f, x, y, z):
    """A roof hatch: a raised brick curb round a dark opening with a timber grille."""
    ms.box('inb_brick', (0.06, 0.06, 0.014), at=(x, y, z), lod=0, frame=f)
    ms.box('dark', (0.042, 0.042, 0.004), at=(x, y, z + 0.012), lod=0, frame=f)
    for k in (-1, 0, 1):
        ms.box('inb_timber', (0.044, 0.005, 0.005), at=(x, y + k * 0.013, z + 0.016), lod=0, frame=f)


def stair(ms, f, x, y0, y1, z0, z1, w=0.06, n=6, axis='y', wall='inb_brick'):
    """Steps climbing from (x, y0) at z0 to (x, y1) at z1 along the frame's Y (or X)."""
    run = (y1 - y0) / n
    for k in range(n):
        sz = (k + 1) * (z1 - z0) / n
        c = y0 + (k + 0.5) * run
        size = (w, abs(run) + 0.002, sz) if axis == 'y' else (abs(run) + 0.002, w, sz)
        at = (x, c, z0) if axis == 'y' else (c, x, z0)
        ms.box(wall, size, at=at, lod=0, frame=f)


def drain(ms, f, x0, x1, y, pit=None, lod=1):
    """The covered street drain along a house front: two stone curbs, water between them, brick
    cover slabs over part of it and a square inspection pit."""
    length = x1 - x0
    cx = (x0 + x1) / 2
    for sy in (-1, 1):
        ms.box('inb_drain', (length, 0.012, 0.012), at=(cx, y + sy * 0.019, G), lod=lod, frame=f)
    ms.box('inb_water', (length, 0.028, 0.005), at=(cx, y, G + 0.002), lod=lod, frame=f)
    px = cx if pit is None else pit
    ms.box('inb_brick', (0.05, 0.055, 0.024), at=(px, y, G), lod=lod, frame=f)
    ms.box('dark', (0.03, 0.03, 0.003), at=(px, y, G + 0.023), lod=0, frame=f)
    for sx in (-1, 1):  # cover slabs either side of the pit
        ms.box('inb_drain', (0.07, 0.05, 0.006), at=(px + sx * 0.07, y, G + 0.011), lod=0, frame=f)


def court_awning(ms, f, x0, x1, y, z, depth=0.07, posts=3):
    """A grey awning along a court face (the wall at y, the court toward -Y) on timber posts."""
    w = x1 - x0
    for i in range(posts):
        px = x0 + 0.015 + (w - 0.03) * i / max(1, posts - 1)
        ms.cyl('inb_timber', 0.008, 0.008, z - G - PLINTH, at=(px, y - depth, G + PLINTH), segs=6, lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector(((x0 + x1) / 2, y - depth / 2, z))) @ Matrix.Rotation(math.radians(-12), 4, 'X')
    ms.box('team_cloth', (w, depth + 0.024, 0.008), at=(0, 0, 0), lod=1, frame=pf)


# ---- houses -------------------------------------------------------------------------------------
# Every house fills its base plot (w x d, local -Y the front facing the town centre), standing on
# a low paved plinth with the drain along its front, so the roofscape keeps the base town's rhythm.

PLINTH = 0.022


def _plinth(ms, f, w, d, drain_front=True, rng=None):
    rect(ms, f, 'inb_paving', -w / 2, w / 2, -d / 2, d / 2, G - 0.006, PLINTH + 0.006, lod=1)
    if drain_front:
        drain(ms, f, -w / 2, w / 2, -d / 2 - 0.04, pit=(rng.uniform(-0.25, 0.25) * w if rng else None))
    return G + PLINTH


def _stand_in(ms, f, w, d, h, inset=0.015):
    """The LOD2 stand-in: one brick block with a plaster top over the whole house."""
    obox(ms, 'inb_brick', (w - 2 * inset, d - 2 * inset, h + PLINTH), at=(0, 0, G - 0.004), lod=2, only=2, frame=f)
    obox(ms, 'inb_plaster', (w - 2 * inset - 0.02, d - 2 * inset - 0.02, 0.006), at=(0, 0, G + PLINTH + h - 0.004),
         lod=2, only=2, frame=f)


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, yard=0.0):
    """The poor house (houses sheet, left; street sheet, bottom row): one brick room at the back of
    the plot under a flat plaster roof with a reed screen, a door with a grey awning, and a walled
    front yard with a reed lean-to, jars and baskets."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    z0 = _plinth(ms, f, w, d, rng=rng)
    W, D, m = w / 2, d / 2, 0.012
    h = 0.27
    rd = max(0.26, 0.56 * d)
    y0 = D - m - rd
    top = block(ms, f, -W + m, W - m, y0, D - m, z0, h)
    side = side if side is not None else rng.choice([-1, 1])
    dx = side * 0.18 * w
    door(ms, f, dx, y0, z0, steps=False)
    awning(ms, f, dx, y0, 0.13, z0 + 0.18, depth=0.09)
    window(ms, f, -dx * 0.2 - side * 0.22 * w, y0, z0 + 0.17)
    window(ms, f, rng.uniform(-0.2, 0.2) * w, D - m, z0 + 0.18, face=1)
    # the walled yard in front
    yh, t = 0.15, 0.024
    rect(ms, f, 'inb_plaster', -W + m, W - m, -D + m, y0, z0, 0.003, lod=1)
    rect(ms, f, 'inb_brick', -W + m, -W + m + t, -D + m, y0, z0, yh, lod=1)
    rect(ms, f, 'inb_brick', W - m - t, W - m, -D + m, y0, z0, yh, lod=1)
    gx = -side * 0.12 * w
    rect(ms, f, 'inb_brick', -W + m, gx - 0.05, -D + m, -D + m + t, z0, yh, lod=1)
    rect(ms, f, 'inb_brick', gx + 0.05, W - m, -D + m, -D + m + t, z0, yh, lod=1)
    # a reed lean-to against the house on the far side, jars by the door
    lx = -side * (W - m - 0.1)
    lean_to(ms, f, lx, y0 - 0.06, w=0.17, d=0.1, z=z0)
    bits(ms, f, side * (W - 0.1), (-D + y0) / 2, rng, 3, z=z0)
    reed_screen(ms, f, -side * 0.2 * w, (y0 + D) / 2 + 0.02, top, w=0.15, d=0.1)
    if rng.random() < 0.6:
        hatch(ms, f, side * 0.25 * w, (y0 + D) / 2, top)
    _stand_in(ms, f, w, rd + 0.02, h)
    if yard > 0:
        back_yard(ms, rng, f, w, d, yard)
    return f


def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, side=None, yard=0.0, pool=None, upper=None,
                tree_in=True, awn=True):
    """The courtyard house (houses sheet, middle and right): rooms on three or four sides of an
    open paved court (a tree, a grey awning on posts along the back range, a stair to the roof),
    a front range with the door under its awning, flat plaster roofs with parapets, reed screens
    and hatches. `rich` adds rooms on both sides, a second storey corner and a bathing pool."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    z0 = _plinth(ms, f, w, d, rng=rng)
    W, D, m = w / 2, d / 2, 0.012
    h = 0.31 if rich else 0.28
    fd = max(0.11, 0.2 * d)
    bd = max(0.13, 0.3 * d)
    sw = max(0.12, 0.27 * w)
    side = side if side is not None else rng.choice([-1, 1])
    yf, yb = -D + m + fd, D - m - bd
    tops = {}
    tops['front'] = block(ms, f, -W + m, W - m, -D + m, yf, z0, h * 0.85)
    tops['back'] = block(ms, f, -W + m, W - m, yb, D - m, z0, h)
    xa, xb = sorted((side * (W - m), side * (W - m - sw)))
    tops['side'] = block(ms, f, xa, xb, yf, yb, z0, h * 0.95)
    if rich:
        ow = max(0.1, 0.2 * w)
        oa, ob = sorted((-side * (W - m), -side * (W - m - ow)))
        block(ms, f, oa, ob, yf, yb, z0, h * 0.85)
        cx0, cx1 = sorted((side * (W - m - sw), -side * (W - m - ow)))
    else:
        t = 0.026
        oa, ob = sorted((-side * (W - m), -side * (W - m - t)))
        rect(ms, f, 'inb_brick', oa, ob, yf, yb, z0, h * 0.8, lod=1)
        cx0, cx1 = sorted((side * (W - m - sw), -side * (W - m - t)))
    # the court
    ccx, ccy = (cx0 + cx1) / 2, (yf + yb) / 2
    cw = cx1 - cx0
    if awn:
        court_awning(ms, f, cx0 + 0.01, cx1 - 0.01, yb, z0 + h * 0.62, posts=3 if cw > 0.25 else 2)
    if pool or (pool is None and rich):
        pw, pd = min(0.16, cw * 0.5), min(0.11, (yb - yf) * 0.45)
        px = ccx - side * (cw / 2 - pw / 2 - 0.035)
        rect(ms, f, 'inb_poolbrick', px - pw / 2 - 0.012, px + pw / 2 + 0.012, ccy - pd / 2 - 0.012, ccy + pd / 2 + 0.012, z0, 0.012, lod=1)
        rect(ms, f, 'inb_water', px - pw / 2, px + pw / 2, ccy - pd / 2, ccy + pd / 2, z0, 0.014, lod=1)
        if tree_in:
            tree(ms, f, ccx + side * (cw / 2 - 0.06), ccy, z=z0, s=0.8)
    elif tree_in:
        rect(ms, f, 'inb_brick', ccx - 0.045, ccx + 0.045, ccy - 0.045, ccy + 0.045, z0, 0.018, lod=0)  # the tree's brick bed
        tree(ms, f, ccx, ccy, z=z0 + 0.018, s=0.9)
    # the stair up the court's open side to the roof
    sx = (cx1 - 0.035) if side < 0 else (cx0 + 0.035)
    if not rich:
        stair(ms, f, sx, yf + 0.02, yb - 0.02, z0, z0 + h * 0.8, w=0.05, n=6)
    else:
        bits(ms, f, sx, yf + 0.06, rng, 2, z=z0)
    # the door, its awning, windows
    dx = rng.uniform(-0.12, 0.12) * w
    door(ms, f, dx, -D + m, z0, w=0.08 if rich else 0.072, h=0.15 if rich else 0.14)
    awning(ms, f, dx, -D + m, 0.16 if rich else 0.13, z0 + 0.19, depth=0.1)
    for wx in (-0.3 * w, 0.3 * w):
        if abs(wx - dx) > 0.1:
            window(ms, f, wx, -D + m, z0 + 0.17)
    window(ms, f, rng.uniform(-0.25, 0.25) * w, D - m, z0 + 0.19, face=1)
    window(ms, f, side * (W - m), ccy, z0 + 0.18, face=side, along='y')
    for k in range(rng.randint(1, 2)):
        jar(ms, f, dx + (0.11 + 0.05 * k) * (1 if dx < 0 else -1), -D - 0.008, rng.uniform(0.85, 1.1))
    # the roofs: a reed screen, a hatch, jars
    top = tops['back']
    if upper or (upper is None and rich):  # a second storey room over one corner of the back range
        ux0, ux1 = sorted((side * (W - m), side * (W - m - max(0.2, 0.42 * w))))
        top2 = block(ms, f, ux0, ux1, yb + 0.01, D - m, top, 0.22)
        door(ms, f, (ux0 + ux1) / 2, yb + 0.01, top, w=0.06, h=0.12, steps=False)
        hatch(ms, f, (ux0 + ux1) / 2, (yb + D) / 2, top2)
        reed_screen(ms, f, -side * 0.22 * w, (yb + D) / 2, top, w=0.17, d=min(0.11, bd - 0.04))
    else:
        reed_screen(ms, f, side * 0.15 * w, (yb + D) / 2, top, w=min(0.2, 0.3 * w), d=min(0.11, bd - 0.04))
        hatch(ms, f, -side * 0.25 * w, (yb + D) / 2, top)
    if rng.random() < 0.6:
        jar(ms, f, (xa + xb) / 2, (yf + yb) / 2 + 0.03, 0.85, z=tops['side'])
        jar(ms, f, (xa + xb) / 2 + 0.03, (yf + yb) / 2 - 0.02, 0.75, z=tops['side'])
    _stand_in(ms, f, w, d, h * (1.15 if rich else 1.0))
    if yard > 0:
        back_yard(ms, rng, f, w, d, yard)
    return f


def back_yard(ms, rng, f, w, d, yard):
    """A brick-walled yard behind the house (toward the town's edge) with a reed lean-to, jars or
    a tree in it."""
    y0, y1, yh, t = d / 2, d / 2 + yard, 0.13, 0.022
    rect(ms, f, 'inb_brick', -w / 2 + 0.01, -w / 2 + 0.01 + t, y0, y1, G, yh, lod=1)
    rect(ms, f, 'inb_brick', w / 2 - 0.01 - t, w / 2 - 0.01, y0, y1, G, yh, lod=1)
    rect(ms, f, 'inb_brick', -w / 2 + 0.01, w / 2 - 0.01, y1 - t, y1, G, yh, lod=1)
    rect(ms, f, 'inb_plaster', -w / 2 + 0.03, w / 2 - 0.03, y0, y1 - t, G, 0.003, lod=1)
    r = rng.random()
    cy = (y0 + y1) / 2
    if r < 0.45:
        lean_to(ms, f, -w * 0.2, cy + 0.02, w=0.2, d=0.1, z=G, yaw=180)
        bits(ms, f, w * 0.25, cy, rng, 2)
    elif r < 0.75:
        tree(ms, f, w * 0.22, cy, s=0.9)
        bits(ms, f, -w * 0.2, cy, rng, 3)
    else:
        kiln(ms, f, w * 0.2, cy, s=0.8)
        bits(ms, f, -w * 0.22, cy, rng, 2)


# ---- the street: lean-tos, kilns, wells, carts, stalls, the gate ---------------------------------

def lean_to(ms, f, x, y, w=0.2, d=0.12, z=G, yaw=0.0):
    """A reed lean-to (street sheet, bottom row): timber posts, a sloping reed-mat roof, jars."""
    lf = f @ Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
    hf, hb = 0.13, 0.16
    for sx in (-w / 2 + 0.01, w / 2 - 0.01):
        ms.box('inb_timber', (0.012, 0.012, hf), at=(sx, -d / 2 + 0.008, z), lod=0, frame=lf)
        ms.box('inb_timber', (0.012, 0.012, hb), at=(sx, d / 2 - 0.008, z), lod=0, frame=lf)
    slope = math.degrees(math.atan2(hb - hf, d))
    rf = lf @ Matrix.Translation(Vector((0, 0, z + (hf + hb) / 2 + 0.006))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box('inb_reed', (w + 0.03, d + 0.04, 0.012), at=(0, 0, 0), lod=1, frame=rf)
    jar(ms, lf, -w * 0.2, 0.0, 0.9, z=z)
    jar(ms, lf, w * 0.15, 0.01, 1.0, z=z)


def shed(ms, x, y, yaw=0.0):
    """A free-standing reed lean-to in the street."""
    lean_to(ms, tm.house_frame(x, y, yaw), 0, 0, w=0.24, d=0.13)


def kiln_at(ms, x, y, yaw=0.0):
    kiln(ms, tm.house_frame(x, y, yaw), 0, 0)


def tree_at(ms, x, y, s=1.0):
    tree(ms, tm.house_frame(x, y, 0), 0, 0, s=s)


def kiln(ms, f, x, y, s=1.0, z=G):
    """A round brick pottery kiln: a squat tapering drum, a dark firing mouth, a stack of fuel."""
    ms.cyl('inb_fired', 0.06 * s, 0.035 * s, 0.09 * s, at=(x, y, z), segs=10, lod=1, frame=f)
    ms.cyl('dark', 0.025 * s, 0.025 * s, 0.004, at=(x, y, z + 0.09 * s), segs=8, lod=0, frame=f)
    ms.box('dark', (0.03 * s, 0.01, 0.03 * s), at=(x, y - 0.056 * s, z), lod=0, frame=f)
    for k in range(3):
        ms.cyl('inb_timber', 0.009, 0.009, 0.08 * s, at=(x + 0.08 * s, y - 0.03 + 0.018 * k, z + 0.009), rot=(0, 90, 0), segs=5, lod=0,
               frame=f)


def well(ms, x, y, yaw=20):
    """The brick-lined round well with a raised brick ring, water, a timber pulley frame."""
    f = tm.house_frame(x, y, yaw)
    ms.cyl('inb_fired', 0.085, 0.085, 0.055, at=(0, 0, G), segs=14, lod=1, frame=f)
    ms.cyl('inb_water', 0.064, 0.064, 0.004, at=(0, 0, G + 0.053), segs=12, lod=0, frame=f)
    ms.cyl('inb_paving', 0.14, 0.14, 0.008, at=(0, 0, G - 0.004), segs=14, lod=1, frame=f)
    for sx in (-0.1, 0.1):
        ms.box('inb_timber', (0.016, 0.016, 0.19), at=(sx, 0, G), lod=0, frame=f)
    ms.box('inb_timber', (0.23, 0.014, 0.014), at=(0, 0, G + 0.19), lod=0, frame=f)
    jar(ms, f, 0.12, -0.06, 0.9)
    return f


def cart(ms, x, y, yaw=0.0):
    """An ox cart (the Harappan clay models): a plank bed on two solid wheels, a long shaft."""
    f = tm.house_frame(x, y, yaw)
    ms.box('inb_timber', (0.13, 0.08, 0.025), at=(0, 0, G + 0.035), lod=1, frame=f)
    for sx in (-0.065, 0.065):
        ms.box('inb_timber', (0.008, 0.08, 0.03), at=(sx, 0, G + 0.06), lod=0, frame=f)
    for sy in (-1, 1):
        ms.cyl('inb_timber', 0.04, 0.04, 0.012, at=(0, sy * 0.046, G + 0.04), rot=(sy * 90, 0, 0), segs=10, lod=1, frame=f)
    ms.box('inb_timber', (0.16, 0.012, 0.012), at=(-0.14, 0, G + 0.03), lod=0, frame=f)
    jar(ms, f, -0.02, 0.0, 0.75, z=G + 0.06)
    tt.basket(ms, f, 0.03, 0.01, 0.9, z=G + 0.06)
    return f


def drying_rack(ms, x, y, yaw=0.0):
    """A reed-mat drying rack on two timber trestles, cloth and grain spread on it."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-0.08, 0.08):
        for s in (-1, 1):
            ms.box('inb_timber', (0.01, 0.01, 0.09), at=(sx, 0, G), lod=0, frame=f @ Matrix.Rotation(math.radians(s * 14), 4, 'X'))
    ms.box('inb_reed', (0.2, 0.1, 0.01), at=(0, 0, G + 0.085), lod=1, frame=f)
    ms.box('linen', (0.08, 0.07, 0.006), at=(0.04, 0, G + 0.095), lod=0, frame=f)


def stall(ms, x, y, rng, yaw=None, cloth='team_cloth', w=0.28, d=0.2):
    """A market stall: a brick counter, four timber poles and a cloth (team cloth or reed mat)
    canopy, pots, bead baskets and a grain sack on the counter."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hf, hb = 0.18, 0.22
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('inb_timber', (0.013, 0.013, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('inb_timber', (0.013, 0.013, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    cf = f @ Matrix.Translation(Vector((0, 0, G + (hf + hb) / 2 + 0.008))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(cloth, (w + 0.04, d + 0.05, 0.008), at=(0, 0, 0), lod=1, frame=cf)
    if cloth == 'team_cloth':
        ms.box(cloth, (w + 0.04, 0.005, 0.035), at=(0, -d / 2 - 0.025, G + hf - 0.03), lod=0, frame=f)
    ms.box('inb_brick', (w - 0.03, d * 0.42, 0.065), at=(0, -d * 0.18, G), lod=0, frame=f, bevel=0.003)
    for k in range(3):
        gx = -w / 2 + 0.055 + k * (w - 0.11) / 2
        r = rng.random()
        if r < 0.4:
            tt.basket(ms, f, gx, -d * 0.18, 0.8, z=G + 0.065)
        elif r < 0.7:
            jar(ms, f, gx, -d * 0.18, 0.6, z=G + 0.065)
        else:
            ms.sphere('linen', 0.026, at=(gx, -d * 0.18, G + 0.083), scale=(1.1, 0.9, 0.75), u=7, v=5, lod=0, frame=f)
    jar(ms, f, w / 2 + 0.03, -d / 2, rng.uniform(0.9, 1.15))


def brick_gate(ms, rng, x, y, yaw=0.0, width=0.32, h=0.5):
    """The town gate (the Harappan brick gateways): two square brick bastions with parapets, a
    timber lintel over the passage, a team pennant, low brick wall stubs to either side."""
    f = tm.house_frame(x, y, yaw)
    tw = 0.24
    for sx in (-1, 1):
        cx = sx * (width / 2 + tw / 2)
        block(ms, f, cx - tw / 2, cx + tw / 2, -0.12, 0.12, G, h, wall='inb_fired', lod=2)
        window(ms, f, cx, -0.12, G + h * 0.7)
        rect(ms, f, 'inb_fired', cx + sx * tw / 2, cx + sx * (tw / 2 + 0.36), -0.04, 0.04, G, 0.2, lod=1)
    ms.box('inb_timber', (width + 0.06, 0.2, 0.04), at=(0, 0, G + h * 0.62), lod=1, frame=f)
    rect(ms, f, 'inb_fired', -width / 2, width / 2, -0.1, 0.1, G + h * 0.62 + 0.04, h * 0.38 - 0.04, lod=2)
    rect(ms, f, 'inb_paving', -width / 2, width / 2, -0.16, 0.16, G - 0.004, 0.008, lod=1)
    px = -(width / 2 + tw / 2)
    ms.cyl('inb_timber', 0.009, 0.007, 0.22, at=(px, 0, G + h + 0.028), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, px, 0, G + h + 0.245, yaw=-160, w=0.2, h=0.12)
    awning(ms, f, width / 2 + tw / 2, -0.12, 0.16, G + 0.2, depth=0.08)


# ---- landmark 1: the Great Bath -----------------------------------------------------------------

def _column(ms, f, x, y, z, h, r=0.016, lod=0):
    """A round brick column with a timber capital block."""
    ms.cyl('inb_fired', r, r, h - 0.012, at=(x, y, z), segs=8, lod=lod, frame=f)
    ms.box('inb_timber', (r * 2.6, r * 2.6, 0.012), at=(x, y, z + h - 0.012), lod=0, frame=f)


def _lattice(ms, f, x, y, z, w, d, n=3):
    """The timber roof lattice over a tower's open room (the sheets' hardwood roof beams)."""
    for k in range(n):
        ms.box('inb_timber', (w, 0.012, 0.012), at=(x, y - d / 2 + d * (k + 0.5) / n, z), lod=0, frame=f)
        ms.box('inb_timber', (0.012, d, 0.012), at=(x - w / 2 + w * (k + 0.5) / n, y, z + 0.012), lod=0, frame=f)


def great_bath(ms, rng, x, y, w=3.7, d=3.3, yaw=None):
    """The Great Bath (sheet: 37 x 33 m, 5.2 m to the tower tops, the pool 18 m and 2.4 m deep):
    a raised fired-brick plinth with steps up at the two front corners, a paved deck round a
    sunken pool of watertight green-grey brick with steps down at both ends, galleries of brick
    columns under flat roofs on the west, east and north with grey awnings, square corner towers
    with doorways (the front pair) and timber roof lattices. Smaller sizes keep the parts."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    s = min(w / 3.7, d / 3.3)
    hs = min(1.0, 0.72 + 0.28 * s)
    W, D = w / 2, d / 2
    ph = 0.09 * hs                       # the plinth (about 1 m)
    z1 = G + ph
    top = 0.52 * hs                      # the towers' tops
    th = top - ph                        # tower height above the deck
    gh = th * 0.72                       # gallery height
    tw, td = max(0.2, 0.2 * w), max(0.2, 0.2 * d)
    gd = max(0.13, 0.14 * w)             # gallery depth (west and east), north gallery the same
    # the pool, centred between the galleries, a little toward the front
    px0, px1 = -W + gd + 0.07, W - gd - 0.07
    py0, py1 = -D + 0.16 * d, D - gd - 0.08
    pw, pd = px1 - px0, py1 - py0
    # the plinth and deck: four slabs round the pool's hole
    for (a, b, c, e) in ((-W, W, -D, py0), (-W, W, py1, D), (-W, px0, py0, py1), (px1, W, py0, py1)):
        rect(ms, f, 'inb_fired', a, b, c, e, G - 0.004, ph + 0.004 - 0.008, lod=2)
        rect(ms, f, 'inb_paving', a + (0.01 if a == -W else 0), b - (0.01 if b == W else 0), c + (0.01 if c == -D else 0),
             e - (0.01 if e == D else 0), z1 - 0.008, 0.008, lod=1)
    # the pool: a green-grey lining, the floor, the water, a stepped coping and stairs at both ends
    depth = ph - 0.01
    zf = z1 - depth
    rect(ms, f, 'inb_poolbrick', px0, px1, py0, py1, G - 0.004, zf - G + 0.004, lod=2)
    for (a, b, c, e) in ((px0, px1, py0, py0 + 0.012), (px0, px1, py1 - 0.012, py1), (px0, px0 + 0.012, py0, py1), (px1 - 0.012, px1, py0, py1)):
        rect(ms, f, 'inb_poolbrick', a, b, c, e, zf, depth - 0.004, lod=1)
    rect(ms, f, 'inb_water', px0 + 0.012, px1 - 0.012, py0 + 0.012, py1 - 0.012, zf, depth * 0.55, lod=2)
    cop = 0.035
    for (a, b, c, e) in ((px0 - cop, px1 + cop, py0 - cop, py0), (px0 - cop, px1 + cop, py1, py1 + cop), (px0 - cop, px0, py0, py1),
                         (px1, px1 + cop, py0, py1)):
        rect(ms, f, 'inb_poolbrick', a, b, c, e, z1 - 0.006, 0.01, lod=1)
    sw = min(0.4 * pw, 0.5)
    for sgn, (ya, yb_) in ((1, (py0 + 0.012, py0 + 0.012 + 0.16 * pd)), (-1, (py1 - 0.012, py1 - 0.012 - 0.16 * pd))):
        n = 5
        for k in range(n):  # stepping down from the deck into the pool
            yy0 = ya + (yb_ - ya) * k / n
            yy1 = ya + (yb_ - ya) * (k + 1) / n
            ms.box('inb_poolbrick', (sw, abs(yy1 - yy0) + 0.002, (depth - 0.004) * (n - k) / n), at=(0, (yy0 + yy1) / 2, zf),
                   lod=0, frame=f)
        obox(ms, 'inb_poolbrick', (sw, abs(yb_ - ya), depth * 0.5), at=(0, (ya + yb_) / 2, zf), frame=f, lod=1, only=1)
    # the corner towers
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * (W - tw / 2), sy * (D - td / 2)
            ttop = block(ms, f, cx - tw / 2, cx + tw / 2, cy - td / 2, cy + td / 2, z1, th, wall='inb_fired', lod=2, parapet=0.03)
            if sy < 0:
                door(ms, f, cx, cy - td / 2, z1, w=0.07, h=0.17 * hs, steps=False)
                window(ms, f, cx + sx * 0.06, cy - td / 2, z1 + th * 0.75)
            else:
                _lattice(ms, f, cx, cy, ttop + 0.02, tw * 0.7, td * 0.7)
            window(ms, f, cx + sx * tw / 2, cy, z1 + th * 0.7, face=sx, along='y')
    # front corner stairs up the plinth
    for sx in (-1, 1):
        cx = sx * (W - tw / 2)
        n = 4
        for k in range(n):
            ms.box('inb_fired', (tw * 0.7, 0.03, ph * (k + 1) / n), at=(cx, -D - 0.12 + 0.03 * k + 0.015, G - 0.004), lod=0, frame=f)
        obox(ms, 'inb_fired', (tw * 0.7, 0.12, ph * 0.55), at=(cx, -D - 0.06, G - 0.004), frame=f, lod=1, only=1)
    # the galleries: west and east between the towers, the north between the back towers
    ncol = max(3, round((d - 2 * td) / 0.28))
    for sx in (-1, 1):
        xo = sx * W
        xi = sx * (W - gd)
        a, b = sorted((xo, xo - sx * 0.05))
        rect(ms, f, 'inb_fired', a, b, -D + td, D - td, z1, gh, lod=2)   # the outer wall
        for k in range(max(2, round((d - 2 * td) / 0.4))):
            yy = -D + td + (d - 2 * td) * (k + 0.5) / max(2, round((d - 2 * td) / 0.4))
            window(ms, f, xo, yy, z1 + gh * 0.65, face=sx, along='y')
        a, b = sorted((xo, xi - sx * 0.01))
        block(ms, f, a, b, -D + td, D - td, z1 + gh, 0.03, wall='inb_fired', lod=2, parapet=0.02)  # the roof slab
        for k in range(ncol):
            yy = -D + td + 0.06 + (d - 2 * td - 0.12) * k / (ncol - 1)
            _column(ms, f, xi, yy, z1, gh, lod=1 if k % 2 == 0 else 0)
        for k in range(2):  # awnings hung from the gallery edge
            yy = -D + td + (d - 2 * td) * (0.3 + 0.4 * k)
            af = f @ Matrix.Translation(Vector((xi - sx * 0.04, yy, z1 + gh * 0.82))) @ Matrix.Rotation(math.radians(sx * 16), 4, 'Y')
            ms.box('team_cloth', (0.09, min(0.22, 0.12 * d), 0.008), at=(0, 0, 0), lod=1, frame=af)
    yo, yi = D, D - gd
    rect(ms, f, 'inb_fired', -W + tw, W - tw, yo - 0.05, yo, z1, gh, lod=2)
    block(ms, f, -W + tw, W - tw, yi - 0.01, yo, z1 + gh, 0.03, wall='inb_fired', lod=2, parapet=0.02)
    ncn = max(3, round((w - 2 * tw) / 0.28))
    for k in range(ncn):
        xx = -W + tw + 0.06 + (w - 2 * tw - 0.12) * k / (ncn - 1)
        _column(ms, f, xx, yi, z1, gh, lod=1 if k % 2 == 0 else 0)
        window(ms, f, xx, yo, z1 + gh * 0.65, face=1)
    for k in range(2):
        xx = -W + tw + (w - 2 * tw) * (0.3 + 0.4 * k)
        af = f @ Matrix.Translation(Vector((xx, yi - 0.04, z1 + gh * 0.82))) @ Matrix.Rotation(math.radians(-16), 4, 'X')
        ms.box('team_cloth', (min(0.22, 0.12 * w), 0.09, 0.008), at=(0, 0, 0), lod=1, frame=af)
    # a low parapet along the front between the towers, a gap at the middle
    for sx in (-1, 1):
        a, b = sorted((sx * (W - tw), sx * 0.2 * W))
        rect(ms, f, 'inb_fired', a, b, -D, -D + 0.025, z1, 0.05, lod=1)
    for (jx, jy) in ((-W + gd + 0.05, py0 - 0.05), (W - gd - 0.05, py1 + 0.03)):
        jar(ms, f, jx, jy, 1.0, z=z1)
    return f


# ---- landmark 2: the granary ----------------------------------------------------------------------

def granary(ms, rng, x, y, w=1.8, d=1.0, yaw=None):
    """The granary (sheet: 18 x 10 m; a 3 m brick plinth, 3.5 m of storage bays, 2.5 m of slatted
    ventilation storey): a baked-brick plinth with pilasters and a central front stair, timber
    posts framing the bays (brick back walls, plank doors, a grey awning over each), a slatted
    timber storey above and a flat reed-mat roof on timber beams. Smaller sizes keep the parts."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    s = min(w / 1.8, d / 1.0)
    hs = min(1.0, 0.72 + 0.28 * s)
    W, D = w / 2, d / 2
    stair_d = 0.16 * d
    pD0 = -D + stair_d                   # the plinth's front (the stair projects in front of it)
    ph = 0.3 * hs
    bh = 0.35 * hs
    vh = 0.25 * hs
    z1 = G + ph
    rect(ms, f, 'inb_fired', -W, W, pD0, D, G - 0.004, ph + 0.004, lod=2, bevel=0.005)
    rect(ms, f, 'inb_fired', -W - 0.012, W + 0.012, pD0 - 0.012, D + 0.012, G - 0.004, 0.03, lod=1)  # the footing course
    npil = 4
    for k in range(npil):  # pilasters on the front and the back
        px = -W + 0.03 + (w - 0.06) * k / (npil - 1)
        for (yy, sgn) in ((pD0, -1), (D, 1)):
            ms.box('inb_fired', (0.05, 0.02, ph), at=(px, yy + sgn * 0.006, G - 0.004), lod=0, frame=f)
    # the front stair, with brick cheeks
    sw = max(0.16, 0.22 * w)
    n = 9
    for k in range(n):
        yy = -D + stair_d * k / n
        ms.box('inb_fired', (sw, stair_d / n + 0.002, ph * (k + 1) / n), at=(0, yy + stair_d / n / 2, G - 0.004), lod=0, frame=f)
    obox(ms, 'inb_fired', (sw, stair_d, ph * 0.55), at=(0, -D + stair_d / 2, G - 0.004), frame=f, lod=1, only=1)
    for sx in (-1, 1):
        ms.box('inb_fired', (0.03, stair_d, ph * 0.6), at=(sx * (sw / 2 + 0.015), -D + stair_d / 2, G - 0.004), lod=1, frame=f)
    # the storage bays: a brick core between timber posts, doors and awnings
    m = 0.05 * max(0.7, s)
    x0, x1, y0, y1 = -W + m, W - m, pD0 + m, D - m
    nb = max(3, min(6, round((x1 - x0) / 0.27)))
    rect(ms, f, 'inb_fired', x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02, z1, bh, lod=2)
    rect(ms, f, 'inb_plaster', -W + 0.01, W - 0.01, pD0 + 0.01, D - 0.01, z1, 0.004, lod=1)  # the deck
    bw = (x1 - x0) / nb
    for k in range(nb + 1):
        px = x0 + bw * k
        for yy in (y0, y1):
            ms.box('inb_timber', (0.032, 0.032, bh + vh), at=(px, yy, z1), lod=1, frame=f, bevel=0.003)
    for yy in (y0 + (y1 - y0) / 3, y0 + 2 * (y1 - y0) / 3):  # the side posts
        for px in (x0, x1):
            ms.box('inb_timber', (0.032, 0.032, bh + vh), at=(px, yy, z1), lod=1, frame=f)
    for k in range(nb):
        bx = x0 + bw * (k + 0.5)
        ms.box('door', (bw * 0.55, 0.01, bh * 0.68), at=(bx, y0 + 0.016, z1), lod=0, frame=f)
        ms.box('inb_timber', (0.008, 0.012, bh * 0.68), at=(bx, y0 + 0.012, z1), lod=0, frame=f)
        af = f @ Matrix.Translation(Vector((bx, y0 - 0.025, z1 + bh * 0.9))) @ Matrix.Rotation(math.radians(-20), 4, 'X')
        ms.box('team_cloth', (bw * 0.82, 0.07, 0.008), at=(0, 0, 0), lod=1, frame=af)
        ms.box('team_cloth', (bw * 0.82, 0.005, 0.03), at=(bx, y0 - 0.058, z1 + bh * 0.9 - 0.04), lod=0, frame=f)
    # the slatted ventilation storey: a dark core behind horizontal slats on every face
    zv = z1 + bh
    rect(ms, f, 'dark', x0 + 0.014, x1 - 0.014, y0 + 0.014, y1 - 0.014, zv, vh, lod=2)
    ms.box('inb_timber', (x1 - x0 + 0.03, y1 - y0 + 0.03, 0.026), at=(0, (y0 + y1) / 2, zv - 0.004), lod=1, frame=f)  # the floor beam
    nsl = 4
    for k in range(nsl):
        zz = zv + 0.035 + (vh - 0.07) * k / (nsl - 1)
        for (yy, ww, dd) in (((y0 + y1) / 2 - (y1 - y0) / 2 + 0.008, x1 - x0, 0.012), ((y0 + y1) / 2 + (y1 - y0) / 2 - 0.008, x1 - x0, 0.012)):
            ms.box('inb_timber', (ww, dd, 0.018), at=(0, yy, zz), lod=0 if k % 2 else 1, frame=f)
        for xx in (x0 + 0.008, x1 - 0.008):
            ms.box('inb_timber', (0.012, y1 - y0, 0.018), at=(xx, (y0 + y1) / 2, zz), lod=0 if k % 2 else 1, frame=f)
    # the roof: a top beam ring, a flat reed-mat roof, timber beams across it
    zr = zv + vh
    ms.box('inb_timber', (x1 - x0 + 0.05, y1 - y0 + 0.05, 0.03), at=(0, (y0 + y1) / 2, zr - 0.012), lod=2, frame=f)
    ms.box('inb_reed', (x1 - x0 + 0.04, y1 - y0 + 0.04, 0.02), at=(0, (y0 + y1) / 2, zr + 0.018), lod=1, frame=f)
    for k in range(nb + 1):
        px = x0 + bw * k
        ms.box('inb_timber', (0.026, y1 - y0 + 0.08, 0.024), at=(px, (y0 + y1) / 2, zr + 0.032), lod=0, frame=f)
    for yy in (y0 - 0.01, y1 + 0.01):
        ms.box('inb_timber', (x1 - x0 + 0.08, 0.026, 0.024), at=(0, yy, zr + 0.036), lod=0, frame=f)
    for k in range(3):
        jar(ms, f, -sw / 2 - 0.1 - 0.05 * k, -D + 0.04, 1.1)
    return f


# ---- building a town file -------------------------------------------------------------------------

def indic_house(ms, rng, slot):
    """Build one house from a slot dict: x, y, w, d, kind ('poor', 'common', 'rich') and options."""
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    if kind == 'poor':
        return poor_house(ms, rng, x, y, w, d, **s)
    return court_house(ms, rng, x, y, w, d, rich=(kind == 'rich'), **s)


def main(file_name, obj_name, layout, ground=None):
    """Build <out_dir>/<file_name>.glb holding one town object `obj_name` (the game reads the
    object by the layout's name, so the Indic town keeps `town-<size>-<v>`)."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(EARTH_GROUND)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
