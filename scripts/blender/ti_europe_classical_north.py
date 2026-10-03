# scripts/blender/ti_europe_classical_north.py
# The northern landmark of the Europe kit in the Classical Age (art spec 3b: "variant for the
# north: a Celtic hillfort hall"; plans/art/kits/europe/classical/landmark-north): a long hall of
# ochre daub between oak posts over a woven wattle base, a steep golden thatch gable with a pegged
# ridge pole, carved bargeboards and a team-cloth banner on the gable end over double plank doors,
# inside a grassy earth bank with a short palisade. Built from the Bronze Europe kit's parts
# (ti_europe_bronze.py), so the hall shares its thatch, daub, oak and wattle.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import bmesh  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_europe_bronze as eb  # noqa: E402
from ti_town import G  # noqa: E402


def celtic_hall(ms, rng, x, y, w=0.62, d=0.95, top=0.62, yaw=None, bank=0.12):
    """The hall (sheet: 8 m across the gable, about 12 m long, 6 m to the ridge, on an 18 x 16 m
    banked enclosure): w x d the hall, `bank` the width of the earth bank round it."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y) if yaw is None else yaw)
    eb.foot(f, w + 2 * bank + 0.12, d + 2 * bank + 0.1, tag='hall')
    h = 0.24
    # the banked enclosure: a grass floor, an earth bank on three sides, a palisade on the east
    ew, ed = w + 2 * bank + 0.12, d + 2 * bank + 0.1
    eb.grass_patch(ms, f, 0, 0, ew - 0.04, ed - 0.04, lod=2)
    for (px, py, pw, pd) in ((-(ew - bank) / 2, 0.02, bank, ed - 0.08), ((ew - bank) / 2, 0.02, bank, ed - 0.08), (0, (ed - bank) / 2, ew, bank)):
        ms.box('eu_turf', (pw, pd, 0.07), at=(px, py, G - 0.005), lod=1, frame=f, taper=0.55)
    pts = []
    for k in range(9):
        p = f @ Vector((ew / 2 - bank * 0.4, -ed * 0.3 + k * (ed * 0.7) / 8, 0))
        pts.append((p.x, p.y))
    tb.stakes(ms, rng, pts, h=(0.14, 0.18))
    # the hall: wattle base, daub walls, oak posts
    ms.box('eu_wattle', (w, d, 0.07), at=(0, 0, G), lod=1, frame=f)
    ms.box('eu_daub', (w - 0.004, d - 0.004, h), at=(0, 0, G), lod=2, frame=f)
    for sx in (-1, 1):
        n = 6
        for i in range(n + 1):
            py = -d / 2 + d * i / n
            ms.cyl('eu_oak', 0.016, 0.016, h + 0.01, at=(sx * (w / 2 + 0.004), py, G), segs=6, lod=0 if 0 < i < n else 1, frame=f)
        for i in range(2):
            ms.box('dark', (0.01, 0.05, 0.05), at=(sx * (w / 2 + 0.004), -d * 0.2 + d * 0.4 * i, G + 0.13), lod=0, frame=f)
    for sy in (-1, 1):
        for px in (-w * 0.25, w * 0.25):
            ms.cyl('eu_oak', 0.016, 0.016, h + 0.01, at=(px, sy * (d / 2 + 0.004), G), segs=6, lod=0, frame=f)
    rise = top - G - h
    rf = f @ Matrix.Rotation(math.radians(90), 4, 'Z')  # the ridge runs front to back, the gable to the front
    tc.gable_roof(ms, rf, d, w, G + h, rise, over=0.06, mat='eu_straw', gable='eu_daub', thick=0.045, lod=2, ridge='eu_straw')
    eb.ridge_pole(ms, rf, d / 2 + 0.02, G + h + rise - 0.005, pegs=7, peg_len=0.09)
    for sy in (-1, 1):  # gable framing: a king post, a tie beam and carved bargeboards crossing at the apex
        gy = sy * (d / 2 + 0.01)
        ms.box('eu_oak', (0.014, 0.012, rise), at=(0, gy, G + h), lod=0, frame=f)
        ms.box('eu_oak', (w + 0.04, 0.014, 0.02), at=(0, gy, G + h), lod=0, frame=f)
        L = math.hypot(w / 2 + 0.06, rise + 0.03)
        a = math.atan2(rise + 0.03, w / 2 + 0.06)
        for sx in (-1, 1):
            bf = f @ Matrix.Translation(Vector((sx * (w / 4 + 0.03), gy - sy * 0.004, G + h + rise / 2))) @ Matrix.Rotation(-sx * a, 4, 'Y')
            ms.box('eu_carved', (L + 0.05, 0.012, 0.026), at=(0, 0, -0.013), lod=0, frame=bf)
    ms.box('door', (0.14, 0.012, 0.18), at=(0, -d / 2 - 0.006, G), lod=1, frame=f)
    ms.box('eu_oak', (0.006, 0.014, 0.18), at=(0, -d / 2 - 0.008, G), lod=0, frame=f)
    ms.box('team_cloth', (0.06, 0.006, 0.1), at=(0, -d / 2 - 0.012, G + h + 0.04), lod=1, frame=f)
    eb.barrel(ms, f, 0.12, -d / 2 - 0.05)
    eb.barrel(ms, f, 0.17, -d / 2 - 0.06)
    return f
