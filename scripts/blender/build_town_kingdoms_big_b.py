# scripts/blender/build_town_kingdoms_big_b.py
# Kingdoms Age `town-big-b`, the Abbasid / Andalusian city (plans/art/towns/kingdoms/town-big-b/
# reference-sheet.png): a great mosque with a white dome, side domes and a 28 m square minaret at
# the north-west, a two-storey caravanserai round an arcaded court under terracotta hip roofs at
# the north-east, an 18 m stone tower at the south-west corner, a row of team-grey market stalls
# down the west street, some thirty flat-roofed courtyard houses of cream and ochre plaster with
# carved timber screens, roof terraces and terracotta roofs packed round a large paved square,
# palms, cypresses, fountains, sandy cobbled lanes; the 14 m centre free. 80 m.
#
#   python scripts/blender/build_town_kingdoms_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402
import build_town_kingdoms_medium_b as mb  # noqa: E402

NAME = 'town-big-b'
GROUND = dict(tk.SANDY, rx=4.0, ry=4.0, square=0.7, n=72)


def ch(ms, rng, x, y, w, d, yaw, **kw):
    tk.court_house(ms, rng, x, y, w, d, yaw=yaw, mat=kw.pop('mat', rng.choice(mb.WALLS)),
                   tiled_wing=kw.pop('tiled_wing', rng.random() < 0.4), court=kw.pop('court', rng.choice(('tree', 'palm', 'palm', 'fountain'))),
                   **kw)


def layout(ms, rng):
    # lanes
    tk.street(ms, [(-3.5, 3.0), (-3.45, -2.2)], 0.4, mat='kg_sand_square')
    tk.street(ms, [(0.1, 1.5), (0.15, 3.95)], 0.38, mat='kg_sand_square')
    tk.street(ms, [(0.0, -1.5), (-0.4, -3.95)], 0.42, mat='kg_sand_square')
    tk.street(ms, [(1.5, -0.1), (3.95, -0.5)], 0.32, mat='kg_sand_square')
    tk.street(ms, [(-1.6, -1.55), (1.65, -1.55), (1.65, 1.55), (-1.6, 1.55), (-1.6, -1.55)], 0.3, mat='kg_sand_square')
    # landmarks
    tk.mosque(ms, rng, -2.6, 2.85, w=1.3, d=1.0, h=0.58, dome_r=0.34, minaret_at=(0.5, 0.42), minaret_top=2.8,
              minaret_w=0.3, yaw=0, porch_bays=5, mat='kg_whitewash', side_domes=True)
    tk.caravanserai(ms, rng, 2.6, 2.55, w=2.0, d=1.9, yaw=0, mat='kg_ochre', wing=0.44)
    tk.stone_tower(ms, rng, -3.2, -3.05, w=0.82, h=1.8, yaw=0)
    tk.flat_house(ms, rng, -2.45, -3.2, 0.62, 0.58, yaw=0, mat='kg_stone', roof_items=(('crates', 0.0, 0.0),))
    # market stalls down the west lane, facing east
    for y in (1.75, 1.25, 0.75, 0.25, -0.25, -0.75, -1.25, -1.75):
        tk.market_stall(ms, rng, -3.45, y, yaw=90, w=0.42, d=0.36)
    # the north middle, between mosque and caravanserai
    ch(ms, rng, -1.05, 3.35, 0.82, 0.8, 0)
    mb.house(ms, rng, -0.45, 3.5, 0.5, 0.5, yaw=0)
    mb.house(ms, rng, 0.75, 3.4, 0.62, 0.66, yaw=0, two=True, tiled=True)
    mb.house(ms, rng, -1.2, 2.25, 0.62, 0.58, yaw=0, two=True, screen=True)
    ch(ms, rng, -0.3, 2.45, 0.7, 0.72, 0)
    mb.house(ms, rng, 0.85, 2.15, 0.6, 0.56, yaw=0, two=True)
    # the west inner column, between the stalls and the square
    ch(ms, rng, -2.45, 1.05, 0.9, 0.82, 90)
    mb.house(ms, rng, -2.5, 0.0, 0.66, 0.66, yaw=90, two=True, screen=True)
    ch(ms, rng, -2.45, -1.0, 0.9, 0.82, 90)
    mb.house(ms, rng, -2.05, -2.1, 0.6, 0.56, yaw=90, stair=1)
    # the east side
    ch(ms, rng, 3.3, 0.85, 0.9, 0.86, -90)
    mb.house(ms, rng, 3.35, -1.1, 0.62, 0.7, yaw=-90, two=True, tiled=True)
    mb.house(ms, rng, 3.4, -2.0, 0.56, 0.56, yaw=-90)
    mb.house(ms, rng, 2.35, 0.75, 0.55, 0.6, yaw=-90, two=True, screen=True)
    mb.house(ms, rng, 2.35, -0.6, 0.6, 0.62, yaw=-90, awning_w=0.3)
    ch(ms, rng, 2.4, -1.75, 0.8, 0.8, -90)
    # the south side
    ch(ms, rng, -1.4, -3.3, 0.9, 0.8, 180)
    mb.house(ms, rng, -1.35, -2.3, 0.62, 0.56, yaw=180, two=True, screen=True)
    mb.house(ms, rng, 0.55, -3.4, 0.62, 0.62, yaw=180, two=True, tiled=True)
    mb.house(ms, rng, 0.7, -2.35, 0.6, 0.56, yaw=180, awning_w=0.3)
    ch(ms, rng, 1.6, -3.25, 0.8, 0.86, 180)
    mb.house(ms, rng, 2.6, -3.4, 0.56, 0.56, yaw=180, two=True)
    mb.house(ms, rng, 3.4, -3.3, 0.5, 0.62, yaw=180)
    mb.house(ms, rng, -0.55, -2.35, 0.42, 0.42, yaw=180)
    tt.well(ms, 1.05, -1.0, yaw=20)
    tk.fountain(ms, tm.house_frame(0, 0, 0), -1.05, 1.05, r=0.11)
    for x, y in ((-3.85, 3.85), (-1.7, 3.85), (1.35, 3.85), (3.85, 1.45), (3.85, -0.15), (-3.85, -2.4), (-0.9, -3.85),
                 (2.15, -3.85), (3.85, -2.75), (-1.75, 2.2), (1.55, 1.2), (-1.75, -1.25), (1.6, -1.2), (-0.35, 1.75),
                 (-3.0, 2.0), (2.0, 0.0), (-1.95, 0.0), (0.0, -1.9), (3.85, 3.85), (-0.6, -3.85)):
        tk.palm(ms, rng, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05), h=rng.uniform(0.48, 0.66), lod2=False)
    for x, y in ((-3.0, -2.2), (2.9, -2.6), (-0.1, 3.0), (1.3, 2.9), (-1.65, 3.85)):
        tc.cypress(ms, x, y, h=rng.uniform(0.4, 0.5), lod=1)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-2.9, 1.65), (-2.95, -1.6), (1.2, 0.6), (-1.1, -1.85), (2.0, -2.6), (0.1, 2.2)):
        tt.clutter(ms, world, x, y, rng, 4)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
