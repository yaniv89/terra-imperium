# scripts/blender/build_town_bronze_small_a.py
# Bronze Age `town-small-a`, the Mesopotamian village (plans/model-brief-for-claude.md, section 4;
# art spec section 3), from plans/art/towns/bronze/town-small-a/approval.png: six flat-roofed,
# lime-washed mud-brick houses round an open 8 m centre, a three-stage stepped tower at the
# north-east with a team flag, a well at the south-west, reed shades, ladders, jars and crates.
#
#   python scripts/blender/build_town_bronze_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

NAME = 'town-small-a'


def stepped_tower(ms, x, y):
    """The landmark: three battered stages, a stair up the front, a team flag on top."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y))
    tiers = [(1.0, 0.95, 0.50), (0.66, 0.62, 0.42), (0.36, 0.36, 0.36)]
    offs = [(0, 0), (0.08, 0.1), (0.1, 0.16)]
    z = G
    for (w, d, h), (ox, oy) in zip(tiers, offs):
        ms.box('mudwall', (w, d, h), at=(ox, oy, z), lod=2, frame=f, bevel=0.008, taper=0.96)
        ms.box('roof', (w * 0.96 - 0.03, d * 0.96 - 0.03, 0.012), at=(ox, oy, z + h), lod=2, frame=f)
        tt._parapet(ms, f, 'mudwall', ox, oy, w * 0.96, d * 0.96, z + h)
        for k in range(6):
            bx = ox - w / 2 + w * (k + 0.5) / 6
            ms.cyl('timber', 0.012, 0.012, 0.05, at=(bx, oy - d / 2 + 0.012, z + h - 0.05), rot=(90, 0, 0), segs=6, lod=0, frame=f)
        z += h
    steps = 9
    for s in range(steps):
        sz = G + (s + 1) * (tiers[0][2] / steps)
        ms.box('mudwall', (0.2, 0.06, sz - G), at=(-0.22, -0.95 / 2 - 0.03 - (steps - 1 - s) * 0.06, G), lod=1, frame=f)
    ms.box('mudwall', (0.05, 0.6, 0.06), at=(-0.345, -0.95 / 2 - 0.27, G), lod=1, frame=f)
    t1top = G + tiers[0][2]
    for s in range(6):
        sz = t1top + (s + 1) * (tiers[1][2] / 6)
        ms.box('mudwall', (0.15, 0.05, sz - t1top), at=(-0.1, 0.1 - 0.62 / 2 - 0.025 - (5 - s) * 0.05, t1top), lod=1, frame=f)
    ms.box('door', (0.12, 0.012, 0.22), at=(0.18, -0.95 / 2 * 0.96 - 0.004, G), lod=1, frame=f)
    ms.box('door', (0.1, 0.012, 0.18), at=(0.1, 0.16 - 0.36 / 2 - 0.004, G + 0.50 + 0.42), lod=1, frame=f)
    ms.box('door', (0.09, 0.012, 0.16), at=(0.22, 0.1 - 0.62 / 2 - 0.004, G + 0.50), lod=0, frame=f)
    for wx in (-0.3, 0.38):
        ms.box('dark', (0.05, 0.01, 0.045), at=(wx, -0.95 / 2 * 0.96 - 0.004, G + 0.32), lod=0, frame=f)
    tt.pergola(ms, f, 0.33, -0.25, G + 0.5, 0.26, 0.22, lod=1, post_h=0.14)
    tt.clutter(ms, f, 0.36, -0.58, tm.seeded(7), 5)
    top = G + 0.50 + 0.42 + 0.36
    pole_h = tt.LANDMARK_TOP - top
    ms.cyl('timber', 0.012, 0.009, pole_h, at=(0.02, 0.22, top), segs=6, lod=1, frame=f)
    tt.pennant(ms, f, 0.02, 0.22, top + pole_h - 0.005)


def layout(ms, rng):
    # the ring of houses (Blender -Y is south, the front); the tower at the north-east
    tt.house(ms, rng, -1.08, 0.78, 0.78, 0.62, roof_items=[('pergola', -0.12, 0.08), ('vent', 0.24, -0.12)], ladder_side=-1, jars=4, heap=(0.3, -0.42))
    tt.house(ms, rng, -0.18, 1.32, 0.66, 0.54, roof_items=[('vent', -0.18, 0.05), ('mat', 0.12, 0.02)], front='shade', jars=4)
    stepped_tower(ms, 0.82, 1.0)
    tt.house(ms, rng, 1.38, 0.02, 0.62, 0.74, roof_items=[('pergola', 0.0, 0.1), ('crates', -0.2, -0.22)], front='shade', ladder_side=1, jars=5)
    tt.house(ms, rng, 0.98, -0.98, 0.7, 0.6, storeys=2, upper=(0.14, 0.12), roof_items=[('vent', -0.22, -0.12)], jars=4, heap=(-0.25, -0.42))
    tt.house(ms, rng, -0.12, -1.36, 0.8, 0.62, roof_items=[('pergola', 0.18, 0.06), ('jars', -0.28, -0.12)], front='team', jars=5)
    tt.house(ms, rng, -1.46, -0.3, 0.66, 0.8, storeys=2, upper=(0.1, 0.16), roof_items=[('vent', -0.16, -0.2), ('mat', 0.12, -0.2)], ladder_side=1, jars=4)
    tt.well(ms, -0.98, -1.06)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-0.55, 1.05), (1.05, -0.45), (-1.25, 0.25), (0.45, -1.15), (-0.35, -0.75)):
        tt.clutter(ms, world, x, y, rng, 4)
    tt.woodpile(ms, world, -0.7, -1.45, 30)
    tt.woodpile(ms, world, 1.4, 0.75, -60)
    tt.rack(ms, world, -0.62, -0.62, 40)
    tt.rack(ms, world, 0.7, 0.42, -35)


if __name__ == '__main__':
    tt.main(NAME, layout)
