# scripts/blender/build_town_classical_sinic_small_b.py
# Classical Age `town-small-b` in the Sinic kit (art spec 3b; plans/art/kits/sinic/classical/):
# the layout of build_town_classical_small_b.py (two halls across the north, the landmark at the
# north-east corner, two houses down each side in walled yards with trees, a well at the south-west,
# courtyard walls round the edge, open to the south) with the kit's houses: a residence hall behind
# its gate and a courtyard house along the north, courtyard houses and cottages down the sides,
# the que watchtower of the sheet (scaled to 10 m) in the shrine pavilion's place, grey-tiled
# copings on the walls, round-crowned and blossoming trees.
#
#   python scripts/blender/build_town_classical_sinic_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_sinic_classical as sc  # noqa: E402

NAME = 'town-small-b'
FILE = 'classical-town-small-b-sinic'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-0.72, y=1.42, w=0.9, d=0.55, yaw=0, kind='rich', garden=False),
    dict(x=0.62, y=1.42, w=0.9, d=0.55, yaw=0, kind='common', jar_n=2),
    dict(x=-1.48, y=0.25, w=0.78, d=0.5, yaw=90, kind='common'),
    dict(x=-1.48, y=-1.05, w=0.78, d=0.5, yaw=90, kind='poor', side=1),
    dict(x=1.48, y=0.25, w=0.78, d=0.5, yaw=-90, kind='common', awning=False),
    dict(x=1.48, y=-1.05, w=0.78, d=0.5, yaw=-90, kind='poor', side=-1),
]


def layout(ms, rng):
    sc.que_tower(ms, rng, 1.55, 1.5, base=0.34, top=0.96, yaw=0)
    for slot in SLOTS:
        sc.sinic_house(ms, rng, slot)
    for side in (-1, 1):
        for i, y in enumerate((0.25, -1.05)):
            sc.tree(ms, rng, side * 1.15, y + 0.5, h=rng.uniform(0.28, 0.34), blossom=(side > 0 and i == 0))
        sc.court_wall(ms, side * 1.08, -1.6, side * 1.08, -0.62, gaps=((0.5, 0.2),))
        sc.court_wall(ms, side * 1.08, -0.3, side * 1.08, 0.85, gaps=((0.45, 0.2),))
    # the outer courtyard walls round the edge, open to the street at the south
    sc.court_wall(ms, -1.95, -1.95, -1.95, 1.95)
    sc.court_wall(ms, 1.95, -1.95, 1.95, 1.95)
    sc.court_wall(ms, -1.95, 1.95, 1.95, 1.95, gaps=((0.5, 0.3),))
    sc.court_wall(ms, -1.95, -1.95, -0.35, -1.95)
    sc.court_wall(ms, 0.35, -1.95, 1.95, -1.95)
    sc.paved_strip(ms, 0.0, -0.7, 0.0, -1.95, 0.5)
    tt.well(ms, -0.75, -1.4, yaw=-10)
    for x, y in ((-1.75, 1.7), (1.8, 0.95), (-0.05, 1.75), (1.75, -1.7), (-1.75, -1.72)):
        tc.shrub(ms, x, y, r=rng.uniform(0.06, 0.09))
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55)):
        tc.shrub(ms, x, y, r=rng.uniform(0.05, 0.07))
    world = tm.house_frame(0, 0, 0)
    tt.clutter(ms, world, 0.9, -0.85, rng, 4)
    sc.jars(ms, world, -0.95, 0.9, rng, 3)
    sc.stall(ms, 0.75, -1.35, rng, yaw=-20, w=0.3, d=0.24)


if __name__ == '__main__':
    sc.main(FILE, NAME, layout, GROUND)
