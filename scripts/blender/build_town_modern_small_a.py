# scripts/blender/build_town_modern_small_a.py
# Modern Age `town-small-a` (plans/art/towns/modern/town-small-a/reference-sheet.png): a street
# runs north to south and opens round a paved square (the 12 m free centre); three houses down
# the west side (rendered, brick with a hip roof, rendered), three on the east (a brick gabled
# house at the north-east, two rendered), a 12 m steel water tower at the north-west, lawns and
# trees at the south corners, hedged plots. 40 m.
#
#   python scripts/blender/build_town_modern_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-small-a'
GROUND = dict(md.TOWN_GROUND, rx=2.0, ry=2.0, square=None)


def layout(ms, rng):
    # the street and the square
    md.flat(ms, 'md_asphalt', md.rounded(0, 0, 1.9, 2.25, 0.45), md.Z_ROAD)
    md.road(ms, 0, 1.1, 0, 1.94, 0.82)
    md.road(ms, 0, -1.1, 0, -1.94, 0.82)
    md.rect(ms, 'md_pave_square', -0.6, -0.6, 0.6, 0.6, md.G + 0.004)
    md.zebra(ms, 0, 0.82, 0.7)
    md.zebra(ms, 0, -0.82, 0.7)
    # the west side
    md.water_tower(ms, -1.38, 1.6, top=1.2, r=0.15, tank_h=0.24)
    md.block(ms, rng, -1.42, 0.98, 0.72, 0.66, storeys=2, units=2)
    md.house(ms, rng, -1.42, 0.05, 0.72, 0.66, roof='hip', rise=0.28)
    md.block(ms, rng, -1.42, -0.88, 0.72, 0.66, storeys=2, units=1, balcony=True)
    # the east side
    md.house(ms, rng, 1.36, 1.2, 0.78, 0.7, roof='gable')
    md.block(ms, rng, 1.4, 0.12, 0.7, 0.66, storeys=2, units=2, stair=False)
    md.block(ms, rng, 1.36, -0.86, 0.7, 0.66, storeys=2, units=1)
    # lawns and hedges round the plots, the corner greens
    md.lawn(ms, -1.82, -1.3, -1.06, 1.4)
    md.lawn(ms, 1.02, -1.3, 1.84, 1.62)
    md.lawn(ms, -1.96, -1.96, -0.52, -1.32, hedges=('n',))
    md.lawn(ms, 0.52, -1.96, 1.96, -1.32, hedges=('n',))
    md.lawn(ms, -1.96, -1.3, -1.82, 1.4, hedges=('e',))
    md.lawn(ms, 1.84, -1.3, 1.96, 0.75, hedges=('w',))
    md.lawn(ms, -1.2, 1.55, -0.55, 1.95, hedges=('s', 'e'))
    md.lawn(ms, 0.55, 1.65, 0.85, 1.95, hedges=('w',))
    for (x0, y0, x1, y1) in ((-1.05, 0.55, -1.05, 1.35), (-1.05, -0.4, -1.05, 0.45), (1.0, -0.4, 1.0, 0.45), (1.0, -1.25, 1.0, -0.5)):
        md.hedge(ms, x0, y0, x1, y1, h=0.05, t=0.035)
    for x, y, h, big in ((-1.55, -1.6, 0.62, True), (1.6, -1.62, 0.6, True), (-0.78, -1.7, 0.5, False), (0.86, -1.72, 0.5, False),
                         (1.8, 0.62, 0.55, True), (-1.8, -0.35, 0.5, False), (-0.85, 1.75, 0.5, False), (1.75, 1.75, 0.48, False),
                         (-1.82, 0.5, 0.45, False)):
        md.tree(ms, x, y, h=h, r=0.16 if big else 0.13, lod2=big, rng=rng)
    for x, y in ((-0.66, 0.66), (0.66, 0.66), (-0.66, -0.66), (0.66, -0.66)):
        md.lamp(ms, x, y)
    md.bench(ms, -0.5, 0.0, yaw=90)
    md.bench(ms, 0.5, 0.0, yaw=-90)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
