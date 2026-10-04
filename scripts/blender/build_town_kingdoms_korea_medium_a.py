# scripts/blender/build_town_kingdoms_korea_medium_a.py
# Kingdoms Age `town-medium-a` in the Sinic kit's Korean variant (North and South Korea) (art spec 3b; plans/art/kits/sinic/kingdoms/):
# the layout of build_town_kingdoms_medium_a.py as recorded call by call in
# build_town_kingdoms_europe_medium_a.py, built with ti_sinic_kingdoms.py: grey-brick cottages,
# courtyard houses and walled noble compounds chosen by plot size, grey stone lanes, canvas stalls,
# and the Korean palace hall in the church spot (call 2); the drum tower in the keep spot (call 3).
#
#   python scripts/blender/build_town_kingdoms_korea_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_kingdoms as sk  # noqa: E402

STYLE, SIZE, VARIANT = 'korea', 'medium', 'a'
# call index -> the kit piece standing there: a landmark kind, 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {2: ('korea', dict(x=-1.9, y=1.92)), 3: 'drum'}

if __name__ == '__main__':
    sk.town_main(STYLE, SIZE, VARIANT, OVERRIDE)
