# scripts/blender/build_town_stone.py
# Stone Age map towns (eight-ages plan U89, KTD16): the base style and six regional kits, each in
# small, medium and big, layouts a and b: 42 files of src/assets/map/towns/stone-town-<size>-<v>[-<style>].glb.
# Villages, not cities: round huts of wattle and daub under conical thatch, longhouses, hide
# tents, bark wigwams, pit houses, stilt houses; granaries on posts and storage pits, storage
# platforms, drying racks, hearths, pens with animals, garden plots, and the village's enclosure
# (layout a: a palisade of pointed stakes or, in the Levant, a stone wall; layout b: an earth bank
# with a light fence on top), a gate at the south. Each village has one landmark (small) or two
# (medium, big) with the team pennant on its pole: a chief's great hut, a shrine, the Jericho
# tower, a great longhouse, a platform mound, a compartmented granary, a great tent, a mammoth
# bone hut, a communal stilt house.
#   base       Africa, the Nile, the Maghreb, East Asia and every land without a kit: round huts
#   europe     Linear Pottery longhouses laid parallel, roundhouses, cattle pens, menhirs
#   levant     a: round stone-footed houses with mud domes; b: flat-roofed mud-brick houses with
#              roof ladders (Catalhoyuk); the tower of Jericho (also Mesopotamia, Israel by fallback)
#   indic      Mehrgarh: mud-brick houses under thatch, compartmented granaries, cattle pens
#   monsoon    stilt houses with saddle roofs, raised granaries, dugouts (also the Pacific)
#   americas   a: bark and mat wigwams, fish racks; b: earth pit houses, a bark longhouse
#   steppe     a: hide tents; b: mammoth bone huts; horse pens (Botai)
# Built with ti_town.build_file: one 1024 atlas per file (KTD16: Stone huts take 1024), LOD0, LOD1
# and LOD2 children, materials Town, Ground and Team. Scale: 1 unit = 10 m, heights raised 1.3x,
# the front (south) facing Blender -Y. Deterministic: the layout comes from the file name's seed.
#
#   blender -b --factory-startup -P scripts/blender/build_town_stone.py -- <style|base> <small|medium|big> <a|b> <out_dir> [atlas]
import math
import os
import sys
import zlib

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401  (before bmesh)
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

STYLES = ('base', 'europe', 'levant', 'indic', 'monsoon', 'americas', 'steppe')

# ---- materials ----------------------------------------------------------------------------------

NEW = ['st_daub', 'st_daub_red', 'st_clay', 'st_hide', 'st_hide_dark', 'st_bark', 'st_bone', 'st_turf',
       'st_bamboo', 'st_ochre', 'st_stake', 'st_straw', 'st_pebble', 'st_fleece']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def _make_stone_materials():
    tm.mat_simple('st_daub', ['#8f6a46', '#a57b52', '#b88c60', '#94704b'], scale=16.0, bump=0.35, dirt=True)
    tm.mat_simple('st_daub_red', ['#8a5236', '#9c6040', '#ad6e4a'], scale=16.0, bump=0.35, dirt=True)
    tm.mat_simple('st_clay', ['#c2a073', '#d1b083', '#b69264'], scale=18.0, bump=0.3, dirt=True)
    tm.mat_simple('st_hide', ['#8c6c49', '#a4845e', '#b8966c', '#7c5e40'], scale=9.0, bump=0.25, rough=0.8)
    tm.mat_simple('st_hide_dark', ['#5e4430', '#73553b', '#4f3828'], scale=9.0, bump=0.25, rough=0.8)
    tm.mat_simple('st_bark', ['#5a4a3a', '#6e5c48', '#4c3e31', '#7a6650'], scale=10.0, stripes={'dir': 'Z', 'scale': 70.0, 'distortion': 9.0}, bump=0.5)
    tm.mat_simple('st_bone', ['#cfc2a4', '#e0d6bd', '#bcae8e'], scale=22.0, bump=0.3, rough=0.7)
    tm.mat_simple('st_turf', ['#4f5a2c', '#66703a', '#7a6a40', '#5a6430'], scale=26.0, bump=0.6)
    tm.mat_simple('st_bamboo', ['#a89452', '#bca664', '#8e7c42'], scale=10.0, stripes={'dir': 'Z', 'scale': 90.0, 'distortion': 3.0}, bump=0.4)
    tm.mat_simple('st_ochre', ['#8a3c22', '#a24a2a', '#7a3420'], scale=14.0, bump=0.2)
    tm.mat_simple('st_stake', ['#6e5236', '#85664a', '#5c432c'], scale=10.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 6.0}, bump=0.4)
    tm.mat_simple('st_straw', ['#a88a4c', '#c4a662', '#d6ba78', '#9c7e44'], scale=12.0, stripes={'dir': 'X', 'scale': 150.0, 'distortion': 10.0}, bump=0.6)
    tm.mat_simple('st_pebble', ['#7a7468', '#948d80', '#6a645a'], scale=34.0, bump=0.7)
    tm.mat_simple('st_fleece', ['#cfc6b4', '#ddd5c4', '#b8ae9a'], scale=40.0, bump=0.5)


CUR_GROUND = {'colors': None}


def _make_ground():
    """The ground patch in the style's colours (ti_town's own earth and grass are replaced)."""
    if not CUR_GROUND['colors']:
        return
    for n in ('earth', 'earth_fringe', 'grass', 'grass_fringe'):
        if n in bpy.data.materials:
            bpy.data.materials.remove(bpy.data.materials[n])
        tm.mat_earth(n, colors=CUR_GROUND['colors'])


tt.EXTRA_MATERIALS.append(('stone', _make_stone_materials))
tt.EXTRA_MATERIALS.append(('stone-ground', _make_ground))

# The land's ground per style (earth with trodden patches, or grass): the patch colours.
GROUNDS = {
    'base': ('earth', ('#a8784a', '#bd8b58', '#c99a66', '#9e6f44')),
    'europe': ('grass', ('#5a6e2a', '#6f7f34', '#8f7e4c', '#62742c')),
    'levant': ('earth', ('#b08454', '#c49662', '#cfa670', '#a67a4c')),
    'indic': ('earth', ('#a87a4c', '#bb8c5a', '#c79b68', '#9c7046')),
    'monsoon': ('grass', ('#4e6a28', '#647c30', '#7c7a48', '#58702a')),
    'americas': ('grass', ('#5c6c2c', '#717e36', '#8a7a4a', '#62702e')),
    'steppe': ('grass', ('#76783e', '#8a8646', '#a08c5a', '#7e7c40')),
}

# ---- small helpers ------------------------------------------------------------------------------


def frame_at(x, y, yaw):
    return tm.house_frame(x, y, yaw)


def lcyl(ms, mat, r1, r2, h, at, frame, segs=(12, 8, 6), caps=True, top=2, rot=(0, 0, 0)):
    """A cylinder or cone with fewer sides at each LOD; `top` is the last LOD that shows it."""
    for lod in range(top + 1):
        ms.cyl(mat, r1, r2, h, at=at, rot=rot, segs=segs[lod], frame=frame, caps=caps, only=(lod,), lod=lod)


def ldome(ms, mat, rx, ry, h, at, frame, segs=((12, 6), (8, 4), (6, 3)), top=2):
    """A half ellipsoid dome standing on `at`."""
    for lod in range(top + 1):
        u, v = segs[lod]
        ms.sphere(mat, 1.0, at=(0, 0, 0), u=u, v=v * 2, cut_below=0.0, lod=lod, only=(lod,),
                  frame=frame @ Matrix.Translation(Vector(at)) @ Matrix.Diagonal((rx, ry, h, 1.0)))


def gable(ms, mat, length, depth, h, z, frame, over=0.03, lod=2, hip=0.0, sweep=0.0, only=None):
    """A ridged roof over a rectangle `length` (local x) by `depth` (local y) from height z:
    two slopes and two gable ends. `hip` pulls the ridge ends in (a hipped roof); `sweep` raises
    and pushes the ridge ends out (the saddle roof of the stilt houses)."""
    bm = bmesh.new()
    L, D = length / 2 + over, depth / 2 + over
    rl = max(0.02, L - hip) + sweep
    e = [bm.verts.new(p) for p in ((-L, -D, z), (L, -D, z), (L, D, z), (-L, D, z))]
    r0 = bm.verts.new((-rl, 0, z + h + sweep * 0.6))
    r1 = bm.verts.new((rl, 0, z + h + sweep * 0.6))
    bm.faces.new((e[0], e[1], r1, r0))
    bm.faces.new((e[2], e[3], r0, r1))
    bm.faces.new((e[1], e[2], r1))
    bm.faces.new((e[3], e[0], r0))
    bm.normal_update()
    ms.add(bm, mat, lod, matrix=frame.copy(), only=only)


def arc_band(ms, mat, r, width, h, a0, a1, steps, lod, only=None):
    """A bank: a ring band from angle a0 to a1 (degrees) of trapezoid section, closed at both ends."""
    bm = bmesh.new()
    prof = [(r - width / 2, G * 0.5), (r - width / 5, G + h), (r + width / 5, G + h), (r + width / 2, G * 0.5)]
    rings = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        c, s = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((rr * c, rr * s, z)) for rr, z in prof])
    for p, q in zip(rings, rings[1:]):
        for k in range(len(prof) - 1):
            bm.faces.new((p[k], p[k + 1], q[k + 1], q[k]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bm.normal_update()
    ms.add(bm, mat, lod, only=only)


def flat(ms, mat, x, y, w, d, yaw, z=G + 0.004, lod=2):
    f = frame_at(x, y, yaw)
    ms.quad_strip(mat, [(-w / 2, -d / 2, z), (w / 2, -d / 2, z), (w / 2, d / 2, z), (-w / 2, d / 2, z)], lod=lod, frame=f)


def pole_with_pennant(ms, f, x, y, z0, top):
    ms.cyl('st_stake', 0.013, 0.009, top - z0, at=(x, y, z0), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, x, y, top - 0.005, lod=1, w=0.18, h=0.1)


def door(ms, f, y_front, z=G, w=0.08, h=0.15, mat='dark', x=0.0):
    ms.box(mat, (w, 0.014, h), at=(x, y_front - 0.004, z), lod=1, frame=f)

# ---- houses -------------------------------------------------------------------------------------
# Each house function draws one building at (x, y) turned by yaw (its front, local -Y, toward the
# centre unless told otherwise) and returns nothing; FOOT gives its half sizes for the layout.


def round_hut(ms, rng, x, y, yaw, r=0.28, wall='st_daub', roof='thatch', wall_h=0.19, roof_h=0.3, over=1.18, knot=True, extra=None):
    f = frame_at(x, y, yaw)
    lcyl(ms, wall, r, r * 0.97, wall_h, (0, 0, G), f, caps=False)
    lcyl(ms, roof, r * over, 0.0, roof_h, (0, 0, G + wall_h - 0.035), f, segs=(14, 8, 6), caps=True)
    if knot:
        ms.cyl(roof, 0.03, 0.012, 0.05, at=(0, 0, G + wall_h - 0.035 + roof_h - 0.02), segs=6, lod=0, frame=f)
    # the door in a short porch under the eave
    ms.box(wall, (0.13, 0.08, wall_h * 0.85), at=(0, -r - 0.02, G), lod=1, frame=f)
    door(ms, f, -r - 0.06, w=0.07, h=wall_h * 0.7)
    ms.box(roof, (0.17, 0.12, 0.02), at=(0, -r - 0.03, G + wall_h * 0.85), rot_z=0, lod=0, frame=f)
    if extra == 'band':  # a painted band round the wall
        ms.cyl('st_ochre', r * 1.005, r * 0.99, 0.03, at=(0, 0, G + 0.04), segs=12, lod=0, frame=f, caps=False)
    return f


def longhouse(ms, rng, x, y, yaw, L=1.1, D=0.46, wall='st_daub', roof='thatch', wall_h=0.17, roof_h=0.34, hip=0.12, sweep=0.0):
    """A long timber house of wattle and daub under a steep thatch (Linear Pottery), its door on
    the short end facing local -X... drawn with its long side on local x."""
    f = frame_at(x, y, yaw)
    ms.box(wall, (L, D, wall_h), at=(0, 0, G), lod=2, frame=f)
    gable(ms, roof, L, D, roof_h, G + wall_h - 0.02, f, over=0.05, hip=hip, sweep=sweep)
    for i in range(6):  # the posts along the walls
        px = -L / 2 + L * (i + 0.5) / 6
        for sy in (-1, 1):
            ms.box('st_stake', (0.022, 0.022, wall_h), at=(px, sy * (D / 2 + 0.006), G), lod=0, frame=f)
    door(ms, f, -D / 2, w=0.08, h=wall_h * 0.8, x=-L * 0.2)
    ms.box('dark', (0.014, 0.08, wall_h * 0.75), at=(-L / 2 - 0.004, 0, G), lod=1, frame=f)
    return f


def rect_house(ms, rng, x, y, yaw, w=0.6, d=0.5, wall='mudwall_bare', roof=None, wall_h=0.24, ladder=True, hatch=True, roof_h=0.2):
    """A mud-brick house: a flat roof with a hatch and a ladder (Catalhoyuk), or under thatch."""
    f = frame_at(x, y, yaw)
    ms.box(wall, (w, d, wall_h), at=(0, 0, G), lod=2, frame=f)
    if roof:
        gable(ms, roof, w, d, roof_h, G + wall_h - 0.01, f, over=0.04, hip=0.06)
    else:
        ms.box('st_clay', (w + 0.02, d + 0.02, 0.025), at=(0, 0, G + wall_h), lod=2, frame=f)
        if hatch:
            ms.box('dark', (0.08, 0.08, 0.004), at=(w * 0.15, d * 0.1, G + wall_h + 0.025), lod=0, frame=f)
        if ladder:
            tt.ladder(ms, f, w * 0.15, d * 0.1 - 0.02, 0.12, lean=8, z=G + wall_h + 0.025)
        for k in range(3):
            tt.basket(ms, f, -w * 0.25 + k * 0.06, -d * 0.2, 0.9, z=G + wall_h + 0.025)
    door(ms, f, -d / 2, w=0.08, h=wall_h * 0.7, x=rng.uniform(-w * 0.2, w * 0.2))
    ms.box('dark', (0.05, 0.01, 0.04), at=(w * 0.3, -d / 2 - 0.002, G + wall_h * 0.6), lod=0, frame=f)
    return f


def stone_round(ms, rng, x, y, yaw, r=0.27):
    """PPNA round house: a fieldstone footing, mud walls and a low mud dome."""
    f = frame_at(x, y, yaw)
    lcyl(ms, 'stone', r + 0.012, r + 0.008, 0.07, (0, 0, G), f, caps=False)
    lcyl(ms, 'st_clay', r, r * 0.97, 0.19, (0, 0, G + 0.06), f, caps=False)
    ldome(ms, 'st_clay', r * 1.02, r * 1.02, 0.17, (0, 0, G + 0.24), f)
    ms.box('st_clay', (0.12, 0.08, 0.17), at=(0, -r - 0.02, G), lod=1, frame=f)
    door(ms, f, -r - 0.06, w=0.07, h=0.13)
    ms.cyl('dark', 0.025, 0.025, 0.01, at=(0, 0, G + 0.405), segs=6, lod=0, frame=f)
    return f


def stilt_house(ms, rng, x, y, yaw, w=0.62, d=0.44, floor=0.17, wall_h=0.16, roof_h=0.28, wall='st_bamboo', roof='thatch'):
    f = frame_at(x, y, yaw)
    for sx in (-w / 2 + 0.03, 0, w / 2 - 0.03):
        for sy in (-d / 2 + 0.03, d / 2 - 0.03):
            ms.cyl('st_stake', 0.016, 0.016, floor, at=(sx, sy, G), segs=5, lod=1 if sx else 0, frame=f, caps=False)
    ms.box('st_stake', (w + 0.1, d + 0.06, 0.025), at=(0, 0, G + floor), lod=1, frame=f)
    ms.box(wall, (w, d, wall_h), at=(0, 0, G + floor + 0.025), lod=2, frame=f)
    gable(ms, roof, w, d, roof_h, G + floor + 0.025 + wall_h - 0.02, f, over=0.06, sweep=0.07)
    door(ms, f, -d / 2, z=G + floor + 0.025, w=0.08, h=wall_h * 0.8)
    tt.ladder(ms, f, 0.0, -d / 2 - 0.13, floor + 0.02, lean=24)
    return f


def wigwam(ms, rng, x, y, yaw, rx=0.27, ry=0.24, h=0.3, mat='st_bark'):
    f = frame_at(x, y, yaw)
    ldome(ms, mat, rx, ry, h, (0, 0, G), f)
    for k in range(4):  # the mats lashed over the bark
        a = rng.uniform(0, 2 * math.pi)
        ms.box('reed', (0.12, 0.1, 0.008), at=(rx * 0.55 * math.cos(a), ry * 0.55 * math.sin(a), G + h * 0.75), rot_z=math.degrees(a), lod=0, frame=f)
    door(ms, f, -ry + 0.02, w=0.07, h=0.15)
    ms.cyl('dark', 0.02, 0.02, 0.01, at=(0, 0, G + h - 0.004), segs=6, lod=0, frame=f)
    return f


def pit_house(ms, rng, x, y, yaw, r=0.3, h=0.2):
    """An earth-covered pit house: a turf mound, a smoke hole with its poles, an entrance tunnel."""
    f = frame_at(x, y, yaw)
    ldome(ms, 'st_turf', r, r, h, (0, 0, G), f)
    ms.box('st_turf', (0.12, 0.16, 0.1), at=(0, -r - 0.02, G), lod=1, frame=f)
    door(ms, f, -r - 0.1, w=0.07, h=0.08)
    for k in range(3):
        a = 2 * math.pi * k / 3
        ms.cyl('st_stake', 0.008, 0.006, 0.12, at=(0.02 * math.cos(a), 0.02 * math.sin(a), G + h - 0.04), rot=(18 * math.sin(a), 18 * math.cos(a), 0), segs=4, lod=0, frame=f)
    ms.cyl('dark', 0.035, 0.035, 0.01, at=(0, 0, G + h - 0.006), segs=6, lod=0, frame=f)
    return f


def hide_tent(ms, rng, x, y, yaw, r=0.25, h=0.42, mat='st_hide'):
    f = frame_at(x, y, yaw)
    lcyl(ms, mat, r, 0.02, h, (0, 0, G), f, segs=(10, 7, 5))
    for k in range(6):  # the poles crossing above the smoke hole
        a = 2 * math.pi * k / 6 + 0.3
        ms.cyl('st_stake', 0.007, 0.005, 0.1, at=(0.012 * math.cos(a), 0.012 * math.sin(a), G + h - 0.03), rot=(22 * math.sin(a), -22 * math.cos(a), 0), segs=4, lod=0, frame=f)
    ms.box('st_hide_dark', (0.1, 0.02, 0.17), at=(0, -r * 0.62, G), rot_z=0, lod=1, frame=f)
    door(ms, f, -r * 0.62 - 0.004, w=0.06, h=0.12)
    if rng.random() < 0.5:  # a painted band
        ms.cyl('st_ochre', r * 0.76, r * 0.66, 0.035, at=(0, 0, G + h * 0.25), segs=10, lod=0, frame=f, caps=False)
    return f


def bone_hut(ms, rng, x, y, yaw, r=0.28, h=0.27):
    """A mammoth bone hut: a hide dome weighed with tusks and ringed by stacked jaw bones."""
    f = frame_at(x, y, yaw)
    ldome(ms, 'st_hide_dark', r, r, h, (0, 0, G), f)
    n = 14
    for k in range(n):
        a = 2 * math.pi * k / n
        ms.box('st_bone', (0.06, 0.035, 0.05), at=(r * 1.02 * math.cos(a), r * 1.02 * math.sin(a), G), rot_z=math.degrees(a), lod=0, frame=f)
    for k in range(4):  # tusks arching over the dome
        a = math.pi * k / 4
        ms.cyl('st_bone', 0.012, 0.006, 0.36, at=(r * 0.6 * math.cos(a), r * 0.6 * math.sin(a), G + h * 0.55), rot=(80 * math.sin(a + 1.57), 80 * math.cos(a + 1.57), 0), segs=5, lod=0, frame=f)
    for sx in (-1, 1):  # the tusk arch over the door
        ms.cyl('st_bone', 0.013, 0.007, 0.2, at=(sx * 0.05, -r - 0.02, G), rot=(0, -sx * 18, 0), segs=5, lod=0, frame=f)
    door(ms, f, -r + 0.02, w=0.07, h=0.12)
    return f


# ---- props --------------------------------------------------------------------------------------

def hearth(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 360))
    for k in range(7):
        a = 2 * math.pi * k / 7
        ms.sphere('st_pebble', 0.018, at=(0.05 * math.cos(a), 0.05 * math.sin(a), G + 0.004), scale=(1, 1, 0.6), u=5, v=3, lod=0, frame=f)
    ms.cyl('ash', 0.045, 0.045, 0.005, at=(0, 0, G), segs=8, lod=1, frame=f)
    for k in range(3):
        a = 2 * math.pi * k / 3
        ms.cyl('timber', 0.006, 0.006, 0.07, at=(0, 0, G + 0.006), rot=(70 * math.sin(a), 70 * math.cos(a), 0), segs=4, lod=0, frame=f)
    if rng.random() < 0.5:
        tt.jar(ms, f, 0.08, 0.02, 0.8, mat='st_daub_red')


def granary(ms, rng, x, y, wall='st_daub', roof='thatch'):
    """A granary on posts: a small round bin under a conical cap."""
    f = frame_at(x, y, rng.uniform(0, 360))
    for k in range(4):
        a = math.pi / 4 + k * math.pi / 2
        ms.cyl('st_stake', 0.01, 0.01, 0.13, at=(0.07 * math.cos(a), 0.07 * math.sin(a), G), segs=4, lod=1, frame=f, caps=False)
    ms.cyl('st_stake', 0.11, 0.11, 0.015, at=(0, 0, G + 0.13), segs=8, lod=1, frame=f)
    lcyl(ms, wall, 0.085, 0.095, 0.12, (0, 0, G + 0.145), f, segs=(10, 7, 6), caps=False, top=1)
    lcyl(ms, roof, 0.12, 0.0, 0.13, (0, 0, G + 0.255), f, segs=(10, 7, 6), top=1)


def storage_pits(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 360))
    for k in range(3):
        px, py = (k - 1) * 0.11, rng.uniform(-0.03, 0.03)
        ms.cyl('st_clay', 0.05, 0.048, 0.012, at=(px, py, G), segs=8, lod=1, frame=f)
        ms.cyl('dark' if k == 1 else 'reed', 0.04, 0.04, 0.004, at=(px, py, G + 0.012), segs=8, lod=0, frame=f)
        if k != 1:
            ms.sphere('st_pebble', 0.014, at=(px + 0.01, py, G + 0.02), scale=(1, 1, 0.6), u=5, v=3, lod=0, frame=f)


def platform(ms, rng, x, y, yaw=None):
    """A storage platform on six posts with baskets and pots."""
    f = frame_at(x, y, rng.uniform(0, 360) if yaw is None else yaw)
    for sx in (-0.11, 0, 0.11):
        for sy in (-0.07, 0.07):
            ms.cyl('st_stake', 0.009, 0.009, 0.12, at=(sx, sy, G), segs=4, lod=0, frame=f, caps=False)
    ms.box('st_stake', (0.27, 0.18, 0.016), at=(0, 0, G + 0.12), lod=1, frame=f)
    for k in range(4):
        px, py = -0.09 + k * 0.06, rng.uniform(-0.04, 0.04)
        if k % 2:
            tt.basket(ms, f, px, py, 1.0, z=G + 0.136)
        else:
            tt.jar(ms, f, px, py, 0.9, z=G + 0.136, mat='st_daub_red')


def drying_rack(ms, rng, x, y, cloth='st_hide'):
    f = frame_at(x, y, rng.uniform(0, 360))
    for sx in (-0.1, 0.1):
        ms.box('st_stake', (0.01, 0.01, 0.15), at=(sx, 0, G), lod=0, frame=f)
    ms.box('st_stake', (0.22, 0.01, 0.01), at=(0, 0, G + 0.145), lod=0, frame=f)
    for k in range(3):
        mat = cloth if k != 1 else ('team_cloth' if rng.random() < 0.3 else 'reed')
        ms.box(mat, (0.05, 0.006, 0.07), at=(-0.065 + k * 0.065, 0, G + 0.075), lod=0, frame=f)


def fish_rack(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 360))
    for sx in (-0.11, 0.11):
        for sy in (-0.04, 0.04):
            ms.box('st_stake', (0.009, 0.009, 0.14), at=(sx, sy, G), lod=0, frame=f)
    for sy in (-0.04, 0.04):
        ms.box('st_stake', (0.24, 0.009, 0.009), at=(0, sy, G + 0.135), lod=0, frame=f)
    for k in range(6):
        ms.box('st_daub_red', (0.012, 0.006, 0.05), at=(-0.09 + k * 0.036, (k % 2) * 0.08 - 0.04, G + 0.085), lod=0, frame=f)


def pen(ms, rng, x, y, yaw, w=0.6, d=0.42, beast='st_hide', n=4):
    """A wattle or rail pen with a few animals in it."""
    f = frame_at(x, y, yaw)
    ms.quad_strip('mud', [(-w / 2, -d / 2, G + 0.002), (w / 2, -d / 2, G + 0.002), (w / 2, d / 2, G + 0.002), (-w / 2, d / 2, G + 0.002)], lod=2, frame=f)
    sides = [((-w / 2, -d / 2), (w / 2, -d / 2)), ((w / 2, -d / 2), (w / 2, d / 2)), ((w / 2, d / 2), (-w / 2, d / 2)), ((-w / 2, d / 2), (-w / 2, -d / 2))]
    for si, ((x0, y0), (x1, y1)) in enumerate(sides):
        length = math.hypot(x1 - x0, y1 - y0)
        steps = max(2, int(length / 0.07))
        ang = math.degrees(math.atan2(y1 - y0, x1 - x0))
        for k in range(steps + 1):
            t = k / steps
            if si == 0 and abs(t - 0.5) < 0.12:
                continue  # the gap of the gate
            ms.box('st_stake', (0.012, 0.012, 0.09), at=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, G), lod=0, frame=f)
        for zz in (0.04, 0.075):
            ms.box('st_stake', (length, 0.008, 0.01), at=((x0 + x1) / 2, (y0 + y1) / 2, G + zz), rot_z=ang, lod=1 if zz > 0.05 else 0, frame=f)
    for k in range(n):
        ax, ay = rng.uniform(-w / 2 + 0.08, w / 2 - 0.08), rng.uniform(-d / 2 + 0.07, d / 2 - 0.07)
        yaw2 = rng.uniform(0, 360)
        af = f @ frame_at(ax, ay, yaw2)
        mat = beast if rng.random() < 0.7 else 'st_fleece'
        ms.box(mat, (0.075, 0.03, 0.032), at=(0, 0, G + 0.03), lod=0, frame=af)
        ms.box(mat, (0.026, 0.022, 0.024), at=(0.048, 0, G + 0.048), lod=0, frame=af)
        for lx in (-0.026, 0.026):
            for ly in (-0.01, 0.01):
                ms.box('st_hide_dark', (0.008, 0.008, 0.03), at=(lx, ly, G), lod=0, frame=af)


def field(ms, rng, x, y, yaw, w=0.5, d=0.32, crop='barley'):
    """A garden plot in strips with a low hedge of sticks at the ends."""
    f = frame_at(x, y, yaw)
    strips = 3
    for k in range(strips):
        sy = -d / 2 + d * (k + 0.5) / strips
        mat = crop if k != 1 or crop == 'leaf' else ('flax' if crop == 'barley' else 'barley')
        ms.quad_strip(mat, [(-w / 2, sy - d / strips * 0.42, G + 0.006), (w / 2, sy - d / strips * 0.42, G + 0.006),
                            (w / 2, sy + d / strips * 0.42, G + 0.006), (-w / 2, sy + d / strips * 0.42, G + 0.006)], lod=2, frame=f)
        if crop == 'leaf':  # a garden: low bushes along the strip
            for j in range(4):
                ms.sphere('leaf', 0.03, at=(-w / 2 + w * (j + 0.5) / 4, sy, G + 0.012), scale=(1, 1, 0.7), u=5, v=3, lod=0, frame=f)
    for sx in (-w / 2 - 0.02, w / 2 + 0.02):
        for k in range(4):
            ms.box('st_stake', (0.008, 0.008, 0.05), at=(sx, -d / 2 + d * k / 3, G), lod=0, frame=f)


def woodpile(ms, rng, x, y):
    tt.woodpile(ms, frame_at(0, 0, 0), x, y, rng.uniform(0, 180))


def clutter(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 360))
    for k in range(4):
        px, py = rng.uniform(-0.06, 0.06), rng.uniform(-0.05, 0.05)
        r = rng.random()
        if r < 0.45:
            tt.jar(ms, f, px, py, rng.uniform(0.7, 1.0), mat='st_daub_red')
        elif r < 0.8:
            tt.basket(ms, f, px, py, rng.uniform(0.8, 1.1))
        else:
            ms.box('st_hide', (0.07, 0.05, 0.006), at=(px, py, G), rot_z=rng.uniform(0, 90), lod=0, frame=f)


def menhir(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 180))
    ms.box('stone', (0.06, 0.045, rng.uniform(0.16, 0.24)), at=(0, 0, G - 0.01), lod=1, frame=f, taper=0.7)


def canoe(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 180))
    ms.box('st_stake', (0.34, 0.055, 0.03), at=(0, 0, G), lod=1, frame=f, taper=0.85)
    ms.box('dark', (0.28, 0.035, 0.004), at=(0, 0, G + 0.03), lod=0, frame=f)


def totem(ms, rng, x, y):
    f = frame_at(x, y, rng.uniform(0, 360))
    ms.cyl('st_bark', 0.025, 0.02, 0.32, at=(0, 0, G), segs=6, lod=1, frame=f)
    for k in range(3):
        ms.cyl('st_ochre', 0.028, 0.028, 0.03, at=(0, 0, G + 0.08 + k * 0.08), segs=6, lod=0, frame=f, caps=False)


# ---- landmarks ----------------------------------------------------------------------------------
# Each stands at least 0.9 square units of base and carries the team pennant on a pole that rises
# from inside its footprint (the layout reader joins the pole to the building).

def lm_great_hut(ms, rng, x, y, yaw, top=1.45, wall='st_daub', roof='thatch', r=0.52):
    f = round_hut(ms, rng, x, y, yaw, r=r, wall=wall, roof=roof, wall_h=0.26, roof_h=0.66, extra='band')
    for k in range(5):  # carved posts round the door yard
        a = math.radians(-90 + (k - 2) * 22)
        ms.cyl('st_ochre' if k % 2 else 'st_bark', 0.02, 0.018, 0.26, at=((r + 0.2) * math.cos(a), (r + 0.2) * math.sin(a), G), segs=6, lod=1, frame=f)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.86, top)


def lm_shrine(ms, rng, x, y, yaw, top=1.25, wall='st_daub_red', roof='st_straw'):
    f = frame_at(x, y, yaw)
    lcyl(ms, 'st_clay', 0.56, 0.54, 0.06, (0, 0, G), f, segs=(16, 10, 8))
    round_hut(ms, rng, x, y, yaw, r=0.4, wall=wall, roof=roof, wall_h=0.24, roof_h=0.5)
    for k in range(8):
        a = 2 * math.pi * k / 8 + 0.2
        ms.cyl('st_bone' if k % 2 else 'st_ochre', 0.015, 0.012, 0.2, at=(0.52 * math.cos(a), 0.52 * math.sin(a), G + 0.06), segs=5, lod=0, frame=f)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.7, top)


def lm_great_longhouse(ms, rng, x, y, yaw, top=1.4, L=2.0, D=0.8):
    f = longhouse(ms, rng, x, y, yaw, L=L, D=D, wall='st_daub', roof='thatch', wall_h=0.24, roof_h=0.72, hip=0.2)
    pole_with_pennant(ms, f, L * 0.37, 0.0, G + 0.6, top)


def lm_roundhouse_great(ms, rng, x, y, yaw, top=1.25):
    f = round_hut(ms, rng, x, y, yaw, r=0.5, wall='st_daub', roof='st_straw', wall_h=0.24, roof_h=0.62)
    for k in range(12):  # a ring of standing posts round it (a timber circle)
        a = 2 * math.pi * k / 12
        ms.cyl('st_stake', 0.022, 0.02, 0.28, at=(0.7 * math.cos(a), 0.7 * math.sin(a), G), segs=6, lod=1, frame=f)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.8, top)


def lm_tower(ms, rng, x, y, yaw, top=1.55):
    """The tower of Jericho: a battered round stone tower with a stair door and a wall stub."""
    f = frame_at(x, y, yaw)
    lcyl(ms, 'stone', 0.5, 0.42, 1.05, (0, 0, G), f, segs=(18, 12, 8))
    ms.cyl('st_pebble', 0.43, 0.43, 0.02, at=(0, 0, G + 1.05), segs=14, lod=1, frame=f)
    door(ms, f, -0.49, w=0.1, h=0.16)
    ms.box('stone', (0.9, 0.12, 0.38), at=(0.7, 0.25, G), rot_z=-20, lod=2, frame=f)
    pole_with_pennant(ms, f, 0.15, 0.1, G + 1.07, top)
    for k in range(3):
        tt.basket(ms, f, -0.15 + k * 0.08, -0.15, 1.0, z=G + 1.07)


def lm_shrine_house(ms, rng, x, y, yaw, top=1.25):
    """A two-storey shrine house with bull horns over its door (Catalhoyuk)."""
    f = rect_house(ms, rng, x, y, yaw, w=1.0, d=0.95, wall='st_clay', wall_h=0.32, ladder=True)
    ms.box('st_clay', (0.6, 0.55, 0.26), at=(0.12, 0.12, G + 0.345), lod=2, frame=f)
    ms.box('st_ochre', (0.62, 0.012, 0.06), at=(0.12, 0.12 - 0.28, G + 0.5), lod=0, frame=f)
    for sx in (-1, 1):
        ms.cyl('st_bone', 0.016, 0.004, 0.12, at=(sx * 0.05, -0.48, G + 0.3), rot=(0, sx * 55, 0), segs=5, lod=0, frame=f)
    pole_with_pennant(ms, f, 0.3, 0.3, G + 0.6, top)


def lm_granary_block(ms, rng, x, y, yaw, top=1.4):
    """Mehrgarh's compartmented granary: a mud-brick block of small cells, open at the top."""
    f = frame_at(x, y, yaw)
    w, d, h = 1.1, 0.9, 0.3
    ms.box('mudwall_bare', (w, 0.05, h), at=(0, -d / 2 + 0.025, G), lod=2, frame=f)
    ms.box('mudwall_bare', (w, 0.05, h), at=(0, d / 2 - 0.025, G), lod=2, frame=f)
    ms.box('mudwall_bare', (0.05, d, h), at=(-w / 2 + 0.025, 0, G), lod=2, frame=f)
    ms.box('mudwall_bare', (0.05, d, h), at=(w / 2 - 0.025, 0, G), lod=2, frame=f)
    ms.box('st_clay', (w - 0.1, d - 0.1, 0.01), at=(0, 0, G), lod=1, frame=f)
    for k in range(1, 4):
        ms.box('mudwall_bare', (0.03, d - 0.1, h * 0.9), at=(-w / 2 + w * k / 4, 0, G), lod=1, frame=f)
    ms.box('mudwall_bare', (w - 0.1, 0.03, h * 0.9), at=(0, 0, G), lod=1, frame=f)
    for k in range(8):
        cx = -w / 2 + w * ((k % 4) + 0.5) / 4
        cy = -d / 4 if k < 4 else d / 4
        if k % 3 != 1:
            ms.cyl('barley', 0.08, 0.05, 0.08, at=(cx, cy, G + 0.01), segs=6, lod=0, frame=f)
    pole_with_pennant(ms, f, w / 2 - 0.06, d / 2 - 0.06, G + h, top)


def lm_brick_platform(ms, rng, x, y, yaw, top=1.25):
    f = frame_at(x, y, yaw)
    ms.box('mudwall_bare', (1.0, 1.0, 0.12), at=(0, 0, G), lod=2, frame=f)
    for k in range(5):
        ms.box('mudwall_bare', (0.3, 0.06, 0.12 * (k + 1) / 5), at=(0, -0.53 - 0.06 * (4 - k), G), lod=1, frame=f)
    rect_house(ms, rng, x + 0.0, y + 0.08, yaw, w=0.62, d=0.5, wall='st_clay', roof='thatch', wall_h=0.24, roof_h=0.24)
    # rect_house draws from the ground: lift it is not possible, so it stands in the platform
    pole_with_pennant(ms, f, 0.36, 0.36, G + 0.12, top)


def lm_long_stilt(ms, rng, x, y, yaw, top=1.45, w=1.5, d=0.66):
    f = stilt_house(ms, rng, x, y, yaw, w=w, d=d, floor=0.18, wall_h=0.2, roof_h=0.5, wall='st_bamboo', roof='thatch')
    for sx in (-1, 1):  # carved buffalo horns on the gable ends
        ms.cyl('st_bone', 0.014, 0.004, 0.14, at=(sx * (w / 2 + 0.2), 0, G + 0.18 + 0.2 + 0.58), rot=(0, sx * 40, 0), segs=5, lod=0, frame=f)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.9, top)


def lm_mound(ms, rng, x, y, yaw, top=1.45):
    """A platform mound with a ramp and a chief's wigwam on top."""
    f = frame_at(x, y, yaw)
    lcyl(ms, 'st_turf', 0.56, 0.4, 0.22, (0, 0, G), f, segs=(16, 10, 8))
    ms.box('st_turf', (0.18, 0.4, 0.2), at=(0, -0.55, G), lod=1, frame=f, taper=0.9)
    ldome(ms, 'st_bark', 0.26, 0.24, 0.3, (0, 0.04, G + 0.22), f)
    door(ms, f, 0.04 - 0.22, z=G + 0.22, w=0.07, h=0.15)
    pole_with_pennant(ms, f, 0.22, 0.22, G + 0.22, top)


def lm_council_longhouse(ms, rng, x, y, yaw, top=1.2):
    f = frame_at(x, y, yaw)
    ldome(ms, 'st_bark', 0.76, 0.33, 0.46, (0, 0, G), f, segs=((16, 6), (10, 4), (8, 3)))
    for sx in (-1, 1):
        ms.box('st_bark', (0.06, 0.2, 0.26), at=(sx * 0.74, 0, G), lod=1, frame=f)
        door(ms, frame_at(x, y, yaw + 90 * sx), -0.77, w=0.07, h=0.17)
    for k in range(4):
        ms.cyl('dark', 0.025, 0.025, 0.01, at=(-0.45 + k * 0.3, 0, G + 0.455), segs=6, lod=0, frame=f)
    pole_with_pennant(ms, f, 0.5, 0.0, G + 0.38, top)


def lm_great_tent(ms, rng, x, y, yaw, top=1.45):
    f = hide_tent(ms, rng, x, y, yaw, r=0.5, h=0.85, mat='st_hide')
    ms.cyl('st_ochre', 0.36, 0.3, 0.06, at=(0, 0, G + 0.24), segs=12, lod=0, frame=f, caps=False)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.8, top)


def lm_bone_lodge(ms, rng, x, y, yaw, top=1.2):
    f = bone_hut(ms, rng, x, y, yaw, r=0.5, h=0.46)
    for k in range(6):  # mammoth skulls set round it
        a = 2 * math.pi * k / 6 + 0.4
        ms.sphere('st_bone', 0.05, at=(0.6 * math.cos(a), 0.6 * math.sin(a), G + 0.03), scale=(1.2, 1, 0.8), u=6, v=4, lod=0, frame=f)
    pole_with_pennant(ms, f, 0.0, 0.0, G + 0.44, top)


# ---- the styles ---------------------------------------------------------------------------------
# houses: [(weight, kind)]; foot(kind, params) gives a house's half sizes (local x, local y) with
# its roof; landmarks per variant; enclosure per variant; props: weights of each prop kind.

def _house_params(style, variant, kind, rng, size):
    big = size == 'big'
    if kind == 'hut':
        r = rng.uniform(0.24, 0.31) + (0.02 if big and rng.random() < 0.3 else 0)
        wall = {'base': 'st_daub', 'europe': 'st_daub', 'indic': 'st_daub_red', 'monsoon': 'st_bamboo', 'americas': 'st_bark'}.get(style, 'st_daub')
        if style == 'base' and rng.random() < 0.35:
            wall = 'st_daub_red'
        roof = 'st_straw' if rng.random() < 0.35 else 'thatch'
        return dict(r=r, wall=wall, roof=roof, roof_h=rng.uniform(0.27, 0.33), extra='band' if rng.random() < 0.25 else None)
    if kind == 'long':
        return dict(L=rng.uniform(0.85, 1.15), D=rng.uniform(0.42, 0.5), roof='st_straw' if rng.random() < 0.3 else 'thatch')
    if kind == 'flat':
        return dict(w=rng.uniform(0.5, 0.68), d=rng.uniform(0.42, 0.54), wall='mudwall_bare' if rng.random() < 0.6 else 'st_clay')
    if kind == 'thatched':
        return dict(w=rng.uniform(0.52, 0.7), d=rng.uniform(0.42, 0.52), wall='mudwall_bare' if rng.random() < 0.5 else 'st_daub_red', roof='thatch', wall_h=0.2, roof_h=0.22)
    if kind == 'stone':
        return dict(r=rng.uniform(0.24, 0.3))
    if kind == 'stilt':
        return dict(w=rng.uniform(0.48, 0.6), d=rng.uniform(0.36, 0.42), roof='thatch' if rng.random() < 0.7 else 'st_straw', wall='st_bamboo' if rng.random() < 0.6 else 'reed')
    if kind == 'wigwam':
        rx = rng.uniform(0.23, 0.3)
        return dict(rx=rx, ry=rx * rng.uniform(0.85, 1.0), h=rng.uniform(0.27, 0.32), mat='st_bark' if rng.random() < 0.6 else 'reed')
    if kind == 'pit':
        return dict(r=rng.uniform(0.26, 0.32), h=rng.uniform(0.18, 0.22))
    if kind == 'tent':
        return dict(r=rng.uniform(0.22, 0.27), h=rng.uniform(0.38, 0.45), mat='st_hide' if rng.random() < 0.65 else 'st_hide_dark')
    if kind == 'bone':
        return dict(r=rng.uniform(0.25, 0.3), h=rng.uniform(0.24, 0.28))
    raise ValueError(kind)


def foot(kind, p):
    if kind in ('hut',):
        return (p['r'] * 1.18, p['r'] * 1.18 + 0.05)
    if kind == 'long':
        return (p['L'] / 2 + 0.06, p['D'] / 2 + 0.06)
    if kind in ('flat', 'thatched'):
        return (p['w'] / 2 + 0.04, p['d'] / 2 + 0.05)
    if kind == 'stone':
        return (p['r'] + 0.02, p['r'] + 0.08)
    if kind == 'stilt':
        return (p['w'] / 2 + 0.08, p['d'] / 2 + 0.13)
    if kind == 'wigwam':
        return (p['rx'] + 0.01, p['ry'] + 0.03)
    if kind == 'pit':
        return (p['r'], p['r'] + 0.12)
    if kind == 'tent':
        return (p['r'], p['r'] + 0.02)
    if kind == 'bone':
        return (p['r'] + 0.04, p['r'] + 0.06)


def draw_house(ms, rng, kind, x, y, yaw, p):
    if kind == 'hut':
        round_hut(ms, rng, x, y, yaw, **p)
    elif kind == 'long':
        longhouse(ms, rng, x, y, yaw, **p)
    elif kind == 'flat':
        rect_house(ms, rng, x, y, yaw, **p)
    elif kind == 'thatched':
        rect_house(ms, rng, x, y, yaw, **p)
    elif kind == 'stone':
        stone_round(ms, rng, x, y, yaw, **p)
    elif kind == 'stilt':
        stilt_house(ms, rng, x, y, yaw, **p)
    elif kind == 'wigwam':
        wigwam(ms, rng, x, y, yaw, **p)
    elif kind == 'pit':
        pit_house(ms, rng, x, y, yaw, **p)
    elif kind == 'tent':
        hide_tent(ms, rng, x, y, yaw, **p)
    elif kind == 'bone':
        bone_hut(ms, rng, x, y, yaw, **p)


# landmark id -> (draw, half sizes)
LANDMARKS = {
    'great-hut': (lm_great_hut, (0.66, 0.72)),
    'shrine': (lm_shrine, (0.6, 0.6)),
    'great-longhouse': (lm_great_longhouse, (1.08, 0.48)),
    'roundhouse': (lm_roundhouse_great, (0.74, 0.74)),
    'tower': (lm_tower, (0.55, 0.55)),
    'shrine-house': (lm_shrine_house, (0.54, 0.54)),
    'granary-block': (lm_granary_block, (0.58, 0.48)),
    'brick-platform': (lm_brick_platform, (0.52, 0.72)),
    'long-stilt': (lm_long_stilt, (0.95, 0.52)),
    'mound': (lm_mound, (0.58, 0.8)),
    'council': (lm_council_longhouse, (0.82, 0.4)),
    'great-tent': (lm_great_tent, (0.52, 0.58)),
    'bone-lodge': (lm_bone_lodge, (0.66, 0.66)),
}

# small villages take the long landmarks shorter (still 0.9 square units of base)
SMALL_LANDMARKS = {
    'great-longhouse': (lambda ms, rng, x, y, yaw: lm_great_longhouse(ms, rng, x, y, yaw, L=1.4, D=0.7), (0.78, 0.43)),
    'long-stilt': (lambda ms, rng, x, y, yaw: lm_long_stilt(ms, rng, x, y, yaw, w=1.15, d=0.82), (0.7, 0.6)),
}

STYLE = {
    'base': dict(houses={'a': [(1, 'hut')], 'b': [(1, 'hut')]}, lm={'a': ['great-hut', 'shrine'], 'b': ['shrine', 'great-hut']},
                 fence={'a': 'palisade', 'b': 'bank'}, props=dict(hearth=3, granary=3, pits=1, platform=1, rack=1, pen=1, field=2, clutter=2, wood=1),
                 beast='st_hide'),
    'europe': dict(houses={'a': [(3, 'long'), (1, 'hut')], 'b': [(2, 'long'), (2, 'hut')]}, lm={'a': ['great-longhouse', 'roundhouse'], 'b': ['roundhouse', 'great-longhouse']},
                   fence={'a': 'palisade', 'b': 'bank'}, props=dict(hearth=1, granary=1, pits=2, platform=1, rack=1, pen=2, field=3, clutter=1, wood=2, menhir=2),
                   beast='st_hide', parallel=True),
    'levant': dict(houses={'a': [(1, 'stone')], 'b': [(1, 'flat')]}, lm={'a': ['tower', 'shrine-house'], 'b': ['shrine-house', 'tower']},
                   fence={'a': 'wall', 'b': 'bank'}, props=dict(hearth=2, granary=0, pits=3, platform=1, rack=1, pen=1, field=3, clutter=3, wood=1),
                   beast='st_fleece'),
    'indic': dict(houses={'a': [(3, 'thatched'), (1, 'hut')], 'b': [(2, 'thatched'), (1, 'flat')]}, lm={'a': ['granary-block', 'brick-platform'], 'b': ['brick-platform', 'granary-block']},
                  fence={'a': 'bank', 'b': 'palisade'}, props=dict(hearth=2, granary=1, pits=2, platform=1, rack=1, pen=2, field=3, clutter=2, wood=1),
                  beast='st_hide_dark'),
    'monsoon': dict(houses={'a': [(1, 'stilt')], 'b': [(3, 'stilt'), (1, 'hut')]}, lm={'a': ['long-stilt', 'shrine'], 'b': ['shrine', 'long-stilt']},
                    fence={'a': 'palisade', 'b': 'bank'}, props=dict(hearth=2, granary=3, pits=0, platform=1, rack=1, pen=1, field=3, clutter=2, wood=1, canoe=2),
                    beast='st_hide_dark'),
    'americas': dict(houses={'a': [(1, 'wigwam')], 'b': [(3, 'pit'), (1, 'wigwam')]}, lm={'a': ['mound', 'council'], 'b': ['council', 'mound']},
                     fence={'a': 'palisade', 'b': 'bank'}, props=dict(hearth=3, granary=1, pits=2, platform=2, fishrack=2, pen=0, field=3, clutter=2, wood=1, totem=2, canoe=1),
                     beast='st_hide'),
    'steppe': dict(houses={'a': [(1, 'tent')], 'b': [(2, 'bone'), (1, 'tent')]}, lm={'a': ['great-tent', 'bone-lodge'], 'b': ['bone-lodge', 'great-tent']},
                   fence={'a': 'palisade', 'b': 'bank'}, props=dict(hearth=3, granary=0, pits=2, platform=1, rack=2, pen=3, field=0, clutter=2, wood=1),
                   beast='st_hide'),
}
# the monsoon and base styles' landmark huts in their own materials
LM_MATS = {'monsoon': dict(wall='st_bamboo', roof='thatch'), 'americas': dict(wall='st_bark', roof='reed')}

# size: ground radius R, the free centre's radius, houses wanted, landmark plots (angle, radius)
SIZES = {
    'small': dict(R=2.0, free=0.55, count=6, lm=[(84, 1.2)], props=1.0),
    'medium': dict(R=3.0, free=0.75, count=12, lm=[(118, 1.85), (58, 1.9)], props=1.6),
    'big': dict(R=4.0, free=0.9, count=22, lm=[(116, 2.35), (62, 2.45)], props=2.5),
}
FENCE_AT = 0.9  # the enclosure's radius, of R
GATE = 11.0       # half the gate's gap, degrees, at the south


# ---- layout (2D) --------------------------------------------------------------------------------

class Box:
    def __init__(self, x, y, yaw, hw, hd):
        self.x, self.y, self.hw, self.hd = x, y, hw, hd
        c, s = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
        self.ax, self.ay = (c, s), (-s, c)
        self.rad = math.hypot(hw, hd)

    def corners(self, pad=0.0):
        out = []
        for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            lx, ly = sx * (self.hw + pad), sy * (self.hd + pad)
            out.append((self.x + self.ax[0] * lx + self.ay[0] * ly, self.y + self.ax[1] * lx + self.ay[1] * ly))
        return out

    def overlaps(self, o, gap):
        if math.hypot(self.x - o.x, self.y - o.y) > self.rad + o.rad + gap:
            return False
        a, b = self.corners(gap / 2), o.corners(gap / 2)
        for axis in (self.ax, self.ay, o.ax, o.ay):
            pa = [p[0] * axis[0] + p[1] * axis[1] for p in a]
            pb = [p[0] * axis[0] + p[1] * axis[1] for p in b]
            if max(pa) < min(pb) or max(pb) < min(pa):
                return False
        return True

    def max_r(self):
        return max(math.hypot(px, py) for px, py in self.corners())

    def min_r(self):
        dx, dy = -self.x, -self.y
        lx = dx * self.ax[0] + dy * self.ax[1]
        ly = dx * self.ay[0] + dy * self.ay[1]
        qx = max(-self.hw, min(self.hw, lx))
        qy = max(-self.hd, min(self.hd, ly))
        return math.hypot(lx - qx, ly - qy)


def pick(rng, weighted):
    t = rng.uniform(0, sum(w for w, _ in weighted))
    for w, k in weighted:
        t -= w
        if t <= 0:
            return k
    return weighted[-1][1]


def plan(style, size, variant, rng):
    """The village's plan: landmarks, houses and props as (kind, x, y, yaw, params)."""
    sz, st = SIZES[size], STYLE[style]
    R = sz['R']
    fence_r = FENCE_AT * R
    limit = fence_r - 0.07
    placed = []  # Box obstacles
    # the street from the gate to the free centre stays open
    placed.append(Box(0, -(sz['free'] + fence_r) / 2, 0, 0.17, (fence_r - sz['free']) / 2))
    lms = []
    names = st['lm'][variant][:len(sz['lm'])]
    for (ang, rad), name in zip(sz['lm'], names):
        if variant == 'b':
            ang = 180 - ang  # the mirror plot
        draw, (hw, hd) = (SMALL_LANDMARKS if size == 'small' else {}).get(name) or LANDMARKS[name]
        x, y = rad * math.cos(math.radians(ang)), rad * math.sin(math.radians(ang))
        yaw = tm.facing_centre(x, y)
        b = Box(x, y, yaw, hw, hd)
        # pull a landmark in until it is inside the enclosure
        while b.max_r() > limit and rad > 0.9:
            rad -= 0.03
            x, y = rad * math.cos(math.radians(ang)), rad * math.sin(math.radians(ang))
            b = Box(x, y, yaw, hw, hd)
        placed.append(b)
        lms.append((name, x, y, yaw))
    houses = []
    mix = st['houses'][variant]
    want = sz['count']
    base_yaw = rng.uniform(-40, -20)
    shrink = {'small': 0.8, 'medium': 0.9, 'big': 0.95}[size]

    def yaw_for(kind, x, y):
        if kind == 'long' and st.get('parallel'):
            return base_yaw + rng.uniform(-6, 6)
        return tm.facing_centre(x, y) + rng.uniform(-12, 12)

    def try_at(kind, p, x, y):
        hw, hd = foot(kind, p)
        yaw = yaw_for(kind, x, y)
        b = Box(x, y, yaw, hw, hd)
        if b.max_r() > limit or b.min_r() < sz['free'] or any(b.overlaps(o, 0.045) for o in placed):
            return None
        return b, yaw

    for i in range(want + 6):
        if len(houses) >= want:
            break
        kind = pick(rng, mix)
        p = _house_params(style, variant, kind, rng, size)
        for key in ('r', 'rx', 'ry', 'L', 'D', 'w', 'd'):
            if key in p:
                p[key] *= shrink
        hit = None
        for _ in range(500):  # random spots first (an irregular village)
            ang = rng.uniform(0, 360)
            if abs(((ang + 90 + 180) % 360) - 180) < GATE + 6:
                continue
            rad = sz['free'] + (limit - sz['free']) * math.sqrt(rng.random())
            hit = try_at(kind, p, rad * math.cos(math.radians(ang)), rad * math.sin(math.radians(ang)))
            if hit:
                break
        if not hit:  # then a sweep from the rim inward
            start = rng.uniform(0, 360)
            rad = limit
            while rad > sz['free'] and not hit:
                for k in range(120):
                    ang = start + k * 3.0
                    if abs(((ang + 90 + 180) % 360) - 180) < GATE + 6:
                        continue
                    hit = try_at(kind, p, rad * math.cos(math.radians(ang)), rad * math.sin(math.radians(ang)))
                    if hit:
                        break
                rad -= 0.04
        if not hit:
            continue
        b, yaw = hit
        placed.append(b)
        houses.append((kind, b.x, b.y, yaw, p))
    # props
    props = []
    scale = sz['props']

    def place_prop(kind, hw, hd, r_min=0.0, r_max=None, near=None):
        for _ in range(300):
            if near is not None:
                hx, hy, hyaw, hhd = near
                a = math.radians(hyaw - 90 + rng.uniform(-35, 35))
                dist = hhd + max(hw, hd) + 0.06
                x, y = hx + dist * math.cos(a), hy + dist * math.sin(a)
                yaw = rng.uniform(0, 360)
            else:
                ang = rng.uniform(0, 360)
                rad = rng.uniform(max(r_min, sz['free'] * 0.6), r_max or limit)
                x, y = rad * math.cos(math.radians(ang)), rad * math.sin(math.radians(ang))
                yaw = tm.facing_centre(x, y) + rng.uniform(-20, 20)
            b = Box(x, y, yaw, hw, hd)
            if b.max_r() > limit or b.min_r() < sz['free'] * 0.55:
                continue
            if any(b.overlaps(o, 0.03) for o in placed):
                continue
            placed.append(b)
            props.append((kind, x, y, yaw))
            return True
        return False

    pr = st['props']
    n = lambda k: int(round(pr.get(k, 0) * scale))  # noqa: E731
    for _ in range(n('pen')):
        place_prop('pen', 0.32, 0.23, r_min=limit * 0.55)
    for _ in range(n('field')):
        place_prop('field', 0.28, 0.19, r_min=limit * 0.6)
    for k in range(n('hearth')):
        h = houses[(k * 3) % len(houses)] if houses else None
        if h:
            hw, hd = foot(h[0], h[4])
            place_prop('hearth', 0.07, 0.07, near=(h[1], h[2], h[3], hd)) or place_prop('hearth', 0.07, 0.07)
    for _ in range(n('granary')):
        place_prop('granary', 0.12, 0.12)
    for _ in range(n('pits')):
        place_prop('pits', 0.17, 0.07)
    for _ in range(n('platform')):
        place_prop('platform', 0.15, 0.1)
    for _ in range(n('rack')):
        place_prop('rack', 0.12, 0.04)
    for _ in range(n('fishrack')):
        place_prop('fishrack', 0.13, 0.06)
    for _ in range(n('clutter')):
        place_prop('clutter', 0.08, 0.07)
    for _ in range(n('wood')):
        place_prop('wood', 0.1, 0.06)
    for _ in range(n('menhir')):
        place_prop('menhir', 0.04, 0.04)
    for _ in range(n('canoe')):
        place_prop('canoe', 0.18, 0.04, r_min=limit * 0.6)
    for _ in range(n('totem')):
        place_prop('totem', 0.04, 0.04)
    return lms, houses, props, fence_r


def draw_fence(ms, rng, kind, r):
    """The enclosure round the village, open at the south gate."""
    a0, a1 = -90 + GATE, 270 - GATE
    if kind in ('palisade', 'wall'):
        circ = 2 * math.pi * r * (a1 - a0) / 360
        if kind == 'palisade':
            n = int(circ / 0.042)
            for k in range(n + 1):
                a = math.radians(a0 + (a1 - a0) * k / n)
                h = rng.uniform(0.22, 0.27)
                x, y = r * math.cos(a), r * math.sin(a)
                ms.cyl('st_stake', 0.016, 0.016, h, at=(x, y, G - 0.01), segs=5, lod=0, caps=False)
                ms.cyl('st_stake', 0.016, 0.0, 0.035, at=(x, y, G - 0.01 + h), segs=5, lod=0, caps=False)
            mat, h1, thick = 'st_stake', 0.25, 0.034
        else:
            # a fieldstone wall in short runs (each its own piece) with a coping of flat stones
            n = int(circ / 0.22)
            for k in range(n):
                a = a0 + (a1 - a0) * (k + 0.5) / n
                ar = math.radians(a)
                x, y = r * math.cos(ar), r * math.sin(ar)
                seg = 2 * math.pi * r * (a1 - a0) / 360 / n - 0.012
                ms.box('stone', (seg, 0.07, 0.2), at=(x, y, G - 0.01), rot_z=a + 90, lod=0)
                ms.box('st_pebble', (seg + 0.006, 0.08, 0.02), at=(x, y, G + 0.19), rot_z=a + 90, lod=0)
            mat, h1, thick = 'stone', 0.21, 0.07
        # LOD1 and LOD2: plain runs of the same height
        for lod, step in ((1, 6.0), (2, 15.0)):
            m = int(round((a1 - a0) / step))
            for k in range(m):
                a = a0 + (a1 - a0) * (k + 0.5) / m
                ar = math.radians(a)
                seg = 2 * math.pi * r * (a1 - a0) / 360 / m
                ms.add(_box_bm(seg * 1.02, thick, h1), mat, lod, only=(lod,),
                       matrix=frame_at(r * math.cos(ar), r * math.sin(ar), a + 90) @ Matrix.Translation(Vector((0, 0, G - 0.01))))
        # gate posts
        for s in (-1, 1):
            a = math.radians(-90 + s * GATE)
            ms.cyl(mat if kind == 'wall' else 'st_stake', 0.03, 0.026, 0.34, at=(r * math.cos(a), r * math.sin(a), G - 0.01), segs=6, lod=1)
    else:
        # an earth bank in short arcs (each its own piece), a light stake fence on its crest
        step = 15.0
        m = int(round((a1 - a0) / step))
        for k in range(m):
            b0 = a0 + (a1 - a0) * k / m
            b1 = a0 + (a1 - a0) * (k + 1) / m - 0.6
            arc_band(ms, 'st_turf', r, 0.16, 0.085, b0, b1, 4, 0, only=(0,))
            arc_band(ms, 'st_turf', r, 0.16, 0.085, b0, b1, 2, 1, only=(1,))
            arc_band(ms, 'st_turf', r, 0.16, 0.085, b0, b1, 1, 2, only=(2,))
        circ = 2 * math.pi * r * (a1 - a0) / 360
        n = int(circ / 0.09)
        for k in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * k / n)
            ms.cyl('st_stake', 0.009, 0.009, 0.1, at=(r * math.cos(a), r * math.sin(a), G + 0.08), segs=4, lod=0, caps=False)
        for s in (-1, 1):
            a = math.radians(-90 + s * GATE)
            ms.cyl('st_stake', 0.026, 0.022, 0.3, at=(r * math.cos(a), r * math.sin(a), G - 0.01), segs=6, lod=1)


def _box_bm(w, d, h):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=(w, d, h), verts=bm.verts)
    return bm


def town_layout(style, size, variant):
    def layout(ms, rng):
        lms, houses, props, fence_r = plan(style, size, variant, rng)
        table = dict(LANDMARKS, **SMALL_LANDMARKS) if size == 'small' else LANDMARKS
        mats = LM_MATS.get(style, {})
        for name, x, y, yaw in lms:
            draw = table[name][0]
            if name in ('great-hut',) and mats:
                draw(ms, rng, x, y, yaw, **mats)
            else:
                draw(ms, rng, x, y, yaw)
        for kind, x, y, yaw, p in houses:
            draw_house(ms, rng, kind, x, y, yaw, p)
        st = STYLE[style]
        hut_mats = {'base': ('st_daub', 'thatch'), 'monsoon': ('st_bamboo', 'thatch'), 'americas': ('st_bark', 'reed'),
                    'levant': ('st_clay', 'reed'), 'indic': ('st_daub_red', 'thatch'), 'europe': ('st_daub', 'thatch'), 'steppe': ('st_hide', 'st_hide')}[style]
        for kind, x, y, yaw in props:
            if kind == 'pen':
                pen(ms, rng, x, y, yaw, beast=st['beast'], n=rng.randint(3, 5))
            elif kind == 'field':
                crop = {'monsoon': 'leaf', 'americas': 'leaf'}.get(style, 'barley' if rng.random() < 0.7 else 'leaf')
                field(ms, rng, x, y, yaw, crop=crop)
            elif kind == 'hearth':
                hearth(ms, rng, x, y)
            elif kind == 'granary':
                granary(ms, rng, x, y, *hut_mats)
            elif kind == 'pits':
                storage_pits(ms, rng, x, y)
            elif kind == 'platform':
                platform(ms, rng, x, y, yaw)
            elif kind == 'rack':
                drying_rack(ms, rng, x, y)
            elif kind == 'fishrack':
                fish_rack(ms, rng, x, y)
            elif kind == 'clutter':
                clutter(ms, rng, x, y)
            elif kind == 'wood':
                woodpile(ms, rng, x, y)
            elif kind == 'menhir':
                menhir(ms, rng, x, y)
            elif kind == 'canoe':
                canoe(ms, rng, x, y)
            elif kind == 'totem':
                totem(ms, rng, x, y)
        draw_fence(ms, rng, st['fence'][variant], fence_r)
    return layout


def file_name(style, size, variant):
    return 'stone-town-%s-%s%s' % (size, variant, '' if style == 'base' else '-' + style)


def _levels(p):
    _bm, _mat, lod, only = p
    if isinstance(only, int):
        only = (only,)
    return tuple(i for i in (0, 1, 2) if (only is None and i <= lod) or (only is not None and i in only))


def trim(ms, lod, budget):
    """Decimate the parts shown at `lod` when the town is over its budget (as build_improvement_fort_classical.trim)."""
    shown = [p for p in ms.parts if lod in _levels(p)]
    total = sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in shown)
    if total <= budget:
        return
    ratio = (budget - 20) / total
    rest = []
    for p in ms.parts:
        bm, mat, maxlod, _only = p
        lv = _levels(p)
        if lod not in lv:
            rest.append(p)
            continue
        others = tuple(i for i in lv if i != lod)
        if others:
            rest.append((bm.copy(), mat, maxlod, others))
        me = bpy.data.meshes.new('_trim')
        bm.to_mesh(me)
        ob = bpy.data.objects.new('_trim', me)
        bpy.context.collection.objects.link(ob)
        mod = ob.modifiers.new('budget', 'DECIMATE')
        mod.ratio = max(0.02, ratio)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        reduced = bmesh.new()
        reduced.from_mesh(ev.to_mesh())
        ev.to_mesh_clear()
        rest.append((reduced, mat, maxlod, (lod,)))
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)
        bm.free()
    ms.parts[:] = rest


def build(style, size, variant, out_dir, atlas=1024):
    name = file_name(style, size, variant)
    R = SIZES[size]['R']
    mat, colors = GROUNDS[style]
    CUR_GROUND['colors'] = colors
    ground = dict(rx=R * 0.99, ry=R * 0.95, square=None, mat=mat)
    seed = zlib.crc32(name.encode()) & 0xffff
    # the layout's own random stream (the bake's stream is build_file's)
    rng_seed = seed

    def layout(ms, rng):
        town_layout(style, size, variant)(ms, tm.seeded(rng_seed))
        trim(ms, 2, 1450)  # the far level within the town budget (validate_model.py: LOD2 1,500)
    return tt.build_file(name, [('town-%s-%s' % (size, variant), layout, ground)], out_dir, atlas=atlas, seed=seed)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    style, size, variant, out_dir = argv[:4]
    atlas = int(argv[4]) if len(argv) > 4 else 1024
    assert style in STYLES and size in SIZES and variant in ('a', 'b'), argv
    build(style, size, variant, out_dir, atlas)
    sys.stdout.flush()
    os._exit(0)
