# scripts/blender/build_town_classical_sinic_medium_a.py
# Classical Age `town-medium-a` in the Sinic kit (art spec 3b; plans/art/kits/sinic/classical/):
# the layout of build_town_classical_medium_a.py (the landmark at the north-west, a row of houses
# along the north, houses down the west and across the south, a market on the east, an inner ring
# round a paved square with a 12 m free centre) as a Han market town: the double-eave gate tower of
# the sheet (12 m) in the temple's place, a pair of que watchtowers (16 m) flanking a gate in a
# courtyard wall where the stoa stood, the stalls under team awnings before them, walled
# residences, courtyard houses and cottages, round-crowned and blossoming trees.
#
#   python scripts/blender/build_town_classical_sinic_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_sinic_classical as sc  # noqa: E402

NAME = 'town-medium-a'
FILE = 'classical-town-medium-a-sinic'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-0.45, y=2.45, w=0.74, d=0.62, yaw=0, kind='common'),  # the north row
    dict(x=0.4, y=2.45, w=0.74, d=0.62, yaw=0, kind='rich', garden=False),
    dict(x=1.25, y=2.45, w=0.74, d=0.62, yaw=0, kind='common', jar_n=3, awning=False),
    dict(x=-2.45, y=0.55, w=0.82, d=0.66, yaw=90, kind='common'),  # the west side
    dict(x=-2.45, y=-0.4, w=0.82, d=0.66, yaw=90, kind='poor', side=1),
    dict(x=-2.45, y=-1.4, w=0.82, d=0.66, yaw=90, kind='common', awning=False),
    dict(x=-2.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor', side=-1),  # the south side
    dict(x=-1.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='rich', garden=False, blossom=True),
    dict(x=0.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common'),
    dict(x=1.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor', side=1),
    dict(x=2.45, y=2.25, w=0.8, d=0.7, yaw=-90, kind='common', awning=False),  # the east side
    dict(x=2.45, y=-1.35, w=0.8, d=0.7, yaw=-90, kind='common', jar_n=3),
    dict(x=-0.55, y=1.45, w=0.66, d=0.56, kind='common', jar_n=2),  # the inner ring round the square
    dict(x=0.45, y=1.5, w=0.6, d=0.52, kind='common', awning=False),
    dict(x=-1.55, y=0.05, w=0.62, d=0.56, kind='poor'),
    dict(x=-1.35, y=-1.4, w=0.7, d=0.58, kind='common'),
    dict(x=0.55, y=-1.55, w=0.62, d=0.54, kind='common', jar_n=3, awning=False),
]


def layout(ms, rng):
    sc.paved_strip(ms, -0.2, -0.7, -0.2, -2.95, 0.5)
    sc.gate_tower(ms, rng, -1.8, 1.95, w=1.2, d=0.86, top=1.2, yaw=0)
    for x, y in ((-2.65, 2.6), (-0.95, 2.75), (-2.6, 1.25)):
        sc.tree(ms, rng, x, y, h=rng.uniform(0.32, 0.4), r=0.09)
    # the market gate: two que watchtowers with a courtyard wall and a gate between them
    for y in (1.2, -0.3):
        sc.que_tower(ms, rng, 2.5, y, base=0.56, top=1.6, yaw=-90)
    sc.court_wall(ms, 2.5, -0.02, 2.5, 0.92, gaps=((0.5, 0.3),), h=0.22)
    for y in (1.15, 0.6, 0.05, -0.5):
        sc.stall(ms, 1.6, y, rng, yaw=-90, w=0.36, d=0.3)
    for slot in SLOTS:
        sc.sinic_house(ms, rng, slot)
    tt.well(ms, 0.95, -1.0, yaw=15)
    for i, (x, y) in enumerate(((-1.0, 0.75), (-1.05, -0.75), (0.05, 1.05), (1.05, -1.6), (-0.75, -2.0), (-2.0, 0.05),
                                (-1.6, -1.75), (1.0, -1.75), (-1.75, 0.85), (2.75, 0.45), (-0.9, 1.9), (0.9, 1.9), (2.1, -2.75))):
        sc.tree(ms, rng, x, y, h=rng.uniform(0.28, 0.38), r=rng.uniform(0.07, 0.1), blossom=i in (2, 7))
    for x, y in ((-2.8, -2.8), (2.8, -2.0), (0.15, 2.0), (-1.1, -2.0), (2.85, 2.85)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    world = tm.house_frame(0, 0, 0)
    sc.jars(ms, world, 1.05, 1.6, rng, 4)
    tt.clutter(ms, world, -1.6, -0.95, rng, 4)


if __name__ == '__main__':
    sc.main(FILE, NAME, layout, GROUND)
