# scripts/blender/build_town_bronze_sinic_small_b.py
# Bronze Age `town-small-b` in the Sinic kit (art spec 3b; plans/art/kits/sinic/bronze/): the
# layout of build_town_bronze_small_b.py (house plots, sizes, the free centre, stalls and the
# landmark spots as the Europe kit read them off the base) built in the Shang manner:
# a Shang hamlet round a shrine: courtyard houses,
# a rich hall with a gate porch at the south and one at the west, poor huts in staked yards, and
# a compact oracle shrine with its drum tower in the landmark's spot.
#
#   python scripts/blender/build_town_bronze_sinic_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_sinic_bronze as sb  # noqa: E402

NAME = 'town-small-b'
FILE = 'bronze-town-small-b-sinic'
GROUND = {}

SLOTS = [
    dict(x=0.58, y=1.38, w=0.7, d=0.58, kind='common', awning=True),
    dict(x=1.42, y=0.5, w=0.62, d=0.68, kind='common', front_fence=True),
    dict(x=1.55, y=-0.42, w=0.5, d=0.56, kind='common'),
    dict(x=0.98, y=-1.08, w=0.56, d=0.52, kind='poor', side=-1),
    dict(x=-0.32, y=-1.24, w=0.92, d=0.66, kind='rich', yaw=0, porch=True, front=0.0),
    dict(x=-1.48, y=-0.18, w=0.62, d=0.8, kind='rich', front=0.1),
    dict(x=-1.5, y=0.62, w=0.48, d=0.52, kind='poor', side=1, garden=False),
]


def layout(ms, rng):
    sb.oracle_shrine(ms, rng, -0.6, 1.12, w=1.0, d=0.86)
    for slot in SLOTS:
        sb.sinic_house(ms, rng, slot)
    sb.well(ms, 0.42, -1.5, yaw=-15)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((0.2, -1.62), (0.7, -1.6), (1.15, 1.02), (-1.0, -0.82), (0.25, 0.9)):
        sb.bits(ms, world, x, y, rng, 4)
    sb.shed(ms, -0.98, -1.18, yaw=25)
    sb.shed(ms, 1.05, 0.0, yaw=-80)
    sb.woodpile(ms, 0.7, -0.62, yaw=-30)
    sb.rack(ms, -0.68, -0.55, yaw=40)


if __name__ == '__main__':
    sb.main(FILE, NAME, layout, GROUND)
