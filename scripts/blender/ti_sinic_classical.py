# scripts/blender/ti_sinic_classical.py
# The Sinic kit for the Classical Age (Han; art spec 3b), from the sheets in
# plans/art/kits/sinic/classical/: houses.png (a 5 x 7 m cottage of cream plaster on a grey stone
# base with natural timber posts and a grey tiled gable; an 8 x 12 m courtyard house with red-brown
# posts, a grey brick dado and a hip roof ringed round a planted court; a 14 x 18 m walled
# residence with a gatehouse, a main hall, side halls and a paved court with trees), street.png and
# roofscape.png (walled compounds with grey-tiled copings, packed earth and stone lanes, canvas
# awnings, jars, racks and fences, round-crowned and blossoming trees), materials.png (grey brick,
# cream plaster, grey ceramic tile, red-brown lacquered timber, stone base, paving), the double-
# eave gate tower (landmark-1) and the Han que watchtower (landmark-2).
# Built beside ti_classical.py (its broadleaf and shrub are reused unchanged); the Han roofs here
# carry grey tile and grey ridges where ti_classical's are terracotta.
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `snc_` prefix.
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
from ti_town import G, STOREY  # noqa: E402

NEW = ['snc_plaster', 'snc_brick', 'snc_tile', 'snc_ridge', 'snc_lacquer', 'snc_stone', 'snc_blossom',
       'snc_paving', 'snc_paving_fringe', 'snc_paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'snc_paving': 'Ground', 'snc_paving_fringe': 'Ground', 'snc_paving_square': 'Ground'})
if 'snc_paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('snc_paving_fringe')

PAVING = (('#a8977a', '#9a8a6e', '#b5a588'), '#77684f', (0.05, 0.036))


def make_materials():
    # cream lime plaster (slightly cooler than the Roman cream)
    tm.mat_simple('snc_plaster', ['#ddd5c3', '#e8e1d1', '#d2c8b2', '#efe9dc'], scale=16.0, bump=0.2, dirt=True)
    # grey brick (dados, the gate tower and the que), fine courses
    tm.mat_mudwall('snc_brick', wash='#7a7b78', brick='#767774', brick2='#646562', mortar='#4e4f4c', wash_cover=0.0,
                   bond=(0.034, 0.012, 0.0018))
    # grey ceramic roof tile: courses down the slope, a dark grey ridge
    tm.mat_mudwall('snc_tile', wash='#45494d', brick='#484c50', brick2='#3b3f43', mortar='#232628', wash_cover=0.0,
                   bond=(0.012, 0.024, 0.0025))
    tm.mat_simple('snc_ridge', ['#2c2f32', '#36393c', '#25282a'], scale=30.0, bump=0.3)
    # red-brown lacquered timber (posts, beams, brackets)
    tm.mat_simple('snc_lacquer', ['#7c2f20', '#8e3a26', '#6c271a'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 2.0}, bump=0.2)
    # stone blocks: the plinths, steps, arch rings, the platform
    tm.mat_mudwall('snc_stone', wash='#a8a397', brick='#a7a195', brick2='#938e83', mortar='#6f6b63', wash_cover=0.0,
                   bond=(0.07, 0.035, 0.003))
    tm.mat_simple('snc_blossom', ['#b8606c', '#cf8f98', '#a8483f', '#c99aa0'], scale=50.0, bump=0.6)
    # the ground: tan stone slabs over packed earth; the square a grey stone
    for n in ('snc_paving', 'snc_paving_fringe'):
        tc.mat_paving(n, stone=PAVING[0], mortar=PAVING[1], slab=PAVING[2])
    tc.mat_paving('snc_paving_square', stone=('#a29f97', '#949189', '#afaca3'), mortar='#6c6a63', slab=(0.05, 0.05))


if not any(n == 'sinic_classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('sinic_classical', make_materials))

PAVED = dict(mat='snc_paving', power=8)


# ---- helpers ------------------------------------------------------------------------------------

def beam(ms, mat, p0, p1, w=0.012, h=0.012, lod=0, frame=None):
    """A box of section w x h from p0 to p1 (local points)."""
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    L = d.length
    rot = d.to_track_quat('X', 'Z').to_matrix().to_4x4()
    m = Matrix.Translation(p0) @ rot
    if frame is not None:
        m = frame @ m
    ms.box(mat, (L, w, h), at=(L / 2, 0, -h / 2), lod=lod, frame=m)


def hexa(ms, mat, pts, lod=2, frame=None):
    """A closed six-sided solid from 8 corners: bottom (-,-),(+,-),(+,+),(-,+) then the top four."""
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in pts]
    for q in ((0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new([v[i] for i in q])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=(frame.copy() if frame is not None else None))


def ring_solid(ms, f, loops, mat, lod=2, cx=0.0, cy=0.0):
    """A closed ring from loops [(half w, half d, z, corner curl)...]: 8 vertices per loop (the
    corners lifted by the curl, the side midpoints at z), each loop joined to the next and the last
    back to the first. Han eaves turn up at the corners this way."""
    bm = bmesh.new()
    vs = []
    for W, D, z, curl in loops:
        ring = []
        for sx, sy, c in ((-1, -1, 1), (0, -1, 0), (1, -1, 1), (1, 0, 0), (1, 1, 1), (0, 1, 0), (-1, 1, 1), (-1, 0, 0)):
            ring.append(bm.verts.new((cx + sx * W, cy + sy * D, z + c * curl)))
        vs.append(ring)
    for i in range(len(vs)):
        A, B = vs[i], vs[(i + 1) % len(vs)]
        for k in range(8):
            j = (k + 1) % 8
            bm.faces.new((A[k], A[j], B[j], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed ring: safe to orient
    ms.add(bm, mat, lod, matrix=f.copy())


def han_roof(ms, f, w, d, z0, rise, over=0.08, curl=0.045, lod=2, ornaments=True, cx=0.0, cy=0.0, horns=0.0,
             finial=False, only=None):
    """A grey-tiled hip roof (ridge along local X when w > d, a pyramid when square) with deep eaves
    whose corners turn up, a dark ridge, hip ridges and upturned ridge ends (`horns` sizes the
    ridge-end ornaments of the big roofs)."""
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - over * 0.3
    r = max(0.0, W - D)
    bm = bmesh.new()
    c = {(sx, sy): bm.verts.new((cx + sx * W, cy + sy * D, ze + curl)) for sx in (-1, 1) for sy in (-1, 1)}
    m = {sy: bm.verts.new((cx, cy + sy * D, ze)) for sy in (-1, 1)}
    s = {sx: bm.verts.new((cx + sx * W, cy, ze)) for sx in (-1, 1)}
    zt = z0 + rise
    if r > 0.001:
        R = {sx: bm.verts.new((cx + sx * r, cy, zt)) for sx in (-1, 1)}
        bm.faces.new((c[(-1, -1)], m[-1], c[(1, -1)], R[1], R[-1]))
        bm.faces.new((c[(1, 1)], m[1], c[(-1, 1)], R[-1], R[1]))
        bm.faces.new((c[(1, -1)], s[1], c[(1, 1)], R[1]))
        bm.faces.new((c[(-1, 1)], s[-1], c[(-1, -1)], R[-1]))
    else:
        top = bm.verts.new((cx, cy, zt))
        bm.faces.new((c[(-1, -1)], m[-1], c[(1, -1)], top))
        bm.faces.new((c[(1, 1)], m[1], c[(-1, 1)], top))
        bm.faces.new((c[(1, -1)], s[1], c[(1, 1)], top))
        bm.faces.new((c[(-1, 1)], s[-1], c[(-1, -1)], top))
    bm.faces.new((c[(-1, -1)], s[-1], c[(-1, 1)], m[1], c[(1, 1)], s[1], c[(1, -1)], m[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, 'snc_tile', lod, matrix=f.copy(), only=only)
    if only is not None:
        return
    rl = min(lod, 1)
    if r > 0.001:
        ms.box('snc_ridge', (2 * r + 0.03, 0.032, 0.026), at=(cx, cy, zt - 0.01), lod=rl, frame=f)
    if not ornaments:
        return
    # hip ridges from the upturned corners up to the ridge ends
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(ms, 'snc_ridge', (cx + sx * W, cy + sy * D, ze + curl + 0.012), (cx + sx * r, cy, zt + 0.004), w=0.016,
                 h=0.016, lod=0, frame=f)
    if r > 0.001:
        hz = max(0.035, horns)
        for sx in (-1, 1):  # ridge-end ornaments curling up
            ms.box('snc_ridge', (0.022, 0.03, hz), at=(cx + sx * (r + 0.008), cy, zt), lod=0, frame=f, taper=0.7)
            ms.box('snc_ridge', (0.03, 0.03, 0.016), at=(cx + sx * (r + 0.008 - 0.012), cy, zt + hz - 0.008), lod=0, frame=f)
    if finial:
        ms.cyl('snc_ridge', 0.022, 0.026, 0.03, at=(cx, cy, zt - 0.012), segs=8, lod=1, frame=f)
        ms.sphere('snc_ridge', 0.022, at=(cx, cy, zt + 0.035), u=8, v=5, lod=0, frame=f)
        ms.cyl('snc_ridge', 0.01, 0.0, 0.05, at=(cx, cy, zt + 0.05), segs=6, lod=0, frame=f)


def lattice(ms, f, x, y, z, w=0.08, h=0.07, face=-1, mat='snc_lacquer'):
    """A lattice window on a wall face at local y: a dark opening behind bars in a frame."""
    ms.box('dark', (w, 0.01, h), at=(x, y + face * 0.003, z), lod=0, frame=f)
    for k in (-1, 0, 1):
        ms.box(mat, (0.006, 0.006, h), at=(x + k * w / 4, y + face * 0.008, z), lod=0, frame=f)
    ms.box(mat, (w, 0.006, 0.006), at=(x, y + face * 0.008, z + h / 2), lod=0, frame=f)
    ms.box(mat, (w + 0.016, 0.01, 0.012), at=(x, y + face * 0.006, z + h), lod=0, frame=f)


def dbl_door(ms, f, x, y, w=0.12, h=0.2, z=G, frame_mat='snc_lacquer'):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, z), lod=1, frame=f)
    ms.box(frame_mat, (0.008, 0.014, h), at=(x, y - 0.006, z), lod=0, frame=f)  # the meeting stile
    ms.box(frame_mat, (w + 0.03, 0.016, 0.018), at=(x, y - 0.006, z + h), lod=0, frame=f)


def court_wall(ms, x0, y0, x1, y1, h=0.17, t=0.035, gaps=(), lod=2):
    """A courtyard wall from (x0, y0) to (x1, y1): grey brick footing, cream plaster, a grey tiled
    coping with a ridge; `gaps` are (centre fraction, width) openings."""
    length = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    f = tm.house_frame(x0, y0, yaw)
    pos, spans = 0.0, []
    for c, gw in sorted(gaps):
        a, b = c * length - gw / 2, c * length + gw / 2
        if a > pos:
            spans.append((pos, a))
        pos = b
    if pos < length:
        spans.append((pos, length))
    for a, b in spans:
        ms.box('snc_plaster', (b - a, t, h), at=((a + b) / 2, 0, G), lod=lod, frame=f)
        ms.box('snc_brick', (b - a + 0.006, t + 0.008, h * 0.35), at=((a + b) / 2, 0, G), lod=1, frame=f)
        ms.box('snc_tile', (b - a + 0.016, t + 0.036, 0.022), at=((a + b) / 2, 0, G + h), lod=1, frame=f, taper=0.55)
        ms.box('snc_ridge', (b - a + 0.016, 0.014, 0.01), at=((a + b) / 2, 0, G + h + 0.018), lod=0, frame=f)


def paved_strip(ms, x0, y0, x1, y1, w):
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * w / 2, dx / length * w / 2
    ms.quad_strip('snc_paving_square', [(x0 + nx, y0 + ny, G + 0.003), (x0 - nx, y0 - ny, G + 0.003),
                                        (x1 - nx, y1 - ny, G + 0.003), (x1 + nx, y1 + ny, G + 0.003)], lod=1)


def tree(ms, rng, x, y, h=0.32, r=0.09, blossom=False):
    """A round-crowned courtyard tree (ti_classical's broadleaf), now and then in red or pink
    blossom as on the street sheet."""
    if not blossom:
        tc.broadleaf(ms, x, y, h=h, r=r)
        return
    ms.cyl('timber', 0.014, 0.01, h * 0.45, at=(x, y, G), segs=6, lod=1)
    ms.sphere('snc_blossom', r, at=(x, y, G + h - r * 0.8), scale=(1, 1, 0.85), u=8, v=5, lod=1, only=(0, 1))
    ms.cyl('snc_blossom', r * 0.95, r * 0.6, r * 1.5, at=(x, y, G + h - r * 1.6), segs=6, lod=2, only=2)


def jars(ms, f, x, y, rng, n=3):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.03, 0.03), rng.uniform(0.9, 1.25))


def fence(ms, f, x0, y0, x1, y1, h=0.09, step=0.07):
    """A low timber yard fence (the street sheet's poor plots)."""
    length = math.hypot(x1 - x0, y1 - y0)
    n = max(1, round(length / step))
    for i in range(n + 1):
        t = i / n
        ms.box('timber', (0.01, 0.01, h), at=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, G), lod=0, frame=f)
    for zz in (0.035, 0.075):
        beam(ms, 'timber', (x0, y0, G + zz), (x1, y1, G + zz), w=0.008, h=0.008, lod=0, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def body(ms, f, w, d, h, base=0.09, cx=0.0, cy=0.0, base_mat='snc_brick', plinth=0.03):
    """A house block: a stone plinth, a grey brick (or stone) dado, cream plaster above."""
    ms.box('snc_stone', (w + 0.04, d + 0.04, plinth), at=(cx, cy, G), lod=1, frame=f)
    ms.box('snc_plaster', (w, d, h), at=(cx, cy, G), lod=2, frame=f, bevel=0.003)
    ms.box(base_mat, (w + 0.006, d + 0.006, base), at=(cx, cy, G + plinth), lod=1, frame=f)


def posts(ms, f, w, d, z, h, n=4, mat='snc_lacquer', y=None, r=0.013):
    """A row of n posts along the front face (local -Y) and the two back corners."""
    yy = -d / 2 - 0.006 if y is None else y
    for i in range(n):
        px = -w / 2 + w * i / (n - 1)
        ms.box(mat, (2 * r, 2 * r, h), at=(px, yy, z), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box(mat, (2 * r, 2 * r, h), at=(sx * w / 2, d / 2 + 0.006, z), lod=0, frame=f)
    ms.box(mat, (w + 2 * r, 0.026, 0.026), at=(0, yy, z + h - 0.026), lod=1, frame=f)


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, awning=True):
    """The cottage (sheet: 5 x 7 m, 2.8 m): a grey stone base, cream plaster between natural timber
    corner posts and a mid rail, a grey tiled gable with its eaves to the street, a plank door
    under a small canopy, two lattice windows; in a wide plot a yard beside it behind a timber
    fence with jars, a rack and a canvas awning (the street sheet)."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    side = side if side is not None else rng.choice([-1, 1])
    hw = min(max(w * 0.62, 0.4), 0.52)
    hx = side * (w - hw) / 2
    hd = min(d, 0.6)
    h = STOREY * 0.72
    hf = f @ Matrix.Translation(Vector((hx, (d - hd) / 2, 0)))
    body(ms, hf, hw, hd, h, base=0.07, base_mat='snc_stone', plinth=0.02)
    for sx in (-1, 1):  # timber corner posts and the mid rail
        for sy in (-1, 1):
            ms.box('timber', (0.022, 0.022, h), at=(sx * hw / 2, sy * hd / 2, G), lod=0, frame=hf)
    ms.box('timber', (hw + 0.02, 0.012, 0.016), at=(0, -hd / 2 - 0.004, G + h * 0.55), lod=0, frame=hf)
    ms.box('timber', (hw + 0.02, 0.016, 0.02), at=(0, -hd / 2 - 0.004, G + h - 0.02), lod=0, frame=hf)
    tc.gable_roof(ms, hf, hw, hd, G + h, 0.15, over=0.04, mat='snc_tile', gable='snc_plaster', ridge='snc_ridge')
    for sx in (-1, 1):  # the ridge's upturned ends
        ms.box('snc_ridge', (0.02, 0.03, 0.04), at=(sx * (hw / 2 + 0.04), 0, G + h + 0.14), lod=0, frame=hf, taper=0.7)
    dx = -0.02 * side
    ms.box('door', (0.085, 0.012, 0.18), at=(dx, -hd / 2 - 0.004, G + 0.02), lod=1, frame=hf)
    ms.box('timber', (0.11, 0.016, 0.016), at=(dx, -hd / 2 - 0.006, G + 0.2), lod=0, frame=hf)
    cf = hf @ Matrix.Translation(Vector((dx, -hd / 2 - 0.04, G + 0.235))) @ Matrix.Rotation(math.radians(-18), 4, 'X')
    ms.box('timber', (0.14, 0.09, 0.012), at=(0, 0, 0), lod=0, frame=cf)  # the door canopy
    for wx in (-hw * 0.3, hw * 0.3):
        if abs(wx - dx) > 0.09:
            lattice(ms, hf, wx, -hd / 2, G + 0.12, w=0.065, h=0.06, mat='timber')
    rest = w - hw
    gx = -side * hw / 2  # the yard beside the cottage
    if rest > 0.12:
        x1 = gx - side * rest
        fy = -d / 2 - 0.06
        fence(ms, f, gx - side * 0.01, fy, x1 + side * 0.02, fy)
        fence(ms, f, x1 + side * 0.02, fy, x1 + side * 0.02, d / 2 - 0.02)
        px = gx - side * rest / 2
        jars(ms, f, px, d * 0.15, rng, 2)
        tt.rack(ms, f, px, d / 2 - 0.08)
        if awning and rest > 0.18:
            for sx in (-1, 1):
                ms.box('timber', (0.012, 0.012, 0.2), at=(px + sx * (rest * 0.4), -d * 0.15, G), lod=0, frame=f)
            af = f @ Matrix.Translation(Vector((px, -d * 0.05, G + 0.215))) @ Matrix.Rotation(math.radians(-10), 4, 'X')
            ms.box('team_cloth', (rest * 0.85, 0.22, 0.008), at=(0, 0, 0), lod=1, frame=af)
    else:
        jars(ms, hf, 0.13 * side, -hd / 2 - 0.06, rng, 2)
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning=True, jar_n=2, tree_in=True):
    """The courtyard house (sheet: 8 x 12 m, 3.2 m): a stone plinth with steps, a grey brick dado,
    cream plaster, red-brown posts and a beam along the front, a double plank door and lattice
    windows, a grey-tiled hip roof with upturned corners ringed round a small planted court
    (the sheet's top view); a canvas awning on posts over a stall front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = STOREY * 0.82
    body(ms, f, w, d, h)
    n = 4 if w < 0.8 else 5
    posts(ms, f, w, d, G + 0.03, h - 0.03, n=n)
    dx = rng.choice([0.0, 0.0, -0.1 * w, 0.1 * w])
    dbl_door(ms, f, dx, -d / 2, w=0.12, h=0.19, z=G + 0.03)
    for s in range(2):  # two steps up the plinth
        ms.box('snc_stone', (0.2 - 0.04 * s, 0.04, 0.015 * (s + 1)), at=(dx, -d / 2 - 0.05 + 0.02 * s, G), lod=0, frame=f)
    for wx in (-w * 0.32, w * 0.32):
        if abs(wx - dx) > 0.12:
            lattice(ms, f, wx, -d / 2, G + 0.15)
    for sx in (-1, 1):
        lattice(ms, f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z'), 0, -w / 2, G + 0.15)
    # the roof ringed round the court
    over, curl, rise = 0.07, 0.035, 0.15
    W, D = w / 2 + over, d / 2 + over
    hw, hd = min(0.12, w * 0.17), min(0.11, d * 0.17)
    z = G + h
    ze = z - over * 0.3
    rw, rd = (W + hw) / 2, (D + hd) / 2
    loops = [(W, D, ze - 0.02, curl), (W, D, ze, curl), (rw, rd, z + rise, 0.0), (hw, hd, z + rise * 0.5, 0.0),
             (hw, hd, z + rise * 0.5 - 0.02, 0.0)]
    ring_solid(ms, f, loops, 'snc_tile', lod=1)
    han_roof(ms, f, w, d, z, rise, over=over, curl=curl, lod=2, only=2)  # the LOD2 stand-in
    for (px, py, sw, sd) in ((0, -rd, 2 * rw, 0.03), (0, rd, 2 * rw, 0.03), (-rw, 0, 0.03, 2 * rd), (rw, 0, 0.03, 2 * rd)):
        ms.box('snc_ridge', (sw + 0.01, sd, 0.02), at=(px, py, z + rise - 0.012), lod=1, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):  # hip ridges to the upturned corners
            beam(ms, 'snc_ridge', (sx * W, sy * D, ze + curl + 0.01), (sx * rw, sy * rd, z + rise + 0.004), w=0.014, h=0.014,
                 lod=0, frame=f)
    ms.box('snc_stone', (2 * hw, 2 * hd, z + rise * 0.5 - 0.03), at=(0, 0, 0), lod=1, frame=f)  # the court floor
    if tree_in:
        ms.sphere('shrub', 0.05, at=(0, 0, z + rise * 0.5 + 0.0), scale=(1, 1, 0.9), u=7, v=5, lod=0, frame=f)
    if awning:
        aw = min(0.28, w * 0.36)
        ax = w * 0.24 if dx <= 0 else -w * 0.24
        tt.front_shade(ms, f, ax, -d / 2 - 0.02, aw, depth=0.15, z=0.24, mat='team_cloth')
        ms.box('timber', (aw * 0.8, 0.07, 0.06), at=(ax, -d / 2 - 0.1, G), lod=0, frame=f, bevel=0.003)
    if jar_n:
        jars(ms, f, (-w * 0.3 if dx >= 0 else w * 0.3), -d / 2 - 0.07, rng, jar_n)
    return f


def hall(ms, f, w, d, h, cx=0.0, cy=0.0, rise=0.18, n=5, windows=True, lod=2, over=0.08, curl=0.045, horns=0.0):
    """A Han hall on a stone plinth: cream walls behind a row of red-brown posts under a beam, a
    double door in the middle, lattice windows, a grey hip roof with upturned eaves."""
    hf = f @ Matrix.Translation(Vector((cx, cy, 0)))
    ms.box('snc_stone', (w + 0.08, d + 0.08, 0.04), at=(0, 0, G), lod=min(lod, 1), frame=hf)
    z = G + 0.04
    ms.box('snc_plaster', (w, d, h), at=(0, 0, z), lod=lod, frame=hf)
    ms.box('snc_brick', (w + 0.006, d + 0.006, 0.06), at=(0, 0, z), lod=1, frame=hf)
    fy = -d / 2 - 0.035  # posts stand out in front: a shallow verandah
    for i in range(n):
        px = -w / 2 + 0.01 + (w - 0.02) * i / (n - 1)
        ms.cyl('snc_lacquer', 0.014, 0.013, h, at=(px, fy, z), segs=6, lod=1, frame=hf)
        ms.cyl('snc_stone', 0.022, 0.02, 0.014, at=(px, fy, z), segs=6, lod=0, frame=hf)
    ms.box('snc_lacquer', (w + 0.03, 0.028, 0.03), at=(0, fy, z + h - 0.03), lod=1, frame=hf)
    ms.box('snc_lacquer', (w, 0.012, h * 0.82), at=(0, -d / 2 - 0.004, z), lod=0, frame=hf)  # red front panels
    dbl_door(ms, hf, 0, -d / 2 - 0.01, w=0.13, h=h * 0.7, z=z)
    if windows:
        for k in (-1, 1):
            for wx in ((0.22 * w, 0.4 * w) if w > 0.7 else (0.3 * w,)):
                lattice(ms, hf, k * wx, -d / 2 - 0.01, z + h * 0.3, w=0.08, h=h * 0.4)
    for s in range(3):
        ms.box('snc_stone', (0.24 - 0.04 * s, 0.035, 0.014 * (s + 1)), at=(0, -d / 2 - 0.1 + 0.025 * s, G), lod=0, frame=hf)
    han_roof(ms, hf, w + 0.07, d + 0.05, z + h, rise, over=over, curl=curl, lod=lod, horns=horns)
    return hf


def rich_house(ms, rng, x, y, w, d, yaw=None, garden=True, blossom=False):
    """The walled residence (sheet: 14 x 18 m, 4.8 m): a compound wall of cream plaster on grey
    brick under a grey-tiled coping, a gatehouse with its own small roof and red doors in the
    middle of the front, the main hall across the back with red posts and a hip roof with upturned
    eaves, side halls down both sides, and a paved court with trees. A shallow plot keeps the hall
    and the front wall with the gate only."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    wh = 0.2
    t = 0.035
    # the compound wall (local frame: the front at -d/2)
    segs = [((-w / 2, -d / 2), (-0.09, -d / 2)), ((0.09, -d / 2), (w / 2, -d / 2))]
    if garden:
        segs += [((w / 2, -d / 2), (w / 2, d / 2)), ((w / 2, d / 2), (-w / 2, d / 2)), ((-w / 2, d / 2), (-w / 2, -d / 2))]
    for (ax, ay), (bx, by) in segs:
        pa, pb = f @ Vector((ax, ay, 0)), f @ Vector((bx, by, 0))
        court_wall(ms, pa.x, pa.y, pb.x, pb.y, h=wh, t=t)
    # the gatehouse
    gw, gd = 0.22, 0.12
    ms.box('snc_brick', (gw, gd, wh + 0.04), at=(0, -d / 2, G), lod=1, frame=f)
    ms.box('snc_plaster', (gw - 0.06, gd + 0.004, wh - 0.03), at=(0, -d / 2, G + 0.03), lod=0, frame=f)
    dbl_door(ms, f, 0, -d / 2 - gd / 2, w=0.11, h=0.17, z=G + 0.02)
    for sx in (-1, 1):
        ms.cyl('snc_lacquer', 0.012, 0.012, wh + 0.03, at=(sx * 0.075, -d / 2 - gd / 2 - 0.012, G), segs=6, lod=1, frame=f)
    han_roof(ms, f, gw, gd, G + wh + 0.04, 0.08, over=0.05, curl=0.025, lod=1, cy=-d / 2)
    for s in range(3):
        ms.box('snc_stone', (0.2 - 0.04 * s, 0.035, 0.012 * (s + 1)), at=(0, -d / 2 - gd / 2 - 0.08 + 0.025 * s, G), lod=0, frame=f)
    if garden:
        hd = min(0.3, d * 0.3)
        hw = w * 0.62
        hall(ms, f, hw, hd, STOREY * 0.8, cy=d / 2 - hd / 2 - 0.06, rise=0.2, n=5 if hw > 0.55 else 4)
        sd = d * 0.42
        sw = min(0.2, w * 0.18)
        for sx in (-1, 1):  # side halls facing the court
            sf = f @ Matrix.Translation(Vector((sx * (w / 2 - sw / 2 - 0.05), -d * 0.06, 0))) @ Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
            hall(ms, sf, sd, sw, STOREY * 0.62, rise=0.12, n=4, windows=False, lod=1, over=0.06, curl=0.03)
        ms.box('snc_paving_square', (w - 2 * sw - 0.2, d * 0.4, 0.006), at=(0, -d * 0.08, G), lod=1, frame=f)
        for sx in (-1, 1):
            p = f @ Vector((sx * w * 0.17, -d * 0.2, 0))
            tree(ms, rng, p.x, p.y, h=0.36, r=0.085, blossom=blossom and sx > 0)
            p = f @ Vector((sx * (w / 2 - 0.08), d / 2 - 0.08, 0))
            tc.shrub(ms, p.x, p.y, r=0.055, lod=0)
    else:
        hall(ms, f, w * 0.7, d * 0.55, STOREY * 0.8, cy=d * 0.12, rise=0.2, n=5)
        for sx in (-1, 1):
            p = f @ Vector((sx * w * 0.42, -d * 0.18, 0))
            tree(ms, rng, p.x, p.y, h=0.32, r=0.075, blossom=blossom and sx > 0)
    for sx in (-1, 1):  # jars and a guardian block beside the gate
        ms.box('snc_stone', (0.04, 0.04, 0.06), at=(sx * 0.14, -d / 2 - 0.1, G), lod=0, frame=f)
    jars(ms, f, -w * 0.32, -d / 2 - 0.07, rng, 2)
    return f


def sinic_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


def stall(ms, x, y, rng, yaw=None, w=0.36, d=0.3):
    import ti_bronze as tb
    tb.stall(ms, x, y, rng, yaw=yaw, cloth='team_cloth', w=w, d=d)


# ---- landmark 1: the double-eave gate tower ------------------------------------------------------

def _arch_block(ms, f, aw, z_spring, z_top, d_bot, d_top, n=8, mat='snc_brick', lod=2):
    """The brick over a gate passage aw wide: front and back faces (battered: half-depth d_bot at
    the ground, d_top at z_top) with a semicircular opening springing at z_spring, and the soffit."""
    r = aw / 2

    def yd(z):
        return d_bot + (d_top - d_bot) * (z - G) / (z_top - G)

    bm = bmesh.new()
    arc = [(-r * math.cos(math.pi * i / n), z_spring + r * math.sin(math.pi * i / n)) for i in range(n + 1)]
    rings = {}
    for face in (-1, 1):
        A = [bm.verts.new((ax, face * yd(az), az)) for ax, az in arc]
        B = [bm.verts.new((ax, face * yd(z_top), z_top)) for ax, az in arc]
        B[0].co.x, B[-1].co.x = -r, r
        for i in range(n):
            fa = bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
            fa.normal_update()
            if fa.normal.y * face < 0:
                fa.normal_flip()
        rings[face] = A
    for i in range(n):
        fs = bm.faces.new((rings[-1][i], rings[-1][i + 1], rings[1][i + 1], rings[1][i]))
        fs.normal_update()
        mid = fs.calc_center_median() - Vector((0, 0, z_spring))
        if fs.normal.dot(Vector((-mid.x, 0, -mid.z))) < 0:
            fs.normal_flip()
    ms.add(bm, mat, lod, matrix=f.copy())


def gate_tower(ms, rng, x, y, w=1.4, d=1.0, top=1.2, yaw=0.0, banners=True):
    """The Han gate tower of the sheet (14 m across, 6 m battered grey-brick base with a 4 m arched
    passage in a stone ring, 12 m to the ridge): a stone plinth, a stone platform with a merloned
    parapet, a hall of red-brown posts and cream infill with lattice windows and red doors behind
    a railing, a lower eave all round, a short upper storey under a bracket band, the top hip roof
    with upturned corners and ridge-end ornaments, and team banners on poles at the parapet."""
    f = tm.house_frame(x, y, yaw)
    W, D = w / 2, d / 2
    H = top * 0.5
    bt = w * 0.05  # batter on each face
    aw = w * 0.29
    zt = G + H
    ms.box('snc_stone', (w + 0.05, d + 0.05, 0.035), at=(0, 0, G - 0.005), lod=2, frame=f)
    zb = G + 0.03

    def yd(z):
        return D - bt * (z - zb) / (zt - zb)

    for sx in (-1, 1):  # the two piers: outer faces battered, the passage walls plumb
        xo_b, xo_t, xi = sx * W, sx * (W - bt), sx * aw / 2
        pts = [(min(xo_b, xi), -D, zb), (max(xo_b, xi), -D, zb), (max(xo_b, xi), D, zb), (min(xo_b, xi), D, zb),
               (min(xo_t, xi), -yd(zt), zt), (max(xo_t, xi), -yd(zt), zt), (max(xo_t, xi), yd(zt), zt), (min(xo_t, xi), yd(zt), zt)]
        hexa(ms, 'snc_brick', pts, lod=2, frame=f)
        # the stone jambs of the passage
        for sy in (-1, 1):
            ms.box('snc_stone', (0.05, 0.03, top * 0.25 - 0.03), at=(sx * (aw / 2 + 0.025), sy * (yd(zb + 0.1) - 0.005), zb), lod=1, frame=f)
    z_spring = zb + H * 0.42
    _arch_block(ms, f, aw, z_spring, zt, D, yd(zt))
    ms.box('dark', (aw, d * 0.6, 0.004), at=(0, 0, G + 0.002), lod=1, frame=f)  # the passage floor in shade
    # the stone voussoir ring round the arch on both faces
    r = aw / 2 + 0.025
    for sy in (-1, 1):
        for k in range(7):
            a0, a1 = math.pi * k / 7, math.pi * (k + 1) / 7
            p0 = Vector((-r * math.cos(a0), 0, z_spring + r * math.sin(a0)))
            p1 = Vector((-r * math.cos(a1), 0, z_spring + r * math.sin(a1)))
            for p in (p0, p1):
                p.y = sy * (yd(p.z) + 0.006)
            beam(ms, 'snc_stone', p0, p1, w=0.02, h=0.05, lod=1, frame=f @ Matrix.Translation(Vector((0, 0, 0.025))))
    # the platform and its merloned parapet
    pw, pd = w - 2 * bt, d - 2 * bt
    ms.box('snc_stone', (pw + 0.03, pd + 0.03, 0.025), at=(0, 0, zt), lod=2, frame=f)
    zp = zt + 0.025
    for (px, py, sw, sd) in ((0, -pd / 2, pw, 0.03), (0, pd / 2, pw, 0.03), (-pw / 2, 0, 0.03, pd), (pw / 2, 0, 0.03, pd)):
        ms.box('snc_brick', (sw + 0.03, sd, 0.035), at=(px, py, zp), lod=1, frame=f)
    for k, (L, frm) in enumerate(((pw, f @ Matrix.Translation(Vector((0, -pd / 2, 0)))),
                                  (pw, f @ Matrix.Translation(Vector((0, pd / 2, 0)))),
                                  (pd, f @ Matrix.Translation(Vector((-pw / 2, 0, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')),
                                  (pd, f @ Matrix.Translation(Vector((pw / 2, 0, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')))):
        n = max(3, int(L / 0.09))
        for i in range(n):
            ms.box('snc_brick', (0.04, 0.032, 0.03), at=(-L / 2 + 0.02 + (L - 0.04) * i / (n - 1), 0, zp + 0.035), lod=0, frame=frm)
    # the hall on the platform
    hw, hd = pw * 0.8, pd * 0.72
    zh = zp + 0.012
    h1 = (top - H) * 0.43
    ms.box('snc_stone', (hw + 0.06, hd + 0.06, 0.015), at=(0, 0, zp), lod=1, frame=f)
    ms.box('snc_plaster', (hw, hd, h1), at=(0, 0, zh), lod=2, frame=f)
    nf = 6 if w > 1.0 else 5
    for k, (L, D2, n) in enumerate(((hw, hd, nf), (hd, hw, 4), (hw, hd, nf), (hd, hw, 4))):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i in range(n):
            ms.box('snc_lacquer', (0.024, 0.024, h1), at=(-L / 2 + L * i / (n - 1), -D2 / 2 - 0.008, zh), lod=1, frame=rf)
        ms.box('snc_lacquer', (L + 0.03, 0.022, 0.022), at=(0, -D2 / 2 - 0.008, zh + h1 - 0.03), lod=1, frame=rf)
        ms.box('snc_lacquer', (L, 0.018, 0.018), at=(0, -D2 / 2 - 0.008, zh + h1 * 0.55), lod=0, frame=rf)
        if k % 2 == 0:  # windows and doors on the long sides
            for i in range(n - 1):
                cx = -L / 2 + L * (i + 0.5) / (n - 1)
                if k == 0 and abs(cx) < L / (n - 1):
                    dbl_door(ms, rf, cx, -D2 / 2, w=L / (n - 1) * 0.6, h=h1 * 0.5, z=zh)
                else:
                    lattice(ms, rf, cx, -D2 / 2, zh + h1 * 0.1, w=L / (n - 1) * 0.55, h=h1 * 0.38)
        # the railing at the platform edge in front of the hall
        Lr, Dr = (hw + 0.1, hd + 0.1) if k % 2 == 0 else (hd + 0.1, hw + 0.1)
        ms.box('snc_lacquer', (Lr, 0.012, 0.012), at=(0, -Dr / 2, zh + 0.06), lod=0, frame=rf)
        for i in range(7):
            ms.box('snc_lacquer', (0.01, 0.01, 0.06), at=(-Lr / 2 + Lr * i / 6, -Dr / 2, zh), lod=0, frame=rf)
    # the lower eave all round, then the upper storey and its bracket band
    z1 = zh + h1
    uw, ud = hw * 0.82, hd * 0.8
    over1 = 0.08 * (w / 1.4) + 0.02
    curl1 = 0.04 * (w / 1.4) + 0.01
    lw, ld = hw / 2 + over1, hd / 2 + over1
    ze1 = z1 - 0.01
    zi1 = z1 + 0.05 * (top / 1.2)
    ring_solid(ms, f, [(lw, ld, ze1 - 0.02, curl1), (lw, ld, ze1, curl1), (uw / 2, ud / 2, zi1, 0.0),
                       (uw / 2, ud / 2, ze1 - 0.02, 0.0)], 'snc_tile', lod=2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(ms, 'snc_ridge', (sx * lw, sy * ld, ze1 + curl1 + 0.01), (sx * uw / 2, sy * ud / 2, zi1 + 0.008), w=0.016, h=0.016,
                 lod=0, frame=f)
    h2 = (top - H) * 0.2
    ms.box('snc_plaster', (uw, ud, h2 + (zi1 - ze1)), at=(0, 0, ze1), lod=2, frame=f)
    z2 = zi1
    for k, (L, D2) in enumerate(((uw, ud), (ud, uw), (uw, ud), (ud, uw))):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        n = 6 if k % 2 == 0 else 4
        for i in range(n):
            ms.box('snc_lacquer', (0.02, 0.02, h2), at=(-L / 2 + L * i / (n - 1), -D2 / 2 - 0.006, z2), lod=1, frame=rf)
        ms.box('snc_lacquer', (L + 0.02, 0.02, 0.018), at=(0, -D2 / 2 - 0.006, z2 + 0.02), lod=0, frame=rf)
        if k % 2 == 0:
            for i in range(n - 1):
                cx = -L / 2 + L * (i + 0.5) / (n - 1)
                lattice(ms, rf, cx, -D2 / 2, z2 + h2 * 0.3, w=L / (n - 1) * 0.5, h=h2 * 0.4)
        # the bracket band under the eave (dougong as a stepped red band)
        ms.box('snc_lacquer', (L + 0.04, 0.03, 0.03), at=(0, -D2 / 2 - 0.012, z2 + h2 - 0.03), lod=1, frame=rf)
        for i in range(n):
            ms.box('snc_lacquer', (0.03, 0.05, 0.02), at=(-L / 2 + L * i / (n - 1), -D2 / 2 - 0.02, z2 + h2 - 0.012), lod=0, frame=rf)
    zr = z2 + h2
    rise = G + top - zr
    han_roof(ms, f, uw, ud, zr, rise, over=0.09 * (w / 1.4) + 0.03, curl=curl1 + 0.01, lod=2, horns=0.06 * (top / 1.2))
    if banners:
        for sx in (-1, 1):
            px, py = sx * (pw / 2 - 0.03), -pd / 2 + 0.03
            ms.cyl('timber', 0.008, 0.007, top * 0.3, at=(px, py, zp), segs=6, lod=1, frame=f)
            ms.box('team_cloth', (0.006, 0.07, top * 0.14), at=(px, py - 0.04, zp + top * 0.3 - top * 0.15), lod=1, frame=f)
            ms.box('timber', (0.008, 0.08, 0.008), at=(px, py - 0.04, zp + top * 0.3 - 0.012), lod=0, frame=f)
    return f


# ---- landmark 2: the que watchtower ---------------------------------------------------------------

def balcony(ms, f, z, s, rail=0.07, lod=1, posts_n=6):
    """A square timber gallery s across at floor height z: a plank floor, diagonal brackets under
    it, posts and two rails round the edge."""
    ms.box('timber', (s, s, 0.022), at=(0, 0, z), lod=min(lod, 2), frame=f)
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        ms.box('timber', (s + 0.01, 0.014, 0.012), at=(0, -s / 2 + 0.007, z + rail), lod=lod, frame=rf)
        ms.box('timber', (s, 0.01, 0.01), at=(0, -s / 2 + 0.007, z + rail * 0.5), lod=0, frame=rf)
        for i in range(posts_n):
            ms.box('timber', (0.014, 0.014, rail + 0.012), at=(-s / 2 + 0.007 + (s - 0.014) * i / (posts_n - 1), -s / 2 + 0.007, z),
                   lod=0, frame=rf)
        for i in (1, posts_n - 2):  # brackets
            px = -s / 2 + 0.007 + (s - 0.014) * i / (posts_n - 1)
            beam(ms, 'timber', (px, -s / 2 + 0.06, z - 0.09), (px, -s / 2 + 0.012, z - 0.004), w=0.012, h=0.012, lod=0, frame=rf)


def que_tower(ms, rng, x, y, base=0.6, top=1.6, yaw=0.0):
    """The Han watchtower (que) of the sheet (6 m base, 16 m high): a battered grey-brick shaft
    with a plank door up stone steps and small window slits, a timber gallery with railings on
    brackets at 8 m, a narrower brick stage above it, a second gallery, a timber lookout room with
    windows, and a grey pyramid roof with upturned corners and a finial."""
    f = tm.house_frame(x, y, yaw)
    s = top / 1.6  # the sheet's proportions, scaled
    z0 = G + 0.0
    h1 = 0.8 * s
    b1 = base
    ms.box('snc_stone', (b1 + 0.06, b1 + 0.06, 0.03 * s), at=(0, 0, G - 0.005), lod=2, frame=f)
    ms.box('snc_brick', (b1, b1, h1), at=(0, 0, z0), lod=2, frame=f, taper=0.82)
    b1t = b1 * 0.82
    ms.box('door', (0.09 * s, 0.012, 0.17 * s), at=(0, -b1 / 2 - 0.002, G + 0.03 * s), lod=1, frame=f)
    ms.box('timber', (0.12 * s, 0.016, 0.016), at=(0, -b1 / 2 - 0.004, G + 0.2 * s), lod=0, frame=f)
    for k in range(3):
        ms.box('snc_stone', (0.14 * s, 0.035 * s, 0.012 * (k + 1) * s), at=(0, -b1 / 2 - 0.09 * s + 0.03 * s * k, G), lod=0, frame=f)
    for k in range(4):  # window slits
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        zz = z0 + h1 * 0.62
        yy = -(b1 + (b1t - b1) * 0.62) / 2 - 0.002
        for wx in (-0.14 * s, 0.0, 0.14 * s) if k else (-0.14 * s, 0.14 * s):
            ms.box('dark', (0.022 * s, 0.01, 0.045 * s), at=(wx, yy, zz), lod=0, frame=rf)
        if k:
            ms.box('dark', (0.022 * s, 0.01, 0.045 * s), at=(0, -(b1 + (b1t - b1) * 0.3) / 2 - 0.002, z0 + h1 * 0.3), lod=0, frame=f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z'))
    zb1 = z0 + h1
    balcony(ms, f, zb1, b1t + 0.2 * s, rail=0.08 * s)
    b2 = b1t * 0.92
    h2 = 0.34 * s
    ms.box('snc_brick', (b2, b2, h2), at=(0, 0, zb1 + 0.02), lod=2, frame=f)
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        ms.box('dark', (0.022 * s, 0.01, 0.045 * s), at=(0, -b2 / 2 - 0.002, zb1 + 0.02 + h2 * 0.45), lod=0, frame=rf)
    zb2 = zb1 + 0.02 + h2
    balcony(ms, f, zb2, b2 + 0.24 * s, rail=0.08 * s)
    b3 = b2 * 0.95
    h3 = 0.22 * s
    ms.box('timber', (b3, b3, h3), at=(0, 0, zb2 + 0.02), lod=2, frame=f)
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i in range(4):
            ms.box('timber', (0.02, 0.02, h3), at=(-b3 / 2 + b3 * i / 3, -b3 / 2 - 0.006, zb2 + 0.02), lod=0, frame=rf)
        for wx in (-b3 * 0.22, b3 * 0.22) if k else (-b3 * 0.3, 0.0, b3 * 0.3):
            ms.box('dark', (b3 * 0.2, 0.01, h3 * 0.42), at=(wx, -b3 / 2 - 0.003, zb2 + 0.02 + h3 * 0.35), lod=0, frame=rf)
        ms.box('timber', (b3 + 0.04, 0.03, 0.025), at=(0, -b3 / 2 - 0.01, zb2 + 0.02 + h3 - 0.025), lod=1, frame=rf)
    zr = zb2 + 0.02 + h3
    han_roof(ms, f, b3, b3, zr, G + top - zr - 0.07 * s, over=0.13 * s, curl=0.05 * s, lod=2, finial=True)
    return f


# ---- building a town file -------------------------------------------------------------------------

def main(file_name, obj_name, layout, ground=None):
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(PAVED)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
