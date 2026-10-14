# scripts/blender/ti_mesopotamia_bronze.py
# The Mesopotamian kit for the Bronze Age (audit I215; art spec 3b: a town is layout x kit), the look
# of Ur, Uruk, Kish, Mari and Susa in the third and second millennia BCE. There is no concept sheet:
# the references are the excavated towns themselves.
#   houses   rooms of sun-dried mud brick round an open court, walls plastered in earth tones with
#            the brick showing where the plaster has worn, flat mud roofs behind parapets with a
#            coping, a stair up from the court, reed screens, jars and date mats on the roofs; blank
#            outer walls with high vent slits and one door (Ur's Old Babylonian quarter). The rich
#            house adds an upper storey over the back range with a timber gallery over the court.
#   poor     on the edges, the marsh people's reed hut (a small mudhif: a barrel vault of bundled
#            reed arches over reed matting, two reed pillars at the door) or a one-room brick hut
#            with a reed shade and a bread oven.
#   landmark-1  the ziggurat (Ur-Nammu's at Ur): three tiers of mud brick in a baked-brick skin with
#            dark bitumen joints, buttressed walls, a central stair and two side stairs on the front
#            meeting at the first terrace, a plastered shrine on top with team banners.
#   landmark-2  the temple on its terrace (the White Temple, Eanna, the temple oval): a plastered
#            cella whose every face is buttressed and niched, a gate of two towers round a tall
#            stepped doorway, a baked-brick terrace with a front stair, team banners, date palms.
#   props    date palms, reed bundles and reed fences, a shaduf at the well, tannur bread ovens,
#            stalls under reed mats or team cloth, a mud-brick town gate, a canal with a reed boat.
# No text, no emblems. Scale as the other kits: 1 unit = 10 m, houses raised a little (the indic
# kit's rule: the brief's 1.3x storey makes small plots read as towers), landmarks fitted to the
# hall-clear caps (assemble_kit_towns.py HALL_CLEAR_DEFAULT). Materials carry the `msb_` prefix.
# The town layouts are in build_town_bronze_mesopotamia.py.
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

NEW = ['msb_brick', 'msb_baked', 'msb_plaster', 'msb_plaster2', 'msb_white', 'msb_roof', 'msb_reed', 'msb_reedmat',
       'msb_bitumen', 'msb_palm', 'msb_trunk', 'msb_water', 'msb_earth', 'msb_earth_fringe', 'msb_earth_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'msb_earth': 'Ground', 'msb_earth_fringe': 'Ground', 'msb_earth_square': 'Ground'})
if 'msb_earth_fringe' not in tt.FRINGES:
    tt.FRINGES.append('msb_earth_fringe')

EARTH = ('#9c8262', '#ae9572', '#a58b69', '#8f7757')  # grey-brown alluvial silt, trodden


def make_materials():
    # sun-dried mud brick, half under its earth plaster (the bare brick of walls and huts)
    tm.mat_mudwall('msb_brick', wash='#cbb089', brick='#b6926a', brick2='#a6835c', mortar='#8b6f4d', wash_cover=0.42,
                   bond=(0.038, 0.013, 0.0022))
    # baked brick laid in dark bitumen (the ziggurat's skin, the terrace casing, door frames)
    tm.mat_mudwall('msb_baked', wash='#b78b62', brick='#a8714a', brick2='#976240', mortar='#3d322a', wash_cover=0.0,
                   bond=(0.036, 0.012, 0.0024))
    # earth-tone plasters: buff and a warmer ochre, so neighbouring houses differ
    tm.mat_simple('msb_plaster', ['#c9ab80', '#bd9d73', '#d2b68c', '#b39268'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_simple('msb_plaster2', ['#c29c72', '#b68f68', '#cca680', '#a9845e'], scale=16.0, bump=0.25, dirt=True)
    # the gypsum plaster of shrines and the temple cella
    tm.mat_simple('msb_white', ['#ddd0b4', '#d1c3a5', '#e5dac2', '#c8b897'], scale=14.0, bump=0.2, dirt=True)
    tm.mat_simple('msb_roof', ['#a98b63', '#9c7e58', '#b5976d', '#937551'], scale=22.0, bump=0.35)
    # reed: bundles (grain along the bundle) and woven mats
    tm.mat_simple('msb_reed', ['#a68b52', '#c0a566', '#d2ba7b', '#977d48'], scale=14.0,
                  stripes={'dir': 'Z', 'scale': 150.0, 'distortion': 4.0}, bump=0.6)
    tm.mat_simple('msb_reedmat', ['#9b834f', '#b69b60', '#c7ae70', '#8b7445'], scale=14.0,
                  stripes={'dir': 'X', 'scale': 170.0, 'distortion': 3.0}, bump=0.55)
    tm.mat_simple('msb_bitumen', ['#221b16', '#30271f', '#29211a'], scale=20.0, rough=0.45, bump=0.15)
    tm.mat_simple('msb_palm', ['#4c6630', '#5f7c3a', '#738c45', '#526833'], scale=30.0, bump=0.5)
    tm.mat_simple('msb_trunk', ['#5f4a33', '#7b6141', '#54412d'], scale=10.0,
                  stripes={'dir': 'Z', 'scale': 220.0, 'distortion': 2.0}, bump=0.6)
    tm.mat_simple('msb_water', ['#3c5d57', '#4a6c63', '#58796d'], scale=10.0, rough=0.15, bump=0.0)
    for n in ('msb_earth', 'msb_earth_fringe'):
        tm.mat_earth(n, colors=EARTH)
    tm.mat_earth('msb_earth_square', colors=('#a88f6e', '#b79e7c', '#c0a886', '#a1886a'))


if not any(n == 'mesopotamia_bronze' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('mesopotamia_bronze', make_materials))

EARTH_GROUND = dict(mat='msb_earth')


# ---- basic parts --------------------------------------------------------------------------------

def obox(ms, mat, size, at=(0, 0, 0), frame=None, lod=2, only=None, rot_z=0.0):
    """A plain box (base at `at`) shown only at the LODs in `only`: a stand-in for LOD1 or LOD2."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = tm.Mesher._m(at, rot_z)
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, lod, m, only=only)


def rect(ms, f, mat, x0, x1, y0, y1, z, h, lod=2, bevel=0.0, taper=1.0):
    ms.box(mat, (x1 - x0, y1 - y0, h), at=((x0 + x1) / 2, (y0 + y1) / 2, z), lod=lod, frame=f, bevel=bevel, taper=taper)


def block(ms, f, x0, x1, y0, y1, z, h, wall='msb_plaster', lod=1, parapet=0.026, coping=True):
    """A flat-roofed room block: plastered walls, a mud roof inside a parapet with a coping."""
    rect(ms, f, wall, x0, x1, y0, y1, z, h, lod=lod, bevel=0.004)
    t = 0.014
    rect(ms, f, 'msb_roof', x0 + t, x1 - t, y0 + t, y1 - t, z + h, 0.004, lod=lod)
    if parapet:
        for (a, b, c, e) in ((x0, x1, y0, y0 + t), (x0, x1, y1 - t, y1), (x0, x0 + t, y0 + t, y1 - t), (x1 - t, x1, y0 + t, y1 - t)):
            rect(ms, f, wall, a, b, c, e, z + h, parapet, lod=0)
        if coping:  # a thin darker coping course along the front parapet (catches the light)
            rect(ms, f, 'msb_brick', x0 - 0.003, x1 + 0.003, y0 - 0.003, y0 + t + 0.003, z + h + parapet, 0.008, lod=0)
    return z + h


def footing(ms, f, x0, x1, y0, y1, h=0.03, lod=0):
    """The brick footing course at the foot of a plastered wall, a little proud of it."""
    rect(ms, f, 'msb_brick', x0 - 0.006, x1 + 0.006, y0 - 0.006, y1 + 0.006, G - 0.004, h + 0.004, lod=lod)


def door(ms, f, x, y, z, w=0.07, h=0.15, frame='msb_baked'):
    """A plank door set into the wall face at y (the wall's front), a baked-brick frame and sill."""
    ms.box('door', (w, 0.012, h), at=(x, y - 0.003, z), lod=1, frame=f)
    ms.box(frame, (w + 0.03, 0.016, 0.016), at=(x, y - 0.006, z + h), lod=0, frame=f)
    ms.box('msb_bitumen', (w + 0.02, 0.03, 0.008), at=(x, y - 0.014, z - 0.004), lod=0, frame=f)


def vent(ms, f, x, y, z, face=-1, along='x'):
    """A high narrow vent slit in a blank wall (Mesopotamian houses turn their backs on the street)."""
    if along == 'x':
        ms.box('dark', (0.022, 0.01, 0.03), at=(x, y + face * 0.004, z), lod=0, frame=f)
    else:
        ms.box('dark', (0.01, 0.022, 0.03), at=(x + face * 0.004, y, z), lod=0, frame=f)


def jar(ms, f, x, y, s=1.0, z=G):
    tt.jar(ms, f, x, y, s, z=z, mat='terracotta')


def bits(ms, f, x, y, rng, n=4, z=G):
    """Jars, baskets and grain sacks heaped round (x, y)."""
    for _ in range(n):
        px, py = x + rng.uniform(-0.06, 0.06), y + rng.uniform(-0.045, 0.045)
        r = rng.random()
        if r < 0.5:
            jar(ms, f, px, py, rng.uniform(0.8, 1.15), z=z)
        elif r < 0.75:
            tt.basket(ms, f, px, py, rng.uniform(0.9, 1.2), z=z)
        else:
            ms.sphere('linen', 0.03, at=(px, py, z + 0.02), scale=(1.1, 0.9, 0.75), u=7, v=5, lod=0, frame=f)


def reed_screen(ms, f, x, y, z, w=0.16, d=0.1, h=0.08):
    """A rooftop shelter: four poles and a flat reed mat."""
    for sx in (-w / 2 + 0.008, w / 2 - 0.008):
        for sy in (-d / 2 + 0.008, d / 2 - 0.008):
            ms.box('timber', (0.01, 0.01, h), at=(x + sx, y + sy, z), lod=0, frame=f)
    ms.box('msb_reedmat', (w + 0.02, d + 0.02, 0.01), at=(x, y, z + h), lod=1, frame=f)


def date_mat(ms, f, x, y, z, w=0.12, d=0.08):
    """A reed mat of dates drying on a roof: the mat and a dark crop on it."""
    ms.box('msb_reedmat', (w, d, 0.004), at=(x, y, z), lod=0, frame=f)
    ms.box('terracotta', (w * 0.7, d * 0.6, 0.004), at=(x, y, z + 0.004), lod=0, frame=f)


def hatch(ms, f, x, y, z):
    ms.box('msb_brick', (0.055, 0.055, 0.012), at=(x, y, z), lod=0, frame=f)
    ms.box('dark', (0.038, 0.038, 0.004), at=(x, y, z + 0.01), lod=0, frame=f)


def stair(ms, f, x, y0, y1, z0, z1, w=0.05, n=6, mat='msb_brick'):
    """Steps climbing from (x, y0) at z0 to (x, y1) at z1 along the frame's Y."""
    run = (y1 - y0) / n
    for k in range(n):
        ms.box(mat, (w, abs(run) + 0.002, (k + 1) * (z1 - z0) / n), at=(x, y0 + (k + 0.5) * run, z0), lod=0, frame=f)


def tannur(ms, f, x, y, s=1.0, z=G):
    """A clay bread oven: a squat dome with a dark mouth on top, a few sticks of fuel."""
    ms.sphere('msb_brick', 0.04 * s, at=(x, y, z), scale=(1, 1, 1.1), u=8, v=4, lod=0, frame=f, cut_below=0.0)
    ms.cyl('dark', 0.014 * s, 0.014 * s, 0.003, at=(x, y, z + 0.043 * s), segs=6, lod=0, frame=f)
    for k in range(2):
        ms.cyl('timber', 0.006, 0.006, 0.07 * s, at=(x + 0.055 * s, y - 0.01 + 0.014 * k, z + 0.006), rot=(0, 90, 0), segs=4, lod=0, frame=f)


# ---- date palm, reeds -----------------------------------------------------------------------------

def palm(ms, rng, x, y, h=0.5, fronds=8, lod=1, z=G, frame=None):
    """A date palm: a ringed trunk leaning a little, a crown of drooping fronds and a few hanging
    bunches (LOD0), a crown cone at LOD1 and LOD2."""
    lean = rng.uniform(-8, 8), rng.uniform(-8, 8)
    f = Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(lean[0]), 4, 'X') @ Matrix.Rotation(math.radians(lean[1]), 4, 'Y')
    if frame is not None:
        f = frame @ f
    ms.cyl('msb_trunk', 0.02, 0.014, h, at=(0, 0, 0), segs=6, lod=lod, frame=f)
    bm = bmesh.new()
    L = rng.uniform(0.15, 0.19) * (h / 0.5) ** 0.5
    prof = [(0.0, 0.0, 0.006), (0.3, 0.03, 0.028), (0.6, 0.015, 0.032), (1.0, -0.075, 0.004)]
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
    ms.add(bm, 'msb_palm', 0, matrix=f)
    for k in range(2):  # bunches of dates under the crown
        a = a0 + 90 + 160 * k
        ms.sphere('terracotta', 0.014, at=(0.02 * math.cos(math.radians(a)), 0.02 * math.sin(math.radians(a)), h - 0.025),
                  scale=(1, 1, 1.4), u=5, v=3, lod=0, frame=f)
    if lod >= 1:
        ms.cyl('msb_palm', 0.13 * L / 0.17, 0.03, 0.07, at=(0, 0, h - 0.05), segs=6, lod=lod, only=tuple(range(1, lod + 1)), frame=f)


def palm_at(ms, rng, x, y, h=None, lod=1):
    palm(ms, rng, x, y, h=h or rng.uniform(0.42, 0.6), fronds=rng.choice([7, 8]), lod=lod)


def reed_bundles(ms, f, x, y, rng, n=4, z=G):
    """Cut reed: bundles lying stacked and a few sheaves standing on end, tied (marsh trade)."""
    for k in range(n):
        yy = y + (k % 3 - 1) * 0.022
        zz = z + 0.012 + (k // 3) * 0.02
        ms.cyl('msb_reed', 0.012, 0.012, 0.17, at=(x - 0.085, yy, zz), rot=(0, 90, rng.uniform(-6, 6)), segs=5, lod=0, frame=f)
    for k in range(2):
        sx = x + 0.1 + 0.03 * k
        ms.cyl('msb_reed', 0.016, 0.005, 0.16, at=(sx, y + rng.uniform(-0.02, 0.02), z), rot=(rng.uniform(-8, 8), rng.uniform(-8, 8), 0),
               segs=5, lod=0, frame=f)


def reed_fence(ms, f, x0, y0, x1, y1, h=0.09, lod=0, z=G):
    """A reed-mat fence between two points with posts at the ends."""
    L = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    ms.box('msb_reedmat', (L, 0.008, h), at=((x0 + x1) / 2, (y0 + y1) / 2, z), rot_z=yaw, lod=lod, frame=f)
    for (px, py) in ((x0, y0), (x1, y1)):
        ms.box('msb_reed', (0.016, 0.016, h + 0.02), at=(px, py, z), lod=0, frame=f)


def _arch_profile(a, hh, n):
    """A parabolic reed arch from +a to -a (n + 1 points), slightly pointed at the crown."""
    pts = []
    for i in range(n + 1):
        t = math.pi * i / n
        pts.append((a * math.cos(t), hh * math.sin(t) ** 0.85))
    return pts


def arch_solid(ms, mat, f, y0, y1, a, hh, z0=G, n=8, lod=1, only=None):
    """A barrel vault with the arch profile, from y0 to y1 along the frame's Y, closed at the ends."""
    bm = bmesh.new()
    prof = _arch_profile(a, hh, n)
    front = [bm.verts.new((px, y0, z0 + pz)) for px, pz in prof]
    back = [bm.verts.new((px, y1, z0 + pz)) for px, pz in prof]
    for i in range(n):
        bm.faces.new((front[i], front[i + 1], back[i + 1], back[i]))
    bm.faces.new(list(reversed(front)))
    bm.faces.new(back)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ms.add(bm, mat, lod, f, only=only)


def reed_hut(ms, rng, f, w=0.5, d=0.62, door_side=-1, z0=G, fence=True):
    """The marsh reed house (a small mudhif): a barrel vault of reed matting over bundled-reed arches,
    the arches standing proud as ribs, two reed pillars at the door with tapering tops, a reed lattice
    over the doorway, a reed fence yard in front with cut reed stacked in it."""
    a = w * 0.42
    hh = min(0.34, 0.6 * w)
    y0, y1 = -d / 2 + 0.05, d / 2 - 0.02
    arch_solid(ms, 'msb_reedmat', f, y0, y1, a, hh, z0=z0, n=8, lod=1)
    arch_solid(ms, 'msb_reedmat', f, y0, y1, a, hh, z0=z0, n=4, lod=2, only=(2,))
    nrib = max(3, int((y1 - y0) / 0.09))
    for k in range(nrib):
        yy = y0 + 0.012 + (y1 - y0 - 0.024) * k / (nrib - 1)
        arch_solid(ms, 'msb_reed', f, yy - 0.008, yy + 0.008, a + 0.008, hh + 0.008, z0=z0, n=8, lod=0)
    # the door pillars (bundles of reed bound tight, taller than the vault) and the door
    for sx in (-1, 1):
        ms.cyl('msb_reed', 0.024, 0.008, hh * 1.25, at=(sx * a, y0 - 0.006, z0), segs=6, lod=1, frame=f)
    ms.box('dark', (0.07, 0.01, hh * 0.55), at=(0, y0 - 0.002, z0), lod=1, frame=f)
    for k in range(3):  # the reed lattice over the doorway
        ms.box('msb_reed', (0.08 - 0.015 * k, 0.008, 0.008), at=(0, y0 - 0.006, z0 + hh * (0.6 + 0.09 * k)), lod=0, frame=f)
    if fence:
        yf = y0 - 0.12
        reed_fence(ms, f, -w / 2 + 0.02, yf, -0.06, yf)
        reed_fence(ms, f, 0.06, yf, w / 2 - 0.02, yf)
        reed_bundles(ms, f, w / 2 - 0.12, y0 - 0.06, rng, 3, z=z0)
    return z0 + hh


# ---- houses -------------------------------------------------------------------------------------
# Every house fills its plot (w x d, local -Y the front facing the town centre).

def _stand_in(ms, f, w, d, h, wall='msb_plaster', inset=0.015):
    """The LOD2 stand-in: one block with a mud-roof top over the whole house."""
    obox(ms, wall, (w - 2 * inset, d - 2 * inset, h), at=(0, 0, G - 0.004), lod=2, only=2, frame=f)
    obox(ms, 'msb_roof', (w - 2 * inset - 0.02, d - 2 * inset - 0.02, 0.006), at=(0, 0, G + h - 0.004), lod=2, only=2, frame=f)


def poor_house(ms, rng, x, y, w, d, yaw=None, side=None, reed=False, yard=0.0):
    """The poor house: the marsh reed hut (`reed`), or one mud-brick room under a flat roof at the back
    of its plot with a reed shade over the door, a bread oven and jars in a yard walled in reed."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D, m = w / 2, d / 2, 0.012
    if reed:
        reed_hut(ms, rng, f, w=w * 0.95, d=d * 0.95)
        return f
    h = 0.26
    rd = max(0.26, 0.58 * d)
    y0 = D - m - rd
    wall = 'msb_brick' if rng.random() < 0.55 else 'msb_plaster2'
    footing(ms, f, -W + m, W - m, y0, D - m, lod=0)
    top = block(ms, f, -W + m, W - m, y0, D - m, G, h, wall=wall)
    side = side if side is not None else rng.choice([-1, 1])
    dx = side * 0.18 * w
    door(ms, f, dx, y0, G, w=0.065, h=0.14)
    vent(ms, f, -dx, y0, G + 0.2)
    vent(ms, f, rng.uniform(-0.2, 0.2) * w, D - m, G + 0.2, face=1)
    # the reed shade on poles before the door
    sw, sd = min(0.22, w * 0.42), 0.1
    for sx in (-sw / 2 + 0.01, sw / 2 - 0.01):
        ms.box('timber', (0.01, 0.01, 0.15), at=(dx + sx, y0 - sd, G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((dx, y0 - sd / 2, G + 0.16))) @ Matrix.Rotation(math.radians(-10), 4, 'X')
    ms.box('msb_reedmat', (sw, sd + 0.02, 0.008), at=(0, 0, 0), lod=1, frame=pf)
    # the yard: reed fence, a bread oven, jars
    reed_fence(ms, f, -W + m, -D + m + 0.01, -0.05 * side - 0.06, -D + m + 0.01)
    reed_fence(ms, f, -0.05 * side + 0.06, -D + m + 0.01, W - m, -D + m + 0.01)
    tannur(ms, f, -side * (W - 0.09), (-D + y0) / 2)
    bits(ms, f, side * (W - 0.1), (-D + y0) / 2, rng, 2)
    reed_screen(ms, f, -side * 0.2 * w, (y0 + D) / 2, top, w=0.13, d=0.09)
    if rng.random() < 0.5:
        date_mat(ms, f, side * 0.18 * w, (y0 + D) / 2, top)
    _stand_in(ms, f, w, rd + 0.02, h, wall=wall)
    return f


def court_house(ms, rng, x, y, w, d, yaw=None, rich=False, side=None, upper=None, tree_in=True):
    """The courtyard house of Ur: rooms on three (common) or four (rich) sides of an open court,
    plastered walls on a brick footing, flat mud roofs behind parapets, a stair from the court to
    the roof, a reed shade over part of the court, a palm or jars in it, a blank street front with
    one door and high vents. `rich`: an upper storey over the back range with a timber gallery on
    posts round the court, a baked-brick door frame and a team awning over the door."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D, m = w / 2, d / 2, 0.012
    wall = 'msb_plaster' if (rich or rng.random() < 0.5) else 'msb_plaster2'
    h = 0.3 if rich else 0.28
    fd = max(0.11, 0.21 * d)
    bd = max(0.13, 0.3 * d)
    sw = max(0.12, 0.26 * w)
    side = side if side is not None else rng.choice([-1, 1])
    yf, yb = -D + m + fd, D - m - bd
    footing(ms, f, -W + m, W - m, -D + m, D - m, lod=0)
    block(ms, f, -W + m, W - m, -D + m, yf, G, h * 0.92, wall=wall)
    top_b = block(ms, f, -W + m, W - m, yb, D - m, G, h, wall=wall)
    xa, xb = sorted((side * (W - m), side * (W - m - sw)))
    top_s = block(ms, f, xa, xb, yf, yb, G, h * 0.96, wall=wall)
    if rich:
        ow = max(0.1, 0.2 * w)
        oa, ob = sorted((-side * (W - m), -side * (W - m - ow)))
        block(ms, f, oa, ob, yf, yb, G, h * 0.9, wall=wall)
        cx0, cx1 = sorted((side * (W - m - sw), -side * (W - m - ow)))
    else:
        t = 0.024
        oa, ob = sorted((-side * (W - m), -side * (W - m - t)))
        rect(ms, f, wall, oa, ob, yf, yb, G, h * 0.78, lod=1)
        cx0, cx1 = sorted((side * (W - m - sw), -side * (W - m - t)))
    # the court: packed floor, a reed shade on poles along the back range, a palm or a jar stand
    ccx, ccy = (cx0 + cx1) / 2, (yf + yb) / 2
    cw = cx1 - cx0
    rect(ms, f, 'msb_roof', cx0, cx1, yf, yb, G, 0.003, lod=1)
    pw = cw - 0.02
    for px in (ccx - pw / 2 + 0.01, ccx + pw / 2 - 0.01):
        ms.box('timber', (0.01, 0.01, h * 0.62), at=(px, yb - 0.06, G), lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((ccx, yb - 0.03, G + h * 0.62))) @ Matrix.Rotation(math.radians(-10), 4, 'X')
    ms.box('msb_reedmat', (pw, 0.075, 0.008), at=(0, 0, 0), lod=1, frame=pf)
    if tree_in and (yb - yf) > 0.16 and cw > 0.16:
        palm(ms, rng, ccx + side * min(0.04, cw * 0.15), ccy - 0.01, h=rng.uniform(0.4, 0.5), fronds=7, lod=1, frame=f)
    else:
        jar(ms, f, ccx, ccy, 1.0)
        jar(ms, f, ccx + 0.04, ccy - 0.02, 0.8)
    # the stair from the court to the roof of the side range
    sx = (cx1 - 0.032) if side < 0 else (cx0 + 0.032)
    stair(ms, f, sx, yf + 0.02, yb - 0.08, G, G + h * 0.85, w=0.045, n=6, mat=wall)
    # the street front: one door, high vents
    dx = rng.uniform(-0.14, 0.14) * w
    door(ms, f, dx, -D + m, G, w=0.075 if rich else 0.068, h=0.16 if rich else 0.15)
    if rich:
        af = f @ Matrix.Translation(Vector((dx, -D + m - 0.045, G + 0.2))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
        ms.box('team_cloth', (0.15, 0.09, 0.008), at=(0, 0, 0), lod=1, frame=af)
        for sx2 in (-0.065, 0.065):
            ms.box('timber', (0.008, 0.008, 0.19), at=(dx + sx2, -D + m - 0.085, G), lod=0, frame=f)
    for vx in (-0.32 * w, 0.32 * w):
        if abs(vx - dx) > 0.1:
            vent(ms, f, vx, -D + m, G + h * 0.78)
    vent(ms, f, rng.uniform(-0.25, 0.25) * w, D - m, G + h * 0.8, face=1)
    vent(ms, f, side * (W - m), ccy, G + h * 0.8, face=side, along='y')
    # roofs: reed screen, hatch, jars, a date mat
    if upper or (upper is None and rich):
        top2 = block(ms, f, -W + m + 0.02, W - m - 0.02, yb + 0.005, D - m, top_b, 0.22, wall=wall)
        door(ms, f, -side * 0.2 * w, yb + 0.005, top_b, w=0.055, h=0.12)
        # the timber gallery on posts along the court face of the upper storey
        gx0, gx1 = cx0 + 0.015, cx1 - 0.015
        for k in range(3):
            px = gx0 + (gx1 - gx0) * k / 2
            ms.box('timber', (0.012, 0.012, top_b - G + 0.01), at=(px, yb - 0.05, G), lod=0, frame=f)
        rect(ms, f, 'timber', gx0 - 0.01, gx1 + 0.01, yb - 0.06, yb, top_b - 0.006, 0.012, lod=1)
        rect(ms, f, 'timber', gx0 - 0.01, gx1 + 0.01, yb - 0.062, yb - 0.052, top_b + 0.006, 0.045, lod=0)  # the rail
        hatch(ms, f, side * 0.25 * w, (yb + D) / 2, top2)
        reed_screen(ms, f, -side * 0.15 * w, (yb + D) / 2, top2, w=0.14, d=min(0.1, bd - 0.04))
    else:
        reed_screen(ms, f, side * 0.15 * w, (yb + D) / 2, top_b, w=min(0.18, 0.3 * w), d=min(0.1, bd - 0.04))
        hatch(ms, f, -side * 0.25 * w, (yb + D) / 2, top_b)
    if rng.random() < 0.6:
        date_mat(ms, f, (xa + xb) / 2, (yf + yb) / 2, top_s, w=min(0.1, sw - 0.03), d=0.1)
    else:
        jar(ms, f, (xa + xb) / 2, (yf + yb) / 2 + 0.03, 0.85, z=top_s)
    _stand_in(ms, f, w, d, h * (1.5 if rich else 1.0), wall=wall)
    return f


def mesopotamia_house(ms, rng, slot):
    """Build one house from a slot dict: x, y, w, d, kind ('poor', 'common', 'rich') and options (the
    entry point build_houses_damage_bronze.py, build_rts_skins_bronze.py and the civic builds use)."""
    s = dict(slot)
    kind = s.pop('kind')
    s.pop('yard', None)
    x, y, w, d = s.pop('x'), s.pop('y'), s.pop('w'), s.pop('d')
    if kind == 'poor':
        return poor_house(ms, rng, x, y, w, d, **s)
    return court_house(ms, rng, x, y, w, d, rich=(kind == 'rich'), **s)


# ---- street props -------------------------------------------------------------------------------

def shaduf_well(ms, rng, x, y, yaw=20):
    """A brick well head with a shaduf: an upright post, a long sweep with a clay counterweight and a
    bucket, a water trough beside it."""
    f = tm.house_frame(x, y, yaw)
    ms.cyl('msb_baked', 0.07, 0.07, 0.05, at=(0, 0, G), segs=12, lod=1, frame=f)
    ms.cyl('msb_water', 0.052, 0.052, 0.004, at=(0, 0, G + 0.048), segs=10, lod=0, frame=f)
    ms.box('timber', (0.018, 0.018, 0.2), at=(0.1, 0, G), lod=1, frame=f)
    sf = f @ Matrix.Translation(Vector((0.1, 0, G + 0.2))) @ Matrix.Rotation(math.radians(-24), 4, 'Y')
    ms.box('timber', (0.38, 0.012, 0.012), at=(-0.06, 0, 0), lod=0, frame=sf)
    ms.sphere('msb_brick', 0.028, at=(0.13, 0, 0), lod=0, frame=sf)
    ms.box('timber', (0.004, 0.004, 0.09), at=(-0.03, 0, G + 0.13), lod=0, frame=f)
    jar(ms, f, -0.03, 0, 0.7, z=G + 0.08)
    rect(ms, f, 'msb_brick', 0.08, 0.26, -0.11, -0.06, G, 0.025, lod=0)
    ms.box('msb_water', (0.16, 0.035, 0.004), at=(0.17, -0.085, G + 0.022), lod=0, frame=f)
    return f


def stall(ms, x, y, rng, yaw=None, cloth='team_cloth', w=0.26, d=0.18):
    """A market stall: a mud-brick counter, four poles and a reed-mat or team-cloth canopy, jars,
    baskets and sacks of grain and dates."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hf, hb = 0.17, 0.21
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('timber', (0.012, 0.012, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('timber', (0.012, 0.012, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    cf = f @ Matrix.Translation(Vector((0, 0, G + (hf + hb) / 2 + 0.008))) @ Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(cloth, (w + 0.04, d + 0.05, 0.008), at=(0, 0, 0), lod=1, frame=cf)
    ms.box('msb_brick', (w - 0.03, d * 0.42, 0.06), at=(0, -d * 0.18, G), lod=0, frame=f, bevel=0.003)
    for k in range(3):
        gx = -w / 2 + 0.055 + k * (w - 0.11) / 2
        r = rng.random()
        if r < 0.4:
            tt.basket(ms, f, gx, -d * 0.18, 0.8, z=G + 0.06)
        elif r < 0.7:
            jar(ms, f, gx, -d * 0.18, 0.6, z=G + 0.06)
        else:
            ms.sphere('linen', 0.026, at=(gx, -d * 0.18, G + 0.078), scale=(1.1, 0.9, 0.75), u=7, v=5, lod=0, frame=f)
    jar(ms, f, w / 2 + 0.03, -d / 2, rng.uniform(0.9, 1.15))


def hut_at(ms, rng, x, y, w=0.46, d=0.56, yaw=None):
    """A free-standing reed hut at the town's edge (its door toward the centre)."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    reed_hut(ms, rng, f, w=w, d=d, fence=False)
    reed_bundles(ms, f, w / 2 + 0.02, -d / 2 + 0.05, rng, 3)


def bundles_at(ms, rng, x, y, yaw=0.0, n=5):
    reed_bundles(ms, tm.house_frame(x, y, yaw), 0, 0, rng, n)


def oven_at(ms, x, y):
    tannur(ms, tm.house_frame(x, y, 0), 0, 0)


def bits_at(ms, rng, x, y, n=4):
    bits(ms, tm.house_frame(0, 0, 0), x, y, rng, n)


def canal(ms, rng, x0, y0, x1, y1, w=0.16, boat=True):
    """An irrigation canal across the town's edge: water between raised mud banks, reeds along it,
    a reed boat moored (only on the ground: nothing below Z = 0)."""
    L = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    f = tm.house_frame((x0 + x1) / 2, (y0 + y1) / 2, yaw)
    ms.box('msb_water', (L, w, 0.004), at=(0, 0, G - 0.002), lod=1, frame=f)
    for sy in (-1, 1):
        ms.box('msb_brick', (L, 0.035, 0.018), at=(0, sy * (w / 2 + 0.017), G - 0.006), lod=1, frame=f, taper=0.7)
    for k in range(int(L / 0.12)):
        sx = -L / 2 + 0.06 + k * 0.12 + rng.uniform(-0.03, 0.03)
        sy = rng.choice([-1, 1]) * (w / 2 + 0.05)
        ms.cyl('msb_palm', 0.012, 0.002, rng.uniform(0.07, 0.11), at=(sx, sy, G), segs=4, lod=0, frame=f)
    if boat:  # a reed boat: a long bundle with upturned ends
        bf = f @ Matrix.Translation(Vector((L * 0.15, 0, G + 0.006)))
        ms.cyl('msb_reed', 0.022, 0.022, 0.2, at=(-0.1, 0, 0.012), rot=(0, 90, 0), segs=6, lod=0, frame=bf)
        for sx, r in ((-0.1, 35), (0.1, -35)):
            ms.cyl('msb_reed', 0.016, 0.006, 0.07, at=(sx, 0, 0.014), rot=(0, r, 0), segs=5, lod=0, frame=bf)
    return f


def town_gate(ms, rng, x, y, yaw=0.0, width=0.3, h=0.5):
    """A mud-brick town gate: two buttressed towers with parapets, a timber lintel over the passage,
    a team pennant, stubs of the town wall either side."""
    f = tm.house_frame(x, y, yaw)
    tw = 0.24
    for sx in (-1, 1):
        cx = sx * (width / 2 + tw / 2)
        block(ms, f, cx - tw / 2, cx + tw / 2, -0.12, 0.12, G, h, wall='msb_brick', lod=2, parapet=0.03, coping=False)
        for k in (-1, 1):  # buttresses on the front face
            ms.box('msb_brick', (0.035, 0.018, h - 0.02), at=(cx + k * 0.07, -0.128, G), lod=0, frame=f)
        vent(ms, f, cx, -0.12, G + h * 0.72)
        rect(ms, f, 'msb_brick', cx + sx * tw / 2, cx + sx * (tw / 2 + 0.36), -0.04, 0.04, G, 0.22, lod=1)
    ms.box('timber', (width + 0.06, 0.2, 0.035), at=(0, 0, G + h * 0.62), lod=1, frame=f)
    rect(ms, f, 'msb_brick', -width / 2, width / 2, -0.1, 0.1, G + h * 0.62 + 0.035, h * 0.38 - 0.035, lod=2)
    rect(ms, f, 'msb_bitumen', -width / 2, width / 2, -0.16, 0.16, G - 0.004, 0.008, lod=1)
    px = -(width / 2 + tw / 2)
    ms.cyl('timber', 0.009, 0.007, 0.22, at=(px, 0, G + h + 0.028), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, px, 0, G + h + 0.245, yaw=-160, w=0.2, h=0.12)


# ---- landmark 1: the ziggurat -------------------------------------------------------------------

def _buttresses(ms, f, x0, x1, y, z, h, step=0.075, face=-1, depth=0.014, w=0.03, mat='msb_baked', lod=0):
    """Shallow buttresses along a wall face at y (face -1: the front, +1: the back)."""
    n = max(2, int((x1 - x0) / step))
    for k in range(n + 1):
        px = x0 + (x1 - x0) * k / n
        ms.box(mat, (w, depth, h), at=(px, y + face * depth / 2, z), lod=lod, frame=f)


def _side_buttresses(ms, f, y0, y1, x, z, h, step=0.075, face=-1, depth=0.014, w=0.03, mat='msb_baked', lod=0):
    n = max(2, int((y1 - y0) / step))
    for k in range(n + 1):
        py = y0 + (y1 - y0) * k / n
        ms.box(mat, (depth, w, h), at=(x + face * depth / 2, py, z), lod=lod, frame=f)


def _tier(ms, f, x0, x1, y0, y1, z, h, taper=0.94, lod=2, bands=True):
    """One battered tier: a baked-brick skin over the mud-brick core, a bitumen band at its top and
    the dark reed-mat layer lines of the core showing as thin bands."""
    rect(ms, f, 'msb_baked', x0, x1, y0, y1, z, h, lod=lod, taper=taper)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    tw, td = (x1 - x0) * taper, (y1 - y0) * taper
    rect(ms, f, 'msb_brick', cx - tw / 2 + 0.01, cx + tw / 2 - 0.01, cy - td / 2 + 0.01, cy + td / 2 - 0.01, z + h, 0.006, lod=min(lod, 1))
    if bands:
        for k in (0.35, 0.7):  # reed-layer lines (thin dark courses on the battered faces)
            s = 1 - (1 - taper) * k
            ms.box('msb_bitumen', ((x1 - x0) * s + 0.004, (y1 - y0) * s + 0.004, 0.006), at=(cx, cy, z + h * k), lod=0, frame=f)
    return z + h


def ziggurat(ms, rng, x, y, w=1.45, d=1.25, h=1.18, yaw=None):
    """The ziggurat (Ur-Nammu's at Ur, about 64 x 46 m and 30 m high, here fitted to its spot):
    three battered tiers of baked brick with bitumen joints, the first buttressed all round, a
    central stair running straight up the front to the second terrace and two side stairs along the
    front face meeting it at the first, gate piers where they meet, a gypsum-plastered shrine on the
    top terrace with a door and two team banners. `h` is the top of the banner poles."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    stair_d = 0.22 * d                    # the central stair projects in front of the first tier
    fy0 = -D + stair_d                    # the first tier's front face
    hs = h / 1.18
    h1, h2, h3 = 0.36 * hs, 0.22 * hs, 0.14 * hs
    shrine_h = 0.16 * hs
    # tier 1 with buttresses on the front and sides
    z1 = _tier(ms, f, -W, W, fy0, D, G - 0.004, h1 + 0.004, taper=0.93)
    _buttresses(ms, f, -W + 0.04, W - 0.04, fy0 + 0.01, G, h1 * 0.88, step=0.09, face=-1)
    for sx in (-1, 1):
        _side_buttresses(ms, f, fy0 + 0.04, D - 0.04, sx * (W - 0.01), G, h1 * 0.88, step=0.1, face=sx)
    # tier 2 (set back toward the rear), tier 3
    t2 = (-W * 0.66, W * 0.66, fy0 + 0.3 * (D - fy0), D - 0.08 * d)
    z2 = _tier(ms, f, t2[0], t2[1], t2[2], t2[3], z1, h2, taper=0.92)
    t3 = (-W * 0.4, W * 0.4, t2[2] + 0.28 * (t2[3] - t2[2]), t2[3] - 0.08 * d)
    z3 = _tier(ms, f, t3[0], t3[1], t3[2], t3[3], z2, h3, taper=0.92, bands=False)
    # the shrine on top: white plaster, a dark door, a brick cornice, two team banners
    sx0, sx1 = t3[0] * 0.62, t3[1] * 0.62
    sy0, sy1 = t3[2] + 0.04, t3[3] - 0.04
    top = block(ms, f, sx0, sx1, sy0, sy1, z3, shrine_h, wall='msb_white', lod=2, parapet=0.018)
    door(ms, f, 0, sy0, z3, w=0.06, h=shrine_h * 0.62, frame='msb_baked')
    _buttresses(ms, f, sx0 + 0.02, sx1 - 0.02, sy0, z3, shrine_h * 0.9, step=0.05, face=-1, mat='msb_white', depth=0.008, w=0.016)
    pole_h = max(0.08, h - (top - G) - 0.004)
    for sx in (sx0 + 0.02, sx1 - 0.02):
        ms.cyl('timber', 0.007, 0.006, pole_h, at=(sx, sy0 - 0.02, top - shrine_h), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, sx, sy0 - 0.02, top - shrine_h + pole_h - 0.004, yaw=-120 if sx < 0 else -60, w=0.1, h=0.07)
    # the stairs: the central one from the ground to the second terrace, two side flights along the
    # front face to the first terrace, gate piers at the landing
    cw = max(0.12, 0.13 * w)
    n = 12
    y_c0, y_c1 = -D, t2[2]
    for k in range(n):
        yy0 = y_c0 + (y_c1 - y_c0) * k / n
        ms.box('msb_baked', (cw, (y_c1 - y_c0) / n + 0.002, (z2 - G) * (k + 1) / n), at=(0, yy0 + (y_c1 - y_c0) / n / 2, G - 0.004),
               lod=0, frame=f)
    pf = f @ Matrix.Translation(Vector((0, (y_c0 + y_c1) / 2, (G + z2) / 2))) @ Matrix.Rotation(math.atan2(z2 - G, y_c1 - y_c0), 4, 'X')
    obox(ms, 'msb_baked', (cw, math.hypot(y_c1 - y_c0, z2 - G), 0.02), at=(0, 0, -0.01), frame=pf, lod=2, only=(1, 2))
    for sx in (-1, 1):  # the cheek walls of the central stair
        ms.box('msb_baked', (0.022, fy0 - y_c0, (z1 - G) * 0.5), at=(sx * (cw / 2 + 0.011), (y_c0 + fy0) / 2, G - 0.004), lod=1, frame=f)
    for sx in (-1, 1):  # the side flights climbing toward the middle along the front face
        xa, xb = sx * (W - 0.03), sx * (cw / 2 + 0.06)
        ns = 9
        for k in range(ns):
            xx = xa + (xb - xa) * (k + 0.5) / ns
            ms.box('msb_baked', (abs(xb - xa) / ns + 0.002, 0.075, (z1 - G) * (k + 1) / ns), at=(xx, fy0 - 0.0375, G - 0.004), lod=0, frame=f)
        sf = f @ Matrix.Translation(Vector(((xa + xb) / 2, fy0 - 0.0375, (G + z1) / 2))) @ Matrix.Rotation(sx * math.atan2(z1 - G, abs(xb - xa)), 4, 'Y')
        obox(ms, 'msb_baked', (math.hypot(xb - xa, z1 - G), 0.075, 0.02), at=(0, 0, -0.01), frame=sf, lod=2, only=(1, 2))
        # the gate pier at the landing
        ms.box('msb_baked', (0.05, 0.05, 0.09 * hs), at=(sx * (cw / 2 + 0.035), fy0 + 0.02, z1), lod=1, frame=f)
    # offerings at the foot: jars and a palm or two
    jar(ms, f, -cw / 2 - 0.06, -D + 0.02, 1.1)
    jar(ms, f, cw / 2 + 0.07, -D + 0.03, 1.0)
    return f


# ---- landmark 2: the temple on its terrace ------------------------------------------------------

NICHE = 'msb_roof'  # the shadowed back of a niche: a darker earth tone, not black

def _niched_face(ms, f, x0, x1, y, z, h, face=-1, step=0.055, mat='msb_white', lod=0):
    """The niched-and-buttressed rhythm of a temple wall along x: buttresses with a recessed stepped
    niche (a dark slit) between each pair."""
    n = max(2, int((x1 - x0) / step))
    for k in range(n + 1):
        px = x0 + (x1 - x0) * k / n
        ms.box(mat, (0.022, 0.014, h), at=(px, y + face * 0.007, z), lod=lod, frame=f)
        if k < n:
            mx = px + (x1 - x0) / n / 2
            ms.box(NICHE, (0.008, 0.004, h * 0.5), at=(mx, y + face * 0.001, z + h * 0.24), lod=0, frame=f)


def _niched_side(ms, f, y0, y1, x, z, h, face=-1, step=0.055, mat='msb_white', lod=0):
    n = max(2, int((y1 - y0) / step))
    for k in range(n + 1):
        py = y0 + (y1 - y0) * k / n
        ms.box(mat, (0.014, 0.022, h), at=(x + face * 0.007, py, z), lod=lod, frame=f)
        if k < n:
            my = py + (y1 - y0) / n / 2
            ms.box(NICHE, (0.004, 0.008, h * 0.5), at=(x + face * 0.001, my, z + h * 0.24), lod=0, frame=f)


def temple(ms, rng, x, y, w=1.3, d=1.05, h=1.0, yaw=None, palms=True):
    """The temple on its terrace (the White Temple at Uruk, the temples of Ur and Mari): a terrace
    cased in baked brick with a front stair, a long cella plastered white with buttresses and
    niches on every face, a gate of two towers round a tall stepped doorway in the long front, team
    banners on the towers, an offering table and date palms on the terrace. `h` is the banner tops."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    W, D = w / 2, d / 2
    hs = h / 1.0
    th = 0.14 * hs                         # the terrace
    sd = 0.14 * d                          # its front stair
    ty0 = -D + sd
    zt = _tier(ms, f, -W, W, ty0, D, G - 0.004, th + 0.004, taper=0.97, bands=False)
    _buttresses(ms, f, -W + 0.03, W - 0.03, ty0 + 0.003, G, th * 0.9, step=0.08, face=-1, depth=0.01, w=0.03)
    n = 6
    sw = max(0.16, 0.2 * w)
    for k in range(n):
        ms.box('msb_baked', (sw, sd / n + 0.002, (zt - G) * (k + 1) / n), at=(0, -D + sd * (k + 0.5) / n, G - 0.004), lod=0, frame=f)
    obox(ms, 'msb_baked', (sw, sd, (zt - G) * 0.55), at=(0, -D + sd / 2, G - 0.004), frame=f, lod=2, only=(1, 2))
    rect(ms, f, 'msb_roof', -W + 0.02, W - 0.02, ty0 + 0.02, D - 0.02, zt, 0.004, lod=1)  # the terrace's paving of mud plaster
    # the cella
    cx0, cx1 = -W * 0.78, W * 0.78
    cy0, cy1 = ty0 + 0.24 * (D - ty0), D - 0.08 * d
    ch = 0.44 * hs
    top = block(ms, f, cx0, cx1, cy0, cy1, zt, ch, wall='msb_white', lod=2, parapet=0.02)
    _niched_face(ms, f, cx0 + 0.02, cx1 - 0.02, cy0, zt, ch * 0.94, face=-1)
    _niched_face(ms, f, cx0 + 0.02, cx1 - 0.02, cy1, zt, ch * 0.94, face=1, lod=0)
    for sx in (-1, 1):
        _niched_side(ms, f, cy0 + 0.02, cy1 - 0.02, cx0 if sx < 0 else cx1, zt, ch * 0.94, face=sx)
    # the gate towers and the tall stepped doorway between them
    gw = 0.11
    gh = ch * 1.18
    for sx in (-1, 1):
        gx = sx * 0.11
        block(ms, f, gx - gw / 2, gx + gw / 2, cy0 - 0.06, cy0 + 0.02, zt, gh, wall='msb_white', lod=2, parapet=0.016, coping=False)
        ms.box('team_cloth', (0.05, 0.006, gh * 0.5), at=(gx, cy0 - 0.064, zt + gh * 0.32), lod=1, frame=f)
    for k, (ww, dz) in enumerate(((0.1, 0.0), (0.08, 0.012), (0.06, 0.024))):  # the recessed jambs
        ms.box('msb_baked' if k < 2 else 'dark', (ww, 0.01, ch * 0.78 - dz), at=(0, cy0 - 0.004 + k * 0.004, zt), lod=1 if k == 2 else 0, frame=f)
    pole_h = max(0.06, h - (zt - G + gh) - 0.01)
    for sx in (-1, 1):
        gx = sx * 0.11
        ms.cyl('timber', 0.006, 0.005, pole_h, at=(gx, cy0 - 0.02, zt + gh), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, gx, cy0 - 0.02, zt + gh + pole_h - 0.004, yaw=-120 if sx < 0 else -60, w=0.09, h=0.06)
    # the offering table and jars before the door, palms at the terrace's front corners
    ms.box('msb_baked', (0.1, 0.05, 0.05), at=(0, cy0 - 0.14, zt), lod=0, frame=f)
    jar(ms, f, -0.1, cy0 - 0.13, 0.9, z=zt)
    jar(ms, f, 0.1, cy0 - 0.12, 0.8, z=zt)
    if palms:
        for sx in (-1, 1):
            palm(ms, rng, sx * (W - 0.1), ty0 + 0.1, h=min(0.5, h * 0.48), fronds=7, lod=1, z=zt, frame=f)
    return f


# ---- the shared file's palaces (shared-bronze-mesopotamia.glb) ------------------------------------

def mudhif_hall(ms, rng):
    """`palace-small` (8 m): the chief's guest hall of the marshes, a great mudhif: a tall barrel
    vault of reed matting on eleven bundled-reed arches, the front a lattice of reed over the door
    between two tall reed pillars with team flags on their tips, a reed-fenced forecourt with a
    hearth and cut reed stacked. Front to -Y, about 8 m to the flag tips."""
    f = tm.house_frame(0, 0.03, 0)
    w, d = 0.6, 0.78
    a, hh = w * 0.47, 0.46
    y0, y1 = -d / 2 + 0.08, d / 2
    arch_solid(ms, 'msb_reedmat', f, y0, y1, a, hh, n=10, lod=1)
    arch_solid(ms, 'msb_reedmat', f, y0, y1, a, hh, n=5, lod=2, only=(2,))
    nrib = 9
    for k in range(nrib):
        yy = y0 + 0.012 + (y1 - y0 - 0.024) * k / (nrib - 1)
        arch_solid(ms, 'msb_reed', f, yy - 0.009, yy + 0.009, a + 0.01, hh + 0.01, n=10, lod=0 if k % 2 else 1)
    # the front: reed lattice in a grid over a tall door, two pillars with flags
    for sx in (-1, 1):
        ms.cyl('msb_reed', 0.034, 0.012, hh * 1.3, at=(sx * (a + 0.004), y0 - 0.012, G), segs=8, lod=2, frame=f)
        ms.cyl('timber', 0.005, 0.004, 0.12, at=(sx * (a + 0.004), y0 - 0.012, G + hh * 1.3 - 0.01), segs=5, lod=1, frame=f)
        tt.pennant(ms, f, sx * (a + 0.004), y0 - 0.012, G + hh * 1.3 + 0.1, yaw=-120 if sx < 0 else -60, w=0.12, h=0.075)
    ms.box('dark', (0.1, 0.01, hh * 0.52), at=(0, y0 - 0.003, G), lod=1, frame=f)
    for k in range(4):
        zz = G + hh * (0.58 + 0.09 * k)
        span = 2 * a * math.sqrt(max(0.0, 1 - ((zz - G) / hh) ** (1 / 0.85) * 0.92)) * 0.9
        ms.box('msb_reed', (span, 0.01, 0.01), at=(0, y0 - 0.006, zz), lod=0, frame=f)
    for k in range(-3, 4):
        ms.box('msb_reed', (0.008, 0.01, hh * (0.38 - 0.05 * abs(k))), at=(k * 0.05, y0 - 0.006, G + hh * 0.56), lod=0, frame=f)
    # the forecourt
    yf = -0.4
    reed_fence(ms, f, -0.38, yf, -0.07, yf, h=0.07)
    reed_fence(ms, f, 0.07, yf, 0.38, yf, h=0.07)
    ms.cyl('msb_brick', 0.035, 0.035, 0.012, at=(0.2, y0 - 0.1, G), segs=8, lod=0, frame=f)
    ms.cyl('ash', 0.024, 0.024, 0.004, at=(0.2, y0 - 0.1, G + 0.012), segs=8, lod=0, frame=f)
    reed_bundles(ms, f, -0.24, y0 - 0.1, rng, 4)
    jar(ms, f, 0.32, y0 - 0.04, 1.0)


def egal_palace(ms, rng):
    """`palace` (12 m): the royal palace (the e-gal of Mari and Ur): a buttressed enclosure of
    plastered mud brick round a court, a gatehouse of two towers with team banners in the middle of
    the front, the high throne hall across the back of the court with its niched front and a team
    awning over its door, a palm in the court. Front to -Y, about 15 m to the banner tops."""
    f = tm.house_frame(0, 0, 0)
    W, D = 0.6, 0.52
    wh, t = 0.3, 0.06
    # the enclosure: four ranges of rooms (thick walls) round the court
    block(ms, f, -W, W, -D, -D + t, G, wh, wall='msb_plaster', lod=2)
    block(ms, f, -W, -W + t, -D + t, D, G, wh, wall='msb_plaster', lod=2)
    block(ms, f, W - t, W, -D + t, D, G, wh, wall='msb_plaster', lod=2)
    footing(ms, f, -W, W, -D, D, lod=1)
    _buttresses(ms, f, -W + 0.03, W - 0.03, -D, G, wh * 0.92, step=0.08, face=-1, mat='msb_plaster', depth=0.012, w=0.03)
    for sx in (-1, 1):
        _side_buttresses(ms, f, -D + 0.03, D - 0.03, sx * W, G, wh * 0.92, step=0.08, face=sx, mat='msb_plaster', depth=0.012, w=0.03)
    # the throne hall across the back, higher, white, niched
    hy0, hy1 = D - 0.36, D
    hh = 0.56
    top = block(ms, f, -W, W, hy0, hy1, G, hh, wall='msb_white', lod=2, parapet=0.024)
    _niched_face(ms, f, -W + t + 0.02, W - t - 0.02, hy0, G, hh * 0.94, face=-1)
    door(ms, f, 0, hy0, G, w=0.09, h=0.26)
    af = f @ Matrix.Translation(Vector((0, hy0 - 0.06, G + 0.3))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('team_cloth', (0.26, 0.12, 0.008), at=(0, 0, 0), lod=1, frame=af)
    for sx in (-0.1, 0.1):
        ms.box('timber', (0.01, 0.01, 0.29), at=(sx, hy0 - 0.11, G), lod=0, frame=f)
    reed_screen(ms, f, -0.3, (hy0 + hy1) / 2, top, w=0.2, d=0.16)
    hatch(ms, f, 0.32, (hy0 + hy1) / 2, top)
    # the gatehouse: two towers round the gate in the front range
    gw, gh = 0.15, 0.5
    for sx in (-1, 1):
        gx = sx * 0.13
        block(ms, f, gx - gw / 2, gx + gw / 2, -D - 0.05, -D + t + 0.03, G, gh, wall='msb_plaster', lod=2, parapet=0.02)
        ms.box('team_cloth', (0.07, 0.006, gh * 0.48), at=(gx, -D - 0.054, G + gh * 0.36), lod=1, frame=f)
        ms.cyl('timber', 0.007, 0.006, 0.36, at=(gx, -D - 0.01, G + gh), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, gx, -D - 0.01, G + gh + 0.355, yaw=-120 if sx < 0 else -60, w=0.16, h=0.1)
    for k, (ww, dz) in enumerate(((0.11, 0.0), (0.09, 0.015), (0.07, 0.03))):
        ms.box('msb_baked' if k < 2 else 'dark', (ww, 0.01, 0.3 - dz), at=(0, -D - 0.006 + k * 0.004, G), lod=1 if k == 2 else 0, frame=f)
    # the court: paving, a palm, jars
    rect(ms, f, 'msb_baked', -W + t, W - t, -D + t, hy0, G, 0.004, lod=1)
    palm(ms, rng, -0.3, -0.05, h=0.5, fronds=8, lod=1)
    for (jx, jy) in ((0.3, -0.25), (0.34, -0.2), (0.27, -0.18)):
        jar(ms, f, jx, jy, 1.0)


# ---- building a town file -------------------------------------------------------------------------

def main(file_name, obj_name, layout, ground=None):
    """Build <out_dir>/<file_name>.glb holding one town object `obj_name`."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 and argv[1].isdigit() else 2048
    g = dict(EARTH_GROUND)
    g.update(ground or {})
    tt.build_file(file_name, [(obj_name, layout, g)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
