# scripts/blender/build_town_bronze_indic_big_b.py
# Bronze Age `town-big-b` in the Indic kit (art spec 3b; plans/art/kits/indic/bronze/): the layout
# of build_town_bronze_big_b.py (two rings of house plots round an open 14 m centre, the outer ring
# with walled yards, market stalls east of the square, landmarks at the north-west, north and east,
# 80 m across) built as an Indus valley town: the granary (17 x 10 m) at the north-west, the Great
# Bath (14 x 12 m) at the north, a potters' quarter of brick kilns at the east, rich courtyard
# houses by the square, poor houses outside.
#
#   python scripts/blender/build_town_bronze_indic_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_indic_bronze as ib  # noqa: E402

NAME = 'town-big-b'
FILE = 'bronze-town-big-b-indic'
GROUND = dict(rx=3.95, ry=3.72, square=0.7)  # an 80 m patch with a 14 m free centre

Y = 0.26
SLOTS = [  # the outer ring (with yards), then the inner ring
    dict(x=2.341, y=1.849, w=0.778, d=0.633, kind='common', yard=Y),
    dict(x=-2.154, y=2.056, w=0.841, d=0.663, kind='poor', yard=Y),
    dict(x=-2.732, y=1.361, w=0.792, d=0.666, kind='common', yard=Y),
    dict(x=-3.035, y=0.554, w=0.775, d=0.6, kind='poor', yard=Y),
    dict(x=-3.093, y=-0.324, w=0.827, d=0.665, kind='common', yard=Y),
    dict(x=-2.859, y=-1.124, w=0.843, d=0.646, kind='poor', yard=Y),
    dict(x=-2.376, y=-1.869, w=0.847, d=0.642, kind='common', yard=Y),
    dict(x=-1.707, y=-2.389, w=0.761, d=0.651, kind='poor', yard=Y),
    dict(x=-0.872, y=-2.79, w=0.818, d=0.615, kind='common', yard=Y),
    dict(x=0.032, y=-2.855, w=1.014, d=0.663, kind='rich', yaw=0, yard=Y),
    dict(x=0.936, y=-2.721, w=0.786, d=0.686, kind='common', yard=Y),
    dict(x=1.742, y=-2.341, w=0.828, d=0.646, kind='poor', yard=Y),
    dict(x=2.431, y=-1.752, w=0.811, d=0.692, kind='common', yard=Y),
    dict(x=2.884, y=-1.015, w=0.818, d=0.627, kind='poor', yard=Y),
    dict(x=3.056, y=-0.231, w=0.834, d=0.657, kind='common', yard=Y),
    dict(x=-1.591, y=1.256, w=0.79, d=0.658, kind='rich'),
    dict(x=-2.057, y=0.347, w=0.798, d=0.665, kind='common'),
    dict(x=-1.964, y=-0.695, w=0.82, d=0.693, kind='rich'),
    dict(x=-1.334, y=-1.495, w=0.854, d=0.643, kind='common'),
    dict(x=-0.387, y=-1.91, w=0.869, d=0.664, kind='rich'),
    dict(x=0.703, y=-1.821, w=0.889, d=0.634, kind='common'),
    dict(x=1.613, y=-1.261, w=0.839, d=0.64, kind='rich'),
    dict(x=2.091, y=-0.323, w=0.854, d=0.603, kind='common'),
]
STALLS = [(0.662, -1.145), (1.059, -0.831), (1.288, -0.422), (1.407, 0.025), (1.272, 0.466), (1.069, 0.834), (0.676, 1.166)]


def layout(ms, rng):
    ib.granary(ms, rng, -0.74, 2.52, w=1.66, d=0.96)
    ib.great_bath(ms, rng, 1.06, 2.46, w=1.36, d=1.24)
    for k, (gx, gy) in enumerate(((2.55, 1.05), (2.95, 0.72), (2.62, 0.52))):
        ib.kiln_at(ms, gx, gy, yaw=-70 + 12 * k)  # the potters' quarter
    for slot in SLOTS:
        ib.indic_house(ms, rng, slot)
    for x, y in STALLS:
        ib.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.7 else 'inb_reed')
    ib.well(ms, -1.19, -0.83, yaw=-20)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-2.48, 0.88), (-2.23, -1.37), (-0.9, -2.35), (1.27, -2.16), (2.32, -1.34)):
        ib.bits(ms, world, x, y, rng, 5)
    ib.shed(ms, -2.62, -0.62, yaw=70)
    ib.shed(ms, 2.45, -1.3, yaw=-30)
    ib.shed(ms, -1.12, -2.5, yaw=10)
    ib.kiln_at(ms, -1.6, 0.85, yaw=40)
    ib.drying_rack(ms, 0.9, -2.45, yaw=-10)
    ib.tree_at(ms, 2.35, 0.95)


if __name__ == '__main__':
    ib.main(FILE, NAME, layout, GROUND)
