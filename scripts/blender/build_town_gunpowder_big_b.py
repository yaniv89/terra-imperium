# scripts/blender/build_town_gunpowder_big_b.py
# Gunpowder Age `town-big-b`, the Low Countries city (plans/art/towns/gunpowder/town-big-b/
# reference-sheet.png): a twin-tower baroque church (28 m) at the north-west facing the square,
# a brick town hall with a tall clock tower (28 m) at the north-east, a post windmill at the
# south-west, a grassed stone bastion with a cannon in the south-east corner, blocks of brick
# and stucco houses under hipped tile and slate roofs among trees, market stalls under
# team-grey awnings on the west of the square, lamps; the 14 m centre free. 80 m.
#
#   python scripts/blender/build_town_gunpowder_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

NAME = 'town-big-b'
GROUND = dict(gp.COBBLED, rx=4.0, ry=4.0, square=0.7, n=72)


def layout(ms, rng):
    gp.twin_church(ms, rng, -2.5, 2.5, top=2.8, w=0.7, length=1.5, yaw=45)
    gp.town_hall(ms, rng, 2.55, 2.55, 1.25, 0.95, top=2.8, yaw=0, storeys=3, tw=0.36, shaft=0.68)
    gp.windmill(ms, -3.0, -2.6, 1.6, yaw=-45, r=0.24)
    gp.garden(ms, [(-3.95, -3.3), (-2.3, -3.3), (-2.3, -1.95), (-3.95, -1.95)])
    gp.garden(ms, [(2.0, -3.95), (3.95, -3.95), (3.95, -2.0), (3.2, -2.0), (2.0, -3.2)])
    gp.town_bastion(ms, rng, 3.15, -3.15, size=1.4, H=0.4, gun=-45)
    gp.houses(ms, rng, [
        (-0.9, 3.35, 0.62, 0.54, 0), (0.0, 3.35, 0.6, 0.54, 0), (0.95, 3.35, 0.62, 0.54, 0),
        (-0.85, 2.35, 0.6, 0.52, 0), (0.1, 2.35, 0.58, 0.52, 0), (1.0, 2.0, 0.5, 0.48, 0),
        (-3.4, 1.0, 0.62, 0.54, 90), (-3.4, 0.2, 0.62, 0.54, 90), (-3.4, -0.6, 0.62, 0.54, 90), (-3.4, -1.4, 0.6, 0.54, 90),
        (-2.5, 0.85, 0.56, 0.5, 90), (-2.5, 0.05, 0.56, 0.5, 90), (-2.5, -0.75, 0.56, 0.5, 90), (-2.45, -1.6, 0.56, 0.5, 90),
        (3.4, 1.1, 0.62, 0.54, -90), (3.4, 0.3, 0.62, 0.54, -90), (3.4, -0.5, 0.62, 0.54, -90), (3.4, -1.3, 0.6, 0.54, -90),
        (2.3, 0.8, 0.6, 0.52, -90), (2.3, -0.05, 0.6, 0.52, -90), (2.3, -0.9, 0.56, 0.5, -90),
        (-1.65, -3.4, 0.62, 0.54, 180), (-0.75, -3.4, 0.6, 0.54, 180), (0.75, -3.4, 0.6, 0.54, 180), (1.55, -3.0, 0.5, 0.48, 180),
        (-1.55, -2.4, 0.58, 0.52, 180), (-0.7, -2.4, 0.56, 0.52, 180), (0.7, -2.35, 0.58, 0.52, 180), (1.55, -2.0, 0.5, 0.48, 180),
    ], palette='b')
    for y in (1.0, 0.4, -0.2, -0.8):
        gp.stall(ms, rng, -1.65, y, yaw=90)
    gp.lamps(ms, [(-1.05, -1.05), (1.05, -1.05), (-1.05, 1.05), (1.05, 1.05), (-0.3, -1.9), (0.3, -1.9), (1.75, 0.2),
                  (-1.2, 1.7), (1.8, 1.7), (0.0, 1.75)])
    gp.trees(ms, rng, [(-3.85, 1.85), (-1.6, 3.85), (1.6, 3.85), (3.85, 3.85), (3.85, 1.85), (-3.85, -2.0), (-3.85, 3.85),
                       (-0.3, 2.9), (0.55, 2.85), (-1.85, -1.3), (1.85, -1.55), (-2.0, 1.55), (2.95, 0.45), (-2.95, -0.2),
                       (-1.15, -2.9), (0.0, -2.95), (1.15, -2.9), (2.95, -0.85), (-2.95, 1.6), (1.45, 1.6)], lod2=False)
    for x, y in ((-1.3, 1.4), (-3.0, 0.6), (2.85, 1.6), (-0.3, -1.6), (2.0, -1.5), (0.35, 1.7)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.25, 0.75), (-1.25, -0.5), (1.25, -1.3), (1.3, 1.45), (-0.8, 1.55)):
        tt.clutter(ms, world, x, y, rng, 3)
        gp.barrel(ms, world, x - 0.1, y + 0.05)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
