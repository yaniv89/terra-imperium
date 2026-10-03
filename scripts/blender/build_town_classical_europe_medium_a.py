# scripts/blender/build_town_classical_europe_medium_a.py
# Classical Age `town-medium-a` in the Europe kit (art spec 3b; plans/art/kits/europe/classical/):
# the layout of build_town_classical_medium_a.py (a paved 60 m town: the temple at the north-west,
# rows of houses on every side and an inner ring round the forum, the market on the east, a street
# to the south) built as a Roman town: the Roman temple, the aqueduct's three arches running along
# the east edge behind the market stalls, domus houses, town houses and cottages.
#
#   python scripts/blender/build_town_classical_europe_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_europe_classical as ec  # noqa: E402
from ti_town import G  # noqa: E402

NAME = 'town-medium-a'
FILE = 'classical-town-medium-a-europe'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-0.45, y=2.45, w=0.74, d=0.62, yaw=0, kind='common'),  # the north row
    dict(x=0.4, y=2.45, w=0.74, d=0.62, yaw=0, kind='rich', garden=False),
    dict(x=1.25, y=2.45, w=0.74, d=0.62, yaw=0, kind='common', jar_n=3),
    dict(x=-2.45, y=0.55, w=0.82, d=0.66, yaw=90, kind='common'),  # the west side
    dict(x=-2.45, y=-0.4, w=0.82, d=0.66, yaw=90, kind='poor'),
    dict(x=-2.45, y=-1.4, w=0.82, d=0.66, yaw=90, kind='common', awning=False),
    dict(x=-2.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor'),  # the south side
    dict(x=-1.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common'),
    dict(x=0.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common', jar_n=2),
    dict(x=1.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor'),
    dict(x=2.45, y=2.25, w=0.8, d=0.7, yaw=-90, kind='common', awning=False),  # the east end
    dict(x=2.45, y=-1.35, w=0.8, d=0.7, yaw=-90, kind='common', jar_n=3),
    dict(x=-0.55, y=1.45, w=0.66, d=0.56, kind='rich', garden=False),  # the inner ring round the forum
    dict(x=0.45, y=1.5, w=0.6, d=0.52, kind='common'),
    dict(x=-1.55, y=0.05, w=0.62, d=0.56, kind='common'),
    dict(x=-1.35, y=-1.4, w=0.7, d=0.58, kind='rich'),
    dict(x=0.55, y=-1.55, w=0.62, d=0.54, kind='common', jar_n=3),
]


def layout(ms, rng):
    ms.quad_strip('euc_paving_square', [(-0.45, -2.95, G + 0.003), (0.05, -2.95, G + 0.003), (0.05, -0.7, G + 0.003), (-0.45, -0.7, G + 0.003)], lod=1)
    ec.roman_temple(ms, rng, -1.75, 1.85, 0.9, 1.3, top=1.2, columns=6, podium=0.16, yaw=0)
    for x, y in ((-2.45, 2.55), (-1.05, 2.6), (-2.5, 1.2)):
        tc.cypress(ms, x, y, h=rng.uniform(0.35, 0.45), r=0.05, lod=1)
    ec.aqueduct(ms, rng, 2.45, 0.45, length=1.9, depth=0.36, top=1.2, yaw=-90)
    for y in (1.15, 0.6, 0.05, -0.5):
        ec.stall(ms, 1.45, y, rng, yaw=-90)
    for slot in SLOTS:
        ec.europe_house(ms, rng, slot)
    tt.well(ms, 0.95, -1.0, yaw=15)
    ec.shrine(ms, 1.0, -0.62, yaw=-20)
    ec.bench(ms, 0.62, -0.95, yaw=60)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.0, 0.75), (-1.05, -0.75), (0.05, 1.05), (1.05, -1.6), (-0.75, -2.0), (-2.0, 0.05), (-1.6, -1.65),
                 (1.0, -1.75), (-1.75, 0.85), (2.75, 1.55), (-0.9, 1.9), (0.9, 1.9), (2.0, -2.7)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42), r=0.045, lod=1)
    for x, y in ((-2.8, -2.8), (2.8, -2.0), (0.15, 2.0), (-1.1, -2.0), (2.85, 2.85)):
        ec.potted(ms, world, x, y) if rng.random() < 0.5 else tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    ec.amphorae(ms, world, 1.0, 1.55, rng, 4)
    ec.amphorae(ms, world, -1.6, -0.95, rng, 4)


if __name__ == '__main__':
    ec.main(FILE, NAME, layout, GROUND)
