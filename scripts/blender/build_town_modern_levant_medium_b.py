# scripts/blender/build_town_modern_levant_medium_b.py
# Modern Age `town-medium-b` with the Levant kit (plans/art/kits/levant/modern/): the base layout
# of build_town_modern_medium_b.py with the kit's villas on its spots, date palms, travertine
# paving, and the refinery flare stack (35 m on a 10 m pad) where the base town has its works and
# chimney. The water tower, market tents and north lawn stay. Writes
# modern-town-medium-b-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import build_town_modern_medium_b as base  # noqa: E402

LANDMARKS = {'factory': lambda ms, x, y, w, d, h=0.42, teeth=4, yaw=0, rise=0.16, chimney=None: lv.flare_stack(
    ms, None, x, y, w, d, top_z=3.5)}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
