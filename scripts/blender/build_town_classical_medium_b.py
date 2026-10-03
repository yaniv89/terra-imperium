# scripts/blender/build_town_classical_medium_b.py
# Classical Age `town-medium-b`, the Han Chinese market town (plans/art/towns/classical/
# town-medium-b/reference-sheet.png): a drum tower at the north-east (12 m), halls in walled
# compounds along the north, houses and yards with trees down both sides, a market of team-grey
# awnings at the south-west, low cream courtyard walls with tiled copings and a paved square
# with a 12 m free centre. 60 m.
#
#   python scripts/blender/build_town_classical_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_classical as tc  # noqa: E402

NAME = 'town-medium-b'
GROUND = dict(tc.PAVED, rx=3.0, ry=3.0, square=0.62)


def layout(ms, rng):
    tc.drum_tower(ms, 2.3, 2.3, base=0.55, top=1.2, yaw=0)
    tc.han_house(ms, rng, -1.85, 2.35, 0.95, 0.6, yaw=0, posts=5, rise=0.24, jar_n=2)
    tc.han_house(ms, rng, -0.3, 2.3, 1.1, 0.66, yaw=0, posts=6, rise=0.26)
    tc.han_house(ms, rng, 1.05, 2.4, 0.7, 0.5, yaw=0)
    tc.court_wall(ms, -2.9, 1.75, -0.9, 1.75, gaps=((0.5, 0.26),))
    tc.court_wall(ms, 0.4, 1.8, 1.7, 1.8, gaps=((0.5, 0.22),))
    for side, yaw in ((-1, 90), (1, -90)):
        for i, y in enumerate((1.0, -0.05, -1.1)):
            if side < 0 and i == 2:
                continue  # the market stands here
            tc.han_house(ms, rng, side * 2.4, y, 0.85, 0.55, yaw=yaw, jar_n=2 if i == 1 else 0, awning_w=0.3 if (side > 0 and i == 0) else None)
            tc.broadleaf(ms, side * 1.9, y + 0.42, h=rng.uniform(0.3, 0.38), r=0.1)
        tc.court_wall(ms, side * 1.75, -1.6, side * 1.75, 1.5, gaps=((0.2, 0.2), (0.55, 0.2), (0.88, 0.2)))
    tc.han_house(ms, rng, 2.25, -2.3, 1.0, 0.62, yaw=180, posts=5)
    tc.han_house(ms, rng, 0.95, -2.4, 0.7, 0.5, yaw=180)
    # the market at the south-west: stalls under team awnings in two rows
    for x in (-2.35, -1.75, -1.15):
        for y in (-1.55, -2.25):
            tb.stall(ms, x, y, rng, yaw=180 if y < -2 else 0, cloth='team_cloth', w=0.42, d=0.32)
    for x, y in ((-2.75, 2.8), (0.4, 2.8), (2.8, 1.2), (-0.6, -2.7), (2.8, -1.6), (-2.8, -0.6)):
        tc.shrub(ms, x, y, r=rng.uniform(0.07, 0.1))
    tc.broadleaf(ms, 1.55, 1.25, h=0.36, r=0.11)
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, 1.2, -1.25, rng, 4)
    tt.clutter(ms, world, -0.9, 1.35, rng, 3)
    tt.well(ms, 0.95, 0.95, yaw=20)
    # an inner ring of houses round the square (the sheet's town is dense; the centre stays free)
    tc.han_house(ms, rng, -1.2, 1.25, 0.72, 0.5, awning_w=0.26)
    tc.han_house(ms, rng, 0.25, 1.4, 0.66, 0.48)
    tc.han_house(ms, rng, -1.25, -0.1, 0.7, 0.48, jar_n=2)
    tc.han_house(ms, rng, 1.25, -0.25, 0.68, 0.5)
    tc.han_house(ms, rng, 0.25, -1.5, 0.72, 0.5, awning_w=0.28)
    for x, y in ((-0.6, 1.0), (1.0, 0.45), (-1.0, -0.75), (0.95, -1.05), (-0.45, -1.2), (2.0, 1.6), (-2.0, 0.5), (2.6, -0.6)):
        tc.broadleaf(ms, x, y, h=rng.uniform(0.28, 0.38), r=rng.uniform(0.08, 0.11))


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
