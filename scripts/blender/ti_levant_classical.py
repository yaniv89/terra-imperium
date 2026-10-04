# scripts/blender/ti_levant_classical.py
# The Levant kit for the Classical Age (art spec 3b: Levant, Mesopotamia, Arabia, Persia), from the
# sheets in plans/art/kits/levant/classical/: street.png (a 3 x 3 block on grey-beige cobbles: a
# north row of two-storey rich residences, 12 x 10 m and 8 m high, with a four-column porch, a
# balcony with a balustrade over it and a roof terrace with a canvas awning; a middle row of
# one-storey courtyard houses, 10 x 10 m and 4.5 m, round an open court with an olive tree, a
# two-column entrance porch and a cloth over the court; a south row of 8 x 8 m, 3 m cottages with
# reed-mat awnings over the door; flat earthen roofs behind parapets, potted plants and jars
# everywhere, olives, cypresses and date palms, a well on a cobbled ring), roofscape.png,
# materials.png (buff limestone ashlar below, cream gypsum plaster above, dark cedar beams whose
# ends project under the parapet, rose-pink sandstone columns, grey stone paving), the Apadana
# hall with bull capitals (landmark-1) and the Petra-style rock-cut tomb (landmark-2).
# There is no houses.png: the three house types are taken from the street and roofscape sheets.
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks fitted to the layouts' spots.
# Materials carry the `lvc_` prefix.
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

NEW = ['lvc_ashlar', 'lvc_pale', 'lvc_plaster', 'lvc_buff', 'lvc_roof', 'lvc_cedar', 'lvc_rose', 'lvc_carved',
       'lvc_rock', 'lvc_relief', 'lvc_palm', 'lvc_palmtrunk', 'lvc_paving', 'lvc_paving_fringe', 'lvc_paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'lvc_paving': 'Ground', 'lvc_paving_fringe': 'Ground', 'lvc_paving_square': 'Ground'})
if 'lvc_paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('lvc_paving_fringe')

# grey-beige cobbles with dusty joints (street sheet; "stone paving" of the materials sheet)
PAVING = (('#b3a487', '#a6977a', '#c0b194'), '#86735a', (0.06, 0.05))


def make_materials():
    # buff limestone ashlar (the lower walls and the house blocks), the pale limestone of the rich
    # houses and the Apadana, cream gypsum plaster (upper walls), buff stone plaster (cottages)
    tm.mat_mudwall('lvc_ashlar', wash='#d3bd92', brick='#d2bb8f', brick2='#c3aa7c', mortar='#a08b67', wash_cover=0.0,
                   bond=(0.07, 0.032, 0.0025))
    tm.mat_mudwall('lvc_pale', wash='#e3d6bb', brick='#e0d1b2', brick2='#d2c19f', mortar='#ae9f83', wash_cover=0.0,
                   bond=(0.08, 0.036, 0.0025))
    tm.mat_simple('lvc_plaster', ['#dfd1b4', '#d5c6a6', '#e6dabf', '#cbbb98'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_mudwall('lvc_buff', wash='#d1b483', brick='#c8a774', brick2='#b8955f', mortar='#9b7f57', wash_cover=0.55,
                   bond=(0.06, 0.03, 0.003))
    # the flat earthen roof, dark cedar timber
    tm.mat_simple('lvc_roof', ['#b48f62', '#a88257', '#c09c6c', '#9c7a52'], scale=22.0, bump=0.35)
    tm.mat_simple('lvc_cedar', ['#3e2a1b', '#553924', '#4a3221'], scale=8.0,
                  stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 6.0}, bump=0.45)
    # rose-pink sandstone: the house columns (smooth), the tomb's carved front and its rough cliff
    tm.mat_simple('lvc_rose', ['#d3a495', '#c8968a', '#dcb2a2'], scale=18.0, bump=0.2)
    tm.mat_simple('lvc_carved', ['#c98a72', '#bf7d66', '#d39a80', '#b87560'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 3.0}, bump=0.3)
    tm.mat_simple('lvc_rock', ['#a5624f', '#b9735c', '#8f5243', '#c4826a'], scale=7.0,
                  stripes={'dir': 'Z', 'scale': 40.0, 'distortion': 10.0}, bump=0.9)
    # the Apadana podium's relief frieze: carved limestone, deep cavities
    tm.mat_simple('lvc_relief', ['#d9c9a8', '#c4b18c', '#e2d4b6', '#ad9a76'], scale=55.0, bump=1.0)
    # date palms
    tm.mat_simple('lvc_palm', ['#3f5a26', '#557634', '#6b8a3e', '#4a6a2c'], scale=60.0,
                  stripes={'dir': 'X', 'scale': 200.0, 'distortion': 6.0}, bump=0.6)
    tm.mat_simple('lvc_palmtrunk', ['#6e5434', '#856a45', '#5c452b'], scale=12.0,
                  stripes={'dir': 'X', 'scale': 160.0, 'distortion': 2.0}, bump=0.7)
    for n in ('lvc_paving', 'lvc_paving_fringe'):
        tc.mat_paving(n, stone=PAVING[0], mortar=PAVING[1], slab=PAVING[2])
    tc.mat_paving('lvc_paving_square', stone=('#bcae92', '#ad9f84', '#c8bb9f'), mortar='#8a785e', slab=(0.05, 0.045))


if not any(n == 'levant_classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('levant_classical', make_materials))

PAVED = dict(mat='lvc_paving', power=8)

FOOT = []  # (tag, corners) of every placed footprint, for overlap checks


def foot(f, w, d, cx=0.0, cy=0.0, tag=''):
    FOOT.append((tag, [((f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))).x, (f @ Vector((cx + sx * w / 2, cy + sy * d / 2, 0))).y)
                       for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]))


def box_only(ms, mat, size, at, frame, only):
    """A box shown only at the listed LODs (Mesher.box has no `only`)."""
    ms.box(mat, size, at=at, lod=2, frame=frame)
    bm, m, lod, _ = ms.parts[-1]
    ms.parts[-1] = (bm, m, lod, only)


# ---- small parts ----------------------------------------------------------------------------------

def ring(ms, f, mat, w, d, cw, cd, z, h, lod=2, cx=0.0, cy=0.0, ccy=0.0, grow=0.0, bevel=0.0):
    """Four boxes round an open court cw x cd (centred at local y `ccy`) inside a w x d block."""
    W, D = w + grow, d + grow
    fy0, fy1 = -D / 2, ccy - cd / 2
    by0, by1 = ccy + cd / 2, D / 2
    ms.box(mat, (W, fy1 - fy0, h), at=(cx, cy + (fy0 + fy1) / 2, z), lod=lod, frame=f, bevel=bevel)
    ms.box(mat, (W, by1 - by0, h), at=(cx, cy + (by0 + by1) / 2, z), lod=lod, frame=f, bevel=bevel)
    sw = (W - cw - grow) / 2
    for sx in (-1, 1):
        ms.box(mat, (sw + grow / 2, cd, h), at=(cx + sx * (cw / 2 + (sw + grow / 2) / 2), cy + ccy, z), lod=lod, frame=f)


def parapet(ms, f, w, d, z, mat='lvc_pale', cx=0.0, cy=0.0, h=0.045, t=0.022, lod=1, piers=True, beams=None,
            court=None):
    """A flat earthen roof at z behind a parapet: the roof slab (open over `court` = (cw, cd, ccy)),
    a cornice band, the parapet ring, corner piers (materials sheet) and cedar beam ends projecting
    under the cornice along the front (`beams` = count, None picks one by width)."""
    if court:
        cw, cd, ccy = court
        ring(ms, f, 'lvc_roof', w - 0.02, d - 0.02, cw + 0.02, cd + 0.02, z, 0.008, lod=2, cx=cx, cy=cy, ccy=ccy)
    else:
        ms.box('lvc_roof', (w - 0.02, d - 0.02, 0.008), at=(cx, cy, z), lod=2, frame=f)
    ms.box(mat, (w + 0.024, d + 0.024, 0.018), at=(cx, cy, z - 0.014), lod=1, frame=f)  # the cornice
    for (px, py, pw, pd) in ((0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t),
                             (w / 2 - t / 2, 0, t, d - 2 * t)):
        ms.box(mat, (pw, pd, h), at=(cx + px, cy + py, z), lod=lod, frame=f)
    if piers:
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.box(mat, (0.04, 0.04, h + 0.025), at=(cx + sx * (w / 2 - 0.018), cy + sy * (d / 2 - 0.018), z), lod=0, frame=f)
    n = beams if beams is not None else max(3, int(w / 0.085))
    for i in range(n):
        bx = -w / 2 + 0.05 + (w - 0.1) * i / max(1, n - 1)
        ms.box('lvc_cedar', (0.018, 0.035, 0.018), at=(cx + bx, cy - d / 2 - 0.012, z - 0.04), lod=0, frame=f)


def window(ms, f, x, y, z, w=0.04, h=0.05, face=-1):
    """A small deep window: a dark grille, a cedar lintel above it."""
    ms.box('dark', (w, 0.01, h), at=(x, y + face * 0.003, z), lod=0, frame=f)
    ms.box('lvc_cedar', (w + 0.025, 0.014, 0.012), at=(x, y + face * 0.006, z + h), lod=0, frame=f)


def door(ms, f, x, y, w=0.085, h=0.18, step='lvc_ashlar'):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, G), lod=1, frame=f)
    ms.box('lvc_cedar', (w + 0.04, 0.02, 0.022), at=(x, y - 0.008, G + h), lod=0, frame=f)
    if step:
        ms.box(step, (w + 0.06, 0.045, 0.016), at=(x, y - 0.026, G), lod=0, frame=f)


def column(ms, f, x, y, z, h, r=0.016, mat='lvc_pale', cap='lvc_pale', lod=1, segs=8):
    """A column with a square base and a flared capital (the materials sheet's porch column)."""
    ms.box(cap, (r * 2.6, r * 2.6, 0.016), at=(x, y, z), lod=0, frame=f)
    ms.cyl(mat, r, r * 0.88, h - 0.03, at=(x, y, z + 0.012), segs=segs, lod=lod, frame=f)
    ms.cyl(cap, r * 0.9, r * 1.5, 0.022, at=(x, y, z + h - 0.036), segs=segs, lod=0, frame=f)
    ms.box(cap, (r * 3.0, r * 3.0, 0.014), at=(x, y, z + h - 0.014), lod=0, frame=f)


def potted(ms, f, x, y, r=0.034, s=0.95):
    tt.jar(ms, f, x, y, s)
    ms.sphere('shrub', r, at=(x, y, G + 0.085 * s + r * 0.55), scale=(1, 1, 0.85), u=7, v=5, lod=0, frame=f)


def bush(ms, f, x, y, r=0.05, lod=1):
    """A shrub at local (x, y) of frame f."""
    p = f @ Vector((x, y, 0))
    tc.shrub(ms, p.x, p.y, r=r, lod=lod)


def roof_pot(ms, f, x, y, z, r=0.03):
    tt.jar(ms, f, x, y, 0.75, z=z)
    ms.sphere('shrub', r, at=(x, y, z + 0.06 + r * 0.5), scale=(1, 1, 0.85), u=6, v=4, lod=0, frame=f)


def jars(ms, f, x, y, rng, n=3, spread=0.05):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-spread, spread), y + rng.uniform(-0.03, 0.03), rng.uniform(1.0, 1.4))


def canvas(ms, f, x, y, z, w, d, post=0.12, lod=1, sag=4.0):
    """A grey canvas sheet (team cloth) stretched on four cedar poles, as over the roof terraces
    and the courts of the sheet."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('lvc_cedar', (0.012, 0.012, post), at=(x + sx * (w / 2 - 0.01), y + sy * (d / 2 - 0.01), z), lod=0, frame=f)
    cf = f @ Matrix.Translation(Vector((x, y, z + post))) @ Matrix.Rotation(math.radians(sag), 4, 'X')
    ms.box('team_cloth', (w + 0.02, d + 0.02, 0.008), at=(0, 0, 0), lod=lod, frame=cf)


def reed_shade(ms, f, x, y, w=0.14, depth=0.11, z=0.22):
    """The cottage's reed-mat awning over the door on two cedar posts."""
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('lvc_cedar', (0.012, 0.012, z - 0.015), at=(x + sx, y - depth, G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((x, y - depth / 2, G + z))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('reed', (w + 0.02, depth + 0.03, 0.01), at=(0, 0, 0), lod=0, frame=pf)


# ---- trees ----------------------------------------------------------------------------------------

def olive(ms, rng, x, y, h=0.26, r=0.085, lod=1):
    """An olive tree: a short leaning trunk and a grey-green crown of two or three lumps."""
    ms.cyl('timber', 0.02, 0.014, h * 0.45, at=(x, y, G), rot=(rng.uniform(-8, 8), rng.uniform(-8, 8), 0), segs=6, lod=min(lod, 1))
    ms.sphere('olive', r, at=(x, y, G + h - r * 0.55), scale=(1, 1, 0.7), u=8, v=5, lod=1)
    for k in range(3):
        a = rng.uniform(0, 2 * math.pi) + k * 2.1
        ms.sphere('olive', r * rng.uniform(0.6, 0.75), at=(x + r * 0.6 * math.cos(a), y + r * 0.6 * math.sin(a), G + h - r * rng.uniform(0.55, 0.9)),
                  scale=(1, 1, 0.75), u=7, v=4, lod=0)
    if lod >= 2:
        ms.cyl('olive', r * 0.95, r * 0.5, r * 1.2, at=(x, y, G + h - r * 1.1), segs=6, lod=2, only=2)


def palm(ms, rng, x, y, h=0.5, fronds=8, lod=1):
    """A date palm: a ringed trunk leaning a little, a crown of drooping fronds (LOD0), a crown
    cone at LOD1."""
    lean = rng.uniform(-7, 7), rng.uniform(-7, 7)
    f = Matrix.Translation(Vector((x, y, G))) @ Matrix.Rotation(math.radians(lean[0]), 4, 'X') @ Matrix.Rotation(math.radians(lean[1]), 4, 'Y')
    ms.cyl('lvc_palmtrunk', 0.02, 0.014, h, at=(0, 0, 0), segs=6, lod=lod, frame=f)
    bm = bmesh.new()
    L = rng.uniform(0.15, 0.19)
    prof = [(0.0, 0.0, 0.006), (0.25, 0.03, 0.026), (0.5, 0.025, 0.034), (0.75, -0.02, 0.026), (1.0, -0.08, 0.004)]
    a0 = rng.uniform(0, 360)
    for k in range(fronds):
        a = math.radians(a0 + 360.0 * k / fronds + rng.uniform(-10, 10))
        droop = rng.uniform(0.8, 1.25)
        c, s = math.cos(a), math.sin(a)
        left, right = [], []
        for t, dz, wd in prof:
            px, py, pz = c * L * t, s * L * t, h + dz * droop * L / 0.17
            left.append(bm.verts.new((px - s * wd / 2, py + c * wd / 2, pz)))
            right.append(bm.verts.new((px + s * wd / 2, py - c * wd / 2, pz)))
        for i in range(len(prof) - 1):
            bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.005)
    ms.add(bm, 'lvc_palm', 0, matrix=f)
    ms.cyl('lvc_palm', 0.15, 0.03, 0.07, at=(0, 0, h - 0.05), segs=7, lod=lod, only=tuple(range(1, lod + 1)), frame=f)


def tree(ms, rng, x, y, kind=None, lod=1):
    kind = kind or rng.choice(['olive', 'olive', 'cypress', 'palm'])
    if kind == 'olive':
        olive(ms, rng, x, y, h=rng.uniform(0.26, 0.32), r=rng.uniform(0.09, 0.12), lod=lod)
    elif kind == 'cypress':
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42), r=0.042, lod=lod)
    else:
        palm(ms, rng, x, y, h=rng.uniform(0.4, 0.5), lod=lod)


# ---- houses -------------------------------------------------------------------------------------

def cottage(ms, rng, x, y, w, d, yaw=None, side=None, stall=False):
    """The cottage (sheet: 8 x 8 m, 3 m, one storey): a block of buff stone plaster under a flat
    earthen roof behind a parapet, a plank door under a reed-mat awning on cedar posts, a small
    window, jars and potted plants at the door, a low yard wall at one front corner and a pot or
    two on the roof; some keep a team-cloth stall awning beside the door."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    side = side if side is not None else rng.choice([-1, 1])
    bw, bd = w * 0.9, d * 0.8
    cy = (d - bd) / 2
    h = STOREY * 0.82
    ms.box('lvc_ashlar', (bw + 0.012, bd + 0.012, 0.035), at=(0, cy, G), lod=1, frame=f)
    ms.box('lvc_buff', (bw, bd, h), at=(0, cy, G), lod=2, frame=f, bevel=0.004)
    parapet(ms, f, bw, bd, G + h, mat='lvc_buff', cy=cy, h=0.04, beams=max(3, int(bw / 0.11)))
    fy = cy - bd / 2
    dx = -side * bw * 0.12
    door(ms, f, dx, fy)
    reed_shade(ms, f, dx, fy, w=0.15)
    window(ms, f, dx + side * 0.15, fy, G + 0.17)
    for sx in (-1, 1):
        window(ms, f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z'), cy * sx, -bw / 2, G + 0.17)
    # the low yard wall at the front corner, open toward the door
    ex = side * bw / 2
    ms.box('lvc_buff', (0.03, fy + d / 2 + 0.005, 0.1), at=(ex - side * 0.015, (fy + -d / 2) / 2, G), lod=1, frame=f)
    ms.box('lvc_buff', (bw * 0.3, 0.03, 0.1), at=(ex - side * bw * 0.15, -d / 2 + 0.015, G), lod=1, frame=f)
    potted(ms, f, ex - side * 0.06, -d / 2 + 0.07)
    if stall:
        tt.front_shade(ms, f, side * bw * 0.25, fy, 0.2, depth=0.13, z=0.22, mat='team_cloth')
        tt.crate(ms, f, side * bw * 0.25, fy - 0.07, 0.9)
    jars(ms, f, dx - side * 0.12, fy - 0.05, rng, 2)
    bush(ms, f, -side * (bw / 2 - 0.02), -d / 2 + 0.04, r=rng.uniform(0.045, 0.06))
    for k in range(rng.choice([1, 2])):
        roof_pot(ms, f, rng.uniform(-bw * 0.3, bw * 0.3), cy + rng.uniform(-bd * 0.25, bd * 0.25), G + h)
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning=True, jar_n=2, cloth=True):
    """The courtyard house (sheet: 10 x 10 m, 4.5 m, one storey): rooms in a ring round an open
    court with an olive tree, buff limestone ashlar below and cream gypsum plaster above (materials
    sheet), a projecting entrance porch with two rose sandstone columns, a flat earthen roof behind
    a parapet with cedar beam ends, a grey cloth over part of the court, a team-cloth awning on
    posts at the side of the front, jars and potted plants."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    h = STOREY * 1.08
    pd = min(0.1, d * 0.16)  # the porch projects this far
    bd = d - pd
    by = pd / 2  # the block's centre (the porch takes the front strip)
    cw, cd = w * 0.5, bd * 0.46
    ccy = 0.03
    ms.box('lvc_ashlar', (w + 0.012, bd + 0.012, 0.035), at=(0, by, G), lod=1, frame=f)
    ring(ms, f, 'lvc_ashlar', w, bd, cw, cd, G, h * 0.55, lod=2, cy=by, ccy=ccy)
    ring(ms, f, 'lvc_plaster', w, bd, cw, cd, G + h * 0.55, h * 0.45, lod=2, cy=by, ccy=ccy)
    ms.box('lvc_pale', (w + 0.008, bd + 0.008, 0.012), at=(0, by, G + h * 0.55 - 0.006), lod=0, frame=f)  # the course line
    parapet(ms, f, w, bd, G + h, mat='lvc_pale', cy=by, court=(cw, cd, ccy))
    # the court: paving, an olive tree, the cloth over half of it, an inner parapet
    ms.box('lvc_paving_square', (cw + 0.01, cd + 0.01, 0.006), at=(0, by + ccy, G), lod=1, frame=f)
    p = f @ Vector((cw * 0.05, by + ccy - cd * 0.12, 0))
    olive(ms, rng, p.x, p.y, h=min(0.36, h * 0.85), r=min(0.1, cw * 0.36), lod=1)
    for sx in (-1, 1):
        potted(ms, f, sx * cw * 0.36, by + ccy - cd * 0.36, r=0.028, s=0.8)
    for (px, py, pw, pdd) in ((0, -cd / 2 - 0.008, cw + 0.03, 0.016), (0, cd / 2 + 0.008, cw + 0.03, 0.016),
                              (-cw / 2 - 0.008, 0, 0.016, cd), (cw / 2 + 0.008, 0, 0.016, cd)):
        ms.box('lvc_pale', (pw, pdd, 0.03), at=(px, by + ccy + py, G + h), lod=0, frame=f)
    if cloth:
        cf = f @ Matrix.Translation(Vector((0, by + ccy + cd * 0.5 - cd * 0.2, G + h + 0.06))) @ Matrix.Rotation(math.radians(-8), 4, 'X')
        ms.box('team_cloth', (cw * 0.9, cd * 0.4, 0.008), at=(0, 0, 0), lod=1, frame=cf)
        for sx in (-1, 1):
            ms.box('lvc_cedar', (0.01, 0.01, 0.06), at=(sx * cw * 0.45, by + ccy - cd * 0.0, G + h), lod=0, frame=f)
    # the entrance porch: two columns in antis, a flat roof with a parapet, the door behind
    fy = by - bd / 2
    pw = min(0.32, w * 0.42)
    ph = h * 0.82
    for sx in (-1, 1):
        ms.box('lvc_ashlar', (0.04, pd, ph), at=(sx * (pw / 2 - 0.02), fy - pd / 2, G), lod=1, frame=f)
        column(ms, f, sx * pw * 0.2, fy - pd + 0.02, G, ph, r=0.014, mat='lvc_rose', cap='lvc_pale', lod=1)
    ms.box('lvc_pale', (pw + 0.02, pd + 0.02, 0.03), at=(0, fy - pd / 2, G + ph), lod=1, frame=f)
    ms.box('lvc_pale', (pw + 0.02, 0.018, 0.035), at=(0, fy - pd - 0.001, G + ph + 0.03), lod=0, frame=f)
    ms.box('lvc_ashlar', (pw + 0.04, pd + 0.05, 0.02), at=(0, fy - pd / 2 - 0.015, G), lod=0, frame=f)  # the step
    door(ms, f, 0, fy, w=0.08, h=min(0.17, ph - 0.03), step=None)
    for wx in (-w * 0.36, w * 0.36):
        if abs(wx) - pw / 2 > 0.04:
            window(ms, f, wx, fy, G + 0.2)
    for sx in (-1, 1):
        window(ms, f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z'), by * sx, -w / 2, G + 0.2)
    side = rng.choice([-1, 1])
    if awning and w > 0.5:
        aw = min(0.2, (w - pw) / 2 - 0.04)
        if aw > 0.1:
            tt.front_shade(ms, f, side * (pw / 2 + aw / 2 + 0.03), fy, aw, depth=0.12, z=0.24, mat='team_cloth')
    if jar_n:
        jars(ms, f, -side * (pw / 2 + 0.07), fy - 0.05, rng, jar_n)
    potted(ms, f, side * (pw / 2 + 0.05), fy - pd - 0.03)
    bush(ms, f, -side * (w / 2 - 0.04), fy - 0.05, r=rng.uniform(0.045, 0.06))
    bush(ms, f, side * (w / 2 + 0.02), by + bd * 0.3, r=rng.uniform(0.04, 0.055))
    roof_pot(ms, f, -w * 0.3, by + bd * 0.32, G + h)
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, terrace=True):
    """The rich residence (sheet: 12 x 10 m, two storeys, 8 m): pale limestone ashlar, a porch of
    four columns up a flight of steps with a balcony and balustrade over it, two rows of windows,
    the upper storey across the front and a roof terrace behind (parapet, a canvas awning on cedar
    poles, potted plants), cedar beam ends under the cornices, cypresses at the corners."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='house')
    pd = min(0.13, d * 0.2)
    bd = d - pd
    by = pd / 2
    h1 = STOREY * 0.95
    h2 = STOREY * 0.8
    ms.box('lvc_ashlar', (w + 0.014, bd + 0.014, 0.04), at=(0, by, G), lod=1, frame=f)
    ms.box('lvc_pale', (w, bd, h1), at=(0, by, G), lod=2, frame=f, bevel=0.004)
    ud = bd * (0.58 if terrace else 1.0)  # the upper storey's depth (front part)
    uy = by - bd / 2 + ud / 2
    ms.box('lvc_pale', (w + 0.016, bd + 0.016, 0.02), at=(0, by, G + h1 - 0.01), lod=1, frame=f)  # the floor band
    ms.box('lvc_pale', (w - 0.01, ud, h2), at=(0, uy, G + h1), lod=2, frame=f, bevel=0.004)
    parapet(ms, f, w - 0.01, ud, G + h1 + h2, mat='lvc_pale', cy=uy)
    if terrace:
        td = bd - ud
        ty = by + bd / 2 - td / 2
        parapet(ms, f, w, td + 0.02, G + h1, mat='lvc_pale', cy=ty, beams=0, piers=False, lod=1)
        canvas(ms, f, w * 0.12, ty, G + h1, min(0.34, w * 0.42), td * 0.6, post=0.13)
        for sx in (-1, 1):
            roof_pot(ms, f, sx * w * 0.36, ty, G + h1)
        roof_pot(ms, f, -w * 0.18, ty + td * 0.25, G + h1)
    # windows: two rows on the front, one per storey on each side
    fy = by - bd / 2
    for wx in (-w * 0.38, w * 0.38):
        window(ms, f, wx, fy, G + 0.18)
        window(ms, f, wx, fy, G + h1 + 0.15)
    for sx in (-1, 1):
        sf = f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        window(ms, sf, by * sx, -w / 2, G + 0.18)
        window(ms, sf, uy * sx, -w / 2, G + h1 + 0.15)
    # the porch: four columns, the entablature, the balcony with its balustrade, steps
    pw = min(0.5, w * 0.6)
    ph = h1 - 0.02
    for i in range(4):
        cx = -pw / 2 + 0.03 + (pw - 0.06) * i / 3
        column(ms, f, cx, fy - pd + 0.025, G + 0.03, ph - 0.03, r=0.016, lod=1, segs=8)
    ms.box('lvc_ashlar', (pw + 0.04, pd + 0.01, 0.03), at=(0, fy - pd / 2, G), lod=1, frame=f)
    for s in range(2):
        ms.box('lvc_ashlar', (pw * 0.62, 0.03, 0.03 - s * 0.014), at=(0, fy - pd - 0.015 - s * 0.03, G), lod=0, frame=f)
    ms.box('lvc_pale', (pw + 0.03, pd + 0.02, 0.03), at=(0, fy - pd / 2 + 0.005, G + h1 - 0.02), lod=1, frame=f)
    for k in range(5):  # beam ends under the balcony
        ms.box('lvc_cedar', (0.016, 0.03, 0.016), at=(-pw / 2 + 0.04 + (pw - 0.08) * k / 4, fy - pd - 0.006, G + h1 - 0.036), lod=0, frame=f)
    ms.box('lvc_pale', (pw + 0.03, 0.012, 0.012), at=(0, fy - pd - 0.004, G + h1 + 0.05), lod=0, frame=f)  # the rail
    n = max(6, int(pw / 0.03))
    for k in range(n):  # the balusters
        ms.box('lvc_pale', (0.008, 0.008, 0.04), at=(-pw / 2 + 0.01 + (pw - 0.02) * k / (n - 1), fy - pd - 0.004, G + h1 + 0.01), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('lvc_pale', (0.012, pd, 0.05), at=(sx * (pw / 2 + 0.008), fy - pd / 2, G + h1 + 0.01), lod=0, frame=f)
    door(ms, f, 0, fy, w=0.1, h=0.2, step=None)
    ms.box('dark', (0.08, 0.01, 0.12), at=(0, fy - 0.003, G + h1 + 0.02), lod=0, frame=f)  # the balcony door
    for sx in (-1, 1):
        potted(ms, f, sx * (pw / 2 + 0.06), fy - pd - 0.04)
        jars(ms, f, sx * (w / 2 - 0.06), fy - 0.05, rng, 2, spread=0.03)
    for sx in (-1, 1):
        bush(ms, f, sx * (w / 2 - 0.03), fy - 0.12, r=rng.uniform(0.045, 0.06))
    for sx in (-1, 1):  # cypresses at the back corners
        p = f @ Vector((sx * (w / 2 + 0.035), by + bd / 2 - 0.05, 0))
        tc.cypress(ms, p.x, p.y, h=rng.uniform(0.42, 0.55), r=0.04, lod=1)
    return f


def levant_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': cottage, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


# ---- the street ---------------------------------------------------------------------------------

def yard_wall(ms, x0, y0, x1, y1, h=0.13, t=0.035, gaps=()):
    """A low limestone yard wall with a flat coping; `gaps` are (centre fraction, width)."""
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
        ms.box('lvc_buff', (b - a, t, h), at=((a + b) / 2, 0, G), lod=2, frame=f)
        ms.box('lvc_pale', (b - a + 0.01, t + 0.016, 0.016), at=((a + b) / 2, 0, G + h), lod=1, frame=f)


def well(ms, x, y, yaw=20, ring_r=0.24):
    """The well on a ring of lighter cobbles, jars round it (the street sheet's centre)."""
    import ti_town
    world = tm.house_frame(0, 0, 0)
    ms.cyl('lvc_paving_square', ring_r, ring_r, 0.006, at=(x, y, G - 0.002), segs=20, lod=1)
    ms.cyl('lvc_ashlar', ring_r + 0.012, ring_r + 0.012, 0.004, at=(x, y, G - 0.002), segs=20, lod=0, caps=True)
    f = ti_town.well(ms, x, y, yaw=yaw)
    for a in (40, 150, 260):
        tt.jar(ms, world, x + 0.16 * math.cos(math.radians(a + yaw)), y + 0.16 * math.sin(math.radians(a + yaw)), 1.2)
    return f


def stall(ms, x, y, rng, yaw=None, w=0.36, d=0.3):
    """A market stall under a team-cloth awning on posts, jars and baskets on the counter."""
    import ti_bronze as tb
    tb.stall(ms, x, y, rng, yaw=yaw, cloth='team_cloth', w=w, d=d)


def street(ms, x0, y0, x1, y1, w):
    """A lighter cobbled street on the town's ground (a paved strip from (x0, y0) to (x1, y1))."""
    dx, dy = x1 - x0, y1 - y0
    L = math.hypot(dx, dy)
    nx, ny = -dy / L * w / 2, dx / L * w / 2
    pts = [(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny)]
    # counter-clockwise from above
    area = sum(pts[i][0] * pts[(i + 1) % 4][1] - pts[(i + 1) % 4][0] * pts[i][1] for i in range(4))
    if area < 0:
        pts.reverse()
    ms.quad_strip('lvc_paving_square', [(px, py, G + 0.003) for px, py in pts], lod=1)


# ---- landmark 1: the Apadana ----------------------------------------------------------------------

def _bull_capital(ms, f, x, y, z, s):
    """A double bull capital: a bell, a block and two bull foreparts facing out sideways, with
    horns, carrying the cedar beam (Persepolis). `s` is the column radius."""
    ms.cyl('lvc_pale', s * 1.0, s * 1.5, s * 1.6, at=(x, y, z), segs=8, lod=0, frame=f)
    zz = z + s * 1.6
    ms.box('lvc_pale', (s * 2.4, s * 2.2, s * 1.4), at=(x, y, zz), lod=1, frame=f)
    for sx in (-1, 1):
        ms.sphere('lvc_pale', s * 1.05, at=(x + sx * s * 1.9, y, zz + s * 0.8), scale=(1.35, 0.9, 0.95), u=7, v=5, lod=0, frame=f)
        ms.sphere('lvc_pale', s * 0.6, at=(x + sx * s * 2.9, y - s * 0.1, zz + s * 0.75), scale=(1.2, 0.9, 1.0), u=6, v=4, lod=0, frame=f)
        hf = f @ Matrix.Translation(Vector((x + sx * s * 2.6, y, zz + s * 1.5))) @ Matrix.Rotation(math.radians(-sx * 35), 4, 'Y')
        ms.cyl('lvc_pale', s * 0.22, s * 0.08, s * 1.0, at=(0, 0, 0), segs=5, lod=0, frame=hf)
        ms.box('lvc_pale', (s * 0.5, s * 1.6, s * 0.9), at=(x + sx * s * 1.35, y, zz - s * 0.5), lod=0, frame=f)  # the knees
    return zz + s * 1.4


def _merlons(ms, f, x0, x1, y, z, h, n, face_x=False, lod=0):
    """A row of stepped Persian merlons from x0 to x1 at local y (or along y when face_x)."""
    step = (x1 - x0) / n
    for i in range(n):
        c = x0 + step * (i + 0.5)
        at1 = (y, c, z) if face_x else (c, y, z)
        sz1 = (0.03, step * 0.8, h * 0.45) if face_x else (step * 0.8, 0.03, h * 0.45)
        ms.box('lvc_pale', sz1, at=at1, lod=lod, frame=f)
        at2 = (y, c, z + h * 0.45) if face_x else (c, y, z + h * 0.45)
        sz2 = (0.03, step * 0.5, h * 0.55) if face_x else (step * 0.5, 0.03, h * 0.55)
        ms.box('lvc_pale', sz2, at=at2, lod=lod, frame=f, taper=0.35)


def apadana(ms, rng, x, y, w, d, top, yaw=None, columns=6):
    """The Apadana of the sheet (18 x 14 m, 18 m high): a limestone podium with a relief frieze, a
    broad stair up the middle of the front between carved cheek walls, a porch of fluted columns
    with double bull capitals carrying cedar beams, a cream plaster hall behind with pilasters and a
    tall door, a flat roof with a cornice and a crown of stepped merlons; `d` includes the porch,
    the stair projects in front of it."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    p = top * 0.17  # the podium
    sd = p * 1.25  # the stair's run
    foot(f, w, d + sd, 0, -sd / 2, tag='apadana')
    ms.box('lvc_pale', (w, d, p), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    ms.box('lvc_relief', (w + 0.012, d + 0.012, p * 0.5), at=(0, 0, G + p * 0.25), lod=1, frame=f)  # the frieze
    ms.box('lvc_pale', (w + 0.022, d + 0.022, p * 0.1), at=(0, 0, G + p * 0.9), lod=1, frame=f)  # the moulding
    sw = w * 0.42
    steps = 9
    for s in range(steps):
        sz = p * (s + 1) / steps
        ms.box('lvc_pale', (sw, sd / steps + 0.002, sz), at=(0, -d / 2 - sd + sd * (s + 0.5) / steps, G), lod=1, frame=f)
    for sx in (-1, 1):  # the cheek walls, carved, with a parapet sloping up the stair
        ms.box('lvc_relief', (0.04, sd, p * 0.55), at=(sx * (sw / 2 + 0.02), -d / 2 - sd / 2, G), lod=1, frame=f)
        cf = f @ Matrix.Translation(Vector((sx * (sw / 2 + 0.02), -d / 2 - sd / 2, G + p * 0.55))) @ Matrix.Rotation(math.atan2(p * 0.45, sd), 4, 'X')
        ms.box('lvc_pale', (0.045, math.hypot(sd, p * 0.45), 0.025), at=(0, 0, -0.005), lod=0, frame=cf)
    zc = G + p
    # the roof: entablature of cedar beams, cornice, merlons
    beam = top * 0.06
    corn = top * 0.035
    mh = top * 0.06
    zr = G + top - mh - corn - beam  # the beam's foot = the top of the columns and the hall walls
    col_h = zr - zc
    porch = d * 0.36
    hd = d - porch - 0.02
    hy = d / 2 - hd / 2 - 0.01
    ms.box('lvc_plaster', (w * 0.94, hd, col_h), at=(0, hy, zc), lod=2, frame=f)
    ms.box('lvc_pale', (w * 0.94 + 0.01, hd + 0.01, 0.025), at=(0, hy, zc), lod=0, frame=f)
    hw = w * 0.94
    for k in range(5):  # pilasters on the hall's front, sides and back
        px = -hw / 2 + hw * k / 4
        for py in (hy - hd / 2, hy + hd / 2):
            ms.box('lvc_pale', (0.05, 0.016, col_h), at=(px, py, zc), lod=0 if 0 < k < 4 else 1, frame=f)
    for sx in (-1, 1):
        for k in range(1, 3):
            ms.box('lvc_pale', (0.016, 0.05, col_h), at=(sx * hw / 2, hy - hd / 2 + hd * k / 3, zc), lod=0, frame=f)
    fy = hy - hd / 2
    ms.box('door', (w * 0.11, 0.012, col_h * 0.42), at=(0, fy - 0.004, zc), lod=1, frame=f)
    ms.box('lvc_pale', (w * 0.15, 0.02, col_h * 0.48), at=(0, fy - 0.002, zc), lod=0, frame=f)
    ms.box('lvc_pale', (w * 0.18, 0.03, 0.03), at=(0, fy - 0.006, zc + col_h * 0.48), lod=0, frame=f)
    cr = min(0.034, w / (columns * 5.2))
    cap_h = cr * 3.0
    shaft = col_h - cap_h - 0.02
    ys = [-d / 2 + 0.05, -d / 2 + porch * 0.62]
    for row, cy in enumerate(ys):
        for i in range(columns):
            if row == 1 and 0 < i < columns - 1:
                continue  # the second row shows at the ends only (sheet side view)
            cx = -w / 2 + 0.06 + (w - 0.12) * i / (columns - 1)
            ms.box('lvc_pale', (cr * 3.0, cr * 3.0, 0.02), at=(cx, cy, zc), lod=0, frame=f)
            ms.cyl('lvc_pale', cr * 1.25, cr * 1.0, 0.025, at=(cx, cy, zc + 0.02), segs=10, lod=0, frame=f)
            ms.cyl('lvc_pale', cr, cr * 0.88, shaft, at=(cx, cy, zc + 0.02), segs=12, lod=1, frame=f)
            _bull_capital(ms, f, cx, cy, zc + 0.02 + shaft, cr)
    # the cedar beams: an architrave round the whole roof, beam ends over the porch
    ms.box('lvc_cedar', (w + 0.02, d + 0.02, beam), at=(0, 0, zr), lod=2, frame=f)
    for i in range(columns * 2 + 1):
        bx = -w / 2 + 0.03 + (w - 0.06) * i / (columns * 2)
        ms.box('lvc_cedar', (0.025, 0.04, beam * 0.6), at=(bx, -d / 2 - 0.01, zr + beam * 0.2), lod=0, frame=f)
    ms.box('lvc_pale', (w + 0.06, d + 0.06, corn), at=(0, 0, zr + beam), lod=2, frame=f)
    ms.box('lvc_pale', (w + 0.04, d + 0.04, 0.012), at=(0, 0, zr + beam - 0.012), lod=0, frame=f)
    zt = zr + beam + corn
    # the merlons round the roof (a plain band stands in at LOD1 and LOD2)
    n = max(10, int(w / 0.075))
    nd = max(8, int(d / 0.075))
    for sy in (-1, 1):
        _merlons(ms, f, -w / 2 - 0.015, w / 2 + 0.015, sy * (d / 2 + 0.012), zt, mh, n)
    for sx in (-1, 1):
        _merlons(ms, f, -d / 2 + 0.06, d / 2 - 0.06, sx * (w / 2 + 0.012), zt, mh, nd - 1, face_x=True)
    for sy in (-1, 1):
        box_only(ms, 'lvc_pale', (w + 0.03, 0.03, mh * 0.6), (0, sy * (d / 2 + 0.012), zt), f, (1, 2))
    for sx in (-1, 1):
        box_only(ms, 'lvc_pale', (0.03, d, mh * 0.6), (sx * (w / 2 + 0.012), 0, zt), f, (1, 2))
    for sx in (-1, 1):  # the corner blocks on the roof (top view)
        for sy in (-1, 1):
            ms.box('lvc_pale', (0.06, 0.06, 0.04), at=(sx * (w / 2 - 0.1), sy * (d / 2 - 0.1), zt), lod=0, frame=f)
    return f


# ---- landmark 2: the rock-cut tomb ----------------------------------------------------------------

def rough_block(ms, rng, f, size, at, cuts=2, amp=0.03, mat='lvc_rock', lod=1, keep_base=True, plain=True):
    """A block of rough rock: a box with its surface grid jittered (a closed solid); a plain box
    stands in for it below `lod`."""
    w, d, h = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co.z += 0.5
        v.co.x *= w
        v.co.y *= d
        v.co.z *= h
        if keep_base and v.co.z < 1e-4:
            v.co.x += rng.uniform(-amp, amp) * 0.5
            v.co.y += rng.uniform(-amp, amp) * 0.5
            continue
        v.co.x += rng.uniform(-amp, amp)
        v.co.y += rng.uniform(-amp, amp)
        v.co.z += rng.uniform(-amp, amp) * 0.8
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, 0 if plain else lod, matrix=f @ Matrix.Translation(Vector(at)))
    if plain and lod >= 1:
        box_only(ms, mat, size, at, f, tuple(range(1, lod + 1)))


def _pediment(ms, f, x, y, z, w, h, depth=0.03, mat='lvc_carved', lod=1):
    bm = bmesh.new()
    a = [bm.verts.new((x - w / 2, y, z)), bm.verts.new((x + w / 2, y, z)), bm.verts.new((x, y, z + h))]
    b = [bm.verts.new((x - w / 2, y + depth, z)), bm.verts.new((x + w / 2, y + depth, z)), bm.verts.new((x, y + depth, z + h))]
    bm.faces.new((a[0], a[1], a[2]))
    bm.faces.new((b[2], b[1], b[0]))
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((a[j], a[i], b[i], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy())


def rock_tomb(ms, rng, x, y, w, d, top, yaw=None, facade=None):
    """The rock-cut tomb of the sheet (Petra: a front 18 m wide and 20 m high cut 4 m deep into a
    rose sandstone cliff): the cliff block with rough sides, back and top, a niche cut into its
    front, and in it the carved front in two orders: below, six columns with capitals, an
    entablature and a pediment over the middle four, a dark doorway up three steps; above, a round
    tholos with columns, a conical roof and an urn between two half pavilions with broken
    pediments; statues in the intercolumns."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    foot(f, w, d, tag='tomb')
    fw = facade or w * 0.7  # the niche (the carved front's width)
    rec = min(0.14, d * 0.3)  # how deep the niche is cut
    wing = (w - fw) / 2
    nh = top * 0.86  # the niche's height
    yb0 = -d / 2 + rec  # the niche's back plane
    # the cliff: the back mass behind the niche, the two wings beside it, the cap over it
    rough_block(ms, rng, f, (w, d - rec, top), (0, (yb0 + d / 2) / 2, G - 0.01), cuts=3, amp=0.03, lod=2)
    for sx in (-1, 1):
        rough_block(ms, rng, f, (wing + 0.02, rec + 0.02, top * rng.uniform(0.93, 1.0)), (sx * (fw / 2 + wing / 2), -d / 2 + rec / 2, G - 0.01),
                    cuts=2, amp=0.022, lod=2)
    rough_block(ms, rng, f, (fw + 0.02, rec + 0.02, top - nh), (0, -d / 2 + rec / 2, G + nh), cuts=2, amp=0.02, lod=2)
    # the carved front, standing on the niche's back plane
    zf = G
    yf = yb0  # front faces -Y
    ms.box('lvc_carved', (fw, 0.02, nh), at=(0, yf + 0.004, zf), lod=2, frame=f)  # the smooth cut face
    for s in range(3):  # the steps
        ms.box('lvc_carved', (fw * (0.8 - s * 0.06), 0.03, 0.012 * (3 - s)), at=(0, yf - rec + 0.03 + s * 0.03, zf), lod=0, frame=f)
    h1 = nh * 0.46  # the lower order
    ent = nh * 0.06
    ped = nh * 0.08
    cr = min(0.03, fw / 36)
    yc = yf - cr * 1.6
    for i in range(6):
        cx = -fw / 2 + fw * 0.07 + fw * 0.86 * i / 5
        ms.box('lvc_carved', (cr * 2.6, cr * 2.6, 0.016), at=(cx, yc, zf + 0.03), lod=0, frame=f)
        ms.cyl('lvc_carved', cr, cr * 0.9, h1 - 0.07, at=(cx, yc, zf + 0.04), segs=10, lod=1, frame=f)
        ms.cyl('lvc_carved', cr * 0.95, cr * 1.5, 0.03, at=(cx, yc, zf + h1 - 0.04), segs=10, lod=0, frame=f)
    ms.box('dark', (fw * 0.13, 0.012, h1 * 0.55), at=(0, yf - 0.002, zf + 0.04), lod=1, frame=f)  # the doorway
    ms.box('lvc_carved', (fw * 0.17, 0.016, 0.02), at=(0, yf - 0.006, zf + 0.04 + h1 * 0.55), lod=0, frame=f)
    for k in (-1, 1):  # the statues between the outer columns
        cx = k * fw * 0.36
        ms.box('lvc_carved', (0.05, 0.02, h1 * 0.5), at=(cx, yf - 0.004, zf + 0.12), lod=0, frame=f)
        ms.sphere('lvc_carved', 0.018, at=(cx, yf - 0.012, zf + 0.12 + h1 * 0.5 + 0.012), u=6, v=4, lod=0, frame=f)
    ms.box('lvc_carved', (fw * 0.96, cr * 3.6, ent), at=(0, yc + 0.004, zf + h1), lod=1, frame=f)  # the entablature
    ms.box('lvc_carved', (fw * 0.98, cr * 4.2, ent * 0.3), at=(0, yc + 0.002, zf + h1 + ent * 0.7), lod=0, frame=f)
    _pediment(ms, f, 0, yc - cr * 1.6, zf + h1 + ent, fw * 0.62, ped, depth=cr * 3.2)
    # the upper order: a round tholos in the middle, half pavilions to the sides
    z2 = zf + h1 + ent + ped * 0.6
    h2 = nh - (z2 - zf) - nh * 0.04
    ms.box('lvc_carved', (fw * 0.9, cr * 3.0, 0.03), at=(0, yc + 0.005, z2 - 0.01), lod=1, frame=f)  # the attic
    tr = fw * 0.11
    ty = yf - tr * 0.55
    ms.cyl('lvc_carved', tr * 0.75, tr * 0.75, h2 * 0.62, at=(0, ty, z2), segs=12, lod=1, frame=f)
    for k in range(6):
        a = math.pi * (0.1 + 0.8 * k / 5) + math.pi
        ms.cyl('lvc_carved', cr * 0.7, cr * 0.65, h2 * 0.58, at=(tr * math.cos(a), ty + tr * math.sin(a) * 0.9, z2 + 0.02), segs=6, lod=0, frame=f)
    ms.cyl('lvc_carved', tr * 1.05, tr * 1.05, 0.025, at=(0, ty, z2 + h2 * 0.6), segs=12, lod=0, frame=f)
    ms.cyl('lvc_carved', tr * 0.95, tr * 0.12, h2 * 0.26, at=(0, ty, z2 + h2 * 0.62 + 0.02), segs=12, lod=1, frame=f)
    ms.lathe('lvc_carved', [(0.0, 0.0), (0.016, 0.005), (0.026, 0.03), (0.02, 0.05), (0.008, 0.06), (0.0, 0.07)],
             at=(0, ty, z2 + h2 * 0.86), segs=8, lod=0, frame=f)  # the urn
    for sx in (-1, 1):
        px = sx * fw * 0.36
        pw = fw * 0.24
        for k in (-1, 1):
            ms.cyl('lvc_carved', cr * 0.85, cr * 0.8, h2 * 0.6, at=(px + k * pw * 0.35, yc + 0.004, z2 + 0.02), segs=8, lod=1, frame=f)
        ms.box('lvc_carved', (0.05, 0.02, h2 * 0.4), at=(px, yf - 0.004, z2 + 0.06), lod=0, frame=f)  # a statue panel
        ms.box('lvc_carved', (pw + 0.03, cr * 3.2, 0.035), at=(px, yc + 0.004, z2 + h2 * 0.6 + 0.02), lod=1, frame=f)
        # the broken pediment: only the outer half rises
        bm = bmesh.new()
        zz = z2 + h2 * 0.6 + 0.055
        x_out, x_in = px + sx * (pw / 2 + 0.015), px - sx * pw * 0.05
        yy0, yy1 = yc - cr * 1.6, yc + cr * 1.6
        a = [bm.verts.new((x_out, yy0, zz)), bm.verts.new((x_in, yy0, zz)), bm.verts.new((x_in, yy0, zz + h2 * 0.16))]
        b = [bm.verts.new((x_out, yy1, zz)), bm.verts.new((x_in, yy1, zz)), bm.verts.new((x_in, yy1, zz + h2 * 0.16))]
        bm.faces.new((a[0], a[1], a[2]))
        bm.faces.new((b[2], b[1], b[0]))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new((a[j], a[i], b[i], b[j]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ms.add(bm, 'lvc_carved', 1, matrix=f.copy())
    # fallen rock and scree at the foot of the cliff
    for k in range(5):
        sx = rng.choice([-1, 1])
        px = sx * rng.uniform(fw / 2 + 0.02, w / 2 + 0.04)
        py = -d / 2 - rng.uniform(0.0, 0.06)
        s = rng.uniform(0.03, 0.06)
        rough_block(ms, rng, f, (s * 1.3, s, s * 0.8), (px, py, G - 0.005), cuts=1, amp=s * 0.2, lod=0, plain=False)
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
