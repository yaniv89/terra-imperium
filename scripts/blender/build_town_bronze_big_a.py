# scripts/blender/build_town_bronze_big_a.py
# Bronze Age `town-big-a`, the Mesopotamian city (plans/model-brief-for-claude.md, section 4; art
# spec section 3), from plans/art/towns/bronze/town-big-a/approval.png: some two dozen lime-washed
# mud-brick houses in two rings round an open 14 m centre, a four-stage ziggurat with its stairs
# and a team flag at the north-east (36 m), a watch tower at the north-west, the south gate with
# two guardian lions, market stalls and a well; 80 m across.
#
#   python scripts/blender/build_town_bronze_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402

NAME = 'town-big-a'
LANDMARK_TOP = 3.6  # the 36 m landmark (flag tip), at the sheet's scale
GROUND = dict(rx=3.95, ry=3.72, square=0.7)  # an 80 m patch with a 14 m free centre


def houses(ms, rng, angles, rx, ry, two_every, size=(0.72, 0.86, 0.6, 0.72), yard=0.0, skip=()):
    for i, (x, y) in enumerate(tb.ring(angles, rx, ry, rng, jitter=0.03)):
        w, d = rng.uniform(size[0], size[1]), rng.uniform(size[2], size[3])
        items = [rng.choice([('pergola', 0.0, 0.08), ('pergola', -0.06, 0.06), ('pergola', 0.06, 0.1), ('crates', -0.12, -0.12)]),
                 rng.choice([('vent', 0.18, -0.12), ('jars', -0.2, 0.12), ('mat', -0.1, -0.1)])]
        two = i % two_every == 0
        tt.house(ms, rng, x, y, w, d, storeys=2 if two else 1, upper=(rng.uniform(-0.08, 0.1), 0.12) if two else None,
                 roof_items=items, front=rng.choice([None, 'shade', 'team', 'shade']),
                 ladder_side=rng.choice([None, -1, 1]) if not two else None, jars=rng.randint(3, 5),
                 heap=(rng.uniform(-0.25, 0.25), -0.4) if rng.random() < 0.35 else None, yard=yard)


def layout(ms, rng):
    tb.stepped_temple(ms, 1.72, 1.58, rng,
                      tiers=[(1.6, 1.46, 0.95), (1.14, 1.02, 0.8), (0.74, 0.66, 0.7), (0.4, 0.36, 0.5)],
                      offs=[(0, 0), (0.04, 0.1), (0.07, 0.17), (0.09, 0.22)], top_z=LANDMARK_TOP)
    tb.watch_tower(ms, -2.05, 1.9, h=2.2, w=0.72)
    tb.town_gate(ms, 0.0, -3.05, yaw=0)
    houses(ms, rng, [0, 16, 82, 98, 114, 158, 176, 194, 212, 230, 246, 296, 314, 332], 3.08, 2.88, 3, size=(0.8, 0.94, 0.62, 0.72), yard=0.26)
    houses(ms, rng, [88, 112, 160, 185, 210, 235, 305, 330, 355], 2.1, 1.96, 2, size=(0.76, 0.9, 0.6, 0.7))
    for x, y in tb.ring([100, 125, 150, 175, 200, 225, 250, 290, 315], 1.38, 1.32, rng, jitter=0.03):
        tb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.6 else 'thatch')
    tt.well(ms, 1.36, -0.52, yaw=15)
    world = tm.house_frame(0, 0, 0)
    for x, y in tb.ring([45, 140, 200, 265, 280, 340], 2.7, 2.5, rng, jitter=0.1):
        tt.clutter(ms, world, x, y, rng, 5)
    for (x, y, yaw) in ((-2.6, -0.7, 70), (2.5, -1.2, -30), (-1.0, -2.6, 10)):
        tt.woodpile(ms, world, x, y, yaw)
    for (x, y, yaw) in ((-1.55, 0.95, 40), (0.9, -2.45, -10), (2.6, 0.55, 80)):
        tt.rack(ms, world, x, y, yaw)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
