# scripts/blender/build_town_classical_levant_medium_b.py
# Classical Age `town-medium-b` in the Levant kit (art spec 3b; plans/art/kits/levant/classical/):
# the layout of build_town_classical_medium_b.py (a 60 m town with a 12 m free centre: the
# landmark in the north-east corner, big houses behind yard walls along the north, houses down
# both sides, houses along the south, an inner ring round the square) built as a Levantine town:
# the rock-cut tomb cut into a cliff in the north-east corner, the Apadana with bull capitals at
# the south-west (where the base town has its market; the stalls move to the south), rich
# residences, courtyard houses and cottages, olives, palms and cypresses on grey-beige cobbles.
#
#   python scripts/blender/build_town_classical_levant_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_levant_classical as lc  # noqa: E402

NAME = 'town-medium-b'
FILE = 'classical-town-medium-b-levant'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-1.85, y=2.35, w=0.95, d=0.6, yaw=0, kind='rich', terrace=False),
    dict(x=-0.3, y=2.3, w=1.1, d=0.66, yaw=0, kind='rich'),
    dict(x=1.05, y=2.4, w=0.7, d=0.5, yaw=0, kind='poor'),
    dict(x=-2.4, y=1.0, w=0.85, d=0.55, yaw=90, kind='common'),
    dict(x=-2.4, y=-0.05, w=0.85, d=0.55, yaw=90, kind='poor', stall=True),
    dict(x=2.4, y=1.0, w=0.85, d=0.55, yaw=-90, kind='common'),
    dict(x=2.4, y=-0.05, w=0.85, d=0.55, yaw=-90, kind='common', jar_n=3),
    dict(x=2.4, y=-1.1, w=0.85, d=0.55, yaw=-90, kind='poor'),
    dict(x=2.25, y=-2.3, w=1.0, d=0.62, yaw=180, kind='common'),
    dict(x=0.95, y=-2.4, w=0.7, d=0.5, yaw=180, kind='poor'),
    dict(x=-1.2, y=1.25, w=0.72, d=0.5, kind='common'),  # the inner ring round the square
    dict(x=0.25, y=1.4, w=0.66, d=0.48, kind='common', awning=False),
    dict(x=-1.25, y=-0.1, w=0.7, d=0.48, kind='common', jar_n=2),
    dict(x=1.25, y=-0.25, w=0.68, d=0.5, kind='common', awning=False),
    dict(x=0.25, y=-1.5, w=0.72, d=0.5, kind='rich', terrace=False),
]


def layout(ms, rng):
    lc.rock_tomb(ms, rng, 2.25, 2.4, 1.3, 0.72, top=1.25, yaw=0, facade=0.92)
    lc.apadana(ms, rng, -1.95, -2.3, 1.0, 0.78, top=1.15, columns=6, yaw=90)
    lc.yard_wall(ms, -2.9, 1.75, -0.9, 1.75, gaps=((0.5, 0.26),))
    lc.yard_wall(ms, 0.4, 1.8, 1.55, 1.8, gaps=((0.5, 0.22),))
    lc.yard_wall(ms, -1.75, -1.3, -1.75, 1.5, gaps=((0.15, 0.2), (0.55, 0.2), (0.88, 0.2)))
    lc.yard_wall(ms, 1.75, -1.6, 1.75, 1.5, gaps=((0.2, 0.2), (0.55, 0.2), (0.88, 0.2)))
    for slot in SLOTS:
        lc.levant_house(ms, rng, slot)
    for side in (-1, 1):
        for i, y in enumerate((1.0, -0.05, -1.1)):
            if side < 0 and i == 2:
                continue
            lc.tree(ms, rng, side * 1.95, y + 0.42, 'olive' if i != 1 else 'palm')
    for x in (-0.75, -0.2, 0.3):  # the market, moved to the south
        lc.stall(ms, x, -2.3, rng, yaw=180, w=0.42, d=0.32)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-2.75, 2.8), (0.4, 2.8), (2.8, 1.6), (-0.6, -2.75), (2.8, -1.6), (-2.8, -0.6), (-2.75, -1.2)):
        lc.potted(ms, world, x, y) if rng.random() < 0.5 else lc.tree(ms, rng, x, y, 'cypress')
    for x, y in ((-0.6, 1.0), (1.0, 0.45), (-1.0, -0.75), (0.95, -1.05), (-0.45, -1.2), (1.5, 1.3), (-1.0, -1.6)):
        lc.tree(ms, rng, x, y)
    lc.jars(ms, world, 1.2, -1.25, rng, 4)
    lc.jars(ms, world, -0.9, 1.35, rng, 3)
    lc.well(ms, 0.95, 0.95, yaw=20)


if __name__ == '__main__':
    lc.main(FILE, NAME, layout, GROUND)
