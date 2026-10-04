# scripts/blender/build_town_bronze_sinic_medium_a.py
# Bronze Age `town-medium-a` in the Sinic kit (art spec 3b; plans/art/kits/sinic/bronze/): the
# layout of build_town_bronze_medium_a.py (house plots, sizes, the free centre, stalls and the
# landmark spots as the Europe kit read them off the base) built in the Shang manner:
# the bronze-casting hall (14 m) in the landmark's
# spot, a compact oracle shrine east of the square, rich halls on platforms, courtyard houses
# and poor huts.
#
#   python scripts/blender/build_town_bronze_sinic_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_sinic_bronze as sb  # noqa: E402

NAME = 'town-medium-a'
FILE = 'bronze-town-medium-a-sinic'
GROUND = dict(rx=2.95, ry=2.78, square=0.62)  # a 60 m patch with a 12 m free centre

SLOTS = [
    dict(x=-0.054, y=2.153, w=0.661, d=0.692, kind='common', front_fence=True),
    dict(x=-0.956, y=1.938, w=0.715, d=0.699, kind='rich'),
    dict(x=-1.701, y=1.437, w=0.68, d=0.63, kind='poor'),
    dict(x=-2.165, y=0.68, w=0.716, d=0.633, kind='common'),
    dict(x=-2.337, y=-0.152, w=0.734, d=0.679, kind='common', awning=True),
    dict(x=-2.094, y=-0.971, w=0.714, d=0.599, kind='rich'),
    dict(x=-1.509, y=-1.641, w=0.707, d=0.619, kind='common'),
    dict(x=-0.655, y=-2.027, w=0.66, d=0.631, kind='common', awning=True),
    dict(x=0.229, y=-2.12, w=0.707, d=0.676, kind='rich', awning=True),
    dict(x=1.113, y=-1.868, w=0.673, d=0.586, kind='poor'),
    dict(x=1.798, y=-1.341, w=0.742, d=0.612, kind='common', front_fence=True),
    dict(x=2.217, y=-0.553, w=0.719, d=0.687, kind='rich', front=0.08),
    dict(x=2.281, y=0.28, w=0.687, d=0.594, kind='common'),
]
STALLS = [(-1.089, 0.875), (-1.318, 0.442), (-1.429, -0.001), (-1.337, -0.478), (-1.092, -0.862), (-0.679, -1.185),
          (-0.265, -1.308), (0.223, -1.345)]


def layout(ms, rng):
    sb.casting_hall(ms, rng, 1.52, 1.4, w=1.42, d=0.98)
    sb.oracle_shrine(ms, rng, 1.22, -0.2, w=1.0, d=0.86)
    for slot in SLOTS:
        sb.sinic_house(ms, rng, slot)
    for x, y in STALLS:
        sb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.6 else 'snb_reed')
    sb.well(ms, 0.72, -1.2, yaw=10)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-0.93, 1.2), (-1.22, -0.79), (0.36, 1.55)):
        sb.bits(ms, world, x, y, rng, 4)
    sb.shed(ms, -1.62, -0.6, yaw=70)
    sb.shed(ms, 0.45, -1.62, yaw=-10)
    sb.woodpile(ms, -0.6, 1.4, yaw=10)
    sb.rack(ms, 1.62, -1.0, yaw=-60)
    sb.tree(ms, -1.62, 0.55, 0.9)


if __name__ == '__main__':
    sb.main(FILE, NAME, layout, GROUND)
