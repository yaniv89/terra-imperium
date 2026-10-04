# scripts/blender/build_town_kingdoms_korea_small_a.py
# Kingdoms Age `town-small-a` in the Sinic kit's Korean variant (North and South Korea) (art spec 3b; plans/art/kits/sinic/kingdoms/):
# the layout of build_town_kingdoms_small_a.py as recorded call by call in
# build_town_kingdoms_europe_small_a.py, built with ti_sinic_kingdoms.py: grey-brick cottages,
# courtyard houses and walled noble compounds chosen by plot size, grey stone lanes, canvas stalls,
# and the palace hall in the base landmark spot (call 1).
#
#   python scripts/blender/build_town_kingdoms_korea_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_kingdoms as sk  # noqa: E402

STYLE, SIZE, VARIANT = 'korea', 'small', 'a'
# call index -> the kit piece standing there: a landmark kind, 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {1: 'korea'}

if __name__ == '__main__':
    sk.town_main(STYLE, SIZE, VARIANT, OVERRIDE)
