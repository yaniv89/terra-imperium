# scripts/blender/build_town_modern_big_b.py
# Modern Age `town-big-b`, the industrial city (plans/art/towns/modern/town-big-b/
# reference-sheet.png): a stepped 42 m glass and concrete skyscraper at the north-east, an 18 m
# water tower in a round park at the north-west, a brick works with a sawtooth roof and a 16 m
# chimney at the south-west, a covered market of glazed canopies with team-grey stalls along
# the plaza's west side, a glazed bus shelter at the south-east, quarters of two- to four-storey
# blocks of render and brick (and slate-roofed houses) round an asphalt ring and a paved plaza
# (the 12 m free centre), streets out to the south. 80 m.
#
#   python scripts/blender/build_town_modern_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-big-b'
GROUND = dict(md.TOWN_GROUND, rx=4.0, ry=4.0, square=None, n=72)
R, B = 'md_render_win', 'md_brick_win'
md.FOOT[0] = 1.35  # the sheets' blocks are deeper than a house
md.LAWN[0] = 0.06


def layout(ms, rng):
    G = md.G
    md.flat(ms, 'md_asphalt', md.rounded(0, -0.05, 2.3, 2.7, 0.35), md.Z_ROAD)
    md.rect(ms, 'md_pave_square', -0.72, -0.85, 0.72, 0.8, G + 0.004)
    md.road(ms, -0.95, -1.35, -0.95, -3.4, 0.4, dashes=False)
    md.road(ms, 1.0, -1.35, 1.0, -3.4, 0.4, dashes=False)
    md.road(ms, -3.7, -3.55, 3.6, -3.55, 0.36)
    for y in (-0.55, 0.0, 0.55):  # parking bays on the ring's east side
        md.rect(ms, 'md_marking', 0.88, y - 0.004, 1.12, y + 0.004, md.Z_MARK, lod=0)
    md.zebra(ms, 0, -1.48, 0.5, n=5)
    # the covered market along the plaza's west
    for y in (0.95, 0.3, -0.35, -1.0):
        md.canopy(ms, -1.48, y, 0.6, 0.3, h=0.26, yaw=90, glass_walls=False)
        for k in (-0.15, 0.15):
            md.market_tent(ms, rng, -1.48, y + k, s=0.22, h=0.17, yaw=90)
    # the north-west park and the water tower
    md.flat(ms, 'md_lawn', md.rounded(-2.35, 2.35, 1.3, 1.3, 0.6, seg=6), md.Z_LAWN)
    md.water_tower(ms, -2.35, 2.45, top=1.8, r=0.2, tank_h=0.3)
    for x, y in ((-2.85, 1.95), (-1.85, 1.95), (-2.9, 2.85), (-1.85, 2.9)):
        md.tree(ms, x, y, h=0.58, r=0.15, lod2=True, rng=rng)
    md.bench(ms, -2.35, 1.85)
    # the skyscraper at the north-east
    md.glass_tower(ms, 2.35, 1.95, [(0.9, 0.82, 1.6, 0, 0), (0.66, 0.6, 1.4, 0.08, 0.06), (0.42, 0.4, 1.08, 0.12, 0.08)],
                   podium=None)
    # the north
    md.block(ms, rng, -1.32, 3.1, 0.6, 0.6, storeys=3, wall=B, yaw=0, roof='hip', rise=0.22)
    md.block(ms, rng, -1.32, 2.25, 0.6, 0.6, storeys=2, wall=R, yaw=0, units=2)
    md.block(ms, rng, -0.48, 3.15, 0.62, 0.6, storeys=3, wall=R, yaw=0, units=2)
    md.block(ms, rng, -0.48, 2.2, 0.62, 0.62, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    md.block(ms, rng, 0.38, 3.15, 0.62, 0.6, storeys=4, wall=B, yaw=0, units=2)
    md.block(ms, rng, 0.38, 2.2, 0.62, 0.62, storeys=3, wall=R, yaw=180, balcony=True)
    md.block(ms, rng, 1.2, 3.05, 0.55, 0.55, storeys=2, wall=R, yaw=0, units=1)
    md.block(ms, rng, 1.22, 2.2, 0.55, 0.62, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    # the west
    md.block(ms, rng, -2.6, 1.15, 0.6, 0.6, storeys=2, wall=R, yaw=-90, units=2)
    md.block(ms, rng, -3.4, 1.0, 0.5, 0.55, storeys=2, wall=B, yaw=-90, units=1)
    md.block(ms, rng, -2.6, 0.3, 0.6, 0.6, storeys=2, wall=R, yaw=-90, roof='gable', rise=0.24)
    md.block(ms, rng, -3.4, 0.25, 0.55, 0.6, storeys=3, wall=R, yaw=-90, units=2)
    md.block(ms, rng, -2.6, -0.6, 0.62, 0.62, storeys=3, wall=R, yaw=-90, shop=True, awning=True)
    md.block(ms, rng, -3.4, -0.55, 0.55, 0.6, storeys=2, wall=B, yaw=-90, units=2)
    # the south-west: the works
    md.factory(ms, -2.35, -2.3, 1.3, 1.05, teeth=5, chimney=(-3.15, -1.5, 1.6))
    md.block(ms, rng, -1.55, -1.75, 0.45, 0.5, storeys=2, wall=B, yaw=90, units=1)
    # the east
    md.block(ms, rng, 1.8, 0.7, 0.6, 0.6, storeys=3, wall=R, yaw=90, units=2)
    md.block(ms, rng, 2.65, 0.75, 0.6, 0.6, storeys=3, wall=B, yaw=90, roof='hip', rise=0.24)
    md.block(ms, rng, 3.45, 0.6, 0.5, 0.55, storeys=2, wall=R, yaw=-90, units=1)
    md.block(ms, rng, 1.8, -0.3, 0.62, 0.6, storeys=2, wall=R, yaw=90, roof='gable', rise=0.24)
    md.block(ms, rng, 2.65, -0.3, 0.6, 0.6, storeys=4, wall=R, yaw=90, units=2, balcony=True)
    md.block(ms, rng, 3.45, -0.35, 0.5, 0.55, storeys=2, wall=B, yaw=-90, units=1)
    md.block(ms, rng, 1.8, -1.3, 0.6, 0.6, storeys=3, wall=B, yaw=90, units=2)
    md.block(ms, rng, 2.65, -1.3, 0.6, 0.6, storeys=2, wall=R, yaw=90, shop=True, awning=True)
    # the south
    md.block(ms, rng, 0.02, -1.9, 0.9, 0.6, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    md.block(ms, rng, 0.02, -2.75, 0.9, 0.6, storeys=2, wall=B, yaw=0, units=2)
    md.block(ms, rng, 1.85, -2.25, 0.6, 0.6, storeys=3, wall=B, yaw=-90, units=2)
    md.block(ms, rng, 2.65, -2.25, 0.6, 0.6, storeys=2, wall=R, yaw=90, units=1)
    md.block(ms, rng, 3.3, -1.95, 0.45, 0.5, storeys=2, wall=R, yaw=90, roof='gable', rise=0.2)
    md.canopy(ms, 2.3, -3.28, 0.8, 0.24, h=0.24)
    # greens and street trees
    md.lawn(ms, -0.6, -3.3, 0.6, -3.15)
    md.lawn(ms, 1.45, -2.95, 3.0, -2.8, hedges=('n',))
    trees = [(-0.9, 2.65), (-0.05, 2.65), (0.8, 2.65), (1.6, 2.65), (-0.9, 1.7), (-0.05, 1.7), (0.8, 1.7), (-3.0, 0.7),
             (-3.0, -0.15), (-2.2, -1.1), (-3.3, -1.15), (-1.3, -2.6), (-1.3, -3.2), (-0.55, -2.35), (0.55, -2.35),
             (1.4, -1.8), (1.4, -2.8), (2.25, -1.75), (3.25, -1.0), (3.1, 0.15), (2.25, 0.2), (2.25, 1.2), (3.3, 1.2),
             (-2.2, 0.75), (-2.2, -0.15), (0.45, -3.15), (-0.45, -3.2), (3.3, -2.7), (1.65, 1.6), (-1.75, 3.1)]
    for i, (x, y) in enumerate(trees):
        md.tree(ms, x, y, h=rng.uniform(0.5, 0.62), r=rng.uniform(0.13, 0.16), lod2=i % 4 == 0, rng=rng)
    for x, y in ((-0.8, 0.88), (0.8, 0.88), (-0.8, -0.93), (0.8, -0.93)):
        md.lamp(ms, x, y)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
