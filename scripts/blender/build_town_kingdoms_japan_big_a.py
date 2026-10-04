# scripts/blender/build_town_kingdoms_japan_big_a.py
# Kingdoms Age `town-big-a` in the Sinic kit's Japanese variant (Japan) (art spec 3b; plans/art/kits/sinic/kingdoms/):
# the layout of build_town_kingdoms_big_a.py as recorded call by call in
# build_town_kingdoms_europe_big_a.py, built with ti_sinic_kingdoms.py: grey-brick cottages,
# courtyard houses and walled noble compounds chosen by plot size, grey stone lanes, canvas stalls,
# and the Japanese pagoda in the church spot (call 6); the castle tenshu in the keep spot (call 7).
#
#   python scripts/blender/build_town_kingdoms_japan_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_kingdoms as sk  # noqa: E402

STYLE, SIZE, VARIANT = 'japan', 'big', 'a'
# call index -> the kit piece standing there: a landmark kind, 'skip', a house kind, or (kind, dict of x, y, s, top, yaw)
OVERRIDE = {6: 'jpagoda', 7: 'tenshu'}

if __name__ == '__main__':
    sk.town_main(STYLE, SIZE, VARIANT, OVERRIDE)
