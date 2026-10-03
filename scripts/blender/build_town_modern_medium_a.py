# scripts/blender/build_town_modern_medium_a.py
# Modern Age `town-medium-a`, the market town with the station
# (plans/art/towns/modern/town-medium-a/reference-sheet.png): a 20 m glass office tower on a
# rendered podium at the north-west, a railway station with a glazed canopy and two tracks along
# the north-east, three- and two-storey blocks of render and red brick (some with slate hip
# roofs) round a paved plaza (the 12 m free centre), a row of team-grey market tents on its east,
# a street running south, a small park with benches at the south-west. 60 m.
#
#   python scripts/blender/build_town_modern_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-medium-a'
GROUND = dict(md.TOWN_GROUND, rx=3.0, ry=3.0, square=None)
R, B = 'md_render_win', 'md_brick_win'
md.FOOT[0] = 1.25  # the sheets' blocks are deeper than a house
md.LAWN[0] = 0.06


def layout(ms, rng):
    G = md.G
    md.rect(ms, 'md_pave_square', -0.65, -0.72, 0.65, 0.72, G + 0.004)
    md.road(ms, 0, -0.78, 0, -2.6, 0.78)
    md.flat(ms, 'md_asphalt', md.rounded(0.9, -2.72, 1.8, 0.5, 0.2), md.Z_ROAD)
    md.road(ms, 0.4, -2.72, 2.4, -2.72, 0.42, lod=0)
    md.zebra(ms, 0, -0.95, 0.66)
    # the tower and the north-west blocks
    md.glass_tower(ms, -2.2, 1.9, [(0.56, 0.56, 1.8, 0, 0)], podium=(0.8, 0.8, 0.17))
    md.block(ms, rng, -1.3, 2.4, 0.62, 0.66, storeys=3, wall=R, yaw=0, units=2)
    md.block(ms, rng, -0.58, 2.42, 0.6, 0.62, storeys=2, wall=B, yaw=0, units=2)
    md.block(ms, rng, -1.32, 1.5, 0.6, 0.62, storeys=2, wall=R, yaw=0, balcony=True)
    md.block(ms, rng, -0.55, 1.42, 0.62, 0.78, storeys=3, wall=B, yaw=0, roof='hip', rise=0.22)
    md.block(ms, rng, 0.15, 1.42, 0.5, 0.72, storeys=2, wall=R, yaw=0, shop=True, awning=True)
    md.block(ms, rng, 0.72, 1.42, 0.5, 0.72, storeys=2, wall=B, yaw=0, units=1)
    md.block(ms, rng, 1.5, 1.45, 0.62, 0.62, storeys=3, wall=R, yaw=0, units=2, balcony=True)
    md.block(ms, rng, 2.35, 1.5, 0.6, 0.6, storeys=2, wall=R, yaw=0, units=2)
    # the station along the north-east
    md.station(ms, 1.25, 2.38, length=1.8, width=0.42, track_len=2.1)
    # the west
    md.block(ms, rng, -2.45, 0.6, 0.78, 0.68, storeys=2, wall=R, yaw=90, units=2)
    md.block(ms, rng, -2.45, -0.35, 0.78, 0.68, storeys=3, wall=B, yaw=90, units=1)
    md.block(ms, rng, -2.45, -1.25, 0.72, 0.68, storeys=2, wall=R, yaw=90, balcony=True)
    md.block(ms, rng, -1.4, 0.35, 0.86, 0.62, storeys=2, wall=B, yaw=90, roof='hip', rise=0.24)
    md.block(ms, rng, -1.4, -0.75, 0.86, 0.62, storeys=3, wall=R, yaw=90, shop=True, awning=True)
    # the market on the east of the plaza
    for y in (0.6, 0.28, -0.04, -0.36, -0.68, -1.0, -1.32):
        md.market_tent(ms, rng, 1.02, y, s=0.27, yaw=90)
    for x in (1.75, 2.08, 2.41):
        md.market_tent(ms, rng, x, -2.42, s=0.28)
    # the east
    md.block(ms, rng, 1.85, 0.5, 0.75, 0.55, storeys=2, wall=R, yaw=-90, shop=True, awning=True)
    md.block(ms, rng, 2.5, 0.5, 0.75, 0.58, storeys=3, wall=B, yaw=-90, units=2)
    md.block(ms, rng, 1.85, -0.72, 0.8, 0.55, storeys=2, wall=R, yaw=-90, shop=True, awning=True)
    md.block(ms, rng, 2.5, -0.72, 0.8, 0.58, storeys=2, wall=R, yaw=-90, units=2)
    md.block(ms, rng, 1.9, -1.72, 0.7, 0.56, storeys=3, wall=B, yaw=-90, balcony=True)
    md.block(ms, rng, 2.55, -1.6, 0.6, 0.55, storeys=2, wall=R, yaw=180, units=1)
    md.block(ms, rng, 0.85, -1.9, 0.52, 0.5, storeys=2, wall=R, yaw=90, shop=True)
    # the south-west park and the south
    md.lawn(ms, -2.85, -2.75, -0.55, -1.75, hedges=('n',))
    md.flat(ms, 'md_pave_square', [(-2.6, -2.5), (-1.0, -2.0), (-0.95, -2.12), (-2.55, -2.62)], md.Z_LAWN + 0.001, lod=1)
    md.block(ms, rng, -1.35, -1.6, 0.72, 0.5, storeys=2, wall=B, yaw=180, units=1)
    for x, y, yaw in ((-1.9, -2.15, -18), (-1.4, -2.0, -18)):
        md.bench(ms, x, y, yaw)
    trees = [(-2.65, -2.0), (-2.2, -2.7), (-1.6, -2.55), (-0.9, -2.55), (-0.75, -1.95), (-2.0, -1.95),
             (0.55, -0.3), (0.55, 0.45), (0.55, -1.15), (1.4, -1.1), (1.38, 0.95), (-0.9, 0.9), (-1.9, 0.95), (-2.75, 1.25),
             (-0.75, -0.3), (-1.9, -0.2), (0.45, -2.2), (2.75, -2.1), (2.8, 0.95), (-0.15, 2.1), (-2.8, -0.9), (1.4, -2.2)]
    for i, (x, y) in enumerate(trees):
        md.tree(ms, x, y, h=rng.uniform(0.5, 0.62), r=rng.uniform(0.13, 0.16), lod2=i % 3 == 0, rng=rng)
    for x, y in ((-0.72, 0.78), (0.72, 0.78), (-0.72, -0.78), (0.72, -0.78)):
        md.lamp(ms, x, y)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
