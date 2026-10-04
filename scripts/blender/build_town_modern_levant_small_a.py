# scripts/blender/build_town_modern_levant_small_a.py
# Modern Age `town-small-a` with the Levant kit (plans/art/kits/levant/modern/): the base layout
# of build_town_modern_small_a.py with the kit's poor, common and rich villas on its spots, date
# palms for its trees, travertine paving, and a compact refinery flare stack (22 m, one pressure
# vessel) where the base town has its water tower. Writes modern-town-small-a-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import build_town_modern_small_a as base  # noqa: E402

LANDMARKS = {'water_tower': lambda ms, x, y, top=1.2, r=0.16, tank_h=0.2: lv.flare_stack(ms, None, -1.45, 1.64, 0.52, 0.52, top_z=2.2, compact=True)}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
