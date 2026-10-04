# scripts/blender/build_town_classical_indic_medium_a.py
# Classical Age `town-medium-a` in the Indic kit (art spec 3b; plans/art/kits/indic/classical/):
# the layout of build_town_classical_medium_a.py (a paved 60 m town: the landmark at the
# north-west, a row of houses on the north, west and south sides, the market on the east, an inner
# ring of houses round the 12 m square, a street to the south) built as a Maurya or Gupta town:
# the Sanchi stupa in the temple's place, a rock-cut chaitya facade in a basalt cliff along the
# east edge in the stoa's place with the market stalls before it, havelis, town houses, cottages,
# palms, mango trees and banana plants.
#
#   python scripts/blender/build_town_classical_indic_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_indic_classical as ic  # noqa: E402

NAME = 'town-medium-a'
FILE = 'classical-town-medium-a-indic'
GROUND = dict(rx=3.0, ry=3.0, square=0.62)

SLOTS = [
    dict(x=-0.45, y=2.45, w=0.74, d=0.62, yaw=0, kind='common'),  # the north row
    dict(x=0.4, y=2.45, w=0.74, d=0.62, yaw=0, kind='rich', garden=False),
    dict(x=1.25, y=2.45, w=0.74, d=0.62, yaw=0, kind='common', jar_n=3),
    dict(x=-2.45, y=0.55, w=0.82, d=0.66, yaw=90, kind='common'),  # the west side
    dict(x=-2.45, y=-0.4, w=0.82, d=0.66, yaw=90, kind='poor', thatch=False),
    dict(x=-2.45, y=-1.4, w=0.82, d=0.66, yaw=90, kind='common', awning=False),
    dict(x=-2.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor', thatch=True),  # the south side
    dict(x=-1.3, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common'),
    dict(x=0.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='common', jar_n=2),
    dict(x=1.75, y=-2.45, w=0.8, d=0.66, yaw=180, kind='poor', thatch=True),
    dict(x=2.45, y=2.25, w=0.8, d=0.7, yaw=-90, kind='common', awning=False),  # the east end
    dict(x=2.45, y=-1.35, w=0.8, d=0.7, yaw=-90, kind='common', jar_n=3),
    dict(x=-0.55, y=1.45, w=0.66, d=0.56, kind='rich', garden=False),  # the inner ring round the square
    dict(x=0.45, y=1.5, w=0.6, d=0.52, kind='common'),
    dict(x=-1.55, y=0.05, w=0.62, d=0.56, kind='common'),
    dict(x=-1.35, y=-1.4, w=0.7, d=0.58, kind='rich'),
    dict(x=0.55, y=-1.55, w=0.62, d=0.54, kind='common', jar_n=3),
]


def layout(ms, rng):
    ic.street(ms, -0.2, -0.7, -0.2, -2.95, 0.5)
    ic.stupa(ms, rng, -1.75, 1.85, D=1.36)
    for x, y in ((-2.45, 2.6), (-1.0, 2.65), (-2.55, 1.2)):
        ic.tree(ms, rng, x, y, palm_p=0.7)
    ic.chaitya(ms, rng, 2.2, 0.45, w=1.5, depth=0.72, yaw=-90)
    for y in (1.15, 0.6, 0.05, -0.5):
        ic.stall(ms, 1.45, y, rng, yaw=-90)
    for slot in SLOTS:
        ic.indic_house(ms, rng, slot)
    tt.well(ms, 0.95, -1.0, yaw=15)
    ic.shrine(ms, 1.0, -0.62, yaw=-20)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.0, 0.75), (-1.05, -0.75), (0.05, 1.05), (1.05, -1.6), (-0.75, -2.0), (-2.0, 0.05), (-1.6, -1.95),
                 (1.0, -1.85), (-1.75, 0.85), (2.75, 1.55), (0.9, 1.9), (2.0, -2.7)):
        ic.tree(ms, rng, x, y)
    for x, y in ((-2.8, -2.8), (2.8, -2.0), (0.15, 2.0), (-1.1, -2.0), (2.85, 2.85), (-0.9, 1.95)):
        r = rng.random()
        if r < 0.4:
            ic.pot(ms, world, x, y, 1.1, plant=True)
        elif r < 0.7:
            ic.banana(ms, rng, x, y)
        else:
            ic.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    ic.pots(ms, world, 1.0, 1.55, rng, 4)
    ic.pots(ms, world, -1.6, -0.95, rng, 4)


if __name__ == '__main__':
    ic.main(FILE, NAME, layout, GROUND)
