# scripts/blender/ti_sinic_modern.py
# The Modern Age Sinic kit (China, Taiwan, Hong Kong, Macau, the Koreas, Japan; plans/art-image-
# spec.md section 3b; sheets in plans/art/kits/sinic/modern/): a town is layout x kit, so these
# towns stand on the base Modern layouts (build_town_modern_<size>_<v>.py) with the kit's
# buildings on their spots:
# - houses (houses.png, street.png, roofscape.png, materials.png): the poor hutong / lane house of
#   grey brick under grey-tiled gables (now and then red tile), a walled front yard behind an
#   arched stone gate with a red-brown door, a corrugated lean-to, washing on a line and a grey
#   awning; the common walk-up of beige concrete (or dark brick) with a stair core up the middle
#   of the front lit by a glass slit, balconies with grey awnings and AC boxes, water tanks on the
#   roof and an iron fence with stone posts in front; the rich residential tower of blue-grey
#   glass in a beige stone frame with a stepped stone crown, in a gated compound with a pool.
#   Windows are painted by the material (as in ti_modern.py), so blocks stay square to the map
#   axes;
# - landmark-1, a TV tower in the manner of Shanghai's Pearl tower: a round glass base on a stone
#   platform, three columns and three raking legs with steel joint spheres, a large lower sphere,
#   five pods up the columns, the upper sphere over an observation ring, a shaft to the small top
#   sphere and a mast banded red and white (sheet 468 m; here 20 to 50 m, see LOG.md);
# - landmark-2, the railway station: a long glass hall under a curved metal roof that sweeps up in
#   the middle and turns up at its tips, a glazed skylight down its crown, branching steel columns
#   across the front, a stone plinth with steps and planters, platform canopies and tracks running
#   out at both sides (sheet 220 m by 36 m).
# The base layouts' water towers, clock tower and glass towers become the TV tower and the stations
# (and small-b's canopy, big-b's works) become this station where the build scripts say so; the
# paved ground becomes a grey granite. Trees (but those on a landmark's ground), stadiums, the other
# works and water towers, market tents, lamps and lawns stay as they are. New materials carry `snm_`.
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

GROUNDS = ['snm_pave']
NEW = ['snm_conc', 'snm_conc_win', 'snm_dbrick', 'snm_dbrick_win', 'snm_gbrick', 'snm_gbrick_win', 'snm_tile',
       'snm_tile_red', 'snm_ridge', 'snm_door', 'snm_stone', 'snm_tower_win', 'snm_slit', 'snm_pool', 'snm_laundry',
       'snm_pearl', 'snm_shaft', 'snm_obsglass', 'snm_chrome', 'snm_red', 'snm_white', 'snm_hallglass', 'snm_roofmetal',
       'snm_canopy']
for _g in GROUNDS:
    NEW += [_g, _g + '_fringe', _g + '_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
for _g in GROUNDS:
    tt.TO_FINAL.update({_g: 'Ground', _g + '_fringe': 'Ground', _g + '_square': 'Ground'})
    if _g + '_fringe' not in tt.FRINGES:
        tt.FRINGES.append(_g + '_fringe')

CONC = ('#bdb5a6', '#c9c1b2', '#b1a999', '#d2cbbd')
STONE = ('#cfc4ae', '#d9cfbb', '#c4b8a0', '#e0d7c5')


def _wall_bricks(brick, brick2, mortar, tint, bond=(0.03, 0.011, 0.0016)):
    """ti_modern's brick wall with its own colours (the base one is tinted red)."""
    def make(nt):
        x, y, z = _xyz(nt)
        comb = nt.nodes.new('ShaderNodeCombineXYZ')
        nt.links.new(_m(nt, 'ADD', x, y), comb.inputs['X'])
        nt.links.new(z, comb.inputs['Y'])
        br = nt.nodes.new('ShaderNodeTexBrick')
        br.inputs['Scale'].default_value = 1.0
        br.inputs['Brick Width'].default_value = bond[0]
        br.inputs['Row Height'].default_value = bond[1]
        br.inputs['Mortar Size'].default_value = bond[2]
        br.inputs['Color1'].default_value = tm._srgb(brick)
        br.inputs['Color2'].default_value = tm._srgb(brick2)
        br.inputs['Mortar'].default_value = tm._srgb(mortar)
        br.offset = 0.5
        nt.links.new(comb.outputs['Vector'], br.inputs['Vector'])
        n = tm._noise(nt, 9.0, 4.0, 0.6)
        t = tm._ramp(nt, n.outputs['Fac'], [(0.3, tint[0]), (0.7, tint[1])])
        return tm._mix(nt, 0.3, br.outputs['Color'], t.outputs['Color'], 'OVERLAY')
    return make


def mat_pearl(name, cell=0.05, line=0.07, panel=('#a63d58', '#bf5370', '#d06a85'), seam='#e3b5c1'):
    """The spheres' pink-red aluminium panels: seams along three directions (one level, two raking
    across x and y) so the panels read as triangles."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    x, y, z = _xyz(nt)

    def lines(t):
        fr = _m(nt, 'FRACT', t)
        return _m(nt, 'GREATER_THAN', _m(nt, 'ABSOLUTE', _m(nt, 'SUBTRACT', fr, 0.5)), 0.5 - line)
    a = lines(_m(nt, 'DIVIDE', z, cell * 0.87))
    b = lines(_m(nt, 'DIVIDE', _m(nt, 'ADD', _m(nt, 'ADD', x, y), _m(nt, 'MULTIPLY', z, 0.58)), cell))
    c = lines(_m(nt, 'DIVIDE', _m(nt, 'SUBTRACT', _m(nt, 'SUBTRACT', x, y), _m(nt, 'MULTIPLY', z, 0.58)), cell))
    m = _m(nt, 'MINIMUM', _m(nt, 'ADD', a, _m(nt, 'ADD', b, c)), 1.0)
    n = tm._noise(nt, 30.0, 3.0, 0.5)
    pr = tm._ramp(nt, n.outputs['Fac'], [(0.3, panel[0]), (0.5, panel[1]), (0.7, panel[2])])
    col = tm._mix(nt, m, pr.outputs['Color'], tm._srgb(seam))
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.35
    bsdf.inputs['Metallic'].default_value = 0.35
    tm._bump(nt, bsdf, m, 0.4, 0.002)
    return mat


def mat_hallglass(name, cell=0.07, bar=0.005, zcell=0.11, glass=('#2f4152', '#46617a', '#86a2b9'), bar_col='#8d9398'):
    """The station's glass walls: mullions on x + y and on x - y (so a wall on a diagonal still
    shows them) and transoms every `zcell`; the glass lighter toward the top."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    x, y, z = _xyz(nt)
    b = bar / cell
    m1 = _m(nt, 'LESS_THAN', _m(nt, 'FRACT', _m(nt, 'DIVIDE', _m(nt, 'ADD', x, y), cell)), b)
    m2 = _m(nt, 'LESS_THAN', _m(nt, 'FRACT', _m(nt, 'DIVIDE', _m(nt, 'SUBTRACT', x, y), cell)), b)
    m3 = _m(nt, 'LESS_THAN', _m(nt, 'FRACT', _m(nt, 'DIVIDE', z, zcell)), bar / zcell * 1.3)
    bars = _m(nt, 'MAXIMUM', _m(nt, 'MAXIMUM', m1, m2), m3)
    gn = tm._noise(nt, 5.0, 3.0, 0.5)
    gv = _m(nt, 'ADD', _m(nt, 'MULTIPLY', gn.outputs['Fac'], 0.6), _m(nt, 'MULTIPLY', _m(nt, 'FRACT', _m(nt, 'DIVIDE', z, zcell)), 0.4))
    gr = tm._ramp(nt, gv, [(0.25, glass[0]), (0.55, glass[1]), (0.85, glass[2])])
    col = tm._mix(nt, bars, gr.outputs['Color'], tm._srgb(bar_col))
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.3
    tm._bump(nt, bsdf, bars, 0.4, 0.002)
    return mat


def make_materials():
    s = tm.mat_simple
    s('snm_conc', list(CONC), scale=14.0, bump=0.25, dirt=True)
    md.mat_facade('snm_conc_win', md._wall_render(CONC), cell_u=0.2, win_w=0.1, z0=0.12, z1=0.3,
                  glass=('#2c3640', '#45525e', '#7a8b99'), frame='#5d5f60', frame_w=0.008)
    tm.mat_mudwall('snm_dbrick', wash='#5a3229', brick='#5c3329', brick2='#4a2a22', mortar='#8a8178', wash_cover=0.0,
                   bond=(0.03, 0.011, 0.0016))
    md.mat_facade('snm_dbrick_win', _wall_bricks('#5c3329', '#4a2a22', '#8a8178', ('#3e2019', '#6c3b2c')), cell_u=0.2,
                  win_w=0.1, z0=0.12, z1=0.3, glass=('#2c3640', '#45525e', '#7a8b99'), frame='#c9c1b2', frame_w=0.01)
    tm.mat_mudwall('snm_gbrick', wash='#7d7d7a', brick='#7f7f7b', brick2='#6b6c69', mortar='#a5a299', wash_cover=0.0,
                   bond=(0.03, 0.011, 0.0016))
    md.mat_facade('snm_gbrick_win', _wall_bricks('#7f7f7b', '#6b6c69', '#a5a299', ('#5d5e5b', '#8f8f8a')), cell_u=0.24,
                  win_w=0.075, z0=0.15, z1=0.3, glass=('#2a2f33', '#3e464c', '#6c7880'), frame='#6b2e22', frame_w=0.012)
    tm.mat_mudwall('snm_tile', wash='#4f5356', brick='#565a5e', brick2='#45494d', mortar='#2c2f32', wash_cover=0.0,
                   bond=(0.022, 0.012, 0.0025))
    tm.mat_mudwall('snm_tile_red', wash='#7c4433', brick='#8a4b37', brick2='#743e2e', mortar='#3d2a22', wash_cover=0.0,
                   bond=(0.022, 0.012, 0.0025))
    s('snm_ridge', ['#34373a', '#3f4245', '#2c2f31'], scale=30.0, bump=0.3)
    s('snm_door', ['#6e2a1e', '#7f3324', '#5f2419'], scale=10.0, stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 2.0}, bump=0.2)
    tm.mat_mudwall('snm_stone', wash=STONE[0], brick=STONE[0], brick2=STONE[2], mortar='#a39880', wash_cover=0.0,
                   bond=(0.07, 0.035, 0.0025))
    # the towers: blue-grey glass in a beige stone frame, one row of glass per raised storey
    md.mat_facade('snm_tower_win', md._wall_render(STONE[:3]), cell_u=0.1, win_w=0.082, z0=0.04, z1=0.37,
                  glass=('#26394c', '#3d5a76', '#7f9fba'), frame='#9a917f', frame_w=0.005, dirt=False, rough=0.5)
    s('snm_slit', ['#2b3b4b', '#3c5268', '#557089'], scale=10.0, rough=0.3, bump=0.0)
    s('snm_pool', ['#2f8fb5', '#47aacb', '#6cc2d8'], scale=10.0, rough=0.2, bump=0.1)
    s('snm_laundry', ['#c4473a', '#3f6aa0', '#e2dccf', '#d6b13c', '#e2dccf'], scale=60.0, bump=0.2)
    # the TV tower
    mat_pearl('snm_pearl')
    s('snm_shaft', ['#d6d0c4', '#e1dcd2', '#cbc4b6'], scale=12.0, bump=0.15, dirt=True)
    s('snm_obsglass', ['#2e3e4d', '#3f5466', '#5a7184'], scale=10.0, stripes={'dir': 'X', 'scale': 120.0, 'distortion': 0.2},
      rough=0.3, bump=0.2)
    s('snm_chrome', ['#b9bec3', '#d3d7da', '#9fa5ab'], scale=8.0, rough=0.25, metal=0.8, bump=0.0)
    s('snm_red', ['#b3261e', '#c33026', '#a11f19'], scale=10.0, rough=0.5, bump=0.0)
    s('snm_white', ['#e8e6e1', '#f1efea'], scale=10.0, rough=0.5, bump=0.0)
    # the station
    mat_hallglass('snm_hallglass')
    md.mat_stripes('snm_roofmetal', ('#9a9fa4', '#b2b6ba', '#c4c8cb'), axis='X', scale=14.0, noise=18.0)
    s('snm_canopy', ['#aeb3b7', '#bfc3c6', '#a1a6aa'], scale=10.0, stripes={'dir': 'Y', 'scale': 40.0, 'distortion': 0.2},
      rough=0.45, metal=0.4, bump=0.2)
    for n in ('snm_pave', 'snm_pave_fringe'):
        tc.mat_paving(n, stone=('#a5a199', '#97938b', '#b2aea6'), mortar='#76736d', slab=(0.035, 0.035))
    tc.mat_paving('snm_pave_square', stone=('#aca79d', '#9e998f', '#b9b4aa'), mortar='#78746c', slab=(0.07, 0.07))


if not any(n == 'sinic-modern' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('sinic-modern', make_materials))

ORIG = {'block': md.block, 'house': md.house, 'tree': md.tree, 'flat': md.flat, 'bench': md.bench}
SWAP = {'md_pave_square': 'snm_pave_square', 'md_pave': 'snm_pave'}
KIT = {'rich_share': 0.15, 'poor_share': 0.15, 'walkup_extra': 1, 'tower_extra': 2, 'clear': ()}


def _t(x, y, z=0.0):
    return Matrix.Translation(Vector((x, y, z)))


def _rz(deg):
    return Matrix.Rotation(math.radians(deg), 4, 'Z')


# ---- small parts ---------------------------------------------------------------------------------


def prism(ms, mat, f, w, d, z0, rise, lod=2, only=None):
    """A plain gabled roof as one closed solid (ridge along local X): the LOD2 stand-in."""
    bm = bmesh.new()
    a = [bm.verts.new(p) for p in ((-w / 2, -d / 2, z0), (w / 2, -d / 2, z0), (w / 2, d / 2, z0), (-w / 2, d / 2, z0))]
    r = [bm.verts.new((-w / 2, 0, z0 + rise)), bm.verts.new((w / 2, 0, z0 + rise))]
    bm.faces.new((a[0], a[1], r[1], r[0]))
    bm.faces.new((a[2], a[3], r[0], r[1]))
    bm.faces.new((a[1], a[2], r[1]))
    bm.faces.new((a[3], a[0], r[0]))
    bm.faces.new((a[0], a[3], a[2], a[1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def awning(ms, f, x, y, z, w, depth=0.09, tilt=-18, lod=0):
    """A grey (team) awning sloping out from a wall face at local y (facing -Y)."""
    af = f @ _t(x, y - depth / 2, z) @ Matrix.Rotation(math.radians(tilt), 4, 'X')
    ms.box('team_cloth', (w, depth, 0.008), at=(0, 0, 0), lod=lod, frame=af)


def fence(ms, f, x0, x1, y, h=0.055, gate=None, post_mat='snm_stone', lod=0):
    """An iron railing on stone posts along local x at y, a gap at `gate` (x, width)."""
    spans = [(x0, x1)] if gate is None else [(x0, gate[0] - gate[1] / 2), (gate[0] + gate[1] / 2, x1)]
    for a, b in spans:
        if b - a < 0.03:
            continue
        ms.box('md_wire', (b - a, 0.006, h * 0.85), at=((a + b) / 2, y, G), lod=lod, frame=f)
        ms.box(post_mat, (b - a, 0.016, 0.018), at=((a + b) / 2, y, G), lod=lod, frame=f)
        for px in (a, b):
            ms.box(post_mat, (0.022, 0.022, h + 0.012), at=(px, y, G), lod=lod, frame=f)


def laundry(ms, f, x0, x1, y, z, rng):
    """Washing on a line between two posts."""
    ms.box('md_wire', (x1 - x0, 0.003, 0.003), at=((x0 + x1) / 2, y, z), lod=0, frame=f)
    n = max(1, int((x1 - x0) / 0.045))
    for i in range(n):
        if rng.random() < 0.75:
            px = x0 + (x1 - x0) * (i + 0.5) / n
            ms.box('snm_laundry', (0.03, 0.004, rng.uniform(0.03, 0.05)), at=(px, y, z - 0.045), lod=0, frame=f)


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


def poor_house(ms, rng, f, w, d, storeys=1, shop=False, awning_on=False):
    """The hutong lane house: one or two grey brick bodies under grey-tiled gables (one in six in
    red tile) at the back of the plot, a walled front yard entered through an arched stone gate
    with a red-brown door, a corrugated lean-to, washing on a line and a grey awning."""
    h = min(storeys, 2) * STOREY
    hd = d if shop else d * 0.62
    cy = d / 2 - hd / 2
    n = 2 if w >= 0.5 else 1
    bw = w / n
    tile = 'snm_tile_red' if rng.random() < 0.17 else 'snm_tile'
    for i in range(n):
        bx = -w / 2 + bw * (i + 0.5)
        bh = h if (i == 0 or storeys < 2 or rng.random() < 0.5) else STOREY
        bf = f @ _t(bx, cy, 0)
        walls4(ms, 'snm_gbrick_win', bf, bw - 0.01, hd, bh, lod=1, only=(0, 1))
        tc.gable_roof(ms, bf, bw - 0.01, hd, G + bh, 0.12, over=0.03, mat=tile, gable='snm_gbrick', ridge='snm_ridge',
                      thick=0.018, lod=1)
        ms.box('snm_door', (0.07, 0.012, 0.17), at=(0, -hd / 2 - 0.004, G), lod=1, frame=bf)
        if not shop and rng.random() < 0.7:
            awning(ms, bf, rng.uniform(-0.05, 0.05), -hd / 2, G + 0.2, bw * 0.5)
    walls4(ms, 'snm_gbrick_win', f, w, hd, h, y=cy, lod=2, only=2)
    prism(ms, tile, f @ _t(0, cy, 0), w + 0.04, hd + 0.04, G + h, 0.12, lod=2, only=2)
    if shop:
        ms.box('md_shop', (w * 0.85, 0.012, 0.22), at=(0, -d / 2 - 0.004, G), lod=1, frame=f)
        awning(ms, f, 0, -d / 2, G + 0.24, w * 0.8, depth=0.12, lod=1 if awning_on else 0)
        return
    # the yard wall with its arched gate
    fy = -d / 2
    gx = rng.uniform(-w * 0.2, w * 0.2)
    gw = 0.13
    for a, b in ((-w / 2, gx - gw / 2), (gx + gw / 2, w / 2)):
        if b - a > 0.02:
            ms.box('snm_gbrick', (b - a, 0.03, 0.15), at=((a + b) / 2, fy + 0.015, G), lod=1, frame=f)
            ms.box('snm_tile', (b - a + 0.01, 0.05, 0.014), at=((a + b) / 2, fy + 0.015, G + 0.15), lod=0, frame=f)
    yd = d - hd
    for sx in (-1, 1):
        ms.box('snm_gbrick', (0.03, yd, 0.15), at=(sx * (w / 2 - 0.015), fy + yd / 2, G), lod=1, frame=f)
    ms.box('snm_stone', (gw, 0.04, 0.2), at=(gx, fy + 0.015, G), lod=1, frame=f)
    ms.cyl('snm_stone', gw / 2, gw / 2, 0.04, at=(gx, fy - 0.005, G + 0.2), rot=(-90, 0, 0), segs=8, lod=0, frame=f)
    ms.box('snm_door', (0.075, 0.012, 0.15), at=(gx, fy - 0.007, G), lod=0, frame=f)
    # the yard: a lean-to, washing, pots
    sx = rng.choice((-1, 1))
    lx = sx * (w / 2 - 0.09)
    ms.box('snm_gbrick', (0.15, yd * 0.6, 0.12), at=(lx, fy + yd * 0.55, G), lod=0, frame=f)
    lf = f @ _t(lx, fy + yd * 0.55, G + 0.135) @ Matrix.Rotation(math.radians(-8), 4, 'X')
    ms.box('md_corrugated', (0.18, yd * 0.7, 0.008), at=(0, 0, 0), lod=0, frame=lf)
    if w > 0.3:
        laundry(ms, f, -sx * w * 0.35, sx * 0.02, fy + yd * 0.6, G + 0.17, rng)
    for k in range(2):
        tt.jar(ms, f, -sx * (w / 2 - 0.05 - 0.05 * k), fy + 0.06, s=0.8, mat='terracotta')


def common_house(ms, rng, f, w, d, h, storeys, shop=False, awning_on=False, balcony=False, brick=False):
    """The walk-up: beige concrete (or dark brick) over the plot with a stair core up the middle of
    the front (a glass slit, rising past the roof), balcony slabs with grey awnings and AC boxes,
    water tanks and plant on the roof, an iron fence on stone posts in front (or a shopfront)."""
    wall, plain = ('snm_dbrick_win', 'snm_dbrick') if brick else ('snm_conc_win', 'snm_conc')
    walls4(ms, wall, f, w, d, h, lod=2)
    top(ms, 'md_roof', f, w, d, G + h, lod=2)
    rim(ms, plain, f, w, d, G + h, t=0.02, h=0.04, lod=1)
    # the stair core
    cw = min(0.12, w * 0.18)
    ms.box('snm_conc', (cw, 0.05, h + 0.1), at=(0, -d / 2 - 0.022, G), lod=1, frame=f)
    ms.box('snm_slit', (cw * 0.4, 0.006, h - STOREY * 0.6), at=(0, -d / 2 - 0.048, G + STOREY * 0.6), lod=1, frame=f)
    ms.box('snm_conc', (cw + 0.04, 0.12, 0.1), at=(0, -d / 2 + 0.04, G + h), lod=1, frame=f)
    # roof: tanks and plant
    for k, tx in enumerate((-w * 0.3, w * 0.28)):
        ms.cyl('md_steel', 0.03, 0.03, 0.05, at=(tx, d * 0.2, G + h + 0.012), segs=8, lod=0, frame=f)
        ms.box('md_steel', (0.07, 0.04, 0.012), at=(tx, d * 0.2, G + h), lod=0, frame=f)
    ms.box('md_steel', (0.06, 0.04, 0.035), at=(w * 0.1, d * 0.25, G + h), lod=0, frame=f)
    # balconies, awnings and AC boxes on the upper floors
    for s in range(1, storeys):
        bz = G + s * STOREY + 0.005
        for sx in (-1, 1):
            bx = sx * (cw / 2 + w * 0.2)
            bwid = min(0.2, w * 0.3)
            if balcony or (s + (sx > 0)) % 2 == 0:
                ms.box('snm_conc', (bwid, 0.05, 0.045), at=(bx, -d / 2 - 0.025, bz), lod=0, frame=f)
            if rng.random() < 0.45:
                awning(ms, f, bx, -d / 2 - (0.05 if balcony else 0.0), bz + STOREY * 0.62, bwid * 0.9, depth=0.06)
            if rng.random() < 0.5:
                ms.box('md_steel', (0.04, 0.025, 0.03), at=(bx + sx * bwid * 0.6, -d / 2 - 0.012, bz + 0.07), lod=0, frame=f)
    if shop:
        ms.box('md_shop', (w * 0.92, 0.012, 0.24), at=(0, -d / 2 - 0.004, G), lod=1, frame=f)
        ms.box(plain, (w * 0.96, 0.02, 0.035), at=(0, -d / 2 - 0.006, G + 0.245), lod=0, frame=f)
        awning(ms, f, 0, -d / 2 - 0.01, G + 0.25, w * 0.85, depth=0.12, lod=1 if awning_on else 0)
        return
    ms.box('door', (0.06, 0.012, 0.17), at=(0, -d / 2 - 0.05, G), lod=1, frame=f)
    ms.box('snm_conc', (cw + 0.06, 0.06, 0.012), at=(0, -d / 2 - 0.07, G + 0.19), lod=0, frame=f)
    fence(ms, f, -w / 2, w / 2, -d / 2 - md.LAWN[0] * 0.8 - 0.06, gate=(0, 0.14))


def rich_house(ms, rng, f, w, d, h, storeys, shop=False, awning_on=False):
    """The residential tower in its compound: blue-grey glass in a beige stone frame (corner piers,
    a fin up the front, a slab at every floor), a stepped stone crown, a glazed lobby under a stone
    canopy; round it a stone and iron fence with a gate, a pool and lawn (or a shop podium)."""
    tw, td = w * 0.64, d * 0.6
    ty = d * 0.12
    z0 = G
    if shop:  # a podium of shops over the whole plot
        walls4(ms, 'snm_stone', f, w, d, STOREY, lod=2)
        top(ms, 'md_roof', f, w, d, G + STOREY, lod=2)
        ms.box('md_shop', (w * 0.92, 0.012, 0.24), at=(0, -d / 2 - 0.004, G), lod=1, frame=f)
        awning(ms, f, 0, -d / 2 - 0.01, G + 0.25, w * 0.85, depth=0.12, lod=1 if awning_on else 0)
        z0 = G + STOREY
        h -= STOREY
    walls4(ms, 'snm_tower_win', f, tw, td, h, y=ty, z=z0, lod=2)
    zt = z0 + h
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('snm_stone', (0.035, 0.035, h), at=(sx * (tw / 2 - 0.012), ty + sy * (td / 2 - 0.012), z0), lod=1, frame=f)
    ms.box('snm_stone', (0.03, 0.02, h), at=(0, ty - td / 2 - 0.006, z0), lod=1, frame=f)
    for s in range(1, int(round(h / STOREY))):
        ms.box('snm_stone', (tw + 0.008, 0.035, 0.01), at=(0, ty - td / 2 - 0.01, z0 + s * STOREY), lod=0, frame=f)
    # the crown
    walls4(ms, 'snm_stone', f, tw + 0.016, td + 0.016, 0.07, y=ty, z=zt - 0.04, lod=1)
    top(ms, 'md_roof', f, tw, td, zt, y=ty, lod=2)
    cw, cd = tw * 0.55, td * 0.55
    walls4(ms, 'snm_stone', f, cw, cd, 0.11, y=ty, z=zt, lod=1)
    top(ms, 'md_roof', f, cw, cd, zt + 0.11, y=ty, lod=1)
    rim(ms, 'snm_stone', f, cw + 0.03, cd + 0.03, zt + 0.11, t=0.015, h=0.03, y=ty, lod=0)
    if shop:
        return
    # the lobby and the compound
    ms.box('md_shop', (tw * 0.5, 0.012, 0.2), at=(0, ty - td / 2 - 0.004, G), lod=1, frame=f)
    ms.box('snm_stone', (tw * 0.6, 0.12, 0.016), at=(0, ty - td / 2 - 0.06, G + 0.21), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('snm_stone', (0.018, 0.018, 0.21), at=(sx * tw * 0.27, ty - td / 2 - 0.11, G), lod=0, frame=f)
    px = rng.choice((-1, 1)) * w * 0.27
    py = -d / 2 + (d / 2 + ty - td / 2) / 2 - 0.02
    ms.box('snm_stone', (w * 0.3, 0.12, 0.012), at=(px, py, G), lod=1, frame=f)
    ms.box('snm_pool', (w * 0.25, 0.09, 0.004), at=(px, py, G + 0.012), lod=1, frame=f)
    fence(ms, f, -w / 2, w / 2, -d / 2 - 0.01, gate=(-px * 0.4, 0.13), h=0.06)
    for sx in (-1, 1):
        ms.box('snm_stone', (0.035, 0.035, 0.09), at=(-px * 0.4 + sx * 0.08, -d / 2 - 0.01, G), lod=0, frame=f)


def kit_block(ms, rng, x, y, w, d, storeys=3, wall='md_render_win', yaw=None, roof='flat', rise=0.2, shop=False,
              awning=False, units=2, balcony=False, door=0.0, h=None, stair=False, chimney=False, typ=None):
    """The base `block` on its spot, built as one of the kit's houses: gabled and hipped blocks and
    one-storey houses become hutong houses, flat-roofed blocks walk-ups (a share of them towers,
    more of the brick ones, and a share hutong houses)."""
    f, w, d = _frame(ms, x, y, w, d, yaw)
    if typ is None:
        if storeys <= 1 or roof in ('gable', 'hip'):
            typ = 'poor'
        else:
            r = rng.random()
            rich = 0.3 if wall == 'md_brick_win' else KIT['rich_share']
            typ = 'rich' if r < rich else 'poor' if r > 1.0 - KIT['poor_share'] else 'common'
    if typ == 'poor':
        poor_house(ms, rng, f, w, d, storeys=min(storeys, 2), shop=shop, awning_on=awning)
    elif typ == 'rich':
        s = storeys + KIT['tower_extra']
        rich_house(ms, rng, f, w, d, s * STOREY, s, shop=shop, awning_on=awning)
    else:
        s = storeys + KIT['walkup_extra']
        common_house(ms, rng, f, w, d, s * STOREY, s, shop=shop, awning_on=awning, balcony=balcony,
                     brick=wall == 'md_brick_win' and rng.random() < 0.6)
    return f


def kit_house(ms, rng, x, y, w, d, yaw=None, roof='gable', wall='md_brick_win', rise=0.3, chimney=True, h=0.52):
    """The base one-storey house becomes a hutong house (now and then of two storeys)."""
    return kit_block(ms, rng, x, y, w, d, storeys=2 if rng.random() < 0.35 else 1, yaw=yaw, typ='poor')


def kit_flat(ms, mat, pts, z, lod=2, only=None, frame=None):
    return ORIG['flat'](ms, SWAP.get(mat, mat), pts, z, lod=lod, only=only, frame=frame)


def _cleared(x, y):
    """True inside a rectangle a landmark took over (KIT['clear'], (x0, y0, x1, y1) each)."""
    return any(x0 <= x <= x1 and y0 <= y <= y1 for x0, y0, x1, y1 in KIT['clear'])


def kit_tree(ms, x, y, h=0.6, r=0.13, lod2=False, rng=None):
    if not _cleared(x, y):
        ORIG['tree'](ms, x, y, h=h, r=r, lod2=lod2, rng=rng)


def kit_bench(ms, x, y, yaw=0):
    if not _cleared(x, y):
        ORIG['bench'](ms, x, y, yaw)


# ---- landmark 1: the TV tower ---------------------------------------------------------------------


def _ball(ms, c, r, band2=False, segs=(16, 10)):
    """A sphere of the tower: a pale core, the pink panelled dome over its upper part, a dark glass
    band round the equator (and a second pink band below it on the big sphere). LOD0, a lighter
    LOD1, a plain pink ball at LOD2."""
    x, y, z = c
    u, v = segs
    ms.sphere('snm_shaft', r, at=(x, y, z), u=u, v=v, lod=0, only=0)
    ms.sphere('snm_pearl', r * 1.012, at=(x, y, z), u=u, v=v, lod=0, only=0, cut_below=-0.18 * r * 1.012)
    ms.cyl('snm_obsglass', r * 0.99, r * 1.015, r * 0.3, at=(x, y, z - 0.3 * r), segs=u, lod=0, only=0, caps=False)
    if band2:
        ms.cyl('snm_pearl', r * 0.86, r * 0.93, r * 0.16, at=(x, y, z - 0.58 * r), segs=u, lod=0, only=0, caps=False)
    u1, v1 = max(8, u // 2 + 2), max(6, v // 2 + 1)
    ms.sphere('snm_pearl', r, at=(x, y, z), u=u1, v=v1, lod=1, only=1)
    ms.cyl('snm_obsglass', r * 0.99, r * 1.015, r * 0.3, at=(x, y, z - 0.3 * r), segs=u1, lod=1, only=1, caps=False)
    ms.sphere('snm_pearl', r, at=(x, y, z), u=6, v=4, lod=2, only=2)


def pearl_tower(ms, x, y, H=4.5, base_r=0.6, yaw=0.0):
    """The TV tower (sheet: 468 m; here `H` to the mast's tip, the legs landing `base_r` from its
    axis): a stone platform and a round glass base, three columns from the ground to the upper
    sphere, three raking legs with steel joint spheres carrying the lower sphere, five glazed pods
    up the columns, the upper sphere over an observation ring, a shaft to the small top sphere and
    a steel mast banded red and white at the top."""
    f = tm.house_frame(x, y, yaw)
    z1, r1 = G + 0.183 * H, 0.066 * H
    z2, r2 = G + 0.578 * H, 0.056 * H
    z3, r3 = G + 0.744 * H, max(0.024 * H, 0.03)
    cr = max(0.019 * H, 0.03)          # the columns' distance from the axis
    rc = max(0.011 * H, 0.014)          # a column's radius
    # the platform and the glass base
    ms.cyl('snm_stone', base_r * 1.08, base_r * 1.08, 0.02, at=(0, 0, G - 0.005), segs=20, lod=1, frame=f)
    ms.cyl('snm_stone', base_r * 1.08, base_r * 1.08, 0.02, at=(0, 0, G - 0.005), segs=8, lod=2, frame=f, only=2)
    ms.cyl('snm_hallglass', base_r * 0.62, base_r * 0.6, max(0.035 * H, 0.06), at=(0, 0, G + 0.015), segs=16, lod=1, frame=f)
    ms.cyl('snm_shaft', base_r * 0.65, base_r * 0.62, 0.012, at=(0, 0, G + 0.015 + max(0.035 * H, 0.06)), segs=16, lod=1, frame=f)
    for k in range(3):  # steps on the platform's south
        ms.box('snm_stone', (base_r * 0.6 - 0.03 * k, 0.03, 0.006 * (3 - k)), at=(0, -base_r * 1.08 - 0.02 + 0.02 * k, G), lod=0, frame=f)
    # the columns
    for k in range(3):
        a = math.radians(90 + 120 * k)
        cx, cy = cr * math.cos(a), cr * math.sin(a)
        ms.cyl('snm_shaft', rc, rc, z2 - G, at=(cx, cy, G), segs=10, lod=1, frame=f, only=(0, 1))
    ms.cyl('snm_shaft', cr + rc, cr + rc, z2 - G, at=(0, 0, G), segs=5, lod=2, frame=f, only=2, caps=False)
    # the raking legs and their joint spheres
    rl = max(0.012 * H, 0.014)
    for k in range(3):
        a = math.radians(-90 + 120 * k)
        p0 = f @ Vector((base_r * math.cos(a), base_r * math.sin(a), G))
        p1 = f @ Vector(((cr + r1 * 0.5) * math.cos(a), (cr + r1 * 0.5) * math.sin(a), z1 - r1 * 0.75))
        rod(ms, 'snm_shaft', tuple(p0), tuple(p1), rl, segs=8, lod=1, only=(0, 1))
        rod(ms, 'snm_shaft', tuple(p0), tuple(p1), rl, segs=3, lod=2, only=2, caps=False)
        ms.sphere('snm_chrome', rl * 1.6, at=tuple(p0.lerp(p1, 0.42)), u=10, v=7, lod=1)
        ms.cyl('snm_stone', rl * 2.2, rl * 2.2, 0.025, at=tuple(p0), segs=8, lod=0)
    # the lower sphere and the pods
    _ball(ms, (f @ Vector((0, 0, z1))).to_tuple(), r1, band2=True)
    lo, hi = z1 + r1, z2 - r2
    for k in range(5):
        pz = lo + (hi - lo) * (k + 0.6) / 5.4
        ph = max(0.014 * H, 0.022)
        ms.cyl('snm_obsglass', cr + rc * 1.15, cr + rc * 1.15, ph, at=(0, 0, pz), segs=12, lod=1, frame=f)
        ms.cyl('snm_pearl', cr + rc * 1.25, cr + rc * 1.25, ph * 0.3, at=(0, 0, pz + ph * 0.35), segs=12, lod=0, frame=f, caps=False)
    # the observation ring and the upper sphere
    ms.cyl('snm_shaft', r2 * 0.7, r2 * 0.5, max(0.02 * H, 0.025), at=(0, 0, z2 - r2 - max(0.02 * H, 0.025) * 0.6), segs=14, lod=1, frame=f)
    _ball(ms, (f @ Vector((0, 0, z2))).to_tuple(), r2)
    # the shaft and the small sphere
    rs = max(0.013 * H, 0.016)
    ms.cyl('snm_shaft', rs, rs * 0.9, z3 - z2, at=(0, 0, z2 + r2 * 0.6), segs=8, lod=1, frame=f)
    for k in range(3):
        ms.cyl('snm_shaft', rs * 1.6, rs * 1.6, 0.012, at=(0, 0, z2 + r2 + (z3 - r3 - z2 - r2) * (k + 1) / 4), segs=8, lod=0, frame=f)
    _ball(ms, (f @ Vector((0, 0, z3))).to_tuple(), r3, segs=(12, 8))
    # the mast: grey steel, then red and white bands to the tip
    zm = z3 + r3 * 0.7
    zb = G + 0.88 * H
    rm = max(0.008 * H, 0.012)
    ms.cyl('md_steel', rm, rm * 0.7, zb - zm, at=(0, 0, zm), segs=6, lod=2, frame=f)
    nb = 6
    for k in range(nb):
        za = zb + (G + H - zb) * k / nb
        zz = (G + H - zb) / nb
        ra = max(rm * 0.7 * (1 - k / nb * 0.7), 0.006)
        rb = max(rm * 0.7 * (1 - (k + 1) / nb * 0.7), 0.005)
        ms.cyl('snm_red' if k % 2 == 0 else 'snm_white', ra, rb, zz, at=(0, 0, za), segs=6, lod=1 if k else 2, frame=f)
    return G + H


# ---- landmark 2: the railway station ---------------------------------------------------------------


def _roof_z(u, v, eave, crown):
    """The roof's height over the plan's normalised (u along the hall, v across): it sweeps from
    low eaves at the ends up to the crown in the middle, turns up at the tips and falls a little to
    the front and back edges."""
    bell = math.cos(math.pi * min(1.0, abs(u)) / 2) ** 2
    tip = max(0.0, abs(u) - 0.75) / 0.25
    return eave + (crown - eave) * bell * (1 - 0.3 * v * v) + (crown - eave) * 0.18 * tip * tip - (crown - eave) * 0.06 * v * v


def _roof_xy(u, v, L, D):
    """The plan: the long sides and the ends pinch in at the middle (the sheet's pillow shape)."""
    return u * L / 2 * (1 - 0.08 * (1 - v * v)), v * D / 2 * (1 - 0.12 * (1 - u * u))


def wave_roof(ms, f, L, D, eave, crown, t=0.02, nu=16, nv=8, lod=1, only=(0, 1), mat='snm_roofmetal'):
    """The curved roof as one closed shell: a top grid, the same grid `t` lower, edges round."""
    bm = bmesh.new()
    top_v, bot_v = {}, {}
    for i in range(nu + 1):
        u = -1 + 2 * i / nu
        for j in range(nv + 1):
            v = -1 + 2 * j / nv
            px, py = _roof_xy(u, v, L, D)
            z = _roof_z(u, v, eave, crown)
            top_v[i, j] = bm.verts.new((px, py, z))
            bot_v[i, j] = bm.verts.new((px, py, z - t))
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((top_v[i, j], top_v[i + 1, j], top_v[i + 1, j + 1], top_v[i, j + 1]))
            bm.faces.new((bot_v[i, j + 1], bot_v[i + 1, j + 1], bot_v[i + 1, j], bot_v[i, j]))
    ring = [(i, 0) for i in range(nu)] + [(nu, j) for j in range(nv)] + [(i, nv) for i in range(nu, 0, -1)] + \
           [(0, j) for j in range(nv, 0, -1)]
    for a, b in zip(ring, ring[1:] + ring[:1]):
        bm.faces.new((top_v[a], bot_v[a], bot_v[b], top_v[b]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed shell: safe to orient
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def roof_patch(ms, f, L, D, eave, crown, u0, u1, v0, v1, nu, nv, lift, mat, lod=1, only=None):
    """A single-sided patch lying on the roof (the skylight), facing up."""
    bm = bmesh.new()
    vs = {}
    for i in range(nu + 1):
        u = u0 + (u1 - u0) * i / nu
        for j in range(nv + 1):
            v = v0 + (v1 - v0) * j / nv
            px, py = _roof_xy(u, v, L, D)
            vs[i, j] = bm.verts.new((px, py, _roof_z(u, v, eave, crown) + lift))
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((vs[i, j], vs[i + 1, j], vs[i + 1, j + 1], vs[i, j + 1]))
    ms.add(bm, mat, lod, matrix=f.copy(), only=only)


def _glass_wall(ms, f, L, D, eave, crown, v, inset, n=10, z0=G, lod=1, only=(0, 1)):
    """A glass wall along the hall at plan row v, its top following the roof's underside."""
    bm = bmesh.new()
    prev = None
    for i in range(n + 1):
        u = (-1 + 2 * i / n) * inset
        px, py = _roof_xy(u, v, L, D)
        zt = _roof_z(u, v, eave, crown) - 0.02
        cur = (bm.verts.new((px, py, z0)), bm.verts.new((px, py, zt)))
        if prev:
            q = (prev[0], cur[0], cur[1], prev[1]) if v < 0 else (cur[0], prev[0], prev[1], cur[1])
            bm.faces.new(q)
        prev = cur
    ms.add(bm, 'snm_hallglass', lod, matrix=f.copy(), only=only)


def _end_wall(ms, f, L, D, eave, crown, u, inset, n=4, z0=G, lod=1, only=(0, 1)):
    """A glass end wall across the hall at plan column u."""
    bm = bmesh.new()
    prev = None
    for j in range(n + 1):
        v = (-1 + 2 * j / n) * inset
        px, py = _roof_xy(u, v, L, D)
        zt = _roof_z(u, v, eave, crown) - 0.02
        cur = (bm.verts.new((px, py, z0)), bm.verts.new((px, py, zt)))
        if prev:
            q = (cur[0], prev[0], prev[1], cur[1]) if u < 0 else (prev[0], cur[0], cur[1], prev[1])
            bm.faces.new(q)
        prev = cur
    ms.add(bm, 'snm_hallglass', lod, matrix=f.copy(), only=only)


def _track(ms, f, x0, x1, y, lod=2):
    ms.box('md_track', (x1 - x0, 0.16, 0.008), at=((x0 + x1) / 2, y, G), lod=lod, frame=f)
    for ry in (-0.035, 0.035):
        ms.box('md_steel', (x1 - x0, 0.01, 0.01), at=((x0 + x1) / 2, y + ry, G + 0.008), lod=1, frame=f)


def _platform(ms, f, x0, x1, y, pw, ph=0.17, posts=True):
    """A platform with its canopy: a concrete slab, a slightly gabled aluminium roof on a row of
    steel posts down the middle."""
    L = x1 - x0
    cx = (x0 + x1) / 2
    ms.box('md_concrete', (L, pw, 0.03), at=(cx, y, G), lod=1, frame=f)
    for sy in (-1, 1):
        rf = f @ _t(cx, y + sy * pw * 0.22, G + 0.03 + ph) @ Matrix.Rotation(math.radians(-6 * sy), 4, 'X')
        ms.box('snm_canopy', (L - 0.02, pw * 0.5, 0.01), at=(0, 0, 0), lod=1, frame=rf)
    top(ms, 'snm_canopy', f, L - 0.02, pw, G + 0.03 + ph, x=cx, y=y, lod=2, only=2)
    if posts:
        n = max(2, int(L / 0.25))
        for i in range(n + 1):
            px = x0 + 0.03 + (L - 0.06) * i / n
            ms.box('md_steel', (0.012, 0.012, ph), at=(px, y, G + 0.03), lod=1 if i % 2 == 0 else 0, frame=f)
            ms.box('md_steel', (0.01, pw * 0.8, 0.01), at=(px, y, G + 0.03 + ph - 0.01), lod=0, frame=f)


def rail_station(ms, x, y, yaw=0.0, length=2.0, hall_l=0.9, hall_d=0.6, eave=0.3, crown=0.55, tracks=(-0.22, 0.22),
                 platforms=((0.0, 0.26),), track_len=None, columns=4, plinth=True, front_extra=0.18):
    """The station (sheet: a 220 by 100 m hall 36 m high with platforms 320 m long): the hall
    (`hall_l` along the tracks, `hall_d` across) under the wave roof with a skylight down its
    crown, glass walls following the roof, branching steel columns across the front, a stone
    plinth with steps and planters; the platform canopies run out `length` overall along the
    tracks (`tracks`, `platforms` (y, width) across, local)."""
    f = tm.house_frame(x, y, yaw)
    L, D = hall_l, hall_d
    tl = track_len or length + 0.3
    for ty in tracks:
        _track(ms, f, -tl / 2, tl / 2, ty)
    for py, pw in platforms:
        for sx in (-1, 1):
            a, b = sx * L * 0.42, sx * length / 2
            _platform(ms, f, min(a, b), max(a, b), py, pw)
    # the plinth, steps and planters in front
    yf = -D / 2
    if plinth:
        ms.box('snm_stone', (L * 0.92, D * 0.9, 0.035), at=(0, 0, G - 0.005), lod=2, frame=f)
        ms.box('snm_stone', (L * 0.85, front_extra, 0.03), at=(0, yf - front_extra / 2 + 0.02, G - 0.005), lod=1, frame=f)
        for k in range(3):
            ms.box('snm_stone', (L * 0.45 - 0.04 * k, 0.025, 0.01 * (3 - k)), at=(0, yf - front_extra + 0.0125 + 0.02 * k, G), lod=0, frame=f)
        for sx in (-1, 1):
            ms.box('snm_stone', (L * 0.16, front_extra * 0.5, 0.03), at=(sx * L * 0.3, yf - front_extra * 0.45, G + 0.02), lod=0, frame=f)
            ms.box('md_hedge', (L * 0.15, front_extra * 0.45, 0.03), at=(sx * L * 0.3, yf - front_extra * 0.45, G + 0.035), lod=0, frame=f)
    z0 = G + (0.03 if plinth else 0.0)
    # the hall's glass walls
    _glass_wall(ms, f, L, D, eave, crown, -0.78, 0.82, z0=z0)
    _glass_wall(ms, f, L, D, eave, crown, 0.78, 0.82, z0=z0)
    _end_wall(ms, f, L, D, eave, crown, -0.82, 0.78, z0=z0)
    _end_wall(ms, f, L, D, eave, crown, 0.82, 0.78, z0=z0)
    for v in (-0.78, 0.78):
        _glass_wall(ms, f, L, D, eave, crown, v, 0.82, n=3, z0=z0, lod=2, only=2)
    ms.box('snm_conc', (L * 0.8, D * 0.04, 0.035), at=(0, yf * 0.78 * 0.9, z0 + 0.13), lod=0, frame=f)
    ms.box('md_shop', (L * 0.25, 0.01, 0.12), at=(0, yf * 0.78 * 0.9 - 0.012, z0), lod=0, frame=f)
    # the roof and its skylight
    wave_roof(ms, f, L * 1.15, D * 1.2, eave, crown)
    wave_roof(ms, f, L * 1.15, D * 1.2, eave, crown, t=0.0, nu=6, nv=2, lod=2, only=2)
    roof_patch(ms, f, L * 1.15, D * 1.2, eave, crown, -0.55, 0.55, -0.22, 0.22, 8, 2, 0.003, 'md_glassroof', lod=1)
    # the branching columns across the front
    for i in range(columns):
        u = -0.75 + 1.5 * i / max(1, columns - 1)
        v = -0.92
        px, py = _roof_xy(u, v, L * 1.15, D * 1.2)
        zr = _roof_z(u, v, eave, crown * 0.98) - 0.025
        p0 = f @ Vector((px, py, z0))
        zb = z0 + (zr - z0) * 0.55
        pb = f @ Vector((px, py, zb))
        rod(ms, 'md_steel', tuple(p0), tuple(pb), 0.011, segs=6, lod=1)
        for da in (-0.06, 0.0, 0.06):
            q = f @ Vector((px + da, py + (0.03 if da == 0 else 0.0), _roof_z(u + da / (L * 0.575), v, eave, crown) - 0.025))
            rod(ms, 'md_steel', tuple(pb), tuple(q), 0.006, segs=4, lod=0, caps=False)
    return f


# ---- applying the kit -----------------------------------------------------------------------------


def apply(landmarks=None, **kit):
    """Swap the base layout's houses and paving for the kit's; `landmarks` maps a ti_modern builder
    name ('glass_tower', 'water_tower', 'clock_tower', 'station', 'canopy', ...) to a replacement."""
    KIT.update(kit)
    md.block = kit_block
    md.house = kit_house
    md.flat = kit_flat
    md.tree = kit_tree
    md.bench = kit_bench
    for name, fn in (landmarks or {}).items():
        setattr(md, name, fn)


def main(base_name, layout, ground, landmarks=None, **kit):
    """Build `modern-<base_name>-sinic.glb` (its object keeps the layout's name).
    argv: <out_dir> [atlas_px]."""
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
    out_dir = argv[0] if argv else 'build/map'
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    apply(landmarks, **kit)
    ground = dict(ground, mat='snm_pave')
    tt.build_file('modern-%s-sinic' % base_name, [(base_name, layout, ground)], out_dir, atlas=atlas)
    sys.stdout.flush()
    os._exit(0)
