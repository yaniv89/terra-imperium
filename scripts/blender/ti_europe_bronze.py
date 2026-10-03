# scripts/blender/ti_europe_bronze.py
# The Europe kit for the Bronze Age (art spec section 3b: a town is layout x kit), from the sheets
# in plans/art/kits/europe/bronze/: houses.png, street.png, roofscape.png, materials.png and the two
# landmarks. Timber longhouses of ochre wattle-and-daub between oak posts on low fieldstone
# footings, under hipped roofs of reed thatch (poor), turf (common) or golden straw (rich) with a
# ridge pole held by crossed pegs; wattle fences round the plots, a packed-earth street, a stone
# well, lean-to woodsheds, barrels, looms, garden beds and hay; market stalls under team cloth.
# Landmarks: a sarsen stone circle with trilithons and bluestones (the north and west), and a
# Minoan palace of cream ashlar with red columns, red and blue friezes, orange roofs, a grand stair
# and horns of consecration (the Aegean).
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `eu_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402  (ti_town imports bpy first)
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['eu_daub', 'eu_lime', 'eu_reed', 'eu_straw', 'eu_turf', 'eu_oak', 'eu_wattle', 'eu_carved', 'eu_garden',
       'eu_grass', 'eu_chalk', 'eu_sarsen', 'eu_bluestone', 'eu_ashlar', 'eu_plaster', 'eu_roof', 'eu_red',
       'eu_black', 'eu_blue', 'eu_paving', 'eu_woad', 'eu_earth', 'eu_earth_fringe', 'eu_earth_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'eu_earth': 'Ground', 'eu_earth_fringe': 'Ground', 'eu_earth_square': 'Ground'})
if 'eu_earth_fringe' not in tt.FRINGES:
    tt.FRINGES.append('eu_earth_fringe')


def _mat(name):
    import bpy
    return bpy.data.materials.new(name)


def mat_thatch(name, colors, course=0.05, rough=0.95):
    """Thatch: courses of straw (darker at each course's foot, every `course` units of height, so
    they run level round a hipped roof) over fine streaks running down the slope."""
    mat = _mat(name)
    nt, bsdf = tm._nodes(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs['Vector'])
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(sep.outputs['Y'], add.inputs[1])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(add.outputs[0], comb.inputs['X'])
    nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    streak = nt.nodes.new('ShaderNodeTexWave')  # fine straws down the slope
    streak.wave_type = 'BANDS'
    streak.bands_direction = 'X'
    streak.inputs['Scale'].default_value = 90.0
    streak.inputs['Distortion'].default_value = 5.0
    streak.inputs['Detail'].default_value = 3.0
    nt.links.new(comb.outputs['Vector'], streak.inputs['Vector'])
    courses = nt.nodes.new('ShaderNodeTexWave')  # level courses
    courses.wave_type = 'BANDS'
    courses.bands_direction = 'Z'
    courses.wave_profile = 'SAW'
    courses.inputs['Scale'].default_value = 2 * math.pi / (20 * course)
    courses.inputs['Distortion'].default_value = 1.5
    nt.links.new(tc.outputs['Object'], courses.inputs['Vector'])
    n = tm._noise(nt, 30.0, 4.0, 0.6)
    m1 = nt.nodes.new('ShaderNodeMath')
    m1.operation = 'MULTIPLY'
    nt.links.new(n.outputs['Fac'], m1.inputs[0])
    nt.links.new(streak.outputs['Fac'], m1.inputs[1])
    m2 = nt.nodes.new('ShaderNodeMath')
    m2.operation = 'MULTIPLY_ADD'
    nt.links.new(courses.outputs['Fac'], m2.inputs[0])
    m2.inputs[1].default_value = 0.45
    nt.links.new(m1.outputs[0], m2.inputs[2])
    stops = [(0.15 + 0.6 * i / (len(colors) - 1), c) for i, c in enumerate(colors)]
    r = tm._ramp(nt, m2.outputs[0], stops)
    nt.links.new(r.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    tm._bump(nt, bsdf, m2.outputs[0], 0.6, 0.004)
    return mat


def mat_paving(name, stone, mortar, slab):
    """Stone slabs laid flat (a brick bond on the ground plane), varied slab tones, worn joints."""
    mat = _mat(name)
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


EARTH = ('#8a6c49', '#a08259', '#857a4c', '#7d6343')  # sheet 4: firm packed earth, #8D7F6A, warmed


def make_materials():
    # walls (sheet 1: ochre daub #C9A062; houses sheet: limewash ochre on the rich house)
    tm.mat_simple('eu_daub', ['#b48a52', '#c9a062', '#d3ad72', '#a98049'], scale=26.0, bump=0.4, dirt=True)
    tm.mat_simple('eu_lime', ['#d2a453', '#dfb766', '#e8c47c', '#c99b4b'], scale=16.0, bump=0.25, dirt=True)
    # roofs (sheet 2: reed thatch #D6B067; sheet 3: turf #6F7F56)
    mat_thatch('eu_straw', ['#6e4f24', '#a17a3c', '#c49a52', '#d2aa62'])
    mat_thatch('eu_reed', ['#4f3d26', '#75603e', '#927a52', '#a68d60'], course=0.04)
    tm.mat_simple('eu_turf', ['#3d4a20', '#56652f', '#66753a', '#5a5432'], scale=55.0, bump=0.8)
    # wood (sheet 5: oak #7A6A52; sheet 6: willow #7E6B4E with carved oak trim)
    tm.mat_simple('eu_oak', ['#55473a', '#7a6a52', '#8a7a62', '#64553f'], scale=8.0,
                  stripes={'dir': 'Y', 'scale': 70.0, 'distortion': 6.0}, bump=0.4)
    tm.mat_mudwall('eu_wattle', wash='#7e6b4e', brick='#806c4c', brick2='#5c4a33', mortar='#3a2e22', wash_cover=0.0,
                   bond=(0.045, 0.011, 0.002))
    tm.mat_simple('eu_carved', ['#4a3b29', '#6b5940', '#87704f'], scale=12.0,
                  stripes={'dir': 'Z', 'scale': 45.0, 'distortion': 1.5}, bump=0.6)
    tm.mat_simple('eu_garden', ['#3c5822', '#58782e', '#6d8a38', '#5e4a32'], scale=80.0,
                  stripes={'dir': 'X', 'scale': 30.0, 'distortion': 3.0}, bump=0.7)
    tm.mat_simple('eu_grass', ['#58702c', '#6d8434', '#83963f', '#66783a'], scale=45.0, bump=0.5)
    tm.mat_earth('eu_chalk', colors=('#6a8232', '#7d9440', '#d4cdb8', '#6e8636'))
    # stone (sheet 8: sarsen #8E8E8E; landmark sheet: bluestone)
    tm.mat_simple('eu_sarsen', ['#585750', '#706f68', '#83817a', '#7a7560'], scale=16.0, bump=0.9)
    tm.mat_simple('eu_bluestone', ['#3c4550', '#55606c', '#6c7682'], scale=20.0, bump=0.8)
    # the Minoan palace: cream ashlar, plaster, orange roofs, red columns with black capitals, friezes
    tm.mat_mudwall('eu_ashlar', wash='#ddd0b3', brick='#ddd0b3', brick2='#cbbd9b', mortar='#9e9076', wash_cover=0.0,
                   bond=(0.07, 0.034, 0.003))
    tm.mat_simple('eu_plaster', ['#ddd0b4', '#e9dfc8', '#d4c5a4'], scale=18.0, bump=0.2, dirt=True)
    tm.mat_simple('eu_roof', ['#c4722f', '#d68a40', '#e19a50', '#c97a36'], scale=14.0, bump=0.25)
    tm.mat_simple('eu_red', ['#7e2016', '#9d2c1e', '#b0372a'], scale=18.0, bump=0.15)
    tm.mat_simple('eu_black', ['#171514', '#262220', '#1d1a18'], scale=18.0, bump=0.1)
    tm.mat_simple('eu_blue', ['#2c4b86', '#3a5e9e', '#294274'], scale=18.0, bump=0.1)
    mat_paving('eu_paving', stone=('#d8ccb0', '#c8ba9b', '#e2d7bd'), mortar='#9a8c72', slab=(0.08, 0.05))
    tm.mat_simple('eu_woad', ['#3a5678', '#4d6a90', '#33496a'], scale=26.0, bump=0.2,
                  stripes={'dir': 'Z', 'scale': 30.0, 'distortion': 2.0})
    for n in ('eu_earth', 'eu_earth_fringe'):
        tm.mat_earth(n, colors=EARTH)
    tm.mat_earth('eu_earth_square', colors=('#9a7c54', '#ae8f66', '#ba9a70', '#937450'))


if not any(n == 'europe_bronze' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('europe_bronze', make_materials))

EARTH_GROUND = dict(mat='eu_earth')  # merge into a town's ground dict

# ---- footprints (only for the layout check in plot_layout; no effect on the model) --------------

FOOT = []


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    pts = []
    for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
        p = f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))
        pts.append((p.x, p.y))
    FOOT.append((tag, pts))


def foot_circle(x, y, r, tag=''):
    FOOT.append((tag, [(x + r * math.cos(2 * math.pi * i / 20), y + r * math.sin(2 * math.pi * i / 20)) for i in range(20)]))


def obox(ms, mat, size, at=(0, 0, 0), frame=None, lod=2, only=None, rot_z=0.0):
    """A plain box (base at `at`) shown only at the LODs in `only` (the Mesher's box has no
    `only`): a simplified stand-in for LOD1 or LOD2."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = tm.Mesher._m(at, rot_z)
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, lod, m, only=only)


# ---- roofs --------------------------------------------------------------------------------------

def hip_roof(ms, f, w, d, z, rise, mat, axis='x', ridge=None, band=0.035, lod=2):
    """A thick hipped thatch or turf roof over a w x d eave footprint (eave top at z), its ridge
    along local X (or Y), `ridge` the ridge's half length. One closed solid: a vertical eave band
    `band` thick, two long slopes and two hips. Returns the frame whose X runs along the ridge."""
    if axis == 'y':
        f = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        w, d = d, w
    W, D = w / 2, d / 2
    r = max(W - D, 0.22 * w) if ridge is None else ridge
    r = max(0.0, min(r, W - 0.03))
    bm = bmesh.new()
    corners = ((-W, -D), (W, -D), (W, D), (-W, D))
    b = [bm.verts.new((x, y, z - band)) for x, y in corners]
    t = [bm.verts.new((x, y, z)) for x, y in corners]
    r0, r1 = bm.verts.new((-r, 0, z + rise)), bm.verts.new((r, 0, z + rise))
    bm.faces.new((b[3], b[2], b[1], b[0]))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    bm.faces.new((t[0], t[1], r1, r0))
    bm.faces.new((t[2], t[3], r0, r1))
    bm.faces.new((t[1], t[2], r1))
    bm.faces.new((t[3], t[0], r0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed solid: safe to orient
    ms.add(bm, mat, lod, matrix=f.copy())
    return f, r


def ridge_pole(ms, f, r, z, pegs=5, over=0.035, peg_len=0.075, lod=1):
    """A ridge pole along the frame's X over a ridge of half length r at height z, held by pairs of
    crossed pegs straddling it (they read as upright sticks from the front, cross strokes from
    above, as on the sheets)."""
    length = 2 * r + 2 * over
    ms.cyl('eu_oak', 0.011, 0.011, length, at=(-length / 2, 0, z + 0.008), rot=(0, 90, 0), segs=6, lod=lod, frame=f)
    for k in range(pegs):
        px = -length / 2 + 0.02 + (length - 0.04) * k / max(1, pegs - 1)
        crossed(ms, f, px, z, peg_len, 30)


def crossed(ms, f, x, z, length, ang, t=0.009, lod=0):
    """Two sticks crossing at (x, 0, z) in the frame's YZ plane (across a ridge along X)."""
    for s in (-1, 1):
        sf = f @ Matrix.Translation(Vector((x, 0, z))) @ Matrix.Rotation(math.radians(s * ang), 4, 'X')
        ms.box('eu_oak', (t, t, length), at=(0, 0, -length * 0.42), lod=lod, frame=sf)


# ---- small things -------------------------------------------------------------------------------

def wattle(ms, f, pts, h=0.1, step=0.13, gaps=(), lod=1, posts=True):
    """A woven willow fence along the polyline `pts` (frame f's local x, y): panels between oak
    stakes. `gaps` are (segment index, centre fraction, width) openings."""
    for si, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
        length = math.hypot(x1 - x0, y1 - y0)
        if length < 0.02:
            continue
        ux, uy = (x1 - x0) / length, (y1 - y0) / length
        yaw = math.degrees(math.atan2(uy, ux))
        spans, pos = [], 0.0
        for c, gw in sorted((c, gw) for s, c, gw in gaps if s == si):
            a, b = c * length - gw / 2, c * length + gw / 2
            if a > pos:
                spans.append((pos, a))
            pos = b
        if pos < length:
            spans.append((pos, length))
        for a, b in spans:
            if b - a < 0.03:
                continue
            m = (a + b) / 2
            ms.box('eu_wattle', (b - a, 0.012, h), at=(x0 + ux * m, y0 + uy * m, G), rot_z=yaw, lod=lod, frame=f)
            if posts:
                n = max(1, round((b - a) / step))
                for i in range(n + 1):
                    p = a + (b - a) * i / n
                    ms.cyl('eu_oak', 0.008, 0.007, h + 0.022, at=(x0 + ux * p, y0 + uy * p, G), segs=5, lod=0, frame=f)


def barrel(ms, f, x, y, s=1.0, z=G):
    ms.cyl('eu_oak', 0.024 * s, 0.024 * s, 0.056 * s, at=(x, y, z), segs=8, lod=0, frame=f)
    ms.cyl('eu_black', 0.0255 * s, 0.0255 * s, 0.006 * s, at=(x, y, z + 0.04 * s), segs=8, lod=0, frame=f, caps=False)


def pot(ms, f, x, y, s=1.0, z=G):
    tt.jar(ms, f, x, y, s, z=z, mat='terracotta')


def bits(ms, f, x, y, rng, n=4):
    """A heap of barrels, baskets, pots and a crate round (x, y) in frame f."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.4:
            barrel(ms, f, px, py, rng.uniform(0.85, 1.15))
        elif r < 0.6:
            pot(ms, f, px, py, rng.uniform(0.8, 1.1))
        elif r < 0.8:
            tt.basket(ms, f, px, py, rng.uniform(0.9, 1.2))
        else:
            ms.box('eu_oak', (0.06, 0.05, 0.045), at=(px, py, G), rot_z=rng.uniform(-20, 20), lod=0, frame=f, bevel=0.003)


def woodshed(ms, x, y, yaw=0.0, w=0.28, d=0.14):
    """A lean-to log store: two oak posts in front, a sloping reed roof, stacked logs under it."""
    f = tm.house_frame(x, y, yaw)
    foot(f, w, d, tag='prop')
    hf, hb = 0.15, 0.19
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('eu_oak', (0.016, 0.016, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('eu_oak', (0.016, 0.016, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    rf = f @ Matrix.Translation(Vector((0, 0, G + (hf + hb) / 2 + 0.008))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box('eu_reed', (w + 0.04, d + 0.06, 0.016), at=(0, 0, 0), lod=1, frame=rf)
    for row in range(3):  # the log stack: rows of logs lying along X
        for k in range(4 - row):
            ms.cyl('timber', 0.014, 0.014, w - 0.04, at=(-w / 2 + 0.02, -0.03 + k * 0.022 + row * 0.011, G + 0.014 + row * 0.024),
                   rot=(0, 90, 0), segs=6, lod=0, frame=f)
    obox(ms, 'timber', (w - 0.04, 0.06, 0.07), at=(0, 0.035, G), lod=1, only=1, frame=f)


def loom(ms, x, y, yaw=0.0, cloth='eu_woad'):
    """A warp-weighted loom: two leaning uprights, a top beam, the woven cloth and its loom weights."""
    f = tm.house_frame(x, y, yaw)
    foot(f, 0.2, 0.08, tag='prop')
    lf = f @ Matrix.Rotation(math.radians(-10), 4, 'X')
    for sx in (-0.08, 0.08):
        ms.box('eu_oak', (0.014, 0.014, 0.22), at=(sx, 0, G), lod=1, frame=lf)
    ms.box('eu_oak', (0.2, 0.016, 0.016), at=(0, 0, G + 0.2), lod=1, frame=lf)
    ms.box(cloth, (0.14, 0.006, 0.12), at=(0, -0.004, G + 0.07), lod=1, frame=lf)
    for k in range(5):
        ms.box('stone', (0.016, 0.012, 0.018), at=(-0.06 + 0.03 * k, -0.004, G + 0.045), lod=0, frame=lf)
    for sx in (-0.08, 0.08):  # the back props
        ms.box('eu_oak', (0.01, 0.01, 0.2), at=(sx, 0.06, G), rot_z=0, lod=0, frame=f @ Matrix.Rotation(math.radians(20), 4, 'X'))


def hide_rack(ms, x, y, yaw=0.0):
    """A drying rack: two A-frames, a pole, hides and cloth hanging."""
    f = tm.house_frame(x, y, yaw)
    foot(f, 0.2, 0.06, tag='prop')
    for sx in (-0.085, 0.085):
        for s in (-1, 1):
            ms.box('eu_oak', (0.01, 0.01, 0.15), at=(sx, 0, G), lod=0, frame=f @ Matrix.Rotation(math.radians(s * 12), 4, 'X'))
    ms.box('eu_oak', (0.2, 0.012, 0.012), at=(0, 0, G + 0.14), lod=1, frame=f)
    ms.box('linen', (0.07, 0.006, 0.08), at=(-0.045, 0, G + 0.065), lod=1, frame=f)
    ms.box('eu_carved', (0.06, 0.006, 0.07), at=(0.045, 0, G + 0.075), lod=1, frame=f)


def garden_bed(ms, f, x, y, w, d, lod=1):
    ms.box('eu_garden', (w, d, 0.016), at=(x, y, G), lod=lod, frame=f, bevel=0.004)


def haystack(ms, x, y, r=0.07, h=0.15):
    ms.cyl('eu_straw', r, r * 0.9, h * 0.45, at=(x, y, G), segs=10, lod=1)
    ms.cyl('eu_straw', r * 0.9, 0.0, h * 0.55, at=(x, y, G + h * 0.45), segs=10, lod=1)
    foot_circle(x, y, r, 'prop')


def grass_patch(ms, f, x, y, w, d, lod=1):
    ms.quad_strip('eu_grass', [(x - w / 2, y - d / 2, G + 0.003), (x + w / 2, y - d / 2, G + 0.003),
                               (x + w / 2, y + d / 2, G + 0.003), (x - w / 2, y + d / 2, G + 0.003)], lod=lod, frame=f)


# ---- houses -------------------------------------------------------------------------------------
# Every house fills its plot (w x d, local -Y the front facing the town centre): the roof's eaves
# reach the plot's edges, so the roofscape keeps the town's rhythm; walls stand inside the eaves.

def _walls(ms, f, bw, bd, h, wall, post_step, door_x, door_w, corner=0.022, footing=True):
    if footing:
        ms.box('stone', (bw + 0.014, bd + 0.014, 0.028), at=(0, 0, G - 0.004), lod=1, frame=f)
    ms.box(wall, (bw, bd, h), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('eu_oak', (corner, corner, h + 0.004), at=(sx * (bw / 2 - corner * 0.3), sy * (bd / 2 - corner * 0.3), G), lod=1, frame=f)
    n = max(2, round(bw / post_step))
    for sy in (-1, 1):
        for i in range(1, n):
            px = -bw / 2 + bw * i / n
            if sy < 0 and abs(px - door_x) < door_w / 2 + 0.03:
                continue
            ms.box('eu_oak', (0.016, 0.01, h), at=(px, sy * (bd / 2 + 0.003), G), lod=0, frame=f)
    m = max(1, round(bd / post_step))
    for sx in (-1, 1):
        for i in range(1, m):
            ms.box('eu_oak', (0.01, 0.016, h), at=(sx * (bw / 2 + 0.003), -bd / 2 + bd * i / m, G), lod=0, frame=f)


def _door(ms, f, x, y, w, h, jamb='eu_oak'):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, G), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box(jamb, (0.02, 0.016, h + 0.01), at=(x + sx * (w / 2 + 0.01), y - 0.006, G), lod=0, frame=f)
    ms.box('eu_oak', (w + 0.05, 0.018, 0.016), at=(x, y - 0.006, G + h), lod=0, frame=f)


def poor_house(ms, rng, x, y, w, d, yaw=None, yard=0.0, side=None, garden=True):
    """The poor house (sheet: 4 x 6 m, 3.2 m): a small wattle-and-daub hut, its narrow end with the
    door to the front, under a steep reed-thatch hip with crossed poles at both ridge ends; the
    rest of the plot a fenced garden or a hay and wood corner."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='plot')
    hw = min(max(w * 0.56, 0.36), 0.48)
    hd = min(max(d * 0.9, 0.44), 0.62)
    side = side if side is not None else rng.choice([-1, 1])
    hx = side * (w - hw) / 2
    hf = f @ Matrix.Translation(Vector((hx, (d - hd) / 2 * 0.5, 0)))
    foot(hf, hw, hd, tag='house')
    over = 0.04
    bw, bd, h = hw - 2 * over, hd - 2 * over, 0.13
    door_x = 0.0
    _walls(ms, hf, bw, bd, h, 'eu_daub', 0.2, door_x, 0.07, corner=0.018, footing=False)
    _door(ms, hf, door_x, -bd / 2, 0.07, 0.115)
    rf, r = hip_roof(ms, hf, hw, hd, G + h + 0.008, 0.27, 'eu_reed', axis='y', ridge=max((hd - hw) / 2, 0.16 * hd), band=0.03)
    for px in (-r, r):  # the crossed poles at the ridge ends
        crossed(ms, rf, px, G + h + 0.008 + 0.27, 0.13, 26, t=0.011, lod=1)
    pot(ms, hf, door_x + 0.08, -bd / 2 - 0.04, 0.9)
    tt.basket(ms, hf, door_x - 0.08, -bd / 2 - 0.035, 1.0)
    rest = w - hw
    if rest > 0.16:
        gx = -side * hw / 2
        if garden:  # a fenced vegetable plot beside the hut
            gw = rest - 0.06
            garden_bed(ms, f, gx, -0.02, gw * 0.8, d * 0.55)
            xa, xb = gx - side * (gw / 2 + 0.01), gx + side * (gw / 2 + 0.02)
            wattle(ms, f, [(xa, -d * 0.36), (xb, -d * 0.36), (xb, d * 0.3), (xa, d * 0.3)], h=0.08, gaps=((0, 0.5, 0.06),))
        else:  # hay and wood
            haystack(ms, *(f @ Vector((gx, 0.05, 0)))[:2], r=min(0.08, rest * 0.35), h=0.15)
            bits(ms, f, gx, -d * 0.3, rng, 2)
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def _yard(ms, rng, f, w, d, yard):
    """A wattle-fenced yard behind the house (toward the town's edge) with a garden bed, hay or
    a log store in it."""
    y0, y1 = d / 2 - 0.02, d / 2 + yard
    wattle(ms, f, [(-w / 2 + 0.02, y0), (-w / 2 + 0.02, y1), (w / 2 - 0.02, y1), (w / 2 - 0.02, y0)], h=0.09, step=0.15)
    grass_patch(ms, f, 0, (y0 + y1) / 2, w - 0.06, y1 - y0 - 0.02)
    r = rng.random()
    if r < 0.45:
        garden_bed(ms, f, -w * 0.18, (y0 + y1) / 2 + 0.01, w * 0.45, yard * 0.55)
        bits(ms, f, w * 0.25, (y0 + y1) / 2, rng, 2)
    elif r < 0.75:
        p = f @ Vector((w * 0.2, (y0 + y1) / 2 + 0.01, 0))
        haystack(ms, p.x, p.y, r=0.075, h=0.16)
        bits(ms, f, -w * 0.2, (y0 + y1) / 2, rng, 3)
    else:
        for k in range(5):
            ms.cyl('timber', 0.013, 0.013, w * 0.4, at=(-w * 0.3, (y0 + y1) / 2 - 0.03 + (k % 3) * 0.024, G + 0.013 + (k // 3) * 0.022),
                   rot=(0, 90, 0), segs=6, lod=0, frame=f)
        bits(ms, f, w * 0.3, (y0 + y1) / 2, rng, 2)


def common_house(ms, rng, x, y, w, d, yaw=None, yard=0.0, awning=False, front_fence=False, roof='eu_turf', window=True):
    """The common longhouse (sheet: 12 x 6 m, 3.5 m): ochre daub between oak posts on a fieldstone
    footing, a plank door and a small window, a hipped turf roof with a pegged ridge pole."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    over = 0.045
    bw, bd, h = w - 2 * over, d - 2 * over, 0.2
    dx = rng.uniform(-0.18, 0.18) * bw
    _walls(ms, f, bw, bd, h, 'eu_daub', 0.13, dx, 0.085)
    _door(ms, f, dx, -bd / 2, 0.085, 0.15)
    if window:
        wx = dx + (0.2 if dx < 0 else -0.2) * bw + (0.06 if dx < 0 else -0.06)
        ms.box('dark', (0.05, 0.01, 0.036), at=(wx, -bd / 2 - 0.004, G + 0.1), lod=0, frame=f)
        ms.box('eu_oak', (0.066, 0.012, 0.01), at=(wx, -bd / 2 - 0.006, G + 0.095), lod=0, frame=f)
    ms.box('dark', (0.045, 0.01, 0.034), at=(rng.uniform(-0.2, 0.2) * bw, bd / 2 + 0.004, G + 0.11), lod=0, frame=f)
    rise = 0.25
    rf, r = hip_roof(ms, f, w, d, G + h + 0.008, rise, roof, ridge=max((w - d) / 2, 0.24 * w))
    ridge_pole(ms, rf, r, G + h + 0.008 + rise, pegs=max(3, round((2 * r + 0.07) / 0.075)))
    if awning:
        tt.front_shade(ms, f, dx, -d / 2 + 0.012, 0.22, depth=0.14, z=0.17, mat='team_cloth')
    for k in range(rng.randint(1, 2)):
        barrel(ms, f, dx + (0.1 + 0.055 * k) * (1 if dx < 0 else -1), -bd / 2 - 0.045, rng.uniform(0.9, 1.1))
    if front_fence:
        fy = -d / 2 - 0.1
        wattle(ms, f, [(-w / 2 + 0.03, -d / 2 + 0.04), (-w / 2 + 0.03, fy), (w / 2 - 0.03, fy), (w / 2 - 0.03, -d / 2 + 0.04)],
               h=0.085, gaps=((1, 0.5 + dx / (w - 0.06), 0.1),))
        foot(f, w, 0.1, 0, -d / 2 - 0.05, tag='fence')
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, porch=False, yard=0.0, fence=True, awning=False, front=0.13):
    """The rich hall (sheet: 16 x 8 m, 4 m): ochre lime-washed walls with close-set oak posts,
    carved door posts, a hipped golden straw thatch with a pegged ridge pole, a wattle-fenced front
    yard with a garden bed, a bench and pots; `porch` adds a gabled porch on carved posts."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    over = 0.05
    bw, bd, h = w - 2 * over, d - 2 * over, 0.24
    dx = 0.0 if porch else rng.uniform(-0.1, 0.1) * bw
    _walls(ms, f, bw, bd, h, 'eu_lime', 0.09, dx, 0.1, corner=0.026)
    _door(ms, f, dx, -bd / 2, 0.1, 0.18, jamb='eu_carved')
    for wx in (-bw * 0.3, bw * 0.3):
        if abs(wx - dx) > 0.12:
            ms.box('dark', (0.05, 0.01, 0.04), at=(wx, -bd / 2 - 0.004, G + 0.13), lod=0, frame=f)
    rise = 0.29
    rf, r = hip_roof(ms, f, w, d, G + h + 0.008, rise, 'eu_straw', ridge=max((w - d) / 2, 0.27 * w), band=0.04)
    ridge_pole(ms, rf, r, G + h + 0.008 + rise, pegs=max(4, round((2 * r + 0.07) / 0.07)), peg_len=0.085)
    if porch:  # a small gabled porch on two carved posts over the door
        py = -d / 2 - 0.06
        for sx in (-1, 1):
            ms.box('eu_carved', (0.024, 0.024, 0.2), at=(dx + sx * 0.085, py - 0.04, G), lod=1, frame=f)
        pf = f @ Matrix.Translation(Vector((dx, py, 0)))
        hip_roof(ms, pf, 0.24, 0.22, G + 0.2, 0.1, 'eu_straw', axis='y', ridge=0.09, band=0.025, lod=1)
    if awning:
        tt.front_shade(ms, f, bw * 0.3, -d / 2 + 0.012, 0.22, depth=0.14, z=0.2, mat='team_cloth')
    if fence and front > 0.04:  # the fenced front yard
        fy = -d / 2 - front
        wattle(ms, f, [(-w / 2 - 0.02, -d / 2 + 0.06), (-w / 2 - 0.02, fy), (w / 2 + 0.02, fy), (w / 2 + 0.02, -d / 2 + 0.06)],
               h=0.1, step=0.12, gaps=((1, 0.5 + dx / (w + 0.04), 0.12),))
        foot(f, w + 0.04, front, 0, -d / 2 - front / 2, tag='fence')
        side = 1 if dx <= 0 else -1
        garden_bed(ms, f, side * w * 0.3, -d / 2 - front / 2 - 0.005, w * 0.26, front * 0.55)
        pot(ms, f, -side * w * 0.36, -d / 2 - front * 0.5, 1.05)
        ms.box('eu_oak', (0.12, 0.035, 0.035), at=(-side * w * 0.22, -bd / 2 - 0.04, G), lod=0, frame=f)  # a bench
    for k in range(2):
        barrel(ms, f, (bw / 2 - 0.05) * (1 if dx <= 0 else -1) - 0.055 * k, -bd / 2 - 0.035, 1.0)
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def europe_house(ms, rng, slot):
    """Build one house from a slot dict: x, y, w, d, kind ('poor', 'common', 'rich') and options."""
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


# ---- the street: stalls, the well, the gate, granaries ------------------------------------------

def stall(ms, x, y, rng, yaw=None, cloth='team_cloth', w=0.3, d=0.22):
    """A market stall: four oak posts, a cloth draped over a ridge pole (team cloth or straw mat),
    a plank counter with baskets, a cheese, pots and a barrel beside it."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='stall')
    hf, hb = 0.19, 0.23
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('eu_oak', (0.014, 0.014, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('eu_oak', (0.014, 0.014, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    cf = f @ Matrix.Translation(Vector((0, 0, G + (hf + hb) / 2 + 0.008))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(cloth, (w + 0.05, d + 0.06, 0.008), at=(0, 0, 0), lod=1, frame=cf)
    ms.box(cloth, (w + 0.05, 0.006, 0.04), at=(0, -d / 2 - 0.03, G + hf - 0.035), lod=0, frame=f)  # the valance
    ms.box('eu_oak', (w - 0.03, d * 0.45, 0.07), at=(0, -d * 0.18, G), lod=0, frame=f, bevel=0.003)
    for k in range(3):
        gx = -w / 2 + 0.06 + k * (w - 0.12) / 2
        r = rng.random()
        if r < 0.4:
            tt.basket(ms, f, gx, -d * 0.18, 0.8, z=G + 0.07)
        elif r < 0.7:
            ms.cyl('eu_lime', 0.028, 0.028, 0.02, at=(gx, -d * 0.18, G + 0.07), segs=10, lod=0, frame=f)  # a cheese
        else:
            pot(ms, f, gx, -d * 0.18, 0.55, z=G + 0.07)
    barrel(ms, f, w / 2 + 0.03, -d / 2 - 0.01, rng.uniform(0.9, 1.1))


def well(ms, x, y, yaw=20):
    """The street's stone well (the shared kit's well: a stone ring, a timber frame and bucket)."""
    foot_circle(x, y, 0.15, 'well')
    return tt.well(ms, x, y, yaw)


def timber_gate(ms, rng, x, y, yaw=0.0, width=0.5, h=0.55):
    """The town gate: two tall oak gate posts, a lintel and a beam with crossed ends, open plank
    leaves, a team pennant on the left post and short palisade wings."""
    f = tm.house_frame(x, y, yaw)
    foot(f, width + 0.8, 0.3, tag='gate')
    for sx in (-1, 1):
        ms.cyl('eu_oak', 0.035, 0.03, h, at=(sx * (width / 2 + 0.03), 0, G), segs=8, lod=2, frame=f)
        lf = f @ Matrix.Translation(Vector((sx * (width / 2 - 0.005), -0.02, G))) @ Matrix.Rotation(math.radians(sx * -70), 4, 'Z')
        ms.box('eu_oak', (0.012, width / 2 - 0.02, h * 0.62), at=(0, -(width / 2 - 0.02) / 2, 0), lod=1, frame=lf)
    ms.box('eu_oak', (width + 0.2, 0.06, 0.05), at=(0, 0, G + h - 0.1), lod=1, frame=f)
    ms.box('eu_oak', (width + 0.14, 0.04, 0.035), at=(0, 0, G + h - 0.03), lod=0, frame=f)
    for sx in (-1, 1):  # crossed horns over each post
        cf = f @ Matrix.Translation(Vector((sx * (width / 2 + 0.03), 0, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
        crossed(ms, cf, 0, G + h + 0.02, 0.12, 28, t=0.014)
    ms.box('team_cloth', (width - 0.08, 0.006, 0.05), at=(0, -0.035, G + h - 0.17), lod=1, frame=f)
    px = -(width / 2 + 0.03)
    ms.cyl('eu_oak', 0.01, 0.008, 0.25, at=(px, 0, G + h), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, px, 0, G + h + 0.245, yaw=-160, w=0.2, h=0.12)
    pts = []
    for sx in (-1, 1):
        for k in range(6):
            p = f @ Vector((sx * (width / 2 + 0.11 + 0.055 * k), 0.02, 0))
            pts.append((p.x, p.y))
    import ti_bronze as tb
    tb.stakes(ms, rng, pts, h=(0.3, 0.38))


def raised_granary(ms, x, y, yaw=0.0, s=1.0):
    """A small plank granary raised on four posts with stone caps, under a straw hip, a ladder."""
    f = tm.house_frame(x, y, yaw)
    foot(f, 0.3 * s, 0.26 * s, tag='granary')
    w, d = 0.24 * s, 0.2 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('eu_oak', 0.014, 0.014, 0.08, at=(sx * w * 0.4, sy * d * 0.4, G), segs=6, lod=1, frame=f)
            ms.cyl('stone', 0.03, 0.022, 0.016, at=(sx * w * 0.4, sy * d * 0.4, G + 0.08), segs=8, lod=0, frame=f)
    ms.box('eu_oak', (w + 0.03, d + 0.03, 0.02), at=(0, 0, G + 0.096), lod=1, frame=f)
    ms.box('eu_oak', (w, d, 0.14 * s), at=(0, 0, G + 0.116), lod=2, frame=f, bevel=0.003)
    ms.box('door', (0.06, 0.01, 0.08), at=(0, -d / 2 - 0.003, G + 0.12), lod=0, frame=f)
    hip_roof(ms, f, w + 0.07, d + 0.07, G + 0.116 + 0.14 * s, 0.15 * s, 'eu_straw', ridge=0.04, band=0.025)
    tt.ladder(ms, f, 0.03, -d / 2 - 0.07, 0.11, lean=22)


# ---- landmark 1: the stone circle ----------------------------------------------------------------

def stone_circle(ms, rng, x, y, dia=1.6, yaw=None, top=0.5):
    """The stone circle (sheet: a 16 m sarsen ring, 5 m to the lintels, on a 20 m grass and chalk
    patch): a ring of sarsen uprights capped by a continuous ring of lintels with a gap facing the
    front, a horseshoe of five taller trilithons inside opening to it, a ring of small bluestones,
    an altar stone, two fallen stones and a worn chalk path. `dia` is the ring's diameter; smaller
    rings keep the stones' size and get fewer of them."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    R = dia / 2
    s = dia / 1.6
    hs = min(1.0, 0.7 + 0.3 * s)
    foot_circle(x, y, R * 1.2, 'circle')
    # the grass and chalk patch (a disc) and the chalk path in through the gap
    bm = bmesh.new()
    n = 28
    vs = [bm.verts.new((R * 1.2 * math.cos(2 * math.pi * i / n), R * 1.2 * math.sin(2 * math.pi * i / n), G + 0.003)) for i in range(n)]
    bm.faces.new(vs)
    ms.add(bm, 'eu_chalk', 2, matrix=f.copy())
    ms.quad_strip('eu_chalk', [(-0.055, -R * 1.2, G + 0.005), (0.055, -R * 1.2, G + 0.005), (0.07, -R * 0.35, G + 0.005),
                               (-0.07, -R * 0.35, G + 0.005)], lod=1, frame=f)
    up_h = 0.41 * hs
    count = max(14, round(2 * math.pi * R / 0.167))
    pitch = 2 * math.pi / count
    gap = {0}  # the opening faces the front (local -Y): stone index 0 sits there, left out
    a0 = -math.pi / 2
    tops = []
    for i in range(count):
        a = a0 + i * pitch
        if i in gap:
            tops.append(None)
            continue
        hh = up_h + rng.uniform(-0.015, 0.012)
        sf = f @ Matrix.Translation(Vector((R * math.cos(a), R * math.sin(a), 0))) @ Matrix.Rotation(a + math.pi / 2 + rng.uniform(-0.05, 0.05), 4, 'Z')
        sw = 2 * math.pi * R / count * 0.68
        ms.box('eu_sarsen', (sw, 0.1, hh), at=(0, 0, G - 0.01), lod=1, frame=sf, bevel=0.01, taper=0.88)
        tops.append(hh)
    # lintels from stone to stone (a bit high so they sit on the tallest upright)
    lz = G - 0.01 + up_h + 0.012
    for i in range(count):
        j = (i + 1) % count
        if tops[i] is None or tops[j] is None:
            continue
        am = a0 + (i + 0.5) * pitch
        chord = 2 * R * math.sin(pitch / 2)
        lf = f @ Matrix.Translation(Vector((R * math.cos(am), R * math.sin(am), 0))) @ Matrix.Rotation(am + math.pi / 2, 4, 'Z')
        ms.box('eu_sarsen', (chord + 0.012, 0.095, 0.07 * hs), at=(0, 0, lz - 0.02), lod=1, frame=lf, bevel=0.008)
    # the LOD2 stand-in: one ring band for uprights and lintels
    bm = bmesh.new()
    nb = 18
    ring = []
    for k, rr in enumerate((R + 0.05, R - 0.05)):
        lo = [bm.verts.new((rr * math.cos(2 * math.pi * i / nb), rr * math.sin(2 * math.pi * i / nb), G)) for i in range(nb)]
        hi = [bm.verts.new((rr * math.cos(2 * math.pi * i / nb), rr * math.sin(2 * math.pi * i / nb), lz + 0.05 * hs)) for i in range(nb)]
        ring.append((lo, hi))
    (olo, ohi), (ilo, ihi) = ring
    for i in range(nb):
        j = (i + 1) % nb
        bm.faces.new((olo[i], olo[j], ohi[j], ohi[i]))
        bm.faces.new((ilo[j], ilo[i], ihi[i], ihi[j]))
        bm.faces.new((ohi[i], ohi[j], ihi[j], ihi[i]))
    ms.add(bm, 'eu_sarsen', 2, matrix=f.copy(), only=2)
    # the trilithon horseshoe, opening to the front, the tallest at the back
    tr = R * 0.5
    for k, ang in enumerate((-70, -35, 0, 35, 70)):
        a = math.radians(90 + ang)
        th = (0.5 if ang == 0 else 0.46 if abs(ang) == 35 else 0.42) * hs
        tw = 0.21 * max(0.8, s)
        tf = f @ Matrix.Translation(Vector((tr * math.cos(a), tr * math.sin(a), 0))) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
        for sx in (-1, 1):
            ms.box('eu_sarsen', (0.075, 0.09, th), at=(sx * tw / 2 * 0.62, 0, G - 0.01), lod=1, frame=tf, bevel=0.01, taper=0.86)
        ms.box('eu_sarsen', (tw * 1.08, 0.09, 0.07 * hs), at=(0, 0, G - 0.01 + th), lod=1, frame=tf, bevel=0.008)
        obox(ms, 'eu_sarsen', (tw, 0.09, th + 0.06 * hs), at=(0, 0, G), lod=2, frame=tf, only=2)
    # the bluestones: a ring of small stones between, and a few inside the horseshoe
    nbs = max(8, round(2 * math.pi * R * 0.75 / 0.2))
    for i in range(nbs):
        a = a0 + (i + 0.5) * 2 * math.pi / nbs
        if abs(math.sin(a) + 1) < 0.08:
            continue
        rr = R * 0.75
        bh = rng.uniform(0.14, 0.2) * hs
        ms.box('eu_bluestone', (0.05, 0.04, bh), at=(rr * math.cos(a), rr * math.sin(a), G - 0.01), rot_z=math.degrees(a) + 90,
               lod=0, frame=f, bevel=0.008, taper=0.65)
    for (bx, by, bh) in ((0.0, 0.08, 0.28), (-0.12, -0.02, 0.17), (0.12, -0.02, 0.17), (-0.06, -0.14, 0.14), (0.07, -0.13, 0.15)):
        ms.box('eu_bluestone', (0.06, 0.05, bh * hs), at=(bx * s, by * s, G - 0.01), rot_z=rng.uniform(-20, 20), lod=1 if bh > 0.2 else 0,
               frame=f, bevel=0.01, taper=0.6)
    ms.box('eu_sarsen', (0.16 * s, 0.06, 0.03), at=(0, 0.2 * s, G), lod=0, frame=f, bevel=0.008)  # the altar stone
    for (fx, fy, fa) in ((-0.42, -0.45, 30), (0.38, -0.52, -50)):  # fallen stones by the entrance
        ms.box('eu_sarsen', (0.17 * hs, 0.075, 0.05), at=(fx * s, fy * s, G - 0.01), rot_z=fa, lod=0, frame=f, bevel=0.01)
    return f


# ---- landmark 2: the Minoan palace ----------------------------------------------------------------

def _column(ms, f, x, y, z, h, lod=1, r=0.02):
    """A Minoan column: a red shaft widening upward, a black cushion capital and a black base."""
    ms.cyl('eu_red', r * 0.75, r, h - 0.03, at=(x, y, z + 0.008), segs=8, lod=lod, frame=f)
    ms.cyl('eu_black', r * 1.45, r * 1.35, 0.024, at=(x, y, z + h - 0.026), segs=8, lod=0, frame=f)
    ms.cyl('eu_black', r * 1.1, r * 1.1, 0.008, at=(x, y, z), segs=8, lod=0, frame=f)


def _block(ms, f, x0, x1, y0, y1, z, h, frieze=True, roof=True, wall='eu_ashlar', lod=2):
    """A palace block from x0..x1, y0..y1, z up h: ashlar walls, a red and a blue frieze band under
    a cornice, an orange flat roof inside a low parapet."""
    w, d = x1 - x0, y1 - y0
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    ms.box(wall, (w, d, h), at=(cx, cy, z), lod=lod, frame=f, bevel=0.004)
    if frieze:
        ms.box('eu_blue', (w + 0.008, d + 0.008, 0.014), at=(cx, cy, z + h - 0.052), lod=0, frame=f)
        ms.box('eu_red', (w + 0.012, d + 0.012, 0.026), at=(cx, cy, z + h - 0.038), lod=1, frame=f)
        ms.box('eu_plaster', (w + 0.022, d + 0.022, 0.014), at=(cx, cy, z + h - 0.012), lod=1, frame=f)
    if roof:
        ms.box('eu_roof', (w - 0.02, d - 0.02, 0.006), at=(cx, cy, z + h), lod=lod, frame=f)
        for (px, py, pw, pd) in ((cx, y0 + 0.008, w, 0.016), (cx, y1 - 0.008, w, 0.016), (x0 + 0.008, cy, 0.016, d), (x1 - 0.008, cy, 0.016, d)):
            ms.box('eu_plaster', (pw, pd, 0.024), at=(px, py, z + h), lod=0, frame=f)


def _windows(ms, f, x0, x1, y, z, n, face=-1, size=(0.04, 0.05)):
    for i in range(n):
        wx = x0 + (x1 - x0) * (i + 0.5) / n
        ms.box('dark', (size[0], 0.01, size[1]), at=(wx, y + face * 0.004, z), lod=0, frame=f)


def _windows_y(ms, f, y0, y1, x, z, n, face=-1, size=(0.04, 0.05)):
    for i in range(n):
        wy = y0 + (y1 - y0) * (i + 0.5) / n
        ms.box('dark', (0.01, size[0], size[1]), at=(x + face * 0.004, wy, z), lod=0, frame=f)


def minoan_palace(ms, rng, x, y, w=2.0, d=1.8, yaw=None, top=0.8):
    """The Minoan palace (sheet: 20 x 18 m, 8 m): two-storey wings of cream ashlar round a paved
    central court, a colonnade of red columns with black capitals along the front and a two-storey
    loggia on the court's north side, red and blue friezes under the orange flat roofs, a raised
    central hall crowned by horns of consecration, a grand stair up the west wing's front with a
    team-cloth awning at its foot, potted shrubs. Smaller sizes keep the parts, scaled to fit."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='palace')
    s = min(w / 2.0, d / 1.8)
    hs = min(1.0, 0.8 + 0.2 * s)
    st = 0.3 * hs                                  # one storey (3 m at the sheet's scale)
    W, D = w / 2, d / 2
    ms.box('eu_paving', (w, d, 0.022), at=(0, 0, G - 0.002), lod=2, frame=f)
    z0 = G + 0.02
    ww = max(0.3, 0.27 * w)                         # the west wing's width
    ew = max(0.24, 0.2 * w)                         # the east wing's width
    nd = max(0.36, 0.3 * d)                         # the north wing's depth
    sd = max(0.16, 0.13 * d)                        # the front colonnade's depth
    sw = 0.13 * max(0.8, s)                          # the stair's width
    lg = 0.1 * max(0.8, s)                           # the north loggia's depth
    yN = D - nd                                     # the north wing's court face
    yS = -D + sw + 0.03                             # the west wing's front (behind the stair)
    # the north wing, two storeys, its court face a two-storey loggia; the raised central hall
    _block(ms, f, -W, W, yN + lg, D, z0, st, roof=False)
    _block(ms, f, -W, W, yN + lg, D, z0 + st, st)
    hall_w = min(0.7 * s + 0.15, w * 0.4)
    _block(ms, f, -hall_w / 2, hall_w / 2, yN + lg + 0.04, D - 0.12 * s, z0 + 2 * st, top - (z0 + 2 * st) - 0.012)
    # the loggia: a floor slab at the first storey, a roof over the second, columns at both levels
    ms.box('eu_plaster', (w - ww - ew + 0.02, lg + 0.01, 0.022), at=((-W + ww + W - ew) / 2, yN + lg / 2, z0 + st - 0.022), lod=1, frame=f)
    ms.box('eu_red', (w - ww - ew + 0.02, 0.014, 0.022), at=((-W + ww + W - ew) / 2, yN - 0.002, z0 + st - 0.04), lod=0, frame=f)
    ms.box('eu_roof', (w - ww - ew + 0.02, lg + 0.02, 0.016), at=((-W + ww + W - ew) / 2, yN + lg / 2, z0 + 2 * st - 0.016), lod=1, frame=f)
    ms.box('eu_red', (w - ww - ew + 0.03, 0.016, 0.03), at=((-W + ww + W - ew) / 2, yN - 0.004, z0 + 2 * st - 0.04), lod=1, frame=f)
    nl = max(3, round((w - ww - ew) / 0.17))
    for i in range(nl):
        cx = -W + ww + 0.06 + (w - ww - ew - 0.12) * i / (nl - 1)
        _column(ms, f, cx, yN + 0.02, z0, st - 0.02)
        _column(ms, f, cx, yN + 0.02, z0 + st, st - 0.03, lod=0)
    ms.box('eu_plaster', (w - ww - ew, 0.012, 0.05), at=((-W + ww + W - ew) / 2, yN + 0.004, z0 + st), lod=0, frame=f)  # balustrade
    _windows(ms, f, -W + 0.05, W - 0.05, D, z0 + st + 0.1, max(3, round(w / 0.3)), face=1)
    _windows(ms, f, -W + 0.05, W - 0.05, D, z0 + 0.1, max(2, round(w / 0.45)), face=1)
    # the west wing, two storeys, the stair along its front
    _block(ms, f, -W, -W + ww, yS, yN + lg, z0, st, roof=False)
    _block(ms, f, -W, -W + ww, yS, yN + lg, z0 + st, st)
    _windows_y(ms, f, yS + 0.05, yN, -W, z0 + 0.1, max(2, round((yN - yS) / 0.3)))
    _windows_y(ms, f, yS + 0.05, yN, -W, z0 + st + 0.1, max(2, round((yN - yS) / 0.3)))
    ms.box('door', (0.08, 0.012, 0.16), at=(-W + ww * 0.3, yS - 0.004, z0 + st), lod=0, frame=f)
    steps = 10
    run = ww - 0.04
    for k in range(steps):  # climbing west along the front of the wing to the upper door
        sz = (k + 1) * st / steps
        ms.box('eu_ashlar', (run / steps + 0.002, sw, sz), at=(-W + ww - 0.02 - (k + 0.5) * run / steps, yS - sw / 2, z0), lod=1, frame=f)
    rail = f @ Matrix.Translation(Vector((-W + ww / 2 - 0.02, yS - sw + 0.006, z0 + st * 0.5 + 0.03))) @ Matrix.Rotation(math.atan2(st, run), 4, 'Y')
    ms.box('eu_plaster', (math.hypot(run, st), 0.014, 0.035), at=(0, 0, 0), lod=0, frame=rail)
    # the east wing, one storey with a roof terrace and a small upper room
    _block(ms, f, W - ew, W, -D + sd, yN + lg, z0, st)
    _block(ms, f, W - ew + 0.04, W - 0.04, (yN + lg) - 0.32 * s, yN + lg - 0.02, z0 + st, st * 0.8)
    _windows_y(ms, f, -D + sd + 0.05, yN, W, z0 + 0.1, max(2, round((yN + D) / 0.3)), face=1)
    # the front: a one-storey colonnade of red columns from the stair to the east wing's corner
    x0, x1 = -W + ww, W
    ms.box('eu_ashlar', (x1 - x0 - ew, 0.04, st), at=((x0 + x1 - ew) / 2, -D + sd - 0.02, z0), lod=2, frame=f)  # back wall
    ms.box('door', (0.12, 0.012, st * 0.7), at=((x0 + x1 - ew) / 2, -D + sd - 0.043, z0), lod=1, frame=f)
    ms.box('eu_plaster', (x1 - x0 + 0.01, sd + 0.01, 0.02), at=((x0 + x1) / 2, -D + sd / 2, z0 + st - 0.02), lod=1, frame=f)
    ms.box('eu_blue', (x1 - x0 + 0.014, sd + 0.014, 0.012), at=((x0 + x1) / 2, -D + sd / 2, z0 + st - 0.048), lod=0, frame=f)
    ms.box('eu_red', (x1 - x0 + 0.018, sd + 0.018, 0.026), at=((x0 + x1) / 2, -D + sd / 2, z0 + st - 0.036), lod=1, frame=f)
    ms.box('eu_roof', (x1 - x0, sd, 0.008), at=((x0 + x1) / 2, -D + sd / 2, z0 + st), lod=2, frame=f)
    nc = max(3, round((x1 - x0) / 0.16))
    for i in range(nc):
        cx = x0 + 0.05 + (x1 - x0 - 0.1) * i / (nc - 1)
        _column(ms, f, cx, -D + 0.03, z0, st - 0.04, r=0.022)
    # the court: an altar and potted shrubs
    cyc = (yN + (-D + sd)) / 2
    ms.box('eu_ashlar', (0.08, 0.08, 0.05), at=((x0 + W - ew) / 2, cyc, z0), lod=0, frame=f, bevel=0.005)
    for (px, py) in ((x0 + 0.06, cyc + 0.1), (W - ew - 0.06, cyc - 0.1), (x0 + 0.1, -D - 0.04), (-W + 0.05, -D - 0.04)):
        pot(ms, f, px, py, 0.9, z=z0 if py > -D else G)
        ms.sphere('leaf', 0.04, at=(px, py, (z0 if py > -D else G) + 0.1), scale=(1, 1, 0.9), u=7, v=5, lod=0, frame=f)
    # the team-cloth awning at the stair's foot, by the court entrance
    tt.front_shade(ms, f, x0 + 0.13, -D + 0.02, 0.2, depth=0.14, z=0.2, mat='team_cloth')
    # horns of consecration on the central hall
    hz = top - 0.012
    hy = (yN + lg + 0.04 + D - 0.12 * s) / 2
    ms.box('eu_plaster', (0.12, 0.04, 0.022), at=(0, hy, hz), lod=1, frame=f)
    for sx in (-1, 1):
        ms.cyl('bronze', 0.016, 0.004, 0.075, at=(sx * 0.035, hy, hz + 0.018), rot=(0, sx * 28, 0), segs=6, lod=1, frame=f)
    return f


# ---- building a town file -------------------------------------------------------------------------

def main(file_name, obj_name, layout, ground=None):
    """Build <out_dir>/<file_name>.glb holding one town object `obj_name` (the game reads the
    object by the layout's name, so the Europe town keeps `town-<size>-<v>`)."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(EARTH_GROUND)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
