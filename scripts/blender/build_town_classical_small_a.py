# scripts/blender/build_town_classical_small_a.py
# Classical Age `town-small-a`, the Roman village (plans/art/towns/classical/town-small-a/
# reference-sheet.png): a paved square with a 12 m free centre, three houses down the west side,
# a small temple with four columns and cypresses at the north-west, a large house with an annex
# at the north-east, a house with an awning on the east, a well at the south-east and a street
# leaving south; cream plaster, cut-stone footings, terracotta roofs, team-grey awnings. 40 m.
#
#   python scripts/blender/build_town_classical_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402

NAME = 'town-small-a'
GROUND = dict(tc.PAVED, rx=2.0, ry=2.0, square=0.6)


def layout(ms, rng):
    tc.paved_strip(ms, 0.05, -0.65, 0.05, -1.95, 0.42)  # the street south
    tc.temple(ms, rng, -0.75, 1.3, 0.5, 0.72, top=0.7, columns=4, yaw=0)
    for x, y in ((-1.05, 1.6), (-0.42, 1.65), (-1.1, 0.95)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.4))
    for i, y in enumerate((0.68, -0.2, -1.08)):
        tc.roman_house(ms, rng, -1.5, y, 0.7, 0.62, yaw=90, awning_w=0.3 if i else None, jar_n=3 if i == 1 else 0,
                       chimney=i == 0, gable_front=i == 2)
    tc.roman_house(ms, rng, 1.2, 1.25, 1.0, 0.78, yaw=0, jar_n=4, rise=0.17, h=0.5)
    tc.roman_house(ms, rng, 0.42, 1.38, 0.44, 0.5, yaw=0, rise=0.1)
    tc.roman_house(ms, rng, 1.52, -0.05, 0.84, 0.7, yaw=-90, awning_w=0.34, jar_n=4, gable_front=True)
    tt.well(ms, 1.0, -1.25, yaw=10)
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.85, 1.55), (1.85, 1.75), (-1.85, -1.55), (1.8, -0.75), (0.65, 1.0), (-0.95, -1.6), (1.6, -1.5)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.08))
    for x, y in ((1.8, 0.75), (-1.9, 0.25), (-1.9, -0.65), (0.75, 1.7), (1.85, 0.45)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42))
    tt.clutter(ms, world, 0.75, 0.65, rng, 4)
    tt.clutter(ms, world, -1.0, -0.6, rng, 4)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
