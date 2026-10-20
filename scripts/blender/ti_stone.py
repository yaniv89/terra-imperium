# scripts/blender/ti_stone.py
# The Stone Age kit's materials and building parts (plans/2026-10-20-001-feat-eight-ages-plan.md,
# U87): wattle and daub, hide, thatch and grass, bark, turf, flint, chalk and mammoth bone, and the
# parts every Stone building is made of: round huts in six regional forms (a thatched cone, a pit
# house under a pyramid roof, a stone-footed brush dome, a hide tipi, a mud drum under a tall grass
# cone, a hide dome ringed with bone), hide tents, wattle hurdles, stake palisades and earth banks.
# Scale as the other kits: 1 unit = 10 m, Z up, the front facing Blender -Y, parts stand on G.
# The organic materials (SMOOTH) export with smoothed normals, hard past 60 degrees
# (build_rts_stone.smooth_normals), as the unit builds do (ti_units.smooth_organic).
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

# ---- materials ----------------------------------------------------------------------------------

NEW = ['daub', 'wattle', 'hide', 'hide_dark', 'pole', 'bark', 'turf', 'flint', 'chalk', 'bone', 'ochre', 'loess',
       'redmud', 'grass_thatch', 'brush', 'fur', 'fieldstone', 'thatch_st', 'meat']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)
# the round, soft stuff: smoothed at export (hard edges past 60 degrees)
SMOOTH = ('hide', 'hide_dark', 'thatch_st', 'grass_thatch', 'brush', 'turf', 'bark', 'daub', 'loess', 'redmud', 'fur', 'meat')
tt.SMOOTH.update(SMOOTH)


def make_materials():
    tm.mat_simple('daub', ['#a88a64', '#bb9c74', '#9a7c58', '#c4a77f'], scale=14.0, bump=0.35, dirt=True)
    tm.mat_simple('wattle', ['#6a4e30', '#86663f', '#5a4128', '#9a7a4c'], scale=10.0, stripes={'dir': 'Z', 'scale': 140.0, 'distortion': 9.0}, bump=0.7)
    tm.mat_simple('hide', ['#a9875e', '#bf9d70', '#94724c', '#c9ab80'], scale=9.0, bump=0.25)
    tm.mat_simple('hide_dark', ['#6e5036', '#80603f', '#5c422c'], scale=9.0, bump=0.25)
    tm.mat_simple('pole', ['#8a6d4a', '#a2845c', '#76593a'], scale=8.0, stripes={'dir': 'X', 'scale': 90.0, 'distortion': 5.0}, bump=0.35)
    tm.mat_simple('bark', ['#4d3b2a', '#62503a', '#3e2f22', '#75634a'], scale=16.0, stripes={'dir': 'X', 'scale': 50.0, 'distortion': 12.0}, bump=0.7)
    tm.mat_simple('turf', ['#4c5a28', '#5f6e30', '#6e5a36', '#55642a'], scale=30.0, bump=0.7)
    tm.mat_simple('flint', ['#2e2f33', '#45474c', '#5a5b5e', '#c9c3b4'], scale=40.0, rough=0.5, bump=0.5)
    tm.mat_simple('chalk', ['#d9d4c4', '#e6e1d2', '#c9c2ae'], scale=24.0, bump=0.4, dirt=True)
    tm.mat_simple('bone', ['#d8ceb4', '#e4dcc6', '#c4b898'], scale=18.0, bump=0.25)
    tm.mat_simple('ochre', ['#8e3a1e', '#a64a26', '#7a301a'], scale=20.0, bump=0.2)
    tm.mat_simple('loess', ['#c2a46a', '#d0b37a', '#b39558', '#dcc28c'], scale=14.0, bump=0.35, dirt=True)
    tm.mat_simple('redmud', ['#94512e', '#a9623a', '#82452a', '#b8714a'], scale=14.0, bump=0.35, dirt=True)
    tm.mat_simple('grass_thatch', ['#a08c52', '#bba566', '#cbb878', '#8e7a46'], scale=12.0, stripes={'dir': 'Z', 'scale': 170.0, 'distortion': 8.0}, bump=0.6)
    tm.mat_simple('brush', ['#5d5232', '#776a42', '#4a4128', '#8a7a4c'], scale=22.0, bump=0.8)
    tm.mat_simple('fur', ['#5a4430', '#6e543a', '#7f6447', '#4a3826'], scale=40.0, bump=0.8)
    tm.mat_simple('fieldstone', ['#7e7666', '#958c7a', '#6a6356', '#a39a86'], scale=22.0, bump=0.7)
    tm.mat_simple('thatch_st', ['#7f6a3e', '#a08650', '#b79c62', '#8c7444'], scale=12.0, stripes={'dir': 'Z', 'scale': 160.0, 'distortion': 10.0}, bump=0.6)
    tm.mat_simple('meat', ['#6a2a22', '#82382c', '#5a221c'], scale=24.0, bump=0.3)


if not any(n == 'stone' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('stone', make_materials))


# ---- styles -------------------------------------------------------------------------------------
# A style is a region's building stuff and hut form. The base file uses 'base'; the regional skins
# (build_rts_skins_stone.py) one each of the six. Keys:
#   form   cone | pit | dome | tipi | drum | bone   (the hut's shape, hut() below)
#   wall   the walls' stuff     roof  the roof's stuff     post  posts and poles     stone  footings
#   eave   roof overhang (x the wall radius)     pitch  roof height (x the wall radius)

STYLES = {
    'base':       dict(form='cone', wall='daub', roof='thatch_st', post='pole', stone='fieldstone', eave=1.28, pitch=1.25, wall_h=0.15, awning=None),
    'europe':     dict(form='cone', wall='wattle', roof='thatch_st', post='timber', stone='fieldstone', eave=1.32, pitch=1.6, wall_h=0.13, awning='hide'),
    'levant':     dict(form='dome', wall='fieldstone', roof='brush', post='pole', stone='fieldstone', eave=1.06, pitch=0.62, wall_h=0.11, awning='reed'),
    'sinic':      dict(form='pit', wall='loess', roof='thatch_st', post='timber', stone='loess', eave=1.3, pitch=1.15, wall_h=0.06, awning='thatch_st'),
    'americas':   dict(form='tipi', wall='hide', roof='hide', post='pole', stone='fieldstone', eave=1.0, pitch=2.3, wall_h=0.0, awning='hide'),
    'westafrica': dict(form='drum', wall='redmud', roof='grass_thatch', post='pole', stone='redmud', eave=1.38, pitch=1.75, wall_h=0.2, awning='grass_thatch'),
    'steppe':     dict(form='bone', wall='hide_dark', roof='hide_dark', post='bone', stone='turf', eave=1.0, pitch=0.85, wall_h=0.0, awning='fur'),
}


def frame(x, y, yaw=0.0, z=0.0):
    return Matrix.Translation(Vector((x, y, z))) @ Matrix.Rotation(math.radians(yaw), 4, 'Z')


# ---- round parts with a plain twin for LOD1/LOD2 ------------------------------------------------
# The detailed part shows at LOD0 only; a plain twin with fewer sides at LOD1 (and LOD2 when
# `maxlod` is 2) is added FIRST, so the ruin builder (build_rts_bronze.ruined) takes it as the
# part's stand-in, as it does for a bevelled block.

def rcyl(ms, mat, r1, r2, h, at=(0, 0, 0), segs=12, low=None, maxlod=2, frame=None, caps=True, rot=(0, 0, 0)):
    if maxlod >= 1:
        ms.cyl(mat, r1, r2, h, at=at, rot=rot, segs=low or max(5, segs // 2 + 1), lod=maxlod, frame=frame, caps=caps, only=tuple(range(1, maxlod + 1)))
    return ms.cyl(mat, r1, r2, h, at=at, rot=rot, segs=segs, lod=0, frame=frame, caps=caps, only=(0,))


def rdome(ms, mat, r, at=(0, 0, 0), scale=(1, 1, 1), u=14, v=6, low=(8, 4), maxlod=2, frame=None):
    if maxlod >= 1:
        ms.sphere(mat, r, at=at, scale=scale, u=low[0], v=low[1], cut_below=0.0, lod=maxlod, frame=frame, only=tuple(range(1, maxlod + 1)))
    return ms.sphere(mat, r, at=at, scale=scale, u=u, v=v, cut_below=0.0, lod=0, frame=frame, only=(0,))


def pole(ms, mat, p0, p1, r=0.01, segs=5, lod=1, f=None):
    """A round pole from p0 to p1 (no caps: its ends are in the ground or the thatch); `f` places
    local points."""
    p0, p1 = Vector(p0), Vector(p1)
    if f is not None:
        p0, p1 = f @ p0, f @ p1
    d = p1 - p0
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=False, cap_tris=False, segments=segs, radius1=r, radius2=r * 0.85, depth=d.length)
    bmesh.ops.translate(bm, vec=(0, 0, d.length / 2), verts=bm.verts)
    ms.add(bm, mat, lod, Matrix.Translation(p0) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())


def rock(ms, mat, x, y, r, rng, squash=0.7, lod=0, z=G, f=None):
    ms.sphere(mat, r, at=(x, y, z - r * 0.15), scale=(rng.uniform(1.0, 1.4), rng.uniform(0.8, 1.1), squash), u=6, v=4, lod=lod, frame=f)


# ---- huts ---------------------------------------------------------------------------------------

def doorway(ms, f, r, h, mat_post, wall_r=None, team=False, lod=1):
    """A low doorway on the hut's front (-Y): a dark opening, two posts and a lintel, a hide or team
    hanging rolled over it."""
    y = -(wall_r or r) - 0.006
    ms.box('dark', (0.085, 0.02, h * 0.92), at=(0, y + 0.008, G), lod=lod, frame=f)
    for sx in (-1, 1):
        ms.box(mat_post, (0.018, 0.022, h), at=(sx * 0.052, y, G), lod=lod, frame=f)
    ms.box(mat_post, (0.13, 0.024, 0.018), at=(0, y, G + h), lod=lod, frame=f)
    if team:
        ms.box('team_cloth', (0.1, 0.008, h * 0.45), at=(0.0, y - 0.01, G + h * 0.5), lod=1, frame=f)
    else:
        ms.cyl('hide_dark', 0.012, 0.012, 0.1, at=(-0.05, y - 0.012, G + h * 0.9), rot=(0, 90, 0), segs=5, lod=0, frame=f)


def hut(ms, x, y, r=0.24, yaw=0.0, style='base', wall_h=None, pitch=None, door=True, team=False, maxlod=2, detail=1, rng=None):
    """A round hut in the style's form, its door on its local -Y. Returns (frame, eave height, top)."""
    S = STYLES[style]
    f = frame(x, y, yaw)
    form = S['form']
    wh = S['wall_h'] if wall_h is None else wall_h
    pitch = S['pitch'] if pitch is None else pitch
    roof_h = r * pitch
    seg = 20 if detail >= 2 else 14 if detail else 10
    if form in ('cone', 'drum'):
        rcyl(ms, S['wall'], r, r * 0.98, wh, at=(0, 0, G), segs=seg, maxlod=maxlod, frame=f, caps=False)
        if form == 'cone' and S['wall'] == 'wattle' and detail:  # daub skirt at the foot of the weave
            ms.cyl('daub', r * 1.01, r * 1.0, wh * 0.35, at=(0, 0, G), segs=seg, lod=0, frame=f, caps=False)
        if form == 'drum' and detail:  # a raised mud plinth band
            ms.cyl(S['wall'], r * 1.05, r * 1.04, 0.025, at=(0, 0, G), segs=seg, lod=0, frame=f, caps=False)
        z = G + wh
        re = r * S['eave']
        rcyl(ms, S['roof'], re, 0.0, roof_h, at=(0, 0, z - 0.02), segs=seg, maxlod=maxlod, frame=f)
        if detail:  # a second course of thatch, stepped, and a bound top knot
            ms.cyl(S['roof'], re * 0.72, re * 0.69, 0.03, at=(0, 0, z - 0.02 + roof_h * 0.28), segs=seg, lod=0, frame=f, caps=False)
            if form == 'drum':  # a clay pot on the finial
                ms.cyl('pole', 0.008, 0.006, roof_h * 0.25, at=(0, 0, z - 0.02 + roof_h * 0.85), segs=5, lod=0, frame=f)
                ms.sphere('terracotta', 0.028, at=(0, 0, z - 0.02 + roof_h * 1.08), scale=(1, 1, 0.8), u=7, v=4, lod=0, frame=f)
            else:
                ms.cyl('pole', 0.035, 0.012, roof_h * 0.18, at=(0, 0, z - 0.02 + roof_h * 0.84), segs=6, lod=0, frame=f)
        top = z - 0.02 + roof_h
        if detail >= 2:  # a hero hut: rafter ends under the eave, two bands of rope, a third course
            for i in range(16):
                a = 2 * math.pi * (i + 0.5) / 16
                pole(ms, S['post'], (math.cos(a) * r * 0.98, math.sin(a) * r * 0.98, z - 0.012), (math.cos(a) * re * 1.01, math.sin(a) * re * 1.01, z - 0.03), r=0.006, segs=4, lod=0, f=f)
            for t in (0.5, 0.68):
                ms.cyl('pole', re * (1 - t) * 1.04 + 0.004, re * (1 - t) * 1.03, 0.008, at=(0, 0, z - 0.02 + roof_h * t), segs=seg, lod=0, frame=f, caps=False)
            ms.cyl(S['roof'], re * 1.02, re * 0.98, 0.025, at=(0, 0, z - 0.035), segs=seg, lod=0, frame=f, caps=False)
            for sx in (-1, 1):  # hides hung on the wall either side of the door
                a = math.radians(-90 + sx * 42)
                ms.box('hide', (0.07, 0.008, wh * 0.7), at=(math.cos(a) * r * 1.01, math.sin(a) * r * 1.01, G + wh * 0.15), rot_z=math.degrees(a) + 90, lod=0, frame=f)
        if door:
            doorway(ms, f, r, min(wh + 0.02, 0.16) if form == 'drum' else max(0.1, wh * 0.95), S['post'], team=team)
        return f, z, top
    if form == 'pit':
        # a sunken floor: a low loess kerb, a pyramid of thatch to the ground, a gabled entrance porch
        rcyl(ms, S['wall'], r * 1.08, r * 1.1, wh, at=(0, 0, G), segs=seg, maxlod=maxlod, frame=f, caps=False)
        re = r * S['eave']
        z = G + wh
        pyr = Matrix.Rotation(math.radians(45), 4, 'Z')
        ms.cyl(S['roof'], re, 0.0, roof_h, at=(0, 0, z - 0.01), segs=4, lod=maxlod, frame=f @ pyr)
        if detail:
            ms.cyl(S['roof'], re * 0.62, re * 0.58, 0.028, at=(0, 0, z + roof_h * 0.36), segs=4, lod=0, frame=f @ pyr, caps=False)
            ms.cyl('timber', 0.02, 0.01, roof_h * 0.2, at=(0, 0, z - 0.01 + roof_h * 0.88), segs=5, lod=0, frame=f)
        # the porch: a small gable over the ramp down
        pf = f @ frame(0, -r * 0.95, 0)
        for sy in (-1, 1):
            rf = pf @ Matrix.Translation(Vector((sy * 0.045, 0, G + 0.08))) @ Matrix.Rotation(math.radians(sy * 38), 4, 'Y')
            ms.box(S['roof'], (0.1, 0.18, 0.016), at=(0, 0, 0), lod=1, frame=rf)
        ms.box('dark', (0.08, 0.14, 0.01), at=(0, 0.0, G), lod=1, frame=pf)
        return f, z, z - 0.01 + roof_h
    if form == 'dome':
        # a ring of dry field stones, a low dome of brush and mud on it, a hide over the door
        rcyl(ms, S['wall'], r * 1.02, r * 0.98, wh, at=(0, 0, G), segs=seg, maxlod=maxlod, frame=f, caps=False)
        if detail:
            for i in range(10):
                a = 2 * math.pi * (i + 0.5) / 10
                ms.box(S['stone'], (0.05, 0.035, 0.03), at=(math.cos(a) * r * 1.02, math.sin(a) * r * 1.02, G + wh * 0.5), rot_z=math.degrees(a) + 90, lod=0, frame=f)
        z = G + wh
        rdome(ms, S['roof'], r * S['eave'], at=(0, 0, z - 0.01), scale=(1, 1, pitch), u=seg, v=5, maxlod=maxlod, frame=f)
        if detail:  # poles poking out at the top, a mud cap
            for k in range(4):
                a = math.radians(45 + 90 * k)
                pole(ms, 'pole', (math.cos(a) * r * 0.25, math.sin(a) * r * 0.25, z + roof_h * 0.8), (math.cos(a) * r * 0.42, math.sin(a) * r * 0.42, z + roof_h * 1.12), r=0.006, segs=4, lod=0, f=f)
            ms.sphere('mud', r * 0.4, at=(0, 0, z - 0.01 + roof_h * 0.86), scale=(1, 1, 0.35), u=8, v=3, cut_below=0.0, lod=0, frame=f)
        if door:
            doorway(ms, f, r, 0.12, S['post'], wall_r=r * 1.03, team=team)
        return f, z, z + roof_h
    if form == 'tipi':
        # a hide cone on poles, the poles crossing out of the top, smoke flaps, a door flap
        h = roof_h
        rcyl(ms, S['wall'], r, r * 0.12, h, at=(0, 0, G), segs=seg, maxlod=maxlod, frame=f, caps=False)
        n = 7 if detail else 4
        for k in range(n):
            a = 2 * math.pi * (k + 0.3) / n
            pole(ms, S['post'], (math.cos(a) * r * 0.95, math.sin(a) * r * 0.95, G), (-math.cos(a) * r * 0.16, -math.sin(a) * r * 0.16, G + h * 1.22), r=0.006, segs=4, lod=1 if k < 3 else 0, f=f)
        if detail:
            for sx in (-1, 1):  # smoke flaps
                ms.box(S['wall'], (0.05, 0.008, 0.09), at=(sx * 0.03, -r * 0.2, G + h * 0.8), rot_z=sx * 20, lod=0, frame=f)
            # a painted band of red ochre
            ms.cyl('ochre', r * 0.72, r * 0.62, h * 0.08, at=(0, 0, G + h * 0.3), segs=seg, lod=0, frame=f, caps=False)
        if door:
            ms.box('dark', (0.06, 0.03, 0.1), at=(0, -r * 0.88, G), lod=1, frame=f, taper=0.6)
            if team:
                ms.box('team_cloth', (0.07, 0.01, 0.05), at=(0, -r * 0.9, G + 0.1), lod=1, frame=f, taper=0.6)
        return f, G + 0.05, G + h * 1.2
    if form == 'bone':
        # a hide dome weighed down with mammoth bones: a ring of jaw bones at the foot, tusk arches
        # over the door, a turf patch on top
        rdome(ms, S['wall'], r, at=(0, 0, G), scale=(1, 1, pitch), u=seg, v=6, maxlod=maxlod, frame=f)
        n = 14 if detail else 8
        for i in range(n):
            a = 2 * math.pi * i / n
            ms.box('bone', (0.05, 0.03, 0.05), at=(math.cos(a) * r * 1.0, math.sin(a) * r * 1.0, G), rot_z=math.degrees(a) + 90, lod=1 if i % 2 == 0 else 0, frame=f, taper=0.7)
        if detail:
            for i in range(6):  # long bones laid over the hide
                a = 2 * math.pi * (i + 0.5) / 6
                pole(ms, 'bone', (math.cos(a) * r * 0.95, math.sin(a) * r * 0.95, G + 0.03), (math.cos(a) * r * 0.35, math.sin(a) * r * 0.35, G + roof_h * 0.88), r=0.008, segs=4, lod=0, f=f)
            ms.sphere('turf', r * 0.45, at=(0, 0, G + roof_h * 0.82), scale=(1, 1, 0.3), u=8, v=3, cut_below=0.0, lod=0, frame=f)
        if door:  # two tusks crossing over a short hide tunnel
            ms.box('dark', (0.08, 0.04, 0.1), at=(0, -r * 0.98, G), lod=1, frame=f)
            for sx in (-1, 1):
                p0 = f @ Vector((sx * 0.07, -r * 1.06, G))
                pm = f @ Vector((sx * 0.06, -r * 1.12, G + 0.1))
                p1 = f @ Vector((-sx * 0.02, -r * 1.06, G + 0.16))
                pole(ms, 'bone', p0, pm, r=0.011, segs=5, lod=1)
                pole(ms, 'bone', pm, p1, r=0.009, segs=5, lod=0)
            if team:
                ms.box('team_cloth', (0.08, 0.01, 0.05), at=(0, -r * 1.08, G + 0.09), lod=1, frame=f)
        return f, G + roof_h * 0.5, G + roof_h
    raise ValueError(form)


def hide_tent(ms, x, y, w=0.26, d=0.34, h=0.2, yaw=0.0, mat='hide', detail=0):
    """A ridge tent of sewn hides over a pole frame, the front (-Y) pinned open, a fur in front."""
    f = frame(x, y, yaw)
    bm = bmesh.new()
    v = [bm.verts.new(p) for p in ((-w / 2, -d / 2, G), (w / 2, -d / 2, G), (w / 2, d / 2, G), (-w / 2, d / 2, G), (0, -d / 2 - 0.02, G + h), (0, d / 2 + 0.02, G + h))]
    bm.faces.new((v[0], v[3], v[5], v[4]))
    bm.faces.new((v[2], v[1], v[4], v[5]))
    bm.faces.new((v[3], v[2], v[5]))
    bm.faces.new((v[1], v[0], v[4]))
    bm.normal_update()
    ms.add(bm, mat, 2, f)
    ms.box('dark', (w * 0.4, 0.01, h * 0.7), at=(0, -d / 2 - 0.004, G), lod=1, frame=f, taper=0.3)
    for sy in (-1, 1):
        pole(ms, 'pole', f @ Vector((0, sy * (d / 2 + 0.02), G)), f @ Vector((0, sy * (d / 2 + 0.03), G + h + 0.05)), r=0.006, segs=4, lod=0)
    pole(ms, 'pole', f @ Vector((0, -d / 2 - 0.03, G + h + 0.01)), f @ Vector((0, d / 2 + 0.03, G + h + 0.01)), r=0.005, segs=4, lod=0)
    ms.box('fur', (w * 0.6, 0.1, 0.008), at=(0, -d / 2 - 0.08, G), lod=0, frame=f)
    if detail:  # guy lines to pegs, stones on the skirt
        for sx in (-1, 1):
            for sy in (-1, 1):
                pole(ms, 'pole', (0, sy * (d / 2 + 0.03), G + h + 0.04), (sx * w * 0.8, sy * (d / 2 + 0.1), G), r=0.0025, segs=3, lod=0, f=f)
                ms.cyl('pole', 0.004, 0.003, 0.03, at=(sx * w * 0.8, sy * (d / 2 + 0.1), G - 0.005), segs=3, lod=0, frame=f, caps=False)
        for k in range(6):
            sx = -1 if k < 3 else 1
            ms.sphere('fieldstone', 0.016, at=(sx * w / 2 * 1.02, -d / 3 + d / 3 * (k % 3), G + 0.004), scale=(1.2, 1, 0.7), u=5, v=3, lod=0, frame=f)
    return f


def hurdle_fence(ms, pts, h=0.1, step=0.12, mat='wattle', lod=1):
    """Woven wattle hurdles between stakes along a polyline."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        ms.box(mat, (L, 0.014, h), at=((x0 + x1) / 2, (y0 + y1) / 2, G), rot_z=a, lod=lod)
        n = max(1, int(L / step))
        for k in range(n + 1):
            t = k / n
            ms.cyl('pole', 0.007, 0.006, h + 0.025, at=(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, G), segs=4, lod=0, caps=False)


def palisade(ms, rng, pts, h=(0.22, 0.3), gap=0.05, r=(0.014, 0.019), lod=1, mat='pole'):
    """Sharpened stakes along a polyline, about `gap` apart."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        n = max(1, int(L / gap))
        for k in range(n):
            t = (k + 0.5) / n
            sh, rr = rng.uniform(*h), rng.uniform(*r)
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            ms.cyl(mat, rr, rr * 0.92, sh, at=(x, y, G - 0.01), segs=5, lod=lod, caps=False)
            ms.cyl(mat, rr * 0.92, 0.0, 0.04, at=(x, y, G - 0.01 + sh), segs=5, lod=0, caps=False)


def earth_bank(ms, pts, w=0.12, h=0.06, mat='turf', lod=2):
    """A low earthwork bank along a polyline: a trapezoid ridge of turf, a ditch outside drawn dark."""
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        L = math.hypot(x1 - x0, y1 - y0)
        a = math.degrees(math.atan2(y1 - y0, x1 - x0))
        ms.box(mat, (L + w * 0.5, w, h), at=((x0 + x1) / 2, (y0 + y1) / 2, G - 0.01), rot_z=a, lod=lod, taper=0.55)


def drying_rack(ms, x, y, yaw=0.0, w=0.26, h=0.16, hang='hide', n=3, lod=1):
    """Two forked posts and a cross pole, hides or meat strips hung over it."""
    f = frame(x, y, yaw)
    for sx in (-1, 1):
        ms.cyl('pole', 0.008, 0.007, h, at=(sx * w / 2, 0, G), segs=5, lod=lod, frame=f, caps=False)
    ms.cyl('pole', 0.006, 0.006, w + 0.04, at=(-w / 2 - 0.02, 0, G + h), rot=(0, 90, 0), segs=5, lod=lod, frame=f, caps=False)
    for k in range(n):
        x0 = -w / 2 + w * (k + 0.5) / n
        if hang == 'meat':
            ms.box('meat', (0.022, 0.01, 0.07), at=(x0, 0, G + h - 0.07), lod=0, frame=f, taper=0.6)
        else:
            ms.box(hang, (w / n * 0.8, 0.008, h * 0.6), at=(x0, 0, G + h * 0.4), lod=0 if k else lod, frame=f)


def pot(ms, x, y, s=1.0, mat='terracotta', z=G):
    """A round-bottomed clay pot."""
    ms.lathe(mat, [(0.0, 0.0), (0.02 * s, 0.006 * s), (0.03 * s, 0.025 * s), (0.024 * s, 0.05 * s), (0.02 * s, 0.056 * s)], at=(x, y, z), segs=7, lod=0)


def basket(ms, x, y, s=1.0, z=G):
    ms.cyl('wattle', 0.028 * s, 0.034 * s, 0.04 * s, at=(x, y, z), segs=7, lod=0)


def standing_stone(ms, x, y, h=0.22, w=0.07, mat='fieldstone', yaw=0.0, lod=1, lean=0.0, bevel=0.0):
    f = frame(x, y, yaw) @ Matrix.Rotation(math.radians(lean), 4, 'X')
    ms.box(mat, (w, w * 0.6, h), at=(0, 0, G - 0.01), lod=lod, frame=f, taper=0.7, bevel=bevel)


def totem(ms, x, y, h=0.6, team=True, lod=1):
    """A carved pole: ochre bands, a horned skull at the top, a team pennant below it."""
    ms.cyl('timber', 0.02, 0.016, h, at=(x, y, G), segs=7, lod=lod)
    for k in range(3):
        ms.cyl('ochre', 0.022, 0.021, 0.02, at=(x, y, G + h * (0.35 + 0.18 * k)), segs=7, lod=0, caps=False)
    ms.box('bone', (0.04, 0.035, 0.035), at=(x, y - 0.01, G + h - 0.01), lod=0, taper=0.7)
    for sx in (-1, 1):
        pole(ms, 'bone', (x + sx * 0.015, y - 0.01, G + h + 0.015), (x + sx * 0.06, y - 0.01, G + h + 0.06), r=0.005, segs=4, lod=0)
    if team:
        tt.pennant(ms, tm.house_frame(0, 0, 0), x, y, G + h - 0.06, yaw=-150, lod=2, w=0.16, h=0.1)
    return (x, y, G + h + 0.02)


def fire_pit(ms, rng, x, y, r=0.08, n=9, mat='fieldstone'):
    f = frame(x, y)
    ms.cyl('ash', r * 0.85, r * 0.8, 0.008, at=(0, 0, G), segs=10, lod=1, frame=f)
    for i in range(n):
        a = 2 * math.pi * i / n
        ms.sphere(mat, 0.022, at=(r * math.cos(a), r * math.sin(a), G + 0.006), scale=(1.1, 0.9, 0.7), u=5, v=3, lod=0, frame=f)
    for k in range(3):
        ms.cyl('timber', 0.008, 0.008, 0.1, at=(-0.045, 0, G + 0.012), rot=(0, 80, 0), segs=4, lod=0, frame=f @ frame(0, 0, 60 * k))


def log_seat(ms, x, y, yaw=0.0, L=0.18):
    ms.cyl('bark', 0.022, 0.022, L, at=(0, 0, G + 0.02), rot=(0, 90, 0), segs=6, lod=0, frame=frame(x, y, yaw) @ frame(-L / 2, 0, 0))


def pole_stack(ms, x, y, yaw=0.0, L=0.4, n=6, mat='pole'):
    f = frame(x, y, yaw)
    for k in range(n):
        row = 0 if k < 3 else 1 if k < 5 else 2
        i = k if k < 3 else k - 3 if k < 5 else 0
        dx = (-0.02 + 0.02 * i) if row == 0 else (-0.01 + 0.02 * i) if row == 1 else 0
        ms.cyl(mat, 0.009, 0.009, L, at=(dx, -L / 2, G + 0.009 + 0.016 * row), rot=(-90, 0, 0), segs=5, lod=1 if k < 3 else 0, frame=f)


def clutter(ms, rng, x, y, n=6, spread=0.08):
    """Pots, baskets, a fur and a stone or two round a spot (LOD0 detail only)."""
    for k in range(n):
        px, py = x + rng.uniform(-spread, spread), y + rng.uniform(-spread, spread)
        c = k % 4
        if c == 0:
            pot(ms, px, py, rng.uniform(1.0, 1.5))
        elif c == 1:
            basket(ms, px, py, rng.uniform(0.9, 1.3))
        elif c == 2:
            ms.box('fur', (0.07, 0.05, 0.006), at=(px, py, G), rot_z=rng.uniform(0, 180), lod=0)
        else:
            rock(ms, 'fieldstone', px, py, rng.uniform(0.015, 0.025), rng, lod=0)


def woodpile(ms, x, y, yaw=0.0, L=0.16, rows=3):
    """Split firewood stacked between two stakes."""
    f = frame(x, y, yaw)
    for r in range(rows):
        for k in range(rows + 1 - r):
            ms.cyl('timber', 0.011, 0.011, L, at=(-0.011 * (rows - r) + 0.022 * k, -L / 2, G + 0.011 + 0.019 * r), rot=(-90, 0, 0), segs=5, lod=0 if r else 1, frame=f, caps=r == rows - 1)
    for sx in (-1, 1):
        ms.cyl('pole', 0.005, 0.005, 0.08, at=(sx * 0.05, 0, G), segs=3, lod=0, frame=f, caps=False)
