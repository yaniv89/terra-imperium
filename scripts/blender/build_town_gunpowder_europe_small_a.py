# scripts/blender/build_town_gunpowder_europe_small_a.py
# Gunpowder Age `town-small-a` with the Europe kit (plans/art/kits/europe/gunpowder/): the base
# layout of build_town_gunpowder_small_a.py with the kit's poor, common and rich houses on its
# spots, the arcaded town hall and the Baroque church as landmarks; with `colonies` the
# clapboard church and white clapboard houses beside Georgian brick ones (the lands of European
# settlement). Writes town-small-a-<mode>.glb.
#
#   python scripts/blender/build_town_gunpowder_europe_small_a.py <out_dir> [atlas_px] [europe|colonies]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_europe_gunpowder as eu  # noqa: E402
import build_town_gunpowder_small_a as base  # noqa: E402

CH = {'europe': eu.baroque_church, 'colonies': eu.clapboard_church}
REPLACE = None

if __name__ == '__main__':
    eu.main(base.NAME, base.layout, base.GROUND, max_storeys=2, replace=REPLACE)
