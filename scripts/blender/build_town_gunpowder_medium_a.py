# scripts/blender/build_town_gunpowder_medium_a.py
# Gunpowder Age `town-medium-a`, the European market town (plans/art/towns/gunpowder/
# town-medium-a/reference-sheet.png): a domed baroque church (20 m) at the north-west, a brick
# town hall with its clock tower (16 m) at the north-east, blocks of brick and stucco houses
# under tile, slate and mansard roofs round a paved square, market stalls under team-grey
# awnings on the east, lamps and trees; the 12 m centre free. 60 m.
#
#   python scripts/blender/build_town_gunpowder_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

NAME = 'town-medium-a'
GROUND = dict(gp.COBBLED, rx=3.0, ry=3.0, square=0.62)


def layout(ms, rng):
    gp.domed_church(ms, rng, -1.72, 1.78, top=2.0, w=0.64, length=1.05, yaw=0)
    gp.town_hall(ms, rng, 1.72, 2.05, 1.2, 0.76, top=1.6, yaw=0, storeys=3, tw=0.3, shaft=0.6)
    gp.houses(ms, rng, [
        (-0.55, 2.42, 0.62, 0.56, 0), (0.18, 2.45, 0.6, 0.56, 0), (-0.55, 1.62, 0.6, 0.54, 0), (0.18, 1.62, 0.56, 0.54, 0),
        (-2.45, 0.5, 0.62, 0.56, 90), (-2.45, -0.32, 0.62, 0.56, 90), (-1.62, 0.5, 0.56, 0.5, 90), (-1.62, -0.3, 0.56, 0.5, 90),
        (-2.25, -1.62, 0.72, 0.6, 180), (-1.42, -1.75, 0.62, 0.56, 180), (-2.3, -2.45, 0.66, 0.46, 0),
        (1.42, -1.62, 0.66, 0.58, 180), (2.3, -1.72, 0.72, 0.6, 180), (1.45, -2.45, 0.62, 0.46, 0),
        (2.45, 0.85, 0.6, 0.56, -90), (2.45, 0.05, 0.6, 0.56, -90), (2.45, -0.75, 0.6, 0.56, -90),
    ], palette='a')
    for y in (0.95, 0.4, -0.15, -0.7):
        gp.stall(ms, rng, 1.55, y, yaw=-90)
    gp.lamps(ms, [(-0.95, -0.95), (0.95, -0.95), (-0.95, 0.95), (0.95, 0.95), (0.35, -1.6), (-0.35, -1.6), (1.1, 1.3), (-1.1, 1.0)])
    gp.trees(ms, rng, [(-2.75, 2.75), (-2.8, 1.25), (-0.95, 2.75), (2.8, 2.75), (2.8, 1.45), (-2.8, -1.0), (2.8, -2.75),
                       (-1.0, -2.6), (0.75, -2.6), (-0.95, -1.15), (1.0, 2.75), (2.8, -1.3)])
    for x, y in ((-1.1, 0.95), (-2.0, -0.05), (0.75, 1.3), (-0.8, -2.0), (2.0, -1.2), (-2.75, -2.75)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.08))
    world = tm.house_frame(0, 0, 0)
    for x, y in ((1.15, 0.7), (1.15, -0.4), (-1.1, -1.25), (0.95, 1.55)):
        tt.clutter(ms, world, x, y, rng, 3)
        gp.barrel(ms, world, x + 0.1, y + 0.05)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
