# scripts/blender/build_town_kingdoms_small_b.py
# Kingdoms Age `town-small-b`, the Abbasid / Andalusian village (plans/art/towns/kingdoms/
# town-small-b/reference-sheet.png): flat-roofed courtyard houses of cream and ochre lime plaster
# with parapets, horseshoe-arched doors, carved timber screens and a few terracotta roofs, a small
# mosque with a white dome and a 10 m square minaret at the north-east, a pergola and team-grey
# awnings, a stone well, date palms, sandy cobbles; the 12 m centre free. 40 m.
#
#   python scripts/blender/build_town_kingdoms_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

NAME = 'town-small-b'
GROUND = dict(tk.SANDY, rx=2.0, ry=2.0, square=0.6, n=72)


def layout(ms, rng):
    tk.street(ms, [(-0.2, -0.65), (-0.45, -1.3), (-0.8, -1.82)], 0.36, mat='kg_sand_square')
    tk.street(ms, [(0.65, -0.1), (1.0, -0.2), (1.84, -0.2)], 0.3, mat='kg_sand_square')
    tk.mosque(ms, rng, 1.25, 1.22, w=0.62, d=0.56, h=0.42, dome_r=0.17, minaret_at=(0.4, 0.26), minaret_top=1.0,
              minaret_w=0.17, yaw=0, porch_bays=3, mat='kg_whitewash')
    tk.court_house(ms, rng, -1.28, 1.3, 0.92, 0.9, yaw=0, mat='kg_ochre', court='palm')
    tk.flat_house(ms, rng, 0.05, 1.42, 0.8, 0.62, yaw=0, storeys=2, upper=(-0.15, 0.08, 0.46, 0.4), tiled=True,
                  roof_items=(('crates', 0.2, 0.0),), mat='kg_whitewash')
    tk.court_house(ms, rng, -1.42, -0.2, 0.78, 1.0, yaw=90, mat='kg_whitewash', tiled_wing=True, court='tree')
    tk.flat_house(ms, rng, -1.45, -1.25, 0.66, 0.56, yaw=90, roof_items=(('jars', -0.1, 0.05), ('mat', 0.1, -0.05)),
                  awning_w=0.32, mat='kg_ochre')
    tt.pergola(ms, tm.house_frame(-1.0, -1.05, 90), 0.0, 0.0, tt.G, 0.34, 0.3, mat='kg_garden', lod=1, post_h=0.24)
    tk.court_house(ms, rng, 1.4, 0.05, 0.86, 0.96, yaw=-90, mat='kg_ochre', tiled_wing=True, court='fountain')
    tk.flat_house(ms, rng, 1.42, -1.2, 0.74, 0.66, yaw=-90, storeys=2, upper=(0.1, 0.1, 0.42, 0.4), screen=True,
                  stair=-1, awning_w=0.34, roof_items=(('tank', 0.0, 0.0),), mat='kg_whitewash')
    tk.stone_wall(ms, 1.0, -1.85, 1.85, -1.85, h=0.1)
    tk.stone_wall(ms, 1.85, -1.85, 1.85, -1.55, h=0.1)
    tt.well(ms, -0.55, -1.0, yaw=10)
    for x, y in ((-1.8, 1.82), (-0.75, 1.85), (0.55, 1.85), (1.85, 1.85), (1.88, 0.75), (-1.85, -1.75), (-1.2, -1.82),
                 (-0.1, -1.8), (0.85, -1.55), (1.88, -0.7), (-0.85, 0.8), (0.75, 0.85), (-1.88, 0.62)):
        tk.palm(ms, rng, x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.04, 0.04), h=rng.uniform(0.42, 0.58), lod2=True)
    for x, y in ((-0.85, -0.55), (0.82, -0.62), (0.8, 1.9), (-1.9, 0.15)):
        tk.tree(ms, x, y, h=rng.uniform(0.28, 0.34), r=rng.uniform(0.08, 0.1), lod2=False)
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, -0.8, -1.45, rng, 4)
    tt.clutter(ms, world, 0.95, -1.1, rng, 4)
    for k in range(4):
        tt.jar(ms, world, -0.3 + 0.05 * k, -1.2 + 0.02 * k, 1.2)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
