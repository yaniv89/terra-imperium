# scripts/blender/build_town_kingdoms_sinic_small_b.py
# Kingdoms Age `town-small-b` in the Sinic kit (China, Taiwan, Hong Kong, Macau) (art spec 3b; plans/art/kits/sinic/kingdoms/):
# the layout of build_town_kingdoms_small_b.py as recorded call by call in
# build_town_kingdoms_europe_small_b.py, built with ti_sinic_kingdoms.py: grey-brick cottages,
# courtyard houses and walled noble compounds chosen by plot size, grey stone lanes, canvas stalls,
# and the drum tower in the keep spot (call 2).
#
#   python scripts/blender/build_town_kingdoms_sinic_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_kingdoms as sk  # noqa: E402

STYLE, SIZE, VARIANT = 'sinic', 'small', 'b'
# call index -> the kit piece standing there: a landmark kind, 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {2: 'drum'}

if __name__ == '__main__':
    sk.town_main(STYLE, SIZE, VARIANT, OVERRIDE)
