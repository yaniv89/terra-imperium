# scripts/blender/ti_indic_classical.py
# The Indic kit for the Classical Age (art spec 3b; Maurya and Gupta India, Pakistan, Bangladesh,
# Sri Lanka, the Maldives), from the sheets in plans/art/kits/indic/classical/: houses.png (a
# one-room cottage of lime plaster over a red-brick base under a terracotta or thatch roof, with a
# bamboo lean-to, a fenced earth yard and a team-cloth shade over the door; a two-storey town house
# round a small court with a carved timber balcony, a front gable over it, an awning on posts and
# brick planters; a haveli round a court with a lotus pool, a carved timber verandah and gallery
# hung with team cloth, a roof pavilion and a terrace with a chhatri), street.png and roofscape.png
# (grey stone streets, earth and paved yards behind red-brick walls, palms, banana plants and
# mango trees, pots), materials.png, the Sanchi stupa (landmark-1) and a rock-cut chaitya facade
# in a basalt cliff (landmark-2).
# Built beside ti_classical.py (gable_roof, hip_roof and the tile materials, unchanged).
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights
# where the layout leaves room. Materials carry the `inc_` prefix.
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

NEW = ['inc_plaster', 'inc_brick', 'inc_sandstone', 'inc_carved', 'inc_timber', 'inc_jali', 'inc_basalt',
       'inc_cbasalt', 'inc_colstone', 'inc_flags', 'inc_yard', 'inc_leaf', 'inc_palm', 'inc_palmtrunk', 'inc_banana',
       'inc_bamboo', 'inc_paving', 'inc_paving_fringe', 'inc_paving_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'inc_paving': 'Ground', 'inc_paving_fringe': 'Ground', 'inc_paving_square': 'Ground'})
if 'inc_paving_fringe' not in tt.FRINGES:
    tt.FRINGES.append('inc_paving_fringe')

PAVING = (('#8e8a82', '#7f7b73', '#9a958b'), '#5c5850', (0.04, 0.032))


def make_materials():
    # lime plaster, off-white with cream patches where it has flaked
    tm.mat_simple('inc_plaster', ['#e4dccb', '#d8ccb2', '#ece6d8', '#cdbf9f'], scale=14.0, bump=0.3, dirt=True)
    # red brick, a running bond with pale lime mortar (bases, compound walls, planters)
    tm.mat_mudwall('inc_brick', wash='#b0543a', brick='#ad4f33', brick2='#8c3b26', mortar='#c3b49a', wash_cover=0.0,
                   bond=(0.04, 0.014, 0.0022))
    # dressed sandstone blocks, pink-buff (the stupa's dome and drum, steps, plinths)
    tm.mat_mudwall('inc_sandstone', wash='#c3aa8a', brick='#c0a585', brick2='#ae9373', mortar='#8f7a62', wash_cover=0.0,
                   bond=(0.05, 0.025, 0.0025))
    # carved sandstone (toranas, railings, the harmika): darker, heavily relieved
    tm.mat_simple('inc_carved', ['#a99073', '#bba285', '#937c62', '#c4ad90'], scale=36.0, bump=0.8, dirt=True)
    # carved dark timber (posts, balconies, frames) and the jali lattice of the balconies
    tm.mat_simple('inc_timber', ['#4a3424', '#5d4330', '#3b2a1c'], scale=8.0,
                  stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 2.0}, bump=0.5)
    tm.mat_simple('inc_jali', ['#3a281a', '#6a4e34', '#2a1d13'], scale=90.0,
                  stripes={'dir': 'X', 'scale': 260.0, 'distortion': 0.5}, bump=0.7)
    # basalt: the cliff (rough, lichen-flecked) and the carved facade (smoother, warmer)
    tm.mat_simple('inc_basalt', ['#2a2826', '#3a3633', '#2f2d2a', '#5e5340'], scale=28.0, bump=1.0)
    tm.mat_simple('inc_cbasalt', ['#7a7062', '#8a7f6e', '#695f52', '#968a76'], scale=30.0, bump=0.7, dirt=True)
    tm.mat_simple('inc_colstone', ['#a29684', '#b3a794', '#93887a'], scale=24.0, bump=0.4)
    # sandstone flags (platforms, court floors), the beaten-earth yards
    tc.mat_paving('inc_flags', stone=('#b8a68c', '#a9977e', '#c4b398'), mortar='#7d6d5a', slab=(0.05, 0.04))
    tm.mat_earth('inc_yard', colors=('#9c7a56', '#b08c64', '#a5825c', '#8e6e4c'))
    # mango and neem leaves; coconut palm fronds and trunk; banana leaves
    tm.mat_simple('inc_leaf', ['#26401c', '#35552a', '#46672f', '#2e4a22'], scale=55.0, bump=0.7)
    tm.mat_simple('inc_palm', ['#3d5a22', '#55772f', '#6d8c3b', '#476a28'], scale=60.0,
                  stripes={'dir': 'X', 'scale': 200.0, 'distortion': 2.0}, bump=0.5)
    tm.mat_simple('inc_palmtrunk', ['#6b5a44', '#837055', '#584836'], scale=12.0,
                  stripes={'dir': 'Z', 'scale': 120.0, 'distortion': 1.0}, bump=0.6)
    tm.mat_simple('inc_bamboo', ['#6e5634', '#8a6d44', '#5a4528', '#9a7c50'], scale=10.0,
                  stripes={'dir': 'X', 'scale': 220.0, 'distortion': 0.6}, bump=0.6)
    tm.mat_simple('inc_banana', ['#4f7a2a', '#66923a', '#7fa548', '#3f6624'], scale=40.0, bump=0.4)
    # grey stone paving (streets and the town ground), the square a little lighter
    for n in ('inc_paving', 'inc_paving_fringe'):
        tc.mat_paving(n, stone=PAVING[0], mortar=PAVING[1], slab=PAVING[2])
    tc.mat_paving('inc_paving_square', stone=('#a49d90', '#958e81', '#b0a99b'), mortar='#6e685d', slab=(0.045, 0.04))


if not any(n == 'indic_classical' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('indic_classical', make_materials))

PAVED = dict(mat='inc_paving', power=8)


# ---- solids -------------------------------------------------------------------------------------

def arc_ring(ms, mat, r_in, r_out, z0, z1, a0=0.0, a1=2 * math.pi, n=24, lod=2, frame=None, only=None):
    """A closed ring solid (an annulus from z0 to z1), or an arc of one from angle a0 to a1 with end
    faces. Angles are counter-clockwise from +X."""
    full = abs(a1 - a0 - 2 * math.pi) < 1e-6
    cnt = n if full else n + 1
    bm = bmesh.new()
    rows = []
    for r, z in ((r_in, z0), (r_out, z0), (r_out, z1), (r_in, z1)):
        rows.append([bm.verts.new((r * math.cos(a0 + (a1 - a0) * i / n), r * math.sin(a0 + (a1 - a0) * i / n), z))
                     for i in range(cnt)])
    for k in range(4):
        A, B = rows[k], rows[(k + 1) % 4]
        for i in range(n):
            j = (i + 1) % cnt
            bm.faces.new((A[i], A[j], B[j], B[i]))
    if not full:
        bm.faces.new([rows[k][0] for k in range(4)])
        bm.faces.new([rows[k][-1] for k in range(4)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # closed: safe to orient
    return ms.add(bm, mat, lod, matrix=frame.copy() if frame is not None else None, only=only)


def arch_band(ms, mat, r_in, r_out, cx, cz, y0, y1, a0, a1, n=12, lod=1, frame=None):
    """A band bent round an arch in the local XZ plane (a ring solid on its side, y0 to y1 deep)."""
    bm = bmesh.new()
    rows = []
    for r, y in ((r_in, y0), (r_out, y0), (r_out, y1), (r_in, y1)):
        rows.append([bm.verts.new((cx + r * math.cos(a0 + (a1 - a0) * i / n), y, cz + r * math.sin(a0 + (a1 - a0) * i / n)))
                     for i in range(n + 1)])
    for k in range(4):
        A, B = rows[k], rows[(k + 1) % 4]
        for i in range(n):
            bm.faces.new((A[i], A[i + 1], B[i + 1], B[i]))
    bm.faces.new([rows[k][0] for k in range(4)])
    bm.faces.new([rows[k][-1] for k in range(4)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ms.add(bm, mat, lod, matrix=frame.copy() if frame is not None else None)


def half_disc(ms, mat, r, cx, cz, y0, y1, legs=0.0, n=12, lod=1, frame=None):
    """A horseshoe opening as a thin closed solid in the XZ plane: a half disc of radius r on
    straight legs `legs` long (the window of the chaitya arch)."""
    pts = [(cx + r, cz - legs)] + [(cx + r * math.cos(math.pi * i / n), cz + r * math.sin(math.pi * i / n)) for i in range(n + 1)] + [(cx - r, cz - legs)]
    bm = bmesh.new()
    F = [bm.verts.new((px, y0, pz)) for px, pz in pts]
    B = [bm.verts.new((px, y1, pz)) for px, pz in pts]
    bm.faces.new(F)
    bm.faces.new(list(reversed(B)))
    m = len(pts)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((F[i], F[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ms.add(bm, mat, lod, matrix=frame.copy() if frame is not None else None)


def hip(ms, f, w, d, z, rise, mat='tile', lod=2, cx=0.0, cy=0.0, only=None, over=0.0):
    """A plain hip (or pyramid) roof as one closed solid; the eaves overhang the w x d block."""
    W, D = w / 2 + over, d / 2 + over
    r = max(0.0, W - D)
    bm = bmesh.new()
    c = [bm.verts.new((cx + sx * W, cy + sy * D, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    b = [bm.verts.new((cx + sx * W, cy + sy * D, z - 0.02)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    bm.faces.new((b[3], b[2], b[1], b[0]))
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new((b[k], b[j], c[j], c[k]))
    if r > 0.001:
        r0, r1 = bm.verts.new((cx - r, cy, z + rise)), bm.verts.new((cx + r, cy, z + rise))
        bm.faces.new((c[0], c[1], r1, r0))
        bm.faces.new((c[2], c[3], r0, r1))
        bm.faces.new((c[1], c[2], r1))
        bm.faces.new((c[3], c[0], r0))
    else:
        top = bm.verts.new((cx, cy, z + rise))
        for k in range(4):
            bm.faces.new((c[k], c[(k + 1) % 4], top))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)
    return r


def ring_roof(ms, f, w, d, z, rise, hole_w, hole_d, mat='tile', band=0.022, lod=2, cx=0.0, cy=0.0):
    """A tiled hip roof round an open court: outer eaves w x d at z, a ridge ring, inner eaves
    sloping into a hole_w x hole_d court. One closed ring solid; LOD2 shows a plain hip."""
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
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, min(lod, 1), matrix=f.copy())
    if lod >= 2:
        hip(ms, f, w, d, z, rise, mat=mat, lod=2, cx=cx, cy=cy, only=2)
    rw, rd = (W + hw) / 2, (D + hd) / 2
    for (px, py, sw, sd) in ((0, -rd, 2 * rw, 0.028), (0, rd, 2 * rw, 0.028), (-rw, 0, 0.028, 2 * rd), (rw, 0, 0.028, 2 * rd)):
        ms.box('tile_dark', (sw + 0.01, sd, 0.018), at=(cx + px, cy + py, z + rise - 0.01), lod=0, frame=f)


def rock(ms, rng, f, cx, cy, z0, sx, sy, sz, amp=0.04, cuts=2, keep=(), lod=1):
    """A rough basalt block: a subdivided box whose vertices are jittered (`keep` lists (axis,
    value) planes whose vertices stay put on that axis, so a carved face can sit flush). The
    bottom stays on z0. LOD2 gets the plain box."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=cuts, use_grid_fill=True)
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, z0 + (v.co.z + 0.5) * sz))
    for v in bm.verts:
        o = v.co.copy()
        v.co += Vector((rng.uniform(-amp, amp), rng.uniform(-amp, amp), rng.uniform(-amp, amp) * 0.8))
        if o.z <= z0 + 1e-6:
            v.co.z = z0 - 0.01
        for axis, val in keep:
            if abs(o[axis] - val) < 1e-6:
                v.co[axis] = val
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, 'inc_basalt', min(lod, 1), matrix=f.copy(), only=tuple(range(0, min(lod, 1) + 1)))
    if lod >= 2:
        ms.add(_box_bm(sx, sy, sz, cx, cy, z0), 'inc_basalt', 2, matrix=f.copy(), only=2)


def boulder(ms, rng, f, x, y, z, r):
    """A lumpy basalt boulder (a jittered low sphere), LOD0 and LOD1."""
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=1, radius=r)
    for v in bm.verts:
        v.co *= rng.uniform(0.8, 1.15)
        v.co.z *= 0.6
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, 'inc_basalt', 1, matrix=f @ Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(rng.uniform(0, 6.28), 4, 'Z'))


def _box_bm(sx, sy, sz, cx, cy, z0):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, z0 + (v.co.z + 0.5) * sz))
    return bm


# ---- trees and props ----------------------------------------------------------------------------

def palm(ms, rng, x, y, h=0.5, fronds=8, lod=1):
    """A coconut palm: a slender trunk leaning a little, a crown of drooping fronds (LOD0), a crown
    cone at LOD1."""
    lean = rng.uniform(-9, 9), rng.uniform(-9, 9)
    f = Matrix.Translation(Vector((x, y, G))) @ Matrix.Rotation(math.radians(lean[0]), 4, 'X') @ Matrix.Rotation(math.radians(lean[1]), 4, 'Y')
    ms.cyl('inc_palmtrunk', 0.018, 0.013, h, at=(0, 0, 0), segs=6, lod=lod, frame=f)
    bm = bmesh.new()
    L = rng.uniform(0.15, 0.19)
    prof = [(0.0, 0.0, 0.008), (0.25, 0.03, 0.03), (0.5, 0.02, 0.038), (0.75, -0.03, 0.028), (1.0, -0.09, 0.006)]
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
    ms.add(bm, 'inc_palm', 0, matrix=f)
    ms.sphere('inc_palm', 0.035, at=(0, 0, h - 0.005), u=6, v=4, lod=0, frame=f)  # the nut cluster
    ms.cyl('inc_palm', 0.15, 0.03, 0.07, at=(0, 0, h - 0.05), segs=7, lod=lod, only=tuple(range(1, lod + 1)), frame=f)


def banana(ms, rng, x, y, h=0.16, leaves=6):
    """A banana plant: a short green stem and broad arching leaves (LOD0), a leafy cone at LOD1."""
    f = Matrix.Translation(Vector((x, y, G)))
    ms.cyl('inc_banana', 0.014, 0.011, h, segs=6, lod=1, frame=f)
    bm = bmesh.new()
    a0 = rng.uniform(0, 360)
    for k in range(leaves):
        a = math.radians(a0 + 360.0 * k / leaves + rng.uniform(-15, 15))
        c, s = math.cos(a), math.sin(a)
        L = rng.uniform(0.1, 0.13)
        prof = [(0.0, 0.0, 0.01), (0.35, 0.04, 0.05), (0.7, 0.02, 0.05), (1.0, -0.04, 0.01)]
        left, right = [], []
        for t, dz, wd in prof:
            px, py, pz = c * L * t, s * L * t, h * 0.9 + dz
            left.append(bm.verts.new((px - s * wd / 2, py + c * wd / 2, pz)))
            right.append(bm.verts.new((px + s * wd / 2, py - c * wd / 2, pz)))
        for i in range(len(prof) - 1):
            bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.004)
    ms.add(bm, 'inc_banana', 0, matrix=f)
    ms.cyl('inc_banana', 0.09, 0.02, 0.08, at=(0, 0, h * 0.75), segs=6, lod=1, only=1, frame=f)


def mango(ms, x, y, h=0.32, r=0.1, lod=1):
    """A round, dense mango or neem tree."""
    ms.cyl('inc_palmtrunk', 0.015, 0.011, h * 0.5, at=(x, y, G), segs=6, lod=1)
    ms.sphere('inc_leaf', r, at=(x, y, G + h - r * 0.8), scale=(1, 1, 0.82), u=9, v=6, lod=1, only=(0, 1))
    ms.sphere('inc_leaf', r * 0.75, at=(x + r * 0.45, y - r * 0.3, G + h - r * 1.25), u=7, v=5, lod=0)
    if lod >= 2:
        ms.cyl('inc_leaf', r * 0.95, r * 0.55, r * 1.5, at=(x, y, G + h - r * 1.6), segs=6, lod=2, only=2)


def tree(ms, rng, x, y, palm_p=0.5):
    """A coconut palm or a mango tree, the street sheet's two trees."""
    if rng.random() < palm_p:
        palm(ms, rng, x, y, h=rng.uniform(0.4, 0.55), fronds=7)
    else:
        mango(ms, x, y, h=rng.uniform(0.28, 0.36), r=rng.uniform(0.08, 0.11))


def street(ms, x0, y0, x1, y1, w):
    """A strip of the lighter paving (a street) along x or y on the town's ground."""
    if abs(x1 - x0) < abs(y1 - y0):
        pts = [(x0 - w / 2, min(y0, y1)), (x0 + w / 2, min(y0, y1)), (x0 + w / 2, max(y0, y1)), (x0 - w / 2, max(y0, y1))]
    else:
        pts = [(min(x0, x1), y0 - w / 2), (max(x0, x1), y0 - w / 2), (max(x0, x1), y0 + w / 2), (min(x0, x1), y0 + w / 2)]
    ms.quad_strip('inc_paving_square', [(px, py, G + 0.003) for px, py in pts], lod=1)


def shrub(ms, x, y, r=0.06, lod=1):
    ms.sphere('inc_leaf', r, at=(x, y, G + r * 0.55), scale=(1, 1, 0.75), u=7, v=4, lod=lod)


def pot(ms, f, x, y, s=1.0, plant=False):
    tt.jar(ms, f, x, y, s)
    if plant:
        ms.sphere('inc_leaf', 0.032 * s, at=(x, y, G + 0.085 * s + 0.02), scale=(1, 1, 0.85), u=7, v=5, lod=0, frame=f)


def pots(ms, f, x, y, rng, n=3):
    for _ in range(n):
        tt.jar(ms, f, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.035, 0.035), rng.uniform(0.85, 1.3))


def planter(ms, f, x, y, w=0.09, d=0.07):
    """A brick planter with a shrub (a tulsi bed), as in front of the town houses."""
    ms.box('inc_brick', (w, d, 0.05), at=(x, y, G), lod=0, frame=f)
    ms.sphere('inc_leaf', min(w, d) * 0.55, at=(x, y, G + 0.06), scale=(1, 1, 0.75), u=7, v=4, lod=0, frame=f)


def cloth(ms, f, x, y, w, z, depth=0.1, tilt=-16):
    """A team-cloth sun shade hung from a wall at local y (facing -Y), with no posts."""
    pf = f @ Matrix.Translation(Vector((x, y - depth / 2, z))) @ Matrix.Rotation(math.radians(tilt), 4, 'X')
    ms.box('team_cloth', (w, depth + 0.02, 0.01), at=(0, 0, 0), lod=0, frame=pf)


def compound_wall(ms, x0, y0, x1, y1, h=0.13, t=0.035, gaps=(), lod=2):
    """A red-brick compound wall with a lime-plaster coping and brick piers every so often;
    `gaps` are (centre fraction, width) openings (gates get plastered piers)."""
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
        ms.box('inc_brick', (b - a, t, h), at=((a + b) / 2, 0, G), lod=lod, frame=f)
        ms.box('inc_plaster', (b - a + 0.006, t + 0.012, 0.016), at=((a + b) / 2, 0, G + h), lod=1, frame=f)
        n = max(1, int((b - a) / 0.35))
        for i in range(n + 1):
            px = a + (b - a) * i / n
            ms.box('inc_brick', (0.04, t + 0.02, h + 0.03), at=(px, 0, G), lod=0, frame=f)
            ms.box('inc_plaster', (0.05, t + 0.03, 0.014), at=(px, 0, G + h + 0.03), lod=0, frame=f)
    for c, gw in gaps:
        if gw < 0.22:  # a narrow gap is a gate: plank leaves in it
            ms.box('inc_timber', (gw * 0.9, 0.012, h * 0.85), at=(c * length, 0, G), lod=0, frame=f)
    return f


# ---- wall details -------------------------------------------------------------------------------

def window(ms, f, x, y, z, w=0.05, h=0.07, face=-1):
    """A small window with a carved timber frame and a jali screen, on a wall face at local y."""
    ms.box('inc_jali', (w, 0.01, h), at=(x, y + face * 0.003, z), lod=0, frame=f)
    ms.box('inc_timber', (w + 0.018, 0.014, 0.012), at=(x, y + face * 0.005, z + h), lod=0, frame=f)
    ms.box('inc_timber', (w + 0.018, 0.014, 0.01), at=(x, y + face * 0.005, z - 0.01), lod=0, frame=f)


def door(ms, f, x, y, w=0.085, h=0.18, steps=2):
    ms.box('door', (w, 0.012, h), at=(x, y - 0.004, G + 0.03), lod=1, frame=f)
    ms.box('inc_timber', (w + 0.04, 0.018, 0.022), at=(x, y - 0.007, G + 0.03 + h), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('inc_timber', (0.018, 0.018, h), at=(x + sx * (w / 2 + 0.011), y - 0.007, G + 0.03), lod=0, frame=f)
    for k in range(steps):
        ms.box('inc_sandstone', (w + 0.1 - k * 0.03, 0.035, 0.03 * (steps - k) / steps), at=(x, y - 0.018 - (steps - 1 - k) * 0.03, G), lod=0, frame=f)


def body(ms, f, w, d, h, cx=0.0, cy=0.0, brick=0.08, belt=None):
    """Lime-plaster walls over a red-brick base on a sandstone plinth; `belt` adds a timber belt
    course at that height (the floor line of a two-storey house)."""
    ms.box('inc_sandstone', (w + 0.016, d + 0.016, 0.03), at=(cx, cy, G), lod=1, frame=f)
    ms.box('inc_plaster', (w, d, h), at=(cx, cy, G), lod=2, frame=f, bevel=0.004)
    if brick:
        ms.box('inc_brick', (w + 0.006, d + 0.006, brick), at=(cx, cy, G + 0.03), lod=1, frame=f)
    if belt:
        ms.box('inc_timber', (w + 0.012, d + 0.012, 0.016), at=(cx, cy, G + belt), lod=1, frame=f)


def finial(ms, f, x, y, z, s=1.0):
    ms.cyl('tile_dark', 0.012 * s, 0.0, 0.06 * s, at=(x, y, z - 0.01), segs=6, lod=0, frame=f)
    ms.sphere('tile_dark', 0.014 * s, at=(x, y, z + 0.005), u=6, v=4, lod=0, frame=f)


# ---- houses -------------------------------------------------------------------------------------

def fence(ms, f, x0, x1, y, h=0.09, gate=None):
    """A bamboo fence along local x at y: a woven panel between posts; `gate` a (x, width) gap."""
    spans = [(x0, x1)] if gate is None else [(x0, gate[0] - gate[1] / 2), (gate[0] + gate[1] / 2, x1)]
    for a, b in spans:
        if b - a < 0.02:
            continue
        ms.box('inc_bamboo', (b - a, 0.012, h), at=((a + b) / 2, y, G), lod=1, frame=f)
        n = max(1, int(abs(b - a) / 0.14))
        for i in range(n + 1):
            ms.box('inc_palmtrunk', (0.012, 0.016, h + 0.02), at=(a + (b - a) * i / n, y, G), lod=0, frame=f)


def lean_to(ms, f, x, y, w, d, side, mat='reed', h0=0.17, h1=0.12):
    """A lean-to shed on bamboo posts, its mat roof sloping down away from the house (toward
    local x `side`)."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ph = h0 if sx == -side else h1
            ms.box('inc_bamboo', (0.014, 0.014, ph), at=(x + sx * (w / 2 - 0.012), y + sy * (d / 2 - 0.012), G), lod=0, frame=f)
    slope = math.atan2(h0 - h1, w)
    rf = f @ Matrix.Translation(Vector((x, y, G + (h0 + h1) / 2 + 0.008))) @ Matrix.Rotation(slope * side, 4, 'Y')
    ms.box(mat, (w / math.cos(slope) + 0.04, d + 0.04, 0.014), at=(0, 0, 0), lod=1, frame=rf)


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, thatch=None):
    """The cottage (sheet: about 4 x 5 m, one storey): lime plaster over a red-brick base, a
    terracotta gable roof with its eaves to the street (or a thatched hip), a plank door up a step
    under a team-cloth shade, a jali window, a bamboo lean-to beside it, an earth yard behind a
    bamboo fence with a gate, pots and a banana plant or a small tree."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    side = side if side is not None else rng.choice([-1, 1])
    thatch = rng.random() < 0.35 if thatch is None else thatch
    ms.quad_strip('inc_yard', [(-w / 2, -d / 2, G + 0.002), (w / 2, -d / 2, G + 0.002), (w / 2, d / 2, G + 0.002),
                               (-w / 2, d / 2, G + 0.002)], lod=1, frame=f)
    hw = min(max(w * 0.6, 0.34), 0.46)
    hd = min(max(d * 0.62, 0.3), 0.4)
    hx = side * (w - hw) / 2 * 0.7
    hy = d / 2 - hd / 2 - 0.03
    h = STOREY * 0.78
    hf = f @ Matrix.Translation(Vector((hx, hy, 0)))
    body(ms, hf, hw, hd, h, brick=0.07)
    if thatch:
        hip(ms, hf, hw, hd, G + h, 0.15, mat='thatch', over=0.045)
    else:
        tc.gable_roof(ms, hf, hw, hd, G + h, 0.13, over=0.04, gable='inc_plaster')
    dx = -0.06 * side
    door(ms, hf, dx, -hd / 2, w=0.075, h=0.16, steps=1)
    window(ms, hf, 0.1 * side, -hd / 2, G + 0.15)
    tt.front_shade(ms, hf, dx, -hd / 2, 0.2, depth=0.1, z=0.24, mat='team_cloth')
    # the bamboo lean-to on the open side
    lw = min(0.2, max(0.0, w / 2 + side * hx - hw / 2 - 0.03))
    if lw > 0.1:
        lx = hx - side * (hw / 2 + lw / 2 + 0.01)
        lean_to(ms, f, lx, hy, lw, hd * 0.8, -side, mat='thatch' if thatch else 'reed')
        pots(ms, f, lx, hy - 0.02, rng, 2)
    # the fenced yard in front, a gate in line with the door, pots and a plant
    fy = -d / 2 + 0.01
    fence(ms, f, -w / 2, w / 2, fy, gate=(hx + dx, 0.12))
    for sx in (-1, 1):
        ms.box('inc_bamboo', (0.012, d - 0.04, 0.08), at=(sx * (w / 2 - 0.006), 0, G), lod=1, frame=f)
    pots(ms, f, hx + side * 0.13, -d / 2 + 0.07, rng, 2)
    p = f @ Vector((-side * (w / 2 - 0.08), -d / 2 + 0.1, 0))
    if rng.random() < 0.5:
        banana(ms, rng, p.x, p.y)
    else:
        mango(ms, p.x, p.y, h=0.26, r=0.07)
    ms.box('inc_timber', (0.11, 0.05, 0.03), at=(hx + side * 0.1, -d / 2 + 0.16, G + 0.02), lod=0, frame=f)  # a charpai
    return f


def common_house(ms, rng, x, y, w, d, yaw=None, awning=True, storeys=2, jar_n=2):
    """The town house (sheet: about 9 x 10 m, two storeys): lime plaster over a red-brick base, a
    timber belt at the floor line, jali windows, a carved door up two steps, a tiled hip roof
    round a small court with a tree, a carved timber balcony on the upper floor under a front
    gable, a team-cloth awning on posts over the ground floor and brick planters at the steps."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = STOREY * (1.32 if storeys == 2 else 0.92)
    body(ms, f, w, d, h, belt=h * 0.52 if storeys == 2 else None)
    hole = (min(0.22, w * 0.32), min(0.2, d * 0.32))
    ring_roof(ms, f, w + 0.08, d + 0.08, G + h, 0.15, hole[0], hole[1])
    ms.box('inc_flags', (hole[0], hole[1], G + h - 0.03), at=(0, 0, 0), lod=1, frame=f)
    ms.sphere('inc_leaf', 0.05, at=(0, 0, G + h + 0.01), u=7, v=5, lod=0, frame=f)
    dx = rng.uniform(-0.1, 0.1) * w
    door(ms, f, dx, -d / 2)
    for wx in (-w * 0.33, w * 0.33):
        if abs(wx - dx) > 0.1:
            window(ms, f, wx, -d / 2, G + 0.15)
    for sx in (-1, 1):
        sf = f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        window(ms, sf, 0, -w / 2, G + 0.15)
        if storeys == 2:
            window(ms, sf, 0, -w / 2, G + h * 0.66)
    if storeys == 2:
        # the carved balcony (jharokha) across the middle of the upper floor, a gable over it
        bw = min(0.36, w * 0.5)
        zf = G + h * 0.52
        ms.box('inc_timber', (bw, 0.075, 0.016), at=(dx * 0.5, -d / 2 - 0.035, zf), lod=1, frame=f)
        ms.box('inc_jali', (bw, 0.012, 0.055), at=(dx * 0.5, -d / 2 - 0.068, zf + 0.016), lod=1, frame=f)
        for i in range(4):
            px = dx * 0.5 - bw / 2 + 0.01 + (bw - 0.02) * i / 3
            ms.box('inc_timber', (0.013, 0.013, G + h - zf + 0.02), at=(px, -d / 2 - 0.066, zf), lod=0, frame=f)
        for wx in (-bw * 0.25, bw * 0.25):
            window(ms, f, dx * 0.5 + wx, -d / 2, zf + 0.04, w=0.05, h=0.09)
        gf = f @ Matrix.Translation(Vector((dx * 0.5, -d / 2 + 0.06, 0))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
        tc.gable_roof(ms, gf, 0.26, bw + 0.02, G + h, 0.13, over=0.04, gable='inc_plaster', lod=1)
        finial(ms, f, dx * 0.5, -d / 2 + 0.06, G + h + 0.13)
    else:
        ms.box('inc_jali', (0.12, 0.01, 0.06), at=(dx * 0.5, -d / 2 - 0.003, G + h * 0.6), lod=0, frame=f)
    if awning:
        aw = min(0.5, w * 0.62)
        tt.front_shade(ms, f, dx * 0.4, -d / 2, aw, depth=0.12, z=0.25, mat='team_cloth')
    for sx in (-1, 1):
        planter(ms, f, dx + sx * 0.11, -d / 2 - 0.05)
    if jar_n:
        pots(ms, f, (w * 0.3 if dx < 0 else -w * 0.3), -d / 2 - 0.06, rng, jar_n)
    return f


def chhatri(ms, f, x, y, z, s=0.14, h=0.13):
    """A small domed-pavilion stand-in: four posts on a plinth under a tiled pyramid with a finial."""
    ms.box('inc_sandstone', (s + 0.02, s + 0.02, 0.02), at=(x, y, z), lod=1, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('inc_timber', (0.014, 0.014, h), at=(x + sx * s * 0.42, y + sy * s * 0.42, z + 0.02), lod=0, frame=f)
    ms.box('inc_timber', (s, s, 0.014), at=(x, y, z + 0.02 + h), lod=1, frame=f)
    hip(ms, f, s, s, z + 0.034 + h, s * 0.6, over=0.025, cx=x, cy=y, lod=1)
    finial(ms, f, x, y, z + 0.034 + h + s * 0.6)


def rich_house(ms, rng, x, y, w, d, yaw=None, garden=True, terrace=None):
    """The haveli (sheet: about 16 x 16 m): two storeys of lime plaster over red brick round a court
    with a lotus pool, a carved timber verandah below and a gallery above hung with team-cloth
    shades, a pavilion storey under its own hip at the back, a flat terrace wing with a balustrade
    and a chhatri, and (where the plot is deep) a forecourt behind a brick wall with a stepped
    gate, pots and palms."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = STOREY * 1.3
    terrace = (w >= 0.8) if terrace is None else terrace
    tw = w * 0.24 if terrace else 0.0
    wm = w - tw
    mx = -tw / 2 * (1 if rng.random() < 0.5 else -1) if terrace else 0.0
    tx = mx + (wm / 2 + tw / 2) * (1 if mx < 0 else -1)
    dm = d * (0.76 if garden else 1.0)
    cy = d / 2 - dm / 2
    body(ms, f, wm, dm, h, cx=mx, cy=cy, belt=h * 0.5)
    hole = (wm * 0.36, dm * 0.34)
    ring_roof(ms, f, wm + 0.08, dm + 0.08, G + h, 0.17, hole[0], hole[1], cx=mx, cy=cy)
    ms.box('inc_flags', (hole[0], hole[1], G + h - 0.04), at=(mx, cy, 0), lod=1, frame=f)
    ms.box('water', (hole[0] * 0.62, hole[1] * 0.62, 0.006), at=(mx, cy, G + h - 0.04), lod=0, frame=f)
    for k in range(3):  # lotus pads and a shrub at the pool
        ms.cyl('inc_banana', 0.018, 0.018, 0.006, at=(mx + (k - 1) * hole[0] * 0.18, cy + (k % 2) * 0.03 - 0.015, G + h - 0.034), segs=6, lod=0, frame=f)
    ms.sphere('inc_leaf', 0.04, at=(mx + hole[0] * 0.38, cy + hole[1] * 0.3, G + h - 0.02), u=7, v=4, lod=0, frame=f)
    # the verandah: carved posts carrying the gallery floor, the gallery's jali rail and posts
    fy = cy - dm / 2
    vw = wm * 0.86
    zf = G + h * 0.5
    n = max(4, round(vw / 0.13))
    ms.box('inc_sandstone', (vw + 0.04, 0.12, 0.035), at=(mx, fy - 0.05, G), lod=1, frame=f)
    ms.box('inc_timber', (vw, 0.11, 0.018), at=(mx, fy - 0.05, zf), lod=1, frame=f)
    ms.box('inc_jali', (vw, 0.012, 0.055), at=(mx, fy - 0.1, zf + 0.018), lod=1, frame=f)
    for i in range(n):
        px = mx - vw / 2 + 0.015 + (vw - 0.03) * i / (n - 1)
        ms.cyl('inc_timber', 0.011, 0.009, zf - G - 0.035, at=(px, fy - 0.095, G + 0.035), segs=6, lod=1, frame=f)
        ms.box('inc_timber', (0.03, 0.03, 0.014), at=(px, fy - 0.095, zf - 0.014), lod=0, frame=f)
        ms.box('inc_timber', (0.012, 0.012, G + h - zf + 0.015), at=(px, fy - 0.098, zf + 0.018), lod=0, frame=f)
    for i in range(3):  # the team-cloth shades along the gallery
        cloth(ms, f, mx - vw / 3 + vw / 3 * i, fy - 0.11, vw / 3 - 0.02, G + h + 0.0, depth=0.07)
    door(ms, f, mx, fy, w=0.1, h=0.17)
    for wx in (-0.3, -0.16, 0.16, 0.3):
        if abs(wx) * wm < vw / 2:
            window(ms, f, mx + wx * wm, fy, G + 0.14)
            window(ms, f, mx + wx * wm, fy, zf + 0.06, w=0.055, h=0.08)
    # the pavilion storey at the back with its own hip and finial
    pw, pd = wm * 0.34, dm * 0.24
    py = cy + dm / 2 - pd / 2 - 0.03
    ph = STOREY * 0.4
    ms.box('inc_plaster', (pw, pd, ph + 0.1), at=(mx, py, G + h - 0.06), lod=2, frame=f)
    ms.box('inc_timber', (pw + 0.01, pd + 0.01, 0.014), at=(mx, py, G + h + 0.04), lod=1, frame=f)
    window(ms, f, mx, py - pd / 2, G + h + 0.08, w=0.07, h=0.07)
    hip(ms, f, pw, pd, G + h + ph + 0.04, 0.1, over=0.04, cx=mx, cy=py, lod=2)
    finial(ms, f, mx, py, G + h + ph + 0.14)
    if terrace:
        th = h * 0.62
        ms.box('inc_sandstone', (tw + 0.012, dm * 0.7 + 0.012, 0.03), at=(tx, cy + dm * 0.15, G), lod=1, frame=f)
        ms.box('inc_plaster', (tw, dm * 0.7, th), at=(tx, cy + dm * 0.15, G), lod=2, frame=f)
        ms.box('inc_brick', (tw + 0.006, dm * 0.7 + 0.006, 0.08), at=(tx, cy + dm * 0.15, G + 0.03), lod=1, frame=f)
        tz = G + th
        for (bx, by, bw, bd) in ((tx, cy + dm * 0.15 - dm * 0.35, tw, 0.02), (tx, cy + dm * 0.5, tw, 0.02),
                                 (tx + (tw / 2 - 0.01) * (1 if tx > mx else -1), cy + dm * 0.15, 0.02, dm * 0.7)):
            ms.box('inc_plaster', (bw, bd, 0.05), at=(bx, by, tz), lod=1, frame=f)
        chhatri(ms, f, tx, cy + dm * 0.32, tz, s=min(0.15, tw * 0.75))
        window(ms, f, tx, cy + dm * 0.15 - dm * 0.35, G + 0.14)
    if garden:
        # the forecourt: a brick wall with a gate and steps, pots, palms
        gy = -d / 2 + 0.02
        x0, x1 = -w / 2, w / 2
        gw = 0.16
        for a, b in ((x0, mx - gw / 2), (mx + gw / 2, x1)):
            ms.box('inc_brick', (b - a, 0.035, 0.1), at=((a + b) / 2, gy, G), lod=2, frame=f)
            ms.box('inc_plaster', (b - a + 0.006, 0.045, 0.014), at=((a + b) / 2, gy, G + 0.1), lod=1, frame=f)
        for sx in (-1, 1):
            ms.box('inc_plaster', (0.045, 0.05, 0.15), at=(mx + sx * (gw / 2 + 0.022), gy, G), lod=1, frame=f)
            ms.box('inc_brick', (0.035, fy - gy, 0.1), at=(sx * (w / 2 - 0.018), (gy + fy) / 2, G), lod=2, frame=f)
            pot(ms, f, mx + sx * 0.14, gy + 0.06, 1.0, plant=True)
        ms.box('inc_sandstone', (gw + 0.04, 0.05, 0.02), at=(mx, gy - 0.03, G), lod=0, frame=f)
        ms.quad_strip('inc_flags', [(mx - gw / 2, gy, G + 0.003), (mx + gw / 2, gy, G + 0.003), (mx + gw / 2, fy - 0.11, G + 0.003),
                                    (mx - gw / 2, fy - 0.11, G + 0.003)], lod=1, frame=f)
        for sx in (-1, 1):
            p = f @ Vector((sx * (w / 2 - 0.1), (gy + fy) / 2, 0))
            if (fy - gy) > 0.14:
                palm(ms, rng, p.x, p.y, h=rng.uniform(0.42, 0.52), fronds=7)
            else:
                pot(ms, f, sx * (w / 2 - 0.08), (gy + fy) / 2, 1.0, plant=True)
    else:
        for sx in (-1, 1):
            pot(ms, f, mx + sx * (vw / 2 + 0.05), fy - 0.06, 1.0, plant=True)
    return f


def indic_house(ms, rng, slot):
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


# ---- street things ------------------------------------------------------------------------------

def stall(ms, x, y, rng, yaw=None, w=0.36, d=0.3):
    """A market stall under a team-cloth awning (the Bronze kit's stall)."""
    import ti_bronze as tb
    tb.stall(ms, x, y, rng, yaw=yaw, cloth='team_cloth', w=w, d=d)


def shrine(ms, x, y, yaw=0.0):
    """A wayside shrine: a small plastered cell on a brick plinth under a tiled pyramid, a lamp
    niche and a pot of offerings."""
    f = tm.house_frame(x, y, yaw)
    ms.box('inc_brick', (0.14, 0.14, 0.04), at=(0, 0, G), lod=1, frame=f)
    ms.box('inc_plaster', (0.1, 0.1, 0.11), at=(0, 0, G + 0.04), lod=1, frame=f)
    ms.box('dark', (0.04, 0.01, 0.06), at=(0, -0.052, G + 0.06), lod=0, frame=f)
    hip(ms, f, 0.1, 0.1, G + 0.15, 0.08, over=0.02, lod=1)
    finial(ms, f, 0, 0, G + 0.23, 0.8)
    tt.jar(ms, f, 0.08, -0.08, 0.7)


# ---- landmark 1: the Sanchi stupa ---------------------------------------------------------------

def stupa(ms, rng, x, y, D=2.0, yaw=0.0):
    """The Great Stupa of the sheet (railing 20 m across, a 2 m drum, an 8 m dome, the harmika and
    three chattra discs to 14 m), at the size D (units) of the railing: a flagged platform, the
    ground railing (vedika) of posts, three crossbars and a coping broken by four toranas at the
    cardinal points, the drum with its walkway railing and a stair, the dressed-stone dome, the
    square harmika and the chattra, two team banners flanking the south gate."""
    s = D / 2.0
    f = tm.house_frame(x, y, yaw)
    seg = 32 if s > 0.55 else 24
    ms.cyl('inc_flags', s * 1.04, s * 1.04, 0.022, at=(0, 0, G - 0.004), segs=seg, lod=1, frame=f, only=(0, 1))
    ms.cyl('inc_flags', s * 1.04, s * 1.04, 0.022, at=(0, 0, G - 0.004), segs=12, lod=2, frame=f, only=2)
    z0 = G + 0.018
    # the ground railing, with four gaps for the gates
    H = 0.27 * s
    t = max(0.03, 0.045 * s)
    gap = 0.2
    arcs = [(math.radians(a) + gap, math.radians(a + 90) - gap) for a in (-90, 0, 90, 180)]
    arc_ring(ms, 'inc_carved', s - t, s, z0, z0 + H, n=14, lod=2, frame=f, only=2)
    npost = int(2 * math.pi * s / max(0.06, 0.09 * s))
    for a0, a1 in arcs:
        k = max(4, int(npost * (a1 - a0) / (2 * math.pi)))
        for i in range(k + 1):
            a = a0 + (a1 - a0) * i / k
            pf = f @ Matrix.Rotation(a, 4, 'Z')
            ms.box('inc_carved', (t * 0.9, max(0.022, 0.032 * s), H * 0.92), at=(s - t / 2, 0, z0), lod=1, frame=pf)
        for zz in (0.25, 0.48, 0.71):
            arc_ring(ms, 'inc_carved', s - t * 0.85, s - t * 0.15, z0 + H * zz, z0 + H * zz + H * 0.13, a0, a1, n=8, lod=0, frame=f)
        arc_ring(ms, 'inc_carved', s - t * 0.8, s - t * 0.2, z0 + H * 0.25, z0 + H * 0.84, a0, a1, n=6, lod=1, frame=f, only=1)
        arc_ring(ms, 'inc_carved', s - t * 1.05, s + t * 0.05, z0 + H * 0.88, z0 + H, a0, a1, n=8, lod=1, frame=f)
    # the drum (medhi), its walkway railing, the stair at the south
    rd = 0.84 * s
    hd = 0.2 * s
    ms.cyl('inc_sandstone', rd, rd, hd, at=(0, 0, z0), segs=seg, lod=1, frame=f, only=(0, 1))
    ms.cyl('inc_sandstone', rd, rd, hd, at=(0, 0, z0), segs=12, lod=2, frame=f, only=2)
    zt = z0 + hd
    arc_ring(ms, 'inc_carved', rd - 0.03 * s, rd, zt, zt + 0.07 * s, n=seg, lod=1, frame=f)
    for k in range(int(seg * 0.75) if s > 0.4 else 0):
        a = 2 * math.pi * k / int(seg * 0.75)
        if abs(math.sin(a) + 1) < 0.02:
            continue
        ms.box('inc_carved', (0.016, 0.016, 0.07 * s), at=(rd * math.cos(a) * 0.985, rd * math.sin(a) * 0.985, zt), lod=0, frame=f)
    sw = 0.16 * s
    for sx in (-1, 1):  # a double stair up the south face of the drum
        for k in range(5):
            zk = hd * (k + 1) / 5
            ms.box('inc_sandstone', (sw, 0.04 * s, zk), at=(sx * (sw / 2 + 0.01 + (4 - k) * 0.035 * s), -rd - 0.02 * s, z0), lod=0, frame=f)
    # the dome (anda): dressed sandstone; a lighter dome at LOD2
    rdome = 0.78 * s
    hdome = 0.8 * s
    ms.sphere('inc_sandstone', rdome, at=(0, 0, zt), scale=(1, 1, hdome / rdome), u=32 if s > 0.55 else 24, v=14,
              cut_below=0.0, lod=0, frame=f)
    ms.sphere('inc_sandstone', rdome, at=(0, 0, zt), scale=(1, 1, hdome / rdome), u=20, v=8, cut_below=0.0, lod=1, frame=f, only=1)
    ms.sphere('inc_sandstone', rdome, at=(0, 0, zt), scale=(1, 1, hdome / rdome), u=10, v=4, cut_below=0.0, lod=2, frame=f, only=2)
    ztop = zt + hdome
    # the harmika: a square stone railing box on the summit
    hw = 0.3 * s
    hz = ztop - 0.03 * s
    ms.box('inc_carved', (hw, hw, 0.11 * s), at=(0, 0, hz), lod=2, frame=f)
    ms.box('inc_sandstone', (hw + 0.03 * s, hw + 0.03 * s, 0.025 * s), at=(0, 0, hz + 0.11 * s), lod=1, frame=f)
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for i in range(5):
            ms.box('inc_sandstone', (0.018 * s + 0.004, 0.012, 0.09 * s), at=(-hw * 0.4 + hw * 0.2 * i, -hw / 2 - 0.004, hz + 0.01 * s), lod=0, frame=rf)
    # the chattra: the shaft and three discs
    zc = hz + 0.135 * s
    top = 1.4 * s + G
    ms.cyl('inc_sandstone', max(0.012, 0.022 * s), max(0.01, 0.018 * s), top - zc, at=(0, 0, zc), segs=8, lod=1, frame=f)
    for k, (r, zz) in enumerate(((0.17, 0.06), (0.13, 0.14), (0.095, 0.22))):
        ms.cyl('inc_sandstone', r * s, r * s * 0.9, 0.028 * s, at=(0, 0, zc + zz * s), segs=16, lod=1 if k < 2 else 0, frame=f)
        ms.cyl('inc_carved', r * s * 0.35, r * s * 0.2, 0.025 * s, at=(0, 0, zc + zz * s + 0.028 * s), segs=8, lod=0, frame=f)
    ms.sphere('inc_sandstone', max(0.016, 0.02 * s), at=(0, 0, top - 0.01), u=6, v=4, lod=0, frame=f)
    # the four toranas
    for k, a in enumerate((-90, 0, 90, 180)):
        gf = f @ Matrix.Rotation(math.radians(a + 90), 4, 'Z') @ Matrix.Translation(Vector((0, -s - 0.06 * s, 0)))
        torana(ms, gf, s, z0)
    # team banners flanking the south gate
    for sx in (-1, 1):
        bx = sx * 0.28 * s
        by = -s - 0.16 * s
        ms.cyl('inc_sandstone', 0.022, 0.026, 0.03, at=(bx, by, z0), segs=8, lod=0, frame=f)
        ms.cyl('timber', 0.006, 0.006, 0.62 * s, at=(bx, by, z0), segs=5, lod=0, frame=f)
        ms.box('timber', (0.1 * s + 0.02, 0.008, 0.008), at=(bx, by, z0 + 0.58 * s), lod=0, frame=f)
        ms.box('team_cloth', (0.1 * s, 0.008, 0.3 * s), at=(bx, by - 0.006, z0 + 0.27 * s), lod=1, frame=f)
    return f


def torana(ms, f, s, z0):
    """A gateway (torana) in its own frame (front -Y): two square pillars with elephant capitals,
    three architraves running past them with volute ends, uprights between the beams."""
    pw = max(0.026, 0.055 * s)
    gx = 0.13 * s + pw / 2
    ph = 0.7 * s
    for sx in (-1, 1):
        ms.box('inc_carved', (pw, pw, ph), at=(sx * gx, 0, z0), lod=1, frame=f)
        ms.box('inc_carved', (pw * 1.5, pw * 1.6, 0.07 * s), at=(sx * gx, 0, z0 + 0.4 * s), lod=0, frame=f)  # the elephants
    L = 2 * gx + 0.22 * s
    for k, zz in enumerate((0.47, 0.57, 0.67)):
        bh = 0.065 * s
        ms.box('inc_carved', (L, pw * 0.8, bh), at=(0, 0, z0 + zz * s), lod=1, frame=f)
        for sx in (-1, 1):
            ms.cyl('inc_carved', bh * 0.62, bh * 0.62, pw * 0.85, at=(sx * L / 2, pw * 0.42, z0 + zz * s + bh / 2), rot=(90, 0, 0), segs=8, lod=0, frame=f)
        if k < 2:
            for ux in (-gx * 0.35, gx * 0.35):
                ms.box('inc_carved', (pw * 0.5, pw * 0.6, 0.06 * s), at=(ux, 0, z0 + (zz + 0.065) * s), lod=0, frame=f)
    ms.cyl('inc_carved', 0.02 * s + 0.006, 0.0, 0.08 * s, at=(0, 0, z0 + 0.735 * s), segs=6, lod=0, frame=f)  # the wheel finial stand-in
    for sx in (-1, 1):
        ms.sphere('inc_carved', 0.03 * s + 0.004, at=(sx * gx, 0, z0 + 0.76 * s), u=6, v=4, lod=0, frame=f)


# ---- landmark 2: the rock-cut chaitya ---------------------------------------------------------------

def figure(ms, f, x, y, z, s):
    """A carved guardian in a shallow niche: a body, a head, a dark niche behind."""
    ms.box('dark', (0.09 * s, 0.01, 0.2 * s), at=(x, y + 0.012, z), lod=0, frame=f)
    ms.cyl('inc_cbasalt', 0.03 * s + 0.004, 0.022 * s + 0.004, 0.15 * s, at=(x, y, z), segs=6, lod=0, frame=f)
    ms.sphere('inc_cbasalt', 0.022 * s + 0.004, at=(x, y, z + 0.17 * s), u=6, v=4, lod=0, frame=f)


def chaitya(ms, rng, x, y, w=1.6, depth=None, yaw=0.0):
    """The rock-cut chaitya of the sheet (facade 16 m wide and 16 m high: a 5 m colonnade and the
    11 m horseshoe arch above) cut into a basalt cliff: the rock frame round the facade and the mass
    behind it, a floor up three steps, eight pillars with pot bases and bell capitals before a dark
    hall with a small stupa, a carved rail over the pillars, the great arch with its timber ribs,
    carved friezes with small kudu arches, guardian figures in niches, team-cloth awnings at the
    front corners. `w` is the facade width; the rock is 1.25 w wide and `depth` deep."""
    s = w / 1.6
    depth = depth or 1.3 * s
    f = tm.house_frame(x, y, yaw)
    W = 0.8 * s           # half the facade
    R = 1.0 * s           # half the rock
    top = 1.6 * s
    fd = 0.2 * s          # how far the rock frame stands proud of the facade
    amp = 0.085 * s + 0.01
    # the cliff: the mass behind, the jambs either side, the overhang above the facade
    rock(ms, rng, f, 0, depth / 2 + 0.02 * s, G, 2 * R, depth, top, amp=amp, cuts=3, keep=((1, 0.02 * s),), lod=2)
    for k in range(14):  # boulders heaped on the top and shoulders
        bx = rng.uniform(-R * 0.9, R * 0.9)
        by = rng.uniform(-fd * 0.6, depth * 0.9)
        br = rng.uniform(0.13, 0.22) * s
        boulder(ms, rng, f, bx, by, G + top - br * 0.15, br)
    for sx in (-1, 1):  # and down the outer shoulders
        for k in range(3):
            br = rng.uniform(0.12, 0.18) * s
            boulder(ms, rng, f, sx * (R - br * 0.3), rng.uniform(0, depth * 0.8), G + top * rng.uniform(0.3, 0.8), br)
    for sx in (-1, 1):
        rock(ms, rng, f, sx * (W + (R - W) / 2), -fd / 2 + 0.02 * s, G, R - W, fd + 0.04 * s, top * 0.97, amp=amp * 0.8, cuts=2,
             keep=((0, sx * W),), lod=2)
    rock(ms, rng, f, 0, -fd / 2 + 0.02 * s, G + 1.44 * s, 2 * W + 0.02, fd + 0.04 * s, 0.17 * s, amp=amp * 0.7, cuts=1,
         keep=((2, G + 1.44 * s),), lod=1)
    # the floor, the steps
    ms.box('inc_flags', (2 * W, fd + 0.02, 0.04 * s), at=(0, -fd / 2 + 0.01, G), lod=2, frame=f)
    for k in range(3):
        ms.box('inc_cbasalt', (1.1 * W - k * 0.04 * s, 0.04 * s, 0.04 * s * (3 - k) / 3), at=(0, -fd - 0.02 * s - (2 - k) * 0.04 * s, G), lod=1, frame=f)
    zf = G + 0.04 * s
    # the dark hall behind the pillars, the small stupa in its door
    ms.box('dark', (2 * W - 0.02, 0.02, 0.48 * s), at=(0, 0.0, zf), lod=2, frame=f)
    ms.cyl('inc_colstone', 0.07 * s, 0.07 * s, 0.07 * s, at=(0, -0.02, zf), segs=10, lod=0, frame=f)
    ms.sphere('inc_colstone', 0.065 * s, at=(0, -0.02, zf + 0.07 * s), cut_below=0.0, u=10, v=5, lod=0, frame=f)
    ms.box('inc_colstone', (0.03 * s, 0.03 * s, 0.03 * s), at=(0, -0.02, zf + 0.135 * s), lod=0, frame=f)
    # eight pillars
    ph = 0.46 * s
    cr = max(0.016, 0.032 * s)
    py = -0.09 * s
    for i in range(8):
        px = -W + 0.08 * s + (2 * W - 0.16 * s) * i / 7
        ms.cyl('inc_colstone', cr * 1.25, cr * 1.1, 0.06 * s, at=(px, py, zf), segs=8, lod=0, frame=f)  # the pot base
        ms.cyl('inc_colstone', cr, cr, ph, at=(px, py, zf), segs=8, lod=1, frame=f)
        ms.cyl('inc_colstone', cr * 1.0, cr * 1.6, 0.05 * s, at=(px, py, zf + ph - 0.05 * s), segs=8, lod=0, frame=f)  # the bell
        ms.box('inc_colstone', (cr * 3.4, cr * 3.4, 0.022 * s), at=(px, py, zf + ph), lod=0, frame=f)
    # the beam and the carved rail over the pillars
    zb = zf + ph + 0.022 * s
    ms.box('inc_cbasalt', (2 * W, fd * 0.7, 0.05 * s), at=(0, -fd * 0.35 + 0.02 * s, zb), lod=2, frame=f)
    ms.box('inc_cbasalt', (2 * W, 0.04 * s, 0.09 * s), at=(0, -fd * 0.62, zb + 0.05 * s), lod=1, frame=f)
    for i in range(13):
        ms.box('inc_carved', (0.03 * s, 0.012, 0.07 * s), at=(-W + 0.06 * s + (2 * W - 0.12 * s) * i / 12, -fd * 0.62 - 0.02 * s, zb + 0.06 * s), lod=0, frame=f)
    # the upper facade face
    zu = zb + 0.05 * s
    ms.box('inc_cbasalt', (2 * W, 0.06 * s, 1.44 * s + G - zu), at=(0, 0.01 * s, zu), lod=2, frame=f)
    # the great arch: the horseshoe window, its ribs, the arch band and the finial
    Ra = 0.46 * s
    cz = zu + 0.24 * s
    yf = -0.02 * s
    half_disc(ms, 'dark', Ra, 0, cz, yf - 0.006, yf + 0.01, legs=0.1 * s, n=14, lod=1, frame=f)
    for k in range(11):
        a = math.pi * (k + 0.5) / 11
        rf = f @ Matrix.Translation(Vector((0, yf - 0.012, cz - 0.08 * s))) @ Matrix.Rotation(-(a - math.pi / 2), 4, 'Y')
        ms.box('inc_timber', (0.014, 0.012, Ra + 0.04 * s), at=(0, 0, 0), lod=0, frame=rf)
    arch_band(ms, 'inc_timber', Ra * 0.48, Ra * 0.48 + 0.02 * s, 0, cz - 0.08 * s, yf - 0.02, yf - 0.006, 0.0, math.pi, n=8, lod=0, frame=f)
    arch_band(ms, 'inc_cbasalt', Ra, Ra + 0.075 * s, 0, cz, yf - 0.05 * s, yf + 0.01, -0.12, math.pi + 0.12, n=14, lod=1, frame=f)
    arch_band(ms, 'inc_carved', Ra + 0.075 * s, Ra + 0.1 * s, 0, cz, yf - 0.035 * s, yf + 0.01, -0.06, math.pi + 0.06, n=14, lod=0, frame=f)
    for sx in (-1, 1):  # the straight legs of the horseshoe
        ms.box('inc_cbasalt', (0.075 * s, 0.05 * s + 0.03, 0.14 * s), at=(sx * (Ra + 0.0375 * s), yf - 0.02 * s, zu), lod=1, frame=f)
    ms.cyl('inc_cbasalt', 0.035 * s, 0.0, 0.12 * s, at=(0, yf - 0.02 * s, cz + Ra + 0.07 * s), segs=6, lod=0, frame=f)
    # the friezes over the arch: bands with rows of small kudu arches
    for k, zz in enumerate((1.18, 1.3)):
        ms.box('inc_cbasalt', (2 * W, 0.05 * s, 0.06 * s), at=(0, yf - 0.025 * s, G + zz * s), lod=1, frame=f)
        n = 9 if k else 7
        for i in range(n):
            px = -W + 0.1 * s + (2 * W - 0.2 * s) * i / (n - 1)
            if abs(px) < Ra + 0.1 * s and k == 0:
                continue
            half_disc(ms, 'inc_carved', 0.03 * s + 0.004, px, G + zz * s + 0.07 * s, yf - 0.05 * s, yf - 0.02 * s, legs=0.03 * s, n=6, lod=0, frame=f)
    # pilasters at the facade's edges, guardians in niches
    for sx in (-1, 1):
        ms.box('inc_cbasalt', (0.08 * s, 0.06 * s, 1.44 * s + G - zf), at=(sx * (W - 0.04 * s), yf - 0.02 * s, zf), lod=1, frame=f)
        figure(ms, f, sx * 0.67 * s, yf - 0.03 * s, zu + 0.04 * s, s)
        figure(ms, f, sx * (W - 0.12 * s), py - 0.04 * s, zf, s)
    # team-cloth awnings on poles at the front corners
    for sx in (-1, 1):
        tt.front_shade(ms, f, sx * (W - 0.14 * s), -fd + 0.02 * s, 0.22 * s, depth=0.14 * s, z=0.38 * s, mat='team_cloth')
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
