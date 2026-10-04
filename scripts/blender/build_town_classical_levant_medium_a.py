# scripts/blender/build_town_classical_levant_medium_a.py
# Classical Age `town-medium-a` in the Levant kit (art spec 3b; plans/art/kits/levant/classical/):
# the layout of build_town_classical_medium_a.py (a 60 m town with a 12 m free centre: the big
# landmark at the north-west, a north row, houses down the west and across the south, a market on
# the east before a long building, an inner ring round the square, a street leaving south) built
# as a Levantine town: the Apadana with bull capitals in the temple's place, the rock-cut tomb in
# the stoa's place along the east edge with the market stalls before it, rich residences,
# courtyard houses and cottages, olives, palms and cypresses on grey-beige cobbles.
#
#   python scripts/blender/build_town_classical_levant_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_levant_classical as lc  # noqa: E402

NAME = 'town-medium-a'
FILE = 'classical-town-medium-a-levant'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-0.45, y=2.45, w=0.74, d=0.62, yaw=0, kind='common'),  # the north row
    dict(x=0.4, y=2.45, w=0.74, d=0.62, yaw=0, kind='rich'),
    dict(x=1.25, y=2.45, w=0.74, d=0.62, yaw=0, kind='common', jar_n=3),
    dict(x=-2.45, y=0.55, w=0.82, d=0.66, yaw=90, kind='common'),  # the west side
    dict(x=-2.45, y=-0.4, w=0.82, d=0.66, yaw=90, kind='poor'),
    dict(x=-2.45, y=-1.4, w=0.82, d=0.66, yaw=90, kind='common', awning=False),
    dict(x=-2.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor', stall=True),  # the south side
    dict(x=-1.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='rich', terrace=False),
    dict(x=0.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common', jar_n=2),
    dict(x=1.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor'),
    dict(x=2.45, y=2.25, w=0.8, d=0.7, yaw=-90, kind='common', awning=False),  # the east end
    dict(x=2.45, y=-1.35, w=0.8, d=0.7, yaw=-90, kind='common', jar_n=3),
    dict(x=-0.55, y=1.45, w=0.66, d=0.56, kind='rich', terrace=False),  # the inner ring round the square
    dict(x=0.45, y=1.5, w=0.6, d=0.52, kind='poor'),
    dict(x=-1.55, y=0.05, w=0.62, d=0.56, kind='common'),
    dict(x=-1.35, y=-1.4, w=0.7, d=0.58, kind='rich'),
    dict(x=0.55, y=-1.55, w=0.62, d=0.54, kind='common', jar_n=3),
]


def layout(ms, rng):
    lc.street(ms, -0.2, -0.7, -0.2, -2.95, 0.5)
    lc.apadana(ms, rng, -1.75, 1.9, 1.0, 0.78, top=1.25, columns=6, yaw=0)
    for x, y, k in ((-2.45, 2.6, 'cypress'), (-1.05, 2.62, 'palm'), (-2.55, 1.2, 'cypress')):
        lc.tree(ms, rng, x, y, k)
    lc.rock_tomb(ms, rng, 2.58, 0.45, 1.7, 0.66, top=1.3, yaw=-90, facade=1.1)
    for y in (1.15, 0.6, 0.05, -0.5):
        lc.stall(ms, 1.45, y, rng, yaw=-90)
    for slot in SLOTS:
        lc.levant_house(ms, rng, slot)
    lc.well(ms, 0.95, -1.0, yaw=15)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.0, 0.75), (-1.05, -0.75), (0.05, 1.05), (1.05, -1.65), (-0.75, -2.0), (-2.0, 0.05), (-1.65, -1.85),
                 (1.0, -1.85), (-1.75, 0.85), (2.75, 1.55), (-0.95, 1.95), (0.9, 1.9), (2.0, -2.7)):
        lc.tree(ms, rng, x, y)
    for x, y in ((-2.8, -2.8), (2.8, -2.0), (0.15, 2.0), (-1.1, -2.0), (2.85, 2.85), (0.45, -0.85), (-0.85, 0.3)):
        lc.potted(ms, world, x, y) if rng.random() < 0.6 else lc.tree(ms, rng, x, y, 'olive')
    lc.jars(ms, world, 1.0, 1.55, rng, 4)
    lc.jars(ms, world, -1.6, -0.95, rng, 4)


if __name__ == '__main__':
    lc.main(FILE, NAME, layout, GROUND)
