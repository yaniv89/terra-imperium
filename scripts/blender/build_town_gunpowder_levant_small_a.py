# scripts/blender/build_town_gunpowder_levant_small_a.py
# Gunpowder Age `town-small-a` with the Levant kit (plans/art/kits/levant/gunpowder/): the base
# layout of build_town_gunpowder_small_a.py with the kit's poor, courtyard and rich houses on its
# spots; the arcaded hall spot becomes the covered souk; the mosque (12 m) takes the north-east house spot. Writes gunpowder-town-small-a-levant.glb.
#
#   python scripts/blender/build_town_gunpowder_levant_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_gunpowder as lv  # noqa: E402
import build_town_gunpowder_small_a as base  # noqa: E402

REPLACE = {(1.05, 1.38): lambda ms, rng: lv.mosque(ms, rng, 1.05, 1.4, top=1.2, w=0.9, d=0.78, yaw=0)}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, max_storeys=2, replace=REPLACE)
