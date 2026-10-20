# scripts/blender/build_rts_stone.py
# The Stone Age battle buildings, src/assets/battle/rts/rts-stone.glb (plans/2026-10-20-001-feat-
# eight-ages-plan.md U87, KTD16; src/assets/battle/rts/README.md): the 13 roles of a battle economy
# plus the `house` (the Hut), each whole, `-damaged` (under 70% HP) and `-ruined`, with LOD0..LOD2,
# their sockets and the four construction stages. The Stone names (plan Appendix C): Fire Circle
# (camp), Longhouse (town hall), Hut (house), Storage Pit (food depot, a smokehouse and lidded pits),
# Stone Pile (materials yard), Barter Ground (trade post), Garden Plot (farm), Flint Pit (mine),
# Warrior Lodge (barracks), Hunters' Camp (range), an animal pen for the stable (not offered in a
# Stone battle; kept so the file has every role), Ladder Yard (siege workshop), Healer's Hut (aid
# post: the shaman's lodge) and Lookout (tower). Round huts of wattle and daub, hide and thatch,
# palisades and earth banks, stone-tool work places (ti_stone.py).
# The structure, sockets, damage, wreck and grounding are build_rts_bronze.py's (imported).
#   blender -b --factory-startup -P scripts/blender/build_rts_stone.py -- [out_dir] [atlas_px]
#   COUNT=1 ... prints the triangles per object and LOD without baking; ONLY=role,role builds a few.
# Scale 1 unit = 10 m, the entrance faces Blender -Y, origin at the footprint centre on Z = 0.
import inspect
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_stone as ts  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
from ti_town import G  # noqa: E402
from ti_stone import hut, pole, frame  # noqa: E402

STYLE = 'base'  # build_rts_skins_stone.py sets a region's style before building
flag_pole = rb.flag_pole
# hides and furs burn like cloth in the wreck
rb.RUIN_CLOTH = tuple(rb.RUIN_CLOTH) + ('hide', 'fur', 'meat')


def S():
    return ts.STYLES[STYLE]


def remat(layout, mapping):
    def build(ms, rng):
        sockets = layout(ms, rng)
        ms.parts[:] = [(bm, mapping.get(mat, mat), lod, only) for bm, mat, lod, only in ms.parts]
        return sockets
    build.__doc__ = layout.__doc__
    return build


def damage_mats():
    """The Bronze damage helper's rubble is mud brick: here it is the style's own wall stuff."""
    return {'mudwall': S()['wall'] if S()['wall'] not in ('hide', 'hide_dark') else 'turf', 'pylon': S()['stone']}


def spear_rack(ms, x, y, yaw=0.0, n=5):
    """A pole rack of flint-tipped spears."""
    f = frame(x, y, yaw)
    for sx in (-0.12, 0.12):
        ms.cyl('pole', 0.009, 0.008, 0.12, at=(sx, 0, G), segs=5, lod=1, frame=f, caps=False)
    ms.cyl('pole', 0.007, 0.007, 0.28, at=(-0.14, 0, G + 0.11), rot=(0, 90, 0), segs=5, lod=1, frame=f, caps=False)
    for k in range(n):
        lx = -0.1 + 0.2 * k / (n - 1)
        bot, top = f @ Vector((lx, -0.03, G)), f @ Vector((lx, 0.04, G + 0.3))
        pole(ms, 'pole', bot, top, r=0.005, segs=4, lod=0)
        tip = top + (top - bot).normalized() * 0.035
        pole(ms, 'flint', top, tip, r=0.008, segs=3, lod=0)


def shield_rack(ms, x, y, yaw=0.0, n=3):
    """Round hide shields on a pole rack (team painted)."""
    f = frame(x, y, yaw)
    ms.cyl('pole', 0.006, 0.006, 0.26, at=(-0.13, 0.01, G + 0.09), rot=(0, 90, 0), segs=5, lod=1, frame=f, caps=False)
    for sx in (-0.12, 0.12):
        ms.cyl('pole', 0.008, 0.007, 0.1, at=(sx, 0.01, G), segs=5, lod=1, frame=f, caps=False)
    for k in range(n):
        ms.cyl('hide', 0.045, 0.045, 0.01, at=(-0.08 + 0.08 * k, 0.0, G + 0.05), rot=(80, 0, 0), segs=9, lod=0, frame=f)
        ms.cyl('team_cloth', 0.016, 0.016, 0.004, at=(-0.08 + 0.08 * k, -0.011, G + 0.052), rot=(80, 0, 0), segs=7, lod=0, frame=f)


def lean_to(ms, x, y, w, d, h_front, h_back, mat='brush', yaw=0.0, lod=2):
    """A sloping roof on forked poles, open at the front."""
    f = frame(x, y, yaw)
    for sx in (-w / 2 + 0.02, w / 2 - 0.02):
        ms.cyl('pole', 0.01, 0.009, h_front, at=(sx, -d / 2 + 0.02, G), segs=5, lod=1, frame=f, caps=False)
        ms.cyl('pole', 0.01, 0.009, h_back, at=(sx, d / 2 - 0.02, G), segs=5, lod=1, frame=f, caps=False)
    slope = math.atan2(h_back - h_front, d)
    rf = f @ Matrix.Translation(Vector((0, 0, G + (h_front + h_back) / 2 + 0.01))) @ Matrix.Rotation(slope, 4, 'X')
    ms.box(mat, (w + 0.06, d / math.cos(slope) + 0.06, 0.025), at=(0, 0, 0), lod=lod, frame=rf)
    return f


def target(ms, x, y):
    """A bundle of grass bound on two stakes, a team painted mark."""
    f = frame(x, y)
    for sx in (-0.05, 0.05):
        ms.cyl('pole', 0.007, 0.006, 0.2, at=(sx, 0.02, G), segs=4, lod=1, frame=f, caps=False)
    ms.cyl('grass_thatch', 0.07, 0.07, 0.07, at=(0, 0.035, G + 0.14), rot=(90, 0, 0), segs=9, lod=1, frame=f)
    ms.cyl('team_cloth', 0.03, 0.03, 0.005, at=(0, -0.037, G + 0.14), rot=(90, 0, 0), segs=7, lod=1, frame=f)


def ladder(ms, x, y, h, yaw=0.0, lean=0.0, w=0.07, rungs=6, z=G, lod=1, flat=False):
    """A pole ladder lashed with rungs; `flat` lays it on the ground."""
    f = frame(x, y, yaw)
    if flat:
        f = f @ Matrix.Translation(Vector((0, 0, z + 0.01))) @ Matrix.Rotation(math.radians(-90), 4, 'X')
        z0 = 0.0
    else:
        f = f @ Matrix.Translation(Vector((0, 0, z))) @ Matrix.Rotation(math.radians(-lean), 4, 'X')
        z0 = 0.0
    for sx in (-w / 2, w / 2):
        ms.cyl('pole', 0.007, 0.006, h, at=(sx, 0, z0), segs=4, lod=lod, frame=f, caps=False)
    for k in range(rungs):
        ms.cyl('pole', 0.004, 0.004, w, at=(-w / 2, 0, z0 + h * (k + 0.6) / (rungs + 0.4)), rot=(0, 90, 0), segs=3, lod=0, frame=f, caps=False)


def rock_pile(ms, x, y, rng, n=8, r=0.04, spread=0.12, mat='fieldstone', lod_base=2):
    """A heap of field stones: a mound under it (every LOD) and stones on it."""
    ms.sphere(mat, spread * 1.05, at=(x, y, G - 0.01), scale=(1.15, 1.0, 0.55), u=8, v=4, cut_below=0.0, lod=lod_base)
    for k in range(n):
        a, d = rng.uniform(0, 6.28), rng.uniform(0, spread)
        ts.rock(ms, mat, x + math.cos(a) * d, y + math.sin(a) * d, r * rng.uniform(0.7, 1.2), rng, z=G + 0.5 * spread * (1 - d / spread) * 0.9, lod=1 if k < 3 else 0)


def hip_roof(ms, f, L, W, z0, h, mat, ov=0.06, hip=0.8, lod=2, only=None, lip=0.025):
    """A hipped roof as a closed solid: an eave lip, two long slopes, two hipped ends."""
    bm = bmesh.new()
    a, b = L / 2 + ov, W / 2 + ov
    lo = [bm.verts.new(p) for p in ((-a + 0.01, -b + 0.01, z0 - lip), (a - 0.01, -b + 0.01, z0 - lip), (a - 0.01, b - 0.01, z0 - lip), (-a + 0.01, b - 0.01, z0 - lip))]
    hi = [bm.verts.new(p) for p in ((-a, -b, z0), (a, -b, z0), (a, b, z0), (-a, b, z0))]
    rx = max(0.0, a - b * hip)
    r0, r1 = bm.verts.new((-rx, 0, z0 + h)), bm.verts.new((rx, 0, z0 + h))
    bm.faces.new(list(reversed(lo)))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new((hi[0], hi[1], r1, r0))
    bm.faces.new((hi[2], hi[3], r0, r1))
    bm.faces.new((hi[1], hi[2], r1))
    bm.faces.new((hi[3], hi[0], r0))
    bm.normal_update()
    ms.add(bm, mat, lod, f, only=only)


def roof_only(ms, f, r, z, style=None):
    """A hut's roof alone (the Lookout's cap) in the style's form."""
    st = ts.STYLES[style or STYLE]
    form = st['form']
    if form == 'pit':
        ms.cyl(st['roof'], r * 1.25, 0.0, r * 1.0, at=(0, 0, z), segs=4, lod=2, frame=f @ Matrix.Rotation(math.radians(45), 4, 'Z'))
    elif form in ('dome', 'bone'):
        ts.rdome(ms, st['roof'], r * 1.1, at=(0, 0, z), scale=(1, 1, 0.7), u=10, v=4, frame=f)
    elif form == 'tipi':
        ts.rcyl(ms, st['roof'], r * 1.05, r * 0.1, r * 1.6, at=(0, 0, z), segs=10, frame=f, caps=False)
        for k in range(5):
            a = 2 * math.pi * (k + 0.3) / 5
            pole(ms, st['post'], (math.cos(a) * r, math.sin(a) * r, z), (-math.cos(a) * r * 0.2, -math.sin(a) * r * 0.2, z + r * 1.9), r=0.005, segs=4, lod=0, f=f)
    else:
        ts.rcyl(ms, st['roof'], r * 1.25, 0.0, r * st['pitch'], at=(0, 0, z), segs=12, frame=f)


# ---- the roles ------------------------------------------------------------------------------------
# Each returns its sockets: {name: (x, y, z)} (z from the ground before the G shift).

def expedition_camp(ms, rng):
    """22 x 22 m, the Fire Circle: a ring of standing stones round a great hearth with log seats, the
    chief's hut behind it, hide tents in a ring, drying racks of hides, a carved pole with the side's
    pennant, stacked poles and a half-built stake palisade at the back."""
    fx, fy = 0.0, -0.12
    ts.fire_pit(ms, rng, fx, fy, r=0.13, n=12)
    for k in range(3):  # the hearth's big flat stones
        a = 2 * math.pi * k / 3 + 0.4
        ms.box('fieldstone', (0.07, 0.05, 0.02), at=(fx + math.cos(a) * 0.19, fy + math.sin(a) * 0.19, G), rot_z=math.degrees(a), lod=0)
    for i in range(11):  # the standing stones, a gap at the front
        a = math.radians(-90 + 25 + (360 - 50) * i / 10)
        ts.standing_stone(ms, fx + math.cos(a) * 0.46, fy + math.sin(a) * 0.46, h=rng.uniform(0.17, 0.27), w=rng.uniform(0.06, 0.08), yaw=math.degrees(a) + 90, lean=rng.uniform(-6, 6), lod=2 if i % 2 == 0 else 1, bevel=0.008)
    for i in range(26):  # a kerb of small stones round the circle's floor
        a = 2 * math.pi * i / 26
        if abs(math.degrees(a) - 270) > 14:
            ts.rock(ms, 'fieldstone', fx + math.cos(a) * 0.38, fy + math.sin(a) * 0.38, 0.018, rng, lod=0)
    ts.hurdle_fence(ms, [(-0.98, 0.72), (-0.98, 0.98), (-0.62, 0.98)], h=0.07, step=0.09)  # a dog pen
    ts.drying_rack(ms, 0.95, -0.55, 90, w=0.26, h=0.15)
    ts.drying_rack(ms, -0.95, -0.55, 90, w=0.26, h=0.15, hang='fur')
    ts.clutter(ms, rng, -0.55, 0.28, n=6, spread=0.08)
    ts.clutter(ms, rng, 0.5, 0.25, n=6, spread=0.08)
    for i in range(6):  # log seats inside the ring
        a = math.radians(30 + 60 * i)
        ts.log_seat(ms, fx + math.cos(a) * 0.3, fy + math.sin(a) * 0.3, yaw=math.degrees(a) + 90)
    hut(ms, 0, 0.62, r=0.3, yaw=0, style=STYLE, team=True, detail=2, rng=rng)
    for sx in (-1, 1):  # two sleeping huts at the sides
        hut(ms, sx * 0.82, -0.12, r=0.19, yaw=tm.facing_centre(sx * 0.82, -0.12), style=STYLE, rng=rng)
        ts.clutter(ms, rng, sx * 0.62, -0.22, n=5, spread=0.06)
        ts.woodpile(ms, sx * 0.95, 0.15, yaw=90)
    for x, y in [(-0.72, 0.52), (0.72, 0.52), (-0.6, -0.78), (0.6, -0.78)]:
        ts.hide_tent(ms, x, y, yaw=tm.facing_centre(x, y), mat='hide' if (x * y) > 0 else 'hide_dark', detail=1)
    for k in range(4):  # spears stuck in the ground by the pole, a tripod and pot over the hearth
        pole(ms, 'pole', (-0.42 + 0.03 * k, -0.62 + 0.01 * k, G), (-0.44 + 0.04 * k, -0.6, G + 0.3), r=0.004, segs=3, lod=0)
        pole(ms, 'flint', (-0.44 + 0.04 * k, -0.6, G + 0.3), (-0.445 + 0.043 * k, -0.6, G + 0.33), r=0.007, segs=3, lod=0)
    for k in range(3):
        a = 2 * math.pi * k / 3
        pole(ms, 'pole', (fx + math.cos(a) * 0.12, fy + math.sin(a) * 0.12, G), (fx, fy, G + 0.2), r=0.006, segs=4, lod=0)
    ts.pot(ms, fx, fy, 1.6, z=G + 0.07)
    ts.clutter(ms, rng, 0.0, 0.3, n=6, spread=0.12)
    ts.drying_rack(ms, -0.3, 0.95, 0, w=0.3, h=0.17)
    ts.drying_rack(ms, 0.36, 0.95, 0, w=0.26, h=0.15, hang='meat', n=5)
    for k in range(5):
        ts.pot(ms, -0.22 + rng.uniform(-0.05, 0.05), -0.88 + rng.uniform(-0.04, 0.04), rng.uniform(1.1, 1.5))
    for k in range(3):
        ts.basket(ms, 0.2 + 0.07 * k, -0.9 + 0.02 * (k % 2), 1.2)
    ts.pole_stack(ms, 0.96, 0.82, 90, L=0.4)
    back = [(-1.0 + 0.07 * i, 1.08 + rng.uniform(-0.01, 0.01)) for i in range(29)]
    for i in range(len(back) - 1):
        if not 11 <= i <= 17:
            ts.palisade(ms, rng, [back[i], back[i + 1]], gap=0.07)
    ts.earth_bank(ms, [(-1.02, 1.0), (1.02, 1.0)], w=0.1, h=0.04)
    top = ts.totem(ms, -0.32, -0.66, h=0.62)
    return {'socket-door': (0, 0.28, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (-0.2, -0.95, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.62, 0.35), 'socket-fire-2': (-0.74, 0.5, 0.15), 'socket-fire-3': (0.74, 0.5, 0.15), 'socket-fire-4': (0.6, -0.78, 0.15), 'socket-smoke-1': (fx, fy, 0.1)}


def town_hall(ms, rng):
    """20 x 20 m, the Longhouse: a long wattle-and-daub hall under a hipped thatch roof, posts along
    its walls, a porch with the side's hanging and a skull over the door, in a court ringed by an
    earth bank and a stake palisade with a gate of tall posts; a granary hut, a hearth, racks."""
    L, W, wh = 1.36, 0.5, 0.17
    hf = frame(0, 0.36, 0)
    ms.box(S()['wall'] if S()['form'] == 'cone' else 'daub', (L, W, wh), at=(0, 0, G), lod=2, frame=hf, bevel=0.006)
    ms.box(S()['stone'], (L + 0.03, W + 0.03, 0.03), at=(0, 0, G - 0.005), lod=1, frame=hf)
    for k in range(15):  # wall posts along both long sides
        x = -L / 2 + L * k / 14
        for sy in (-1, 1):
            ms.cyl('timber', 0.016, 0.014, wh + 0.02, at=(x, sy * (W / 2 + 0.01), G), segs=6, lod=1 if k % 7 == 0 else 0, frame=hf, caps=False)
    hip_roof(ms, hf, L, W, G + wh, 0.46, 'thatch_st', ov=0.09, hip=0.75, lod=2)
    for sy in (-1, 1):  # the bound eave rolls along the long sides
        ms.cyl('thatch_st', 0.018, 0.018, L + 0.16, at=(-(L + 0.16) / 2, sy * (W / 2 + 0.085), G + wh - 0.012), rot=(0, 90, 0), segs=8, lod=0, frame=hf)
    for sx in (-1, 1):  # wattle showing where the daub has worn off the ends
        ms.box('wattle', (0.006, W * 0.5, wh * 0.45), at=(sx * (L / 2 + 0.002), 0.04, G + 0.05), lod=0, frame=hf)
        for k in range(5):
            ms.cyl('pole', 0.006, 0.006, wh * 0.5, at=(sx * (L / 2 + 0.004), -W * 0.2 + W * 0.12 * k, G + 0.045), segs=4, lod=0, frame=hf, caps=False)
    # a second course of thatch half way up, the ridge bound with poles, two smoke holes
    hip_roof(ms, hf @ Matrix.Translation(Vector((0, 0, 0.0))), L * 0.62, W * 0.45, G + wh + 0.24, 0.22, 'thatch_st', ov=0.06, hip=0.75, lod=0, lip=0.02)
    ms.cyl('pole', 0.014, 0.014, L * 0.55, at=(-L * 0.275, 0, G + wh + 0.47), rot=(0, 90, 0), segs=6, lod=1, frame=hf)
    for k in range(7):
        x = -L * 0.27 + L * 0.54 * k / 6
        for sy in (-1, 1):
            pole(ms, 'pole', (x, sy * 0.04, G + wh + 0.43), (x, -sy * 0.03, G + wh + 0.5), r=0.006, segs=4, lod=0, f=hf)
    for sx in (-0.3, 0.3):
        ms.box('dark', (0.06, 0.05, 0.02), at=(sx, -0.08, G + wh + 0.36), lod=0, frame=hf)
    # the porch: posts and a small thatched gable at the door, the side's hanging, a skull above
    pf = hf @ frame(0, -W / 2 - 0.09, 0)
    for sx in (-0.09, 0.09):
        ms.cyl('timber', 0.017, 0.015, 0.2, at=(sx, -0.03, G), segs=6, lod=1, frame=pf, caps=False)
    for sy in (-1, 1):
        rf = pf @ Matrix.Translation(Vector((sy * 0.07, 0.04, G + 0.22))) @ Matrix.Rotation(math.radians(sy * 32), 4, 'Y')
        ms.box('thatch_st', (0.16, 0.2, 0.022), at=(0, 0, 0), lod=1, frame=rf)
    ms.box('dark', (0.12, 0.02, 0.15), at=(0, 0.09, G), lod=1, frame=pf)
    ms.box('team_cloth', (0.13, 0.01, 0.1), at=(0, 0.075, G + 0.05), lod=1, frame=pf)
    ms.box('bone', (0.05, 0.03, 0.04), at=(0, 0.08, G + 0.17), lod=0, frame=pf, taper=0.7)
    for sx in (-1, 1):
        pole(ms, 'bone', (sx * 0.02, 0.07, G + 0.2), (sx * 0.08, 0.06, G + 0.25), r=0.006, segs=4, lod=0, f=pf)
    # ochre bands painted on the daub either side of the door
    for sx in (-1, 1):
        ms.box('ochre', (0.36, 0.006, 0.02), at=(sx * 0.32, -W / 2 - 0.002, G + 0.12), lod=0, frame=hf)
    # the court: an earth bank with a stake palisade on it, a gate gap at the front
    ring = [(-0.17, -0.92), (-0.96, -0.92), (-0.96, 0.96), (0.96, 0.96), (0.96, -0.92), (0.17, -0.92)]
    ts.earth_bank(ms, ring, w=0.11, h=0.055)
    ts.palisade(ms, rng, ring, h=(0.2, 0.26), gap=0.05, lod=1)
    for sx in (-1, 1):  # the gate's tall posts, a skull on each
        ms.cyl('timber', 0.024, 0.02, 0.4, at=(sx * 0.17, -0.92, G), segs=7, lod=2)
        ms.box('bone', (0.04, 0.035, 0.035), at=(sx * 0.17, -0.94, G + 0.36), lod=0, taper=0.7)
    hut(ms, 0.64, -0.5, r=0.18, yaw=tm.facing_centre(0.64, -0.5), style=STYLE, detail=2, rng=rng)
    hut(ms, -0.68, 0.0, r=0.16, yaw=90, style=STYLE, detail=2, rng=rng)
    ts.clutter(ms, rng, -0.5, 0.02, n=6, spread=0.06)
    ts.drying_rack(ms, 0.2, -0.62, 0, w=0.24, hang='meat', n=5)
    ts.hurdle_fence(ms, [(0.45, -0.1), (0.85, -0.1), (0.85, 0.12), (0.45, 0.12), (0.45, 0.0)], h=0.08, step=0.1)
    for k in range(3):
        ms.sphere('grass_thatch', 0.04, at=(0.55 + 0.1 * k, 0.03, G), scale=(1.2, 1, 0.7), u=7, v=4, cut_below=0.0, lod=0)
    ts.clutter(ms, rng, -0.2, -0.62, n=8, spread=0.1)
    ts.clutter(ms, rng, 0.45, 0.82, n=6, spread=0.08)
    ts.woodpile(ms, -0.88, 0.55, yaw=90, L=0.2, rows=4)
    ts.woodpile(ms, 0.4, -0.15, yaw=0, L=0.18, rows=3)
    ts.fire_pit(ms, rng, -0.45, -0.45, r=0.08)
    ts.drying_rack(ms, -0.62, -0.7, 20, w=0.24)
    for k in range(4):
        ts.pot(ms, -0.75 + 0.06 * k, 0.86, 1.3)
    ts.pole_stack(ms, 0.75, 0.86, 0, L=0.3)
    top = ts.totem(ms, -0.32, -0.75, h=0.85)
    return {'socket-door': (0, -0.95, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (0.3, -0.98, 0), 'socket-banner': top,
            'socket-fire-1': (-0.35, 0.36, 0.45), 'socket-fire-2': (0.35, 0.36, 0.45), 'socket-fire-3': (0.64, -0.5, 0.3), 'socket-fire-4': (-0.62, -0.7, 0.15), 'socket-smoke-1': (-0.3, 0.3, 0.6)}


def house(ms, rng):
    """7 x 7 m, the Hut: one round hut, a woodpile and pots by the door, a fire outside."""
    hut(ms, 0, 0.06, r=0.27, yaw=0, style=STYLE, rng=rng)
    ts.pole_stack(ms, 0.36, -0.12, 90, L=0.22, n=5)
    for k in range(3):
        ts.pot(ms, -0.3 + 0.05 * k, -0.28 + 0.02 * (k % 2), 1.2)
    ts.fire_pit(ms, rng, 0.12, -0.42, r=0.06, n=7)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.6, 0),
            'socket-fire-1': (0, 0.06, 0.35), 'socket-fire-2': (-0.15, 0.1, 0.25), 'socket-fire-3': (0.15, 0.0, 0.25), 'socket-fire-4': (0.36, -0.12, 0.05), 'socket-smoke-1': (0, 0.06, 0.45)}


def food_depot(ms, rng):
    """10 x 10 m, the Storage Pit: a low smokehouse of daub and thatch with meat and fish hung to
    smoke, three storage pits under wicker and clay lids, a granary hut raised on posts, baskets."""
    f = frame(-0.12, 0.22, 0)
    ms.box('daub', (0.48, 0.32, 0.14), at=(0, 0, G), lod=2, frame=f, bevel=0.005)
    hip_roof(ms, f, 0.48, 0.32, G + 0.14, 0.2, S()['roof'] if S()['roof'] != 'hide_dark' else 'thatch_st', ov=0.05, hip=0.9, lod=2)
    ms.box('dark', (0.08, 0.04, 0.03), at=(0, 0, G + 0.31), lod=0, frame=f)
    ms.box('dark', (0.1, 0.02, 0.12), at=(0, -0.165, G), lod=1, frame=f)
    ts.drying_rack(ms, -0.2, -0.22, 0, w=0.26, h=0.15, hang='meat', n=6)
    for k, (x, y) in enumerate([(0.12, -0.3), (0.3, -0.12), (0.34, -0.36)]):  # the pits
        ms.cyl('dark', 0.07, 0.07, 0.004, at=(x, y, G), segs=10, lod=1)
        ms.cyl(S()['stone'] if S()['stone'] != 'turf' else 'chalk', 0.09, 0.085, 0.018, at=(x, y, G - 0.004), segs=10, lod=2, caps=False)
        if k != 1:
            ms.cyl('wattle', 0.075, 0.07, 0.012, at=(x + 0.01, y, G + 0.012), segs=10, lod=0)
            ms.sphere('mud', 0.06, at=(x + 0.01, y, G + 0.022), scale=(1, 1, 0.25), u=8, v=3, cut_below=0.0, lod=0)
    gf = frame(0.3, 0.3, 0)  # the raised granary
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('timber', 0.012, 0.012, 0.1, at=(sx * 0.07, sy * 0.07, G), segs=5, lod=1, frame=gf, caps=False)
    ms.box('pole', (0.2, 0.2, 0.015), at=(0, 0, G + 0.1), lod=2, frame=gf)
    ts.rcyl(ms, 'wattle', 0.09, 0.09, 0.1, at=(0, 0, G + 0.115), segs=10, frame=gf, caps=False)
    ts.rcyl(ms, S()['roof'], 0.13, 0.0, 0.14, at=(0, 0, G + 0.2), segs=10, frame=gf)
    for k in range(4):
        ts.basket(ms, -0.4 + 0.06 * k, -0.42 + 0.02 * (k % 2), 1.2)
    ts.pot(ms, 0.06, 0.0, 1.4)
    return {'socket-door': (0, -0.48, 0), 'socket-rally': (0, -0.8, 0), 'socket-drop': (-0.1, -0.45, 0),
            'socket-fire-1': (-0.12, 0.22, 0.3), 'socket-fire-2': (0.3, 0.3, 0.3), 'socket-fire-3': (0.3, -0.12, 0.05), 'socket-fire-4': (-0.2, -0.22, 0.12), 'socket-smoke-1': (-0.12, 0.22, 0.36)}


def materials_yard(ms, rng):
    """10 x 10 m, the Stone Pile: heaps of field stones, a log sledge loaded with a block on rollers,
    stacked poles, levers and a hurdle fence."""
    hurdle = [(-0.12, -0.46), (-0.46, -0.46), (-0.46, 0.46), (0.46, 0.46), (0.46, -0.46), (0.12, -0.46)]
    ts.hurdle_fence(ms, hurdle, h=0.08, step=0.15)
    rock_pile(ms, -0.2, 0.18, rng, n=12, r=0.045, spread=0.16)
    rock_pile(ms, 0.22, 0.26, rng, n=8, r=0.04, spread=0.12)
    sf = frame(0.18, -0.16, 15)  # the sledge on rollers
    for sx in (-1, 1):
        ms.box('timber', (0.03, 0.34, 0.025), at=(sx * 0.07, 0, G + 0.02), lod=1, frame=sf)
    for sy in (-0.12, 0.0, 0.12):
        ms.cyl('pole', 0.013, 0.013, 0.24, at=(-0.12, sy, G + 0.013), rot=(0, 90, 0), segs=6, lod=0, frame=sf)
    ms.box(S()['stone'] if S()['stone'] not in ('turf', 'loess', 'redmud') else 'fieldstone', (0.15, 0.2, 0.1), at=(0, 0.0, G + 0.045), lod=2, frame=sf, bevel=0.01)
    ts.pole_stack(ms, -0.28, -0.22, 0, L=0.36, n=6)
    for k in range(2):
        pole(ms, 'pole', (0.02 + 0.06 * k, -0.4, G), (0.12 + 0.05 * k, -0.3, G + 0.1), r=0.008, segs=4, lod=0)
    for k in range(3):
        ts.basket(ms, -0.05 + 0.06 * k, 0.4, 1.1)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -0.85, 0), 'socket-drop': (0, -0.4, 0),
            'socket-fire-1': (-0.28, -0.22, 0.08), 'socket-fire-2': (0.18, -0.16, 0.12), 'socket-fire-3': (-0.2, 0.18, 0.1), 'socket-fire-4': (0.22, 0.26, 0.1), 'socket-smoke-1': (-0.28, -0.22, 0.15)}


def awning(ms, x, y, w=0.3, d=0.22, h=0.17, mat='hide', yaw=0.0, team=True):
    """A hide awning on four poles, the side's colour along its front edge, a mat of goods under it."""
    f = frame(x, y, yaw)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('pole', 0.008, 0.007, h + (0.03 if sy > 0 else 0), at=(sx * w / 2, sy * d / 2, G), segs=5, lod=1, frame=f, caps=False)
    rf = f @ Matrix.Translation(Vector((0, 0, G + h + 0.015))) @ Matrix.Rotation(math.atan2(0.03, d), 4, 'X')
    ms.box(mat, (w + 0.04, d + 0.04, 0.008), at=(0, 0, 0), lod=2, frame=rf)
    if team:
        ms.box('team_cloth', (w + 0.04, 0.008, 0.04), at=(0, -d / 2 - 0.02, G + h - 0.035), lod=1, frame=f)
    ms.box('fur', (w * 0.85, d * 0.7, 0.006), at=(0, 0, G), lod=1, frame=f)
    return f


def trade_post(ms, rng):
    """14 x 14 m, the Barter Ground: a storehouse hut behind three hide awnings over mats of goods
    (pots, furs, flint blades, shells), a standing stone where bargains are struck, a carved pole."""
    hut(ms, 0, 0.45, r=0.25, yaw=0, style=STYLE, rng=rng)
    goods = ['pot', 'flint', 'bone', 'fur']
    for i, (x, y) in enumerate([(-0.46, -0.1), (0.46, -0.1), (-0.3, -0.5)]):
        f = awning(ms, x, y, mat=S()['awning'] or ('hide' if i % 2 == 0 else 'hide_dark'), yaw=tm.facing_centre(x, y) * 0.3)
        for k in range(4):
            g = goods[(i + k) % 4]
            lx, ly = -0.1 + 0.07 * k, rng.uniform(-0.05, 0.05)
            p = f @ Vector((lx, ly, 0))
            if g == 'pot':
                ts.pot(ms, p.x, p.y, 1.2, z=G + 0.006)
            elif g == 'flint':
                ms.box('flint', (0.04, 0.02, 0.01), at=(p.x, p.y, G + 0.006), rot_z=rng.uniform(0, 90), lod=0)
            elif g == 'bone':
                ms.sphere('bone', 0.015, at=(p.x, p.y, G + 0.01), scale=(1.4, 1, 0.6), u=6, v=3, lod=0)
            else:
                ms.box('fur', (0.05, 0.04, 0.015), at=(p.x, p.y, G + 0.006), rot_z=rng.uniform(0, 90), lod=0)
    ts.standing_stone(ms, 0.12, -0.32, h=0.26, w=0.08, lod=2)
    for k in range(3):
        ts.basket(ms, 0.4 + 0.06 * k, -0.5, 1.2)
    top = ts.totem(ms, -0.62, 0.45, h=0.66)
    return {'socket-door': (0, -0.68, 0), 'socket-rally': (0, -1.0, 0), 'socket-drop': (0.15, -0.55, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.45, 0.4), 'socket-fire-2': (-0.46, -0.1, 0.2), 'socket-fire-3': (0.46, -0.1, 0.2), 'socket-fire-4': (-0.3, -0.5, 0.2), 'socket-smoke-1': (0, 0.45, 0.5)}


def farm_plot(ms, rng):
    """14 x 14 m, the Garden Plot: irregular beds of emmer and flax inside a wattle hurdle fence
    with a gap, a brush shade, a grinding stone, digging sticks and baskets."""
    hurdle = [(-0.12, -0.66), (-0.66, -0.66), (-0.68, 0.0), (-0.64, 0.66), (0.66, 0.68), (0.68, 0.0), (0.66, -0.66), (0.12, -0.66)]
    ts.hurdle_fence(ms, hurdle, h=0.08, step=0.16)
    import ti_bronze as tb
    beds = [(-0.4, 0.3, 0.42, 0.5, 'barley'), (0.18, 0.34, 0.6, 0.42, 'flax'), (-0.36, -0.28, 0.46, 0.5, 'flax'), (0.26, -0.2, 0.5, 0.52, 'barley')]
    for x, y, w, d, crop in beds:
        tb.crop_bed(ms, crop, x, y, w, d, rng.uniform(0.05, 0.07), rng, rows=3)
    lean_to(ms, 0.52, -0.52, 0.2, 0.14, 0.12, 0.16, mat='brush')
    ms.box('fieldstone', (0.1, 0.06, 0.03), at=(0.45, -0.38, G), lod=0, bevel=0.006)  # the quern
    ms.sphere('fieldstone', 0.022, at=(0.45, -0.38, G + 0.04), scale=(1.4, 1, 0.6), u=6, v=3, lod=0)
    for k in range(2):
        pole(ms, 'pole', (-0.05 + 0.04 * k, -0.6, G), (-0.02 + 0.04 * k, -0.56, G + 0.16), r=0.005, segs=4, lod=0)
    for k in range(2):
        ts.basket(ms, 0.56 + 0.05 * k, -0.6, 1.2)
    return {'socket-door': (0, -0.7, 0), 'socket-rally': (0, -0.95, 0), 'socket-drop': (0, -0.6, 0),
            'socket-fire-1': (-0.4, 0.3, 0.08), 'socket-fire-2': (0.18, 0.34, 0.08), 'socket-fire-3': (0.26, -0.2, 0.08), 'socket-fire-4': (-0.36, -0.28, 0.08), 'socket-smoke-1': (0, 0, 0.1)}


def mine(ms, rng):
    """12 x 12 m, the Flint Pit: a shaft sunk through the chalk with a notched log ladder, white spoil
    mounds round it, a knapping floor behind a hurdle windbreak with nodules and flakes on a hide,
    antler picks and baskets of flint."""
    ms.sphere('chalk', 0.34, at=(0.0, 0.34, G - 0.02), scale=(1.5, 0.9, 0.62), u=8, v=4, cut_below=0.0, lod=2)  # the big spoil mound
    ms.sphere('chalk', 0.18, at=(-0.42, 0.18, G - 0.02), scale=(1.1, 1.0, 0.6), u=7, v=4, cut_below=0.0, lod=1)
    ms.sphere('chalk', 0.15, at=(0.44, 0.08, G - 0.02), scale=(1.0, 1.2, 0.55), u=7, v=4, cut_below=0.0, lod=1)
    sx, sy = 0.0, -0.08  # the shaft
    ms.cyl('chalk', 0.15, 0.13, 0.04, at=(sx, sy, G - 0.01), segs=12, lod=2, caps=False)
    ms.cyl('dark', 0.13, 0.13, 0.004, at=(sx, sy, G + 0.002), segs=12, lod=2)
    pole(ms, 'timber', (sx + 0.02, sy + 0.04, G - 0.02), (sx + 0.06, sy - 0.02, G + 0.3), r=0.016, segs=6, lod=1)
    for k in range(5):  # notches
        ms.box('dark', (0.026, 0.01, 0.008), at=(sx + 0.03 + 0.007 * k, sy + 0.022 - 0.011 * k, G + 0.04 + 0.05 * k), lod=0)
    for k in range(6):  # flint nodules in the spoil
        ts.rock(ms, 'flint', rng.uniform(-0.3, 0.3), rng.uniform(0.15, 0.3), rng.uniform(0.02, 0.03), rng, z=G + 0.1, lod=0)
    ts.hurdle_fence(ms, [(-0.52, -0.2), (-0.52, -0.5), (-0.24, -0.56)], h=0.1, step=0.12)
    ms.box('hide', (0.2, 0.16, 0.006), at=(-0.36, -0.36, G), rot_z=10, lod=1)
    for k in range(7):  # flakes and cores on the hide
        ms.box('flint', (0.02, 0.012, 0.006), at=(-0.36 + rng.uniform(-0.08, 0.08), -0.36 + rng.uniform(-0.06, 0.06), G + 0.006), rot_z=rng.uniform(0, 180), lod=0)
    ts.rock(ms, 'fieldstone', -0.3, -0.42, 0.03, rng, lod=0)  # the knapper's anvil stone
    for k in range(3):
        pole(ms, 'bone', (0.22 + 0.06 * k, -0.42, G + 0.01), (0.3 + 0.06 * k, -0.34, G + 0.04), r=0.007, segs=4, lod=0)  # antler picks
    for k in range(3):
        ts.basket(ms, 0.24 + 0.06 * k, -0.24 + 0.02 * (k % 2), 1.2)
        ts.rock(ms, 'flint', 0.24 + 0.06 * k, -0.24 + 0.02 * (k % 2), 0.018, rng, z=G + 0.045, lod=0)
    return {'socket-door': (0, -0.2, 0), 'socket-rally': (0, -0.75, 0), 'socket-drop': (-0.1, -0.3, 0),
            'socket-fire-1': (-0.36, -0.36, 0.1), 'socket-fire-2': (0, -0.08, 0.2), 'socket-fire-3': (0.44, 0.08, 0.08), 'socket-fire-4': (0.3, -0.24, 0.05), 'socket-smoke-1': (0, 0.3, 0.25)}


def barracks(ms, rng):
    """16 x 12 m, the Warrior Lodge: a great round lodge with the side's hanging at its door, flint
    spear racks, hide shields, drill posts and a carved pole."""
    hut(ms, 0.1, 0.16, r=0.42, yaw=0, style=STYLE, team=True, rng=rng)
    hut(ms, -0.62, 0.36, r=0.17, yaw=tm.facing_centre(-0.62, 0.36), style=STYLE, detail=0, rng=rng)
    spear_rack(ms, -0.5, -0.32)
    spear_rack(ms, 0.5, -0.32)
    shield_rack(ms, -0.66, -0.05, yaw=90)
    for k in range(3):
        ms.cyl('timber', 0.02, 0.018, 0.2, at=(-0.2 + 0.2 * k, -0.5, G), segs=6, lod=1)
        ms.box('grass_thatch', (0.04, 0.03, 0.05), at=(-0.2 + 0.2 * k, -0.5, G + 0.13), lod=0)
    top = ts.totem(ms, 0.72, -0.5, h=0.72)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.3, 0.16, 0.4), 'socket-fire-2': (0.3, 0.16, 0.4), 'socket-fire-3': (0, 0.3, 0.55), 'socket-fire-4': (-0.5, -0.32, 0.1), 'socket-smoke-1': (0, 0.16, 0.6)}


def shooting_range(ms, rng):
    """16 x 12 m, the Hunters' Camp: grass bundle targets on stakes along a brush screen, a lean-to
    with bows and quivers, a deer hide stretched on a frame, antlers, a shooting line of logs."""
    ts.hurdle_fence(ms, [(-0.8, 0.6), (0.8, 0.6)], h=0.16, step=0.14, mat='brush')
    for x in (-0.05, 0.3, 0.65):
        target(ms, x, 0.44)
    lf = lean_to(ms, -0.5, 0.3, 0.42, 0.26, 0.16, 0.24, mat='brush' if S()['roof'] not in ('hide', 'hide_dark') else S()['roof'])
    for k in range(4):  # bows leaning on the back of the shelter
        pole(ms, 'pole', (-0.66 + 0.08 * k, 0.4, G), (-0.64 + 0.08 * k, 0.43, G + 0.17), r=0.004, segs=3, lod=0)
    ms.cyl('ash', 0.04, 0.04, 0.006, at=(-0.5, 0.25, G), segs=8, lod=1)
    hf = frame(0.0, -0.05, 0)  # the stretching frame
    for sx in (-1, 1):
        ms.cyl('pole', 0.007, 0.007, 0.22, at=(sx * 0.1, 0, G), segs=4, lod=1, frame=hf, caps=False)
    for z in (0.03, 0.2):
        ms.cyl('pole', 0.006, 0.006, 0.22, at=(-0.11, 0, G + z), rot=(0, 90, 0), segs=4, lod=0, frame=hf, caps=False)
    ms.box('hide', (0.17, 0.006, 0.15), at=(0, 0, G + 0.04), lod=1, frame=hf, taper=0.85)
    for sx in (-1, 1):  # a pair of antlers on a post
        pole(ms, 'bone', (0.45, 0.1, G + 0.18), (0.45 + sx * 0.06, 0.1, G + 0.26), r=0.005, segs=3, lod=0)
    ms.cyl('pole', 0.01, 0.01, 0.18, at=(0.45, 0.1, G), segs=5, lod=1, caps=False)
    rb.beam(ms, 'bark', (-0.25, -0.42, G + 0.018), (0.55, -0.42, G + 0.018), r=0.018, lod=1)
    top = flag_pole(ms, 0.76, -0.45, 0.6)
    return {'socket-door': (0, -0.55, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.5, 0.3, 0.25), 'socket-fire-2': (0.3, 0.44, 0.2), 'socket-fire-3': (-0.05, 0.44, 0.2), 'socket-fire-4': (0.65, 0.44, 0.2), 'socket-smoke-1': (-0.5, 0.25, 0.3)}


def stable(ms, rng):
    """20 x 16 m, an animal pen (the stable is not offered in a Stone battle): a wattle hurdle pen
    in two folds, a thatched lean-to shelter at the back, a hollowed log trough, heaps of fodder."""
    lean_to(ms, 0, 0.5, 1.5, 0.36, 0.22, 0.32, mat=S()['roof'] if S()['roof'] not in ('hide', 'hide_dark', 'brush') else 'thatch_st')
    ts.hurdle_fence(ms, [(-0.78, 0.68), (0.78, 0.68)], h=0.24, step=0.2)
    ts.hurdle_fence(ms, [(-0.15, -0.78), (-0.95, -0.78), (-0.95, 0.68), (-0.78, 0.68)], h=0.12, step=0.18)
    ts.hurdle_fence(ms, [(0.78, 0.68), (0.95, 0.68), (0.95, -0.78), (0.15, -0.78)], h=0.12, step=0.18)
    ts.hurdle_fence(ms, [(0.0, -0.78), (0.0, 0.25)], h=0.1, step=0.2)
    for x, y in [(-0.5, -0.1), (0.45, -0.15)]:
        f = frame(x, y, 0)
        ms.cyl('bark', 0.04, 0.04, 0.28, at=(-0.14, 0, G + 0.03), rot=(0, 90, 0), segs=7, lod=1, frame=f)
        ms.box('shallows', (0.24, 0.05, 0.004), at=(0, 0, G + 0.06), lod=0, frame=f)
    for x, y in [(0.55, -0.48), (0.68, -0.38), (-0.6, -0.55), (-0.3, 0.35)]:
        ms.sphere('grass_thatch', 0.07, at=(x, y, G), scale=(1.2, 1, 0.8), u=8, v=4, cut_below=0.0, lod=1)
    top = flag_pole(ms, -0.88, -0.7, 0.62)
    return {'socket-door': (0, -0.8, 0), 'socket-rally': (0, -1.2, 0), 'socket-banner': top,
            'socket-fire-1': (-0.5, 0.5, 0.3), 'socket-fire-2': (0.5, 0.5, 0.3), 'socket-fire-3': (0, 0.5, 0.3), 'socket-fire-4': (0.6, -0.42, 0.08), 'socket-smoke-1': (0, 0.5, 0.45)}


def siege_workshop(ms, rng):
    """20 x 16 m, the Ladder Yard: finished pole ladders leaning on a tall frame, two more lashed on
    trestles, pole stacks, a tool shelter of hides over a knapping bench with stone axes."""
    for sx in (-0.6, 0.6):  # the A-frames, a rail across
        for sy in (-1, 1):
            pole(ms, 'timber', (sx, 0.32 + sy * 0.12, G), (sx, 0.32, G + 0.75), r=0.014, segs=6, lod=2)
    rb.beam(ms, 'timber', (-0.65, 0.32, G + 0.72), (0.65, 0.32, G + 0.72), r=0.014, lod=2)
    for k in range(5):
        ladder(ms, -0.45 + 0.22 * k, 0.18, 0.78, yaw=0, lean=-14, w=0.08, rungs=7, lod=1 if k % 2 == 0 else 0)
    for x in (-0.3, 0.25):  # trestles with ladders being lashed
        for sx in (-0.18, 0.18):
            ms.box('timber', (0.03, 0.14, 0.08), at=(x + sx, -0.3, G), lod=1)
        ladder(ms, x - 0.0, -0.3, 0.5, yaw=90, flat=True, z=G + 0.08, w=0.08, rungs=6, lod=1)
    ts.pole_stack(ms, -0.78, -0.45, 90, L=0.42, n=6)
    ts.pole_stack(ms, 0.8, -0.5, 90, L=0.42, n=6)
    tf = lean_to(ms, 0.6, 0.66, 0.5, 0.26, 0.2, 0.28, mat='hide')
    ms.box('timber', (0.24, 0.09, 0.06), at=(0.6, 0.62, G), lod=1, bevel=0.004)  # the bench
    for k in range(3):  # stone axes and adzes on it
        ms.box('flint', (0.03, 0.018, 0.012), at=(0.53 + 0.06 * k, 0.6, G + 0.06), rot_z=20 * k, lod=0)
        pole(ms, 'pole', (0.53 + 0.06 * k, 0.6, G + 0.065), (0.53 + 0.06 * k, 0.66, G + 0.067), r=0.004, segs=3, lod=0)
    top = flag_pole(ms, -0.86, 0.6, 0.7)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -1.1, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.32, 0.7), 'socket-fire-2': (0.6, 0.66, 0.25), 'socket-fire-3': (-0.78, -0.45, 0.06), 'socket-fire-4': (0.25, -0.3, 0.12), 'socket-smoke-1': (0, 0.32, 0.8)}


def aid_post(ms, rng):
    """12 x 12 m, the Healer's Hut (the shaman's lodge): a hide-covered lodge on bent poles with
    painted ochre hands, a pole hung with a skull and antlers, herbs drying on a rack, a fire pot,
    two pole-and-hide stretchers and water pots."""
    lf = frame(0, 0.2, 0)
    ts.rdome(ms, 'hide_dark' if S()['wall'] != 'hide_dark' else 'hide', 0.3, at=(0, 0, G), scale=(1, 1.15, 0.85), u=14, v=6, frame=lf)
    for k in range(4):  # bent pole hoops over the hides, across its length
        y = -0.24 + 0.16 * k
        rr = 0.3 * math.sqrt(max(0.0, 1 - (y / 0.345) ** 2))
        hh = 0.255 * math.sqrt(max(0.0, 1 - (y / 0.345) ** 2))
        pts = [lf @ Vector((math.cos(math.radians(t)) * rr * 1.02, y, G + math.sin(math.radians(t)) * hh * 1.02)) for t in (0, 45, 90, 135, 180)]
        for a, b in zip(pts, pts[1:]):
            pole(ms, 'pole', a, b, r=0.007, segs=4, lod=0 if k % 3 else 1)
    for sx in (-1, 1):
        ms.box('ochre', (0.05, 0.006, 0.05), at=(sx * 0.15, -0.075, G + 0.12), rot_z=sx * 32, lod=0, frame=lf)
    ms.box('dark', (0.1, 0.06, 0.12), at=(0, -0.33, G), lod=1, frame=lf)
    ms.box('team_cloth', (0.11, 0.01, 0.06), at=(0, -0.365, G + 0.08), lod=1, frame=lf)
    ts.drying_rack(ms, 0.36, -0.2, 90, w=0.24, h=0.15, hang='grass_thatch', n=4)
    ts.fire_pit(ms, rng, -0.1, -0.42, r=0.05, n=7)
    ts.pot(ms, -0.1, -0.42, 1.2, z=G + 0.008)
    for x in (-0.38, -0.24):  # stretchers
        f = frame(x, -0.12, 90)
        for sy in (-0.045, 0.045):
            ms.cyl('pole', 0.006, 0.006, 0.34, at=(-0.17, sy, G + 0.012), rot=(0, 90, 0), segs=4, lod=0, frame=f, caps=False)
        ms.box('hide', (0.26, 0.09, 0.006), at=(0, 0, G + 0.012), lod=1, frame=f)
    for k in range(3):
        ts.pot(ms, 0.3 + 0.05 * (k % 2), 0.36 + 0.05 * (k // 2), 1.3)
    top = ts.totem(ms, 0.32, -0.48, h=0.6)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.8, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.2, 0.25), 'socket-fire-2': (-0.38, -0.12, 0.04), 'socket-fire-3': (0.36, -0.2, 0.1), 'socket-fire-4': (0.32, 0.38, 0.06), 'socket-smoke-1': (-0.1, -0.42, 0.1)}


def tower(ms, rng):
    """8 x 8 m, 14 m: the Lookout, four tall poles braced with lashed cross poles on a turf mound,
    a pole platform with a hide parapet under a roof in the style's form, a ladder up the front, the
    side's pennant at the top."""
    ms.sphere('turf', 0.36, at=(0, 0, G - 0.02), scale=(1, 1, 0.22), u=10, v=4, cut_below=0.0, lod=2)
    body = 0.86
    q = 0.2
    for x in (-q, q):
        for y in (-q, q):
            pole(ms, S()['post'] if S()['post'] != 'bone' else 'timber', (x * 1.15, y * 1.15, G), (x, y, G + body + 0.12), r=0.022, segs=6, lod=2)
    for z0, z1 in ((0.1, 0.45), (0.45, 0.8)):
        for (x0, y0, x1, y1) in ((-q, -q, q, -q), (q, q, -q, q), (-q, q, -q, -q), (q, -q, q, q)):
            k0, k1 = 1.15 - 0.15 * z0 / body, 1.15 - 0.15 * z1 / body
            pole(ms, 'pole', (x0 * k0, y0 * k0, G + z0), (x1 * k1, y1 * k1, G + z1), r=0.009, segs=4, lod=1)
    ms.box('pole', (0.5, 0.5, 0.03), at=(0, 0, G + body - 0.03), lod=2)
    for (w, d, x, y) in ((0.5, 0.012, 0, -0.25), (0.5, 0.012, 0, 0.25), (0.012, 0.5, -0.25, 0), (0.012, 0.5, 0.25, 0)):
        ms.box('hide' if S()['wall'] not in ('hide', 'hide_dark') else S()['wall'], (w, d, 0.09), at=(x, y, G + body), lod=1)
    for x, y in ((-0.22, -0.22), (0.22, -0.22), (0.22, 0.22), (-0.22, 0.22)):
        ms.cyl('pole', 0.008, 0.008, 0.2, at=(x, y, G + body), segs=4, lod=1, caps=False)
    roof_only(ms, frame(0, 0, 0), 0.24, G + body + 0.19)
    ladder(ms, 0, -0.34, body + 0.02, yaw=0, lean=-13, w=0.08, rungs=9, lod=1)
    top = flag_pole(ms, 0.22, 0.22, body + 0.62, w=0.16, fh=0.1)
    return {'socket-door': (0, -0.3, 0), 'socket-rally': (0, -0.65, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0, body + 0.25), 'socket-fire-2': (-0.15, -0.2, 0.55), 'socket-fire-3': (0.15, 0.2, 0.8), 'socket-fire-4': (0, -0.24, 0.3), 'socket-smoke-1': (0, 0, body + 0.4)}


# ---- construction stages ----------------------------------------------------------------------------
# A round wattle-and-daub hut going up: marked out, the wall stakes woven, the roof frame on, the
# walls daubed and the thatch half laid. One square footprint (10 x 10 m), fitted by the game.

R = 0.34


def _stakes_ring(ms, h, n=18, lod=1):
    for i in range(n):
        a = 2 * math.pi * (i + 0.5) / n
        if abs(math.degrees(a) - 270) < 12:
            continue  # the door gap at the front
        ms.cyl('pole', 0.008, 0.007, h, at=(math.cos(a) * R, math.sin(a) * R, G - 0.01), segs=4, lod=lod if i % 3 == 0 else 0, caps=False)


def _wattle_ring(ms, h, lod=2):
    ts.rcyl(ms, 'wattle', R, R, h, at=(0, 0, G), segs=14, maxlod=lod, caps=False)


def _rafters(ms, z, h, n=10):
    for i in range(n):
        a = 2 * math.pi * i / n
        pole(ms, 'pole', (math.cos(a) * R * 1.25, math.sin(a) * R * 1.25, z - 0.03), (0, 0, z + h), r=0.007, segs=4, lod=1 if i % 2 == 0 else 0)


def construction_stage_0(ms, rng):
    """Marked out: a ring scratched in the ground, corner stakes, a bundle of rods for the wattle,
    a pile of poles, a daub pit."""
    ms.cyl('mud', R + 0.02, R + 0.02, 0.006, at=(0, 0, G - 0.003), segs=16, lod=2, caps=True)
    ms.cyl('turf', R - 0.03, R - 0.03, 0.008, at=(0, 0, G - 0.002), segs=16, lod=1)
    _stakes_ring(ms, 0.06, n=12)
    ts.pole_stack(ms, -0.2, -0.5, 90, L=0.4, n=6)
    ms.cyl('wattle', 0.05, 0.05, 0.3, at=(0.28, -0.52, G + 0.05), rot=(0, 90, 0), segs=7, lod=1)
    ms.cyl('mud', 0.1, 0.09, 0.012, at=(0.3, 0.42, G - 0.004), segs=10, lod=1)
    ts.basket(ms, 0.4, 0.3, 1.2)


def construction_stage_1(ms, rng):
    """A quarter: the wall stakes up, the weave knee high, rods and a daub pit."""
    _stakes_ring(ms, 0.18)
    _wattle_ring(ms, 0.07)
    ms.cyl('wattle', 0.05, 0.05, 0.3, at=(0.3, -0.5, G + 0.05), rot=(0, 90, 0), segs=7, lod=1)
    ms.cyl('mud', 0.1, 0.09, 0.012, at=(-0.35, -0.42, G - 0.004), segs=10, lod=1)
    ts.pole_stack(ms, 0.42, 0.3, 0, L=0.36, n=5)
    ts.basket(ms, -0.2, -0.5, 1.2)


def construction_stage_2(ms, rng):
    """Half: the weave at full height, half daubed, the roof's rafters up to a ring at the top."""
    _stakes_ring(ms, 0.18)
    _wattle_ring(ms, 0.15)
    ms.cyl('daub', R + 0.006, R + 0.006, 0.07, at=(0, 0, G), segs=14, lod=1, caps=False)
    _rafters(ms, G + 0.16, 0.36)
    ladder(ms, 0.3, -0.42, 0.3, yaw=0, lean=-18, lod=1)
    ms.cyl('mud', 0.1, 0.09, 0.012, at=(-0.35, -0.42, G - 0.004), segs=10, lod=1)
    ts.basket(ms, -0.2, -0.5, 1.2)


def construction_stage_3(ms, rng):
    """Nearly done: the walls daubed, the thatch laid on the lower half of the roof, the rafters
    bare above it, a ladder and bundles of thatch."""
    ts.rcyl(ms, 'daub', R, R * 0.98, 0.16, at=(0, 0, G), segs=14, caps=False)
    ts.doorway(ms, frame(0, 0, 0), R, 0.13, 'pole')
    _rafters(ms, G + 0.16, 0.36)
    ts.rcyl(ms, 'thatch_st', R * 1.28, R * 0.66, 0.18, at=(0, 0, G + 0.14), segs=14, caps=False)
    ladder(ms, 0.32, -0.4, 0.42, yaw=0, lean=-20, lod=1)
    for k in range(3):
        ms.cyl('thatch_st', 0.035, 0.035, 0.24, at=(-0.45, -0.3 + 0.08 * k, G + 0.035), rot=(0, 90, 0), segs=6, lod=1 if k == 0 else 0)


STAGES = [('construction-stage-0', construction_stage_0), ('construction-stage-1', construction_stage_1),
          ('construction-stage-2', construction_stage_2), ('construction-stage-3', construction_stage_3)]

ROLES = [('expedition-camp', expedition_camp), ('town-hall', town_hall), ('house', house), ('food-depot', food_depot),
         ('materials-yard', materials_yard), ('trade-post', trade_post), ('farm-plot', farm_plot), ('mine', mine),
         ('barracks', barracks), ('range', shooting_range), ('stable', stable), ('siege-workshop', siege_workshop),
         ('aid-post', aid_post), ('tower', tower)]


# ---- build ---------------------------------------------------------------------------------------

def gpu_bake():
    """Convex packing and a GPU bake when there is one (build_rts_skins_bronze.py's speed-up)."""
    exec(inspect.getsource(tm.smart_uv).replace('CONCAVE', 'CONVEX'), tm.__dict__)
    exec(inspect.getsource(tm.bake_atlas).replace("scene.cycles.device = 'CPU'", "scene.cycles.device = 'GPU'\n    prefs = bpy.context.preferences.addons['cycles'].preferences\n    prefs.compute_device_type = 'OPTIX'\n    prefs.get_devices()\n    for device in prefs.devices: device.use = device.type == 'OPTIX'\n    scene.render.threads_mode = 'FIXED'\n    scene.render.threads = 8"), tm.__dict__)


def smooth_normals(objs, angle=60):
    """The organic faces (smoothed by build_file through tt.SMOOTH) keep hard edges past `angle`."""
    for o in objs:
        if o.type == 'MESH' and any(p.use_smooth for p in o.data.polygons):
            o.data.set_sharp_from_angle(angle=math.radians(angle))


def count(items):
    tt.make_materials()
    rng = tm.seeded(1)
    out = {}
    for name, layout, _g in items:
        ms = tm.Mesher()
        layout(ms, rng)
        tris = []
        for lv in (0, 1, 2):
            n = 0
            for bm, _mat, lod, only in ms.parts:
                if lod < lv or (only is not None and lv not in (only if isinstance(only, tuple) else (only,))):
                    continue
                n += sum(len(f.verts) - 2 for f in bm.faces)
            tris.append(n)
        out[name] = tris
        print('COUNT %-28s %6d %6d %6d' % (name, *tris), flush=True)
    return out


def items_for(roles, stages=(), ruins=True, only=()):
    items = []
    for name, fn in roles:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
        items.append((name + '-damaged', rb.grounded(name + '-damaged', remat(rb.damaged(fn), damage_mats())), None))
    for name, fn in stages:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
    if ruins:
        items += rb.ruined_items([(n, fn) for n, fn in roles if not only or n in only])
    return items


def write(file_name, items, out_dir, atlas, seed, extra=None):
    counts = tt.build_file(file_name, items, out_dir, atlas=atlas, seed=seed, write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.parent is None and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)  # faces -Y: units come out toward the front
    exported = roots + [c for r in roots for c in r.children]
    smooth_normals(exported)
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, file_name + '.blend'))
    tm.export_glb(os.path.join(out_dir, file_name + '.glb'), exported)
    with open(os.path.join(out_dir, file_name + '.report.json'), 'w') as fh:
        json.dump({'file': file_name + '.glb', 'atlas': atlas, 'triangles': counts, 'sockets': rb.SOCKETS, **(extra or {}),
                   'license': 'original procedural geometry'}, fh, indent=2)
    print('RTS_STONE_BUILT', file_name, len(roots), 'objects', flush=True)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-stone')
    atlas = int(argv[1]) if len(argv) > 1 else 2048
    only = [a for a in os.environ.get('ONLY', '').split(',') if a]
    items = items_for(ROLES, STAGES, only=only)
    if os.environ.get('COUNT'):
        count(items)
    else:
        gpu_bake()
        write('rts-stone', items, out_dir, atlas, 3000)
    sys.stdout.flush()
    os._exit(0)  # bpy can crash while tearing down packed images; the files are already written


if __name__ == '__main__':
    main()
