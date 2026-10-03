# scripts/blender/ti_gunpowder.py
# The Gunpowder Age kit (plans/art/towns/gunpowder/<id>/reference-sheet.png): European brick and
# cream-stucco houses on sandstone plinths with sandstone quoins, string courses and window
# surrounds, shutters, terracotta or slate roofs (gable, hip or mansard with dormers), brick
# chimneys; landmarks (a clock tower, a town hall with its clock tower, a domed baroque church, a
# twin-tower baroque church, a post windmill, a corner bastion with a cannon), market stalls
# under team-grey awnings, iron street lamps, trees; cobbled ground with a pale slab square.
# The shared pieces: a manor (palace-small), a domed baroque palace on a U plan (palace),
# bastioned wall traces (low battered stone scarps under turf ramparts, angled bastions with
# cannon, a gatehouse at the south), the colony camp, and four fields (wheat, pears, pasture,
# potatoes). Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the
# sheets' heights, the front (south) facing -Y.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
from ti_town import G  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['gp_brick', 'gp_stucco', 'gp_sandstone', 'gp_tile', 'gp_slate', 'gp_window', 'gp_shutter', 'gp_shutter_brown',
       'gp_scarp', 'gp_turf', 'gp_iron', 'gp_lead', 'gp_plank', 'gp_sail', 'gp_wheat', 'gp_potato', 'gp_pear',
       'gp_fence', 'gp_clock', 'gp_gravel', 'gp_cobble', 'gp_cobble_fringe', 'gp_cobble_square',
       'gp_meadow', 'gp_meadow_fringe']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'gp_cobble': 'Ground', 'gp_cobble_fringe': 'Ground', 'gp_cobble_square': 'Ground',
                    'gp_meadow': 'Ground', 'gp_meadow_fringe': 'Ground'})
for _n in ('gp_cobble_fringe', 'gp_meadow_fringe'):
    if _n not in tt.FRINGES:
        tt.FRINGES.append(_n)


def make_materials():
    tm.mat_mudwall('gp_brick', wash='#b07a62', brick='#a2503a', brick2='#8c4232', mortar='#c2ad94', wash_cover=0.0,
                   bond=(0.04, 0.014, 0.0022))
    tm.mat_simple('gp_stucco', ['#d8c9ab', '#e5dac3', '#cdbd9b', '#ece3cf'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_mudwall('gp_sandstone', wash='#d9c6a0', brick='#d2bc92', brick2='#c1a97f', mortar='#9c8868', wash_cover=0.0,
                   bond=(0.06, 0.03, 0.003))
    tm.mat_mudwall('gp_tile', wash='#b9542f', brick='#c4623b', brick2='#a94b2c', mortar='#6e2d18', wash_cover=0.0,
                   bond=(0.026, 0.013, 0.0025))
    tm.mat_mudwall('gp_slate', wash='#56637a', brick='#55627a', brick2='#46526a', mortar='#2a3140', wash_cover=0.0,
                   bond=(0.024, 0.012, 0.002))
    tm.mat_mudwall('gp_window', wash='#2a3540', brick='#26323e', brick2='#2f3d4a', mortar='#cfc8b8', wash_cover=0.0,
                   bond=(0.022, 0.03, 0.003))
    tm.mat_simple('gp_shutter', ['#3a4a34', '#46583e', '#33412e'], scale=8.0, stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 3.0}, bump=0.4)
    tm.mat_simple('gp_shutter_brown', ['#3e2c1e', '#4f3826', '#36261a'], scale=8.0, stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 3.0}, bump=0.4)
    tm.mat_mudwall('gp_scarp', wash='#9c978d', brick='#8f8b83', brick2='#7b7870', mortar='#5c5a55', wash_cover=0.0,
                   bond=(0.07, 0.034, 0.004))
    tm.mat_earth('gp_turf', colors=('#5d772c', '#718a36', '#8b8748', '#647e34'))
    tm.mat_simple('gp_iron', ['#24262a', '#33363a', '#2a2c30'], scale=30.0, rough=0.45, bump=0.2, metal=0.6)
    tm.mat_simple('gp_lead', ['#566476', '#677689', '#4b5869'], scale=14.0, rough=0.5, bump=0.2, metal=0.25,
                  stripes={'dir': 'Z', 'scale': 30.0, 'distortion': 1.0})
    tm.mat_simple('gp_plank', ['#6a5948', '#7e6b57', '#5a4b3c'], scale=8.0, stripes={'dir': 'X', 'scale': 140.0, 'distortion': 3.0}, bump=0.5)
    tm.mat_mudwall('gp_sail', wash='#d8d0bc', brick='#d9d1bd', brick2='#cbc2ac', mortar='#3a2c20', wash_cover=0.0,
                   bond=(0.03, 0.03, 0.005))
    tm.mat_simple('gp_wheat', ['#8a6a24', '#c29c40', '#ddbb5c', '#a8842e'], scale=60.0, stripes={'dir': 'X', 'scale': 260.0, 'distortion': 14.0}, bump=0.8)
    tm.mat_simple('gp_potato', ['#2c5420', '#3d7029', '#4b8432', '#386426', '#d2c4dc'], scale=90.0, bump=0.7)
    tm.mat_simple('gp_pear', ['#2d4c20', '#41662a', '#537a30', '#3a5a26', '#d4c03c'], scale=70.0, bump=0.6)
    tm.mat_simple('gp_fence', ['#cdc6b6', '#dcd5c6', '#b6ae9e'], scale=14.0, stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 3.0}, bump=0.3)
    tm.mat_simple('gp_clock', ['#e9e2d0', '#f1ece0'], scale=20.0, bump=0.0)
    tm.mat_earth('gp_gravel', colors=('#a89878', '#b8a888', '#9c8c6c', '#c0b294'))
    for n in ('gp_cobble', 'gp_cobble_fringe'):
        tc.mat_paving(n, stone=('#9d988f', '#8a857c', '#aea99f'), mortar='#5c5852', slab=(0.022, 0.018))
    tc.mat_paving('gp_cobble_square', stone=('#b9b2a2', '#aaa393', '#c5beae'), mortar='#7a7468', slab=(0.07, 0.07))
    meadow = ('#8c7a48', '#a48c56', '#6f7c38', '#957f4c')
    tm.mat_earth('gp_meadow', colors=meadow)
    tm.mat_earth('gp_meadow_fringe', colors=meadow)


if not any(n == 'gunpowder' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('gunpowder', make_materials))

COBBLED = dict(mat='gp_cobble', power=8)
HOUSE_H = {1: 0.34, 2: 0.56, 3: 0.78}   # wall heights: 2.6, 4.3 and 6 m storeys raised 1.3x


# ---- small geometry helpers -------------------------------------------------------------------

def _rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


def _t(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation(Vector((x, y, z)))


def quad(ms, mat, f, x, y, z, w, h, lod=0, only=None):
    """A vertical rectangle in local XZ at depth y, facing local -Y, its bottom at z."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((x - w / 2, y, z), (x + w / 2, y, z), (x + w / 2, y, z + h), (x - w / 2, y, z + h))]
    bm.faces.new(vs)
    ms.add(bm, mat, lod, matrix=f, only=only)


def flat(ms, mat, pts, z, lod=1, f=None):
    """A flat polygon (convex or not) lying at height z, facing up."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for x, y in pts]
    face = bm.faces.new(vs)
    face.normal_update()
    if face.normal.z < 0:
        face.normal_flip()
    ms.add(bm, mat, lod, matrix=f if f is not None else Matrix.Identity(4))


def solid(ms, mat, verts, faces, f=None, lod=2, only=None):
    """A closed solid from vertex and face lists (normals recalculated)."""
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for fc in faces:
        bm.faces.new([vs[i] for i in fc])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f if f is not None else Matrix.Identity(4), only=only)


def slab(ms, mat, pts, depth, f=None, axis='Y', lod=2, only=None):
    """A polygon extruded into a closed slab. axis 'Y': pts are (x, z), extruded from y 0 to +depth;
    axis 'X': pts are (y, z), extruded from x 0 to +depth."""
    bm = bmesh.new()
    if axis == 'Y':
        vs = [bm.verts.new((a, 0.0, b)) for a, b in pts]
        vec = (0, depth, 0)
    else:
        vs = [bm.verts.new((0.0, a, b)) for a, b in pts]
        vec = (depth, 0, 0)
    face = bm.faces.new(vs)
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    moved = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=vec, verts=moved)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f if f is not None else Matrix.Identity(4), only=only)


def box_only(ms, mat, size, at, f, only, taper=1.0):
    """A plain box shown only at the listed LODs (a stand-in)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    if taper != 1.0:
        for v in bm.verts:
            if v.co.z > 0.9:
                v.co.x *= taper
                v.co.y *= taper
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    ms.add(bm, mat, max(only), matrix=f @ _t(*at), only=only)


def arch_outline(w, spring, rise, n=8):
    """A door outline with a segmental (elliptic) arched head: [(x, z)...] counter-clockwise."""
    pts = [(-w / 2, 0.0), (w / 2, 0.0)]
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((w / 2 * math.cos(a), spring + rise * math.sin(a)))
    return pts


def arched_door(ms, f, x, y, w, spring, rise, z=G, mat='door', surround='gp_sandstone', lod=1):
    """An arched door in a wall face at local y (facing -Y) with a stone surround."""
    pts = arch_outline(w, spring, rise)
    slab(ms, mat, [(px + x, pz + z) for px, pz in pts], 0.012, f=f @ _t(0, y - 0.01, 0), lod=lod)
    if surround:
        s = 0.022
        pts = arch_outline(w + 2 * s, spring, rise + s)
        slab(ms, surround, [(px + x, pz + z) for px, pz in pts], 0.008, f=f @ _t(0, y - 0.006, 0), lod=0)


def faces_of(f, w, d):
    """Frames on a w x d block's four wall faces (each with the face at local y 0, facing -Y)
    and the face's length: front, back, east, west."""
    return [(f @ _t(0, -d / 2), w, 'front'), (f @ _rz(180) @ _t(0, -d / 2), w, 'back'),
            (f @ _rz(90) @ _t(0, -w / 2), d, 'east'), (f @ _rz(-90) @ _t(0, -w / 2), d, 'west')]


def window(ms, F, x, z, ww=0.056, wh=0.12, shutters=None, glass_lod=1, frame=True):
    """A sash window on a face frame: a sandstone surround, glass with glazing bars, shutters."""
    if frame:
        quad(ms, 'gp_sandstone', F, x, -0.003, z - 0.014, ww + 0.022, wh + 0.026, lod=0)
    quad(ms, 'gp_window', F, x, -0.005, z, ww, wh, lod=glass_lod)
    if shutters:
        sw = ww * 0.5
        for sx in (-1, 1):
            quad(ms, shutters, F, x + sx * (ww / 2 + 0.011 + sw / 2), -0.004, z, sw, wh, lod=0)


def beam(ms, mat, f, p0, p1, t=0.016, lod=1):
    """A square timber from p0 to p1 (local points of frame f)."""
    p0, p1 = Vector(p0), Vector(p1)
    v = p1 - p0
    rot = v.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    ms.box(mat, (t, t, v.length), at=(0, 0, 0), lod=lod, frame=f @ Matrix.Translation(p0) @ rot)


def barrel(ms, f, x, y, s=1.0, z=G):
    ms.cyl('timber', 0.021 * s, 0.021 * s, 0.05 * s, at=(x, y, z), segs=8, lod=0, frame=f)


def flower_pot(ms, f, x, y):
    ms.cyl('terracotta', 0.018, 0.022, 0.026, at=(x, y, G), segs=6, lod=0, frame=f)
    ms.sphere('shrub', 0.03, at=(x, y, G + 0.04), scale=(1, 1, 0.8), u=6, v=4, lod=0, frame=f)


def lamp(ms, x, y, h=0.3):
    """An iron street lamp: a post, a glazed lantern, a cap."""
    ms.cyl('gp_iron', 0.008, 0.006, h, at=(x, y, G), segs=5, lod=1)
    ms.cyl('gp_iron', 0.02, 0.02, 0.012, at=(x, y, G), segs=6, lod=0)
    ms.box('gp_window', (0.03, 0.03, 0.04), at=(x, y, G + h), lod=0)
    ms.cyl('gp_iron', 0.026, 0.0, 0.03, at=(x, y, G + h + 0.04), segs=4, rot=(0, 0, 45), lod=0)


def tree(ms, x, y, h=0.4, r=0.13, mat='leaf', lod2=True):
    """A broadleaf tree: lumpy crown at LOD0, one ball at LOD1, a cone at LOD2."""
    ms.cyl('timber', 0.016, 0.011, h * 0.5, at=(x, y, G), segs=5, lod=1)
    zc = G + h - r * 0.85
    ms.sphere(mat, r, at=(x, y, zc), scale=(1, 1, 0.85), u=8, v=5, lod=0)
    for k in range(3):
        a = 2.1 * k + x * 3.0
        ms.sphere(mat, r * 0.62, at=(x + r * 0.55 * math.cos(a), y + r * 0.55 * math.sin(a), zc - r * 0.15), u=6, v=4, lod=0)
    ms.sphere(mat, r, at=(x, y, zc), scale=(1, 1, 0.85), u=6, v=4, lod=1, only=1)
    if lod2:
        ms.cyl(mat, r, r * 0.3, r * 1.6, at=(x, y, zc - r * 0.8), segs=5, lod=2, only=2)


def cannon(ms, f, x, y, z, yaw, s=1.0, lod=0):
    """A cannon on a timber carriage, its muzzle toward local -Y of yaw."""
    cf = f @ tm.house_frame(x, y, yaw) @ _t(0, 0, z)
    ms.box('timber', (0.05 * s, 0.11 * s, 0.026 * s), at=(0, 0.012 * s, 0.01 * s), lod=lod, frame=cf)
    for sx in (-1, 1):
        ms.cyl('timber', 0.026 * s, 0.026 * s, 0.012 * s, at=(0.025 * s if sx > 0 else -0.037 * s, -0.02 * s, 0.026 * s),
               rot=(0, 90, 0), segs=8, lod=0, frame=cf)
    ms.cyl('gp_iron', 0.015 * s, 0.01 * s, 0.14 * s, at=(0, 0.045 * s, 0.045 * s), rot=(90, 0, 0), segs=8, lod=lod, frame=cf)


# ---- roofs --------------------------------------------------------------------------------------

def gable(ms, f, w, d, z0, rise, mat='gp_tile', wall='gp_stucco', over=0.03, lod=2):
    """A gable roof, ridge along local X: two slabs and the wall-coloured gables (LOD0, LOD1), a
    closed prism at LOD2."""
    tc.gable_roof(ms, f, w, d, z0, rise, over=over, mat=mat, gable=wall, thick=0.02, lod=1, ridge=mat)
    if lod >= 2:
        W, D = w / 2 + over, d / 2 + over
        ze = z0 - over * rise / (d / 2)
        solid(ms, mat, [(-W, -D, ze), (W, -D, ze), (W, D, ze), (-W, D, ze), (-W, 0, z0 + rise), (W, 0, z0 + rise)],
              [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (3, 2, 1, 0)], f=f, lod=2, only=2)


def hip(ms, f, w, d, z0, rise, mat='gp_tile', over=0.03, lod=2, only=None):
    """A hip roof over a w x d block as one closed solid (a pyramid when square)."""
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - over * 0.5
    c = [(-W, -D, ze), (W, -D, ze), (W, D, ze), (-W, D, ze)]
    top = z0 + rise
    if abs(W - D) < 1e-4:
        solid(ms, mat, c + [(0, 0, top)], [(0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4), (3, 2, 1, 0)], f=f, lod=lod, only=only)
    elif W > D:
        r = W - D
        solid(ms, mat, c + [(-r, 0, top), (r, 0, top)], [(0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (3, 2, 1, 0)],
              f=f, lod=lod, only=only)
    else:
        r = D - W
        solid(ms, mat, c + [(0, -r, top), (0, r, top)], [(3, 0, 4, 5), (1, 2, 5, 4), (0, 1, 4), (2, 3, 5), (3, 2, 1, 0)],
              f=f, lod=lod, only=only)


def mansard(ms, f, w, d, z0, low, rise, inset=0.07, mat='gp_slate', over=0.025, lod=2, curb='gp_sandstone'):
    """A mansard: a steep lower slope (`low` high, drawing in by `inset`) under a low hip."""
    W, D = w / 2 + over, d / 2 + over
    Wi, Di = W - inset - over, D - inset - over
    zb = z0 + low
    c = [(-W, -D, z0 - 0.006), (W, -D, z0 - 0.006), (W, D, z0 - 0.006), (-W, D, z0 - 0.006)]
    b = [(-Wi, -Di, zb), (Wi, -Di, zb), (Wi, Di, zb), (-Wi, Di, zb)]
    faces = [(0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7), (3, 2, 1, 0)]
    top = zb + rise
    if Wi >= Di:
        r = Wi - Di
        v = c + b + [(-r, 0, top), (r, 0, top)]
        faces += [(4, 5, 9, 8), (6, 7, 8, 9), (5, 6, 9), (7, 4, 8)]
    else:
        r = Di - Wi
        v = c + b + [(0, -r, top), (0, r, top)]
        faces += [(7, 4, 8, 9), (5, 6, 9, 8), (4, 5, 8), (6, 7, 9)]
    solid(ms, mat, v, faces, f=f, lod=lod)
    if curb:  # the light trim along the break of the slope
        ms.box(curb, (2 * Wi + 0.012, 2 * Di + 0.012, 0.012), at=(0, 0, zb - 0.006), lod=0, frame=f)


def dormer(ms, f, x, y, z, w=0.085, h=0.1, depth=0.14, mat='gp_slate', cheek=None):
    """A dormer whose front is at local y (facing -Y): a cheek box, a small gable cap, a window."""
    ms.box(cheek or mat, (w, depth, h), at=(x, y + depth / 2, z), lod=1, frame=f)
    W, rz = w / 2 + 0.012, z + h
    solid(ms, mat, [(x - W, y - 0.012, rz), (x + W, y - 0.012, rz), (x + W, y + depth, rz), (x - W, y + depth, rz),
                    (x, y - 0.012, rz + h * 0.5), (x, y + depth, rz + h * 0.5)],
          [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5), (3, 2, 1, 0)], f=f, lod=0)
    quad(ms, 'gp_sandstone', f, x, y - 0.002, z + 0.012, w * 0.8, h * 0.8, lod=0)
    quad(ms, 'gp_window', f, x, y - 0.004, z + 0.02, w * 0.56, h * 0.62, lod=1)


def chimney(ms, f, x, y, z0, h, w=0.055, d=0.075):
    ms.box('gp_brick', (w, d, h), at=(x, y, z0), lod=1, frame=f)
    ms.box('gp_sandstone', (w + 0.014, d + 0.014, 0.014), at=(x, y, z0 + h), lod=0, frame=f)
    for k in (-1, 1):
        ms.cyl('terracotta', 0.009, 0.008, 0.025, at=(x, y + k * d * 0.22, z0 + h + 0.014), segs=5, lod=0, frame=f)


# ---- the house ----------------------------------------------------------------------------------

def gp_house(ms, rng, x, y, w, d, yaw=None, wall='gp_brick', roof='gp_tile', kind='gable', storeys=2, h=None, rise=None,
             shutters='gp_shutter_brown', chimneys=2, dormers=0, awning=None, door=True, door_x=None, props=2,
             gable_front=False, quoins=True, back_windows=True, side_windows=True, pots=0):
    """A Gunpowder Age house: a sandstone plinth, brick or cream stucco walls with sandstone quoins,
    string courses and a cornice, sash windows (shutters), a door with a stone surround and step,
    a gable, hip or mansard roof (tile or slate) with dormers and brick chimneys."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = h or HOUSE_H[storeys]
    sh = h / storeys
    ms.box('gp_sandstone', (w + 0.014, d + 0.014, 0.045), at=(0, 0, G), lod=0, frame=f)
    ms.box(wall, (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    if quoins:
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.box('gp_sandstone', (0.03, 0.03, h - 0.02), at=(sx * (w / 2 - 0.012), sy * (d / 2 - 0.012), G), lod=0, frame=f)
    for k in range(1, storeys):
        ms.box('gp_sandstone', (w + 0.01, d + 0.01, 0.013), at=(0, 0, G + sh * k - 0.006), lod=0, frame=f)
    ms.box('gp_sandstone', (w + 0.02, d + 0.02, 0.02), at=(0, 0, G + h - 0.02), lod=1, frame=f)
    # windows on every face; the door on the front
    n_front = max(1, int(round(w / 0.19)))
    slots = [-w / 2 + w * (i + 0.5) / n_front for i in range(n_front)]
    if door and door_x is None:
        door_x = slots[n_front // 2] if n_front % 2 else slots[n_front // 2] + rng.choice((-1, 1)) * w / n_front / 2
    wh = min(0.15, sh * 0.48)
    for F, length, side in faces_of(f, w, d):
        if side == 'back' and not back_windows:
            continue
        if side in ('east', 'west') and not side_windows:
            continue
        n = n_front if side in ('front', 'back') else max(1, int(round(length / 0.26)))
        xs = slots if side in ('front', 'back') else [-length / 2 + length * (i + 0.5) / n for i in range(n)]
        for k in range(storeys):
            zw = G + sh * k + sh * 0.3
            for wx in xs:
                if side == 'front' and k == 0 and door and abs(wx - door_x) < 0.08:
                    continue
                window(ms, F, wx, zw, wh=wh, shutters=shutters if side == 'front' else None,
                       glass_lod=1 if side in ('front', 'back') or n == 1 else 0)
    if door:
        F = faces_of(f, w, d)[0][0]
        dh = min(0.2, sh * 0.72)
        ms.box('door', (0.075, 0.012, dh), at=(door_x, -0.004, G + 0.03), lod=1, frame=F)
        quad(ms, 'gp_sandstone', F, door_x, -0.003, G + 0.03, 0.105, dh + 0.025, lod=0)
        ms.box('gp_sandstone', (0.12, 0.05, 0.03), at=(door_x, -0.022, G), lod=0, frame=F)
    # the roof
    zt = G + h
    if kind == 'gable':
        rise = rise or 0.2
        rf = f @ _rz(90) if gable_front else f
        rw, rd = (d, w) if gable_front else (w, d)
        gable(ms, rf, rw, rd, zt, rise, mat=roof, wall=wall)
        ch_pos = [(sx * (rw / 2 - 0.07), 0.0) for sx in (-1, 1)][:chimneys]
        for cx, cy in ch_pos:
            chimney(ms, rf, cx, cy + 0.03, zt, rise + 0.06)
    elif kind == 'hip':
        rise = rise or 0.18
        hip(ms, f, w, d, zt, rise, mat=roof)
        for k in range(chimneys):
            chimney(ms, f, (-1 if k == 0 else 1) * w * 0.22, d * 0.12, zt, rise + 0.04)
        for k in range(dormers):
            dx = -w / 2 + w * (k + 0.5) / dormers
            dormer(ms, f, dx, -d / 2 + 0.05, zt - 0.01, mat=roof)
    elif kind == 'mansard':
        rise = rise or 0.07
        low = 0.15
        mansard(ms, f, w, d, zt, low, rise, mat=roof)
        for k in range(chimneys):
            chimney(ms, f, (-1 if k == 0 else 1) * (w / 2 - 0.1), 0.0, zt, low + rise + 0.03)
        for k in range(dormers):
            dx = -w / 2 + w * (k + 0.5) / dormers
            dormer(ms, f, dx, -d / 2 + 0.012, zt + 0.01, h=0.1, mat=roof, cheek='gp_sandstone')
    if awning:
        tc.awning(ms, f, awning[0], -d / 2 - 0.006, awning[1], depth=0.17, z=min(0.26, sh * 0.85))
    for k in range(props):
        px = rng.uniform(-w / 2 + 0.05, w / 2 - 0.05)
        if door and abs(px - door_x) < 0.08:
            continue
        r = rng.random()
        if r < 0.45:
            barrel(ms, f, px, -d / 2 - 0.035, rng.uniform(0.9, 1.15))
        elif r < 0.7:
            tt.crate(ms, f, px, -d / 2 - 0.04, rng.uniform(0.8, 1.0), rng.uniform(-15, 15))
        else:
            ms.box('timber', (0.12, 0.035, 0.03), at=(px, -d / 2 - 0.03, G), lod=0, frame=f)  # a bench
    for k in range(pots):
        flower_pot(ms, f, rng.uniform(-w / 2 + 0.04, w / 2 - 0.04), -d / 2 - 0.03)
    return f


def styled(ms, rng, x, y, w, d, yaw=None, palette='a', storeys=None, **kw):
    """A house in one of the age's looks, picked by the rng (variant a: brown shutters, more tile
    gables and mansards; variant b: green shutters, more brick and hip roofs with dormers)."""
    a = palette == 'a'
    wall = rng.choice(['gp_brick', 'gp_stucco', 'gp_stucco'] if a else ['gp_brick', 'gp_brick', 'gp_stucco'])
    roof = rng.choice(['gp_tile', 'gp_tile', 'gp_slate'] if a else ['gp_tile', 'gp_slate'])
    kinds = ['gable', 'gable', 'hip', 'mansard'] if a else ['hip', 'hip', 'gable', 'mansard']
    kind = kw.pop('kind', None) or rng.choice(kinds)
    if kind == 'mansard':
        roof = 'gp_slate'
    if storeys is None:
        storeys = rng.choice([2, 2, 3])
    dormers = kw.pop('dormers', None)
    if dormers is None:
        dormers = 0 if kind == 'gable' else max(1, int(w / 0.3))
    return gp_house(ms, rng, x, y, w, d, yaw=yaw, wall=wall, roof=roof, kind=kind, storeys=storeys,
                    shutters=kw.pop('shutters', 'gp_shutter_brown' if a else 'gp_shutter'), dormers=dormers,
                    gable_front=kw.pop('gable_front', kind == 'gable' and rng.random() < 0.3),
                    rise=kw.pop('rise', rng.uniform(0.18, 0.24) if kind == 'gable' else None), **kw)


# ---- landmarks ----------------------------------------------------------------------------------

def clock_face(ms, F, z, r):
    """A clock on a face frame: a stone ring, a white dial, two hands."""
    ms.cyl('gp_sandstone', r * 1.18, r * 1.18, 0.006, at=(0, 0.0, z), rot=(90, 0, 0), segs=12, lod=0, frame=F)
    ms.cyl('gp_clock', r, r, 0.012, at=(0, 0.0, z), rot=(90, 0, 0), segs=12, lod=1, frame=F)
    ms.box('dark', (0.008, 0.004, r * 0.75), at=(0, -0.014, z), lod=0, frame=F)
    hf = F @ _t(0, -0.014, z) @ Matrix.Rotation(math.radians(-60), 4, 'Y')
    ms.box('dark', (0.008, 0.004, r * 0.55), at=(0, 0, 0), lod=0, frame=hf)


def tower_top(ms, f, w, z, top, cap='gp_slate', belfry='gp_sandstone', bulb=True):
    """A belfry with arched openings on a cornice, an ogee cap, a lantern, a dome and a finial
    rising from z (the tower's cornice) to `top`."""
    span = top - z
    bw = w * 0.82
    bh = span * 0.24
    ms.box(belfry, (bw, bw, bh), at=(0, 0, z), lod=2, frame=f)
    for F, length, _s in faces_of(f, bw, bw):
        slab(ms, 'dark', [(px, pz + z + bh * 0.18) for px, pz in arch_outline(bw * 0.42, bh * 0.42, bh * 0.2, 6)], 0.008,
             f=F @ _t(0, -0.004, 0), lod=1)
    ms.box('gp_sandstone', (bw + 0.03, bw + 0.03, 0.02), at=(0, 0, z + bh), lod=1, frame=f)
    zc = z + bh + 0.02
    ch = span * 0.3
    r0 = bw * 0.62
    if bulb:
        ms.lathe(cap, [(r0, zc), (r0 * 0.95, zc + ch * 0.3), (r0 * 0.72, zc + ch * 0.62), (r0 * 0.36, zc + ch * 0.9), (0.03, zc + ch)],
                 segs=8, lod=0, frame=f @ _rz(22.5))
        ms.cyl(cap, r0 * 0.9, 0.03, ch, at=(0, 0, zc), segs=8, lod=2, only=(1, 2), frame=f @ _rz(22.5))
    else:
        ms.cyl(cap, r0 * 1.05, 0.02, ch, at=(0, 0, zc), segs=4, rot=(0, 0, 45), lod=2, frame=f)
    zl = zc + ch * 0.92
    lh = span * 0.18
    ms.cyl('gp_sandstone', 0.035, 0.035, lh, at=(0, 0, zl), segs=8, lod=1, frame=f)
    ms.sphere(cap, 0.045, at=(0, 0, zl + lh), scale=(1, 1, 1.2), u=8, v=5, lod=0, frame=f, cut_below=0.0)
    ms.cyl('gp_iron', 0.006, 0.003, top - (zl + lh), at=(0, 0, zl + lh), segs=5, lod=1, frame=f)
    ms.sphere('bronze', 0.014, at=(0, 0, zl + lh + 0.06), u=6, v=4, lod=0, frame=f)


def clock_tower(ms, f, top, w=0.24, body='gp_sandstone', cap='gp_slate', shaft=0.62, door=True, clock_r=None):
    """A square clock tower in frame f (base at G): quoins, bands, an arched door, slit windows,
    clocks on four faces under the cornice, the belfry and its cap up to `top`."""
    sh = (top - G) * shaft
    ms.box(body, (w, w, sh), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    if body != 'gp_sandstone':
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.box('gp_sandstone', (0.034, 0.034, sh - 0.02), at=(sx * (w / 2 - 0.013), sy * (w / 2 - 0.013), G), lod=0, frame=f)
    for k in (0.36, 0.7):
        ms.box('gp_sandstone', (w + 0.012, w + 0.012, 0.016), at=(0, 0, G + sh * k), lod=0, frame=f)
    ms.box('gp_sandstone', (w + 0.034, w + 0.034, 0.03), at=(0, 0, G + sh - 0.01), lod=1, frame=f)
    r = clock_r or w * 0.3
    for F, length, side in faces_of(f, w, w):
        clock_face(ms, F, G + sh - 0.03 - r * 1.25, r)
        if side != 'front' or not door:
            window(ms, F, 0, G + sh * 0.42, ww=0.04, wh=min(0.12, sh * 0.18), glass_lod=0)
    if door:
        arched_door(ms, faces_of(f, w, w)[0][0], 0, 0, 0.09, min(0.15, sh * 0.25), 0.045)
    tower_top(ms, f, w, G + sh + 0.02, top, cap=cap)


def town_hall(ms, rng, x, y, w, d, top, yaw=0, wall='gp_brick', roof='gp_slate', storeys=3, kind='mansard', tw=0.3, shaft=0.58,
              h=None):
    """A town hall: a brick block with sandstone dressings and a mansard or hip roof with dormers,
    a clock tower rising from the middle of its front to `top`."""
    f = gp_house(ms, rng, x, y, w, d, yaw=yaw, wall=wall, roof=roof, kind=kind, storeys=storeys, shutters=None,
                 chimneys=2, dormers=max(2, int(w / 0.28)), door=False, props=0, rise=0.12 if kind == 'mansard' else 0.22, h=h)
    tf = f @ _t(0, -d / 2 + tw * 0.35, 0)
    clock_tower(ms, tf, top, w=tw, body=wall, shaft=shaft)
    for k in range(4):
        if k % 2:
            tt.crate(ms, f, -w / 2 + 0.1 + 0.05 * k, -d / 2 - 0.05, 0.9, rng.uniform(-15, 15))
        else:
            barrel(ms, f, -w / 2 + 0.1 + 0.05 * k, -d / 2 - 0.05)
    return f


def pediment(ms, f, x, y, z, w, rise, depth=0.03, mat='gp_sandstone', lod=1):
    """A triangular pediment slab on a face at local y (facing -Y), its base at z."""
    slab(ms, mat, [(x - w / 2, z), (x + w / 2, z), (x, z + rise)], depth, f=f @ _t(0, y, 0), lod=lod)


def facade_pilasters(ms, F, xs, z, h, w=0.03, mat='gp_sandstone'):
    for px in xs:
        ms.box(mat, (w, 0.014, h), at=(px, -0.004, z), lod=0, frame=F)


def dome(ms, f, x, y, z, r, rz, drum_h, mat='gp_lead', drum='gp_stucco', lantern=0.12, top=None, windows=8):
    """A drum with windows and pilasters, a dome, a lantern with a small cap and a cross."""
    ms.cyl(drum, r, r, drum_h, at=(x, y, z), segs=16, lod=1, frame=f)
    ms.cyl(drum, r, r, drum_h, at=(x, y, z), segs=8, lod=2, only=2, frame=f)
    ms.cyl('gp_sandstone', r + 0.018, r + 0.018, 0.02, at=(x, y, z + drum_h - 0.01), segs=16, lod=0, frame=f)
    for k in range(windows):
        a = 360.0 * k / windows
        F = f @ _t(x, y, 0) @ _rz(a) @ _t(0, -r, 0)
        quad(ms, 'gp_window', F, 0, -0.004, z + drum_h * 0.3, 0.05, drum_h * 0.45, lod=0)
        ms.box('gp_sandstone', (0.022, 0.016, drum_h * 0.9), at=(0, 0.002, z), lod=0, frame=F @ _rz(360.0 / windows / 2))
    zd = z + drum_h
    ms.sphere(mat, r, at=(x, y, zd), scale=(1, 1, rz / r), u=16, v=8, lod=0, frame=f, cut_below=0.0)
    ms.sphere(mat, r, at=(x, y, zd), scale=(1, 1, rz / r), u=10, v=6, lod=1, only=1, frame=f, cut_below=0.0)
    ms.cyl(mat, r, r * 0.25, rz * 0.95, at=(x, y, zd), segs=8, lod=2, only=2, frame=f)
    for k in range(8):  # ribs
        a = 360.0 * k / 8
        rf = f @ _t(x, y, zd) @ _rz(a)
        for j in range(3):
            t0, t1 = j / 3 * 0.5 * math.pi, (j + 1) / 3 * 0.5 * math.pi
            p0 = Vector((r * math.cos(t0) * 1.01, 0, rz * math.sin(t0)))
            p1 = Vector((r * math.cos(t1) * 1.01, 0, rz * math.sin(t1)))
            seg = p1 - p0
            ang = math.atan2(seg.x, seg.z)
            ms.box('gp_sandstone', (0.014, 0.014, seg.length), at=(0, 0, 0), lod=0,
                   frame=rf @ _t(p0.x, 0, p0.z) @ Matrix.Rotation(ang, 4, 'Y'))
    zl = zd + rz * 0.92
    lr = max(0.035, r * 0.18)
    ms.cyl('gp_sandstone', lr, lr, lantern, at=(x, y, zl), segs=8, lod=1, frame=f)
    for k in range(4):
        F = f @ _t(x, y, 0) @ _rz(90 * k) @ _t(0, -lr, 0)
        quad(ms, 'dark', F, 0, -0.003, zl + lantern * 0.25, lr * 0.7, lantern * 0.5, lod=0)
    ms.sphere(mat, lr * 1.15, at=(x, y, zl + lantern), scale=(1, 1, 1.1), u=8, v=5, lod=0, frame=f, cut_below=0.0)
    zt = zl + lantern + lr * 1.1
    top = top or zt + 0.1
    ms.cyl('gp_iron', 0.006, 0.006, top - zt, at=(x, y, zt), segs=5, lod=1, frame=f)
    ms.box('gp_iron', (0.05, 0.008, 0.008), at=(x, y, top - 0.04), lod=0, frame=f)


def domed_church(ms, rng, x, y, top, w=0.62, length=1.0, yaw=0):
    """A baroque church: a cream nave under a slate gable, a sandstone front with pilasters, a
    pediment, an arched door and an oculus, low side chapels, and over the crossing at the back a
    drum and a lead dome with a lantern and cross reaching `top`."""
    f = tm.house_frame(x, y, yaw)
    s = top - G
    nh = s * 0.3
    yc = length * 0.18           # the crossing's centre (toward the back)
    nave_len = length * 0.62
    ny = -length / 2 + nave_len / 2
    ms.box('gp_sandstone', (w + 0.02, length + 0.02, 0.04), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_stucco', (w, nave_len, nh), at=(0, ny, G), lod=2, frame=f, bevel=0.004)
    gable(ms, f @ _t(0, ny, 0) @ _rz(90), nave_len, w, G + nh, w * 0.32, mat='gp_slate', wall='gp_stucco', over=0.02)
    # side chapels
    for sx in (-1, 1):
        cf = f @ _t(sx * (w / 2 + 0.1), ny + nave_len * 0.1, 0)
        ms.box('gp_stucco', (0.2, nave_len * 0.6, nh * 0.6), at=(0, 0, G), lod=2, frame=cf)
        hip(ms, cf, 0.2, nave_len * 0.6, G + nh * 0.6, 0.08, mat='gp_slate', over=0.015)
        for k in range(2):
            window(ms, cf @ _rz(sx * 90) @ _t(0, -0.1, 0), (k - 0.5) * nave_len * 0.25, G + nh * 0.2, ww=0.05, wh=nh * 0.25, glass_lod=0)
    for k in range(3):
        for sx in (-1, 1):
            F = f @ _rz(sx * 90) @ _t(0, -w / 2, 0)
            window(ms, F, sx * (ny - nave_len * 0.3 + k * nave_len * 0.3), G + nh * 0.62, ww=0.05, wh=nh * 0.26, glass_lod=0)
    # the crossing block, drum, dome
    cw = w * 1.1
    ch = s * 0.42
    ms.box('gp_stucco', (cw, cw, ch), at=(0, yc, G), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('gp_sandstone', (0.04, 0.04, ch - 0.02), at=(sx * (cw / 2 - 0.016), yc + sy * (cw / 2 - 0.016), G), lod=0, frame=f)
    ms.box('gp_sandstone', (cw + 0.03, cw + 0.03, 0.03), at=(0, yc, G + ch - 0.015), lod=1, frame=f)
    hip(ms, f @ _t(0, yc, 0), cw, cw, G + ch, 0.06, mat='gp_slate', over=0.015)
    for F, length_, side in faces_of(f @ _t(0, yc, 0), cw, cw):
        if side == 'front':
            continue
        window(ms, F, 0, G + ch * 0.55, ww=0.07, wh=ch * 0.25, glass_lod=0)
    for sx in (-1, 1):  # small corner pinnacles (urns) round the drum's base
        for sy in (-1, 1):
            ms.cyl('gp_sandstone', 0.02, 0.012, 0.06, at=(sx * cw * 0.4, yc + sy * cw * 0.4, G + ch + 0.02), segs=6, lod=0, frame=f)
    r = cw * 0.42
    drum_h = s * 0.13
    rz = s * 0.2
    dome(ms, f, 0, yc, G + ch + 0.04, r, rz, drum_h, top=top, lantern=s * 0.09)
    # the front: a sandstone frontispiece with pilasters, entablature, pediment, door, oculus
    fy = -length / 2
    fw = w + 0.06
    fh = nh + s * 0.08
    ms.box('gp_sandstone', (fw, 0.07, fh), at=(0, fy + 0.03, G), lod=2, frame=f, bevel=0.004)
    F = f @ _t(0, fy - 0.005, 0)
    facade_pilasters(ms, F, [-fw * 0.42, -fw * 0.17, fw * 0.17, fw * 0.42], G + 0.04, fh - 0.06)
    ms.box('gp_sandstone', (fw + 0.03, 0.09, 0.03), at=(0, fy + 0.03, G + fh - 0.03), lod=1, frame=f)
    pediment(ms, f, 0, fy - 0.012, G + fh, fw + 0.02, w * 0.3, depth=0.08)
    arched_door(ms, F, 0, 0, 0.12, nh * 0.42, 0.05)
    ms.cyl('dark', 0.05, 0.05, 0.01, at=(0, -0.006, G + fh * 0.7), rot=(90, 0, 0), segs=10, lod=1, frame=F)
    ms.cyl('gp_sandstone', 0.066, 0.066, 0.006, at=(0, -0.0, G + fh * 0.7), rot=(90, 0, 0), segs=10, lod=0, frame=F)
    for sx in (-1, 1):
        window(ms, F, sx * fw * 0.3, G + fh * 0.38, ww=0.05, wh=nh * 0.26, glass_lod=0)
        ms.cyl('gp_sandstone', 0.024, 0.014, 0.08, at=(sx * fw * 0.45, fy + 0.03, G + fh), segs=6, lod=0, frame=f)
    for k in range(4):  # steps
        ms.box('gp_sandstone', (fw * 0.6 - k * 0.03, 0.035, 0.012 * (4 - k)), at=(0, fy - 0.03 - 0.03 * (3 - k) + 0.02, G), lod=0, frame=f)
    ms.cyl('gp_iron', 0.004, 0.004, 0.08, at=(0, fy + 0.02, G + fh + w * 0.3 - 0.01), segs=4, lod=0, frame=f)
    ms.box('gp_iron', (0.04, 0.006, 0.006), at=(0, fy + 0.02, G + fh + w * 0.3 + 0.045), lod=0, frame=f)
    return f


def twin_church(ms, rng, x, y, top, w=0.66, length=1.5, yaw=0, tw=0.26):
    """A twin-tower baroque church: a long nave under a slate roof with a transept, a sandstone
    west front between two towers with lantern caps reaching `top`, a pediment, door, windows."""
    f = tm.house_frame(x, y, yaw)
    s = top - G
    nh = s * 0.22
    ms.box('gp_sandstone', (w + 0.02, length + 0.02, 0.04), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_stucco', (w, length, nh), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    gable(ms, f @ _rz(90), length, w, G + nh, w * 0.42, mat='gp_slate', wall='gp_stucco', over=0.025)
    for k in range(5):
        for sx in (-1, 1):
            F = f @ _rz(sx * 90) @ _t(0, -w / 2, 0)
            window(ms, F, sx * (-length * 0.38 + k * length * 0.17), G + nh * 0.35, ww=0.055, wh=nh * 0.45, glass_lod=0)
            ms.box('gp_sandstone', (0.06, 0.05, nh * 0.85), at=(sx * (w / 2 + 0.01), -length * 0.46 + k * length * 0.17 + length * 0.085, G), lod=0, frame=f)
    # the transept with a crossing turret
    ty = length * 0.22
    ms.box('gp_stucco', (w + 0.36, 0.34, nh * 1.02), at=(0, ty, G), lod=2, frame=f)
    gable(ms, f @ _t(0, ty, 0), w + 0.36, 0.34, G + nh * 1.02, w * 0.36, mat='gp_slate', wall='gp_stucco', over=0.02)
    ms.box('gp_sandstone', (0.14, 0.14, 0.12), at=(0, ty, G + nh + w * 0.3), lod=1, frame=f)
    ms.cyl('gp_slate', 0.1, 0.0, s * 0.18, at=(0, ty, G + nh + w * 0.3 + 0.12), segs=4, rot=(0, 0, 45), lod=1, frame=f)
    # the front between the towers
    fy = -length / 2
    fw = w - 0.04
    fh = nh + s * 0.14
    ms.box('gp_sandstone', (fw, 0.08, fh), at=(0, fy + 0.03, G), lod=2, frame=f)
    F = f @ _t(0, fy - 0.01, 0)
    facade_pilasters(ms, F, [-fw * 0.3, fw * 0.3], G + 0.04, fh - 0.06)
    ms.box('gp_sandstone', (fw + 0.03, 0.1, 0.03), at=(0, fy + 0.03, G + fh - 0.03), lod=1, frame=f)
    pediment(ms, f, 0, fy - 0.014, G + fh, fw * 0.9, fw * 0.28, depth=0.09)
    arched_door(ms, F, 0, 0, 0.13, nh * 0.55, 0.06)
    slab(ms, 'gp_window', [(px, pz + G + nh * 1.05) for px, pz in arch_outline(0.09, 0.12, 0.045, 6)], 0.008, f=F @ _t(0, -0.006, 0), lod=1)
    ms.cyl('dark', 0.04, 0.04, 0.01, at=(0, -0.006, G + fh - 0.1), rot=(90, 0, 0), segs=10, lod=0, frame=F)
    for sx in (-1, 1):
        tf = f @ _t(sx * (w / 2 - tw / 2 + 0.03), fy + tw / 2 - 0.04, 0)
        clock_tower(ms, tf, top, w=tw, body='gp_sandstone', cap='gp_slate', shaft=0.55, door=False, clock_r=tw * 0.22)
    for k in range(4):
        ms.box('gp_sandstone', (fw * 0.7 - k * 0.03, 0.035, 0.012 * (4 - k)), at=(0, fy - 0.04 - 0.03 * (3 - k) + 0.02, G), lod=0, frame=f)
    return f


def windmill(ms, x, y, top, yaw=0, r=0.2, sail_angle=45):
    """A post mill: a round stone base, a dark timber body with a gable roof on a post, a tail
    pole with steps, four lattice sails (an X) on the front reaching `top`."""
    f = tm.house_frame(x, y, yaw)
    s = top - G
    bh = s * 0.3
    ms.cyl('gp_sandstone', r, r * 0.86, bh, at=(0, 0, G), segs=14, lod=1, frame=f)
    ms.cyl('gp_sandstone', r, r * 0.86, bh, at=(0, 0, G), segs=7, lod=2, only=2, frame=f)
    ms.cyl('gp_scarp', r * 0.9, r * 0.9, 0.02, at=(0, 0, G + bh), segs=14, lod=0, frame=f)
    ms.box('door', (0.07, 0.012, 0.13), at=(0, -r * 0.93, G), lod=0, frame=f)
    ms.cyl('timber', 0.03, 0.03, 0.06, at=(0, 0, G + bh), segs=6, lod=1, frame=f)
    bz = G + bh + 0.05
    bw, bd, bhh = r * 1.15, r * 1.45, s * 0.28
    ms.box('timber', (bw, bd, bhh), at=(0, 0, bz), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for k in range(3):
            ms.box('gp_plank', (0.006, bd * 0.95, 0.012), at=(sx * (bw / 2 + 0.002), 0, bz + bhh * (0.2 + 0.3 * k)), lod=0, frame=f)
    gable(ms, f @ _rz(90), bd, bw, bz + bhh, bw * 0.35, mat='gp_plank', wall='timber', over=0.02)
    quad(ms, 'dark', f @ _t(0, -bd / 2, 0), 0, -0.004, bz + bhh * 0.45, 0.05, 0.06, lod=0)
    # tail pole and steps at the back
    beam(ms, 'timber', f, (0, bd / 2 - 0.02, bz + 0.04), (0, bd / 2 + bh * 1.1, G), t=0.02, lod=1)
    st = (0, bd / 2 + 0.02, bz), (0, bd / 2 + bh * 0.75, G)
    beam(ms, 'timber', f @ _t(-0.03, 0, 0), st[0], st[1], t=0.012, lod=0)
    beam(ms, 'timber', f @ _t(0.03, 0, 0), st[0], st[1], t=0.012, lod=0)
    for k in range(1, 6):
        t = k / 6
        ms.box('timber', (0.07, 0.016, 0.006), at=(0, st[0][1] + (st[1][1] - st[0][1]) * t, st[0][2] + (st[1][2] - st[0][2]) * t), lod=0, frame=f)
    # the sails: an X whose upper tips reach `top`
    zh = bz + bhh * 0.7
    hy = -bd / 2 - 0.04
    ms.cyl('timber', 0.026, 0.022, 0.05, at=(0, -bd / 2 + 0.01, zh), rot=(90, 0, 0), segs=8, lod=1, frame=f)
    c = abs(math.cos(math.radians(sail_angle)))
    L = min((top - zh - 0.005) / c, (zh - G - 0.03) / c)
    for k in range(4):
        a = sail_angle + 90 * k
        sf = f @ _t(0, hy, zh) @ Matrix.Rotation(math.radians(a), 4, 'Y')
        ms.box('timber', (0.016, 0.016, L), at=(0, 0, 0), lod=1, frame=sf)
        ms.box('gp_sail', (L * 0.2, 0.006, L * 0.78), at=(L * 0.1 + 0.008, 0.004, L * 0.2), lod=1, frame=sf)
        for j in range(4):
            ms.box('timber', (L * 0.22, 0.008, 0.008), at=(L * 0.1 + 0.008, -0.002, L * (0.22 + 0.25 * j)), lod=0, frame=sf)
    return f


def stall(ms, rng, x, y, yaw=None, w=0.34, d=0.28):
    """A market stall under a team-grey awning with barrels and crates of goods."""
    tb.stall(ms, x, y, rng, yaw=yaw, cloth='team_cloth', w=w, d=d)


def well(ms, x, y, yaw=15, roof='gp_tile'):
    """The town well with a small tiled roof on its posts."""
    f = tt.well(ms, x, y, yaw=yaw)
    tc.gable_roof(ms, f @ _rz(90) @ _t(0, 0, 0), 0.22, 0.34, G + 0.235, 0.1, over=0.02, mat=roof, gable='timber', thick=0.016,
                  lod=0, ridge=roof)
    return f


def garden(ms, pts, lod=1):
    """A patch of turf (a garden or verge) on the town ground."""
    flat(ms, 'gp_turf', pts, G + 0.003, lod=lod)


# ---- bastions and wall traces -------------------------------------------------------------------

def _inset(poly, d):
    """Miter-inset a counter-clockwise convex polygon by d (negative d grows it)."""
    out = []
    n = len(poly)
    for i in range(n):
        p0, p1, p2 = poly[i - 1], poly[i], poly[(i + 1) % n]

        def nrm(a, b):
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy)
            return (-dy / L, dx / L)
        n1, n2 = nrm(p0, p1), nrm(p1, p2)
        bx, by = n1[0] + n2[0], n1[1] + n2[1]
        bl = math.hypot(bx, by)
        bx, by = bx / bl, by / bl
        k = d / max(0.25, n1[0] * bx + n1[1] * by)
        out.append((p1[0] + bx * k, p1[1] + by * k))
    return out


def _ccw(poly):
    cx = sum(p[0] for p in poly) / len(poly)
    cy = sum(p[1] for p in poly) / len(poly)
    return sorted(poly, key=lambda p: math.atan2(p[1] - cy, p[0] - cx))


def frustum(ms, mat, base, top, z0, z1, lod=2, only=None):
    """A closed solid from polygon `base` at z0 to polygon `top` (same count) at z1."""
    n = len(base)
    verts = [(x, y, z0) for x, y in base] + [(x, y, z1) for x, y in top]
    faces = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    faces += [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
    solid(ms, mat, verts, faces, lod=lod, only=only)


def bastion(ms, rng, poly, H, Hs, bat=0.07, gun=None, sentry=False, platform=True, fringe=True, open_edges=1):
    """An angled bastion on a counter-clockwise plan polygon: a battered stone scarp to Hs with a
    sandstone cordon, a turf parapet slope to H, a packed-earth gun platform and a cannon aimed
    along `gun` (an angle in degrees). The polygon's last `open_edges` edges (the gorge, facing
    the town) get no outer fringe."""
    top = _inset(poly, bat)
    frustum(ms, 'gp_scarp', poly, top, 0.0, Hs, lod=2)
    frustum(ms, 'gp_sandstone', _inset(poly, bat - 0.008), _inset(poly, bat - 0.008), Hs - 0.012, Hs + 0.004, lod=1)
    cap = _inset(poly, bat + 0.06)
    frustum(ms, 'gp_turf', top, cap, Hs, H, lod=2)
    if platform:
        flat(ms, 'gp_gravel', _inset(poly, bat + 0.13), H + 0.003, lod=1)
    if gun is not None:
        cx = sum(p[0] for p in poly) / len(poly)
        cy = sum(p[1] for p in poly) / len(poly)
        a = math.radians(gun)
        cannon(ms, Matrix.Identity(4), cx + 0.05 * math.cos(a), cy + 0.05 * math.sin(a), H, math.degrees(a) + 90, s=1.25, lod=1)
    if fringe:
        out = _inset(poly, -0.17)
        n = len(poly)
        for i in range(n - open_edges):
            j = (i + 1) % n
            bm = bmesh.new()
            vs = [bm.verts.new((poly[i][0], poly[i][1], G + 0.004)), bm.verts.new((out[i][0], out[i][1], 0.0)),
                  bm.verts.new((out[j][0], out[j][1], 0.0)), bm.verts.new((poly[j][0], poly[j][1], G + 0.004))]
            face = bm.faces.new(vs)
            face.normal_update()
            if face.normal.z < 0:
                face.normal_flip()
            ms.add(bm, 'earth_fringe', 1)


def curtain(ms, a, b, W, H, Hs, bat=0.07, fringe=True):
    """A straight rampart from a to b along its outer foot (the outside on the right of a->b): a
    battered stone scarp with a sandstone cordon, a turf parapet and rampart on top, a stone
    inner face; packed earth at its outer foot."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy)
    f = _t(a[0], a[1], 0) @ Matrix.Rotation(math.atan2(dy, dx), 4, 'Z')   # local +y points inward
    inner = W - bat * 0.5
    slab(ms, 'gp_scarp', [(0.0, 0.0), (bat, Hs), (inner, Hs), (W, 0.0)], L, f=f, axis='X', lod=2)
    slab(ms, 'gp_turf', [(bat, Hs), (bat + 0.05, H), (bat + 0.1, H), (bat + 0.13, H - 0.04), (inner - 0.03, H - 0.04), (inner, Hs)],
         L, f=f, axis='X', lod=2)
    slab(ms, 'gp_sandstone', [(bat - 0.01, Hs - 0.012), (bat + 0.012, Hs - 0.012), (bat + 0.012, Hs + 0.005), (bat - 0.01, Hs + 0.005)],
         L, f=f, axis='X', lod=1)
    if fringe:
        bm = bmesh.new()
        vs = [bm.verts.new(p) for p in ((0, 0, G + 0.004), (L, 0, G + 0.004), (L, -0.17, 0.0), (0, -0.17, 0.0))]
        face = bm.faces.new(vs)
        face.normal_update()
        if face.normal.z < 0:
            face.normal_flip()
        ms.add(bm, 'earth_fringe', 1, matrix=f)
    return f


def corner_bastion(c, W, g, f_, e, sx=1, sy=1):
    """The plan polygon of the bastion on the (sx, sy) corner of a square trace whose curtains'
    outer feet lie at +-c and inner feet at +-(c - W): gorge points on the inner lines, flanks
    out to shoulders f_ beyond the curtain, faces meeting at a salient e beyond the corner."""
    pts = [(c - g, c - W - 0.02), (c - g, c + f_), (c + e, c + e), (c + f_, c - g), (c - W - 0.02, c - g)]
    pts = [(sx * px, sy * py) for px, py in pts]
    poly = _ccw(pts)
    # rotate the list so the gorge (between the two inner points) is the last edge
    inner = {(sx * (c - g), sy * (c - W - 0.02)), (sx * (c - W - 0.02), sy * (c - g))}
    for k in range(len(poly)):
        if poly[k] in inner and poly[(k - 1) % len(poly)] in inner:
            return poly[k:] + poly[:k]
    return poly


def gatehouse(ms, rng, c, W, H, gw, flag_top=None, cannons=False):
    """The gate in the south curtain: a sandstone gatehouse a little above the rampart, an arched
    timber double door in a stone surround, a cornice, a road out, a team pennant on a pole."""
    f = tm.house_frame(0, -c, 0)
    bw = gw + 0.18
    gh = H + 0.07
    ms.box('gp_sandstone', (bw, W + 0.02, gh), at=(0, W / 2 - 0.01, 0), lod=2, frame=f, bevel=0.004)
    ms.box('gp_sandstone', (bw + 0.03, W + 0.05, 0.025), at=(0, W / 2 - 0.01, gh - 0.01), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('gp_sandstone', (0.04, 0.02, gh * 0.9), at=(sx * (bw / 2 - 0.03), -0.02, 0), lod=0, frame=f)
    spring = H * 0.42
    rise = min(gw * 0.35, gh - spring - 0.06)
    arched_door(ms, f, 0, -0.022, gw, spring, rise, z=0.0, mat='door', surround='gp_sandstone')
    for sx in (-1, 1):  # iron straps on the leaves and the meeting line
        for k in range(2):
            ms.box('gp_iron', (gw / 2 - 0.04, 0.006, 0.014), at=(sx * gw / 4, -0.036, spring * (0.3 + 0.45 * k)), lod=0, frame=f)
    ms.box('dark', (0.006, 0.006, spring + rise * 0.9), at=(0, -0.035, 0), lod=0, frame=f)
    pediment(ms, f, 0, -0.03, gh - 0.005, bw * 0.55, 0.06, depth=0.04, lod=0)
    flat(ms, 'gp_gravel', [(-gw / 2 - 0.02, -0.02), (gw / 2 + 0.02, -0.02), (gw / 2 + 0.08, -0.4), (-gw / 2 - 0.08, -0.4)], 0.004, lod=1, f=f)
    flat(ms, 'gp_gravel', [(-gw / 2, W), (gw / 2, W), (gw / 2, W + 0.15), (-gw / 2, W + 0.15)], 0.004, lod=0, f=f)
    if flag_top:
        ms.cyl('timber', 0.012, 0.009, flag_top - gh, at=(bw / 2 - 0.06, W * 0.6, gh), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, bw / 2 - 0.06, W * 0.6, flag_top - 0.005, yaw=-160, w=0.22, h=0.13)
    return f


def bastioned_walls(ms, rng, c, W, H, gw, g, f_, e, flag_top=None, curtain_guns=0, Hb=None):
    """A bastioned trace round a square town: four curtains (the south one parted by the gate),
    an angled bastion with a cannon at each corner, the gatehouse at the south, packed earth at
    the outer foot and an earth apron inside (under the town's own ground) so no map shows
    between them."""
    Hs = H * 0.72
    Hb = Hb or H * 1.06
    bat = H * 0.18
    ext = g - bat - 0.05      # the curtains run on into the bastions, past their battered flanks
    L = c - ext
    gx = gw / 2 + 0.07
    sides = [  # (a, b) with the outside on the right of a->b (a counter-clockwise trace)
        ((L, c), (-L, c)), ((-c, L), (-c, -L)), ((c, -L), (c, L)),
        ((-L, -c), (-gx, -c)), ((gx, -c), (L, -c)),
    ]
    for a, b in sides:
        curtain(ms, a, b, W, H, Hs, bat)
    for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
        poly = corner_bastion(c, W, g, f_, e, sx, sy)
        bastion(ms, rng, poly, Hb, Hs * 1.04, bat=bat, gun=math.degrees(math.atan2(sy, sx)))
    gatehouse(ms, rng, c, W, H, gw, flag_top=flag_top)
    for k in range(curtain_guns):  # cannon on the south curtain either side of the gate
        sx = -1 if k % 2 == 0 else 1
        cannon(ms, Matrix.Identity(4), sx * (c * 0.45 + 0.25 * (k // 2)), -c + W * 0.55, H - 0.04, 0, s=1.0, lod=0)
    # the earth apron inside the ring, then its alpha-cut edge
    a0, a1, a2 = c - W + 0.02, c - W - 0.3, c - W - 0.44
    for k in range(4):
        rf = _rz(90 * k)
        for (r0, z0), (r1, z1), mat in (((a0, G * 0.6), (a1, G * 0.5), 'earth'), ((a1, G * 0.5), (a2, G * 0.3), 'earth_fringe')):
            bm = bmesh.new()
            vs = [bm.verts.new(p) for p in ((-r0, -r0, z0), (r0, -r0, z0), (r1, -r1, z1), (-r1, -r1, z1))]
            face = bm.faces.new(vs)
            face.normal_update()
            if face.normal.z < 0:
                face.normal_flip()
            ms.add(bm, mat, 1, matrix=rf)


def walls_small(ms, rng):
    """`walls-small` (49 m): a square bastioned trace of grey stone scarps under turf with four
    diamond bastions, each with a cannon, and a sandstone gatehouse with an arched timber gate."""
    bastioned_walls(ms, rng, c=2.2, W=0.26, H=0.3 * tb.WALL_RAISE, gw=0.36, g=0.42, f_=0.0, e=0.25)


def walls_medium(ms, rng):
    """`walls-medium` (69 m): a square trace with pentagonal bastions (flanks and faces), a cannon
    on each, a gatehouse with a team pennant."""
    bastioned_walls(ms, rng, c=3.2, W=0.3, H=0.4 * tb.WALL_RAISE, gw=0.42, g=0.56, f_=0.2, e=0.25, flag_top=0.95)


def walls_big(ms, rng):
    """`walls-big` (91 m): a square trace with big diamond bastions and cannon, two more guns on
    the south curtain, a gatehouse with a team pennant."""
    bastioned_walls(ms, rng, c=4.25, W=0.34, H=0.5 * tb.WALL_RAISE, gw=0.5, g=0.64, f_=0.05, e=0.3, flag_top=1.15,
                    curtain_guns=2)


def town_bastion(ms, rng, x, y, size=0.9, H=0.36, gun=-45):
    """A corner bastion inside a big town (the sheets' SE corner): an arrowhead of stone scarp and
    turf pointing out of the corner, a gun platform and a cannon."""
    a = math.radians(gun)
    ux, uy = math.cos(a), math.sin(a)          # toward the salient
    px, py = -uy, ux                           # across
    s = size
    loc = [(-0.45 * s, -0.42 * s), (0.08 * s, -0.42 * s), (0.5 * s, 0.0), (0.08 * s, 0.42 * s), (-0.45 * s, 0.42 * s)]
    poly = _ccw([(x + u * ux + v * px, y + u * uy + v * py) for u, v in loc])
    bastion(ms, rng, poly, H, H * 0.72, bat=0.06, gun=gun, fringe=False)
    return poly


# ---- the palaces --------------------------------------------------------------------------------

def banner_pair(ms, F, xs, z_top, h=0.16, w=0.05):
    for bx in xs:
        ms.box('team_cloth', (w, 0.006, h), at=(bx, -0.012, z_top - h), lod=1, frame=F)
        ms.box('gp_iron', (w + 0.016, 0.01, 0.008), at=(bx, -0.014, z_top - 0.004), lod=0, frame=F)


def palace_small(ms, rng):
    """`palace-small` (8 m): a manor of cream stucco with red-brick pilaster strips and sandstone
    quoins, five bays and two storeys of shuttered sash windows, a pedimented doorcase with team
    banners either side and stone steps, a slate mansard with three dormers and two chimneys."""
    w, d, h = 0.76, 0.5, 0.42
    f = tm.house_frame(0, 0.02, 0)
    ms.box('gp_sandstone', (w + 0.016, d + 0.016, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_stucco', (w, d, h), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    sh = h / 2
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('gp_sandstone', (0.03, 0.03, h - 0.03), at=(sx * (w / 2 - 0.012), sy * (d / 2 - 0.012), G + 0.03), lod=0, frame=f)
    ms.box('gp_sandstone', (w + 0.01, d + 0.01, 0.014), at=(0, 0, G + sh), lod=0, frame=f)
    ms.box('gp_sandstone', (w + 0.026, d + 0.026, 0.024), at=(0, 0, G + h - 0.02), lod=1, frame=f)
    for F, length, side in faces_of(f, w, d):
        n = 5 if side in ('front', 'back') else 3
        xs = [-length / 2 + length * (i + 0.5) / n for i in range(n)]
        for i in range(n + 1):  # brick strips between the bays
            if i in (0, n):
                continue
            bx = -length / 2 + length * i / n
            quad(ms, 'gp_brick', F, bx, -0.002, G + 0.05, 0.03, h - 0.07, lod=0)
        for k in range(2):
            for i, wx in enumerate(xs):
                if side == 'front' and k == 0 and i == n // 2:
                    continue
                shut = side != 'back' and (side != 'front' or i in (0, n - 1))
                window(ms, F, wx, G + sh * k + sh * 0.28, ww=0.05, wh=0.1, shutters='gp_shutter_brown' if shut else None,
                       glass_lod=1)
    F = faces_of(f, w, d)[0][0]
    ms.box('door', (0.075, 0.014, 0.15), at=(0, -0.004, G + 0.04), lod=1, frame=F)
    for sx in (-1, 1):
        ms.box('gp_sandstone', (0.022, 0.024, 0.17), at=(sx * 0.06, -0.01, G + 0.04), lod=0, frame=F)
    ms.box('gp_sandstone', (0.15, 0.03, 0.018), at=(0, -0.012, G + 0.205), lod=0, frame=F)
    pediment(ms, F, 0, -0.026, G + 0.222, 0.16, 0.045, depth=0.024, lod=0)
    banner_pair(ms, F, (-0.09, 0.09), G + sh + 0.05, h=0.15, w=0.038)
    for k in range(4):
        ms.box('gp_sandstone', (0.24 - k * 0.03, 0.03, 0.012 * (4 - k)), at=(0, -d / 2 - 0.1 + 0.025 * k + 0.012, G), lod=1 if k == 0 else 0, frame=f)
    mansard(ms, f, w, d, G + h, 0.13, 0.07, inset=0.07, mat='gp_slate')
    for k in range(3):
        dormer(ms, f, (k - 1) * 0.24, -d / 2 + 0.012, G + h + 0.01, w=0.075, h=0.09, mat='gp_slate', cheek='gp_sandstone')
    for sx in (-1, 1):
        chimney(ms, f, sx * (w / 2 - 0.13), 0.02, G + h, 0.29, w=0.06, d=0.08)
    for sx in (-1, 1):
        flower_pot(ms, f, sx * 0.17, -d / 2 - 0.05)


def palace(ms, rng):
    """`palace` (12 m): a baroque palace on a U plan round a paved forecourt open to the south:
    brick wings with sandstone quoins and window surrounds under slate mansards with dormers and
    chimneys, a sandstone central pavilion with columns, a pediment, banners, a balustrade and
    steps, a drum and lead dome with a lantern and cross."""
    wing_w, main_d, h = 0.3, 0.34, 0.46
    W = 1.16
    D = 0.92
    # the main block across the back
    my = D / 2 - main_d / 2
    for sx in (-1, 1):  # two halves, so the pavilion breaks the roof between them
        gp_house(ms, rng, sx * (W / 4 + 0.06), my, W / 2 - 0.12, main_d, yaw=0, wall='gp_brick', roof='gp_slate', kind='mansard',
                 storeys=2, h=h, shutters=None, chimneys=1, dormers=2, door=False, props=0, rise=0.06)
    # the wings
    wl = D - main_d + 0.02
    for sx in (-1, 1):
        gp_house(ms, rng, sx * (W / 2 - wing_w / 2), -D / 2 + wl / 2, wing_w, wl, yaw=0, wall='gp_brick', roof='gp_slate',
                 kind='mansard', storeys=2, h=h, shutters=None, chimneys=1, dormers=1, door=False, props=0, rise=0.05)
    # the forecourt
    flat(ms, 'gp_cobble_square', [(-W / 2 + wing_w, -D / 2), (W / 2 - wing_w, -D / 2), (W / 2 - wing_w, my - main_d / 2),
                                  (-W / 2 + wing_w, my - main_d / 2)], G + 0.004, lod=1)
    # the central pavilion
    pw, pd, ph = 0.36, 0.3, h + 0.1
    py = my - main_d / 2 + pd / 2 - 0.08
    f = tm.house_frame(0, py, 0)
    ms.box('gp_sandstone', (pw + 0.02, pd + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box('gp_sandstone', (pw, pd, ph), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    F = faces_of(f, pw, pd)[0][0]
    for k, cx in enumerate((-0.14, -0.065, 0.065, 0.14)):
        ms.cyl('gp_sandstone', 0.016, 0.014, ph * 0.86, at=(cx, -0.02, G + 0.05), segs=8, lod=1, frame=F)
    ms.box('gp_sandstone', (pw + 0.02, 0.05, 0.035), at=(0, -0.01, G + ph - 0.04), lod=1, frame=F)
    pediment(ms, F, 0, -0.035, G + ph - 0.005, pw * 0.8, 0.07, depth=0.04)
    for k in range(9):  # balustrade along the top
        ms.box('gp_sandstone', (0.014, 0.014, 0.04), at=(-pw / 2 + 0.02 + k * (pw - 0.04) / 8, -0.006, G + ph), lod=0, frame=f @ _t(0, -pd / 2 + 0.02, 0))
    ms.box('gp_sandstone', (pw, 0.02, 0.012), at=(0, -pd / 2 + 0.02, G + ph + 0.04), lod=0, frame=f)
    arched_door(ms, F, 0, 0, 0.09, 0.15, 0.04)
    slab(ms, 'gp_window', [(px, pz + G + ph * 0.55) for px, pz in arch_outline(0.07, 0.1, 0.035, 6)], 0.008, f=F @ _t(0, -0.008, 0), lod=1)
    banner_pair(ms, F, (-0.1, 0.1), G + ph * 0.86, h=0.24, w=0.045)
    for k in range(5):
        ms.box('gp_sandstone', (0.3 - k * 0.03, 0.03, 0.012 * (5 - k)), at=(0, -pd / 2 - 0.12 + 0.025 * k + 0.012, G), lod=1 if k == 0 else 0, frame=f)
    for sx in (-1, 1):
        ms.box('gp_sandstone', (0.02, 0.08, 0.05), at=(sx * 0.16, -pd / 2 - 0.06, G), lod=0, frame=f)
    hip(ms, f, pw, pd, G + ph + 0.012, 0.05, mat='gp_slate', over=0.0)
    dome(ms, f, 0, 0.02, G + ph + 0.05, 0.15, 0.22, 0.14, top=1.25, lantern=0.11)
    # the back of the pavilion through the main block (its own roof line) and chimneys
    ms.box('gp_brick', (pw - 0.04, main_d * 0.9, h), at=(0, my, G), lod=1)
    hip(ms, tm.house_frame(0, my, 0), pw - 0.04, main_d * 0.9, G + h, 0.12, mat='gp_slate', over=0.02)


# ---- the colony camp ----------------------------------------------------------------------------

def plank_hut(ms, rng, x, y):
    """The camp's hut: weathered planks on corner posts, a plank door and a window, a terracotta
    tiled gable roof (3.5 m)."""
    f = tm.house_frame(x, y, 0)
    w, d, wh = 0.6, 0.42, 0.24
    ms.box('gp_plank', (w, d, wh), at=(0, 0, G), lod=2, frame=f, bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.03, 0.03, wh + 0.01), at=(sx * (w / 2 - 0.006), sy * (d / 2 - 0.006), G), lod=1, frame=f)
    F = faces_of(f, w, d)[0][0]
    ms.box('dark', (0.1, 0.01, 0.17), at=(0.06, -0.003, G), lod=1, frame=F)
    ms.box('door', (0.09, 0.014, 0.16), at=(-0.1, -0.004, G), lod=1, frame=F)
    quad(ms, 'dark', F, -0.2, -0.004, G + 0.12, 0.05, 0.05, lod=0)
    gable(ms, f, w, d, G + wh, 0.11, mat='gp_tile', wall='gp_plank', over=0.04)
    return f


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): a plank hut with a tiled roof at the back, two canvas tents, a
    stone fire ring, barrels, sacks and a chest, a log pile, a half-built palisade of stakes on
    the west and north, a team flag on a pole."""
    plank_hut(ms, rng, 0.02, 0.42)
    tb.tent(ms, -0.56, 0.12, w=0.28, d=0.44, h=0.24)
    tb.tent(ms, 0.58, 0.12, w=0.28, d=0.44, h=0.24)
    tb.fire_ring(ms, rng, 0.04, -0.15)
    world = tm.house_frame(0, 0, 0)
    for k, (bx, by) in enumerate(((-0.62, -0.42), (-0.55, -0.48), (-0.62, -0.53), (-0.54, -0.39), (-0.69, -0.47))):
        ms.cyl('timber', 0.034, 0.034, 0.075, at=(bx, by, G), segs=10, lod=1 if k < 2 else 0)
        for zz in (0.015, 0.055):
            ms.cyl('gp_iron', 0.0355, 0.0355, 0.006, at=(bx, by, G + zz), segs=10, lod=0)
    for k in range(3):
        ms.sphere('linen', 0.036, at=(-0.46 + 0.03 * k, -0.5 + 0.02 * k, G + 0.03), scale=(1, 0.9, 1.1), u=8, v=5, lod=0)
    ms.box('timber', (0.1, 0.07, 0.06), at=(-0.4, -0.45, G), rot_z=8, lod=0, bevel=0.004)
    for k in range(2):
        tb.log_bundle(ms, 0.5, -0.44 + 0.1 * k, 90, length=0.36)
    west = [(-0.86 + rng.uniform(-0.01, 0.01), -0.62 + 0.062 * i) for i in range(23)]
    north = [(-0.8 + 0.062 * i, 0.78 + rng.uniform(-0.01, 0.01)) for i in range(26) if not (8 <= i <= 9)]
    tb.stakes(ms, rng, west + north)
    top = 0.4 * tb.WALL_RAISE
    ms.cyl('timber', 0.016, 0.012, top - G, at=(0.76, -0.5, G), segs=6, lod=2)
    tt.pennant(ms, world, 0.76, -0.5, top - 0.005, yaw=-160, lod=2, w=0.24, h=0.15)
    for k in range(5):
        a = 2 * math.pi * k / 5
        ms.sphere('stone', 0.03, at=(0.76 + 0.04 * math.cos(a), -0.5 + 0.04 * math.sin(a), G + 0.01), scale=(1.1, 1, 0.8), u=6, v=4, lod=1)


# ---- fields -------------------------------------------------------------------------------------

def field_1(ms, rng):
    """`field-1` (14 by 10 m): eight strips of ripe wheat, a ditch with a sluice along the north."""
    tb.field_1(ms, rng, crop='gp_wheat')


def pear_tree(ms, rng, x, y, top=0.25, stake=False):
    """A pear tree in a mulched basin: a short trunk, a round crown hung with pears (the material)."""
    ms.cyl('mud', 0.15, 0.14, 0.008, at=(x, y, G), segs=12, lod=1)
    ms.cyl('timber', 0.017, 0.012, 0.13, at=(x, y, G), segs=6, lod=1)
    cr = 0.105
    zc = top - cr
    ms.sphere('gp_pear', cr, at=(x, y, zc), scale=(1.05, 1.05, 0.92), u=8, v=6, lod=0)
    for k in range(5):
        a = k * 2 * math.pi / 5 + rng.uniform(-0.3, 0.3)
        ms.sphere('gp_pear', cr * 0.62, at=(x + 0.072 * math.cos(a), y + 0.072 * math.sin(a), zc - 0.02 + rng.uniform(-0.01, 0.02)), u=7, v=5, lod=0)
    ms.sphere('gp_pear', cr * 1.05, at=(x, y, zc), scale=(1.05, 1.05, 0.9), u=7, v=5, lod=1, only=1)
    ms.cyl('gp_pear', cr * 1.1, cr * 0.5, top - G - 0.1, at=(x, y, G + 0.1), segs=6, lod=2, only=2)
    if stake:
        ms.box('timber', (0.014, 0.014, 0.17), at=(x + 0.04, y - 0.05, G), lod=0)
        ms.box('reed', (0.03, 0.03, 0.012), at=(x + 0.03, y - 0.04, G + 0.12), lod=0)


def field_2(ms, rng):
    """`field-2` (16 by 12 m): six pear trees in two rows in mulched basins on grass, two of them
    staked young trees, a cross of trodden paths."""
    flat(ms, 'gp_gravel', [(-0.8, -0.03), (0.8, -0.03), (0.8, 0.05), (-0.8, 0.05)], G + 0.002, lod=1)
    for x0 in (-0.26, 0.24):
        flat(ms, 'gp_gravel', [(x0 - 0.035, -0.6), (x0 + 0.035, -0.6), (x0 + 0.035, 0.6), (x0 - 0.035, 0.6)], G + 0.0025, lod=1)
    k = 0
    for y in (0.3, -0.3):
        for x in (-0.52, 0.0, 0.52):
            pear_tree(ms, rng, x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.015, 0.015), top=rng.uniform(0.24, 0.26),
                      stake=k in (1, 5))
            k += 1


def field_3(ms, rng):
    """`field-3` (14 by 12 m): a grazed pasture with trodden paths and bare patches, a whitewashed
    post-and-rail fence on the west and north, a stone water trough and a flat stone."""
    pts = [(-0.66, -0.56), (-0.66, 0.56), (0.62, 0.56)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        n = max(1, round(length / 0.22))
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        for i in range(n + 1):
            px, py = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            ms.box('gp_fence', (0.022, 0.022, 0.12), at=(px, py, G - 0.004), rot_z=yaw, lod=1)
        for zr in (0.05, 0.095):
            ms.box('gp_fence', (length, 0.012, 0.016), at=((x0 + x1) / 2, (y0 + y1) / 2, G + zr), rot_z=yaw, lod=1)
    ms.box('gp_sandstone', (0.22, 0.09, 0.055), at=(-0.46, 0.45, G), lod=1, bevel=0.005)
    ms.box('shallows', (0.19, 0.06, 0.004), at=(-0.46, 0.45, G + 0.05), lod=1)
    ms.sphere('stone', 0.035, at=(-0.27, 0.38, G + 0.004), scale=(1.4, 1.1, 0.5), u=8, v=5, lod=1)
    flat(ms, 'gp_gravel', [(-0.42, 0.36), (-0.34, 0.4), (0.5, -0.56), (0.4, -0.58)], G + 0.002, lod=1)
    for cx, cy, r in ((-0.3, -0.3, 0.12), (0.32, 0.1, 0.1), (0.38, -0.32, 0.07)):
        flat(ms, 'gp_gravel', [(cx + r * math.cos(a * math.pi / 4) * (1 + 0.2 * (a % 2)), cy + r * 0.8 * math.sin(a * math.pi / 4))
                               for a in range(8)], G + 0.0025, lod=1)


def field_4(ms, rng):
    """`field-4` (16 by 10 m): five ridged rows of flowering potatoes running east-west, a ditch
    with a marker post along the west edge."""
    x0 = -0.68
    ms.quad_strip('shallows', [(x0 - 0.03, -0.46, G + 0.002), (x0 + 0.03, -0.46, G + 0.002), (x0 + 0.03, 0.44, G + 0.002),
                               (x0 - 0.03, 0.44, G + 0.002)], lod=2)
    for sx in (-1, 1):
        ms.box('mud', (0.018, 0.92, 0.014), at=(x0 + sx * 0.039, -0.01, G), lod=1)
    ms.box('timber', (0.025, 0.025, 0.1), at=(x0 + 0.02, 0.47, G), lod=0, bevel=0.003)
    for i in range(5):
        y = -0.36 + 0.18 * i
        ms.box('mud', (1.3, 0.13, 0.022), at=(0.06, y, G), lod=2, taper=0.75)
        ms.box('gp_potato', (1.26, 0.1, 0.045), at=(0.06, y, G + 0.012), lod=1, taper=0.7)
        for k in range(11):
            ms.sphere('gp_potato', 0.042, at=(-0.56 + 0.124 * k + rng.uniform(-0.02, 0.02), y + rng.uniform(-0.008, 0.008), G + 0.045),
                      scale=(1.25, 1.0, 0.7), u=7, v=4, lod=0)
