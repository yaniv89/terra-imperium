# scripts/blender/build_city_stone.py
# The Stone Age battle city kit (eight-ages plan U88, Stone part; src/assets/battle/city/README.md),
# every file the Bronze city has, with the same object names, states, LODs and one atlas per file:
#   walls-stone.glb          an earthwork bank with a log palisade on its crest: wall-straight (10 m along
#                            model x, outer face to Blender -Y), wall-corner, tower (a timber watch platform
#                            on a mound), gate-open, gate-closed (a timber gate between two great posts);
#                            each also -damaged and -breached
#   ruins-stone.glb          rubble-s (8 m), rubble-m (14 m), rubble-l (24 m): fallen wattle and daub, slumped
#                            thatch, charred posts; beams; scorch
#   fort-stone.glb           fort: an earthwork ring with a palisade and a timber gate in the 50 m circle,
#                            round huts, a hide hut, a watch platform, a hearth and the team's pole
#   civic-stone.glb          keep, keep-damaged, keep-ruined: the shaman's lodge (a big round lodge under a
#                            tall thatch cone) on its meeting ground (standing stones, log benches, a hearth,
#                            a carved pole with the team's streamer)
#   stone-houses-damage.glb  house-poor (a hide hut), house-common (a round wattle and daub hut), house-rich
#                            (a bigger round hut with a porch); each -damaged and -ruined
#   palace-damage-stone.glb  palace-damaged, palace-ruined, palace-small-damaged, palace-small-ruined: the
#                            great longhouse and the small one (`longhouse_palace`, `longhouse_small` give
#                            the intact ones at the same origin, for the shared Stone file)
# Budgets as Bronze (validate_model.py): wall-kit 1,500 / 400 / 80; ruin 1,200 / 300 / 80; fort as an
# improvement 8,000 / 1,500 / 300; keep 15,000 / 3,000 / 600, keep-damaged 2,500 / 600 / 120, keep-ruined
# 1,200 / 300 / 80; house and palace damage 2,500 / 600 / 120, ruined 1,200 / 300 / 80. 1024 atlases.
#   blender -b --factory-startup -P scripts/blender/build_city_stone.py -- <out_dir> [walls,ruins,fort,civic,houses,palace] [--probe]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_nature as tn  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_houses_damage_bronze as hd  # noqa: E402

# ---- materials -------------------------------------------------------------------------------------

NEW = ['st_daub', 'st_wattle', 'st_hide', 'st_bank', 'st_floor', 'st_ochre', 'st_bone']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    # wattle and daub: clay and dung over woven rods, patchy and dirty at the foot
    tm.mat_simple('st_daub', ['#a88a64', '#b99b73', '#97795a', '#c3a77f'], scale=14.0, bump=0.45, dirt=True)
    tm.mat_simple('st_wattle', ['#6e5434', '#87683f', '#5a432a'], scale=10.0, stripes={'dir': 'Z', 'scale': 180.0, 'distortion': 5.0}, bump=0.7)
    tm.mat_simple('st_hide', ['#9a7650', '#b08a5e', '#86643f', '#c29c6c'], scale=7.0, bump=0.25, dirt=True)
    # the bank: turfed earth, green-brown, bare where it is trodden
    tm.mat_simple('st_bank', ['#4f5a2a', '#5f6a30', '#7a6040', '#48522a'], scale=18.0, bump=0.5)
    tm.mat_simple('st_floor', ['#8a6c4a', '#9e7e58', '#7a5e40'], scale=20.0, bump=0.2)
    tm.mat_simple('st_ochre', ['#8e3b22', '#a8492a', '#76301d'], scale=16.0, bump=0.2)
    tm.mat_simple('st_bone', ['#d9cfb8', '#e7ddc8', '#c6b99c'], scale=24.0, bump=0.2)


if not any(n == 'stone_city' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('stone_city', make_materials))
hd.RUBBLE['stone'] = ('st_daub', 'thatch')


# ---- small shapes -----------------------------------------------------------------------------------

def obox(ms, mat, size, at=(0, 0, 0), only=(0, 1, 2), rot_z=0.0, frame=None, taper=1.0, tilt=None):
    """A box with its base at `at`, shown at the levels in `only`; `tilt` (axis, degrees) about its base."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.translate(bm, vec=(0, 0, 0.5), verts=bm.verts)
    if taper != 1.0:
        for v in bm.verts:
            if v.co.z > 0.9:
                v.co.x *= taper
                v.co.y *= taper
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    m = Matrix.Translation(Vector(at)) @ Matrix.Rotation(math.radians(rot_z), 4, 'Z')
    if tilt:
        m = m @ Matrix.Rotation(math.radians(tilt[1]), 4, tilt[0])
    if frame is not None:
        m = frame @ m
    return ms.add(bm, mat, 2, m, only=tuple(only))


def pole(ms, mat, p0, p1, r, segs=5, only=(0,), frame=None, r1=None, caps=False):
    f = frame if frame is not None else Matrix.Identity(4)
    return tn.limb(ms, mat, f @ Vector(p0), f @ Vector(p1), r, r if r1 is None else r1, segs=segs, lod=2, only=tuple(only), caps=caps)


def ring_wall(ms, mat, f, r, t, h, z0=0.0, n=14, only=(0,)):
    """A round wall `t` thick and `h` high (outer face, top, inner face), centred in frame f."""
    bm = tb.sweep(ms, mat, [(r, z0), (r, z0 + h), (r - t, z0 + h), (r - t, z0)], 0, 360, n, lod=2, only=tuple(only), chunk=360.0)
    bmesh.ops.transform(bm, matrix=f, verts=bm.verts)
    return bm


def lump(ms, rng, mat, x, y, r, h, only=(0,), subdiv=1, frame=None):
    """A low heap on the ground (cut flat at Z = 0)."""
    if frame is not None:
        p = frame @ Vector((x, y, 0))
        x, y = p.x, p.y
    tn.blob(ms, mat, (x, y, 0.003), r, (1.0, 0.8, h / r), rng, 0.2, subdiv, lod=2, only=tuple(only), cut=0.0, yaw=rng.uniform(0, 180))


def hearth(ms, rng, f, x, y, r=0.07, z=0.0, stones=9):
    ms.cyl('ash', r * 0.85, r * 0.8, 0.006, at=(x, y, z), segs=10, lod=1, frame=f)
    for i in range(stones):
        a = 2 * math.pi * i / stones
        ms.sphere('stone', 0.02, at=(x + r * math.cos(a), y + r * math.sin(a), z + 0.006), scale=(1.1, 0.9, 0.7), u=5, v=3, lod=0, frame=f)
    for k in range(3):
        a = math.radians(60 * k + 20)
        pole(ms, 'ash', (x - 0.05 * math.cos(a), y - 0.05 * math.sin(a), z + 0.008), (x + 0.05 * math.cos(a), y + 0.05 * math.sin(a), z + 0.02), 0.007, segs=4, frame=f)


def woodpile(ms, f, x, y, yaw=0.0, length=0.16, z=0.0):
    g = f @ tm.house_frame(x, y, yaw)
    for k, (dx, dz) in enumerate(((-0.022, 0), (0, 0), (0.022, 0), (-0.011, 0.02), (0.011, 0.02))):
        pole(ms, 'log', (dx, -length / 2, z + 0.011 + dz), (dx, length / 2, z + 0.011 + dz), 0.011, segs=5, frame=g, caps=True)


def hide_rack(ms, f, x, y, yaw=0.0, w=0.2, h=0.16):
    """Two posts, a cross pole and a stretched hide drying on it."""
    g = f @ tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        pole(ms, 'timber', (sx * w / 2, 0, 0), (sx * w / 2, 0, h + 0.02), 0.008, segs=4, frame=g, only=(0, 1))
    pole(ms, 'timber', (-w / 2 - 0.02, 0, h), (w / 2 + 0.02, 0, h), 0.007, segs=4, frame=g)
    obox(ms, 'st_hide', (w * 0.7, 0.006, h * 0.7), at=(0, 0, h * 0.25), frame=g, only=(0, 1))


def skull(ms, f, x, y, z, yaw=0.0):
    """An aurochs skull with its horns, hung over a door."""
    g = f @ tm.house_frame(x, y, yaw)
    ms.sphere('st_bone', 0.022, at=(0, 0, z), scale=(1.0, 0.7, 1.2), u=6, v=4, lod=0, frame=g)
    for sx in (-1, 1):
        pole(ms, 'st_bone', (sx * 0.015, 0, z + 0.015), (sx * 0.055, -0.01, z + 0.05), 0.006, segs=4, frame=g, r1=0.002)


def pennant_pole(ms, f, x, y, h, z=0.0, yaw=-150, w=0.2, flag_h=0.12, carved=False, flag_lod=2):
    g = f @ tm.house_frame(x, y, 0)
    ms.cyl('timber', 0.016, 0.012, h, at=(0, 0, z), segs=6, lod=1, frame=g)
    if carved:  # painted bands and a carved head on the pole
        for k in range(3):
            ms.cyl('st_ochre', 0.019, 0.018, 0.04, at=(0, 0, z + h * (0.35 + 0.17 * k)), segs=6, lod=0, frame=g)
        ms.sphere('st_ochre', 0.03, at=(0, 0, z + h * 0.88), scale=(1, 0.8, 1.3), u=6, v=4, lod=0, frame=g)
    tt.pennant(ms, g, 0, 0, z + h - 0.005, yaw=yaw, lod=flag_lod, w=w, h=flag_h)


# ---- wall pieces ------------------------------------------------------------------------------------

BANK = [(-0.2, 0.0), (0.17, 0.0), (0.07, 0.13), (-0.07, 0.15)]  # (y, z): the outer slope to -Y
CREST_Y = -0.035
CREST_Z = 0.14
PAL_H = 0.3  # the palisade stands 3 m over the crest


def bank_section(s):
    return [(y, z * s) for y, z in BANK]


def palisade(ms, rng, x0, x1, z0, state, f, burnt=0.0):
    """Log by log at LOD0 along local x at the crest (feet sunk into the bank); damaged palisades miss
    logs, lean and are burnt down in places."""
    span = x1 - x0
    n = max(2, int(round(span / 0.046)))
    for i in range(n):
        x = x0 + span * (i + 0.5) / n
        if state == 1 and rng.random() < 0.16:
            continue
        lh = PAL_H * rng.uniform(0.93, 1.06)
        r = rng.uniform(0.018, 0.023)
        mat = 'log'
        if rng.random() < burnt:
            mat = 'ash'
            lh *= rng.uniform(0.45, 0.8)
        lean = rng.uniform(-2.5, 2.5)
        if state == 1 and rng.random() < 0.14:
            lean += rng.uniform(8, 18) * rng.choice((-1, 1))
        lf = f @ Matrix.Translation(Vector((x, CREST_Y + rng.uniform(-0.004, 0.004), z0 - 0.03))) @ Matrix.Rotation(math.radians(lean), 4, 'Y')
        ms.cyl(mat, r, r * 0.92, lh, segs=5, lod=0, frame=lf, caps=False)
        if mat == 'log':
            ms.cyl(mat, r * 0.92, 0.0, 0.05, at=(0, 0, lh), segs=5, lod=0, frame=lf, caps=False)
    # the binding rail behind the logs
    obox(ms, 'timber', (span, 0.012, 0.016), at=((x0 + x1) / 2, CREST_Y + 0.026, z0 + PAL_H * 0.7), frame=f, only=(0,))


def teeth(ms, mat, x0, x1, y, z, h, f, only=(1,)):
    """The palisade's pointed top as a two-sided zigzag strip (the far levels)."""
    n = max(1, int(round((x1 - x0) / 0.046)))
    bm = bmesh.new()
    for i in range(n):
        a, b = x0 + (x1 - x0) * i / n, x0 + (x1 - x0) * (i + 1) / n
        v = [bm.verts.new((a, y, z)), bm.verts.new((b, y, z)), bm.verts.new(((a + b) / 2, y, z + h))]
        bm.faces.new(v)
        bm.faces.new([bm.verts.new(p.co.copy()) for p in reversed(v)])
    ms.add(bm, mat, 2, f, only=tuple(only))


def band(ms, x0, x1, z0, f, lods=(1, 2), h=PAL_H):
    obox(ms, 'log', (x1 - x0, 0.042, h), at=((x0 + x1) / 2, CREST_Y, z0 - 0.03), frame=f, only=lods)
    if 1 in lods:
        teeth(ms, 'log', x0, x1, CREST_Y - 0.0215, z0 - 0.03 + h, 0.045, f)


def abatis(ms, rng, x0, x1, f, n=4):
    """Sharpened stakes slanting out of the foot of the bank."""
    for k in range(n):
        x = x0 + (x1 - x0) * (k + 0.5) / n + rng.uniform(-0.03, 0.03)
        pole(ms, 'timber', (x, -0.17, 0.0), (x + rng.uniform(-0.02, 0.02), -0.27, 0.09), 0.009, segs=4, frame=f, r1=0.002)


def wall_run(ms, rng, x0, x1, state, frame=None, far=True):
    """One stretch of earthwork from x0 to x1 along local x: the bank, the palisade on its crest, a
    fire step behind it, stakes at its foot. 1 damaged: the bank slumped, logs gone, leaning and
    burnt; 2 breached: the palisade torn out of the middle and the bank dug down to a ramp."""
    f = frame if frame is not None else Matrix.Identity(4)
    heights = [1.0] * 5 if state == 0 else [1.0, 0.82, 1.0, 0.9, 1.0] if state == 1 else [0.85, 0.5, 0.12, 0.5, 0.85]
    span = x1 - x0
    sections = {
        0: [(x0 + span * k / 5, x0 + span * (k + 1) / 5, heights[k]) for k in range(5)],
        1: [(x0, x0 + span * 0.4, heights[0]), (x0 + span * 0.4, x0 + span * 0.6, heights[2]), (x0 + span * 0.6, x1, heights[4])],
        2: ([(x0, x1, sum(heights) / 5)] if state < 2 else [(x0, x0 + span * 0.4, heights[0]), (x0 + span * 0.6, x1, heights[4])]),
    }
    for lod, secs in sections.items():
        for a, b, s in secs:
            cb.prism(ms, 'st_bank', bank_section(s), a, b, lod=lod, only=(lod,), frame=f)
    if state < 2:
        palisade(ms, rng, x0, x1, CREST_Z, state, f, burnt=0.15 if state == 1 else 0.0)
        if state == 0:
            band(ms, x0, x1, CREST_Z, f)
        else:
            gap = (x0 + span * 0.45, x0 + span * 0.62)  # the far levels show a burnt-down gap
            band(ms, x0, gap[0], CREST_Z, f, lods=(1,))
            band(ms, gap[1], x1, CREST_Z, f, lods=(1,))
            band(ms, x0, x1, CREST_Z, f, lods=(2,), h=PAL_H * 0.85)
        obox(ms, 'timber', (span, 0.06, 0.012), at=((x0 + x1) / 2, 0.05, 0.22), frame=f, only=(0, 1))  # the fire step
        for k in range(3):
            obox(ms, 'timber', (0.018, 0.018, 0.12), at=(x0 + span * (k + 0.5) / 3, 0.07, 0.1), frame=f, only=(0,))
        abatis(ms, rng, x0, x1, f, n=4 if state == 0 else 2)
    else:
        for xa, xb in ((x0, x0 + span * 0.36), (x1 - span * 0.36, x1)):
            palisade(ms, rng, xa, xb, CREST_Z * 0.85, 1, f, burnt=0.35)
            band(ms, xa, xb, CREST_Z * 0.85, f, lods=(1, 2) if far else (1,), h=PAL_H * 0.8)
    if state >= 1:
        cx = (x0 + x1) / 2
        lump(ms, rng, 'st_bank', cx + rng.uniform(-0.2, 0.2), -0.25, 0.1, 0.035, frame=f)
        for k in range(3 if state == 1 else 6):  # fallen and burnt logs at the foot
            x = cx + rng.uniform(-0.3, 0.3)
            pole(ms, 'ash' if k % 2 else 'log', (x, -0.22 - rng.uniform(0, 0.08), 0.012), (x + rng.uniform(-0.25, 0.25), -0.3 - rng.uniform(0, 0.1), 0.02), 0.016, segs=5, frame=f, only=(0, 1) if k < 2 else (0,))
        cb.scorch_plate(ms, rng, (f @ Vector((cx, -0.05, 0))).x, (f @ Vector((cx, -0.05, 0))).y, 0.14, lod=0)
    if state == 2:
        cx = (x0 + x1) / 2
        lump(ms, rng, 'st_bank', cx, -0.08, 0.22, 0.06, only=(0, 1) if not far else (0, 1, 2), frame=f)
        for k in range(4):
            cb.charred_beam(ms, rng, cx + rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.1), 0.03, rng.uniform(0.2, 0.3), rng.uniform(0, 180), frame=f)


def wall_straight(state):
    def build(ms, rng):
        wall_run(ms, rng, -0.5, 0.5, state)
    return build


def wall_corner(state):
    """Two half-length arms meeting at the origin (one along +x, one along +y), the outer faces
    outward (-Y and -X), a mound with a post cluster at the angle."""
    def build(ms, rng):
        wall_run(ms, rng, -0.2, 0.5, state, far=state < 2)
        wall_run(ms, rng, -0.5, 0.2, state, frame=Matrix.Rotation(math.radians(-90), 4, 'Z'), far=False)
        s = 1.0 if state == 0 else 0.85 if state == 1 else 0.45
        ms.cyl('st_bank', 0.24, 0.12, 0.15 * s, at=(0, 0, 0), segs=8, lod=2)
        if state < 2:
            for k in range(5):
                a = 2 * math.pi * k / 5
                pole(ms, 'log', (0.05 * math.cos(a), 0.05 * math.sin(a), 0.1), (0.05 * math.cos(a), 0.05 * math.sin(a), 0.5 - 0.06 * state), 0.025, segs=5, only=(0, 1))
    return build


def tower(state):
    """A timber watch platform on a mound, 6 m across: four posts, a wattle breastwork 4.5 m up, a hide
    roof and the team's pennant; damaged: the roof torn off and one side of the breastwork gone;
    breached: the posts burnt to stumps and the platform fallen."""
    def build(ms, rng):
        f = Matrix.Identity(4)
        ms.cyl('st_bank', 0.3, 0.22, 0.12, segs=10, lod=1)
        ms.cyl('st_bank', 0.3, 0.22, 0.12, segs=6, only=(2,))
        p, top = 0.16, 0.44
        if state < 2:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    h = top + 0.2 if state == 0 else top + 0.1
                    pole(ms, 'log', (sx * p, sy * p, 0.08), (sx * p * 0.9, sy * p * 0.9, h), 0.022, segs=6, only=(0, 1))
            for sy in (-1, 1):  # cross braces
                pole(ms, 'timber', (-p, sy * p, 0.14), (p, sy * p, top - 0.04), 0.008, segs=4)
            obox(ms, 'timber', (0.42, 0.42, 0.02), at=(0, 0, top))
            sides = [(0, -0.2, 0), (0, 0.2, 0), (-0.2, 0, 90), (0.2, 0, 90)]
            for k, (x, y, yaw) in enumerate(sides):
                if state == 1 and k == 2:
                    continue
                obox(ms, 'st_wattle', (0.42, 0.02, 0.11), at=(x, y, top + 0.02), rot_z=yaw, only=(0, 1))
            obox(ms, 'st_wattle', (0.4, 0.4, 0.1), at=(0, 0, top + 0.02), only=(2,))
            obox(ms, 'log', (0.3, 0.3, top - 0.08), at=(0, 0, 0.08), only=(2,), taper=0.9)
            for k in range(5):  # the ladder at the back
                obox(ms, 'timber', (0.08, 0.008, 0.008), at=(0, 0.25 - k * 0.005, 0.12 + k * 0.07), only=(0,))
            for sx in (-1, 1):
                pole(ms, 'timber', (sx * 0.045, 0.27, 0.08), (sx * 0.045, 0.22, top + 0.04), 0.006, segs=4)
            if state == 0:
                g = Matrix.Rotation(math.radians(45), 4, 'Z')
                ms.cyl('st_hide', 0.33, 0.0, 0.16, at=(0, 0, top + 0.2), segs=4, lod=2, frame=g)
                pennant_pole(ms, f, 0, 0, 0.18, z=top + 0.3, yaw=-150, w=0.18, flag_h=0.11, flag_lod=1)
            else:
                for k in range(2):  # torn hide hanging off the posts
                    obox(ms, 'st_hide', (0.12, 0.006, 0.1), at=(rng.uniform(-0.12, 0.12), -p - 0.01, top + 0.12), rot_z=rng.uniform(-10, 10), only=(0,))
                tt.pennant(ms, f, p, -p, top + 0.29, yaw=-150, lod=1, w=0.16, h=0.1)
                lump(ms, rng, 'st_bank', 0.15, -0.36, 0.1, 0.035)
                for k in range(3):
                    cb.charred_beam(ms, rng, rng.uniform(-0.25, 0.25), -0.34, 0.0, 0.22, rng.uniform(0, 180))
        else:
            for sx in (-1, 1):
                for sy in (-1, 1):
                    h = rng.uniform(0.15, 0.24)
                    pole(ms, 'ash', (sx * p, sy * p, 0.08), (sx * p, sy * p, h), 0.022, segs=6, only=(0, 1))
            obox(ms, 'ash', (0.3, 0.3, 0.1), at=(0, 0, 0.08), only=(2,))
            obox(ms, 'timber', (0.42, 0.42, 0.02), at=(0.05, -0.32, 0.0), rot_z=20, tilt=('X', 12), only=(0, 1, 2))
            for k in range(3):
                obox(ms, 'st_wattle', (0.3, 0.02, 0.1), at=(rng.uniform(-0.25, 0.25), rng.uniform(-0.25, 0.25), 0.12), rot_z=rng.uniform(0, 180), tilt=('X', 80), only=(0,))
            for k in range(4):
                cb.charred_beam(ms, rng, rng.uniform(-0.3, 0.3), rng.uniform(-0.35, 0.1), 0.1, 0.3, rng.uniform(0, 180))
            lump(ms, rng, 'st_bank', 0.0, -0.4, 0.18, 0.05, only=(0, 1))
    return build


def gate(state, open_):
    """A gateway 10 m wide: the bank and palisade to each side, two great posts with a lintel and a
    fighting platform over a 3.4 m opening, plank doors (swung in when open), an aurochs skull and the
    team's banner over the passage."""
    def build(ms, rng):
        f = Matrix.Identity(4)
        gw = 0.34
        for x0, x1 in ((-0.5, -0.23), (0.23, 0.5)):
            s = 1.0 if state < 2 else 0.6
            for lod in (0, 1, 2):
                cb.prism(ms, 'st_bank', bank_section(s), x0, x1, lod=lod, only=(lod,))
            if state < 2:
                palisade(ms, rng, x0, x1, CREST_Z, state, f, burnt=0.2 if state == 1 else 0.0)
                band(ms, x0, x1, CREST_Z, f, lods=(1,))
            else:
                palisade(ms, rng, x0 + (0 if x0 < 0 else 0.12), x1 - (0.12 if x0 < 0 else 0), CREST_Z * 0.6, 1, f, burnt=0.4)
        if state < 2:
            ph = 0.66
            for sx in (-1, 1):
                pole(ms, 'log', (sx * 0.2, -0.01, 0.0), (sx * 0.2, -0.01, ph), 0.034, segs=7, only=(0, 1))
                ms.cyl('st_ochre', 0.037, 0.037, 0.05, at=(sx * 0.2, -0.01, 0.3), segs=7, lod=0)
                obox(ms, 'log', (0.06, 0.06, ph), at=(sx * 0.2, -0.01, 0), only=(2,))
            obox(ms, 'timber', (0.5, 0.07, 0.05), at=(0, -0.01, 0.5), only=(0, 1))
            obox(ms, 'timber', (0.5, 0.18, 0.015), at=(0, 0.05, 0.55), only=(0, 1))
            if state == 0:
                obox(ms, 'st_wattle', (0.5, 0.02, 0.1), at=(0, -0.035, 0.565), only=(0, 1))
            else:
                obox(ms, 'st_wattle', (0.22, 0.02, 0.08), at=(-0.14, -0.035, 0.565), only=(0, 1))
            skull(ms, f, 0, -0.05, 0.47)
            obox(ms, 'team_cloth', (0.16, 0.008, 0.15), at=(0, -0.05, 0.33))
            dh = 0.44
            if open_:
                for sx in (-1, 1):  # the leaves swung inward against the bank ends
                    hinge = Vector((sx * gw / 2, 0.02, 0))
                    lf = Matrix.Translation(hinge) @ Matrix.Rotation(math.radians(sx * -95), 4, 'Z')
                    obox(ms, 'door', (gw / 2 - 0.004, 0.03, dh), at=(-sx * gw / 4, 0, 0), frame=lf, only=(0, 1))
                    if state == 1 and sx > 0:
                        obox(ms, 'ash', (0.1, 0.034, 0.12), at=(-sx * gw / 4, -0.002, 0.05), frame=lf, only=(0,))
            else:
                tb.gate_doors(ms, Matrix.Translation(Vector((0, 0.01, 0))), gw, dh)
                obox(ms, 'door', (gw, 0.03, dh), at=(0, 0.01, 0), only=(2,))
                if state == 1:
                    obox(ms, 'ash', (0.12, 0.034, 0.12), at=(0.06, -0.002, 0.04), only=(0,))
            if state == 1:
                lump(ms, rng, 'st_bank', 0.36, -0.27, 0.09, 0.035)
                for k in range(2):
                    cb.charred_beam(ms, rng, rng.uniform(-0.4, 0.4), -0.3, 0.0, 0.24, rng.uniform(0, 180))
        else:
            for sx in (-1, 1):
                h = rng.uniform(0.16, 0.24)
                pole(ms, 'ash', (sx * 0.2, -0.01, 0.0), (sx * 0.2, -0.01, h), 0.034, segs=7, only=(0, 1))
                obox(ms, 'ash', (0.06, 0.06, h), at=(sx * 0.2, -0.01, 0), only=(2,))
            pole(ms, 'timber', (-0.25, -0.2, 0.02), (0.22, -0.32, 0.04), 0.025, segs=5, only=(0, 1, 2))  # the fallen lintel
            obox(ms, 'door', (gw / 2, 0.03, 0.4), at=(-0.12, -0.25, 0.0), rot_z=70, tilt=('X', 86), only=(0, 1))
            obox(ms, 'door', (gw / 2, 0.03, 0.4), at=(0.1, -0.05, 0.0), rot_z=-20, tilt=('X', -84), only=(0,))
            lump(ms, rng, 'st_bank', 0.0, -0.05, 0.22, 0.07, only=(0, 1))
            for k in range(4):
                cb.charred_beam(ms, rng, rng.uniform(-0.3, 0.3), rng.uniform(-0.3, 0.1), 0.03, 0.3, rng.uniform(0, 180))
    return build


def wall_items():
    items = []
    for base, make in (('wall-straight', wall_straight), ('wall-corner', wall_corner), ('tower', tower)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, make(state), None))
    for base, open_ in (('gate-open', True), ('gate-closed', False)):
        for state, suffix in ((0, ''), (1, '-damaged'), (2, '-breached')):
            items.append((base + suffix, gate(state, open_), None))
    return items


# ---- ruins ------------------------------------------------------------------------------------------

def rubble(size):
    """A fallen round hut `size` across: a heap of its daub with the stub of its wall, broken wattle
    panels, slumped thatch, charred posts and a pot or two."""
    def build(ms, rng):
        r = size / 2
        f = Matrix.Identity(4)
        lump(ms, rng, 'st_daub', 0, 0, r * 0.62, 0.05 + 0.05 * size, only=(0,), subdiv=2)
        lump(ms, rng, 'st_daub', 0, 0, r * 0.62, 0.05 + 0.05 * size, only=(1, 2))
        lump(ms, rng, 'thatch', r * 0.2, -r * 0.15, r * 0.4, 0.03 + 0.03 * size, only=(0, 1))
        ring_wall(ms, 'st_daub', f, r * 0.82, 0.03, 0.05 + 0.02 * size, n=12, only=(0,))
        ring_wall(ms, 'st_daub', f, r * 0.82, 0.03, 0.05 + 0.02 * size, n=6, only=(1,))
        for k in range(2 + int(size * 1.5)):  # wattle panels fallen over
            a = 2 * math.pi * k / (2 + int(size * 1.5)) + rng.uniform(-0.3, 0.3)
            d = r * rng.uniform(0.5, 0.85)
            obox(ms, 'st_wattle', (rng.uniform(0.1, 0.2) * min(1.4, size), 0.012, rng.uniform(0.08, 0.14)), at=(math.cos(a) * d, math.sin(a) * d, 0),
                 rot_z=math.degrees(a) + 90, tilt=('X', rng.uniform(55, 80)), only=(0,) if k > 1 else (0, 1))
        for k in range(int(2 + size * 2)):  # charred posts still standing
            a, d = rng.uniform(0, 2 * math.pi), r * rng.uniform(0.3, 0.8)
            pole(ms, 'ash', (math.cos(a) * d, math.sin(a) * d, 0), (math.cos(a) * d, math.sin(a) * d, rng.uniform(0.06, 0.16)), 0.014, segs=5)
        for k in range(int(3 + size * 3)):
            a, d = rng.uniform(0, 2 * math.pi), r * rng.uniform(0.1, 0.8)
            cb.charred_beam(ms, rng, math.cos(a) * d, math.sin(a) * d, rng.uniform(0.0, 0.04), rng.uniform(0.12, 0.28) * min(1.3, size), rng.uniform(0, 180), lift=rng.uniform(0.0, 0.05))
        cb.bricks(ms, rng, 0, 0, r * 0.9, int(6 + 5 * size), mat='st_daub')
        for k in range(max(1, int(size))):
            tt.jar(ms, f, rng.uniform(-r, r) * 0.7, rng.uniform(-r, r) * 0.7, 1.0, z=0.0)
    return build


def beams(ms, rng):
    """A heap of charred posts, rafters and torn thatch, 6 m."""
    for k in range(7):
        cb.charred_beam(ms, rng, rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12), 0.012 * (k // 3), rng.uniform(0.35, 0.55), rng.uniform(0, 180), lift=rng.uniform(0.0, 0.05))
    obox(ms, 'log', (0.5, 0.03, 0.025), at=(0, 0.1, 0.0), rot_z=15)
    obox(ms, 'ash', (0.2, 0.14, 0.006), at=(0.05, -0.05, 0.0), rot_z=30, only=(0, 1))
    obox(ms, 'thatch', (0.18, 0.12, 0.01), at=(-0.1, 0.08, 0.004), rot_z=-20, only=(0,))
    obox(ms, 'st_hide', (0.12, 0.08, 0.006), at=(0.12, -0.1, 0.004), rot_z=40, only=(0,))


# ---- round huts ---------------------------------------------------------------------------------------

def hide_hut(ms, rng, f, r=0.2, h=0.34, z0=0.0, detail=True):
    """A hide tent on a pole frame: a cone of sewn hides, the pole ends crossing out of the top, a door
    flap and stones holding the hem down."""
    ms.cyl('st_hide', r, 0.02, h, at=(0, 0, z0), segs=12, frame=f, only=(0,))
    ms.cyl('st_hide', r, 0.02, h, at=(0, 0, z0), segs=7, frame=f, only=(1,))
    ms.cyl('st_hide', r, 0.02, h, at=(0, 0, z0), segs=5, frame=f, only=(2,))
    for k in range(6):
        a = 2 * math.pi * k / 6 + 0.3
        pole(ms, 'timber', (r * 0.95 * math.cos(a), r * 0.95 * math.sin(a), z0), (-0.05 * math.cos(a), -0.05 * math.sin(a), z0 + h + 0.08), 0.007, segs=4, frame=f, only=(0, 1) if k < 3 else (0,))
    # the door: a dark opening and the flap pinned back
    bm = bmesh.new()
    ang = math.radians(-90)
    base = [Vector(((r - 0.002) * math.cos(ang + s), (r - 0.002) * math.sin(ang + s), z0)) for s in (-0.28, 0.28)]
    tip = Vector((0.8 * r * math.cos(ang), 0.8 * r * math.sin(ang) - 0.006, z0 + h * 0.48))
    v = [bm.verts.new(base[0] + Vector((0, -0.006, 0))), bm.verts.new(base[1] + Vector((0, -0.006, 0))), bm.verts.new(tip)]
    bm.faces.new(v)
    ms.add(bm, 'dark', 2, f, only=(0, 1))
    obox(ms, 'st_hide', (0.06, 0.006, h * 0.4), at=(0.07, -r * 0.88, z0), rot_z=30, frame=f, only=(0,), tilt=('Y', -18))
    if detail:
        for k in range(8):
            a = 2 * math.pi * k / 8
            ms.sphere('stone', 0.016, at=(r * math.cos(a), r * math.sin(a), z0 + 0.006), scale=(1.2, 1.0, 0.7), u=5, v=3, lod=0, frame=f)


def daub_hut(ms, rng, f, r=0.27, wall_h=0.17, roof_h=0.3, z0=0.0, porch=False, team=False, band_ochre=False, detail=True):
    """A round house of wattle and daub under a conical thatch roof: the door in the south (-Y) with a
    lintel and a hide hanging; the rich one adds a porch, a red ochre band and a team cloth."""
    t = 0.03
    ring_wall(ms, 'st_daub', f, r, t, wall_h, z0=z0, n=14, only=(0,))
    ring_wall(ms, 'st_daub', f, r, t, wall_h, z0=z0, n=8, only=(1,))
    ms.cyl('st_daub', r, r, wall_h, at=(0, 0, z0), segs=6, frame=f, only=(2,), caps=False)
    if band_ochre:
        ring_wall(ms, 'st_ochre', f, r + 0.003, 0.004, 0.03, z0=z0 + wall_h * 0.62, n=14, only=(0,))
    ov = 0.07
    rz = z0 + wall_h - 0.025
    ms.cyl('thatch', r + ov, 0.0, roof_h, at=(0, 0, rz), segs=14, frame=f, only=(0,))
    ms.cyl('thatch', r + ov, 0.0, roof_h, at=(0, 0, rz), segs=8, frame=f, only=(1,))
    ms.cyl('thatch', r + ov, 0.0, roof_h, at=(0, 0, rz), segs=6, frame=f, only=(2,))
    ms.cyl('thatch', r + ov + 0.004, r + ov - 0.02, 0.025, at=(0, 0, rz - 0.012), segs=14, frame=f, only=(0,), caps=False)  # the eave's thick edge
    ms.cyl('timber', 0.022, 0.0, 0.05, at=(0, 0, rz + roof_h - 0.02), segs=5, frame=f, only=(0,))  # the top knot
    # the door: a dark opening with posts and a lintel, a hide hung half across it
    obox(ms, 'dark', (0.1, 0.03, wall_h * 0.85), at=(0, -r + 0.012, z0), frame=f, only=(0, 1))
    for sx in (-1, 1):
        obox(ms, 'timber', (0.016, 0.016, wall_h * 0.9), at=(sx * 0.058, -r - 0.004, z0), frame=f, only=(0,))
    obox(ms, 'timber', (0.14, 0.02, 0.016), at=(0, -r - 0.004, z0 + wall_h * 0.86), frame=f, only=(0,))
    obox(ms, 'st_hide', (0.05, 0.006, wall_h * 0.72), at=(0.025, -r - 0.008, z0 + wall_h * 0.12), frame=f, only=(0,))
    if detail:  # the wattle showing where the daub has flaked
        for k in range(3):
            a = math.radians(rng.uniform(20, 160) + 180 * (k % 2))
            g = f @ Matrix.Translation(Vector(((r + 0.001) * math.cos(a), (r + 0.001) * math.sin(a), z0 + rng.uniform(0.02, wall_h * 0.5)))) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
            obox(ms, 'st_wattle', (0.05, 0.004, 0.04), at=(0, 0, 0), frame=g, only=(0,))
    if porch:
        pd = 0.11
        for sx in (-1, 1):
            pole(ms, 'timber', (sx * 0.09, -r - pd, z0), (sx * 0.09, -r - pd, z0 + wall_h * 0.95), 0.012, segs=5, frame=f, only=(0, 1))
        pf = f @ Matrix.Translation(Vector((0, -r - pd / 2 + 0.01, z0 + wall_h * 0.95))) @ Matrix.Rotation(math.radians(-14), 4, 'X')
        obox(ms, 'thatch', (0.24, pd + 0.06, 0.02), at=(0, 0, 0), frame=pf)
        skull(ms, f, 0, -r - pd - 0.01, z0 + wall_h * 0.9)
    if team:
        obox(ms, 'team_cloth', (0.07, 0.006, wall_h * 0.6), at=(0.09 if porch else 0.1, -r - (0.12 if porch else 0.012), z0 + wall_h * 0.3), frame=f)


def house_poor(ms, rng):
    f = Matrix.Identity(4)
    hide_hut(ms, rng, f, r=0.21, h=0.36)
    obox(ms, 'st_wattle', (0.2, 0.014, 0.08), at=(0.2, 0.08, 0), rot_z=70, only=(0,))  # a windbreak
    hide_rack(ms, f, -0.16, 0.14, yaw=30, w=0.14, h=0.12)
    tt.jar(ms, f, 0.15, -0.16, 0.9, z=0.0)


def house_common(ms, rng):
    f = Matrix.Identity(4)
    daub_hut(ms, rng, f, r=0.25, wall_h=0.16, roof_h=0.3)
    woodpile(ms, f, 0.25, 0.12, yaw=20, length=0.14)
    tt.jar(ms, f, -0.2, -0.2, 1.0, z=0.0)
    tt.jar(ms, f, -0.16, -0.23, 0.8, z=0.0)


def house_rich(ms, rng):
    f = Matrix.Identity(4)
    daub_hut(ms, rng, f, r=0.29, wall_h=0.19, roof_h=0.36, porch=True, team=True, band_ochre=True)
    woodpile(ms, f, 0.3, 0.12, yaw=15, length=0.16)
    hide_rack(ms, f, -0.3, 0.06, yaw=80, w=0.16, h=0.14)
    tt.jar(ms, f, 0.2, -0.3, 1.0, z=0.0)


# ---- the longhouse ---------------------------------------------------------------------------------------

def hip_roof(ms, mat, f, L, W, ze, zr, ov, only):
    """A hipped roof solid: the eaves rectangle at ze, the ridge along x at zr."""
    bm = bmesh.new()
    ex, ey, xr = L / 2 + ov, W / 2 + ov, L / 2 - W * 0.3
    e = [bm.verts.new(p) for p in ((-ex, -ey, ze), (ex, -ey, ze), (ex, ey, ze), (-ex, ey, ze))]
    r = [bm.verts.new((-xr, 0, zr)), bm.verts.new((xr, 0, zr))]
    bm.faces.new((e[3], e[2], e[1], e[0]))
    bm.faces.new((e[0], e[1], r[1], r[0]))
    bm.faces.new((e[2], e[3], r[0], r[1]))
    bm.faces.new((e[1], e[2], r[1]))
    bm.faces.new((e[3], e[0], r[0]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return ms.add(bm, mat, 2, f, only=tuple(only))


def longhouse(ms, rng, L, W, wall_h, ridge, f=None, detail=True):
    """The chief's great longhouse, long side and main door to the south (-Y): low wattle and daub
    walls, a hipped thatch roof sweeping almost to the ground, a ridge pole with crossed gable horns,
    smoke holes, a porch on carved red posts with the team's hangings and an aurochs skull, an end
    door, two rows of roof posts and the long hearth inside."""
    f = f if f is not None else Matrix.Identity(4)
    t = 0.035
    for lods in ((0, 1), (2,)):
        obox(ms, 'st_daub', (L, t, wall_h), at=(0, -W / 2 + t / 2, 0), frame=f, only=lods)
        obox(ms, 'st_daub', (L, t, wall_h), at=(0, W / 2 - t / 2, 0), frame=f, only=lods)
        if lods == (0, 1):
            for sx in (-1, 1):
                obox(ms, 'st_daub', (t, W - 2 * t, wall_h), at=(sx * (L / 2 - t / 2), 0, 0), frame=f, only=lods)
    ze = wall_h - 0.02
    hip_roof(ms, 'thatch', f, L, W, ze, ridge, 0.08, (0, 1, 2))
    hip_roof(ms, 'thatch', f @ Matrix.Translation(Vector((0, 0, -0.022))), L + 0.004, W + 0.004, ze, ze + 0.03, 0.082, (0,))  # the eave's thick edge
    xr = L / 2 - W * 0.3
    pole(ms, 'timber', (-xr - 0.02, 0, ridge + 0.006), (xr + 0.02, 0, ridge + 0.006), 0.014, segs=5, frame=f, only=(0, 1))
    for sx in (-1, 1):  # crossed horns at the ridge ends
        for sy in (-1, 1):
            pole(ms, 'timber', (sx * xr, 0, ridge), (sx * (xr + 0.03), sy * 0.06, ridge + 0.09), 0.008, segs=4, frame=f, r1=0.004)
    if detail:
        for k in (-1, 1):  # smoke holes
            obox(ms, 'dark', (0.06, 0.035, 0.02), at=(k * L * 0.18, -0.03, ridge - 0.045), frame=f, only=(0,), tilt=('X', 30))
    # the porch on the south side
    pd = 0.12
    obox(ms, 'dark', (0.12, 0.03, wall_h * 0.88), at=(0, -W / 2 - 0.002, 0), frame=f, only=(0, 1))
    for sx in (-1, 1):
        pole(ms, 'timber', (sx * 0.1, -W / 2 - pd, 0), (sx * 0.1, -W / 2 - pd, wall_h + 0.04), 0.016, segs=6, frame=f, only=(0, 1))
        for k in range(2):
            ms.cyl('st_ochre', 0.018, 0.018, 0.02, at=(sx * 0.1, -W / 2 - pd, 0.05 + 0.06 * k), segs=6, lod=0, frame=f)
        obox(ms, 'team_cloth', (0.05, 0.006, wall_h * 0.7), at=(sx * 0.1, -W / 2 - pd - 0.02, wall_h * 0.25), frame=f)
    pf = f @ Matrix.Translation(Vector((0, -W / 2 - pd / 2 + 0.02, wall_h + 0.04))) @ Matrix.Rotation(math.radians(-16), 4, 'X')
    obox(ms, 'thatch', (0.3, pd + 0.1, 0.025), at=(0, 0, 0), frame=pf, only=(0, 1))
    skull(ms, f, 0, -W / 2 - pd - 0.01, wall_h + 0.02)
    # the end door on the east gable
    obox(ms, 'dark', (0.03, 0.1, wall_h * 0.8), at=(L / 2 - 0.004, 0, 0), frame=f, only=(0,))
    if detail:
        for k in range(4):  # the two rows of roof posts and the long hearth, seen when it burns
            x = -L * 0.3 + L * 0.2 * k
            for sy in (-1, 1):
                pole(ms, 'timber', (x, sy * W * 0.22, 0), (x, sy * W * 0.22, ze + 0.05), 0.012, segs=4, frame=f)
        hearth(ms, rng, f, -L * 0.12, 0, r=0.06, stones=7)
        hearth(ms, rng, f, L * 0.14, 0, r=0.05, stones=6)
        woodpile(ms, f, -L / 2 + 0.06, -W / 2 - 0.09, yaw=90, length=0.18)
        hide_rack(ms, f, L / 2 - 0.16, -W / 2 - 0.12, w=0.16, h=0.13)
        tt.jar(ms, f, 0.2, -W / 2 - 0.07, 1.0, z=0.0)
        tt.jar(ms, f, 0.25, -W / 2 - 0.08, 0.85, z=0.0)


def longhouse_palace(ms, rng):
    longhouse(ms, rng, 1.7, 0.66, 0.18, 0.68)


def longhouse_small(ms, rng):
    longhouse(ms, rng, 1.15, 0.5, 0.15, 0.52)


# ---- damage of a building at its own origin (the footprint stays the intact one's) ----------------------

def clean(ms):
    for bm, _m, _l, _o in ms.parts:
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
    ms.parts[:] = [p for p in ms.parts if p[0].faces]


def drop_small(ms, rng, chance):
    def small(bm):
        lo, hi = hd.bounds([(bm, None, 0, None)])
        return max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) < 0.08
    ms.parts[:] = [p for p in ms.parts if not (p[3] == (0,) and small(p[0]) and rng.random() < chance)]


def damaged(intact, rubble_mat=('st_daub', 'thatch'), side=1):
    """30 to 70% HP: one side of the roof burnt and fallen in (cut on a slant and capped), charred
    rafters standing out of the hole, the fallen roof and wall in a heap below, cracks."""
    def build(ms, rng):
        intact(ms, rng)
        clean(ms)
        lo, hi = hd.bounds(ms.parts)
        w, d, top = hi.x - lo.x, hi.y - lo.y, hi.z
        cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
        sx = side
        main, minor = rubble_mat
        hd.cut(ms, Vector((cx + sx * w * 0.16, cy - d * 0.05, top * 0.55)), Vector((sx * 0.8, -0.35, 1.0)).normalized(), fill=True)
        hx = cx + sx * w * 0.12
        tn.blob(ms, 'ash', (hx, cy, top * 0.5), min(w, d) * 0.17, (1.3, 1.0, 0.4), rng, 0.25, 1, lod=2, only=(0, 1))
        for k in range(3):
            hd.charred(ms, rng, hx + rng.uniform(-0.06, 0.06), cy + rng.uniform(-0.05, 0.05), top * 0.4, top * 0.62 + rng.uniform(0, 0.05), 0.2, rng.uniform(0, 180))
        hd.heap(ms, rng, minor, cx + sx * w * 0.3, cy - d * 0.12, w * 0.13, d * 0.14, min(0.07, top * 0.25))
        hd.bits(ms, rng, main, w, d, 6)
        hd.charred(ms, rng, cx + sx * w * 0.3, cy + d * 0.18, 0.01, 0.1, 0.22, rng.uniform(0, 180))
        for k in range(2):
            obox(ms, 'dark', (0.012, 0.006, rng.uniform(0.04, 0.08)), at=(cx + rng.uniform(-0.2, 0.2) * w, lo.y + 0.03, rng.uniform(0.02, 0.06)), only=(0,))
    return build


def ruined(intact, rubble_mat=('st_daub', 'thatch'), lining=True):
    """Down: the walls burnt to a 1 to 1.6 m stub on a slanting line, the roof gone, the inside full
    of fallen daub and thatch, charred posts and rafters."""
    def build(ms, rng):
        intact(ms, rng)
        clean(ms)
        lo, hi = hd.bounds(ms.parts)
        w, d, top = hi.x - lo.x, hi.y - lo.y, hi.z
        cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
        main, minor = rubble_mat
        zc = min(top * 0.5, rng.uniform(0.1, 0.15))
        hd.cut(ms, Vector((cx, cy, zc)), Vector((rng.uniform(-0.15, 0.15), rng.uniform(-0.15, 0.15), 1.0)).normalized(), fill=False)
        drop_small(ms, rng, 0.6)
        clean(ms)
        hd.heap(ms, rng, main, cx, cy, w * 0.32, d * 0.3, zc * 0.9)
        r = max(w * 0.18, d * 0.16)
        tn.blob(ms, minor, (cx + rng.uniform(-0.1, 0.1) * w, cy + rng.uniform(-0.1, 0.1) * d, 0.003), r, (w * 0.18 / r, d * 0.16 / r, zc * 0.9 / r), rng, 0.2, 1, lod=1, cut=0.0)
        hd.bits(ms, rng, main, w, d, 5)
        for k in range(3):
            hd.charred(ms, rng, cx + rng.uniform(-0.25, 0.25) * w, cy + rng.uniform(-0.25, 0.25) * d, zc * 0.5, zc * rng.uniform(0.6, 1.1), rng.uniform(0.2, 0.32), rng.uniform(0, 180))
    return build


# ---- the fort ------------------------------------------------------------------------------------------

def earthwork_ring(ms, rng, R=2.0, gate_w=0.4):
    """The fort's earthwork: a turfed bank 1.5 m high, log by log palisade on its crest (a band at the
    far levels), a timber gate with a fighting platform at the south."""
    half = math.degrees(math.asin((gate_w / 2 + 0.06) / R))
    a0, a1 = -90 + half, 270 - half
    prof = [(R + 0.22, 0.0), (R + 0.08, 0.14), (R - 0.06, 0.15), (R - 0.2, 0.0)]
    tb.sweep(ms, 'st_bank', prof, a0, a1, 48, lod=1)
    tb.sweep(ms, 'st_bank', prof, a0, a1, 16, only=(2,))
    for a in (a0, a1):  # the bank's ends at the gate
        bm = bmesh.new()
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        v = [bm.verts.new((r * ca, r * sa, z)) for r, z in prof]
        bm.faces.new(v)
        bm.faces.new([bm.verts.new(p.co.copy()) for p in reversed(v)])
        ms.add(bm, 'st_bank', 2)
    rp = R + 0.02
    n = int(math.radians(a1 - a0) * rp / 0.047)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        lh = PAL_H * rng.uniform(0.92, 1.05)
        r = rng.uniform(0.019, 0.023)
        fr = tb.ring_frame(rp + rng.uniform(-0.005, 0.005), a, 0.12)
        ms.cyl('log', r, r * 0.92, lh, segs=4, lod=0, frame=fr, caps=False)
        ms.cyl('log', r * 0.92, 0.0, 0.05, at=(0, 0, lh), segs=4, lod=0, frame=fr, caps=False)
    for lod, steps in ((1, 40), (2, 14)):
        tb.sweep(ms, 'log', [(rp + 0.02, 0.12), (rp + 0.02, 0.12 + PAL_H)], a0, a1, steps, only=(lod,))
        tb.sweep(ms, 'log', [(rp + 0.02, 0.12 + PAL_H), (rp - 0.02, 0.12 + PAL_H)], a0, a1, steps, only=(lod,))
        if lod == 1:
            tb.sweep(ms, 'log', [(rp - 0.02, 0.12 + PAL_H), (rp - 0.02, 0.12)], a0, a1, steps, only=(lod,))
    gf = tm.house_frame(0, -R, 0)
    gh = 0.5
    for sx in (-1, 1):
        pole(ms, 'log', (sx * (gate_w / 2 + 0.03), 0, 0), (sx * (gate_w / 2 + 0.03), 0, gh + 0.12), 0.03, segs=6, frame=gf, only=(0, 1))
        obox(ms, 'log', (0.06, 0.06, gh + 0.12), at=(sx * (gate_w / 2 + 0.03), 0, 0), frame=gf, only=(2,))
        ms.cyl('st_ochre', 0.033, 0.033, 0.04, at=(sx * (gate_w / 2 + 0.03), 0, 0.26), segs=6, lod=0, frame=gf)
    obox(ms, 'timber', (gate_w + 0.14, 0.18, 0.03), at=(0, 0.03, gh), frame=gf)
    obox(ms, 'st_wattle', (gate_w + 0.14, 0.02, 0.1), at=(0, -0.05, gh + 0.03), frame=gf, only=(0, 1))
    skull(ms, gf, 0, -0.04, gh - 0.04)
    tb.gate_doors(ms, gf @ Matrix.Translation(Vector((0, 0.03, 0))), gate_w, gh - 0.04)


def fort(ms, rng):
    """`fort` (50 m circle): the earthwork ring round three round huts, a hide hut, a small longhouse,
    a watch platform by the gate, a hearth, a woodpile, hide racks and the team's carved pole."""
    earthwork_ring(ms, rng)
    f = Matrix.Identity(4)
    for x, y, r, porch in ((-0.95, 0.55, 0.24, False), (-0.25, 1.15, 0.26, True), (0.95, 0.75, 0.22, False)):
        daub_hut(ms, rng, tm.house_frame(x, y, math.degrees(math.atan2(-y, -x)) + 90), r=r, wall_h=0.15, roof_h=0.28, porch=porch, detail=False)
    hide_hut(ms, rng, tm.house_frame(1.05, -0.35, 120), r=0.18, h=0.3, detail=False)
    longhouse(ms, rng, 0.9, 0.42, 0.13, 0.42, f=tm.house_frame(-0.85, -0.45, 10), detail=False)
    tw = tm.house_frame(0.62, -1.3, 0)
    sub = tm.Mesher()
    tower(0)(sub, rng)
    for bm, mat, lod, only in sub.parts:  # far away only its body stands for it (the fort's LOD2 budget)
        levels = tuple(i for i in (0, 1, 2) if (only is None and i <= lod) or (only is not None and i in only))
        if mat != 'log':
            levels = tuple(i for i in levels if i < 2)
        if levels:
            ms.add(bm, mat, 2, tw @ Matrix.Diagonal(Vector((0.8, 0.8, 0.8, 1.0))), levels)
    hearth(ms, rng, f, 0.15, 0.05, r=0.08)
    for k in range(3):
        a = math.radians(90 + 120 * k)
        pole(ms, 'log', (0.15 + 0.2 * math.cos(a) - 0.06 * math.sin(a), 0.05 + 0.2 * math.sin(a) + 0.06 * math.cos(a), 0.012),
             (0.15 + 0.2 * math.cos(a) + 0.06 * math.sin(a), 0.05 + 0.2 * math.sin(a) - 0.06 * math.cos(a), 0.012), 0.012, segs=5, caps=True)
    woodpile(ms, f, 0.5, 0.3, yaw=40, length=0.2)
    hide_rack(ms, f, -0.3, 0.45, yaw=10)
    hide_rack(ms, f, 0.45, 1.2, yaw=-40)
    pennant_pole(ms, f, -0.15, -0.55, 0.85, yaw=-150, w=0.22, flag_h=0.14, carved=True, flag_lod=1)


# ---- the civic hall: the shaman's lodge on the meeting ground ---------------------------------------

def lodge(ms, rng, detail=True):
    """The keep: the shaman's lodge, a round lodge 8 m across under a thatch cone 9.5 m high, a red
    ochre band, a porch facing the meeting ground with skulls and the team's hangings; in front the
    meeting ground, a trodden floor ringed by standing stones with log benches round the fire; the
    carved pole with the team's streamer and a second pole with antlers; a stake fence behind."""
    f = Matrix.Identity(4)
    lf = tm.house_frame(0, 0.38, 0)
    daub_hut(ms, rng, lf, r=0.4, wall_h=0.22, roof_h=0.72, porch=True, team=True, band_ochre=True, detail=detail)
    if detail:  # painted marks on the wall either side of the porch
        for sx in (-1, 1):
            a = math.radians(-90 + sx * 35)
            g = lf @ Matrix.Translation(Vector((0.402 * math.cos(a), 0.402 * math.sin(a), 0.06))) @ Matrix.Rotation(a + math.pi / 2, 4, 'Z')
            obox(ms, 'st_ochre', (0.08, 0.004, 0.06), at=(0, 0, 0), frame=g, only=(0,))
            obox(ms, 'st_bone', (0.03, 0.004, 0.03), at=(0, -0.001, 0.015), frame=g, only=(0,))
    # the meeting ground
    mc = (0.0, -0.45)
    ms.cyl('st_floor', 0.5, 0.5, 0.006, at=(mc[0], mc[1], 0), segs=16, lod=1)
    ms.cyl('st_floor', 0.5, 0.5, 0.006, at=(mc[0], mc[1], 0), segs=8, only=(2,))
    hearth(ms, rng, f, mc[0], mc[1], r=0.09, stones=11)
    for k in range(9):  # the ring of standing stones, an opening toward the lodge
        a = math.radians(-90 + 360 * (k + 0.5) / 10)
        if abs(math.degrees(a) - 90) < 20:
            continue
        x, y = mc[0] + 0.56 * math.cos(a), mc[1] + 0.56 * math.sin(a)
        h = rng.uniform(0.13, 0.22)
        obox(ms, 'stone', (0.07, 0.045, h), at=(x, y, 0), rot_z=math.degrees(a) + 90, taper=0.7, only=(0, 1))
    for k in range(4):  # log benches round the fire
        a = math.radians(45 + 90 * k)
        x, y = mc[0] + 0.3 * math.cos(a), mc[1] + 0.3 * math.sin(a)
        tx, ty = -math.sin(a) * 0.1, math.cos(a) * 0.1
        pole(ms, 'log', (x - tx, y - ty, 0.016), (x + tx, y + ty, 0.016), 0.016, segs=5, caps=True, only=(0, 1))
    pennant_pole(ms, f, 0.62, -0.05, 1.05, yaw=-150, w=0.24, flag_h=0.16, carved=True)
    g = tm.house_frame(-0.62, -0.02, 0)
    ms.cyl('timber', 0.014, 0.011, 0.75, segs=6, lod=1, frame=g)
    for sx in (-1, 1):  # antlers on the second pole
        pole(ms, 'st_bone', (0, 0, 0.72), (sx * 0.08, -0.01, 0.84), 0.006, segs=4, frame=g, r1=0.003)
        pole(ms, 'st_bone', (sx * 0.04, 0, 0.78), (sx * 0.05, -0.04, 0.85), 0.004, segs=4, frame=g, r1=0.002)
    if detail:
        tb.stakes(ms, rng, [(0.6 * math.cos(math.radians(a)), 0.38 + 0.62 * math.sin(math.radians(a))) for a in range(10, 171, 10)], h=(0.12, 0.18))
        hide_rack(ms, f, 0.6, 0.55, yaw=-60, w=0.16, h=0.13)
        for k in range(3):
            tt.jar(ms, f, -0.5 + 0.05 * k, 0.05 + 0.02 * (k % 2), 0.9, z=0.0)
        woodpile(ms, f, 0.48, -0.25, yaw=70, length=0.15)


def trim_budget(ms, lod, budget):
    """Decimate the parts shown at `lod` when they are over its budget (build_civic_bronze.trim_budget)."""
    def shown(p):
        return (p[3] is None and lod <= p[2]) or (p[3] is not None and lod in p[3])
    parts = [p for p in ms.parts if shown(p)]
    total = sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in parts)
    if total <= budget:
        return
    ratio = (budget - 20) / total
    remaining = []
    for bm, mat, maxlod, only in ms.parts:
        levels = tuple(i for i in (0, 1, 2) if (only is None and i <= maxlod) or (only is not None and i in only))
        if lod not in levels:
            remaining.append((bm, mat, maxlod, only))
            continue
        others = tuple(i for i in levels if i != lod)
        if others:
            remaining.append((bm.copy(), mat, maxlod, others))
        me = bpy.data.meshes.new('_trim')
        bm.to_mesh(me)
        ob = bpy.data.objects.new('_trim', me)
        bpy.context.collection.objects.link(ob)
        mod = ob.modifiers.new('budget', 'DECIMATE')
        mod.ratio = max(0.01, ratio)
        deps = bpy.context.evaluated_depsgraph_get()
        ev = ob.evaluated_get(deps)
        reduced = bmesh.new()
        reduced.from_mesh(ev.to_mesh())
        ev.to_mesh_clear()
        remaining.append((reduced, mat, maxlod, (lod,)))
        bpy.data.objects.remove(ob, do_unlink=True)
        bpy.data.meshes.remove(me)
        bm.free()
    ms.parts = [p for p in remaining if p[0].faces]


def budgeted(layout, budgets):
    def build(ms, rng):
        layout(ms, rng)
        for b in ms.parts:  # nothing below the ground
            for v in b[0].verts:
                if v.co.z < 0:
                    v.co.z = 0.0
        for lod, budget in enumerate(budgets):
            trim_budget(ms, lod, budget)
        for b in ms.parts:  # and again after the trim (it can move a vertex a hair under the ground)
            for v in b[0].verts:
                if v.co.z < 0:
                    v.co.z = 0.0
    return build


def keep_damaged(ms, rng):
    damaged(lodge, side=1)(ms, rng)


def keep_ruined(ms, rng):
    ruined(lodge)(ms, rng)
    obox(ms, 'timber', (0.03, 0.03, 0.9), at=(0.45, -0.3, 0.018), rot_z=-30, tilt=('X', 88), only=(0, 1, 2))  # the carved pole thrown down


# ---- files ---------------------------------------------------------------------------------------------

def house_items():
    items = []
    for kind, fn in (('poor', house_poor), ('common', house_common), ('rich', house_rich)):
        mats = ('st_hide', 'timber') if kind == 'poor' else ('st_daub', 'thatch')
        items.append(('house-%s-damaged' % kind, budgeted(damaged(fn, mats, side=-1 if kind == 'common' else 1), (2450, 590, 118)), None))
        items.append(('house-%s-ruined' % kind, budgeted(ruined(fn, mats), (1180, 295, 78)), None))
    return items


FILES = {
    'walls-stone': wall_items,
    'ruins-stone': lambda: [('rubble-s', budgeted(rubble(0.8), (1180, 295, 78)), None), ('rubble-m', budgeted(rubble(1.4), (1180, 295, 78)), None),
                            ('rubble-l', budgeted(rubble(2.4), (1180, 295, 78)), None), ('beams', beams, None), ('scorch', cb.scorch, None)],
    'fort-stone': lambda: [('fort', budgeted(fort, (7900, 1480, 295)), None)],
    'civic-stone': lambda: [('keep', budgeted(lodge, (14800, 2950, 590)), None),
                            ('keep-damaged', budgeted(keep_damaged, (2450, 590, 118)), None),
                            ('keep-ruined', budgeted(keep_ruined, (1180, 295, 78)), None)],
    'stone-houses-damage': house_items,
    'palace-damage-stone': lambda: [
        ('palace-damaged', budgeted(damaged(longhouse_palace), (2450, 590, 118)), None),
        ('palace-ruined', budgeted(ruined(longhouse_palace), (1180, 295, 78)), None),
        ('palace-small-damaged', budgeted(damaged(longhouse_small, side=-1), (2450, 590, 118)), None),
        ('palace-small-ruined', budgeted(ruined(longhouse_small), (1180, 295, 78)), None)],
}
SHORT = {'walls': 'walls-stone', 'ruins': 'ruins-stone', 'fort': 'fort-stone', 'civic': 'civic-stone',
         'houses': 'stone-houses-damage', 'palace': 'palace-damage-stone'}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    probe = '--probe' in argv
    argv = [a for a in argv if a != '--probe']
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-stone')
    only = [SHORT.get(n, n) for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    os.makedirs(out_dir, exist_ok=True)
    report = {}
    for k, name in enumerate(only):
        seed = 8800 + 31 * list(FILES).index(name)
        if probe:
            bpy.ops.wm.read_factory_settings(use_empty=True)
            tt.make_materials()
            report[name] = {}
            for n, fn, _g in FILES[name]():
                ms = tm.Mesher()
                fn(ms, tm.seeded(seed))
                report[name][n] = [tm.triangles(ms.build('%s-%d' % (n, i), i, tt.PROC)) for i in range(3)]
            print('PROBE', name, json.dumps(report[name]), flush=True)
            continue
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=seed)
    with open(os.path.join(out_dir, 'report-%s%s.json' % ('-'.join(only), '-probe' if probe else '')), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
