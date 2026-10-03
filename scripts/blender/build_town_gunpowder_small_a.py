# scripts/blender/build_town_gunpowder_small_a.py
# Gunpowder Age `town-small-a`, the French market village (plans/art/towns/gunpowder/
# town-small-a/reference-sheet.png): a stucco town hall under a slate hip roof with a sandstone
# clock tower (10 m) at the north-west, a big tiled house at the north-east, brick and stucco
# houses under tile and slate gables down the west and east, a mansard house with a team-grey
# awning at the south-east, a roofed well, iron lamps, trees, cobbles; the 12 m centre free. 40 m.
#
#   python scripts/blender/build_town_gunpowder_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

NAME = 'town-small-a'
GROUND = dict(gp.COBBLED, rx=2.0, ry=2.0, square=0.6)


def layout(ms, rng):
    gp.town_hall(ms, rng, -1.05, 1.42, 0.92, 0.6, top=1.0, yaw=0, wall='gp_stucco', roof='gp_slate', storeys=2, kind='hip',
                 tw=0.24, shaft=0.66, h=0.42)
    gp.gp_house(ms, rng, 1.05, 1.38, 0.98, 0.7, yaw=0, wall='gp_stucco', roof='gp_tile', kind='hip', chimneys=2, dormers=0,
                props=3, pots=2, rise=0.24)
    # the west side (fronts to the east)
    gp.gp_house(ms, rng, -1.42, 0.5, 0.68, 0.62, yaw=90, wall='gp_brick', roof='gp_tile', kind='gable', rise=0.22, props=2, pots=1)
    gp.gp_house(ms, rng, -1.42, -0.32, 0.72, 0.64, yaw=90, wall='gp_stucco', roof='gp_slate', kind='gable', rise=0.22, props=2,
                gable_front=True)
    gp.gp_house(ms, rng, -1.38, -1.2, 0.76, 0.7, yaw=90, wall='gp_brick', roof='gp_tile', kind='gable', rise=0.24, props=3, pots=2)
    # the east side (fronts to the west) and the south-east
    gp.gp_house(ms, rng, 1.42, 0.38, 0.74, 0.62, yaw=-90, wall='gp_brick', roof='gp_slate', kind='gable', rise=0.22, props=2,
                gable_front=True)
    gp.gp_house(ms, rng, 1.25, -1.22, 0.86, 0.66, yaw=0, wall='gp_stucco', roof='gp_slate', kind='mansard', dormers=3, chimneys=2,
                awning=(0.12, 0.36), props=3)
    gp.gp_house(ms, rng, 1.52, -0.4, 0.5, 0.5, yaw=-90, wall='gp_stucco', roof='gp_tile', kind='hip', storeys=1, chimneys=1, props=1)
    gp.well(ms, 0.72, -1.72, yaw=12)
    for x, y in ((-0.45, -1.0), (0.62, -0.98), (-0.72, 0.8), (0.72, 0.85)):
        gp.lamp(ms, x, y)
    for x, y in ((-1.82, 1.82), (1.85, 1.85), (-1.85, -1.82), (-1.88, 0.95), (1.86, 0.95), (-0.15, 1.85), (1.86, -1.8)):
        gp.tree(ms, x, y, h=rng.uniform(0.34, 0.42), r=rng.uniform(0.1, 0.14))
    for x, y in ((-0.82, -1.7), (-1.85, -0.75), (0.25, 1.9), (1.85, -0.85), (-0.75, 0.95)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    gp.garden(ms, [(-1.95, -1.95), (-1.0, -1.95), (-1.0, -1.7), (-1.95, -1.6)])
    gp.garden(ms, [(1.0, 1.82), (1.95, 1.8), (1.95, 1.95), (1.0, 1.95)])
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-0.82, -1.5), (0.9, -1.45), (-0.7, 1.05)):
        tt.clutter(ms, world, x, y, rng, 3)
    for k in range(3):
        gp.barrel(ms, world, 0.5 + 0.05 * k, -1.62 + 0.02 * k)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
