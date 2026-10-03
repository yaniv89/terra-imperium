# scripts/blender/build_town_classical_europe_small_b.py
# Classical Age `town-small-b` in the Europe kit (art spec 3b; plans/art/kits/europe/classical/):
# the layout of build_town_classical_small_b.py (a walled 40 m town open to the south, two houses
# along the north, two each side behind garden walls, the landmark at the north-east, a well) built
# as a Roman town: town houses and a domus, cottages, garden walls with tile copings, and a small
# Roman temple in the landmark's corner.
#
#   python scripts/blender/build_town_classical_europe_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_europe_classical as ec  # noqa: E402

NAME = 'town-small-b'
FILE = 'classical-town-small-b-europe'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-0.72, y=1.42, w=0.9, d=0.55, yaw=0, kind='rich', garden=False),
    dict(x=0.62, y=1.42, w=0.9, d=0.55, yaw=0, kind='common', jar_n=2),
    dict(x=-1.48, y=0.25, w=0.78, d=0.5, yaw=90, kind='common'),
    dict(x=-1.48, y=-1.05, w=0.78, d=0.5, yaw=90, kind='poor', side=1),
    dict(x=1.48, y=0.25, w=0.78, d=0.5, yaw=-90, kind='common', jar_n=0),
    dict(x=1.48, y=-1.05, w=0.78, d=0.5, yaw=-90, kind='poor', side=-1),
]


def layout(ms, rng):
    ec.roman_temple(ms, rng, 1.55, 1.48, 0.36, 0.5, top=0.6, columns=4, yaw=0)
    for slot in SLOTS:
        ec.europe_house(ms, rng, slot)
    for side in (-1, 1):
        for y in (0.25, -1.05):
            tc.cypress(ms, side * 1.15, y + 0.5, h=rng.uniform(0.3, 0.36), r=0.045, lod=1)
        tc.court_wall(ms, side * 1.08, -1.6, side * 1.08, -0.62, gaps=((0.5, 0.2),))
        tc.court_wall(ms, side * 1.08, -0.3, side * 1.08, 0.85, gaps=((0.45, 0.2),))
    tc.court_wall(ms, -1.95, -1.95, -1.95, 1.95)
    tc.court_wall(ms, 1.95, -1.95, 1.95, 1.95)
    tc.court_wall(ms, -1.95, 1.95, 1.95, 1.95, gaps=((0.5, 0.3),))
    tc.court_wall(ms, -1.95, -1.95, -0.35, -1.95)
    tc.court_wall(ms, 0.35, -1.95, 1.95, -1.95)
    tt.well(ms, -0.75, -1.4, yaw=-10)
    ec.shrine(ms, 0.75, -1.45, yaw=10)
    ec.bench(ms, -0.4, -1.55, yaw=0)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.75, 1.7), (1.8, 0.95), (-0.05, 1.75), (1.75, -1.7), (-1.75, -1.72), (-0.95, 0.35), (0.95, 0.5),
                 (-0.85, -0.85), (0.9, -0.55)):
        ec.potted(ms, world, x, y) if rng.random() < 0.5 else tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.08))
    ec.amphorae(ms, world, 0.9, -0.85, rng, 4)
    ec.amphorae(ms, world, -0.95, 0.9, rng, 3)


if __name__ == '__main__':
    ec.main(FILE, NAME, layout, GROUND)
