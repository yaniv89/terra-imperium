# scripts/blender/build_town_kingdoms_medium_a.py
# Kingdoms Age `town-medium-a`, the European market town (plans/art/towns/kingdoms/
# town-medium-a/reference-sheet.png): a gothic stone church with an 18 m slate spire at the
# north-west, a big half-timbered hall (11 m) at the north-east, rows of half-timbered houses
# under slate and straw thatch round a cobbled market square, team-grey market stalls down the
# east side, a cobbled street leaving south and a lane north, gardens, fences and trees; the 12 m
# centre free. 60 m.
#
#   python scripts/blender/build_town_kingdoms_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

NAME = 'town-medium-a'
GROUND = dict(tk.COBBLED, rx=3.0, ry=3.0, square=0.62, n=80)


def layout(ms, rng):
    tk.street(ms, [(0.25, -0.64), (0.25, -2.8)], 0.7)
    tk.street(ms, [(0.15, 0.64), (0.15, 2.8)], 0.36)
    tk.cathedral(ms, rng, -1.85, 2.02, top=1.8, s=0.95, yaw=0, transept=True, tower_h=0.72)
    # the hall at the north-east: two jettied storeys, the gable to the square, a side wing
    tk.town_house(ms, rng, 2.0, 2.2, 1.1, 0.8, yaw=0, storeys=2, gable_front=False, chimneys=2, dormer=True, barrels=3, sign=True)
    tk.town_house(ms, rng, 1.2, 2.45, 0.5, 0.62, yaw=0, storeys=1, roof='slate', gable_front=True, chimneys=1)
    # the north row (the lane runs between them)
    tk.town_house(ms, rng, -0.75, 2.4, 0.66, 0.6, yaw=0, roof='thatch', chimneys=1, barrels=2)
    tk.town_house(ms, rng, -0.3, 1.85, 0.5, 0.5, yaw=0, roof='slate', gable_front=True, storeys=2)
    tk.town_house(ms, rng, 0.62, 2.35, 0.6, 0.6, yaw=0, roof='thatch', gable_front=True)
    # the west side
    for i, (y, roof, st, gf) in enumerate(((0.72, 'thatch', 1, False), (-0.1, 'slate', 1, True), (-0.95, 'slate', 2, False),
                                           (-1.95, 'slate', 2, True))):
        tk.town_house(ms, rng, -2.35, y, 0.86 if not gf else 0.62, 0.68, yaw=90, roof=roof, storeys=st, gable_front=gf,
                      chimneys=1 + (i % 2), barrels=2 if i == 2 else 0, awning_w=0.3 if i == 1 else None)
    tk.town_house(ms, rng, -1.55, 0.45, 0.55, 0.5, yaw=90, roof='thatch', gable_front=True)
    tk.town_house(ms, rng, -1.55, -0.6, 0.6, 0.52, yaw=90, roof='slate', storeys=2, jetty=True)
    # the south side, either side of the street
    tk.town_house(ms, rng, -1.25, -2.4, 0.8, 0.66, yaw=180, roof='slate', storeys=2, chimneys=2, sign=True)
    tk.town_house(ms, rng, -0.55, -2.35, 0.5, 0.6, yaw=180, roof='slate', gable_front=True)
    tk.town_house(ms, rng, -0.75, -1.7, 0.42, 0.42, yaw=180, roof='thatch', gable_front=True)
    tk.town_house(ms, rng, 1.05, -2.4, 0.66, 0.64, yaw=180, roof='slate', gable_front=True, storeys=2)
    tk.town_house(ms, rng, 1.85, -2.35, 0.7, 0.66, yaw=180, roof='slate', chimneys=1, barrels=2)
    # the east side: houses behind a row of market stalls
    for i, (y, roof, gf) in enumerate(((1.15, 'slate', True), (0.25, 'thatch', False), (-0.65, 'slate', True), (-1.5, 'slate', False))):
        tk.town_house(ms, rng, 2.4, y, 0.62 if gf else 0.82, 0.66, yaw=-90, roof=roof, gable_front=gf, storeys=2 if i % 2 == 0 else 1,
                      chimneys=1)
    for y in (1.0, 0.45, -0.1, -0.65):
        tk.market_stall(ms, rng, 1.62, y, yaw=-90, w=0.42, d=0.34)
    tt.well(ms, -0.95, -0.95, yaw=10)
    # gardens, fences and trees round the edges
    tk.garden(ms, rng, -2.65, -1.4, 0.4, 0.3, yaw=90)
    tk.garden(ms, rng, 2.7, -0.2, 0.36, 0.3, yaw=90)
    tk.garden(ms, rng, -2.6, 2.6, 0.3, 0.26, yaw=90)
    tk.wattle_fence(ms, [(-2.9, -2.9), (-1.7, -2.9)], h=0.08, step=0.25, lod=0)
    tk.wattle_fence(ms, [(0.65, -2.9), (2.9, -2.9), (2.9, -2.0)], h=0.08, step=0.25, lod=0)
    tk.wattle_fence(ms, [(2.9, 0.65), (2.9, 1.7)], h=0.08, step=0.25, lod=0)
    for x, y in ((-2.85, 2.8), (-2.85, 1.25), (-1.35, 2.85), (1.45, 1.75), (2.85, 2.85), (2.85, -1.0), (-2.85, -0.45),
                 (-2.0, -2.85), (2.6, -2.85), (-0.25, -2.85), (0.75, 1.75), (-1.15, 1.1)):
        tk.tree(ms, x + rng.uniform(-0.05, 0.05), y + rng.uniform(-0.05, 0.05), h=rng.uniform(0.38, 0.5), r=rng.uniform(0.13, 0.17),
                lod2=False)
    for x, y in ((-2.9, 2.0), (2.85, 2.0), (-0.95, 2.85)):
        tk.conifer(ms, x, y, h=rng.uniform(0.45, 0.55), lod2=False)
    for x, y in ((-1.1, -1.3), (0.75, -1.25), (-1.15, 0.85), (1.05, 1.25), (-0.4, 1.25)):
        tc_shrub(ms, x, y, rng)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-1.8, 1.2), (1.95, 1.65), (-1.8, -1.35), (1.7, -1.9)):
        tt.clutter(ms, world, x, y, rng, 4)
    tt.woodpile(ms, world, -2.7, 0.45, 90)
    tt.woodpile(ms, world, 2.75, 0.75, 90)


def tc_shrub(ms, x, y, rng):
    import ti_classical as tc
    tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07), lod=0)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
