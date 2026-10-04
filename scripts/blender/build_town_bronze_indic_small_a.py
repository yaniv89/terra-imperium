# scripts/blender/build_town_bronze_indic_small_a.py
# Bronze Age `town-small-a` in the Indic kit (art spec 3b; plans/art/kits/indic/bronze/): the layout
# of build_town_bronze_small_a.py (six house plots round an open 8 m centre, the landmark at the
# north-east, a well at the south-west, 40 m across) built as an Indus valley town: four courtyard
# houses, two rich houses with a bathing pool and an upper room, a poor house behind its walled
# yard, and a compact Great Bath (11 x 10 m) in the landmark's spot.
#
#   python scripts/blender/build_town_bronze_indic_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_indic_bronze as ib  # noqa: E402

NAME = 'town-small-a'
FILE = 'bronze-town-small-a-indic'
GROUND = {}  # the layout's own ground (40 m, the default 8 m centre)

# the house plots of build_town_bronze_small_a.py (x, y, w, d), with the Indic house type (the plots as the Europe kit read them)
SLOTS = [
    dict(x=-1.08, y=0.78, w=0.78, d=0.62, kind='common'),
    dict(x=-0.18, y=1.32, w=0.66, d=0.54, kind='common'),
    dict(x=1.38, y=0.02, w=0.62, d=0.74, kind='poor', side=1),
    dict(x=0.98, y=-0.98, w=0.7, d=0.6, kind='rich'),
    dict(x=-0.12, y=-1.36, w=0.8, d=0.62, kind='common'),
    dict(x=-1.46, y=-0.3, w=0.66, d=0.8, kind='rich'),
]


def layout(ms, rng):
    ib.great_bath(ms, rng, 0.88, 0.93, w=1.08, d=1.0)
    for slot in SLOTS:
        ib.indic_house(ms, rng, slot)
    ib.well(ms, -0.98, -1.06)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-0.55, 1.05), (1.0, -0.42), (-1.2, 0.3), (0.45, -1.15)):
        ib.bits(ms, world, x, y, rng, 4)
    ib.shed(ms, -0.68, -1.5, yaw=10)
    ib.shed(ms, 1.62, 0.62, yaw=-75)
    ib.kiln_at(ms, -0.62, -0.62, yaw=40)
    ib.drying_rack(ms, 0.55, -0.55, yaw=-40)
    ib.tree_at(ms, -0.62, 0.5)


if __name__ == '__main__':
    ib.main(FILE, NAME, layout, GROUND)
