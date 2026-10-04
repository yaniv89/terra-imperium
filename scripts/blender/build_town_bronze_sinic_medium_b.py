# scripts/blender/build_town_bronze_sinic_medium_b.py
# Bronze Age `town-medium-b` in the Sinic kit (art spec 3b; plans/art/kits/sinic/bronze/): the
# layout of build_town_bronze_medium_b.py (house plots, sizes, the free centre, stalls and the
# landmark spots as the Europe kit read them off the base) built in the Shang manner:
# the oracle shrine with its drum tower (14 x 11 m)
# in the landmark's spot, a small casting hall west of the square, rich halls, courtyard houses
# and poor huts.
#
#   python scripts/blender/build_town_bronze_sinic_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_sinic_bronze as sb  # noqa: E402

NAME = 'town-medium-b'
FILE = 'bronze-town-medium-b-sinic'
GROUND = dict(rx=2.95, ry=2.78, square=0.62)  # a 60 m patch with a 12 m free centre

SLOTS = [
    dict(x=-1.571, y=1.588, w=0.737, d=0.675, kind='rich', front=0.08),
    dict(x=-2.062, y=0.957, w=0.696, d=0.585, kind='common'),
    dict(x=-2.327, y=0.158, w=0.683, d=0.669, kind='common'),
    dict(x=-2.218, y=-0.657, w=0.696, d=0.637, kind='poor'),
    dict(x=-1.807, y=-1.399, w=0.682, d=0.659, kind='rich'),
    dict(x=-1.113, y=-1.889, w=0.669, d=0.674, kind='common', awning=True),
    dict(x=-0.259, y=-2.146, w=0.941, d=0.598, kind='rich', yaw=0, porch=True),
    dict(x=0.61, y=-2.031, w=0.666, d=0.691, kind='common', front_fence=True),
    dict(x=1.406, y=-1.707, w=0.748, d=0.68, kind='common', awning=True),
    dict(x=1.987, y=-1.046, w=0.759, d=0.611, kind='common'),
    dict(x=2.282, y=-0.28, w=0.687, d=0.617, kind='rich', front=0.08),
    dict(x=2.226, y=0.536, w=0.667, d=0.656, kind='poor'),
    dict(x=1.881, y=1.279, w=0.669, d=0.655, kind='common', awning=True),
]
STALLS = [(0.479, -1.238), (0.883, -1.03), (1.232, -0.699), (1.387, -0.237), (1.392, 0.207), (1.227, 0.696),
          (0.878, 1.052), (0.591, 1.2)]


def layout(ms, rng):
    sb.oracle_shrine(ms, rng, -0.28, 1.92, w=1.38, d=1.12)
    sb.casting_hall(ms, rng, -1.26, 0.14, w=0.98, d=0.72)
    for slot in SLOTS:
        sb.sinic_house(ms, rng, slot)
    for x, y in STALLS:
        sb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.7 else 'snb_reed')
    sb.well(ms, -1.05, -1.05, yaw=-20)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-1.39, -0.62), (-0.6, -1.37), (0.58, -1.5)):
        sb.bits(ms, world, x, y, rng, 4)
    sb.shed(ms, 0.4, -1.62, yaw=10)
    sb.shed(ms, -1.62, 1.0, yaw=60)
    sb.rack(ms, 0.15, -1.45, yaw=-10)
    sb.woodpile(ms, -0.5, -1.0, yaw=40)


if __name__ == '__main__':
    sb.main(FILE, NAME, layout, GROUND)
