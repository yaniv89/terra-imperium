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
