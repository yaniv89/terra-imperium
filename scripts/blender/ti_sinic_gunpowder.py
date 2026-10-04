# scripts/blender/ti_sinic_gunpowder.py
# The Gunpowder Age Sinic kit (China, Taiwan, Hong Kong, Macau, the Koreas, Japan; Ming and Qing,
# Edo Japan; plans/art-image-spec.md section 3b; sheets in plans/art/kits/sinic/gunpowder/): a town
# is layout x kit, so these towns stand on the base Gunpowder layouts
# (build_town_gunpowder_<size>_<v>.py) with the kit's buildings on their spots:
# - houses (houses.png, street.png, roofscape.png): the poor cottage of white plaster on a grey
#   brick dado under a grey tiled gable with a fenced yard, an awning, jars and a rack; the common
#   courtyard house (a hall with dark lattice fronts across the back, a gabled side wing, a grey
#   brick front wall with a small roofed gate); the rich siheyuan (the hall under a hip roof with
#   upturned corners, gabled wings down both sides, a gatehouse in the plastered front wall, trees
#   and team-grey hangings in the court);
# - landmark-1, the barbican gate: a battered grey brick D-shaped bastion with merlons, an arched
#   gate passage, team banners on the front, a double-eave gate tower with red posts on top and
#   awning pavilions at the back corners;
# - landmark-2, the yellow-roof temple: a white stone terrace with balustrades, stairs and bronze
#   urns, a red hall under a double-eave yellow glazed hip roof with painted brackets, corner
#   pavilions under yellow pyramids joined by galleries;
# - landmark-japan, the Edo castle keep: a battered fitted-stone base, five white plaster tiers
#   with dark timber bands and barred windows under grey tile eaves, triangular gables and gold
#   ridge fish; Japan's houses are Edo machiya (dark lattice fronts, white plaster upper storeys,
#   pent roofs, team-grey noren), board row houses and walled houses with roofed gates.
# The base layouts' European pieces become Sinic ones: town halls the barbican (Japan: the keep),
# churches the temple (Japan: grey-tiled), windmills the temple or a yellow-roof shrine, wells get
# grey tile roofs, iron lamps red lanterns (Japan: stone lanterns), barrels jars, the cobbles grey
# stone paving (Japan: packed earth). Stalls, gardens, trees, fences and bastions stay as they are.
# Materials carry the `sng_` prefix.
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
import ti_gunpowder as gp  # noqa: E402
from ti_town import G  # noqa: E402
from ti_gunpowder import _t, _rz  # noqa: E402

NEW = ['sng_plaster', 'sng_brick', 'sng_tile', 'sng_ridge', 'sng_yellow', 'sng_lacquer', 'sng_lattice', 'sng_marble',
       'sng_paint', 'sng_bronze', 'sng_granite', 'sng_board', 'sng_gold', 'sng_lantern', 'sng_jar',
       'sng_paving', 'sng_paving_fringe', 'sng_paving_square', 'sng_earth', 'sng_earth_fringe', 'sng_earth_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({n: 'Ground' for n in ('sng_paving', 'sng_paving_fringe', 'sng_paving_square',
                                          'sng_earth', 'sng_earth_fringe', 'sng_earth_square')})
for _n in ('sng_paving_fringe', 'sng_earth_fringe'):
    if _n not in tt.FRINGES:
        tt.FRINGES.append(_n)


def make_materials():
    # white lime plaster with grey weathering (the sheet's walls)
    tm.mat_simple('sng_plaster', ['#e4e1d8', '#efece5', '#d6d2c6', '#c9c5b9'], scale=14.0, bump=0.2, dirt=True)
    # grey brick (dados, front walls, the barbican)
    tm.mat_mudwall('sng_brick', wash='#7a7b78', brick='#777874', brick2='#62635f', mortar='#a3a19a', wash_cover=0.0,
                   bond=(0.034, 0.012, 0.0018))
    # grey ceramic roof tile: courses down the slope
    tm.mat_mudwall('sng_tile', wash='#4f5356', brick='#565a5e', brick2='#43474b', mortar='#2a2d30', wash_cover=0.0,
                   bond=(0.02, 0.012, 0.0025))
    tm.mat_simple('sng_ridge', ['#34373a', '#3f4245', '#2c2f31'], scale=30.0, bump=0.3)
    # yellow glazed imperial tile
    tm.mat_mudwall('sng_yellow', wash='#d39a2a', brick='#dba634', brick2='#c48a22', mortar='#8a5e18', wash_cover=0.0,
                   bond=(0.014, 0.008, 0.002))
    tm.mat_simple('sng_lacquer', ['#8c2a1e', '#9e3324', '#7a2218'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 2.0}, bump=0.2)
    # dark lattice timber (house fronts, Japan's beams and boarding)
    tm.mat_simple('sng_lattice', ['#3e2b1e', '#4c3726', '#33241a'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 2.0}, bump=0.4)
    tm.mat_simple('sng_board', ['#3a3029', '#463a31', '#2f2721'], scale=8.0,
                  stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 3.0}, bump=0.4)
    # white stone of the temple terrace and balustrades
    tm.mat_mudwall('sng_marble', wash='#d2cfc6', brick='#d0ccc2', brick2='#c0bcb1', mortar='#9a968c', wash_cover=0.0,
                   bond=(0.08, 0.04, 0.003))
    # the painted brackets under the eaves: blue-green with gold
    tm.mat_simple('sng_paint', ['#2e5f66', '#24496a', '#3f7a5e', '#b08a3a'], scale=60.0, bump=0.2)
    tm.mat_simple('sng_bronze', ['#2f3a32', '#3c4a3f', '#27302a'], scale=20.0, rough=0.5, metal=0.4, bump=0.2)
    # fitted granite of the castle base
    tm.mat_mudwall('sng_granite', wash='#77746c', brick='#7a776f', brick2='#615e57', mortar='#3e3c38', wash_cover=0.0,
                   bond=(0.05, 0.035, 0.004))
    tm.mat_simple('sng_gold', ['#c69a3a', '#dcb24c', '#a87e2a'], scale=20.0, rough=0.35, metal=0.7, bump=0.1)
    tm.mat_simple('sng_lantern', ['#b8322a', '#cc4434', '#a52a22'], scale=20.0, bump=0.1)
    tm.mat_simple('sng_jar', ['#4a3424', '#5a402c', '#3c2a1e'], scale=16.0, rough=0.5, bump=0.1)
    # the ground: grey stone slabs; the square larger pale slabs; Japan packed earth
    for n in ('sng_paving', 'sng_paving_fringe'):
        tc.mat_paving(n, stone=('#8e8c86', '#85837d', '#97958e'), mortar='#6e6c66', slab=(0.032, 0.022))
    tc.mat_paving('sng_paving_square', stone=('#a9a69e', '#a09d95', '#b1aea6'), mortar='#85827a', slab=(0.05, 0.036))
    jp = ('#a89676', '#b6a483', '#9c8a6a', '#bfae8e')
    tm.mat_earth('sng_earth', colors=jp)
    tm.mat_earth('sng_earth_fringe', colors=jp)
    tc.mat_paving('sng_earth_square', stone=('#a7a298', '#99948a', '#b3aea4'), mortar='#6d695f', slab=(0.06, 0.04))


if not any(n == 'sinic-gunpowder' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('sinic-gunpowder', make_materials))

KIT = {'mode': 'sinic', 'replace': {}, 'used': set()}
ORIG_WELL = gp.well


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


def ring_solid(ms, f, loops, mat, lod=2, cx=0.0, cy=0.0, only=None):
    """A closed ring from loops [(half w, half d, z, corner curl)...] of 8 vertices each (corners
    lifted by the curl), each loop joined to the next and the last back to the first: an eave
    whose corners turn up."""
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def curved_hip(ms, f, w, d, z0, rise, mat='sng_tile', ridge='sng_ridge', over=0.06, curl=0.035, lod=2, ornaments=True,
               cx=0.0, cy=0.0, horns=0.0, finial=False, only=None, ridge_lod=1):
    """A hip roof (ridge along local X when w > d, a pyramid when square) with deep eaves whose
    corners turn up, a ridge, hip ridges and upturned ridge-end ornaments."""
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
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)
    if only is not None:
        return
    if r > 0.001:
        ms.box(ridge, (2 * r + 0.03, 0.03, 0.024), at=(cx, cy, zt - 0.01), lod=min(lod, ridge_lod), frame=f)
    if not ornaments:
        return
    for sx in (-1, 1):
        for sy in (-1, 1):
            beam(ms, ridge, (cx + sx * W, cy + sy * D, ze + curl + 0.01), (cx + sx * r, cy, zt + 0.004), w=0.014,
                 h=0.014, lod=0, frame=f)
    if r > 0.001 and horns > 0:
        for sx in (-1, 1):
            ms.box(ridge, (0.02, 0.028, horns), at=(cx + sx * (r + 0.006), cy, zt), lod=0, frame=f, taper=0.7)
    if finial:
        ms.cyl(ridge, 0.018, 0.022, 0.026, at=(cx, cy, zt - 0.01), segs=6, lod=1, frame=f)
        ms.sphere('sng_gold', 0.018, at=(cx, cy, zt + 0.03), u=6, v=4, lod=0, frame=f)


def eave_ring(ms, f, lw, ld, uw, ud, ze, zi, curl, mat='sng_tile', ridge='sng_ridge', lod=2, hips=True):
    """The lower eave of a double roof: from the eave line (half sizes lw, ld at ze, corners up by
    curl) up to the upper storey's wall (half sizes uw, ud at zi)."""
    ring_solid(ms, f, [(lw, ld, ze - 0.018, curl), (lw, ld, ze, curl), (uw, ud, zi, 0.0), (uw, ud, ze - 0.018, 0.0)], mat,
               lod=lod)
    if hips:
        for sx in (-1, 1):
            for sy in (-1, 1):
                beam(ms, ridge, (sx * lw, sy * ld, ze + curl + 0.008), (sx * uw, sy * ud, zi + 0.006), w=0.014, h=0.014,
                     lod=0, frame=f)


def block_lod2(ms, f, w, d, h, rise, wall='sng_plaster', roof='sng_tile', cx=0.0, cy=0.0, kind='hip', z0=G):
    """A LOD2-only stand-in: four walls (no floor) under a hip or gable cap, about 14 triangles."""
    W, D = w / 2, d / 2
    bm = bmesh.new()
    b = [bm.verts.new((cx + x, cy + y, z0)) for x, y in ((-W, -D), (W, -D), (W, D), (-W, D))]
    t = [bm.verts.new((cx + x, cy + y, z0 + h)) for x, y in ((-W, -D), (W, -D), (W, D), (-W, D))]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    ms.add(bm, wall, 2, matrix=f.copy(), only=2)
    bm = bmesh.new()
    t = [bm.verts.new((cx + x, cy + y, z0 + h)) for x, y in ((-W, -D), (W, -D), (W, D), (-W, D))]
    zt = z0 + h + rise
    if kind == 'gable':
        r0, r1 = bm.verts.new((cx - W, cy, zt)), bm.verts.new((cx + W, cy, zt))
        bm.faces.new((t[0], t[1], r1, r0))
        bm.faces.new((t[2], t[3], r0, r1))
        bm.faces.new((t[1], t[2], r1))
        bm.faces.new((t[3], t[0], r0))
    else:
        r = max(0.0, W - D)
        if r > 0.001:
            r0, r1 = bm.verts.new((cx - r, cy, zt)), bm.verts.new((cx + r, cy, zt))
            bm.faces.new((t[0], t[1], r1, r0))
            bm.faces.new((t[2], t[3], r0, r1))
            bm.faces.new((t[1], t[2], r1))
            bm.faces.new((t[3], t[0], r0))
        else:
            p = bm.verts.new((cx, cy, zt))
            for i in range(4):
                bm.faces.new((t[i], t[(i + 1) % 4], p))
    ms.add(bm, roof, 2, matrix=f.copy(), only=2)


def gable_tile(ms, f, w, d, z0, rise, over=0.035, lod=1, gable='sng_plaster', mat='sng_tile', horns=True):
    """A grey tiled gable (ridge along local X) with plaster gable ends and upturned ridge ends."""
    tc.gable_roof(ms, f, w, d, z0, rise, over=over, mat=mat, gable=gable, thick=0.018, lod=lod, ridge='sng_ridge')
    if horns:
        for sx in (-1, 1):
            ms.box('sng_ridge', (0.018, 0.026, 0.032), at=(sx * (w / 2 + over), 0, z0 + rise - 0.004), lod=0, frame=f,
                   taper=0.7)


def lattice(ms, f, x, y, z, w=0.08, h=0.07, mat='sng_lattice', lod=0):
    """A lattice window on a wall face at local y (facing -Y): a dark opening behind bars."""
    ms.box('dark', (w, 0.008, h), at=(x, y - 0.003, z), lod=lod, frame=f)
    for k in (-1, 0, 1):
        ms.box(mat, (0.006, 0.006, h), at=(x + k * w / 4, y - 0.008, z), lod=0, frame=f)
    ms.box(mat, (w + 0.012, 0.008, 0.01), at=(x, y - 0.006, z + h), lod=0, frame=f)


def dbl_door(ms, f, x, y, w=0.11, h=0.18, z=G, frame_mat='sng_lattice', lod=1):
    ms.box('door', (w, 0.01, h), at=(x, y - 0.004, z), lod=lod, frame=f)
    ms.box(frame_mat, (w + 0.024, 0.014, 0.016), at=(x, y - 0.006, z + h), lod=0, frame=f)


def wall_run(ms, f, x0, y0, x1, y1, h=0.15, t=0.032, wall='sng_brick', coping='sng_tile', lod=1, plaster_band=False):
    """A courtyard wall in frame f from (x0, y0) to (x1, y1) with a grey tiled coping."""
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 0.01:
        return
    wf = f @ _t((x0 + x1) / 2, (y0 + y1) / 2, 0) @ _rz(math.degrees(math.atan2(y1 - y0, x1 - x0)))
    ms.box(wall, (L, t, h), at=(0, 0, G), lod=lod, frame=wf)
    if plaster_band:
        ms.box('sng_plaster', (L - 0.01, t + 0.004, h * 0.55), at=(0, 0, G + h * 0.3), lod=0, frame=wf)
    ms.box(coping, (L + 0.012, t + 0.03, 0.02), at=(0, 0, G + h), lod=min(lod, 1), frame=wf, taper=0.55)


def small_gate(ms, f, x, y, w=0.13, h=0.17, roof=True, lod=1, posts='sng_lattice'):
    """A gate in a front wall at local (x, y): plank doors between posts under a small tiled gable."""
    dbl_door(ms, f, x, y, w=w * 0.75, h=h * 0.85, lod=lod)
    for sx in (-1, 1):
        ms.box(posts, (0.022, 0.03, h), at=(x + sx * w / 2, y, G), lod=lod, frame=f)
    if roof:
        gable_tile(ms, f @ _t(x, y, 0), w + 0.03, 0.07, G + h, 0.05, over=0.025, lod=lod, gable='sng_lattice')


def jars(ms, f, x, y, rng, n=2):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.025, 0.025), rng.uniform(0.9, 1.2), mat='sng_jar')


def balustrade(ms, f, x0, y0, x1, y1, z, h=0.04, step=0.07, lod=0, rail_lod=1):
    """A white stone balustrade: a top rail on posts."""
    L = math.hypot(x1 - x0, y1 - y0)
    if L < 0.02:
        return
    a = math.degrees(math.atan2(y1 - y0, x1 - x0))
    bf = f @ _t((x0 + x1) / 2, (y0 + y1) / 2, 0) @ _rz(a)
    ms.box('sng_marble', (L, 0.014, 0.012), at=(0, 0, z + h - 0.012), lod=rail_lod, frame=bf)
    n = max(1, int(L / step))
    for i in range(n + 1):
        ms.box('sng_marble', (0.014, 0.014, h), at=(-L / 2 + L * i / n, 0, z), lod=lod, frame=bf)


# ---- Sinic houses -------------------------------------------------------------------------------

def hall_block(ms, f, w, d, h, cx=0.0, cy=0.0, posts=4, post_mat='sng_lattice', roof='hip', rise=0.13, lod=1,
               roof_mat='sng_tile', windows=True, door=True):
    """A house hall on a stone plinth: a grey brick dado, white plaster, a row of posts with a beam
    and lattice panels on the front, a door, under a grey hip roof with upturned corners (or a
    gable with plaster ends)."""
    hf = f @ _t(cx, cy, 0)
    ms.box('stone', (w + 0.03, d + 0.03, 0.025), at=(0, 0, G), lod=min(lod, 1), frame=hf)
    z = G + 0.02
    ms.box('sng_plaster', (w, d, h), at=(0, 0, z), lod=lod, frame=hf)
    ms.box('sng_brick', (w + 0.006, d + 0.006, h * 0.28), at=(0, 0, z), lod=0, frame=hf)
    fy = -d / 2 - 0.004
    for i in range(posts):
        px = -w / 2 + 0.012 + (w - 0.024) * i / (posts - 1)
        ms.box(post_mat, (0.022, 0.02, h), at=(px, fy, z), lod=min(lod, 1) if i in (0, posts - 1) else 0, frame=hf)
    ms.box(post_mat, (w + 0.01, 0.02, 0.022), at=(0, fy, z + h - 0.022), lod=min(lod, 1), frame=hf)
    if door:
        dbl_door(ms, hf, 0, -d / 2, w=0.1, h=h * 0.68, z=z)
    if windows:
        for i in range(posts - 1):
            wx = -w / 2 + w * (i + 0.5) / (posts - 1)
            if door and abs(wx) < 0.07:
                continue
            lattice(ms, hf, wx, -d / 2, z + h * 0.3, w=min(0.1, w / (posts - 1) * 0.7), h=h * 0.45)
    if roof == 'hip':
        curved_hip(ms, hf, w, d, z + h, rise, mat=roof_mat, over=0.05, curl=0.03, lod=lod, horns=0.03)
    else:
        gable_tile(ms, hf, w, d, z + h, rise, lod=lod)
    return hf


def wing(ms, f, cx, cy, w, d, h, side, lod=1):
    """A side wing whose long side faces the court (its ridge along local Y, its gable plaster ends
    at the front and back), with a door and a lattice window on the court side."""
    wf = f @ _t(cx, cy, 0) @ _rz(90)
    ms.box('stone', (d + 0.02, w + 0.02, 0.02), at=(0, 0, G), lod=0, frame=wf)
    ms.box('sng_plaster', (d, w, h), at=(0, 0, G), lod=lod, frame=wf)
    ms.box('sng_brick', (d + 0.006, w + 0.006, h * 0.3), at=(0, 0, G), lod=0, frame=wf)
    gable_tile(ms, wf, d, w, G + h, 0.1, lod=lod)
    cf = f @ _t(cx - side * w / 2, cy, 0) @ _rz(-90 * side)  # the face toward the court
    ms.box('door', (0.06, 0.008, h * 0.7), at=(0.0, -0.003, G), lod=0, frame=cf)
    if d > 0.22:
        lattice(ms, cf, -side * 0.0 + (d * 0.28), 0, G + h * 0.35, w=0.06, h=h * 0.36)


def poor_house(ms, rng, x, y, w, d, yaw=None, awning=None, **_ignored):
    """The poor cottage (houses.png left): white plaster on a grey brick dado, timber corner posts,
    a grey tiled gable with its eaves to the street, a plank door with a stone step and a lattice
    window; beside it a yard behind a plastered wall and a timber fence, a lean-to, jars, a rack
    and a team-grey awning."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    side = rng.choice([-1, 1])
    hw = min(max(w * 0.62, 0.36), 0.5)
    hd = min(d * 0.78, 0.46)
    h = 0.27
    hx = side * (w - hw) / 2
    hy = (d - hd) / 2
    hf = f @ _t(hx, hy, 0)
    ms.box('sng_brick', (hw + 0.012, hd + 0.012, 0.07), at=(0, 0, G), lod=1, frame=hf)
    ms.box('sng_plaster', (hw, hd, h), at=(0, 0, G), lod=1, frame=hf)
    for sx in (-1, 1):
        ms.box('timber', (0.02, 0.02, h), at=(sx * hw / 2, -hd / 2, G), lod=0, frame=hf)
    gable_tile(ms, hf, hw, hd, G + h, 0.13, over=0.035, lod=1)
    dx = -side * hw * 0.18
    ms.box('door', (0.075, 0.01, 0.17), at=(dx, -hd / 2 - 0.004, G + 0.015), lod=1, frame=hf)
    ms.box('stone', (0.1, 0.035, 0.015), at=(dx, -hd / 2 - 0.02, G), lod=0, frame=hf)
    lattice(ms, hf, side * hw * 0.24, -hd / 2, G + 0.12, w=0.07, h=0.06, mat='timber')
    block_lod2(ms, hf, hw, hd, h, 0.13, kind='gable')
    # the yard
    rest = w - hw
    yx0 = -side * hw / 2 + hx
    yx1 = -side * w / 2
    fy = -d / 2 + 0.03
    if rest > 0.1:
        wall_run(ms, f, yx0, fy, (yx0 + yx1) / 2, fy, h=0.11, lod=0, wall='sng_plaster')
        tb_fence(ms, f, (yx0 + yx1) / 2, fy, yx1, fy)
        wall_run(ms, f, yx1, fy, yx1, d / 2 - 0.02, h=0.11, lod=0, wall='sng_brick')
        px = (yx0 + yx1) / 2
        jars(ms, f, px - side * 0.03, d * 0.25, rng, 2)
        if rest > 0.17:
            tt.rack(ms, f, px, d * 0.02, yaw=90)
    if awning or rng.random() < 0.45:
        aw = min(0.24, hw * 0.55)
        tt.front_shade(ms, hf, -dx * 0.2 + side * hw * 0.2, -hd / 2 - 0.01, aw, depth=0.12, z=0.22, mat='team_cloth')
    else:
        jars(ms, hf, side * hw * 0.3, -hd / 2 - 0.05, rng, 2)
    return f


def tb_fence(ms, f, x0, y0, x1, y1, h=0.09):
    """A low timber yard fence."""
    L = math.hypot(x1 - x0, y1 - y0)
    n = max(1, round(L / 0.06))
    for i in range(n + 1):
        t = i / n
        ms.box('timber', (0.01, 0.01, h), at=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, G), lod=0, frame=f)
    for zz in (0.035, 0.075):
        beam(ms, 'timber', (x0, y0, G + zz), (x1, y1, G + zz), w=0.008, h=0.008, lod=0, frame=f)


def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, awning=None, **_ignored):
    """The courtyard house (houses.png middle and right, street.png): the main hall across the back
    with dark lattice fronts and a hip roof with upturned corners, gabled wings facing the court
    (one for the common house, two for the rich), a front wall with a roofed gate (the rich: a
    plastered wall, a gatehouse with team-grey hangings), a tree, jars and an awning in the court."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hd = min(d * 0.42, 0.28)
    hw = w - 0.02
    h = 0.3 if rich else 0.27
    hall_block(ms, f, hw, hd, h, cy=d / 2 - hd / 2 - 0.01, posts=5 if hw > 0.55 else 4, rise=0.15 if rich else 0.13)
    block_lod2(ms, f, hw, hd, h + 0.02, 0.15, cy=d / 2 - hd / 2 - 0.01)
    fy = -d / 2 + 0.02
    ww = min(0.18, w * 0.27)
    wd = d - hd - 0.1
    sides = (-1, 1) if rich else (rng.choice([-1, 1]),)
    for sx in sides:
        wing(ms, f, sx * (w / 2 - ww / 2 - 0.005), fy + 0.03 + wd / 2, ww, wd, 0.22, sx)
    # the front wall and its gate
    gx = 0.0 if rich else -sides[0] * w * 0.18
    gw = 0.2 if rich else 0.13
    wh = 0.17 if rich else 0.14
    wall = 'sng_plaster' if rich else 'sng_brick'
    for a, b in ((-w / 2, gx - gw / 2), (gx + gw / 2, w / 2)):
        wall_run(ms, f, a, fy, b, fy, h=wh, wall=wall, lod=1)
        if rich:
            ms.box('sng_brick', (b - a, 0.036, wh * 0.32), at=((a + b) / 2, fy, G), lod=0, frame=f)
    if rich:
        gf = f @ _t(gx, fy, 0)
        ms.box('sng_brick', (gw + 0.04, 0.09, wh + 0.05), at=(0, 0, G), lod=1, frame=gf)
        dbl_door(ms, gf, 0, -0.045, w=0.11, h=0.17, frame_mat='sng_lacquer')
        for sx in (-1, 1):
            ms.box('sng_lacquer', (0.02, 0.02, wh + 0.04), at=(sx * 0.075, -0.052, G), lod=0, frame=gf)
            ms.box('team_cloth', (0.035, 0.005, 0.11), at=(sx * 0.11, -0.05, G + 0.06), lod=1, frame=gf)
        curved_hip(ms, gf, gw + 0.04, 0.09, G + wh + 0.05, 0.08, over=0.035, curl=0.02, lod=1, ornaments=False)
        for k in range(2):
            ms.box('stone', (0.16 - 0.04 * k, 0.03, 0.012 * (k + 1)), at=(0, -0.08 + 0.022 * k, G), lod=0, frame=gf)
        for sx in (-1, 1):
            p = f @ Vector((sx * w * 0.2, fy + 0.03 + wd * 0.45, 0))
            tc.broadleaf(ms, p.x, p.y, h=0.3, r=0.075)
    else:
        small_gate(ms, f, gx, fy, w=gw, h=wh + 0.03)
        p = f @ Vector((-gx * 0.6 - sides[0] * w * 0.1, fy + 0.03 + wd * 0.5, 0))
        if rng.random() < 0.6:
            tc.broadleaf(ms, p.x, p.y, h=0.28, r=0.07)
        else:
            jars(ms, f, -sides[0] * w * 0.12, fy + wd * 0.5, rng, 2)
    if awning:
        tt.front_shade(ms, f, w * 0.25, fy - 0.02, min(0.24, w * 0.35), depth=0.12, z=0.22, mat='team_cloth')
    else:
        jars(ms, f, (w * 0.32 if gx <= 0 else -w * 0.32), fy - 0.05, rng, 1 + rng.randint(0, 1))
    return f


# ---- Japan houses (Edo) -------------------------------------------------------------------------

def mushiko(ms, F, x, z, w=0.08, h=0.035):
    """A barred slit window in a plaster upper storey (facing -Y at y 0)."""
    ms.box('dark', (w, 0.008, h), at=(x, -0.003, z), lod=0, frame=F)
    for k in range(4):
        ms.box('sng_plaster', (0.006, 0.01, h), at=(x - w / 2 + w * (k + 0.5) / 4, -0.006, z), lod=0, frame=F)


def machiya(ms, rng, x, y, w, d, yaw=None, awning=None, **_ignored):
    """The Edo town house: a dark timber lattice ground floor with a team-grey noren over the door,
    a pent roof of grey tile, a low white plaster upper storey with barred slit windows, a grey
    tiled gable with its eaves to the street; a fence and a small garden behind."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hw = w - 0.03
    hd = min(d * 0.8, 0.5)
    cy = -d / 2 + hd / 2 + 0.02
    hf = f @ _t(0, cy, 0)
    h1, h2 = 0.24, 0.17
    ms.box('stone', (hw + 0.02, hd + 0.02, 0.02), at=(0, 0, G), lod=0, frame=hf)
    ms.box('sng_board', (hw, hd, h1), at=(0, 0, G), lod=1, frame=hf)
    ms.box('sng_plaster', (hw - 0.02, hd - 0.02, h2), at=(0, 0, G + h1), lod=1, frame=hf)
    ms.box('sng_lattice', (hw + 0.006, hd + 0.006, 0.02), at=(0, 0, G + h1 - 0.01), lod=0, frame=hf)
    F = hf @ _t(0, -hd / 2, 0)
    n = max(3, int(hw / 0.09))
    for i in range(n + 1):  # the lattice front
        ms.box('sng_lattice', (0.008, 0.012, h1 - 0.03), at=(-hw / 2 + hw * i / n, -0.006, G + 0.01), lod=0, frame=F)
    dx = rng.choice([-1, 1]) * hw * 0.25
    ms.box('dark', (0.09, 0.008, 0.17), at=(dx, -0.004, G), lod=1, frame=F)
    ms.box('team_cloth', (0.11, 0.006, 0.07), at=(dx, -0.016, G + 0.11), lod=1, frame=F)
    # the pent roof between the storeys
    pf = hf @ _t(0, -hd / 2 - 0.045, G + h1 + 0.02) @ Matrix.Rotation(math.radians(-24), 4, 'X')
    ms.box('sng_tile', (hw + 0.04, 0.11, 0.014), at=(0, 0, 0), lod=1, frame=pf)
    for k in range(2):
        mushiko(ms, F @ _t(0, 0.01, 0), (k - 0.5) * hw * 0.45, G + h1 + h2 * 0.35)
    gable_tile(ms, hf, hw, hd, G + h1 + h2, 0.15, over=0.05, lod=1)
    block_lod2(ms, hf, hw, hd, h1 + h2, 0.15, wall='sng_plaster', kind='gable')
    # behind: a board fence and a shrub
    by = d / 2 - 0.02
    if d - hd > 0.08:
        tb_fence(ms, f, -w / 2 + 0.02, by, w / 2 - 0.02, by, h=0.08)
        tc.shrub(ms, *(f @ Vector((rng.uniform(-w * 0.3, w * 0.3), (cy + hd / 2 + by) / 2, 0)))[:2], r=0.04, lod=0)
    if awning:
        ms.box('team_cloth', (min(0.24, hw * 0.4), 0.006, 0.06), at=(-dx, -0.016, G + 0.12), lod=1, frame=F)
    tt.jar(ms, hf, -dx, -hd / 2 - 0.04, 1.0, mat='sng_jar')
    return f


def nagaya(ms, rng, x, y, w, d, yaw=None, awning=None, **_ignored):
    """The Edo row house: one storey of dark boarding on a stone footing with plaster panels, two
    sliding doors with noren, a grey tiled gable, rain barrels and a bench."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hw = w - 0.04
    hd = min(d * 0.7, 0.42)
    hf = f @ _t(0, -d / 2 + hd / 2 + 0.04, 0)
    h = 0.25
    ms.box('stone', (hw + 0.016, hd + 0.016, 0.03), at=(0, 0, G), lod=0, frame=hf)
    ms.box('sng_board', (hw, hd, h), at=(0, 0, G), lod=1, frame=hf)
    F = hf @ _t(0, -hd / 2, 0)
    for k, sx in enumerate((-0.25, 0.25)):
        ms.box('sng_plaster', (hw * 0.2, 0.006, h * 0.4), at=(sx * hw + (0.12 if k == 0 else -0.12), -0.003, G + h * 0.45), lod=0, frame=F)
        ms.box('dark', (0.08, 0.008, 0.17), at=(sx * hw, -0.004, G + 0.02), lod=1, frame=F)
        ms.box('team_cloth', (0.09, 0.006, 0.05), at=(sx * hw, -0.012, G + 0.13), lod=0, frame=F)
    gable_tile(ms, hf, hw, hd, G + h, 0.13, over=0.05, lod=1, gable='sng_board')
    block_lod2(ms, hf, hw, hd, h, 0.13, wall='sng_board', kind='gable')
    for k in range(2):
        gp.barrel(ms, hf, (k - 0.5) * hw * 0.9, -hd / 2 - 0.04, 1.1)
    ms.box('timber', (0.12, 0.035, 0.03), at=(0, -hd / 2 - 0.035, G), lod=0, frame=hf)
    return f


def walled_house(ms, rng, x, y, w, d, yaw=None, awning=None, **_ignored):
    """A merchant's or samurai's house: a white plaster wall on a stone footing under a grey tiled
    coping with a roofed gate, the house behind under a hip roof with upturned corners, a pine."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hd = min(d * 0.55, 0.34)
    hw = w * 0.82
    hall_block(ms, f, hw, hd, 0.28, cy=d / 2 - hd / 2 - 0.02, posts=4, post_mat='sng_lattice', rise=0.17, windows=True)
    block_lod2(ms, f, hw, hd, 0.3, 0.17, cy=d / 2 - hd / 2 - 0.02)
    fy = -d / 2 + 0.02
    gw = 0.16
    for a, b in ((-w / 2, -gw / 2), (gw / 2, w / 2)):
        wall_run(ms, f, a, fy, b, fy, h=0.16, wall='sng_plaster', lod=1)
        ms.box('stone', (b - a, 0.04, 0.04), at=((a + b) / 2, fy, G), lod=0, frame=f)
    for a, b in (((-w / 2, fy), (-w / 2, d / 2 - 0.02)), ((w / 2, fy), (w / 2, d / 2 - 0.02))):
        wall_run(ms, f, a[0], a[1], b[0], b[1], h=0.14, wall='sng_plaster', lod=0)
    small_gate(ms, f, 0, fy, w=gw, h=0.2)
    p = f @ Vector((rng.choice([-1, 1]) * w * 0.28, fy + 0.12, 0))
    pine(ms, p.x, p.y, h=0.3, r=0.08)
    return f


def pine(ms, x, y, h=0.3, r=0.08):
    """A garden pine: a leaning trunk and flat layered crowns."""
    ms.cyl('timber', 0.014, 0.01, h * 0.7, at=(x, y, G), segs=5, lod=1)
    for k, (dx, dz, s) in enumerate(((0.0, 0.55, 1.0), (0.03, 0.8, 0.75), (-0.025, 0.98, 0.5))):
        ms.sphere('leaf', r * s, at=(x + dx, y, G + h * dz), scale=(1, 1, 0.45), u=7, v=4, lod=0 if k else 1, only=None)
    ms.cyl('leaf', r, r * 0.4, h * 0.5, at=(x, y, G + h * 0.45), segs=5, lod=2, only=2)


# ---- the house dispatcher -----------------------------------------------------------------------

def kit_house(ms, rng, x, y, w, d, yaw=None, awning=None, **_ignored):
    key = (round(x, 3), round(y, 3))
    if key in KIT['replace']:
        spec = KIT['replace'][key]
        if spec and key not in KIT['used']:
            spec(ms, rng)
        KIT['used'].add(key)
        return None
    area = w * d
    r = rng.random()
    typ = 'poor' if area < 0.3 or r < 0.25 else ('rich' if area >= 0.5 or r > 0.8 else 'common')
    if KIT['mode'] == 'japan':
        fn = {'poor': nagaya, 'common': machiya, 'rich': walled_house}[typ]
        return fn(ms, rng, x, y, w, d, yaw=yaw, awning=awning)
    if typ == 'poor':
        return poor_house(ms, rng, x, y, w, d, yaw=yaw, awning=awning)
    return court_house(ms, rng, x, y, w, d, yaw=yaw, rich=typ == 'rich', awning=awning)


def kit_styled(ms, rng, x, y, w, d, yaw=None, palette='a', storeys=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


def kit_gp_house(ms, rng, x, y, w, d, yaw=None, **kw):
    return kit_house(ms, rng, x, y, w, d, yaw=yaw, awning=kw.get('awning'))


# ---- small street pieces ------------------------------------------------------------------------

def red_lantern(ms, x, y, h=0.28):
    """A timber post with an arm and a red paper lantern."""
    ms.cyl('timber', 0.008, 0.007, h, at=(x, y, G), segs=5, lod=1)
    ms.box('timber', (0.06, 0.008, 0.008), at=(x + 0.025, y, G + h - 0.01), lod=0)
    ms.sphere('sng_lantern', 0.026, at=(x + 0.05, y, G + h - 0.05), scale=(1, 1, 1.25), u=7, v=5, lod=0)
    ms.cyl('sng_ridge', 0.012, 0.012, 0.008, at=(x + 0.05, y, G + h - 0.02), segs=6, lod=0)


def stone_lantern(ms, x, y, h=0.16):
    """A stone toro: a post, a fire box, a hat with upturned corners, a knob."""
    ms.cyl('stone', 0.035, 0.03, 0.02, at=(x, y, G), segs=6, lod=0)
    ms.cyl('stone', 0.013, 0.013, h * 0.5, at=(x, y, G + 0.02), segs=6, lod=1)
    ms.box('stone', (0.05, 0.05, 0.04), at=(x, y, G + 0.02 + h * 0.5), lod=0)
    ms.cyl('stone', 0.05, 0.012, 0.03, at=(x, y, G + 0.06 + h * 0.5), segs=6, lod=0)
    ms.sphere('stone', 0.014, at=(x, y, G + 0.1 + h * 0.5), u=6, v=4, lod=0)


def kit_lamp(ms, x, y, h=0.3):
    if KIT['mode'] == 'japan':
        stone_lantern(ms, x, y)
    else:
        red_lantern(ms, x, y, h=h * 0.95)


def kit_well(ms, x, y, yaw=15, roof='gp_tile'):
    return ORIG_WELL(ms, x, y, yaw=yaw, roof='sng_tile')


def kit_barrel(ms, f, x, y, s=1.0, z=G):
    tt.jar(ms, f, x, y, 0.9 * s, z=z, mat='sng_jar')


# ---- landmark 1: the barbican gate ----------------------------------------------------------------

def _d_plan(w, d, n=12):
    """The barbican's D plan (counter-clockwise): a straight back at +d/2, the sides down to the
    springing, a half ellipse round the front."""
    ry = min(d * 0.62, w / 2)
    cy = -d / 2 + ry
    pts = [(w / 2, d / 2)]
    for i in range(n + 1):
        a = math.pi * i / n  # from the east (0) round the front to the west (pi)
        pts.append((w / 2 * math.cos(a), cy - ry * math.sin(a)))
    pts.append((-w / 2, d / 2))
    pts = list(reversed(pts))  # counter-clockwise
    # drop duplicates (the springing points coincide with the side ends when cy == d/2)
    out = []
    for p in pts:
        if not out or math.hypot(p[0] - out[-1][0], p[1] - out[-1][1]) > 1e-4:
            out.append(p)
    if math.hypot(out[0][0] - out[-1][0], out[0][1] - out[-1][1]) < 1e-4:
        out.pop()
    return out


def tower_hall(ms, f, hw, hd, zh, height, wall_mat='sng_lacquer', roof_mat='sng_tile', posts_front=6, scale=1.0,
               paint=True, railing=True, lod_hi=2):
    """A two-storey gate tower hall: red posts and lattice on a stone floor, a railing round it, a
    lower eave all round, a shorter upper storey with a bracket band, a hip roof with upturned
    corners and ridge-end ornaments, its ridge reaching zh + height."""
    s = scale
    h1 = height * 0.32
    ms.box('stone', (hw + 0.05 * s, hd + 0.05 * s, 0.015), at=(0, 0, zh - 0.012), lod=1, frame=f)
    ms.box('sng_plaster', (hw, hd, h1), at=(0, 0, zh), lod=lod_hi, frame=f)
    for k, (L, D2, n) in enumerate(((hw, hd, posts_front), (hd, hw, 4), (hw, hd, posts_front), (hd, hw, 4))):
        rf = f @ _rz(90 * k)
        for i in range(n):
            ms.box('sng_lacquer', (0.022 * s, 0.022 * s, h1), at=(-L / 2 + L * i / (n - 1), -D2 / 2 - 0.008, zh),
                   lod=1 if i in (0, n - 1) or k % 2 == 0 else 0, frame=rf)
        ms.box('sng_lacquer', (L + 0.03, 0.022 * s, 0.022 * s), at=(0, -D2 / 2 - 0.008, zh + h1 - 0.03 * s), lod=1, frame=rf)
        if k % 2 == 0:
            for i in range(n - 1):
                cx = -L / 2 + L * (i + 0.5) / (n - 1)
                if k == 0 and abs(cx) < L / (n - 1) * 0.6:
                    dbl_door(ms, rf, cx, -D2 / 2, w=L / (n - 1) * 0.6, h=h1 * 0.6, z=zh, frame_mat='sng_lacquer', lod=0)
                else:
                    lattice(ms, rf, cx, -D2 / 2, zh + h1 * 0.15, w=L / (n - 1) * 0.55, h=h1 * 0.4)
        if railing:
            Lr, Dr = (hw + 0.09 * s, hd + 0.09 * s) if k % 2 == 0 else (hd + 0.09 * s, hw + 0.09 * s)
            ms.box('sng_lacquer', (Lr, 0.01, 0.01), at=(0, -Dr / 2, zh + 0.05 * s), lod=0, frame=rf)
            for i in range(5):
                ms.box('sng_lacquer', (0.01, 0.01, 0.05 * s), at=(-Lr / 2 + Lr * i / 4, -Dr / 2, zh), lod=0, frame=rf)
    z1 = zh + h1
    uw, ud = hw * 0.8, hd * 0.78
    over1 = 0.11 * s
    curl1 = 0.045 * s
    lw, ld = hw / 2 + over1, hd / 2 + over1
    ze1 = z1 - 0.01
    zi1 = z1 + height * 0.1
    if paint:
        ms.box('sng_paint', (hw + 0.02, hd + 0.02, 0.025 * s), at=(0, 0, z1 - 0.03 * s), lod=0, frame=f)
    eave_ring(ms, f, lw, ld, uw / 2, ud / 2, ze1, zi1, curl1, mat=roof_mat, lod=lod_hi)
    h2 = height * 0.24
    ms.box(wall_mat, (uw, ud, h2 + (zi1 - ze1)), at=(0, 0, ze1), lod=lod_hi, frame=f)
    z2 = zi1
    for k, (L, D2) in enumerate(((uw, ud), (ud, uw), (uw, ud), (ud, uw))):
        rf = f @ _rz(90 * k)
        n = 5 if k % 2 == 0 else 4
        if k % 2 == 0:
            for i in range(n - 1):
                cx = -L / 2 + L * (i + 0.5) / (n - 1)
                lattice(ms, rf, cx, -D2 / 2, z2 + h2 * 0.25, w=L / (n - 1) * 0.5, h=h2 * 0.45)
        ms.box('sng_paint' if paint else 'sng_lacquer', (L + 0.03, 0.026 * s, 0.03 * s), at=(0, -D2 / 2 - 0.01, z2 + h2 - 0.03 * s),
               lod=1, frame=rf)
    zr = z2 + h2
    rise = zh + height - zr
    curved_hip(ms, f, uw, ud, zr, rise, mat=roof_mat, over=0.1 * s, curl=curl1 + 0.01, lod=lod_hi, horns=0.06 * s)
    return zr


def barbican(ms, rng, x, y, w=1.8, d=1.4, top=1.4, yaw=0.0, **_ignored):
    """The barbican gate (landmark-1: 28 m across, 9 m walls, 21 m to the ridge): a battered grey
    brick bastion on a D plan, its platform paved, merlons round the parapet, a projecting gate
    block with an arched passage and plank doors, team banners hanging on the front, a double-eave
    gate tower with red posts on the platform, timber stairs up the back and awning pavilions on
    the back corners."""
    f = tm.house_frame(x, y, yaw)
    s = w / 2.8
    H = top * 9.0 / 21.0
    bat = 0.05 * s + 0.02
    plan = _d_plan(w, d)
    topp = gp._inset(plan, bat)
    pf = [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in plan]
    tf = [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in topp]
    gp.frustum(ms, 'sng_brick', pf, tf, 0.0, G + H, lod=2)
    # a stone footing course
    gp.frustum(ms, 'stone', [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in gp._inset(plan, -0.012)],
               [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in gp._inset(plan, 0.0)], 0.0, G + 0.05 * s, lod=0)
    # the paved platform and the parapet with merlons
    zp = G + H
    gp.flat(ms, 'sng_marble', [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in gp._inset(plan, bat + 0.03)], zp + 0.003, lod=1)
    n = len(topp)
    for i in range(n):
        a, b = topp[i], topp[(i + 1) % n]
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        if L < 0.02:
            continue
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        nx, ny = -(b[1] - a[1]) / L, (b[0] - a[0]) / L  # inward normal of a ccw polygon
        cf = f @ _t((a[0] + b[0]) / 2 + nx * 0.015, (a[1] + b[1]) / 2 + ny * 0.015, 0) @ _rz(ang)
        ms.box('sng_brick', (L + 0.012, 0.03, 0.04 * s + 0.01), at=(0, 0, zp), lod=1, frame=cf)
        m = max(1, int(L / (0.11 * s + 0.03)))
        for j in range(m):
            ms.box('sng_brick', (0.045 * s + 0.01, 0.032, 0.04 * s + 0.01), at=(-L / 2 + L * (j + 0.5) / m, 0, zp + 0.04 * s + 0.01),
                   lod=0, frame=cf)
    # the gate block projecting at the front with the arched passage
    gw, gd = w * 0.24, 0.12 * s + 0.04
    yf = -d / 2
    gf = f @ _t(0, yf + gd * 0.3, 0)
    ms.box('sng_brick', (gw, gd * 1.6, H + 0.06 * s), at=(0, 0, G), lod=2, frame=gf, taper=0.95)
    for k in range(int(gw / (0.11 * s + 0.03))):
        ms.box('sng_brick', (0.045 * s + 0.01, 0.03, 0.04 * s + 0.01),
               at=(-gw / 2 + gw * (k + 0.5) / int(gw / (0.11 * s + 0.03)), -gd * 0.8 + 0.02, G + H + 0.06 * s), lod=0, frame=gf)
    F = gf @ _t(0, -gd * 0.8, 0)
    aw = gw * 0.5
    spring = H * 0.45
    pts = gp.arch_outline(aw + 0.04 * s, spring, aw * 0.5 + 0.02 * s, 7)
    gp.slab(ms, 'stone', [(px, pz + G) for px, pz in pts], 0.01, f=F @ _t(0, -0.008, 0), lod=1)
    pts = gp.arch_outline(aw, spring, aw * 0.5, 7)
    gp.slab(ms, 'door', [(px, pz + G) for px, pz in pts], 0.01, f=F @ _t(0, -0.012, 0), lod=1)
    for k in range(3):
        ms.box('sng_lattice', (aw * 0.9, 0.006, 0.008), at=(0, -0.016, G + spring * (0.3 + 0.3 * k)), lod=0, frame=F)
    # a paved ramp to the gate
    gp.flat(ms, 'sng_marble', [tuple((f @ Vector(p))[:2]) for p in ((-aw * 0.7, yf - gd, 0), (aw * 0.7, yf - gd, 0),
                                                                     (aw * 0.9, yf - gd - 0.3 * s, 0), (-aw * 0.9, yf - gd - 0.3 * s, 0))],
            G + 0.004, lod=1)
    # team banners hanging down the front wall beside the gate, on timber arms
    for sx in (-1, 1):
        bx = sx * (gw / 2 + 0.1 * s)
        a = math.asin(max(-1.0, min(1.0, bx / (w / 2))))
        by = (-d / 2 + min(d * 0.62, w / 2)) - min(d * 0.62, w / 2) * math.cos(a)
        bf = f @ _t(bx, by - 0.02, 0)
        bh = H * 0.55
        ms.box('team_cloth', (0.07 * s + 0.03, 0.006, bh), at=(0, -0.012, zp - bh + 0.02), lod=1, frame=bf)
        ms.box('timber', (0.09 * s + 0.03, 0.03, 0.012), at=(0, -0.012, zp + 0.02), lod=0, frame=bf)
        ms.box('timber', (0.02, 0.03, 0.08 * s), at=(0, -0.004, zp - bh - 0.04 * s), lod=0, frame=bf)
    # the gate tower on the platform
    hw, hd = w * 0.42, d * 0.32
    ty = d * 0.05
    tf2 = f @ _t(0, ty, 0)
    tower_hall(ms, tf2, hw, hd, zp + 0.012, top - H - 0.012, scale=s * 1.4)
    # stairs up the back: two timber ramps against the back wall
    for sx in (-1, 1):
        x0 = sx * w * 0.2
        p0 = (x0, d / 2 + 0.02, G)
        p1 = (x0 + sx * w * 0.2, d / 2 + 0.02, zp)
        beam(ms, 'gp_plank', p0, p1, w=0.08 * s + 0.02, h=0.02, lod=1, frame=f @ _t(0, 0.04 * s + 0.01, 0.02))
    # awning pavilions on the back corners
    for sx in (-1, 1):
        px, py = sx * (w / 2 - 0.16 * s - 0.05), d / 2 - 0.16 * s - 0.05
        pw = 0.2 * s + 0.08
        for qx in (-1, 1):
            for qy in (-1, 1):
                ms.box('timber', (0.014, 0.014, 0.16 * s + 0.08), at=(px + qx * pw / 2, py + qy * pw / 2, zp), lod=0, frame=f)
        af = f @ _t(px, py, zp + 0.17 * s + 0.08) @ Matrix.Rotation(math.radians(-8), 4, 'X')
        ms.box('team_cloth', (pw + 0.04, pw + 0.04, 0.008), at=(0, 0, 0), lod=1, frame=af)
        ms.box('timber', (pw, 0.012, 0.04), at=(0, -pw / 2, zp), lod=0, frame=f @ _t(px, py, 0))
    # arrow slits on the curved face
    for i in range(1, n - 1, 2):
        a, b = plan[i], plan[i + 1]
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        if my > d / 2 - 0.05 or abs(mx) < gw * 0.7:
            continue
        L = math.hypot(b[0] - a[0], b[1] - a[1])
        ang = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
        nx, ny = (b[1] - a[1]) / L, -(b[0] - a[0]) / L
        sf = f @ _t(mx + nx * -0.01 - nx * bat * 0.3, my + ny * -0.01 - ny * bat * 0.3, 0) @ _rz(ang + 180)
        ms.box('dark', (0.02, 0.01, 0.06 * s + 0.02), at=(0, 0.0, G + H * 0.7), lod=0, frame=sf)
    return f


# ---- landmark 2: the yellow-roof temple ----------------------------------------------------------

def urn(ms, f, x, y, z, s=1.0):
    """A bronze temple urn on three legs with a lid."""
    ms.cyl('sng_bronze', 0.02 * s, 0.03 * s, 0.04 * s, at=(x, y, z + 0.012 * s), segs=8, lod=0, frame=f)
    ms.cyl('sng_bronze', 0.03 * s, 0.02 * s, 0.015 * s, at=(x, y, z + 0.052 * s), segs=8, lod=0, frame=f)
    ms.cyl('sng_bronze', 0.024 * s, 0.006 * s, 0.03 * s, at=(x, y, z + 0.066 * s), segs=6, lod=0, frame=f)
    ms.box('sng_bronze', (0.04 * s, 0.04 * s, 0.014 * s), at=(x, y, z), lod=0, frame=f)


def pavilion(ms, f, x, y, s, z, roof='sng_yellow', lod=1):
    """A square corner pavilion: red walls, painted brackets, a pyramid roof with a finial."""
    pf = f @ _t(x, y, 0)
    ms.box('sng_lacquer', (s, s, s * 0.55), at=(0, 0, z), lod=lod, frame=pf)
    ms.box('sng_paint', (s + 0.012, s + 0.012, 0.02), at=(0, 0, z + s * 0.55 - 0.02), lod=0, frame=pf)
    for k in range(4):
        rf = pf @ _rz(90 * k)
        lattice(ms, rf, 0, -s / 2, z + s * 0.1, w=s * 0.4, h=s * 0.3, mat='sng_lacquer')
    curved_hip(ms, pf, s, s, z + s * 0.55, s * 0.55, mat=roof, over=0.045, curl=0.03, lod=lod, finial=True, ridge='sng_ridge'
               if roof == 'sng_tile' else 'sng_yellow')


def temple(ms, rng, x, y, w=1.6, d=1.0, top=1.1, yaw=0.0, roof='sng_yellow', pavilions=None, **_ignored):
    """The yellow-roof temple (landmark-2: 38 m across with the corner pavilions, a 4 m terrace,
    16 m to the ridge): a white stone terrace on a stone base with balustrades and three flights
    of stairs at the front, bronze urns, the red main hall (posts all round, lattice doors) under
    a double-eave glazed hip roof with painted brackets and ridge-end ornaments, team hangings at
    its front, corner pavilions under pyramid roofs joined to it by galleries."""
    f = tm.house_frame(x, y, yaw)
    pav = (w >= 1.25) if pavilions is None else pavilions
    sc = top / 1.6
    ridge = 'sng_ridge' if roof == 'sng_tile' else 'sng_yellow'
    tz = top * 0.18  # the terrace
    ms.box('sng_marble', (w, d, tz), at=(0, 0, G - 0.005), lod=2, frame=f)
    ms.box('stone', (w + 0.02, d + 0.02, tz * 0.25), at=(0, 0, G - 0.005), lod=0, frame=f)
    zt = G - 0.005 + tz
    # balustrade round the terrace with a gap at the stairs
    sw = w * 0.22
    for a, b in ((-w / 2, -sw / 2), (sw / 2, w / 2)):
        balustrade(ms, f, a, -d / 2 + 0.01, b, -d / 2 + 0.01, zt)
    balustrade(ms, f, -w / 2 + 0.01, -d / 2, -w / 2 + 0.01, d / 2, zt)
    balustrade(ms, f, w / 2 - 0.01, -d / 2, w / 2 - 0.01, d / 2, zt)
    balustrade(ms, f, -w / 2, d / 2 - 0.01, w / 2, d / 2 - 0.01, zt)
    # the stairs: a central flight and two side flights
    for sx, fw in ((0, sw), (-1, sw * 0.45), (1, sw * 0.45)):
        cx = sx * w * 0.3
        nst = 4
        for k in range(nst):
            ms.box('sng_marble', (fw, tz * 1.6 * (nst - k) / nst, tz * (k + 1) / nst),
                   at=(cx, -d / 2 - tz * 0.8 * (nst - k) / nst + 0.002, G - 0.005), lod=1 if k in (0, nst - 1) else 0, frame=f)
        for qx in (-1, 1):
            beam(ms, 'sng_marble', (cx + qx * fw / 2, -d / 2 - tz * 1.6, G + 0.03), (cx + qx * fw / 2, -d / 2, zt + 0.04),
                 w=0.014, h=0.014, lod=0, frame=f)
    # the main hall
    mw = w * (0.6 if pav else 0.82)
    md = d * 0.55
    my = d * 0.08
    hf = f @ _t(0, my, 0)
    hh = top * 0.22
    ms.box('stone', (mw + 0.06, md + 0.06, 0.02), at=(0, 0, zt), lod=1, frame=hf)
    z0 = zt + 0.02
    ms.box('sng_lacquer', (mw - 0.04, md - 0.04, hh), at=(0, 0, z0), lod=2, frame=hf)
    np_ = 7 if mw > 0.9 else 5
    for k, (L, D2, n) in enumerate(((mw, md, np_), (md, mw, 4), (mw, md, np_), (md, mw, 4))):
        rf = hf @ _rz(90 * k)
        for i in range(n):
            ms.cyl('sng_lacquer', 0.016 * sc + 0.004, 0.016 * sc + 0.004, hh, at=(-L / 2 + L * i / (n - 1), -D2 / 2, z0), segs=6,
                   lod=1 if k == 0 else 0, frame=rf)
        if k == 0:
            for i in range(n - 1):
                cx = -L / 2 + L * (i + 0.5) / (n - 1)
                lattice(ms, rf, cx, -D2 / 2 + 0.02, z0 + hh * 0.05, w=L / (n - 1) * 0.7, h=hh * 0.7, mat='sng_lattice')
            for i in (1, n - 3):
                cx = -L / 2 + L * (i + 1) / (n - 1)
                ms.box('team_cloth', (0.05 * sc + 0.02, 0.005, hh * 0.6), at=(cx, -D2 / 2 - 0.022, z0 + hh * 0.38), lod=1, frame=rf)
    ms.box('sng_paint', (mw + 0.02, md + 0.02, 0.03 * sc + 0.01), at=(0, 0, z0 + hh - 0.02), lod=0, frame=hf)
    # the double eave
    z1 = z0 + hh
    over1 = 0.13 * sc + 0.03
    curl1 = 0.05 * sc + 0.01
    uw, ud = mw * 0.78, md * 0.7
    zi = z1 + top * 0.1
    eave_ring(ms, hf, mw / 2 + over1, md / 2 + over1, uw / 2, ud / 2, z1 - 0.01, zi, curl1, mat=roof, ridge=ridge)
    h2 = top * 0.1
    ms.box('sng_lacquer', (uw, ud, h2 + (zi - z1)), at=(0, 0, z1), lod=2, frame=hf)
    ms.box('sng_paint', (uw + 0.02, ud + 0.02, 0.035 * sc + 0.01), at=(0, 0, zi + h2 - 0.035 * sc - 0.01), lod=1, frame=hf)
    for k in range(2):
        rf = hf @ _rz(180 * k)
        for i in range(4):
            lattice(ms, rf, -uw / 2 + uw * (i + 0.5) / 4, -ud / 2, zi + h2 * 0.15, w=uw / 4 * 0.5, h=h2 * 0.5, mat='sng_lattice')
    zr = zi + h2
    curved_hip(ms, hf, uw, ud, zr, G + top - zr, mat=roof, ridge=ridge, over=0.12 * sc + 0.03, curl=curl1 + 0.01, lod=2,
               horns=0.08 * sc)
    # urns on the terrace in front of the hall
    for ux in (-0.35, -0.17, 0.17, 0.35):
        urn(ms, f, ux * w, -d / 2 + (d / 2 + my - md / 2) * 0.45, zt, s=sc * 1.6 + 0.3)
    if pav:
        ps = min(0.28, w * 0.13) * (0.7 + 0.3 * sc / 0.8)
        for qx in (-1, 1):
            for qy in (-1, 1):
                px, py = qx * (w / 2 - ps / 2 - 0.04), qy * (d / 2 - ps / 2 - 0.04)
                pavilion(ms, f, px, py, ps, zt, roof=roof, lod=1 if qy < 0 else 0)
            # the gallery from the front pavilion to the hall's side
            gx0, gx1 = qx * (mw / 2 + 0.02), qx * (w / 2 - ps - 0.04)
            gw2 = abs(gx1 - gx0)
            if gw2 > 0.04:
                gf = f @ _t((gx0 + gx1) / 2, my, 0)
                ms.box('sng_lacquer', (gw2, 0.12 * sc + 0.04, hh * 0.6), at=(0, 0, zt), lod=1, frame=gf)
                gable_tile(ms, gf, gw2, 0.12 * sc + 0.04, zt + hh * 0.6, 0.05, over=0.03, lod=1, mat=roof, gable='sng_lacquer',
                           horns=False)
    return f


def shrine(ms, x, y, top, yaw=0, r=0.2, **_ignored):
    """The windmill's spot: a small yellow-roof shrine (Japan: grey) on a stone terrace."""
    roof = 'sng_tile' if KIT['mode'] == 'japan' else 'sng_yellow'
    s = r * 4.2
    return temple(ms, None, x, y, w=s, d=s * 0.75, top=min(top * 0.6, s * 0.9), yaw=0 if yaw is None else 0, roof=roof,
                  pavilions=False)


# ---- landmark japan: the Edo castle keep ---------------------------------------------------------

def chidori(ms, F, x, z, w, rise, depth=0.1, lod=0):
    """A triangular dormer gable (chidori-hafu) standing out from a roof slope at local y 0
    (facing -Y): a white triangle under two tiled boards and a gold ornament."""
    gf = F @ _t(x, -depth * 0.5, 0)
    tc.gable_roof(ms, gf @ _rz(90), depth, w, z, rise, over=0.02, mat='sng_tile', gable='sng_plaster', thick=0.014, lod=lod,
                  ridge='sng_ridge')
    ms.box('sng_gold', (0.02, 0.006, 0.02), at=(0, -depth / 2 - 0.012, z + rise * 0.45), lod=0, frame=gf)


def edo_castle(ms, rng, x, y, base=1.3, top=1.5, yaw=0.0, **_ignored):
    """The Edo castle keep (landmark-japan: an 18 m fitted-stone base 6 m high, five 3 m tiers, 21 m
    in all): a battered granite base with a roofed gate and steps, five tiers of white plaster
    shrinking upward with a dark timber band and barred windows, each under a grey tile eave with
    upturned corners; triangular gables on the lower roofs, a balcony on the top tier, a hip roof
    with gold ridge fish."""
    f = tm.house_frame(x, y, yaw)
    s = top / 2.1
    hb = top * 6.0 / 21.0
    bt = base * 0.12
    b0 = [(-base / 2, -base / 2), (base / 2, -base / 2), (base / 2, base / 2), (-base / 2, base / 2)]
    b1 = [(px * (1 - 2 * bt / base), py * (1 - 2 * bt / base)) for px, py in b0]
    gp.frustum(ms, 'sng_granite', [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in b0],
               [tuple((f @ Vector((px, py, 0)))[:2]) for px, py in b1], 0.0, G + hb, lod=2)
    # the gate in the base, its small roof and the steps
    F = f @ _t(0, -base / 2 + bt * 0.3, 0)
    ms.box('sng_granite', (0.22 * s + 0.06, 0.09, hb * 0.55), at=(0, -0.03, G), lod=1, frame=F)
    ms.box('door', (0.12 * s + 0.03, 0.01, hb * 0.38), at=(0, -0.08, G + 0.03), lod=1, frame=F)
    gable_tile(ms, F @ _t(0, -0.05, 0), 0.24 * s + 0.07, 0.1, G + hb * 0.55, 0.05, over=0.025, lod=1, gable='sng_board',
               horns=False)
    for k in range(4):
        ms.box('sng_granite', (0.16 * s + 0.05, 0.04, 0.012 * (4 - k)), at=(0, -0.1 - 0.035 * (4 - k) + 0.035, G), lod=0, frame=F)
    # the tiers
    widths = [base - 2 * bt + 0.02, (base - 2 * bt) * 0.84, (base - 2 * bt) * 0.7, (base - 2 * bt) * 0.58, (base - 2 * bt) * 0.48]
    th = (top - hb) / 5.4
    z = G + hb
    for i, tw in enumerate(widths):
        td = tw * (0.86 if i < 4 else 0.8)
        wh = th * (0.62 if i < 4 else 0.7)
        ms.box('sng_plaster', (tw, td, wh), at=(0, 0, z), lod=2, frame=f)
        if i == 0:  # the dark boarded lower band of the first tier
            ms.box('sng_board', (tw + 0.008, td + 0.008, wh * 0.38), at=(0, 0, z), lod=1, frame=f)
        for k in range(4):
            rf = f @ _rz(90 * k)
            L, D2 = (tw, td) if k % 2 == 0 else (td, tw)
            nwin = max(2, int(L / (0.16 * s + 0.04)))
            for j in range(nwin):
                wx = -L / 2 + L * (j + 0.5) / nwin
                mushiko(ms, rf @ _t(0, -D2 / 2, 0), wx, z + wh * (0.48 if i == 0 else 0.3), w=0.05 * s + 0.02, h=wh * 0.32)
        if i == 4:  # the top tier's balcony
            ms.box('sng_lattice', (tw + 0.06, td + 0.06, 0.012), at=(0, 0, z + wh * 0.05), lod=0, frame=f)
            for k in range(4):
                rf = f @ _rz(90 * k)
                L, D2 = (tw + 0.06, td + 0.06) if k % 2 == 0 else (td + 0.06, tw + 0.06)
                ms.box('sng_lattice', (L, 0.008, 0.008), at=(0, -D2 / 2, z + wh * 0.3), lod=0, frame=rf)
        zr = z + wh
        if i < 4:
            nw = widths[i + 1]
            nd = nw * (0.86 if i + 1 < 4 else 0.8)
            over = 0.1 * s + 0.03
            ze = zr - 0.004
            zi = zr + th * 0.3
            eave_ring(ms, f, tw / 2 + over, td / 2 + over, nw / 2, nd / 2, ze, zi, 0.035 * s + 0.01)
            # chidori gables on the front and sides of the lower roofs
            if i in (0, 2):
                for k in (0, 1, 3) if i == 0 else (0, 2):
                    rf = f @ _rz(90 * k)
                    D2 = td if k % 2 == 0 else tw
                    chidori(ms, rf @ _t(0, -(D2 / 2 + over * 0.2), 0), 0, ze + 0.01, min(0.3, tw * 0.32), th * 0.32,
                            depth=0.1 * s + 0.04, lod=0 if k else 1)
            if i == 1:
                for sx in (-1, 1):
                    chidori(ms, f @ _t(0, -(td / 2 + over * 0.2), 0), sx * tw * 0.22, ze + 0.01, min(0.2, tw * 0.22), th * 0.26,
                            depth=0.08 * s + 0.04)
            z = zi
        else:
            rise = G + top - zr
            curved_hip(ms, f, tw, td, zr, rise, over=0.11 * s + 0.03, curl=0.04 * s + 0.012, lod=2, horns=0.0)
            ridge_half = max(0.0, (tw - td) / 2)
            for sx in (-1, 1):  # gold shachihoko
                ms.box('sng_gold', (0.025, 0.02, 0.06 * s + 0.02), at=(sx * (ridge_half + 0.015), 0, G + top - 0.012), lod=1, frame=f,
                       taper=0.6)
            chidori(ms, f @ _t(0, -(td / 2 + 0.03), 0), 0, zr, min(0.2, tw * 0.4), rise * 0.6, depth=0.08 * s + 0.03)
    return f


# ---- applying the kit ---------------------------------------------------------------------------

def hall_landmark(ms, rng, x, y, w, d, top=None, yaw=0, **_ignored):
    """The base layout's town hall becomes the barbican (Japan: the castle keep)."""
    if KIT['mode'] == 'japan':
        b = min(max(w, d) * 1.05, 1.6)
        return edo_castle(ms, rng, x, y, base=b, top=b * 21.0 / 18.0, yaw=0)
    bw = min(max(w * 1.3, 1.0), 2.2)
    return barbican(ms, rng, x, y, w=bw, d=bw * 0.72, top=bw * 0.75, yaw=0)


def church_landmark(ms, rng, x, y, top, w=0.62, length=1.0, yaw=0, **_ignored):
    """The base layout's churches become the temple (Japan: grey-tiled)."""
    tw = min(max(length * 1.45, 1.0), 2.0)
    roof = 'sng_tile' if KIT['mode'] == 'japan' else 'sng_yellow'
    return temple(ms, rng, x, y, w=tw, d=tw * 0.64, top=tw * 0.6, yaw=0, roof=roof)


def apply(mode='sinic', replace=None):
    KIT['mode'] = mode
    KIT['replace'] = {(round(x, 3), round(y, 3)): fn for (x, y), fn in (replace or {}).items()}
    KIT['used'] = set()
    gp.styled = kit_styled
    gp.gp_house = kit_gp_house
    gp.town_hall = hall_landmark
    gp.domed_church = church_landmark
    gp.twin_church = church_landmark
    gp.windmill = shrine
    gp.well = kit_well
    gp.lamp = kit_lamp
    gp.barrel = kit_barrel


def main(base_name, layout, ground, replace=None):
    """Build `gunpowder-<base_name>-<mode>.glb` (its object keeps the layout's name).
    argv: <out_dir> [atlas_px] [sinic|japan]. `replace(mode)` gives apply()'s replace map."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    mode = argv[2] if len(argv) > 2 else 'sinic'
    apply(mode, replace(mode) if replace else None)
    g = dict(ground, mat='sng_earth' if mode == 'japan' else 'sng_paving')
    tt.build_file('gunpowder-%s-%s' % (base_name, mode), [(base_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
