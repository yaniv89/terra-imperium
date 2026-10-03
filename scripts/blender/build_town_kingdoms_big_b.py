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


def split(rng, a, b, lo=0.62, hi=0.95):
    """Cut the span a..b into pieces between lo and hi long."""
    n = max(1, round((b - a) / ((lo + hi) / 2)))
    cuts = [a + (b - a) * (i + rng.uniform(-0.12, 0.12) * (0 < i < n)) / n for i in range(n + 1)]
    return list(zip(cuts, cuts[1:]))


def cluster(ms, rng, x0, y0, x1, y1, yaw, gap=0.06):
    """Fill a rectangle with houses: a grid of plots, each a flat-roofed house or (a big, squarish
    plot) a courtyard house, fronts turned by `yaw`."""
    for cx0, cx1 in split(rng, x0, x1):
        for cy0, cy1 in split(rng, y0, y1):
            x, y = (cx0 + cx1) / 2, (cy0 + cy1) / 2
            ww, dd = cx1 - cx0 - gap, cy1 - cy0 - gap
            w, d = (dd, ww) if yaw in (90, -90) else (ww, dd)
            if min(w, d) > 0.74 and rng.random() < 0.6:
                ch(ms, rng, x, y, w, d, yaw)
            else:
                mb.house(ms, rng, x, y, w * rng.uniform(0.88, 1.0), d * rng.uniform(0.88, 1.0), yaw=yaw,
                         awning_w=0.3 if rng.random() < 0.15 else None, stair=rng.choice((None, None, None, 1, -1)))


def layout(ms, rng):
    # lanes
    tk.street(ms, [(-3.5, 3.0), (-3.45, -2.2)], 0.4, mat='kg_sand_square')
    tk.street(ms, [(0.1, 1.5), (0.15, 3.72)], 0.38, mat='kg_sand_square')
    tk.street(ms, [(0.0, -1.5), (-0.4, -3.72)], 0.42, mat='kg_sand_square')
    tk.street(ms, [(1.5, -0.1), (3.72, -0.5)], 0.32, mat='kg_sand_square')
    # landmarks
    tk.mosque(ms, rng, -2.6, 2.85, w=1.3, d=1.0, h=0.58, dome_r=0.34, minaret_at=(0.5, 0.42), minaret_top=2.8,
              minaret_w=0.3, yaw=0, porch_bays=5, mat='kg_whitewash', side_domes=True)
    tk.caravanserai(ms, rng, 2.6, 2.55, w=2.0, d=1.9, yaw=0, mat='kg_ochre', wing=0.44)
    tk.stone_tower(ms, rng, -3.2, -3.05, w=0.82, h=1.8, yaw=0)
    tk.flat_house(ms, rng, -2.45, -3.2, 0.62, 0.58, yaw=0, mat='kg_stone', roof_items=(('crates', 0.0, 0.0),))
    # market stalls down the west lane, facing east
    for y in (1.75, 1.25, 0.75, 0.25, -0.25, -0.75, -1.25, -1.75):
        tk.market_stall(ms, rng, -3.45, y, yaw=90, w=0.34, d=0.36)
    # the quarters: blocks packed with houses and courtyard houses (the sheet's city is dense)
    cluster(ms, rng, -1.85, 1.75, -0.2, 3.7, 0)
    cluster(ms, rng, 0.38, 1.75, 1.5, 3.7, 0)
    cluster(ms, rng, -3.1, -1.6, -1.75, 1.95, 90)
    cluster(ms, rng, 1.75, 0.15, 3.75, 1.45, -90)
    cluster(ms, rng, 1.75, -3.7, 3.75, -0.75, -90)
    cluster(ms, rng, 0.2, -3.7, 1.55, -1.75, 180)
    cluster(ms, rng, -2.25, -3.7, -0.68, -1.75, 180)
    tt.well(ms, 1.05, -1.0, yaw=20)
    tk.fountain(ms, tm.house_frame(0, 0, 0), -1.05, 1.05, r=0.11)
    for x, y in ((-3.85, 3.85), (-3.85, 2.0), (-3.85, -2.45), (3.85, -0.2), (3.85, 1.55), (-1.6, 1.62), (1.6, 1.62),
                 (-1.6, -1.6), (1.6, -1.6), (-1.6, 0.0), (1.6, 0.0), (0.0, 1.6), (0.55, -1.62), (-3.0, 2.05), (3.85, -3.85), (0.38, 2.4), (-0.15, 3.1),
                 (0.15, -2.4), (-0.6, -3.1), (2.6, -0.62), (3.3, 0.05), (-2.0, 0.0), (-1.7, 1.0), (1.7, -1.0)):
        tk.palm(ms, rng, x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.04, 0.04), h=rng.uniform(0.5, 0.66), lod2=False)
    for x, y in ((-1.85, 2.0), (1.65, 1.7), (-1.68, -1.7), (3.85, 0.0)):
        tc.cypress(ms, x, y, h=rng.uniform(0.4, 0.5), lod=1)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-3.25, 2.05), (-3.25, -2.2), (1.25, 0.6), (-1.1, -1.5), (0.4, 1.55), (-0.3, -1.55)):
        tt.clutter(ms, world, x, y, rng, 4)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
