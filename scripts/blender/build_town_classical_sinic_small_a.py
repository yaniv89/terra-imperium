# scripts/blender/build_town_classical_sinic_small_a.py
# Classical Age `town-small-a` in the Sinic kit (art spec 3b; plans/art/kits/sinic/classical/):
# the layout of build_town_classical_small_a.py (a paved 40 m town, the landmark at the north-west,
# three houses down the west side, a big house at the north-east, a street to the south, a well)
# built as a Han town: a walled residence with a gatehouse, courtyard houses under grey hip roofs
# with red posts, cottages with fenced yards and awnings, the double-eave gate tower of the sheet
# in the temple's place, round-crowned courtyard trees, jars and team-cloth awnings.
#
#   python scripts/blender/build_town_classical_sinic_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_sinic_classical as sc  # noqa: E402

NAME = 'town-small-a'
FILE = 'classical-town-small-a-sinic'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-1.5, y=0.68, w=0.7, d=0.62, yaw=90, kind='common', awning=False),
    dict(x=-1.5, y=-0.2, w=0.7, d=0.62, yaw=90, kind='common', jar_n=3),
    dict(x=-1.5, y=-1.08, w=0.7, d=0.62, yaw=90, kind='poor', side=-1),
    dict(x=1.2, y=1.25, w=1.0, d=0.78, yaw=0, kind='rich', blossom=True),
    dict(x=0.42, y=1.38, w=0.44, d=0.5, yaw=0, kind='poor', side=1),
    dict(x=1.52, y=-0.05, w=0.84, d=0.7, yaw=-90, kind='common'),
]


def layout(ms, rng):
    sc.paved_strip(ms, 0.05, -0.65, 0.05, -1.95, 0.42)
    sc.gate_tower(ms, rng, -0.75, 1.3, w=0.68, d=0.5, top=0.8, yaw=0)
    for x, y in ((-1.18, 1.68), (-0.3, 1.72), (-1.12, 0.92)):
        sc.tree(ms, rng, x, y, h=rng.uniform(0.3, 0.36), r=0.08)
    for slot in SLOTS:
        sc.sinic_house(ms, rng, slot)
    tt.well(ms, 1.0, -1.25, yaw=10)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55), (-1.85, 1.55), (1.85, 1.75), (-1.85, -1.55),
                 (1.8, -0.75), (-0.95, -1.6), (1.6, -1.5)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    for i, (x, y) in enumerate(((1.8, 0.75), (-1.9, 0.25), (-1.9, -0.65), (0.72, 1.78), (1.85, 0.45))):
        sc.tree(ms, rng, x, y, h=rng.uniform(0.28, 0.36), r=rng.uniform(0.07, 0.09), blossom=i == 3)
    sc.jars(ms, world, 0.75, 0.65, rng, 4)
    tt.clutter(ms, world, -1.0, -0.6, rng, 3)
    sc.stall(ms, 0.65, -1.2, rng, yaw=-30, w=0.3, d=0.24)


if __name__ == '__main__':
    sc.main(FILE, NAME, layout, GROUND)
