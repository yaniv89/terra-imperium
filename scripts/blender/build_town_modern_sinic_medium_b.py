# scripts/blender/build_town_modern_sinic_medium_b.py
# Modern Age `town-medium-b` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_medium_b.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, and a 32 m TV tower in the round green where the base town has its water tower.
# The works and chimney, market tents and north lawn stay. Writes modern-town-medium-b-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_medium_b as base  # noqa: E402

LANDMARKS = {'water_tower': lambda ms, x, y, top=1.2, r=0.16, tank_h=0.2: sm.pearl_tower(ms, 2.05, 2.05, H=3.2, base_r=0.4)}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
