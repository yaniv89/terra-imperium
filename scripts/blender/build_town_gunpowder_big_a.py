# scripts/blender/build_town_gunpowder_big_a.py
# Gunpowder Age `town-big-a`, the European city (plans/art/towns/gunpowder/town-big-a/
# reference-sheet.png): a domed baroque church (28 m) at the north-west, a brick town hall with
# its clock tower (26 m) at the north-east, a post windmill at the south-west, a stone bastion
# with a cannon in the south-east corner, two rings of brick and stucco houses under tile, slate
# and mansard roofs, market stalls under team-grey awnings on the east of the square, lamps and
# trees; the 14 m centre free. 80 m.
#
#   python scripts/blender/build_town_gunpowder_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

NAME = 'town-big-a'
GROUND = dict(gp.COBBLED, rx=4.0, ry=4.0, square=0.7, n=72)


def layout(ms, rng):
    gp.domed_church(ms, rng, -2.6, 2.55, top=2.8, w=0.86, length=1.4, yaw=0)
    gp.town_hall(ms, rng, 2.6, 2.75, 1.4, 0.86, top=2.6, yaw=0, storeys=3, tw=0.36, shaft=0.66)
    gp.windmill(ms, -3.05, -3.05, 1.8, yaw=-45, r=0.27)
    gp.garden(ms, [(-3.95, -3.95), (-2.4, -3.95), (-2.4, -2.45), (-3.95, -2.45)])
    gp.town_bastion(ms, rng, 3.0, -3.0, size=1.6, H=0.4, gun=-45)
    gp.houses(ms, rng, [
        # north, between the church and the hall
        (-1.35, 3.35, 0.66, 0.56, 0), (-0.45, 3.35, 0.7, 0.56, 0), (0.5, 3.35, 0.66, 0.56, 0), (1.38, 3.4, 0.5, 0.5, 0),
        (-3.5, 2.0, 0.48, 0.5, 90),
        (-1.35, 2.45, 0.62, 0.54, 0), (-0.4, 2.45, 0.6, 0.54, 0), (0.6, 2.4, 0.66, 0.54, 0),
        # west, two rows
        (-3.4, 1.15, 0.66, 0.56, 90), (-3.4, 0.35, 0.66, 0.56, 90), (-3.4, -0.45, 0.66, 0.56, 90), (-3.4, -1.25, 0.66, 0.56, 90),
        (-3.4, -2.05, 0.62, 0.56, 90),
        (-2.45, 1.0, 0.6, 0.52, 90), (-2.45, 0.2, 0.6, 0.52, 90), (-2.45, -0.6, 0.6, 0.52, 90), (-2.45, -1.4, 0.6, 0.52, 90),
        # south, either side of the street
        (-1.75, -3.4, 0.66, 0.56, 180), (-0.85, -3.4, 0.66, 0.56, 180), (0.85, -3.4, 0.66, 0.56, 180), (1.75, -3.4, 0.62, 0.56, 180),
        (-1.6, -2.45, 0.62, 0.54, 180), (-0.75, -2.45, 0.6, 0.54, 180), (0.75, -2.45, 0.6, 0.54, 180), (1.6, -2.4, 0.62, 0.54, 180),
        # east, two rows behind the market
        (3.4, 1.55, 0.66, 0.56, -90), (3.4, 0.75, 0.66, 0.56, -90), (3.4, -0.05, 0.66, 0.56, -90), (3.4, -0.85, 0.66, 0.56, -90),
        (3.4, -1.65, 0.62, 0.56, -90),
        (2.5, 1.1, 0.6, 0.52, -90), (2.5, 0.3, 0.6, 0.52, -90), (2.5, -0.5, 0.6, 0.52, -90), (2.45, -1.4, 0.6, 0.52, -90),
    ], palette='a')
    for y in (1.15, 0.55, -0.05, -0.65):
        gp.stall(ms, rng, 1.65, y, yaw=-90)
    gp.lamps(ms, [(-1.05, -1.05), (1.05, -1.05), (-1.05, 1.05), (1.05, 1.05), (-0.35, -1.95), (0.35, -1.95), (-1.9, 0.0),
                  (1.25, 1.65), (-1.9, 1.7), (0.0, 1.85)])
    gp.trees(ms, rng, [(-3.85, 3.8), (-1.85, 3.8), (1.25, 3.85), (3.85, 3.85), (3.85, 2.2), (-3.85, 1.95), (-3.85, -2.85),
                       (-2.0, -3.85), (2.45, -3.85), (3.85, -2.35), (-1.95, -1.9), (1.95, -1.95), (-1.95, 2.0), (1.15, 2.95),
                       (-0.05, -3.85), (3.0, 1.9), (-0.95, 1.95)], lod2=False)
    for x, y in ((-1.2, 1.55), (-2.9, -2.2), (2.1, 1.65), (-0.2, 2.9), (2.95, -1.95), (-1.2, -1.55)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    world = tm.house_frame(0, 0, 0)
    for x, y in ((1.25, 0.85), (1.25, -0.35), (-1.25, -1.35), (1.2, 1.4), (-1.6, 1.55)):
        tt.clutter(ms, world, x, y, rng, 3)
        gp.barrel(ms, world, x + 0.1, y + 0.05)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
