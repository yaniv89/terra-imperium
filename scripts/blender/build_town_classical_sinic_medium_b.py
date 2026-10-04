# scripts/blender/build_town_classical_sinic_medium_b.py
# Classical Age `town-medium-b` in the Sinic kit (art spec 3b; plans/art/kits/sinic/classical/):
# the layout of build_town_classical_medium_b.py (the landmark at the north-east, halls in walled
# compounds along the north, houses and yards with trees down both sides, a market at the
# south-west, courtyard walls, an inner ring round a paved square with a 12 m free centre) with the
# que watchtower of the sheet (16 m) in the drum tower's place and the double-eave gate tower
# (10 m) set in the east courtyard wall, its passage opening on the square; walled residences,
# courtyard houses and cottages, round-crowned and blossoming trees.
#
#   python scripts/blender/build_town_classical_sinic_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_sinic_classical as sc  # noqa: E402

NAME = 'town-medium-b'
FILE = 'classical-town-medium-b-sinic'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-1.85, y=2.35, w=0.95, d=0.6, yaw=0, kind='rich', garden=False),
    dict(x=-0.3, y=2.3, w=1.1, d=0.66, yaw=0, kind='rich', garden=False, blossom=True),
    dict(x=1.05, y=2.4, w=0.7, d=0.5, yaw=0, kind='poor'),
    dict(x=-2.4, y=1.0, w=0.85, d=0.55, yaw=90, kind='common'),
    dict(x=-2.4, y=-0.05, w=0.85, d=0.55, yaw=90, kind='poor'),
    dict(x=2.4, y=1.0, w=0.85, d=0.55, yaw=-90, kind='common'),
    dict(x=2.4, y=-0.05, w=0.85, d=0.55, yaw=-90, kind='common', jar_n=3, awning=False),
    dict(x=2.4, y=-1.1, w=0.85, d=0.55, yaw=-90, kind='poor'),
    dict(x=2.25, y=-2.3, w=1.0, d=0.62, yaw=180, kind='common'),
    dict(x=0.95, y=-2.4, w=0.7, d=0.5, yaw=180, kind='poor'),
    dict(x=-1.2, y=1.25, w=0.72, d=0.5, kind='common'),  # the inner ring round the square
    dict(x=0.25, y=1.4, w=0.66, d=0.48, kind='common', awning=False),
    dict(x=-1.25, y=-0.1, w=0.7, d=0.48, kind='common', jar_n=2),
    dict(x=1.15, y=-0.6, w=0.62, d=0.48, kind='poor'),
    dict(x=0.25, y=-1.5, w=0.72, d=0.5, kind='common'),
]


def layout(ms, rng):
    sc.que_tower(ms, rng, 2.3, 2.3, base=0.56, top=1.6, yaw=0)
    sc.court_wall(ms, -2.9, 1.75, -0.9, 1.75, gaps=((0.5, 0.26),))
    sc.court_wall(ms, 0.4, 1.8, 1.7, 1.8, gaps=((0.5, 0.22),))
    sc.court_wall(ms, -1.75, -1.6, -1.75, 1.5, gaps=((0.2, 0.2), (0.55, 0.2), (0.88, 0.2)))
    # the east courtyard wall with the gate tower set in it (the passage runs east to west)
    sc.gate_tower(ms, rng, 1.75, 0.5, w=0.9, d=0.6, top=1.0, yaw=-90)
    sc.court_wall(ms, 1.75, -1.6, 1.75, 0.05, gaps=((0.45, 0.2),))
    sc.court_wall(ms, 1.75, 0.95, 1.75, 1.5)
    for slot in SLOTS:
        sc.sinic_house(ms, rng, slot)
    for side in (-1, 1):
        for i, y in enumerate((1.0, -0.05, -1.1)):
            if side < 0 and i == 2:
                continue
            sc.tree(ms, rng, side * 1.95 if side < 0 else 2.05, y + 0.42, h=rng.uniform(0.3, 0.38), r=0.1, blossom=(side > 0 and i == 1))
    for x in (-2.35, -1.75, -1.15):
        for y in (-1.55, -2.25):
            sc.stall(ms, x, y, rng, yaw=180 if y < -2 else 0, w=0.42, d=0.32)
    for x, y in ((-2.75, 2.8), (0.4, 2.8), (2.8, 1.6), (-0.6, -2.7), (2.8, -1.6), (-2.8, -0.6)):
        tc.shrub(ms, x, y, r=rng.uniform(0.07, 0.1))
    for i, (x, y) in enumerate(((-0.6, 1.0), (1.0, 0.45), (-1.0, -0.75), (0.95, -1.15), (-0.45, -1.2), (1.4, 1.25), (-2.0, 0.5))):
        sc.tree(ms, rng, x, y, h=rng.uniform(0.28, 0.38), r=rng.uniform(0.08, 0.11), blossom=i == 4)
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, 1.2, -1.25, rng, 4)
    sc.jars(ms, world, -0.9, 1.35, rng, 3)
    tt.well(ms, 0.95, 0.95, yaw=20)


if __name__ == '__main__':
    sc.main(FILE, NAME, layout, GROUND)
