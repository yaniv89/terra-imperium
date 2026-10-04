# scripts/blender/ti_levant_modern.py
# The Modern Age Levant kit (Levant, Mesopotamia, Arabia, Persia; plans/art-image-spec.md section
# 3b; sheets in plans/art/kits/levant/modern/): a town is layout x kit, so these towns stand on the
# base Modern layouts (build_town_modern_<size>_<v>.py) with the kit's buildings on their spots:
# - houses (houses.png, street.png, roofscape.png, materials.png): the poor one-storey white
#   concrete house with a parapet, a steel water tank on the roof, a sail shade and a walled yard;
#   the common cream-plaster villa of stacked, set-back volumes with bronze mashrabiya screens, a
#   roof terrace under a timber pergola and planters; the rich multi-level villa on a limestone
#   ground floor, white upper volumes with full-height glass, teak slat panels, a glass balustrade,
#   a pergola and a small terrace pool. Every roof is flat. Windows are painted by the material
#   (as in ti_modern.py), so blocks stay square to the map axes;
# - landmark-1, the glass tower with a mashrabiya screen: a limestone podium with a glazed lobby
#   and a porte-cochere canopy, a blue-grey curtain-wall shaft framed by limestone piers, bronze
#   lattice screens running up the front, back and sides, a louvred plant enclosure and a bronze
#   frame on the crown (sheet 45 m, 18 m wide);
# - landmark-2, the refinery flare stack: a concrete pad with anchor blocks, a lattice A-frame
#   base on a yellow-railed grating deck, a steel stack with three caged platforms and a ladder,
#   the flare burning at the tip, galvanised pipe runs and two horizontal pressure vessels on
#   saddles (sheet 35 m, 20 m pad).
# The base layouts' water towers, works and glass towers become these landmarks where the build
# scripts say so; their street trees become date palms and the paved ground travertine. Stations,
# stadiums, canopies, market tents, lamps and lawns stay as they are. New materials carry `lvm_`.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402  (imports bpy first)
import bmesh  # noqa: E402
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_modern as md  # noqa: E402
from ti_town import G, STOREY  # noqa: E402
from ti_modern import _m, _xyz, walls4, top, rim, rod  # noqa: E402

GROUNDS = ['lvm_pave']
NEW = ['lvm_white', 'lvm_cream', 'lvm_stone', 'lvm_white_win', 'lvm_cream_win', 'lvm_villa_win', 'lvm_curtain',
       'lvm_screen', 'lvm_screen_big', 'lvm_teak', 'lvm_pergola', 'lvm_roof', 'lvm_canvas', 'lvm_pool', 'lvm_frond',
       'lvm_trunk', 'lvm_bronze', 'lvm_louver', 'lvm_glassrail', 'lvm_galv', 'lvm_yellow', 'lvm_flame', 'lvm_vessel',
       'lvm_grating', 'lvm_lobby']
for _g in GROUNDS:
    NEW += [_g, _g + '_fringe', _g + '_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
for _g in GROUNDS:
    tt.TO_FINAL.update({_g: 'Ground', _g + '_fringe': 'Ground', _g + '_square': 'Ground'})
    if _g + '_fringe' not in tt.FRINGES:
        tt.FRINGES.append(_g + '_fringe')

WHITE = ('#e4e1d9', '#ece9e2', '#dcd8ce', '#f1eee8')
CREAM = ('#e2d3b4', '#eadfc6', '#dacaa8', '#f0e6d2')


def mat_lattice(name, cell=0.05, bar=0.09, bar_cols=('#a27a46', '#b88d55', '#c99f66'), gap='#3a3027', rough=0.55):
    """A geometric mashrabiya screen painted by the material: bars along four directions (0, 90,
    45 and 135 degrees, the diagonals offset half a cell) on facade coordinates (x + y, z), so the
    crossings make eight-pointed stars; bronze bars over the dark shadow behind."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    x, y, z = _xyz(nt)
    u = _m(nt, 'ADD', x, y)

    def lines(t, k):
        fr = _m(nt, 'FRACT', t)
        return _m(nt, 'GREATER_THAN', _m(nt, 'ABSOLUTE', _m(nt, 'SUBTRACT', fr, 0.5)), 0.5 - k)
    s2 = math.sqrt(2.0)
    a = lines(_m(nt, 'DIVIDE', u, cell), bar)
    b = lines(_m(nt, 'DIVIDE', z, cell), bar)
    c = lines(_m(nt, 'ADD', _m(nt, 'DIVIDE', _m(nt, 'ADD', u, z), cell * s2), 0.5), bar * 0.8)
    d = lines(_m(nt, 'ADD', _m(nt, 'DIVIDE', _m(nt, 'SUBTRACT', u, z), cell * s2), 0.5), bar * 0.8)
    m = _m(nt, 'MINIMUM', _m(nt, 'ADD', _m(nt, 'ADD', a, b), _m(nt, 'ADD', c, d)), 1.0)
    n = tm._noise(nt, 12.0, 4.0, 0.6)
    br = tm._ramp(nt, n.outputs['Fac'], [(0.3, bar_cols[0]), (0.5, bar_cols[1]), (0.7, bar_cols[2])])
    col = tm._mix(nt, m, tm._srgb(gap), br.outputs['Color'])
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0.3
    tm._bump(nt, bsdf, m, 0.5, 0.003)
    return mat


def make_materials():
    s = tm.mat_simple
    s('lvm_white', list(WHITE), scale=14.0, bump=0.2, dirt=True)
    s('lvm_cream', list(CREAM), scale=14.0, bump=0.2, dirt=True)
    tm.mat_mudwall('lvm_stone', wash='#d4c3a1', brick='#d3c19c', brick2='#c3ae86', mortar='#9c8b6c', wash_cover=0.0,
                   bond=(0.07, 0.035, 0.0025))
    md.mat_facade('lvm_white_win', md._wall_render(WHITE), cell_u=0.3, win_w=0.075, z0=0.14, z1=0.29,
                  glass=('#2e3236', '#454b51', '#6f7a84'), frame='#6a4e33', frame_w=0.012)
    md.mat_facade('lvm_cream_win', md._wall_render(CREAM), cell_u=0.3, win_w=0.07, z0=0.08, z1=0.33,
                  glass=('#2f3a44', '#4a5a69', '#7d93a6'), frame='#7b5c3a', frame_w=0.01)
    md.mat_facade('lvm_villa_win', md._wall_render(WHITE), cell_u=0.26, win_w=0.21, z0=0.03, z1=0.38,
                  glass=('#2c3d4c', '#47617a', '#8aa5bc'), frame='#3b3e42', frame_w=0.006, rough=0.6)
    # the tower's curtain wall at the sheet's 3.75 m floors: blue-grey glass in bronze mullions
    md.mat_facade('lvm_curtain', md._wall_render(('#6b5a43', '#776449')), cell_u=0.1, cell_z=0.375, win_w=0.09,
                  z0=0.04, z1=0.355, glass=('#22385a', '#365a86', '#7b9cc4'), frame='#5c4c38', frame_w=0.004,
                  dirt=False, rough=0.4)
    md.mat_facade('lvm_lobby', md._wall_render(('#6b5a43', '#776449')), cell_u=0.16, cell_z=1.0, win_w=0.15, z0=0.0,
                  z1=0.36, glass=('#1f2a35', '#34485c', '#5e7790'), frame='#5c4c38', frame_w=0.006, dirt=False, rough=0.4)
    mat_lattice('lvm_screen', cell=0.05)
    mat_lattice('lvm_screen_big', cell=0.09, bar=0.1, bar_cols=('#7e6646', '#94784f', '#a88a5c'), gap='#28313d')
    s('lvm_teak', ['#6e4a2c', '#8a5e38', '#5a3b22'], scale=10.0, stripes={'dir': 'X', 'scale': 16.0, 'distortion': 0.4}, bump=0.5)
    md.mat_stripes('lvm_pergola', ('#3b2c1f', '#9b7548', '#b08957'), axis='X', scale=8.0, noise=30.0)
    s('lvm_roof', ['#cbc2b0', '#d6cebd', '#c0b6a2'], scale=12.0, bump=0.2)
    s('lvm_canvas', ['#d8c9a6', '#e3d6b8', '#cbbb96'], scale=16.0, bump=0.3)
    s('lvm_pool', ['#2f8fb5', '#47aacb', '#6cc2d8'], scale=10.0, rough=0.2, bump=0.1)
    s('lvm_frond', ['#3b5a22', '#557a2c', '#6c8f36', '#45652a'], scale=50.0, stripes={'dir': 'X', 'scale': 60.0, 'distortion': 2.0}, bump=0.6)
    s('lvm_trunk', ['#6b5a44', '#7d6a50', '#5a4a37'], scale=20.0, stripes={'dir': 'Z', 'scale': 30.0, 'distortion': 0.5}, bump=0.7)
    s('lvm_bronze', ['#6b5639', '#7c6544', '#5d4a31'], scale=14.0, rough=0.45, metal=0.5, bump=0.1)
    s('lvm_louver', ['#5f5a52', '#77716a', '#4d4943'], scale=10.0, stripes={'dir': 'Z', 'scale': 40.0, 'distortion': 0.1}, bump=0.5)
    s('lvm_glassrail', ['#9fb5c2', '#b7c9d3', '#8ea6b4'], scale=8.0, rough=0.2, bump=0.0)
    s('lvm_galv', ['#9aa0a4', '#b3b8bb', '#868c90'], scale=16.0, rough=0.4, metal=0.6, bump=0.15)
    s('lvm_yellow', ['#d7a21c', '#e6b42a', '#c38f16'], scale=14.0, rough=0.5, bump=0.1)
    s('lvm_flame', ['#ff7a14', '#ffb02e', '#ffe08a'], scale=6.0, rough=1.0, bump=0.0)
    s('lvm_vessel', ['#b9bec1', '#cdd1d3', '#a6abaf'], scale=8.0, rough=0.35, metal=0.5, bump=0.1)
    s('lvm_grating', ['#6f7478', '#878c90', '#5c6165'], scale=10.0, stripes={'dir': 'X', 'scale': 50.0, 'distortion': 0.2}, bump=0.5)
    for n in ('lvm_pave', 'lvm_pave_fringe'):
        tc.mat_paving(n, stone=('#d5c7aa', '#c9ba9b', '#ded2b8'), mortar='#a3957a', slab=(0.04, 0.04))
    tc.mat_paving('lvm_pave_square', stone=('#d9ccb1', '#cdbfa2', '#e3d8c0'), mortar='#a0927a', slab=(0.08, 0.08))


if not any(n == 'levant-modern' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('levant-modern', make_materials))

ORIG = {'block': md.block, 'house': md.house, 'tree': md.tree, 'flat': md.flat}
SWAP = {'md_pave_square': 'lvm_pave_square', 'md_pave': 'lvm_pave'}
KIT = {'rich_share': 0.12}


def _t(x, y, z=0.0):
    return Matrix.Translation(Vector((x, y, z)))


def _rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


# ---- small parts ---------------------------------------------------------------------------------


def pergola(ms, f, x, y, w, d, z, h=0.2, lod_posts=0):
    """A timber pergola: four posts and a slatted top (the slats carried by the material)."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('md_wood', (0.014, 0.014, h), at=(x + sx * (w / 2 - 0.01), y + sy * (d / 2 - 0.01), z), lod=lod_posts, frame=f)
    ms.box('lvm_pergola', (w, d, 0.012), at=(x, y, z + h), lod=1, frame=f)
    for sy in (-1, 1):
        ms.box('md_wood', (w + 0.02, 0.016, 0.02), at=(x, y + sy * (d / 2 - 0.01), z + h - 0.008), lod=0, frame=f)


def tank(ms, f, x, y, z, r=0.035, h=0.05):
    """A rooftop steel water tank on a small stand."""
    ms.box('md_steel', (r * 1.6, r * 1.6, 0.012), at=(x, y, z), lod=0, frame=f)
    ms.cyl('lvm_galv', r, r, h, at=(x, y, z + 0.012), segs=8, lod=1, frame=f)
    ms.cyl('lvm_galv', r, r * 0.3, 0.012, at=(x, y, z + 0.012 + h), segs=8, lod=0, frame=f)


def planter(ms, f, x, y, z, w=0.08, d=0.04, mat='lvm_cream'):
    ms.box(mat, (w, d, 0.025), at=(x, y, z), lod=0, frame=f)
    ms.box('md_hedge', (w - 0.01, d - 0.01, 0.035), at=(x, y, z + 0.02), lod=0, frame=f)


def yard_wall(ms, f, w, d, door_x, mat, h=0.1, off=0.05, sides=True):
    """A low wall along the front `off` beyond the facade, a timber gate at the door, short returns."""
    y = -d / 2 - off
    gate = 0.11
    for a, b in ((-w / 2, door_x - gate / 2), (door_x + gate / 2, w / 2)):
        if b - a > 0.03:
            ms.box(mat, (b - a, 0.022, h), at=((a + b) / 2, y, G), lod=1, frame=f)
    ms.box('lvm_teak', (gate, 0.012, h * 0.9), at=(door_x, y, G), lod=0, frame=f)
    if sides:
        for sx in (-1, 1):
            ms.box(mat, (0.022, off, h), at=(sx * (w / 2 - 0.011), -d / 2 - off / 2, G), lod=0, frame=f)


def screen(ms, f, x, y, z, w, h, mat='lvm_screen', depth=0.012, lod=1, frame_mat='lvm_bronze'):
    """A mashrabiya panel standing proud of a facade (local -Y) with a thin bronze frame (LOD0)."""
    ms.box(mat, (w, depth, h), at=(x, y - depth / 2, z), lod=lod, frame=f)
    if frame_mat:
        for sx in (-1, 1):
            ms.box(frame_mat, (0.008, depth + 0.004, h), at=(x + sx * (w / 2 + 0.004), y - depth / 2, z), lod=0, frame=f)


def palm(ms, x, y, h=0.6, r=0.13, lod2=False, rng=None):
    """A date palm: a slim ringed trunk with a slight lean and a crown of drooping fronds (one
    open mesh per crown, single-sided and facing up, so the crown is one atlas island)."""
    h = h * 1.25
    lean = (rng.uniform(-0.03, 0.03), rng.uniform(-0.03, 0.03)) if rng else (0.0, 0.0)
    ct = Vector((x + lean[0], y + lean[1], G + h))
    rod(ms, 'lvm_trunk', (x, y, G), tuple(ct), 0.017, segs=6, lod=1, r2=0.012)
    ms.sphere('lvm_trunk', 0.022, at=tuple(ct), u=6, v=4, lod=0)
    a0 = rng.uniform(0, 6.28) if rng else 0.0
    for lod, n, segs in ((0, 9, 2), (1, 5, 1)):
        bm = bmesh.new()
        for k in range(n):
            a = a0 + 2 * math.pi * k / n
            ca, sa = math.cos(a), math.sin(a)
            L = r * 1.6 * (0.9 + 0.2 * ((k * 7) % 3) / 2)
            if segs == 2:
                pts = [(0.0, 0.0), (L * 0.5, 0.05), (L, -0.06)]
                wid = [0.014, 0.055, 0.0]
            else:
                pts = [(0.0, 0.0), (L, -0.03)]
                wid = [0.035, 0.0]
            prev = None
            for (rr, dz), wd in zip(pts, wid):
                cx, cy = ct.x + ca * rr, ct.y + sa * rr
                px, py = -sa * wd / 2, ca * wd / 2
                cur = [bm.verts.new((cx - px, cy - py, ct.z + dz)), bm.verts.new((cx + px, cy + py, ct.z + dz))] if wd > 0 else \
                    [bm.verts.new((cx, cy, ct.z + dz))]
                if prev is not None:
                    face = prev + list(reversed(cur)) if len(cur) == 2 else prev + cur
                    fc = bm.faces.new(face)
                    fc.normal_update()
                    if fc.normal.z < 0:
                        fc.normal_flip()
                prev = cur
        ms.add(bm, 'lvm_frond', lod, only=lod if lod == 1 else None)
    if lod2:
        ms.cyl('lvm_frond', r * 1.1, r * 0.2, r * 0.6, at=(ct.x, ct.y, ct.z - r * 0.35), segs=5, lod=2, only=2)


# ---- houses ---------------------------------------------------------------------------------------


def _frame(ms, x, y, w, d, yaw):
    """The base block's bookkeeping: widened footprint, the lawn verge, the frame."""
    yaw = md.facing(x, y) if yaw is None else yaw
    w, d = w * md.FOOT[0], d * md.FOOT[0]
    md.FOOTPRINTS.append((x, y, w, d) if yaw % 180 == 0 else (x, y, d, w))
    if md.LAWN[0] > 0:
        bx, by, bw, bd = md.FOOTPRINTS[-1]
        m = md.LAWN[0]
        md.rect(ms, 'md_lawn', bx - bw / 2 - m, by - bd / 2 - m, bx + bw / 2 + m, by + bd / 2 + m, md.Z_LAWN, lod=1)
    return tm.house_frame(x, y, yaw), w, d


def _stand_in(ms, f, w, d, h, wall):
    """LOD2: the whole house as one box."""
    walls4(ms, wall, f, w, d, h, lod=2, only=2)
    top(ms, 'lvm_roof', f, w, d, G + h, lod=2, only=2)


def _shopfront(ms, f, w, d, awning, wall):
    ms.box('md_shop', (w * 0.92, 0.012, 0.24), at=(0, -d / 2 - 0.004, G), lod=1, frame=f)
    ms.box(wall, (w * 0.96, 0.02, 0.035), at=(0, -d / 2 - 0.006, G + 0.245), lod=0, frame=f)
    if awning:
        af = f @ _t(0, -d / 2 - 0.06, G + 0.25) @ Matrix.Rotation(math.radians(-16), 4, 'X')
        ms.box('team_cloth', (w * 0.85, 0.13, 0.01), at=(0, 0, 0), lod=1, frame=af)


def poor_house(ms, rng, f, w, d, shop=False, awning=False):
    """One white concrete storey with a parapet at the back of the plot, a steel tank and an AC
    box on the roof, a sail shade over the yard, a walled front yard with a timber gate."""
    hw, hd = w * 0.82, d * 0.78
    cy = d / 2 - hd / 2
    h = STOREY
    sx = rng.choice((-1, 1))
    hx = sx * (w - hw) / 2
    walls4(ms, 'lvm_white_win', f, hw, hd, h, x=hx, y=cy, lod=1, only=(0, 1))
    top(ms, 'lvm_roof', f, hw, hd, G + h, x=hx, y=cy, lod=1, only=(0, 1))
    rim(ms, 'lvm_white', f, hw, hd, G + h, t=0.022, h=0.05, x=hx, y=cy, lod=1)
    _stand_in(ms, f, w, d, h, 'lvm_white_win')
    tank(ms, f, hx + sx * hw * 0.25, cy + hd * 0.2, G + h)
    ms.box('md_steel', (0.06, 0.04, 0.04), at=(hx - sx * hw * 0.2, cy + hd * 0.25, G + h), lod=0, frame=f)
    fy = cy - hd / 2
    if shop:
        _shopfront(ms, f @ _t(hx, cy, 0), hw, hd, awning, 'lvm_white')
        return
    ms.box('lvm_teak', (0.08, 0.012, 0.2), at=(hx - sx * hw * 0.15, fy - 0.004, G), lod=1, frame=f)
    ms.box('lvm_white', (0.14, 0.05, 0.02), at=(hx - sx * hw * 0.15, fy - 0.03, G), lod=0, frame=f)
    # the sail shade over the yard on the house's other side, tied to two posts
    yw = w - hw
    sxw = max(0.16, min(0.3, hw * 0.45))
    px = hx + sx * hw * 0.15
    yd = fy + d / 2  # the front yard's depth
    for k in (-1, 1):
        ms.box('md_steel', (0.01, 0.01, 0.22), at=(px + k * sxw / 2, fy - yd * 0.85, G), lod=0, frame=f)
    sf = f @ _t(px, fy - yd * 0.43, G + 0.25) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('lvm_canvas', (sxw, yd * 0.9, 0.006), at=(0, 0, 0), lod=1, frame=sf)
    if yw > 0.08:  # a planted side yard
        planter(ms, f, -sx * (w / 2 - yw / 2), cy, G, w=min(yw * 0.7, 0.1), d=0.06, mat='lvm_white')
    yard_wall(ms, f, w, d, hx - sx * hw * 0.15, 'lvm_white', off=0.0, sides=False)
    planter(ms, f, px + sxw * 0.3, fy - yd * 0.5, G, w=0.05, d=0.04, mat='lvm_white')


def common_house(ms, rng, f, w, d, h, storeys, shop=False, awning=False, balcony=False):
    """The cream-plaster villa: the lower floors over the whole plot, the top floor set back to one
    side, a stair tower rising past it, a bronze mashrabiya screen on the front, a roof terrace
    under a timber pergola with planters, a walled front with a gate (or a shopfront)."""
    sx = rng.choice((-1, 1))
    lower = h - STOREY if storeys >= 2 else h
    walls4(ms, 'lvm_cream_win', f, w, d, lower, lod=1, only=(0, 1))
    top(ms, 'lvm_roof', f, w, d, G + lower, lod=1, only=(0, 1))
    rim(ms, 'lvm_cream', f, w, d, G + lower, t=0.022, h=0.05, lod=1)
    _stand_in(ms, f, w, d, h, 'lvm_cream_win')
    if storeys >= 2:
        uw, ud = w * 0.58, d * 0.72
        ux, uy = sx * (w - uw) / 2, (d - ud) / 2
        walls4(ms, 'lvm_cream_win', f, uw, ud, STOREY, x=ux, y=uy, z=G + lower, lod=1, only=(0, 1))
        top(ms, 'lvm_roof', f, uw, ud, G + h, x=ux, y=uy, lod=1, only=(0, 1))
        rim(ms, 'lvm_cream', f, uw, ud, G + h, t=0.02, h=0.04, x=ux, y=uy, lod=1)
        # the stair tower, a half storey above at the back corner
        ms.box('lvm_white', (0.13, 0.13, STOREY * 0.45), at=(ux + sx * (uw / 2 - 0.065), uy + ud / 2 - 0.065, G + h), lod=1, frame=f)
        tank(ms, f, ux - sx * uw * 0.25, uy + ud * 0.25, G + h)
        # the terrace: pergola and planters on the free side
        tw = w - uw
        tx = -sx * (w / 2 - tw / 2)
        pergola(ms, f, tx, d * 0.1, tw - 0.06, d * 0.5, G + lower)
        planter(ms, f, tx, -d / 2 + 0.05, G + lower, w=tw * 0.6, d=0.04)
        planter(ms, f, ux, -d / 2 + 0.05, G + lower, w=0.1, d=0.04)
        # the screen up the front of the upper volume
        screen(ms, f, ux + sx * uw * 0.2, uy - ud / 2, G + lower + 0.04, uw * 0.42, STOREY - 0.08)
    # a tall screen on the lower floors
    if storeys >= 3 or not shop:
        z0 = G + (STOREY if shop else 0.14)
        screen(ms, f, -sx * w * 0.22, -d / 2, z0, w * 0.3, max(0.2, lower - (z0 - G) - 0.06))
    if balcony and storeys > 1:
        for s in range(1, storeys - 1):
            bz = G + s * STOREY + 0.005
            ms.box('md_concrete', (0.16, 0.06, 0.012), at=(sx * w * 0.22, -d / 2 - 0.03, bz), lod=0, frame=f)
            ms.box('lvm_glassrail', (0.16, 0.006, 0.05), at=(sx * w * 0.22, -d / 2 - 0.06, bz + 0.012), lod=0, frame=f)
    if shop:
        _shopfront(ms, f, w, d, awning, 'lvm_cream')
        return
    dx = sx * w * 0.2
    ms.box('lvm_teak', (0.09, 0.012, 0.2), at=(dx, -d / 2 - 0.004, G), lod=1, frame=f)
    ms.box('lvm_cream', (0.16, 0.06, 0.012), at=(dx, -d / 2 - 0.03, G + 0.22), lod=0, frame=f)
    yard_wall(ms, f, w, d, dx, 'lvm_cream', off=0.045, sides=False)


def rich_house(ms, rng, f, w, d, h, storeys, shop=False, awning=False, balcony=False):
    """The contemporary villa: a limestone ground floor over the whole plot, white upper volumes
    with full-height glass set back over a terrace with a pool and a glass balustrade, a teak slat
    panel, a pergola on the top roof, a limestone wall with a teak gate in front."""
    sx = rng.choice((-1, 1))
    gh = STOREY
    walls4(ms, 'lvm_stone', f, w, d, gh, lod=1, only=(0, 1))
    top(ms, 'lvm_roof', f, w, d, G + gh, lod=1, only=(0, 1))
    _stand_in(ms, f, w, d, h, 'lvm_villa_win')
    ms.box('lvm_villa_win', (w * 0.5, 0.012, gh - 0.06), at=(-sx * w * 0.18, -d / 2 - 0.004, G), lod=1, frame=f)
    uh = max(STOREY, h - gh)
    uw, ud = w * 0.7, d * 0.7
    ux, uy = sx * (w - uw) / 2, (d - ud) / 2
    walls4(ms, 'lvm_villa_win', f, uw, ud, uh, x=ux, y=uy, z=G + gh, lod=1, only=(0, 1))
    top(ms, 'lvm_roof', f, uw, ud, G + gh + uh, x=ux, y=uy, lod=1, only=(0, 1))
    rim(ms, 'lvm_white', f, uw, ud, G + gh + uh, t=0.02, h=0.035, x=ux, y=uy, lod=1)
    # a cantilevered white frame round the upper front and a teak slat panel
    ms.box('lvm_white', (uw + 0.03, 0.05, 0.03), at=(ux, uy - ud / 2 - 0.02, G + gh + uh - 0.03), lod=0, frame=f)
    ms.box('lvm_teak', (uw * 0.22, 0.014, uh - 0.04), at=(ux + sx * uw * 0.36, uy - ud / 2 - 0.007, G + gh + 0.02), lod=1, frame=f)
    # the terrace on the ground floor's roof: glass balustrade, a pool, planters
    rail_y = -d / 2 + 0.012
    ms.box('lvm_glassrail', (w - 0.02, 0.008, 0.05), at=(0, rail_y, G + gh), lod=1, frame=f)
    ms.box('lvm_stone', (w, 0.02, 0.012), at=(0, rail_y, G + gh - 0.006), lod=0, frame=f)
    tw = w - uw
    if tw > 0.12:
        ms.box('lvm_glassrail', (0.008, d - 0.03, 0.05), at=(-sx * (w / 2 - 0.012), 0, G + gh), lod=0, frame=f)
        px = -sx * (w / 2 - tw / 2)
        ms.box('lvm_pool', (tw * 0.65, d * 0.45, 0.006), at=(px, d * 0.1, G + gh), lod=1, frame=f)
        ms.box('lvm_white', (tw * 0.75, d * 0.52, 0.004), at=(px, d * 0.1, G + gh), lod=1, frame=f)
    planter(ms, f, ux - sx * uw * 0.3, -d / 2 + 0.06, G + gh, w=0.1, d=0.04, mat='lvm_stone')
    pergola(ms, f, ux - sx * uw * 0.18, uy - ud * 0.1, uw * 0.5, ud * 0.55, G + gh + uh, h=0.12)
    tank(ms, f, ux + sx * uw * 0.3, uy + ud * 0.3, G + gh + uh, r=0.03)
    if storeys >= 3:
        ms.box('lvm_glassrail', (uw * 0.5, 0.008, 0.05), at=(ux, uy - ud / 2 - 0.03, G + gh + STOREY), lod=0, frame=f)
        ms.box('md_concrete', (uw * 0.5, 0.06, 0.012), at=(ux, uy - ud / 2 - 0.03, G + gh + STOREY - 0.012), lod=0, frame=f)
    if shop:
        _shopfront(ms, f, w, d, awning, 'lvm_stone')
        return
    dx = sx * w * 0.25
    ms.box('lvm_teak', (0.1, 0.012, 0.22), at=(dx, -d / 2 - 0.004, G), lod=1, frame=f)
    yard_wall(ms, f, w, d, dx, 'lvm_stone', h=0.11, off=0.045, sides=False)


def kit_block(ms, rng, x, y, w, d, storeys=3, wall='md_render_win', yaw=None, roof='flat', rise=0.2, shop=False,
              awning=False, units=2, balcony=False, door=0.0, h=None, stair=False, chimney=False, typ=None):
    """The base `block` on its spot, built as one of the kit's villas: brick blocks become rich
    villas, rendered ones common villas (a share of them rich), one-storey houses poor ones."""
    f, w, d = _frame(ms, x, y, w, d, yaw)
    h = h or storeys * STOREY
    if typ is None:
        if storeys <= 1:
            typ = 'poor'
        elif rng.random() < (0.45 if wall == 'md_brick_win' else KIT['rich_share']):
            typ = 'rich'
        else:
            typ = 'common'
    if typ == 'poor':
        poor_house(ms, rng, f, w, d, shop=shop, awning=awning)
    elif typ == 'rich':
        rich_house(ms, rng, f, w, d, h, storeys, shop=shop, awning=awning, balcony=balcony)
    else:
        common_house(ms, rng, f, w, d, h, storeys, shop=shop, awning=awning, balcony=balcony)
    return f


def kit_house(ms, rng, x, y, w, d, yaw=None, roof='gable', wall='md_brick_win', rise=0.3, chimney=True, h=0.52):
    """The base one-storey house becomes the poor white concrete house."""
    return kit_block(ms, rng, x, y, w, d, storeys=1, yaw=yaw, typ='poor')


def kit_flat(ms, mat, pts, z, lod=2, only=None, frame=None):
    return ORIG['flat'](ms, SWAP.get(mat, mat), pts, z, lod=lod, only=only, frame=frame)


# ---- landmark 1: the glass tower with the mashrabiya screen ---------------------------------------


def mashrabiya_tower(ms, rng, x, y, top_z, w=1.0, d=0.8, podium=(1.3, 1.1, 0.15), palms=True):
    """The tower (sheet: 45 m, 18 m wide on a 24 m podium; here `w` by `d` to `top_z`): a limestone
    podium with a glazed lobby and a canopy on bronze posts over the entrance; a blue-grey curtain
    wall framed by limestone corner piers; two bronze mashrabiya screens up the front and the back
    and one up each side; a limestone crown band, a louvred plant enclosure and a bronze frame on the
    roof; planters and palms round the podium."""
    f = tm.house_frame(x, y, 0)
    pw, pd, ph = podium
    walls4(ms, 'lvm_stone', f, pw, pd, ph, lod=2)
    top(ms, 'lvm_roof', f, pw, pd, G + ph, lod=2)
    rim(ms, 'lvm_stone', f, pw, pd, G + ph, t=0.02, h=0.03, lod=1)
    ms.box('lvm_lobby', (w * 0.7, 0.012, ph * 0.85), at=(0, -pd / 2 - 0.004, G), lod=1, frame=f)
    # the entrance canopy
    cd = min(0.22, w * 0.3)
    ms.box('lvm_stone', (w * 0.85, cd, 0.025), at=(0, -pd / 2 - cd / 2, G + ph * 0.9), lod=1, frame=f)
    ms.box('lvm_bronze', (w * 0.86, cd + 0.005, 0.008), at=(0, -pd / 2 - cd / 2, G + ph * 0.9 - 0.006), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('lvm_bronze', (0.016, 0.016, ph * 0.9), at=(sx * w * 0.38, -pd / 2 - cd + 0.02, G), lod=0, frame=f)
    for k in range(3):  # steps
        ms.box('lvm_stone', (w * 0.6 - 0.04 * k, 0.03, 0.008 * (3 - k)), at=(0, -pd / 2 - cd - 0.02 + 0.02 * k, G), lod=0, frame=f)
    # the shaft
    z0 = G + ph
    sh = top_z - z0 - 0.08
    walls4(ms, 'lvm_curtain', f, w, d, sh, z=z0, lod=2)
    top(ms, 'lvm_roof', f, w, d, z0 + sh, lod=2)
    pier = max(0.05, w * 0.09)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('lvm_stone', (pier, pier, sh), at=(sx * (w / 2 - pier / 2 + 0.006), sy * (d / 2 - pier / 2 + 0.006), z0), lod=1, frame=f)
    sz0 = z0 + min(0.375, sh * 0.08)
    shh = sh - (sz0 - z0) - 0.06
    for side, length, xs, sw in (('front', w, (-0.24, 0.24), 0.2), ('back', w, (-0.24, 0.24), 0.2), ('east', d, (0.0,), 0.28),
                                 ('west', d, (0.0,), 0.28)):
        yaw = {'front': 0, 'back': 180, 'east': 90, 'west': -90}[side]
        depth = d if side in ('front', 'back') else w
        F = f @ _rz(yaw) @ _t(0, -depth / 2, 0)
        for xr in xs:
            screen(ms, F, xr * length, 0.0, sz0, length * sw, shh, mat='lvm_screen_big', depth=0.018, lod=1)
        # the screens at LOD2: a darker band on two faces only
        if side in ('front', 'west'):
            for xr in xs:
                ms.box('lvm_screen_big', (length * sw, 0.012, shh), at=(xr * length, -0.006, sz0), lod=2, frame=F)
    # the crown
    zc = z0 + sh
    walls4(ms, 'lvm_stone', f, w + 0.02, d + 0.02, 0.08, z=zc, lod=2)
    top(ms, 'lvm_roof', f, w + 0.02, d + 0.02, zc + 0.08, lod=1)
    ms.box('lvm_louver', (w * 0.42, d * 0.42, 0.14), at=(0, 0.02, zc + 0.08), lod=1, frame=f)
    ms.box('lvm_bronze', (w * 0.44, d * 0.44, 0.01), at=(0, 0.02, zc + 0.22), lod=0, frame=f)
    for sx in (-1, 1):  # the bronze frame over the corners
        ms.box('lvm_bronze', (0.014, d * 0.86, 0.014), at=(sx * w * 0.4, 0, zc + 0.2), lod=0, frame=f)
        for sy in (-1, 1):
            ms.box('lvm_bronze', (0.014, 0.014, 0.12), at=(sx * w * 0.4, sy * d * 0.42, zc + 0.08), lod=0, frame=f)
    for k in range(3):
        ms.box('md_steel', (0.06, 0.06, 0.035), at=(-w * 0.32 + 0.08 * k, -d * 0.3, zc + 0.08), lod=0, frame=f)
    # planters and palms round the podium
    for sx in (-1, 1):
        planter(ms, f, sx * (pw / 2 - 0.1), -pd / 2 - 0.08, G, w=0.14, d=0.06, mat='lvm_stone')
        if palms:
            palm(ms, x + sx * (pw / 2 + 0.06), y - pd / 2 - 0.05, h=0.5, r=0.13, lod2=False, rng=rng)
    return top_z


# ---- landmark 2: the refinery flare stack ----------------------------------------------------------


def _vessel(ms, f, x, y, length, r, yaw=0, lod=2):
    """A horizontal pressure vessel with domed ends on two saddles."""
    F = f @ _t(x, y, 0) @ _rz(yaw)
    zc = G + 0.03 + r + 0.02
    ms.cyl('lvm_vessel', r, r, length, at=(-length / 2, 0, zc), rot=(0, 90, 0), segs=10, lod=lod, frame=F, caps=False)
    for sx in (-1, 1):
        ms.sphere('lvm_vessel', r, at=(sx * length / 2, 0, zc), scale=(0.55, 1, 1), u=10, v=6, lod=min(lod, 1), frame=F)
        ms.box('md_concrete', (0.04, r * 1.6, r + 0.02), at=(sx * length * 0.3, 0, G + 0.03), lod=1, frame=F)
    ms.cyl('lvm_galv', 0.008, 0.008, 0.05, at=(0, 0, zc + r - 0.005), segs=5, lod=0, frame=F)


def _rail(ms, f, pts, z, h=0.045, lod=0):
    """A yellow safety railing (top rail and posts) along a polyline at deck height z."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        ms.box('lvm_yellow', (L, 0.008, 0.008), at=((x0 + x1) / 2, (y0 + y1) / 2, z + h), rot_z=a, lod=lod, frame=f)
        n = max(1, int(L / 0.09))
        for i in range(n + 1):
            t = i / n
            ms.box('lvm_yellow', (0.007, 0.007, h), at=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, z), lod=lod, frame=f)


def _pipe(ms, f, pts, r=0.012, z=G + 0.05, lod=1):
    """A pipe run along a polyline (local coordinates) with a flange at each bend."""
    P = [f @ Vector((px, py, z)) for px, py in pts]
    for a, b in zip(P, P[1:]):
        rod(ms, 'lvm_galv', tuple(a), tuple(b), r, segs=6, lod=lod, caps=False)
    for p in P[1:-1]:
        ms.sphere('lvm_galv', r * 1.25, at=tuple(p), u=6, v=4, lod=0)


def flare_stack(ms, rng, x, y, w, d, top_z=3.5, compact=False):
    """The flare stack (sheet: 35 m on a 20 by 20 m pad; here a `w` by `d` pad, the tip at
    `top_z`): a concrete pad with anchor blocks, a lattice A-frame round the stack's foot on a
    yellow-railed grating deck, the steel stack with three caged platforms, a ladder and the flare,
    galvanised pipe runs, two pressure vessels on saddles behind a railing (one when `compact`)."""
    f = tm.house_frame(x, y, 0)
    ms.box('md_concrete', (w, d, 0.03), at=(0, 0, G - 0.01), lod=2, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('md_concrete', (0.05, 0.05, 0.03), at=(sx * (w / 2 - 0.06), sy * (d / 2 - 0.06), G + 0.02), lod=0, frame=f)
    zp = G + 0.02
    # the stack, off-centre toward the north-west as on the sheet's plan
    sx0, sy0 = -w * 0.18, d * 0.12
    S = f @ _t(sx0, sy0, 0)
    base = min(0.2, w * 0.17)
    deck_z = zp + 0.1
    frame_top = zp + (top_z - zp) * 0.33
    r0, r1 = 0.04, 0.03
    ms.cyl('lvm_galv', r0, r1, top_z - zp - 0.12, at=(0, 0, zp), segs=10, lod=2, frame=S)
    # the flare tip and the flame
    zt = top_z - 0.12
    ms.cyl('md_wire', r1 * 1.25, r1 * 1.1, 0.06, at=(0, 0, zt), segs=10, lod=1, frame=S)
    ms.cyl('lvm_bronze', r1 * 1.0, r1 * 0.9, 0.02, at=(0, 0, zt + 0.06), segs=10, lod=0, frame=S)
    ms.cyl('lvm_flame', r1 * 1.3, 0.0, 0.16, at=(0, 0, zt + 0.06), segs=7, lod=2, frame=S)
    ms.sphere('lvm_flame', r1 * 1.15, at=(0.004, 0, zt + 0.1), scale=(1, 1, 1.6), u=7, v=5, lod=0, frame=S)
    # the A-frame legs and their bracing
    legs = []
    for kx in (-1, 1):
        for ky in (-1, 1):
            p0 = S @ Vector((kx * base, ky * base, zp))
            p1 = S @ Vector((kx * r0 * 1.2, ky * r0 * 1.2, frame_top))
            legs.append((p0, p1))
            rod(ms, 'md_steel', tuple(p0), tuple(p1), 0.009, segs=5, lod=1)
    order = [0, 1, 3, 2]
    for i in range(4):
        la, lb = legs[order[i]], legs[order[(i + 1) % 4]]
        for t0, t1 in ((0.05, 0.4), (0.4, 0.75)):
            pa = la[0].lerp(la[1], t0)
            pb = lb[0].lerp(lb[1], t1)
            rod(ms, 'md_steel', tuple(pa), tuple(pb), 0.004, segs=4, lod=0, caps=False)
            pa = lb[0].lerp(lb[1], t0)
            pb = la[0].lerp(la[1], t1)
            rod(ms, 'md_steel', tuple(pa), tuple(pb), 0.004, segs=4, lod=0, caps=False)
    # the grating deck round the foot
    dk = base * 1.5
    ms.box('lvm_grating', (dk * 2, dk * 2, 0.01), at=(0, 0, deck_z), lod=1, frame=S)
    for kx in (-1, 1):
        for ky in (-1, 1):
            ms.box('md_steel', (0.012, 0.012, deck_z - zp), at=(kx * (dk - 0.01), ky * (dk - 0.01), zp), lod=0, frame=S)
    _rail(ms, S, [(-dk, -dk), (dk, -dk), (dk, dk), (-dk, dk), (-dk, -dk + 0.08)], deck_z + 0.01)
    ms.box('lvm_yellow', (0.05, 0.12, 0.012), at=(dk + 0.03, -dk * 0.5, zp + 0.04), rot_z=0, lod=0, frame=S)
    # the platforms up the stack
    for k, frac in enumerate((0.45, 0.68, 0.9)):
        zz = zp + (top_z - zp - 0.15) * frac
        ms.cyl('lvm_grating', 0.075, 0.075, 0.008, at=(0, 0, zz), segs=10, lod=1, frame=S)
        ms.cyl('lvm_yellow', 0.077, 0.077, 0.04, at=(0, 0, zz + 0.008), segs=10, lod=1, frame=S, caps=False)
        ms.cyl('lvm_yellow', 0.077, 0.077, 0.006, at=(0, 0, zz + 0.048), segs=10, lod=0, frame=S, caps=False)
    # the ladder on the stack's south face
    ms.box('md_steel', (0.016, 0.005, top_z - frame_top - 0.2), at=(0, -r0 - 0.008, frame_top), lod=0, frame=S)
    ms.box('md_steel', (0.03, 0.03, frame_top - deck_z), at=(0, -r0 - 0.02, deck_z), lod=0, frame=S)
    # vessels behind their railing at the east, pipes along the pad
    vx = w * 0.22
    vr = min(0.07, d * 0.08)
    vl = min(0.5, d * 0.5)
    if compact:
        _vessel(ms, f, vx, -d * 0.12, vl, vr, yaw=90)
        _rail(ms, f, [(vx - 0.12, -d * 0.12 - vl / 2 - 0.08), (vx + 0.12, -d * 0.12 - vl / 2 - 0.08)], G + 0.02)
    else:
        for k in (-1, 1):
            _vessel(ms, f, vx + k * (vr + 0.04), 0.0, vl, vr, yaw=90)
        _rail(ms, f, [(vx - 2 * vr - 0.1, -vl / 2 - 0.1), (vx + 2 * vr + 0.1, -vl / 2 - 0.1), (vx + 2 * vr + 0.1, vl / 2 + 0.1),
                      (vx - 2 * vr - 0.1, vl / 2 + 0.1), (vx - 2 * vr - 0.1, -vl / 2 - 0.1)], G + 0.02)
    e = 0.1
    _pipe(ms, f, [(-w / 2 + e, -d / 2 + e), (w / 2 - e, -d / 2 + e), (w / 2 - e, d * 0.25)], r=0.014)
    _pipe(ms, f, [(sx0, sy0 - dk - 0.02), (sx0, -d / 2 + e + 0.05), (vx, -d / 2 + e + 0.05), (vx, -vl / 2 - 0.02)], r=0.011, z=G + 0.07)
    _pipe(ms, f, [(-w / 2 + e, -d / 2 + e + 0.04), (-w / 2 + e, d / 2 - e), (sx0 + dk + 0.05, d / 2 - e), (sx0 + dk + 0.05, sy0)], r=0.012, z=G + 0.06)
    if not compact:
        _pipe(ms, f, [(sx0 - dk - 0.05, sy0), (-w / 2 + e + 0.04, sy0)], r=0.01, z=G + 0.09, lod=0)
        for kx in (-0.1, 0.1):  # valves on the front run
            ms.cyl('md_wire', 0.022, 0.022, 0.006, at=(kx, -d / 2 + e, G + 0.1), segs=8, lod=0, frame=f)
            ms.box('md_steel', (0.008, 0.008, 0.04), at=(kx, -d / 2 + e, G + 0.06), lod=0, frame=f)
    return top_z


# ---- applying the kit -----------------------------------------------------------------------------


def apply(landmarks=None, rich_share=0.12):
    """Swap the base layout's houses, trees and paving for the kit's; `landmarks` maps a ti_modern
    builder name ('glass_tower', 'water_tower', 'factory', 'clock_tower') to a replacement fn."""
    KIT['rich_share'] = rich_share
    md.block = kit_block
    md.house = kit_house
    md.tree = palm
    md.flat = kit_flat
    for name, fn in (landmarks or {}).items():
        setattr(md, name, fn)


def main(base_name, layout, ground, landmarks=None, rich_share=0.12):
    """Build `modern-<base_name>-levant.glb` (its object keeps the layout's name).
    argv: <out_dir> [atlas_px]."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    apply(landmarks, rich_share)
    ground = dict(ground, mat='lvm_pave')
    tt.build_file('modern-%s-levant' % base_name, [(base_name, layout, ground)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
