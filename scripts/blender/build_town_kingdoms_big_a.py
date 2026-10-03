# scripts/blender/build_town_kingdoms_big_a.py
# Kingdoms Age `town-big-a`, the European walled city quarter (plans/art/towns/kingdoms/
# town-big-a/reference-sheet.png): a gothic church with transept, aisles and a 28 m spire at the
# north-west, a 20 m crenellated stone keep at the north-east, round corner towers with slate
# cones at the south-west and south-east, some fifty half-timbered houses under slate and straw
# thatch packed along cobbled streets (south, north, east and west) round an octagonal market
# square, team-grey market stalls on its east side and by the south-east tower, gardens, fences
# and trees in the back plots; the 14 m centre free. 80 m.
#
#   python scripts/blender/build_town_kingdoms_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

NAME = 'town-big-a'
GROUND = dict(tk.COBBLED, rx=4.0, ry=4.0, square=0.7, n=72)


def h(ms, rng, x, y, yaw, w=None, d=None, **kw):
    """One house with its look rolled: size, slate or thatch, one or two storeys, gable or eaves to
    the street."""
    w = w or rng.uniform(0.56, 0.82)
    d = d or rng.uniform(0.56, 0.7)
    roof = kw.pop('roof', 'thatch' if rng.random() < 0.28 else 'slate')
    st = kw.pop('storeys', 2 if rng.random() < 0.55 else 1)
    gf = kw.pop('gable_front', rng.random() < 0.45 and w < 0.72)
    tk.town_house(ms, rng, x, y, w, d, yaw=yaw, roof=roof, storeys=st, gable_front=gf,
                  chimneys=kw.pop('chimneys', rng.choice((1, 1, 2))), barrels=kw.pop('barrels', rng.choice((0, 0, 2))),
                  lod1_frame=False, **kw)


def row(ms, rng, x0, y0, x1, y1, n, yaw, **kw):
    for i in range(n):
        t = (i + 0.5) / n
        h(ms, rng, x0 + (x1 - x0) * t + rng.uniform(-0.03, 0.03), y0 + (y1 - y0) * t + rng.uniform(-0.03, 0.03), yaw, **kw)


def layout(ms, rng):
    # streets: south and north from the square, east and west, and a ring of lanes
    tk.street(ms, [(0.15, -1.0), (0.2, -2.4), (0.05, -3.72)], 0.75)
    tk.street(ms, [(0.0, 1.0), (-0.1, 2.2), (0.05, 3.72)], 0.5)
    tk.street(ms, [(-1.1, 0.3), (-2.4, 0.55), (-3.72, 0.6)], 0.42)
    tk.street(ms, [(1.1, 0.4), (2.4, 0.9), (3.72, 0.85)], 0.42)
    tk.street(ms, [(-2.38, 0.3), (-2.2, -1.9), (-0.9, -2.6)], 0.26)
    tk.street(ms, [(2.4, 0.66), (2.35, -1.6), (1.0, -2.5)], 0.26)
    # landmarks
    tk.cathedral(ms, rng, -2.25, 3.0, top=2.8, s=1.3, yaw=-90, transept=True)
    tk.keep_tower(ms, rng, 3.0, 3.05, w=1.0, d=1.0, h=2.0, yaw=180, flag=True)
    tk.round_tower(ms, -3.45, -3.45, 0.36, 0.9, roof=0.52, face=-135)
    tk.round_tower(ms, 3.45, -3.45, 0.36, 0.9, roof=0.52, face=-45)
    # the north-west quarter (south of the church)
    row(ms, rng, -3.45, 1.95, -0.85, 1.95, 4, 180)
    h(ms, rng, -1.2, 2.85, -90, w=0.62, d=0.7)
    row(ms, rng, -3.55, 1.25, -2.65, 1.25, 1, 0)
    h(ms, rng, -1.85, 1.25, 0, w=0.7)
    # the north middle, either side of the north street
    h(ms, rng, -0.65, 3.45, 90, w=0.66)
    h(ms, rng, -0.7, 2.6, 90, w=0.6)
    h(ms, rng, 0.75, 3.45, -90, w=0.7)
    h(ms, rng, 0.8, 2.6, -90, w=0.62)
    h(ms, rng, 1.65, 3.45, 180, w=0.66, d=0.7)
    h(ms, rng, 1.65, 2.55, 0, w=0.7)
    # the north-east quarter (south of the keep)
    row(ms, rng, 2.15, 1.7, 3.6, 1.7, 2, 0)
    h(ms, rng, 0.85, 1.9, 0, w=0.62)
    # the west quarter: north and south of the west street
    row(ms, rng, -3.55, -0.2, -1.95, -0.2, 2, 0)
    h(ms, rng, -3.5, -1.05, 90, w=0.7)
    h(ms, rng, -1.75, -0.6, 90, w=0.56)
    # the south-west quarter
    h(ms, rng, -2.75, -2.15, 0, w=1.0, d=0.8, storeys=2, roof='slate', gable_front=False, dormer=True, sign=True)
    row(ms, rng, -1.65, -1.95, -0.55, -1.95, 2, 0)
    row(ms, rng, -2.6, -3.5, -0.7, -3.5, 3, 0)
    h(ms, rng, -0.55, -2.85, -90, w=0.6)
    # the south-east quarter and the east side
    row(ms, rng, 0.85, -3.5, 2.85, -3.5, 3, 0)
    row(ms, rng, 0.95, -2.0, 1.85, -2.0, 2, 0)
    h(ms, rng, 0.8, -2.8, 90, w=0.6)
    h(ms, rng, 3.45, -1.3, -90, w=0.72)
    h(ms, rng, 3.45, -0.35, -90, w=0.72)
    h(ms, rng, 3.5, -2.35, -90, w=0.66)
    h(ms, rng, 2.6, -0.1, -90, w=0.56)
    h(ms, rng, 2.75, -1.75, -90, w=0.52)
    # market stalls down the square's east side and by the south-east tower
    for y in (0.95, 0.4, -0.15, -0.7):
        tk.market_stall(ms, rng, 1.75, y, yaw=-90, w=0.44, d=0.34)
    for x in (2.2, 2.7):
        tk.market_stall(ms, rng, x, -2.75, yaw=180, w=0.44, d=0.34)
    tt.well(ms, -0.9, -0.9, yaw=10)
    # in-fill: the sheet's city is packed
    h(ms, rng, 0.95, 1.25, 180, w=0.56, d=0.5)
    h(ms, rng, 0.98, -1.1, -90, w=0.56, d=0.5)
    h(ms, rng, -1.8, -1.12, 90, w=0.5, d=0.5)
    h(ms, rng, 2.05, 2.1, 0, w=0.48, d=0.5, storeys=1)
    h(ms, rng, -0.75, 1.45, 90, w=0.5, d=0.5)
    h(ms, rng, 3.5, -3.0, -90, w=0.5, d=0.55, storeys=1)
    # gardens, fences and trees in the back plots
    for x, y, yaw in ((-3.2, 2.6, 0), (-1.95, -1.2, 90), (2.95, 2.45, 0), (-3.55, -2.75, 90), (1.95, -1.05, 90), (3.6, 0.15, 90)):
        tk.garden(ms, rng, x, y, 0.42, 0.3, yaw=yaw)
    tk.wattle_fence(ms, [(-3.9, -3.0), (-3.9, -1.6)], h=0.08, step=0.3, lod=0)
    tk.wattle_fence(ms, [(3.9, -3.0), (3.9, -1.9)], h=0.08, step=0.3, lod=0)
    tk.wattle_fence(ms, [(-1.6, -3.9), (-0.6, -3.9)], h=0.08, step=0.3, lod=0)
    for x, y in ((-3.85, 3.85), (-3.85, 2.6), (-0.6, 1.25), (1.0, 1.15), (2.05, 3.6), (3.85, 2.2), (3.85, -0.9), (-3.85, -0.5),
                 (-1.15, -2.4), (1.5, -2.6), (-3.0, -2.95), (3.0, -2.9), (-1.6, 3.85), (2.3, 2.3), (-2.95, -1.4), (0.6, -3.85),
                 (-1.6, -3.85), (3.85, 3.85), (-3.2, 1.6), (-0.55, 3.0), (1.25, 2.9), (2.2, 1.5), (-2.75, -0.55),
                 (-1.25, -3.0), (1.45, -3.0), (3.1, -2.4), (-3.85, -3.0), (2.85, 0.35)):
        tk.tree(ms, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05), h=rng.uniform(0.4, 0.52), r=rng.uniform(0.13, 0.18),
                lod2=False)
    for x, y in ((-3.85, 1.45), (3.85, 1.4), (-2.2, 3.85)):
        tk.conifer(ms, x, y, h=rng.uniform(0.5, 0.6), lod2=False)
    for x, y in ((-1.25, -1.05), (1.15, -1.1), (-1.15, 0.95), (-0.5, -1.35), (0.75, 1.35)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07), lod=0)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-2.0, 1.2), (2.0, 1.25), (-1.95, -2.65), (2.4, -2.3), (-0.6, -1.6), (3.0, 0.4)):
        tt.clutter(ms, world, x, y, rng, 4)
    for x, y, yaw in ((-3.7, 0.15, 90), (3.7, 1.45, 90), (-0.3, -3.6, 0)):
        tt.woodpile(ms, world, x, y, yaw)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
