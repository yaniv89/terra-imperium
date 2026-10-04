# scripts/blender/ti_sinic_kingdoms.py
# The Sinic kit for the Kingdoms Age (Tang to Song, Heian to Kamakura, Goryeo; art spec 3b), from the
# sheets in plans/art/kits/sinic/kingdoms/: houses.png (a 7 x 5 m grey-brick cottage under a grey
# tiled gable with a lean-to shed; a 12 x 8 m courtyard house, a red-pillared main hall with a
# hip-and-gable roof between two side wings behind a front wall and gate; an 18 x 14 m noble
# compound with a two-storey double-eaved hall on a balustraded terrace, side halls, a gate hall
# and a planted court), street.png and roofscape.png (walled compounds on grey stone lanes, canvas
# awnings, jars, racks, red-blossom trees), materials.png (grey brick, grey ceramic tile, red
# lacquered pillars, dark carved timber, cream plaster, stone base, stone street, team cloth), the
# seven-storey octagonal pagoda (landmark-1), the drum tower (landmark-2), the Japanese five-
# roofed pagoda (landmark-japan-pagoda), the castle tenshu (landmark-japan-tenshu), the Korean
# palace hall (landmark-korea), palace-small, palace and walls-medium.
# Uses ti_kingdoms.py's street, garden, lod2_block and tree helpers and ti_classical.py's broadleaf
# and shrub unchanged; the curved Chinese roofs are this module's own (`curved_roof`).
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `snk_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_kingdoms as tk  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

NEW = ['snk_brick', 'snk_tile', 'snk_ridge', 'snk_lacquer', 'snk_timber', 'snk_plaster', 'snk_white', 'snk_stone',
       'snk_balus', 'snk_cedar', 'snk_bronze', 'snk_green', 'snk_paint', 'snk_drum', 'snk_rough', 'snk_blossom', 'snk_pine',
       'snk_paving', 'snk_paving_fringe', 'snk_paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'snk_paving': 'Ground', 'snk_paving_fringe': 'Ground', 'snk_paving_square': 'Ground'})
if 'snk_paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('snk_paving_fringe')


def make_materials():
    # grey brick (walls of the cottages, the drum tower's base, the city wall): dark grey in fine courses
    tm.mat_mudwall('snk_brick', wash='#6a6b69', brick='#686966', brick2='#555653', mortar='#9a978e', wash_cover=0.0,
                   bond=(0.032, 0.012, 0.0018))
    # grey ceramic roof tile: courses down the slope; dark ridges
    tm.mat_mudwall('snk_tile', wash='#5a5f64', brick='#5e6368', brick2='#4d5257', mortar='#373a3e', wash_cover=0.0,
                   bond=(0.016, 0.009, 0.002))
    tm.mat_simple('snk_ridge', ['#33363a', '#3e4246', '#2b2e31'], scale=30.0, bump=0.3)
    # red lacquered pillars and beams
    tm.mat_simple('snk_lacquer', ['#a3301f', '#b53a26', '#8e2a1c', '#c04530'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 2.0}, bump=0.2, rough=0.6)
    # dark carved timber (doors, lattices, brackets, poor houses' frames)
    tm.mat_simple('snk_timber', ['#4a3324', '#5a3f2b', '#3c291c'], scale=14.0,
                  stripes={'dir': 'Z', 'scale': 70.0, 'distortion': 2.5}, bump=0.3)
    tm.mat_simple('snk_plaster', ['#d9cfb8', '#e3dac6', '#cfc3a8', '#e9e2d2'], scale=16.0, bump=0.2, dirt=True)
    tm.mat_simple('snk_white', ['#e9e7e1', '#f1efea', '#dedbd2'], scale=14.0, bump=0.15, dirt=True)
    # grey stone: plinths, platforms, steps
    tm.mat_mudwall('snk_stone', wash='#8f8c85', brick='#918e86', brick2='#7d7a73', mortar='#5e5b55', wash_cover=0.0,
                   bond=(0.07, 0.035, 0.003))
    # pale carved stone: balustrades, the Korean terrace
    tm.mat_mudwall('snk_balus', wash='#c9c2b2', brick='#cbc4b4', brick2='#b9b2a2', mortar='#9c9586', wash_cover=0.0,
                   bond=(0.08, 0.04, 0.0025))
    # Japan: dark stained cedar; bronze and gilt finials
    tm.mat_simple('snk_cedar', ['#3a2a20', '#463326', '#2f221a'], scale=14.0,
                  stripes={'dir': 'Z', 'scale': 80.0, 'distortion': 2.0}, bump=0.3)
    tm.mat_simple('snk_bronze', ['#9a7a34', '#b8933f', '#7d6229', '#6f7d5a'], scale=30.0, rough=0.4, metal=0.6, bump=0.1)
    # Korea: green lattice doors and the painted (dancheong) bracket band
    tm.mat_simple('snk_green', ['#2f6650', '#3a7660', '#28584a'], scale=40.0, bump=0.3)
    tm.mat_simple('snk_paint', ['#2d6a5a', '#3a7f8e', '#b2402f', '#2a5646', '#d9b04a'], scale=90.0, bump=0.4)
    tm.mat_simple('snk_drum', ['#d6c094', '#cdb383', '#e0cda4'], scale=12.0, bump=0.2, dirt=True)
    # the castle's fitted stone base: big irregular blocks
    tm.mat_mudwall('snk_rough', wash='#6f6b63', brick='#77736a', brick2='#5c5952', mortar='#3a3834', wash_cover=0.0,
                   bond=(0.05, 0.035, 0.006))
    tm.mat_simple('snk_blossom', ['#b0302a', '#c8473a', '#9a2622', '#d26a5a'], scale=50.0, bump=0.6)
    tm.mat_simple('snk_pine', ['#2f4a2c', '#3b5a34', '#274025'], scale=40.0, bump=0.6)
    # the ground: grey stone slabs; the square and lanes a lighter grey
    for n in ('snk_paving', 'snk_paving_fringe'):
        tc.mat_paving(n, stone=('#8a857c', '#837e75', '#918c83'), mortar='#67625a', slab=(0.03, 0.022))
    tc.mat_paving('snk_paving_square', stone=('#9b978e', '#948f86', '#a29e95'), mortar='#6f6b63', slab=(0.04, 0.028))


if not any(n == 'sinic_kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('sinic_kingdoms', make_materials))

PAVED = dict(mat='snk_paving', power=8)
STYLE = {'post': 'snk_lacquer', 'wall': 'snk_plaster', 'lattice': 'snk_timber'}  # 'japan' swaps the red for cedar
DETAIL = {'big': False}  # a big town's houses carry fewer small parts (the 60,000 triangle budget)


def set_style(style):
    if style == 'japan':
        STYLE.update(post='snk_cedar', wall='snk_white', lattice='snk_cedar')
    elif style == 'korea':
        STYLE.update(post='snk_lacquer', wall='snk_plaster', lattice='snk_green')
    else:
        STYLE.update(post='snk_lacquer', wall='snk_plaster', lattice='snk_timber')


# ---- helpers ------------------------------------------------------------------------------------

def beam(ms, mat, p0, p1, w=0.012, h=0.012, lod=0, frame=None):
    """A box of section w x h from p0 to p1 (local points)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    if L < 1e-5:
        return
    rot = d.to_track_quat('X', 'Z').to_matrix().to_4x4()
    m = Matrix.Translation(p0) @ rot
    if frame is not None:
        m = frame @ m
    ms.box(mat, (L, w, h), at=(L / 2, 0, -h / 2), lod=lod, frame=m)


def obox(ms, only, mat, size, at=(0, 0, 0), frame=None, rot_z=0.0, taper=1.0):
    """A plain box shown only at the LODs in `only`."""
    lod = max(only) if isinstance(only, tuple) else only
    ms.box(mat, size, at=at, rot_z=rot_z, lod=lod, frame=frame, taper=taper)
    bm, m, lo, _ = ms.parts[-1]
    ms.parts[-1] = (bm, m, lo, only)


def prism(ms, mat, f, pts2, z0, z1, lod=2, only=None):
    """A vertical prism over a convex polygon [(x, y)...] (counter-clockwise), z0 to z1."""
    bm = bmesh.new()
    b = [bm.verts.new((x, y, z0)) for x, y in pts2]
    t = [bm.verts.new((x, y, z1)) for x, y in pts2]
    n = len(pts2)
    bm.faces.new(list(reversed(b)))
    bm.faces.new(t)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((b[i], b[j], t[j], t[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def wedge(ms, mat, f, x0, x1, y0, y1, z0, h0, h1, lod=1, only=None):
    """A ramp block over x0..x1, y0..y1 from z0, its top h0 high at y0 and h1 at y1 (a stair flight)."""
    bm = bmesh.new()
    p = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    hh = [h0, h0, h1, h1]
    b = [bm.verts.new((x, y, z0)) for x, y in p]
    t = [bm.verts.new((x, y, z0 + max(h, 0.002))) for (x, y), h in zip(p, hh)]
    bm.faces.new(list(reversed(b)))
    bm.faces.new(t)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def _loop(shape, W, D, z, curl, detail):
    """One horizontal ring of a roof: corners lifted by `curl`. rect: corners and side points
    (16 at detail 2, 8 at 1, 4 at 0); oct: the 8 corners and (detail >= 1) the 8 side middles."""
    pts = []
    if shape == 'oct':
        R = W
        for k in range(8):
            a0 = math.radians(22.5 + 45 * k)
            pts.append((R * math.cos(a0), R * math.sin(a0), z + curl))
            if detail >= 1:
                a1 = math.radians(45 + 45 * k)
                rm = R * math.cos(math.radians(22.5))
                pts.append((rm * math.cos(a1), rm * math.sin(a1), z))
        return pts
    us = {2: (1.0, 0.55, 0.0, -0.55), 3: (1.0, 0.55, -0.55), 1: (1.0, 0.0), 0: (1.0,)}[detail]
    lift = {1.0: 1.0, 0.55: 0.17, 0.0: 0.0, -0.55: 0.17}
    # walk counter-clockwise from the front-left corner
    for side in range(4):
        for u in us:
            if side == 0:
                x, y = -u * W, -D
            elif side == 1:
                x, y = W, -u * D
            elif side == 2:
                x, y = u * W, D
            else:
                x, y = -W, u * D
            pts.append((x, y, z + curl * lift[u]))
    # rotate so the walk starts at (-W, -D) going +x: side 0 above runs from (-W,-D) toward +x
    return pts


def curved_roof(ms, f, w, d, z0, rise, over=0.08, curl=0.05, sag=1.7, mat='snk_tile', lod=2, cx=0.0, cy=0.0, kind='hip',
                top=None, gable=0.5, thick=0.022, shape='rect', ornaments=True, horns=0.0, finial=False, ridge_mat='snk_ridge',
                gable_mat='snk_lacquer', lod1_simple=True, only=None, light=False, droop=0.3):
    """A grey-tiled Chinese roof over a w x d block whose walls end at z0: concave slopes (steep at
    the ridge, flat at the eaves), deep eaves whose corners turn up by `curl`, a ridge, hip ridges
    and ridge-end ornaments. `kind`: 'hip' (a ridge along local X, a pyramid when square), 'xie'
    (hip-and-gable: hipped up to `gable` of the rise, then upright gable ends in `gable_mat`),
    'gable' (gable ends from the eaves), 'skirt' (a pent roof round a wall that goes on up: `top`
    = the wall's half extents (or radius), the roof ends there at z0 + rise), 'point' (a pyramid).
    shape 'oct' makes the eight-sided pagoda roofs (w = across the walls). `light` (the houses) uses
    fewer rings and a four-cornered LOD1."""
    W, D = w / 2 + over, d / 2 + over
    if shape == 'oct':
        W = D = w / 2 / math.cos(math.radians(22.5)) + over
    zt = z0 + rise
    if kind == 'skirt':
        tw, td = top
        if shape == 'oct':
            tw = td = tw / math.cos(math.radians(22.5))
        Wt, Dt, tg, Wh = tw, td, 1.0, tw
    elif kind == 'point' or (kind == 'hip' and abs(W - D) < 0.01):
        Wt = Dt = 0.006
        tg, Wh = 1.0, 0.006
    elif kind == 'hip':
        Wt, Dt, tg, Wh = max(0.006, W - D), 0.006, 1.0, max(0.006, W - D)
    elif kind == 'xie':
        Wh = W - D * gable
        Wt, Dt, tg = Wh, 0.006, gable
    else:  # gable
        Wh = W - 0.004
        Wt, Dt, tg = Wh, 0.006, 0.0

    # the eave height that puts the slope just above the wall top where it crosses the wall line
    run = max(0.02, D - Dt)
    pw = min(0.85, over / run) ** sag
    ze = min(z0 - 0.004, (z0 + 0.004 - zt * pw) / (1 - pw))
    ze = max(ze, z0 - droop * over)  # a pent roof's wall line is near its eave: never hang the eave far below the wall

    def zf(t):
        return ze + (zt - ze) * t ** sag

    def ext(t):
        dd = D + (Dt - D) * t
        if tg <= 0.0:
            ww = Wh
        else:
            ww = W + (Wh - W) * min(1.0, t / tg)
        if kind == 'skirt':
            ww = W + (Wt - W) * t
        return ww, dd

    def build(n, detail, lod_, only_):
        loops = []
        ww, dd = ext(0.0)
        loops.append(_loop(shape, ww, dd, ze - thick, curl, detail))
        for i in range(n + 1):
            t = i / n
            ww, dd = ext(t)
            z = zf(t)
            loops.append(_loop(shape, ww, dd, z, curl * (1 - t) ** 2, detail))
        bm = bmesh.new()
        vs = [[bm.verts.new((cx + x, cy + y, z)) for x, y, z in lp] for lp in loops]
        m = len(vs[0])
        for i in range(len(vs)):
            A, B = vs[i], vs[(i + 1) % len(vs)]
            for k in range(m):
                j = (k + 1) % m
                try:
                    bm.faces.new((A[k], A[j], B[j], B[k]))
                except ValueError:
                    pass
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed shell: safe to orient
        ms.add(bm, mat, lod_, matrix=f.copy(), only=only_)

    if only is not None:
        build(1, 0 if 2 in only else 1, max(only), only)
    elif lod1_simple:
        build(2 if light else 3, 3 if light else 2, 0, (0,))
        if lod >= 1:
            build(1, 0 if light else 1, 1, (1,))
        if lod >= 2:
            build(1, 0, 2, (2,))
    else:
        build(3, 2, lod, None)
    if only is not None and 0 not in only:
        return zt
    # gable ends of a hip-and-gable (or gable) roof: a triangle in gable_mat just outside the tiles
    if kind in ('xie', 'gable') and shape == 'rect':
        z_g = zf(tg)
        _, dg = ext(tg)
        for sx in (-1, 1):
            x = cx + sx * (Wh + 0.003)
            dgg = dg * 0.92
            zb = z_g + 0.006
            pts = [(x, cy - dgg, zb), (x, cy + dgg, zb), (x, cy, zt - 0.012)]
            bm = bmesh.new()
            bot = [bm.verts.new(p) for p in pts]
            topv = [bm.verts.new((p[0] - sx * 0.008, p[1], p[2])) for p in pts]
            bm.faces.new(bot)
            bm.faces.new(list(reversed(topv)))
            for i in range(3):
                j = (i + 1) % 3
                bm.faces.new((bot[i], bot[j], topv[j], topv[i]))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
            ms.add(bm, gable_mat, 1 if lod >= 2 else 0, matrix=f.copy())
    rl = min(lod, 1)
    if kind in ('hip', 'xie', 'gable') and Wt > 0.02:
        ms.box(ridge_mat, (2 * Wt + 0.02, 0.03, 0.028), at=(cx, cy, zt - 0.014), lod=0 if light else rl, frame=f)
    if not ornaments:
        return zt
    # hip ridges along the corners of the slope
    if shape == 'rect' and kind != 'gable':
        steps = 1 if light else 3
        for sx in (-1, 1):
            for sy in (-1, 1):
                prev = None
                for i in range(steps + 1):
                    t = (tg if kind == 'xie' else 1.0) * i / steps
                    ww, dd = ext(t)
                    z = zf(t)
                    p = (cx + sx * ww, cy + sy * dd, z + curl * (1 - t) ** 2 + 0.008)
                    if prev is not None:
                        beam(ms, ridge_mat, prev, p, w=0.014, h=0.014, lod=0, frame=f)
                    prev = p
    if kind in ('hip', 'xie', 'gable') and Wt > 0.02 and not light:
        hz = max(0.03, horns)
        for sx in (-1, 1):  # ridge-end ornaments (chiwei) curling up
            ms.box(ridge_mat, (0.02, 0.028, hz), at=(cx + sx * (Wt + 0.004), cy, zt - 0.01), lod=0, frame=f, taper=0.75)
            ms.box(ridge_mat, (0.028, 0.026, 0.014), at=(cx + sx * (Wt - 0.006), cy, zt - 0.01 + hz - 0.006), lod=0, frame=f)
    if finial:
        ms.cyl('snk_bronze', 0.02, 0.024, 0.026, at=(cx, cy, zt - 0.012), segs=8, lod=1, frame=f)
    return zt


def lattice(ms, f, x, y, z, w=0.08, h=0.07, face=-1, mat=None):
    """A lattice window or door panel on a wall face at local y."""
    mat = mat or STYLE['lattice']
    ms.box('dark', (w, 0.008, h), at=(x, y + face * 0.002, z), lod=0, frame=f)
    ms.box(mat, (0.006, 0.006, h), at=(x, y + face * 0.006, z), lod=0, frame=f)
    ms.box(mat, (w + 0.012, 0.01, 0.01), at=(x, y + face * 0.005, z + h), lod=0, frame=f)


def dbl_door(ms, f, x, y, w=0.11, h=0.18, z=G, mat='snk_timber', lod=1):
    ms.box(mat, (w, 0.012, h), at=(x, y - 0.004, z), lod=lod, frame=f)
    ms.box('dark', (0.006, 0.014, h), at=(x, y - 0.006, z), lod=0, frame=f)
    ms.box(STYLE['post'], (w + 0.026, 0.016, 0.016), at=(x, y - 0.006, z + h), lod=0, frame=f)


def steps(ms, f, x, y, w, h, n=4, run=0.03, mat='snk_stone', toward=-1, lod=0, cheeks=False):
    """A flight of n steps climbing h, its foot at local (x, y) going away from `toward`."""
    for k in range(n):
        ms.box(mat, (w, run, h * (n - k) / n), at=(x, y + toward * run * (k + 0.5), G), lod=lod, frame=f)
    if cheeks:
        for sx in (-1, 1):
            wedge(ms, 'snk_balus', f, x + sx * w / 2 - 0.01, x + sx * w / 2 + 0.01, y + toward * run * n, y, G, 0.012, h + 0.02, lod=0)


def balustrade(ms, f, pts, z, h=0.045, mat='snk_balus', post_step=0.1, lod=0, rail_lod=1, closed=False, t=0.012):
    """A railing along a polyline of local (x, y) at height z: a top rail and a bottom rail, posts."""
    P = list(pts) + ([pts[0]] if closed else [])
    for (x0, y0), (x1, y1) in zip(P, P[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        if L < 1e-4:
            continue
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        mf = f @ Matrix.Translation(Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
        ms.box(mat, (L, t, t), at=(0, 0, z + h - t), lod=rail_lod, frame=mf)
        ms.box(mat, (L, t * 0.7, h * 0.35), at=(0, 0, z), lod=0, frame=mf)
        n = max(1, round(L / post_step))
        for i in range(n + 1):
            ms.box(mat, (t * 1.3, t * 1.3, h + 0.008), at=(-L / 2 + L * i / n, 0, z), lod=lod, frame=mf)


def ring_pts(r, n=8, rot=22.5):
    return [(r * math.cos(math.radians(rot + 360 * k / n)), r * math.sin(math.radians(rot + 360 * k / n))) for k in range(n)]


def jar(ms, f, x, y, s=1.0, z=G):
    """A big glazed storage jar (the street sheet's), cheaper than ti_town's."""
    ms.cyl('terracotta', 0.026 * s, 0.034 * s, 0.035 * s, at=(x, y, z), segs=7, lod=0, frame=f)
    ms.cyl('terracotta', 0.034 * s, 0.018 * s, 0.03 * s, at=(x, y, z + 0.035 * s), segs=7, lod=0, frame=f)


def jars(ms, f, x, y, rng, n=3):
    for _ in range(n):
        jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.03, 0.03), rng.uniform(1.0, 1.3))


def tree(ms, rng, x, y, h=0.34, r=0.09, blossom=False, lod2=False):
    """A round-crowned courtyard tree, or one of the street sheet's red-leaved ornamental trees."""
    mat = 'snk_blossom' if blossom else 'shrub'
    ms.cyl('timber', 0.013, 0.009, h * 0.5, at=(x, y, G), segs=5, lod=1)
    ms.sphere(mat, r, at=(x, y, G + h - r * 0.8), scale=(1, 1, 0.8), u=7, v=5, lod=0)
    ms.sphere(mat, r * 0.6, at=(x + r * 0.5, y - r * 0.3, G + h - r * 1.3), u=6, v=3, lod=0)
    ms.sphere(mat, r, at=(x, y, G + h - r * 0.9), scale=(1, 1, 0.8), u=6, v=3, lod=1, only=1)
    if lod2:
        ms.cyl(mat, r, 0.0, h - 0.06, at=(x, y, G + 0.04), segs=4, lod=2, only=2, caps=False)


def pine(ms, x, y, h=0.4, r=0.1):
    """A pine with flat layered crowns (the gardens of the palace sheets)."""
    ms.cyl('timber', 0.014, 0.01, h * 0.8, at=(x, y, G), segs=6, lod=1)
    for k, (zz, rr) in enumerate(((0.55, 1.0), (0.75, 0.8), (0.92, 0.55))):
        ms.cyl('snk_pine', r * rr, r * rr * 0.7, h * 0.12, at=(x + (k - 1) * 0.012, y, G + h * zz), segs=8, lod=0 if k else 1)


def court_wall(ms, f, x0, y0, x1, y1, h=0.17, t=0.035, gaps=(), lod=1, wall=None):
    """A compound wall in the local frame f from (x0, y0) to (x1, y1): grey brick footing, plaster,
    a grey tiled coping; `gaps` are (centre fraction, width) openings."""
    wall = wall or STYLE['wall']
    length = math.hypot(x1 - x0, y1 - y0)
    if length < 1e-4:
        return
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    wf = f @ Matrix.Translation(Vector((x0, y0, 0))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
    pos, spans = 0.0, []
    for c, gw in sorted(gaps):
        a, b = c * length - gw / 2, c * length + gw / 2
        if a > pos:
            spans.append((pos, a))
        pos = b
    if pos < length:
        spans.append((pos, length))
    for a, b in spans:
        ms.box(wall, (b - a, t, h), at=((a + b) / 2, 0, G), lod=lod, frame=wf)
        ms.box('snk_brick', (b - a + 0.004, t + 0.006, h * 0.35), at=((a + b) / 2, 0, G), lod=0, frame=wf)
        ms.box('snk_tile', (b - a + 0.014, t + 0.032, 0.022), at=((a + b) / 2, 0, G + h), lod=0 if lod < 2 else 1, frame=wf, taper=0.5)


# ---- houses -------------------------------------------------------------------------------------

def hall(ms, f, w, d, h, cx=0.0, cy=0.0, rise=0.2, n=None, kind='xie', over=0.07, curl=0.045, plinth=0.04, lod=2,
         windows=True, doors=True, back=True, horns=0.0, roof=True, light=False):
    """A hall on a stone plinth: plaster walls with a brick dado behind a row of red pillars under a
    beam (a shallow porch), a double door and lattice windows in the front, a curved roof."""
    hf = f @ Matrix.Translation(Vector((cx, cy, 0)))
    ms.box('snk_stone', (w + 0.08, d + 0.08, plinth), at=(0, 0, G), lod=0 if light else min(lod, 1), frame=hf)
    z = G + plinth
    ms.box(STYLE['wall'], (w, d, h), at=(0, 0, z), lod=lod, frame=hf)
    ms.box('snk_brick', (w + 0.004, d + 0.004, h * 0.16), at=(0, 0, z), lod=0, frame=hf)
    n = n or max(3, int(w / 0.14) + 1)
    fy = -d / 2 - 0.03
    for i in range(n):
        px = -w / 2 + 0.01 + (w - 0.02) * i / (n - 1)
        ms.box(STYLE['post'], (0.024, 0.024, h), at=(px, fy, z), lod=0 if light else (1 if i in (0, n - 1) or n <= 4 else 0), frame=hf)
    ms.box(STYLE['post'], (w + 0.03, 0.03, 0.03), at=(0, fy, z + h - 0.03), lod=0 if light else 1, frame=hf)
    if doors:
        ms.box(STYLE['post'], (w * 0.9, 0.01, h * 0.84), at=(0, -d / 2 - 0.003, z), lod=0, frame=hf)
        dbl_door(ms, hf, 0, -d / 2 - 0.008, w=min(0.13, w * 0.3), h=h * 0.72, z=z, lod=0 if light else 1)
        if windows:
            for k in (-1, 1):
                for wx in ((0.22 * w, 0.38 * w) if w > 0.6 and not DETAIL['big'] else (0.3 * w,)):
                    lattice(ms, hf, k * wx, -d / 2 - 0.01, z + h * 0.3, w=min(0.08, w * 0.14), h=h * 0.42)
        steps(ms, hf, 0, -d / 2 - 0.04, min(0.22, w * 0.4), plinth, n=2, run=0.025)
    if back and windows and not light:
        lattice(ms, hf, 0, d / 2 + 0.002, z + h * 0.4, w=0.08, h=h * 0.3, face=1)
    if roof:
        return curved_roof(ms, hf, w + 0.06, d + 0.06, z + h, rise, over=over, curl=curl, lod=lod, kind=kind, horns=horns, light=light)
    return z + h


def poor_house(ms, rng, x, y, w, d, yaw=None, awning=True, **_):
    """The cottage (sheet: 7 x 5 m, 3.5 m): grey brick walls on a stone footing with dark timber
    corner posts, a plank door and two lattice windows, a grey tiled gable with gently upturned ends,
    a lean-to shed of planks at the side; in front a small yard with jars, a rack and a canvas
    awning on poles (the street sheet)."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    bw, bd = min(w * 0.78, 0.7), min(d * 0.62, 0.5)
    by = d / 2 - bd / 2 - 0.02
    bx = -w / 2 + bw / 2 + 0.02 if w - bw > 0.16 else 0.0
    hf = f @ Matrix.Translation(Vector((bx, by, 0)))
    h = STOREY * 0.78
    ms.box('snk_stone', (bw + 0.02, bd + 0.02, 0.04), at=(0, 0, G), lod=1, frame=hf)
    ms.box('snk_brick', (bw, bd, h), at=(0, 0, G), lod=1, frame=hf)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('snk_timber', (0.02, 0.02, h), at=(sx * (bw / 2 - 0.006), sy * (bd / 2 - 0.006), G), lod=0, frame=hf)
    ms.box('snk_timber', (bw + 0.01, bd + 0.01, 0.014), at=(0, 0, G + h - 0.014), lod=0, frame=hf)
    dx = -bw * 0.05
    ms.box('snk_timber', (0.08, 0.012, 0.17), at=(dx, -bd / 2 - 0.004, G), lod=1, frame=hf)
    for wx in (-bw * 0.32, bw * 0.3):
        lattice(ms, hf, wx, -bd / 2, G + 0.13, w=0.07, h=0.07, mat='snk_timber')
    rise = 0.16
    curved_roof(ms, hf, bw, bd, G + h, rise, over=0.05, curl=0.02, sag=1.3, kind='gable', lod=1, ornaments=True,
                gable_mat='snk_brick', light=True)
    tk.lod2_block(ms, hf, bw, bd, h, rise=rise, mat='snk_tile')
    # the lean-to shed of planks on the side away from the yard
    sw = min(0.16, w - bw - 0.04) if w - bw > 0.1 else 0.0
    if sw > 0.06:
        sf = hf @ Matrix.Translation(Vector((bw / 2 + sw / 2, 0, 0)))
        for sy in (-1, 1):
            ms.box('timber', (0.016, 0.016, h * 0.7), at=(sw / 2 - 0.01, sy * (bd / 2 - 0.02), G), lod=0, frame=sf)
        ms.box('kg_planks', (0.012, bd - 0.04, h * 0.65), at=(-sw / 2 + 0.01, 0, G), lod=0, frame=sf)
        bm = bmesh.new()
        a, b2 = h * 0.82, h * 0.6
        q = [bm.verts.new(p) for p in ((-sw / 2, -bd / 2, G + a), (sw / 2 + 0.02, -bd / 2, G + b2), (sw / 2 + 0.02, bd / 2, G + b2),
                                        (-sw / 2, bd / 2, G + a))]
        bm.faces.new(q)
        ms.add(bm, 'kg_planks' if rng.random() < 0.5 else 'snk_tile', 0, matrix=sf.copy())
        tk.barrel(ms, sf, 0.0, -bd / 2 + 0.06)
    # the front yard: a low wall or fence, jars, an awning
    yd = d - bd - 0.04
    if yd > 0.12:
        yf = f @ Matrix.Translation(Vector((0, -d / 2 + yd / 2, 0)))
        if awning:
            ax = bx + bw * 0.15
            for sx in (-1, 1):
                for sy in (-1, 1):
                    ms.box('timber', (0.012, 0.012, 0.2), at=(ax + sx * 0.1, sy * yd * 0.3, G), lod=0, frame=yf)
            ms.box('team_cloth', (0.24, yd * 0.7, 0.006), at=(ax, 0, G + 0.2), lod=1, frame=yf)
        jars(ms, yf, -w * 0.3, -yd * 0.2, rng, 2)
        if rng.random() < 0.6:
            tt.rack(ms, yf, w * 0.35, 0.0, 90)
        court_wall(ms, f, -w / 2, -d / 2, -0.06, -d / 2, h=0.09, t=0.025, lod=0, wall='snk_brick')
        court_wall(ms, f, 0.06, -d / 2, w / 2, -d / 2, h=0.09, t=0.025, lod=0, wall='snk_brick')
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning_w=None, **_):
    """The courtyard house (sheet: 12 x 8 m, 5 m): the main hall across the back on a stone plinth,
    red pillars, lattice doors, a hip-and-gable roof with upturned eaves; two side wings under grey
    gables facing a paved court with two trees; a plastered front wall with a gate up stone steps.
    Narrow plots keep the hall and one wing."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hd = min(0.3, d * 0.44)
    hw = w * (0.66 if w > 0.5 else 0.8)
    h = STOREY * 0.88
    zt = hall(ms, f, hw, hd, h, cy=d / 2 - hd / 2 - 0.04, rise=0.2, kind='xie', n=4 if hw < 0.5 else 5, lod=1, light=True)
    tk.lod2_block(ms, f, hw + 0.1, hd + 0.1, h + 0.04, y=d / 2 - hd / 2 - 0.04, rise=zt - G - h - 0.04, mat='snk_tile')
    ww = min(0.18, (w - hw) / 2 + 0.06) if w > 0.5 else 0.0
    wd = d - hd - 0.16
    sides = (-1, 1) if w > 0.55 else ((-1,) if w > 0.45 else ())
    for sx in sides:
        if wd < 0.16 or ww < 0.1:
            break
        sf = f @ Matrix.Translation(Vector((sx * (w / 2 - ww / 2 - 0.02), -d / 2 + 0.06 + wd / 2, 0))) @ \
            Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
        wh = STOREY * 0.66
        ms.box(STYLE['wall'], (wd, ww, wh), at=(0, 0, G), lod=1, frame=sf)
        ms.box('snk_brick', (wd + 0.004, ww + 0.004, wh * 0.22), at=(0, 0, G), lod=0, frame=sf)
        for i in range(2):
            ms.box(STYLE['post'], (0.02, 0.02, wh), at=(-wd / 2 + 0.01 + (wd - 0.02) * i, -ww / 2 - 0.006, G), lod=0, frame=sf)
        lattice(ms, sf, -wd * 0.2, -ww / 2 - 0.004, G + wh * 0.3, w=0.07, h=wh * 0.45)
        ms.box('snk_timber', (0.07, 0.01, wh * 0.7), at=(wd * 0.22, -ww / 2 - 0.004, G), lod=0, frame=sf)
        curved_roof(ms, sf, wd, ww, G + wh, 0.12, over=0.04, curl=0.02, sag=1.3, kind='gable', lod=1, gable_mat=STYLE['wall'], light=True)
    # the court and the front wall with the gate
    pv = [f @ Vector((px, py, G + 0.004)) for px, py in ((-w / 2 + 0.03, -d / 2 + 0.03), (w / 2 - 0.03, -d / 2 + 0.03),
                                                           (w / 2 - 0.03, d / 2 - hd - 0.06), (-w / 2 + 0.03, d / 2 - hd - 0.06))]
    ms.quad_strip('snk_paving_square', [tuple(v) for v in pv], lod=1)
    gw = 0.14
    court_wall(ms, f, -w / 2, -d / 2, w / 2, -d / 2, h=0.17, gaps=((0.5, gw),), lod=1)
    for sx in (-1, 1):
        if sx not in sides or ww < 0.1:
            court_wall(ms, f, sx * w / 2, -d / 2, sx * w / 2, d / 2 - hd - 0.04, h=0.17, lod=1)
    gf = f @ Matrix.Translation(Vector((0, -d / 2, 0)))
    for sx in (-1, 1):
        ms.box(STYLE['post'], (0.02, 0.02, 0.2), at=(sx * gw / 2, 0, G), lod=0, frame=gf)
    dbl_door(ms, gf, 0, 0.012, w=gw - 0.02, h=0.17, z=G, lod=0)
    ms.box('snk_tile', (gw + 0.08, 0.1, 0.03), at=(0, 0, G + 0.2), lod=0, frame=gf, taper=0.5)
    steps(ms, gf, 0, -0.05, gw, 0.03, n=2, run=0.025)
    cdy = -d / 2 + 0.06 + wd / 2
    if w > 0.55 and wd > 0.2:
        for sx in (-1, 1):
            p = f @ Vector((sx * w * 0.16, cdy, 0))
            tree(ms, rng, p.x, p.y, h=0.3, r=0.075, blossom=rng.random() < 0.25)
    else:
        p = f @ Vector((w * 0.18, cdy, 0))
        tc.shrub(ms, p.x, p.y, r=0.055, lod=0)
    if not DETAIL['big']:
        jars(ms, f, w * 0.3, -d / 2 + 0.1, rng, 1)
    if awning_w:
        tc.awning(ms, f, -w * 0.25, -d / 2 - 0.02, min(awning_w, w * 0.4), depth=0.12, z=0.17)
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, **_):
    """The noble compound (sheet: 18 x 14 m, 8 m): a compound wall with a gate hall at the front, a
    two-storey main hall on a balustraded stone terrace (red pillars, lattice doors, a skirt roof
    round the upper storey, a hip-and-gable roof with ridge ornaments), side halls down both sides
    and a paved court with trees."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    # the compound wall and the gate hall
    gw = min(0.24, w * 0.3)
    court_wall(ms, f, -w / 2, -d / 2, w / 2, -d / 2, h=0.19, gaps=((0.5, gw),), lod=1)
    for sx in (-1, 1):
        court_wall(ms, f, sx * w / 2, -d / 2, sx * w / 2, d / 2, h=0.19, lod=1)
    court_wall(ms, f, -w / 2, d / 2, w / 2, d / 2, h=0.19, lod=1)
    gf = f @ Matrix.Translation(Vector((0, -d / 2, 0)))
    ms.box(STYLE['wall'], (gw, 0.1, 0.22), at=(0, 0, G), lod=1, frame=gf)
    for sx in (-1, 1):
        ms.box(STYLE['post'], (0.022, 0.022, 0.22), at=(sx * gw * 0.36, -0.056, G), lod=0, frame=gf)
    dbl_door(ms, gf, 0, -0.05, w=gw * 0.5, h=0.18, z=G)
    curved_roof(ms, gf, gw, 0.1, G + 0.22, 0.09, over=0.045, curl=0.025, kind='xie', lod=0, light=True)
    steps(ms, gf, 0, -0.11, gw * 0.6, 0.035, n=3, run=0.022)
    # the main hall: terrace, ground storey, skirt roof, upper storey, top roof
    hw, hd = w * 0.62, min(0.34, d * 0.4)
    cy = d / 2 - hd / 2 - 0.08
    hf = f @ Matrix.Translation(Vector((0, cy, 0)))
    tz = 0.06
    ms.box('snk_stone', (hw + 0.14, hd + 0.14, tz), at=(0, 0, G), lod=1, frame=hf)
    balustrade(ms, hf, [(-hw / 2 - 0.07, -hd / 2 - 0.07), (-0.08, -hd / 2 - 0.07)], G + tz, h=0.04)
    balustrade(ms, hf, [(0.08, -hd / 2 - 0.07), (hw / 2 + 0.07, -hd / 2 - 0.07)], G + tz, h=0.04)
    steps(ms, hf, 0, -hd / 2 - 0.07, 0.16, tz, n=3, run=0.026)
    z1 = G + tz
    h1 = STOREY * 0.85
    ms.box(STYLE['wall'], (hw, hd, h1), at=(0, 0, z1), lod=1, frame=hf)
    ms.box(STYLE['post'], (hw * 0.92, 0.01, h1 * 0.84), at=(0, -hd / 2 - 0.003, z1), lod=0, frame=hf)
    n = max(4, int(hw / 0.12) + 1)
    for i in range(n):
        px = -hw / 2 + 0.01 + (hw - 0.02) * i / (n - 1)
        ms.box(STYLE['post'], (0.026, 0.026, h1), at=(px, -hd / 2 - 0.035, z1), lod=1 if i in (0, n - 1) else 0, frame=hf)
    ms.box(STYLE['post'], (hw + 0.03, 0.03, 0.03), at=(0, -hd / 2 - 0.035, z1 + h1 - 0.03), lod=1, frame=hf)
    dbl_door(ms, hf, 0, -hd / 2 - 0.008, w=0.13, h=h1 * 0.72, z=z1)
    for k in (-1, 1):
        for wx in (0.22 * hw, 0.4 * hw):
            lattice(ms, hf, k * wx, -hd / 2 - 0.01, z1 + h1 * 0.3, w=0.07, h=h1 * 0.45)
    z2 = z1 + h1
    uw, ud = hw * 0.74, hd * 0.7
    curved_roof(ms, hf, hw + 0.04, hd + 0.04, z2, 0.1, over=0.07, curl=0.04, kind='skirt', top=(uw / 2, ud / 2), lod=1,
                ornaments=True, light=True)
    h2 = STOREY * 0.62
    ms.box(STYLE['wall'], (uw, ud, h2), at=(0, 0, z2), lod=1, frame=hf)
    balustrade(ms, hf, [(-uw / 2 - 0.02, -ud / 2 - 0.02), (uw / 2 + 0.02, -ud / 2 - 0.02)], z2 + 0.1, h=0.035, mat=STYLE['post'])
    for i in range(5):
        lattice(ms, hf, -uw * 0.36 + uw * 0.18 * i, -ud / 2 - 0.004, z2 + 0.13, w=0.06, h=h2 * 0.42)
    zt = curved_roof(ms, hf, uw + 0.04, ud + 0.04, z2 + h2, 0.2, over=0.08, curl=0.05, kind='xie', lod=1, horns=0.05, light=True)
    tk.lod2_block(ms, hf, hw + 0.1, hd + 0.1, z2 + h2 - G, rise=zt - z2 - h2, mat='snk_tile')
    # side halls facing the court
    sd = d - hd - 0.3
    sw = min(0.18, w * 0.2)
    if sd > 0.18:
        for sx in (-1, 1):
            sf = f @ Matrix.Translation(Vector((sx * (w / 2 - sw / 2 - 0.04), -d / 2 + 0.14 + sd / 2, 0))) @ \
                Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
            zz = hall(ms, sf, sd, sw, STOREY * 0.62, rise=0.11, kind='gable', n=3, windows=False, lod=1, over=0.04, curl=0.02,
                      back=False, light=True)
        ms.box('snk_paving_square', (w - 2 * sw - 0.14, sd, 0.006), at=(0, -d / 2 + 0.14 + sd / 2, G), lod=1, frame=f)
        for sx in (-1, 1):
            p = f @ Vector((sx * (w / 2 - sw - 0.14), -d / 2 + 0.2, 0))
            tree(ms, rng, p.x, p.y, h=0.34, r=0.08, blossom=sx > 0 and rng.random() < 0.6)
    for sx in (-1, 1):  # stone lanterns either side of the gate
        ms.box('snk_balus', (0.03, 0.03, 0.08), at=(sx * (gw / 2 + 0.07), -d / 2 - 0.06, G), lod=0, frame=f)
        ms.box('snk_balus', (0.045, 0.045, 0.02), at=(sx * (gw / 2 + 0.07), -d / 2 - 0.06, G + 0.08), lod=0, frame=f)
    return f


def house(ms, rng, kind, x, y, w, d, **kw):
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **kw)


# ---- the street ---------------------------------------------------------------------------------

def stall(ms, rng, x, y, yaw=None, w=0.34, d=0.28, h=0.2):
    """A market stall: a counter of goods under a flat canvas awning (team cloth) on four poles."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.012, 0.012, h + (0.03 if sy > 0 else 0.0)), at=(sx * (w / 2 - 0.01), sy * (d / 2 - 0.01), G), lod=1,
                   frame=f)
    bm = bmesh.new()
    q = [bm.verts.new(p) for p in ((-w / 2, -d / 2 - 0.02, G + h), (w / 2, -d / 2 - 0.02, G + h), (w / 2, d / 2, G + h + 0.03),
                                    (-w / 2, d / 2, G + h + 0.03))]
    bm.faces.new(q)
    ms.add(bm, 'team_cloth', 1, matrix=f.copy())
    ms.box('timber', (w - 0.04, d * 0.4, 0.07), at=(0, -d * 0.15, G), lod=0, frame=f)
    for k in range(3):
        gx = -w / 2 + 0.07 + k * (w - 0.14) / 2
        r = rng.random()
        if r < 0.4:
            tt.basket(ms, f, gx, -d * 0.15, 0.8, z=G + 0.07)
        elif r < 0.75:
            tt.jar(ms, f, gx, -d * 0.15, 0.9, z=G + 0.07)
        else:
            tt.crate(ms, f, gx, -d * 0.15, 0.7, rng.uniform(-20, 20), z=G + 0.07)
    jars(ms, f, w * 0.35, d * 0.25, rng, 1)
    tk.lod2_block(ms, f, w, d, h, mat='team_cloth')


def market_hall(ms, rng, x, y, w, d, yaw=None):
    """An open market hall: red pillars on stone pads round a paved floor with stalls and jars, a
    hip-and-gable roof."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ms.box('snk_stone', (w + 0.06, d + 0.06, 0.03), at=(0, 0, G), lod=1, frame=f)
    h = STOREY * 0.9
    nx, ny = max(3, int(w / 0.22) + 1), max(2, int(d / 0.22) + 1)
    for i in range(nx):
        for j in range(ny):
            if 0 < i < nx - 1 and 0 < j < ny - 1:
                continue
            px, py = -w / 2 + w * i / (nx - 1), -d / 2 + d * j / (ny - 1)
            ms.box(STYLE['post'], (0.028, 0.028, h), at=(px, py, G + 0.03), lod=1 if (i in (0, nx - 1) and j in (0, ny - 1)) else 0,
                   frame=f)
    for sy in (-1, 1):
        ms.box(STYLE['post'], (w + 0.03, 0.03, 0.03), at=(0, sy * d / 2, G + 0.03 + h - 0.03), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box(STYLE['post'], (0.03, d, 0.03), at=(sx * w / 2, 0, G + 0.03 + h - 0.03), lod=1, frame=f)
    for k in range(3):
        ms.box('timber', (w * 0.22, 0.08, 0.07), at=(-w * 0.3 + w * 0.3 * k, -d * 0.1, G + 0.03), lod=0, frame=f)
        jars(ms, f, -w * 0.3 + w * 0.3 * k, d * 0.18, rng, 2)
    zt = curved_roof(ms, f, w, d, G + 0.03 + h, 0.24, over=0.08, curl=0.05, kind='xie', lod=2)
    tk.lod2_block(ms, f, w, d, h + 0.03, rise=zt - G - h - 0.03, mat='snk_tile')


def watchtower(ms, x, y, s=1.0, face=0.0):
    """A corner watchtower: a battered grey brick block with merlons and a small pavilion with a
    pyramid roof (the wall sheet's corner towers)."""
    f = tm.house_frame(x, y, face)
    b, h = 0.5 * s, 0.75 * s
    ms.box('snk_stone', (b + 0.04, b + 0.04, 0.03), at=(0, 0, G - 0.01), lod=1, frame=f)
    ms.box('snk_brick', (b, b, h), at=(0, 0, G), lod=2, frame=f, taper=0.9)
    tb.merlons(ms, f, 0, 0, b * 0.9, b * 0.9, G + h, step=0.1, size=0.035, h=0.04, mat='snk_brick')
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        ms.box('dark', (0.02, 0.01, 0.05), at=(0, -b * 0.47, G + h * 0.6), lod=0, frame=rf)
    pw = b * 0.62
    ph = 0.2 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box(STYLE['post'], (0.02, 0.02, ph), at=(sx * pw / 2, sy * pw / 2, G + h), lod=1, frame=f)
    ms.box('snk_timber', (pw - 0.02, pw - 0.02, ph * 0.7), at=(0, 0, G + h), lod=0, frame=f)
    curved_roof(ms, f, pw, pw, G + h + ph, 0.16 * s, over=0.08 * s, curl=0.035, kind='point', lod=2, finial=True)


def well(ms, x, y, yaw=10):
    tt.well(ms, x, y, yaw=yaw)


# ---- landmarks ----------------------------------------------------------------------------------

def octa_rail(ms, f, r, z, h=0.05, mat='snk_lacquer', lod=0, posts=True):
    pts = ring_pts(r)
    balustrade(ms, f, pts, z, h=h, mat=mat, post_step=0.12 if posts else 99.0, lod=lod, rail_lod=min(1, lod + 1), closed=True,
               t=0.01)


def pagoda(ms, rng, x, y, s=1.0, top=2.7, yaw=0.0):
    """landmark-1, the octagonal pagoda (sheet: 16 m across with its stairs, 27 m to the bronze
    finial): a grey stone octagonal platform with a pale balustrade and stairs on four sides, a
    ground storey of white walls behind red pillars with grey cloth valances, six more storeys each
    with a red balcony railing, white walls with red posts and dark windows, under eight-sided grey
    roofs whose corners turn up, a pyramid roof and a stacked bronze finial."""
    f = tm.house_frame(x, y, yaw)
    k = s / 10.0  # sheet metres -> units
    rp = 6.0 * k
    zp = 2.0 * k
    prism(ms, 'snk_stone', f, ring_pts(rp), G - 0.01, G + zp, lod=2)
    octa_rail(ms, f, rp - 0.012, G + zp, h=1.0 * k, mat='snk_balus', lod=0)
    for a in (0, 90, 180, 270):
        sf = f @ Matrix.Rotation(math.radians(a), 4, 'Z')
        sw = 4.2 * k if a == 0 else 2.8 * k
        wedge(ms, 'snk_stone', sf, -sw / 2, sw / 2, -rp - 2.2 * k, -rp + 0.01, G, 0.004, zp, lod=1)
        for sx in (-1, 1):
            wedge(ms, 'snk_balus', sf, sx * sw / 2 - 0.008, sx * sw / 2 + 0.008, -rp - 2.2 * k, -rp + 0.01, G, 0.02, zp + 0.9 * k, lod=0)
    z = G + zp
    # the ground storey
    r1 = 3.6 * k
    h1 = 3.6 * k
    ms.cyl('snk_white', r1 / math.cos(math.radians(22.5)), r1 / math.cos(math.radians(22.5)), h1, at=(0, 0, z), rot=(0, 0, 22.5),
           segs=8, lod=1, frame=f)
    ms.cyl('snk_white', r1, r1, h1, at=(0, 0, z), segs=6, lod=2, only=2, frame=f)
    rv = r1 + 0.9 * k
    for px, py in ring_pts(rv / math.cos(math.radians(22.5))):
        ms.box('snk_lacquer', (0.5 * k, 0.5 * k, h1), at=(px, py, z), lod=1, frame=f)
    ms.box('snk_timber', (1.8 * k, 0.012, 2.6 * k), at=(0, -r1 - 0.004, z), lod=0, frame=f)
    for kk in range(8):
        rf = f @ Matrix.Rotation(math.radians(45 * kk), 4, 'Z')
        ms.box('snk_lacquer', (2.0 * rv * math.tan(math.radians(22.5)), 0.4 * k, 0.4 * k), at=(0, -rv, z + h1 - 0.4 * k), lod=1, frame=rf)
        if kk in (0, 1, 7, 3, 5):
            ms.box('team_cloth', (2.0 * rv * math.tan(math.radians(22.5)) * 0.8, 0.006, 0.9 * k), at=(0, -rv - 0.012, z + h1 - 1.3 * k),
                   lod=0, frame=rf)
    zz = z + h1
    curved_roof(ms, f, 2 * r1, 2 * r1, zz, 0.8 * k, over=2.0 * k, curl=0.7 * k, shape='oct', kind='skirt', top=(r1 * 0.86, 0),
                lod=2, thick=0.18 * k, ornaments=False, sag=1.5)
    zz += 0.8 * k
    # six upper storeys: a red balcony rail, white walls with red posts and dark windows, a thin roof
    r = r1 * 0.86
    for i in range(6):
        hh = 2.3 * k
        balustrade(ms, f, ring_pts(r + 0.5 * k), zz, h=0.8 * k, mat='snk_lacquer', post_step=0.12, lod=0, rail_lod=0, closed=True, t=0.01)
        ms.cyl('snk_white', r / math.cos(math.radians(22.5)), r / math.cos(math.radians(22.5)), hh + 0.7 * k, at=(0, 0, zz - 0.4 * k),
               rot=(0, 0, 22.5), segs=8, lod=1, frame=f)
        ms.cyl('snk_lacquer', (r + 0.55 * k) / math.cos(math.radians(22.5)), (r + 0.55 * k) / math.cos(math.radians(22.5)), 0.25 * k,
               at=(0, 0, zz - 0.25 * k), rot=(0, 0, 22.5), segs=8, lod=1, frame=f)
        for px, py in ring_pts(r / math.cos(math.radians(22.5)) + 0.01):
            ms.box('snk_lacquer', (0.35 * k, 0.35 * k, hh), at=(px, py, zz), lod=0, frame=f)
        for kk in (0, 2, 4, 6):
            rf = f @ Matrix.Rotation(math.radians(45 * kk), 4, 'Z')
            ms.box('dark', (1.2 * k, 0.008, 1.2 * k), at=(0, -r - 0.003, zz + 0.4 * k), lod=0, frame=rf)
        zr = zz + hh
        rn = r * 0.93
        rl = 2 if i in (1, 3) else 1
        if i == 5:
            zt = curved_roof(ms, f, 2 * r, 2 * r, zr, 1.9 * k, over=1.6 * k, curl=0.6 * k, shape='oct', kind='point', lod=2,
                             thick=0.15 * k, ornaments=False, sag=1.4, light=True)
        else:
            curved_roof(ms, f, 2 * r, 2 * r, zr, 0.7 * k, over=1.6 * k, curl=0.6 * k, shape='oct', kind='skirt', top=(rn, 0), lod=rl,
                        thick=0.15 * k, ornaments=False, sag=1.5, light=True)
        zz = zr + 0.7 * k
        r = rn
    ms.cyl('snk_white', r1 * 0.95, r1 * 0.62, zz - z - h1, at=(0, 0, z + h1), segs=8, lod=2, only=2, frame=f)
    # the finial: stacked bronze rings to the sheet's height
    zf = zt - 0.3 * k
    hf = G + top * 1.0 - zf if top else 3.0 * k
    ms.cyl('snk_bronze', 0.55 * k, 0.4 * k, hf * 0.15, at=(0, 0, zf), segs=8, lod=1, frame=f)
    for j in range(4):
        ms.cyl('snk_bronze', (0.5 - 0.08 * j) * k, (0.3 - 0.05 * j) * k, hf * 0.12, at=(0, 0, zf + hf * (0.15 + 0.13 * j)), segs=8, lod=0,
               frame=f)
    ms.cyl('snk_bronze', 0.12 * k, 0.06 * k, hf * 0.68, at=(0, 0, zf + hf * 0.15), segs=6, lod=1, frame=f)
    ms.sphere('snk_bronze', 0.35 * k, at=(0, 0, zf + hf * 0.82), u=8, v=5, lod=0, frame=f)
    ms.cyl('snk_bronze', 0.4 * k, 0.0, 0.9 * k, at=(0, 0, zf), segs=6, lod=2, only=2, frame=f)
    return f


def drum_tower(ms, rng, x, y, s=1.0, top=1.5, yaw=0.0):
    """landmark-2, the drum tower (sheet: 14 m across, a 4 m grey brick base, 15 m high): a battered
    brick base on a stone plinth with an arched door in the front and twin stairs climbing the
    front face to a balustraded top; on it an open pavilion of red pillars round a red railing with
    the great drum (rawhide face to the front), lanterns and two team banners on poles, under a
    hip-and-gable roof with a small cross gable to the front and ridge ornaments."""
    f = tm.house_frame(x, y, yaw)
    k = s / 10.0
    B, Bd = 13.0 * k, 11.0 * k
    hb = 4.0 * k
    ms.box('snk_stone', (B + 0.6 * k, Bd + 0.6 * k, 0.5 * k), at=(0, 0, G - 0.01), lod=2, frame=f)
    ms.box('snk_brick', (B, Bd, hb), at=(0, 0, G), lod=2, frame=f, taper=0.93)
    zb = G + hb
    tw, td = B * 0.93, Bd * 0.93
    balustrade(ms, f, [(-tw / 2, -td / 2), (tw / 2, -td / 2), (tw / 2, td / 2), (-tw / 2, td / 2)], zb, h=0.9 * k, closed=True,
               post_step=0.12)
    # the arched door and the twin stairs on the front face
    tk.arch_face(ms, f, 'snk_timber', 0, -Bd / 2 - 0.006, G, 0.9 * k, 1.9 * k, lod=1, horseshoe=False, n=6)
    tk.arch_face(ms, f, 'snk_stone', 0, -Bd / 2 - 0.004, G, 1.15 * k, 2.1 * k, lod=0, horseshoe=False, n=6)
    for sx in (-1, 1):
        x0, x1 = sorted((sx * 1.6 * k, sx * B * 0.47))
        sw = 1.6 * k
        bm = bmesh.new()
        # a flight running along the face: low by the door, high at the corner
        lo, hi = (x0, x1) if sx > 0 else (x1, x0)
        pts = [(lo, -Bd / 2 - sw, 0.0), (hi, -Bd / 2 - sw, hb), (hi, -Bd / 2, hb), (lo, -Bd / 2, 0.0)]
        vb = [bm.verts.new((p[0], p[1], G)) for p in pts]
        vt = [bm.verts.new((p[0], p[1], G + max(p[2], 0.004))) for p in pts]
        for q in ((0, 1, 2, 3),):
            bm.faces.new([vb[i] for i in reversed(q)])
            bm.faces.new([vt[i] for i in q])
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vb[i], vb[j], vt[j], vt[i]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ms.add(bm, 'snk_stone', 1, matrix=f.copy())
        beam(ms, 'snk_balus', (lo, -Bd / 2 - sw, G + 0.8 * k), (hi, -Bd / 2 - sw, G + hb + 0.8 * k), w=0.012, h=0.012, lod=0, frame=f)
    # the pavilion
    pw, pd = 10.0 * k, 8.0 * k
    ph = 5.6 * k
    ms.box('snk_timber', (pw + 0.4 * k, pd + 0.4 * k, 0.35 * k), at=(0, 0, zb), lod=1, frame=f)
    zf = zb + 0.35 * k
    nx, ny = 4, 3
    for i in range(nx):
        for j in range(ny):
            if 0 < i < nx - 1 and 0 < j < ny - 1:
                continue
            px, py = -pw / 2 + pw * i / (nx - 1), -pd / 2 + pd * j / (ny - 1)
            ms.cyl('snk_lacquer', 0.3 * k, 0.28 * k, ph, at=(px, py, zf), segs=6, lod=1, frame=f)
    balustrade(ms, f, [(-pw / 2, -pd / 2), (pw / 2, -pd / 2), (pw / 2, pd / 2), (-pw / 2, pd / 2)], zf, h=0.9 * k, mat='snk_lacquer',
               closed=True, post_step=0.08)
    for sy in (-1, 1):
        ms.box('snk_lacquer', (pw + 0.5 * k, 0.4 * k, 0.6 * k), at=(0, sy * pd / 2, zf + ph - 0.6 * k), lod=1, frame=f)
        ms.box('snk_paint', (pw, 0.3 * k, 0.4 * k), at=(0, sy * (pd / 2 + 0.1 * k), zf + ph - 1.0 * k), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('snk_lacquer', (0.4 * k, pd + 0.5 * k, 0.6 * k), at=(sx * pw / 2, 0, zf + ph - 0.6 * k), lod=1, frame=f)
    # the drum on its stand, the skin to the front
    dr = 1.9 * k
    dl = 2.6 * k
    dz = zf + 0.5 * k + dr
    ms.cyl('snk_lacquer', dr * 0.96, dr * 0.96, dl, at=(0, dl / 2, dz), rot=(90, 0, 0), segs=14, lod=1, frame=f)
    for sy in (-1, 1):
        ms.cyl('snk_drum', dr, dr, 0.12 * k, at=(0, sy * dl / 2 + (0.12 * k if sy > 0 else 0.0), dz), rot=(90, 0, 0), segs=14, lod=1,
               frame=f)
    for sx in (-1, 1):
        ms.box('snk_timber', (0.25 * k, 0.6 * k, dr * 1.3), at=(sx * dr * 0.8, 0, zf), lod=0, frame=f)
    # lanterns and the team banners
    for sx in (-1, 1):
        ms.box('snk_lacquer', (0.45 * k, 0.45 * k, 0.7 * k), at=(sx * pw * 0.32, -pd / 2, zf + ph - 2.0 * k), lod=0, frame=f)
        bf = f @ Matrix.Translation(Vector((sx * (pw / 2 + 0.9 * k), -pd / 2 + 0.6 * k, 0)))
        ms.cyl('snk_timber', 0.1 * k, 0.08 * k, ph + 0.8 * k, at=(0, 0, zf - 0.2 * k), segs=5, lod=1, frame=bf)
        ms.box('snk_timber', (0.9 * k, 0.1 * k, 0.1 * k), at=(-sx * 0.4 * k, 0, zf + ph + 0.2 * k), lod=0, frame=bf)
        ms.box('team_cloth', (0.75 * k, 0.04 * k, 2.6 * k), at=(-sx * 0.45 * k, 0, zf + ph - 2.5 * k), lod=1, frame=bf)
    for sy in (-1, 1):  # the bracket band under the eaves
        ms.box('snk_timber', (pw + 0.6 * k, 0.5 * k, 0.8 * k), at=(0, sy * pd / 2, zf + ph), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('snk_timber', (0.5 * k, pd + 0.6 * k, 0.8 * k), at=(sx * pw / 2, 0, zf + ph), lod=1, frame=f)
    zr = zf + ph + 0.8 * k
    zt = curved_roof(ms, f, pw + 0.4 * k, pd + 0.4 * k, zr, G + top - zr - 0.6 * k, over=1.35 * k, curl=0.65 * k, kind='xie', gable=0.5,
                     lod=2, horns=0.9 * k, thick=0.3 * k)
    # the small cross gable on the front slope
    cf = f @ Matrix.Translation(Vector((0, -pd / 2 - 0.4 * k, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    curved_roof(ms, cf, 4.2 * k, 3.6 * k, zr + 0.9 * k, 1.6 * k, over=0.5 * k, curl=0.2 * k, kind='gable', lod=1, sag=1.2,
                ornaments=False, thick=0.2 * k)
    return zt


def jp_pagoda(ms, rng, x, y, s=1.0, top=1.92, yaw=0.0):
    """landmark-japan-pagoda (sheet: 10 m across, 19.2 m to the finial): a cut granite base with
    steps on four sides, four storeys of dark cedar posts and bracket sets round white plaster
    panels, a timber veranda railing round the ground storey and balcony rails above, very wide
    grey roofs with a gentle lift at the corners (each storey narrower), and a long bronze sorin of
    nine rings with a jewel on top."""
    f = tm.house_frame(x, y, yaw)
    k = s / 10.0
    bs = 8.6 * k
    zb = 1.2 * k
    ms.box('snk_stone', (bs, bs, zb), at=(0, 0, G - 0.01), lod=2, frame=f, taper=0.96)
    for a in (0, 90, 180, 270):
        sf = f @ Matrix.Rotation(math.radians(a), 4, 'Z')
        sw = 2.2 * k
        wedge(ms, 'snk_stone', sf, -sw / 2, sw / 2, -bs / 2 - 1.6 * k, -bs / 2 + 0.01, G, 0.004, zb, lod=1)
    z = G + zb
    b = 6.0 * k
    ms.box('snk_cedar', (b + 1.2 * k, b + 1.2 * k, 0.2 * k), at=(0, 0, z), lod=1, frame=f)
    balustrade(ms, f, [(-b / 2 - 0.6 * k, -b / 2 - 0.6 * k), (b / 2 + 0.6 * k, -b / 2 - 0.6 * k), (b / 2 + 0.6 * k, b / 2 + 0.6 * k),
                       (-b / 2 - 0.6 * k, b / 2 + 0.6 * k)], z + 0.2 * k, h=0.8 * k, mat='snk_cedar', closed=True, post_step=0.1)
    z += 0.2 * k
    sh = 3.2 * k
    for i in range(4):
        hh = sh - 1.0 * k if i else sh - 0.6 * k
        ms.box('snk_white', (b, b, hh), at=(0, 0, z), lod=2, frame=f)
        for kk in range(4):
            rf = f @ Matrix.Rotation(math.radians(90 * kk), 4, 'Z')
            for j in range(4):
                px = -b / 2 + b * j / 3
                ms.box('snk_cedar', (0.35 * k, 0.12 * k, hh), at=(px, -b / 2 - 0.004, z), lod=0 if 0 < j < 3 else 1, frame=rf)
            ms.box('snk_cedar', (b + 0.1 * k, 0.2 * k, 0.4 * k), at=(0, -b / 2 - 0.006, z + hh - 0.4 * k), lod=1, frame=rf)
            ms.box('snk_cedar', (b * 0.3, 0.012, hh * 0.7), at=(0, -b / 2 - 0.006, z), lod=0, frame=rf)
            for j in range(3):  # bracket sets under the eaves
                ms.box('snk_cedar', (0.4 * k, 0.5 * k, 0.3 * k), at=(-b / 3 + b / 3 * j, -b / 2 - 0.25 * k, z + hh - 0.1 * k), lod=0, frame=rf)
        zr = z + hh
        over = (2.0 - 0.15 * i) * k
        bn = b - 0.75 * k
        if i < 3:
            curved_roof(ms, f, b, b, zr, 0.8 * k, over=over, curl=0.45 * k, kind='skirt', top=(bn / 2 - 0.1 * k, bn / 2 - 0.1 * k),
                        lod=2, thick=0.2 * k, ornaments=True, sag=1.4)
            z = zr + 0.8 * k
            balustrade(ms, f, [(-bn / 2 - 0.3 * k, -bn / 2 - 0.3 * k), (bn / 2 + 0.3 * k, -bn / 2 - 0.3 * k),
                               (bn / 2 + 0.3 * k, bn / 2 + 0.3 * k), (-bn / 2 - 0.3 * k, bn / 2 + 0.3 * k)], z, h=0.6 * k, mat='snk_cedar',
                       closed=True, post_step=0.12, rail_lod=0)
            b = bn
        else:
            zt = curved_roof(ms, f, b, b, zr, 1.7 * k, over=over, curl=0.45 * k, kind='point', lod=2, thick=0.2 * k, sag=1.4)
    # the sorin
    hs = G + top - zt + 0.2 * k
    zs = zt - 0.2 * k
    ms.box('snk_bronze', (0.8 * k, 0.8 * k, 0.5 * k), at=(0, 0, zs), lod=1, frame=f)
    ms.cyl('snk_bronze', 0.1 * k, 0.08 * k, hs * 0.92, at=(0, 0, zs), segs=6, lod=1, frame=f)
    for j in range(9):
        ms.cyl('snk_bronze', 0.42 * k, 0.42 * k, 0.12 * k, at=(0, 0, zs + 0.7 * k + j * hs * 0.065), segs=8, lod=0, frame=f)
    ms.sphere('snk_bronze', 0.3 * k, at=(0, 0, zs + hs - 0.3 * k), u=8, v=5, lod=0, frame=f)
    ms.cyl('snk_bronze', 0.3 * k, 0.0, hs, at=(0, 0, zs), segs=4, lod=2, only=2, frame=f)
    return f


def _chidori(ms, f, x, y, z, w, d, rise, face=-1, plaster='snk_white', lod=1):
    """A triangular dormer gable (chidori-hafu) on a roof slope: a curved gable roof with its ridge
    toward the front and a white plaster triangle with a small dark window."""
    cf = f @ Matrix.Translation(Vector((x, y, 0))) @ Matrix.Rotation(math.radians(90 * -face), 4, 'Z')
    curved_roof(ms, cf, d, w, z, rise, over=0.012, curl=0.012, kind='gable', lod=lod, sag=1.2, ornaments=False, gable_mat=plaster,
                thick=0.016)


def tenshu(ms, rng, x, y, s=1.0, top=1.18, yaw=0.0):
    """landmark-japan-tenshu (sheet: 9.6 m across, 11.8 m): a battered base of fitted rough stone,
    a first storey of dark cedar boarding with barred windows under a white plaster band, a wide
    roof with a big triangular gable to the front and back, a second storey of white plaster with
    a smaller front gable, a third storey with a balcony railing, a hip-and-gable top roof with
    white gables and dark ridge-end fish; an entrance annex with a small roof, a cloth curtain
    (team cloth) and a timber stair up the base."""
    f = tm.house_frame(x, y, yaw)
    k = s / 10.0
    B, Bd = 9.6 * k, 8.6 * k
    hb = 1.9 * k
    ms.box('snk_rough', (B, Bd, hb), at=(0, 0, G - 0.01), lod=2, frame=f, taper=0.88)
    z = G + hb
    w1, d1 = B * 0.84, Bd * 0.84
    h1 = 2.4 * k
    ms.box('snk_cedar', (w1, d1, h1), at=(0, 0, z), lod=2, frame=f)
    ms.box('snk_white', (w1 + 0.004, d1 + 0.004, 0.7 * k), at=(0, 0, z + h1 - 0.7 * k), lod=1, frame=f)
    for kk in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * kk), 4, 'Z')
        L = w1 if kk % 2 == 0 else d1
        for j in (-1, 1):
            ms.box('dark', (1.0 * k, 0.008, 0.8 * k), at=(j * L * 0.28, -(d1 if kk % 2 == 0 else w1) / 2 - 0.003, z + 0.6 * k), lod=0, frame=rf)
    z1 = z + h1
    w2, d2 = w1 * 0.78, d1 * 0.78
    curved_roof(ms, f, w1, d1, z1, 0.9 * k, over=1.1 * k, curl=0.35 * k, kind='skirt', top=(w2 / 2, d2 / 2), lod=2, thick=0.25 * k,
                sag=1.2)
    for sy in (-1, 1):
        _chidori(ms, f, 0, sy * d1 * 0.36, z1 - 0.1 * k, w1 * 0.5, 2.2 * k, 1.9 * k, face=-sy if sy < 0 else 1, lod=1)
    z2 = z1 + 0.9 * k
    h2 = 2.2 * k
    ms.box('snk_white', (w2, d2, h2), at=(0, 0, z2), lod=2, frame=f)
    ms.box('snk_cedar', (w2 + 0.004, d2 + 0.004, 0.25 * k), at=(0, 0, z2), lod=0, frame=f)
    for j in (-1, 0, 1):
        ms.box('dark', (0.7 * k, 0.008, 0.6 * k), at=(j * w2 * 0.3, -d2 / 2 - 0.003, z2 + 0.8 * k), lod=0, frame=f)
    z3r = z2 + h2
    w3, d3 = w2 * 0.8, d2 * 0.82
    curved_roof(ms, f, w2, d2, z3r, 0.7 * k, over=0.9 * k, curl=0.3 * k, kind='skirt', top=(w3 / 2, d3 / 2), lod=2, thick=0.22 * k,
                sag=1.2)
    _chidori(ms, f, 0, -d2 * 0.34, z3r - 0.1 * k, w2 * 0.36, 1.6 * k, 1.3 * k, face=-1, lod=0)
    z3 = z3r + 0.7 * k
    h3 = 2.0 * k
    ms.box('snk_white', (w3, d3, h3), at=(0, 0, z3), lod=2, frame=f)
    ms.box('snk_cedar', (w3 + 0.004, d3 + 0.004, 0.9 * k), at=(0, 0, z3 + 0.2 * k), lod=0, frame=f)
    balustrade(ms, f, [(-w3 / 2 - 0.4 * k, -d3 / 2 - 0.4 * k), (w3 / 2 + 0.4 * k, -d3 / 2 - 0.4 * k), (w3 / 2 + 0.4 * k, d3 / 2 + 0.4 * k),
                       (-w3 / 2 - 0.4 * k, d3 / 2 + 0.4 * k)], z3, h=0.8 * k, mat='snk_cedar', closed=True, post_step=0.08)
    ms.box('snk_cedar', (w3 + 0.8 * k, d3 + 0.8 * k, 0.15 * k), at=(0, 0, z3), lod=1, frame=f)
    zr = z3 + h3
    # the top roof: hip-and-gable with its gable to the front (ridge across the depth)
    rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
    zt = curved_roof(ms, rf, d3 + 0.1 * k, w3 + 0.1 * k, zr, G + top - zr - 0.5 * k, over=1.1 * k, curl=0.35 * k, kind='xie', gable=0.4,
                     lod=2, horns=0.7 * k, thick=0.25 * k, gable_mat='snk_white', sag=1.3)
    # the entrance annex at the front with its stair and curtain
    ew, ed = 2.6 * k, 1.6 * k
    ef = f @ Matrix.Translation(Vector((0, -Bd / 2 + 0.2 * k, 0)))
    ms.box('snk_cedar', (ew, ed, 1.8 * k), at=(0, -ed / 2, z), lod=1, frame=ef)
    ms.box('team_cloth', (ew * 0.8, 0.006, 0.9 * k), at=(0, -ed - 0.004, z + 0.9 * k), lod=0, frame=ef)
    curved_roof(ms, ef, ew, ed, z + 1.8 * k, 0.6 * k, over=0.35 * k, curl=0.12 * k, kind='xie', cy=-ed / 2, lod=1, sag=1.2,
                ornaments=False, thick=0.15 * k, gable_mat='snk_white')
    wedge(ms, 'snk_cedar', ef, -0.9 * k, 0.9 * k, -ed - 2.4 * k, -ed, G, 0.004, hb, lod=1)
    for sx in (-1, 1):
        beam(ms, 'snk_cedar', (sx * 0.95 * k, -ed - 2.4 * k, G + 0.8 * k), (sx * 0.95 * k, -ed, G + hb + 0.8 * k), w=0.012, h=0.012, lod=0,
             frame=ef)
    return zt


def korean_hall(ms, rng, x, y, s=1.0, top=0.96, yaw=0.0):
    """landmark-korea, the palace hall (sheet: a 24 m two-step stone terrace 2.4 m high, a 19 m hall,
    9.6 m to the ridge): pale stone terraces with carved balustrades and stairs at the front (a
    carved slab between twin flights) and the sides, a hall of red pillars round green lattice
    doors under grey cloth valances, a painted (dancheong) bracket band, a big hip-and-gable roof
    with a strongly lifted eave line, white mortar ridges, red gable triangles and ridge figures."""
    f = tm.house_frame(x, y, yaw)
    k = s / 10.0
    T, Td = 24.0 * k, 20.0 * k
    t1 = 1.2 * k
    ms.box('snk_balus', (T, Td, t1), at=(0, 0, G - 0.01), lod=2, frame=f)
    balustrade(ms, f, [(-T / 2, -Td / 2), (-1.8 * k, -Td / 2)], G + t1 - 0.01, h=0.8 * k, post_step=0.1)
    balustrade(ms, f, [(1.8 * k, -Td / 2), (T / 2, -Td / 2), (T / 2, Td / 2), (-T / 2, Td / 2), (-T / 2, -Td / 2)], G + t1 - 0.01,
               h=0.8 * k, post_step=0.1)
    T2, Td2 = 21.0 * k, 16.5 * k
    ms.box('snk_balus', (T2, Td2, t1), at=(0, 0.6 * k, G + t1 - 0.01), lod=2, frame=f)
    balustrade(ms, f, [(-T2 / 2, -Td2 / 2 + 0.6 * k), (-1.8 * k, -Td2 / 2 + 0.6 * k)], G + 2 * t1 - 0.01, h=0.8 * k, post_step=0.1)
    balustrade(ms, f, [(1.8 * k, -Td2 / 2 + 0.6 * k), (T2 / 2, -Td2 / 2 + 0.6 * k)], G + 2 * t1 - 0.01, h=0.8 * k, post_step=0.1)
    # front stairs: twin flights round a carved slab, up both terrace steps
    wedge(ms, 'snk_balus', f, -1.8 * k, 1.8 * k, -Td / 2 - 2.2 * k, -Td / 2 + 0.01, G, 0.004, t1, lod=1)
    wedge(ms, 'snk_balus', f, -1.8 * k, 1.8 * k, -Td2 / 2 + 0.6 * k - 2.2 * k, -Td2 / 2 + 0.6 * k + 0.01, G + t1 - 0.01, 0.004, t1, lod=1)
    # the carved dragon slab between the flights, and a side stair on each flank
    wedge(ms, 'snk_stone', f, -0.5 * k, 0.5 * k, -Td / 2 - 2.2 * k, -Td / 2 + 0.01, G, 0.006, t1 + 0.004, lod=0)
    for sx in (-1, 1):
        sf = f @ Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
        wedge(ms, 'snk_balus', sf, -1.4 * k, 1.4 * k, -T / 2 - 1.8 * k, -T / 2 + 0.01, G, 0.004, t1, lod=1)
    zt0 = G + 2 * t1 - 0.01
    # the hall
    hw, hd = 17.0 * k, 11.0 * k
    hh = 4.2 * k
    cy = 0.8 * k
    hf = f @ Matrix.Translation(Vector((0, cy, 0)))
    ms.box('snk_green', (hw - 1.6 * k, hd - 1.6 * k, hh), at=(0, 0, zt0), lod=2, frame=hf)
    nx, ny = 6, 4
    for i in range(nx):
        for j in range(ny):
            if 0 < i < nx - 1 and 0 < j < ny - 1:
                continue
            px, py = -hw / 2 + hw * i / (nx - 1), -hd / 2 + hd * j / (ny - 1)
            ms.cyl('snk_lacquer', 0.32 * k, 0.3 * k, hh, at=(px, py, zt0), segs=6, lod=1 if (i in (0, nx - 1) or j == 0) else 0, frame=hf)
    for kk in range(4):
        rf = hf @ Matrix.Rotation(math.radians(90 * kk), 4, 'Z')
        L = hw if kk % 2 == 0 else hd
        D2 = hd if kk % 2 == 0 else hw
        ms.box('snk_lacquer', (L + 0.6 * k, 0.45 * k, 0.5 * k), at=(0, -D2 / 2, zt0 + hh - 0.5 * k), lod=1, frame=rf)
        ms.box('snk_paint', (L + 1.2 * k, 0.9 * k, 0.9 * k), at=(0, -D2 / 2 - 0.2 * k, zt0 + hh), lod=1, frame=rf)
        if kk == 0:
            for i in range(nx - 1):
                px = -hw / 2 + hw * (i + 0.5) / (nx - 1)
                ms.box('team_cloth', (hw / (nx - 1) * 0.85, 0.006, 0.9 * k), at=(px, -D2 / 2 - 0.02, zt0 + hh - 1.4 * k), lod=0, frame=rf)
                for q in (-1, 1):
                    ms.box('snk_lacquer', (0.05 * k + 0.004, 0.006, hh * 0.6), at=(px + q * hw / (nx - 1) * 0.2, -(hd - 1.6 * k) / 2 - 0.004,
                                                                                   zt0), lod=0, frame=rf)
    zr = zt0 + hh + 0.9 * k
    zt = curved_roof(ms, hf, hw + 0.6 * k, hd + 0.6 * k, zr, G + top - zr - 0.25 * k, over=2.4 * k, curl=1.2 * k, kind='xie', gable=0.55,
                     lod=2, horns=0.5 * k, thick=0.3 * k, ridge_mat='snk_white', sag=1.9)
    return zt


# ---- the regional palaces and walls --------------------------------------------------------------

def stone_lantern(ms, f, x, y, s=1.0):
    ms.box('snk_balus', (0.03 * s, 0.03 * s, 0.07 * s), at=(x, y, G), lod=0, frame=f)
    ms.box('snk_balus', (0.05 * s, 0.05 * s, 0.025 * s), at=(x, y, G + 0.07 * s), lod=0, frame=f)
    ms.cyl('snk_balus', 0.04 * s, 0.0, 0.03 * s, at=(x, y, G + 0.095 * s), segs=4, lod=0, frame=f)


def palace_small(ms, rng):
    """`palace-small` (sheet: a 23 m walled court with 3.2 m walls; the main hall 11 m wide, 8.5 m
    high): a plastered compound wall on grey brick under a tiled coping, a gate hall with red doors
    up steps between stone lanterns at the front, two side halls, and the main hall on a stone
    terrace at the back with red pillars, lattice doors, grey cloth valances and a hip-and-gable
    roof; a paved court with trees. Built to fit the 12 m free centre (11 x 9 m)."""
    f = tm.house_frame(0, 0, 0)
    W, D = 1.1, 0.9
    ms.box('snk_paving_square', (W - 0.04, D - 0.04, 0.008), at=(0, 0, G), lod=1, frame=f)
    wh = 0.22
    court_wall(ms, f, -W / 2, -D / 2, W / 2, -D / 2, h=wh, gaps=((0.5, 0.2),), lod=2)
    for sx in (-1, 1):
        court_wall(ms, f, sx * W / 2, -D / 2, sx * W / 2, D / 2, h=wh, lod=2)
    court_wall(ms, f, -W / 2, D / 2, W / 2, D / 2, h=wh, lod=2)
    # the gate hall
    gf = f @ Matrix.Translation(Vector((0, -D / 2, 0)))
    ms.box('snk_plaster', (0.22, 0.12, 0.25), at=(0, 0, G), lod=2, frame=gf)
    for sx in (-1, 1):
        ms.box('snk_lacquer', (0.024, 0.024, 0.25), at=(sx * 0.1, -0.066, G), lod=1, frame=gf)
    dbl_door(ms, gf, 0, -0.06, w=0.12, h=0.2, z=G, mat='snk_lacquer')
    curved_roof(ms, gf, 0.22, 0.12, G + 0.25, 0.11, over=0.05, curl=0.03, kind='xie', lod=2, horns=0.03)
    steps(ms, gf, 0, -0.12, 0.16, 0.04, n=3, run=0.02)
    for sx in (-1, 1):
        stone_lantern(ms, f, sx * 0.2, -D / 2 - 0.08)
    # side halls
    for sx in (-1, 1):
        sf = f @ Matrix.Translation(Vector((sx * (W / 2 - 0.12), -0.08, 0))) @ Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
        hall(ms, sf, 0.4, 0.15, 0.24, rise=0.12, kind='xie', n=4, windows=True, lod=2, over=0.05, curl=0.025, back=False)
    # the main hall on its terrace
    hf = f @ Matrix.Translation(Vector((0, D / 2 - 0.22, 0)))
    ms.box('snk_stone', (0.66, 0.36, 0.06), at=(0, 0, G), lod=2, frame=hf)
    balustrade(ms, hf, [(-0.33, -0.18), (-0.08, -0.18)], G + 0.06, h=0.04)
    balustrade(ms, hf, [(0.08, -0.18), (0.33, -0.18)], G + 0.06, h=0.04)
    steps(ms, hf, 0, -0.18, 0.14, 0.06, n=3, run=0.025)
    hw, hd, hh = 0.56, 0.24, 0.34
    z = G + 0.06
    ms.box('snk_plaster', (hw, hd, hh), at=(0, 0.01, z), lod=2, frame=hf)
    ms.box('snk_lacquer', (hw * 0.92, 0.01, hh * 0.84), at=(0, -hd / 2 + 0.006, z), lod=0, frame=hf)
    for i in range(6):
        px = -hw / 2 + hw * i / 5
        ms.box('snk_lacquer', (0.026, 0.026, hh), at=(px, -hd / 2 - 0.03, z), lod=1, frame=hf)
    ms.box('snk_lacquer', (hw + 0.03, 0.03, 0.03), at=(0, -hd / 2 - 0.03, z + hh - 0.03), lod=1, frame=hf)
    dbl_door(ms, hf, 0, -hd / 2 + 0.002, w=0.12, h=0.24, z=z, mat='snk_lacquer')
    for k in (-1, 1):
        lattice(ms, hf, k * 0.17, -hd / 2 + 0.002, z + 0.1, w=0.08, h=0.14)
        ms.box('team_cloth', (0.1, 0.006, 0.07), at=(k * 0.17, -hd / 2 - 0.045, z + hh - 0.1), lod=1, frame=hf)
    curved_roof(ms, hf, hw + 0.04, hd + 0.06, z + hh, 0.22, over=0.09, curl=0.05, kind='xie', lod=2, horns=0.05)
    for sx in (-1, 1):
        tree(ms, rng, sx * 0.25, -0.12, h=0.3, r=0.07, blossom=sx > 0)
        tc.shrub(ms, sx * 0.42, D / 2 - 0.08, r=0.04, lod=0)
    return f


def palace(ms, rng):
    """`palace` (sheet: a 56 m walled palace rising in terraces to a 23 m main hall): a grey brick
    enclosure with corner watch pavilions, a gate hall with red doors and two team banners at the
    front, long side galleries, a middle hall on a terrace and the main hall raised on a higher
    balustraded terrace at the back, both with red pillars and hip-and-gable roofs; paved courts
    with pines. Built to fit the free centre (13 x 13 m)."""
    f = tm.house_frame(0, 0, 0)
    W, D = 1.3, 1.3
    ms.box('snk_paving_square', (W - 0.04, D - 0.04, 0.008), at=(0, 0, G), lod=1, frame=f)
    wh = 0.3
    t = 0.07
    for (x0, y0, x1, y1, gaps) in ((-W / 2, -D / 2, W / 2, -D / 2, ((0.5, 0.3),)), (W / 2, -D / 2, W / 2, D / 2, ()),
                                   (W / 2, D / 2, -W / 2, D / 2, ()), (-W / 2, D / 2, -W / 2, -D / 2, ())):
        court_wall(ms, f, x0, y0, x1, y1, h=wh, t=t, gaps=gaps, lod=2, wall='snk_brick')
    for sx in (-1, 1):
        for sy in (-1, 1):
            cf = f @ Matrix.Translation(Vector((sx * (W / 2 - 0.05), sy * (D / 2 - 0.05), 0)))
            ms.box('snk_brick', (0.16, 0.16, wh + 0.08), at=(0, 0, G), lod=2, frame=cf, taper=0.92)
            for qx in (-1, 1):
                for qy in (-1, 1):
                    ms.box('snk_lacquer', (0.016, 0.016, 0.1), at=(qx * 0.045, qy * 0.045, G + wh + 0.08), lod=0, frame=cf)
            curved_roof(ms, cf, 0.1, 0.1, G + wh + 0.18, 0.1, over=0.045, curl=0.025, kind='point', lod=2, ornaments=False)
    # the gate hall
    gf = f @ Matrix.Translation(Vector((0, -D / 2 + 0.04, 0)))
    ms.box('snk_brick', (0.38, 0.16, wh + 0.03), at=(0, 0, G), lod=2, frame=gf)
    tk.arch_face(ms, gf, 'snk_lacquer', 0, -0.084, G, 0.065, 0.17, lod=1, horseshoe=False, n=6)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.07, 0.006, 0.2), at=(sx * 0.14, -0.084, G + wh - 0.22), lod=1, frame=gf)
    z = G + wh + 0.03
    ms.box('snk_plaster', (0.3, 0.12, 0.16), at=(0, 0, z), lod=2, frame=gf)
    for i in range(5):
        ms.box('snk_lacquer', (0.02, 0.02, 0.16), at=(-0.15 + 0.075 * i, -0.065, z), lod=0, frame=gf)
    curved_roof(ms, gf, 0.3, 0.12, z + 0.16, 0.12, over=0.06, curl=0.035, kind='xie', lod=2, horns=0.03)
    steps(ms, gf, 0, -0.08, 0.2, 0.03, n=2, run=0.03)
    # the side galleries
    for sx in (-1, 1):
        sf = f @ Matrix.Translation(Vector((sx * (W / 2 - 0.12), -0.02, 0))) @ Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
        hall(ms, sf, 0.9, 0.13, 0.2, rise=0.09, kind='gable', n=7, windows=False, lod=2, over=0.04, curl=0.02, back=False, doors=False)
    # the middle hall
    mf = f @ Matrix.Translation(Vector((0, -0.12, 0)))
    ms.box('snk_stone', (0.56, 0.3, 0.06), at=(0, 0, G), lod=2, frame=mf)
    steps(ms, mf, 0, -0.15, 0.14, 0.06, n=3, run=0.025)
    hall(ms, mf @ Matrix.Translation(Vector((0, 0, 0.06))), 0.46, 0.2, 0.26, rise=0.16, kind='xie', n=6, lod=2, over=0.07, curl=0.04,
         horns=0.04, plinth=0.0)
    # the main hall on the high terrace at the back
    bf = f @ Matrix.Translation(Vector((0, D / 2 - 0.27, 0)))
    tz = 0.2
    ms.box('snk_balus', (0.8, 0.4, tz), at=(0, 0, G), lod=2, frame=bf)
    balustrade(ms, bf, [(-0.4, -0.2), (-0.09, -0.2)], G + tz, h=0.04)
    balustrade(ms, bf, [(0.09, -0.2), (0.4, -0.2)], G + tz, h=0.04)
    wedge(ms, 'snk_balus', bf, -0.09, 0.09, -0.2 - 0.22, -0.2 + 0.005, G, 0.004, tz, lod=1)
    zb = G + tz
    hw, hd, hh = 0.64, 0.28, 0.34
    ms.box('snk_plaster', (hw, hd, hh), at=(0, 0.02, zb), lod=2, frame=bf)
    ms.box('snk_lacquer', (hw * 0.92, 0.01, hh * 0.84), at=(0, -hd / 2 + 0.024, zb), lod=0, frame=bf)
    for i in range(7):
        ms.box('snk_lacquer', (0.028, 0.028, hh), at=(-hw / 2 + hw * i / 6, -hd / 2 - 0.01, zb), lod=1, frame=bf)
    ms.box('snk_lacquer', (hw + 0.03, 0.03, 0.03), at=(0, -hd / 2 - 0.01, zb + hh - 0.03), lod=1, frame=bf)
    dbl_door(ms, bf, 0, -hd / 2 + 0.02, w=0.14, h=0.25, z=zb, mat='snk_lacquer')
    for kx in (-1, 1):
        for wx in (0.15, 0.25):
            lattice(ms, bf, kx * wx, -hd / 2 + 0.02, zb + 0.1, w=0.07, h=0.15)
    uw, ud = hw * 0.78, hd * 0.72
    curved_roof(ms, bf, hw + 0.04, hd + 0.06, zb + hh, 0.08, over=0.09, curl=0.05, kind='skirt', top=(uw / 2, ud / 2), lod=2,
                cy=0.02)
    z2 = zb + hh + 0.08
    ms.box('snk_plaster', (uw, ud, 0.16), at=(0, 0.02, z2), lod=2, frame=bf)
    for i in range(5):
        lattice(ms, bf, -uw * 0.36 + uw * 0.18 * i, -ud / 2 + 0.018, z2 + 0.03, w=0.06, h=0.09)
    balustrade(ms, bf, [(-uw / 2 - 0.02, -ud / 2), (uw / 2 + 0.02, -ud / 2)], z2, h=0.035, mat='snk_lacquer')
    curved_roof(ms, bf, uw + 0.04, ud + 0.04, z2 + 0.16, 0.24, over=0.1, curl=0.06, kind='xie', lod=2, horns=0.06, cy=0.02)
    for sx in (-1, 1):
        pine(ms, sx * 0.32, -0.38, h=0.32, r=0.08)
        pine(ms, sx * 0.4, 0.14, h=0.28, r=0.07)
    return f


def walls_medium(ms, rng):
    """`walls-medium` (sheet: a 52 m front, 6 m grey brick walls with crenellations and slits, 12 m
    corner towers with small pavilion roofs, a 12 m gatehouse with an arched gate, timber doors,
    two team banners and a two-storey gate pavilion): a square ring 6.6 units across outside, the
    gate in the south, raised 1.3x like the other wall rings."""
    RAISE = tb.WALL_RAISE
    R = 3.3  # outer half width
    t = 0.24
    H = 0.6 * RAISE
    f = tm.house_frame(0, 0, 0)
    gw = 1.1  # the gatehouse width
    # the four curtains (the south one either side of the gatehouse)
    segs = [((-R, -R + t / 2), (-gw / 2, -R + t / 2)), ((gw / 2, -R + t / 2), (R, -R + t / 2)),
            ((R - t / 2, -R), (R - t / 2, R)), ((R, R - t / 2), (-R, R - t / 2)), ((-R + t / 2, R), (-R + t / 2, -R))]
    for (x0, y0), (x1, y1) in segs:
        L = math.hypot(x1 - x0, y1 - y0)
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        sf = f @ Matrix.Translation(Vector(((x0 + x1) / 2, (y0 + y1) / 2, 0))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')
        ms.box('snk_stone', (L, t + 0.06, 0.05), at=(0, 0, G - 0.02), lod=1, frame=sf)
        ms.box('snk_brick', (L, t, H), at=(0, 0, G - 0.01), lod=2, frame=sf)
        # the outer face is local -Y for the ring walked counter-clockwise? place merlons on both edges
        n = max(2, int(L / 0.11))
        for i in range(n):
            xx = -L / 2 + L * (i + 0.5) / n
            ms.box('snk_brick', (0.05, 0.035, 0.06), at=(xx, -t / 2 + 0.018, G + H - 0.01), lod=0, frame=sf)
            if i % 3 == 1:
                ms.box('dark', (0.018, 0.008, 0.05), at=(xx, -t / 2 - 0.003, G + H * 0.62), lod=0, frame=sf)
        ms.box('snk_brick', (L, 0.03, 0.04), at=(0, t / 2 - 0.015, G + H - 0.01), lod=1, frame=sf)
        ms.box('snk_stone', (L, t - 0.08, 0.006), at=(0, 0, G + H - 0.01), lod=0, frame=sf)
    # corner towers with pavilions
    for sx in (-1, 1):
        for sy in (-1, 1):
            cf = f @ Matrix.Translation(Vector((sx * (R - 0.3), sy * (R - 0.3), 0)))
            b, h = 0.78, 0.8 * RAISE
            ms.box('snk_stone', (b + 0.06, b + 0.06, 0.06), at=(0, 0, G - 0.02), lod=1, frame=cf)
            ms.box('snk_brick', (b, b, h), at=(0, 0, G - 0.01), lod=2, frame=cf, taper=0.9)
            tb.merlons(ms, cf, 0, 0, b * 0.88, b * 0.88, G + h - 0.01, step=0.09, size=0.04, h=0.05, mat='snk_brick')
            pw, ph = 0.46, 0.22
            for qx in (-1, 1):
                for qy in (-1, 1):
                    ms.box('snk_lacquer', (0.025, 0.025, ph), at=(qx * pw / 2, qy * pw / 2, G + h), lod=1, frame=cf)
            ms.box('snk_timber', (pw - 0.03, pw - 0.03, ph * 0.75), at=(0, 0, G + h), lod=1, frame=cf)
            curved_roof(ms, cf, pw, pw, G + h + ph, 0.24, over=0.12, curl=0.06, kind='point', lod=2, finial=True, thick=0.025)
    # the gatehouse and its pavilion
    gd = t + 0.3
    gf = f @ Matrix.Translation(Vector((0, -R + t / 2, 0)))
    gh = H + 0.06
    ms.box('snk_stone', (gw + 0.08, gd + 0.06, 0.06), at=(0, 0, G - 0.02), lod=1, frame=gf)
    ms.box('snk_brick', (gw, gd, gh), at=(0, 0, G - 0.01), lod=2, frame=gf)
    tb.merlons(ms, gf, 0, 0, gw, gd, G + gh - 0.01, step=0.1, size=0.04, h=0.05, mat='snk_brick')
    tk.arch_face(ms, gf, 'dark', 0, -gd / 2 - 0.004, G, 0.15, 0.34, lod=1, horseshoe=False, n=6)
    tk.arch_face(ms, gf, 'snk_timber', 0, -gd / 2 - 0.007, G, 0.13, 0.32, lod=0, horseshoe=False, n=6)
    tk.arch_face(ms, gf, 'dark', 0, gd / 2 + 0.004, G, 0.15, 0.34, lod=1, horseshoe=False, n=6)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.12, 0.006, 0.42), at=(sx * 0.34, -gd / 2 - 0.005, G + gh - 0.5), lod=1, frame=gf)
    z = G + gh
    pw, pd = gw * 0.82, gd * 0.8
    ms.box('snk_timber', (pw, pd, 0.26), at=(0, 0, z), lod=2, frame=gf)
    for i in range(7):
        ms.box('snk_lacquer', (0.026, 0.026, 0.26), at=(-pw / 2 + pw * i / 6, -pd / 2 - 0.012, z), lod=0, frame=gf)
    balustrade(ms, gf, [(-pw / 2 - 0.03, -pd / 2 - 0.03), (pw / 2 + 0.03, -pd / 2 - 0.03)], z, h=0.06, mat='snk_lacquer')
    curved_roof(ms, gf, pw, pd, z + 0.26, 0.1, over=0.11, curl=0.06, kind='skirt', top=(pw * 0.38, pd * 0.36), lod=2, thick=0.025)
    z2 = z + 0.36
    ms.box('snk_timber', (pw * 0.76, pd * 0.72, 0.18), at=(0, 0, z2), lod=2, frame=gf)
    for i in range(6):
        ms.box('dark', (0.07, 0.008, 0.08), at=(-pw * 0.3 + pw * 0.12 * i, -pd * 0.36 - 0.003, z2 + 0.05), lod=0, frame=gf)
    curved_roof(ms, gf, pw * 0.76, pd * 0.72, z2 + 0.18, 0.26, over=0.13, curl=0.065, kind='xie', lod=2, horns=0.05, thick=0.03)
    # a stair up the inside by the west tower
    for i in range(8):
        ms.box('snk_brick', (0.07, 0.12, H * (i + 1) / 8), at=(-R + t + 0.06, -R + 0.8 + 0.07 * i, G - 0.01), lod=0, frame=f)


# ---- building a town on a base Kingdoms layout ----------------------------------------------------
# The town scripts take the base town's calls as recorded in build_town_kingdoms_europe_<size>_<v>.py
# (positions, sizes, yaws as build_town_kingdoms_<size>_<v>.py drew them); `replay` swaps each for
# this kit's piece. Landmarks: (kind, scale s, top) per town size; s = 1 is the sheet's size.

SIZES = {
    'small': dict(pagoda=(0.6, 1.62), drum=(0.72, 1.08), jpagoda=(0.85, 1.63), tenshu=(1.05, 1.24), korea=(0.55, 0.53)),
    'medium': dict(pagoda=(0.75, 2.02), drum=(0.85, 1.28), jpagoda=(1.0, 1.92), tenshu=(1.25, 1.48), korea=(0.7, 0.67)),
    'big': dict(pagoda=(0.9, 2.43), drum=(1.0, 1.5), jpagoda=(1.2, 2.3), tenshu=(1.45, 1.71), korea=(0.85, 0.82)),
}
LANDMARKS = {'pagoda': pagoda, 'drum': drum_tower, 'jpagoda': jp_pagoda, 'tenshu': tenshu, 'korea': korean_hall}
FOOT = {'pagoda': (8.2, 8.2), 'drum': (7.4, 7.4), 'jpagoda': (6.1, 6.1), 'tenshu': (4.9, 5.2), 'korea': (12.2, 11.2)}  # half extents in sheet m
HOUSES = ('tudor_house', 'town_house', 'court_house', 'flat_house', 'house')
VEG = ('tree', 'palm', 'broadleaf', 'conifer', 'cypress', 'shrub', 'clutter', 'woodpile', 'garden', 'market_stall', 'jar', 'well',
       'fountain', 'wattle_fence', 'stone_wall', 'pergola')
REC = []  # (call index, name, first part, last part) of the last replay, for the layout check


def house_kind(name, w, d, kw):
    area = w * d
    storeys = kw.get('storeys', 2 if kw.get('two') else 1)
    if name == 'court_house' or area >= 0.6:
        return 'rich'
    if area < 0.3 or (storeys == 1 and area < 0.36) or kw.get('roof') == 'thatch' and area < 0.42:
        return 'poor'
    return 'common'


def _rect(cx, cy, hx, hy, yaw):
    c, s = abs(math.cos(math.radians(yaw))), abs(math.sin(math.radians(yaw)))
    ex, ey = hx * c + hy * s, hx * s + hy * c
    return (cx - ex, cy - ey, cx + ex, cy + ey)


def landmark_rect(kind, x, y, s, yaw):
    hx, hy = FOOT[kind]
    k = s / 10.0
    return _rect(x, y, hx * k, hy * k, yaw)


def _inside(px, py, r, m=0.04):
    return r[0] - m < px < r[2] + m and r[1] - m < py < r[3] + m


def _overlap(a, b):
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def base_layout(size, v):
    """The base town's recorded calls and ground, read from build_town_kingdoms_europe_<size>_<v>.py
    without importing it (which would register the Europe kit's materials too)."""
    import ast
    import re
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_town_kingdoms_europe_%s_%s.py' % (size, v))).read()
    calls = ast.literal_eval(re.search(r"^CALLS = (\[.*?\])\n\n", src, re.S | re.M).group(1))
    ground = ast.literal_eval(re.search(r"^GROUND = (\{.*?\})\n", src, re.M).group(1))
    return calls, ground


def town_main(style, size, v, override):
    """Build kingdoms-town-<size>-<v>-<style>.glb (object town-<size>-<v>) on the base layout."""
    calls, ground = base_layout(size, v)

    def layout(ms, rng):
        replay(ms, rng, calls, size, override=override, style=style)
    main('kingdoms-town-%s-%s-%s' % (size, v, style), 'town-%s-%s' % (size, v), layout, ground)


def replay(ms, rng, calls, size, override=None, style='sinic'):
    """Build the base layout's calls with this kit. `override` maps a call's index to a landmark
    kind ('pagoda', 'drum', 'jpagoda', 'tenshu', 'korea'), 'skip', a house kind, or (kind, dict)
    with x, y, s, top, yaw. Base pieces that a landmark covers are left out."""
    set_style(style)
    DETAIL['big'] = size == 'big'
    override = override or {}
    del REC[:]
    lms = []
    for i, ov in override.items():
        kind, opt = (ov, {}) if isinstance(ov, str) else ov
        if kind not in LANDMARKS:
            continue
        name, args, kw = calls[i]
        s, top = SIZES[size][kind]
        o = dict(x=args[0], y=args[1], s=s, top=top, yaw=0)
        o.update(opt)
        lms.append((i, kind, o, landmark_rect(kind, o['x'], o['y'], o['s'], o['yaw'])))
    covered = [r for _i, _k, _o, r in lms]
    world = tm.house_frame(0, 0, 0)
    tree_n = 0
    for i, (name, args, kw) in enumerate(calls):
        start = len(ms.parts)
        ov = override.get(i)
        kind = ov if isinstance(ov, str) or ov is None else ov[0]
        if kind == 'skip':
            continue
        if kind in LANDMARKS:
            o = next(o for j, _k, o, _r in lms if j == i)
            LANDMARKS[kind](ms, rng, o['x'], o['y'], s=o['s'], top=o['top'], yaw=o['yaw'])
            REC.append((i, kind, start, len(ms.parts)))
            continue
        if name in VEG and len(args) >= 2 and isinstance(args[0], (int, float)) and any(_inside(args[0], args[1], r) for r in covered):
            continue
        if name in HOUSES and kind in (None, 'poor', 'common', 'rich'):
            x, y, w, d = args[:4]
            hr = _rect(x, y, w / 2, d / 2, kw.get('yaw', 0) or 0)
            if any(_overlap(hr, r) > 0.02 for r in covered):
                continue
            k = kind or house_kind(name, w, d, kw)
            house(ms, rng, k, x, y, w, d, yaw=kw.get('yaw'), awning_w=kw.get('awning_w') if k == 'common' else None)
        elif name in ('church', 'cathedral', 'mosque', 'caravanserai', 'keep_tower'):
            pass  # a landmark spot that the town script gives no override: left free
        elif name == 'arcade_hall':
            x, y, w, d = args[:4]
            hr = _rect(x, y, w / 2, d / 2, kw.get('yaw', 0) or 0)
            if any(_overlap(hr, r) > 0.02 for r in covered):
                continue
            market_hall(ms, rng, x, y, w * 0.8, d * 0.62, yaw=kw.get('yaw'))
        elif name == 'round_tower':
            watchtower(ms, args[0], args[1], s=1.0, face=0)
        elif name == 'stone_tower':
            watchtower(ms, args[0], args[1], s=1.1, face=0)
        elif name == 'market_stall':
            stall(ms, rng, args[0], args[1], yaw=kw.get('yaw'), w=kw.get('w', 0.34), d=kw.get('d', 0.28))
        elif name in ('street', 'paved_strip'):
            if name == 'street':
                tk.street(ms, args[0], args[1], mat='snk_paving_square')
            else:
                x0, y0, x1, y1, w = args
                tk.street(ms, [(x0, y0), (x1, y1)], w, mat='snk_paving_square')
        elif name == 'garden':
            tk.garden(ms, rng, *args, **kw)
        elif name == 'wattle_fence':
            for (x0, y0), (x1, y1) in zip(args[0], args[0][1:]):
                court_wall(ms, world, x0, y0, x1, y1, h=0.1, t=0.03, lod=1, wall='snk_brick')
        elif name == 'stone_wall':
            x0, y0, x1, y1 = args[:4]
            court_wall(ms, world, x0, y0, x1, y1, h=kw.get('h', 0.12) + 0.03, t=0.035, lod=1)
        elif name in ('tree', 'broadleaf', 'palm'):
            tree_n += 1
            tree(ms, rng, args[0], args[1], h=kw.get('h', 0.42) * 0.85, r=kw.get('r', 0.14) * 0.85, blossom=tree_n % 4 == 0)
        elif name in ('conifer', 'cypress'):
            pine(ms, args[0], args[1], h=kw.get('h', 0.45) * 0.9, r=0.1)
        elif name == 'shrub':
            tc.shrub(ms, *args, **kw)
        elif name in ('well', 'fountain'):
            well(ms, args[0], args[1], yaw=kw.get('yaw', 10))
        elif name == 'clutter':
            jars(ms, world, args[0], args[1], rng, min(3, int(args[2]) if len(args) > 2 else 3))
        elif name == 'woodpile':
            tt.woodpile(ms, world, args[0], args[1], args[2] if len(args) > 2 else 0)
        elif name == 'jar':
            tt.jar(ms, world, args[0], args[1], 1.2)
        # anything else (the pergola in the free centre) is left out
        REC.append((i, name, start, len(ms.parts)))


def main(file_name, obj_name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(PAVED)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
