# scripts/blender/build_town_kingdoms_japan_medium_b.py
# Kingdoms Age `town-medium-b` in the Sinic kit's Japanese variant (Japan) (art spec 3b; plans/art/kits/sinic/kingdoms/):
# the layout of build_town_kingdoms_medium_b.py as recorded call by call in
# build_town_kingdoms_europe_medium_b.py, built with ti_sinic_kingdoms.py: grey-brick cottages,
# courtyard houses and walled noble compounds chosen by plot size, grey stone lanes, canvas stalls,
# and the Japanese pagoda in the church spot (call 4); the castle tenshu in the second landmark spot (call 21).
#
#   python scripts/blender/build_town_kingdoms_japan_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_kingdoms as sk  # noqa: E402

STYLE, SIZE, VARIANT = 'japan', 'medium', 'b'
# call index -> the kit piece standing there: a landmark kind, 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {4: 'jpagoda', 21: 'tenshu'}

if __name__ == '__main__':
    sk.town_main(STYLE, SIZE, VARIANT, OVERRIDE)
