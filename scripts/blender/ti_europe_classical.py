# scripts/blender/ti_europe_classical.py
# The Europe kit for the Classical Age (art spec 3b), from the sheets in
# plans/art/kits/europe/classical/: houses.png (a 4 x 6 m ochre-plastered cottage with a lean-to
# and a walled garden; an 8 x 10 m cream town house with a red dado, shutters and a tiled roof
# round a small open court; a 12 x 16 m atrium domus with a columned porch, an impluvium and a
# peristyle garden behind), street.png and roofscape.png (stone-slab streets, plots on beige
# curbs, team-cloth awnings, amphorae, potted shrubs and cypresses, a well and a street shrine),
# materials.png, the Roman temple (landmark-1) and the aqueduct arch (landmark-2).
# Built on ti_classical.py's parts (gable_roof, temple, cypress, shrub, court_wall), unchanged.
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `euc_` prefix (the Bronze Europe kit has `eu_`).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

NEW = ['euc_plaster', 'euc_ochre', 'euc_dado', 'euc_stone', 'euc_shutter', 'euc_paving', 'euc_paving_fringe',
       'euc_paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'euc_paving': 'Ground', 'euc_paving_fringe': 'Ground', 'euc_paving_square': 'Ground'})
if 'euc_paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('euc_paving_fringe')

PAVING = (('#a9a397', '#979187', '#b7b1a5'), '#6a665e', (0.045, 0.032))


def make_materials():
    # 1. lime plaster, warm cream; 2. ochre plaster over Roman brick; the red-ochre dado band
    tm.mat_simple('euc_plaster', ['#e2d6bc', '#d6c7a6', '#ece2cd', '#cbb995'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_mudwall('euc_ochre', wash='#d7a659', brick='#a9573a', brick2='#8f4630', mortar='#c9b79a', wash_cover=0.42,
                   bond=(0.04, 0.013, 0.002))
    tm.mat_simple('euc_dado', ['#9b3d27', '#ad4b31', '#8a3322'], scale=20.0, bump=0.2)
    # 4. limestone ashlar, buff (the temple, the aqueduct, curbs and footings)
    tm.mat_mudwall('euc_stone', wash='#d8c8a6', brick='#d4c3a0', brick2='#c2b08c', mortar='#9b8b70', wash_cover=0.0,
                   bond=(0.08, 0.04, 0.003))
    # 6. dark weathered timber shutters (slatted)
    tm.mat_simple('euc_shutter', ['#3b2a1c', '#57402b', '#4a3524'], scale=8.0,
                  stripes={'dir': 'Z', 'scale': 160.0, 'distortion': 1.0}, bump=0.5)
    # 5. stone paving, grey-beige slabs; the square a lighter beige
    for n in ('euc_paving', 'euc_paving_fringe'):
        tc.mat_paving(n, stone=PAVING[0], mortar=PAVING[1], slab=PAVING[2])
    tc.mat_paving('euc_paving_square', stone=('#c9bea6', '#b8ad96', '#d4cab3'), mortar='#857b69', slab=(0.07, 0.07))


if not any(n == 'europe_classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('europe_classical', make_materials))

PAVED = dict(mat='euc_paving', power=8)

FOOT = []


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    FOOT.append((tag, [((f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))).x, (f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))).y)
                       for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]))


# ---- roofs --------------------------------------------------------------------------------------

def ring_roof(ms, f, w, d, z, rise, hole_w, hole_d, mat='tile', band=0.022, lod=2, cx=0.0, cy=0.0):
    """A tiled hip roof round an open court (the compluvium): outer eaves w x d at z, a ridge
    ring, the inner eaves round a hole_w x hole_d opening sloping down into the court. One closed
    ring solid."""
    W, D = w / 2, d / 2
    hw, hd = hole_w / 2, hole_d / 2
    loops = [(W, D, z - band), (W, D, z), ((W + hw) / 2, (D + hd) / 2, z + rise), (hw, hd, z + rise * 0.55),
             (hw, hd, z + rise * 0.55 - band)]
    bm = bmesh.new()
    vs = [[bm.verts.new((cx + sx * a, cy + sy * b, zz)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))] for a, b, zz in loops]
    for i in range(len(vs)):
        A, B = vs[i], vs[(i + 1) % len(vs)]
        for k in range(4):
            j = (k + 1) % 4
            bm.faces.new((A[k], A[j], B[j], B[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed ring: safe to orient
    ms.add(bm, mat, lod, matrix=f.copy())
    # ridge caps along the ridge ring
    rw, rd = (W + hw) / 2, (D + hd) / 2
    for (px, py, sw, sd) in ((0, -rd, 2 * rw, 0.028), (0, rd, 2 * rw, 0.028), (-rw, 0, 0.028, 2 * rd), (rw, 0, 0.028, 2 * rd)):
        ms.box('tile_dark', (sw + 0.01, sd, 0.018), at=(cx + px, cy + py, z + rise - 0.01), lod=min(lod, 1), frame=f)


def hip(ms, f, w, d, z, rise, mat='tile', lod=2, cx=0.0, cy=0.0):
    """A plain tiled hip roof (no turned-up eaves) as one closed solid."""
    W, D = w / 2, d / 2
    r = max(0.0, W - D)
    bm = bmesh.new()
    c = [bm.verts.new((cx + sx * W, cy + sy * D, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    b = [bm.verts.new((cx + sx * W, cy + sy * D, z - 0.02)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    r0, r1 = bm.verts.new((cx - r, cy, z + rise)), bm.verts.new((cx + r, cy, z + rise))
    bm.faces.new((b[3], b[2], b[1], b[0]))
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new((b[k], b[j], c[j], c[k]))
    if r > 0.001:
        bm.faces.new((c[0], c[1], r1, r0))
        bm.faces.new((c[2], c[3], r0, r1))
        bm.faces.new((c[1], c[2], r1))
        bm.faces.new((c[3], c[0], r0))
    else:
        bmesh.ops.pointmerge(bm, verts=[r0, r1], merge_co=(cx, cy, z + rise))
        top = [v for v in bm.verts if v.co.z > z + rise - 1e-6][0]
        for k in range(4):
            bm.faces.new((c[k], c[(k + 1) % 4], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy())


# ---- wall details -------------------------------------------------------------------------------

def shuttered(ms, f, x, y, z, w=0.05, h=0.065, face=-1):
    """A small window with two timber shutters on a wall face at local y (facing `face`)."""
    ms.box('dark', (w, 0.01, h), at=(x, y + face * 0.003, z), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('euc_shutter', (w * 0.55, 0.008, h + 0.006), at=(x + sx * w * 0.8, y + face * 0.006, z - 0.003), lod=0, frame=f)


def door(ms, f, x, y, w=0.09, h=0.19, frame_mat='euc_stone', step=True):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, G), lod=1, frame=f)
    ms.box(frame_mat, (w + 0.04, 0.016, 0.022), at=(x, y - 0.006, G + h), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box(frame_mat, (0.018, 0.016, h), at=(x + sx * (w / 2 + 0.011), y - 0.006, G), lod=0, frame=f)
    if step:
        ms.box(frame_mat, (w + 0.08, 0.05, 0.018), at=(x, y - 0.03, G), lod=0, frame=f)


def body(ms, f, w, d, h, wall='euc_plaster', dado=True, cx=0.0, cy=0.0):
    ms.box('euc_stone', (w + 0.012, d + 0.012, 0.04), at=(cx, cy, G), lod=1, frame=f)
    ms.box(wall, (w, d, h), at=(cx, cy, G), lod=2, frame=f, bevel=0.004)
    if dado:
        ms.box('euc_dado', (w + 0.006, d + 0.006, 0.055), at=(cx, cy, G + 0.04), lod=1, frame=f)


def amphorae(ms, f, x, y, rng, n=3):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.03, 0.03), rng.uniform(1.0, 1.35))


def potted(ms, f, x, y, r=0.035):
    tt.jar(ms, f, x, y, 0.9)
    ms.sphere('shrub', r, at=(x, y, G + 0.09 + r * 0.6), scale=(1, 1, 0.85), u=7, v=5, lod=0, frame=f)


def curb(ms, f, w, d, front=0.12):
    """The plot's beige stone curb (a low kerb round the plot, as on the street sheet)."""
    y0, y1 = -d / 2 - front, d / 2 + 0.04
    for (px, py, pw, pd) in ((0, y0, w + 0.1, 0.03), (0, y1, w + 0.1, 0.03), (-w / 2 - 0.05, (y0 + y1) / 2, 0.03, y1 - y0),
                             (w / 2 + 0.05, (y0 + y1) / 2, 0.03, y1 - y0)):
        ms.box('euc_stone', (pw, pd, 0.012), at=(px, py, G), lod=1, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def poor_house(ms, rng, x, y, w, d, yaw=None, side=None):
    """The cottage (sheet: 4 x 6 m, one storey): worn ochre plaster with Roman brick showing, a
    tiled gable with its gable to the street, a plank door and a shuttered window, a tiled lean-to
    at the side, a timber pergola and a garden walled in rubble with a gate, amphorae and a bench."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    side = side if side is not None else rng.choice([-1, 1])
    hw = min(max(w * 0.58, 0.38), 0.5)
    hx = side * (w - hw) / 2
    h = STOREY * 0.85
    hf = f @ Matrix.Translation(Vector((hx, 0, 0)))
    body(ms, hf, hw, d, h, wall='euc_ochre', dado=False)
    rf = hf @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rf, d, hw, G + h, 0.16, over=0.035, gable='euc_ochre')
    door(ms, hf, -0.05 * side, -d / 2, w=0.08, h=0.17)
    shuttered(ms, hf, 0.11 * side, -d / 2, G + 0.18)
    rest = w - hw
    gx = -side * hw / 2
    if rest > 0.12:
        # the lean-to (tiled) against the cottage and the pergola beyond it
        lw = min(rest * 0.6, 0.2)
        lx = gx - side * lw / 2
        ms.box('euc_ochre', (lw, d * 0.45, h * 0.7), at=(lx, d * 0.25, G), lod=1, frame=f)
        lf = f @ Matrix.Translation(Vector((lx, d * 0.25, G + h * 0.7 + 0.02))) @ Matrix.Rotation(math.radians(side * -14), 4, 'Y')
        ms.box('tile', (lw + 0.04, d * 0.45 + 0.04, 0.02), at=(0, 0, 0), lod=1, frame=lf)
        px = gx - side * (lw + (rest - lw) / 2)
        for sy in (-1, 1):
            ms.box('timber', (0.014, 0.014, 0.22), at=(px + side * 0.03, sy * d * 0.22 - 0.05, G), lod=0, frame=f)
        ms.box('timber', (rest - lw, d * 0.55, 0.012), at=(px, -0.05, G + 0.22), lod=0, frame=f)
        for k in range(4):
            ms.box('timber', (rest - lw + 0.02, 0.012, 0.012), at=(px, -0.05 - d * 0.22 + k * d * 0.147, G + 0.232), lod=0, frame=f)
        tc.shrub(ms, *(f @ Vector((px, d * 0.2, 0)))[:2], r=0.05, lod=1)
        # the garden wall in front with its gate
        wy = -d / 2 - 0.1
        x0, x1 = gx, side * w / 2
        ms.box('euc_stone', (abs(x1 - x0) - 0.08, 0.03, 0.08), at=((x0 + x1) / 2 + side * 0.04, wy, G), lod=1, frame=f)
        ms.box('timber', (0.08, 0.012, 0.075), at=(x0 + side * 0.04, wy, G), lod=0, frame=f)
        ms.box('euc_stone', (0.03, 0.1, 0.08), at=(x1 - side * 0.015, wy + 0.05, G), lod=1, frame=f)
    amphorae(ms, hf, 0.13 * side, -d / 2 - 0.05, rng, 2)
    ms.box('euc_stone', (0.1, 0.03, 0.03), at=(-0.12 * side, -d / 2 - 0.04, G), lod=0, frame=hf)  # a bench
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning=True, storeys=2, jar_n=2, curbs=False):
    """The town house (sheet: 8 x 10 m): cream plaster on a stone footing with a red-ochre dado,
    shuttered windows in two rows, a door in a stone frame up a step, a tiled hip roof round a
    small open court with a shrub, a team-cloth awning on timber brackets over the shop front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * (1.35 if storeys == 2 else 0.95)
    body(ms, f, w, d, h)
    dx = rng.uniform(-0.12, 0.12) * w
    door(ms, f, dx, -d / 2)
    for wx in (-w * 0.32, w * 0.32):
        if abs(wx - dx) > 0.1:
            shuttered(ms, f, wx, -d / 2, G + 0.16)
        if storeys == 2:
            ms.box('dark', (0.04, 0.01, 0.03), at=(wx, -d / 2 - 0.003, G + h - 0.1), lod=0, frame=f)
    for sx in (-1, 1):
        shuttered(ms, f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z'), 0, -w / 2, G + 0.16)
    hole = (min(0.22, w * 0.32), min(0.2, d * 0.32))
    ring_roof(ms, f, w + 0.07, d + 0.07, G + h, 0.15, hole[0], hole[1])
    ms.box('euc_stone', (hole[0], hole[1], G + h - 0.03), at=(0, 0, 0), lod=1, frame=f)  # the court floor (closes the hole)
    ms.sphere('shrub', 0.045, at=(0, 0, G + h), u=7, v=5, lod=0, frame=f)
    if awning:
        aw = min(0.3, w * 0.4)
        ax = w * 0.22 if dx < 0 else -w * 0.22
        for sx in (-1, 1):  # timber brackets
            ms.box('timber', (0.012, 0.1, 0.012), at=(ax + sx * aw / 2, -d / 2 - 0.05, G + 0.25), lod=0, frame=f)
        tt.front_shade(ms, f, ax, -d / 2, aw, depth=0.12, z=0.27, mat='team_cloth')
    if jar_n:
        amphorae(ms, f, (w * 0.22 if dx < 0 else -w * 0.22), -d / 2 - 0.06, rng, jar_n)
    potted(ms, f, dx + 0.1, -d / 2 - 0.05)
    if curbs:
        curb(ms, f, w, d)
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, garden=True):
    """The atrium domus (sheet: 12 x 16 m): cream plaster with a red dado, a porch of four columns
    under its own tiled hip at the front, the atrium roof round an impluvium pool, and behind it a
    peristyle garden: a colonnade with a lean-to roof round a planted court with two cypresses."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * 1.05
    dm = d * (0.66 if garden else 1.0)  # the atrium block
    cy = -d / 2 + dm / 2
    body(ms, f, w, dm, h, cy=cy)
    for wx in (-w * 0.36, -w * 0.22, w * 0.22, w * 0.36):
        shuttered(ms, f, wx, -d / 2, G + 0.17)
    hole = (w * 0.28, dm * 0.3)
    ring_roof(ms, f, w + 0.07, dm + 0.07, G + h, 0.16, hole[0], hole[1], cy=cy)
    ms.box('euc_stone', (hole[0], hole[1], G + h - 0.04), at=(0, cy, 0), lod=1, frame=f)
    ms.box('water', (hole[0] * 0.6, hole[1] * 0.6, 0.004), at=(0, cy, G + h - 0.04), lod=0, frame=f)
    # the front porch: four columns, an entablature, a small hip roof, steps
    pw, pd = min(0.36, w * 0.4), 0.13
    py = -d / 2 - pd / 2
    for i in range(4):
        cx = -pw / 2 + 0.02 + (pw - 0.04) * i / 3
        ms.cyl('marble', 0.016, 0.014, h * 0.82, at=(cx, -d / 2 - pd + 0.02, G + 0.03), segs=8, lod=1, frame=f)
        ms.box('marble', (0.04, 0.04, 0.015), at=(cx, -d / 2 - pd + 0.02, G + 0.03 + h * 0.82 - 0.015), lod=0, frame=f)
    ms.box('euc_stone', (pw + 0.06, pd + 0.04, 0.03), at=(0, py, G), lod=1, frame=f)
    ms.box('euc_stone', (pw - 0.04, 0.04, 0.015), at=(0, -d / 2 - pd - 0.03, G), lod=0, frame=f)
    ms.box('marble', (pw + 0.02, pd + 0.02, 0.03), at=(0, py + 0.01, G + 0.03 + h * 0.82), lod=1, frame=f)
    hip(ms, f, pw + 0.06, pd + 0.06, G + 0.06 + h * 0.82, 0.07, cy=py + 0.01, lod=1)
    door(ms, f, 0, -d / 2, w=0.1, h=0.2, step=False)
    if garden:
        y0, y1 = cy + dm / 2, d / 2
        gd = y1 - y0
        for sx in (-1, 1):  # side wings of the peristyle: walls with lean-to roofs
            ms.box('euc_plaster', (0.05, gd, h * 0.7), at=(sx * (w / 2 - 0.025), (y0 + y1) / 2, G), lod=2, frame=f)
            lf = f @ Matrix.Translation(Vector((sx * (w / 2 - 0.06), (y0 + y1) / 2, G + h * 0.7))) @ Matrix.Rotation(math.radians(sx * 14), 4, 'Y')
            ms.box('tile', (0.13, gd + 0.02, 0.016), at=(0, 0, 0), lod=1, frame=lf)
        ms.box('euc_plaster', (w, 0.05, h * 0.7), at=(0, y1 - 0.025, G), lod=2, frame=f)
        lf = f @ Matrix.Translation(Vector((0, y1 - 0.06, G + h * 0.7))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
        ms.box('tile', (w + 0.02, 0.13, 0.016), at=(0, 0, 0), lod=1, frame=lf)
        n = max(3, round((w - 0.2) / 0.11))
        for i in range(n):  # the colonnade along the back
            ms.cyl('marble', 0.011, 0.01, h * 0.62, at=(-w / 2 + 0.12 + (w - 0.24) * i / (n - 1), y1 - 0.11, G), segs=6, lod=0, frame=f)
        ms.box('shrub', (w - 0.3, gd - 0.2, 0.02), at=(0, (y0 + y1) / 2 - 0.02, G), lod=1, frame=f, bevel=0.005)
        for sx in (-1, 1):
            p = f @ Vector((sx * (w / 2 - 0.16), (y0 + y1) / 2, 0))
            tc.cypress(ms, p.x, p.y, h=0.38, r=0.045, lod=1)
        p = f @ Vector((0, (y0 + y1) / 2, 0))
        tc.shrub(ms, p.x, p.y, r=0.05, lod=0)
    for sx in (-1, 1):  # potted shrubs and cypresses flank the porch
        potted(ms, f, sx * (pw / 2 + 0.07), -d / 2 - 0.07)
    return f


def europe_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


# ---- the street ---------------------------------------------------------------------------------

def shrine(ms, x, y, yaw=0.0):
    """A street shrine (lararium): a niche on a plinth under a small pediment, with an offering."""
    f = tm.house_frame(x, y, yaw)
    foot(f, 0.14, 0.1, tag='prop')
    ms.box('euc_stone', (0.14, 0.1, 0.06), at=(0, 0, G), lod=1, frame=f)
    ms.box('euc_plaster', (0.11, 0.07, 0.12), at=(0, 0.01, G + 0.06), lod=1, frame=f)
    ms.box('dark', (0.05, 0.01, 0.06), at=(0, -0.025, G + 0.085), lod=0, frame=f)
    rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rf, 0.08, 0.12, G + 0.18, 0.04, over=0.01, mat='euc_stone', gable='euc_stone', lod=1, ridge='euc_stone')


def bench(ms, x, y, yaw=0.0):
    f = tm.house_frame(x, y, yaw)
    ms.box('euc_stone', (0.14, 0.04, 0.025), at=(0, 0, G + 0.025), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('euc_stone', (0.025, 0.035, 0.025), at=(sx * 0.05, 0, G), lod=0, frame=f)


def stall(ms, x, y, rng, yaw=None, w=0.36, d=0.3):
    """A market stall: a counter of amphorae and baskets under a team-cloth awning on timber posts."""
    import ti_bronze as tb
    tb.stall(ms, x, y, rng, yaw=yaw, cloth='team_cloth', w=w, d=d)


# ---- landmark 1: the Roman temple ---------------------------------------------------------------

def roman_temple(ms, rng, x, y, w, d, top, yaw=None, columns=6, podium=None):
    """The Roman temple of the sheet (16 m across, 3 m podium, 15 m to the ridge): a limestone
    podium with a front stair between cheek walls, a porch of columns with capitals, a cella with
    pilasters down its sides and back, a pediment and a terracotta tile roof."""
    podium = podium or max(0.08, top * 0.2)
    f = tc.temple(ms, rng, x, y, w, d, top, columns=columns, side_columns=0, podium=podium, yaw=yaw, steps=7)
    foot(f, w, d + 0.2, 0, -0.1, tag='temple')
    zc = G + podium
    col_h = top - zc - w * 0.2 - 0.05
    porch = d * 0.32
    cw = w * 0.82
    n = max(3, round((d - porch) / 0.16))
    for sx in (-1, 1):  # pilasters down the cella's sides
        for i in range(n + 1):
            py = -d / 2 + porch + 0.02 + (d - porch - 0.06) * i / n
            ms.box('marble', (0.012, 0.035, col_h), at=(sx * (cw / 2 + 0.004), py, zc), lod=0, frame=f)
            ms.box('marble', (0.02, 0.045, 0.02), at=(sx * (cw / 2 + 0.006), py, zc + col_h - 0.02), lod=0, frame=f)
    for sx in (-1, 1):  # the cheek walls of the stair
        ms.box('euc_stone', (0.05, 0.2, podium), at=(sx * (w * 0.35 + 0.025), -d / 2 - 0.1, G), lod=1, frame=f)
    return f


# ---- landmark 2: the aqueduct arch --------------------------------------------------------------

def _arch_wall(ms, f, x0, x1, z_spring, z_top, y0, y1, n=8, mat='euc_stone', lod=2):
    """The spandrel wall of one bay from x0 to x1: solid from the springing line z_spring to z_top,
    a semicircular opening below; front, back and the arch's soffit."""
    cx, r = (x0 + x1) / 2, (x1 - x0) / 2
    bm = bmesh.new()
    arc = [(cx - r * math.cos(math.pi * i / n), z_spring + r * math.sin(math.pi * i / n)) for i in range(n + 1)]
    outer = [(ax, z_top) for ax, az in arc]
    outer[0] = (x0, z_top)
    outer[-1] = (x1, z_top)
    for yy, face in ((y0, -1), (y1, 1)):
        A = [bm.verts.new((ax, yy, az)) for ax, az in arc]
        B = [bm.verts.new((ox, yy, oz)) for ox, oz in outer]
        # the corner pieces between the arch foot and the top corners
        for i in range(n):
            fa = bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
            fa.normal_update()
            if fa.normal.y * face < 0:
                fa.normal_flip()
    A0 = [v for v in bm.verts if abs(v.co.y - y0) < 1e-6][:n + 1]
    A1 = [v for v in bm.verts if abs(v.co.y - y1) < 1e-6][:n + 1]
    for i in range(n):  # the soffit (facing down into the opening)
        fs = bm.faces.new((A0[i], A0[i + 1], A1[i + 1], A1[i]))
        fs.normal_update()
        mid = (fs.calc_center_median() - Vector((cx, (y0 + y1) / 2, z_spring)))
        if fs.normal.dot(Vector((-mid.x, 0, -mid.z))) < 0:
            fs.normal_flip()
    ms.add(bm, mat, lod, matrix=f.copy())


def aqueduct(ms, rng, x, y, length=2.0, depth=0.4, top=1.2, bays=3, yaw=0.0):
    """The aqueduct arch (sheet: 20 m long, 4 m deep, 12 m high, three arches in one tier): ashlar
    piers with impost mouldings, voussoir rings, spandrels with pilasters over the piers, a cornice
    and the water channel along the top between parapets."""
    f = tm.house_frame(x, y, yaw)
    foot(f, length + 0.1, depth + 0.1, tag='aqueduct')
    ms.box('euc_paving_square', (length + 0.12, depth + 0.12, 0.012), at=(0, 0, G - 0.004), lod=1, frame=f)
    pier = length * 0.11
    span = (length - pier * (bays + 1)) / bays
    z_spring = G + top * 0.42
    z_deck = G + top * 0.8
    y0, y1 = -depth / 2, depth / 2
    for i in range(bays + 1):
        px = -length / 2 + pier / 2 + i * (pier + span)
        ms.box('euc_stone', (pier, depth, z_spring - G), at=(px, 0, G), lod=2, frame=f, bevel=0.005)
        ms.box('euc_stone', (pier + 0.03, depth + 0.03, 0.025), at=(px, 0, z_spring - 0.025), lod=1, frame=f)  # impost
        ms.box('euc_stone', (pier * 0.55, depth + 0.03, z_deck - z_spring), at=(px, 0, z_spring), lod=0, frame=f)  # pilaster
    for i in range(bays):
        x0 = -length / 2 + pier + i * (pier + span)
        _arch_wall(ms, f, x0, x0 + span, z_spring, z_deck, y0, y1)
        # the voussoir ring, a band proud of the face
        r = span / 2
        for k in range(7):
            a0, a1 = math.pi * k / 7, math.pi * (k + 1) / 7
            am = (a0 + a1) / 2
            vf = f @ Matrix.Translation(Vector((x0 + r - (r + 0.025) * math.cos(am), 0, z_spring + (r + 0.025) * math.sin(am)))) @ Matrix.Rotation(-(am - math.pi / 2), 4, 'Y')
            ms.box('stone', (2 * (r + 0.025) * math.sin((a1 - a0) / 2) + 0.004, depth + 0.02, 0.05), at=(0, 0, -0.025), lod=0, frame=vf)
    ms.box('euc_stone', (length, depth, top - (z_deck - G) - 0.08), at=(0, 0, z_deck), lod=2, frame=f)
    ms.box('euc_stone', (length + 0.04, depth + 0.04, 0.03), at=(0, 0, z_deck), lod=1, frame=f)  # the cornice
    zt = G + top - 0.08
    for sy in (-1, 1):  # the channel's parapets and the water between them
        ms.box('euc_stone', (length, 0.07, 0.08), at=(0, sy * (depth / 2 - 0.035), zt), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('euc_stone', (0.07, depth - 0.14, 0.08), at=(sx * (length / 2 - 0.035), 0, zt), lod=1, frame=f)
    ms.box('water', (length - 0.14, depth - 0.14, 0.06), at=(0, 0, zt), lod=1, frame=f)
    for i in range(bays + 1):  # pilaster caps rising over the parapet
        px = -length / 2 + pier / 2 + i * (pier + span)
        for sy in (-1, 1):
            ms.box('euc_stone', (pier * 0.6, 0.1, 0.11), at=(px, sy * (depth / 2 - 0.03), zt), lod=0, frame=f)
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
