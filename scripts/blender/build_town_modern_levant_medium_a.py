# scripts/blender/build_town_modern_levant_medium_a.py
# Modern Age `town-medium-a` with the Levant kit (plans/art/kits/levant/modern/): the base layout
# of build_town_modern_medium_a.py with the kit's villas on its spots, date palms, travertine
# paving, and the mashrabiya glass tower (30 m on a limestone podium) where the base town has its
# glass office tower. The station, market tents and park stay. Writes
# modern-town-medium-a-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import build_town_modern_medium_a as base  # noqa: E402

LANDMARKS = {'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: lv.mashrabiya_tower(
    ms, None, -2.2, 1.9, 3.0, w=0.62, d=0.56, podium=(0.85, 0.8, 0.12))}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
