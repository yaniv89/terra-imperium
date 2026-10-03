# scripts/blender/ti_bronze.py
# Bronze Age pieces beyond the house kit of ti_town.py: market stalls, the stepped temple
# (Mesopotamian landmark), the pylon gate with its colonnade and the obelisk (Egyptian landmarks),
# and a ring layout helper that sets houses round the open centre of a town.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402


def stall(ms, x, y, rng, yaw=None, cloth='team_cloth', w=0.3, d=0.22):
    """A market stall: four posts, a sloping canopy (team cloth or thatch), a counter with goods.
    Faces the town centre unless `yaw` is given."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    hf, hb = 0.2, 0.25  # canopy height at the front and the back
    for sx in (-w / 2 + 0.012, w / 2 - 0.012):
        ms.box('timber', (0.012, 0.012, hf), at=(sx, -d / 2 + 0.01, G), lod=1, frame=f)
        ms.box('timber', (0.012, 0.012, hb), at=(sx, d / 2 - 0.01, G), lod=1, frame=f)
    slope = math.degrees(math.atan2(hb - hf, d))
    cf = f @ tm.Matrix.Translation(tm.Vector((0, 0, G + (hf + hb) / 2 + 0.006))) @ tm.Matrix.Rotation(math.radians(slope), 4, 'X')
    ms.box(cloth, (w + 0.05, d + 0.06, 0.008), at=(0, 0, 0), lod=1, frame=cf)
    ms.box('timber', (w - 0.03, d * 0.45, 0.07), at=(0, -d * 0.18, G), lod=0, frame=f, bevel=0.003)
    for k in range(3):
        gx = -w / 2 + 0.06 + k * (w - 0.12) / 2
        r = rng.random()
        if r < 0.5:
            tt.jar(ms, f, gx, -d * 0.18, 0.55, z=G + 0.07)
        elif r < 0.8:
            tt.basket(ms, f, gx, -d * 0.18, 0.8, z=G + 0.07)
        else:
            tt.crate(ms, f, gx, -d * 0.18, 0.7, rng.uniform(-20, 20), z=G + 0.07)
    tt.jar(ms, f, w / 2 + 0.03, -d / 2 - 0.02, rng.uniform(0.8, 1.1))


def stepped_temple(ms, x, y, rng, tiers, offs, top_z, yaw=None, stair_w=0.26):
    """A stepped temple: battered stages with parapets and beam ends, a straight stair up the front
    of every stage, a shrine door on top, and a team flag reaching `top_z`."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    z = G
    bases = []
    for (w, d, h), (ox, oy) in zip(tiers, offs):
        ms.box('mudwall', (w, d, h), at=(ox, oy, z), lod=2, frame=f, bevel=0.008, taper=0.95)
        ms.box('roof', (w * 0.95 - 0.03, d * 0.95 - 0.03, 0.012), at=(ox, oy, z + h), lod=2, frame=f)
        tt._parapet(ms, f, 'mudwall', ox, oy, w * 0.95, d * 0.95, z + h)
        n = max(5, int(w / 0.15))
        for k in range(n):
            bx = ox - w / 2 + w * (k + 0.5) / n
            ms.cyl('timber', 0.012, 0.012, 0.05, at=(bx, oy - d / 2 + 0.012, z + h - 0.05), rot=(90, 0, 0), segs=6, lod=0, frame=f)
        # pilasters on the front, the Mesopotamian buttressed wall
        for k in range(1, n, 2):
            bx = ox - w / 2 + w * k / n
            ms.box('mudwall', (0.04, 0.02, h * 0.9), at=(bx, oy - d / 2 * 0.975 - 0.008, z), lod=0, frame=f)
        bases.append((z, ox, oy, w, d, h))
        z += h
    # a stair climbing sideways along the front of each stage (alternating direction), so the
    # flights stay in a band in front of the face and never reach into the open centre
    for i, (z0, ox, oy, w, d, h) in enumerate(bases[:-1]):
        steps = max(6, int(h / 0.065))
        run = min(w * 0.8, h * 1.1)
        sign = 1 if i % 2 == 0 else -1
        x0 = ox - sign * run / 2
        y = oy - d / 2 * 0.95 - stair_w / 2
        for s in range(steps):
            sz = (s + 1) * h / steps
            ms.box('mudwall', (run / steps + 0.002, stair_w, sz), at=(x0 + sign * (s + 0.5) * run / steps, y, z0), lod=1, frame=f)
        ms.box('mudwall', (run, 0.03, 0.05), at=(ox, y - stair_w / 2 - 0.015, z0 + h * 0.45), lod=0, frame=f)
    z0, ox, oy, w, d, h = bases[-1]
    ms.box('door', (0.11, 0.012, 0.2), at=(ox, oy - d / 2 * 0.95 - 0.004, z0), lod=1, frame=f)
    ms.box('door', (0.13, 0.012, 0.24), at=(offs[0][0] + tiers[0][0] * 0.25, offs[0][1] - tiers[0][1] / 2 * 0.95 - 0.004, G), lod=1, frame=f)
    tt.pergola(ms, f, offs[0][0] + tiers[0][0] * 0.3, offs[0][1] - tiers[0][1] * 0.32, G + tiers[0][2], 0.28, 0.22, lod=1, post_h=0.14)
    tt.clutter(ms, f, offs[0][0] + tiers[0][0] * 0.38, offs[0][1] - tiers[0][1] / 2 - 0.1, rng, 5)
    pole_z = z
    ms.cyl('timber', 0.013, 0.01, top_z - pole_z, at=(ox - w * 0.25, oy + d * 0.2, pole_z), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, ox - w * 0.25, oy + d * 0.2, top_z - 0.005, w=0.24, h=0.14)
    return f


def obelisk(ms, f, x, y, height, base=0.13):
    """A tapering stone shaft on a plinth with a pyramidion (granite-red stone)."""
    ms.box('pylon', (base * 1.7, base * 1.7, 0.06), at=(x, y, G), lod=1, frame=f, bevel=0.004)
    shaft = height - G - 0.06 - base * 0.9
    ms.box('pylon', (base, base, shaft), at=(x, y, G + 0.06), lod=2, frame=f, taper=0.68)
    ms.cyl('pylon', base * 0.68 * 0.72, 0.0, base * 0.9, at=(x, y, G + 0.06 + shaft), rot=(0, 0, 45), segs=4, lod=1, frame=f)


def pylon_gate(ms, x, y, rng, tower=(0.56, 0.42, 1.5), gate=(0.44, 0.3, 1.0), flag_top=2.6, colonnade=4, yaw=None,
               obelisk_top=None):
    """A temple pylon: two battered towers with a cavetto cornice, a gateway between fronted by a
    row of papyrus columns, flagpoles with team pennants, a walled court behind and an obelisk."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    tw, td, th = tower
    gw, gd, gh = gate
    for sx in (-1, 1):
        cx = sx * (gw / 2 + tw / 2 - 0.02)
        ms.box('pylon', (tw, td, th), at=(cx, 0, G), lod=2, frame=f, bevel=0.006, taper=0.82)
        ms.box('pylon', (tw * 0.82 + 0.04, td * 0.82 + 0.04, 0.06), at=(cx, 0, G + th), lod=1, frame=f, taper=1.08)
        ms.box('roof', (tw * 0.82, td * 0.82, 0.01), at=(cx, 0, G + th + 0.06), lod=2, frame=f)
        px = cx - sx * 0.09
        ms.cyl('timber', 0.015, 0.011, flag_top - G, at=(px, -td / 2 + 0.01, G), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, px, -td / 2 + 0.01, flag_top - 0.005, yaw=-150 if sx < 0 else -160, w=0.22, h=0.13)
        for k in range(2):
            ms.box('dark', (0.035, 0.01, 0.07), at=(cx + sx * 0.08, -td * 0.42 - 0.002, G + 0.6 + 0.35 * k), lod=0, frame=f)
    ms.box('pylon', (gw + 0.04, gd, gh), at=(0, 0, G), lod=2, frame=f, bevel=0.006)
    ms.box('pylon', (gw + 0.08, gd + 0.04, 0.05), at=(0, 0, G + gh), lod=1, frame=f, taper=1.06)
    ms.box('door', (0.16, 0.012, 0.42), at=(0, -gd / 2 - 0.004, G), lod=1, frame=f)
    if colonnade:
        # a porch of papyrus columns in front of the gate, roofed between the towers
        depth = 0.24
        for i in range(colonnade):
            cx = -gw / 2 + 0.04 + (gw - 0.08) * i / (colonnade - 1)
            ms.cyl('painted', 0.03, 0.025, gh * 0.72, at=(cx, -gd / 2 - depth + 0.03, G), segs=8, lod=1, frame=f)
            ms.cyl('painted', 0.026, 0.045, 0.05, at=(cx, -gd / 2 - depth + 0.03, G + gh * 0.72 - 0.02), segs=8, lod=0, frame=f)
        ms.box('pylon', (gw + 0.02, depth + 0.02, 0.06), at=(0, -gd / 2 - depth / 2 + 0.02, G + gh * 0.72 + 0.03), lod=1, frame=f)
    court_d = 0.5
    ms.box('pylon', (gw + 2 * tw - 0.1, court_d, 0.42), at=(0, gd / 2 + court_d / 2, G), lod=2, frame=f, bevel=0.006)
    ms.box('roof', (gw + 2 * tw - 0.13, court_d - 0.03, 0.01), at=(0, gd / 2 + court_d / 2, G + 0.42), lod=2, frame=f)
    tt._parapet(ms, f, 'pylon', 0, gd / 2 + court_d / 2, gw + 2 * tw - 0.1, court_d, G + 0.42)
    if obelisk_top:
        obelisk(ms, f, 0, gd / 2 + court_d * 0.45, obelisk_top, base=0.14)
    tt.clutter(ms, f, -(gw / 2 + tw * 0.6), -td / 2 - 0.1, rng, 4)
    tt.clutter(ms, f, gw / 2 + tw * 0.6, -td / 2 - 0.1, rng, 4)
    return f


def ring(angles_deg, rx, ry, rng, jitter=0.06):
    """Points on an ellipse at the given angles (0 east, 90 north), jittered a little."""
    out = []
    for a in angles_deg:
        r = math.radians(a)
        out.append((rx * math.cos(r) + rng.uniform(-jitter, jitter), ry * math.sin(r) + rng.uniform(-jitter, jitter)))
    return out


# ---- palaces (they stand in a capital town's free centre; the base sits on the town's ground) ----

def merlons(ms, f, x, y, w, d, z, step=0.07, size=0.03, h=0.035, mat='pylon'):
    """Stepped crenellations along the top of a parapet rectangle centred on (x, y)."""
    for sx in (-1, 1):
        n = max(2, int(d / step))
        for i in range(n):
            ms.box(mat, (size, size, h), at=(x + sx * (w / 2 - size / 2), y - d / 2 + d * (i + 0.5) / n, z), lod=0, frame=f)
    for sy in (-1, 1):
        n = max(2, int(w / step))
        for i in range(n):
            ms.box(mat, (size, size, h), at=(x - w / 2 + w * (i + 0.5) / n, y + sy * (d / 2 - size / 2), z), lod=0, frame=f)


def banner(ms, f, x, y, z, w=0.06, h=0.16):
    """A team banner hanging flat against a south wall, its top at z."""
    ms.box('team_cloth', (w, 0.006, h), at=(x, y - 0.004, z - h), lod=1, frame=f)
    ms.box('timber', (w + 0.02, 0.012, 0.01), at=(x, y - 0.006, z - 0.005), lod=0, frame=f)


def porch(ms, f, x, y, w, depth, h, swag=True):
    """A timber porch with a reed roof and a grey team swag under its front beam."""
    for sx in (-w / 2 + 0.015, w / 2 - 0.015):
        for sy in (y - depth + 0.015, y - 0.01):
            ms.box('timber', (0.018, 0.018, h), at=(x + sx, sy, G), lod=1, frame=f)
    ms.box('timber', (w + 0.03, 0.022, 0.022), at=(x, y - depth + 0.015, G + h), lod=1, frame=f)
    ms.box('thatch', (w + 0.06, depth + 0.05, 0.025), at=(x, y - depth / 2, G + h + 0.02), lod=1, frame=f)
    if swag:
        ms.box('team_cloth', (w - 0.03, 0.006, 0.045), at=(x, y - depth + 0.02, G + h - 0.045), lod=1, frame=f)


def palace_small(ms, rng):
    """`palace-small` (8 m): a mud-brick audience hall with battered walls, corner buttresses,
    stepped merlons, a reed porch with a team swag over carved double doors, a team banner, an
    outside stair on the east side up to a rooftop shrine with the flag (8 m, at the sheet's scale)."""
    # the hall sits a little west of centre so its east stair stays inside the 8 m footprint
    f = tm.house_frame(-0.065, 0, 0)
    w, d, h = 0.64, 0.62, 0.42
    ms.box('pylon', (w, d, h), at=(0, 0.02, G), lod=2, frame=f, bevel=0.006, taper=0.93)
    ms.box('roof', (w * 0.93 - 0.04, d * 0.93 - 0.04, 0.012), at=(0, 0.02, G + h), lod=2, frame=f)
    tt._parapet(ms, f, 'pylon', 0, 0.02, w * 0.93, d * 0.93, G + h)
    merlons(ms, f, 0, 0.02, w * 0.93, d * 0.93, G + h + 0.05)
    for sx in (-1, 1):  # corner buttresses on the front, taller than the wall
        ms.box('pylon', (0.12, 0.12, h + 0.08), at=(sx * (w / 2 - 0.05), -d / 2 + 0.07, G), lod=1, frame=f, bevel=0.004, taper=0.88)
    for k in range(6):
        bx = -w / 2 + w * (k + 0.5) / 6
        ms.cyl('timber', 0.012, 0.012, 0.05, at=(bx, -d / 2 + 0.03, G + h - 0.06), rot=(90, 0, 0), segs=6, lod=0, frame=f)
    ms.box('door', (0.16, 0.012, 0.22), at=(0, -d / 2 + 0.035, G + 0.03), lod=1, frame=f)
    for s in range(3):  # stone threshold steps
        ms.box('stone', (0.3 - s * 0.03, 0.05, 0.012 * (3 - s)), at=(0, -d / 2 - 0.02 - s * 0.04, G), lod=0, frame=f)
    porch(ms, f, 0, -d / 2 + 0.04, 0.36, 0.14, 0.27)
    banner(ms, f, w / 2 - 0.13, -d / 2 + 0.035, G + h - 0.05)
    for wx in (-0.2, 0.2):
        ms.box('dark', (0.04, 0.01, 0.04), at=(wx + (0.06 if wx > 0 else -0.06), -d / 2 + 0.03, G + 0.32), lod=0, frame=f)
    tt.outside_stair(ms, f, 1, w * 0.93, d, h, wall='pylon')
    # the rooftop shrine at the back right, its timber frame and the flag
    sx, sy = w * 0.22, d * 0.2
    ms.box('pylon', (0.2, 0.18, 0.16), at=(sx, sy, G + h), lod=2, frame=f, bevel=0.004)
    tt._parapet(ms, f, 'pylon', sx, sy, 0.2, 0.18, G + h + 0.16)
    ms.box('door', (0.06, 0.012, 0.12), at=(sx, sy - 0.09 - 0.002, G + h), lod=1, frame=f)
    for px in (-0.08, 0.08):
        ms.box('timber', (0.014, 0.014, 0.07), at=(sx + px, sy - 0.07, G + h + 0.21), lod=0, frame=f)
    ms.box('timber', (0.2, 0.014, 0.014), at=(sx, sy - 0.07, G + h + 0.28), lod=0, frame=f)
    top = 0.8  # 8 m, at the sheet's scale
    ms.cyl('timber', 0.012, 0.009, top - (G + h + 0.16), at=(sx + 0.07, sy + 0.05, G + h + 0.16), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, sx + 0.07, sy + 0.05, top - 0.005, w=0.16, h=0.1)
    for (jx, jy) in ((-0.28, -0.36), (-0.24, -0.37), (0.28, -0.36), (0.25, -0.38), (-0.3, 0.1)):
        tt.jar(ms, f, jx, jy, rng.uniform(0.9, 1.15))


def palace(ms, rng):
    """`palace` (12 m): a stepped ziggurat palace with buttressed stages, a summit hall, three
    stairs on the front (a central flight to the second stage, two side flights to the first),
    reed shades on the first terrace, two team banners on poles (16 m, at the sheet's scale)."""
    f = tm.house_frame(0, 0, 0)
    tiers = [(1.16, 0.98, 0.55), (0.84, 0.7, 0.42), (0.52, 0.44, 0.36)]
    offs = [(0, 0.1), (0, 0.16), (0, 0.2)]
    z = G
    tops = []
    for (w, d, h), (ox, oy) in zip(tiers, offs):
        ms.box('pylon', (w, d, h), at=(ox, oy, z), lod=2, frame=f, bevel=0.008, taper=0.94)
        ms.box('roof', (w * 0.94 - 0.03, d * 0.94 - 0.03, 0.012), at=(ox, oy, z + h), lod=2, frame=f)
        tt._parapet(ms, f, 'pylon', ox, oy, w * 0.94, d * 0.94, z + h)
        n = max(5, int(w / 0.14))
        for k in range(1, n):  # pilasters on the front and beam ends
            bx = ox - w / 2 + w * k / n
            ms.box('pylon', (0.04, 0.02, h * 0.9), at=(bx, oy - d / 2 * 0.97 - 0.008, z), lod=0, frame=f)
            ms.cyl('timber', 0.011, 0.011, 0.05, at=(bx + w / n / 2, oy - d / 2 + 0.012, z + h - 0.05), rot=(90, 0, 0), segs=6, lod=0, frame=f)
        tops.append((z, z + h, ox, oy, w, d))
        z += h
    # the summit hall
    ms.box('pylon', (0.26, 0.22, 0.18), at=(0, 0.22, z), lod=2, frame=f, bevel=0.004)
    tt._parapet(ms, f, 'pylon', 0, 0.22, 0.26, 0.22, z + 0.18)
    ms.box('door', (0.07, 0.012, 0.12), at=(0, 0.22 - 0.11 - 0.002, z), lod=1, frame=f)
    # the central stair: ground to the top of the second stage, on the front of both stages
    (z0, z1, ox0, oy0, w0, d0), (_, z2, ox1, oy1, w1, d1) = tops[0], tops[1]
    front0 = oy0 - d0 / 2
    steps = 14
    run = 0.2
    for s in range(steps):
        sz = (s + 1) * (z1 - G) / steps
        ms.box('pylon', (0.2, run / steps + 0.002, sz), at=(0, front0 - run + (s + 0.5) * run / steps, G), lod=1, frame=f)
    front1 = oy1 - d1 / 2
    run1 = front1 - front0
    for s in range(10):
        sz = (s + 1) * (z2 - z1) / 10
        ms.box('pylon', (0.16, run1 / 10 + 0.002, sz), at=(0, front0 + (s + 0.5) * run1 / 10, z1), lod=1, frame=f)
    for sx in (-1, 1):  # side flights up to the first terrace
        for s in range(10):
            sz = (s + 1) * (z1 - G) / 10
            ms.box('pylon', (0.14, 0.2 / 10 + 0.002, sz), at=(sx * 0.38, front0 - 0.2 + (s + 0.5) * 0.02, G), lod=1, frame=f)
        tt.pergola(ms, f, sx * 0.4, oy0 - d0 / 2 + 0.17, z1, 0.22, 0.18, lod=1, post_h=0.13)
        # a team banner on a pole at each front corner of the second stage
        bx, by = sx * (w1 / 2 - 0.06), oy1 - d1 / 2 + 0.06
        top = 1.5  # the banner poles stop just under the summit hall's 16 m
        ms.cyl('timber', 0.012, 0.009, top - z1, at=(bx, by, z1), segs=6, lod=1, frame=f)
        bf = f @ tm.Matrix.Translation(tm.Vector((bx + sx * 0.012, by, top - 0.03)))
        ms.box('team_cloth', (0.1, 0.006, 0.2), at=(sx * 0.05, 0, -0.2), lod=1, frame=bf)
    ms.box('door', (0.12, 0.012, 0.2), at=(0, front1 + 0.01, z1), lod=1, frame=f)
    for k in range(6):
        tt.jar(ms, f, -0.52 + 0.03 * k, front0 - 0.05, rng.uniform(0.9, 1.1))


# ---- big-town landmarks ------------------------------------------------------------------------

def lion(ms, f, x, y, yaw=0.0):
    """A guardian lion on a stone plinth, couchant, facing local -Y (front)."""
    lf = f @ tm.house_frame(x, y, yaw)
    ms.box('stone', (0.16, 0.24, 0.07), at=(0, 0, G), lod=1, frame=lf, bevel=0.005)
    ms.box('stone', (0.1, 0.18, 0.07), at=(0, 0.02, G + 0.07), lod=1, frame=lf, bevel=0.012)
    ms.sphere('stone', 0.05, at=(0, -0.07, G + 0.165), scale=(1.0, 1.1, 1.0), u=8, v=5, lod=1, frame=lf)
    ms.box('stone', (0.08, 0.05, 0.025), at=(0, -0.1, G + 0.07), lod=0, frame=lf)


def town_gate(ms, x, y, yaw=0.0, width=0.5, h=0.62):
    """A gateway: two battered piers, a timber lintel and a beam, a team cloth across the top, and
    two guardian lions on plinths in front."""
    f = tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        ms.box('pylon', (0.22, 0.3, h), at=(sx * (width / 2 + 0.11), 0, G), lod=2, frame=f, bevel=0.005, taper=0.88)
        tt._parapet(ms, f, 'pylon', sx * (width / 2 + 0.11), 0, 0.19, 0.27, G + h)
        lion(ms, f, sx * (width / 2 + 0.2), -0.3)
    ms.box('timber', (width + 0.06, 0.08, 0.05), at=(0, 0, G + h - 0.12), lod=1, frame=f)
    ms.box('timber', (width + 0.1, 0.03, 0.03), at=(0, -0.05, G + h - 0.04), lod=0, frame=f)
    ms.box('team_cloth', (width - 0.06, 0.006, 0.05), at=(0, -0.045, G + h - 0.18), lod=1, frame=f)
    return f


def watch_tower(ms, x, y, h=1.9, w=0.5, rng=None):
    """A tall square mud-brick tower, battered, with slit windows, merlons and a timber look-out
    with a reed roof on top."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y))
    ms.box('pylon', (w, w * 0.92, h), at=(0, 0, G), lod=2, frame=f, bevel=0.006, taper=0.86)
    top = G + h
    tw = w * 0.86
    tt._parapet(ms, f, 'pylon', 0, 0, tw, tw * 0.92, top)
    merlons(ms, f, 0, 0, tw, tw * 0.92, top + 0.05, mat='pylon')
    for k in range(4):
        ms.box('dark', (0.03, 0.01, 0.08), at=(-0.1 + 0.2 * (k % 2), -w * 0.46 * (1 - 0.14 * k / 3) - 0.004, G + 0.4 + 0.35 * k), lod=0, frame=f)
    ms.box('door', (0.1, 0.012, 0.18), at=(0, -w * 0.46 - 0.004, G), lod=1, frame=f)
    tt.pergola(ms, f, 0, 0, top, tw * 0.7, tw * 0.62, lod=1, post_h=0.16)
    for k in range(5):
        ms.cyl('timber', 0.012, 0.012, 0.05, at=(-tw / 2 + tw * (k + 0.5) / 5, -tw * 0.46 + 0.01, top - 0.06), rot=(90, 0, 0), segs=6, lod=0, frame=f)
    return f


def granaries(ms, x, y, n=5, r=0.17, h=0.62, yaw=None):
    """A row of round mud-brick granaries with domed tops and timber ladders, on a low platform."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    span = n * r * 2.1
    ms.box('pylon', (span + 0.12, r * 2 + 0.16, 0.06), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for i in range(n):
        cx = -span / 2 + r * 1.05 + i * r * 2.1
        cy = 0.0 if i % 2 == 0 else 0.03
        ms.cyl('pylon', r, r * 0.96, h, at=(cx, cy, G + 0.06), segs=12, lod=2, frame=f)
        ms.sphere('pylon', r * 0.96, at=(cx, cy, G + 0.06 + h), scale=(1, 1, 0.55), u=12, v=6, cut_below=0.0, lod=1, frame=f)
        ms.box('dark', (0.05, 0.01, 0.06), at=(cx, cy - r - 0.003, G + 0.06 + h * 0.75), lod=0, frame=f)
        if i % 2 == 0:
            tt.ladder(ms, f, cx + 0.06, cy - r - 0.12, h + 0.05, lean=14, z=G + 0.06)
    return f


def step_pyramid(ms, x, y, base=0.9, levels=4, h=0.18, yaw=None):
    """A small stepped pyramid shrine: stacked stages of falling size with a capstone."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    z = G
    for i in range(levels):
        s = base * (1 - i / (levels + 0.6))
        ms.box('pylon', (s, s, h), at=(0, 0, z), lod=2, frame=f, bevel=0.004, taper=0.94)
        z += h
    ms.cyl('pylon', base * 0.16, 0.0, h * 1.1, at=(0, 0, z), rot=(0, 0, 45), segs=4, lod=1, frame=f)
    ms.box('door', (0.08, 0.012, 0.12), at=(0, -base / 2 * 0.97 - 0.004, G), lod=1, frame=f)
    return f


# ---- wall rings (a ring just outside the town's footprint, one gate at the front, south) --------
# Heights are raised 1.3x like the houses, so a wall stands to the eaves of the houses it guards
# as on the sheets; diameters are the sheets' own.

WALL_RAISE = 1.3


def sweep(ms, mat, profile, a0, a1, n, lod=2, only=None):
    """A strip swept round the origin: `profile` is a polyline [(r, z), ...] turned from angle a0
    to a1 (degrees, 0 east, counter-clockwise) in n steps. Walk the profile with the outside on
    the right (up the outer face, across the top, down the inner face)."""
    bm = tt.bmesh.new()
    rows = []
    for j in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * j / n)
        c, s = math.cos(a), math.sin(a)
        rows.append([bm.verts.new((r * c, r * s, z)) for r, z in profile])
    for j in range(n):
        for i in range(len(profile) - 1):
            bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
    bm.normal_update()
    bm.faces.ensure_lookup_table()
    # the face normal should point to the profile's right: (dz, -dr) in the (r, z) plane
    (r0, z0), (r1, z1) = profile[0], profile[1]
    am = math.radians(a0 + (a1 - a0) * 0.5 / n)
    want = tm.Vector(((z1 - z0) * math.cos(am), (z1 - z0) * math.sin(am), -(r1 - r0)))
    if bm.faces[0].normal.dot(want) < 0:
        tt.bmesh.ops.reverse_faces(bm, faces=bm.faces[:])
    return ms.add(bm, mat, lod, only=only)


def ring_frame(r, a_deg, z=0.0):
    """A frame on the ring at angle a: local +X along the ring (counter-clockwise), -Y outward."""
    a = math.radians(a_deg)
    return tm.Matrix.Translation(tm.Vector((r * math.cos(a), r * math.sin(a), z))) @ tm.Matrix.Rotation(a + math.pi / 2, 4, 'Z')


def footing(ms, r_out, r_in, n, lod=1, apron=0.5):
    """Packed earth at the foot of a wall: a narrow alpha-cut band outside, and inside an apron of
    earth (under the town's own ground where they meet, so no grass shows between the two) that
    ends in an alpha-cut band."""
    sweep(ms, 'earth_fringe', [(r_out + 0.2, 0.0), (r_out, G + 0.004)], 0, 360, n, lod=lod)
    sweep(ms, 'earth', [(r_in, G * 0.6), (r_in - apron, G * 0.5)], 0, 360, n, lod=lod)
    sweep(ms, 'earth_fringe', [(r_in - apron, G * 0.5), (r_in - apron - 0.14, G * 0.3)], 0, 360, n, lod=lod)


def merlon_ring(ms, r, z, a0, a1, step, skip, size=(0.055, 0.04, 0.055), mat='brick'):
    """Merlons along the outer edge of a wall top from a0 to a1, leaving out angles in `skip`
    [(centre, half width)] (the towers)."""
    n = max(2, int(math.radians(abs(a1 - a0)) * r / step))
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        if any(abs((a - c + 180) % 360 - 180) < hw for c, hw in skip):
            continue
        ms.box(mat, size, at=(0, 0, 0), lod=0, frame=ring_frame(r, a, z))


def wall_tower(ms, f, w, d, h, rng, flag_top=None, slits=2, mat='brick', band=None):
    """A square battered tower in frame f (front -Y): merlons, slit windows, a timber floor on top,
    a lime or plaster band at its foot when `band` (material, height) is given."""
    ms.box(mat, (w, d, h), at=(0, 0, 0), lod=2, frame=f, bevel=0.005, taper=0.94)
    if band:
        ms.box(band[0], (w + 0.006, d + 0.006, band[1]), at=(0, 0, 0), lod=1, frame=f)
    tw, td = w * 0.94, d * 0.94
    tt._parapet(ms, f, mat, 0, 0, tw, td, h)
    merlons(ms, f, 0, 0, tw, td, h + 0.05, step=0.1, size=0.05, h=0.05, mat=mat)
    ms.box('timber', (tw - 0.06, td - 0.06, 0.008), at=(0, 0, h), lod=1, frame=f)
    for k in range(slits):
        ms.box('dark', (0.03, 0.01, 0.08), at=(0, -d / 2 * (1 - 0.06 * (k + 1)) - 0.004, h * (0.45 + 0.3 * k)), lod=0, frame=f)
    if flag_top:
        ms.cyl('timber', 0.012, 0.009, flag_top - h, at=(0, td * 0.2, h), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, 0, td * 0.2, flag_top - 0.005, yaw=-160, w=0.2, h=0.13)


def gate_doors(ms, f, w, h, straps=False):
    """Two plank leaves with braces, in frame f, on the local y = 0 plane facing -Y."""
    for sx in (-1, 1):
        ms.box('door', (w / 2 - 0.004, 0.03, h), at=(sx * w / 4, 0, 0), lod=1, frame=f)
        if straps:  # bronze straps with bosses
            for k in range(3):
                ms.box('bronze', (w / 2 - 0.03, 0.008, 0.02), at=(sx * w / 4, -0.018, h * (0.18 + 0.32 * k)), lod=0, frame=f)
        else:  # a Z brace
            bf = f @ tm.Matrix.Translation(tm.Vector((sx * w / 4, -0.017, h / 2))) @ tm.Matrix.Rotation(math.atan2(h * 0.7, w / 2) * sx, 4, 'Y')
            ms.box('timber', (0.018, 0.006, math.hypot(h * 0.7, w / 2) * 0.95), at=(0, 0, -math.hypot(h * 0.7, w / 2) * 0.475), lod=0, frame=bf)
            for zz in (0.12, 0.88):
                ms.box('timber', (w / 2 - 0.03, 0.006, 0.018), at=(sx * w / 4, -0.017, h * zz - 0.009), lod=0, frame=f)


def walls_small(ms, rng):
    """`walls-small` (44 m): a palisade of sharpened logs lashed with two reed-fibre bands on a
    packed earth berm, and a timber gatehouse at the south with plank doors and a railed top."""
    R = 2.08
    h = 0.3 * WALL_RAISE
    berm = 0.045
    gate_w = 0.4
    half = math.degrees(math.asin((gate_w / 2 + 0.05) / R))
    a0, a1 = -90 + half, 270 - half
    # the berm: a raised ring of earth, alpha-cut on both slopes
    sweep(ms, 'earth_fringe', [(R + 0.24, 0.0), (R + 0.12, berm)], 0, 360, 96, lod=1)
    sweep(ms, 'earth', [(R + 0.12, berm), (R - 0.1, berm)], 0, 360, 96, lod=1, only=(0, 1))
    sweep(ms, 'earth', [(R + 0.2, 0.01), (R - 0.1, berm)], 0, 360, 36, lod=2, only=2)
    sweep(ms, 'earth_fringe', [(R - 0.1, berm), (R - 0.22, G * 0.6)], 0, 360, 96, lod=1)
    # LOD0: the logs, one by one
    n = int(math.radians(a1 - a0) * R / 0.036)
    for i in range(n):
        a = a0 + (a1 - a0) * (i + 0.5) / n
        lh = h * rng.uniform(0.9, 1.06)
        r = rng.uniform(0.016, 0.02)
        f = ring_frame(R + rng.uniform(-0.006, 0.006), a, berm - 0.01) @ tm.Matrix.Rotation(math.radians(rng.uniform(-2, 2)), 4, 'X')
        ms.cyl('log', r, r * 0.92, lh, at=(0, 0, 0), segs=5, lod=0, frame=f, caps=False)
        ms.cyl('log', r * 0.92, 0.0, 0.05, at=(0, 0, lh), segs=5, lod=0, frame=f, caps=False)
    for zb in (0.12, 0.27):  # reed lashings round the outside
        sweep(ms, 'reed', [(R + 0.021, berm + zb), (R + 0.021, berm + zb + 0.014)], a0, a1, 120, lod=0)
    # LOD1 and LOD2: the palisade as a band with a toothed top (LOD1) or a plain one (LOD2)
    for lod, steps in ((1, 72), (2, 32)):
        top = berm + h
        sweep(ms, 'log', [(R + 0.018, berm - 0.01), (R + 0.018, top)], a0, a1, steps, lod=lod, only=lod)
        sweep(ms, 'log', [(R + 0.018, top), (R - 0.018, top)], a0, a1, steps, lod=lod, only=lod)
        sweep(ms, 'log', [(R - 0.018, top), (R - 0.018, berm - 0.01)], a0, a1, steps, lod=lod, only=lod)
    bm = tt.bmesh.new()  # LOD1 teeth: a triangle on every 0.07 of the ring
    nt = int(math.radians(a1 - a0) * R / 0.07)
    for i in range(nt):
        aa, ab = math.radians(a0 + (a1 - a0) * i / nt), math.radians(a0 + (a1 - a0) * (i + 1) / nt)
        am = (aa + ab) / 2
        rr = R + 0.0
        v = [bm.verts.new((rr * math.cos(aa), rr * math.sin(aa), berm + h)), bm.verts.new((rr * math.cos(ab), rr * math.sin(ab), berm + h)),
             bm.verts.new((rr * math.cos(am), rr * math.sin(am), berm + h + 0.05))]
        bm.faces.new(v)
    ms.add(bm, 'log', 1, only=1)
    # the gatehouse: four posts, a lintel, a railed top, plank doors
    gf = tm.house_frame(0, -R, 0)
    gh = 0.35 * WALL_RAISE
    for sx in (-1, 1):
        for sy in (-0.05, 0.05):
            ms.box('timber', (0.035, 0.035, gh + 0.06), at=(sx * (gate_w / 2 + 0.02), sy, berm - 0.01), lod=2, frame=gf)
        ms.box('timber', (0.03, 0.13, 0.02), at=(sx * (gate_w / 2 + 0.02), 0, berm + gh - 0.06), lod=0, frame=gf)
    for sy in (-0.05, 0.05):
        ms.box('timber', (gate_w + 0.1, 0.03, 0.035), at=(0, sy, berm + gh - 0.02), lod=2, frame=gf)
        ms.box('timber', (gate_w + 0.08, 0.016, 0.016), at=(0, sy, berm + gh + 0.04), lod=0, frame=gf)
    ms.box('timber', (gate_w + 0.06, 0.12, 0.012), at=(0, 0, berm + gh - 0.012), lod=1, frame=gf)
    gate_doors(ms, gf @ tm.Matrix.Translation(tm.Vector((0, 0.0, berm - 0.005))), gate_w, gh - 0.07)
    tt.clutter(ms, gf, gate_w / 2 + 0.16, -0.12, rng, 3)


def mud_wall_ring(ms, rng, R_out, R_in, H, gate_x, band, buttresses=(), towers=(), tower_size=0.6,
                  tower_h=None, gate_towers=(0.6, 0.78), gate_flag=None, straps=False, n=(144, 72, 32), planks=True):
    """A mud-brick ring with a battered outer face, a lime or plaster band at its foot, merlons,
    a timber wall-walk, packed earth at the foot, two gate towers at the south (gate opening
    2 * gate_x wide), buttresses and towers at the given angles."""
    R_top = R_out - 0.03
    bh = band[1]
    gw = gate_x * 2
    gtw, gth = gate_towers
    half = math.degrees(math.asin((gate_x + gtw * 0.5) / ((R_out + R_in) / 2)))
    a0, a1 = -90 + half, 270 - half
    for lod in (0, 1, 2):
        steps = n[lod]
        sweep(ms, band[0], [(R_out, 0.0), (R_out - 0.005, bh)], a0, a1, steps, lod=lod, only=lod)
        sweep(ms, 'brick', [(R_out - 0.005, bh), (R_top, H)], a0, a1, steps, lod=lod, only=lod)
        sweep(ms, 'roof', [(R_top, H), (R_in + 0.01, H)], a0, a1, steps, lod=lod, only=lod)
        sweep(ms, 'brick', [(R_in + 0.01, H), (R_in, 0.0)], a0, a1, steps, lod=lod, only=lod)
        if lod < 2:  # the outer parapet: a low band (with merlons on it at LOD0) and an inner rail
            ph = 0.03 if lod == 0 else 0.06
            sweep(ms, 'brick', [(R_top, H), (R_top, H + ph), (R_top - 0.04, H + ph), (R_top - 0.04, H)], a0, a1, steps, lod=lod, only=lod)
            sweep(ms, 'brick', [(R_in + 0.035, H), (R_in + 0.035, H + 0.035), (R_in + 0.01, H + 0.035), (R_in + 0.01, H)], a0, a1, steps, lod=lod, only=lod)
    walk_in = R_in + 0.045
    sweep(ms, 'timber', [(R_top - 0.045, H + 0.004), (walk_in, H + 0.004)], a0, a1, n[1], lod=1)
    # the walk's plank joints (LOD0)
    joints = int(math.radians(a1 - a0) * (R_top + R_in) / 2 / 0.09) if planks else 0
    for i in range(joints):
        a = a0 + (a1 - a0) * (i + 0.5) / joints
        ms.box('dark', (0.006, R_top - walk_in - 0.05, 0.002), at=(0, 0, 0), lod=0,
               frame=ring_frame((R_top + walk_in) / 2, a, H + 0.004))
    footing(ms, R_out, R_in, n[1])
    t_half = math.degrees(math.asin(tower_size * 0.55 / R_out))
    skip = [(a, t_half) for a in towers] + [(a, math.degrees(math.asin(0.13 / R_out))) for a in buttresses]
    merlon_ring(ms, R_top - 0.02, H + 0.03, a0, a1, 0.11, skip)
    for a in buttresses:
        f = ring_frame(R_out - 0.02, a)
        ms.box('brick', (0.2, 0.22, H * 0.92), at=(0, -0.08, 0), lod=1, frame=f, bevel=0.004, taper=0.82)
        ms.box(band[0], (0.206, 0.226, bh * 0.9), at=(0, -0.08, 0), lod=0, frame=f)
    th = tower_h or H * 1.3
    for a in towers:
        f = ring_frame((R_out + R_in) / 2 + 0.05, a)
        wall_tower(ms, f, tower_size, tower_size * 0.95, th, rng, band=band)
    # the gate: two towers, the doors set back between them, a lintel and a timber bridge on top
    gy = -(R_out + R_in) / 2
    for sx in (-1, 1):
        f = tm.house_frame(sx * (gate_x + gtw / 2), gy - 0.03, 0)
        wall_tower(ms, f, gtw, gtw * 0.95, gth, rng, flag_top=gate_flag, band=band)
    gf = tm.house_frame(0, gy, 0)
    gh = H * 0.82
    gate_doors(ms, gf @ tm.Matrix.Translation(tm.Vector((0, 0.02, 0))), gw, gh - 0.02, straps=straps)
    ms.box('brick', (gw + 0.04, R_out - R_in, H - gh + 0.02), at=(0, 0, gh), lod=2, frame=gf)
    ms.box('timber', (gw + 0.06, 0.05, 0.04), at=(0, -0.02, gh - 0.02), lod=1, frame=gf)
    ms.box('timber', (gw, R_out - R_in - 0.04, 0.01), at=(0, 0, H + 0.02), lod=1, frame=gf)
    for k in range(5):
        ms.box('timber', (0.014, 0.014, 0.08), at=(-gw / 2 + gw * k / 4, -0.08, H + 0.03), lod=0, frame=gf)
    ms.box('timber', (gw, 0.014, 0.014), at=(0, -0.08, H + 0.1), lod=0, frame=gf)


def walls_medium(ms, rng):
    """`walls-medium` (64 m): a battered mud-brick ring with merlons, a worn lime-wash band at the
    foot, a timber wall-walk, four buttresses and a gate between two 6 m towers at the south."""
    mud_wall_ring(ms, rng, R_out=3.2, R_in=2.96, H=0.45 * WALL_RAISE, gate_x=0.25, band=('limewash', 0.15),
                  buttresses=(40, 140, 200, 340), gate_towers=(0.56, 0.6 * WALL_RAISE))


def walls_big(ms, rng):
    """`walls-big` (86 m): a plastered mud-brick ring with crenellations and a timber wall-walk,
    seven towers round it, and a gate with bronze-strapped doors between two towers that fly team
    flags at the south."""
    mud_wall_ring(ms, rng, R_out=4.3, R_in=3.97, H=0.6 * WALL_RAISE, gate_x=0.3, band=('plaster', 0.22),
                  towers=(0, 45, 90, 135, 180, 222, 318), tower_size=0.68, tower_h=0.78 * WALL_RAISE,
                  gate_towers=(0.7, 0.84 * WALL_RAISE), gate_flag=1.4, straps=True, n=(128, 52, 32), planks=False)


# ---- the colony camp (an outpost a settler has just founded) ------------------------------------

def tent(ms, x, y, w=0.3, d=0.42, h=0.24, yaw=0.0):
    """An A-frame linen tent, its ridge along local Y and its open flap at the front (-Y)."""
    f = tm.house_frame(x, y, yaw)
    bm = tt.bmesh.new()
    ov = 0.02
    p = [(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)]
    v = [bm.verts.new((px, py, G)) for px, py in p]
    r0, r1 = bm.verts.new((0, -d / 2 - ov, G + h)), bm.verts.new((0, d / 2 + ov, G + h))
    bm.faces.new((v[0], v[3], r1, r0))
    bm.faces.new((v[2], v[1], r0, r1))
    bm.faces.new((v[3], v[2], r1))
    bm.faces.new((v[1], v[0], r0))
    tt.bmesh.ops.recalc_face_normals(bm, faces=bm.faces)  # a closed prism: safe to orient
    ms.add(bm, 'linen', 2, matrix=f)
    bm = tt.bmesh.new()  # the dark opening on the front gable
    o = [bm.verts.new((-w * 0.18, -d / 2 - 0.004, G)), bm.verts.new((w * 0.18, -d / 2 - 0.004, G)), bm.verts.new((0, -d / 2 - 0.004, G + h * 0.72))]
    bm.faces.new((o[0], o[1], o[2]))
    ms.add(bm, 'dark', 1, matrix=f)
    for sy in (-d / 2 - ov, d / 2 + ov):
        ms.cyl('timber', 0.007, 0.006, h + 0.04, at=(0, sy, G), segs=5, lod=0, frame=f)
    for sx in (-1, 1):  # guy ropes to pegs
        for sy in (-d / 2 - 0.05, d / 2 + 0.05):
            ms.box('timber', (0.01, 0.01, 0.03), at=(sx * (w / 2 + 0.06), sy, G), lod=0, frame=f)


def hut(ms, x, y, w=0.62, d=0.42, wall_h=0.22, top=0.39):
    """A reed-walled hut with corner posts, a plank door and a steep thatched gable roof."""
    f = tm.house_frame(x, y, 0)
    ms.box('reed', (w, d, wall_h), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('timber', (0.03, 0.03, wall_h + 0.02), at=(sx * (w / 2 - 0.005), sy * (d / 2 - 0.005), G), lod=1, frame=f)
    ms.box('door', (0.11, 0.012, 0.17), at=(0.05, -d / 2 - 0.004, G), lod=1, frame=f)
    rise = top - G - wall_h
    ov = 0.06
    run = d / 2 + ov
    slope = math.atan2(rise + 0.03, run)
    length = math.hypot(run, rise + 0.03)
    for sy in (-1, 1):
        rf = f @ tm.Matrix.Translation(tm.Vector((0, sy * run / 2, G + wall_h - 0.03 + (rise + 0.03) / 2))) @ tm.Matrix.Rotation(-slope * sy, 4, 'X')
        ms.box('thatch', (w + 0.1, length + 0.02, 0.035), at=(0, 0, -0.0175), lod=2, frame=rf)
    bm = tt.bmesh.new()  # the reed gables
    for sx in (-w / 2, w / 2):
        g = [bm.verts.new((sx, -d / 2, G + wall_h)), bm.verts.new((sx, d / 2, G + wall_h)), bm.verts.new((sx, 0, top - 0.01))]
        bm.faces.new(g if sx > 0 else list(reversed(g)))
    ms.add(bm, 'reed', 2, matrix=f)
    ms.box('timber', (w + 0.14, 0.03, 0.03), at=(0, 0, top - 0.02), lod=1, frame=f)


def fire_ring(ms, rng, x, y, r=0.085):
    f = tm.house_frame(x, y, 0)
    ms.cyl('ash', r * 0.85, r * 0.8, 0.008, at=(0, 0, G), segs=12, lod=1, frame=f)
    for i in range(11):
        a = 2 * math.pi * i / 11
        ms.sphere('stone', 0.024, at=(r * math.cos(a), r * math.sin(a), G + 0.008), scale=(1.1, 0.9, 0.7), u=6, v=4, lod=0, frame=f)
    for k in range(3):  # charred sticks
        ms.cyl('timber', 0.008, 0.008, 0.11, at=(-0.05, 0, G + 0.012), rot=(0, 85, 0), segs=5, lod=0, frame=f @ tm.house_frame(0, 0, 60 * k))


def log_bundle(ms, x, y, yaw, length=0.38):
    f = tm.house_frame(x, y, yaw)
    for k, (dx, dz) in enumerate(((-0.036, 0), (0, 0), (0.036, 0), (-0.018, 0.032), (0.018, 0.032), (0, 0.064))):
        ms.cyl('timber', 0.018, 0.018, length, at=(dx, -length / 2, G + 0.018 + dz), rot=(-90, 0, 0), segs=6, lod=1 if k < 3 else 0, frame=f)
    for sy in (-0.1, 0.1):
        ms.box('reed', (0.11, 0.014, 0.1), at=(0, sy, G), lod=0, frame=f)


def stakes(ms, rng, pts, h=(0.26, 0.42)):
    for x, y in pts:
        sh = rng.uniform(*h)
        r = rng.uniform(0.016, 0.021)
        f = tm.house_frame(x, y, rng.uniform(0, 360)) @ tm.Matrix.Rotation(math.radians(rng.uniform(-4, 4)), 4, 'X')
        ms.cyl('timber', r, r * 0.92, sh, at=(0, 0, G - 0.01), segs=6, lod=1, frame=f, caps=False)
        ms.cyl('timber', r * 0.92, 0.0, 0.05, at=(0, 0, G - 0.01 + sh), segs=6, lod=1, frame=f, caps=False)


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): a packed earth clearing with a thatched reed hut at the back, two
    linen tents, a stone fire ring, jars, crates, sacks, a bundle of logs, a half-built palisade of
    stakes along the west and north, and a team flag on a 4 m pole held by stones."""
    hut(ms, 0.02, 0.45)
    tent(ms, -0.55, -0.02)
    tent(ms, 0.55, -0.02)
    fire_ring(ms, rng, 0.05, -0.12)
    world = tm.house_frame(0, 0, 0)
    for k in range(7):  # the supplies
        tt.jar(ms, world, -0.26 + rng.uniform(-0.07, 0.07), -0.4 + rng.uniform(-0.06, 0.06), rng.uniform(1.2, 1.7))
    tt.crate(ms, world, -0.14, -0.48, 1.4, 10)
    tt.crate(ms, world, -0.1, -0.42, 1.2, -15, z=G)
    for k in range(3):
        ms.sphere('linen', 0.035, at=(-0.1 + 0.05 * k, -0.36 + 0.02 * k, G + 0.03), scale=(1, 0.9, 1.1), u=8, v=5, lod=0)
    log_bundle(ms, 0.34, -0.4, 40)
    west = [(-0.86 + rng.uniform(-0.01, 0.01), -0.72 + 0.062 * i) for i in range(25)]
    north = [(-0.8 + 0.062 * i, 0.8 + rng.uniform(-0.01, 0.01)) for i in range(28) if not (6 <= i <= 7 or 19 <= i <= 21)]
    stakes(ms, rng, west + north)
    ms.cyl('timber', 0.016, 0.012, 0.4 * WALL_RAISE - G, at=(0.74, -0.58, G), segs=6, lod=2)
    tt.pennant(ms, world, 0.74, -0.58, 0.4 * WALL_RAISE - 0.005, yaw=-160, lod=2, w=0.24, h=0.15)
    for k in range(5):
        a = 2 * math.pi * k / 5
        ms.sphere('stone', 0.03, at=(0.74 + 0.04 * math.cos(a), -0.58 + 0.04 * math.sin(a), G + 0.01), scale=(1.1, 1, 0.8), u=6, v=4, lod=1)
