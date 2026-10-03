# scripts/blender/build_town_classical_small_b.py
# Classical Age `town-small-b`, the Han Chinese village (plans/art/towns/classical/town-small-b/
# reference-sheet.png): two halls on stone plinths across the north, a small shrine pavilion at
# the north-east corner, two houses down each side in walled yards with trees, awnings in team
# grey, a well at the south-west, low cream courtyard walls with tiled copings round the edge and
# a paved square with a 12 m free centre. 40 m.
#
#   python scripts/blender/build_town_classical_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402

NAME = 'town-small-b'
GROUND = dict(tc.PAVED, rx=2.0, ry=2.0, square=0.6)


def layout(ms, rng):
    for x in (-0.72, 0.62):
        tc.han_house(ms, rng, x, 1.42, 0.9, 0.55, yaw=0, posts=5, rise=0.22, jar_n=2)
    tc.han_pavilion(ms, 1.55, 1.5, size=0.3, top=0.6, yaw=0)
    for side, yaw in ((-1, 90), (1, -90)):
        for i, y in enumerate((0.25, -1.05)):
            tc.han_house(ms, rng, side * 1.48, y, 0.78, 0.5, yaw=yaw, awning_w=0.3 if i == 0 else None, jar_n=2 if i else 0)
            tc.broadleaf(ms, side * 1.15, y + 0.5, h=rng.uniform(0.28, 0.34))
        tc.court_wall(ms, side * 1.08, -1.6, side * 1.08, -0.62, gaps=((0.5, 0.2),))
        tc.court_wall(ms, side * 1.08, -0.3, side * 1.08, 0.85, gaps=((0.45, 0.2),))
    # the outer courtyard walls round the edge, open to the street at the south
    tc.court_wall(ms, -1.95, -1.95, -1.95, 1.95)
    tc.court_wall(ms, 1.95, -1.95, 1.95, 1.95)
    tc.court_wall(ms, -1.95, 1.95, 1.95, 1.95, gaps=((0.5, 0.3),))
    tc.court_wall(ms, -1.95, -1.95, -0.35, -1.95)
    tc.court_wall(ms, 0.35, -1.95, 1.95, -1.95)
    tt.well(ms, -0.75, -1.4, yaw=-10)
    for x, y in ((-1.75, 1.7), (1.8, 0.95), (-0.05, 1.75), (1.75, -1.7), (-1.75, -1.72)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, 0.9, -0.85, rng, 4)
    tt.clutter(ms, world, -0.95, 0.9, rng, 3)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
