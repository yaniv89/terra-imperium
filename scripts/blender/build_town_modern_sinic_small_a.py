# scripts/blender/build_town_modern_sinic_small_a.py
# Modern Age `town-small-a` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_small_a.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, and a 20 m TV tower (the Pearl tower's spheres, columns and legs) where the base
# town has its water tower. Writes modern-town-small-a-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_small_a as base  # noqa: E402

LANDMARKS = {'water_tower': lambda ms, x, y, top=1.2, r=0.16, tank_h=0.2: sm.pearl_tower(ms, -1.35, 1.55, H=2.0, base_r=0.22)}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS, walkup_extra=0, tower_extra=1, poor_share=0.3)
