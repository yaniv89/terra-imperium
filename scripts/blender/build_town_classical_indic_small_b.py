# scripts/blender/build_town_classical_indic_small_b.py
# Classical Age `town-small-b` in the Indic kit (art spec 3b; plans/art/kits/indic/classical/):
# the layout of build_town_classical_small_b.py (a walled 40 m town of courtyards: two houses on
# the north row, two each side behind inner walls, the landmark in the north-east corner, a gate
# to the south) built as a Maurya or Gupta town: red-brick compound walls with plastered copings,
# a haveli and a town house on the north row, town houses and cottages each side, a small
# rock-cut chaitya facade in a basalt outcrop in the pavilion's place.
#
#   python scripts/blender/build_town_classical_indic_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_indic_classical as ic  # noqa: E402

NAME = 'town-small-b'
FILE = 'classical-town-small-b-indic'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-0.72, y=1.42, w=0.9, d=0.55, yaw=0, kind='rich', garden=False),
    dict(x=0.62, y=1.42, w=0.9, d=0.55, yaw=0, kind='common', jar_n=2),
    dict(x=-1.48, y=0.25, w=0.78, d=0.5, yaw=90, kind='common'),
    dict(x=-1.48, y=-1.05, w=0.78, d=0.5, yaw=90, kind='poor', side=1, thatch=True),
    dict(x=1.48, y=0.25, w=0.78, d=0.5, yaw=-90, kind='common', jar_n=0),
    dict(x=1.48, y=-1.05, w=0.78, d=0.5, yaw=-90, kind='poor', side=-1, thatch=False),
]


def layout(ms, rng):
    ic.chaitya(ms, rng, 1.52, 1.42, w=0.66, depth=0.48, yaw=0)
    for slot in SLOTS:
        ic.indic_house(ms, rng, slot)
    for side in (-1, 1):
        for y in (0.25, -1.05):
            ic.tree(ms, rng, side * 1.17, y + 0.5)
        ic.compound_wall(ms, side * 1.08, -1.6, side * 1.08, -0.62, gaps=((0.5, 0.2),))
        ic.compound_wall(ms, side * 1.08, -0.3, side * 1.08, 0.85, gaps=((0.45, 0.2),))
    ic.compound_wall(ms, -1.95, -1.95, -1.95, 1.95)
    ic.compound_wall(ms, 1.95, -1.95, 1.95, 1.95)
    ic.compound_wall(ms, -1.95, 1.95, 1.95, 1.95, gaps=((0.5, 0.3),))
    ic.compound_wall(ms, -1.95, -1.95, -0.35, -1.95)
    ic.compound_wall(ms, 0.35, -1.95, 1.95, -1.95)
    tt.well(ms, -0.75, -1.4, yaw=-10)
    ic.shrine(ms, 0.75, -1.45, yaw=10)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.75, 1.7), (-0.05, 1.75), (1.75, -1.7), (-1.75, -1.72), (-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85),
                 (0.9, -0.55)):
        r = rng.random()
        if r < 0.4:
            ic.pot(ms, world, x, y, 1.1, plant=True)
        elif r < 0.7:
            ic.banana(ms, rng, x, y)
        else:
            ic.shrub(ms, x, y, r=rng.uniform(0.05, 0.08))
    ic.pots(ms, world, 0.9, -0.85, rng, 4)
    ic.pots(ms, world, -0.95, 0.9, rng, 3)


if __name__ == '__main__':
    ic.main(FILE, NAME, layout, GROUND)
