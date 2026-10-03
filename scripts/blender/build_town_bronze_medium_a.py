# scripts/blender/build_town_bronze_medium_a.py
# Bronze Age `town-medium-a`, the Mesopotamian market town (plans/model-brief-for-claude.md,
# section 4; art spec section 3), from plans/art/towns/bronze/town-medium-a/approval.png: thirteen
# lime-washed mud-brick houses in a ring round an open 12 m centre, market stalls under team cloth
# and reed on the south-west of the square, a four-stage stepped temple with its stairs and a team
# flag at the north-east (24 m), a well at the south-east; 60 m across.
#
#   python scripts/blender/build_town_bronze_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402

NAME = 'town-medium-a'
LANDMARK_TOP = 2.4  # the 24 m landmark (flag tip), at the sheet's scale


def layout(ms, rng):
    tb.stepped_temple(ms, 1.5, 1.4, rng,
                      tiers=[(1.2, 1.1, 0.6), (0.84, 0.78, 0.52), (0.55, 0.5, 0.46), (0.3, 0.28, 0.34)],
                      offs=[(0, 0), (0.04, 0.08), (0.06, 0.13), (0.08, 0.17)], top_z=LANDMARK_TOP)
    angles = [92, 115, 138, 161, 184, 207, 230, 253, 276, 299, 322, 345, 8]
    for i, (x, y) in enumerate(tb.ring(angles, 2.32, 2.14, rng, jitter=0.03)):
        w, d = rng.uniform(0.66, 0.78), rng.uniform(0.58, 0.7)
        items = [rng.choice([('pergola', 0.0, 0.08), ('pergola', -0.06, 0.06), ('pergola', 0.06, 0.1), ('crates', -0.12, -0.12)]),
                 rng.choice([('vent', 0.18, -0.12), ('jars', -0.2, 0.12), ('mat', -0.1, -0.1)])]
        two = i % 2 == 1
        tt.house(ms, rng, x, y, w, d, storeys=2 if two else 1, upper=(rng.uniform(-0.08, 0.1), 0.12) if two else None,
                 roof_items=items, front=rng.choice([None, 'shade', 'team', 'shade']),
                 ladder_side=rng.choice([None, -1, 1]) if not two else None, jars=rng.randint(3, 5),
                 heap=(rng.uniform(-0.25, 0.25), -0.4) if rng.random() < 0.4 else None)
    for x, y in tb.ring([140, 160, 180, 200, 220, 240, 260, 280], 1.4, 1.34, rng, jitter=0.03):
        tb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.6 else 'thatch')
    tt.well(ms, 1.05, -1.05, yaw=10)
    world = tm.house_frame(0, 0, 0)
    for x, y in tb.ring([40, 128, 215, 300, 330], 1.55, 1.45, rng, jitter=0.1):
        tt.clutter(ms, world, x, y, rng, 4)
    tt.woodpile(ms, world, -1.55, -0.6, 70)
    tt.woodpile(ms, world, 0.55, -1.55, -10)
    tt.rack(ms, world, -0.9, 1.25, 30)
    tt.rack(ms, world, 1.45, -0.35, -70)


GROUND = dict(rx=2.95, ry=2.78, square=0.62)  # a 60 m patch with a 12 m free centre

if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
