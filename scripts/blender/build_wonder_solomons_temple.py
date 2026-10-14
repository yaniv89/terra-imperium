# scripts/blender/build_wonder_solomons_temple.py
# Solomon's Temple for the map's close view (src/assets/map/wonders/solomons_temple.glb), built by
# script in the house style of the map models (ti_map.py, ti_town.py): 1 unit = 10 m, Z up, the
# front (the porch) facing Blender -Y, toward the map camera; materials Town and Team (neutral grey,
# the game tints it); ONE baked atlas set; LOD0, LOD1 and LOD2 under each of tier1, tier2, tier3,
# which share one origin (wonderAssets.js shows the built tier).
#
# The tiers only ever add parts (tier 1 is inside tier 2, tier 2 inside tier 3), so the atlas is
# baked once from tier 3 and every tier and level samples the same islands: three times the texel
# density of a file that bakes each tier apart, at a quarter of the texture memory (1024 atlas).
#
#   tier 1  the temple itself: a raised ashlar platform with a walled inner court, the long
#           sanctuary of pale ashlar with a flat cedar roof and three storeys of side chambers, the
#           tall porch with the two bronze pillars (Jachin and Boaz) before it, the stepped altar,
#           the bronze sea on twelve oxen and the ten lavers on wheeled stands.
#   tier 2  the great outer court: a paved court round the platform, its wall with a gatehouse
#           (and side gates), porticoes and rows of chambers along the wall.
#   tier 3  the royal quarter beside it: the palace round its court with a tower and the throne
#           hall, the House of the Forest of Lebanon (a cedar-pillared hall), gardens and walls.
#
#   blender -b --factory-startup -P scripts/blender/build_wonder_solomons_temple.py -- <out_dir> [atlas] [--probe]
# Writes <out_dir>/solomons_temple.glb (unpacked) and .blend; --probe only prints triangle counts.
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
import numpy as np  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402

NAME = 'solomons_temple'

# ---- materials (baked away) -------------------------------------------------------------------


def mat_paving(name, c1, c2, mortar, w=0.09, h=0.065):
    """Flagstones on the horizontal plane (object x, y), with a little colour noise."""
    mat = bpy.data.materials.new(name)
    nt, bsdf = tm._nodes(mat)
    tc = nt.nodes.new('ShaderNodeTexCoord')
    br = nt.nodes.new('ShaderNodeTexBrick')
    br.inputs['Scale'].default_value = 1.0
    br.inputs['Brick Width'].default_value = w
    br.inputs['Row Height'].default_value = h
    br.inputs['Mortar Size'].default_value = 0.0035
    br.inputs['Color1'].default_value = tm._srgb(c1)
    br.inputs['Color2'].default_value = tm._srgb(c2)
    br.inputs['Mortar'].default_value = tm._srgb(mortar)
    br.offset = 0.5
    nt.links.new(tc.outputs['Object'], br.inputs['Vector'])
    n = tm._noise(nt, 30.0, 5.0, 0.6)
    var = tm._ramp(nt, n.outputs['Fac'], [(0.3, '#8c8070'), (0.7, '#f2eadc')])
    col = tm._mix(nt, 0.22, br.outputs['Color'], var.outputs['Color'], 'OVERLAY')
    nt.links.new(col, bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    tm._bump(nt, bsdf, br.outputs['Fac'], 0.3, 0.003)
    return mat


MINE = ['ashlar', 'ashlar_big', 'paving', 'paving_outer', 'cedar', 'brightbronze', 'gold', 'olive']


def make_materials():
    tt.make_materials()
    # pale dressed limestone of the temple and its courts, the platform's big blocks a shade warmer
    tm.mat_mudwall('ashlar', wash='#e6dcc6', brick='#e0d4b8', brick2='#d2c4a4', mortar='#ab9b7c', wash_cover=0.18,
                   bond=(0.12, 0.045, 0.0035))
    tm.mat_mudwall('ashlar_big', wash='#d6c7a7', brick='#cdbb95', brick2='#bcaa84', mortar='#8f7e60', wash_cover=0.12,
                   bond=(0.2, 0.075, 0.006))
    mat_paving('paving', '#b9aa8b', '#a99a7b', '#857860')
    mat_paving('paving_outer', '#c6b593', '#b6a482', '#8e7f63', w=0.12, h=0.08)
    tm.mat_simple('cedar', ['#4f3520', '#6a4a2e', '#5a3e26'], scale=8.0, stripes={'dir': 'X', 'scale': 140.0, 'distortion': 6.0}, bump=0.4)
    tm.mat_simple('brightbronze', ['#86602a', '#b98b40', '#9c7232'], scale=30.0, rough=0.45, bump=0.3)
    tm.mat_simple('gold', ['#a8842c', '#d0a646', '#b8902f'], scale=24.0, rough=0.4, bump=0.2)
    tm.mat_simple('olive', ['#56653a', '#6e7d48', '#4a5832'], scale=40.0, bump=0.6)


PROC = tt.PROC + MINE

# ---- parts --------------------------------------------------------------------------------------

PZ = 0.30                 # the inner court's platform (3 m)
TOP = PZ + 0.012          # its paving
YF = -0.9                 # the porch's front face
PODIUM = 0.08
TZ = TOP + PODIUM         # the temple floor
YB = YF + 0.55 + 3.0 + 0.45  # the back of the north side chambers
OUTER = (3.2, -4.35, 4.1)    # tier 2: the outer court's half width, south and north edges
G2 = 0.03                    # tier 2 and 3: the paved courts at ground level


def wall_x(ms, mat, x1, x2, y, h, t=0.08, z=0.0, lod=2, cap='cedar', cap_h=0.05):
    """A wall along x from x1 to x2 at y: ashlar courses with a cedar course on top."""
    ms.box(mat, (abs(x2 - x1), t, h), at=((x1 + x2) / 2, y, z), lod=lod)
    if cap:
        ms.box(cap, (abs(x2 - x1), t + 0.01, cap_h), at=((x1 + x2) / 2, y, z + h), lod=min(lod, 1))


def wall_y(ms, mat, y1, y2, x, h, t=0.08, z=0.0, lod=2, cap='cedar', cap_h=0.05):
    ms.box(mat, (t, abs(y2 - y1), h), at=(x, (y1 + y2) / 2, z), lod=lod)
    if cap:
        ms.box(cap, (t + 0.01, abs(y2 - y1), cap_h), at=(x, (y1 + y2) / 2, z + h), lod=min(lod, 1))


def parapet(ms, cx, cy, w, d, z, mat='ashlar', t=0.04, h=0.06, lod=1):
    """A low parapet round a flat roof of w x d centred at (cx, cy), its foot at z."""
    ms.box(mat, (w, t, h), at=(cx, cy - d / 2 + t / 2, z), lod=lod)
    ms.box(mat, (w, t, h), at=(cx, cy + d / 2 - t / 2, z), lod=lod)
    ms.box(mat, (t, d - 2 * t, h), at=(cx - w / 2 + t / 2, cy, z), lod=lod)
    ms.box(mat, (t, d - 2 * t, h), at=(cx + w / 2 - t / 2, cy, z), lod=lod)


def flat_roof(ms, cx, cy, w, d, z, lod_parapet=1):
    """A flat cedar roof (the plank deck just under the parapet's top) on a block w x d whose top is z."""
    ms.box('cedar', (w - 0.04, d - 0.04, 0.02), at=(cx, cy, z), lod=2)
    parapet(ms, cx, cy, w, d, z, lod=lod_parapet)


def stair(ms, x, y_top, y_out, z_top, w, n, mat='ashlar_big', z0=0.0):
    """Steps from z0 at y_out up to z_top at y_top (y_out < y_top: they climb north)."""
    run = (y_top - y_out) / n
    rise = (z_top - z0) / n
    for i in range(n):
        y1 = y_out + i * run
        ms.box(mat, (w, y_top - y1, rise), at=(x, (y1 + y_top) / 2, z0 + i * rise), lod=2 if i % 2 == 0 else 1)


def slits(ms, x, y1, y2, z, step, size=(0.012, 0.05, 0.2), axis='y', lod=0):
    """Dark window slits along a wall face (axis y: a wall at x running along y)."""
    n = max(1, int(round(abs(y2 - y1) / step)))
    for i in range(n):
        t = (i + 0.5) / n
        p = y1 + (y2 - y1) * t
        if axis == 'y':
            ms.box('dark', size, at=(x, p, z), lod=lod)
        else:
            ms.box('dark', (size[1], size[0], size[2]), at=(p, x, z), lod=lod)


def pole_pennant(ms, x, y, z, h=0.35, yaw=-150, w=0.2, ph=0.11):
    ms.cyl('timber', 0.012, 0.01, h, at=(x, y, z), segs=6, lod=1)
    tt.pennant(ms, Matrix.Identity(4), x, y, z + h - 0.01, yaw=yaw, lod=1, w=w, h=ph)


def pillar(ms, x, y):
    """Jachin or Boaz: a bronze shaft 9 m high with a bowl capital of lilies and pomegranates."""
    ms.box('brightbronze', (0.24, 0.24, 0.06), at=(x, y, TZ - PODIUM), lod=2)
    ms.cyl('brightbronze', 0.09, 0.085, 0.9, at=(x, y, TZ - PODIUM + 0.06), segs=12, lod=1)
    ms.cyl('brightbronze', 0.09, 0.085, 0.9, at=(x, y, TZ - PODIUM + 0.06), segs=6, only=(2,))
    ms.lathe('brightbronze', [(0.085, 0.0), (0.12, 0.05), (0.155, 0.12), (0.16, 0.17), (0.13, 0.23), (0.07, 0.27), (0.0, 0.28)],
             at=(x, y, TZ - PODIUM + 0.96), segs=12, lod=1)
    ms.cyl('brightbronze', 0.15, 0.15, 0.06, at=(x, y, TZ - PODIUM + 0.98), segs=8, only=(2,))
    for i in range(12):  # the pomegranate rows round the bowl
        a = 2 * math.pi * i / 12
        ms.sphere('gold', 0.026, at=(x + 0.158 * math.cos(a), y + 0.158 * math.sin(a), TZ - PODIUM + 1.1), u=6, v=4, lod=0)
    ms.cyl('gold', 0.05, 0.02, 0.06, at=(x, y, TZ - PODIUM + 1.23), segs=8, lod=0)  # the lily top


def ox(ms, x, y, yaw, z):
    f = tm.house_frame(x, y, yaw)
    ms.box('brightbronze', (0.05, 0.1, 0.05), at=(0, 0, z + 0.035), lod=0, frame=f)
    ms.box('brightbronze', (0.035, 0.04, 0.04), at=(0, -0.065, z + 0.06), lod=0, frame=f)
    for dx in (-0.016, 0.016):
        for dy in (-0.035, 0.035):
            ms.box('brightbronze', (0.012, 0.012, 0.035), at=(dx, dy, z), lod=0, frame=f)


def bronze_sea(ms, x, y):
    """The cast sea: a bowl 5 m across on twelve oxen in four threes facing out."""
    for g in range(4):
        base = 90 * g
        for k in (-1, 0, 1):
            a = math.radians(base + 22 * k)
            ox(ms, x + 0.13 * math.cos(a), y + 0.13 * math.sin(a), math.degrees(a) + 90, TOP)
    ms.cyl('brightbronze', 0.17, 0.15, 0.11, at=(x, y, TOP), segs=10, only=(1, 2))
    ms.lathe('brightbronze', [(0.0, 0.0), (0.14, 0.0), (0.23, 0.05), (0.27, 0.13), (0.29, 0.2), (0.27, 0.2), (0.25, 0.14), (0.0, 0.14)],
             at=(x, y, TOP + 0.1), segs=16, lod=1)
    ms.cyl('brightbronze', 0.22, 0.29, 0.2, at=(x, y, TOP + 0.1), segs=8, only=(2,))
    ms.cyl('water', 0.255, 0.255, 0.006, at=(x, y, TOP + 0.27), segs=16, lod=1)


def laver(ms, x, y):
    """One of the ten lavers: a bronze basin on a square stand with four wheels."""
    ms.box('brightbronze', (0.13, 0.13, 0.09), at=(x, y, TOP + 0.03), lod=1)
    for dx in (-0.07, 0.07):
        for dy in (-0.045, 0.045):
            ms.cyl('brightbronze', 0.028, 0.028, 0.012, at=(x + dx - 0.006 * (1 if dx > 0 else -1), y + dy, TOP + 0.03), rot=(0, 90, 0), segs=8, lod=0)
    ms.cyl('brightbronze', 0.06, 0.085, 0.05, at=(x, y, TOP + 0.12), segs=10, lod=1)
    ms.cyl('water', 0.075, 0.075, 0.004, at=(x, y, TOP + 0.166), segs=10, lod=0)


def altar(ms, x, y):
    """The stepped altar of burnt offering (10 x 10 m, 5 m high), its horns and its hearth."""
    ms.box('stone', (1.0, 1.0, 0.18), at=(x, y, TOP), lod=2)
    ms.box('brightbronze', (0.86, 0.86, 0.15), at=(x, y, TOP + 0.18), lod=2)
    ms.box('stone', (0.72, 0.72, 0.14), at=(x, y, TOP + 0.33), lod=2)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('stone', (0.08, 0.08, 0.08), at=(x + sx * 0.32, y + sy * 0.32, TOP + 0.47), lod=1)
    ms.box('ash', (0.5, 0.5, 0.012), at=(x, y, TOP + 0.47), lod=1)
    for i in range(5):  # the wood laid on the hearth
        ms.box('log', (0.36, 0.035, 0.03), at=(x, y - 0.12 + i * 0.06, TOP + 0.48), rot_z=8 * (i - 2), lod=0)
    # the ramp up its east side, in three wide steps
    for i in range(3):
        ms.box('stone', (0.18, 0.5, 0.47 - i * 0.15), at=(x + 0.59 + i * 0.18, y, TOP), lod=1 if i else 2)


def temple(ms):
    """The house: the porch, the holy place and the inner room in one pale ashlar block, side
    chambers in three storeys round it, a flat cedar roof with narrow windows under it."""
    ys = YF + 0.55            # the sanctuary's front (behind the porch)
    ye = ys + 3.0             # its back
    # the podium the house stands on, two steps up before the porch
    ms.box('ashlar_big', (2.3, YB - YF + 0.1, PODIUM), at=(0, (YF + YB) / 2, TOP), lod=2)
    ms.box('ashlar_big', (0.9, 0.14, PODIUM / 2), at=(0, YF - 0.1, TOP), lod=1)
    # the porch: a tall front, 20 m, its doorway with gilded doors standing open and the veil
    ms.box('ashlar', (1.5, 0.55, 2.0), at=(0, YF + 0.275, TZ), lod=2)
    ms.box('ashlar', (1.6, 0.65, 0.07), at=(0, YF + 0.275, TZ + 2.0), lod=2)       # cornice
    flat_roof(ms, 0, YF + 0.275, 1.6, 0.65, TZ + 2.07)
    ms.box('ashlar', (1.56, 0.6, 0.05), at=(0, YF + 0.275, TZ + 1.45), lod=0)     # a string course
    ms.box('dark', (0.56, 0.03, 1.0), at=(0, YF - 0.01, TZ), lod=2)
    ms.box('ashlar', (0.74, 0.05, 0.1), at=(0, YF - 0.02, TZ + 1.0), lod=1)       # the lintel
    for sx in (-1, 1):
        ms.box('ashlar', (0.08, 0.05, 1.0), at=(sx * 0.32, YF - 0.02, TZ), lod=1)  # the jambs
        ms.box('gold', (0.025, 0.26, 0.95), at=(sx * 0.31, YF - 0.16, TZ), rot_z=sx * 25, lod=0)  # door leaves
    ms.box('team_cloth', (0.48, 0.012, 0.62), at=(0, YF - 0.035, TZ + 0.36), lod=1)  # the veil, before the dark doorway
    slits(ms, YF - 0.006, -0.5, 0.5, TZ + 1.62, 0.25, size=(0.02, 0.06, 0.22), axis='x', lod=0)  # porch windows (front)
    # the sanctuary: 30 m long, 15 m high, cedar roof and the narrow lights above the chambers
    ms.box('ashlar', (1.3, 3.0, 1.5), at=(0, (ys + ye) / 2, TZ), lod=2)
    flat_roof(ms, 0, (ys + ye) / 2, 1.3, 3.0, TZ + 1.5)
    for sx in (-1, 1):
        slits(ms, sx * 0.656, ys + 0.15, ye - 0.15, TZ + 1.05, 0.38, size=(0.012, 0.07, 0.22), lod=0)
        for i in range(15):  # the beam ends under the roof
            ms.box('cedar', (0.05, 0.035, 0.035), at=(sx * 0.66, ys + 0.1 + i * 0.2, TZ + 1.42), lod=0)
    # the side chambers: west, east and north, three storeys (string courses), small windows
    ch = 0.85
    for sx in (-1, 1):
        cx = sx * (0.65 + 0.225)
        ms.box('ashlar', (0.45, ye + 0.45 - ys, ch), at=(cx, (ys + ye + 0.45) / 2, TZ), lod=2)
        flat_roof(ms, cx, (ys + ye + 0.45) / 2, 0.45, ye + 0.45 - ys, TZ + ch)
        for z in (TZ + 0.28, TZ + 0.56):
            ms.box('cedar', (0.465, ye + 0.465 - ys, 0.025), at=(cx, (ys + ye + 0.45) / 2, z), lod=1)
        for z in (TZ + 0.12, TZ + 0.4, TZ + 0.68):
            slits(ms, sx * 1.103, ys + 0.2, ye + 0.3, z, 0.42, size=(0.012, 0.05, 0.09), lod=0)
        ms.box('dark', (0.18, 0.02, 0.24), at=(cx, ys - 0.005, TZ), lod=0)  # the chambers' door
    ms.box('ashlar', (1.3, 0.45, ch), at=(0, ye + 0.225, TZ), lod=2)
    flat_roof(ms, 0, ye + 0.225, 1.3, 0.45, TZ + ch)
    for z in (TZ + 0.28, TZ + 0.56):
        ms.box('cedar', (1.3, 0.465, 0.025), at=(0, ye + 0.225, z), lod=1)
    for z in (TZ + 0.12, TZ + 0.4, TZ + 0.68):
        slits(ms, ye + 0.453, -1.0, 1.0, z, 0.42, size=(0.012, 0.05, 0.09), axis='x', lod=0)


def tier1(ms, rng):
    # the platform of the inner court: big ashlar retaining walls, flagstones on top
    y0, y1 = -3.5, 3.45
    ms.box('ashlar_big', (4.0, y1 - y0, PZ), at=(0, (y0 + y1) / 2, 0), lod=2)
    ms.box('paving', (3.98, y1 - y0 - 0.02, 0.012), at=(0, (y0 + y1) / 2, PZ), lod=2)
    ms.box('ashlar_big', (4.06, y1 - y0 + 0.06, 0.04), at=(0, (y0 + y1) / 2, 0), lod=1)  # the footing course
    # the court wall: three courses of hewn stone and a course of cedar beams; the gate on the south
    h = 0.24
    wall_y(ms, 'ashlar', y0 + 0.04, y1 - 0.04, -1.96, h, z=TOP)
    wall_y(ms, 'ashlar', y0 + 0.04, y1 - 0.04, 1.96, h, z=TOP)
    wall_x(ms, 'ashlar', -2.0, 2.0, y1 - 0.04, h, z=TOP)
    wall_x(ms, 'ashlar', -2.0, -0.45, y0 + 0.04, h, z=TOP)
    wall_x(ms, 'ashlar', 0.45, 2.0, y0 + 0.04, h, z=TOP)
    for sx in (-1, 1):
        ms.box('ashlar', (0.3, 0.3, 0.55), at=(sx * 0.6, y0 + 0.11, TOP), lod=2)
        ms.box('ashlar', (0.34, 0.34, 0.04), at=(sx * 0.6, y0 + 0.11, TOP + 0.55), lod=1)
        pole_pennant(ms, sx * 0.6, y0 + 0.11, TOP + 0.59, yaw=-150 if sx > 0 else -30)
    ms.box('cedar', (1.5, 0.16, 0.06), at=(0, y0 + 0.11, TOP + 0.46), lod=1)
    stair(ms, 0, y0 + 0.01, y0 - 0.45, PZ, 0.85, 6)
    temple(ms)
    pillar(ms, -0.45, YF - 0.32)
    pillar(ms, 0.45, YF - 0.32)
    altar(ms, -0.15, YF - 1.55)
    bronze_sea(ms, 1.35, YF - 0.55)
    for sx in (-1, 1):
        for i in range(5):
            laver(ms, sx * 1.52, YF + 0.45 + i * 0.62)


def chambers_y(ms, x, y1, y2, inner, w=0.38, h=0.34):
    """A row of chambers along the outer wall (x), their doors on the court side (inner: +1 or -1)."""
    ms.box('ashlar', (w, abs(y2 - y1), h), at=(x, (y1 + y2) / 2, G2), lod=2)
    flat_roof(ms, x, (y1 + y2) / 2, w, abs(y2 - y1), G2 + h)
    slits(ms, x + inner * (w / 2 + 0.004), y1 + 0.1, y2 - 0.1, G2, 0.34, size=(0.012, 0.1, 0.18), lod=0)


def chambers_x(ms, y, x1, x2, inner, w=0.36, h=0.34):
    ms.box('ashlar', (abs(x2 - x1), w, h), at=((x1 + x2) / 2, y, G2), lod=2)
    flat_roof(ms, (x1 + x2) / 2, y, abs(x2 - x1), w, G2 + h)
    slits(ms, y + inner * (w / 2 + 0.004), x1 + 0.1, x2 - 0.1, G2, 0.34, size=(0.012, 0.1, 0.18), axis='x', lod=0)


def portico_x(ms, y, x1, x2, depth=0.34, h=0.36):
    """A cedar-roofed colonnade against the wall at y (the court lies to the north)."""
    n = max(2, int(round(abs(x2 - x1) / 0.26)))
    for i in range(n + 1):
        x = x1 + (x2 - x1) * i / n
        ms.cyl('ashlar', 0.025, 0.022, h, at=(x, y + depth, G2), segs=6, lod=1)
    ms.box('cedar', (abs(x2 - x1) + 0.06, depth + 0.05, 0.03), at=((x1 + x2) / 2, y + depth / 2, G2 + h), lod=2)
    ms.box('paving', (abs(x2 - x1) + 0.06, depth + 0.05, 0.01), at=((x1 + x2) / 2, y + depth / 2, G2), lod=1)


def tier2(ms, rng):
    hx, ys, yn = OUTER
    # the outer court's paving, a ring round the platform (never under it)
    for (x1, x2, y1, y2) in ((-hx, hx, ys, -3.5), (-hx, hx, 3.45, yn), (-hx, -2.0, -3.5, 3.45), (2.0, hx, -3.5, 3.45)):
        ms.box('paving_outer', (x2 - x1, y2 - y1, G2), at=((x1 + x2) / 2, (y1 + y2) / 2, 0), lod=2)
    # its wall, the gatehouse on the south and gates east and west
    h, t = 0.32, 0.1
    gx = 0.55
    wall_x(ms, 'ashlar_big', -hx, -gx - 0.3, ys + t / 2, h, t=t, z=G2)
    wall_x(ms, 'ashlar_big', gx + 0.3, hx, ys + t / 2, h, t=t, z=G2)
    wall_x(ms, 'ashlar_big', -hx, hx, yn - t / 2, h, t=t, z=G2)
    for sx in (-1, 1):
        wall_y(ms, 'ashlar_big', ys + t, -0.4, sx * (hx - t / 2), h, t=t, z=G2)
        wall_y(ms, 'ashlar_big', 0.4, yn - t, sx * (hx - t / 2), h, t=t, z=G2)
        # the gatehouse towers and the side gates' towers
        ms.box('ashlar_big', (0.42, 0.55, 0.78), at=(sx * (gx + 0.21), ys + 0.2, G2), lod=2)
        flat_roof(ms, sx * (gx + 0.21), ys + 0.2, 0.42, 0.55, G2 + 0.78)
        slits(ms, ys - 0.075, sx * (gx + 0.1), sx * (gx + 0.32), G2 + 0.45, 0.1, size=(0.012, 0.04, 0.16), axis='x', lod=0)
        pole_pennant(ms, sx * (gx + 0.21), ys + 0.2, G2 + 0.8, yaw=-150 if sx > 0 else -30)
        for sy in (-1, 1):
            ms.box('ashlar_big', (0.3, 0.26, 0.52), at=(sx * (hx - 0.1), sy * 0.53, G2), lod=2)
            ms.box('ashlar_big', (0.33, 0.29, 0.03), at=(sx * (hx - 0.1), sy * 0.53, G2 + 0.52), lod=1)
    ms.box('cedar', (2 * gx + 0.05, 0.5, 0.08), at=(0, ys + 0.2, G2 + 0.6), lod=2)  # the gate's beam and its deck
    ms.box('dark', (2 * gx, 0.02, 0.6), at=(0, ys + 0.45, G2), lod=1)
    stair(ms, 0, ys + 0.02, ys - 0.25, G2, 1.1, 2, mat='paving_outer')
    # porticoes along the south wall, rows of chambers along the east, west and north walls
    portico_x(ms, ys + t, -hx + t, -gx - 0.42)
    portico_x(ms, ys + t, gx + 0.42, hx - t)
    for sx in (-1, 1):
        chambers_y(ms, sx * (hx - t - 0.19), ys + 0.5, -0.7, -sx)
        chambers_y(ms, sx * (hx - t - 0.19), 0.7, yn - 0.5, -sx)
    chambers_x(ms, yn - t - 0.18, -2.6, -0.55, -1)
    chambers_x(ms, yn - t - 0.18, 0.55, 2.6, -1)


def cypress(ms, x, y, s=1.0):
    ms.cyl('log', 0.012 * s, 0.01 * s, 0.06 * s, at=(x, y, G2), segs=5, lod=0)
    ms.cyl('leaf', 0.075 * s, 0.0, 0.42 * s, at=(x, y, G2 + 0.04 * s), segs=7, lod=1)


def olive(ms, x, y, s=1.0):
    ms.cyl('log', 0.016 * s, 0.013 * s, 0.1 * s, at=(x, y, G2), segs=5, lod=0)
    ms.sphere('olive', 0.13 * s, at=(x, y, G2 + 0.17 * s), scale=(1.0, 1.0, 0.7), u=8, v=5, lod=1)


def tier3(ms, rng):
    hx, ys, yn = OUTER
    x0, x1 = hx, 4.75           # the royal quarter on both flanks of the temple courts
    y0, y1 = -3.9, 3.7
    for sx in (-1, 1):
        ms.box('paving', (x1 - x0, y1 - y0, G2), at=(sx * (x0 + x1) / 2, (y0 + y1) / 2, 0), lod=2)
        wall_y(ms, 'ashlar_big', y0, y1, sx * (x1 - 0.04), 0.26, z=G2)
        wall_x(ms, 'ashlar_big', min(sx * x0, sx * x1), max(sx * x0, sx * x1), y1 - 0.04, 0.26, z=G2)
        wall_x(ms, 'ashlar_big', min(sx * x0, sx * x1), max(sx * x0, sx * x1), y0 + 0.04, 0.26, z=G2)
    # west: the king's house round its court, the tower at its north-west corner, the throne hall
    cx = -(x0 + x1) / 2
    pw, py0, py1, h = 1.2, -1.9, 2.6, 0.5
    for sy, (ya, yb) in ((0, (py1 - 0.32, py1)), (1, (py0, py0 + 0.32))):
        ms.box('ashlar', (pw, yb - ya, h), at=(cx, (ya + yb) / 2, G2), lod=2)
        flat_roof(ms, cx, (ya + yb) / 2, pw, yb - ya, G2 + h)
    for sx in (-1, 1):
        ms.box('ashlar', (0.32, py1 - py0 - 0.64, h), at=(cx + sx * (pw / 2 - 0.16), (py0 + py1) / 2, G2), lod=2)
        flat_roof(ms, cx + sx * (pw / 2 - 0.16), (py0 + py1) / 2, 0.32, py1 - py0 - 0.64, G2 + h)
        slits(ms, cx + sx * (pw / 2 + 0.004), py0 + 0.1, py1 - 0.1, G2 + 0.28, 0.3, size=(0.012, 0.05, 0.12), lod=0)
    ms.box('ashlar', (0.42, 0.42, 0.98), at=(cx - 0.36, py1 - 0.1, G2), lod=2)
    flat_roof(ms, cx - 0.36, py1 - 0.1, 0.42, 0.42, G2 + 0.98)
    slits(ms, py1 - 0.1 - 0.214, cx - 0.5, cx - 0.22, G2 + 0.7, 0.14, size=(0.012, 0.05, 0.14), axis='x', lod=0)
    pole_pennant(ms, cx - 0.36, py1 - 0.1, G2 + 1.0, yaw=-30)
    olive(ms, cx, (py0 + py1) / 2 + 0.3, 1.1)
    olive(ms, cx + 0.15, (py0 + py1) / 2 - 0.5, 0.9)
    # the throne hall in front, its porch of pillars facing the gate
    ms.box('ashlar', (1.1, 0.75, 0.72), at=(cx, -2.55, G2), lod=2)
    flat_roof(ms, cx, -2.55, 1.1, 0.75, G2 + 0.72)
    for i in range(5):
        ms.cyl('cedar', 0.028, 0.026, 0.5, at=(cx - 0.44 + i * 0.22, -3.08, G2), segs=6, lod=1)
    ms.box('cedar', (1.1, 0.2, 0.04), at=(cx, -3.03, G2 + 0.5), lod=2)
    ms.box('dark', (0.3, 0.02, 0.4), at=(cx, -2.93, G2), lod=1)
    # east: the House of the Forest of Lebanon, cedar pillars along its open west side
    cx = (x0 + x1) / 2
    hw, hy0, hy1, hh = 1.05, -2.9, 0.6, 0.66
    ms.box('ashlar', (hw - 0.25, hy1 - hy0, hh), at=(cx + 0.12, (hy0 + hy1) / 2, G2), lod=2)
    ms.box('cedar', (hw + 0.04, hy1 - hy0 + 0.04, 0.035), at=(cx, (hy0 + hy1) / 2, G2 + hh), lod=2)
    parapet(ms, cx, (hy0 + hy1) / 2, hw + 0.04, hy1 - hy0 + 0.04, G2 + hh + 0.035)
    for row, xr in enumerate((cx - hw / 2 + 0.05, cx - hw / 2 + 0.16)):
        for i in range(12):
            ms.cyl('cedar', 0.026, 0.024, hh, at=(xr, hy0 + 0.12 + i * (hy1 - hy0 - 0.24) / 11, G2), segs=6, lod=1 if row == 0 else 0)
    for z in (G2 + 0.3, G2 + 0.45):
        slits(ms, cx + 0.12 + (hw - 0.25) / 2 + 0.004, hy0 + 0.15, hy1 - 0.15, z, 0.3, size=(0.012, 0.06, 0.1), lod=0)
    ms.box('cedar', (0.04, hy1 - hy0, 0.05), at=(cx - hw / 2 + 0.05, (hy0 + hy1) / 2, G2 + hh - 0.05), lod=1)
    # the house beside it and the gardens
    ms.box('ashlar', (0.85, 0.9, 0.46), at=(cx + 0.05, 1.9, G2), lod=2)
    flat_roof(ms, cx + 0.05, 1.9, 0.85, 0.9, G2 + 0.46)
    ms.box('dark', (0.2, 0.02, 0.26), at=(cx + 0.05, 1.444, G2), lod=0)
    for (x, y, s) in ((-4.4, -3.55, 1.0), (-3.55, -3.6, 0.9), (4.45, 1.0, 1.0), (3.5, 1.05, 0.85), (4.45, 3.2, 0.95), (3.5, 3.3, 1.0), (-3.5, 3.35, 0.9)):
        cypress(ms, x, y, s)
    for (x, y, s) in ((3.75, -3.5, 1.0), (4.4, -3.45, 0.85), (-4.45, 3.3, 0.9)):
        olive(ms, x, y, s)


def layout(tier):
    def lay(ms):
        tier1(ms, random.Random(4201))
        if tier >= 2:
            tier2(ms, random.Random(4202))
        if tier >= 3:
            tier3(ms, random.Random(4203))
    return lay


# ---- build ----------------------------------------------------------------------------------------

TO_FINAL = {'team_cloth': 'Team'}
ORDER = ['Town', 'Team']


def fast_uv(obj, margin):
    """tm.smart_uv with convex island packing (concave packing takes minutes on many small parts)."""
    for o in bpy.context.scene.objects:
        o.select_set(o == obj)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=margin, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(udim_source='CLOSEST_UDIM', rotate=True, rotate_method='CARDINAL', scale=True,
                            merge_overlap=False, margin_method='FRACTION', margin=margin, pin=False, shape_method='CONVEX')
    bpy.ops.object.mode_set(mode='OBJECT')


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    probe = '--probe' in argv
    argv = [a for a in argv if a != '--probe']
    out = os.path.abspath(argv[0] if argv else 'build/wonders')
    atlas = int(argv[1]) if len(argv) > 1 else 1024
    os.makedirs(out, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    make_materials()
    meshers = {}
    for t in (1, 2, 3):
        ms = tm.Mesher()
        layout(t)(ms)
        meshers[t] = ms
    if probe:
        for t in (1, 2, 3):
            print('PROBE tier%d' % t, [tm.triangles(meshers[t].build('p', lod, PROC)) for lod in (0, 1, 2)], flush=True)
        return
    # one unwrap and one bake from tier 3's LOD0: every tier and level samples it
    src = meshers[3].build('_bake', 0, PROC)
    fast_uv(src, 0.002)
    print('bake source triangles', tm.triangles(src), flush=True)
    maps = tm.bake_atlas(src, size=atlas, ao_samples=48)
    ao = maps['ao'][..., 0:1]
    base = maps['color'].copy()
    base[..., :3] = base[..., :3] * (0.35 + 0.65 * ao)
    base[..., 3] = 1.0
    normal = maps['normal'].copy()
    normal[..., 3] = 1.0
    packed = np.zeros_like(base)
    packed[..., 0] = ao[..., 0]
    packed[..., 1] = maps['rough'][..., 0]
    packed[..., 3] = 1.0
    img_base = tm.image_from_array(NAME + '_base', base, 'WEBP')
    img_norm = tm.image_from_array(NAME + '_normal', normal, 'WEBP', non_color=True)
    img_pack = tm.image_from_array(NAME + '_orm', packed, 'WEBP', non_color=True)
    finals = {
        'Town': tm.final_material('Town', img_base, img_norm, img_pack),
        'Team': tm.final_material('Team', img_base, img_norm, img_pack),
    }
    exported, counts = [], {}
    for t in (1, 2, 3):
        lods = []
        for lod in (0, 1, 2):
            o = meshers[t].build('LOD%d' % lod, lod, PROC)
            tm.transfer_uvs_by_face(src, o)
            me = o.data
            remap = [ORDER.index(TO_FINAL.get(m.name, 'Town')) for m in me.materials]
            for p in me.polygons:
                p.use_smooth = False
                p.material_index = remap[p.material_index]
            for j, mname in enumerate(ORDER):
                me.materials[j] = finals[mname]
            while len(me.materials) > len(ORDER):
                me.materials.pop(index=len(me.materials) - 1)
            lods.append(o)
        root = bpy.data.objects.new('tier%d' % t, None)
        bpy.context.scene.collection.objects.link(root)
        for o in lods:
            o.parent = root
        exported += [root] + lods
        counts['tier%d' % t] = [tm.triangles(o) for o in lods]
        print('tier%d' % t, counts['tier%d' % t], flush=True)
    bpy.data.objects.remove(src)
    for m in [m for m in bpy.data.materials if m.name in PROC]:
        bpy.data.materials.remove(m)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, NAME + '.blend'))
    tm.export_glb(os.path.join(out, NAME + '.glb'), exported)
    print('wrote', os.path.join(out, NAME + '.glb'), counts, flush=True)


main()
sys.stdout.flush()
os._exit(0)  # bpy can crash while tearing down packed images; the files are already written
