# scripts/blender/build_town_classical_levant_small_b.py
# Classical Age `town-small-b` in the Levant kit (art spec 3b; plans/art/kits/levant/classical/):
# the layout of build_town_classical_small_b.py (two big houses across the north, the landmark in
# the north-east corner, two houses down each side behind yard walls, a well at the south-west,
# low walls round the edge open to the south, a 12 m free centre) built as a Levantine town: a
# rich residence and a courtyard house along the north, courtyard houses and cottages each side,
# the Petra-style rock-cut tomb as the landmark, olives, palms, cypresses, pots and jars.
#
#   python scripts/blender/build_town_classical_levant_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_levant_classical as lc  # noqa: E402

NAME = 'town-small-b'
FILE = 'classical-town-small-b-levant'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-0.72, y=1.42, w=0.9, d=0.55, yaw=0, kind='rich', terrace=False),
    dict(x=0.62, y=1.42, w=0.9, d=0.55, yaw=0, kind='common', jar_n=2),
    dict(x=-1.48, y=0.25, w=0.78, d=0.5, yaw=90, kind='common'),
    dict(x=-1.48, y=-1.05, w=0.78, d=0.5, yaw=90, kind='poor', side=1, stall=True),
    dict(x=1.48, y=0.25, w=0.78, d=0.5, yaw=-90, kind='common', jar_n=0),
    dict(x=1.48, y=-1.05, w=0.78, d=0.5, yaw=-90, kind='poor', side=-1),
]


def layout(ms, rng):
    lc.rock_tomb(ms, rng, 1.52, 1.6, 0.74, 0.56, top=0.78, yaw=0)
    for slot in SLOTS:
        lc.levant_house(ms, rng, slot)
    for side in (-1, 1):
        for y, k in ((0.25, 'olive'), (-1.05, 'palm')):
            lc.tree(ms, rng, side * 1.15, y + 0.5, k)
        lc.yard_wall(ms, side * 1.08, -1.6, side * 1.08, -0.62, gaps=((0.5, 0.2),))
        lc.yard_wall(ms, side * 1.08, -0.3, side * 1.08, 0.85, gaps=((0.45, 0.2),))
    lc.yard_wall(ms, -1.95, -1.95, -1.95, 1.95)
    lc.yard_wall(ms, 1.95, -1.95, 1.95, 1.2)
    lc.yard_wall(ms, -1.95, 1.95, 1.1, 1.95, gaps=((0.5, 0.3),))
    lc.yard_wall(ms, -1.95, -1.95, -0.35, -1.95)
    lc.yard_wall(ms, 0.35, -1.95, 1.95, -1.95)
    lc.well(ms, -0.75, -1.4, yaw=-10)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.75, 1.72), (1.8, 0.95), (-0.05, 1.75), (1.75, -1.7), (-1.75, -1.72), (-0.95, 0.35), (0.95, 0.5),
                 (-0.85, -0.85), (0.9, -0.55), (0.6, -1.5)):
        lc.potted(ms, world, x, y) if rng.random() < 0.55 else lc.tree(ms, rng, x, y, 'olive')
    for x, y, k in ((0.95, -1.75, 'palm'), (-0.4, -1.72, 'cypress')):
        lc.tree(ms, rng, x, y, k)
    lc.jars(ms, world, 0.9, -0.85, rng, 4)
    lc.jars(ms, world, -0.95, 0.9, rng, 3)


if __name__ == '__main__':
    lc.main(FILE, NAME, layout, GROUND)
