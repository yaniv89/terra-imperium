# scripts/blender/build_town_classical_levant_small_a.py
# Classical Age `town-small-a` in the Levant kit (art spec 3b; plans/art/kits/levant/classical/):
# the layout of build_town_classical_small_a.py (a paved 40 m town with a 12 m free centre, the
# landmark at the north-west, three houses down the west side, a big house at the north-east, a
# street to the south, a well at the south-east) built as a Levantine town: a two-storey rich
# residence with a columned porch and balcony, courtyard houses round open courts, flat-roofed
# cottages under reed awnings, the Apadana with bull capitals as the landmark, olives, cypresses
# and date palms, potted plants and jars on grey-beige cobbles.
#
#   python scripts/blender/build_town_classical_levant_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_levant_classical as lc  # noqa: E402

NAME = 'town-small-a'
FILE = 'classical-town-small-a-levant'
GROUND = dict(rx=2.0, ry=2.0, square=0.6)

SLOTS = [
    dict(x=-1.5, y=0.68, w=0.7, d=0.62, yaw=90, kind='common', awning=False),
    dict(x=-1.5, y=-0.2, w=0.7, d=0.62, yaw=90, kind='common', jar_n=3),
    dict(x=-1.5, y=-1.08, w=0.7, d=0.62, yaw=90, kind='poor', side=-1, stall=True),
    dict(x=1.2, y=1.25, w=1.0, d=0.78, yaw=0, kind='rich'),
    dict(x=0.42, y=1.38, w=0.44, d=0.5, yaw=0, kind='poor', side=1),
    dict(x=1.52, y=-0.05, w=0.84, d=0.7, yaw=-90, kind='common'),
]


def layout(ms, rng):
    lc.street(ms, 0.05, -0.65, 0.05, -1.95, 0.42)
    lc.apadana(ms, rng, -0.75, 1.34, 0.72, 0.56, top=0.9, columns=6, yaw=0)
    for x, y, k in ((-1.12, 1.72, 'cypress'), (-0.38, 1.74, 'palm'), (-1.12, 0.92, 'cypress')):
        lc.tree(ms, rng, x, y, k)
    for slot in SLOTS:
        lc.levant_house(ms, rng, slot)
    lc.well(ms, 1.0, -1.25, yaw=10)
    world = tm.house_frame(0, 0, 0)
    for x, y in ((-0.95, 0.35), (0.95, 0.5), (-0.85, -0.85), (0.9, -0.55), (-1.85, 1.55), (1.85, 1.78), (-1.85, -1.55),
                 (1.8, -0.75), (-0.95, -1.6), (1.6, -1.6), (0.55, -1.1)):
        lc.potted(ms, world, x, y) if rng.random() < 0.55 else lc.tree(ms, rng, x, y, 'olive')
    for x, y, k in ((1.82, 0.75, 'palm'), (-1.92, 0.25, 'cypress'), (-1.92, -0.65, 'olive'), (0.72, 1.78, 'cypress'),
                    (1.85, 0.45, 'cypress'), (-0.55, -1.75, 'palm')):
        lc.tree(ms, rng, x, y, k)
    lc.jars(ms, world, 0.75, 0.65, rng, 4)
    lc.jars(ms, world, -1.0, -0.6, rng, 3)


if __name__ == '__main__':
    lc.main(FILE, NAME, layout, GROUND)
