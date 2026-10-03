# scripts/blender/build_town_classical_medium_a.py
# Classical Age `town-medium-a`, the Roman market town (plans/art/towns/classical/
# town-medium-a/reference-sheet.png): a hexastyle temple on a podium with broad steps at the
# north-west (12 m), a row of houses along the north, houses down the west and across the south,
# a market on the east (stalls under team-grey awnings before a long tiled stoa), courtyards
# with cypresses, and a paved forum with a 12 m free centre. 60 m.
#
#   python scripts/blender/build_town_classical_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_classical as tc  # noqa: E402

NAME = 'town-medium-a'
GROUND = dict(tc.PAVED, rx=3.0, ry=3.0, square=0.62)


def layout(ms, rng):
    tc.paved_strip(ms, -0.2, -0.7, -0.2, -2.95, 0.5)
    tc.temple(ms, rng, -1.75, 1.85, 0.9, 1.3, top=1.2, columns=6, side_columns=3, podium=0.16, yaw=0, steps=8)
    for x, y in ((-2.45, 2.55), (-1.05, 2.6), (-2.5, 1.2)):
        tc.cypress(ms, x, y, h=rng.uniform(0.35, 0.45))
    for i, x in enumerate((-0.45, 0.4, 1.25)):  # the north row
        tc.roman_house(ms, rng, x, 2.45, 0.74, 0.62, yaw=0, storeys=2 if i == 1 else 1, balcony=i == 1, jar_n=3 if i == 2 else 0)
    for i, y in enumerate((0.55, -0.4, -1.4)):  # the west side
        tc.roman_house(ms, rng, -2.45, y, 0.82, 0.66, yaw=90, gable_front=i == 1, awning_w=0.32 if i == 0 else None, chimney=i == 2)
    for i, x in enumerate((-2.3, -1.3, 0.75, 1.75)):  # the south side
        tc.roman_house(ms, rng, x, -2.45, 0.8, 0.66, yaw=180, storeys=2 if i == 1 else 1, balcony=i == 1, jar_n=2)
    # the market: a stoa on the east, stalls under team awnings before it
    tc.stoa(ms, rng, 2.45, 0.45, 1.9, yaw=-90, columns=7)
    for y in (1.15, 0.6, 0.05, -0.5):
        tb.stall(ms, 1.45, y, rng, yaw=-90, cloth='team_cloth', w=0.36, d=0.3)
    tc.roman_house(ms, rng, 2.45, 2.25, 0.8, 0.7, yaw=-90, gable_front=True)
    tc.roman_house(ms, rng, 2.45, -1.35, 0.8, 0.7, yaw=-90, jar_n=3)
    tt.well(ms, 0.95, -1.0, yaw=15)
    # an inner ring round the forum (the sheet's town is dense; the 12 m centre stays free)
    tc.roman_house(ms, rng, -0.55, 1.45, 0.66, 0.56, jar_n=2)
    tc.roman_house(ms, rng, 0.45, 1.5, 0.6, 0.52, gable_front=True)
    tc.roman_house(ms, rng, -1.55, 0.05, 0.62, 0.56, awning_w=0.28)
    tc.roman_house(ms, rng, -1.35, -1.4, 0.7, 0.58, storeys=2, balcony=True)
    tc.roman_house(ms, rng, 0.55, -1.55, 0.62, 0.54, jar_n=3)
    for x, y in ((-1.0, 0.75), (-1.05, -0.75), (0.05, 1.05), (1.05, -1.6), (-0.75, -2.0), (-2.0, 0.05)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42))
    for x, y in ((-1.6, -1.65), (1.0, -1.75), (-1.75, 0.85), (2.75, 1.55), (-0.9, 1.9), (0.9, 1.9), (2.0, -2.7)):
        tc.cypress(ms, x, y, h=rng.uniform(0.3, 0.42))
    for x, y in ((-2.8, -2.8), (2.8, -2.0), (0.15, 2.0), (-1.1, -2.0), (2.85, 2.85)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, 1.0, 1.55, rng, 4)
    tt.clutter(ms, world, -1.6, -0.95, rng, 4)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
