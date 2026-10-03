# scripts/blender/ti_europe_kingdoms.py
# The Europe kit for the Kingdoms Age (art spec 3b), from the sheets in
# plans/art/kits/europe/kingdoms/: houses.png (a 4 x 6 m ochre half-timbered cottage under a slate
# gable; a 6 x 10 m town house, a grey stone ground floor with a jettied half-timbered upper floor
# in cream plaster under a steep slate gable; a 10 x 14 m merchant house with a cross gable, a bay
# window, dormers, chimneys and a walled yard), street.png and roofscape.png (cobbled lanes, stalls
# under team cloth, barrels, log stores, garden walls), materials.png, the Gothic church
# (landmark-1), the stone keep (landmark-2), the onion-domed church of the Orthodox east
# (landmark-east), palace-small, palace and walls-medium.
# Uses ti_kingdoms.py's helpers (street, trees, lod2_block, round_tower, stone_ring) and
# ti_classical.py's gable_roof unchanged.
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `ek_` prefix.
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

NEW = ['ek_stone', 'ek_plaster', 'ek_daub', 'ek_slate', 'ek_limestone', 'ek_white', 'ek_lead', 'ek_copper', 'ek_glass',
       'ek_gold', 'ek_cobble', 'ek_cobble_fringe', 'ek_cobble_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'ek_cobble': 'Ground', 'ek_cobble_fringe': 'Ground', 'ek_cobble_square': 'Ground'})
if 'ek_cobble_fringe' not in tt.FRINGES:
    tt.FRINGES.append('ek_cobble_fringe')


def make_materials():
    # the houses: grey rubble ashlar ground floors, cream plaster and ochre daub in dark oak frames
    tm.mat_mudwall('ek_stone', wash='#8b8780', brick='#8d8982', brick2='#6f6c66', mortar='#a39e94', wash_cover=0.0,
                   bond=(0.045, 0.026, 0.004))
    tm.mat_simple('ek_plaster', ['#e6d8b6', '#ddcda6', '#eee3c8', '#d6c49a'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_simple('ek_daub', ['#c69548', '#d4a55a', '#b98a42', '#dcb06a'], scale=20.0, bump=0.3, dirt=True)
    # dark blue-grey slate in small courses
    tm.mat_mudwall('ek_slate', wash='#3e4450', brick='#434a57', brick2='#343a45', mortar='#22262d', wash_cover=0.0,
                   bond=(0.02, 0.011, 0.0018))
    # the church and the keep: limestone blocks, light grey-beige
    tm.mat_mudwall('ek_limestone', wash='#a8a193', brick='#aba496', brick2='#958e80', mortar='#c2bcae', wash_cover=0.0,
                   bond=(0.06, 0.032, 0.004))
    # the Orthodox church: white lime plaster, lead sheet roofs, weathered copper domes, gilt crosses
    tm.mat_simple('ek_white', ['#e9e5dc', '#f1eee8', '#dcd6ca', '#e4dfd4'], scale=14.0, bump=0.2, dirt=True)
    tm.mat_simple('ek_lead', ['#5a5f66', '#6a7077', '#4e535a'], scale=10.0, stripes={'dir': 'X', 'scale': 60.0, 'distortion': 0.5},
                  bump=0.25, rough=0.6)
    tm.mat_simple('ek_copper', ['#2f6964', '#3f7f78', '#5a958a', '#2a5a58'], scale=24.0, bump=0.3, rough=0.55)
    tm.mat_simple('ek_glass', ['#2c3644', '#3a4656', '#283039'], scale=40.0, bump=0.2, rough=0.35)
    tm.mat_simple('ek_gold', ['#a07a2a', '#c49a3a', '#8a6a24'], scale=30.0, rough=0.35, metal=0.7, bump=0.1)
    for n in ('ek_cobble', 'ek_cobble_fringe'):
        tc.mat_paving(n, stone=('#8a857c', '#77736b', '#9a958b'), mortar='#56524b', slab=(0.02, 0.016))
    tc.mat_paving('ek_cobble_square', stone=('#9d978b', '#8b867b', '#aaa498'), mortar='#625d55', slab=(0.026, 0.02))


if not any(n == 'europe_kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('europe_kingdoms', make_materials))

COBBLED = dict(mat='ek_cobble', power=8)
FOOT = []


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        p = f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))
        pts.append((p.x, p.y))
    FOOT.append((tag, pts))


def obox(ms, only, mat, size, at=(0, 0, 0), frame=None, rot_z=0.0):
    """A plain box shown only at the LODs in `only`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = tm.Mesher._m(at, rot_z)
    if frame is not None:
        m = frame @ m
    lod = max(only) if isinstance(only, tuple) else only
    return ms.add(bm, mat, lod, m, only=only)


# ---- house parts --------------------------------------------------------------------------------

def frame(ms, f, w, d, z0, h, step=0.12, braces=True):
    """Dark oak framing on the four faces of a w x d block from z0 up h: sill, mid rail and wall
    plate, studs, and corner braces on the long faces (LOD0 only; LOD1 keeps the corner posts)."""
    t = 0.014
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.024, 0.024, h), at=(sx * (w / 2 - 0.003), sy * (d / 2 - 0.003), z0), lod=0, frame=f)
    for sy in (-1, 1):
        y = sy * (d / 2 + 0.003)
        for zz in (0.0, h * 0.5, h - t):
            ms.box('timber', (w, 0.008, t), at=(0, y, z0 + zz), lod=0, frame=f)
        n = max(2, round(w / step))
        for i in range(1, n):
            ms.box('timber', (t * 0.9, 0.008, h), at=(-w / 2 + w * i / n, y, z0), lod=0, frame=f)
        if braces:
            for sx in (-1, 1):
                bl = math.hypot(w / n, h * 0.5)
                ang = math.atan2(h * 0.5, w / n) * -sx
                bf = f @ Matrix.Translation((sx * (w / 2 - w / n / 2), y, z0 + h * 0.25)) @ Matrix.Rotation(ang, 4, 'Y')
                ms.box('timber', (bl, 0.008, t * 0.9), at=(0, 0, -t * 0.45), lod=0, frame=bf)
    for sx in (-1, 1):
        x = sx * (w / 2 + 0.003)
        for zz in (h * 0.5, h - t):
            ms.box('timber', (0.008, d, t), at=(x, 0, z0 + zz), lod=0, frame=f)
        ms.box('timber', (0.008, t * 0.9, h), at=(x, 0, z0), lod=0, frame=f)


def window(ms, f, x, y, z, w=0.05, h=0.07, shutters=True, glass=True):
    ms.box('ek_glass' if glass else 'dark', (w, 0.01, h), at=(x, y - 0.004, z), lod=0, frame=f)
    ms.box('timber', (w + 0.016, 0.012, 0.01), at=(x, y - 0.006, z - 0.008), lod=0, frame=f)
    if shutters:
        for sx in (-1, 1):
            ms.box('door', (w * 0.5, 0.008, h), at=(x + sx * w * 0.78, y - 0.007, z), lod=0, frame=f)


def door(ms, f, x, y, w=0.09, h=0.18, z=G):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, z), lod=1, frame=f)
    ms.box('ek_stone', (w + 0.03, 0.016, 0.02), at=(x, y - 0.006, z + h), lod=0, frame=f)
    ms.box('ek_stone', (w + 0.06, 0.05, 0.02), at=(x, y - 0.03, G), lod=0, frame=f)


def chimney(ms, f, x, y, z, h):
    ms.box('ek_stone', (0.06, 0.06, h), at=(x, y, z), lod=1, frame=f)
    ms.box('ek_stone', (0.075, 0.075, 0.02), at=(x, y, z + h), lod=0, frame=f)
    ms.cyl('terracotta', 0.014, 0.014, 0.03, at=(x, y, z + h + 0.02), segs=6, lod=0, frame=f)


def slate_roof(ms, f, w, d, z, rise, gable_front=False, gable='ek_plaster', over=0.035, lod=1):
    """A steep slate gable (ridge along local X, or the gable to the front with `gable_front`)."""
    if gable_front:
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        tc.gable_roof(ms, rf, d, w, z, rise, over=over, mat='ek_slate', gable=gable, thick=0.024, lod=lod, ridge='ek_slate')
    else:
        tc.gable_roof(ms, f, w, d, z, rise, over=over, mat='ek_slate', gable=gable, thick=0.024, lod=lod, ridge='ek_slate')


def poor_house(ms, rng, x, y, w, d, yaw=None, roof='slate', **_):
    """The cottage (sheet: 4 x 6 m): ochre daub in an oak frame on a rubble footing, a shuttered
    window and a plank door in the gable end facing the street, a steep slate (or thatch) roof,
    a stone chimney."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * 0.85
    ms.box('ek_stone', (w + 0.014, d + 0.014, 0.06), at=(0, 0, G), lod=1, frame=f)
    ms.box('ek_daub', (w, d, h - 0.06), at=(0, 0, G + 0.06), lod=1, frame=f)
    frame(ms, f, w, d, G + 0.06, h - 0.06, step=0.16)
    rise = 0.3
    gf = w < d * 1.15
    if roof == 'thatch':
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z') if gf else f
        tc.gable_roof(ms, rf, d if gf else w, w if gf else d, G + h, rise, over=0.05, mat='thatch', gable='ek_daub', thick=0.04, lod=1,
                      ridge='thatch')
    else:
        slate_roof(ms, f, w, d, G + h, rise, gable_front=gf, gable='ek_daub')
    dx = -w * 0.18
    door(ms, f, dx, -d / 2, w=0.08, h=0.17)
    window(ms, f, w * 0.22, -d / 2, G + 0.15)
    chimney(ms, f, w * 0.3, d * 0.25, G + h - 0.05, rise + 0.1)
    tk.lod2_block(ms, f, w, d, h, rise=rise if not gf else 0.0, mat='ek_slate')
    if rng.random() < 0.6:
        tk.barrel(ms, f, dx + 0.1, -d / 2 - 0.05)
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, gable_front=None, roof='slate', awning_w=None, barrels=1, chimneys=1, **_):
    """The town house (sheet: 6 x 10 m): a grey stone ground floor with a plank door and small
    windows, a half-timbered upper floor of cream plaster jettied out over the street on joists,
    shuttered leaded windows, a steep slate gable with a stone chimney; team-cloth awning."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    gf = (w < 0.72) if gable_front is None else gable_front
    h0, h1, jet = STOREY, STOREY * 0.9, 0.03
    ms.box('ek_stone', (w, d, h0), at=(0, 0, G), lod=1, frame=f, bevel=0.003)
    ms.box('ek_plaster', (w, d + 2 * jet, h1), at=(0, 0, G + h0), lod=1, frame=f)
    frame(ms, f, w, d + 2 * jet, G + h0, h1)
    for k in range(max(2, int(w / 0.1))):  # joist ends under the jetty
        ms.box('timber', (0.014, 0.03, 0.014), at=(-w / 2 + 0.05 + k * 0.1, -d / 2 - 0.012, G + h0 - 0.014), lod=0, frame=f)
    rise = 0.36 if not gf else 0.42
    z = G + h0 + h1
    if roof == 'thatch':
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z') if gf else f
        tc.gable_roof(ms, rf, (d + 2 * jet) if gf else w, w if gf else d + 2 * jet, z, rise, over=0.05, mat='thatch', gable='ek_plaster',
                      thick=0.04, lod=1, ridge='thatch')
    else:
        slate_roof(ms, f, w, d + 2 * jet, z, rise, gable_front=gf)
    dx = rng.uniform(-0.2, 0.2) * w
    door(ms, f, dx, -d / 2)
    window(ms, f, dx + (0.16 if dx < 0 else -0.16), -d / 2, G + 0.17, shutters=False)
    for wx in ((-w * 0.25, w * 0.25) if w > 0.55 else (0.0,)):
        window(ms, f, wx, -d / 2 - jet, G + h0 + 0.12)
    for k in range(chimneys):
        chimney(ms, f, (w * 0.3 if k == 0 else -w * 0.3), d * 0.2, z - 0.05, rise + 0.08)
    if awning_w:
        tt.front_shade(ms, f, -dx * 0.5, -d / 2, min(awning_w, w * 0.6), depth=0.15, z=0.25, mat='team_cloth')
    for i in range(barrels or 0):
        tk.barrel(ms, f, dx + (0.11 + 0.05 * i) * (1 if dx < 0 else -1), -d / 2 - 0.05)
    tk.lod2_block(ms, f, w, d, h0 + h1, rise=rise if not gf else 0.0, mat='ek_slate')
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, yard=None, **_):
    """The merchant house (sheet: 10 x 14 m): a stone ground floor with an arched door and leaded
    windows, a half-timbered cream upper floor with a jettied cross gable to the street over a bay
    window, a steep slate roof with dormers and two chimneys; a walled yard at the side with a
    shed and a tree (when the plot is wide)."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    yard = (w >= 0.86) if yard is None else yard
    bw = w * 0.72 if yard else w
    bx = -(w - bw) / 2
    hf = f @ Matrix.Translation(Vector((bx, 0, 0)))
    h0, h1 = STOREY, STOREY * 0.95
    ms.box('ek_stone', (bw, d, h0), at=(0, 0, G), lod=1, frame=hf, bevel=0.003)
    ms.box('ek_plaster', (bw, d + 0.04, h1), at=(0, 0, G + h0), lod=1, frame=hf)
    frame(ms, hf, bw, d + 0.04, G + h0, h1, step=0.1)
    z = G + h0 + h1
    rise = 0.38
    slate_roof(ms, hf, bw, d + 0.04, z, rise)
    # the cross gable: a jettied front bay with its own steep gable over a bay window
    gw = min(0.34, bw * 0.45)
    gx = -bw * 0.18
    gd = 0.12
    gf = hf @ Matrix.Translation(Vector((gx, -d / 2 - 0.02, 0)))
    ms.box('ek_plaster', (gw, gd, h1), at=(0, -gd / 2 + 0.02, G + h0), lod=1, frame=gf)
    frame(ms, gf, gw, gd, G + h0, h1, step=0.09, braces=False)
    rgf = gf @ Matrix.Translation(Vector((0, 0.02 + 0.08, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rgf, gd + 0.2, gw, z, rise + 0.06, over=0.03, mat='ek_slate', gable='ek_plaster', thick=0.024, lod=1, ridge='ek_slate')
    ms.box('ek_glass', (gw * 0.6, 0.01, 0.12), at=(0, -gd + 0.015, G + h0 + 0.12), lod=0, frame=gf)
    ms.box('timber', (gw * 0.7, 0.06, 0.03), at=(0, -gd + 0.02, G + h0 + 0.08), lod=0, frame=gf)  # the bay's sill
    # an arched door, windows, dormers, chimneys, lanterns
    door(ms, hf, bw * 0.18, -d / 2, w=0.1, h=0.2)
    for wx in (-bw * 0.35, -bw * 0.05, bw * 0.38):
        window(ms, hf, wx, -d / 2, G + 0.17, shutters=False)
    window(ms, hf, bw * 0.3, -d / 2 - 0.02, G + h0 + 0.12)
    for dxr in (bw * 0.28,):
        df = hf @ Matrix.Translation(Vector((dxr, -d / 4, z + 0.06)))
        ms.box('ek_plaster', (0.09, 0.1, 0.08), at=(0, 0, 0), lod=0, frame=df)
        ms.box('ek_glass', (0.05, 0.01, 0.05), at=(0, -0.055, 0.01), lod=0, frame=df)
        tc.gable_roof(ms, df @ Matrix.Rotation(math.radians(90), 4, 'Z'), 0.12, 0.1, 0.08, 0.05, over=0.01, mat='ek_slate',
                      gable='ek_plaster', thick=0.012, lod=0, ridge='ek_slate')
    chimney(ms, hf, -bw * 0.38, d * 0.15, z - 0.05, rise + 0.12)
    chimney(ms, hf, bw * 0.38, d * 0.1, z - 0.05, rise + 0.1)
    tk.lod2_block(ms, hf, bw, d, h0 + h1, rise=rise, mat='ek_slate')
    for sx in (bw * 0.18 - 0.08, bw * 0.18 + 0.08):
        tt.jar(ms, hf, sx, -d / 2 - 0.04, 0.9)
        ms.sphere('shrub', 0.03, at=(sx, -d / 2 - 0.04, G + 0.1), u=6, v=4, lod=0, frame=hf)
    if yard:
        yw = w - bw
        yx = w / 2 - yw / 2
        for (px, py, pw, pd) in ((yx, -d / 2 + 0.02, yw, 0.04), (yx, d / 2 - 0.02, yw, 0.04), (w / 2 - 0.02, 0, 0.04, d)):
            ms.box('ek_stone', (pw, pd, 0.13), at=(px, py, G), lod=1, frame=f)
        ms.box('door', (0.08, 0.012, 0.12), at=(yx, -d / 2 - 0.002, G), lod=0, frame=f)
        sf = f @ Matrix.Translation(Vector((yx, d * 0.25, 0)))
        ms.box('kg_planks', (yw * 0.6, 0.14, 0.13), at=(0, 0, G), lod=0, frame=sf)
        tc.gable_roof(ms, sf, yw * 0.6, 0.14, G + 0.13, 0.06, over=0.015, mat='ek_slate', gable='kg_planks', thick=0.012, lod=0,
                      ridge='ek_slate')
        p = f @ Vector((yx, -d * 0.1, 0))
        tk.tree(ms, p.x, p.y, h=0.3, r=0.09, lod2=False)
    return f


def house(ms, rng, kind, x, y, w, d, **kw):
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **kw)


# ---- the street ---------------------------------------------------------------------------------

def market_hall(ms, rng, x, y, w, d, yaw=None):
    """A half-timbered market hall: an open ground floor on oak posts over stone pads with stalls
    and barrels under it, a jettied upper floor and a steep slate hipped gable."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='hall')
    h0, h1 = STOREY * 0.85, STOREY * 0.85
    nx, ny = max(3, round(w / 0.22)), max(2, round(d / 0.25))
    for i in range(nx):
        for j in range(ny):
            if 0 < i < nx - 1 and 0 < j < ny - 1:
                continue
            px, py = -w / 2 + 0.03 + (w - 0.06) * i / (nx - 1), -d / 2 + 0.03 + (d - 0.06) * j / (ny - 1)
            ms.box('ek_stone', (0.05, 0.05, 0.03), at=(px, py, G), lod=0, frame=f)
            ms.box('timber', (0.03, 0.03, h0), at=(px, py, G), lod=1, frame=f)
    ms.box('ek_cobble_square', (w - 0.02, d - 0.02, 0.008), at=(0, 0, G), lod=1, frame=f)
    ms.box('ek_plaster', (w + 0.04, d + 0.04, h1), at=(0, 0, G + h0), lod=1, frame=f)
    frame(ms, f, w + 0.04, d + 0.04, G + h0, h1, step=0.11)
    slate_roof(ms, f, w + 0.04, d + 0.04, G + h0 + h1, 0.34)
    for k in range(3):
        tk.barrel(ms, f, -w / 4 + 0.07 * k, 0.05)
    tt.crate(ms, f, w / 4, -0.05, 1.0, 10)
    tk.lod2_block(ms, f, w, d, h0 + h1, rise=0.34, mat='ek_slate')
    return f


def log_store(ms, x, y, yaw=0.0):
    """A lean-to log store: two posts, a slate pent roof, a stack of split logs."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-0.12, 0.12):
        ms.box('timber', (0.014, 0.014, 0.17), at=(sx, -0.05, G), lod=0, frame=f)
    rf = f @ Matrix.Translation(Vector((0, 0, G + 0.19))) @ Matrix.Rotation(math.radians(12), 4, 'X')
    ms.box('ek_slate', (0.3, 0.15, 0.012), at=(0, 0, 0), lod=1, frame=rf)
    for row in range(3):
        for k in range(4 - row):
            ms.cyl('timber', 0.014, 0.014, 0.22, at=(-0.11, -0.02 + k * 0.022 + row * 0.011, G + 0.014 + row * 0.024), rot=(0, 90, 0),
                   segs=6, lod=0, frame=f)


# ---- landmark 1: the Gothic church --------------------------------------------------------------

def lancet(ms, f, x, y, z, w, h, face=-1, side=False, mat='ek_glass'):
    """A pointed window: a tall glazed slot with a small pointed head and a stone hood."""
    if side:
        ms.box(mat, (0.01, w, h), at=(x + face * 0.004, y, z), lod=0, frame=f)
        hf = f @ Matrix.Translation(Vector((x + face * 0.004, y, z + h))) @ Matrix.Rotation(math.radians(45), 4, 'X')
        ms.box(mat, (0.01, w * 0.7, w * 0.7), at=(0, 0, -w * 0.35), lod=0, frame=hf)
    else:
        ms.box(mat, (w, 0.01, h), at=(x, y + face * 0.004, z), lod=0, frame=f)
        hf = f @ Matrix.Translation(Vector((x, y + face * 0.004, z + h))) @ Matrix.Rotation(math.radians(45), 4, 'Y')
        ms.box(mat, (w * 0.7, 0.01, w * 0.7), at=(0, 0, -w * 0.35), lod=0, frame=hf)


def gothic_church(ms, rng, x, y, s=1.0, top=2.4, yaw=None):
    """The Gothic church (sheet: 16 m across with its aisles, 20 m long, 8 m walls, a west tower
    with a slate spire and a cross at 24 m): a limestone nave with a steep slate roof and dormers,
    lower aisles under lean-to roofs, stepped buttresses between pointed windows, a polygonal apse,
    the tower at the front with a pointed portal, a rose window, belfry openings, corner pinnacles."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    nw, aw = 0.62 * s, 0.24 * s
    tw = 0.42 * s
    L = 1.5 * s
    y0 = -L / 2 + tw                       # the nave's front (behind the tower)
    y1 = L / 2 - 0.22 * s                  # the nave's back (the apse beyond)
    foot(f, nw + 2 * aw, L, tag='church')
    zw = 0.8 * min(1.0, 0.6 + 0.4 * s)     # the nave walls (8 m on the sheet)
    za = zw * 0.58
    nl = y1 - y0
    cy = (y0 + y1) / 2
    ms.box('ek_limestone', (nw, nl, zw), at=(0, cy, G), lod=2, frame=f, bevel=0.004)
    rf = f @ Matrix.Translation(Vector((0, cy, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rf, nl, nw, G + zw, nw * 0.62, over=0.03, mat='ek_slate', gable='ek_limestone', thick=0.026, lod=2, ridge='ek_slate')
    nb = max(3, round(nl / (0.3 * s)))
    for sx in (-1, 1):
        ax = sx * (nw / 2 + aw / 2)
        ms.box('ek_limestone', (aw, nl, za), at=(ax, cy, G), lod=2, frame=f)
        lf = f @ Matrix.Translation(Vector((ax - sx * 0.01, cy, G + za + 0.04 * s))) @ Matrix.Rotation(math.radians(sx * -22), 4, 'Y')
        ms.box('ek_slate', (aw + 0.04, nl + 0.03, 0.02), at=(0, 0, -0.01), lod=1, frame=lf)
        for i in range(nb + 1):
            by = y0 + nl * i / nb
            bf = f @ Matrix.Translation(Vector((sx * (nw / 2 + aw + 0.03 * s), by, G)))
            ms.box('ek_limestone', (0.07 * s, 0.06 * s, za * 0.95), at=(0, 0, 0), lod=1, frame=bf, taper=0.75)
            ms.cyl('ek_limestone', 0.02 * s, 0.0, 0.08 * s, at=(0, 0, za * 0.95), segs=4, lod=0, frame=bf)
            # flying buttress up to the nave wall
            if i not in (0, nb):
                fl = f @ Matrix.Translation(Vector((sx * (nw / 2 + aw * 0.5 + 0.015 * s), by, G + za + 0.02))) @ Matrix.Rotation(math.radians(sx * 35), 4, 'Y')
                ms.box('ek_limestone', (0.025 * s, 0.03 * s, aw * 1.15), at=(0, 0, 0), lod=0, frame=fl)
        for i in range(nb):
            wy = y0 + nl * (i + 0.5) / nb
            lancet(ms, f, sx * (nw / 2 + aw), wy, G + za * 0.25, 0.06 * s, za * 0.45, face=sx, side=True)
            lancet(ms, f, sx * nw / 2, wy, G + za + 0.06 * s, 0.05 * s, (zw - za) * 0.5, face=sx, side=True)
    for i in range(2):  # dormers on the nave roof
        dy = y0 + nl * (0.3 + 0.4 * i)
        for sx in (-1, 1):
            df = f @ Matrix.Translation(Vector((sx * nw * 0.3, dy, G + zw + nw * 0.62 * 0.35)))
            ms.box('ek_slate', (0.05 * s, 0.05 * s, 0.05 * s), at=(0, 0, 0), lod=0, frame=df)
    # the apse: a half-octagon with a cone roof
    ar = nw / 2
    ms.cyl('ek_limestone', ar, ar, zw * 0.9, at=(0, y1, G), segs=8, lod=2, frame=f)
    ms.cyl('ek_slate', ar * 1.08, 0.0, nw * 0.5, at=(0, y1, G + zw * 0.9), segs=8, lod=1, frame=f)
    for k in range(3):
        a = math.radians(-45 + 45 * k) + math.pi / 2
        lancet(ms, f @ Matrix.Translation(Vector((ar * 0.98 * math.cos(a), y1 + ar * 0.98 * math.sin(a), 0))) @ Matrix.Rotation(a - math.pi / 2, 4, 'Z'),
               0, 0.0, G + zw * 0.3, 0.05 * s, zw * 0.42, face=1)
    # the west tower with its spire
    ty = -L / 2 + tw / 2
    th = min(top * 0.56, 1.35 * s)
    ms.box('ek_limestone', (tw, tw, th), at=(0, ty, G), lod=2, frame=f, bevel=0.005)
    for zz in (th * 0.38, th * 0.7):
        ms.box('ek_limestone', (tw + 0.02, tw + 0.02, 0.02), at=(0, ty, G + zz), lod=0, frame=f)
    for sx in (-1, 1):  # corner buttresses of the tower
        for sy in (-1, 1):
            ms.box('ek_limestone', (0.06 * s, 0.06 * s, th * 0.6), at=(sx * (tw / 2 + 0.01), ty + sy * (tw / 2 + 0.01), G), lod=1, frame=f, taper=0.7)
            ms.cyl('ek_limestone', 0.022 * s, 0.0, 0.14 * s, at=(sx * tw * 0.42, ty + sy * tw * 0.42, G + th), segs=4, lod=0, frame=f)
    ms.box('door', (0.1 * s, 0.012, 0.26 * s), at=(0, ty - tw / 2 - 0.004, G), lod=1, frame=f)
    hf = f @ Matrix.Translation(Vector((0, ty - tw / 2 - 0.006, G + 0.26 * s))) @ Matrix.Rotation(math.radians(45), 4, 'Y')
    ms.box('door', (0.07 * s, 0.012, 0.07 * s), at=(0, 0, -0.035 * s), lod=0, frame=hf)
    ms.box('ek_limestone', (0.18 * s, 0.03, 0.34 * s), at=(0, ty - tw / 2 - 0.01, G), lod=0, frame=f)  # the portal's frame
    ms.cyl('ek_glass', 0.075 * s, 0.075 * s, 0.01, at=(0, ty - tw / 2 - 0.004, G + th * 0.5), rot=(90, 0, 0), segs=12, lod=0, frame=f)
    ms.cyl('ek_limestone', 0.09 * s, 0.09 * s, 0.008, at=(0, ty - tw / 2 - 0.0, G + th * 0.5), rot=(90, 0, 0), segs=12, lod=0, frame=f)
    for k in range(4):  # belfry openings
        kf = f @ Matrix.Translation(Vector((0, ty, 0))) @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for sx in (-1, 1):
            lancet(ms, kf, sx * tw * 0.18, -tw / 2, G + th * 0.78, 0.045 * s, th * 0.13, mat='dark')
    spire = top - G - th - 0.1 * s
    ms.cyl('ek_slate', tw * 0.62, 0.0, spire, at=(0, ty, G + th), rot=(0, 0, 22.5), segs=8, lod=2, frame=f)
    ms.cyl('ek_gold', 0.008, 0.008, 0.1 * s, at=(0, ty, G + th + spire - 0.01), segs=5, lod=0, frame=f)
    ms.box('ek_gold', (0.05 * s, 0.01, 0.01), at=(0, ty, G + th + spire + 0.05 * s), lod=0, frame=f)
    return f


# ---- landmark 2: the stone keep -----------------------------------------------------------------

def stone_keep(ms, rng, x, y, s=1.0, top=1.8, yaw=None):
    """The stone keep (sheet: a 10 m square tower, 16 m across its four round corner turrets, 18 m
    to the turret cones): grey ashlar on battered spurs at the corners, slit windows, crenellated
    walls and turret tops, conical slate caps, a stone stair up to an arched door 2 m above the
    ground, a team banner over the door, a hatch on the flat roof."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    w = 1.0 * s
    h = (top - G) * 0.72
    foot(f, w + 0.36 * s, w + 0.4 * s, 0, -0.04, tag='keep')
    ms.box('kg_wallstone', (w, w, h), at=(0, 0, G), lod=2, frame=f, bevel=0.005)
    for zz in (h * 0.4, h * 0.75):
        ms.box('kg_wallstone', (w + 0.015, w + 0.015, 0.018), at=(0, 0, G + zz), lod=0, frame=f)
    ms.box('stone', (w - 0.04, w - 0.04, 0.006), at=(0, 0, G + h), lod=1, frame=f)
    ms.box('kg_wallstone', (0.14 * s, 0.14 * s, 0.08), at=(w * 0.15, w * 0.15, G + h), lod=0, frame=f)  # the roof hatch
    tb.merlons(ms, f, 0, 0, w, w, G + h, step=0.1 * s, size=0.045 * s, h=0.06 * s, mat='kg_wallstone')
    tr = 0.18 * s
    th = h + 0.18 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * w / 2, sy * w / 2
            ms.box('kg_wallstone', (0.3 * s, 0.3 * s, h * 0.35), at=(cx, cy, G), lod=1, frame=f, taper=0.62)  # the battered spur
            ms.cyl('kg_wallstone', tr, tr, th, at=(cx, cy, G), segs=12, lod=1, frame=f)
            ms.cyl('kg_wallstone', tr * 1.12, tr * 1.12, 0.06 * s, at=(cx, cy, G + th - 0.06 * s), segs=12, lod=0, frame=f)
            ms.cyl('ek_slate', tr * 1.15, 0.0, top - G - th, at=(cx, cy, G + th), segs=12, lod=1, frame=f)
            ms.cyl('kg_iron', 0.006, 0.003, 0.05, at=(cx, cy, top - 0.01), segs=5, lod=0, frame=f)
            p = f @ Vector((cx, cy, 0))
            obox(ms, 2, 'kg_wallstone', (tr * 1.6, tr * 1.6, th), at=(p.x, p.y, G))
    for k in range(4):  # slit windows
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i, zz in enumerate((0.35, 0.62, 0.85)):
            for sx in (-0.2, 0.2):
                if k == 0 and i == 0:
                    continue
                ms.box('dark', (0.022, 0.01, 0.07), at=(sx * w, -w / 2 - 0.004, G + h * zz), lod=0, frame=kf)
    dz = 0.2 * min(1.0, s)
    ms.box('door', (0.09 * s, 0.012, 0.16 * s), at=(0, -w / 2 - 0.004, G + dz), lod=1, frame=f)
    hf = f @ Matrix.Translation(Vector((0, -w / 2 - 0.005, G + dz + 0.16 * s))) @ Matrix.Rotation(math.radians(45), 4, 'Y')
    ms.box('door', (0.064 * s, 0.012, 0.064 * s), at=(0, 0, -0.032 * s), lod=0, frame=hf)
    steps = 7
    for k in range(steps):  # the straight stair up the front, between cheek walls
        ms.box('kg_wallstone', (0.2 * s, 0.045, dz * (k + 1) / steps), at=(0, -w / 2 - 0.045 * (steps - k) + 0.02, G), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('kg_wallstone', (0.03, 0.045 * steps, dz * 0.6), at=(sx * 0.115 * s, -w / 2 - 0.045 * steps / 2, G), lod=0, frame=f)
    ms.box('team_cloth', (0.1 * s, 0.006, 0.2 * s), at=(0, -w / 2 - 0.006, G + dz + 0.25 * s), lod=1, frame=f)  # the banner
    ms.box('timber', (0.13 * s, 0.012, 0.012), at=(0, -w / 2 - 0.008, G + dz + 0.45 * s), lod=0, frame=f)
    return f


# ---- the eastern landmark: the onion-domed church -----------------------------------------------

def onion(ms, f, x, y, z, r, lod=1, segs=12):
    """An onion dome of weathered copper on (x, y, z), radius r at its widest, a gilt cross above."""
    p = [(r * 0.86, 0.0), (r * 1.05, 0.25 * r), (r * 1.12, 0.55 * r), (r * 0.98, 0.95 * r), (r * 0.62, 1.32 * r), (r * 0.26, 1.62 * r),
         (r * 0.07, 1.86 * r), (0.004, 1.95 * r)]
    ms.lathe('ek_copper', [(a, b + z) for a, b in p], at=(x, y, 0), segs=segs, lod=lod, frame=f)
    ms.cyl('ek_gold', 0.006, 0.006, 0.6 * r, at=(x, y, z + 1.9 * r), segs=5, lod=0, frame=f)
    ms.box('ek_gold', (0.36 * r, 0.008, 0.008), at=(x, y, z + 2.25 * r), lod=0, frame=f)


def onion_church(ms, rng, x, y, s=1.0, top=2.2, yaw=None):
    """The onion-domed church (sheet: 16 x 18 m, 16 m to the main drum's foot, 22 m to the main
    cross): a white plastered cube with pilaster strips and arched windows on a stone plinth,
    lead roofs on a cross of gables, a tall central drum with a big copper onion dome, four smaller
    drums and domes at the corners, three apses at the back, a gabled porch with a recessed arched
    portal and steps at the front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    w, d = 1.3 * s, 1.3 * s
    foot(f, w, d + 0.35 * s, 0, 0.02 * s, tag='church')
    hz = min(1.0, 0.72 + 0.28 * s) * 0.82
    ms.box('ek_stone', (w + 0.03, d + 0.03, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box('ek_white', (w, d, hz), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for k in range(4):  # pilaster strips and arched windows on each face
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i in range(4):
            px = -w / 2 + w * i / 3
            ms.box('ek_white', (0.035 * s, 0.012, hz), at=(px, -d / 2 - 0.004, G), lod=0, frame=kf)
        for i in range(3):
            wx = -w / 3 + w / 3 * i
            ms.box('dark', (0.04 * s, 0.01, 0.12 * s), at=(wx, -d / 2 - 0.004, G + hz * 0.5), lod=0, frame=kf)
            ms.cyl('dark', 0.02 * s, 0.02 * s, 0.01, at=(wx, -d / 2 - 0.004 + 0.005, G + hz * 0.5 + 0.12 * s), rot=(90, 0, 0), segs=8, lod=0, frame=kf)
    # the cross of lead gables
    for ang in (0, 90):
        rf = f @ Matrix.Rotation(math.radians(ang), 4, 'Z')
        tc.gable_roof(ms, rf, w * 0.5, d + 0.02, G + hz, 0.22 * s, over=0.02, mat='ek_lead', gable='ek_white', thick=0.016, lod=2, ridge='ek_lead')
    for sx in (-1, 1):  # low hipped lead slopes at the corners
        for sy in (-1, 1):
            ms.box('ek_lead', (w * 0.27, d * 0.27, 0.05 * s), at=(sx * w * 0.37, sy * d * 0.37, G + hz), lod=1, frame=f, taper=0.6)
    # the drums and domes
    rz = G + hz + 0.16 * s
    r0 = 0.2 * s
    main_top = top - 2.25 * r0 * 1.15
    ms.cyl('ek_white', r0, r0, main_top - rz, at=(0, 0, rz), segs=12, lod=1, frame=f)
    ms.cyl('ek_white', r0 * 1.08, r0 * 1.08, 0.03, at=(0, 0, main_top - 0.03), segs=12, lod=0, frame=f)
    for k in range(6):
        a = 2 * math.pi * k / 6 - math.pi / 2
        ms.box('dark', (0.025 * s, 0.01, 0.1 * s), at=(r0 * math.cos(a), r0 * math.sin(a), (rz + main_top) / 2 - 0.04 * s), rot_z=math.degrees(a) + 90,
               lod=0, frame=f)
    onion(ms, f, 0, 0, main_top, r0 * 1.15)
    r1 = 0.11 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * w * 0.33, sy * d * 0.33
            t1 = rz + 0.24 * s
            ms.cyl('ek_white', r1, r1, t1 - (G + hz), at=(cx, cy, G + hz), segs=10, lod=1, frame=f)
            ms.box('dark', (0.02 * s, 0.01, 0.07 * s), at=(cx, cy - r1 - 0.002, t1 - 0.12 * s), lod=0, frame=f)
            onion(ms, f, cx, cy, t1, r1 * 1.12, segs=10, lod=0)
            p = f @ Vector((cx, cy, 0))
            ms.sphere('ek_copper', r1 * 1.12, at=(p.x, p.y, t1 + r1 * 0.9), scale=(1, 1, 1.3), u=8, v=5, lod=1, only=1)
    obox(ms, 2, 'ek_copper', (r0 * 2.2, r0 * 2.2, top - G - hz - 0.1), at=tuple((f @ Vector((0, 0, 0)))[:2]) + (G + hz,))
    # three apses at the back
    for ax in (-w * 0.3, 0.0, w * 0.3):
        ar = 0.15 * s if ax else 0.2 * s
        ms.cyl('ek_white', ar, ar, hz * 0.8, at=(ax, d / 2, G), segs=10, lod=1, frame=f)
        ms.cyl('ek_lead', ar * 1.06, 0.0, ar * 0.7, at=(ax, d / 2, G + hz * 0.8), segs=10, lod=1, frame=f)
    # the porch with its arched portal and steps
    pw, pd = 0.36 * s, 0.22 * s
    py = -d / 2 - pd / 2
    ms.box('ek_white', (pw, pd, hz * 0.55), at=(0, py, G), lod=1, frame=f)
    pr = f @ Matrix.Translation(Vector((0, py, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, pr, pd + 0.02, pw, G + hz * 0.55, 0.12 * s, over=0.02, mat='ek_lead', gable='ek_white', thick=0.014, lod=1, ridge='ek_lead')
    for k, (aw_, az) in enumerate(((0.2, 0.3), (0.15, 0.25), (0.1, 0.21))):
        ms.box('ek_limestone' if k < 2 else 'door', (aw_ * s, 0.012, az * s), at=(0, -d / 2 - pd - 0.004 + k * 0.004, G + 0.03), lod=0 if k < 2 else 1, frame=f)
    for k in range(3):
        ms.box('ek_stone', (pw + 0.12 - 0.04 * k, 0.05, 0.012 * (k + 1)), at=(0, -d / 2 - pd - 0.08 + 0.025 * k, G), lod=0, frame=f)
    return f


# ---- the shared objects: palace-small, palace, walls-medium -------------------------------------

def palace_small(ms, rng):
    """`palace-small` (sheet: 12 m across, 12 m high, on an 18 x 16 m paved patch): a grey stone
    ground floor with buttresses, an arched door up steps between two team banners, a jettied
    half-timbered cream upper floor with Gothic windows, a steep slate roof with a front cross
    gable, a tall chimney, and a round stair tower with a slate spire at the east corner."""
    f = tm.house_frame(0, 0, 0)
    w, d = 0.86, 0.66
    h0, h1 = 0.36, 0.3
    ms.box('ek_cobble_square', (1.02, 0.86, 0.014), at=(0, -0.04, G - 0.004), lod=1, frame=f)
    ms.box('ek_stone', (w, d, h0), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for xx in (w / 2, w * 0.18):
            ms.box('ek_stone', (0.05, 0.06, h0 * 0.8), at=(sx * xx, -d / 2 - 0.025, G), lod=1, frame=f, taper=0.7)
    ms.box('ek_plaster', (w, d + 0.06, h1), at=(0, 0, G + h0), lod=2, frame=f)
    frame(ms, f, w, d + 0.06, G + h0, h1, step=0.1)
    for k in range(int(w / 0.09)):
        ms.box('timber', (0.016, 0.04, 0.03), at=(-w / 2 + 0.05 + k * 0.09, -d / 2 - 0.02, G + h0 - 0.03), lod=0, frame=f)
    z = G + h0 + h1
    rise = 1.2 - z - 0.02
    slate_roof(ms, f, w, d + 0.06, z, rise, lod=2)
    gw = 0.36
    gf = f @ Matrix.Translation(Vector((-0.06, -d / 2 - 0.05, 0)))
    ms.box('ek_plaster', (gw, 0.12, h1), at=(0, 0.04, G + h0), lod=1, frame=gf)
    frame(ms, gf, gw, 0.12, G + h0, h1, step=0.09, braces=False)
    rgf = gf @ Matrix.Translation(Vector((0, 0.16, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rgf, 0.42, gw, z, rise * 0.8, over=0.03, mat='ek_slate', gable='ek_plaster', thick=0.024, lod=1, ridge='ek_slate')
    for wx in (-0.11, 0.0, 0.11):
        lancet(ms, gf, wx, -0.02, G + h0 + 0.08, 0.05, 0.12)
    for wx in (-w * 0.4, w * 0.25, w * 0.4):
        lancet(ms, f, wx, -d / 2 - 0.03, G + h0 + 0.08, 0.045, 0.11)
    for wx in (-w * 0.36, w * 0.32):
        lancet(ms, f, wx, -d / 2, G + 0.1, 0.04, 0.12, mat='dark')
    door(ms, f, -0.06, -d / 2, w=0.1, h=0.2, z=G + 0.06)
    for k in range(4):
        ms.box('ek_stone', (0.24 - 0.03 * k, 0.04, 0.015 * (k + 1)), at=(-0.06, -d / 2 - 0.15 + 0.035 * k, G), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('team_cloth', (0.06, 0.006, 0.15), at=(-0.06 + sx * 0.11, -d / 2 - 0.004, G + h0 - 0.18), lod=1, frame=f)
    chimney(ms, f, -w * 0.38, d * 0.2, z - 0.05, rise + 0.1)
    tz = tk.round_tower(ms, w / 2 - 0.02, -d / 2 + 0.06, 0.13, 0.86, roof=1.22 - 0.86 - G, mat='ek_stone', cap='ek_slate', face=-60)
    tt.pennant(ms, f, w / 2 - 0.02, -d / 2 + 0.06, 1.24, w=0.16, h=0.1)
    tk.lod2_block(ms, f, w, d, h0 + h1, rise=rise, mat='ek_slate')
    return tz


def palace(ms, rng):
    """`palace` (sheet: a 20 m courtyard palace, 9 m wings, 18 m towers): four wings round a paved
    court on grey stone ground floors, half-timbered cream upper floors under steep slate roofs,
    a great hall at the back with tall Gothic windows, four square corner towers with slate
    pyramid roofs and team pennants, a crenellated gatehouse with an arched gate, a portcullis
    and two team banners at the front, a grey cloth awning over the court gallery."""
    f = tm.house_frame(0, 0, 0)
    W, D = 1.3, 1.24
    wg = 0.3                                    # the wings' depth
    h0, h1 = 0.36, 0.3
    ms.box('ek_cobble_square', (W + 0.12, D + 0.12, 0.014), at=(0, 0, G - 0.004), lod=1, frame=f)
    # the great hall (back)
    hb = D / 2 - wg / 2
    ms.box('ek_limestone', (W - 0.3, wg, h0 + h1 + 0.06), at=(0, hb, G), lod=2, frame=f, bevel=0.004)
    slate_roof(ms, f @ Matrix.Translation(Vector((0, hb, 0))), W - 0.3, wg + 0.02, G + h0 + h1 + 0.06, 0.36, gable='ek_limestone', lod=2)
    for i in range(4):
        lancet(ms, f, -0.39 + 0.26 * i, hb - wg / 2, G + 0.12, 0.07, 0.42)
        lancet(ms, f, -0.39 + 0.26 * i, hb + wg / 2, G + 0.12, 0.07, 0.42, face=1)
    for i in range(3):
        dx = -0.26 + 0.26 * i
        df = f @ Matrix.Translation(Vector((dx, hb - wg * 0.2, G + h0 + h1 + 0.06 + 0.12)))
        ms.box('ek_plaster', (0.07, 0.08, 0.07), at=(0, 0, 0), lod=0, frame=df)
    # the side wings and the front wings either side of the gatehouse
    for sx in (-1, 1):
        wf = f @ Matrix.Translation(Vector((sx * (W / 2 - wg / 2), 0, 0)))
        L = D - 0.3
        ms.box('ek_stone', (wg, L, h0), at=(0, 0, G), lod=2, frame=wf)
        ms.box('ek_plaster', (wg + 0.04, L, h1), at=(0, 0, G + h0), lod=2, frame=wf)
        frame(ms, wf @ Matrix.Rotation(math.radians(90), 4, 'Z'), L, wg + 0.04, G + h0, h1, step=0.12)
        slate_roof(ms, wf @ Matrix.Rotation(math.radians(90), 4, 'Z'), L, wg + 0.04, G + h0 + h1, 0.3, lod=2)
        for i in range(3):
            window(ms, wf @ Matrix.Rotation(math.radians(sx * -90), 4, 'Z'), -0.3 + 0.3 * i, -wg / 2 - 0.02, G + h0 + 0.1, shutters=False)
            lancet(ms, wf @ Matrix.Rotation(math.radians(sx * -90), 4, 'Z'), -0.3 + 0.3 * i, -wg / 2, G + 0.1, 0.04, 0.12, mat='dark')
        ff = f @ Matrix.Translation(Vector((sx * (W / 2 - 0.3), -D / 2 + wg / 2, 0)))
        ms.box('ek_stone', (0.36, wg, h0), at=(0, 0, G), lod=2, frame=ff)
        ms.box('ek_plaster', (0.36, wg + 0.04, h1), at=(0, 0, G + h0), lod=2, frame=ff)
        frame(ms, ff, 0.36, wg + 0.04, G + h0, h1, step=0.1)
        slate_roof(ms, ff, 0.36, wg + 0.04, G + h0 + h1, 0.3, gable_front=True, lod=2)
        for wx in (-0.08, 0.08):
            window(ms, ff, wx, -wg / 2 - 0.02, G + h0 + 0.1, shutters=False)
            lancet(ms, ff, wx, -wg / 2, G + 0.1, 0.04, 0.12, mat='dark')
        ms.box('team_cloth', (0.08, 0.006, 0.2), at=(sx * 0.2, -D / 2 - 0.006, G + 0.22), lod=1, frame=f)
    # the gatehouse
    gw = 0.36
    ms.box('ek_limestone', (gw, wg + 0.06, h0 + 0.22), at=(0, -D / 2 + wg / 2, G), lod=2, frame=f, bevel=0.004)
    tb.merlons(ms, f, 0, -D / 2 + wg / 2, gw, wg + 0.06, G + h0 + 0.22, step=0.07, size=0.035, h=0.05, mat='ek_limestone')
    tk.arch_face(ms, f, 'dark', 0, -D / 2 - 0.035, G, 0.09, 0.18, lod=1, horseshoe=False, n=6)
    for k in range(5):
        ms.box('kg_iron', (0.008, 0.008, 0.2), at=(-0.07 + 0.035 * k, -D / 2 - 0.04, G), lod=0, frame=f)
    # the court: paving, a well, the gallery awning
    tt.well(ms, 0.0, 0.02, yaw=0)
    ms.box('team_cloth', (0.5, 0.12, 0.008), at=(0, -D / 2 + wg + 0.06, G + h0 + 0.02), lod=1, frame=f)
    # the corner towers with pyramid slate roofs and pennants
    for sx in (-1, 1):
        for sy in (-1, 1):
            tf = f @ Matrix.Translation(Vector((sx * (W / 2 - 0.1), sy * (D / 2 - 0.1), 0)))
            th = 1.25
            ms.box('ek_limestone', (0.26, 0.26, th), at=(0, 0, G), lod=2, frame=tf, bevel=0.004)
            ms.cyl('ek_slate', 0.2, 0.0, 1.78 - G - th, at=(0, 0, G + th), rot=(0, 0, 45), segs=4, lod=2, frame=tf)
            for zz in (0.5, 0.85, 1.08):
                ms.box('dark', (0.025, 0.01, 0.07), at=(0, -0.134, G + zz), lod=0, frame=tf)
            if sy < 0:
                ms.cyl('timber', 0.008, 0.006, 0.18, at=(0, 0, 1.75), segs=5, lod=1, frame=tf)
                tt.pennant(ms, tf, 0, 0, 1.92, w=0.16, h=0.09)
    return f


def walls_medium(ms, rng):
    """`walls-medium` (sheet: 68 m across, 60 m inside, 6 m walls, 8 m towers): a pale limestone
    curtain wall with merlons and a wall-walk on a cobbled footing, seven round towers with slate
    cones, a gatehouse of two taller round towers with team pennants round an arched gate with
    oak doors and a portcullis, and sloping buttresses along the outer face between the towers."""
    RAISE = tb.WALL_RAISE
    R_out, R_in = 3.4, 3.16
    towers = (0, 50, 100, 145, 190, 235, 320)
    tk.stone_ring(ms, rng, R_out=R_out, R_in=R_in, H=0.6 * RAISE, gate_x=0.25, towers=towers, tower_r=0.3,
                  tower_h=0.8 * RAISE, gate_r=0.34, gate_h=0.95 * RAISE, banners=True, portcullis=True, stairs=((80, 1),),
                  n=(128, 56, 28))
    span = sorted(towers) + [360]
    for t0, t1 in zip(span, span[1:]):
        for k in (1, 2):
            a = t0 + (t1 - t0) * k / 3
            if 245 < a % 360 < 295:  # leave the gate clear
                continue
            bf = tb.ring_frame(R_out + 0.035, a)
            ms.box('kg_ringstone', (0.08, 0.1, 0.5 * RAISE), at=(0, 0, G - 0.005), lod=0, frame=bf, taper=0.4)


# ---- building a town on a base Kingdoms layout ----------------------------------------------------
# The town scripts hold the base town's calls as recorded from build_town_kingdoms_<size>_<v>.py
# (positions, sizes, yaws as the base drew them); `replay` swaps each for this kit's piece.

SIZES = {'small': dict(church=(0.55, 1.6), keep=(0.55, 1.2)), 'medium': dict(church=(0.8, 2.0), keep=(0.75, 1.5)),
         'big': dict(church=(1.0, 2.4), keep=(1.0, 1.8))}
HOUSES = ('tudor_house', 'town_house', 'court_house', 'flat_house', 'house')


def house_kind(name, w, d, kw):
    area = w * d
    storeys = kw.get('storeys', 2 if kw.get('two') else 1)
    if name == 'court_house' or area >= 0.6:
        return 'rich'
    if area < 0.3 or (storeys == 1 and area < 0.4):
        return 'poor'
    return 'common'


def replay(ms, rng, calls, size, east=False, override=None):
    """Build the base layout's calls with this kit. `override` maps a call's index to a kind
    ('church', 'keep', 'hall', 'skip', 'poor', 'common', 'rich') to place the landmarks."""
    override = override or {}
    cs, ct = SIZES[size]['church']
    ks, kt = SIZES[size]['keep']
    world = tm.house_frame(0, 0, 0)
    for i, (name, args, kw) in enumerate(calls):
        kind = override.get(i)
        if kind == 'skip':
            continue
        if name in HOUSES and kind in (None, 'poor', 'common', 'rich'):
            x, y, w, d = args[:4]
            k = kind or house_kind(name, w, d, kw)
            opts = dict(yaw=kw.get('yaw'))
            if k == 'common':
                opts.update(gable_front=kw.get('gable_front'), roof=kw.get('roof', 'slate'), awning_w=kw.get('awning_w'),
                            barrels=kw.get('barrels', kw.get('jar_n', 1)) and 1, chimneys=kw.get('chimneys', 1))
            elif k == 'poor':
                opts.update(roof=kw.get('roof', 'slate'))
            house(ms, rng, k, x, y, w, d, **opts)
        elif kind == 'church' or name in ('church', 'cathedral'):
            fn = onion_church if east else gothic_church
            fn(ms, rng, args[0], args[1], s=cs if not east else cs * 0.95, top=ct if not east else ct * 0.92, yaw=kw.get('yaw'))
        elif kind == 'keep' or name == 'keep_tower':
            stone_keep(ms, rng, args[0], args[1], s=ks, top=kt, yaw=kw.get('yaw'))
        elif kind == 'hall' or name == 'arcade_hall':
            x, y, w, d = args[:4]
            market_hall(ms, rng, x, y, w * 0.85, d * 0.7, yaw=kw.get('yaw'))
        elif name == 'round_tower':
            tk.round_tower(ms, *args, **kw)
        elif name == 'stone_tower':
            tk.round_tower(ms, args[0], args[1], 0.3, 1.25, roof=0.5, face=-90)
        elif name == 'market_stall':
            tk.market_stall(ms, rng, *args, **kw)
        elif name in ('street', 'paved_strip'):
            if name == 'street':
                tk.street(ms, args[0], args[1], mat='ek_cobble_square')
            else:
                x0, y0, x1, y1, w = args
                tk.street(ms, [(x0, y0), (x1, y1)], w, mat='ek_cobble_square')
        elif name == 'garden':
            tk.garden(ms, rng, *args, **kw)
        elif name == 'wattle_fence':
            tk.wattle_fence(ms, *args, **kw)
        elif name == 'stone_wall':
            kw = dict(kw)
            kw['mat'] = 'ek_stone'
            tk.stone_wall(ms, *args, **kw)
        elif name in ('tree', 'palm'):
            tk.tree(ms, args[0], args[1], h=kw.get('h', 0.42) * (0.85 if name == 'palm' else 1.0), r=kw.get('r', 0.14), lod2=False)
        elif name in ('conifer', 'cypress'):
            tk.conifer(ms, args[0], args[1], h=kw.get('h', 0.45) * 1.05, lod2=False)
        elif name == 'broadleaf':
            tc.broadleaf(ms, *args, **kw)
        elif name == 'shrub':
            tc.shrub(ms, *args, **kw)
        elif name in ('well', 'fountain'):
            tt.well(ms, args[0], args[1], yaw=kw.get('yaw', 10))
        elif name == 'clutter':
            tt.clutter(ms, world, args[0], args[1], rng, int(args[2]) if len(args) > 2 else 4)
        elif name == 'woodpile':
            log_store(ms, args[0], args[1], args[2] if len(args) > 2 else 0)
        # anything else (jars, pergolas) is left out


def main(file_name, obj_name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(COBBLED)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
