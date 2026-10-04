# scripts/blender/build_town_bronze_indic_big_a.py
# Bronze Age `town-big-a` in the Indic kit (art spec 3b; plans/art/kits/indic/bronze/): the layout
# of build_town_bronze_big_a.py (two rings of house plots round an open 14 m centre, the outer ring
# with walled yards, stalls round the square, landmarks at the north-east and north-west, a gate at
# the south, 80 m across) built as an Indus valley town: the Great Bath (16 x 14 m) at the north-
# east, the granary (11 x 7 m) at the north-west, a brick gateway at the south, rich courtyard
# houses by the square, poor houses outside.
#
#   python scripts/blender/build_town_bronze_indic_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_indic_bronze as ib  # noqa: E402

NAME = 'town-big-a'
FILE = 'bronze-town-big-a-indic'
GROUND = dict(rx=3.95, ry=3.72, square=0.7)  # an 80 m patch with a 14 m free centre

Y = 0.26  # the outer ring's yards
SLOTS = [  # the outer ring (with yards), then the inner ring
    dict(x=3.107, y=0.014, w=0.817, d=0.635, kind='common', yard=Y),
    dict(x=2.985, y=0.793, w=0.849, d=0.66, kind='poor', yard=Y),
    dict(x=0.452, y=2.857, w=0.8, d=0.686, kind='poor', yard=Y),
    dict(x=-0.4, y=2.835, w=0.841, d=0.65, kind='common', yard=Y),
    dict(x=-1.275, y=2.628, w=0.841, d=0.62, kind='poor', yard=Y),
    dict(x=-2.883, y=1.08, w=0.869, d=0.638, kind='common', yard=Y),
    dict(x=-3.091, y=0.199, w=0.871, d=0.672, kind='common', yard=Y),
    dict(x=-2.965, y=-0.677, w=0.864, d=0.645, kind='poor', yard=Y),
    dict(x=-2.625, y=-1.518, w=0.858, d=0.664, kind='common', yard=Y),
    dict(x=-1.992, y=-2.202, w=0.922, d=0.691, kind='common', yard=Y),
    dict(x=-1.283, y=-2.654, w=0.859, d=0.702, kind='poor', yard=Y),
    dict(x=1.327, y=-2.588, w=0.894, d=0.674, kind='poor', yard=Y),
    dict(x=2.123, y=-2.09, w=0.899, d=0.633, kind='common', yard=Y),
    dict(x=2.69, y=-1.326, w=0.887, d=0.715, kind='poor', yard=Y),
    dict(x=0.089, y=1.954, w=0.858, d=0.654, kind='rich'),
    dict(x=-0.786, y=1.812, w=0.859, d=0.676, kind='common'),
    dict(x=-1.992, y=0.647, w=0.768, d=0.623, kind='rich'),
    dict(x=-2.105, y=-0.151, w=0.838, d=0.699, kind='common'),
    dict(x=-1.806, y=-0.974, w=0.886, d=0.664, kind='rich'),
    dict(x=-1.194, y=-1.614, w=0.879, d=0.62, kind='common'),
    dict(x=1.176, y=-1.597, w=0.882, d=0.655, kind='rich'),
    dict(x=1.789, y=-1.006, w=0.891, d=0.633, kind='common'),
    dict(x=2.085, y=-0.194, w=0.896, d=0.63, kind='rich'),
]
STALLS = [(-0.245, 1.273), (-0.799, 1.099), (-1.199, 0.686), (-1.362, 0.119), (-1.314, -0.452), (-0.977, -0.952),
          (-0.445, -1.241), (0.455, -1.259), (0.986, -0.937)]


def layout(ms, rng):
    ib.great_bath(ms, rng, 1.82, 1.66, w=1.6, d=1.44)
    ib.granary(ms, rng, -2.1, 1.96, w=1.1, d=0.72)
    ib.brick_gate(ms, rng, 0.0, -3.1, yaw=0)
    for slot in SLOTS:
        ib.indic_house(ms, rng, slot)
    for x, y in STALLS:
        ib.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.6 else 'inb_reed')
    ib.well(ms, 1.3, -0.45, yaw=15)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-2.51, -0.9), (-0.16, -2.57), (0.39, -2.42), (2.51, -0.9)):
        ib.bits(ms, world, x, y, rng, 5)
    ib.shed(ms, -2.6, -0.62, yaw=70)
    ib.shed(ms, 2.5, -1.2, yaw=-30)
    ib.shed(ms, -0.75, -2.6, yaw=10)
    ib.kiln_at(ms, -1.55, 1.0, yaw=40)
    ib.drying_rack(ms, 0.9, -2.45, yaw=-10)
    ib.drying_rack(ms, 2.6, 0.45, yaw=80)
    ib.tree_at(ms, 0.75, 2.2)


if __name__ == '__main__':
    ib.main(FILE, NAME, layout, GROUND)
