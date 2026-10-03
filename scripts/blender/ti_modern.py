# scripts/blender/ti_modern.py
# The Modern Age kit (plans/art/towns/modern/<id>/reference-sheet.png; 1900 to 2300): flat-roofed
# blocks of off-white render or red brick with window grids carried by the material (not window
# boxes), slate-roofed brick houses, glass towers, steel water towers, a station canopy, a
# stadium, a sawtooth-roofed works with its chimney, team-grey market tents, asphalt streets with
# markings, paved sidewalks, lawns, hedges and trees. Plus the shared file's town hall and
# parliament, the earthwork, bunker and barbed-wire perimeters, the prefab outpost camp and the
# four fields. Scale as the other kits: 1 unit = 10 m, ordinary buildings raised 1.3x
# (`STOREY`), landmarks and palaces at the sheets' stated heights, fields at real heights.
# Every new material carries the `md_` prefix.
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
import ti_bronze as tb  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

GROUNDS = ['md_pave', 'md_asphalt', 'md_lawn']
NEW = ['md_render', 'md_render_win', 'md_brick', 'md_brick_win', 'md_glass', 'md_shop', 'md_roof', 'md_slate',
       'md_slate_dark', 'md_concrete', 'md_bunker', 'md_lime', 'md_steel', 'md_wire', 'md_glassroof', 'md_leaf',
       'md_hedge', 'md_turf', 'md_corrugated', 'md_prefab', 'md_marking', 'md_wheat', 'md_apple', 'md_poly',
       'md_veg', 'md_veg_red', 'md_gravel', 'md_track', 'md_pitch', 'md_seats', 'md_dome', 'md_wood',
       'md_sandbag', 'md_jerry', 'md_mesh', 'md_soil', 'md_mulch', 'md_pipe']
for _g in GROUNDS:
    NEW += [_g, _g + '_fringe', _g + '_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
for _g in GROUNDS:
    tt.TO_FINAL.update({_g: 'Ground', _g + '_fringe': 'Ground', _g + '_square': 'Ground'})
    if _g + '_fringe' not in tt.FRINGES:
        tt.FRINGES.append(_g + '_fringe')


def _m(nt, op, a, b=None):
    """A Math node: a and b are sockets or floats."""
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    for i, v in enumerate((a, b)):
        if v is None:
            continue
        if isinstance(v, (int, float)):
            n.inputs[i].default_value = float(v)
        else:
            nt.links.new(v, n.inputs[i])
    return n.outputs[0]


def _band(nt, v, lo, hi):
    """1 where lo < v < hi."""
    return _m(nt, 'MULTIPLY', _m(nt, 'GREATER_THAN', v, lo), _m(nt, 'LESS_THAN', v, hi))


def _xyz(nt):
    tcn = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tcn.outputs['Object'], sep.inputs['Vector'])
    return sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']


def _wall_render(colors):
    def make(nt):
        n = tm._noise(nt, 14.0, 5.0, 0.6)
        r = tm._ramp(nt, n.outputs['Fac'], [(0.25 + 0.5 * i / (len(colors) - 1), c) for i, c in enumerate(colors)])
        return r.outputs['Color']
    return make


def _wall_brick(brick='#9b4a32', brick2='#86402c', mortar='#b9ab9a', bond=(0.03, 0.011, 0.0016)):
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
        tint = tm._ramp(nt, n.outputs['Fac'], [(0.3, '#7a3a28'), (0.7, '#a9573a')])
        return tm._mix(nt, 0.3, br.outputs['Color'], tint.outputs['Color'], 'OVERLAY')
    return make


def mat_facade(name, wall, cell_u=0.28, cell_z=STOREY, win_w=0.12, z0=0.14, z1=0.31, base=G,
               glass=('#34414d', '#4f6172', '#8195a6'), frame='#7d7f80', frame_w=0.01, dirt=True, rough=0.88):
    """A wall with a grid of windows painted by the material (so a facade costs two triangles):
    the wall colour from `wall(nt)`, windows `win_w` wide on a `cell_u` pitch along the facade
    (object x + y, so blocks stay axis-aligned), from z0 to z1 above `base` in every `cell_z`
    storey; a dark frame round each, the glass darker below and catching the sky at the top."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    x, y, z = _xyz(nt)
    u = _m(nt, 'ADD', x, y)
    fu = _m(nt, 'FRACT', _m(nt, 'DIVIDE', u, cell_u))
    fz = _m(nt, 'FRACT', _m(nt, 'DIVIDE', _m(nt, 'SUBTRACT', z, base), cell_z))
    hw = win_w / 2 / cell_u
    fw = frame_w / cell_u
    fzw = frame_w / cell_z
    glass_m = _m(nt, 'MULTIPLY', _band(nt, fu, 0.5 - hw, 0.5 + hw), _band(nt, fz, z0 / cell_z, z1 / cell_z))
    frame_m = _m(nt, 'MULTIPLY', _band(nt, fu, 0.5 - hw - fw, 0.5 + hw + fw), _band(nt, fz, z0 / cell_z - fzw, z1 / cell_z + fzw * 1.6))
    col = wall(nt)
    if dirt:
        col = tm._base_dirt(nt, col, height=0.05, dirt='#5c5a55', amount=0.35)
    col = tm._mix(nt, frame_m, col, tm._srgb(frame))
    # glass: a noise between three tones, lighter toward the window's top (sky reflection)
    gn = tm._noise(nt, 6.0, 3.0, 0.5)
    rel = _m(nt, 'DIVIDE', _m(nt, 'SUBTRACT', fz, z0 / cell_z), (z1 - z0) / cell_z)
    gv = _m(nt, 'ADD', _m(nt, 'MULTIPLY', gn.outputs['Fac'], 0.6), _m(nt, 'MULTIPLY', rel, 0.5))
    gr = tm._ramp(nt, gv, [(0.25, glass[0]), (0.55, glass[1]), (0.85, glass[2])])
    col = tm._mix(nt, glass_m, col, gr.outputs['Color'])
    nt.links.new(col, bsdf.inputs['Base Color'])
    rgh = _m(nt, 'SUBTRACT', rough, _m(nt, 'MULTIPLY', glass_m, rough - 0.25))
    nt.links.new(rgh, bsdf.inputs['Roughness'])
    height = _m(nt, 'SUBTRACT', 1.0, _m(nt, 'MULTIPLY', _m(nt, 'ADD', frame_m, glass_m), 0.5))
    tm._bump(nt, bsdf, height, 0.5, 0.004)
    return mat


def mat_grid_xy(name, cell=0.08, bar=0.006, glass=('#7f97a8', '#9fb4c2', '#c3d0d8'), bar_col='#5d646b'):
    """Glazing laid flat (roofs, canopies): a grid on object x and y with thin glazing bars."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    x, y, z = _xyz(nt)
    fx = _m(nt, 'FRACT', _m(nt, 'DIVIDE', x, cell))
    fy = _m(nt, 'FRACT', _m(nt, 'DIVIDE', _m(nt, 'ADD', y, z), cell * 1.6))
    b = bar / cell
    bars = _m(nt, 'MAXIMUM', _m(nt, 'LESS_THAN', fx, b), _m(nt, 'LESS_THAN', fy, b * 0.7))
    gn = tm._noise(nt, 4.0, 3.0, 0.5)
    gr = tm._ramp(nt, gn.outputs['Fac'], [(0.3, glass[0]), (0.55, glass[1]), (0.8, glass[2])])
    col = tm._mix(nt, bars, gr.outputs['Color'], tm._srgb(bar_col))
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.3
    tm._bump(nt, bsdf, bars, 0.4, 0.003)
    return mat


def mat_asphalt(name, colors=('#3b3d40', '#47494c', '#525457')):
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    big = tm._noise(nt, 3.0, 4.0, 0.55)
    fine = tm._noise(nt, 160.0, 6.0, 0.7)
    r = tm._ramp(nt, big.outputs['Fac'], [(0.3, colors[0]), (0.5, colors[1]), (0.7, colors[2])])
    grit = tm._ramp(nt, fine.outputs['Fac'], [(0.35, '#2c2d2f'), (0.65, '#6e6f72')])
    col = tm._mix(nt, 0.3, r.outputs['Color'], grit.outputs['Color'], 'OVERLAY')
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.92
    tm._bump(nt, bsdf, fine.outputs['Fac'], 0.2, 0.002)
    return mat


def mat_stripes(name, colors, axis='X', scale=2.0, noise=20.0):
    """Two or three tones in straight bands (mown grass, stadium rows): object coordinates."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    tcn = nt.nodes.new('ShaderNodeTexCoord')
    wave = nt.nodes.new('ShaderNodeTexWave')
    wave.wave_type = 'BANDS'
    wave.bands_direction = axis
    wave.wave_profile = 'SAW'
    wave.inputs['Scale'].default_value = scale
    wave.inputs['Distortion'].default_value = 0.0
    nt.links.new(tcn.outputs['Object'], wave.inputs['Vector'])
    step = _m(nt, 'GREATER_THAN', wave.outputs['Fac'], 0.5)
    n = tm._noise(nt, noise, 4.0, 0.6)
    v = _m(nt, 'ADD', _m(nt, 'MULTIPLY', step, 0.5), _m(nt, 'MULTIPLY', n.outputs['Fac'], 0.4))
    r = tm._ramp(nt, v, [(0.15 + 0.6 * i / (len(colors) - 1), c) for i, c in enumerate(colors)])
    nt.links.new(r.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    tm._bump(nt, bsdf, n.outputs['Fac'], 0.2, 0.002)
    return mat


RENDER = ('#d2cbbc', '#ddd6c8', '#e6e0d4', '#c8bfae')


def make_materials():
    s = tm.mat_simple
    s('md_render', list(RENDER), scale=14.0, bump=0.2, dirt=True)
    mat_facade('md_render_win', _wall_render(RENDER))
    tm.mat_mudwall('md_brick', wash='#9b4a32', brick='#9b4a32', brick2='#86402c', mortar='#b9ab9a', wash_cover=0.0,
                   bond=(0.03, 0.011, 0.0016))
    mat_facade('md_brick_win', _wall_brick(), frame='#d8d2c6', frame_w=0.014)
    # the towers' curtain wall: blue-grey glass in a steel grid, 3.5 m floors at the sheet's scale
    mat_facade('md_glass', _wall_render(('#5b636b', '#6a727a')), cell_u=0.12, cell_z=0.35, win_w=0.108, z0=0.07, z1=0.345,
               glass=('#2d3d4e', '#4a6075', '#7f98ad'), frame='#4d555c', frame_w=0.004, dirt=False, rough=0.5)
    mat_facade('md_shop', _wall_render(('#3c4147', '#454b51')), cell_u=0.22, cell_z=1.0, win_w=0.2, z0=0.0, z1=0.22,
               glass=('#202a33', '#33424f', '#556878'), frame='#2c3034', frame_w=0.006, dirt=False, rough=0.4)
    s('md_roof', ['#5a5d61', '#66696d', '#52555a', '#707377'], scale=10.0, bump=0.25)
    tm.mat_mudwall('md_slate', wash='#454c56', brick='#47505b', brick2='#3a414b', mortar='#262b31', wash_cover=0.0,
                   bond=(0.03, 0.013, 0.002))
    s('md_slate_dark', ['#2f343a', '#3a3f46'], scale=20.0, bump=0.2)
    s('md_concrete', ['#a9a7a0', '#bab8b1', '#9a9891', '#c4c2bb'], scale=16.0, bump=0.25, dirt=True)
    s('md_bunker', ['#8f8d86', '#a5a39b', '#b8b6ae', '#7f7d77'], scale=22.0, bump=0.5, dirt=True)
    s('md_lime', ['#cfc6b2', '#dbd3c1', '#c4baa4', '#e2dccd'], scale=18.0, bump=0.25, dirt=True)
    s('md_steel', ['#7f868c', '#959ca2', '#6f757b'], scale=18.0, rough=0.5, bump=0.15)
    s('md_wire', ['#2f3134', '#3d4044'], scale=20.0, rough=0.6, bump=0.0)
    mat_grid_xy('md_glassroof')
    s('md_leaf', ['#2c4520', '#3c5c27', '#527a30', '#33502a'], scale=40.0, bump=0.7)
    s('md_hedge', ['#2b4321', '#38572a', '#2a3f22'], scale=50.0, bump=0.6)
    s('md_turf', ['#5a7430', '#6d8838', '#8a8448', '#4f682b'], scale=26.0, bump=0.5)
    s('md_corrugated', ['#6f767d', '#838a91', '#5f666d'], scale=12.0, stripes={'dir': 'X', 'scale': 260.0, 'distortion': 0.5}, bump=0.5)
    s('md_prefab', ['#cfccc4', '#dad7d0', '#c3c0b8'], scale=12.0, stripes={'dir': 'X', 'scale': 30.0, 'distortion': 0.3}, bump=0.3, dirt=True)
    s('md_marking', ['#e4e4de', '#f0f0ea'], scale=30.0, bump=0.0)
    s('md_wheat', ['#8e6a22', '#c09538', '#ddb75a', '#a57f2e'], scale=70.0, stripes={'dir': 'Y', 'scale': 300.0, 'distortion': 14.0}, bump=0.8)
    s('md_apple', ['#2a4a1f', '#416f29', '#b3261c', '#5a8634'], scale=55.0, bump=0.7)
    s('md_poly', ['#cfd5cf', '#e2e6e1', '#bcc6bd'], scale=8.0, stripes={'dir': 'Y', 'scale': 12.0, 'distortion': 0.2}, rough=0.4, bump=0.2)
    s('md_veg', ['#3a7026', '#5a9536', '#7cae48'], scale=90.0, bump=0.7)
    s('md_veg_red', ['#4f2033', '#6c2b44', '#3c5f28'], scale=90.0, bump=0.7)
    s('md_gravel', ['#8e877b', '#a29b8f', '#7a7367'], scale=120.0, bump=0.6)
    tm.mat_mudwall('md_track', wash='#5c574f', brick='#5f5a52', brick2='#6b665d', mortar='#3e352b', wash_cover=0.0,
                   bond=(0.18, 0.03, 0.012))
    mat_stripes('md_pitch', ('#3d7a2e', '#4b8c37', '#58993e'), axis='X', scale=2.2)
    mat_stripes('md_seats', ('#6d7278', '#868b91', '#9aa0a6'), axis='Z', scale=40.0)
    s('md_dome', ['#465868', '#566a7c', '#3b4b59'], scale=14.0, stripes={'dir': 'X', 'scale': 160.0, 'distortion': 0.3}, rough=0.5, bump=0.3)
    s('md_wood', ['#9b7548', '#b18a58', '#87653e'], scale=10.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 6.0}, bump=0.4)
    s('md_sandbag', ['#ad9568', '#c0a97c', '#98825a'], scale=40.0, bump=0.5)
    s('md_jerry', ['#d6d6d2', '#e4e4e0'], scale=20.0, bump=0.1)
    s('md_mesh', ['#7c8186', '#8e9398', '#6e7378'], scale=40.0, stripes={'dir': 'Z', 'scale': 240.0, 'distortion': 0.2}, bump=0.4)
    s('md_soil', ['#5a3f2a', '#6e4e34', '#4c3523'], scale=40.0, bump=0.6)
    s('md_mulch', ['#5a3a24', '#704a2e', '#4a2f1c'], scale=60.0, bump=0.6)
    s('md_pipe', ['#2e3134', '#3b3e42'], scale=20.0, rough=0.5, bump=0.0)
    pave = ('#b4b1aa', '#a5a29b', '#c1beb7')
    for n in ('md_pave', 'md_pave_fringe'):
        tc.mat_paving(n, stone=pave, mortar='#87847e', slab=(0.03, 0.03))
    tc.mat_paving('md_pave_square', stone=('#aaa69d', '#9c988f', '#b7b3aa'), mortar='#7d7972', slab=(0.06, 0.06))
    for n in ('md_asphalt', 'md_asphalt_fringe', 'md_asphalt_square'):
        mat_asphalt(n)
    lawn = ('#4f6e2a', '#5f7f30', '#6f8a3a', '#56752c')
    for n in ('md_lawn', 'md_lawn_fringe', 'md_lawn_square'):
        tm.mat_earth(n, colors=lawn)


if not any(n == 'modern' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('modern', make_materials))

FOOT = [1.0]        # a town file widens its blocks' footprints by this (the sheets' blocks are deep)
LAWN = [0.0]        # a town file can ring every block with a lawn strip this wide
FOOTPRINTS = []     # every block's (x, y, w, d) in world axes, for an overlap check
PLAIN = {'md_render_win': 'md_render', 'md_brick_win': 'md_brick'}
TOWN_GROUND = dict(mat='md_pave', power=4, n=64)
Z_ROAD = G + 0.002      # asphalt over the paved ground
Z_LAWN = G + 0.005      # lawns and planted plots
Z_MARK = G + 0.0035     # paint on the asphalt

# ---- geometry helpers ---------------------------------------------------------------------------


def walls4(ms, mat, f, w, d, h, x=0.0, y=0.0, z=G, lod=2, only=None):
    """Four walls of a w x d block (no top or bottom): eight triangles."""
    bm = bmesh.new()
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    b = [bm.verts.new((x + sx * w / 2, y + sy * d / 2, z)) for sx, sy in corners]
    t = [bm.verts.new((x + sx * w / 2, y + sy * d / 2, z + h)) for sx, sy in corners]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((b[i], b[j], t[j], t[i]))
    return ms.add(bm, mat, lod, matrix=f, only=only)


def top(ms, mat, f, w, d, z, x=0.0, y=0.0, lod=2, only=None):
    bm = bmesh.new()
    bm.faces.new([bm.verts.new((x + sx * w / 2, y + sy * d / 2, z)) for sx, sy in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    return ms.add(bm, mat, lod, matrix=f, only=only)


def rim(ms, mat, f, w, d, z, t=0.025, h=0.05, x=0.0, y=0.0, lod=1, only=None):
    """A parapet: a closed rectangular ring t thick and h high on a roof at z (no bottom)."""
    bm = bmesh.new()
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    ob = [bm.verts.new((x + sx * w / 2, y + sy * d / 2, z)) for sx, sy in corners]
    ot = [bm.verts.new((x + sx * w / 2, y + sy * d / 2, z + h)) for sx, sy in corners]
    ib = [bm.verts.new((x + sx * (w / 2 - t), y + sy * (d / 2 - t), z)) for sx, sy in corners]
    it = [bm.verts.new((x + sx * (w / 2 - t), y + sy * (d / 2 - t), z + h)) for sx, sy in corners]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))
        bm.faces.new((ot[i], ot[j], it[j], it[i]))
        bm.faces.new((ib[i], it[i], it[j], ib[j]))
    return ms.add(bm, mat, lod, matrix=f, only=only)


def flat(ms, mat, pts, z, lod=2, only=None, frame=None):
    """A flat polygon (any winding; made to face up) at height z."""
    area = sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))
    if area < 0:
        pts = list(reversed(pts))
    bm = bmesh.new()
    bm.faces.new([bm.verts.new((px, py, z)) for px, py in pts])
    return ms.add(bm, mat, lod, matrix=frame, only=only)


def rect(ms, mat, x0, y0, x1, y1, z, lod=2, only=None):
    return flat(ms, mat, [(x0, y0), (x1, y0), (x1, y1), (x0, y1)], z, lod, only)


def rounded(cx, cy, w, d, r, seg=4):
    """The outline of a rounded rectangle, counter-clockwise."""
    pts = []
    for k, (sx, sy) in enumerate(((1, -1), (1, 1), (-1, 1), (-1, -1))):
        ccx, ccy = cx + sx * (w / 2 - r), cy + sy * (d / 2 - r)
        a0 = -math.pi / 2 + k * math.pi / 2
        for i in range(seg + 1):
            a = a0 + (math.pi / 2) * i / seg
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a)))
    return pts


def rod(ms, mat, p0, p1, r, segs=5, lod=1, only=None, r2=None, caps=True):
    """A cylinder from point p0 to p1."""
    p0, p1 = Vector(p0), Vector(p1)
    dv = p1 - p0
    length = dv.length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=caps, cap_tris=False, segments=segs, radius1=r, radius2=r if r2 is None else r2, depth=length)
    bmesh.ops.translate(bm, vec=(0, 0, length / 2), verts=bm.verts)
    m = Matrix.Translation(p0) @ Vector((0, 0, 1)).rotation_difference(dv.normalized()).to_matrix().to_4x4()
    return ms.add(bm, mat, lod, matrix=m, only=only)


def hip(ms, f, w, d, z0, rise, over=0.03, mat='md_slate', lod=2):
    """A hip roof (one closed solid) over a w x d block whose walls stop at z0."""
    if d > w:
        f = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        w, d = d, w
    W, D = w / 2 + over, d / 2 + over
    ze = z0 - 0.008
    r = W - D
    bm = bmesh.new()
    c = {(sx, sy): bm.verts.new((sx * W, sy * D, ze)) for sx in (-1, 1) for sy in (-1, 1)}
    if r > 0.002:
        R = {sx: bm.verts.new((sx * r, 0, z0 + rise)) for sx in (-1, 1)}
        bm.faces.new((c[(-1, -1)], c[(1, -1)], R[1], R[-1]))
        bm.faces.new((c[(1, 1)], c[(-1, 1)], R[-1], R[1]))
        bm.faces.new((c[(1, -1)], c[(1, 1)], R[1]))
        bm.faces.new((c[(-1, 1)], c[(-1, -1)], R[-1]))
    else:
        tp = bm.verts.new((0, 0, z0 + rise))
        bm.faces.new((c[(-1, -1)], c[(1, -1)], tp))
        bm.faces.new((c[(1, 1)], c[(-1, 1)], tp))
        bm.faces.new((c[(1, -1)], c[(1, 1)], tp))
        bm.faces.new((c[(-1, 1)], c[(-1, -1)], tp))
    bm.faces.new((c[(-1, -1)], c[(-1, 1)], c[(1, 1)], c[(1, -1)]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed solid: safe to orient
    ms.add(bm, mat, lod, matrix=f)


def facing(x, y):
    """The axis yaw (0, 90, 180, -90) that turns a block's front toward the centre."""
    if abs(x) > abs(y):
        return -90 if x > 0 else 90
    return 0 if y > 0 else 180


# ---- buildings ----------------------------------------------------------------------------------


def block(ms, rng, x, y, w, d, storeys=3, wall='md_render_win', yaw=None, roof='flat', rise=0.2, shop=False,
          awning=False, units=2, balcony=False, door=0.0, h=None, stair=False, chimney=False):
    """An ordinary modern building: walls whose windows the material paints, a flat membrane roof
    with a parapet, a stair housing and plant boxes (or a slate gable or hip roof), a door with a
    concrete canopy, a glazed shopfront (with a team-grey awning) on the ground floor, balconies.
    Its front (-Y) faces `yaw` (default: toward the centre, snapped to an axis)."""
    yaw = facing(x, y) if yaw is None else yaw
    w, d = w * FOOT[0], d * FOOT[0]
    FOOTPRINTS.append((x, y, w, d) if yaw % 180 == 0 else (x, y, d, w))
    if LAWN[0] > 0:  # a planted strip round the block (the sheets' green verges)
        bx, by, bw, bd = FOOTPRINTS[-1]
        m = LAWN[0]
        rect(ms, 'md_lawn', bx - bw / 2 - m, by - bd / 2 - m, bx + bw / 2 + m, by + bd / 2 + m, Z_LAWN, lod=1)
    f = tm.house_frame(x, y, yaw)
    h = h or storeys * STOREY
    plain = PLAIN.get(wall, wall)
    walls4(ms, wall, f, w, d, h, lod=2)
    if roof == 'flat':
        top(ms, 'md_roof', f, w, d, G + h, lod=2)
        rim(ms, plain, f, w, d, G + h, lod=1)
        if stair:
            ms.box(plain, (0.12, 0.1, 0.08), at=(w * 0.22, d * 0.15, G + h), lod=1, frame=f)
        for k in range(units):
            ms.box('md_steel', (0.07, 0.05, 0.045), at=(-w * 0.25 + 0.1 * k, -d * 0.12 + rng.uniform(-0.04, 0.04), G + h), lod=0, frame=f, bevel=0.004)
    elif roof == 'gable':
        tc.gable_roof(ms, f, w, d, G + h, rise, over=0.03, mat='md_slate', gable=plain, ridge='md_slate_dark', thick=0.02)
    else:
        hip(ms, f, w, d, G + h, rise)
    if chimney:
        ms.box(plain, (0.06, 0.06, rise + 0.08), at=(w * 0.3, d * 0.1, G + h), lod=1, frame=f)
    if shop:
        ms.box('md_shop', (w * 0.92, 0.012, 0.24), at=(0, -d / 2 - 0.004, G), lod=1, frame=f)
        ms.box(plain, (w * 0.96, 0.02, 0.035), at=(0, -d / 2 - 0.006, G + 0.245), lod=0, frame=f)
        if awning:
            af = f @ Matrix.Translation(Vector((0, -d / 2 - 0.06, G + 0.25))) @ Matrix.Rotation(math.radians(-16), 4, 'X')
            ms.box('team_cloth', (w * 0.85, 0.13, 0.01), at=(0, 0, 0), lod=1, frame=af)
    else:
        ms.box('door', (0.09, 0.012, 0.19), at=(door, -d / 2 - 0.004, G), lod=1, frame=f)
        ms.box('md_concrete', (0.16, 0.07, 0.012), at=(door, -d / 2 - 0.03, G + 0.2), lod=0, frame=f)
        ms.box('md_concrete', (0.14, 0.05, 0.012), at=(door, -d / 2 - 0.025, G), lod=0, frame=f)
    if balcony and storeys > 1:
        for s in range(1, storeys):
            for bx in (-w * 0.25, w * 0.25):
                bz = G + s * STOREY + 0.005
                ms.box('md_concrete', (0.14, 0.06, 0.012), at=(bx, -d / 2 - 0.03, bz), lod=0, frame=f)
                ms.box('md_steel', (0.14, 0.006, 0.045), at=(bx, -d / 2 - 0.06, bz + 0.012), lod=0, frame=f)
    return f


def house(ms, rng, x, y, w, d, yaw=None, roof='gable', wall='md_brick_win', rise=0.3, chimney=True, h=0.52):
    """A slate-roofed red-brick house (or a rendered one): one storey and a knee wall under a steep
    roof (the attic lit by a window in each gable), a chimney."""
    f = block(ms, rng, x, y, w, d, wall=wall, yaw=yaw, roof=roof, rise=rise, chimney=chimney, h=h)
    if roof == 'gable':
        for sx in (-1, 1):
            ms.box('md_shop', (0.012, 0.08, 0.1), at=(sx * (w / 2 + 0.003), 0, G + h + 0.04), lod=0, frame=f)
    else:
        ms.box(PLAIN.get(wall, wall), (0.12, 0.08, 0.1), at=(0, -d / 2 + 0.06, G + h + 0.02), lod=1, frame=f)
        ms.box('md_shop', (0.07, 0.012, 0.06), at=(0, -d / 2 + 0.018, G + h + 0.04), lod=0, frame=f)
        ms.box('md_slate', (0.14, 0.11, 0.02), at=(0, -d / 2 + 0.06, G + h + 0.12), lod=1, frame=f)
    return f


def tree(ms, x, y, h=0.6, r=0.13, lod2=False, rng=None):
    """A round-crowned street tree: a trunk, a crown of three blobs (LOD0), one (LOD1), a cone
    stand-in at LOD2 when `lod2`."""
    ms.cyl('timber', 0.016, 0.011, h * 0.45, at=(x, y, G), segs=5, lod=1)
    cz = G + h - r * 1.05
    ms.sphere('md_leaf', r, at=(x, y, cz), scale=(1, 1, 1.05), u=8, v=6, lod=0)
    for k in range(2):
        a = (rng.uniform(0, 6.28) if rng else 1.3 + 3.1 * k)
        ms.sphere('md_leaf', r * 0.75, at=(x + r * 0.6 * math.cos(a), y + r * 0.6 * math.sin(a), cz - r * 0.35), u=7, v=5, lod=0)
    ms.sphere('md_leaf', r * 1.1, at=(x, y, cz - r * 0.05), u=6, v=4, lod=1, only=1)
    if lod2:
        ms.cyl('md_leaf', r * 1.1, r * 0.3, r * 1.9, at=(x, y, cz - r * 0.9), segs=4, lod=2, only=2)


def hedge(ms, x0, y0, x1, y1, h=0.06, t=0.05, lod=1):
    length = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    ms.box('md_hedge', (length, t, h), at=((x0 + x1) / 2, (y0 + y1) / 2, G), rot_z=yaw, lod=lod)


def road(ms, x0, y0, x1, y1, w, dashes=True, lod=2):
    """A straight asphalt street with a dashed white centre line (LOD0)."""
    dx, dy = x1 - x0, y1 - y0
    length = math.hypot(dx, dy)
    nx, ny = -dy / length * w / 2, dx / length * w / 2
    flat(ms, 'md_asphalt', [(x0 + nx, y0 + ny), (x0 - nx, y0 - ny), (x1 - nx, y1 - ny), (x1 + nx, y1 + ny)], Z_ROAD, lod)
    if dashes:
        n = int(length / 0.22)
        for i in range(n):
            t0, t1 = (i + 0.25) / n, (i + 0.75) / n
            ax, ay, bx, by = x0 + dx * t0, y0 + dy * t0, x0 + dx * t1, y0 + dy * t1
            ex, ey = nx / (w / 2) * 0.007, ny / (w / 2) * 0.007
            flat(ms, 'md_marking', [(ax + ex, ay + ey), (ax - ex, ay - ey), (bx - ex, by - ey), (bx + ex, by + ey)], Z_MARK, 0)


def zebra(ms, x, y, w, yaw=0, n=5):
    """A pedestrian crossing: n white bars across a street of width w (bars along local Y)."""
    f = tm.house_frame(x, y, yaw)
    for i in range(n):
        bx = -w / 2 + w * (i + 0.5) / n
        ms.box('md_marking', (w / n * 0.5, 0.14, 0.001), at=(bx, 0, Z_MARK - 0.0005), lod=0, frame=f)


def lawn(ms, x0, y0, x1, y1, hedges=(), lod=2):
    """A lawn plot; `hedges` names its hedged sides ('n', 's', 'e', 'w')."""
    rect(ms, 'md_lawn', x0, y0, x1, y1, Z_LAWN, lod)
    for side in hedges:
        if side == 'n':
            hedge(ms, x0, y1, x1, y1)
        elif side == 's':
            hedge(ms, x0, y0, x1, y0)
        elif side == 'w':
            hedge(ms, x0, y0, x0, y1)
        elif side == 'e':
            hedge(ms, x1, y0, x1, y1)


def bench(ms, x, y, yaw=0):
    f = tm.house_frame(x, y, yaw)
    ms.box('md_wood', (0.14, 0.04, 0.012), at=(0, 0, G + 0.035), lod=0, frame=f)
    ms.box('md_wood', (0.14, 0.008, 0.035), at=(0, 0.02, G + 0.045), lod=0, frame=f)
    for sx in (-0.055, 0.055):
        ms.box('md_wire', (0.01, 0.035, 0.035), at=(sx, 0, G), lod=0, frame=f)


def lamp(ms, x, y, h=0.42):
    ms.cyl('md_wire', 0.007, 0.005, h, at=(x, y, G), segs=5, lod=0)
    ms.box('md_wire', (0.05, 0.02, 0.012), at=(x + 0.02, y, G + h), lod=0)


def market_tent(ms, rng, x, y, s=0.26, h=0.2, yaw=0):
    """A square market gazebo: four steel legs, a team-grey pyramid roof with a valance, a table
    with crates under it."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('md_steel', 0.006, 0.006, h, at=(sx * (s / 2 - 0.01), sy * (s / 2 - 0.01), G), segs=4, lod=1, frame=f)
    pf = f @ Matrix.Translation(Vector((0, 0, G + h))) @ Matrix.Rotation(math.radians(45), 4, 'Z')
    ms.cyl('team_cloth', s * 0.72, 0.0, 0.085, at=(0, 0, 0), segs=4, lod=2, frame=pf)
    walls4(ms, 'team_cloth', f, s + 0.012, s + 0.012, 0.035, z=G + h - 0.034, lod=0)
    ms.box('md_wood', (s * 0.75, s * 0.32, 0.075), at=(0, -s * 0.18, G), lod=0, frame=f)
    for k in range(2):
        ms.box('md_wood', (0.05, 0.04, 0.035), at=(-0.05 + 0.1 * k, -s * 0.18 + rng.uniform(-0.02, 0.02), G + 0.075), rot_z=rng.uniform(-20, 20), lod=0, frame=f)


def water_tower(ms, x, y, top=1.2, r=0.16, tank_h=0.2):
    """A steel water tower: four battered legs with X bracing and a ring beam, a cylindrical tank
    with a conical roof and a walkway round its foot; `top` is the roof's tip."""
    roof_h = r * 0.5
    zt = top - roof_h - tank_h
    legs = []
    for k in range(4):
        a = math.radians(45 + 90 * k)
        p0 = (x + r * 1.35 * math.cos(a), y + r * 1.35 * math.sin(a), G)
        p1 = (x + r * 0.8 * math.cos(a), y + r * 0.8 * math.sin(a), zt)
        legs.append((p0, p1))
        rod(ms, 'md_steel', p0, p1, 0.016, segs=6, lod=2)
    def at(leg, t):
        (a0, b0, c0), (a1, b1, c1) = leg
        return (a0 + (a1 - a0) * t, b0 + (b1 - b0) * t, c0 + (c1 - c0) * t)
    for k in range(4):
        la, lb = legs[k], legs[(k + 1) % 4]
        for t0, t1 in ((0.05, 0.5), (0.5, 0.95)):
            rod(ms, 'md_steel', at(la, t0), at(lb, t1), 0.005, segs=4, lod=0)
            rod(ms, 'md_steel', at(lb, t0), at(la, t1), 0.005, segs=4, lod=0)
        rod(ms, 'md_steel', at(la, 0.5), at(lb, 0.5), 0.007, segs=4, lod=1)
    ms.cyl('md_steel', r * 1.12, r * 1.12, 0.012, at=(x, y, zt - 0.006), segs=14, lod=1)
    ms.cyl('md_steel', r, r, tank_h, at=(x, y, zt), segs=16, lod=2)
    ms.cyl('md_steel', r * 1.02, 0.02, roof_h, at=(x, y, zt + tank_h), segs=16, lod=2)
    for k in range(10):  # the walkway rail posts
        a = 2 * math.pi * k / 10
        ms.box('md_wire', (0.006, 0.006, 0.05), at=(x + r * 1.1 * math.cos(a), y + r * 1.1 * math.sin(a), zt + 0.006), lod=0)
    ms.cyl('md_steel', 0.012, 0.012, zt - G, at=(x, y, G), segs=5, lod=0)  # the riser pipe


def glass_tower(ms, x, y, tiers, podium=None, crown=0.06):
    """An office tower in blue-grey curtain wall: `tiers` [(w, d, h, dx, dy), ...] stacked set-backs
    (h each tier's own height), concrete corner fins, a concrete crown, plant on the roof, and a
    rendered podium with a glazed ground floor (`podium` (w, d, h))."""
    f = tm.house_frame(x, y, 0)
    z = G
    if podium:
        pw, pd, ph = podium
        walls4(ms, 'md_render', f, pw, pd, ph, lod=2)
        ms.box('md_shop', (pw * 0.9, 0.012, min(ph - 0.04, 0.24)), at=(0, -pd / 2 - 0.004, G), lod=1, frame=f)
        top(ms, 'md_roof', f, pw, pd, G + ph, lod=2)
        rim(ms, 'md_render', f, pw, pd, G + ph, h=0.035, lod=1)
        ms.box('md_concrete', (0.3, 0.1, 0.015), at=(0, -pd / 2 - 0.05, G + 0.22), lod=0, frame=f)
        z = G + ph
    for i, (w, d, h, dx, dy) in enumerate(tiers):
        walls4(ms, 'md_glass', f, w, d, h, x=dx, y=dy, z=z, lod=2)
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.box('md_concrete', (0.035, 0.035, h), at=(dx + sx * (w / 2 - 0.012), dy + sy * (d / 2 - 0.012), z), lod=1, frame=f)
        z += h
        last = i == len(tiers) - 1
        ch = crown if last else 0.03
        walls4(ms, 'md_concrete', f, w + 0.01, d + 0.01, ch, x=dx, y=dy, z=z - ch + 0.004, lod=1)
        top(ms, 'md_roof', f, w, d, z, x=dx, y=dy, lod=2)
        if last:
            ms.box('md_steel', (w * 0.4, d * 0.35, 0.06), at=(dx, dy, z), lod=1, frame=f, bevel=0.004)
            ms.cyl('md_wire', 0.006, 0.004, 0.12, at=(dx + w * 0.3, dy + d * 0.25, z), segs=4, lod=0)
    return z


def station(ms, x, y, length=2.0, yaw=0, width=0.42, tracks=2, track_len=None):
    """A railway station: a concrete platform under a long glazed canopy on steel columns, the
    tracks beside it (ballast, sleepers and rails), a small brick booking hall at one end."""
    f = tm.house_frame(x, y, yaw)
    ms.box('md_concrete', (length, width * 0.55, 0.03), at=(0, 0, G), lod=2, frame=f)
    ch = 0.3
    n = max(3, int(length / 0.3))
    for i in range(n + 1):
        cx = -length / 2 + 0.05 + (length - 0.1) * i / n
        ms.cyl('md_steel', 0.009, 0.009, ch, at=(cx, 0, G + 0.03), segs=6, lod=1, frame=f)
        ms.box('md_steel', (0.012, width, 0.012), at=(cx, 0, G + 0.03 + ch - 0.006), lod=0, frame=f)
    slope = math.radians(10)
    for sy in (-1, 1):
        rf = f @ Matrix.Translation(Vector((0, sy * width / 4, G + 0.03 + ch + width / 4 * math.tan(slope)))) @ Matrix.Rotation(-slope * sy, 4, 'X')
        ms.box('md_glassroof', (length + 0.06, width / 2 / math.cos(slope) + 0.02, 0.012), at=(0, 0, 0), lod=2, frame=rf)
    ms.box('md_steel', (length + 0.08, 0.02, 0.02), at=(0, 0, G + 0.03 + ch + width / 4 * math.tan(slope) * 2 - 0.004), lod=1, frame=f)
    tl = track_len or length + 0.6
    for k in range(tracks):
        ty = -(width * 0.55 / 2 + 0.1 + 0.2 * k) if k % 2 == 0 else (width * 0.55 / 2 + 0.1 + 0.2 * (k - 1))
        ms.box('md_track', (tl, 0.16, 0.008), at=(0, ty, G), lod=2, frame=f)
        for ry in (-0.035, 0.035):
            ms.box('md_steel', (tl, 0.01, 0.01), at=(0, ty + ry, G + 0.008), lod=1, frame=f)
    hx = length / 2 - 0.2
    ms.box('md_brick', (0.3, width * 0.5, 0.26), at=(hx, 0, G + 0.03), lod=2, frame=f)
    ms.box('md_roof', (0.32, width * 0.52, 0.02), at=(hx, 0, G + 0.29), lod=2, frame=f)
    return f


def canopy(ms, x, y, w, d, h=0.3, yaw=0, glass_walls=True):
    """A glazed shelter or covered market: steel posts, a flat glass roof with a steel edge,
    glass panels at the back."""
    f = tm.house_frame(x, y, yaw)
    n = max(1, int(w / 0.3))
    for i in range(n + 1):
        px = -w / 2 + 0.02 + (w - 0.04) * i / n
        for sy in (-1, 1):
            ms.box('md_steel', (0.016, 0.016, h), at=(px, sy * (d / 2 - 0.02), G), lod=1, frame=f)
    ms.box('md_glassroof', (w + 0.04, d + 0.04, 0.014), at=(0, 0, G + h), lod=2, frame=f)
    walls4(ms, 'md_steel', f, w + 0.05, d + 0.05, 0.025, z=G + h - 0.008, lod=1)
    if glass_walls:
        ms.box('md_glass', (w - 0.03, 0.008, h - 0.03), at=(0, d / 2 - 0.02, G), lod=1, frame=f)
    return f


def clock_tower(ms, x, y, h=1.0, s=0.16):
    """A slender concrete clock tower with a clock face on each side near the top."""
    f = tm.house_frame(x, y, 0)
    ms.box('md_concrete', (s, s, h), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    ms.box('md_concrete', (s + 0.03, s + 0.03, 0.03), at=(0, 0, G + h), lod=1, frame=f)
    zc = G + h - 0.12
    for k in range(4):
        rf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        ms.cyl('md_marking', 0.055, 0.055, 0.01, at=(0, -s / 2, zc), rot=(90, 0, 0), segs=12, lod=1, frame=rf)
        ms.box('dark', (0.006, 0.006, 0.04), at=(0, -s / 2 - 0.011, zc - 0.005), lod=0, frame=rf)
        ms.box('dark', (0.03, 0.006, 0.006), at=(0.012, -s / 2 - 0.011, zc - 0.003), lod=0, frame=rf)


def factory(ms, x, y, w, d, h=0.42, teeth=4, yaw=0, rise=0.16, chimney=None):
    """A brick works with a sawtooth roof: each tooth a slate slope and a vertical glazed face,
    and a tall tapering brick chimney at `chimney` (x, y, top) in world space."""
    f = tm.house_frame(x, y, yaw)
    walls4(ms, 'md_brick_win', f, w, d, h, lod=2)
    z = G + h
    tw = w / teeth
    for i in range(teeth):
        x0 = -w / 2 + i * tw
        x1 = x0 + tw
        bm = bmesh.new()  # the slope
        bm.faces.new([bm.verts.new(p) for p in ((x0, -d / 2, z), (x1, -d / 2, z + rise), (x1, d / 2, z + rise), (x0, d / 2, z))])
        ms.add(bm, 'md_slate', 2, matrix=f)
        bm = bmesh.new()  # the north-light glazing
        bm.faces.new([bm.verts.new(p) for p in ((x1, -d / 2, z), (x1, d / 2, z), (x1, d / 2, z + rise), (x1, -d / 2, z + rise))])
        ms.add(bm, 'md_glass', 2, matrix=f)
        bm = bmesh.new()  # the brick ends
        bm.faces.new([bm.verts.new(p) for p in ((x0, -d / 2, z), (x1, -d / 2, z), (x1, -d / 2, z + rise))])
        bm.faces.new([bm.verts.new(p) for p in ((x1, d / 2, z + rise), (x1, d / 2, z), (x0, d / 2, z))])
        ms.add(bm, 'md_brick', 2, matrix=f)
    ms.box('door', (0.2, 0.012, 0.24), at=(-w * 0.2, -d / 2 - 0.004, G), lod=1, frame=f)
    ms.box('md_concrete', (0.26, 0.02, 0.03), at=(-w * 0.2, -d / 2 - 0.008, G + 0.24), lod=0, frame=f)
    if chimney:
        cx, cy, ctop = chimney
        ms.cyl('md_brick', 0.075, 0.05, ctop - G, at=(cx, cy, G), segs=10, lod=2)
        ms.cyl('md_brick', 0.06, 0.06, 0.03, at=(cx, cy, ctop - 0.03), segs=10, lod=0)
        ms.cyl('dark', 0.045, 0.045, 0.004, at=(cx, cy, ctop), segs=10, lod=0)
        ms.box('md_brick', (0.2, 0.2, 0.08), at=(cx, cy, G), lod=1, bevel=0.004)
    return f


def ell_sweep(ms, mat, profile, cx, cy, rx, ry, a0, a1, n, lod=2, only=None, chunk=45.0):
    """`ti_bronze.sweep` round an ellipse: profile [(offset, z), ...] where the offset grows
    outward from the ellipse (rx, ry) centred on (cx, cy); outside on the right."""
    pieces = max(1, round(abs(a1 - a0) / chunk))
    if pieces > 1:
        per = max(1, round(n / pieces))
        for p in range(pieces):
            b0, b1 = a0 + (a1 - a0) * p / pieces, a0 + (a1 - a0) * (p + 1) / pieces
            ell_sweep(ms, mat, profile, cx, cy, rx, ry, b0, b1, per, lod=lod, only=only, chunk=360.0)
        return
    bm = bmesh.new()
    rows = []
    for j in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * j / n)
        c, s = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((cx + (rx + o) * c, cy + (ry + o) * s, z)) for o, z in profile])
    for j in range(n):
        for i in range(len(profile) - 1):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    (r0, z0), (r1, z1) = profile[0], profile[1]
    am = math.radians(a0 + (a1 - a0) * 0.5 / n)
    want = Vector(((z1 - z0) * math.cos(am), (z1 - z0) * math.sin(am), -(r1 - r0)))
    if bm.faces[0].normal.dot(want) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    ms.add(bm, mat, lod, only=only)


def stadium(ms, cx, cy, rx=1.0, ry=0.9, top=0.6):
    """A football ground: a mown pitch with white lines, stands of grey seating rising in an
    oval bowl to a concrete outer wall, a cantilevered roof over the upper rows, floodlights."""
    pw, pd = rx * 1.15, ry * 0.95
    rect(ms, 'md_pitch', cx - rx * 0.98, cy - ry * 0.98, cx + rx * 0.98, cy + ry * 0.98, Z_LAWN, lod=2)
    lw = 0.008
    for (x0, y0, x1, y1) in ((-pw / 2, -pd / 2, pw / 2, -pd / 2 + lw), (-pw / 2, pd / 2 - lw, pw / 2, pd / 2),
                             (-pw / 2, -pd / 2, -pw / 2 + lw, pd / 2), (pw / 2 - lw, -pd / 2, pw / 2, pd / 2),
                             (-lw / 2, -pd / 2, lw / 2, pd / 2)):
        rect(ms, 'md_marking', cx + x0, cy + y0, cx + x1, cy + y1, Z_LAWN + 0.0015, lod=0)
    for sx in (-1, 1):  # the penalty boxes
        bx = cx + sx * pw / 2
        rect(ms, 'md_marking', bx - sx * 0.16, cy - 0.2, bx - sx * 0.16 + lw, cy + 0.2, Z_LAWN + 0.0015, lod=0)
        for sy in (-1, 1):
            rect(ms, 'md_marking', min(bx, bx - sx * 0.16), cy + sy * 0.2, max(bx, bx - sx * 0.16), cy + sy * 0.2 + lw, Z_LAWN + 0.0015, lod=0)
    ell_sweep(ms, 'md_marking', [(-0.0, Z_LAWN + 0.0015), (-0.009, Z_LAWN + 0.0015)], cx, cy, 0.09, 0.09, 0, 360, 20, lod=0)
    sw = 0.42  # the stands' depth
    for lod, n in ((0, 64), (1, 40), (2, 20)):
        ell_sweep(ms, 'md_concrete', [(0.0, G), (0.0, G + 0.04)], cx, cy, rx, ry, 0, 360, n, lod=lod, only=lod)
        ell_sweep(ms, 'md_seats', [(0.0, G + 0.04), (sw, top - 0.04)], cx, cy, rx, ry, 0, 360, n, lod=lod, only=lod)
        ell_sweep(ms, 'md_render', [(sw, top - 0.04), (sw + 0.03, top), (sw + 0.03, G)], cx, cy, rx, ry, 0, 360, n, lod=lod, only=lod)
    for lod, n in ((0, 48), (1, 28)):  # the roof: a thin closed blade over the back rows
        ell_sweep(ms, 'md_steel', [(sw + 0.03, top + 0.12), (sw * 0.45, top + 0.06), (sw * 0.45, top + 0.045), (sw + 0.03, top + 0.105)],
                  cx, cy, rx, ry, 20, 160, n // 2, lod=lod, only=lod)
        ell_sweep(ms, 'md_steel', [(sw + 0.03, top + 0.12), (sw * 0.45, top + 0.06), (sw * 0.45, top + 0.045), (sw + 0.03, top + 0.105)],
                  cx, cy, rx, ry, 200, 340, n // 2, lod=lod, only=lod)
    for k in range(4):
        a = math.radians(45 + 90 * k)
        px, py = cx + (rx + sw + 0.06) * math.cos(a), cy + (ry + sw + 0.06) * math.sin(a)
        ms.cyl('md_steel', 0.012, 0.009, top + 0.32, at=(px, py, G), segs=5, lod=1)
        ms.box('md_marking', (0.1, 0.03, 0.06), at=(px, py, G + top + 0.3), rot_z=math.degrees(a) + 90, lod=0)


# ---- the shared file: palaces -------------------------------------------------------------------


def obox(ms, mat, size, at=(0, 0, 0), frame=None, lod=1, only=None):
    """Mesher.box for a part shown only at the listed LODs (`only`)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = Matrix.Translation(Vector(at))
    return ms.add(bm, mat, lod, matrix=m if frame is None else frame @ m, only=only)


def window_row(ms, f, xs, y, z, w, h, lod=0, mat='md_shop'):
    for wx in xs:
        ms.box(mat, (w, 0.012, h), at=(wx, y, z), lod=lod, frame=f)


def flagpole(ms, f, x, y, top, lod=1):
    ms.cyl('md_steel', 0.009, 0.006, top - G, at=(x, y, G), segs=6, lod=lod, frame=f)
    tt.pennant(ms, f, x, y, top - 0.01, yaw=-160, lod=lod, w=0.18, h=0.12)


def planter(ms, f, x, y, w, d=0.06):
    ms.box('md_lime', (w, d, 0.035), at=(x, y, G), lod=1, frame=f)
    ms.box('md_hedge', (w - 0.02, d - 0.02, 0.05), at=(x, y, G + 0.03), lod=0, frame=f, bevel=0.006)


def palace_small(ms, rng):
    """`palace-small`, the town hall (sheet: 20 m wide, 11 m; here 9.5 m wide to fit a small town's
    free centre, at the sheet's height): an off-white two-storey civic block on a pale stone
    plinth, five tall window bays between piers on the front, a flat roof with a parapet and two
    vents, a concrete entrance canopy over dark timber doors, a flight of steps with steel rails,
    planters and two team-grey flags."""
    f = tm.house_frame(0, 0.06, 0)
    w, d, h = 0.95, 0.56, 0.9
    pz = 0.05
    ms.box('md_lime', (w + 0.04, d + 0.04, pz), at=(0, 0, G), lod=2, frame=f)
    z = G + pz
    walls4(ms, 'md_render', f, w, d, h, z=z, lod=2)
    top(ms, 'md_roof', f, w, d, z + h, lod=2)
    rim(ms, 'md_render', f, w, d, z + h, t=0.03, h=0.06, lod=1)
    ms.box('md_lime', (w + 0.012, d + 0.012, 0.05), at=(0, 0, z), lod=1, frame=f)
    for vx in (-w * 0.3, w * 0.3):
        ms.box('md_steel', (0.06, 0.06, 0.04), at=(vx, d * 0.15, z + h), lod=1, frame=f, bevel=0.004)
    # the front: five bays of tall windows (two storeys each) between piers; a band at mid height
    bays = 5
    bw = w / bays
    for i in range(bays):
        bx = -w / 2 + bw * (i + 0.5)
        for zz in (z + 0.09, z + 0.5):
            ms.box('md_shop', (bw * 0.62, 0.012, 0.3), at=(bx, -d / 2 - 0.003, zz), lod=1, frame=f)
    for i in range(bays + 1):
        px = -w / 2 + bw * i
        ms.box('md_render', (0.05 if 0 < i < bays else 0.07, 0.025, h - 0.02), at=(px, -d / 2 - 0.01, z), lod=1, frame=f)
    ms.box('md_lime', (w, 0.02, 0.045), at=(0, -d / 2 - 0.008, z + 0.42), lod=1, frame=f)
    for sx in (-1, 1):  # the sides: three bays
        sf = f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        for i in range(3):
            by = -d / 2 + d * (i + 0.5) / 3
            for zz in (z + 0.09, z + 0.5):
                ms.box('md_shop', (d / 3 * 0.6, 0.012, 0.3), at=(by, -w / 2 - 0.003, zz), lod=1, frame=sf)
    ms.box('door', (0.06, 0.012, 0.13), at=(0.1, d / 2 + 0.004, z), lod=0, frame=f)
    # the entrance: doors, a canopy, steps, rails, planters, flags
    ms.box('door', (0.16, 0.014, 0.22), at=(0, -d / 2 - 0.012, z), lod=1, frame=f)
    ms.box('md_concrete', (0.3, 0.13, 0.025), at=(0, -d / 2 - 0.06, z + 0.28), lod=1, frame=f)
    steps = 4
    for s in range(steps):
        ms.box('md_lime', (0.34, 0.04 * (steps - s), pz * (s + 1) / steps), at=(0, -d / 2 - 0.02 - 0.02 * (steps - s), G), lod=1, frame=f)
    for sx in (-1, 1):
        rod(ms, 'md_steel', (sx * 0.15, -d / 2 - 0.17, G + 0.07), (sx * 0.15, -d / 2 - 0.02, z + 0.07), 0.004, segs=4, lod=0)
        planter(ms, f, sx * 0.33, -d / 2 - 0.06, 0.26)
        flagpole(ms, f, sx * 0.21, -d / 2 - 0.08, 0.72)


def palace(ms, rng):
    """`palace`, the parliament (sheet: 40 by 28 m, 22 m to the dome's lantern; here 13.4 m wide
    to fit a town's free centre, at the sheet's heights): a limestone central block (16 m) with a
    portico of eight columns over three timber doors, a blue-grey ribbed metal dome on a drum with
    a lantern, two lower wings (12 m) with rows of tall windows and membrane roofs, a stone
    forecourt with broad steps, planters and two team-grey flags."""
    f = tm.house_frame(0, 0.1, 0)
    pz = 0.04
    ms.box('md_lime', (1.36, 0.9, pz), at=(0, 0, G), lod=2, frame=f)
    z = G + pz
    # the wings
    ww, wd, wh = 0.36, 0.72, 1.16
    for sx in (-1, 1):
        wx = sx * (0.31 + ww / 2)
        walls4(ms, 'md_lime', f, ww, wd, wh, x=wx, z=z, lod=2)
        top(ms, 'md_roof', f, ww, wd, z + wh, x=wx, lod=2)
        rim(ms, 'md_lime', f, ww, wd, z + wh, t=0.02, h=0.04, x=wx, lod=1)
        xs = [wx - ww / 2 + ww * (i + 0.5) / 4 for i in range(4)]
        for zz in (z + 0.1, z + 0.48, z + 0.84):
            window_row(ms, f, xs, -wd / 2 - 0.003, zz, 0.05, 0.22)
        obox(ms, 'md_shop', (ww * 0.9, 0.006, 0.022), at=(wx, -wd / 2 - 0.002, z + 0.2), frame=f, lod=1, only=1)
        for zz in (z + 0.1, z + 0.48, z + 0.84):  # LOD1: one dark band per storey
            obox(ms, 'md_shop', (ww * 0.88, 0.008, 0.22), at=(wx, -wd / 2 - 0.003, zz), frame=f, lod=1, only=1)
        sf = f @ Matrix.Translation(Vector((wx, 0, 0))) @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        ys = [-wd / 2 + wd * (i + 0.5) / 6 for i in range(6)]
        for zz in (z + 0.1, z + 0.48, z + 0.84):
            window_row(ms, sf, ys, -ww / 2 - 0.003, zz, 0.05, 0.22)
            obox(ms, 'md_shop', (wd * 0.9, 0.008, 0.22), at=(0, -ww / 2 - 0.003, zz), frame=sf, lod=1, only=1)
        ms.box('md_lime', (ww + 0.012, wd + 0.012, 0.06), at=(wx, 0, z), lod=1, frame=f)
    # the central block
    cw, cd, chh = 0.62, 0.62, 1.56
    cy = -0.02
    walls4(ms, 'md_lime', f, cw, cd, chh, y=cy, z=z, lod=2)
    top(ms, 'md_roof', f, cw, cd, z + chh, y=cy, lod=2)
    rim(ms, 'md_lime', f, cw, cd, z + chh, t=0.03, h=0.05, y=cy, lod=1)
    for sx in (-1, 1):  # windows on the central block's sides above the wings and at the back
        sf = f @ Matrix.Translation(Vector((0, cy, 0))) @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        window_row(ms, sf, [-0.15, 0.0, 0.15], -cw / 2 - 0.003, z + 1.24, 0.06, 0.2)
    bf = f @ Matrix.Translation(Vector((0, cy, 0))) @ Matrix.Rotation(math.radians(180), 4, 'Z')
    for zz in (z + 0.1, z + 0.5, z + 0.9):
        window_row(ms, bf, [-0.2, -0.07, 0.07, 0.2], -cd / 2 - 0.003, zz, 0.06, 0.24)
    ms.box('door', (0.1, 0.012, 0.16), at=(0, cd / 2 + cy + 0.004, z), lod=0, frame=f)
    # the portico: a recessed glazed front, eight columns, an entablature
    fy = cy - cd / 2
    ms.box('md_shop', (cw * 0.86, 0.012, 1.15), at=(0, fy - 0.002, z), lod=1, frame=f)
    for dx in (-0.16, 0.0, 0.16):
        ms.box('door', (0.08, 0.014, 0.2), at=(dx, fy - 0.006, z), lod=1, frame=f)
    col_h = 1.2
    for i in range(8):
        px = -cw / 2 + 0.04 + (cw - 0.08) * i / 7
        ms.cyl('md_lime', 0.024, 0.021, col_h, at=(px, fy - 0.08, z), segs=8, lod=1, frame=f)
        ms.box('md_lime', (0.06, 0.06, 0.02), at=(px, fy - 0.08, z), lod=0, frame=f)
    ms.box('md_lime', (cw + 0.02, 0.14, 0.12), at=(0, fy - 0.06, z + col_h), lod=2, frame=f)
    ms.box('md_lime', (cw + 0.04, 0.16, 0.03), at=(0, fy - 0.06, z + col_h + 0.12), lod=1, frame=f)
    # the dome: drum, ribbed dome, lantern
    dz = z + chh
    ms.cyl('md_lime', 0.27, 0.27, 0.1, at=(0, cy, dz), segs=24, lod=2, frame=f)
    ms.cyl('md_lime', 0.285, 0.285, 0.02, at=(0, cy, dz + 0.1), segs=24, lod=1, frame=f)
    ms.sphere('md_dome', 0.26, at=(0, cy, dz + 0.12), scale=(1, 1, 0.78), u=24, v=10, cut_below=0.0, lod=1, only=(0, 1), frame=f)
    ms.sphere('md_dome', 0.26, at=(0, cy, dz + 0.12), scale=(1, 1, 0.78), u=10, v=5, cut_below=0.0, lod=2, only=2, frame=f)
    for k in range(12):  # the ribs
        rf = f @ Matrix.Translation(Vector((0, cy, dz + 0.12))) @ Matrix.Rotation(math.radians(30 * k), 4, 'Z')
        bm = bmesh.new()
        prof = [(0.262 * math.cos(math.radians(a)), 0.262 * 0.78 * math.sin(math.radians(a))) for a in range(0, 91, 15)]
        vs = []
        for (r, zz) in prof:
            vs.append((bm.verts.new((r, -0.006, zz)), bm.verts.new((r, 0.006, zz))))
        for (a0, a1), (b0, b1) in zip(vs, vs[1:]):
            bm.faces.new((a0, b0, b1, a1))
        ms.add(bm, 'md_steel', 0, matrix=rf)
    lz = dz + 0.12 + 0.26 * 0.78
    ms.cyl('md_lime', 0.07, 0.07, 0.1, at=(0, cy, lz - 0.01), segs=12, lod=1, frame=f)
    ms.cyl('md_dome', 0.085, 0.0, 0.08, at=(0, cy, lz + 0.09), segs=12, lod=1, frame=f)
    # the forecourt: steps, planters, flags
    for s in range(5):
        ms.box('md_lime', (0.6, 0.035 * (5 - s), pz * (s + 1) / 5), at=(0, -0.45 - 0.0175 * (5 - s) + 0.03, G), lod=1, frame=f)
    for sx in (-1, 1):
        planter(ms, f, sx * 0.48, -0.43, 0.3)
        flagpole(ms, f, sx * 0.4, -0.42, 1.9)
        rod(ms, 'md_steel', (sx * 0.28, -0.6, G + 0.06), (sx * 0.28, -0.42, z + 0.06), 0.004, segs=4, lod=0)


# ---- the shared file: earthwork, bunker and wire perimeters ------------------------------------

RAISE = tb.WALL_RAISE


def bunker(ms, f, r, h, slits=True):
    """A weathered concrete pillbox (an octagon) in frame f, its firing slit facing -Y (out)."""
    rot = (0, 0, 22.5)
    ms.cyl('md_bunker', r, r * 0.93, h, at=(0, 0, 0), rot=rot, segs=8, lod=1, only=(0, 1), frame=f)
    ms.cyl('md_bunker', r * 1.07, r * 1.02, 0.035, at=(0, 0, h - 0.01), rot=rot, segs=8, lod=1, frame=f)
    ms.cyl('md_bunker', r * 1.04, r * 0.95, h + 0.02, at=(0, 0, 0), rot=rot, segs=6, lod=2, only=2, frame=f)
    ms.box('dark', (r * 1.0, 0.02, 0.04), at=(0, -r * 0.93, h * 0.5), lod=1, frame=f)
    if slits:
        for sx in (-1, 1):
            sf = f @ Matrix.Rotation(math.radians(sx * 50), 4, 'Z')
            ms.box('dark', (r * 0.5, 0.02, 0.035), at=(0, -r * 0.92, h * 0.5), lod=0, frame=sf)
    ms.box('dark', (r * 0.45, 0.02, h * 0.6), at=(0, r * 0.93, 0.0), lod=0, frame=f)  # the door at the back


def earthwork_ring(ms, rng, R_in, R_out, berm, gate_w, bunkers, bk_r, bk_h, trench=False, n=(120, 56, 24), post_step=0.32):
    """A Modern perimeter: a grassed earth berm (with a trench along its crest when `trench`) round
    the town, a gap at the south closed by a timber barrier, concrete pillboxes on the crest at
    the given angles, steel posts strung with barbed wire along the outer edge."""
    half = math.degrees(math.asin((gate_w / 2) / R_out))
    a0, a1 = -90 + half, 270 - half
    wd = R_out - R_in
    if trench:
        prof = [(R_out, G + 0.004), (R_out - wd * 0.25, berm), (R_out - wd * 0.45, berm), (R_out - wd * 0.5, G + berm * 0.25),
                (R_out - wd * 0.62, G + berm * 0.25), (R_out - wd * 0.67, berm * 0.75), (R_out - wd * 0.8, berm * 0.75), (R_in, G + 0.004)]
        ditch = (3, 4)
    else:
        prof = [(R_out, G + 0.004), (R_out - wd * 0.3, berm), (R_out - wd * 0.68, berm), (R_in, G + 0.004)]
        ditch = None
    for lod in (0, 1, 2):
        steps = n[lod]
        p = prof if lod < 2 else [prof[0], (R_out - wd * 0.3, berm), (R_out - wd * 0.7, berm * 0.9), prof[-1]]
        for i in range(len(p) - 1):
            mat = 'mud' if (ditch and lod < 2 and i == ditch[0]) else 'md_turf'
            tb.sweep(ms, mat, [p[i], p[i + 1]], a0, a1, steps, lod=lod, only=lod)
        for sx, aa in ((-1, a0), (1, a1)):  # close the berm's ends at the gate
            if lod == 2:
                continue
            ang = math.radians(aa)
            bm = bmesh.new()
            vs = [bm.verts.new((r * math.cos(ang), r * math.sin(ang), zz)) for r, zz in p]
            cap = bm.faces.new(vs if sx > 0 else list(reversed(vs)))
            bm.normal_update()
            if cap.normal.dot(Vector((math.cos(ang + sx * math.pi / 2), math.sin(ang + sx * math.pi / 2), 0))) < 0:
                bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
            ms.add(bm, 'md_turf', lod, only=lod)
    tb.footing(ms, R_out, R_in, n[1], apron=0.3)
    ms.quad_strip('md_gravel', [(-gate_w / 2 + 0.03, -R_out - 0.12, G + 0.002), (gate_w / 2 - 0.03, -R_out - 0.12, G + 0.002),
                                (gate_w / 2 - 0.03, -R_in + 0.1, G + 0.002), (-gate_w / 2 + 0.03, -R_in + 0.1, G + 0.002)], lod=1)
    # the wire: steel posts along the outer crest, two strands (LOD0), one (LOD1)
    rp = R_out - wd * 0.27
    skip = [(a, math.degrees(math.asin(bk_r * 1.5 / rp))) for a in bunkers]
    npost = int(math.radians(a1 - a0) * rp / post_step)
    ph = 0.2
    for i in range(npost + 1):
        a = a0 + (a1 - a0) * i / npost
        if any(abs((a - c + 180) % 360 - 180) < hw for c, hw in skip):
            continue
        rr = math.radians(a)
        px, py = rp * math.cos(rr), rp * math.sin(rr)
        ms.cyl('md_wire', 0.007, 0.006, ph + 0.02, at=(px, py, berm - 0.02), segs=4, lod=1)
    for zz, lod in ((berm + ph * 0.45, 0), (berm + ph * 0.9, 1)):
        t = 0.0025
        tb.sweep(ms, 'md_wire', [(rp + t, zz), (rp + t, zz + 2 * t), (rp - t, zz + 2 * t), (rp - t, zz)], a0, a1, n[lod], lod=lod)
    if True:  # a third strand, the barbed one, between them (LOD0)
        zz = berm + ph * 0.68
        t = 0.0035
        tb.sweep(ms, 'md_wire', [(rp + t, zz), (rp + t, zz + 2 * t), (rp - t, zz + 2 * t), (rp - t, zz)], a0, a1, n[0], lod=0)
    for a in bunkers:
        f = tb.ring_frame(R_out - wd * 0.42, a, berm - 0.03)
        bunker(ms, f, bk_r, bk_h)
    # the gate: a timber post on each side and a barrier beam between them
    gy = -(R_out + R_in) / 2
    for sx in (-1, 1):
        for dy in (-0.05, 0.05):
            ms.box('md_wood', (0.035, 0.035, 0.16), at=(sx * (gate_w / 2 - 0.02), gy + dy, G), lod=1)
        ms.box('md_sandbag', (0.08, 0.16, 0.045), at=(sx * (gate_w / 2 + 0.04), gy, G), lod=0, bevel=0.01)
    ms.box('md_wood', (gate_w - 0.02, 0.025, 0.03), at=(0, gy - 0.05, G + 0.11), lod=1)
    ms.box('md_wood', (gate_w - 0.02, 0.02, 0.025), at=(0, gy - 0.05, G + 0.05), lod=0)
    ms.box('md_wood', (gate_w - 0.02, 0.025, 0.03), at=(0, gy + 0.05, G + 0.11), lod=0)


def walls_small(ms, rng):
    """`walls-small` (46 m, a 40 m clear town): a 1.2 m grassed earth berm, four concrete
    bunkers (2 m on the crest) at the corners, steel posts with barbed wire, a 4 m timber
    barrier at the south gap. Heights raised 1.3x."""
    earthwork_ring(ms, rng, 2.0, 2.3, G + 0.12 * RAISE, 0.4, (45, 135, 225, 315), 0.17, 0.2 * RAISE)


def walls_medium(ms, rng):
    """`walls-medium` (68 m, 60 m clear): a 1.5 m berm with a trench along its crest, six
    pillboxes (4 by 3 m, 2.5 m), posts with barbed wire, a 5 m barrier gap at the south."""
    earthwork_ring(ms, rng, 3.0, 3.4, G + 0.15 * RAISE, 0.5, (0, 60, 120, 180, 237, 303), 0.19, 0.22 * RAISE, trench=True,
                   n=(144, 64, 28))


def walls_big(ms, rng):
    """`walls-big` (90 m, 80 m clear): a 1.8 m berm with a crest trench, seven bunkers, posts and
    barbed wire, a 6 m barrier gap at the south."""
    earthwork_ring(ms, rng, 4.0, 4.5, G + 0.18 * RAISE, 0.6, (0, 45, 90, 135, 180, 232, 308), 0.21, 0.24 * RAISE, trench=True,
                   n=(160, 72, 32), post_step=0.38)


# ---- the shared file: the outpost camp -----------------------------------------------------------


def prefab(ms, x, y, w, d, wall_h=0.3, rise=0.07, ridge_y=False, door=0.0):
    """A prefab cabin: off-white panel walls, a shallow corrugated gable roof (ridge along x, or
    along y when `ridge_y`), a steel door with a step, small windows."""
    f = tm.house_frame(x, y, 0)
    ms.box('md_prefab', (w, d, wall_h), at=(0, 0, G + 0.02), lod=2, frame=f, bevel=0.004)
    ms.box('md_concrete', (w + 0.02, d + 0.02, 0.02), at=(0, 0, G), lod=1, frame=f)
    if ridge_y:
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        tc.gable_roof(ms, rf, d, w, G + 0.02 + wall_h, rise, over=0.025, mat='md_corrugated', gable='md_prefab', ridge='md_steel', thick=0.012)
    else:
        tc.gable_roof(ms, f, w, d, G + 0.02 + wall_h, rise, over=0.025, mat='md_corrugated', gable='md_prefab', ridge='md_steel', thick=0.012)
    ms.box('md_steel', (0.075, 0.012, 0.19), at=(door, -d / 2 - 0.004, G + 0.02), lod=1, frame=f)
    ms.box('md_concrete', (0.12, 0.05, 0.02), at=(door, -d / 2 - 0.025, G), lod=0, frame=f)
    for wx in (door - 0.13, door + 0.13):
        if abs(wx) < w / 2 - 0.04:
            ms.box('md_shop', (0.06, 0.01, 0.06), at=(wx, -d / 2 - 0.003, G + 0.15), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('md_shop', (0.06, 0.01, 0.06), at=(sx * (w / 2 + 0.003), d * 0.15, G + 0.15), rot_z=90, lod=0, frame=f)


def chain_fence(ms, pts, h=0.26, step=0.24):
    """A chain-link fence along a polyline: steel posts, a top rail, a mesh panel."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        nseg = max(1, round(length / step))
        for i in range(nseg + 1):
            px, py = x0 + (x1 - x0) * i / nseg, y0 + (y1 - y0) * i / nseg
            ms.cyl('md_steel', 0.007, 0.007, h, at=(px, py, G - 0.005), segs=5, lod=1)
        mx, my = (x0 + x1) / 2, (y0 + y1) / 2
        ms.box('md_steel', (length, 0.008, 0.008), at=(mx, my, G + h - 0.012), rot_z=yaw, lod=1)
        ms.box('md_mesh', (length, 0.003, h - 0.03), at=(mx, my, G + 0.01), rot_z=yaw, lod=1)


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): a 4 m prefab cabin at the back and two 3 m cabins either side,
    corrugated roofs, a stone fire ring, crates, sandbags and jerrycans on the west, a stack of
    steel pipes and timber boards on the east, a chain-link fence on the west and north, a team
    flag on a 4 m steel pole. Heights raised 1.3x as the other camps."""
    prefab(ms, 0.0, 0.42, 0.42, 0.4, wall_h=0.3, rise=0.06)
    prefab(ms, -0.5, 0.02, 0.3, 0.44, wall_h=0.28, rise=0.06, ridge_y=True)
    prefab(ms, 0.5, 0.02, 0.3, 0.44, wall_h=0.28, rise=0.06, ridge_y=True)
    tb.fire_ring(ms, rng, 0.02, -0.32, r=0.08)
    w = tm.house_frame(0, 0, 0)
    for (cx, cy, s) in ((-0.62, -0.55, 0.075), (-0.54, -0.6, 0.065), (-0.62, -0.47, 0.06)):
        ms.box('md_wood', (s, s, s * 0.85), at=(cx, cy, G), rot_z=rng.uniform(-10, 10), lod=1, bevel=0.003)
    for k in range(5):
        ms.sphere('md_sandbag', 0.032, at=(-0.45 + (k % 3) * 0.05, -0.58 + (k // 3) * 0.05, G + 0.018 + (k // 3) * 0.012), scale=(1.4, 0.9, 0.55), u=7, v=4, lod=0)
    for k in range(3):
        ms.box('md_jerry', (0.03, 0.045, 0.06), at=(-0.31 + 0.035 * k, -0.6, G), lod=0, bevel=0.004)
    for k in range(6):  # steel pipes stacked on timber bearers
        ms.cyl('md_steel', 0.014, 0.014, 0.3, at=(0.36 + (k % 3) * 0.03, -0.62, G + 0.03 + (k // 3) * 0.026), rot=(-90, 0, 0), segs=6, lod=0 if k > 2 else 1)
    for k in range(4):
        ms.box('md_wood', (0.12, 0.3, 0.012), at=(0.6, -0.47, G + 0.012 * k), lod=1 if k == 0 else 0)
    chain_fence(ms, [(-0.88, -0.55), (-0.88, 0.78), (0.86, 0.78)])
    flag = tm.house_frame(0.76, -0.62, 0)
    flagpole(ms, flag, 0, 0, 0.4 * RAISE)


# ---- the shared file: fields --------------------------------------------------------------------


def pipe(ms, pts, r=0.01, z=G + 0.012, mat='md_steel', lod=1):
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        rod(ms, mat, (x0, y0, z), (x1, y1, z), r, segs=6, lod=lod)


def field_1(ms, rng):
    """`field-1` (16 by 12 m): six long beds of ripe wheat (0.9 m) on tilled soil, an irrigation
    pipe with two sprinklers along the north edge."""
    for i in range(6):
        y = 0.43 - 0.165 * i
        hh = rng.uniform(0.085, 0.095)
        ms.box('md_soil', (1.48, 0.15, 0.008), at=(0, y, G), lod=1)
        ms.box('md_wheat', (1.42, 0.12, hh * 0.75), at=(0, y, G), lod=0, taper=0.97)
        ms.box('md_wheat', (1.4, 0.11, hh * 0.3), at=(0, y, G + hh * 0.72), lod=0, taper=0.6)
        ms.add(tb._block('md_wheat', 0, y, 1.42, 0.12, hh), 'md_wheat', 2, only=(1, 2))
    pipe(ms, [(-0.72, 0.55), (0.72, 0.55)], r=0.009)
    rod(ms, 'md_steel', (-0.74, 0.55, G + 0.012), (-0.72, 0.55, G + 0.012), 0.014, segs=6, lod=0)
    for sx in (-0.33, 0.33):
        ms.cyl('md_steel', 0.005, 0.005, 0.08, at=(sx, 0.55, G + 0.012), segs=5, lod=0)
        ms.box('md_pipe', (0.04, 0.012, 0.012), at=(sx, 0.55, G + 0.09), lod=0)


def apple_tree(ms, rng, x, y, top=0.25, r=0.1):
    ms.cyl('md_mulch', 0.14, 0.13, 0.006, at=(x, y, G), segs=12, lod=1)
    ms.cyl('timber', 0.014, 0.01, top * 0.5, at=(x, y, G), segs=6, lod=1)
    ms.cyl('md_wood', 0.004, 0.004, top * 0.55, at=(x + 0.03, y - 0.02, G), segs=4, lod=0)  # the stake
    cz = top - r
    ms.sphere('md_apple', r, at=(x, y, cz), scale=(1.05, 1.05, 0.95), u=9, v=6, lod=0)
    for k in range(4):
        a = k * math.pi / 2 + rng.uniform(-0.4, 0.4)
        ms.sphere('md_apple', r * 0.66, at=(x + 0.07 * math.cos(a), y + 0.07 * math.sin(a), cz - 0.02), u=7, v=5, lod=0)
    ms.sphere('md_apple', r * 1.1, at=(x, y, cz), u=7, v=4, lod=1, only=1)
    ms.cyl('md_apple', r * 1.15, r * 0.5, r * 1.6, at=(x, y, cz - r * 0.75), segs=5, lod=2, only=2)


def field_2(ms, rng):
    """`field-2` (16 by 12 m): an apple orchard, two rows of three trees (2.5 m) on mulched
    circles, a trodden path between the rows, a black drip line from a valve at the north-west."""
    rect(ms, 'earth', -0.78, -0.07, 0.78, 0.05, G + 0.002, lod=1)
    for y in (0.3, -0.3):
        for x in (-0.48, 0.0, 0.48):
            apple_tree(ms, rng, x + rng.uniform(-0.015, 0.015), y + rng.uniform(-0.015, 0.015), top=rng.uniform(0.24, 0.26))
    pipe(ms, [(-0.68, 0.52), (-0.68, -0.3), (0.62, -0.3)], r=0.007, z=G + 0.008, mat='md_pipe', lod=1)
    pipe(ms, [(-0.68, 0.3), (0.62, 0.3)], r=0.007, z=G + 0.008, mat='md_pipe', lod=1)
    ms.cyl('md_steel', 0.018, 0.018, 0.07, at=(-0.68, 0.52, G), segs=8, lod=0)


def field_3(ms, rng):
    """`field-3` (16 by 12 m): a pasture behind a galvanised steel fence (posts and four rails), a
    tube gate at the south, a round steel water trough on a concrete pad at the north-west fed by
    a pipe, a trodden path from the gate."""
    x0, x1, y0, y1 = -0.76, 0.76, -0.54, 0.54
    flat(ms, 'earth', [(0.05, y0 + 0.01), (0.17, y0 + 0.01), (0.12, -0.2), (0.08, 0.0), (0.03, -0.2)], G + 0.002, lod=1)
    gx0, gx1 = -0.02, 0.24
    runs = [((gx1, y0), (x1, y0)), ((x1, y0), (x1, y1)), ((x1, y1), (x0, y1)), ((x0, y1), (x0, y0)), ((x0, y0), (gx0, y0))]
    for (ax, ay), (bx, by) in runs:
        length = math.hypot(bx - ax, by - ay)
        n = max(1, round(length / 0.24))
        for i in range(n + 1):
            px, py = ax + (bx - ax) * i / n, ay + (by - ay) * i / n
            ms.cyl('md_steel', 0.008, 0.008, 0.13, at=(px, py, G - 0.005), segs=6, lod=1)
        yaw = math.degrees(math.atan2(by - ay, bx - ax))
        for k, zr in enumerate((0.035, 0.065, 0.095, 0.12)):
            ms.box('md_steel', (length, 0.005, 0.005), at=((ax + bx) / 2, (ay + by) / 2, G + zr), rot_z=yaw, lod=1 if k in (1, 3) else 0)
    for px in (gx0, gx1):
        ms.cyl('md_steel', 0.012, 0.012, 0.14, at=(px, y0, G - 0.005), segs=6, lod=1)
    for k, zr in enumerate((0.03, 0.06, 0.09, 0.12)):
        ms.box('md_steel', (gx1 - gx0 - 0.02, 0.006, 0.006), at=((gx0 + gx1) / 2, y0, G + zr), lod=1 if k in (0, 3) else 0)
    ms.box('md_concrete', (0.26, 0.2, 0.012), at=(-0.55, 0.38, G), lod=1)
    ms.cyl('md_steel', 0.075, 0.075, 0.06, at=(-0.55, 0.39, G + 0.012), segs=16, lod=2)
    ms.cyl('water', 0.068, 0.068, 0.004, at=(-0.55, 0.39, G + 0.068), segs=16, lod=1)
    pipe(ms, [(-0.74, 0.5), (-0.66, 0.5), (-0.66, 0.42), (-0.62, 0.42)], r=0.006, z=G + 0.04, mat='md_pipe', lod=0)


def polytunnel(ms, x, y, w=0.4, length=1.0, h=0.22, n=12):
    """A polythene tunnel: a half-round hoop house (sheet: 4 by 10 m, 2.2 m), ends with a door
    opening, crops visible inside the doorway."""
    bm = bmesh.new()
    rows = []
    for j in range(2):
        yy = y - length / 2 + length * j
        rows.append([bm.verts.new((x + (w / 2) * math.cos(math.pi * i / n), yy, G + h * math.sin(math.pi * i / n))) for i in range(n + 1)])
    for i in range(n):
        bm.faces.new((rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.x < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    ms.add(bm, 'md_poly', 2)
    for j, sgn in ((0, -1), (1, 1)):  # the end walls
        yy = y - length / 2 + length * j
        bm = bmesh.new()
        vs = [bm.verts.new((x + (w / 2) * math.cos(math.pi * i / n), yy, G + h * math.sin(math.pi * i / n))) for i in range(n + 1)]
        f = bm.faces.new(vs)
        bm.normal_update()
        if f.normal.y * sgn < 0:
            bmesh.ops.reverse_faces(bm, faces=[f])
        ms.add(bm, 'md_poly', 2)
        ms.box('dark', (w * 0.4, 0.01, h * 0.75), at=(x, yy + sgn * 0.004, G), lod=1)
    for k in range(7):  # hoops
        yy = y - length / 2 + 0.02 + (length - 0.04) * k / 6
        tb_prof = [(w / 2 + 0.003, 0)]
        bm = bmesh.new()
        ring = [(x + (w / 2 + 0.003) * math.cos(math.pi * i / n), G + (h + 0.003) * math.sin(math.pi * i / n)) for i in range(n + 1)]
        vs = [(bm.verts.new((px, yy - 0.004, pz)), bm.verts.new((px, yy + 0.004, pz))) for px, pz in ring]
        for (a0, a1), (b0, b1) in zip(vs, vs[1:]):
            bm.faces.new((a0, a1, b1, b0))
        bm.normal_update()
        bm.faces.ensure_lookup_table()
        if bm.faces[n // 2].normal.z < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
        ms.add(bm, 'md_steel', 0)
        del tb_prof
    ms.box('md_wood', (w + 0.02, length + 0.02, 0.012), at=(x, y, G), lod=1)


def field_4(ms, rng):
    """`field-4` (16 by 12 m): a market garden: two polythene tunnels (4 by 10 m, 2.2 m), beds of
    cabbage, lettuce and red lettuce in front of them, a gravel path between, an irrigation main
    with a tee along the north."""
    for x in (-0.32, 0.32):
        polytunnel(ms, x, 0.12, w=0.36, length=0.78)
        for i in range(4):  # beds at the front
            bx = x - 0.14 + 0.095 * i
            mat = 'md_veg_red' if i == 3 else 'md_veg'
            ms.box('md_soil', (0.07, 0.16, 0.01), at=(bx, -0.4, G), lod=1)
            for k in range(3):
                ms.sphere(mat, 0.022, at=(bx, -0.45 + 0.05 * k, G + 0.016), scale=(1, 1, 0.65), u=6, v=4, lod=0)
            obox(ms, mat, (0.05, 0.14, 0.02), at=(bx, -0.4, G + 0.005), lod=1, only=1)
    rect(ms, 'md_gravel', -0.05, -0.52, 0.05, 0.5, G + 0.002, lod=1)
    for sx in (-1, 1):
        rect(ms, 'md_soil', sx * 0.56 - 0.08, -0.5, sx * 0.56 + 0.08, 0.5, G + 0.002, lod=1)
    pipe(ms, [(-0.6, 0.56), (0.6, 0.56)], r=0.012, z=G + 0.015, mat='md_pipe')
    pipe(ms, [(0.0, 0.56), (0.0, 0.48)], r=0.012, z=G + 0.015, mat='md_pipe')
