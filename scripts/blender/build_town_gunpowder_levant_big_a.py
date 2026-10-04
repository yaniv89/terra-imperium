# scripts/blender/build_town_gunpowder_levant_big_a.py
# Gunpowder Age `town-big-a` with the Levant kit (plans/art/kits/levant/gunpowder/): the base
# layout of build_town_gunpowder_big_a.py with the kit's poor, courtyard and rich houses on its
# spots; the domed church becomes the mosque (28 m), the town hall the covered souk, the windmill the hammam. Writes gunpowder-town-big-a-levant.glb.
#
#   python scripts/blender/build_town_gunpowder_levant_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_gunpowder as lv  # noqa: E402
import build_town_gunpowder_big_a as base  # noqa: E402

REPLACE = None

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, max_storeys=3, replace=REPLACE)
