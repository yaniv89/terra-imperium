# scripts/blender/ti_classical.py
# The Classical Age kit (art spec section 3: white or cream plaster, cut stone, terracotta tile;
# variant a Roman, variant b Han Chinese): cream plaster houses on cut-stone footings under tiled
# gable roofs (Roman) or on stone plinths with timber posts under hip roofs with upturned eaves
# (Han), courtyard walls, awnings, cypresses and shrubs, and the landmarks of the sheets: a small
# and a large Roman temple, a market stoa, a Han pavilion and a drum tower. Grounds are paved.
# Scale as the Bronze kit: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['cream', 'ashlar', 'tile', 'tile_dark', 'marble', 'cypress', 'shrub', 'red_lacquer', 'olive', 'vine',
       'paving', 'paving_fringe', 'paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'paving': 'Ground', 'paving_fringe': 'Ground', 'paving_square': 'Ground'})
if 'paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('paving_fringe')


def mat_paving(name, stone=('#b9b1a1', '#a9a191', '#c4bcac'), mortar='#7f786c', slab=(0.06, 0.04)):
    """Stone slabs laid flat: a brick bond on the ground plane (object x, y), varied slab tones,
    worn joints, grit."""
    mat = bpy_materials_new(name)
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
    br.inputs['Bias'].default_value = 0.0
    br.offset = 0.5
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    patch = tm._noise(nt, 6.0, 4.0, 0.6)
    tint = tm._ramp(nt, patch.outputs['Fac'], [(0.35, stone[1]), (0.65, stone[2])])
    col = tm._mix(nt, 0.35, br.outputs['Color'], tint.outputs['Color'], 'OVERLAY')
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    tm._bump(nt, bsdf, br.outputs['Fac'], 0.35, 0.003)
    return mat


def bpy_materials_new(name):
    import bpy
    return bpy.data.materials.new(name)


def make_materials():
    tm.mat_simple('cream', ['#d6c6a4', '#e3d6ba', '#ece2cc', '#cfbd98'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_mudwall('ashlar', wash='#d6c9ae', brick='#cbbb9b', brick2='#b7a688', mortar='#8c8070', wash_cover=0.0,
                   bond=(0.09, 0.04, 0.003))
    # terracotta roof tile: courses of tiles (rows along the slope's height), columns across
    tm.mat_mudwall('tile', wash='#b5532f', brick='#b95a33', brick2='#9e4528', mortar='#6a2c18', wash_cover=0.0,
                   bond=(0.026, 0.013, 0.0025))
    tm.mat_simple('tile_dark', ['#7e3520', '#93412a', '#6c2c1a'], scale=30.0, bump=0.3)
    tm.mat_simple('marble', ['#ddd8cc', '#ece8de', '#d0c9ba'], scale=20.0, bump=0.15, dirt=True)
    tm.mat_simple('cypress', ['#1c3519', '#284624', '#33552c'], scale=60.0, bump=0.7)
    tm.mat_simple('shrub', ['#34522a', '#4a6b30', '#5c7c38'], scale=50.0, bump=0.6)
    tm.mat_simple('olive', ['#56633e', '#6f7b55', '#87916a', '#4a5636'], scale=40.0, bump=0.6)
    tm.mat_simple('vine', ['#2f5222', '#43702c', '#3a2a40', '#55803a'], scale=70.0, bump=0.7)
    tm.mat_simple('red_lacquer', ['#7a2418', '#93301e', '#6a1e14'], scale=20.0, bump=0.2)
    mat_paving('paving')
    mat_paving('paving_fringe')
    mat_paving('paving_square', stone=('#a49d90', '#968f82', '#b1aa9c'), slab=(0.08, 0.08))


if not any(n == 'classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('classical', make_materials))

PAVED = dict(mat='paving', power=8)  # a town's ground: paved, squared off


# ---- roofs --------------------------------------------------------------------------------------

def gable_roof(ms, f, w, d, z0, rise, over=0.045, mat='tile', gable='cream', thick=0.022, lod=2, ridge='tile_dark'):
    """A pitched roof with its ridge along local X over a w x d block whose walls stop at z0:
    two tiled slabs with eaves overhanging by `over`, gable triangles, a ridge cap."""
    run = d / 2 + over
    slope = math.atan2(rise, d / 2)
    length = run / math.cos(slope)
    zc = z0 + rise - (run / 2) * math.tan(slope)
    for sy in (-1, 1):
        rf = f @ Matrix.Translation(Vector((0, sy * run / 2, zc))) @ Matrix.Rotation(-slope * sy, 4, 'X')
        ms.box(mat, (w + 2 * over, length + 0.01, thick), at=(0, 0, -thick / 2), lod=lod, frame=rf)
    bm = bmesh.new()
    for sx in (-w / 2 + 0.001, w / 2 - 0.001):
        g = [bm.verts.new((sx, -d / 2, z0)), bm.verts.new((sx, d / 2, z0)), bm.verts.new((sx, 0, z0 + rise - 0.005))]
        bm.faces.new(g if sx > 0 else list(reversed(g)))
    ms.add(bm, gable, lod, matrix=f)
    ms.box(ridge, (w + 2 * over + 0.01, 0.034, 0.02), at=(0, 0, z0 + rise - 0.006), lod=min(lod, 1), frame=f)


def hip_roof(ms, f, w, d, z0, rise, over=0.09, curl=0.055, mat='tile', lod=2, ornaments=True):
    """A hip roof over a w x d block (walls stop at z0) with deep eaves whose corners turn up (the
    Han roof): one closed solid, a ridge cap with upturned ends."""
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - over * 0.3
    r = max(0.0, W - D) if W >= D else 0.0
    bm = bmesh.new()
    c = {(sx, sy): bm.verts.new((sx * W, sy * D, ze + curl)) for sx in (-1, 1) for sy in (-1, 1)}
    m = {sy: bm.verts.new((0, sy * D, ze)) for sy in (-1, 1)}
    s = {sx: bm.verts.new((sx * W, 0, ze)) for sx in (-1, 1)}
    if r > 0.001:
        R = {sx: bm.verts.new((sx * r, 0, z0 + rise)) for sx in (-1, 1)}
        bm.faces.new((c[(-1, -1)], m[-1], c[(1, -1)], R[1], R[-1]))
        bm.faces.new((c[(1, 1)], m[1], c[(-1, 1)], R[-1], R[1]))
        bm.faces.new((c[(1, -1)], s[1], c[(1, 1)], R[1]))
        bm.faces.new((c[(-1, 1)], s[-1], c[(-1, -1)], R[-1]))
    else:  # a pyramid
        top = bm.verts.new((0, 0, z0 + rise))
        bm.faces.new((c[(-1, -1)], m[-1], c[(1, -1)], top))
        bm.faces.new((c[(1, 1)], m[1], c[(-1, 1)], top))
        bm.faces.new((c[(1, -1)], s[1], c[(1, 1)], top))
        bm.faces.new((c[(-1, 1)], s[-1], c[(-1, -1)], top))
    bm.faces.new((c[(-1, -1)], s[-1], c[(-1, 1)], m[1], c[(1, 1)], s[1], c[(1, -1)], m[-1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed solid: safe to orient
    ms.add(bm, mat, lod, matrix=f)
    if r > 0.001:
        ms.box('tile_dark', (2 * r + 0.02, 0.03, 0.022), at=(0, 0, z0 + rise - 0.008), lod=min(lod, 1), frame=f)
        if ornaments:
            for sx in (-1, 1):
                ms.box('tile_dark', (0.02, 0.026, 0.05), at=(sx * (r + 0.005), 0, z0 + rise), lod=0, frame=f)
    elif ornaments:
        ms.cyl('tile_dark', 0.018, 0.0, 0.06, at=(0, 0, z0 + rise - 0.01), segs=6, lod=0, frame=f)


# ---- small things -------------------------------------------------------------------------------

def cypress(ms, x, y, h=0.34, r=0.06, lod=2):
    ms.cyl('timber', 0.008, 0.008, 0.03, at=(x, y, G), segs=5, lod=0)
    ms.cyl('cypress', r, r * 0.15, h, at=(x, y, G + 0.02), segs=7, lod=lod)


def shrub(ms, x, y, r=0.07, lod=1):
    ms.sphere('shrub', r, at=(x, y, G + r * 0.55), scale=(1, 1, 0.75), u=7, v=4, lod=lod)


def broadleaf(ms, x, y, h=0.3, r=0.09):
    """A round-crowned tree (the Han courtyards' trees)."""
    ms.cyl('timber', 0.014, 0.01, h * 0.45, at=(x, y, G), segs=6, lod=1)
    ms.sphere('shrub', r, at=(x, y, G + h - r * 0.8), scale=(1, 1, 0.85), u=8, v=5, lod=1, only=(0, 1))
    ms.cyl('shrub', r * 0.95, r * 0.6, r * 1.5, at=(x, y, G + h - r * 1.6), segs=6, lod=2, only=2)


def awning(ms, f, x, y, w, depth=0.17, z=0.26, mat='team_cloth'):
    """A canvas awning on two posts in front of a wall face at local y (facing -Y)."""
    tt.front_shade(ms, f, x, y, w, depth=depth, z=z, mat=mat)


def jars(ms, f, x, y, rng, n=3):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.03, 0.03), rng.uniform(0.9, 1.25))


# ---- houses -------------------------------------------------------------------------------------

def roman_house(ms, rng, x, y, w, d, storeys=1, yaw=None, rise=0.15, awning_w=None, chimney=False, door=0.0,
                balcony=False, jar_n=0, gable_front=False, h=None):
    """A Roman house: cream plaster walls on a cut-stone footing, small windows with timber
    shutters, a plank door with a stone step, a tiled gable roof (eaves to the front, or the gable
    to the front when `gable_front`), an awning, a chimney, a balcony on a two-storey house."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = h or STOREY * storeys
    ms.box('ashlar', (w + 0.012, d + 0.012, 0.08), at=(0, 0, G), lod=1, frame=f)
    ms.box('cream', (w, d, h), at=(0, 0, G), lod=2, bevel=0.004, frame=f)
    if gable_front:
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        gable_roof(ms, rf, d, w, G + h, rise)
    else:
        gable_roof(ms, f, w, d, G + h, rise)
    ms.box('door', (0.1, 0.012, min(0.2, h * 0.75)), at=(door, -d / 2 - 0.004, G), lod=1, frame=f)
    ms.box('ashlar', (0.14, 0.04, 0.015), at=(door, -d / 2 - 0.02, G), lod=0, frame=f)
    for row in range(storeys):
        zw = G + min(0.2, h * 0.5) + row * STOREY
        for wx in (-w * 0.3, w * 0.3):
            if row == 0 and abs(wx - door) < 0.1:
                continue
            ms.box('dark', (0.055, 0.01, 0.065), at=(wx, -d / 2 - 0.003, zw), lod=0, frame=f)
            for sx in (-1, 1):
                ms.box('timber', (0.028, 0.008, 0.07), at=(wx + sx * 0.045, -d / 2 - 0.005, zw - 0.003), lod=0, frame=f)
        ms.box('dark', (0.05, 0.01, 0.06), at=(0, d / 2 + 0.003, zw), lod=0, frame=f)
    if balcony and storeys > 1:
        ms.box('timber', (w * 0.5, 0.08, 0.015), at=(0, -d / 2 - 0.04, G + STOREY), lod=1, frame=f)
        for k in range(5):
            ms.box('timber', (0.008, 0.008, 0.06), at=(-w * 0.24 + k * w * 0.12, -d / 2 - 0.075, G + STOREY + 0.015), lod=0, frame=f)
        ms.box('timber', (w * 0.5, 0.01, 0.01), at=(0, -d / 2 - 0.075, G + STOREY + 0.075), lod=0, frame=f)
    if awning_w:
        awning(ms, f, w * 0.18 if door <= 0 else -w * 0.18, -d / 2, awning_w)
    if chimney:
        ms.box('cream', (0.06, 0.06, rise + 0.08), at=(w * 0.3, d * 0.15, G + h), lod=1, frame=f)
    if jar_n:
        jars(ms, f, -w / 2 + 0.06, -d / 2 - 0.06, rng, jar_n)
    return f


def han_house(ms, rng, x, y, w, d, yaw=None, rise=0.2, posts=4, door=0.0, awning_w=None, jar_n=0, h=None):
    """A Han house: a pale stone plinth with a step, cream walls framed by dark timber posts and a
    beam, lattice windows, a plank door, a tiled hip roof with deep eaves turning up at the
    corners."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = h or STOREY * 0.92
    pz = 0.045
    ms.box('ashlar', (w + 0.07, d + 0.07, pz), at=(0, 0, G), lod=2, frame=f)
    ms.box('ashlar', (0.16, 0.05, pz * 0.5), at=(door, -d / 2 - 0.06, G), lod=0, frame=f)
    z = G + pz
    ms.box('cream', (w, d, h), at=(0, 0, z), lod=2, frame=f)
    for i in range(posts):
        px = -w / 2 + w * i / (posts - 1)
        ms.box('timber', (0.026, 0.026, h), at=(px, -d / 2 - 0.006, z), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('timber', (0.026, 0.026, h), at=(sx * w / 2, d / 2 + 0.006, z), lod=0, frame=f)
    ms.box('timber', (w + 0.03, 0.03, 0.03), at=(0, -d / 2 - 0.006, z + h - 0.03), lod=1, frame=f)
    ms.box('door', (0.11, 0.012, 0.21), at=(door, -d / 2 - 0.006, z), lod=1, frame=f)
    for wx in (-w * 0.3, w * 0.3):
        if abs(wx - door) < 0.12:
            continue
        ms.box('dark', (0.09, 0.01, 0.08), at=(wx, -d / 2 - 0.004, z + 0.14), lod=0, frame=f)
        for k in range(3):  # lattice bars
            ms.box('timber', (0.006, 0.006, 0.08), at=(wx - 0.03 + 0.03 * k, -d / 2 - 0.01, z + 0.14), lod=0, frame=f)
        ms.box('timber', (0.09, 0.006, 0.006), at=(wx, -d / 2 - 0.01, z + 0.18), lod=0, frame=f)
    hip_roof(ms, f, w, d, z + h, rise)
    if awning_w:
        awning(ms, f, w * 0.25, -d / 2 - 0.03, awning_w, depth=0.16, z=0.25)
    if jar_n:
        jars(ms, f, w / 2 - 0.05, -d / 2 - 0.09, rng, jar_n)
    return f


def court_wall(ms, x0, y0, x1, y1, h=0.17, t=0.035, gaps=()):
    """A low cream courtyard wall from (x0, y0) to (x1, y1) with a tiled coping; `gaps` are
    (centre fraction, width) openings."""
    length = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    f = tm.house_frame(x0, y0, yaw)
    cuts = sorted(gaps)
    pos = 0.0
    spans = []
    for c, gw in cuts:
        a, b = c * length - gw / 2, c * length + gw / 2
        if a > pos:
            spans.append((pos, a))
        pos = b
    if pos < length:
        spans.append((pos, length))
    for a, b in spans:
        ms.box('cream', (b - a, t, h), at=((a + b) / 2, 0, G), lod=2, frame=f)
        ms.box('tile', (b - a + 0.01, t + 0.03, 0.02), at=((a + b) / 2, 0, G + h), lod=1, frame=f, taper=0.6)


# ---- landmarks ----------------------------------------------------------------------------------

def temple(ms, rng, x, y, w, d, top, columns=4, side_columns=0, podium=0.1, yaw=None, steps=6):
    """A Roman temple on a podium: front steps, a porch of marble columns, a cella behind, an
    entablature, a gable roof with a marble pediment facing the front; `top` is the ridge."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ms.box('ashlar', (w, d, podium), at=(0, 0, G), lod=2, bevel=0.004, frame=f)
    for s in range(steps):  # the stair up the front of the podium
        sz = podium * (s + 1) / steps
        ms.box('ashlar', (w * 0.7, 0.03, sz), at=(0, -d / 2 - 0.03 * (steps - s) + 0.015, G), lod=1, frame=f)
    zc = G + podium
    rise = w * 0.2
    ent = 0.05
    col_h = top - zc - rise - ent
    porch = d * 0.32
    ms.box('marble', (w * 0.82, d - porch - 0.04, col_h), at=(0, porch / 2, zc), lod=2, frame=f)
    ms.box('door', (w * 0.2, 0.012, col_h * 0.6), at=(0, -d / 2 + porch + 0.012, zc), lod=1, frame=f)
    cr = min(0.03, w / (columns * 4.5))
    for i in range(columns):
        cx = -w / 2 + 0.05 + (w - 0.1) * i / (columns - 1)
        ms.cyl('marble', cr, cr * 0.85, col_h, at=(cx, -d / 2 + 0.05, zc), segs=10, lod=1, frame=f)
        ms.box('marble', (cr * 2.6, cr * 2.6, 0.02), at=(cx, -d / 2 + 0.05, zc + col_h - 0.02), lod=0, frame=f)
        ms.box('marble', (cr * 2.6, cr * 2.6, 0.015), at=(cx, -d / 2 + 0.05, zc), lod=0, frame=f)
    for sx in (-1, 1):
        for i in range(side_columns):
            cy = -d / 2 + 0.05 + (d - 0.1) * (i + 1) / (side_columns + 1)
            ms.cyl('marble', cr, cr * 0.85, col_h, at=(sx * (w / 2 - 0.05), cy, zc), segs=8, lod=0, frame=f)
    ms.box('marble', (w, d, ent), at=(0, 0, zc + col_h), lod=2, frame=f)
    rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')  # the ridge runs front to back
    gable_roof(ms, rf, d, w, zc + col_h + ent, rise, over=0.03, gable='marble')
    return f


def stoa(ms, rng, x, y, length, depth=0.42, yaw=None, columns=7, h=None):
    """A market hall: a long cream back wall, a row of columns along the front, a lean-to tiled
    roof, with stalls under team awnings in front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = h or STOREY * 0.95
    ms.box('ashlar', (length + 0.04, depth + 0.04, 0.04), at=(0, 0, G), lod=2, frame=f)
    ms.box('cream', (length, 0.06, h + 0.06), at=(0, depth / 2 - 0.03, G), lod=2, frame=f)
    for sx in (-1, 1):
        ms.box('cream', (0.06, depth, h), at=(sx * (length / 2 - 0.03), 0, G), lod=2, frame=f)
    for i in range(columns):
        cx = -length / 2 + 0.05 + (length - 0.1) * i / (columns - 1)
        ms.cyl('marble', 0.022, 0.019, h, at=(cx, -depth / 2 + 0.03, G + 0.04), segs=8, lod=1, frame=f)
    slope = math.atan2(0.08, depth)
    rf = f @ Matrix.Translation(Vector((0, 0, G + h + 0.07))) @ Matrix.Rotation(slope, 4, 'X')
    ms.box('tile', (length + 0.08, depth / math.cos(slope) + 0.1, 0.02), at=(0, 0, 0), lod=2, frame=rf)
    for i in range(columns - 1):
        cx = -length / 2 + 0.05 + (length - 0.1) * (i + 0.5) / (columns - 1)
        ms.box('timber', (0.12, 0.08, 0.06), at=(cx, 0.02, G + 0.04), lod=0, frame=f)
        tt.jar(ms, f, cx + 0.04, 0.02, 0.8, z=G + 0.1)
    return f


def han_pavilion(ms, x, y, size=0.34, top=0.55, yaw=None):
    """A small shrine pavilion on a stepped stone platform: four red posts, a low wall at the back,
    a pyramid hip roof with upturned corners."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ms.box('ashlar', (size + 0.12, size + 0.12, 0.05), at=(0, 0, G), lod=2, frame=f)
    ms.box('ashlar', (size + 0.04, size + 0.04, 0.05), at=(0, 0, G + 0.05), lod=1, frame=f)
    for s in range(3):
        ms.box('ashlar', (0.14, 0.04, 0.1 * (s + 1) / 3), at=(0, -size / 2 - 0.08 - 0.04 * (2 - s), G), lod=0, frame=f)
    z = G + 0.1
    ph = top - z - size * 0.45
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('red_lacquer', (0.025, 0.025, ph), at=(sx * size * 0.42, sy * size * 0.42, z), lod=1, frame=f)
    ms.box('cream', (size * 0.84, 0.04, ph * 0.8), at=(0, size * 0.4, z), lod=1, frame=f)
    ms.box('timber', (size * 0.9, size * 0.9, 0.03), at=(0, 0, z + ph - 0.03), lod=1, frame=f)
    hip_roof(ms, f, size, size, z + ph, size * 0.45, over=0.06, curl=0.03)
    return f


def drum_tower(ms, x, y, base=0.5, top=1.2, yaw=None):
    """A drum tower: a battered cream-and-stone base with an arched gate, a timber gallery with a
    railing and a great drum, a hip roof with upturned eaves; `top` is the ridge."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    bh = top * 0.5
    ms.box('ashlar', (base + 0.04, base + 0.04, 0.12), at=(0, 0, G), lod=2, frame=f)
    ms.box('cream', (base, base, bh - 0.12), at=(0, 0, G + 0.12), lod=2, frame=f, taper=0.92)
    ms.box('dark', (0.14, 0.012, 0.2), at=(0, -base / 2 - 0.003, G), lod=1, frame=f)
    z = G + bh
    gw = base * 0.86
    ms.box('timber', (gw + 0.04, gw + 0.04, 0.025), at=(0, 0, z), lod=1, frame=f)
    gh = top - z - gw * 0.4 - 0.02
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('red_lacquer', (0.028, 0.028, gh), at=(sx * gw * 0.45, sy * gw * 0.45, z), lod=1, frame=f)
    for k in range(4):  # railings round the gallery
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        ms.box('timber', (gw * 0.9, 0.012, 0.012), at=(0, -gw * 0.45, z + 0.08), lod=0, frame=rf)
        for i in range(5):
            ms.box('timber', (0.008, 0.008, 0.08), at=(-gw * 0.36 + gw * 0.18 * i, -gw * 0.45, z + 0.005), lod=0, frame=rf)
    ms.cyl('red_lacquer', 0.1, 0.1, 0.14, at=(-0.07, 0, z + 0.14), rot=(0, 90, 0), segs=12, lod=1, frame=f)
    ms.cyl('cream', 0.085, 0.085, 0.145, at=(-0.0725, 0, z + 0.14), rot=(0, 90, 0), segs=12, lod=0, frame=f)
    ms.box('timber', (gw * 0.95, gw * 0.95, 0.03), at=(0, 0, z + gh - 0.03), lod=1, frame=f)
    hip_roof(ms, f, gw, gw, z + gh, gw * 0.4, over=0.08, curl=0.04)
    return f


def paved_strip(ms, x0, y0, x1, y1, w):
    """A strip of lighter paving (a street) on the town's ground."""
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * w / 2, dx / length * w / 2
    ms.quad_strip('paving_square', [(x0 + nx, y0 + ny, G + 0.003), (x0 - nx, y0 - ny, G + 0.003),
                                    (x1 - nx, y1 - ny, G + 0.003), (x1 + nx, y1 + ny, G + 0.003)], lod=1)


# ---- the shared file: wall rings, the colony camp, fields ---------------------------------------
import ti_bronze as tb  # noqa: E402

RAISE = tb.WALL_RAISE


def walls_small(ms, rng):
    """`walls-small` (44 m): a limestone ashlar ring with merlons and a wall-walk, four square
    corner towers and two gate towers flanking an arched timber gate at the south."""
    tb.mud_wall_ring(ms, rng, R_out=2.2, R_in=2.02, H=0.4 * RAISE, gate_x=0.2, band=('ashlar', 0.06),
                     towers=(45, 135, 225, 315), tower_size=0.44, tower_h=0.58 * RAISE, gate_towers=(0.46, 0.6 * RAISE),
                     n=(96, 48, 28), mat='ashlar')


def walls_medium(ms, rng):
    """`walls-medium` (65 m): ashlar curtain walls with merlons, four square towers, a gatehouse of
    two tall towers hung with team banners over an arched gate."""
    tb.mud_wall_ring(ms, rng, R_out=3.25, R_in=3.0, H=0.55 * RAISE, gate_x=0.25, band=('ashlar', 0.07),
                     towers=(40, 140, 215, 325), tower_size=0.55, tower_h=0.75 * RAISE, gate_towers=(0.6, 0.8 * RAISE),
                     n=(128, 56, 30), mat='ashlar', banners=True)


def walls_big(ms, rng):
    """`walls-big` (86 m): a tall ashlar ring with merlons, seven square towers, and a gatehouse of
    two towers with team banners over an iron-strapped gate."""
    tb.mud_wall_ring(ms, rng, R_out=4.3, R_in=4.0, H=0.7 * RAISE, gate_x=0.3, band=('ashlar', 0.08),
                     towers=(0, 45, 90, 135, 180, 222, 318), tower_size=0.68, tower_h=0.95 * RAISE,
                     gate_towers=(0.72, 1.1 * RAISE), straps=True, n=(128, 48, 32), planks=False, mat='ashlar', banners=True)


def camp_hut(ms, rng, x, y):
    """The camp's hut: a small plastered house with a tiled gable roof (3 m)."""
    roman_house(ms, rng, x, y, 0.62, 0.42, yaw=0, rise=0.12, h=0.26)


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): the Bronze camp's layout with a plastered, tile-roofed hut."""
    tb.colony_camp(ms, rng, hut_fn=camp_hut)


def field_1(ms, rng):
    """`field-1` (14 by 10 m): eight strips of ripe wheat, a ditch with a sluice on the north."""
    tb.field_1(ms, rng, crop='barley')


def field_2(ms, rng):
    """`field-2` (16 by 12 m): six olive trees with silver-green crowns in stone-ringed basins."""
    tb.field_2(ms, rng, leaf='olive', basin='ashlar', trunk=0.022)


def field_3(ms, rng):
    """`field-3` (14 by 12 m): a fenced pasture with a stone water trough."""
    tb.field_3(ms, rng, trough='ashlar')


def field_4(ms, rng):
    """`field-4` (16 by 10 m): a vineyard: six rows of vines on posts with grapes, a ditch with a
    sluice along the north edge."""
    tb.canal(ms, -0.72, 0.72, 0.41)
    for i in range(6):
        x = -0.6 + 0.24 * i
        ms.box('vine', (0.07, 0.74, 0.09), at=(x, -0.06, G + 0.02), lod=2, taper=0.6)
        for k in range(6):
            ms.cyl('log', 0.008, 0.007, 0.12, at=(x, -0.42 + 0.145 * k, G), segs=5, lod=1)
        for k in range(5):
            ms.sphere('vine', 0.045, at=(x + rng.uniform(-0.01, 0.01), -0.36 + 0.145 * k, G + 0.08), scale=(0.8, 1.4, 0.8), u=6, v=4, lod=0)
        ms.box('mud', (0.16, 0.78, 0.008), at=(x, -0.06, G), lod=0)
