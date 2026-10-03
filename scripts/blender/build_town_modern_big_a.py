# scripts/blender/build_town_modern_big_a.py
# Modern Age `town-big-a`, the city with the stadium (plans/art/towns/modern/town-big-a/
# reference-sheet.png): a 42 m glass office tower at the north-west, a football stadium at the
# south-west, a railway station on a diagonal at the north-east, an 18 m water tower at the
# south-east among slate-gabled houses, quarters of two- to four-storey blocks in render and red
# brick between asphalt streets, a large paved plaza (the 12 m free centre) with team-grey market
# tents on its east side, street trees. 80 m.
#
#   python scripts/blender/build_town_modern_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402

NAME = 'town-big-a'
GROUND = dict(md.TOWN_GROUND, rx=4.0, ry=4.0, square=None, n=72)
R, B = 'md_render_win', 'md_brick_win'
md.FOOT[0] = 1.35  # the sheets' blocks are deeper than a house
md.LAWN[0] = 0.06


def layout(ms, rng):
    G = md.G
    # streets: a ring round the plaza, a road north, two south, one west and one east
    md.flat(ms, 'md_asphalt', md.rounded(0, 0, 2.6, 2.7, 0.4), md.Z_ROAD)
    md.rect(ms, 'md_pave_square', -0.92, -0.98, 0.92, 0.98, G + 0.004)
    md.road(ms, -0.2, 1.3, -0.2, 3.85, 0.5)
    md.road(ms, -0.75, -1.3, -0.75, -3.85, 0.4, dashes=False)
    md.road(ms, 0.75, -1.3, 0.75, -3.85, 0.4, dashes=False)
    md.road(ms, -1.25, 0.6, -3.85, 0.6, 0.45)
    md.road(ms, 1.25, -0.3, 3.85, -0.3, 0.45)
    for x, y, yaw in ((-0.2, 1.45, 0), (-1.42, 0.6, 90), (1.42, -0.3, 90), (-0.75, -1.45, 0), (0.75, -1.45, 0)):
        md.zebra(ms, x, y, 0.4, yaw=yaw, n=4)
    for y in (0.62, 0.3, -0.02, -0.34, -0.66):
        md.market_tent(ms, rng, 0.76, y, s=0.26, yaw=-90)
    # the north-west: the tower and its blocks
    md.glass_tower(ms, -2.35, 2.35, [(0.62, 0.62, 3.95, 0, 0)], podium=(0.95, 0.95, 0.2))
    md.block(ms, rng, -1.05, 3.2, 0.62, 0.66, storeys=3, wall=R, yaw=90, units=2)
    md.block(ms, rng, -1.05, 2.38, 0.62, 0.7, storeys=2, wall=B, yaw=90, units=2)
    md.block(ms, rng, -1.05, 1.5, 0.62, 0.62, storeys=4, wall=R, yaw=0, shop=True, awning=True)
    md.block(ms, rng, -1.95, 1.35, 0.8, 0.55, storeys=2, wall=B, yaw=180, balcony=True)
    md.block(ms, rng, -2.95, 1.3, 0.6, 0.55, storeys=3, wall=R, yaw=180, units=2)
    md.block(ms, rng, -1.75, 3.25, 0.55, 0.55, storeys=2, wall=R, yaw=0, units=1)
    # the north-east: the station and its blocks
    md.station(ms, 2.4, 2.4, length=2.0, yaw=-45, width=0.42, track_len=2.5)
    md.block(ms, rng, 0.55, 3.15, 0.55, 0.62, storeys=3, wall=B, yaw=-90, units=2)
    md.block(ms, rng, 0.55, 2.35, 0.55, 0.62, storeys=2, wall=R, yaw=-90, units=2)
    md.block(ms, rng, 1.35, 2.35, 0.55, 0.55, storeys=3, wall=R, yaw=0, units=1)
    md.block(ms, rng, 0.55, 1.5, 0.55, 0.55, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    md.block(ms, rng, 1.38, 1.45, 0.6, 0.6, storeys=4, wall=B, yaw=180, units=2)
    md.block(ms, rng, 2.25, 1.35, 0.55, 0.5, storeys=2, wall=R, yaw=180, units=1)
    md.block(ms, rng, 1.95, 0.45, 0.6, 0.55, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    md.block(ms, rng, 2.75, 0.45, 0.6, 0.55, storeys=3, wall=B, yaw=180, units=2)
    md.block(ms, rng, 3.45, 0.4, 0.5, 0.55, storeys=2, wall=R, yaw=180, units=1)
    # the west
    md.block(ms, rng, -1.7, -0.3, 0.62, 0.66, storeys=3, wall=R, yaw=-90, shop=True, awning=True)
    md.block(ms, rng, -2.5, -0.15, 0.62, 0.55, storeys=2, wall=B, yaw=0, units=2)
    md.block(ms, rng, -3.3, -0.15, 0.55, 0.55, storeys=3, wall=R, yaw=0, units=1)
    # the south-west: the stadium
    md.stadium(ms, -2.4, -2.1, rx=0.72, ry=0.6, top=0.5)
    # the south: blocks between the two streets
    md.block(ms, rng, 0, -1.85, 0.85, 0.6, storeys=3, wall=R, yaw=180, shop=True, awning=True)
    md.block(ms, rng, 0, -2.65, 0.85, 0.6, storeys=3, wall=B, yaw=180, roof='hip', rise=0.24)
    md.block(ms, rng, 0, -3.42, 0.8, 0.5, storeys=2, wall=R, yaw=0, units=2)
    # the south-east: the water tower among slate-gabled houses
    md.water_tower(ms, 2.85, -2.15, top=1.8, r=0.2, tank_h=0.3)
    md.block(ms, rng, 1.55, -0.95, 0.55, 0.52, storeys=2, wall=R, yaw=180, roof='gable', rise=0.24)
    md.block(ms, rng, 2.3, -0.95, 0.55, 0.52, storeys=2, wall=R, yaw=180, roof='gable', rise=0.24)
    md.block(ms, rng, 3.15, -0.95, 0.6, 0.55, storeys=3, wall=B, yaw=180, units=2)
    md.block(ms, rng, 1.6, -1.95, 0.7, 0.55, storeys=3, wall=B, yaw=90, roof='hip', rise=0.22)
    md.block(ms, rng, 1.6, -2.85, 0.7, 0.55, storeys=2, wall=R, yaw=90, units=1)
    md.block(ms, rng, 2.4, -3.2, 0.55, 0.5, storeys=2, wall=R, yaw=0, roof='gable', rise=0.22)
    # greens and street trees
    md.lawn(ms, -3.7, 0.95, -2.95, 0.98)
    md.lawn(ms, 2.0, -2.75, 3.4, -2.55)
    md.lawn(ms, -3.5, -0.75, -1.1, -0.6, hedges=('n',))
    trees = [(-0.55, 1.95), (-0.55, 2.8), (0.15, 1.95), (0.15, 2.8), (-0.55, 3.55), (-1.5, 0.95), (-2.5, 0.95), (-3.35, 0.95),
             (-1.5, 0.25), (-2.5, 0.25), (-3.4, 0.25), (1.5, 0.05), (2.35, 0.05), (3.2, 0.05), (1.6, -0.6), (2.6, -0.6),
             (-1.1, -1.6), (-1.1, -2.6), (-1.1, -3.4), (0.4, -2.25), (-0.4, -3.05), (1.1, -2.3), (1.15, -3.3), (2.2, -1.5),
             (3.4, -1.55), (3.3, -2.6), (1.95, -2.4), (0.95, 2.75), (1.8, 2.0), (-1.55, 2.8), (-3.35, 2.0), (-2.4, 1.75),
             (-1.6, 1.85), (0.9, 1.0), (-0.9, -0.95), (0.95, -1.05)]
    for i, (x, y) in enumerate(trees):
        md.tree(ms, x, y, h=rng.uniform(0.5, 0.62), r=rng.uniform(0.13, 0.16), lod2=i % 4 == 0, rng=rng)
    for x, y in ((-0.98, 1.05), (0.98, 1.05), (-0.98, -1.05), (0.98, -1.05)):
        md.lamp(ms, x, y)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
