# scripts/blender/ti_sinic_bronze.py
# The Sinic kit for the Bronze Age (art spec section 3b: a town is layout x kit; China, Taiwan,
# Hong Kong, Macau, Japan and the Koreas), from the sheets in plans/art/kits/sinic/bronze/:
# houses.png, street.png, roofscape.png, materials.png and the two landmarks. Shang building:
# timber post frames with ochre rammed-earth panels on rammed-earth platforms, hip-and-gable
# thatch roofs with a tied straw ridge, a ridge pole held by crossed pegs and crossed poles at the
# gable ends; poor huts in staked yards, common houses as walled courtyards (a hall at the back,
# two side sheds and a little gatehouse in a rammed-earth wall), rich halls on high platforms with
# stone steps, red-lacquered posts and railings. Packed-earth streets, staked fences, pots, big
# storage jars, drying racks, slatted sheds and a few trees. Landmarks: the bronze-casting hall
# (an open timber hall on an 18 x 12 m platform, a beehive furnace, moulds and vessels) and the
# oracle shrine (a 12 m hall on an 18 m platform, bronze cauldrons on its veranda, a 14 m drum
# tower beside it).
# Scale as the other kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
# Materials carry the `snb_` prefix.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['snb_earth', 'snb_platform', 'snb_thatch', 'snb_reed', 'snb_timber', 'snb_post', 'snb_red', 'snb_door',
       'snb_mat', 'snb_stone', 'snb_bronze', 'snb_clay', 'snb_hide', 'snb_bamboo', 'snb_plank', 'snb_fence',
       'snb_pot', 'snb_black', 'snb_bone', 'snb_leaf', 'snb_bark', 'snb_garden',
       'snb_street', 'snb_street_fringe', 'snb_street_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'snb_street': 'Ground', 'snb_street_fringe': 'Ground', 'snb_street_square': 'Ground'})
if 'snb_street_fringe' not in tt.FRINGES:
    tt.FRINGES.append('snb_street_fringe')


def _mat(name):
    return bpy.data.materials.new(name)


def mat_thatch(name, colors, course=0.05, rough=0.95):
    """Thatch (the Europe kit's recipe, copied): level courses darker at each course's foot over
    fine straws running down the slope."""
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
    streak = nt.nodes.new('ShaderNodeTexWave')
    streak.wave_type = 'BANDS'
    streak.bands_direction = 'X'
    streak.inputs['Scale'].default_value = 90.0
    streak.inputs['Distortion'].default_value = 5.0
    streak.inputs['Detail'].default_value = 3.0
    nt.links.new(comb.outputs['Vector'], streak.inputs['Vector'])
    courses = nt.nodes.new('ShaderNodeTexWave')
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


STREET = ('#8f6a42', '#a77d50', '#9a7a4a', '#87633d')  # street sheet: packed earth, warm brown


def make_materials():
    # rammed earth (houses sheet: #B48C5C walls in horizontal lifts) and the compacted platforms
    tm.mat_simple('snb_earth', ['#9a7748', '#b38c5a', '#c39d68', '#a68150'], scale=22.0, bump=0.4, dirt=True,
                  stripes={'dir': 'Z', 'scale': 70.0, 'distortion': 1.5})
    tm.mat_simple('snb_platform', ['#8c6c45', '#a68355', '#b39264', '#957450'], scale=18.0, bump=0.5, dirt=True,
                  stripes={'dir': 'Z', 'scale': 45.0, 'distortion': 1.2})
    # thatch (straw, golden tan #B89660) and reed (the sheds and poor huts, greyer)
    mat_thatch('snb_thatch', ['#4f3a22', '#6e5634', '#8a6f45', '#9c8152'])
    mat_thatch('snb_reed', ['#4a3d2a', '#665640', '#7e6c4e', '#8c7a58'], course=0.04)
    # dark weathered timber (posts, frames) and the plank door
    tm.mat_simple('snb_timber', ['#3c3026', '#53443a', '#615043', '#47392d'], scale=8.0,
                  stripes={'dir': 'X', 'scale': 70.0, 'distortion': 6.0}, bump=0.4)
    tm.mat_simple('snb_post', ['#4a3b2b', '#64513c', '#755f47'], scale=10.0,
                  stripes={'dir': 'X', 'scale': 90.0, 'distortion': 5.0}, bump=0.4)
    tm.mat_simple('snb_red', ['#7e2a1c', '#9a3422', '#ab4430', '#8a2e1f'], scale=16.0, bump=0.15)
    tm.mat_simple('snb_door', ['#2e251d', '#43362a', '#382c22'], scale=6.0,
                  stripes={'dir': 'X', 'scale': 110.0, 'distortion': 2.0}, bump=0.5)
    tm.mat_mudwall('snb_mat', wash='#9a8456', brick='#a58c5a', brick2='#7c6640', mortar='#3a2e20', wash_cover=0.0,
                   bond=(0.012, 0.012, 0.002))  # the reed-mat window screens: a tight weave
    tm.mat_simple('snb_stone', ['#7c766a', '#958e80', '#a8a090', '#857c6c'], scale=24.0, bump=0.6)
    tm.mat_simple('snb_bronze', ['#2f5a4e', '#43786a', '#5a8f7c', '#6f6234'], scale=26.0, rough=0.55, bump=0.3, metal=0.3)
    tm.mat_simple('snb_clay', ['#8a4a2e', '#a65d3a', '#b77048', '#94553a'], scale=20.0, bump=0.35)
    tm.mat_simple('snb_hide', ['#c9b48e', '#d9c7a2', '#bfa77e'], scale=14.0, bump=0.2)
    tm.mat_mudwall('snb_bamboo', wash='#8c7448', brick='#9b8152', brick2='#77603c', mortar='#4a3a26', wash_cover=0.0,
                   bond=(0.03, 0.016, 0.002))
    tm.mat_simple('snb_plank', ['#4c4036', '#5f5246', '#6e6155', '#544538'], scale=7.0,
                  stripes={'dir': 'X', 'scale': 60.0, 'distortion': 2.0}, bump=0.4)
    tm.mat_simple('snb_fence', ['#5a4836', '#75604a', '#8a7356', '#4a3b2c'], scale=10.0,
                  stripes={'dir': 'X', 'scale': 160.0, 'distortion': 1.0}, bump=0.6)  # staked fence panels
    tm.mat_simple('snb_pot', ['#6a3e2a', '#84513a', '#94604a'], scale=16.0, bump=0.2)
    tm.mat_simple('snb_black', ['#262220', '#36302b', '#2c2724'], scale=14.0, bump=0.2)
    tm.mat_simple('snb_bone', ['#cfc3a6', '#ded3b8', '#bfb091'], scale=20.0, bump=0.2)
    tm.mat_simple('snb_leaf', ['#3a5a24', '#527a2e', '#679036', '#466a2a'], scale=40.0, bump=0.6)
    tm.mat_simple('snb_bark', ['#3e3226', '#54442f', '#463828'], scale=12.0, bump=0.5)
    tm.mat_simple('snb_garden', ['#4a6426', '#62822e', '#7a6440', '#5a4a30'], scale=70.0,
                  stripes={'dir': 'X', 'scale': 30.0, 'distortion': 3.0}, bump=0.7)
    for n in ('snb_street', 'snb_street_fringe'):
        tm.mat_earth(n, colors=STREET)
    tm.mat_earth('snb_street_square', colors=('#9a764b', '#b08a5c', '#bb9566', '#93704a'))


if not any(n == 'sinic_bronze' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('sinic_bronze', make_materials))

STREET_GROUND = dict(mat='snb_street')


def obox(ms, mat, size, at=(0, 0, 0), frame=None, lod=2, only=None, rot_z=0.0):
    """A plain box (base at `at`) shown only at the LODs in `only`."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = tm.Mesher._m(at, rot_z)
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, lod, m, only=only)


def _solid(ms, mat, verts, faces, frame, lod=2, only=None):
    bm = bmesh.new()
    vs = [bm.verts.new(v) for v in verts]
    for fc in faces:
        bm.faces.new([vs[i] for i in fc])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # every caller passes a closed solid
    return ms.add(bm, mat, lod, matrix=frame.copy(), only=only)


# ---- roofs --------------------------------------------------------------------------------------

def hipgable_roof(ms, f, w, d, z, rise, mat='snb_thatch', k=0.42, band=0.035, axis='x', lod=2, gable_mat='snb_bamboo', gable_lod=0):
    """The Shang hip-and-gable thatch over a w x d eave footprint (eave top at z), its ridge along
    the frame's X (or Y): hips rise from the eaves to a level line `k` of the way up the half depth,
    then a small upright gable (woven bamboo) runs to the ridge. One closed solid. Returns the
    roof frame (X along the ridge) and the ridge's half length."""
    if axis == 'y':
        f = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        w, d = d, w
    W, D = w / 2, d / 2
    dg = k * D
    zg = z + rise * (1 - k)
    xg = max(W - (D - dg) * 1.05, 0.22 * W)
    zt = z + rise
    v = [(-W, -D, z - band), (W, -D, z - band), (W, D, z - band), (-W, D, z - band),     # 0-3 bottom
         (-W, -D, z), (W, -D, z), (W, D, z), (-W, D, z),                                   # 4-7 eave top
         (-xg, -dg, zg), (-xg, dg, zg), (xg, -dg, zg), (xg, dg, zg),                       # 8-11 gable feet
         (-xg, 0, zt), (xg, 0, zt)]                                                        # 12-13 ridge
    faces = [(3, 2, 1, 0), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
             (4, 5, 10, 13, 12, 8), (6, 7, 9, 12, 13, 11), (5, 6, 11, 10), (7, 4, 8, 9),
             (10, 11, 13), (9, 8, 12)]
    _solid(ms, mat, v, faces, f, lod)
    # the woven gable boards just proud of each gable
    for s in (-1, 1):
        gv = [(s * (xg + 0.002), -dg * 0.94, zg + 0.004), (s * (xg + 0.002), dg * 0.94, zg + 0.004),
              (s * (xg + 0.002), 0, zt - 0.012), (s * (xg + 0.008), -dg * 0.94, zg + 0.004),
              (s * (xg + 0.008), dg * 0.94, zg + 0.004), (s * (xg + 0.008), 0, zt - 0.012)]
        _solid(ms, gable_mat, gv, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], f, lod=gable_lod)
    return f, xg


def gable_roof(ms, f, w, d, z, rise, mat='snb_thatch', band=0.035, lod=2, gable_mat='snb_bamboo', inset=0.04):
    """A plain gable thatch (the casting hall): two thick thatch slabs meeting at the ridge (along
    X), with upright gable triangles of woven bamboo set `inset` under the overhang."""
    W, D = w / 2, d / 2
    L = math.hypot(D, rise) + 0.01
    a = math.atan2(rise, D)
    for sy in (-1, 1):
        sf = f @ Matrix.Translation(Vector((0, sy * D / 2, z + rise / 2))) @ Matrix.Rotation(-sy * a, 4, 'X')
        ms.box(mat, (w, L, band), at=(0, 0, -band / 2), lod=lod, frame=sf)
    gx = W - inset
    for s in (-1, 1):
        gv = [(s * gx, -D * 0.9, z - band * 0.5), (s * gx, D * 0.9, z - band * 0.5), (s * gx, 0, z + rise * 0.98 - band),
              (s * (gx - 0.008), -D * 0.9, z - band * 0.5), (s * (gx - 0.008), D * 0.9, z - band * 0.5), (s * (gx - 0.008), 0, z + rise * 0.98 - band)]
        _solid(ms, gable_mat, gv, [(0, 1, 2), (5, 4, 3), (0, 3, 4, 1), (1, 4, 5, 2), (2, 5, 3, 0)], f, lod=1)
    return f, W


def ridge(ms, f, r, z, pegs=4, over=0.03, cross=0.09, bundle=0.016, lod=1, ends=0):
    """The tied ridge (materials sheet): a straw bundle along the ridge, a timber ridge pole on it
    held by pairs of crossed pegs, and crossed poles standing up at both ends."""
    length = 2 * r + 2 * over
    ms.cyl('snb_thatch', bundle, bundle, 2 * r + 0.01, at=(-r - 0.005, 0, z - bundle * 0.3), rot=(0, 90, 0), segs=6, lod=0, frame=f)
    ms.cyl('snb_timber', 0.009, 0.009, length, at=(-length / 2, 0, z + bundle * 0.7), rot=(0, 90, 0), segs=4 if lod >= 1 else 6, lod=lod, frame=f)
    for kk in range(pegs):
        px = -r + 0.02 + (2 * r - 0.04) * kk / max(1, pegs - 1)
        crossed(ms, f, px, z + bundle * 0.5, 0.05, 32, t=0.007, lod=0)
    for px in (-r - over * 0.4, r + over * 0.4):
        crossed(ms, f, px, z + bundle * 0.5, cross, 28, t=0.009, lod=ends, up=0.55)


def crossed(ms, f, x, z, length, ang, t=0.008, lod=0, up=0.42):
    """Two sticks crossing at (x, 0, z) in the frame's YZ plane (across a ridge along X); `up` is
    the share of each stick above the crossing."""
    for s in (-1, 1):
        sf = f @ Matrix.Translation(Vector((x, 0, z))) @ Matrix.Rotation(math.radians(s * ang), 4, 'X')
        ms.box('snb_timber', (t, t, length), at=(0, 0, -length * (1 - up)), lod=lod, frame=sf)


# ---- small things -------------------------------------------------------------------------------

def fence(ms, f, pts, h=0.09, step=0.4, gaps=(), lod=1, posts=True):
    """A staked fence along the polyline `pts` in frame f: a panel of close stakes (the material
    carries them) with a heavier post every `step` at LOD0. `gaps` are (segment, centre fraction,
    width) openings."""
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
            ms.box('snb_fence', (b - a, 0.01, h), at=(x0 + ux * m, y0 + uy * m, G), rot_z=yaw, lod=lod, frame=f)
            if posts:
                n = max(1, round((b - a) / step))
                for i in range(n + 1):
                    p = a + (b - a) * i / n
                    ms.box('snb_post', (0.013, 0.013, h + 0.02), at=(x0 + ux * p, y0 + uy * p, G), rot_z=yaw, lod=0, frame=f)
                ms.box('snb_post', (b - a, 0.012, 0.01), at=(x0 + ux * m, y0 + uy * m, G + h * 0.7), rot_z=yaw, lod=0, frame=f)


def pot(ms, f, x, y, s=1.0, z=G, mat='snb_pot'):
    """A clay or bronze pot (a lighter lathe than the shared jar)."""
    p = [(0.0, 0.0), (0.02 * s, 0.002), (0.032 * s, 0.035 * s), (0.016 * s, 0.075 * s), (0.018 * s, 0.084 * s), (0.0, 0.084 * s)]
    ms.lathe(mat, [(r, zz + z) for r, zz in p], at=(x, y, 0), segs=7, lod=0, frame=f)


def big_jar(ms, f, x, y, s=1.0, z=G):
    """A big dark storage jar (street sheet)."""
    p = [(0.0, 0.0), (0.03, 0.002), (0.052, 0.055), (0.03, 0.104), (0.0, 0.104)]
    ms.lathe('snb_black', [(r * s, zz * s + z) for r, zz in p], at=(x, y, 0), segs=8, lod=0, frame=f)


def bits(ms, f, x, y, rng, n=4):
    """Pots, baskets, a big jar and a bundle round (x, y) in frame f."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.07, 0.07), y + rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.45:
            pot(ms, f, px, py, rng.uniform(0.8, 1.15), mat='snb_pot' if rng.random() < 0.6 else 'terracotta')
        elif r < 0.62:
            big_jar(ms, f, px, py, rng.uniform(0.75, 0.95))
        elif r < 0.85:
            tt.basket(ms, f, px, py, rng.uniform(0.9, 1.2))
        else:
            ms.box('snb_plank', (0.06, 0.05, 0.04), at=(px, py, G), rot_z=rng.uniform(-20, 20), lod=0, frame=f, bevel=0.003)


def rack(ms, x, y, yaw=0.0, f=None):
    """A drying rack: two posts, two rails, reed mats and cloth hanging."""
    rf = (f or Matrix.Identity(4)) @ tm.house_frame(x, y, yaw)
    for sx in (-0.08, 0.08):
        ms.box('snb_post', (0.012, 0.012, 0.15), at=(sx, 0, G), lod=0, frame=rf)
    ms.box('snb_post', (0.19, 0.01, 0.01), at=(0, 0, G + 0.14), lod=1, frame=rf)
    ms.box('snb_reed', (0.07, 0.006, 0.08), at=(-0.04, 0, G + 0.055), lod=1, frame=rf)
    ms.box('linen', (0.06, 0.006, 0.07), at=(0.045, 0, G + 0.065), lod=1, frame=rf)


def shed(ms, x, y, yaw=0.0, f=None, w=0.16, d=0.12):
    """A small slatted store shed (roofscape sheet): plank walls under a grey plank pent roof."""
    sf = (f or Matrix.Identity(4)) @ tm.house_frame(x, y, yaw)
    ms.box('snb_plank', (w, d, 0.1), at=(0, 0, G), lod=1, frame=sf, bevel=0.003)
    rf = sf @ Matrix.Translation(Vector((0, 0, G + 0.115))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('snb_plank', (w + 0.04, d + 0.05, 0.012), at=(0, 0, 0), lod=1, frame=rf)
    ms.box('snb_door', (0.05, 0.008, 0.075), at=(0, -d / 2 - 0.002, G), lod=0, frame=sf)


def woodpile(ms, x, y, yaw=0.0, f=None):
    wf = (f or Matrix.Identity(4)) @ tm.house_frame(x, y, yaw)
    for kk in range(6):
        ms.cyl('timber', 0.012, 0.012, 0.18, at=(-0.09, -0.03 + (kk % 3) * 0.024, G + 0.012 + (kk // 3) * 0.022), rot=(0, 90, 0),
               segs=6, lod=0, frame=wf)


def tree(ms, x, y, s=1.0, rng=None, lod=1):
    """A small broadleaf (street sheet's corner trees): a trunk and three leaf clumps."""
    ms.cyl('snb_bark', 0.018 * s, 0.013 * s, 0.2 * s, at=(x, y, G), segs=6, lod=lod)
    offs = ((0.0, 0.0, 0.27, 0.11), (0.06, 0.03, 0.22, 0.08), (-0.05, -0.04, 0.23, 0.08))
    for k, (ox, oy, oz, r) in enumerate(offs):
        ms.sphere('snb_leaf', r * s, at=(x + ox * s, y + oy * s, G + oz * s), scale=(1, 1, 0.85), u=7, v=5, lod=lod if k == 0 else 0)


def bush(ms, x, y, s=1.0):
    ms.sphere('snb_leaf', 0.05 * s, at=(x, y, G + 0.03 * s), scale=(1, 1, 0.75), u=6, v=4, lod=0)


def corner_bushes(ms, rng, f, w, d, n=2):
    """Green bushes at a few of a plot's corners, outside its fence or wall (roofscape sheet)."""
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    rng.shuffle(corners)
    for sx, sy in corners[:n]:
        p = f @ Vector((sx * (w / 2 + 0.02), sy * (d / 2 + 0.02), 0))
        bush(ms, p.x, p.y, rng.uniform(0.8, 1.25))


def garden_bed(ms, f, x, y, w, d, lod=1):
    ms.box('snb_garden', (w, d, 0.014), at=(x, y, G), lod=lod, frame=f, bevel=0.003)


# ---- walls and frames ---------------------------------------------------------------------------

def _walls(ms, f, bw, bd, h, z, post_step, door_x, door_w, wall='snb_earth', post='snb_timber', rail=True, corner=0.02, lod=2):
    """Rammed-earth walls between timber posts (materials sheet): a box of earth, posts at the
    corners and every `post_step`, a mid rail and a sill rail."""
    ms.box(wall, (bw, bd, h), at=(0, 0, z), lod=lod, frame=f, bevel=0.003)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box(post, (corner, corner, h + 0.006), at=(sx * (bw / 2 - corner * 0.3), sy * (bd / 2 - corner * 0.3), z), lod=0, frame=f)
    n = max(2, round(bw / post_step))
    for sy in (-1, 1):
        for i in range(1, n):
            px = -bw / 2 + bw * i / n
            if sy < 0 and abs(px - door_x) < door_w / 2 + 0.02:
                continue
            ms.box(post, (0.014, 0.008, h), at=(px, sy * (bd / 2 + 0.003), z), lod=0, frame=f)
    m = max(1, round(bd / post_step))
    for sx in (-1, 1):
        for i in range(1, m):
            ms.box(post, (0.008, 0.014, h), at=(sx * (bw / 2 + 0.003), -bd / 2 + bd * i / m, z), lod=0, frame=f)
    if rail:
        for zz in (z + h * 0.62,):
            ms.box(post, (bw + 0.012, bd + 0.012, 0.01), at=(0, 0, zz), lod=0, frame=f)


def _door(ms, f, x, y, w, h, z=G, jamb='snb_timber'):
    ms.box('snb_door', (w, 0.01, h), at=(x, y - 0.004, z), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box(jamb, (0.016, 0.014, h + 0.01), at=(x + sx * (w / 2 + 0.008), y - 0.006, z), lod=0, frame=f)
    ms.box('snb_timber', (w + 0.04, 0.016, 0.014), at=(x, y - 0.006, z + h), lod=0, frame=f)


def _window(ms, f, x, y, z, w=0.05, h=0.045, face=-1):
    ms.box('snb_mat', (w, 0.008, h), at=(x, y + face * 0.004, z), lod=0, frame=f)


def _steps(ms, f, x, y0, w, h, z=G, n=5, run=0.03, mat='snb_stone', cheeks=True, lod=1, toward=-1):
    """A flight of n steps up to height h at the front edge y0 (descending toward local `toward`)."""
    for s in range(n):
        sh = h * (n - s) / n
        ms.box(mat, (w, run + 0.002, sh), at=(x, y0 + toward * (s + 0.5) * run, z), lod=lod, frame=f)
    if cheeks:
        for sx in (-1, 1):
            ms.box('snb_platform', (0.03, n * run, h * 0.7), at=(x + sx * (w / 2 + 0.015), y0 + toward * n * run / 2, z), lod=0, frame=f)


def platform(ms, f, w, d, h, x=0.0, y=0.0, mat='snb_platform', lod=2, posts=0.0):
    """A rammed-earth platform (slightly battered); `posts` > 0 sets timber posts into its faces
    every `posts` units (the shrine's sheet)."""
    ms.box(mat, (w, d, h + 0.01), at=(x, y, G - 0.01), lod=lod, frame=f, bevel=0.006, taper=0.975)
    if posts > 0:
        for sy in (-1, 1):
            n = max(2, round(w / posts))
            for i in range(n + 1):
                ms.box('snb_post', (0.016, 0.016, h + 0.02), at=(x - w / 2 + w * i / n, y + sy * (d / 2 + 0.006), G - 0.01), lod=0, frame=f)
        for sx in (-1, 1):
            n = max(2, round(d / posts))
            for i in range(1, n):
                ms.box('snb_post', (0.016, 0.016, h + 0.02), at=(x + sx * (w / 2 + 0.006), y - d / 2 + d * i / n, G - 0.01), lod=0, frame=f)


def railing(ms, f, pts, z, h=0.05, mat='snb_red', step=0.11, gaps=(), lod=0):
    """A low lacquered railing along a polyline: a top rail, a mid rail and balusters."""
    for si, ((x0, y0), (x1, y1)) in enumerate(zip(pts, pts[1:])):
        length = math.hypot(x1 - x0, y1 - y0)
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
            ms.box(mat, (b - a, 0.01, 0.01), at=(x0 + ux * m, y0 + uy * m, z + h), rot_z=yaw, lod=max(lod, 1), frame=f)
            ms.box(mat, (b - a, 0.006, 0.008), at=(x0 + ux * m, y0 + uy * m, z + h * 0.45), rot_z=yaw, lod=lod, frame=f)
            n = max(1, round((b - a) / step))
            for i in range(n + 1):
                p = a + (b - a) * i / n
                ms.box(mat, (0.01, 0.01, h), at=(x0 + ux * p, y0 + uy * p, z), rot_z=yaw, lod=lod, frame=f)


# ---- houses -------------------------------------------------------------------------------------
# Every house fills its plot (w x d, local -Y the front toward the town centre). The options of
# the base slots are read as: awning (a team-cloth shade at the door), front_fence (a staked front
# yard), yard (a fenced yard behind), porch (rich: a gabled gate porch over the steps), side/garden
# (poor: which side the hut stands, and whether the rest is a garden or a woodpile).

def poor_house(ms, rng, x, y, w, d, yaw=None, yard=0.0, side=None, garden=True, awning=False, front_fence=True, **_):
    """The poor hut (sheet: 4 x 6 m, 2.8 m): rammed-earth panels between posts, a plank door in
    its narrow front, a steep hip-and-gable thatch with crossed poles; the rest of the plot a
    staked yard with a garden bed or a woodpile, pots and a rack."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hw = min(max(w * 0.55, 0.34), 0.46)
    hd = min(max(d * 0.82, 0.42), 0.58)
    side = side if side is not None else rng.choice([-1, 1])
    hx = side * (w - hw) / 2 * 0.9
    hf = f @ Matrix.Translation(Vector((hx, (d - hd) / 2 * 0.6, 0)))
    over = 0.045
    bw, bd, h = hw - 2 * over, hd - 2 * over, 0.15
    _walls(ms, hf, bw, bd, h, G, 0.12, 0.0, 0.07, corner=0.018)
    ms.box('snb_stone', (bw + 0.012, bd + 0.012, 0.016), at=(0, 0, G - 0.004), lod=0, frame=hf)
    _door(ms, hf, 0.0, -bd / 2, 0.07, 0.12)
    rf, r = hipgable_roof(ms, hf, hw, hd, G + h + 0.006, 0.2, 'snb_thatch', axis='y', k=0.45, band=0.03)
    ridge(ms, rf, r, G + h + 0.006 + 0.2, pegs=2, cross=0.08)
    pot(ms, hf, 0.075, -bd / 2 - 0.04, 0.9)
    tt.basket(ms, hf, -0.075, -bd / 2 - 0.035, 1.0)
    if awning:
        tt.front_shade(ms, hf, 0.0, -hd / 2 + 0.03, 0.18, depth=0.1, z=0.15, mat='team_cloth')
    rest = w - hw
    gx = -side * hw / 2 * 1.0
    if rest > 0.14:
        if garden:
            garden_bed(ms, f, gx, d * 0.05, rest * 0.7, d * 0.45)
            rack(ms, gx, -d * 0.3, 0, f=f)
        else:
            woodpile(ms, gx, d * 0.15, 90, f=f)
            bits(ms, f, gx, -d * 0.28, rng, 2)
    if front_fence:  # the staked yard round the whole plot (roofscape sheet), a gap at the door
        fx0, fx1, fy0, fy1 = -w / 2 + 0.02, w / 2 - 0.02, -d / 2 - 0.02, d / 2 - 0.01
        cx = hx / (fx1 - fx0) + 0.5
        fence(ms, f, [(fx0, fy1), (fx0, fy0), (fx1, fy0), (fx1, fy1), (fx0, fy1)], h=0.075, gaps=((1, cx, 0.1),))
        corner_bushes(ms, rng, f, w, d)
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def _yard(ms, rng, f, w, d, yard):
    """A staked yard behind the house (toward the town's edge) with a garden bed, a shed, pots or
    a woodpile, and now and then a tree."""
    y0, y1 = d / 2 - 0.01, d / 2 + yard
    fence(ms, f, [(-w / 2 + 0.02, y0), (-w / 2 + 0.02, y1), (w / 2 - 0.02, y1), (w / 2 - 0.02, y0)], h=0.085)
    ym = (y0 + y1) / 2
    r = rng.random()
    if r < 0.4:
        garden_bed(ms, f, -w * 0.18, ym, w * 0.45, yard * 0.55)
        bits(ms, f, w * 0.25, ym, rng, 2)
    elif r < 0.7:
        shed(ms, w * 0.22, ym, 0, f=f)
        bits(ms, f, -w * 0.2, ym, rng, 3)
    else:
        woodpile(ms, -w * 0.15, ym, 0, f=f)
        big_jar(ms, f, w * 0.28, ym, 0.9)
    for sx in (-1, 1):
        if rng.random() < 0.6:
            bush(ms, *(f @ Vector((sx * (w / 2 - 0.05), y1 - 0.05, 0)))[:2], s=rng.uniform(0.8, 1.2))
    if rng.random() < 0.35:
        p = f @ Vector((rng.choice((-1, 1)) * (w / 2 - 0.07), y1 - 0.07, 0))
        tree(ms, p.x, p.y, rng.uniform(0.75, 0.95), lod=1)


def hall(ms, rng, f, w, d, z, wall_h, rise, door_x=0.0, windows=True, back_window=True, k=0.42, ridge_pegs=None):
    """The common hall (materials sheet: 8.4 m, 4.8 m on a 0.6 m stone footing): rammed earth
    between dark posts, a plank double door, reed-mat windows, the hip-and-gable thatch."""
    over = 0.05
    bw, bd = w - 2 * over, d - 2 * over
    _walls(ms, f, bw, bd, wall_h, z, 0.16, door_x, 0.09)
    _door(ms, f, door_x, -bd / 2, 0.085, wall_h * 0.72, z=z)
    if windows:
        for wx in (-bw * 0.32, bw * 0.32):
            if abs(wx - door_x) > 0.1:
                _window(ms, f, wx, -bd / 2, z + wall_h * 0.36, w=0.06, h=0.05)
    if back_window:
        _window(ms, f, rng.uniform(-0.2, 0.2) * bw, bd / 2, z + wall_h * 0.4, face=1)
    rf, r = hipgable_roof(ms, f, w, d, z + wall_h + 0.006, rise, 'snb_thatch', k=k)
    ridge(ms, rf, r, z + wall_h + 0.006 + rise, pegs=ridge_pegs or max(2, round(2 * r / 0.13)))
    return bw, bd


def common_house(ms, rng, x, y, w, d, yaw=None, yard=0.0, awning=False, front_fence=False, **_):
    """The common courtyard house (sheet: 8 x 10 m, 3.8 m): a rammed-earth wall round the plot
    with a small thatched gatehouse in its front, the hall across the back on a low footing with
    steps, two thatched side sheds facing the court."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    t, wh = 0.03, 0.15
    W, D = w / 2, d / 2
    gx = rng.uniform(-0.12, 0.12) * w
    gw = 0.12
    # the compound wall (four sides; the front in two parts beside the gate)
    ms.box('snb_earth', (w, t, wh), at=(0, D - t / 2, G), lod=1, frame=f, bevel=0.003)
    for sx in (-1, 1):
        ms.box('snb_earth', (t, d - 2 * t, wh), at=(sx * (W - t / 2), 0, G), lod=1, frame=f, bevel=0.003)
    for a, b in ((-W, gx - gw / 2), (gx + gw / 2, W)):
        if b - a > 0.02:
            ms.box('snb_earth', (b - a, t, wh), at=((a + b) / 2, -D + t / 2, G), lod=1, frame=f, bevel=0.003)
    # the gatehouse: two posts, plank leaves, a little hip-and-gable thatch
    for sx in (-1, 1):
        ms.box('snb_timber', (0.018, 0.018, wh + 0.04), at=(gx + sx * (gw / 2 + 0.005), -D + t / 2, G), lod=0, frame=f)
    ms.box('snb_door', (gw, 0.01, wh - 0.01), at=(gx, -D + t / 2, G), lod=1, frame=f)
    gf = f @ Matrix.Translation(Vector((gx, -D + t / 2, 0)))
    hipgable_roof(ms, gf, gw + 0.11, 0.1, G + wh + 0.04, 0.075, k=0.4, band=0.022, lod=1)
    # the hall across the back
    hd = min(0.36, d * 0.5)
    hy = D - t - hd / 2 + 0.01
    hf = f @ Matrix.Translation(Vector((0, hy, 0)))
    ms.box('snb_stone', (w - 2 * t - 0.03, hd - 0.04, 0.03), at=(0, 0, G - 0.005), lod=1, frame=hf, bevel=0.003)
    hall(ms, rng, hf, w - 2 * t + 0.02, hd, G + 0.025, 0.19, 0.24, door_x=rng.uniform(-0.1, 0.1) * w)
    _steps(ms, hf, 0.0, -(hd - 0.04) / 2, 0.1, 0.025, n=2, run=0.02, cheeks=False, lod=0)
    # the side sheds (lean-to thatch on posts, open to the court)
    sd = max(0.0, (d - hd) - 2 * t - 0.12)
    if sd > 0.1:
        sw = min(0.14, w * 0.22)
        for sx in (-1, 1):
            cx = sx * (W - t - sw / 2)
            cy = -D + t + 0.04 + sd / 2
            sf = f @ Matrix.Translation(Vector((cx, cy, 0))) @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
            # local frame: X along the shed (along the plot's depth), -Y toward the court
            ms.box('snb_earth', (sd - 0.02, sw * 0.6, 0.12), at=(0, sw * 0.18, G), lod=0, frame=sf)
            for px in (-sd / 2 + 0.02, 0.0, sd / 2 - 0.02):
                ms.box('snb_timber', (0.014, 0.014, 0.12), at=(px, -sw / 2 + 0.02, G), lod=0, frame=sf)
            rf, r = hipgable_roof(ms, sf, sd + 0.04, sw + 0.04, G + 0.13, 0.12, k=0.4, band=0.025, lod=1)
            ridge(ms, rf, r, G + 0.25, pegs=2, cross=0.06, bundle=0.01, lod=0)
    # the court: pots, a rack, a basket
    bits(ms, f, -w * 0.15, -D + 0.17, rng, 3)
    if rng.random() < 0.5:
        rack(ms, w * 0.12, -D + 0.2, 0, f=f)
    else:
        big_jar(ms, f, w * 0.15, -D + 0.17, 0.9)
    if awning:
        tt.front_shade(ms, f, gx, -D - 0.005, 0.2, depth=0.1, z=0.15, mat='team_cloth')
    corner_bushes(ms, rng, f, w + 0.03, d + 0.03)
    if front_fence:
        fy = -D - 0.1
        fence(ms, f, [(-W + 0.02, -D + 0.005), (-W + 0.02, fy), (W - 0.02, fy), (W - 0.02, -D + 0.005)], h=0.075,
              gaps=((1, 0.5 + gx / (w - 0.04), 0.13),))
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def rich_house(ms, rng, x, y, w, d, yaw=None, porch=False, yard=0.0, awning=False, front=0.0, **_):
    """The rich hall (sheet: 12 x 16 m, 5 m): a rammed-earth platform with stone steps at the
    front, a veranda of red-lacquered posts and a red railing round a hall of dark lattice panels
    and a red door, under a big hip-and-gable thatch with a tied ridge. `porch` adds a gabled
    gate porch over the steps; `front` > 0 a staked front yard."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ph = 0.07
    pw, pd = w - 0.04, d - 0.08
    py = 0.03
    platform(ms, f, pw, pd, ph, y=py)
    z = G + ph
    # the hall and its veranda
    vw, vd = pw - 0.05, pd - 0.05
    hw, hd = vw - 0.12, vd - 0.12
    hf = f @ Matrix.Translation(Vector((0, py, 0)))
    ms.box('snb_plank', (hw, hd, 0.24), at=(0, 0, z), lod=2, frame=hf, bevel=0.003)
    n = max(3, round(hw / 0.1))
    for i in range(1, n):  # lattice posts on the front
        ms.box('snb_timber', (0.012, 0.008, 0.24), at=(-hw / 2 + hw * i / n, -hd / 2 - 0.003, z), lod=0, frame=hf)
    ms.box('snb_red', (0.11, 0.012, 0.18), at=(0, -hd / 2 - 0.004, z), lod=1, frame=hf)  # the red double door
    ms.box('snb_timber', (0.004, 0.014, 0.18), at=(0, -hd / 2 - 0.006, z), lod=0, frame=hf)
    for wx in (-hw * 0.3, hw * 0.3):
        _window(ms, hf, wx, -hd / 2, z + 0.1, w=0.07, h=0.07)
    # red posts round the veranda
    nx = max(4, round(vw / 0.12))
    ny = max(2, round(vd / 0.12))
    for i in range(nx + 1):
        for sy in (-1, 1):
            ms.box('snb_red', (0.02, 0.02, 0.25), at=(-vw / 2 + vw * i / nx, sy * vd / 2, z), lod=1 if sy < 0 and i % 2 == 0 else 0, frame=hf)
    for j in range(1, ny):
        for sx in (-1, 1):
            ms.box('snb_red', (0.02, 0.02, 0.25), at=(sx * vw / 2, -vd / 2 + vd * j / ny, z), lod=0, frame=hf)
    ms.box('snb_timber', (vw + 0.02, vd + 0.02, 0.016), at=(0, 0, z + 0.24), lod=1, frame=hf)  # the plate
    sw = min(0.2, w * 0.24)
    railing(ms, hf, [(-sw / 2, -vd / 2), (-vw / 2, -vd / 2), (-vw / 2, vd / 2), (vw / 2, vd / 2), (vw / 2, -vd / 2), (sw / 2, -vd / 2)], z,
            h=0.045, step=0.11)
    rf, r = hipgable_roof(ms, hf, pw + 0.06, pd + 0.02, z + 0.256, 0.3, 'snb_thatch', k=0.4, band=0.04)
    ridge(ms, rf, r, z + 0.256 + 0.3, pegs=max(3, round(2 * r / 0.12)), cross=0.11, bundle=0.02)
    _steps(ms, f, 0.0, py - pd / 2, sw, ph, n=5, run=0.022)
    if porch:  # a gabled gate porch on red posts over the foot of the steps
        yy = py - pd / 2 - 5 * 0.022 - 0.03
        for sx in (-1, 1):
            ms.box('snb_red', (0.02, 0.02, 0.22), at=(sx * (sw / 2 + 0.03), yy, G), lod=1, frame=f)
        pf = f @ Matrix.Translation(Vector((0, yy, 0)))
        hipgable_roof(ms, pf, sw + 0.16, 0.12, G + 0.22, 0.08, k=0.4, band=0.022, lod=1)
    if awning:
        tt.front_shade(ms, f, pw * 0.3, py - pd / 2 + 0.01, 0.2, depth=0.12, z=0.17, mat='team_cloth')
    for k in range(2):  # bronze and clay vessels by the steps
        pot(ms, f, (sw / 2 + 0.06 + 0.05 * k), py - pd / 2 - 0.035, 1.0, mat='snb_bronze' if k == 0 else 'snb_pot')
    if front > 0.04:
        fy = -d / 2 - front
        fence(ms, f, [(-w / 2, py - pd / 2 + 0.02), (-w / 2, fy), (w / 2, fy), (w / 2, py - pd / 2 + 0.02)], h=0.08,
              gaps=((1, 0.5, 0.16),))
        bush(ms, *(f @ Vector((-w * 0.36, fy + 0.06, 0)))[:2])
        bush(ms, *(f @ Vector((w * 0.36, fy + 0.06, 0)))[:2], s=0.8)
    if yard > 0:
        _yard(ms, rng, f, w, d, yard)
    return f


def sinic_house(ms, rng, slot):
    """Build one house from a slot dict: x, y, w, d, kind ('poor', 'common', 'rich') and options."""
    s = dict(slot)
    kind = s.pop('kind')
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    return {'poor': poor_house, 'common': common_house, 'rich': rich_house}[kind](ms, rng, x, y, w, d, **s)


# ---- the street: stalls, the well, the gate, granaries ------------------------------------------

def stall(ms, x, y, rng, yaw=None, cloth='team_cloth', w=0.28, d=0.2):
    """A market stall: four timber posts, a reed-mat or team-cloth roof, a plank counter with
    pots, bronze vessels and baskets, a big jar beside it."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hf, hb = 0.18, 0.22
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('snb_post', (0.014, 0.014, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('snb_post', (0.014, 0.014, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    cf = f @ Matrix.Translation(Vector((0, 0, G + (hf + hb) / 2 + 0.008))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(cloth, (w + 0.05, d + 0.06, 0.01), at=(0, 0, 0), lod=1, frame=cf)
    ms.box('snb_plank', (w - 0.03, d * 0.45, 0.065), at=(0, -d * 0.18, G), lod=0, frame=f, bevel=0.003)
    for kk in range(3):
        gx = -w / 2 + 0.06 + kk * (w - 0.12) / 2
        r = rng.random()
        if r < 0.35:
            tt.basket(ms, f, gx, -d * 0.18, 0.8, z=G + 0.065)
        elif r < 0.7:
            pot(ms, f, gx, -d * 0.18, 0.55, z=G + 0.065, mat='snb_bronze')
        else:
            pot(ms, f, gx, -d * 0.18, 0.6, z=G + 0.065)
    big_jar(ms, f, w / 2 + 0.035, -d / 2 + 0.01, rng.uniform(0.6, 0.75))


def well(ms, x, y, yaw=20):
    """The street's well (the shared kit's stone well with its timber frame and bucket)."""
    return tt.well(ms, x, y, yaw)


def gate(ms, rng, x, y, yaw=0.0, width=0.5, h=0.34):
    """The town gate: two rammed-earth wall stubs, a timber gatehouse on four posts with plank
    leaves and a hip-and-gable thatch with a tied ridge, a team pennant on a pole."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        ms.box('snb_earth', (0.55, 0.09, 0.24), at=(sx * (width / 2 + 0.3), 0, G), lod=2, frame=f, bevel=0.004, taper=0.96)
        for sy in (-1, 1):
            ms.box('snb_timber', (0.03, 0.03, h), at=(sx * (width / 2 + 0.01), sy * 0.06, G), lod=1, frame=f)
        lf = f @ Matrix.Translation(Vector((sx * (width / 2 - 0.01), -0.06, G))) @ Matrix.Rotation(math.radians(sx * -70), 4, 'Z')
        ms.box('snb_door', (0.012, width / 2 - 0.02, h * 0.7), at=(0, -(width / 2 - 0.02) / 2, 0), lod=1, frame=lf)
    ms.box('snb_timber', (width + 0.12, 0.16, 0.03), at=(0, 0, G + h), lod=1, frame=f)
    rf, r = hipgable_roof(ms, f, width + 0.24, 0.26, G + h + 0.04, 0.16, k=0.42, band=0.03, gable_lod=1)
    ridge(ms, rf, r, G + h + 0.2, pegs=4, cross=0.09, ends=1)
    px = -(width / 2 + 0.58)
    ms.cyl('snb_timber', 0.01, 0.008, 0.4, at=(px, 0, G + 0.24), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, px, 0, G + 0.635, yaw=-160, w=0.2, h=0.12)


def raised_granary(ms, x, y, yaw=0.0, s=1.0):
    """A plank granary raised on four posts under a hip-and-gable thatch, a ladder up."""
    f = tm.house_frame(x, y, yaw)
    w, d = 0.24 * s, 0.2 * s
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('snb_post', 0.014, 0.014, 0.09, at=(sx * w * 0.4, sy * d * 0.4, G), segs=6, lod=1, frame=f)
    ms.box('snb_timber', (w + 0.03, d + 0.03, 0.02), at=(0, 0, G + 0.09), lod=1, frame=f)
    ms.box('snb_plank', (w, d, 0.13 * s), at=(0, 0, G + 0.11), lod=2, frame=f, bevel=0.003)
    ms.box('snb_door', (0.06, 0.01, 0.08), at=(0, -d / 2 - 0.003, G + 0.115), lod=0, frame=f)
    rf, r = hipgable_roof(ms, f, w + 0.08, d + 0.08, G + 0.11 + 0.13 * s, 0.16 * s, k=0.42, band=0.025)
    ridge(ms, rf, r, G + 0.11 + 0.29 * s, pegs=2, cross=0.07, bundle=0.01, lod=0)
    tt.ladder(ms, f, 0.03, -d / 2 - 0.07, 0.11, lean=22)


# ---- landmark 1: the bronze-casting hall ---------------------------------------------------------

def furnace(ms, f, x, y, z, s=1.0, lod=1):
    """A beehive furnace of packed clay with a dark stoke hole, its chimney mouth at the top."""
    p = [(0.0, 0.0), (0.075, 0.0), (0.078, 0.05), (0.07, 0.11), (0.05, 0.16), (0.03, 0.185), (0.022, 0.19), (0.0, 0.19)]
    ms.lathe('snb_clay', [(r * s, zz * s + z) for r, zz in p], at=(x, y, 0), segs=12, lod=lod, frame=f)
    ms.box('dark', (0.05 * s, 0.01, 0.05 * s), at=(x, y - 0.074 * s, z), lod=0, frame=f)
    ms.cyl('ash', 0.022 * s, 0.022 * s, 0.006, at=(x, y, z + 0.19 * s), segs=8, lod=0, frame=f)


def mould(ms, f, x, y, z, s=1.0, yaw=0.0):
    """A clay piece-mould block (materials sheet)."""
    ms.box('snb_clay', (0.035 * s, 0.03 * s, 0.04 * s), at=(x, y, z), rot_z=yaw, lod=0, frame=f, bevel=0.003)


def vessel(ms, f, x, y, z, s=1.0):
    """A bronze ding: a round bowl on three legs with two handles, green patina."""
    for k in range(3):
        a = 2 * math.pi * k / 3 + 0.5
        ms.box('snb_bronze', (0.008 * s, 0.008 * s, 0.03 * s), at=(x + 0.02 * s * math.cos(a), y + 0.02 * s * math.sin(a), z), lod=0, frame=f)
    p = [(0.0, 0.0), (0.03, 0.006), (0.034, 0.042), (0.0, 0.042)]
    ms.lathe('snb_bronze', [(r * s, zz * s + z + 0.026 * s) for r, zz in p], at=(x, y, 0), segs=8, lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('snb_bronze', (0.006 * s, 0.014 * s, 0.018 * s), at=(x + sx * 0.026 * s, y, z + 0.068 * s), lod=0, frame=f)


def table(ms, f, x, y, z, w=0.12, d=0.06, h=0.05):
    ms.box('snb_plank', (w, d, 0.012), at=(x, y, z + h - 0.012), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('snb_timber', (0.01, d - 0.01, h - 0.012), at=(x + sx * (w / 2 - 0.01), y, z), lod=0, frame=f)


def casting_hall(ms, rng, x, y, w=1.8, d=1.2, yaw=None, top=1.0):
    """The bronze-casting hall (sheet: a 16 x 10 m hall on an 18 x 12 m rammed-earth platform,
    10 m to the ridge): a wide front stair between cheek blocks, an open frame of timber posts
    with a plank back wall and woven bamboo gables, a gable thatch with a pegged ridge and crossed
    ends, a staked fence round the platform's sides and back; inside a beehive furnace, work
    tables, clay moulds, ingots and bronze vessels. Smaller spots scale the plan; the height
    shrinks only a little."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    s = min(w / 1.8, d / 1.2)
    hs = min(1.0, 0.75 + 0.25 * s)
    ph = 0.13 * hs
    platform(ms, f, w, d, ph)
    z = G + ph
    hw, hd = w * 0.86, d * 0.78
    hy = d * 0.04
    hf = f @ Matrix.Translation(Vector((0, hy, 0)))
    post_h = 0.4 * hs
    rise = top * hs - (ph + post_h) - G - 0.03
    # the posts: front and back rows, gable rows
    nx = max(4, round(hw / 0.27))
    for i in range(nx + 1):
        px = -hw / 2 + hw * i / nx
        for sy in (-1, 1):
            ms.box('snb_post', (0.03, 0.03, post_h), at=(px, sy * hd / 2, z), lod=1, frame=hf)
            ms.cyl('snb_stone', 0.026, 0.03, 0.016, at=(px, sy * hd / 2, z), segs=6, lod=0, frame=hf)
    for sx in (-1, 1):
        ms.box('snb_post', (0.03, 0.03, post_h + rise * 0.55), at=(sx * hw / 2, 0, z), lod=1, frame=hf)
    obox(ms, 'snb_post', (hw, hd, post_h * 0.9), at=(0, 0, z), frame=hf, lod=2, only=2)  # LOD2: the hall's block
    ms.box('snb_timber', (hw + 0.04, 0.03, 0.03), at=(0, -hd / 2, z + post_h - 0.03), lod=1, frame=hf)  # plates
    ms.box('snb_timber', (0.03, hd + 0.04, 0.03), at=(-hw / 2, 0, z + post_h - 0.03), lod=1, frame=hf)
    ms.box('snb_timber', (0.03, hd + 0.04, 0.03), at=(hw / 2, 0, z + post_h - 0.03), lod=1, frame=hf)
    ms.box('snb_plank', (hw, 0.02, post_h), at=(0, hd / 2 - 0.01, z), lod=1, frame=hf)  # the back wall
    for i in range(1, nx):  # tie beams across
        ms.box('snb_timber', (0.02, hd, 0.022), at=(-hw / 2 + hw * i / nx, 0, z + post_h - 0.02), lod=0, frame=hf)
    rf, r = gable_roof(ms, hf, hw + 0.16, hd + 0.3, z + post_h, rise, band=0.045, inset=0.08)
    ridge(ms, rf, r - 0.03, z + post_h + rise, pegs=max(4, round(2 * r / 0.1)), cross=0.16, bundle=0.024, ends=1)
    # the poles held down across the slopes (top view)
    for px in (-hw * 0.18, hw * 0.18):
        for sy in (-1, 1):
            a = math.atan2(rise, (hd + 0.3) / 2)
            pf = hf @ Matrix.Translation(Vector((px, sy * (hd + 0.3) / 4, z + post_h + rise / 2 + 0.008))) @ Matrix.Rotation(-sy * a, 4, 'X')
            ms.box('snb_timber', (0.012, math.hypot(rise, (hd + 0.3) / 2) - 0.02, 0.012), at=(0, 0, 0), lod=0, frame=pf)
    # the front stair
    sw = 0.42 * max(0.6, s)
    _steps(ms, f, 0.0, -d / 2, sw, ph, n=6, run=0.032, mat='snb_platform')
    # the staked fence on the platform's sides and back
    e = 0.025
    fence(ms, f, [(-w / 2 + e, -d / 2 + 0.12), (-w / 2 + e, d / 2 - e), (w / 2 - e, d / 2 - e), (w / 2 - e, -d / 2 + 0.12)],
          h=0.12 * hs, step=0.24)
    # the furnace and the work floor
    zf = z + 0.002
    furnace(ms, hf, -hw * 0.22, 0.02, zf, s=max(0.75, hs))
    nt = max(3, round(hw / 0.3))
    for i in range(nt):
        tx = -hw / 2 + 0.12 + (hw - 0.24) * i / max(1, nt - 1)
        if abs(tx + hw * 0.22) < 0.12:
            continue
        ty = -hd * 0.18 + rng.uniform(-0.03, 0.03)
        table(ms, hf, tx, ty, zf)
        for k in range(2):
            if rng.random() < 0.5:
                mould(ms, hf, tx - 0.03 + 0.06 * k, ty, zf + 0.05, s=0.9, yaw=rng.uniform(-15, 15))
            else:
                vessel(ms, hf, tx - 0.03 + 0.06 * k, ty, zf + 0.05, s=0.6)
    for i in range(max(4, round(hw / 0.22))):  # moulds and vessels along the back wall
        bx = -hw / 2 + 0.1 + (hw - 0.2) * i / max(1, round(hw / 0.22) - 1)
        if abs(bx + hw * 0.22) < 0.1:
            continue
        if i % 2:
            vessel(ms, hf, bx, hd / 2 - 0.08, zf, s=0.9)
        else:
            mould(ms, hf, bx, hd / 2 - 0.07, zf, s=1.2)
            mould(ms, hf, bx + 0.04, hd / 2 - 0.08, zf, s=1.0, yaw=20)
    for k in range(3):  # charcoal and ore heaps, crucibles
        ms.sphere('ash', 0.04, at=(-hw * 0.22 + 0.12 + 0.05 * k, 0.1, zf), scale=(1, 1, 0.45), u=7, v=4, lod=0, frame=hf, cut_below=0.0)
    for k in range(3):
        pot(ms, hf, -hw * 0.22 - 0.1, -0.05 + 0.045 * k, 0.6, z=zf, mat='snb_clay')
    # clay and charcoal outside at the foot of the platform
    bits(ms, f, w / 2 - 0.1, -d / 2 - 0.08, rng, 3)
    woodpile(ms, -w / 2 + 0.16, -d / 2 - 0.08, 0, f=f)
    return f


# ---- landmark 2: the oracle shrine with its drum tower --------------------------------------------

def drum_tower(ms, f, x, y, z, s=1.0, top=1.4, base=G):
    """The drum tower (sheet: 4 x 4 m, 14 m with the finial): four tall posts with cross bracing,
    a plank-clad middle storey, an open top floor with a railing and a big hide drum lying on a
    frame, a pyramid thatch roof with a timber knob."""
    tf = f @ Matrix.Translation(Vector((x, y, 0)))
    a = 0.2 * s  # half the post square
    roof_h = 0.24 * s
    eave = top - roof_h - 0.05
    floor2 = z + (eave - z) * 0.48
    floor3 = z + (eave - z) * 0.74
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('snb_post', (0.034, 0.034, eave - z + 0.01), at=(sx * a, sy * a, z), lod=1, frame=tf)
    obox(ms, 'snb_post', (2 * a, 2 * a, eave - z), at=(0, 0, z), frame=tf, lod=2, only=2)
    for zz in (floor2, floor3, eave - 0.03):  # ring beams
        for sy in (-1, 1):
            ms.box('snb_timber', (2 * a + 0.06, 0.026, 0.026), at=(0, sy * a, zz), lod=1, frame=tf)
            ms.box('snb_timber', (0.026, 2 * a + 0.06, 0.026), at=(sy * a, 0, zz), lod=1, frame=tf)
    # cross bracing on the lower stage (a diagonal pair on each face)
    lo, hi = z + 0.02, floor2
    L = math.hypot(2 * a, hi - lo)
    ang = math.atan2(2 * a, hi - lo)
    for face in range(4):
        rot = Matrix.Rotation(math.radians(90 * face), 4, 'Z')
        for sgn in (-1, 1):
            bf = tf @ rot @ Matrix.Translation(Vector((0, -a - 0.012, (lo + hi) / 2))) @ Matrix.Rotation(sgn * ang, 4, 'Y')
            ms.box('snb_timber', (0.016, 0.014, L), at=(0, 0, -L / 2), lod=1, frame=bf)
    # the plank-clad middle storey
    ms.box('snb_plank', (2 * a, 2 * a, floor3 - floor2 - 0.01), at=(0, 0, floor2 + 0.02), lod=1, frame=tf)
    ms.box('snb_timber', (2 * a + 0.08, 2 * a + 0.08, 0.02), at=(0, 0, floor3), lod=1, frame=tf)  # the drum floor
    railing(ms, tf, [(-a - 0.03, -a - 0.03), (a + 0.03, -a - 0.03), (a + 0.03, a + 0.03), (-a - 0.03, a + 0.03), (-a - 0.03, -a - 0.03)],
            floor3 + 0.02, h=0.05, mat='snb_timber', step=0.09)
    # the drum lying across, on a cradle
    dr = 0.085 * s
    ms.cyl('snb_hide', dr, dr, 0.26 * s, at=(-0.13 * s, 0, floor3 + 0.02 + dr + 0.02), rot=(0, 90, 0), segs=12, lod=1, frame=tf)
    for sx in (-1, 1):
        ms.cyl('snb_timber', dr + 0.008, dr + 0.008, 0.02, at=(sx * 0.13 * s - (0.02 if sx > 0 else 0), 0, floor3 + 0.02 + dr + 0.02),
               rot=(0, 90, 0), segs=12, lod=0, frame=tf)
        ms.box('snb_timber', (0.02, 0.06, dr + 0.02), at=(sx * 0.1 * s, 0, floor3 + 0.02), lod=0, frame=tf)
    # the pyramid roof and its knob
    R = (a + 0.11) * math.sqrt(2)
    ms.cyl('snb_thatch', R, 0.0, roof_h, at=(0, 0, eave), rot=(0, 0, 45), segs=4, lod=2, frame=tf)
    ms.cyl('snb_thatch', R, R, 0.03, at=(0, 0, eave - 0.03), rot=(0, 0, 45), segs=4, lod=1, frame=tf, caps=True)
    ms.cyl('snb_timber', 0.012, 0.012, 0.05, at=(0, 0, eave + roof_h - 0.02), segs=6, lod=1, frame=tf)
    ms.sphere('snb_timber', 0.024, at=(0, 0, top - 0.024), u=8, v=6, lod=1, frame=tf)
    # a ladder up the inside to the middle storey
    tt.ladder(ms, tf, 0.0, -a * 0.4, floor2 - z, lean=12, z=z)
    return floor3


def oracle_shrine(ms, rng, x, y, w=1.8, d=1.5, yaw=None, top=1.4):
    """The oracle shrine (sheet: an 18 m platform, the 12 m hall 6 m high, the 4 m drum tower
    14 m): a rammed-earth platform faced with timber posts, a wide stair to the hall's front, the
    hall with a veranda of posts round plank walls under a hip-and-gable thatch with a tied ridge,
    bronze cauldrons and an altar table with an oracle shell on the veranda, and the drum tower at
    the back of the platform's east end with a team pennant. Smaller spots scale the plan."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    s = min(w / 1.8, d / 1.5)
    hs = min(1.0, 0.72 + 0.28 * s)
    ph = 0.13 * hs
    platform(ms, f, w, d, ph, posts=0.16)
    z = G + ph
    # the hall: two thirds of the width, at the west, toward the front
    hw = w * 0.64
    hd = min(d * 0.62, hw * 0.78)
    hx = -w / 2 + 0.05 + hw / 2
    hy = -d / 2 + 0.16 * max(0.7, s) + hd / 2
    hf = f @ Matrix.Translation(Vector((hx, hy, 0)))
    wall_h = 0.23 * hs
    iw, idp = hw - 0.16, hd - 0.18
    ms.box('snb_plank', (iw, idp, wall_h), at=(0, 0.02, z), lod=2, frame=hf, bevel=0.003)
    n = max(3, round(iw / 0.12))
    for i in range(1, n):
        ms.box('snb_timber', (0.012, 0.008, wall_h), at=(-iw / 2 + iw * i / n, 0.02 - idp / 2 - 0.003, z), lod=0, frame=hf)
    ms.box('snb_door', (0.1, 0.012, wall_h * 0.75), at=(0, 0.02 - idp / 2 - 0.005, z), lod=1, frame=hf)
    vw, vd = hw - 0.05, hd - 0.04
    nx = max(4, round(vw / 0.15))
    for i in range(nx + 1):
        for sy in (-1, 1):
            ms.box('snb_post', (0.026, 0.026, wall_h), at=(-vw / 2 + vw * i / nx, sy * vd / 2, z), lod=1, frame=hf)
    for sx in (-1, 1):
        ms.box('snb_post', (0.026, 0.026, wall_h), at=(sx * vw / 2, 0, z), lod=1, frame=hf)
    ms.box('snb_timber', (vw + 0.03, vd + 0.03, 0.022), at=(0, 0, z + wall_h - 0.01), lod=1, frame=hf)
    rise = 0.6 * hs - ph - wall_h - 0.01
    rf, r = hipgable_roof(ms, hf, hw + 0.08, hd + 0.1, z + wall_h + 0.01, rise, k=0.4, band=0.04, gable_lod=1)
    ridge(ms, rf, r, z + wall_h + 0.01 + rise, pegs=max(4, round(2 * r / 0.08)), cross=0.13, bundle=0.022, ends=1)
    # the veranda's things: cauldrons either side of the door, the altar table with the shell
    vy = -vd / 2 + 0.05
    for vx in (-vw * 0.38, -vw * 0.2, vw * 0.2, vw * 0.38):
        vessel(ms, hf, vx, vy, z, s=1.15)
    table(ms, hf, 0.0, vy - 0.005, z, w=0.13, d=0.06, h=0.05)
    ms.box('snb_bone', (0.04, 0.03, 0.006), at=(0.0, vy - 0.005, z + 0.05), lod=0, frame=hf)
    # the stair to the hall's front and a side stair at the west end
    sw = 0.36 * max(0.6, s)
    _steps(ms, f, hx, -d / 2, sw, ph, n=6, run=0.03, mat='snb_platform')
    # the drum tower at the back of the east end
    tx = w / 2 - 0.05 - 0.2 * max(0.75, s)
    ty = d / 2 - 0.05 - 0.2 * max(0.75, s)
    drum_tower(ms, f, tx, ty, z, s=max(0.75, s), top=top * hs)
    tt.pennant(ms, f, tx + 0.2 * max(0.75, s) + 0.01, ty - 0.2 * max(0.75, s) - 0.01, z + (top * hs - z) * 0.74, yaw=-150, w=0.18, h=0.11)
    # the open east court: a stone altar, a cauldron and a fire basin
    cx = (hx + hw / 2 + w / 2) / 2
    ms.box('snb_stone', (0.1, 0.07, 0.04), at=(cx, -d * 0.12, z), lod=0, frame=f, bevel=0.004)
    vessel(ms, f, cx, -d * 0.3, z, s=1.4)
    ms.cyl('snb_bronze', 0.04, 0.03, 0.03, at=(cx - 0.12, -d * 0.12, z), segs=8, lod=0, frame=f)
    return f


# ---- building a town file -------------------------------------------------------------------------

def main(file_name, obj_name, layout, ground=None):
    """Build <out_dir>/<file_name>.glb holding one town object `obj_name` (the game reads the
    object by the layout's name, so the Sinic town keeps `town-<size>-<v>`)."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    g = dict(STREET_GROUND)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
