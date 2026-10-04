# scripts/blender/build_town_gunpowder_levant_small_b.py
# Gunpowder Age `town-small-b` with the Levant kit (plans/art/kits/levant/gunpowder/): the base
# layout of build_town_gunpowder_small_b.py with the kit's poor, courtyard and rich houses on its
# spots; the mosque (12 m) takes the north house spot, the windmill becomes the hammam. Writes gunpowder-town-small-b-levant.glb.
#
#   python scripts/blender/build_town_gunpowder_levant_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_gunpowder as lv  # noqa: E402
import build_town_gunpowder_small_b as base  # noqa: E402

REPLACE = {(0.0, 1.42): lambda ms, rng: lv.mosque(ms, rng, 0.0, 1.4, top=1.2, w=0.86, d=0.76, yaw=0)}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, max_storeys=2, replace=REPLACE)
