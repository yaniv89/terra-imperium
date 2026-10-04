# scripts/blender/ti_indic_kingdoms.py
# The Indic kit for the Kingdoms Age (art spec 3b: India, Pakistan, Bangladesh, Sri Lanka, the
# Maldives; Chola temples and the Delhi Sultanate), from the sheets in
# plans/art/kits/indic/kingdoms/: houses.png (a poor one-storey house of lime-washed brick under a
# terracotta tile roof with a small tiled upper room, a timber veranda and a walled yard; a common
# courtyard house of plaster and sandstone with tiled hip roofs round a court with a tree, a
# corner tower room and a pillared porch; a rich two-storey sandstone haveli round a court with a
# pool, a cusped portal up steps, balconies, corner towers with domed chhatris and grey awnings),
# street.png and roofscape.png (grey stone lanes between walled sandy plots, thatched sheds, grey
# cloth shades, jars, palms), materials.png (sandstone, granite, carved timber, terracotta tile,
# lime plaster, bronze trim, stone paving, team cloth), the gopuram temple gate (landmark-1), the
# Sultanate tomb (landmark-2), palace-small, palace and walls-medium.
# Uses ti_kingdoms.py's helpers (palm, tree, street, market stalls, lod2_block, box_only,
# banner_pointed, garden) and ti_classical.py's gable_roof, hip_roof and shrub, all unchanged.
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `ink_` prefix.
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

NEW = ['ink_sandstone', 'ink_granite', 'ink_carved', 'ink_plaster', 'ink_lime', 'ink_redstone', 'ink_tile', 'ink_ridge',
       'ink_dome', 'ink_jali', 'ink_wallstone', 'ink_earth', 'ink_earth_fringe', 'ink_earth_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'ink_earth': 'Ground', 'ink_earth_fringe': 'Ground', 'ink_earth_square': 'Ground'})
if 'ink_earth_fringe' not in tt.FRINGES:
    tt.FRINGES.append('ink_earth_fringe')


def make_materials():
    # warm buff sandstone ashlar (the havelis, the palaces, the walls) and grey granite (the temple's base)
    tm.mat_mudwall('ink_sandstone', wash='#c6a571', brick='#c8a470', brick2='#b08d5c', mortar='#dcc597', wash_cover=0.0,
                   bond=(0.06, 0.03, 0.004))
    tm.mat_mudwall('ink_granite', wash='#85817b', brick='#88847e', brick2='#6f6b66', mortar='#a19c93', wash_cover=0.0,
                   bond=(0.07, 0.034, 0.004))
    # the gopuram's carved sandstone figures (ochre gold, deep relief) and its weathered lime plaster
    tm.mat_simple('ink_carved', ['#a8773c', '#c6964f', '#8e6430', '#d4a865'], scale=70.0, bump=0.8, dirt=True)
    tm.mat_simple('ink_plaster', ['#e0d7c4', '#e9e2d2', '#d3c8b0', '#d9cfba'], scale=16.0, bump=0.25, dirt=True)
    # the poor houses: a worn lime wash over red brick
    tm.mat_mudwall('ink_lime', wash='#dcd2bd', brick='#a8664a', brick2='#93553d', mortar='#bba98e', wash_cover=0.72,
                   bond=(0.05, 0.022, 0.004))
    # the Sultanate red sandstone (the tomb's trims, the wall gate)
    tm.mat_mudwall('ink_redstone', wash='#a35b3e', brick='#a65d40', brick2='#8b4a32', mortar='#bd7a5b', wash_cover=0.0,
                   bond=(0.05, 0.026, 0.003))
    # terracotta half-round tiles in courses, darker ridge tiles
    tm.mat_mudwall('ink_tile', wash='#ad5437', brick='#b25a3a', brick2='#954530', mortar='#6c2e1c', wash_cover=0.0,
                   bond=(0.024, 0.014, 0.0025))
    tm.mat_simple('ink_ridge', ['#7c3622', '#91432b', '#6a2d1b'], scale=30.0, bump=0.3)
    # the lime-plastered stone dome, mottled grey with weather
    tm.mat_simple('ink_dome', ['#cdc4b2', '#b3ab9b', '#dcd4c2', '#a39b8d'], scale=12.0, bump=0.25, dirt=True)
    # the town wall: weathered pinkish-grey sandstone in rough courses
    tm.mat_mudwall('ink_wallstone', wash='#9c8574', brick='#a08775', brick2='#86705f', mortar='#b39d8a', wash_cover=0.0,
                   bond=(0.055, 0.028, 0.004))
    # pierced stone screens (jali): dark holes in a sandstone grid
    tm.mat_mudwall('ink_jali', wash='#2a2018', brick='#241b14', brick2='#2e2319', mortar='#7d6442', wash_cover=0.0,
                   bond=(0.012, 0.012, 0.004))
    # the ground: sandy earth plots, grey stone paving for the lanes and the square
    sand = ('#b38b5d', '#c39c6b', '#a78053', '#cba676')
    for n in ('ink_earth', 'ink_earth_fringe'):
        tm.mat_earth(n, colors=sand)
    tc.mat_paving('ink_earth_square', stone=('#8f8a83', '#827d76', '#9c978f'), mortar='#5e5a54', slab=(0.04, 0.03))


if not any(n == 'indic_kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('indic_kingdoms', make_materials))

EARTHY = dict(mat='ink_earth', power=8)
FOOT = []


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        p = f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))
        pts.append((p.x, p.y))
    FOOT.append((tag, pts))


# ---- small helpers ------------------------------------------------------------------------------

def pointed_pts(cx, a, zj, n=5, k=1.3):
    """A two-centred pointed (Sultanate) arch over half-width a springing at zj: the points from the
    right jamb over the apex to the left jamb."""
    R = a * k
    off = R - a
    th = math.acos(off / R)
    right = [(cx - off + R * math.cos(th * i / n), zj + R * math.sin(th * i / n)) for i in range(n + 1)]
    left = [(cx + off - R * math.cos(th * i / n), zj + R * math.sin(th * i / n)) for i in range(n - 1, -1, -1)]
    return right + left


def arch_rise(a, k=1.3):
    R = a * k
    return R * math.sin(math.acos((R - a) / R))


def pointed(ms, f, mat, cx, y, z0, a, h, lod=0, n=4, only=None):
    """A flat pointed-arch opening (door, window, niche) on the local y plane facing -Y: half-width
    a, total height h."""
    zj = max(0.0, h - arch_rise(a))
    bm = bmesh.new()
    vs = [bm.verts.new((cx - a, y, z0)), bm.verts.new((cx + a, y, z0))]
    vs += [bm.verts.new((px, y, z0 + pz)) for px, pz in pointed_pts(cx, a, zj, n)]
    face = bm.faces.new(vs)
    bm.normal_update()
    if face.normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=[face])
    lod_ = max(only) if isinstance(only, tuple) else (only if only is not None else lod)
    ms.add(bm, mat, lod_, matrix=f, only=only)


def faces4(f, w, d):
    """The four outer faces of a w x d block: (frame whose local -Y is the face, half the distance to
    it, the face's width), front first, then east, back, west."""
    out = []
    for k in range(4):
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        out.append((kf, (d if k % 2 == 0 else w) / 2, w if k % 2 == 0 else d))
    return out


def hip(ms, f, w, d, z0, rise, over=0.035, lod=1, mat='ink_tile'):
    """A terracotta hip roof over a w x d block (walls stop at z0), its ridge along local X: one
    closed solid (ti_classical's hip_roof without the upturned corners), the ridge tiles at LOD0."""
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - over * 0.3
    r = max(0.0, W - D)
    bm = bmesh.new()
    c = [bm.verts.new((sx * W, sy * D, ze)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    if r > 0.001:
        R0, R1 = bm.verts.new((-r, 0, z0 + rise)), bm.verts.new((r, 0, z0 + rise))
        bm.faces.new((c[0], c[1], R1, R0))
        bm.faces.new((c[2], c[3], R0, R1))
        bm.faces.new((c[1], c[2], R1))
        bm.faces.new((c[3], c[0], R0))
    else:
        top = bm.verts.new((0, 0, z0 + rise))
        for i in range(4):
            bm.faces.new((c[i], c[(i + 1) % 4], top))
    bm.faces.new(list(reversed(c)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed solid: safe to orient
    ms.add(bm, mat, lod, matrix=f)
    if r > 0.001:
        ms.box('ink_ridge', (2 * r + 0.02, 0.03, 0.02), at=(0, 0, z0 + rise - 0.008), lod=0, frame=f)


def tile_hip(ms, f, x, y, w, d, z, rise, over=0.035, lod=1):
    """A terracotta hip roof over a w x d block (the ridge along the longer side)."""
    rf = f @ Matrix.Translation(Vector((x, y, 0)))
    if d > w:
        rf = rf @ Matrix.Rotation(math.radians(90), 4, 'Z')
        w, d = d, w
    hip(ms, rf, w, d, z, rise, over=over, lod=lod)


def tile_gable(ms, f, x, y, w, d, z, rise, gable='ink_lime', over=0.03, lod=1):
    """A terracotta gable roof, its ridge along local X."""
    rf = f @ Matrix.Translation(Vector((x, y, 0)))
    tc.gable_roof(ms, rf, w, d, z, rise, over=over, mat='ink_tile', gable=gable, thick=0.02, lod=lod, ridge='ink_ridge')


def window(ms, f, x, y, z, w=0.045, h=0.065, lod=0):
    """A small window: a carved timber frame with a dark opening and a sill."""
    ms.box('dark', (w, 0.006, h), at=(x, y - 0.003, z), lod=lod, frame=f)
    ms.box('timber', (w + 0.014, 0.012, 0.01), at=(x, y - 0.005, z - 0.008), lod=0, frame=f)


def jar(ms, f, x, y, s=1.0, z=G, mat='terracotta'):
    """A water jar (6 sides, 5 rings)."""
    p = [(0.0, 0.0), (0.024 * s, 0.004), (0.032 * s, 0.035 * s), (0.016 * s, 0.072 * s), (0.016 * s, 0.084 * s), (0.0, 0.084 * s)]
    ms.lathe(mat, [(r, zz + z) for r, zz in p], at=(x, y, 0), segs=6, lod=0, frame=f)


def potted(ms, f, x, y, s=1.0, z=G):
    """A potted shrub: a jar with a ball of leaves."""
    jar(ms, f, x, y, s, z=z)
    ms.sphere('shrub', 0.035 * s, at=(x, y, z + 0.1 * s), u=6, v=4, lod=0, frame=f)


def clutter(ms, f, x, y, rng, n=4):
    for _ in range(n):
        px, py = x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.6:
            jar(ms, f, px, py, rng.uniform(0.8, 1.15))
        elif r < 0.85:
            tt.basket(ms, f, px, py, rng.uniform(0.8, 1.1))
        else:
            tt.crate(ms, f, px, py, rng.uniform(0.8, 1.1), rng.uniform(-20, 20))


def cloth_shade(ms, f, x, y, w, d, z, tilt=8.0, lod=0):
    """A grey cloth shade (team cloth) on four poles, sloping a little."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.012, 0.012, z - G + (0.02 if sy > 0 else 0.0)), at=(x + sx * (w / 2 - 0.01), y + sy * (d / 2 - 0.01), G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(tilt), 4, 'X')
    ms.box('team_cloth', (w + 0.02, d + 0.02, 0.008), at=(0, 0, 0), lod=lod, frame=pf)


def hang_awning(ms, f, x, y, w, depth=0.1, z=0.3, lod=0):
    """A grey cloth awning (team cloth) hung from a -Y wall face at local y, sloping out and down."""
    pf = f @ Matrix.Translation(Vector((x, y - depth / 2, z))) @ Matrix.Rotation(math.radians(-28), 4, 'X')
    ms.box('team_cloth', (w, depth * 1.12, 0.008), at=(0, 0, 0), lod=lod, frame=pf)
    ms.box('team_cloth', (w, 0.006, 0.03), at=(x, y - depth - 0.004, z - depth * 0.55 - 0.03), lod=0, frame=f)


def thatch_shed(ms, f, x, y, w, d, h=0.17, lod=0):
    """A lean-to of poles under a thatch (palm-leaf) roof."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.012, 0.012, h + (0.03 if sy > 0 else 0.0)), at=(x + sx * (w / 2 - 0.01), y + sy * (d / 2 - 0.01), G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y, G + h + 0.015))) @ Matrix.Rotation(math.radians(-10), 4, 'X')
    ms.box('thatch', (w + 0.04, d + 0.04, 0.025), at=(0, 0, 0), lod=lod, frame=pf)


def balustrade(ms, f, x, y, w, d, z, mat='ink_sandstone', lod=0, sides=(0, 1, 2, 3)):
    """A pierced stone parapet: a dark band of balusters under a rail, round a w x d top."""
    segs = ((0, -d / 2, w, 0.016), (w / 2, 0, 0.016, d), (0, d / 2, w, 0.016), (-w / 2, 0, 0.016, d))
    for k in sides:
        px, py, pw, pd = segs[k]
        ms.box('ink_jali', (pw * 0.98, pd * 0.6, 0.04), at=(x + px, y + py, z), lod=lod, frame=f)
        ms.box(mat, (pw + 0.004, pd + 0.004, 0.014), at=(x + px, y + py, z + 0.04), lod=lod, frame=f)


def finial(ms, f, x, y, z, s=1.0, mat='bronze'):
    """A bronze kalasha finial: a pot and a spike."""
    ms.lathe(mat, [(0.004 * s, 0.0), (0.016 * s, 0.01 * s), (0.02 * s, 0.026 * s), (0.008 * s, 0.044 * s), (0.012 * s, 0.05 * s),
                   (0.003 * s, 0.075 * s), (0.001, 0.08 * s)], at=(x, y, z), segs=6, lod=0, frame=f)


def onion_dome(ms, f, x, y, z, r, mat='ink_dome', lod=1, segs=12, fin=True):
    """A Sultanate dome: a bulb a little wider than its drum, a lotus neck and a bronze finial."""
    p = [(r * 0.9, 0.0), (r * 1.0, 0.18 * r), (r * 1.02, 0.4 * r), (r * 0.93, 0.68 * r), (r * 0.72, 0.92 * r), (r * 0.42, 1.08 * r),
         (r * 0.12, 1.17 * r), (0.003, 1.2 * r)]
    ms.lathe(mat, [(a, b + z) for a, b in p], at=(x, y, 0), segs=segs, lod=lod, frame=f)
    if fin:
        finial(ms, f, x, y, z + 1.15 * r, s=max(0.6, r / 0.08))


def chhatri(ms, f, x, y, z, r, mat='ink_sandstone', dome='ink_dome', lod=1, posts=4):
    """A chhatri: a small open pavilion of `posts` pillars on a square base under a dome."""
    ph = r * 1.5
    ms.box(mat, (2.2 * r, 2.2 * r, r * 0.25), at=(x, y, z), lod=lod, frame=f)
    for k in range(posts):
        a = math.radians(45 + 360 * k / posts)
        ms.box(mat, (r * 0.22, r * 0.22, ph), at=(x + r * 0.95 * math.cos(a), y + r * 0.95 * math.sin(a), z + r * 0.25), lod=0, frame=f)
    ms.box(mat, (2.3 * r, 2.3 * r, r * 0.18), at=(x, y, z + r * 0.25 + ph), lod=lod, frame=f)
    onion_dome(ms, f, x, y, z + r * 0.43 + ph, r * 0.95, mat=dome, lod=0, segs=10)
    if lod >= 1:  # LOD1 (and up): a 6-sided cone stands in for the dome
        ms.cyl(dome, r * 0.95, 0.0, r * 1.2, at=(x, y, z + r * 0.43 + ph), segs=6, lod=1, only=1, frame=f, caps=False)
    if lod >= 1:
        tk.box_only(ms, 0 if lod == 0 else (1,), mat, (r * 1.6, r * 1.6, ph), at=(x, y, z + r * 0.25), frame=f)


def tiled_pavilion(ms, f, x, y, z, w, h, roof=None, mat='ink_sandstone', lod=1):
    """A small open pavilion on four pillars under a tiled pyramid roof with a finial (the palaces'
    roof kiosks)."""
    roof = roof or w * 0.6
    ms.box(mat, (w, w, 0.03), at=(x, y, z), lod=lod, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box(mat, (0.03, 0.03, h), at=(x + sx * (w / 2 - 0.02), y + sy * (w / 2 - 0.02), z + 0.03), lod=0, frame=f)
    tk.box_only(ms, (1, 2) if lod >= 2 else (1,), mat, (w * 0.8, w * 0.8, h), at=(x, y, z + 0.03), frame=f)
    rf = f @ Matrix.Translation(Vector((x, y, 0)))
    hip(ms, rf, w, w, z + 0.03 + h, roof, over=0.05, lod=lod)
    finial(ms, f, x, y, z + 0.03 + h + roof - 0.01, s=1.2)


def porch(ms, f, x, y, w, depth, h, n=4, mat='ink_sandstone', roof=True, lod=1):
    """A pillared porch on a -Y face at local y: pillars with capitals, a lintel and a low tiled
    lean-to roof (or none)."""
    for i in range(n):
        px = x - w / 2 + 0.02 + (w - 0.04) * i / (n - 1)
        ms.box(mat, (0.026, 0.026, h), at=(px, y - depth + 0.016, G), lod=0, frame=f)
        ms.box(mat, (0.04, 0.04, 0.016), at=(px, y - depth + 0.016, G + h - 0.016), lod=0, frame=f)
    ms.box(mat, (w + 0.01, depth, 0.03), at=(x, y - depth / 2, G + h), lod=0, frame=f)
    if roof:
        pf = f @ Matrix.Translation(Vector((x, y - depth / 2, G + h + 0.04))) @ Matrix.Rotation(math.radians(-16), 4, 'X')
        ms.box('ink_tile', (w + 0.05, depth + 0.06, 0.018), at=(0, 0, 0), lod=lod, frame=pf)
    ms.box(mat, (w + 0.02, depth + 0.02, 0.025), at=(x, y - depth / 2, G), lod=0, frame=f)  # the porch floor


def steps(ms, f, x, y, w, n, rise=0.014, run=0.03, z=G, mat='ink_sandstone', lod=0):
    """n steps down from z on a -Y face at local y."""
    for k in range(n):
        ms.box(mat, (w, run * (n - k), rise * (k + 1) if z == G else (z - G) * (k + 1) / n), at=(x, y - run * (n - k) / 2, G), lod=lod, frame=f)


# ---- the houses ---------------------------------------------------------------------------------

def yard_wall(ms, f, w, d, h, mat, gate_x=0.0, gate_w=0.1, back=False, lod=1, t=0.03):
    """A low wall round a w x d plot with a gateway in the front at gate_x."""
    l0 = (gate_x - gate_w / 2) - (-w / 2)
    l1 = w / 2 - (gate_x + gate_w / 2)
    if l0 > 0.02:
        ms.box(mat, (l0, t, h), at=(-w / 2 + l0 / 2, -d / 2 + t / 2, G), lod=lod, frame=f)
    if l1 > 0.02:
        ms.box(mat, (l1, t, h), at=(w / 2 - l1 / 2, -d / 2 + t / 2, G), lod=lod, frame=f)
    for sx in (-1, 1):
        ms.box(mat, (t, d - t, h), at=(sx * (w / 2 - t / 2), t / 2, G), lod=lod, frame=f)
    if back:
        ms.box(mat, (w - 2 * t, t, h), at=(0, d / 2 - t / 2, G), lod=lod, frame=f)
    for sx in (-1, 1):  # gate posts
        ms.box(mat, (0.035, 0.04, h + 0.03), at=(gate_x + sx * (gate_w / 2 + 0.017), -d / 2 + t / 2, G), lod=0, frame=f)


def poor_house(ms, rng, x, y, w, d, yaw=None, **_):
    """The poor house (sheet: about 8 x 6 m with its yard): one storey of lime-washed brick under a
    terracotta gable, a small tiled upper room at one end, a veranda of timber posts under a tiled
    lean-to, a plank door and a small window; a low walled yard in front with a gate, a thatched
    lean-to shed, a grey cloth shade or a tree, jars."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * 0.82
    bd = d * 0.55
    by = d / 2 - bd / 2
    ms.box('ink_lime', (w - 0.02, bd, h), at=(0, by, G), lod=1, frame=f)
    tile_gable(ms, f, 0, by, w - 0.02, bd, G + h, 0.16, gable='ink_lime')
    up = w > 0.62
    side = rng.choice((-1, 1))
    if up:
        uw = min(0.26, w * 0.32)
        ux = side * (w / 2 - 0.01 - uw / 2)
        uh = STOREY * 0.62
        ms.box('ink_lime', (uw, bd * 0.7, uh + 0.12), at=(ux, by + bd * 0.1, G + h - 0.12), lod=1, frame=f)
        tile_gable(ms, f, ux, by + bd * 0.1, uw, bd * 0.7, G + h + uh, 0.1, gable='ink_lime')
        window(ms, f, ux, by + bd * 0.1 - bd * 0.35, G + h + uh * 0.35, w=0.04, h=0.05)
    # the veranda along the house front
    vy = by - bd / 2
    vw = w * (0.6 if up else 0.8)
    vx = -side * (w - vw) / 2 * 0.6 if up else 0.0
    porch(ms, f, vx, vy, vw, 0.1, h * 0.72, n=3, mat='timber')
    ms.box('door', (0.075, 0.012, 0.16), at=(vx, vy - 0.004, G), lod=0, frame=f)
    window(ms, f, vx + vw * 0.3, vy, G + 0.15)
    # the yard
    yd = d - bd
    gx = -side * w * 0.22
    yard_wall(ms, f, w, d, 0.12, 'ink_lime', gate_x=gx, gate_w=0.1)
    ms.box('door', (0.09, 0.01, 0.11), at=(gx, -d / 2 + 0.01, G), lod=0, frame=f)
    sx_ = side * (w / 2 - 0.13)
    thatch_shed(ms, f, sx_, -d / 2 + yd * 0.45, 0.2, min(0.18, yd * 0.6))
    r = rng.random()
    if r < 0.45:
        cloth_shade(ms, f, -side * w * 0.15, -d / 2 + yd * 0.5, min(0.22, w * 0.3), yd * 0.4, G + 0.17)
    elif r < 0.8:
        p = f @ Vector((-side * w * 0.3, -d / 2 + yd * 0.5, 0))
        tk.tree(ms, p.x, p.y, h=0.28, r=0.08, lod2=False)
    for k in range(3):
        jar(ms, f, sx_ - 0.06 + 0.05 * k, -d / 2 + 0.07, rng.uniform(0.8, 1.05))
    tk.lod2_block(ms, f, w - 0.02, bd, h, rise=0.16, y=by, mat='ink_lime')
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning_w=None, **_):
    """The common house (sheet: about 12 x 12 m): lime plaster on a sandstone plinth, tiled hip
    roofs round a court: a back range with a pillared porch to the court and a two-storey tower
    room at one corner, a side wing, a front wall with a sandstone gateway up steps; a court with a
    tree in a stone planter, a grey cloth shade, jars. On narrow plots a closed block with a
    pillared front porch and a tiled upper room."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY
    side = rng.choice((-1, 1))
    ms.box('ink_sandstone', (w + 0.012, d + 0.012, 0.03), at=(0, 0, G), lod=0, frame=f)
    if min(w, d) >= 0.5:
        bd = d * 0.4
        by = d / 2 - bd / 2
        ms.box('ink_plaster', (w, bd, h), at=(0, by, G), lod=1, frame=f)
        tile_hip(ms, f, 0, by, w, bd, G + h, 0.14)
        # the tower room at one back corner
        tw_ = min(0.3, w * 0.34)
        tx = side * (w / 2 - tw_ / 2)
        th = h + STOREY * 0.8
        ms.box('ink_plaster', (tw_, tw_, th), at=(tx, d / 2 - tw_ / 2, G), lod=1, frame=f)
        ms.box('ink_sandstone', (tw_ + 0.01, tw_ + 0.01, 0.02), at=(tx, d / 2 - tw_ / 2, G + h), lod=0, frame=f)
        tile_hip(ms, f, tx, d / 2 - tw_ / 2, tw_, tw_, G + th, 0.12)
        window(ms, f, tx, d / 2 - tw_, G + h + 0.1)
        # the side wing
        ww = w * 0.3
        wx = -side * (w - ww) / 2
        wd = d - bd
        wy = -d / 2 + wd / 2
        ms.box('ink_plaster', (ww, wd, h * 0.85), at=(wx, wy, G), lod=1, frame=f)
        tile_hip(ms, f, wx, wy, ww, wd, G + h * 0.85, 0.12)
        # the front wall and gateway
        cw = w - ww
        cx = side * ww / 2
        ms.box('ink_plaster', (cw, 0.035, h * 0.55), at=(cx, -d / 2 + 0.0175, G), lod=1, frame=f)
        ms.box('ink_plaster', (0.035, wd - 0.035, h * 0.55), at=(side * (w / 2 - 0.0175), wy + 0.0175, G), lod=1, frame=f)
        ms.box('ink_sandstone', (cw + 0.01, 0.045, 0.02), at=(cx, -d / 2 + 0.0175, G + h * 0.55), lod=0, frame=f)
        gx = cx - side * cw * 0.15
        ms.box('ink_sandstone', (0.18, 0.05, h * 0.78), at=(gx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('ink_sandstone', (0.21, 0.065, 0.025), at=(gx, -d / 2 + 0.01, G + h * 0.78), lod=0, frame=f)
        pointed(ms, f, 'door', gx, -d / 2 - 0.016, G, 0.04, 0.2, lod=1)
        steps(ms, f, gx, -d / 2 - 0.015, 0.16, 2)
        # the court: paving, the porch on the back range, a tree in a planter, a shade
        cd = wd - 0.035
        ccx, ccy = cx - side * 0.0175, -d / 2 + 0.035 + cd / 2
        ms.box('ink_earth_square', (cw - 0.035, cd, 0.006), at=(ccx, ccy, G), lod=0, frame=f)
        porch(ms, f, ccx, by - bd / 2, cw * 0.7, 0.07, h * 0.75, n=4, roof=False)
        if cw > 0.42:
            ms.box('ink_sandstone', (0.12, 0.12, 0.04), at=(ccx + side * cw * 0.12, ccy, G), lod=0, frame=f)
            p = f @ Vector((ccx + side * cw * 0.12, ccy, 0))
            tk.tree(ms, p.x, p.y, h=0.3, r=0.085, lod2=False)
            cloth_shade(ms, f, ccx - side * cw * 0.2, ccy, cw * 0.3, cd * 0.45, G + h * 0.6, tilt=-6)
        else:
            cloth_shade(ms, f, ccx, ccy, cw * 0.5, cd * 0.45, G + h * 0.6, tilt=-6)
        for k in range(3):
            jar(ms, f, wx + side * (ww / 2 + 0.04), ccy - cd * 0.3 + 0.05 * k, rng.uniform(0.8, 1.05))
        for wxx in (wx,):
            window(ms, f, wxx, -d / 2, G + 0.15)
        ph = th
        tk.lod2_block(ms, f, w, d, h * 0.9, mat='ink_plaster')
        tk.lod2_block(ms, f, tw_, tw_, th - h * 0.9 + 0.08, z0=G + h * 0.9, x=tx, y=d / 2 - tw_ / 2, mat='ink_tile')
    else:
        bd = d - 0.1
        by = 0.05
        ms.box('ink_plaster', (w, bd, h), at=(0, by, G), lod=1, frame=f)
        tile_hip(ms, f, 0, by, w, bd, G + h, 0.13)
        uw = w * 0.5
        ux = side * (w - uw) / 2
        uh = STOREY * 0.75
        ms.box('ink_plaster', (uw, bd * 0.5, uh + 0.08), at=(ux, by + bd * 0.2, G + h - 0.04), lod=1, frame=f)
        tile_hip(ms, f, ux, by + bd * 0.2, uw, bd * 0.5, G + h + uh + 0.04, 0.1)
        porch(ms, f, 0, by - bd / 2, w * 0.7, 0.09, h * 0.72, n=4)
        ms.box('door', (0.08, 0.012, 0.17), at=(0, by - bd / 2 - 0.004, G), lod=0, frame=f)
        for wxx in (-w * 0.25, w * 0.25):
            window(ms, f, wxx, by - bd / 2, G + 0.15)
        steps(ms, f, 0, -d / 2 + 0.02, 0.14, 1)
        ph = h + uh
        tk.lod2_block(ms, f, w, bd, h, y=by, rise=0.1, mat='ink_plaster')
    if awning_w:
        tt.front_shade(ms, f, side * w * 0.3, -d / 2, min(awning_w, w * 0.32), depth=0.14, z=0.24, mat='team_cloth')
    return ph


def rich_house(ms, rng, x, y, w, d, yaw=None, **_):
    """The rich house, a haveli (sheet: about 18 x 18 m, 12 m to the chhatris): two storeys of
    sandstone round a court with a pool, the front range with a tall cusped portal up steps, a
    carved door and a jharokha balcony over it, balconies and grey awnings either side, two corner
    towers with domed chhatris, balustraded roof terraces, tiled hip roofs on the side wings and the
    back range, palms and potted shrubs in the court."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h0, h1 = STOREY, STOREY * 0.85
    H = h0 + h1
    ms.box('ink_sandstone', (w + 0.02, d + 0.02, 0.045), at=(0, 0, G), lod=1, frame=f)
    z = G + 0.045
    fd, bd = d * 0.3, d * 0.3
    sw = w * 0.22
    cd = d - fd - bd
    fy, byy = -d / 2 + fd / 2, d / 2 - bd / 2
    ms.box('ink_sandstone', (w, fd, H), at=(0, fy, z), lod=1, frame=f, bevel=0.003)
    ms.box('ink_plaster', (w - 0.03, fd - 0.03, 0.006), at=(0, fy, z + H), lod=0, frame=f)
    balustrade(ms, f, 0, fy, w - 0.02, fd - 0.02, z + H)
    ms.box('ink_sandstone', (w, bd, H), at=(0, byy, z), lod=1, frame=f)
    tile_hip(ms, f, 0, byy, w, bd, z + H, 0.1)
    for sx in (-1, 1):
        ms.box('ink_sandstone', (sw, cd + 0.01, h0), at=(sx * (w / 2 - sw / 2), -d / 2 + fd + cd / 2, z), lod=1, frame=f)
        tile_hip(ms, f, sx * (w / 2 - sw / 2), -d / 2 + fd + cd / 2, sw, cd + 0.01, z + h0, 0.1)
    ms.box('ink_sandstone', (w + 0.016, d + 0.016, 0.018), at=(0, 0, z + h0 - 0.01), lod=0, frame=f)  # the floor band
    # the portal and the jharokha over it
    pw = min(0.3, max(0.2, w * 0.3))
    ms.box('ink_sandstone', (pw, 0.05, H + 0.08), at=(0, -d / 2 - 0.02, z), lod=1, frame=f)
    ms.box('ink_carved', (pw + 0.02, 0.065, 0.025), at=(0, -d / 2 - 0.02, z + H + 0.08), lod=0, frame=f)
    pointed(ms, f, 'ink_carved', 0, -d / 2 - 0.046, z, pw * 0.36, h0 + 0.06, lod=0)
    pointed(ms, f, 'door', 0, -d / 2 - 0.048, z, pw * 0.2, h0 * 0.62, lod=1)
    ms.box('ink_sandstone', (pw * 0.6, 0.06, 0.12), at=(0, -d / 2 - 0.07, z + h0 + 0.04), lod=0, frame=f)
    ms.box('ink_jali', (pw * 0.5, 0.006, 0.08), at=(0, -d / 2 - 0.1, z + h0 + 0.06), lod=0, frame=f)
    tile_hip(ms, f, 0, -d / 2 - 0.07, pw * 0.66, 0.08, z + h0 + 0.16, 0.05, over=0.015, lod=0)
    steps(ms, f, 0, -d / 2 - 0.045, pw * 0.8, 3)
    for sx in (-1, 1):
        wx = sx * w * 0.27
        pointed(ms, f, 'dark', wx, -d / 2 - 0.003, z + 0.06, 0.03, 0.14)
        ms.box('ink_sandstone', (0.12, 0.05, 0.1), at=(wx, -d / 2 - 0.025, z + h0 + 0.04), lod=0, frame=f)
        ms.box('ink_jali', (0.1, 0.006, 0.07), at=(wx, -d / 2 - 0.051, z + h0 + 0.055), lod=0, frame=f)
        hang_awning(ms, f, wx, -d / 2, 0.16, depth=0.1, z=z + H - 0.04)
        for kf, half, span in faces4(f, w, d)[1:4:2]:
            for i in (-1, 1):
                pointed(ms, kf, 'dark', i * span * 0.28, -half - 0.003, z + h0 + 0.06, 0.028, 0.11)
    # the corner towers with chhatris
    tw_ = min(0.16, w * 0.17)
    for sx in (-1, 1):
        tx = sx * (w / 2 - tw_ / 2 + 0.01)
        ty = -d / 2 + tw_ / 2 - 0.01
        ms.box('ink_sandstone', (tw_, tw_, H + 0.1), at=(tx, ty, z), lod=1, frame=f)
        ms.box('ink_sandstone', (tw_ + 0.02, tw_ + 0.02, 0.02), at=(tx, ty, z + H + 0.08), lod=0, frame=f)
        pointed(ms, f, 'dark', tx, ty - tw_ / 2 - 0.003, z + h0 + 0.07, 0.025, 0.1)
        chhatri(ms, f, tx, ty, z + H + 0.1, tw_ * 0.4, lod=1)
    # the court: paving, a pool, palms, potted shrubs
    ccy = -d / 2 + fd + cd / 2
    ms.box('ink_earth_square', (w - 2 * sw, cd, 0.006), at=(0, ccy, z), lod=0, frame=f)
    ms.box('ink_sandstone', (0.14, min(0.2, cd * 0.6), 0.025), at=(0, ccy, z), lod=0, frame=f)
    ms.box('water', (0.11, min(0.2, cd * 0.6) - 0.03, 0.004), at=(0, ccy, z + 0.024), lod=0, frame=f)
    for sx in (-1, 1):
        p = f @ Vector((sx * (w / 2 - sw - 0.06), ccy, 0))
        if w - 2 * sw > 0.38:
            tk.palm(ms, rng, p.x, p.y, h=rng.uniform(0.4, 0.48), fronds=7)
        else:
            potted(ms, f, sx * (w / 2 - sw - 0.05), ccy, 1.0, z=z)
    for sx in (-1, 1):
        potted(ms, f, sx * (pw / 2 + 0.06), -d / 2 - 0.06, 1.1)
    tk.lod2_block(ms, f, w, d, H + 0.05, mat='ink_sandstone')
    return f


def house(ms, rng, kind, x, y, w, d, **kw):
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **kw)


# ---- landmark 1: the gopuram ---------------------------------------------------------------------

def gopuram(ms, rng, x, y, s=0.6, yaw=None):
    """The gopuram temple gate (sheet: 18 m across, a 6 m granite base storey, 27 m of tiers above,
    33 m to the finials): a grey granite gateway with pilasters, carved door guardians and a team
    cloth swag over a tall passage, low granite walls either side; seven receding tiers of white
    lime plaster banded with carved sandstone cornices, a carved pavilion with a dark niche in the
    middle of each face and carved figures at the corners; the barrel-vaulted crown (shala) with
    horned gable ends and a row of bronze kalasha finials."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = 1.8 * s, 1.1 * s
    hb = 0.6 * s
    foot(f, W + 0.56 * s, D, tag='temple')
    ms.box('ink_granite', (W + 0.05 * s, D + 0.05 * s, 0.06 * s), at=(0, 0, G), lod=1, frame=f)
    gw, gh = 0.3 * s, 0.44 * s
    pw = (W - gw) / 2
    for sx in (-1, 1):
        ms.box('ink_granite', (pw, D, hb), at=(sx * (gw / 2 + pw / 2), 0, G), lod=1, frame=f)
    ms.box('ink_granite', (gw, D, hb - gh), at=(0, 0, G + gh), lod=1, frame=f)
    ms.box('dark', (gw, 0.01, gh), at=(0, 0, G), lod=1, frame=f)  # the shadowed passage
    tk.box_only(ms, 2, 'ink_granite', (W, D, hb), at=(0, 0, G), frame=f)
    ms.box('ink_sandstone', (W + 0.06 * s, D + 0.06 * s, 0.035 * s), at=(0, 0, G + hb - 0.035 * s), lod=1, frame=f)
    for kf, half, span in faces4(f, W, D):
        n = 8 if span > W * 0.9 else 5
        for i in range(n):
            px = -span / 2 + span * (i + 0.5) / n
            if abs(px) < gw * 0.75 and span > W * 0.9:
                continue
            ms.box('ink_granite', (0.035 * s, 0.014, hb * 0.82), at=(px, -half - 0.007, G + 0.06 * s), lod=0, frame=kf)
        if span > W * 0.9:
            for sx in (-1, 1):  # the door guardians and the figures in niches
                ms.box('ink_carved', (0.05 * s, 0.02, 0.22 * s), at=(sx * (gw / 2 + 0.05 * s), -half - 0.01, G + 0.1 * s), lod=0, frame=kf)
                ms.box('ink_carved', (0.04 * s, 0.016, 0.18 * s), at=(sx * pw * 0.95, -half - 0.008, G + 0.14 * s), lod=0, frame=kf)
            ms.box('team_cloth', (gw * 1.4, 0.008, 0.07 * s), at=(0, -half - 0.012, G + gh - 0.03 * s), lod=1, frame=kf)
    for sx in (-1, 1):  # the low walls either side
        ms.box('ink_granite', (0.28 * s, D * 0.8, 0.34 * s), at=(sx * (W / 2 + 0.14 * s), D * 0.05, G), lod=1, frame=f)
        ms.box('ink_sandstone', (0.3 * s, D * 0.8 + 0.02, 0.025 * s), at=(sx * (W / 2 + 0.14 * s), D * 0.05, G + 0.34 * s), lod=0, frame=f)
    # the tiers
    n = 7
    Ht = 2.3 * s
    th = Ht / n
    z0 = G + hb
    for i in range(n):
        t = i / (n - 1)
        tw = W * (0.92 - 0.46 * t)
        td = D * (0.84 - 0.5 * t)
        z = z0 + i * th
        ms.box('ink_carved', (tw, td, th * 0.76), at=(0, 0, z), lod=1, frame=f)
        ms.box('ink_plaster', (tw + 0.01, td + 0.01, th * 0.16), at=(0, 0, z + th * 0.3), lod=0, frame=f)
        ms.box('ink_plaster', (tw + 0.04 * s, td + 0.04 * s, th * 0.26), at=(0, 0, z + th * 0.74), lod=1, frame=f, taper=0.97)
        for k, (kf, half, span) in enumerate(faces4(f, tw, td)):
            front = k % 2 == 0
            cw = (0.2 if front else 0.12) * s * (1 - 0.35 * t)
            ms.box('ink_carved', (cw, 0.03 * s, th * 0.76), at=(0, -half - 0.012 * s, z), lod=0, frame=kf)
            ms.box('dark', (cw * 0.42, 0.006, th * 0.42), at=(0, -half - 0.042 * s, z + th * 0.14), lod=0, frame=kf)
            for sx in (-1, 1):
                ms.box('ink_carved', (0.07 * s, 0.022 * s, th * 0.7), at=(sx * (span / 2 - 0.035 * s), -half - 0.008 * s, z), lod=0, frame=kf)
                for fx in ((0.2, 0.34) if front and span > 0.6 * s else (0.27,) if front else ()):
                    ms.box('ink_carved', (0.055 * s, 0.018 * s, th * 0.66), at=(sx * span * fx, -half - 0.007 * s, z), lod=0, frame=kf)
                if not front and span > 0.35 * s:
                    ms.box('ink_carved', (0.05 * s, 0.016 * s, th * 0.6), at=(sx * span * 0.25, -half - 0.006 * s, z), lod=0, frame=kf)
    obox_top = z0 + Ht
    tk.box_only(ms, 2, 'ink_plaster', (W * 0.9, D * 0.82, Ht), at=(0, 0, z0), frame=f, taper=0.52)  # LOD2: the tiers as one block
    # the crown: a barrel vault with horned ends and bronze finials
    vw = W * 0.5
    rv = D * 0.17
    ms.cyl('ink_plaster', rv, rv, vw, at=(-vw / 2, 0, obox_top + rv * 0.6), rot=(0, 90, 0), segs=10, lod=1, frame=f)
    ms.box('ink_plaster', (vw, rv * 2, rv * 0.6), at=(0, 0, obox_top), lod=1, frame=f)
    for sx in (-1, 1):
        hf = f @ Matrix.Translation(Vector((sx * (vw / 2 + 0.01 * s), 0, obox_top + rv * 1.4))) @ Matrix.Rotation(math.radians(sx * -20), 4, 'Y')
        ms.box('ink_carved', (0.04 * s, rv * 1.6, 0.16 * s), at=(0, 0, 0), lod=0, frame=hf, taper=0.4)
    nf = 7
    for i in range(nf):
        px = -vw / 2 + 0.04 * s + (vw - 0.08 * s) * i / (nf - 1)
        finial(ms, f, px, 0, obox_top + rv * 1.55, s=1.6 * s / 0.6)
    return f


# ---- landmark 2: the Sultanate tomb --------------------------------------------------------------

def merlon_row(ms, f, x0, x1, y, z, step=0.05, size=(0.03, 0.02, 0.035), mat='ink_redstone', lod=0):
    n = max(2, int(abs(x1 - x0) / step))
    for i in range(n):
        px = x0 + (x1 - x0) * (i + 0.5) / n
        ms.box(mat, size, at=(px, y, z), lod=lod, frame=f, taper=0.45)


def tomb(ms, rng, x, y, s=1.0, yaw=None):
    """The Sultanate tomb (sheet: 12 m square, 5 m walls, 8 m to the drum's top, 13 m to the
    finial): a sandstone cube on a red sandstone plinth with steps at the front, red sandstone
    bands and a pointed merlon cresting, a tall red sandstone portal frame (pishtaq) round a deep
    pointed arch and a door, pointed jali windows on the other faces, octagonal corner turrets with
    domed chhatris, an octagonal drum with arched windows and a big lime-plastered dome on a red
    sandstone ring with a bronze finial."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    w = 1.2 * s
    foot(f, w + 0.2 * s, w + 0.5 * s, 0, -0.1 * s, tag='tomb')
    pz = 0.07 * s
    ms.box('ink_redstone', (w + 0.16 * s, w + 0.16 * s, pz), at=(0, 0, G), lod=2, frame=f)
    steps(ms, f, 0, -(w + 0.16 * s) / 2, 0.42 * s, 4, run=0.06 * s, z=G + pz, mat='ink_redstone')
    hw = 0.5 * s
    ms.box('ink_sandstone', (w, w, hw), at=(0, 0, G + pz), lod=2, frame=f, bevel=0.004)
    z = G + pz
    ms.box('stone', (w - 0.02, w - 0.02, 0.008), at=(0, 0, z + hw), lod=0, frame=f)  # the roof terrace
    for zz, hh in ((0.0, 0.06 * s), (hw - 0.05 * s, 0.05 * s)):
        ms.box('ink_redstone', (w + 0.012, w + 0.012, hh), at=(0, 0, z + zz), lod=1, frame=f)
    for kf, half, span in faces4(f, w, w):
        merlon_row(ms, kf, -span / 2 + 0.03 * s, span / 2 - 0.03 * s, -half + 0.012, z + hw, step=0.07 * s,
                   size=(0.04 * s, 0.022 * s, 0.05 * s))
    # the portal and the windows
    pw_ = 0.52 * s
    ph = hw + 0.12 * s
    ms.box('ink_redstone', (pw_, 0.06 * s, ph), at=(0, -w / 2 - 0.02 * s, z), lod=1, frame=f)
    merlon_row(ms, f, -pw_ / 2 + 0.02 * s, pw_ / 2 - 0.02 * s, -w / 2 - 0.02 * s, z + ph, step=0.06 * s, size=(0.035 * s, 0.02 * s, 0.045 * s))
    pointed(ms, f, 'ink_sandstone', 0, -w / 2 - 0.051 * s, z, 0.17 * s, 0.4 * s, lod=0)
    pointed(ms, f, 'dark', 0, -w / 2 - 0.053 * s, z, 0.13 * s, 0.34 * s, lod=1)
    pointed(ms, f, 'door', 0, -w / 2 - 0.055 * s, z, 0.06 * s, 0.18 * s, lod=0)
    for sx in (-1, 1):
        pointed(ms, f, 'ink_jali', sx * 0.38 * s, -w / 2 - 0.003, z + 0.17 * s, 0.05 * s, 0.17 * s, lod=0)
    for kf, half, span in faces4(f, w, w)[1:]:
        ms.box('ink_redstone', (0.34 * s, 0.03 * s, hw * 0.88), at=(0, -half - 0.01 * s, z + 0.05 * s), lod=1, frame=kf)
        pointed(ms, kf, 'ink_jali', 0, -half - 0.026 * s, z + 0.12 * s, 0.09 * s, 0.28 * s, lod=0)
        for sx in (-1, 1):
            pointed(ms, kf, 'ink_jali', sx * 0.36 * s, -half - 0.003, z + 0.14 * s, 0.05 * s, 0.2 * s, lod=0)
    # the corner turrets with chhatris
    tr = 0.09 * s
    tz = hw + 0.12 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * w / 2, sy * w / 2
            ms.cyl('ink_sandstone', tr, tr * 0.92, tz, at=(cx, cy, z), segs=8, lod=1, frame=f)
            for zz in (0.06 * s, hw - 0.05 * s, tz - 0.02 * s):
                ms.cyl('ink_redstone', tr * 1.08, tr * 1.08, 0.025 * s, at=(cx, cy, z + zz), segs=8, lod=0, frame=f)
            chhatri(ms, f, cx, cy, z + tz, tr * 0.85, posts=6, lod=1)
    # the drum and the dome
    dz = z + hw
    rd = 0.34 * s
    ms.cyl('ink_sandstone', rd * 1.08, rd * 1.08, 0.06 * s, at=(0, 0, dz), segs=8, lod=1, frame=f)
    hd = 0.86 * s - pz - hw - 0.06 * s
    ms.cyl('ink_sandstone', rd, rd, hd, at=(0, 0, dz + 0.06 * s), rot=(0, 0, 22.5), segs=8, lod=2, frame=f)
    ms.cyl('ink_redstone', rd * 1.03, rd * 1.03, 0.03 * s, at=(0, 0, dz + 0.06 * s + hd - 0.03 * s), rot=(0, 0, 22.5), segs=8, lod=0, frame=f)
    for k in range(8):
        a = math.radians(45 * k)
        kf = f @ Matrix.Rotation(a, 4, 'Z')
        pointed(ms, kf, 'ink_jali', 0, -rd * math.cos(math.radians(22.5)) - 0.003, dz + 0.12 * s, 0.04 * s, 0.15 * s, lod=0)
    top = dz + 0.06 * s + hd
    ms.cyl('ink_redstone', rd * 0.98, rd * 0.98, 0.03 * s, at=(0, 0, top), segs=16, lod=0, frame=f)
    rdm = rd * 0.98
    p = [(rdm * 0.96, 0.0), (rdm * 1.04, 0.2 * rdm), (rdm * 1.04, 0.45 * rdm), (rdm * 0.94, 0.75 * rdm), (rdm * 0.7, 1.0 * rdm),
         (rdm * 0.36, 1.16 * rdm), (rdm * 0.08, 1.22 * rdm), (0.003, 1.23 * rdm)]
    ms.lathe('ink_dome', [(a, b + top + 0.03 * s) for a, b in p], at=(0, 0, 0), segs=16, lod=0, frame=f)
    tk.lathe2(ms, 'ink_dome', [(a, b + top + 0.03 * s) for a, b in p[::2] + [p[-1]]], at=(0, 0, 0), segs=8, lod=2, only=(1, 2), frame=f)
    dt = top + 0.03 * s + 1.23 * rdm
    ms.cyl('ink_redstone', 0.03 * s, 0.02 * s, 0.025 * s, at=(0, 0, dt - 0.01 * s), segs=8, lod=0, frame=f)
    ms.lathe('bronze', [(0.006, 0.0), (0.022 * s, 0.02 * s), (0.012 * s, 0.045 * s), (0.02 * s, 0.06 * s), (0.008 * s, 0.08 * s),
                        (0.003, 1.3 * s - (dt - G))], at=(0, 0, dt), segs=6, lod=0, frame=f)
    return f


# ---- the shared objects: palace-small, palace, walls-medium -------------------------------------

def palace_small(ms, rng):
    """`palace-small` (sheet: 18 m across, a 3.5 m stone terrace, 12 m to the tower's finial): a
    sandstone house on a raised terrace with steps up the middle of the front between bronze urns;
    a two-storey central block with a cusped portal and a carved door, a tower room over it with a
    tiled pyramid roof; pillared verandas either side with grey cloth awnings between the pillars,
    balustrades and tiled hip roofs; side ranges under tiled hip roofs and a flat back range with
    tiled roof kiosks at its corners, round a court with a pool and a tree. Built at 10 x 9 m to
    fit the capital's free centre."""
    f = tm.house_frame(0, 0, 0)
    w, d = 1.0, 0.84
    pz = 0.1
    ms.box('ink_sandstone', (w, d, pz), at=(0, 0, G), lod=2, frame=f, bevel=0.003)
    ms.box('ink_carved', (w + 0.01, d + 0.01, 0.02), at=(0, 0, G + pz - 0.02), lod=0, frame=f)
    z = G + pz
    steps(ms, f, 0, -d / 2, 0.22, 5, run=0.028, z=z)
    for sx in (-1, 1):
        ms.box('ink_sandstone', (0.04, 0.15, pz + 0.03), at=(sx * 0.13, -d / 2 - 0.075, G), lod=0, frame=f)
        jar(ms, f, sx * 0.13, -d / 2 - 0.12, 1.2, z=G + pz + 0.03, mat='bronze')
    # the central block and its tower
    cw, cd = 0.34, 0.36
    cy = -d / 2 + 0.03 + cd / 2
    h0, h1 = 0.3, 0.26
    ms.box('ink_sandstone', (cw, cd, h0 + h1), at=(0, cy, z), lod=2, frame=f)
    ms.box('ink_carved', (cw + 0.02, cd + 0.02, 0.025), at=(0, cy, z + h0), lod=0, frame=f)
    pointed(ms, f, 'ink_carved', 0, cy - cd / 2 - 0.003, z, 0.09, h0 + 0.02, lod=0)
    pointed(ms, f, 'door', 0, cy - cd / 2 - 0.005, z, 0.05, 0.2, lod=1)
    for wx in (-0.11, 0.11):
        pointed(ms, f, 'ink_jali', wx, cy - cd / 2 - 0.003, z + h0 + 0.06, 0.025, 0.12, lod=0)
    pointed(ms, f, 'dark', 0, cy - cd / 2 - 0.003, z + h0 + 0.05, 0.03, 0.14, lod=0)
    balustrade(ms, f, 0, cy, cw - 0.02, cd - 0.02, z + h0 + h1)
    tz = z + h0 + h1
    tw_ = 0.22
    ty = cy + 0.03
    ms.box('ink_sandstone', (tw_, tw_, 0.18), at=(0, ty, tz), lod=2, frame=f)
    window(ms, f, 0, ty - tw_ / 2, tz + 0.05, w=0.05, h=0.08)
    rise = 1.12 - tz - 0.18
    hip(ms, f @ Matrix.Translation(Vector((0, ty, 0))), tw_, tw_, tz + 0.18, rise, over=0.06, lod=2)
    finial(ms, f, 0, ty, tz + 0.18 + rise - 0.01, s=1.0)
    # the verandas either side of the front
    vw = (w - cw) / 2 - 0.02
    vd = 0.28
    vy = -d / 2 + 0.03 + vd / 2
    vh = 0.3
    for sx in (-1, 1):
        vx = sx * (cw / 2 + vw / 2 + 0.005)
        ms.box('ink_sandstone', (vw, vd * 0.5, vh), at=(vx, vy + vd * 0.25, z), lod=1, frame=f)
        for i in range(4):
            px = vx - vw / 2 + 0.02 + (vw - 0.04) * i / 3
            ms.box('ink_sandstone', (0.026, 0.026, vh), at=(px, vy - vd / 2 + 0.02, z), lod=0, frame=f)
            ms.box('ink_carved', (0.04, 0.04, 0.016), at=(px, vy - vd / 2 + 0.02, z + vh - 0.016), lod=0, frame=f)
            if i < 3:
                ms.box('team_cloth', ((vw - 0.04) / 3 - 0.02, 0.006, 0.08), at=(px + (vw - 0.04) / 6, vy - vd / 2 + 0.02, z + vh - 0.09), lod=1, frame=f)
        tk.box_only(ms, (1, 2), 'ink_sandstone', (vw, vd - 0.03, vh), at=(vx, vy + 0.015, z), frame=f)
        balustrade(ms, f, vx, vy - vd / 2 + 0.02, vw - 0.02, 0.0, z, sides=(0,))
        ms.box('ink_sandstone', (vw + 0.01, vd, 0.025), at=(vx, vy, z + vh), lod=1, frame=f)
        tile_hip(ms, f, vx, vy, vw + 0.02, vd + 0.02, z + vh + 0.025, 0.12, over=0.04, lod=2)
        for k in range(2):
            window(ms, f, vx - vw * 0.2 + vw * 0.4 * k, vy, z + 0.12)
    # the back range with its kiosks, the side ranges, the court
    bd = 0.2
    by = d / 2 - bd / 2
    ms.box('ink_sandstone', (w, bd, 0.34), at=(0, by, z), lod=2, frame=f)
    balustrade(ms, f, 0, by, w - 0.02, bd - 0.02, z + 0.34)
    sy0, sy1 = vy + vd / 2, d / 2 - bd
    sd = sy1 - sy0
    sy = (sy0 + sy1) / 2
    for sx in (-1, 1):
        rx = sx * (w / 2 - 0.12)
        ms.box('ink_sandstone', (0.24, sd + 0.01, 0.3), at=(rx, sy, z), lod=2, frame=f)
        tile_hip(ms, f, rx, sy, 0.24, sd + 0.01, z + 0.3, 0.09, lod=2)
        tiled_pavilion(ms, f, sx * (w / 2 - 0.1), by, z + 0.34, 0.15, 0.14, roof=0.11)
        kf = f @ Matrix.Rotation(math.radians(sx * 90), 4, 'Z')
        for yy in (sy - sd * 0.25, sy + sd * 0.25, by):
            pointed(ms, kf, 'ink_jali', sx * yy, -(w / 2) - 0.003, z + 0.08, 0.03, 0.15, lod=0)
    ms.box('ink_earth_square', (w - 0.5, sd, 0.006), at=(0, sy, z), lod=0, frame=f)
    ms.box('ink_sandstone', (0.16, 0.12, 0.03), at=(0.08, sy, z), lod=0, frame=f)
    ms.box('water', (0.13, 0.09, 0.004), at=(0.08, sy, z + 0.029), lod=0, frame=f)
    p = f @ Vector((-0.12, sy, 0))
    tk.tree(ms, p.x, p.y, h=0.42, r=0.085, lod2=False)
    tt.pennant(ms, f, 0, ty, 1.14, w=0.14, h=0.08)
    for sx in (-1, 1):
        for k in range(2):
            potted(ms, f, sx * (0.24 + 0.2 * k), -d / 2 - 0.05, 1.0, z=G)
    return f


def palace(ms, rng):
    """`palace` (sheet: a 56 m walled palace, 8 m walls, 24 m to the dome): a sandstone enclosure
    with corner towers under tiled roofs and chhatris, two-storey ranges round a court whose upper
    floors open in pointed arcades under tiled hip roofs, a gate block in the middle of the front
    with a cusped portal up steps between team banners, a great hall at the back with an open
    domed pavilion over it, a court with a pool and a small domed pavilion in it, potted trees.
    Built at 13 x 13 m to fit the capital's free centre."""
    f = tm.house_frame(0, 0, 0)
    W, D = 1.3, 1.3
    ms.box('ink_granite', (W + 0.04, D + 0.04, 0.05), at=(0, 0, G), lod=1, frame=f)
    z = G + 0.05
    rd = 0.26
    h0, h1 = 0.32, 0.28
    H = h0 + h1
    # the four ranges
    rngs = [(0, -D / 2 + rd / 2, W, rd), (0, D / 2 - rd / 2, W, rd), (-W / 2 + rd / 2, 0, rd, D - 2 * rd), (W / 2 - rd / 2, 0, rd, D - 2 * rd)]
    for k, (bx, by, bw_, bd_) in enumerate(rngs):
        hh = H + (0.06 if k == 1 else 0.0)
        ms.box('ink_sandstone', (bw_, bd_, hh), at=(bx, by, z), lod=2, frame=f)
        tile_hip(ms, f, bx, by, bw_ - (0.0 if k < 2 else 0.0), bd_, z + hh, 0.16, over=0.03, lod=2)
    ms.box('ink_carved', (W + 0.012, D + 0.012, 0.022), at=(0, 0, z + h0 - 0.011), lod=0, frame=f)
    # pointed arcades on the outer faces (upper floor) and windows below
    for kf, half, span in faces4(f, W, D):
        n = 7
        for i in range(n):
            cx = -span / 2 + 0.16 + (span - 0.32) * i / (n - 1)
            if kf is not None and abs(cx) < 0.22 and half == D / 2 and kf == f:
                continue
            pointed(ms, kf, 'dark', cx, -half - 0.003, z + h0 + 0.05, 0.035, 0.17)
            pointed(ms, kf, 'ink_jali', cx, -half - 0.003, z + 0.08, 0.025, 0.13)
    # arcades on the court faces
    for kf, half, span in faces4(f, W - 2 * rd, D - 2 * rd):
        for i in range(4):
            cx = -span / 2 + span * (i + 0.5) / 4
            pointed(ms, kf @ Matrix.Rotation(math.pi, 4, 'Z'), 'dark', cx, -half + 0.003 - 0.0, z, 0.04, 0.22)
    # the corner towers
    for sx in (-1, 1):
        for sy in (-1, 1):
            tx, ty = sx * (W / 2 - 0.1), sy * (D / 2 - 0.1)
            th = H + 0.3
            ms.box('ink_sandstone', (0.24, 0.24, th), at=(tx, ty, z), lod=2, frame=f, bevel=0.003)
            ms.box('ink_carved', (0.26, 0.26, 0.025), at=(tx, ty, z + th - 0.025), lod=0, frame=f)
            for kf, half, span in faces4(f @ Matrix.Translation(Vector((tx, ty, 0))), 0.24, 0.24):
                pointed(ms, kf, 'dark', 0, -half - 0.003, z + H + 0.08, 0.03, 0.14)
            tiled_pavilion(ms, f, tx, ty, z + th, 0.22, 0.15, roof=0.14, lod=1)
            tk.box_only(ms, 2, 'ink_tile', (0.3, 0.3, 0.26), at=(tx, ty, z + th), frame=f, taper=0.15)
    # the gate block
    gw, gd = 0.4, rd + 0.1
    gy = -D / 2 + rd / 2 - 0.05
    gh = H + 0.12
    ms.box('ink_sandstone', (gw, gd, gh), at=(0, gy, z), lod=2, frame=f, bevel=0.003)
    ms.box('ink_carved', (gw + 0.02, gd + 0.02, 0.03), at=(0, gy, z + gh), lod=0, frame=f)
    balustrade(ms, f, 0, gy, gw - 0.02, gd - 0.02, z + gh + 0.03)
    pointed(ms, f, 'ink_carved', 0, gy - gd / 2 - 0.003, z, 0.12, h0 + 0.2, lod=0)
    pointed(ms, f, 'dark', 0, gy - gd / 2 - 0.005, z, 0.08, h0 + 0.1, lod=1)
    pointed(ms, f, 'door', 0, gy - gd / 2 - 0.007, z, 0.06, 0.26, lod=0)
    for sx in (-1, 1):
        chhatri(ms, f, sx * (gw / 2 - 0.06), gy - 0.05, z + gh + 0.03, 0.045, lod=1)
    steps(ms, f, 0, gy - gd / 2, 0.36, 4, run=0.035, z=z)
    for sx in (-1, 1):
        for bx in (0.3, 0.48):
            tk.banner_pointed(ms, f, sx * bx, -D / 2, z + H - 0.03, w=0.07, h=0.26)
        potted(ms, f, sx * 0.24, -D / 2 - 0.1, 1.3)
    # the great hall's domed pavilion at the back
    hy = D / 2 - rd / 2
    pz_ = z + H + 0.06
    ms.box('ink_sandstone', (0.44, 0.3, 0.06), at=(0, hy, pz_ + 0.12), lod=2, frame=f)
    ms.box('ink_sandstone', (0.4, 0.26, 0.14), at=(0, hy, pz_), lod=2, frame=f)
    pv = pz_ + 0.18
    ph_ = 0.26
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('ink_sandstone', (0.035, 0.035, ph_), at=(sx * 0.16, hy + sy * 0.1, pv), lod=0, frame=f)
    for sx in (-1, 0, 1):
        if sx:
            ms.box('ink_sandstone', (0.035, 0.035, ph_), at=(sx * 0.16, hy, pv), lod=0, frame=f)
    tk.box_only(ms, (1, 2), 'ink_sandstone', (0.32, 0.2, ph_), at=(0, hy, pv), frame=f)
    ms.box('ink_sandstone', (0.4, 0.28, 0.04), at=(0, hy, pv + ph_), lod=1, frame=f)
    onion_dome(ms, f, 0, hy, pv + ph_ + 0.04, 0.17, lod=1, segs=14)
    tk.box_only(ms, 2, 'ink_dome', (0.26, 0.26, 0.18), at=(0, hy, pv + ph_ + 0.04), frame=f, taper=0.3)
    for sx in (-1, 1):
        chhatri(ms, f, sx * 0.3, hy, pz_ + 0.12, 0.05, lod=1)
    # the court: paving, the pool and its domed pavilion
    ms.box('ink_earth_square', (W - 2 * rd, D - 2 * rd, 0.006), at=(0, 0, z), lod=0, frame=f)
    ms.box('ink_sandstone', (0.44, 0.44, 0.03), at=(0, 0, z), lod=1, frame=f)
    ms.box('water', (0.4, 0.4, 0.004), at=(0, 0, z + 0.029), lod=0, frame=f)
    chhatri(ms, f, 0, 0, z + 0.03, 0.075, lod=1)
    for sx in (-1, 1):
        for sy in (-1, 1):
            potted(ms, f, sx * 0.3, sy * 0.3, 1.2, z=z)
    return f


def bastion(ms, f, r, h, mat='ink_wallstone', crown=True, chh=False, lod=2):
    """A round battered bastion: a sloping foot, a red sandstone band, a corbelled crown with pointed
    merlons, slits, a chhatri on top (LOD1 coarser, LOD2 one 6-sided drum)."""
    for lv, segs in ((0, 14), (1, 9)):
        if lv > lod:
            continue
        ms.cyl(mat, r * 1.12, r, h * 0.35, at=(0, 0, 0), segs=segs, lod=lv, only=lv, frame=f, caps=False)
        ms.cyl(mat, r, r, h * 0.65, at=(0, 0, h * 0.35), segs=segs, lod=lv, only=lv, frame=f, caps=False)
        ms.cyl(mat, r * 1.08, r * 1.08, 0.05, at=(0, 0, h - 0.05), segs=segs, lod=lv, only=lv, frame=f)
    if lod >= 2:
        ms.cyl(mat, r * 1.08, r * 1.02, h, at=(0, 0, 0), segs=6, lod=2, only=2, frame=f, caps=False)
        ms.cyl(mat, r * 1.02, r * 1.02, 0.0, at=(0, 0, h), segs=6, lod=2, only=2, frame=f)
    ms.cyl('ink_redstone', r * 1.03, r * 1.03, 0.03, at=(0, 0, h * 0.35), segs=14, lod=0, frame=f, caps=False)
    ms.cyl('stone', r * 0.98, r * 0.98, 0.006, at=(0, 0, h), segs=14, lod=0, frame=f)
    if crown:
        n = 16
        for k in range(n):
            a = 2 * math.pi * (k + 0.5) / n
            ms.box(mat, (0.06, 0.035, 0.07), at=(r * 1.04 * math.cos(a), r * 1.04 * math.sin(a), h), rot_z=math.degrees(a) + 90, lod=0, frame=f, taper=0.4)
    for k in range(3):
        a = math.radians(-90 + (k - 1) * 50)
        ms.box('dark', (0.024, 0.01, 0.07), at=(r * 1.0 * math.cos(a), r * 1.0 * math.sin(a), h * 0.62), rot_z=math.degrees(a) + 90, lod=0, frame=f)
    if chh:
        chhatri(ms, f, 0, 0, h, 0.06, lod=1 if lod >= 1 else 0)


def walls_medium(ms, rng):
    """`walls-medium` (sheet: 52 m long, 12 m to the bastions' chhatris): a weathered sandstone
    curtain with red sandstone bands, pointed merlons and a wall-walk, slits and pilaster strips,
    seven round battered bastions with corbelled crowns, chhatris on three of them, and a gate of a
    red sandstone portal round a pointed arch with iron-banded hardwood doors between two slim
    towers topped by chhatris, team banners either side. Built as a ring of 68 m (the brief's
    medium wall) with the gate at the south."""
    RAISE = tb.WALL_RAISE
    R_out, R_in = 3.22, 3.0
    H = 0.6 * RAISE
    gate_x = 0.26
    tr, th = 0.34, 0.8 * RAISE
    towers = (95, 45, 0, -40, 220, 180, 135)
    chh_at = (95, 0, 180)
    Rm = (R_out + R_in) / 2
    gtw = 0.16
    half = math.degrees(math.asin((gate_x + gtw) / Rm))
    a0, a1 = -90 + half, 270 - half
    for lod in (0, 1, 2):
        stp = (128, 44, 16)[lod]
        if lod < 2:
            tb.sweep(ms, 'ink_wallstone', [(R_out + 0.04, 0.0), (R_out, 0.14)], a0, a1, stp, lod=lod, only=lod)
            tb.sweep(ms, 'ink_wallstone', [(R_out, 0.14), (R_out, H)], a0, a1, stp, lod=lod, only=lod)
        else:
            tb.sweep(ms, 'ink_wallstone', [(R_out, 0.0), (R_out, H)], a0, a1, stp, lod=lod, only=lod)
        tb.sweep(ms, 'stone', [(R_out, H), (R_in, H)], a0, a1, stp, lod=lod, only=lod)
        tb.sweep(ms, 'ink_wallstone', [(R_in, H), (R_in, 0.0)], a0, a1, stp, lod=lod, only=lod)
        if lod < 2:
            ph = 0.03 if lod == 0 else 0.08
            tb.sweep(ms, 'ink_wallstone', [(R_out, H), (R_out, H + ph), (R_out - 0.04, H + ph), (R_out - 0.04, H)], a0, a1, stp, lod=lod, only=lod)
    tb.sweep(ms, 'ink_redstone', [(R_out + 0.006, 0.14), (R_out + 0.006, 0.17)], a0, a1, 64, lod=0)
    tb.sweep(ms, 'ink_redstone', [(R_out + 0.006, H - 0.06), (R_out + 0.006, H - 0.03)], a0, a1, 64, lod=0)
    # the footing: sandy earth either side
    tb.sweep(ms, 'ink_earth_fringe', [(R_out + 0.2, 0.0), (R_out, G + 0.004)], 0, 360, 56, lod=1)
    tb.sweep(ms, 'ink_earth', [(R_in, G * 0.6), (R_in - 0.35, G * 0.5)], 0, 360, 56, lod=1)
    tb.sweep(ms, 'ink_earth_fringe', [(R_in - 0.35, G * 0.5), (R_in - 0.49, G * 0.3)], 0, 360, 56, lod=1)
    t_half = [(a, math.degrees(math.asin(tr * 1.1 / R_out))) for a in towers]
    n = int(math.radians(a1 - a0) * R_out / 0.11)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        if any(abs((a - c + 180) % 360 - 180) < hw for c, hw in t_half):
            continue
        ms.box('ink_wallstone', (0.06, 0.035, 0.07), at=(0, 0.02, 0), lod=0, frame=tb.ring_frame(R_out, a, H + 0.03), taper=0.4)
    for i in range(18):
        a = a0 + (a1 - a0) * (i + 0.5) / 18
        if any(abs((a - c + 180) % 360 - 180) < hw * 1.5 for c, hw in t_half):
            continue
        rf = tb.ring_frame(R_out, a)
        ms.box('dark', (0.022, 0.01, 0.07), at=(0, -0.004, H * 0.6), lod=0, frame=rf)
        ms.box('ink_wallstone', (0.04, 0.03, H - 0.2), at=(0.25, -0.01, 0.17), lod=0, frame=rf)  # pilaster strips
    for a in towers:
        rf = tb.ring_frame(Rm + 0.06, a)
        bastion(ms, rf, tr, th, chh=a in chh_at)
    # the gate
    gy = -Rm
    gd = R_out - R_in + 0.12
    gh = H + 0.12
    gw = 2 * gate_x
    gf = tm.house_frame(0, gy, 0)
    ms.box('ink_wallstone', (gw, gd, gh), at=(0, 0, 0), lod=2, frame=gf)
    ms.box('ink_redstone', (gw + 0.01, gd + 0.01, 0.03), at=(0, 0, gh - 0.06), lod=0, frame=gf)
    ms.box('ink_redstone', (gw * 0.86, 0.03, gh * 0.92), at=(0, -gd / 2 - 0.01, 0), lod=1, frame=gf)
    pointed(ms, gf, 'ink_carved', 0, -gd / 2 - 0.028, 0, 0.17, H * 0.8, lod=0)
    pointed(ms, gf, 'door', 0, -gd / 2 - 0.03, 0, 0.13, H * 0.7, lod=1)
    for i in range(4):
        ms.box('kg_iron', (0.24, 0.006, 0.012), at=(0, -gd / 2 - 0.033, H * (0.12 + 0.14 * i)), lod=0, frame=gf)
    pointed(ms, gf @ Matrix.Rotation(math.pi, 4, 'Z'), 'dark', 0, -gd / 2 - 0.003, 0, 0.13, H * 0.7, lod=1)
    for k in range(int(gw / 0.07)):
        ms.box('ink_wallstone', (0.04, 0.03, 0.06), at=(-gw / 2 + 0.035 + 0.07 * k, -gd / 2 + 0.015, gh), lod=0, frame=gf, taper=0.4)
    for sx in (-1, 1):
        tx = sx * (gate_x + gtw / 2)
        tf = tm.house_frame(tx, gy - 0.02, 0)
        tht = th + 0.05
        ms.box('ink_wallstone', (gtw, gtw, tht), at=(0, 0, 0), lod=2, frame=tf)
        ms.box('ink_redstone', (gtw + 0.01, gtw + 0.01, 0.03), at=(0, 0, tht * 0.55), lod=0, frame=tf)
        ms.box('ink_carved', (gtw + 0.03, gtw + 0.03, 0.03), at=(0, 0, tht - 0.03), lod=0, frame=tf)
        chhatri(ms, tf, 0, 0, tht, 0.075, lod=1)
        tk.banner_pointed(ms, tf, 0, -gtw / 2, tht * 0.78, w=0.11, h=tht * 0.45)
    # a stair up the inner face
    k = 9
    da = math.degrees(0.075 / R_in)
    for i in range(k):
        a = 160 + i * da
        ms.box('ink_wallstone', (0.078, 0.11, H * (i + 1) / k), at=(0, 0.055, 0.0), lod=0, frame=tb.ring_frame(R_in, a))


# ---- building a town on a base Kingdoms layout ----------------------------------------------------
# The town scripts take the base town's calls as recorded in build_town_kingdoms_europe_<size>_<v>.py
# (positions, sizes, yaws as build_town_kingdoms_<size>_<v>.py drew them); `replay` swaps each for
# this kit's piece.

SIZES = {'small': dict(gopuram=0.5, tomb=0.78), 'medium': dict(gopuram=0.62, tomb=0.9), 'big': dict(gopuram=0.76, tomb=1.0)}
HOUSES = ('tudor_house', 'town_house', 'court_house', 'flat_house', 'house')
VEG = ('tree', 'palm', 'broadleaf', 'conifer', 'cypress', 'shrub', 'clutter', 'woodpile', 'garden', 'market_stall', 'jar', 'well',
       'fountain', 'wattle_fence', 'stone_wall', 'pergola')
REC = []  # (call index, name, first part, last part) of the last replay


def house_kind(name, w, d, kw):
    area = w * d
    if name == 'court_house' or area >= 0.6:
        return 'rich'
    if area < 0.3 or (name in ('tudor_house',) and kw.get('roof') == 'thatch'):
        return 'poor'
    return 'common'


def _rect(cx, cy, hx, hy, yaw):
    c, s = abs(math.cos(math.radians(yaw))), abs(math.sin(math.radians(yaw)))
    ex, ey = hx * c + hy * s, hx * s + hy * c
    return (cx - ex, cy - ey, cx + ex, cy + ey)


def landmark_rect(kind, x, y, s, yaw):
    if kind == 'gopuram':
        return _rect(x, y, (1.8 * s + 0.56 * s) / 2 + 0.05, 1.1 * s / 2 + 0.08, yaw)
    w = 1.36 * s
    return _rect(x, y - 0.1 * s, w / 2 + 0.05, w / 2 + 0.2 * s, yaw)


def _inside(px, py, r, m=0.04):
    return r[0] - m < px < r[2] + m and r[1] - m < py < r[3] + m


def _overlap(a, b):
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


def replay(ms, rng, calls, size, override=None):
    """Build the base layout's calls with this kit. `override` maps a call's index to 'gopuram',
    'tomb', 'skip', a house kind, or (kind, dict) with x, y, s, yaw to move or size a landmark.
    Base pieces that a (bigger) landmark covers are left out."""
    override = override or {}
    del REC[:]
    lms = []
    for i, ov in override.items():
        kind, opt = (ov, {}) if isinstance(ov, str) else ov
        if kind not in ('gopuram', 'tomb'):
            continue
        name, args, kw = calls[i]
        o = dict(x=args[0], y=args[1], s=SIZES[size][kind], yaw=0)
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
        if kind in ('gopuram', 'tomb'):
            o = next(o for j, _k, o, _r in lms if j == i)
            (gopuram if kind == 'gopuram' else tomb)(ms, rng, o['x'], o['y'], s=o['s'], yaw=o['yaw'])
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
            market_hall(ms, rng, x, y, w * 0.85, d * 0.7, yaw=kw.get('yaw'))
        elif name in ('round_tower', 'stone_tower'):
            r = args[2] * 1.1 if name == 'round_tower' else 0.3
            bastion(ms, tm.house_frame(args[0], args[1], 0), r, 0.9 if name == 'round_tower' else 1.1, chh=True)
        elif name == 'market_stall':
            tk.market_stall(ms, rng, *args, **kw)
        elif name in ('street', 'paved_strip'):
            if name == 'street':
                tk.street(ms, args[0], args[1], mat='ink_earth_square')
            else:
                x0, y0, x1, y1, w = args
                tk.street(ms, [(x0, y0), (x1, y1)], w, mat='ink_earth_square')
        elif name == 'garden':
            tk.garden(ms, rng, *args, **kw)
        elif name == 'wattle_fence':
            for (x0, y0), (x1, y1) in zip(args[0], args[0][1:]):
                tk.stone_wall(ms, x0, y0, x1, y1, h=0.12, t=0.035, mat='ink_lime')
        elif name == 'stone_wall':
            kw = dict(kw)
            kw['mat'] = 'ink_lime'
            tk.stone_wall(ms, *args, **kw)
        elif name in ('tree', 'broadleaf', 'palm'):
            tree_n += 1
            if name == 'palm' or tree_n % 3 != 0:
                tk.palm(ms, rng, args[0], args[1], h=kw.get('h', 0.45) * 1.05, fronds=7)
            else:
                tk.tree(ms, args[0], args[1], h=kw.get('h', 0.4) * 0.95, r=kw.get('r', 0.13) * 1.0, lod2=False)
        elif name in ('conifer', 'cypress'):
            tk.palm(ms, rng, args[0], args[1], h=kw.get('h', 0.45), fronds=7)
        elif name == 'shrub':
            tc.shrub(ms, args[0], args[1], r=kw.get('r', 0.07), lod=0)
        elif name == 'well':
            stepwell_well(ms, args[0], args[1])
        elif name == 'fountain':
            ms.box('ink_sandstone', (0.2, 0.2, 0.025), at=(args[0], args[1], G), lod=1)
            ms.box('water', (0.17, 0.17, 0.004), at=(args[0], args[1], G + 0.024), lod=0)
        elif name == 'clutter':
            clutter(ms, world, args[0], args[1], rng, int(args[2]) if len(args) > 2 else 4)
        elif name == 'woodpile':
            thatch_shed(ms, tm.house_frame(args[0], args[1], args[2] if len(args) > 2 else 0), 0, 0, 0.22, 0.16)
            for k in range(3):
                jar(ms, world, args[0] - 0.06 + 0.06 * k, args[1] - 0.12, 1.0)
        elif name == 'jar':
            jar(ms, world, args[0], args[1], 1.0)
        REC.append((i, name, start, len(ms.parts)))


def stepwell_well(ms, x, y):
    """A round well of sandstone with a timber pulley frame."""
    f = tm.house_frame(x, y, 0)
    ms.cyl('ink_sandstone', 0.07, 0.07, 0.07, at=(0, 0, G), segs=10, lod=1, frame=f)
    ms.cyl('water', 0.055, 0.055, 0.004, at=(0, 0, G + 0.068), segs=10, lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('timber', (0.014, 0.014, 0.16), at=(sx * 0.06, 0, G), lod=0, frame=f)
    ms.box('timber', (0.14, 0.012, 0.012), at=(0, 0, G + 0.16), lod=0, frame=f)
    jar(ms, f, 0.1, -0.04, 0.9)


def market_hall(ms, rng, x, y, w, d, yaw=None):
    """A pillared market hall (mandapa): sandstone pillars on a plinth under a tiled hip roof, stalls
    and jars under it."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='hall')
    h = STOREY * 0.85
    ms.box('ink_sandstone', (w, d, 0.04), at=(0, 0, G), lod=1, frame=f)
    nx, ny = max(3, round(w / 0.2)), max(2, round(d / 0.22))
    for i in range(nx):
        for j in range(ny):
            if 0 < i < nx - 1 and 0 < j < ny - 1:
                continue
            px, py = -w / 2 + 0.03 + (w - 0.06) * i / (nx - 1), -d / 2 + 0.03 + (d - 0.06) * j / (ny - 1)
            ms.box('ink_sandstone', (0.03, 0.03, h), at=(px, py, G + 0.04), lod=1, frame=f)
            ms.box('ink_carved', (0.045, 0.045, 0.02), at=(px, py, G + 0.04 + h - 0.02), lod=0, frame=f)
    ms.box('ink_sandstone', (w + 0.02, d + 0.02, 0.03), at=(0, 0, G + 0.04 + h), lod=1, frame=f)
    tile_hip(ms, f, 0, 0, w + 0.02, d + 0.02, G + 0.07 + h, 0.16, over=0.05)
    for k in range(4):
        jar(ms, f, -w / 4 + 0.06 * k, 0.05, 1.0)
    cloth_shade(ms, f, w * 0.15, -d / 2 - 0.1, 0.24, 0.14, G + 0.2)
    tk.lod2_block(ms, f, w, d, h + 0.1, rise=0.14, mat='ink_tile')
    return f


def main(file_name, obj_name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(EARTHY)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
