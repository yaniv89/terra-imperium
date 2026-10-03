# scripts/blender/ti_kingdoms.py
# The Kingdoms Age kit, variant a: the European medieval village (art spec section 3, kingdoms;
# plans/art/towns/kingdoms/town-small-a/reference-sheet.png): half-timbered houses of cream lime
# plaster in a dark oak frame on grey rubble-stone footings, steep slate or straw-thatch roofs
# with stone chimneys, a small stone church with a spire, cobbled ground. Scale as the other
# kits: 1 unit = 10 m, houses raised 1.3x, landmarks at the sheets' heights.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Matrix  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
from ti_town import G, STOREY  # noqa: E402

NEW = ['rubble', 'slate', 'lime', 'cobble', 'cobble_fringe', 'cobble_square']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
tt.TO_FINAL.update({'cobble': 'Ground', 'cobble_fringe': 'Ground', 'cobble_square': 'Ground'})
if 'cobble_fringe' not in tt.FRINGES:
    tt.FRINGES.append('cobble_fringe')


def make_materials():
    tm.mat_mudwall('rubble', wash='#9a948a', brick='#8f8a80', brick2='#77726a', mortar='#5e5a54', wash_cover=0.0,
                   bond=(0.05, 0.03, 0.006))
    tm.mat_mudwall('slate', wash='#4a5260', brick='#4b5463', brick2='#3b4250', mortar='#262b33', wash_cover=0.0,
                   bond=(0.022, 0.011, 0.002))
    tm.mat_simple('lime', ['#e3d9c2', '#ece4d2', '#d8ccb0', '#efe8d8'], scale=18.0, bump=0.25, dirt=True)
    for n in ('cobble', 'cobble_fringe'):
        tc.mat_paving(n, stone=('#a19c92', '#8d887e', '#b1aca2'), mortar='#605c55', slab=(0.022, 0.018))
    tc.mat_paving('cobble_square', stone=('#97928a', '#86817a', '#a7a29a'), mortar='#5c5852', slab=(0.03, 0.03))


if not any(n == 'kingdoms' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('kingdoms', make_materials))

COBBLED = dict(mat='cobble', power=8)


def timber_frame(ms, f, w, d, z0, h, step=0.13, lod_detail=0):
    """Dark oak framing on a block's four faces: corner posts, sill, mid rail and wall plate, studs
    and corner braces on the long faces."""
    t = 0.016
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.026, 0.026, h), at=(sx * (w / 2 - 0.004), sy * (d / 2 - 0.004), z0), lod=1, frame=f)
    for sy in (-1, 1):
        y = sy * (d / 2 + 0.003)
        for zz in (0.0, h * 0.48, h - t):
            ms.box('timber', (w, 0.008, t), at=(0, y, z0 + zz), lod=1 if zz else lod_detail, frame=f)
        n = max(2, int(w / step))
        for i in range(1, n):
            ms.box('timber', (t * 0.9, 0.008, h), at=(-w / 2 + w * i / n, y, z0), lod=lod_detail, frame=f)
        for sx in (-1, 1):  # braces from the sill to the corner posts
            length = math.hypot(w / n, h * 0.48)
            ang = math.atan2(h * 0.48, w / n) * -sx
            bf = f @ Matrix.Translation((sx * (w / 2 - w / n / 2), y, z0 + h * 0.24)) @ Matrix.Rotation(ang, 4, 'Y')
            ms.box('timber', (length, 0.008, t * 0.9), at=(0, 0, -t * 0.45), lod=lod_detail, frame=bf)
    for sx in (-1, 1):
        x = sx * (w / 2 + 0.003)
        for zz in (h * 0.48, h - t):
            ms.box('timber', (0.008, d, t), at=(x, 0, z0 + zz), lod=lod_detail, frame=f)
        ms.box('timber', (0.008, t * 0.9, h), at=(x, 0, z0), lod=lod_detail, frame=f)


def tudor_house(ms, rng, x, y, w, d, yaw=None, roof='slate', rise=0.38, storeys=1, awning_w=None, chimneys=1,
                hipped=False, jar_n=0):
    """A half-timbered house: a rubble-stone footing, lime plaster in an oak frame, small windows
    with shutters, a plank door, a steep slate or thatch gable (or hipped thatch) roof, chimneys."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    base = 0.09
    h = STOREY * storeys
    ms.box('rubble', (w + 0.02, d + 0.02, base), at=(0, 0, G), lod=2, frame=f)
    ms.box('lime', (w, d, h - base), at=(0, 0, G + base), lod=2, frame=f)
    timber_frame(ms, f, w, d, G + base, h - base)
    z = G + h
    if hipped:
        tc.hip_roof(ms, f, w, d, z, rise, over=0.05, curl=0.0, mat=roof, ornaments=False)
    else:
        tc.gable_roof(ms, f, w, d, z, rise, over=0.04, mat=roof, gable='lime', thick=0.035 if roof == 'thatch' else 0.022,
                      ridge='rubble' if roof == 'slate' else 'thatch')
        # the gables are framed too: a king post
        for sx in (-1, 1):
            ms.box('timber', (0.008, 0.016, rise * 0.9), at=(sx * (w / 2 + 0.004), 0, z), lod=0, frame=f)
    for k in range(chimneys):
        cx = (-w * 0.3 if k == 0 else w * 0.3)
        ms.box('rubble', (0.07, 0.07, rise + 0.12), at=(cx, d * 0.12, z), lod=1, frame=f)
    door = -w * 0.18
    ms.box('door', (0.09, 0.012, 0.2), at=(door, -d / 2 - 0.008, G + 0.02), lod=1, frame=f)
    ms.box('rubble', (0.13, 0.05, 0.02), at=(door, -d / 2 - 0.03, G), lod=0, frame=f)
    for wx in (w * 0.15, w * 0.36):
        ms.box('dark', (0.055, 0.01, 0.06), at=(wx, -d / 2 - 0.006, G + 0.2), lod=0, frame=f)
        ms.box('timber', (0.03, 0.008, 0.065), at=(wx + 0.045, -d / 2 - 0.009, G + 0.198), lod=0, frame=f)
    if awning_w:
        tc.awning(ms, f, w * 0.2, -d / 2 - 0.01, awning_w, depth=0.2, z=0.26)
    if jar_n:  # barrels and crates by the door
        for i in range(jar_n):
            ms.cyl('timber', 0.022, 0.024, 0.055, at=(door - 0.1 - 0.05 * i, -d / 2 - 0.05, G), segs=8, lod=0, frame=f)
    return f


def church(ms, rng, x, y, top=1.0, yaw=None):
    """A small stone church: a rubble nave with a slate roof and lancet windows, a square west tower
    with a slate spire and a cross (`top` is the cross tip), an arched door in the tower."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    nw, nd, nh = 0.42, 0.72, 0.36
    ms.box('rubble', (nw, nd, nh), at=(0, 0.12, G), lod=2, frame=f)
    rf = f @ Matrix.Translation((0, 0.12, 0)) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rf, nd, nw, G + nh, 0.24, over=0.03, mat='slate', gable='rubble', ridge='rubble')
    for k in range(3):
        for sx in (-1, 1):
            ms.box('dark', (0.01, 0.04, 0.11), at=(sx * (nw / 2 + 0.004), -0.1 + 0.2 * k + 0.12, G + 0.14), lod=0, frame=f)
    tw = 0.28
    ty = -nd / 2 + 0.12 - tw / 2 + 0.02
    th = 0.62
    ms.box('rubble', (tw, tw, th), at=(0, ty, G), lod=2, frame=f, bevel=0.004)
    ms.box('door', (0.09, 0.012, 0.17), at=(0, ty - tw / 2 - 0.004, G), lod=1, frame=f)
    ms.box('dark', (0.04, 0.01, 0.09), at=(0, ty - tw / 2 - 0.004, G + 0.38), lod=0, frame=f)
    spire = top - G - th - 0.08
    ms.cyl('slate', tw * 0.72, 0.0, spire, at=(0, ty, G + th), rot=(0, 0, 45), segs=4, lod=2, frame=f)
    ms.box('timber', (0.008, 0.008, 0.08), at=(0, ty, G + th + spire - 0.01), lod=0, frame=f)
    ms.box('timber', (0.05, 0.008, 0.008), at=(0, ty, G + th + spire + 0.04), lod=0, frame=f)
    return f


# =================================================================================================
# The rest of the Kingdoms kit (plans/art/towns/kingdoms/<id>/reference-sheet.png): bigger
# half-timbered houses and a hall, a gothic church, a stone keep and round corner towers for the
# European towns (variant a); flat-roofed courtyard houses, mosques with a dome and a square
# minaret, horseshoe arcades, palms and fountains for the Abbasid / Andalusian towns (variant b);
# the motte palace and the stone keep palace, stone curtain rings with round towers, the camp and
# the fields of the shared file. Every new material carries the `kg_` prefix.
import bmesh  # noqa: E402
import ti_bronze as tb  # noqa: E402
from mathutils import Vector  # noqa: E402

KG = ['kg_ringstone', 'kg_ochre', 'kg_whitewash', 'kg_dome', 'kg_stone', 'kg_wallstone', 'kg_shingle', 'kg_planks', 'kg_turf',
      'kg_rye', 'kg_apple', 'kg_wattle', 'kg_palm', 'kg_palmtrunk', 'kg_iron', 'kg_flag', 'kg_garden',
      'kg_sand', 'kg_sand_fringe', 'kg_sand_square', 'kg_soil', 'kg_soil_fringe', 'kg_soil_square',
      'kg_meadow', 'kg_meadow_fringe', 'kg_meadow_square']
for _n in KG:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
for _g in ('kg_sand', 'kg_soil', 'kg_meadow'):
    tt.TO_FINAL.update({_g: 'Ground', _g + '_fringe': 'Ground', _g + '_square': 'Ground'})
    if _g + '_fringe' not in tt.FRINGES:
        tt.FRINGES.append(_g + '_fringe')


def mat_fruit_leaf(name):
    """Apple-tree leaves: a leafy green noise with red and yellow fruit dots (a Voronoi cell mask)."""
    mat = tm.mat_simple(name, ['#24401c', '#3a5e26', '#4f7a30', '#335424'], scale=40.0, bump=0.6)
    nt = mat.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    leaf = bsdf.inputs['Base Color'].links[0].from_socket
    coord = nt.nodes.new('ShaderNodeTexCoord')
    vor = nt.nodes.new('ShaderNodeTexVoronoi')
    vor.inputs['Scale'].default_value = 26.0
    nt.links.new(coord.outputs['Object'], vor.inputs['Vector'])
    dots = tm._ramp(nt, vor.outputs['Distance'], [(0.0, '#ffffff'), (0.27, '#ffffff'), (0.31, '#000000')])
    pick = tm._ramp(nt, vor.outputs['Color'], [(0.0, '#a8231c'), (0.55, '#b8321e'), (0.62, '#d6b23a'), (1.0, '#c9a432')])
    col = tm._mix(nt, dots.outputs['Color'], leaf, pick.outputs['Color'])
    nt.links.new(col, bsdf.inputs['Base Color'])
    return mat


def mat_ringstone(name, stone=('#6e6b66', '#56534e'), mortar='#7d786f', bond=(0.045, 0.024, 0.0032)):
    """Masonry for walls swept round the origin: the brick bond laid on (arc length, z), so the
    courses run evenly round a ring wall (an (x + y, z) bond smears into bands on a curve)."""
    import bpy
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    tco = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tco.outputs['Object'], sep.inputs['Vector'])
    at2 = nt.nodes.new('ShaderNodeMath')
    at2.operation = 'ARCTAN2'
    nt.links.new(sep.outputs['Y'], at2.inputs[0])
    nt.links.new(sep.outputs['X'], at2.inputs[1])
    flat = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(sep.outputs['X'], flat.inputs['X'])
    nt.links.new(sep.outputs['Y'], flat.inputs['Y'])
    ln = nt.nodes.new('ShaderNodeVectorMath')
    ln.operation = 'LENGTH'
    nt.links.new(flat.outputs['Vector'], ln.inputs[0])
    arc = nt.nodes.new('ShaderNodeMath')
    arc.operation = 'MULTIPLY'
    nt.links.new(at2.outputs[0], arc.inputs[0])
    nt.links.new(ln.outputs['Value'], arc.inputs[1])
    comb = nt.nodes.new('ShaderNodeCombineXYZ')
    nt.links.new(arc.outputs[0], comb.inputs['X'])
    nt.links.new(sep.outputs['Z'], comb.inputs['Y'])
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = bond[0]
    br.inputs['Row Height'].default_value = bond[1]
    br.inputs['Mortar Size'].default_value = bond[2]
    br.inputs['Color1'].default_value = tm._srgb(stone[0])
    br.inputs['Color2'].default_value = tm._srgb(stone[1])
    br.inputs['Mortar'].default_value = tm._srgb(mortar)
    br.offset = 0.5
    nt.links.new(comb.outputs['Vector'], br.inputs['Vector'])
    n = tm._noise(nt, 30.0, 5.0, 0.6)
    tint = tm._ramp(nt, n.outputs['Fac'], [(0.3, '#8a857c'), (0.7, '#6a665f')])
    col = tm._mix(nt, 0.3, br.outputs['Color'], tint.outputs['Color'], 'OVERLAY')
    col = tm._base_dirt(nt, col)
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.92
    tm._bump(nt, bsdf, br.outputs['Fac'], 0.35, 0.004)
    return mat


def make_materials_kg():
    mat_ringstone('kg_ringstone')
    tm.mat_simple('kg_ochre', ['#cfae7c', '#dcbf90', '#c49d68', '#e3cca2'], scale=16.0, bump=0.25, dirt=True)
    tm.mat_simple('kg_whitewash', ['#e1d9c6', '#ebe5d6', '#d6ccb4', '#efe9dc'], scale=18.0, bump=0.2, dirt=True)
    tm.mat_simple('kg_dome', ['#e6e1d6', '#f0ece4', '#d9d3c6'], scale=12.0, bump=0.15)
    tm.mat_mudwall('kg_stone', wash='#b8ab92', brick='#b3a78f', brick2='#9d917b', mortar='#7a7062', wash_cover=0.0,
                   bond=(0.06, 0.03, 0.004))
    # the castle and wall masonry: grey stones in pale lime mortar
    tm.mat_mudwall('kg_wallstone', wash='#7a766f', brick='#6e6b66', brick2='#56534e', mortar='#7d786f', wash_cover=0.0,
                   bond=(0.045, 0.024, 0.0032))
    tm.mat_simple('kg_shingle', ['#5a4e40', '#74675a', '#4c4136', '#6a6050'], scale=40.0,
                  stripes={'dir': 'Z', 'scale': 140.0, 'distortion': 1.5}, bump=0.6)
    tm.mat_mudwall('kg_planks', wash='#4e3e2e', brick='#54432f', brick2='#47392a', mortar='#2a2018', wash_cover=0.0,
                   bond=(0.022, 2.0, 0.0022))
    tm.mat_earth('kg_turf', colors=('#3f5a22', '#55702c', '#7a6a40', '#4a6526'))
    tm.mat_simple('kg_rye', ['#8a6a2a', '#c09a48', '#dcbc66', '#a8843a'], scale=60.0, stripes={'dir': 'X', 'scale': 260.0, 'distortion': 14.0}, bump=0.8)
    mat_fruit_leaf('kg_apple')
    tm.mat_simple('kg_wattle', ['#5a4430', '#7a5c3e', '#4a3826'], scale=20.0, stripes={'dir': 'Z', 'scale': 240.0, 'distortion': 5.0}, bump=0.6)
    tm.mat_simple('kg_palm', ['#34501f', '#4c6e2a', '#62853a', '#40602a'], scale=50.0, stripes={'dir': 'X', 'scale': 300.0, 'distortion': 4.0}, bump=0.5)
    tm.mat_simple('kg_palmtrunk', ['#6c563e', '#86704f', '#5a4834'], scale=12.0, stripes={'dir': 'Z', 'scale': 220.0, 'distortion': 2.0}, bump=0.6)
    tm.mat_simple('kg_iron', ['#26262a', '#3a3a40', '#2e2e33'], scale=30.0, rough=0.5, metal=0.6, bump=0.2)
    tm.mat_simple('kg_flag', ['#8d877c', '#9f998d', '#7f796f'], scale=30.0, bump=0.35)
    tm.mat_simple('kg_garden', ['#3c5a24', '#58782e', '#6e5a36', '#4a6a28'], scale=70.0, stripes={'dir': 'X', 'scale': 200.0, 'distortion': 3.0}, bump=0.6)
    sand = ('#c4b496', '#b3a383', '#d0c2a6')
    for n in ('kg_sand', 'kg_sand_fringe'):
        tc.mat_paving(n, stone=sand, mortar='#8a7a5e', slab=(0.045, 0.034))
    tc.mat_paving('kg_sand_square', stone=('#d3c6aa', '#c4b597', '#ddd1b8'), mortar='#9a8a6c', slab=(0.08, 0.08))
    soil = ('#6f5034', '#86613f', '#94704a', '#644830')  # the fields' darker tilled earth
    for n in ('kg_soil', 'kg_soil_fringe'):
        tm.mat_earth(n, colors=soil)
    tm.mat_earth('kg_soil_square', colors=('#9a7a52', '#a8885e', '#b09066', '#94744c'))  # trodden paths
    meadow = ('#4f6c26', '#66822e', '#7c8a3c', '#587426')  # the orchard's and pasture's grass
    for n in ('kg_meadow', 'kg_meadow_fringe'):
        tm.mat_earth(n, colors=meadow)
    tm.mat_earth('kg_meadow_square', colors=('#8a7048', '#9a7c50', '#a48658', '#86694a'))


if not any(n == 'kingdoms_kg' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('kingdoms_kg', make_materials_kg))

SANDY = dict(mat='kg_sand', power=8)


# ---- small helpers -----------------------------------------------------------------------------

def box_only(ms, only, mat, size, **kw):
    """Mesher.box shown only at the LOD(s) in `only` (an int or a tuple)."""
    lod = max(only) if isinstance(only, tuple) else only
    ms.box(mat, size, lod=lod, **kw)
    bm, m, lo, _ = ms.parts[-1]
    ms.parts[-1] = (bm, m, lo, only)


def lod2_block(ms, f, w, d, h, rise=0.0, z0=G, x=0.0, y=0.0, mat='lime'):
    """The LOD2 stand-in of a building: a bottomless box (10 triangles), or with `rise` a gable
    prism with its ridge along local X (14 triangles). The atlas UVs come from the nearest LOD0
    surface, so one material is enough."""
    bm = bmesh.new()
    hw, hd = w / 2, d / 2
    b = [bm.verts.new((x + px, y + py, z0)) for px, py in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))]
    t = [bm.verts.new((v.co.x, v.co.y, z0 + h)) for v in b]
    if rise <= 0:
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((b[i], b[j], t[j], t[i]))
        bm.faces.new(t)
    else:
        r0, r1 = bm.verts.new((x - hw, y, z0 + h + rise)), bm.verts.new((x + hw, y, z0 + h + rise))
        bm.faces.new((b[0], b[1], t[1], t[0]))
        bm.faces.new((b[2], b[3], t[3], t[2]))
        bm.faces.new((b[1], b[2], t[2], r1, t[1]))
        bm.faces.new((b[3], b[0], t[0], r0, t[3]))
        bm.faces.new((t[0], t[1], r1, r0))
        bm.faces.new((t[2], t[3], r0, r1))
    ms.add(bm, mat, 2, matrix=f, only=2)


def lathe2(ms, mat, profile, at=(0, 0, 0), segs=10, lod=0, only=None, frame=None):
    """ti_map's lathe with `only` (a surface of revolution from [(r, z)...], capped)."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * i / segs), r * math.sin(2 * math.pi * i / segs), z)) for i in range(segs)])
    for a, b in zip(rings, rings[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    m = tm.Mesher._m(at)
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, lod, matrix=m, only=only)


def arc_pts(cx, a, zj, n=8, horseshoe=True, a0=None, a1=None):
    """Points of an arch over an opening of half-width a whose jambs stop at zj: a horseshoe (the
    circle runs on past the springing, 1.15 x wider than the opening) or a round arch. Angles run
    from a0 to a1 (degrees, 0 to the right); default the whole arch from the right jamb round to
    the left one."""
    if horseshoe:
        R = a / math.cos(math.radians(30))
        zs = zj + R * 0.5
        lo, hi = -30.0, 210.0
    else:
        R, zs, lo, hi = a, zj, 0.0, 180.0
    a0 = lo if a0 is None else a0
    a1 = hi if a1 is None else a1
    return [(cx + R * math.cos(math.radians(a0 + (a1 - a0) * i / n)), zs + R * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)], zs + R


def arch_face(ms, f, mat, cx, y, z0, a, zj, lod=0, horseshoe=True, n=8, only=None):
    """A flat arched opening (door, window or a dark arcade bay) on the local y plane, facing -Y."""
    pts, _top = arc_pts(cx, a, zj, n, horseshoe)
    bm = bmesh.new()
    vs = [bm.verts.new((cx - a, y, z0)), bm.verts.new((cx + a, y, z0))]
    vs += [bm.verts.new((px, y, z0 + pz)) for px, pz in pts]
    bm.faces.new(vs)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    if bm.faces[0].normal.y > 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    ms.add(bm, mat, lod, matrix=f, only=only)


def arcade(ms, f, mat, x0, x1, y, z0, h, bays, a_frac=0.36, zj_frac=0.5, depth=0.04, lod=0, horseshoe=True, back='dark'):
    """A facade of `bays` arches from x0 to x1 (local frame, facing -Y), height h: pier-and-spandrel
    pieces extruded `depth` toward +Y, the openings dark behind them."""
    span = (x1 - x0) / bays
    a = span * a_frac
    zj = h * zj_frac
    n = 6
    pieces = []
    for i in range(bays + 1):
        pts = []
        if i == 0:
            pts.append((x0, 0.0))
        else:
            c = x0 + span * (i - 0.5)
            pts.append((c + a, 0.0))
        if i == bays:
            pts += [(x1, 0.0), (x1, h)]
        else:
            c1 = x0 + span * (i + 0.5)
            arc, _t = arc_pts(c1, a, zj, n, horseshoe, a0=210.0 if horseshoe else 180.0, a1=90.0)
            pts += [(c1 - a, 0.0)] + arc + [(c1, h)]
        if i == 0:
            pts.append((x0, h))
        else:
            c = x0 + span * (i - 0.5)
            arc, _t = arc_pts(c, a, zj, n, horseshoe, a0=90.0, a1=-30.0 if horseshoe else 0.0)
            pts += [(c, h)] + arc
        pieces.append(pts)
    for pts in pieces:
        bm = bmesh.new()
        clean = []
        for p in pts:
            if not clean or (abs(p[0] - clean[-1][0]) > 1e-5 or abs(p[1] - clean[-1][1]) > 1e-5):
                clean.append(p)
        if abs(clean[0][0] - clean[-1][0]) < 1e-5 and abs(clean[0][1] - clean[-1][1]) < 1e-5:
            clean.pop()
        face = bm.faces.new([bm.verts.new((px, y, z0 + pz)) for px, pz in clean])
        res = bmesh.ops.extrude_face_region(bm, geom=[face])
        moved = [g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)]
        bmesh.ops.translate(bm, vec=(0, depth, 0), verts=moved)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed slab: safe to orient
        ms.add(bm, mat, lod, matrix=f)
    if back:
        ms.box(back, (x1 - x0 - 0.01, 0.006, h * 0.98), at=((x0 + x1) / 2, y + depth + 0.03, z0), lod=lod, frame=f)


def tree(ms, x, y, h=0.4, r=0.13, mat='shrub', lod2=True):
    """A round-crowned broadleaf tree: LOD0 a trunk and a crown of four lumps, LOD1 one crown,
    LOD2 a four-sided cone (4 triangles) when `lod2`."""
    ms.cyl('timber', 0.016, 0.011, h * 0.5, at=(x, y, G), segs=6, lod=1)
    ms.sphere(mat, r, at=(x, y, G + h - r * 0.85), scale=(1, 1, 0.85), u=9, v=6, lod=0)
    for k in range(3):
        a = 2.1 * k + x * 7.0
        ms.sphere(mat, r * 0.62, at=(x + r * 0.55 * math.cos(a), y + r * 0.55 * math.sin(a), G + h - r * 1.25), u=7, v=5, lod=0)
    ms.sphere(mat, r * 1.05, at=(x, y, G + h - r * 0.95), scale=(1, 1, 0.9), u=7, v=4, lod=1, only=1)
    if lod2:
        ms.cyl(mat, r * 1.05, 0.0, h - 0.06, at=(x, y, G + 0.04), segs=4, lod=2, only=2, caps=False)


def conifer(ms, x, y, h=0.45, r=0.09, lod2=True):
    ms.cyl('timber', 0.012, 0.01, 0.06, at=(x, y, G), segs=5, lod=0)
    ms.cyl('cypress', r, 0.0, h * 0.62, at=(x, y, G + 0.04), segs=8, lod=0)
    ms.cyl('cypress', r * 0.75, 0.0, h * 0.55, at=(x, y, G + h * 0.42), segs=8, lod=0)
    ms.cyl('cypress', r, 0.0, h - 0.04, at=(x, y, G + 0.04), segs=6, lod=1, only=1, caps=False)
    if lod2:
        ms.cyl('cypress', r, 0.0, h - 0.04, at=(x, y, G + 0.04), segs=4, lod=2, only=2, caps=False)


def palm(ms, rng, x, y, h=0.5, fronds=8, lod2=False):
    """A date palm: a ringed trunk leaning a little, a crown of drooping fronds (LOD0), a crown
    cone at LOD1."""
    lean = rng.uniform(-7, 7), rng.uniform(-7, 7)
    f = tm.Matrix.Translation(Vector((x, y, G))) @ tm.Matrix.Rotation(math.radians(lean[0]), 4, 'X') @ tm.Matrix.Rotation(math.radians(lean[1]), 4, 'Y')
    ms.cyl('kg_palmtrunk', 0.02, 0.014, h, at=(0, 0, 0), segs=6, lod=1, frame=f)
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
    ms.add(bm, 'kg_palm', 0, matrix=f)
    ms.cyl('kg_palm', 0.15, 0.03, 0.07, at=(0, 0, h - 0.05), segs=7, lod=1, only=1, frame=f)
    if lod2:
        ms.cyl('kg_palm', 0.12, 0.0, h, at=(0, 0, 0.0), segs=4, lod=2, only=2, frame=f, caps=False)


def street(ms, pts, w, mat='cobble_square'):
    """A paved street along a polyline (lighter cobbles on the town's ground), LOD0 and LOD1: one
    strip with mitred joints (overlapping coplanar pieces would bake dark). A closed polyline
    (last point = first) makes a ring."""
    closed = len(pts) > 3 and abs(pts[0][0] - pts[-1][0]) < 1e-6 and abs(pts[0][1] - pts[-1][1]) < 1e-6
    p = pts[:-1] if closed else list(pts)
    n = len(p)

    def unit(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy)
        return dx / ln, dy / ln
    left = []
    for i in range(n):
        if closed or 0 < i < n - 1:
            d0 = unit(p[i - 1], p[i])
            d1 = unit(p[i], p[(i + 1) % n])
        elif i == 0:
            d0 = d1 = unit(p[0], p[1])
        else:
            d0 = d1 = unit(p[-2], p[-1])
        n0, n1 = (-d0[1], d0[0]), (-d1[1], d1[0])
        mx, my = n0[0] + n1[0], n0[1] + n1[1]
        ml = math.hypot(mx, my)
        mx, my = mx / ml, my / ml
        k = (w / 2) / max(0.3, mx * n1[0] + my * n1[1])
        left.append((mx * k, my * k))
    bm = bmesh.new()
    L = [bm.verts.new((p[i][0] + left[i][0], p[i][1] + left[i][1], G + 0.003)) for i in range(n)]
    R = [bm.verts.new((p[i][0] - left[i][0], p[i][1] - left[i][1], G + 0.003)) for i in range(n)]
    for i in range(n if closed else n - 1):
        j = (i + 1) % n
        bm.faces.new((R[i], R[j], L[j], L[i]))
    ms.add(bm, mat, 1)


def barrel(ms, f, x, y, z=G, s=1.0):
    ms.cyl('timber', 0.022 * s, 0.025 * s, 0.06 * s, at=(x, y, z), segs=8, lod=0, frame=f)


def market_stall(ms, rng, x, y, yaw=None, w=0.34, d=0.28, h=0.22):
    """A market stall under a peaked team-grey canopy: four posts, a counter with goods."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.014, 0.014, h), at=(sx * (w / 2 - 0.01), sy * (d / 2 - 0.01), G), lod=1, frame=f)
    rise = 0.07
    tc.gable_roof(ms, f, w, d, G + h, rise, over=0.03, mat='team_cloth', gable='team_cloth', thick=0.008, lod=1, ridge='timber')
    ms.box('timber', (w - 0.04, d * 0.4, 0.07), at=(0, -d * 0.2, G), lod=0, frame=f)
    for k in range(3):
        gx = -w / 2 + 0.07 + k * (w - 0.14) / 2
        r = rng.random()
        if r < 0.4:
            tt.basket(ms, f, gx, -d * 0.2, 0.8, z=G + 0.07)
        elif r < 0.7:
            barrel(ms, f, gx, -d * 0.2, z=G + 0.07, s=0.7)
        else:
            tt.crate(ms, f, gx, -d * 0.2, 0.7, rng.uniform(-20, 20), z=G + 0.07)
    lod2_block(ms, f, w, d, h, rise=rise, mat='team_cloth')
    return f


def stone_wall(ms, x0, y0, x1, y1, h=0.12, t=0.04, mat='kg_stone', lod=1):
    """A low dry-stone or plastered boundary wall from (x0, y0) to (x1, y1)."""
    length = math.hypot(x1 - x0, y1 - y0)
    yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
    ms.box(mat, (length, t, h), at=((x0 + x1) / 2, (y0 + y1) / 2, G), rot_z=yaw, lod=lod)


def wattle_fence(ms, pts, h=0.1, step=0.2, lod=1):
    """Posts with woven hurdles between them along a polyline."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        length = math.hypot(x1 - x0, y1 - y0)
        n = max(1, round(length / step))
        yaw = math.degrees(math.atan2(y1 - y0, x1 - x0))
        for i in range(n + 1):
            ms.cyl('log', 0.013, 0.011, h + 0.03, at=(x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n, G - 0.005), segs=6, lod=lod)
        ms.box('kg_wattle', (length, 0.012, h * 0.8), at=((x0 + x1) / 2, (y0 + y1) / 2, G + 0.015), rot_z=yaw, lod=lod)


def garden(ms, rng, x, y, w, d, yaw=0.0):
    """A kitchen garden: a few beds of greens with a wattle edge."""
    f = tm.house_frame(x, y, yaw)
    rows = max(2, int(w / 0.09))
    for r in range(rows):
        ms.box('kg_garden', (w / rows * 0.7, d * 0.9, rng.uniform(0.018, 0.03)), at=(-w / 2 + w * (r + 0.5) / rows, 0, G), lod=0, frame=f, taper=0.7)
    ms.box('mud', (w, d, 0.006), at=(0, 0, G), lod=1, frame=f)


# ---- variant a: the European town ------------------------------------------------------------

def frame_members(ms, f, w, d, z0, h, step=0.13, lod1=True):
    """Oak framing on a block (like timber_frame) with the LOD1 share kept small: corner posts and
    the wall plate on the two long faces show at LOD1 when `lod1`, the rest only at LOD0."""
    t = 0.016
    l1 = 1 if lod1 else 0
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.024, 0.024, h), at=(sx * (w / 2 - 0.004), sy * (d / 2 - 0.004), z0), lod=l1, frame=f)
    for sy in (-1, 1):
        y = sy * (d / 2 + 0.003)
        ms.box('timber', (w, 0.008, t), at=(0, y, z0 + h - t), lod=l1, frame=f)
        ms.box('timber', (w, 0.008, t), at=(0, y, z0 + h * 0.48), lod=0, frame=f)
        ms.box('timber', (w, 0.008, t), at=(0, y, z0), lod=0, frame=f)
        n = max(2, int(w / step))
        for i in range(1, n):
            ms.box('timber', (t * 0.9, 0.008, h), at=(-w / 2 + w * i / n, y, z0), lod=0, frame=f)
        for sx in (-1, 1):
            length = math.hypot(w / n, h * 0.48)
            ang = math.atan2(h * 0.48, w / n) * -sx
            bf = f @ Matrix.Translation((sx * (w / 2 - w / n / 2), y, z0 + h * 0.24)) @ Matrix.Rotation(ang, 4, 'Y')
            ms.box('timber', (length, 0.008, t * 0.9), at=(0, 0, -t * 0.45), lod=0, frame=bf)
    for sx in (-1, 1):
        x = sx * (w / 2 + 0.003)
        for zz in (h * 0.48, h - t):
            ms.box('timber', (0.008, d, t), at=(x, 0, z0 + zz), lod=0, frame=f)
        ms.box('timber', (0.008, t * 0.9, h), at=(x, 0, z0), lod=0, frame=f)


def town_house(ms, rng, x, y, w, d, yaw=None, storeys=1, roof='slate', rise=None, gable_front=False, jetty=True,
               chimneys=1, awning_w=None, barrels=0, dormer=False, lod1_frame=True, sign=False):
    """A half-timbered town house for the bigger towns: a rubble footing, lime plaster in an oak
    frame, an upper storey jettied out over the street, a steep slate or thatch gable roof (eaves
    or the gable to the street), chimneys, shuttered windows, a plank door, an optional dormer,
    team-grey awning, barrels. LOD1 keeps the blocks, roof and main posts; LOD2 one gable prism."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    base = 0.08
    jet = 0.03 if (jetty and storeys > 1) else 0.0
    rise = rise if rise is not None else (0.36 if roof == 'slate' else 0.4) * (1.0 if not gable_front else 1.15)
    ms.box('rubble', (w + 0.02, d + 0.02, base), at=(0, 0, G), lod=1, frame=f)
    ms.box('lime', (w, d, STOREY - base), at=(0, 0, G + base), lod=1, frame=f)
    frame_members(ms, f, w, d, G + base, STOREY - base, lod1=lod1_frame)
    z = G + STOREY
    uw, ud = w, d + 2 * jet
    if storeys > 1:
        ms.box('lime', (uw, ud, STOREY * 0.9), at=(0, 0, z), lod=1, frame=f)
        frame_members(ms, f, uw, ud, z, STOREY * 0.9, step=0.11, lod1=lod1_frame)
        if jet:
            for k in range(int(w / 0.09)):  # joist ends under the jetty
                ms.box('timber', (0.014, 0.03, 0.014), at=(-w / 2 + 0.045 + k * 0.09, -d / 2 - 0.012, z - 0.014), lod=0, frame=f)
        z += STOREY * 0.9
    thick = 0.035 if roof == 'thatch' else 0.022
    ridge = 'rubble' if roof == 'slate' else 'thatch'
    if gable_front:
        rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
        tc.gable_roof(ms, rf, ud, uw, z, rise, over=0.04, mat=roof, gable='lime', thick=thick, lod=1, ridge=ridge)
        ms.box('timber', (0.016, 0.008, rise * 0.85), at=(0, -ud / 2 - 0.004, z), lod=0, frame=f)
        ms.box('timber', (uw * 0.6, 0.008, 0.014), at=(0, -ud / 2 - 0.004, z + rise * 0.35), lod=0, frame=f)
        lod2_block(ms, rf, ud, uw, z - G, rise=rise, mat='lime')
    else:
        tc.gable_roof(ms, f, uw, ud, z, rise, over=0.04, mat=roof, gable='lime', thick=thick, lod=1, ridge=ridge)
        for sx in (-1, 1):
            ms.box('timber', (0.008, 0.016, rise * 0.85), at=(sx * (uw / 2 + 0.004), 0, z), lod=0, frame=f)
        lod2_block(ms, f, uw, ud, z - G, rise=rise, mat='lime')
        if dormer:
            dw = min(0.2, uw * 0.3)
            df = f @ Matrix.Translation((uw * 0.12, -ud * 0.22, z)) @ Matrix.Rotation(math.radians(90), 4, 'Z')
            ms.box('lime', (dw, 0.16, 0.12), at=(0, 0, 0), lod=0, frame=f @ Matrix.Translation((uw * 0.12, -ud * 0.22, z)))
            tc.gable_roof(ms, df, 0.2, dw, 0.12, 0.09, over=0.02, mat=roof, gable='lime', thick=thick, lod=0, ridge=ridge)
            ms.box('dark', (dw * 0.45, 0.008, 0.07), at=(uw * 0.12, -ud * 0.22 - 0.081, z + 0.025), lod=0, frame=f)
    for k in range(chimneys):
        cx = (-uw * 0.3 if k == 0 else uw * 0.3) if not gable_front else 0.0
        cy = ud * 0.15 if not gable_front else (ud * 0.3 if k == 0 else -ud * 0.05)
        ms.box('rubble', (0.065, 0.065, rise + 0.12), at=(cx, cy, z - 0.02), lod=1 if k == 0 else 0, frame=f)
    door = -w * 0.2 if w > 0.5 else 0.0
    ms.box('door', (0.085, 0.012, 0.2), at=(door, -d / 2 - 0.008, G + 0.02), lod=1, frame=f)
    ms.box('rubble', (0.12, 0.045, 0.02), at=(door, -d / 2 - 0.028, G), lod=0, frame=f)
    rows = [(G + 0.2, -d / 2 - 0.006)]
    if storeys > 1:
        rows.append((G + STOREY + 0.13, -ud / 2 - 0.006))
    for zr, yr in rows:
        for wx in (-w * 0.32, w * 0.12, w * 0.34):
            if abs(wx - door) < 0.09 and zr < G + 0.3:
                continue
            ms.box('dark', (0.05, 0.01, 0.06), at=(wx, yr, zr), lod=0, frame=f)
            ms.box('timber', (0.026, 0.008, 0.062), at=(wx + 0.04, yr - 0.003, zr), lod=0, frame=f)
    for sx in (-1, 1):  # a window on each side
        ms.box('dark', (0.01, 0.05, 0.06), at=(sx * (w / 2 + 0.006), 0, G + 0.2), lod=0, frame=f)
    if awning_w:
        tc.awning(ms, f, w * 0.18, -d / 2 - 0.01, awning_w, depth=0.18, z=0.26)
    for i in range(barrels):
        barrel(ms, f, door - 0.1 - 0.055 * i, -d / 2 - 0.05)
    if sign:  # a hanging sign on a bracket
        ms.box('timber', (0.012, 0.09, 0.012), at=(w * 0.38, -d / 2 - 0.045, G + 0.33), lod=0, frame=f)
        ms.box('painted', (0.008, 0.06, 0.05), at=(w * 0.38, -d / 2 - 0.07, G + 0.27), lod=0, frame=f)
    return f


def lancet(ms, f, x, y, z, w, h, mat='dark', lod=0, side=False):
    """A pointed (gothic) window on a wall face: a flat pentagon facing -Y (or +X with `side`)."""
    bm = bmesh.new()
    pts = [(-w / 2, 0), (w / 2, 0), (w / 2, h - w * 0.7), (0, h), (-w / 2, h - w * 0.7)]
    if side:
        vs = [bm.verts.new((x, y + px, z + pz)) for px, pz in pts]
    else:
        vs = [bm.verts.new((x + px, y, z + pz)) for px, pz in pts]
    bm.faces.new(vs)
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    want = Vector((1, 0, 0)) if side else Vector((0, -1, 0))
    if (side and x < 0) or False:
        want = Vector((-1, 0, 0))
    if bm.faces[0].normal.dot(want) < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    ms.add(bm, mat, lod, matrix=f)


def cathedral(ms, rng, x, y, top=2.8, s=1.0, yaw=None, transept=True):
    """A gothic stone church: an aisled nave under a steep slate roof (lean-to aisle roofs, buttresses,
    lancet windows), a transept, a polygonal apse at the back, a square west tower with corner
    buttresses, belfry lancets, a pinnacled parapet and a tall slate spire (`top` is the cross tip),
    a pointed door in the tower."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    nw, nd, nh = 0.42 * s, 1.2 * s, 0.62 * s
    aw, ah = 0.2 * s, 0.34 * s
    ny = 0.2 * s
    ms.box('rubble', (nw, nd, nh), at=(0, ny, G), lod=1, frame=f)
    rf = f @ Matrix.Translation((0, ny, 0)) @ Matrix.Rotation(math.radians(90), 4, 'Z')
    tc.gable_roof(ms, rf, nd, nw, G + nh, 0.36 * s, over=0.03, mat='slate', gable='rubble', ridge='rubble', lod=1)
    lod2_block(ms, rf, nd, nw, nh, rise=0.36 * s, mat='rubble')
    for sx in (-1, 1):  # the aisles, their lean-to roofs, buttresses and windows
        ax = sx * (nw / 2 + aw / 2)
        ms.box('rubble', (aw, nd * 0.86, ah), at=(ax, ny, G), lod=1, frame=f)
        slope = math.atan2(nh - ah - 0.04 * s, aw)
        lf = f @ Matrix.Translation((ax, ny, G + ah + (nh - ah - 0.04 * s) / 2)) @ Matrix.Rotation(-slope * sx, 4, 'Y')
        ms.box('slate', (aw / math.cos(slope) + 0.04, nd * 0.86 + 0.03, 0.02), at=(0, 0, 0), lod=1, frame=lf)
        n = 5
        for k in range(n):
            by = ny - nd * 0.43 + nd * 0.86 * (k + 0.5) / n
            if k < n:
                ms.box('rubble', (0.05 * s, 0.05 * s, ah * 0.95), at=(sx * (nw / 2 + aw + 0.02 * s), by - nd * 0.86 / n / 2, G), lod=0, frame=f, taper=0.7)
            lancet(ms, f, sx * (nw / 2 + aw + 0.003), by, G + ah * 0.25, 0.06 * s, ah * 0.55, side=True)
            lancet(ms, f, sx * (nw / 2 + 0.003), by, G + ah + 0.07 * s, 0.05 * s, (nh - ah) * 0.5, side=True)
        lod2_block(ms, f, aw, nd * 0.86, ah, x=ax, y=ny, mat='rubble')
    if transept:
        ty = ny + nd * 0.22
        tw2 = nw + 2 * aw + 0.3 * s
        ms.box('rubble', (tw2, 0.3 * s, nh * 0.95), at=(0, ty, G), lod=1, frame=f)
        tc.gable_roof(ms, f @ Matrix.Translation((0, ty, 0)), tw2, 0.3 * s, G + nh * 0.95, 0.3 * s, over=0.02, mat='slate',
                      gable='rubble', ridge='rubble', lod=1)
        for sx in (-1, 1):
            lancet(ms, f, sx * (tw2 / 2 + 0.003), ty, G + 0.15 * s, 0.1 * s, nh * 0.6, side=True)
        lod2_block(ms, f, tw2, 0.3 * s, nh * 0.95, rise=0.3 * s, y=ty, mat='rubble')
    # the apse: a half octagon at the back under a cone roof
    ay = ny + nd / 2
    ms.cyl('rubble', nw * 0.5, nw * 0.5, nh * 0.85, at=(0, ay, G), segs=8, lod=1, frame=f)
    ms.cyl('slate', nw * 0.56, 0.0, 0.3 * s, at=(0, ay, G + nh * 0.85), segs=8, lod=1, frame=f)
    for k in range(3):
        a = math.radians(-45 + 45 * k + 90)
        lancet(ms, f @ Matrix.Translation((0, ay, 0)) @ Matrix.Rotation(a - math.pi / 2 + math.pi, 4, 'Z'),
               0, -nw * 0.5 * 0.93 - 0.002, G + 0.12 * s, 0.05 * s, nh * 0.45)
    # the west tower
    tw = 0.36 * s
    tyy = ny - nd / 2 - tw / 2 + 0.04 * s
    th = 1.0 * s
    ms.box('rubble', (tw, tw, th), at=(0, tyy, G), lod=2, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('rubble', (0.06 * s, 0.06 * s, th * 0.8), at=(sx * (tw / 2 + 0.01 * s), tyy + sy * (tw / 2 + 0.01 * s), G), lod=0, frame=f, taper=0.75)
            ms.cyl('rubble', 0.022 * s, 0.0, 0.14 * s, at=(sx * (tw / 2 - 0.02 * s), tyy + sy * (tw / 2 - 0.02 * s), G + th + 0.04 * s), segs=4, lod=0, frame=f)
    ms.box('rubble', (tw + 0.02, tw + 0.02, 0.05 * s), at=(0, tyy, G + th), lod=1, frame=f)
    for k in range(4):  # belfry lancets and a big west window
        kf = f @ Matrix.Translation((0, tyy, 0)) @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        lancet(ms, kf, 0, -tw / 2 - 0.004, G + th * 0.7, 0.07 * s, th * 0.2)
    lancet(ms, f, 0, tyy - tw / 2 - 0.004, G + th * 0.33, 0.1 * s, th * 0.24)
    arch_face(ms, f, 'door', 0, tyy - tw / 2 - 0.006, G, 0.055 * s, 0.14 * s, lod=1, horseshoe=False, n=6)
    ms.box('rubble', (tw * 0.6, 0.05, 0.02), at=(0, tyy - tw / 2 - 0.03, G), lod=0, frame=f)
    spire = top - G - th - 0.05 * s - 0.08 * s
    ms.cyl('slate', tw * 0.62, 0.0, spire, at=(0, tyy, G + th + 0.05 * s), rot=(0, 0, 22.5), segs=8, lod=1, frame=f)
    ms.cyl('slate', tw * 0.62, 0.0, spire, at=(0, tyy, G + th + 0.05 * s), rot=(0, 0, 45), segs=4, lod=2, only=2, frame=f, caps=False)
    for sx in (-1, 1):  # spire lucarnes
        ms.box('slate', (0.05 * s, 0.05 * s, 0.1 * s), at=(sx * tw * 0.3, tyy, G + th + 0.08 * s), lod=0, frame=f)
    ms.box('kg_iron', (0.008, 0.008, 0.1), at=(0, tyy, top - 0.1), lod=0, frame=f)
    ms.box('kg_iron', (0.05, 0.008, 0.008), at=(0, tyy, top - 0.04), lod=0, frame=f)
    return f


def keep_tower(ms, rng, x, y, w=0.8, d=0.8, h=2.0, yaw=None, mat='kg_wallstone', flag=False):
    """A square stone keep: a battered plinth, string courses, slit and arched windows, a
    crenellated top with corner turrets, an arched door with a stair."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ms.box(mat, (w + 0.06, d + 0.06, 0.12), at=(0, 0, G), lod=1, frame=f, taper=0.93)
    ms.box(mat, (w, d, h - 0.08), at=(0, 0, G), lod=2, frame=f)
    for zz in (h * 0.35, h * 0.7):
        ms.box(mat, (w + 0.02, d + 0.02, 0.02), at=(0, 0, G + zz), lod=0, frame=f)
    ms.box(mat, (w + 0.05, d + 0.05, 0.08), at=(0, 0, G + h - 0.08), lod=1, frame=f)
    ms.box('stone', (w - 0.04, d - 0.04, 0.006), at=(0, 0, G + h), lod=1, frame=f)
    tb.merlons(ms, f, 0, 0, w + 0.05, d + 0.05, G + h, step=0.09, size=0.045, h=0.07, mat=mat)
    for k in range(4):
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        side = w if k % 2 == 0 else d
        for i, zz in enumerate((0.25, 0.5, 0.78)):
            for sx in ((-0.22, 0.22) if i else (0.0,)):
                if k == 0 and i == 0:
                    continue
                lancet(ms, kf, sx * side, -(d if k % 2 == 0 else w) / 2 - 0.004, G + h * zz, 0.035 if i < 2 else 0.06, 0.1 if i < 2 else 0.14)
    arch_face(ms, f, 'door', 0, -d / 2 - 0.006, G + 0.12, 0.07, 0.14, lod=1, horseshoe=False, n=6)
    for s in range(5):
        ms.box(mat, (0.22, 0.04, 0.025 * (s + 1)), at=(0, -d / 2 - 0.2 + 0.04 * s, G), lod=0, frame=f)
    if flag:
        ms.cyl('timber', 0.012, 0.009, 0.4, at=(w * 0.3, d * 0.3, G + h), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, w * 0.3, d * 0.3, G + h + 0.395, w=0.24, h=0.14)
    return f


def round_tower(ms, x, y, r, h, roof=None, mat='kg_wallstone', segs=14, slits=3, cap='slate', finial=True, face=None, z0=None):
    """A round stone tower with a plinth, a corbelled top band and a conical slate roof (`roof`
    is the cone's height); slit windows toward `face` (degrees, default south). `z0` is its foot
    (default just under the town's ground top). Returns the tower's top (eaves) height."""
    z0 = G - 0.005 if z0 is None else z0
    roof = roof if roof is not None else r * 1.5
    ms.cyl(mat, r * 1.07, r * 1.02, 0.08, at=(x, y, z0), segs=segs, lod=0)
    ms.cyl(mat, r, r, h, at=(x, y, z0), segs=segs, lod=0)
    ms.cyl(mat, r, r, h, at=(x, y, z0), segs=max(8, segs // 2 + 1), lod=1, only=1)
    ms.cyl(mat, r, r, h, at=(x, y, z0), segs=6, lod=2, only=2, caps=False)
    ms.cyl(mat, r * 1.03, r * 1.09, 0.06, at=(x, y, z0 + h - 0.065), segs=segs, lod=0)
    ms.cyl(cap, r * 1.14, 0.0, roof, at=(x, y, z0 + h - 0.015), segs=segs, lod=0)
    ms.cyl(cap, r * 1.14, 0.0, roof, at=(x, y, z0 + h - 0.015), segs=max(8, segs // 2 + 1), lod=1, only=1)
    ms.cyl(cap, r * 1.14, 0.0, roof, at=(x, y, z0 + h - 0.015), segs=6, lod=2, only=2, caps=False)
    if finial:
        ms.cyl('kg_iron', 0.008, 0.004, 0.08, at=(x, y, z0 + h - 0.035 + roof), segs=5, lod=0)
    a0 = -90 if face is None else face
    for k in range(slits):
        a = math.radians(a0 + (k - (slits - 1) / 2) * 40)
        sf = tm.house_frame(x + r * math.cos(a), y + r * math.sin(a), math.degrees(a) + 90)
        ms.box('dark', (0.028, 0.012, 0.09), at=(0, 0, z0 + h * (0.35 + 0.3 * (k % 2))), lod=0, frame=sf)
    return z0 + h


# ---- variant b: the Abbasid / Andalusian town ------------------------------------------------

def parapet(ms, f, mat, x, y, w, d, z, h=0.045, t=0.022, lod=0):
    for (px, py, pw, pd) in ((0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t), (w / 2 - t / 2, 0, t, d - 2 * t)):
        ms.box(mat, (pw, pd, h), at=(x + px, y + py, z), lod=lod, frame=f)


def flat_block(ms, f, mat, x, y, w, d, h, z0=G, roof_items=(), rng=None, lod2=True, roof_mat='roof'):
    """A flat-roofed plastered block with a parapet (LOD0), a plain block at LOD1, a bottomless box
    at LOD2. Roof items: ('crates'|'jars'|'tank'|'pergola'|'mat'|'line', x, y) in block space."""
    ms.box(mat, (w, d, h), at=(x, y, z0), lod=0, frame=f)
    box_only(ms, 1, mat, (w, d, h + 0.045), at=(x, y, z0), frame=f)
    ms.box(roof_mat, (w - 0.03, d - 0.03, 0.01), at=(x, y, z0 + h), lod=0, frame=f)
    parapet(ms, f, mat, x, y, w, d, z0 + h)
    if lod2:
        lod2_block(ms, f, w, d, z0 + h + 0.03 - G, x=x, y=y, mat=mat)
    top = z0 + h
    for kind, ix, iy in roof_items:
        px, py = x + ix, y + iy
        if kind == 'crates':
            tt.crate(ms, f, px, py, 1.0, 10, z=top)
            tt.crate(ms, f, px + 0.07, py + 0.01, 0.9, -15, z=top)
        elif kind == 'jars':
            for k in range(3):
                tt.jar(ms, f, px + 0.04 * k, py, 0.8, z=top)
        elif kind == 'tank':
            ms.cyl('kg_stone', 0.045, 0.045, 0.06, at=(px, py, top), segs=10, lod=0, frame=f)
        elif kind == 'pergola':
            tt.pergola(ms, f, px, py, top, 0.26, 0.22, mat='kg_garden', lod=0, post_h=0.14)
        elif kind == 'mat':
            ms.box('reed', (0.18, 0.12, 0.008), at=(px, py, top + 0.01), lod=0, frame=f)
        elif kind == 'line':
            for sx in (-0.1, 0.1):
                ms.box('timber', (0.008, 0.008, 0.1), at=(px + sx, py, top), lod=0, frame=f)
            ms.box('linen', (0.16, 0.004, 0.05), at=(px, py, top + 0.045), lod=0, frame=f)
    return top


def screen_box(ms, f, x, y, z, w, h=0.16, depth=0.05):
    """A projecting carved timber window screen (mashrabiya) on a -Y face at local (x, y)."""
    ms.box('timber', (w, depth, h), at=(x, y - depth / 2, z), lod=1, frame=f)
    ms.box('timber', (w + 0.02, depth + 0.02, 0.016), at=(x, y - depth / 2, z + h), lod=0, frame=f)
    ms.box('timber', (w + 0.01, depth + 0.01, 0.012), at=(x, y - depth / 2, z - 0.012), lod=0, frame=f)
    n = max(2, int(w / 0.03))
    for i in range(1, n):
        ms.box('dark', (0.006, 0.004, h * 0.8), at=(x - w / 2 + w * i / n, y - depth - 0.001, z + h * 0.1), lod=0, frame=f)


def tile_roof(ms, f, x, y, w, d, z, rise=0.12, lod=1):
    """A low terracotta hip roof over a block (no upturned corners)."""
    rf = f @ Matrix.Translation((x, y, 0))
    tc.hip_roof(ms, rf, w, d, z, rise, over=0.04, curl=0.0, mat='tile', lod=lod, ornaments=False)


def flat_house(ms, rng, x, y, w, d, yaw=None, storeys=1, mat='kg_ochre', upper=None, tiled=False, screen=False,
               stair=None, roof_items=(), awning_w=None, jars=2, pent=False):
    """A flat-roofed Abbasid / Andalusian house: plastered walls (ochre or whitewash) on a stone
    plinth, a parapet, a horseshoe-arched door, small windows with timber grilles, an upper storey
    (`upper` = (x, y, w, d) in house space) with a carved timber screen or a terracotta hip roof,
    an outside stair, roof clutter, a team-grey awning."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = STOREY
    ms.box('kg_stone', (w + 0.012, d + 0.012, 0.05), at=(0, 0, G), lod=0, frame=f)
    items = roof_items if storeys == 1 or upper is None else ()
    top = flat_block(ms, f, mat, 0, 0, w, d, h, roof_items=items, rng=rng, lod2=storeys == 1 or upper is None)
    door = rng.uniform(-w * 0.2, w * 0.2)
    arch_face(ms, f, 'kg_stone', door, -d / 2 - 0.003, G, 0.058, 0.13, lod=0, n=8)
    arch_face(ms, f, 'door', door, -d / 2 - 0.005, G, 0.045, 0.125, lod=1, n=8)
    for wx in (door - 0.2, door + 0.2):
        if abs(wx) < w / 2 - 0.05:
            ms.box('dark', (0.045, 0.01, 0.055), at=(wx, -d / 2 - 0.003, G + 0.22), lod=0, frame=f)
            ms.box('timber', (0.055, 0.012, 0.01), at=(wx, -d / 2 - 0.005, G + 0.215), lod=0, frame=f)
    for sx in (-1, 1):
        ms.box('dark', (0.01, 0.045, 0.05), at=(sx * (w / 2 + 0.003), rng.uniform(-d * 0.2, d * 0.2), G + 0.24), lod=0, frame=f)
    if storeys > 1 and upper is not None:
        ux, uy, uw, ud = upper
        uh = STOREY * 0.9
        if tiled:
            ms.box(mat, (uw, ud, uh), at=(ux, uy, top), lod=1, frame=f)
            tile_roof(ms, f, ux, uy, uw, ud, top + uh)
            lod2_block(ms, f, uw, ud, top + uh - G + 0.06, x=ux, y=uy, mat='tile')
        else:
            flat_block(ms, f, mat, ux, uy, uw, ud, uh, z0=top, roof_items=roof_items, rng=rng, lod2=False)
            lod2_block(ms, f, uw, ud, top + uh + 0.03 - G, x=ux, y=uy, mat=mat)
        lod2_block(ms, f, w, d, top + 0.03 - G, mat=mat)
        if screen:
            screen_box(ms, f, ux, uy - ud / 2, top + 0.1, min(0.24, uw * 0.5))
        else:
            for wx in (ux - uw * 0.25, ux + uw * 0.25):
                ms.box('dark', (0.04, 0.01, 0.06), at=(wx, uy - ud / 2 - 0.003, top + 0.15), lod=0, frame=f)
        if pent:  # a tiled pent roof over the lower roof's front
            pf = f @ Matrix.Translation((ux, uy - ud / 2 - 0.08, top + uh * 0.55)) @ Matrix.Rotation(math.radians(-22), 4, 'X')
            ms.box('tile', (uw * 0.8, 0.18, 0.016), at=(0, 0, 0), lod=0, frame=pf)
    elif tiled:
        tile_roof(ms, f, 0, 0, w, d, top)
    if stair:
        side = stair
        n = 7
        for s in range(n):
            sz = (s + 1) * h / n
            ms.box(mat, (0.11, 0.055, sz), at=(side * (w / 2 + 0.055), d * 0.3 - s * 0.055, G), lod=0, frame=f)
        bm = bmesh.new()  # the LOD1 ramp
        sx0 = side * (w / 2 + 0.11) if side > 0 else side * (w / 2)
        sx1 = side * (w / 2) if side > 0 else side * (w / 2 + 0.11)
        y0, y1 = d * 0.3 + 0.028, d * 0.3 - n * 0.055 + 0.028
        v = [bm.verts.new(p) for p in ((sx0, y1, G), (sx1, y1, G), (sx1, y0, G), (sx0, y0, G), (sx0, y0, G + h), (sx1, y0, G + h))]
        bm.faces.new((v[0], v[1], v[5], v[4]))
        bm.faces.new((v[1], v[2], v[5]))
        bm.faces.new((v[3], v[0], v[4]))
        bm.faces.new((v[2], v[3], v[4], v[5]))
        bm.faces.new((v[0], v[3], v[2], v[1]))
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ms.add(bm, mat, 1, matrix=f, only=1)
    if awning_w:
        tc.awning(ms, f, door + (0.12 if door < 0 else -0.12), -d / 2 - 0.01, awning_w, depth=0.17, z=0.25)
    for _ in range(jars):
        jx = rng.uniform(-w / 2 + 0.05, w / 2 - 0.05)
        if abs(jx - door) > 0.08:
            tt.jar(ms, f, jx, -d / 2 - 0.04, rng.uniform(0.8, 1.1))
    return f


def court_house(ms, rng, x, y, w, d, yaw=None, mat='kg_ochre', tiled_wing=False, screen=True, court='tree',
                two=True, roof_items=(('crates', -0.1, 0.0), ('tank', 0.15, 0.05))):
    """A courtyard house: a two-storey main range across the back, a one-storey wing down one
    side, a wall with an arched gate across the front, a courtyard with a tree, a palm or a small
    fountain. Local -Y is the street front."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    bd = d * 0.42
    by = d / 2 - bd / 2
    h = STOREY
    ms.box('kg_stone', (w + 0.012, d + 0.012, 0.04), at=(0, 0, G), lod=0, frame=f)
    top = flat_block(ms, f, mat, 0, by, w, bd, h, lod2=not two, roof_items=() if two else roof_items, rng=rng)
    if two:
        uw = w * 0.6
        ux = rng.choice((-1, 1)) * (w - uw) / 2
        flat_block(ms, f, mat, ux, by + 0.02, uw, bd - 0.04, STOREY * 0.85, z0=top, roof_items=roof_items, rng=rng, lod2=False)
        lod2_block(ms, f, uw, bd - 0.04, top + STOREY * 0.85 + 0.03 - G, x=ux, y=by + 0.02, mat=mat)
        lod2_block(ms, f, w, bd, top + 0.03 - G, y=by, mat=mat)
        if screen:
            screen_box(ms, f, ux, by - bd / 2 + 0.02, top + 0.1, min(0.22, uw * 0.45))
    # the side wing
    ww = w * 0.32
    wsx = rng.choice((-1, 1))
    wd = d - bd - 0.02
    wy = -d / 2 + wd / 2
    if tiled_wing:
        ms.box(mat, (ww, wd, h * 0.85), at=(wsx * (w - ww) / 2, wy, G), lod=1, frame=f)
        tile_roof(ms, f, wsx * (w - ww) / 2, wy, ww, wd, G + h * 0.85, rise=0.1)
        lod2_block(ms, f, ww, wd, h * 0.85 + 0.06, x=wsx * (w - ww) / 2, y=wy, mat='tile')
    else:
        flat_block(ms, f, mat, wsx * (w - ww) / 2, wy, ww, wd, h * 0.85, rng=rng)
    # the front wall and gate
    cw = w - ww
    cx = -wsx * ww / 2
    gh = 0.17
    for part in (-1, 1):
        pw = cw / 2 - 0.07
        ms.box(mat, (pw, 0.035, gh), at=(cx + part * (cw / 4 + 0.035), -d / 2 + 0.0175, G), lod=1, frame=f)
    ms.box(mat, (0.16, 0.04, 0.26), at=(cx, -d / 2 + 0.02, G), lod=1, frame=f)
    arch_face(ms, f, 'door', cx, -d / 2 - 0.003, G, 0.045, 0.12, lod=0, n=8)
    ms.box(mat, (cw, 0.035, 0.03), at=(cx, d / 2 - bd - 0.0175, G), lod=0, frame=f)  # the court's back step
    # the courtyard floor and what grows in it
    cd = d - bd - 0.035
    ms.box('kg_sand_square', (cw - 0.04, cd - 0.02, 0.006), at=(cx, -d / 2 + 0.035 + cd / 2, G), lod=0, frame=f)
    ccx, ccy = cx, -d / 2 + 0.035 + cd / 2
    world = f
    if court == 'tree':
        tree_f = f @ Matrix.Translation((ccx, ccy, 0))
        p = tree_f.translation
        tree(ms, p.x, p.y, h=0.34, r=0.1, mat='shrub', lod2=False)
    elif court == 'palm':
        p = (f @ Matrix.Translation((ccx, ccy, 0))).translation
        palm(ms, rng, p.x, p.y, h=rng.uniform(0.42, 0.55))
    elif court == 'fountain':
        fountain(ms, world, ccx, ccy, r=0.07)
    # arched doors from the court into the main range
    arch_face(ms, f, 'door', ccx, by - bd / 2 - 0.003, G, 0.04, 0.11, lod=0, n=6)
    tt.jar(ms, f, ccx + 0.12, by - bd / 2 - 0.04, 0.9)
    return f


def fountain(ms, f, x, y, r=0.09, lod=1):
    """An octagonal stone basin with water and a small spout column."""
    ms.cyl('kg_stone', r, r, 0.04, at=(x, y, G), segs=8, lod=lod, frame=f)
    ms.cyl('water', r * 0.84, r * 0.84, 0.004, at=(x, y, G + 0.036), segs=8, lod=0, frame=f)
    ms.cyl('kg_stone', 0.014, 0.01, 0.08, at=(x, y, G + 0.03), segs=6, lod=0, frame=f)
    ms.cyl('kg_stone', 0.03, 0.02, 0.012, at=(x, y, G + 0.1), segs=8, lod=0, frame=f)


def dome(ms, f, x, y, z, r, mat='kg_dome', drum=0.05, lod2=True, segs=14):
    """A drum and a white dome with a finial (LOD0 smooth, LOD1 coarser, LOD2 a 4-sided cone)."""
    ms.cyl(mat, r * 1.02, r * 1.02, drum, at=(x, y, z), segs=segs, lod=1, frame=f)
    ms.sphere(mat, r, at=(x, y, z + drum), scale=(1, 1, 1.08), u=segs + 2, v=8, cut_below=0.0, lod=0, frame=f)
    ms.sphere(mat, r, at=(x, y, z + drum), scale=(1, 1, 1.08), u=10, v=4, cut_below=0.0, lod=1, only=1, frame=f)
    if lod2:
        ms.cyl(mat, r, 0.0, r * 1.1, at=(x, y, z), segs=4, lod=2, only=2, frame=f, caps=False)
    ms.cyl('bronze', 0.008, 0.005, 0.07, at=(x, y, z + drum + r * 1.06), segs=5, lod=0, frame=f)
    ms.sphere('bronze', 0.016, at=(x, y, z + drum + r * 1.08 + 0.04), u=6, v=4, lod=0, frame=f)


def minaret(ms, f, x, y, top, w=0.2, mat='kg_ochre'):
    """A square (Maghrebi / Andalusian) minaret: a plain shaft with bands and paired arched
    windows, a merloned gallery, a smaller lantern with arched openings and a small dome with a
    finial reaching `top`."""
    lant = w * 0.55
    dome_r = lant * 0.42
    lant_h = top * 0.12
    shaft = top - G - lant_h - dome_r * 1.2 - 0.09
    ms.box(mat, (w, w, shaft), at=(x, y, G), lod=2, frame=f)
    for zz in (0.33, 0.66):
        ms.box('kg_stone', (w + 0.012, w + 0.012, 0.02), at=(x, y, G + shaft * zz), lod=0, frame=f)
    for k in range(4):
        kf = f @ Matrix.Translation((x, y, 0)) @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        for zz in (0.45, 0.78):
            for sx in (-0.035, 0.035):
                arch_face(ms, kf, 'dark', sx * w / 0.2, -w / 2 - 0.003, G + shaft * zz, 0.016 * w / 0.2, 0.05 * w / 0.2, lod=0, n=6)
    z = G + shaft
    ms.box('kg_stone', (w + 0.03, w + 0.03, 0.025), at=(x, y, z), lod=1, frame=f)
    tb.merlons(ms, f, x, y, w + 0.03, w + 0.03, z + 0.025, step=0.05, size=0.022, h=0.035, mat=mat)
    ms.box(mat, (lant, lant, lant_h), at=(x, y, z + 0.025), lod=1, frame=f)
    for k in range(4):
        kf = f @ Matrix.Translation((x, y, 0)) @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        arch_face(ms, kf, 'dark', 0, -lant / 2 - 0.003, z + 0.035, lant * 0.22, lant_h * 0.45, lod=0, n=6)
    ms.box('kg_stone', (lant + 0.02, lant + 0.02, 0.018), at=(x, y, z + 0.025 + lant_h), lod=0, frame=f)
    dome(ms, f, x, y, z + 0.025 + lant_h + 0.012, dome_r, drum=0.01, lod2=False, segs=10)


def mosque(ms, rng, x, y, w=0.62, d=0.6, h=0.46, dome_r=0.2, minaret_at=(0.3, 0.3), minaret_top=1.0,
           minaret_w=0.2, yaw=None, porch_bays=3, mat='kg_ochre', courtyard=0.0, side_domes=False):
    """A mosque: a plastered prayer hall with stepped merlons, a white dome on a drum over its
    centre, a horseshoe-arched porch on the front, an optional arcaded courtyard (sahn) in front
    with a fountain, and a square minaret at `minaret_at` (hall space) reaching `minaret_top`."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    ms.box('kg_stone', (w + 0.02, d + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box(mat, (w, d, h), at=(0, 0, G), lod=1, frame=f)
    ms.box('roof', (w - 0.03, d - 0.03, 0.01), at=(0, 0, G + h), lod=0, frame=f)
    parapet(ms, f, mat, 0, 0, w, d, G + h, lod=0)
    tb.merlons(ms, f, 0, 0, w, d, G + h + 0.045, step=0.06, size=0.024, h=0.035, mat=mat)
    lod2_block(ms, f, w, d, h + 0.04, mat=mat)
    # the dome over a square base
    ms.box(mat, (dome_r * 2.3, dome_r * 2.3, 0.08), at=(0, d * 0.05, G + h), lod=1, frame=f)
    dome(ms, f, 0, d * 0.05, G + h + 0.08, dome_r)
    if side_domes:
        for sx in (-1, 1):
            dome(ms, f, sx * w * 0.32, d * 0.05, G + h + 0.01, dome_r * 0.4, drum=0.02, lod2=False, segs=10)
    # the porch: a horseshoe arcade across the front
    pd = 0.12
    pw = w * 0.86
    arcade(ms, f, mat, -pw / 2, pw / 2, -d / 2 - pd, G, h * 0.62, porch_bays, depth=0.04, lod=0)
    box_only(ms, 1, mat, (pw, pd + 0.04, h * 0.62), at=(0, -d / 2 - pd / 2 + 0.02, G), frame=f)
    ms.box('roof', (pw, pd + 0.02, 0.012), at=(0, -d / 2 - pd / 2 + 0.01, G + h * 0.62), lod=0, frame=f)
    arch_face(ms, f, 'door', 0, -d / 2 - 0.004, G, 0.06, 0.16, lod=0, n=8)
    for sx in (-1, 1):  # windows on the sides and back
        for k in range(2):
            kf = f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
            arch_face(ms, kf, 'dark', -d * 0.2 + d * 0.4 * k, -w / 2 - 0.003, G + 0.14, 0.03, 0.1, lod=0, n=6)
    if courtyard > 0:  # a walled court in front with an arcade along its sides and a fountain
        cy = -d / 2 - pd - courtyard / 2
        for sx in (-1, 1):
            cf = f @ Matrix.Translation((sx * (w / 2 - 0.06), cy, 0)) @ Matrix.Rotation(math.radians(-90 * sx), 4, 'Z')
            arcade(ms, cf, mat, -courtyard / 2, courtyard / 2, -0.06, G, h * 0.55, 4, depth=0.035, lod=0)
            box_only(ms, 1, mat, (0.12, courtyard, h * 0.55), at=(sx * (w / 2 - 0.06), cy, G), frame=f)
            ms.box('roof', (0.13, courtyard, 0.012), at=(sx * (w / 2 - 0.065), cy, G + h * 0.55), lod=0, frame=f)
            lod2_block(ms, f, 0.12, courtyard, h * 0.55, x=sx * (w / 2 - 0.06), y=cy, mat=mat)
        ms.box(mat, (w, 0.04, h * 0.5), at=(0, cy - courtyard / 2 + 0.02, G), lod=1, frame=f)
        arch_face(ms, f, 'door', 0, cy - courtyard / 2 - 0.003, G, 0.06, 0.16, lod=0, n=8)
        ms.box('kg_sand_square', (w - 0.24, courtyard - 0.04, 0.006), at=(0, cy, G), lod=0, frame=f)
        fountain(ms, f, 0, cy, r=0.08)
    mx, my = minaret_at
    minaret(ms, f, mx, my, minaret_top, w=minaret_w, mat=mat)
    return f


def stone_tower(ms, rng, x, y, w=0.6, h=1.8, yaw=None, mat='kg_stone'):
    """A square stone tower (a qasba gate tower): battered plinth, slits, a horseshoe door, merlons."""
    return keep_tower(ms, rng, x, y, w=w, d=w, h=h, yaw=yaw, mat=mat)


def caravanserai(ms, rng, x, y, w=1.9, d=1.8, yaw=None, mat='kg_ochre', wing=0.42, court='tree'):
    """A courtyard building (caravanserai or madrasa): four two-storey wings under terracotta hip
    roofs round a court, a horseshoe arcade on the court side, an arched gate in the front wing
    with a carved timber gallery above, a tree or fountain in the court."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = STOREY * 1.75
    wings = [  # (cx, cy, ww, wd, yaw of the court-side face)
        (0, d / 2 - wing / 2, w, wing, 0),
        (0, -d / 2 + wing / 2, w, wing, 180),
        (-w / 2 + wing / 2, 0, wing, d - 2 * wing, 90),
        (w / 2 - wing / 2, 0, wing, d - 2 * wing, -90),
    ]
    ms.box('kg_stone', (w + 0.02, d + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    for k, (cx, cy, ww, wd, fy) in enumerate(wings):
        ms.box(mat, (ww, wd, h), at=(cx, cy, G), lod=1, frame=f)
        tile_roof(ms, f, cx, cy, ww, wd, G + h, rise=0.16)
        lod2_block(ms, f, ww, wd, h + 0.1, x=cx, y=cy, mat='tile')
        # the court-side arcade (ground floor) and windows above
        cf = f @ Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(math.radians(fy), 4, 'Z')
        span = ww if k < 2 else wd
        inner = span - (2 * wing if k < 2 else 0) - 0.04
        ydist = (wd if k < 2 else ww) / 2
        bays = max(2, int(inner / 0.22))
        arcade(ms, cf, mat, -inner / 2, inner / 2, -ydist - 0.05, G, h * 0.5, bays, depth=0.05, lod=0)
        for i in range(bays):
            bx = -inner / 2 + inner * (i + 0.5) / bays
            arch_face(ms, cf, 'dark', bx, -ydist - 0.003, G + h * 0.6, 0.03, 0.12, lod=0, n=6)
        # outer windows
        of = f @ Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(math.radians(fy + 180), 4, 'Z')
        for i in range(max(2, int(span / 0.3))):
            bx = -span / 2 + span * (i + 0.5) / max(2, int(span / 0.3))
            ms.box('dark', (0.045, 0.01, 0.07), at=(bx, -ydist - 0.003, G + h * 0.62), lod=0, frame=of)
    # the gate in the front wing with a timber gallery above
    arch_face(ms, f, 'kg_stone', 0, -d / 2 - 0.004, G, 0.1, 0.22, lod=0, n=8)
    arch_face(ms, f, 'door', 0, -d / 2 - 0.006, G, 0.08, 0.2, lod=1, n=8)
    screen_box(ms, f, 0, -d / 2, G + h * 0.62, 0.36, h=0.18)
    cd = d - 2 * wing
    ms.box('kg_sand_square', (w - 2 * wing - 0.02, cd - 0.02, 0.006), at=(0, 0, G), lod=0, frame=f)
    if court == 'tree':
        p = f.translation
        tree(ms, p.x, p.y, h=0.5, r=0.16, lod2=False)
    else:
        fountain(ms, f, 0, 0, r=0.1)
    return f


# ---- the shared file: palaces ------------------------------------------------------------------

def banner_pointed(ms, f, x, y, ztop, w=0.07, h=0.26, lod=1):
    """A long team banner with a pointed foot, hanging flat on a -Y wall face, a rod on top."""
    bm = bmesh.new()
    pts = [(-w / 2, 0), (-w / 2, -h + w * 0.6), (0, -h), (w / 2, -h + w * 0.6), (w / 2, 0)]
    face = bm.faces.new([bm.verts.new((x + px, y - 0.008, ztop + pz)) for px, pz in pts])
    res = bmesh.ops.extrude_face_region(bm, geom=[face])
    bmesh.ops.translate(bm, vec=(0, 0.006, 0), verts=[g for g in res['geom'] if isinstance(g, bmesh.types.BMVert)])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, 'team_cloth', lod, matrix=f)
    ms.box('timber', (w + 0.02, 0.012, 0.01), at=(x, y - 0.008, ztop - 0.004), lod=0, frame=f)


def palace(ms, rng):
    """`palace` (stone keep): a rectangular grey-stone keep on a battered plinth with four square
    corner towers rising above its crenellated walls, string courses, gothic windows, machicolation
    corbels under the tower tops, an arched iron-strapped door up a flight of stone steps between
    cheek walls, two team banners on the front, a team pennant on the south-west tower. 12 m
    across (the capital's free centre), 16 m to the tower merlons."""
    f = tm.house_frame(0, 0, 0)
    mat = 'kg_wallstone'
    bw, bd, by = 0.82, 0.76, 0.05
    H, TH, tw = 1.0, 1.24, 0.3
    ms.box(mat, (bw + 0.05, bd + 0.05, 0.1), at=(0, by, G), lod=1, frame=f, taper=0.95)
    ms.box(mat, (bw, bd, H), at=(0, by, G), lod=2, frame=f)
    for zz in (0.33, 0.62):
        ms.box(mat, (bw + 0.016, bd + 0.016, 0.018), at=(0, by, G + H * zz), lod=0, frame=f)
    ms.box(mat, (bw + 0.04, bd + 0.04, 0.05), at=(0, by, G + H - 0.05), lod=1, frame=f)
    ms.box('stone', (bw - 0.02, bd - 0.02, 0.006), at=(0, by, G + H), lod=1, frame=f)
    tb.merlons(ms, f, 0, by, bw + 0.04, bd + 0.04, G + H, step=0.085, size=0.045, h=0.065, mat=mat)
    ms.box('timber', (0.12, 0.12, 0.02), at=(0.15, by + 0.12, G + H), lod=0, frame=f)  # the roof hatch
    for k in range(int(bw / 0.09)):  # corbels under the parapet band on the front and back
        for sy in (-1, 1):
            ms.box(mat, (0.022, 0.02, 0.035), at=(-bw / 2 + 0.06 + k * 0.09, by + sy * (bd / 2 + 0.01), G + H - 0.085), lod=0, frame=f)
    corners = [(sx * bw / 2, by + sy * bd / 2) for sx in (-1, 1) for sy in (-1, 1)]
    for cx, cy in corners:
        ms.box(mat, (tw + 0.03, tw + 0.03, 0.12), at=(cx, cy, G), lod=0, frame=f, taper=0.92)
        ms.box(mat, (tw, tw, TH), at=(cx, cy, G), lod=2, frame=f)
        ms.box(mat, (tw + 0.04, tw + 0.04, 0.055), at=(cx, cy, G + TH - 0.055), lod=1, frame=f)
        for zz in (0.33, 0.62):
            ms.box(mat, (tw + 0.016, tw + 0.016, 0.018), at=(cx, cy, G + H * zz), lod=0, frame=f)
        for k in range(3):
            for sy in (-1, 1):
                ms.box(mat, (0.022, 0.02, 0.035), at=(cx - tw / 2 + 0.05 + k * 0.09, cy + sy * (tw / 2 + 0.01), G + TH - 0.09), lod=0, frame=f)
                ms.box(mat, (0.02, 0.022, 0.035), at=(cx + sy * (tw / 2 + 0.01), cy - tw / 2 + 0.05 + k * 0.09, G + TH - 0.09), lod=0, frame=f)
        ms.box('stone', (tw - 0.02, tw - 0.02, 0.006), at=(cx, cy, G + TH), lod=1, frame=f)
        tb.merlons(ms, f, cx, cy, tw + 0.04, tw + 0.04, G + TH, step=0.075, size=0.042, h=0.065, mat=mat)
        # windows on the two outer faces
        for k, (fx, fy, rot) in enumerate(((0, -1, 0), (1 if cx > 0 else -1, 0, -90 if cx > 0 else 90), (0, 1, 180))):
            if (fy == 1 and cy < by) or (fy == -1 and cy > by):
                continue
            kf = f @ Matrix.Translation((cx, cy, 0)) @ Matrix.Rotation(math.radians(rot), 4, 'Z')
            for zz, lw, lh in ((0.3, 0.026, 0.08), (0.58, 0.026, 0.08), (0.82, 0.04, 0.12)):
                lancet(ms, kf, 0, -tw / 2 - 0.004, G + TH * zz, lw, lh)
    # windows on the body's four faces: lancets above, slits below
    for k in range(4):
        rot = 90 * k
        kf = f @ Matrix.Translation((0, by, 0)) @ Matrix.Rotation(math.radians(rot), 4, 'Z')
        half = (bd if k % 2 == 0 else bw) / 2
        span = (bw if k % 2 == 0 else bd) - tw
        for i in range(3):
            wx = -span / 2 + span * (i + 0.5) / 3
            lancet(ms, kf, wx, -half - 0.004, G + H * 0.66, 0.06, 0.16)
            if k != 0 or i != 1:
                ms.box('dark', (0.026, 0.01, 0.08), at=(wx, -half - 0.004, G + H * 0.38), lod=0, frame=f @ Matrix.Translation((0, by, 0)) @ Matrix.Rotation(math.radians(rot), 4, 'Z'))
    ms.box('door', (0.08, 0.012, 0.16), at=(0, by + bd / 2 + 0.006, G + 0.1), lod=0, frame=f)  # the back door
    # the front door, banners and the stair
    fy = by - bd / 2
    arch_face(ms, f, mat, 0, fy - 0.005, G + 0.1, 0.095, 0.2, lod=1, horseshoe=False, n=8)
    arch_face(ms, f, 'door', 0, fy - 0.008, G + 0.1, 0.078, 0.19, lod=1, horseshoe=False, n=8)
    for zz in (0.06, 0.14):
        ms.box('kg_iron', (0.15, 0.008, 0.014), at=(0, fy - 0.012, G + 0.1 + zz), lod=0, frame=f)
    for sx in (-1, 1):
        banner_pointed(ms, f, sx * 0.19, fy, G + H * 0.6, w=0.075, h=0.3)
    steps, run = 6, 0.2
    for s in range(steps):
        ms.box(mat, (0.3, run / steps + 0.002, 0.1 * (s + 1) / steps), at=(0, fy - run + (s + 0.5) * run / steps, G), lod=0, frame=f)
    bm = bmesh.new()  # the stair as one wedge at LOD1 and LOD2
    v = [bm.verts.new(p) for p in ((-0.15, fy - run, G), (0.15, fy - run, G), (0.15, fy, G), (-0.15, fy, G), (-0.15, fy, G + 0.1), (0.15, fy, G + 0.1))]
    for fc in ((v[0], v[1], v[5], v[4]), (v[1], v[2], v[5]), (v[3], v[0], v[4]), (v[2], v[3], v[4], v[5]), (v[0], v[3], v[2], v[1])):
        bm.faces.new(fc)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, mat, 2, matrix=f, only=(1, 2))
    for sx in (-1, 1):  # cheek walls with a pier at the foot
        ms.box(mat, (0.05, run, 0.14), at=(sx * 0.175, fy - run / 2, G), lod=1, frame=f)
        ms.box(mat, (0.07, 0.07, 0.19), at=(sx * 0.175, fy - run + 0.02, G), lod=0, frame=f)
    # the team pennant on the south-west tower
    px, py = -bw / 2, by - bd / 2
    ms.cyl('timber', 0.012, 0.009, 0.32, at=(px, py, G + TH), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, px, py, G + TH + 0.315, w=0.26, h=0.15)


def palace_small(ms, rng):
    """`palace-small` (motte and bailey keep): a grassy earthen motte, a ring palisade of sharpened
    logs round its top, a plank-walled timber keep with corner posts, shuttered windows and an
    X-braced door under a steep shingle roof, a team pennant over the ridge, a timber stair with
    rails up the south slope. 11 m across, 10 m to the flag."""
    R0, R1, MH = 0.56, 0.37, 0.22
    prof = []
    for i in range(9):  # a smooth shoulder: a cosine profile from the foot to the plateau
        t = i / 8
        prof.append((R0 - (R0 - R1) * t, G - 0.004 + (MH + 0.004) * (0.5 - 0.5 * math.cos(math.pi * t))))
    lathe2(ms, 'kg_turf', prof, segs=28, lod=0)
    lathe2(ms, 'kg_turf', prof[::2], segs=14, lod=1, only=1)
    ms.cyl('kg_turf', R0, R1, MH + 0.004, at=(0, 0, G - 0.004), segs=8, lod=2, only=2)
    top = G + MH
    # the palisade, open at the south for the stair
    Rp = 0.34
    half = 11.0
    a0, a1 = -90 + half, 270 - half
    n = int(math.radians(a1 - a0) * Rp / 0.028)
    ph = 0.15
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        lh = ph * rng.uniform(0.92, 1.06)
        r = rng.uniform(0.012, 0.015)
        lf = tb.ring_frame(Rp, a, top - 0.01)
        ms.cyl('log', r, r * 0.92, lh, at=(0, 0, 0), segs=5, lod=0, frame=lf, caps=False)
        ms.cyl('log', r * 0.92, 0.0, 0.035, at=(0, 0, lh), segs=5, lod=0, frame=lf, caps=False)
    tb.sweep(ms, 'log', [(Rp + 0.014, top - 0.01), (Rp + 0.014, top + ph)], a0, a1, 24, lod=1, only=1)
    tb.sweep(ms, 'log', [(Rp - 0.014, top + ph), (Rp - 0.014, top - 0.01)], a0, a1, 24, lod=1, only=1)
    tb.sweep(ms, 'log', [(Rp, top - 0.01), (Rp, top + ph)], a0, a1, 8, lod=2, only=2)
    for sx in (-1, 1):  # gate posts
        gx = Rp * math.cos(math.radians(-90 + sx * half))
        ms.cyl('timber', 0.018, 0.016, ph + 0.06, at=(gx, -Rp * math.cos(math.radians(half)), top - 0.01), segs=6, lod=1)
    # the keep
    f = tm.house_frame(0, 0.02, 0)
    w, d, h = 0.5, 0.38, 0.34
    ms.box('rubble', (w + 0.02, d + 0.02, 0.03), at=(0, 0, top - 0.01), lod=1, frame=f)
    ms.box('kg_planks', (w, d, h), at=(0, 0, top + 0.02), lod=2, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.03, 0.03, h + 0.01), at=(sx * (w / 2 - 0.006), sy * (d / 2 - 0.006), top + 0.015), lod=1, frame=f)
    for sy in (-1, 1):
        ms.box('timber', (w + 0.01, 0.02, 0.025), at=(0, sy * (d / 2 + 0.004), top + 0.02), lod=0, frame=f)
        ms.box('timber', (w + 0.01, 0.02, 0.022), at=(0, sy * (d / 2 + 0.004), top + 0.02 + h - 0.022), lod=0, frame=f)
    z = top + 0.02 + h
    rise = 0.22
    tc.gable_roof(ms, f, w, d, z, rise, over=0.05, mat='kg_shingle', gable='kg_planks', thick=0.026, lod=2, ridge='timber')
    # door with an X brace and iron hinges, windows with shutters
    ms.box('door', (0.11, 0.012, 0.19), at=(0, -d / 2 - 0.006, top + 0.03), lod=1, frame=f)
    for k in (-1, 1):
        bf = f @ Matrix.Translation((0, -d / 2 - 0.014, top + 0.125)) @ Matrix.Rotation(math.atan2(0.17, 0.09) * k, 4, 'Y')
        ms.box('timber', (0.012, 0.006, 0.19), at=(0, 0, -0.095), lod=0, frame=bf)
    for zz in (0.06, 0.15):
        ms.box('kg_iron', (0.05, 0.008, 0.01), at=(-0.03, -d / 2 - 0.014, top + 0.03 + zz), lod=0, frame=f)
    for k in range(4):
        kf = f @ Matrix.Rotation(math.radians(90 * k), 4, 'Z')
        half_d = (d if k % 2 == 0 else w) / 2
        span = (w if k % 2 == 0 else d)
        for wx in ((-span * 0.33, span * 0.33) if k != 3 and k != 1 else (0.0,)):
            ms.box('dark', (0.045, 0.01, 0.055), at=(wx, -half_d - 0.004, top + 0.24), lod=0, frame=kf)
            ms.box('timber', (0.026, 0.008, 0.06), at=(wx + 0.038, -half_d - 0.008, top + 0.237), lod=0, frame=kf)
    ms.cyl('timber', 0.011, 0.008, 0.2, at=(0, 0, z + rise - 0.01), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, 0, 0, z + rise + 0.185, w=0.2, h=0.11)
    # the stair up the south slope
    y0, y1 = -R0 - 0.02, -Rp + 0.01
    run = y1 - y0
    slope = math.atan2(MH, run)
    length = math.hypot(run, MH)
    sf = tm.Matrix.Translation(Vector((0, (y0 + y1) / 2, G + MH / 2))) @ tm.Matrix.Rotation(slope, 4, 'X')
    for sx in (-1, 1):
        ms.box('timber', (0.02, length, 0.03), at=(sx * 0.06, 0, -0.015), lod=1, frame=sf)
    ms.box('timber', (0.12, length, 0.012), at=(0, 0, -0.03), lod=2, frame=sf)
    steps = 10
    for s in range(steps):
        yy = y0 + run * (s + 0.5) / steps
        zz = G + MH * (s + 0.5) / steps
        ms.box('timber', (0.11, run / steps * 0.8, 0.012), at=(0, yy, zz - 0.005), lod=0)
    for sx in (-1, 1):  # rails on posts
        for k in range(4):
            yy = y0 + run * k / 3
            zz = G + MH * k / 3
            ms.box('timber', (0.012, 0.012, 0.09), at=(sx * 0.07, yy, zz - 0.01), lod=0)
        ms.box('timber', (0.01, length, 0.01), at=(sx * 0.07, 0, 0.06), lod=0, frame=sf)


# ---- the shared file: wall rings -----------------------------------------------------------------

def stone_ring(ms, rng, R_out, R_in, H, gate_x, towers, tower_r, tower_h, gate_r, gate_h, roof_k=1.65,
               banners=False, portcullis=False, stairs=(), n=(128, 56, 28)):
    """A grey stone curtain wall ring on a packed-earth footing: a crenellated parapet and a stone
    wall-walk, round towers with corbelled tops and conical slate roofs at `towers` (degrees, 0
    east), two taller round gate towers at the south round an arched gate with timber doors (and a
    portcullis, team banners), stairs up the inner face at `stairs` [(angle, direction)]."""
    mat = 'kg_wallstone'
    Rm = (R_out + R_in) / 2
    gy = -Rm
    gtx = gate_x + gate_r * 0.75
    half = math.degrees(math.asin(gtx / Rm))
    a0, a1 = -90 + half, 270 - half
    for lod in (0, 1, 2):
        steps = n[lod]
        outer = [(R_out + 0.02, 0.0), (R_out, 0.07), (R_out, H)] if lod < 2 else [(R_out, 0.0), (R_out, H)]
        tb.sweep(ms, 'kg_ringstone', outer, a0, a1, steps, lod=lod, only=lod)
        tb.sweep(ms, 'stone', [(R_out, H), (R_in, H)], a0, a1, steps, lod=lod, only=lod)
        tb.sweep(ms, 'kg_ringstone', [(R_in, H), (R_in, 0.0)], a0, a1, steps, lod=lod, only=lod)
        if lod < 2:
            ph = 0.035 if lod == 0 else 0.08
            tb.sweep(ms, 'kg_ringstone', [(R_out, H), (R_out, H + ph), (R_out - 0.04, H + ph), (R_out - 0.04, H)], a0, a1, steps, lod=lod, only=lod)
    tb.footing(ms, R_out, R_in, n[1], apron=0.35)
    t_half = [(a, math.degrees(math.asin(tower_r * 1.05 / R_out))) for a in towers]
    tb.merlon_ring(ms, R_out - 0.02, H + 0.035, a0, a1, 0.1, t_half, size=(0.05, 0.04, 0.055), mat=mat)
    # a few slit windows along the outer face
    for i in range(int(math.radians(a1 - a0) * R_out / 0.9)):
        a = a0 + (a1 - a0) * (i + 0.5) / int(math.radians(a1 - a0) * R_out / 0.9)
        if any(abs((a - c + 180) % 360 - 180) < hw * 1.5 for c, hw in t_half):
            continue
        ms.box('dark', (0.025, 0.01, 0.07), at=(0, -0.002, H * 0.55), lod=0, frame=tb.ring_frame(R_out, a))
    for a in towers:
        ra = math.radians(a)
        rc = R_out - tower_r * 0.3
        round_tower(ms, rc * math.cos(ra), rc * math.sin(ra), tower_r, tower_h, roof=tower_r * roof_k, face=a, z0=0.0, segs=16)
    # the gate: two round towers, a gate block with an arched door (and a portcullis), merlons
    for sx in (-1, 1):
        tx, ty = sx * gtx, gy - 0.04
        round_tower(ms, tx, ty, gate_r, gate_h, roof=gate_r * roof_k * 1.05, face=-90, z0=0.0, segs=16, slits=2)
        if banners:
            bf = tm.house_frame(tx, ty, 0)
            banner_pointed(ms, bf, 0, -gate_r - 0.004, gate_h * 0.82, w=gate_r * 0.55, h=gate_h * 0.42)
    gw = 2 * gate_x
    gd = R_out - R_in + 0.06
    gf = tm.house_frame(0, gy, 0)
    gh = H + 0.06
    ms.box(mat, (2 * gtx, gd, gh), at=(0, 0, 0), lod=2, frame=gf)
    tb.merlons(ms, gf, 0, 0, 2 * gtx, gd, gh, step=0.1, size=0.045, h=0.055, mat=mat)
    zj = min(H * 0.55, gw * 0.95)
    arch_face(ms, gf, mat, 0, -gd / 2 - 0.004, 0.0, gate_x + 0.04, zj, lod=1, horseshoe=False, n=10)
    arch_face(ms, gf, 'door', 0, -gd / 2 - 0.008, 0.0, gate_x, zj, lod=1, horseshoe=False, n=10)
    ms.box('timber', (0.012, 0.006, zj + gate_x * 0.9), at=(0, -gd / 2 - 0.012, 0.0), lod=0, frame=gf)
    for zz in (0.25, 0.55):
        ms.box('kg_iron', (gw * 0.9, 0.006, 0.016), at=(0, -gd / 2 - 0.012, zj * zz), lod=0, frame=gf)
    if portcullis:  # the iron grid hanging in the upper half of the arch
        for i in range(7):
            px = -gate_x * 0.85 + gate_x * 1.7 * i / 6
            top_z = zj + math.sqrt(max(0.0, gate_x ** 2 - px ** 2)) * 0.95
            ms.box('kg_iron', (0.012, 0.01, top_z - zj * 0.55), at=(px, -gd / 2 - 0.016, zj * 0.55), lod=0, frame=gf)
        for zz in (0.7, 0.88, 1.06):
            ms.box('kg_iron', (gw * 0.86, 0.01, 0.012), at=(0, -gd / 2 - 0.016, zj * zz), lod=0, frame=gf)
    arch_face(ms, gf @ Matrix.Rotation(math.pi, 4, 'Z'), 'door', 0, -gd / 2 - 0.008, 0.0, gate_x, zj, lod=1, horseshoe=False, n=8)
    # stairs up the inner face
    for ang, dirn in stairs:
        k = 9
        da = math.degrees(0.075 / R_in)
        for i in range(k):
            a = ang + dirn * i * da
            ms.box(mat, (0.078, 0.11, H * (i + 1) / k), at=(0, 0.055, 0.0), lod=0, frame=tb.ring_frame(R_in, a))
        bm = bmesh.new()  # LOD1: one ramp along the wall
        pts = []
        for i in (0, k):
            a = math.radians(ang + dirn * i * da)
            pts.append((math.cos(a), math.sin(a), H * i / k))
        rr = (R_in, R_in - 0.11)
        v = [bm.verts.new((rr[j] * c, rr[j] * s, z if z > 0 else 0.0)) for (c, s, z) in pts for j in (0, 1)]
        v += [bm.verts.new((rr[j] * pts[1][0], rr[j] * pts[1][1], 0.0)) for j in (0, 1)]
        for fc in ((v[0], v[1], v[3], v[2]), (v[1], v[5], v[3]), (v[0], v[2], v[4]), (v[2], v[3], v[5], v[4]), (v[0], v[4], v[5], v[1])):
            bm.faces.new(fc)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        ms.add(bm, mat, 1, only=1)


RAISE = tb.WALL_RAISE


def walls_small(ms, rng):
    """`walls-small` (44 m): a grey stone ring 4.5 m high with merlons, four round towers with
    slate cones (east, north-east, north-west, west), two round gate towers flanking an arched
    timber gate at the south."""
    stone_ring(ms, rng, R_out=2.2, R_in=2.06, H=0.45 * RAISE, gate_x=0.2, towers=(0, 61, 119, 180),
               tower_r=0.25, tower_h=0.62 * RAISE, gate_r=0.28, gate_h=0.7 * RAISE, n=(112, 48, 24))


def walls_medium(ms, rng):
    """`walls-medium` (65 m): a 6 m stone ring with merlons, five round towers (8 m) and a
    gatehouse of two 10 m round towers hung with team banners, an arched gate with a portcullis,
    a stair up to the wall-walk by the north tower."""
    stone_ring(ms, rng, R_out=3.25, R_in=3.02, H=0.6 * RAISE, gate_x=0.25, towers=(41, 90, 139, 190, 350),
               tower_r=0.32, tower_h=0.8 * RAISE, gate_r=0.36, gate_h=1.0 * RAISE, banners=True, portcullis=True,
               stairs=((104, 1),), n=(128, 56, 28))


def walls_big(ms, rng):
    """`walls-big` (86 m): an 8 m stone ring with merlons, seven round towers (11 m), a gatehouse
    of two 13 m round towers with team banners, an arched gate with a portcullis, stairs up to the
    wall-walk by the north-west and north-east towers."""
    stone_ring(ms, rng, R_out=4.3, R_in=4.0, H=0.8 * RAISE, gate_x=0.3, towers=(0, 45, 90, 135, 180, 225, 315),
               tower_r=0.38, tower_h=1.1 * RAISE, gate_r=0.42, gate_h=1.3 * RAISE, banners=True, portcullis=True,
               stairs=((122, 1), (58, -1)), n=(144, 56, 32))


# ---- the shared file: the colony camp and the fields ------------------------------------------

def camp_hut(ms, rng, x, y):
    """The camp's hut: a small half-timbered cottage, its gable to the front, under a steep straw
    thatch with crossed gable finials (3.5 m, raised like the houses)."""
    f = tm.house_frame(x, y, 0)
    w, d, h = 0.46, 0.5, 0.19
    ms.box('rubble', (w + 0.02, d + 0.02, 0.04), at=(0, 0, G), lod=1, frame=f)
    ms.box('lime', (w, d, h), at=(0, 0, G + 0.03), lod=1, frame=f)
    frame_members(ms, f, w, d, G + 0.03, h, lod1=True)
    rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')
    rise = 0.21
    tc.gable_roof(ms, rf, d, w, G + 0.03 + h, rise, over=0.06, mat='thatch', gable='lime', thick=0.04, lod=1, ridge='thatch')
    lod2_block(ms, rf, d, w, h + 0.03, rise=rise, mat='lime')
    zr = G + 0.03 + h + rise
    for sy in (-1, 1):
        for k in (-1, 1):
            cf = f @ Matrix.Translation((0, sy * (d / 2 + 0.05), zr - 0.02)) @ Matrix.Rotation(math.radians(35 * k), 4, 'Y')
            ms.box('timber', (0.012, 0.012, 0.12), at=(0, 0, 0), lod=0, frame=cf)
    ms.box('timber', (0.012, 0.012, rise * 0.9), at=(0, -d / 2 - 0.006, G + 0.03 + h), lod=0, frame=f)
    ms.box('door', (0.1, 0.012, 0.18), at=(0, -d / 2 - 0.008, G + 0.03), lod=1, frame=f)
    for sx in (-1, 1):
        ms.box('dark', (0.01, 0.05, 0.05), at=(sx * (w / 2 + 0.006), 0, G + 0.17), lod=0, frame=f)


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): a grassy clearing with a thatched half-timbered hut at the back,
    two linen tents, a stone fire ring, jars, a crate and sacks, a log pile, a half-built palisade
    along the west and north, a team flag on a 4.5 m pole."""
    tb.colony_camp(ms, rng, hut_fn=camp_hut)


def field_1(ms, rng):
    """`field-1` (14 by 10 m): eight strips of ripe rye (1 m), a ditch with a sluice on the north."""
    tb.canal(ms, -0.62, 0.62, 0.41)
    for i in range(8):
        tb.crop_bed(ms, 'kg_rye', -0.56 + 0.16 * i, -0.07, 0.12, 0.76, rng.uniform(0.085, 0.1), rng)


def apple_tree(ms, rng, x, y, top=0.27, support=False):
    """An apple tree: a mulched ring, a short trunk with two limbs, a round crown dotted with red and
    yellow fruit; a pair of stakes with a rope when `support`."""
    ms.cyl('mud', 0.15, 0.15, 0.006, at=(x, y, G), segs=12, lod=1)
    ms.cyl('timber', 0.02, 0.014, 0.11, at=(x, y, G), segs=7, lod=1)
    for k in (-1, 1):
        ms.cyl('timber', 0.012, 0.008, 0.08, at=(x, y, G + 0.09), rot=(0, 30 * k, rng.uniform(0, 180)), segs=5, lod=0)
    cr = 0.12
    cz = top - cr * 0.9
    ms.sphere('kg_apple', cr, at=(x, y, cz), scale=(1.05, 1.05, 0.9), u=10, v=6, lod=0)
    for k in range(5):
        a = 2 * math.pi * k / 5 + rng.uniform(-0.3, 0.3)
        ms.sphere('kg_apple', cr * 0.62, at=(x + 0.085 * math.cos(a), y + 0.085 * math.sin(a), cz - 0.02 + rng.uniform(-0.015, 0.02)), u=8, v=5, lod=0)
    ms.sphere('kg_apple', cr * 1.15, at=(x, y, cz), scale=(1, 1, 0.85), u=8, v=5, lod=1, only=1)
    ms.cyl('kg_apple', cr * 1.15, 0.0, top - G - 0.05, at=(x, y, G + 0.05), segs=4, lod=2, only=2, caps=False)
    if support:
        for sx in (-1, 1):
            ms.cyl('log', 0.009, 0.008, 0.12, at=(x + sx * 0.09, y - 0.1, G), segs=5, lod=0)
        ms.box('reed', (0.18, 0.006, 0.006), at=(x, y - 0.1, G + 0.085), lod=0)


def field_2(ms, rng):
    """`field-2` (16 by 12 m): an apple orchard: six trees (2.5 m) in two rows on grass with
    mulched rings, trodden paths between them, stakes and ropes on two of the young trees."""
    ms.quad_strip('kg_meadow_square', [(-0.8, -0.04, G + 0.002), (0.8, -0.04, G + 0.002), (0.8, 0.05, G + 0.002), (-0.8, 0.05, G + 0.002)], lod=1)
    for x in (-0.26, 0.26):
        ms.quad_strip('kg_meadow_square', [(x - 0.04, -0.6, G + 0.002), (x + 0.04, -0.6, G + 0.002), (x + 0.04, 0.6, G + 0.002), (x - 0.04, 0.6, G + 0.002)], lod=1)
    for i, x in enumerate((-0.52, 0.0, 0.52)):
        for j, y in enumerate((0.3, -0.3)):
            apple_tree(ms, rng, x + rng.uniform(-0.02, 0.02), y + rng.uniform(-0.02, 0.02), top=rng.uniform(0.25, 0.28),
                       support=(j == 1 and i != 1))


def field_3(ms, rng):
    """`field-3` (14 by 12 m): a grazed pasture with trodden paths, a wattle fence on the west and
    north sides, a plank water trough and a stone in the north-west corner."""
    wattle_fence(ms, [(-0.68, -0.56), (-0.68, 0.56), (0.56, 0.56)], h=0.1, step=0.18)
    ms.box('timber', (0.24, 0.08, 0.055), at=(-0.44, 0.46, G), lod=1)
    ms.box('water', (0.21, 0.055, 0.004), at=(-0.44, 0.46, G + 0.05), lod=1)
    ms.sphere('stone', 0.035, at=(-0.26, 0.45, G + 0.005), scale=(1.3, 1, 0.6), u=8, v=5, lod=1)
    for (x0, y0, x1, y1) in ((-0.4, 0.38, 0.5, -0.55), (-0.2, -0.1, -0.5, -0.4)):
        dx, dy = x1 - x0, y1 - y0
        ln = math.hypot(dx, dy)
        nx, ny = -dy / ln * 0.05, dx / ln * 0.05
        ms.quad_strip('kg_meadow_square', [(x0 + nx, y0 + ny, G + 0.002), (x0 - nx, y0 - ny, G + 0.002), (x1 - nx, y1 - ny, G + 0.002), (x1 + nx, y1 + ny, G + 0.002)], lod=1)


def field_4(ms, rng):
    """`field-4` (16 by 10 m): six beds of flowering flax (0.6 m) on red-brown earth, a dry ditch
    with stones along the north edge and a marker post at its west end."""
    ms.box('mud', (1.46, 0.07, 0.006), at=(0, 0.42, G), lod=1)
    for sy in (-1, 1):
        ms.box('mud', (1.48, 0.018, 0.016), at=(0, 0.42 + sy * 0.044, G), lod=1)
    for k in range(9):
        ms.sphere('stone', 0.022, at=(-0.6 + 0.15 * k + rng.uniform(-0.03, 0.03), 0.42 + rng.uniform(-0.02, 0.02), G + 0.004), scale=(1.2, 1, 0.6), u=6, v=4, lod=0)
    ms.box('timber', (0.04, 0.04, 0.1), at=(-0.74, 0.45, G), lod=1)
    for i in range(6):
        tb.crop_bed(ms, 'flax', -0.6 + 0.24 * i, -0.05, 0.17, 0.74, rng.uniform(0.055, 0.065), rng)


def arcade_hall(ms, rng, x, y, w, d, yaw=None, bays=4, mat='kg_ochre', h=None, porch=0.14, rise=0.2):
    """A market hall (funduq): a tall plastered block under a terracotta hip roof with a
    horseshoe arcade porch across its front under a tiled lean-to, windows above."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    h = h or STOREY * 1.7
    ms.box('kg_stone', (w + 0.02, d + 0.02, 0.05), at=(0, 0, G), lod=1, frame=f)
    ms.box(mat, (w, d, h), at=(0, 0, G), lod=1, frame=f)
    tile_roof(ms, f, 0, 0, w, d, G + h, rise=rise)
    lod2_block(ms, f, w, d, h + rise * 0.6, mat='tile')
    ph = h * 0.5
    arcade(ms, f, mat, -w / 2, w / 2, -d / 2 - porch, G, ph, bays, depth=0.045, lod=0)
    box_only(ms, 1, mat, (w, porch + 0.045, ph), at=(0, -d / 2 - porch / 2 + 0.0225, G), frame=f)
    pf = f @ Matrix.Translation((0, -d / 2 - porch / 2, G + ph + 0.03)) @ Matrix.Rotation(math.radians(-14), 4, 'X')
    ms.box('tile', (w + 0.04, porch + 0.08, 0.018), at=(0, 0, 0), lod=1, frame=pf)
    for i in range(bays):
        bx = -w / 2 + w * (i + 0.5) / bays
        arch_face(ms, f, 'dark', bx, -d / 2 - 0.003, G + h * 0.66, 0.03, 0.1, lod=0, n=6)
    for sx in (-1, 1):
        kf = f @ Matrix.Rotation(math.radians(90 * sx), 4, 'Z')
        for i in range(max(1, int(d / 0.35))):
            by = -d / 2 + d * (i + 0.5) / max(1, int(d / 0.35))
            arch_face(ms, kf, 'dark', by * sx, -w / 2 - 0.003, G + h * 0.55, 0.03, 0.1, lod=0, n=6)
    return f
