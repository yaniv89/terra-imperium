# scripts/blender/build_town_modern_medium_b.py
# Modern Age `town-medium-b`, the works town (plans/art/towns/modern/town-medium-b/
# reference-sheet.png): an 18 m steel water tower in a round green at the north-east, a red-brick
# works with a sawtooth roof and a tall chimney at the south-west, a row of team-grey market
# tents down the west, a strip of lawn with trees and benches along the north, twelve blocks of
# render and brick (and slate-gabled houses) round an asphalt ring and a paved plaza (the 12 m
# free centre), a street out to the south-east. 60 m.
#
#   python scripts/blender/build_town_modern_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-medium-b'
GROUND = dict(md.TOWN_GROUND, rx=3.0, ry=3.0, square=None)
R, B = 'md_render_win', 'md_brick_win'


def layout(ms, rng):
    G = md.G
    md.flat(ms, 'md_asphalt', md.rounded(0, -0.05, 1.9, 2.0, 0.32), md.Z_ROAD)
    md.rect(ms, 'md_pave_square', -0.62, -0.68, 0.62, 0.6, G + 0.004)
    md.road(ms, 0.45, -1.0, 0.45, -2.55, 0.4, dashes=False)
    md.flat(ms, 'md_asphalt', md.rounded(1.4, -2.7, 2.3, 0.42, 0.2), md.Z_ROAD)
    md.road(ms, 0.6, -2.7, 2.45, -2.7, 0.42, lod=0)
    # the north lawn and the water tower's green
    md.lawn(ms, -1.75, 2.42, 1.55, 2.88, hedges=('s',))
    md.flat(ms, 'md_lawn', md.rounded(2.05, 2.05, 0.92, 0.92, 0.42, seg=5), md.Z_LAWN)
    md.water_tower(ms, 2.05, 2.05, top=1.8, r=0.2, tank_h=0.3)
    for x in (-0.9, 0.0, 0.9):
        md.bench(ms, x, 2.55)
    for x in (-1.5, -0.45, 0.45, 1.3):
        md.tree(ms, x, 2.7, h=0.58, r=0.15, lod2=True, rng=rng)
    # the north row
    md.block(ms, rng, -2.15, 2.0, 0.72, 0.9, storeys=3, wall=R, yaw=0, units=2)
    md.block(ms, rng, -1.15, 1.85, 0.62, 0.8, storeys=3, wall=R, yaw=0, units=2)
    md.block(ms, rng, -0.5, 1.85, 0.62, 0.8, storeys=3, wall=R, yaw=0, units=3, balcony=True)
    md.block(ms, rng, 0.42, 1.75, 0.66, 0.9, storeys=3, wall=B, yaw=0, units=2)
    md.block(ms, rng, 1.25, 1.7, 0.52, 0.85, storeys=2, wall=R, yaw=0, roof='gable', rise=0.24)
    md.block(ms, rng, 2.5, 1.0, 0.55, 0.52, storeys=2, wall=R, yaw=-90, roof='gable', rise=0.22)
    # the market down the west
    for y in (1.2, 0.75, 0.3, -0.15, -0.6, -1.05):
        md.market_tent(ms, rng, -2.62, y, s=0.32, yaw=90)
    md.block(ms, rng, -1.62, 0.55, 0.85, 0.8, storeys=3, wall=R, yaw=90, units=2)
    md.block(ms, rng, -1.62, -0.6, 0.85, 0.8, storeys=3, wall=R, yaw=90, shop=True, awning=True)
    # the east
    md.block(ms, rng, 1.6, 0.35, 0.8, 0.7, storeys=3, wall=R, yaw=-90, units=2)
    md.block(ms, rng, 2.5, 0.12, 0.85, 0.52, storeys=2, wall=R, yaw=-90, roof='gable', rise=0.24)
    md.block(ms, rng, 1.6, -1.15, 1.05, 0.7, storeys=3, wall=B, yaw=-90, units=2)
    md.block(ms, rng, 2.5, -1.4, 0.95, 0.52, storeys=3, wall=R, yaw=-90, units=1, balcony=True)
    md.block(ms, rng, 0.95, -1.95, 0.55, 0.62, storeys=2, wall=R, yaw=90, units=1)
    # the south: the works and a block
    md.factory(ms, -2.05, -2.05, 1.0, 1.0, teeth=4, chimney=(-2.72, -1.45, 1.45))
    md.block(ms, rng, -0.8, -2.0, 1.05, 0.85, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    # lawns, hedges, trees
    md.lawn(ms, -2.95, -1.45, -2.4, -1.25)
    md.lawn(ms, 2.1, -2.35, 2.9, -2.0, hedges=('n',))
    for (x0, y0, x1, y1) in ((-1.15, -0.2, -1.15, 1.0), (1.15, -0.8, 1.15, 0.8), (-2.25, -1.4, -1.25, -1.4), (0.75, -1.5, 2.0, -1.5)):
        md.hedge(ms, x0, y0, x1, y1, h=0.05, t=0.035)
    trees = [(-1.12, -1.2), (-2.25, 1.35), (-2.2, -1.1), (1.12, 1.15), (2.15, -0.55), (2.85, -2.1), (-0.3, -2.75), (1.4, -2.15),
             (2.75, 1.5), (-2.9, 1.65), (0.95, -0.95), (-1.15, 1.25)]
    for i, (x, y) in enumerate(trees):
        md.tree(ms, x, y, h=rng.uniform(0.5, 0.6), r=rng.uniform(0.13, 0.16), lod2=i % 3 == 0, rng=rng)
    for x, y in ((-0.7, 0.68), (0.7, 0.68), (-0.7, -0.78), (0.7, -0.78)):
        md.lamp(ms, x, y)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
