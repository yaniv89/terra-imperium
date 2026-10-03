# scripts/blender/build_town_bronze_big_b.py
# Bronze Age `town-big-b`, the Egyptian (Nile) city (plans/model-brief-for-claude.md, section 4;
# art spec section 3, variant b), from plans/art/towns/bronze/town-big-b/approval.png: some two
# dozen lime-washed mud-brick houses in two rings round an open 14 m centre, the temple pylon with
# its colonnade, team flags and an obelisk (36 m) at the north-west, a row of domed granaries at
# the north, a small stepped pyramid shrine at the east, market stalls, a porch house at the south
# and a well; 80 m across.
#
#   python scripts/blender/build_town_bronze_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402

NAME = 'town-big-b'
LANDMARK_TOP = 3.6  # the obelisk tip: the 36 m landmark at the sheet's scale
GROUND = dict(rx=3.95, ry=3.72, square=0.7)  # an 80 m patch with a 14 m free centre


def houses(ms, rng, angles, rx, ry, two_every, size=(0.72, 0.86, 0.6, 0.72), yard=0.0, porch_at=None):
    for i, (x, y) in enumerate(tb.ring(angles, rx, ry, rng, jitter=0.03)):
        w, d = rng.uniform(size[0], size[1]), rng.uniform(size[2], size[3])
        items = [rng.choice([('pergola', 0.0, 0.08), ('pergola', -0.08, 0.04), ('pergola', 0.06, 0.1), ('crates', -0.12, -0.12)]),
                 rng.choice([('vent', 0.18, -0.12), ('jars', -0.2, 0.12), ('mat', -0.1, -0.1)])]
        two = i % two_every == 0
        porch = angles[i] == porch_at
        tt.house(ms, rng, x, y, w + (0.2 if porch else 0), d, storeys=2 if two and not porch else 1,
                 upper=(rng.uniform(-0.08, 0.1), 0.12) if two and not porch else None, roof_items=items,
                 front=None if porch else rng.choice([None, 'shade', 'team', 'team']),
                 stair_side=rng.choice([-1, 1]) if (not two and rng.random() < 0.6) or porch else None,
                 porch=porch, yaw=0 if porch else None, jars=rng.randint(3, 5),
                 heap=(rng.uniform(-0.25, 0.25), -0.4) if rng.random() < 0.35 else None, yard=yard)


def layout(ms, rng):
    tb.pylon_gate(ms, -0.85, 2.45, rng, tower=(0.62, 0.48, 2.4), gate=(0.5, 0.36, 1.6), flag_top=3.1,
                  colonnade=4, obelisk_top=LANDMARK_TOP)
    tb.granaries(ms, 1.05, 2.55, n=4, r=0.22, h=0.85)
    tb.step_pyramid(ms, 2.75, 1.0, base=0.9, levels=4, h=0.2)
    houses(ms, rng, [40, 135, 152, 169, 186, 203, 220, 237, 254, 271, 288, 305, 322, 339, 356], 3.08, 2.88, 3, porch_at=271, size=(0.74, 0.86, 0.6, 0.7), yard=0.26)
    houses(ms, rng, [140, 170, 200, 230, 260, 290, 320, 350], 2.1, 1.96, 2, size=(0.76, 0.9, 0.6, 0.7))
    for x, y in tb.ring([-60, -40, -20, 0, 20, 40, 60], 1.38, 1.32, rng, jitter=0.03):
        tb.stall(ms, x, y, rng, cloth='team_cloth' if rng.random() < 0.7 else 'thatch')
    tt.well(ms, -1.19, -0.83, yaw=-20)
    world = tm.house_frame(0, 0, 0)
    for x, y in tb.ring([75, 160, 215, 250, 300, 330], 2.7, 2.5, rng, jitter=0.1):
        tt.clutter(ms, world, x, y, rng, 5)
    for (x, y, yaw) in ((-2.6, -0.7, 70), (2.45, -1.3, -30), (-1.1, -2.6, 10)):
        tt.woodpile(ms, world, x, y, yaw)
    for (x, y, yaw) in ((-1.6, 0.9, 40), (0.9, -2.45, -10)):
        tt.rack(ms, world, x, y, yaw)


if __name__ == '__main__':
    tt.main(NAME, layout, ground=GROUND)
