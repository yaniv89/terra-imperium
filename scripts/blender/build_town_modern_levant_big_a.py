# scripts/blender/build_town_modern_levant_big_a.py
# Modern Age `town-big-a` with the Levant kit (plans/art/kits/levant/modern/): the base layout of
# build_town_modern_big_a.py with the kit's villas on its spots, date palms, travertine paving,
# and the mashrabiya glass tower (45 m, the sheet's height, on a limestone podium) where the base
# city has its glass office tower. The stadium, station, water tower and market stay. Writes
# modern-town-big-a-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import build_town_modern_big_a as base  # noqa: E402

LANDMARKS = {'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: lv.mashrabiya_tower(
    ms, None, -2.75, 2.55, 4.5, w=0.9, d=0.75, podium=(1.25, 1.1, 0.15))}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
