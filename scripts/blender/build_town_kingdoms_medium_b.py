# scripts/blender/build_town_kingdoms_medium_b.py
# Kingdoms Age `town-medium-b`, the Abbasid / Andalusian market town (plans/art/towns/kingdoms/
# town-medium-b/reference-sheet.png): a mosque with a white dome and an 18 m square minaret at
# the north-west, team-grey market stalls before it, flat-roofed courtyard houses of cream and
# ochre plaster with carved timber screens, roof terraces and a few terracotta roofs round a
# paved square, a market hall complex with horseshoe arcades under terracotta hip roofs at the
# south-east, palms and cypresses, sandy cobbles; the 12 m centre free. 60 m.
#
#   python scripts/blender/build_town_kingdoms_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

NAME = 'town-medium-b'
GROUND = dict(tk.SANDY, rx=3.0, ry=3.0, square=0.62, n=80)
WALLS = ('kg_ochre', 'kg_whitewash')


def items(rng):
    return rng.choice([(('crates', -0.1, 0.0),), (('tank', 0.1, 0.05), ('mat', -0.1, -0.05)), (('jars', -0.1, 0.05),),
                       (('pergola', 0.0, 0.0),), (('line', 0.0, 0.05), ('jars', -0.15, -0.05))])


def house(ms, rng, x, y, w, d, yaw=None, two=None, **kw):
    two = rng.random() < 0.55 if two is None else two
    mat = kw.pop('mat', rng.choice(WALLS))
    if two:
        uw, ud = w * rng.uniform(0.5, 0.7), d * rng.uniform(0.55, 0.7)
        up = (rng.choice((-1, 1)) * (w - uw) / 2, (d - ud) / 2, uw, ud)
        tk.flat_house(ms, rng, x, y, w, d, yaw=yaw, storeys=2, upper=up, tiled=kw.pop('tiled', rng.random() < 0.3),
                      screen=kw.pop('screen', rng.random() < 0.6), roof_items=items(rng), mat=mat, **kw)
    else:
        tk.flat_house(ms, rng, x, y, w, d, yaw=yaw, roof_items=items(rng), mat=mat, **kw)


def ch(ms, rng, x, y, w, d, yaw, **kw):
    tk.court_house(ms, rng, x, y, w, d, yaw=yaw, mat=kw.pop('mat', rng.choice(WALLS)),
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
                house(ms, rng, x, y, w * rng.uniform(0.88, 1.0), d * rng.uniform(0.88, 1.0), yaw=yaw,
                         awning_w=0.3 if rng.random() < 0.15 else None, stair=rng.choice((None, None, None, 1, -1)))


def layout(ms, rng):
    tk.street(ms, [(-0.55, -0.75), (-0.55, -2.8)], 0.55, mat='kg_sand_square')
    tk.street(ms, [(0.7, 0.75), (1.0, 1.4), (1.0, 2.8)], 0.32, mat='kg_sand_square')
    tk.street(ms, [(-0.75, 0.0), (-1.2, -0.1), (-2.8, -0.2)], 0.32, mat='kg_sand_square')
    tk.street(ms, [(0.75, -0.2), (2.8, -0.35)], 0.3, mat='kg_sand_square')
    tk.mosque(ms, rng, -1.95, 2.2, w=0.95, d=0.8, h=0.5, dome_r=0.26, minaret_at=(0.6, 0.32), minaret_top=1.8,
              minaret_w=0.24, yaw=0, porch_bays=4, mat='kg_whitewash', side_domes=True)
    for x, y in ((-2.55, 1.15), (-2.05, 1.15), (-1.55, 1.15), (-2.4, 0.55), (-1.9, 0.55)):
        tk.market_stall(ms, rng, x, y, yaw=0, w=0.42, d=0.36)
    # the north and east quarters, packed
    cluster(ms, rng, -1.15, 1.7, 0.78, 2.85, 0)
    cluster(ms, rng, 1.22, 1.7, 2.85, 2.85, 0)
    cluster(ms, rng, 1.65, 0.0, 2.85, 1.45, -90)
    cluster(ms, rng, 1.65, -1.38, 2.85, -0.6, -90)
    # the market hall complex at the south-east: two arcaded halls, a court and an arcade wall
    tk.arcade_hall(ms, rng, 2.2, -2.05, 1.15, 1.2, yaw=0, bays=4, mat='kg_ochre', rise=0.32)
    tk.arcade_hall(ms, rng, 0.45, -2.1, 0.95, 0.8, yaw=0, bays=3, mat='kg_whitewash', rise=0.26)
    tk.stone_wall(ms, 0.95, -1.55, 1.6, -1.55, h=0.16, t=0.05, mat='kg_ochre')
    tc.cypress(ms, 1.25, -1.75, h=0.42, lod=1)
    tk.fountain(ms, tm.house_frame(0, 0, 0), 1.3, -2.25, r=0.09)
    # the south-west quarter, packed, and the west side between the market and the quarter
    cluster(ms, rng, -2.85, -2.85, -0.88, -0.48, 90)
    house(ms, rng, -2.6, 0.0, 0.55, 0.5, yaw=90, awning_w=0.28)
    tt.well(ms, 0.75, -1.05, yaw=20)
    for x, y in ((-2.85, 2.85), (1.0, 2.05), (1.0, 2.75), (-0.95, 1.45), (0.85, -0.95), (-0.55, -0.62), (1.45, 1.45),
                 (1.45, -1.25), (-1.4, 0.45), (-0.25, -2.85), (-0.85, -2.4), (2.85, -0.45), (-2.85, -0.2), (0.75, 1.4)):
        tk.palm(ms, rng, x + rng.uniform(-0.04, 0.04), y + rng.uniform(-0.04, 0.04), h=rng.uniform(0.45, 0.62), lod2=False)
    for x, y in ((-1.3, 2.85), (1.05, 0.95), (-1.1, -0.45), (1.4, 0.45)):
        tc.cypress(ms, x, y, h=rng.uniform(0.36, 0.46), lod=1)
    for x, y in ((0.4, 0.95), (-1.0, 0.65)):
        tk.tree(ms, x, y, h=rng.uniform(0.3, 0.36), r=rng.uniform(0.09, 0.11), lod2=False)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.2, 0.45), (1.25, 0.3), (-1.0, -1.15), (0.25, -1.35)):
        tt.clutter(ms, world, x, y, rng, 4)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
