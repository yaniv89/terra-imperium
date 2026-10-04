# scripts/blender/build_town_classical_indic_small_a.py
# Classical Age `town-small-a` in the Indic kit (art spec 3b; plans/art/kits/indic/classical/):
# the layout of build_town_classical_small_a.py (a paved 40 m town, the landmark at the north-west,
# three houses down the west side, a big house at the north-east, a street to the south, a well)
# built as a Maurya or Gupta town: a haveli round a lotus court, two-storey town houses with carved
# balconies, plastered cottages with fenced yards, the Sanchi stupa in the temple's place, palms,
# mango trees, banana plants, pots and team-cloth shades.
#
#   python scripts/blender/build_town_classical_indic_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_indic_classical as ic  # noqa: E402

NAME = 'town-small-a'
FILE = 'classical-town-small-a-indic'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-1.5, y=0.68, w=0.7, d=0.62, yaw=90, kind='common', awning=False),
    dict(x=-1.5, y=-0.2, w=0.7, d=0.62, yaw=90, kind='common', jar_n=3),
    dict(x=-1.5, y=-1.08, w=0.7, d=0.62, yaw=90, kind='poor', side=-1, thatch=True),
    dict(x=1.2, y=1.25, w=1.0, d=0.78, yaw=0, kind='rich'),
    dict(x=0.42, y=1.38, w=0.44, d=0.5, yaw=0, kind='poor', side=1, thatch=False),
    dict(x=1.52, y=-0.05, w=0.84, d=0.7, yaw=-90, kind='common'),
]


def layout(ms, rng):
    ic.street(ms, 0.05, -0.65, 0.05, -1.95, 0.42)
    ic.stupa(ms, rng, -0.75, 1.3, D=0.96)
    for x, y in ((-1.35, 1.75), (-0.2, 1.82), (-1.05, 0.72)):
        ic.tree(ms, rng, x, y)
    for slot in SLOTS:
        ic.indic_house(ms, rng, slot)
    tt.well(ms, 1.0, -1.25, yaw=10)
    ic.shrine(ms, 0.62, -1.1, yaw=-30)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55), (-1.85, 1.55), (1.85, 1.75), (-1.85, -1.55),
                 (1.8, -0.75), (-0.95, -1.6), (1.6, -1.5)):
        r = rng.random()
        if r < 0.4:
            ic.pot(ms, world, x, y, 1.1, plant=True)
        elif r < 0.7:
            ic.banana(ms, rng, x, y)
        else:
            ic.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    for x, y in ((1.8, 0.75), (-1.92, 0.25), (-1.92, -0.65), (0.75, 1.75), (1.85, 0.45)):
        ic.tree(ms, rng, x, y, palm_p=0.6)
    ic.pots(ms, world, 0.75, 0.65, rng, 4)
    ic.pots(ms, world, -1.0, -0.6, rng, 3)


if __name__ == '__main__':
    ic.main(FILE, NAME, layout, GROUND)
