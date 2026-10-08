# scripts/blender/ti_modern_battle.py
# Battle pieces of the Modern age (Wave 6), shared by build_rts_modern.py, build_city_modern.py, the
# Modern props and the map fort: olive vehicle paint, tyres and a camouflage net (new `md_` materials,
# registered like ti_modern.py's), sandbag walls and rings, parked vehicles (truck, jeep, tank,
# howitzer, jet) as static scenery, a lattice radio mast, a radar dish, a Nissen hangar, a gun pit, a
# camouflage net on poles, fuel tanks and drums. Scale as the town kits: 1 unit = 10 m, Z up, the front
# (-Y). Everything takes the Mesher (`ms`) and an optional `frame`.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402  (imports bpy first)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_modern as tmd  # noqa: E402
from ti_town import G  # noqa: E402

NEW = ['md_olive', 'md_olive_dark', 'md_tyre', 'md_camo', 'md_tarmac_line']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    s = tm.mat_simple
    s('md_olive', ['#59603f', '#646b48', '#4f5638', '#6b7050'], scale=14.0, bump=0.15, dirt=True)
    s('md_olive_dark', ['#40452f', '#4a5036', '#383d29'], scale=16.0, bump=0.3)
    s('md_tyre', ['#232426', '#2c2d30'], scale=30.0, rough=0.95, bump=0.3)
    s('md_camo', ['#4b5634', '#5e6a3c', '#76704a', '#3f4a2c'], scale=26.0, bump=0.8)
    s('md_tarmac_line', ['#d8c25a', '#e4d070'], scale=30.0, bump=0.0)


if not any(n == 'modern-battle' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('modern-battle', make_materials))

rod = tmd.rod


def F(x, y, yaw=0.0, frame=None):
    f = tm.house_frame(x, y, yaw)
    return frame @ f if frame is not None else f


# ---- sandbags ------------------------------------------------------------------------------------

def sandbag_wall(ms, x0, y0, x1, y1, h=0.06, t=0.06, lod=1, frame=None, z=G):
    """A sandbag wall: two courses of bags as a long low block with a rounded top course (LOD0)."""
    length = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    f = F((x0 + x1) / 2, (y0 + y1) / 2, yaw, frame)
    ms.box('md_sandbag', (length, t, h * 0.6), at=(0, 0, z), lod=lod, frame=f, bevel=0.006)
    n = max(1, int(length / 0.07))
    for k in range(n):
        ms.box('md_sandbag', (length / n - 0.006, t * 0.85, h * 0.42), at=(-length / 2 + (k + 0.5) * length / n, 0, z + h * 0.58), lod=0, frame=f, bevel=0.008)


def sandbag_ring(ms, x, y, r, h=0.07, gap=60.0, gap_at=90.0, n=10, lod=1, frame=None):
    """A ring of sandbag walls round (x, y), open over `gap` degrees centred on `gap_at` (90: the back)."""
    a0 = gap_at + gap / 2
    span = 360.0 - gap
    pts = [(x + r * math.cos(math.radians(a0 + span * k / n)), y + r * math.sin(math.radians(a0 + span * k / n))) for k in range(n + 1)]
    for (px, py), (qx, qy) in zip(pts, pts[1:]):
        sandbag_wall(ms, px, py, qx, qy, h=h, lod=lod, frame=frame)


# ---- vehicles (static scenery) ---------------------------------------------------------------------

def wheels(ms, f, xs, ys, r, w=0.03, lod=1):
    for x in xs:
        for y in ys:
            ms.cyl('md_tyre', r, r, w, at=(x - w / 2, y, G + r), rot=(0, 90, 0), segs=8, lod=lod, frame=f)


def truck(ms, x, y, yaw=0.0, body='md_olive', canvas='md_olive_dark', s=1.0, lod=1, frame=None):
    """A six-wheeled army lorry (7 m): cab at the front (-Y), a canvas tilt over the bed."""
    f = F(x, y, yaw, frame) @ Matrix.Scale(s, 4)
    W, L = 0.24, 0.7
    r = 0.05
    wheels(ms, f, (-W / 2 + 0.01, W / 2 - 0.01), (-L / 2 + 0.1, L / 2 - 0.18, L / 2 - 0.07), r, lod=lod)
    ms.box(body, (W - 0.02, L - 0.04, 0.05), at=(0, 0, G + r), lod=lod, frame=f)
    ms.box(body, (W, 0.18, 0.16), at=(0, -L / 2 + 0.1, G + r + 0.03), lod=lod, frame=f, bevel=0.006)
    ms.box('md_glass', (W - 0.03, 0.008, 0.05), at=(0, -L / 2 + 0.008, G + r + 0.13), lod=0, frame=f)
    ms.box(canvas, (W, L - 0.22, 0.17), at=(0, 0.1, G + r + 0.05), lod=lod, frame=f, bevel=0.01)


def jeep(ms, x, y, yaw=0.0, body='md_olive', lod=1, frame=None):
    """A light four-wheel-drive car (4 m), open, a spare wheel at the back."""
    f = F(x, y, yaw, frame)
    r = 0.035
    wheels(ms, f, (-0.085, 0.085), (-0.13, 0.13), r, w=0.025, lod=lod)
    ms.box(body, (0.17, 0.38, 0.06), at=(0, 0, G + r), lod=lod, frame=f, bevel=0.006)
    ms.box(body, (0.16, 0.012, 0.05), at=(0, -0.04, G + r + 0.06), lod=0, frame=f)
    ms.cyl('md_tyre', 0.033, 0.033, 0.02, at=(0, 0.19, G + r + 0.04), rot=(-90, 0, 0), segs=8, lod=0, frame=f)


def tank(ms, x, y, yaw=0.0, body='md_olive', lod=1, frame=None, team=True):
    """A parked main battle tank (9 m with the gun): tracks, hull, turret, gun forward (-Y)."""
    f = F(x, y, yaw, frame)
    for sx in (-1, 1):
        ms.box('md_tyre', (0.09, 0.66, 0.09), at=(sx * 0.13, 0, G), lod=lod, frame=f, bevel=0.02)
    ms.box(body, (0.34, 0.66, 0.07), at=(0, 0, G + 0.06), lod=lod, frame=f, taper=0.95)
    ms.box(body, (0.24, 0.3, 0.07), at=(0, 0.05, G + 0.13), lod=lod, frame=f, taper=0.85, bevel=0.008)
    if team:
        ms.box('team_cloth', (0.245, 0.305, 0.02), at=(0, 0.05, G + 0.16), lod=0, frame=f)
    ms.cyl(body, 0.016, 0.014, 0.42, at=(0, -0.08, G + 0.165), rot=(90, 0, 0), segs=6, lod=lod, frame=f)


def howitzer(ms, x, y, yaw=0.0, body='md_olive', lod=1, frame=None, elev=25):
    """A towed howitzer in the firing position: two wheels, split trails spread, barrel raised (-Y)."""
    f = F(x, y, yaw, frame)
    for sx in (-1, 1):
        ms.cyl('md_tyre', 0.055, 0.055, 0.03, at=(sx * 0.1 - 0.015, 0, G + 0.055), rot=(0, 90, 0), segs=8, lod=lod, frame=f)
        tf = f @ Matrix.Translation(Vector((sx * 0.04, 0.05, G + 0.03))) @ Matrix.Rotation(math.radians(-sx * 22), 4, 'Z')
        ms.box(body, (0.03, 0.34, 0.03), at=(0, 0.17, 0), lod=lod, frame=tf)
    ms.box(body, (0.12, 0.12, 0.06), at=(0, 0, G + 0.06), lod=lod, frame=f)
    bf = f @ Matrix.Translation(Vector((0, 0.02, G + 0.11))) @ Matrix.Rotation(math.radians(elev), 4, 'X')
    ms.cyl(body, 0.02, 0.016, 0.5, at=(0, 0, 0), rot=(90, 0, 0), segs=6, lod=lod, frame=bf)
    ms.cyl('md_olive_dark', 0.024, 0.024, 0.04, at=(0, -0.48, 0), rot=(90, 0, 0), segs=6, lod=0, frame=bf)


def jet(ms, x, y, yaw=0.0, body='md_steel', lod=1, frame=None):
    """A parked fighter (16 m): fuselage along Y, swept wings, twin fins (team cloth)."""
    f = F(x, y, yaw, frame)
    ms.cyl(body, 0.06, 0.05, 1.3, at=(0, 0.62, G + 0.1), rot=(90, 0, 0), segs=8, lod=lod, frame=f)
    ms.cyl(body, 0.06, 0.0, 0.32, at=(0, -0.68, G + 0.1), rot=(90, 0, 0), segs=8, lod=lod, frame=f)
    ms.sphere('md_glass', 0.05, at=(0, -0.42, G + 0.15), scale=(0.8, 2.0, 0.8), u=8, v=5, lod=0, frame=f)
    for sx in (-1, 1):
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((sx * 0.05, -0.15, G + 0.1), (sx * 0.55, 0.38, G + 0.1), (sx * 0.55, 0.5, G + 0.1), (sx * 0.05, 0.52, G + 0.1))]
        bm.faces.new(vs if sx > 0 else list(reversed(vs)))
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.015)
        ms.add(bm, body, lod, matrix=f)
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((sx * 0.06, 0.42, G + 0.15), (sx * 0.06, 0.62, G + 0.15), (sx * 0.1, 0.66, G + 0.36), (sx * 0.1, 0.56, G + 0.36))]
        bm.faces.new(vs)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.012)
        ms.add(bm, 'team_cloth', lod, matrix=f)
    for sy in (-0.4, 0.3):  # the landing gear down
        ms.box('md_tyre', (0.03, 0.04, 0.05), at=(0, sy, G), lod=0, frame=f)


# ---- structures --------------------------------------------------------------------------------------

def lattice_mast(ms, x, y, h=1.2, w=0.08, lod=1, frame=None):
    """A triangular steel lattice radio mast with braces every 0.2 and a light on top."""
    f = F(x, y, 0, frame)
    pts = [(w * math.cos(math.radians(90 + 120 * k)), w * math.sin(math.radians(90 + 120 * k))) for k in range(3)]
    for px, py in pts:
        p0 = f @ Vector((px, py, G)); p1 = f @ Vector((px * 0.4, py * 0.4, G + h))
        rod(ms, 'md_steel', tuple(p0), tuple(p1), 0.007, segs=4, lod=lod)
    n = int(h / 0.2)
    for k in range(1, n):
        t = k / n
        z = G + h * t
        sc = 1 - 0.6 * t
        for i in range(3):
            a, b = pts[i], pts[(i + 1) % 3]
            p0 = f @ Vector((a[0] * sc, a[1] * sc, z)); p1 = f @ Vector((b[0] * sc, b[1] * sc, z))
            rod(ms, 'md_steel', tuple(p0), tuple(p1), 0.004, segs=3, lod=0)
    ms.box('team_cloth', (0.02, 0.02, 0.03), at=(0, 0, G + h), lod=0, frame=f)


def radar(ms, x, y, z=G, h=0.4, r=0.13, lod=1, frame=None):
    """A radar: a steel post on a box base and a tilted dish facing -Y."""
    f = F(x, y, 0, frame)
    ms.box('md_steel', (0.12, 0.12, 0.08), at=(0, 0, z), lod=lod, frame=f)
    ms.cyl('md_steel', 0.02, 0.02, h, at=(0, 0, z + 0.08), segs=6, lod=lod, frame=f)
    df = f @ Matrix.Translation(Vector((0, 0, z + 0.08 + h))) @ Matrix.Rotation(math.radians(-70), 4, 'X')
    ms.cyl('md_jerry', r, r * 0.25, r * 0.4, at=(0, 0, 0), segs=12, lod=lod, frame=df, caps=True)
    ms.cyl('md_steel', 0.008, 0.008, r * 0.9, at=(0, 0, 0), segs=4, lod=0, frame=df)


def nissen(ms, x, y, span=0.5, length=1.0, yaw=0.0, n=8, lod=2, door=True, frame=None, mat='md_corrugated'):
    """A Nissen hangar: a half-round corrugated shell along local Y (open bay or doors at -Y), end walls."""
    f = F(x, y, yaw, frame)
    r = span / 2
    arc = [(r * math.cos(math.pi * k / n), G + r * math.sin(math.pi * k / n)) for k in range(n + 1)]
    for (x0, z0), (x1, z1) in zip(arc, arc[1:]):
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((x0, -length / 2, z0), (x1, -length / 2, z1), (x1, length / 2, z1), (x0, length / 2, z0))]
        bm.faces.new(vs)
        bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.01)
        ms.add(bm, mat, lod, matrix=f)
    for sy, is_front in ((-1, True), (1, False)):
        bm = bmesh.new()
        vs = [bm.verts.new((px, sy * length / 2, pz)) for px, pz in arc]
        face = bm.faces.new(vs if sy > 0 else list(reversed(vs)))
        bmesh.ops.solidify(bm, geom=[face], thickness=0.01)
        ms.add(bm, 'md_prefab', lod, matrix=f)
        if is_front and door:
            ms.box('dark', (span * 0.55, 0.012, r * 0.75), at=(0, -length / 2 - 0.006, G), lod=1, frame=f)
    return f


def camo_net(ms, x, y, w, d, h=0.18, yaw=0.0, lod=1, frame=None, n=4):
    """A camouflage net on four poles, sagging between them."""
    f = F(x, y, yaw, frame)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('md_wood', 0.006, 0.006, h, at=(sx * w / 2, sy * d / 2, G), segs=4, lod=0, frame=f)
    bm = bmesh.new()
    grid = {}
    for i in range(n + 1):
        for j in range(n + 1):
            u_, v_ = i / n, j / n
            sag = 0.05 * math.sin(math.pi * u_) * math.sin(math.pi * v_)
            grid[i, j] = bm.verts.new((-w / 2 + w * u_, -d / 2 + d * v_, G + h - sag))
    for i in range(n):
        for j in range(n):
            bm.faces.new((grid[i, j], grid[i + 1, j], grid[i + 1, j + 1], grid[i, j + 1]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.008)
    ms.add(bm, 'md_camo', lod, matrix=f)


def gun_pit(ms, x, y, r=0.2, gun='aa', lod=1, frame=None):
    """A sandbagged gun pit open at the back with a twin AA gun or a field gun inside."""
    sandbag_ring(ms, x, y, r, h=0.07, gap=50, n=9, lod=lod, frame=frame)
    f = F(x, y, 0, frame)
    if gun == 'aa':
        ms.cyl('md_olive', 0.07, 0.06, 0.06, at=(0, 0, G), segs=8, lod=lod, frame=f)
        for sx in (-1, 1):
            bf = f @ Matrix.Translation(Vector((sx * 0.03, 0, G + 0.08))) @ Matrix.Rotation(math.radians(45), 4, 'X')
            ms.cyl('md_olive_dark', 0.008, 0.007, 0.26, at=(0, 0, 0), rot=(90, 0, 0), segs=5, lod=lod, frame=bf)
    else:
        howitzer(ms, x, y, 0, lod=lod, frame=frame, elev=12)


def fuel_tank(ms, x, y, yaw=0.0, r=0.08, length=0.4, lod=1, frame=None):
    f = F(x, y, yaw, frame)
    ms.cyl('md_jerry', r, r, length, at=(-length / 2, 0, G + r + 0.03), rot=(0, 90, 0), segs=10, lod=lod, frame=f)
    for sx in (-0.12, 0.12):
        ms.box('md_concrete', (0.04, r * 1.6, 0.04), at=(sx * length * 2, 0, G), lod=0, frame=f)


def drums(ms, x, y, n=4, frame=None, mat='md_olive'):
    f = F(x, y, 0, frame)
    for k in range(n):
        ms.cyl(mat, 0.022, 0.022, 0.06, at=((k % 2) * 0.05 - 0.025, (k // 2) * 0.05 - 0.025, G), segs=8, lod=0 if k else 1, frame=f)


def crates(ms, x, y, n=3, frame=None, mat='md_olive'):
    f = F(x, y, 0, frame)
    for k in range(n):
        ms.box(mat, (0.07, 0.045, 0.04), at=((k % 2) * 0.075, 0, G + (k // 2) * 0.04), lod=0 if k else 1, frame=f, bevel=0.003)


def searchlight(ms, x, y, z=G, frame=None):
    f = F(x, y, 0, frame)
    ms.cyl('md_steel', 0.01, 0.01, 0.05, at=(0, 0, z), segs=5, lod=0, frame=f)
    ms.cyl('md_steel', 0.035, 0.035, 0.05, at=(0, 0.02, z + 0.07), rot=(90, 0, 0), segs=8, lod=0, frame=f)


def windsock(ms, x, y, h=0.35, frame=None):
    f = F(x, y, 0, frame)
    ms.cyl('md_steel', 0.006, 0.005, h, at=(0, 0, G), segs=4, lod=0, frame=f)
    ms.cyl('team_cloth', 0.025, 0.012, 0.12, at=(0, 0, G + h - 0.02), rot=(0, 90, 0), segs=6, lod=0, frame=f)
