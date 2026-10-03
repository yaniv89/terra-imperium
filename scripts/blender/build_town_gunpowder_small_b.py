# scripts/blender/build_town_gunpowder_small_b.py
# Gunpowder Age `town-small-b`, the Low Countries village (plans/art/towns/gunpowder/
# town-small-b/reference-sheet.png): brick and cream stucco houses under hipped tile and slate
# roofs with dormers and green shutters round a cobbled square with a pale slab centre, a timber
# post windmill (10 m) at the north-east, a roofed well at the south-west, a market stall under a
# team-grey awning at the south, rail fences, lamps, trees; the 12 m centre free. 40 m.
#
#   python scripts/blender/build_town_gunpowder_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as gp  # noqa: E402
import ti_bronze as tb  # noqa: E402

NAME = 'town-small-b'
GROUND = dict(gp.COBBLED, rx=2.0, ry=2.0, square=0.6)


def layout(ms, rng):
    gp.windmill(ms, 1.42, 1.48, 1.0, yaw=-40, r=0.17)
    gp.garden(ms, [(0.95, 1.0), (1.95, 1.0), (1.95, 1.95), (0.95, 1.95)])
    sh = 'gp_shutter'
    gp.gp_house(ms, rng, -1.18, 1.42, 0.8, 0.64, yaw=0, wall='gp_stucco', roof='gp_tile', kind='hip', dormers=1, shutters=sh,
                props=2, pots=1, rise=0.22)
    gp.gp_house(ms, rng, 0.0, 1.42, 0.86, 0.64, yaw=0, wall='gp_brick', roof='gp_slate', kind='hip', dormers=2, shutters=sh,
                props=3, rise=0.2)
    gp.gp_house(ms, rng, -1.5, 0.4, 0.66, 0.6, yaw=90, wall='gp_stucco', roof='gp_slate', kind='hip', dormers=1, shutters=sh, props=2)
    gp.gp_house(ms, rng, -1.5, -0.62, 0.72, 0.62, yaw=90, wall='gp_stucco', roof='gp_tile', kind='hip', dormers=1, shutters=sh,
                props=2, awning=(0.0, 0.34))
    gp.gp_house(ms, rng, 1.5, 0.52, 0.62, 0.6, yaw=-90, wall='gp_brick', roof='gp_slate', kind='hip', dormers=1, shutters=sh, props=2)
    gp.gp_house(ms, rng, 1.5, -0.42, 0.68, 0.6, yaw=-90, wall='gp_stucco', roof='gp_tile', kind='hip', dormers=1, shutters=sh,
                props=3, pots=2)
    gp.stall(ms, rng, 0.15, -1.62, w=0.42, d=0.3)
    gp.well(ms, -1.45, -1.55, yaw=20)
    fence = [(-1.93, -1.2), (-1.93, 1.0), (-1.93, 1.93), (-0.6, 1.93)]

    tb.rail_fence(ms, fence, h=0.1, step=0.25)
    tb.rail_fence(ms, [(0.4, -1.93), (1.93, -1.93), (1.93, -1.0)], h=0.1, step=0.25)
    gp.lamps(ms, [(-0.95, -1.2), (0.95, -1.15), (0.95, 0.9), (-0.85, 0.85)])
    gp.trees(ms, rng, [(-1.85, 1.0), (-0.62, 1.86), (1.88, 0.95), (1.88, -1.0), (-1.86, -1.25), (0.62, 1.88)])
    for x, y in ((-1.0, -1.8), (1.2, -1.7), (-1.88, -0.1), (0.75, -1.85)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, -1.0, -1.6, rng, 3)
    for k in range(4):
        gp.barrel(ms, world, 0.55 + 0.05 * k, -1.7)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
