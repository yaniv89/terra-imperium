# scripts/blender/build_town_gunpowder_medium_b.py
# Gunpowder Age `town-medium-b`, the Low Countries market town (plans/art/towns/gunpowder/
# town-medium-b/reference-sheet.png): a brick town hall with a tall clock tower (20 m) at the
# north-east, a post windmill (14 m) on its stone base at the south-west, rows of brick and
# stucco houses under hipped tile and slate roofs with dormers, a column of market stalls under
# team-grey awnings on the west of the square, lamps and trees; the 12 m centre free. 60 m.
#
#   python scripts/blender/build_town_gunpowder_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

NAME = 'town-medium-b'
GROUND = dict(gp.COBBLED, rx=3.0, ry=3.0, square=0.62)


def layout(ms, rng):
    gp.town_hall(ms, rng, 1.95, 2.05, 1.22, 0.8, top=2.0, yaw=0, storeys=3, tw=0.3, shaft=0.66)
    gp.windmill(ms, -2.15, -2.1, 1.4, yaw=-45, r=0.22)
    gp.garden(ms, [(-2.95, -2.95), (-1.5, -2.95), (-1.5, -1.6), (-2.95, -1.5)])
    gp.houses(ms, rng, [
        (-2.3, 2.42, 0.66, 0.56, 0), (-1.45, 2.42, 0.62, 0.56, 0), (-0.55, 2.42, 0.66, 0.56, 0), (0.4, 2.45, 0.66, 0.56, 0),
        (-0.4, 1.62, 0.56, 0.5, 0), (0.45, 1.62, 0.56, 0.5, 0),
        (-2.45, 1.45, 0.62, 0.56, 90), (-2.45, 0.65, 0.62, 0.56, 90), (-2.45, -0.15, 0.62, 0.56, 90), (-2.45, -0.95, 0.62, 0.56, 90),
        (2.45, 0.95, 0.62, 0.56, -90), (2.45, 0.15, 0.62, 0.56, -90), (2.45, -0.65, 0.62, 0.56, -90),
        (1.6, 0.55, 0.56, 0.5, -90), (1.6, -0.3, 0.56, 0.5, -90),
        (0.15, -2.2, 0.72, 0.58, 180), (1.0, -2.3, 0.62, 0.56, 180), (2.25, -2.15, 0.7, 0.58, 180), (2.35, -1.35, 0.56, 0.5, -90),
        (-0.85, -2.35, 0.56, 0.5, 180),
    ], palette='b')
    for y in (1.0, 0.42, -0.16, -0.74):
        gp.stall(ms, rng, -1.45, y, yaw=90)
    gp.lamps(ms, [(-0.95, -0.95), (0.95, -0.95), (-0.95, 0.95), (0.95, 0.95), (-1.0, -1.6), (1.05, -1.55), (0.0, 1.15)])
    gp.trees(ms, rng, [(-2.8, 2.8), (-1.0, 2.82), (1.15, 2.8), (2.82, 2.82), (2.82, -2.82), (2.82, 1.6), (-2.82, -1.45),
                       (-0.3, -2.8), (1.6, -2.75), (-1.15, -1.5), (1.15, 1.35), (2.0, 1.35)])
    for x, y in ((-1.95, 1.0), (-1.9, -0.6), (1.9, -0.9), (0.6, -1.7), (-0.4, -1.75)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.08))
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.1, 0.7), (-1.1, -0.45), (1.3, -1.65), (-1.55, -1.45)):
        tt.clutter(ms, world, x, y, rng, 3)
        gp.barrel(ms, world, x - 0.1, y + 0.05)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
