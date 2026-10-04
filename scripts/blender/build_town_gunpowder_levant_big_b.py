# scripts/blender/build_town_gunpowder_levant_big_b.py
# Gunpowder Age `town-big-b` with the Levant kit (plans/art/kits/levant/gunpowder/): the base
# layout of build_town_gunpowder_big_b.py with the kit's poor, courtyard and rich houses on its
# spots; the twin-tower church becomes the mosque (28 m, turned to the square), the town hall the covered souk, the windmill the hammam. Writes gunpowder-town-big-b-levant.glb.
#
#   python scripts/blender/build_town_gunpowder_levant_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_gunpowder as lv  # noqa: E402
import build_town_gunpowder_big_b as base  # noqa: E402

REPLACE = None

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, max_storeys=3, replace=REPLACE)
