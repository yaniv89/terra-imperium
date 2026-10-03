# scripts/blender/build_town_bronze_medium_b.py
# Bronze Age `town-medium-b`, the Egyptian (Nile) market town (plans/model-brief-for-claude.md,
# section 4; art spec section 3, variant b), from plans/art/towns/bronze/town-medium-b/approval.png:
# thirteen lime-washed mud-brick houses with outside stairs round an open 12 m centre, market
# stalls under team cloth on the east of the square, a temple pylon with a colonnade, two team
# flags and an obelisk behind it (24 m) at the north, a well at the south-west and a house with a
# columned porch at the south; 60 m across.
#
#   python scripts/blender/build_town_bronze_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402

NAME = 'town-medium-b'
LANDMARK_TOP = 2.4  # the obelisk tip: the 24 m landmark at the sheet's scale
GROUND = dict(rx=2.95, ry=2.78, square=0.62)  # a 60 m patch with a 12 m free centre


def layout(ms, rng):
    tb.pylon_gate(ms, -0.32, 1.92, rng, tower=(0.5, 0.4, 1.35), gate=(0.4, 0.3, 0.9), flag_top=1.95,
                  colonnade=4, obelisk_top=LANDMARK_TOP)
    angles = [132, 154, 176, 198, 220, 242, 264, 286, 308, 330, 352, 14, 36]
    for i, (x, y) in enumerate(tb.ring(angles, 2.32, 2.14, rng, jitter=0.03)):
        w, d = rng.uniform(0.66, 0.78), rng.uniform(0.58, 0.7)
        items = [rng.choice([('pergola', 0.0, 0.08), ('pergola', -0.08, 0.04), ('pergola', 0.06, 0.1), ('crates', -0.12, -0.12)]),
                 rng.choice([('vent', 0.18, -0.12), ('jars', -0.2, 0.12), ('mat', -0.1, -0.1)])]
        two = i % 2 == 0
        south = angles[i] == 264
        tt.house(ms, rng, x, y, w + (0.2 if south else 0), d, storeys=2 if two else 1,
                 upper=(rng.uniform(-0.08, 0.1), 0.12) if two else None, roof_items=items,
                 front=None if south else rng.choice([None, 'shade', 'team', 'team']),
                 stair_side=rng.choice([-1, 1]) if (not two and rng.random() < 0.6) or south else None,
                 porch=south, yaw=0 if south else None, jars=rng.randint(3, 5),
                 heap=(rng.uniform(-0.25, 0.25), -0.4) if rng.random() < 0.4 else None)
    for x, y in tb.ring([-70, -50, -30, -10, 10, 30, 50, 66], 1.4, 1.34, rng, jitter=0.03):
        tb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.7 else 'thatch')
    tt.well(ms, -1.05, -1.05, yaw=-20)
    world = tm.house_frame(0, 0, 0)
    for x, y in tb.ring([110, 160, 205, 250, 290], 1.55, 1.45, rng, jitter=0.1):
        tt.clutter(ms, world, x, y, rng, 4)
    tt.woodpile(ms, world, -1.6, 0.55, 60)
    tt.woodpile(ms, world, 0.4, -1.6, 10)
    tt.rack(ms, world, -1.25, -0.25, 80)
    tt.rack(ms, world, 0.15, -1.45, -10)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
