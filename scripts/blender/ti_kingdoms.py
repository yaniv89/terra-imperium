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
