# scripts/blender/build_town_bronze_small_b.py
# Bronze Age `town-small-b`, the Egyptian (Nile) village (plans/model-brief-for-claude.md,
# section 4; art spec section 3, variant b), from plans/art/towns/bronze/town-small-b/approval.png:
# seven flat-roofed lime-washed mud-brick houses round an open 8 m centre, outside stairs to the
# roofs, a house with a columned porch, a temple pylon with two team flags at the north-west, a
# well at the south, reed shades, team-cloth awnings, jars and crates. Same palette and footprint
# as variant a, different layout and landmark.
#
#   python scripts/blender/build_town_bronze_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
from ti_town import G  # noqa: E402

NAME = 'town-small-b'


def pylon(ms, x, y, rng):
    """The landmark: a temple pylon, two battered towers with a cavetto cornice either side of a
    lower gateway, a flagpole with a team pennant against each tower, a walled court behind."""
    f = tm.house_frame(x, y, tm.facing_centre(x, y))
    tw, td, th = 0.46, 0.36, 1.05          # a tower: 4.6 x 3.6 m at the base, 10.5 m high
    gw, gd, gh = 0.3, 0.24, 0.7            # the gateway between them
    for sx in (-1, 1):
        cx = sx * (gw / 2 + tw / 2 - 0.02)
        ms.box('pylon', (tw, td, th), at=(cx, 0, G), lod=2, frame=f, bevel=0.006, taper=0.8)
        ms.box('pylon', (tw * 0.8 + 0.03, td * 0.8 + 0.03, 0.05), at=(cx, 0, G + th), lod=1, frame=f, taper=1.08)
        ms.box('roof', (tw * 0.8 - 0.01, td * 0.8 - 0.01, 0.01), at=(cx, 0, G + th + 0.05), lod=2, frame=f)
        # a flagpole in a niche on the front face, rising past the cornice to the 16 m mark
        px = cx - sx * 0.07
        ms.cyl('timber', 0.014, 0.01, tt.LANDMARK_TOP - G, at=(px, -td / 2 + 0.01, G), segs=6, lod=1, frame=f)
        tt.pennant(ms, f, px, -td / 2 + 0.01, tt.LANDMARK_TOP - 0.005, yaw=-150 if sx < 0 else -160, w=0.18, h=0.11)
        # two small high windows and a dark slit on the front
        ms.box('dark', (0.03, 0.01, 0.06), at=(cx + sx * 0.06, -td * 0.42 - 0.002, G + 0.7), lod=0, frame=f)
    ms.box('pylon', (gw + 0.04, gd, gh), at=(0, 0, G), lod=2, frame=f, bevel=0.006)
    ms.box('pylon', (gw + 0.08, gd + 0.04, 0.04), at=(0, 0, G + gh), lod=1, frame=f, taper=1.06)
    ms.box('door', (0.13, 0.012, 0.32), at=(0, -gd / 2 - 0.004, G), lod=1, frame=f)
    ms.box('timber', (0.17, 0.02, 0.025), at=(0, -gd / 2 - 0.006, G + 0.32), lod=0, frame=f)
    # the temple court behind the gate: a low walled yard and a shrine block
    ms.box('pylon', (0.9, 0.4, 0.36), at=(0, 0.36, G), lod=2, frame=f, bevel=0.006)
    ms.box('roof', (0.87, 0.37, 0.01), at=(0, 0.36, G + 0.36), lod=2, frame=f)
    tt._parapet(ms, f, 'pylon', 0, 0.36, 0.9, 0.4, G + 0.36)
    # offerings and jars at the foot of the towers
    tt.clutter(ms, f, -0.32, -0.26, rng, 4)
    tt.clutter(ms, f, 0.34, -0.25, rng, 3)


def layout(ms, rng):
    # seven houses round the centre (Blender -Y is south, the front); the pylon at the north-west
    pylon(ms, -0.72, 1.28, rng)
    tt.house(ms, rng, 0.58, 1.38, 0.7, 0.58, roof_items=[('pergola', -0.1, 0.06), ('jars', 0.18, -0.16)], stair_side=1, front='team', jars=4)
    tt.house(ms, rng, 1.42, 0.5, 0.62, 0.68, roof_items=[('pergola', 0.02, 0.1), ('vent', -0.18, -0.2)], stair_side=-1, front='shade', jars=5)
    tt.house(ms, rng, 1.55, -0.42, 0.5, 0.56, storeys=2, upper=(0.06, 0.12), roof_items=[('crates', -0.16, -0.16)], jars=4)
    tt.house(ms, rng, 0.98, -1.08, 0.56, 0.52, roof_items=[('mat', 0.0, 0.05), ('vent', 0.16, 0.12)], front='team', jars=4, heap=(0.28, -0.36))
    tt.house(ms, rng, -0.32, -1.24, 0.92, 0.66, yaw=0, porch=True, roof_items=[('pergola', 0.2, 0.08), ('jars', -0.32, 0.14)], stair_side=-1, jars=5)
    tt.house(ms, rng, -1.48, -0.18, 0.62, 0.8, storeys=2, upper=(0.08, 0.14), roof_items=[('pergola', -0.06, -0.18)], ladder_side=1, front='shade', jars=4)
    tt.house(ms, rng, -1.5, 0.62, 0.48, 0.52, roof_items=[('vent', 0.1, 0.1), ('mat', -0.08, -0.06)], jars=3, heap=(0.24, -0.34))
    tt.well(ms, 0.42, -1.5, yaw=-15)
    world = tm.house_frame(0, 0, 0)
    for (x, y) in ((0.2, -1.62), (0.66, -1.62), (1.15, 1.05), (-0.95, 0.42), (-1.0, -0.82), (0.25, 0.95)):
        tt.clutter(ms, world, x, y, rng, 4)
    tt.woodpile(ms, world, -0.95, -1.15, 25)
    tt.woodpile(ms, world, 1.05, 0.0, -80)
    tt.rack(ms, world, 0.7, -0.62, -30)
    tt.rack(ms, world, -0.68, -0.55, 40)


if __name__ == '__main__':
    tt.main(NAME, layout)
