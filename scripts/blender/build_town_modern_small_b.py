# scripts/blender/build_town_modern_small_b.py
# Modern Age `town-small-b` (plans/art/towns/modern/town-small-b/reference-sheet.png): an asphalt
# square open to the south round a paved plaza (the 12 m free centre); two rendered blocks on the
# north, a glazed steel canopy (a bus and market shelter) with a concrete clock tower at the
# north-east, a gabled brick house and a rendered block down each side, hedged lawns and trees.
# 40 m.
#
#   python scripts/blender/build_town_modern_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-small-b'
GROUND = dict(md.TOWN_GROUND, rx=2.0, ry=2.0, square=None)


def layout(ms, rng):
    md.flat(ms, 'md_asphalt', md.rounded(0, -0.56, 2.0, 2.78, 0.36), md.Z_ROAD)
    md.rect(ms, 'md_pave_square', -0.6, -0.6, 0.6, 0.6, md.G + 0.004)
    for k in range(10):  # parking bays along the plaza's east and west
        for sx in (-1, 1):
            md.rect(ms, 'md_marking', sx * 0.94 - 0.004, -1.55 + 0.2 * k, sx * 0.94 + 0.004, -1.55 + 0.2 * k + 0.13, md.Z_MARK, lod=0)
    md.zebra(ms, 0, -0.78, 0.6)
    # the north
    md.block(ms, rng, -1.37, 1.36, 0.56, 0.8, storeys=2, yaw=0, units=2)
    md.block(ms, rng, -0.39, 1.4, 0.76, 0.8, storeys=2, yaw=0, units=3, balcony=True)
    md.canopy(ms, 0.98, 1.42, 0.9, 0.44, h=0.3)
    md.clock_tower(ms, 1.62, 1.46, h=1.1)
    for x in (0.75, 1.15):
        md.bench(ms, x, 1.33)
    # the west and east sides
    md.house(ms, rng, -1.55, -0.05, 1.0, 0.56, yaw=90)
    md.block(ms, rng, -1.5, -1.15, 0.76, 0.58, storeys=2, yaw=90, units=2)
    md.house(ms, rng, 1.57, 0.25, 1.0, 0.56, yaw=-90)
    md.block(ms, rng, 1.53, -1.12, 0.8, 0.58, storeys=2, yaw=-90, units=2, balcony=True)
    # lawns, hedges, trees
    md.lawn(ms, -1.95, -1.95, -1.15, -1.55, hedges=('n',))
    md.lawn(ms, 1.15, -1.95, 1.95, -1.6, hedges=('n',))
    md.lawn(ms, -1.95, 0.5, -1.2, 0.85, hedges=('s',))
    md.lawn(ms, 1.2, 0.8, 1.95, 1.1, hedges=('n', 's'))
    md.lawn(ms, -1.95, -0.65, -1.88, 0.5)
    md.lawn(ms, 1.88, -0.8, 1.95, 0.8)
    for (x0, y0, x1, y1) in ((-1.15, -1.5, -1.15, -0.7), (-1.15, -0.55, -1.15, 0.45), (1.18, -1.5, 1.18, -0.65), (1.18, -0.3, 1.18, 0.75),
                             (-1.7, 0.95, -1.05, 0.95), (-0.8, 0.95, 0.05, 0.95)):
        md.hedge(ms, x0, y0, x1, y1, h=0.05, t=0.035)
    for x, y, h, big in ((-1.6, 0.68, 0.58, True), (-0.95, 0.78, 0.5, False), (1.75, 0.95, 0.55, True), (1.4, -0.55, 0.5, False),
                         (1.6, -1.78, 0.55, True), (-1.55, -1.78, 0.58, True), (0.3, 1.0, 0.45, False), (-1.85, 1.85, 0.5, False),
                         (-0.55, -1.85, 0.42, False)):
        md.tree(ms, x, y, h=h, r=0.16 if big else 0.13, lod2=big, rng=rng)
    for x, y in ((-0.66, 0.66), (0.66, 0.66), (-0.66, -0.66), (0.66, -0.66)):
        md.lamp(ms, x, y)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
