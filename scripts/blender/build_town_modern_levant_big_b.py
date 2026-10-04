# scripts/blender/build_town_modern_levant_big_b.py
# Modern Age `town-big-b` with the Levant kit (plans/art/kits/levant/modern/): the base layout of
# build_town_modern_big_b.py with the kit's villas on its spots, date palms, travertine paving,
# the mashrabiya glass tower (45 m on a limestone podium) where the base city has its stepped
# skyscraper, and the refinery flare stack (35 m on a 13 by 10.5 m pad) where it has its works and
# chimney. The water tower park, covered market and bus shelter stay. Writes
# modern-town-big-b-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import build_town_modern_big_b as base  # noqa: E402

LANDMARKS = {
    'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: lv.mashrabiya_tower(
        ms, None, 2.5, 2.2, 4.5, w=1.0, d=0.8, podium=(1.35, 1.15, 0.15)),
    'factory': lambda ms, x, y, w, d, h=0.42, teeth=4, yaw=0, rise=0.16, chimney=None: lv.flare_stack(
        ms, None, x, y, w, d, top_z=3.5),
}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
