# scripts/blender/build_town_bronze_europe_small_a.py
# Bronze Age `town-small-a` in the Europe kit (art spec 3b; plans/art/kits/europe/bronze/): the
# layout of build_town_bronze_small_a.py (six house plots round an open 8 m centre, the landmark
# at the north-east, a well at the south-west, 40 m across) built as a northern European village:
# turf and thatch longhouses, two rich halls with fenced yards, a poor hut with its garden, and
# the stone circle in the landmark's spot.
#
#   python scripts/blender/build_town_bronze_europe_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_europe_bronze as eb  # noqa: E402

NAME = 'town-small-a'
FILE = 'bronze-town-small-a-europe'
GROUND = {}  # the layout's own ground (40 m, the default 8 m centre)

# the house plots of build_town_bronze_small_a.py (x, y, w, d), with the Europe house type
SLOTS = [
    dict(x=-1.08, y=0.78, w=0.78, d=0.62, kind='common', awning=True),
    dict(x=-0.18, y=1.32, w=0.66, d=0.54, kind='common', roof='eu_straw', front_fence=True),
    dict(x=1.38, y=0.02, w=0.62, d=0.74, kind='poor', side=1),
    dict(x=0.98, y=-0.98, w=0.7, d=0.6, kind='rich', front=0.1),
    dict(x=-0.12, y=-1.36, w=0.8, d=0.62, kind='common', awning=True, front_fence=True),
    dict(x=-1.46, y=-0.3, w=0.66, d=0.8, kind='rich', front=0.1),
]


def layout(ms, rng):
    eb.stone_circle(ms, rng, 0.88, 0.93, dia=1.08)
    for slot in SLOTS:
        eb.europe_house(ms, rng, slot)
    eb.well(ms, -0.98, -1.06)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((-0.55, 1.05), (1.0, -0.42), (-1.2, 0.3), (0.45, -1.15)):
        eb.bits(ms, world, x, y, rng, 4)
    eb.woodshed(ms, -0.68, -1.5, yaw=10)
    eb.woodshed(ms, 1.62, 0.62, yaw=-75)
    eb.loom(ms, -0.62, -0.62, yaw=40)
    eb.hide_rack(ms, 0.55, -0.55, yaw=-40)
    eb.haystack(ms, -0.62, 0.5, r=0.07, h=0.15)


if __name__ == '__main__':
    eb.main(FILE, NAME, layout, GROUND)
