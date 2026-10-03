# scripts/blender/build_town_classical_europe_small_a.py
# Classical Age `town-small-a` in the Europe kit (art spec 3b; plans/art/kits/europe/classical/):
# the layout of build_town_classical_small_a.py (a paved 40 m town, the temple at the north-west,
# three houses down the west side, a big house at the north-east, a street to the south, a well)
# built as a Roman town: an atrium domus, town houses round small open courts, ochre cottages with
# walled gardens, the Roman temple of the sheet, cypresses, potted shrubs, amphorae and awnings.
#
#   python scripts/blender/build_town_classical_europe_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_europe_classical as ec  # noqa: E402
from ti_town import G  # noqa: E402

NAME = 'town-small-a'
FILE = 'classical-town-small-a-europe'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-1.5, y=0.68, w=0.7, d=0.62, yaw=90, kind='common', awning=False),
    dict(x=-1.5, y=-0.2, w=0.7, d=0.62, yaw=90, kind='common', jar_n=3),
    dict(x=-1.5, y=-1.08, w=0.7, d=0.62, yaw=90, kind='poor', side=-1),
    dict(x=1.2, y=1.25, w=1.0, d=0.78, yaw=0, kind='rich'),
    dict(x=0.42, y=1.38, w=0.44, d=0.5, yaw=0, kind='poor', side=1),
    dict(x=1.52, y=-0.05, w=0.84, d=0.7, yaw=-90, kind='common'),
]


def street(ms, x0, y0, x1, y1, w):
    ms.quad_strip('euc_paving_square', [(x0 - w / 2, y1, G + 0.003), (x0 + w / 2, y1, G + 0.003), (x0 + w / 2, y0, G + 0.003),
                                        (x0 - w / 2, y0, G + 0.003)], lod=1)


def layout(ms, rng):
    street(ms, 0.05, -0.65, 0.05, -1.95, 0.42)
    ec.roman_temple(ms, rng, -0.75, 1.3, 0.52, 0.74, top=0.75, columns=4, yaw=0)
    for x, y in ((-1.08, 1.62), (-0.4, 1.66), (-1.1, 0.95)):
        tc.cypress(ms, x, y, h=rng.uniform(0.32, 0.42), r=0.045)
    for slot in SLOTS:
        ec.europe_house(ms, rng, slot)
    tt.well(ms, 1.0, -1.25, yaw=10)
    ec.shrine(ms, 0.62, -1.1, yaw=-30)
    ec.bench(ms, 1.28, -1.48, yaw=20)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55), (-1.85, 1.55), (1.85, 1.75), (-1.85, -1.55),
                 (1.8, -0.75), (-0.95, -1.6), (1.6, -1.5)):
        ec.potted(ms, world, x, y) if rng.random() < 0.5 else tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    for x, y in ((1.8, 0.75), (-1.92, 0.25), (-1.92, -0.65), (0.75, 1.75), (1.85, 0.45)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42), r=0.045)
    ec.amphorae(ms, world, 0.75, 0.65, rng, 4)
    ec.amphorae(ms, world, -1.0, -0.6, rng, 3)


if __name__ == '__main__':
    ec.main(FILE, NAME, layout, GROUND)
