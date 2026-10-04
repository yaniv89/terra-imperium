# scripts/blender/build_town_gunpowder_levant_medium_b.py
# Gunpowder Age `town-medium-b` with the Levant kit (plans/art/kits/levant/gunpowder/): the base
# layout of build_town_gunpowder_medium_b.py with the kit's poor, courtyard and rich houses on its
# spots; the town hall becomes the covered souk, the windmill the hammam; the mosque (20 m) takes two north-west house spots. Writes gunpowder-town-medium-b-levant.glb.
#
#   python scripts/blender/build_town_gunpowder_levant_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_gunpowder as lv  # noqa: E402
import build_town_gunpowder_medium_b as base  # noqa: E402

REPLACE = {(-2.3, 2.42): lambda ms, rng: lv.mosque(ms, rng, -1.9, 2.3, top=2.0, w=1.3, d=0.95, yaw=0), (-1.45, 2.42): None}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, max_storeys=3, replace=REPLACE)
