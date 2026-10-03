# scripts/blender/build_town_classical_europe_medium_b.py
# Classical Age `town-medium-b` in the Europe kit (art spec 3b; plans/art/kits/europe/classical/):
# the layout of build_town_classical_medium_b.py (a paved 60 m town: three houses along the north
# behind garden walls, rows on the east and west, the market at the south-west, an inner ring of
# houses round the square, the landmark at the north-east) built as a Roman town: a small Roman
# temple in the north-east corner, the aqueduct's three arches along the east garden-wall line,
# domus houses, town houses, cottages, garden walls with tile copings and the market's stalls.
#
#   python scripts/blender/build_town_classical_europe_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_europe_classical as ec  # noqa: E402

NAME = 'town-medium-b'
FILE = 'classical-town-medium-b-europe'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-1.85, y=2.35, w=0.95, d=0.6, yaw=0, kind='rich', garden=False),
    dict(x=-0.3, y=2.3, w=1.1, d=0.66, yaw=0, kind='rich'),
    dict(x=1.05, y=2.4, w=0.7, d=0.5, yaw=0, kind='poor'),
    dict(x=-2.4, y=1.0, w=0.85, d=0.55, yaw=90, kind='common'),
    dict(x=-2.4, y=-0.05, w=0.85, d=0.55, yaw=90, kind='poor'),
    dict(x=2.4, y=1.0, w=0.85, d=0.55, yaw=-90, kind='common'),
    dict(x=2.4, y=-0.05, w=0.85, d=0.55, yaw=-90, kind='common', jar_n=3),
    dict(x=2.4, y=-1.1, w=0.85, d=0.55, yaw=-90, kind='poor'),
    dict(x=2.25, y=-2.3, w=1.0, d=0.62, yaw=180, kind='common'),
    dict(x=0.95, y=-2.4, w=0.7, d=0.5, yaw=180, kind='poor'),
    dict(x=-1.2, y=1.25, w=0.72, d=0.5, kind='common'),  # the inner ring round the square
    dict(x=0.25, y=1.4, w=0.66, d=0.48, kind='common', awning=False),
    dict(x=-1.25, y=-0.1, w=0.7, d=0.48, kind='common', jar_n=2),
    dict(x=1.25, y=-0.25, w=0.68, d=0.5, kind='common', awning=False),
    dict(x=0.25, y=-1.5, w=0.72, d=0.5, kind='rich', garden=False),
]


def layout(ms, rng):
    ec.roman_temple(ms, rng, 2.3, 2.3, 0.55, 0.75, top=0.9, columns=4, yaw=0)
    tc.court_wall(ms, -2.9, 1.75, -0.9, 1.75, gaps=((0.5, 0.26),))
    tc.court_wall(ms, 0.4, 1.8, 1.7, 1.8, gaps=((0.5, 0.22),))
    tc.court_wall(ms, -1.75, -1.6, -1.75, 1.5, gaps=((0.2, 0.2), (0.55, 0.2), (0.88, 0.2)))
    ec.aqueduct(ms, rng, 1.78, 0.0, length=2.0, depth=0.36, top=1.2, yaw=90)
    for slot in SLOTS:
        ec.europe_house(ms, rng, slot)
    for side in (-1, 1):
        for i, y in enumerate((1.0, -0.05, -1.1)):
            if side < 0 and i == 2:
                continue
            tc.cypress(ms, side * 1.95 if side < 0 else 2.05, y + 0.42, h=rng.uniform(0.3, 0.38), r=0.045, lod=1)
    for x in (-2.35, -1.75, -1.15):
        for y in (-1.55, -2.25):
            ec.stall(ms, x, y, rng, yaw=180 if y < -2 else 0, w=0.42, d=0.32)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-2.75, 2.8), (0.4, 2.8), (2.8, 1.6), (-0.6, -2.7), (2.8, -1.6), (-2.8, -0.6)):
        ec.potted(ms, world, x, y) if rng.random() < 0.5 else tc.shrub(ms, x, y, r=rng.uniform(0.07, 0.1))
    for x, y in ((-0.6, 1.0), (1.0, 0.45), (-1.0, -0.75), (0.95, -1.05), (-0.45, -1.2)):
        tc.cypress(ms, x, y, h=rng.uniform(0.28, 0.38), r=0.045, lod=1)
    ec.amphorae(ms, world, 1.2, -1.25, rng, 4)
    ec.amphorae(ms, world, -0.9, 1.35, rng, 3)
    tt.well(ms, 0.95, 0.95, yaw=20)
    ec.shrine(ms, 0.6, 1.05, yaw=-140)


if __name__ == '__main__':
    ec.main(FILE, NAME, layout, GROUND)
