# scripts/blender/build_town_kingdoms_small_a.py
# Kingdoms Age `town-small-a`, the European medieval village (plans/art/towns/kingdoms/
# town-small-a/reference-sheet.png): a small stone church with a slate spire at the north-west
# (10 m), half-timbered houses round a cobbled square under slate and straw-thatch roofs with
# stone chimneys, a house with a team-grey awning at the south-west, a well at the south-east,
# trees and a street leaving south; the 12 m centre free. 40 m.
#
#   python scripts/blender/build_town_kingdoms_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

NAME = 'town-small-a'
GROUND = dict(tk.COBBLED, rx=2.0, ry=2.0, square=0.6)


def layout(ms, rng):
    tc.paved_strip(ms, 0.0, -0.65, 0.0, -1.95, 0.45)
    tk.church(ms, rng, -0.82, 1.38, top=1.0, yaw=0)
    tk.tudor_house(ms, rng, 0.2, 1.4, 0.92, 0.66, yaw=0, chimneys=2, jar_n=2)
    tk.tudor_house(ms, rng, 1.45, 1.4, 0.72, 0.8, yaw=0, roof='thatch', hipped=True, rise=0.4)
    tk.tudor_house(ms, rng, -1.45, -0.05, 0.8, 0.66, yaw=90, chimneys=1)
    tk.tudor_house(ms, rng, -1.4, -1.15, 0.92, 0.74, yaw=90, awning_w=0.36, chimneys=2, jar_n=3)
    tk.tudor_house(ms, rng, 1.48, 0.12, 0.86, 0.66, yaw=-90, jar_n=2)
    tk.tudor_house(ms, rng, 1.45, -0.95, 0.6, 0.56, yaw=-90, roof='thatch', rise=0.28)
    tt.well(ms, 1.45, -1.55, yaw=10)
    for x, y in ((-1.4, 1.75), (-1.85, 1.3), (0.9, 1.85), (-1.85, -0.55), (1.85, -0.45), (0.85, -1.8), (-0.8, -1.8),
                 (-1.85, 0.75), (1.85, 0.8)):
        tc.broadleaf(ms, x, y, h=rng.uniform(0.36, 0.46), r=rng.uniform(0.13, 0.17))
    for x, y in ((-0.85, 0.65), (0.9, -0.5), (-0.8, -0.6), (0.85, 0.75)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    world = tm.house_frame(0, 0, 0)
    tt.woodpile(ms, world, 0.85, 1.0, 0)
    tt.clutter(ms, world, -0.85, -1.2, rng, 3)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
