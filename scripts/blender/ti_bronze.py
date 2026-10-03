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
