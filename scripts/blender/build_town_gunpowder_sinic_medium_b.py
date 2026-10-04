# scripts/blender/build_town_gunpowder_sinic_medium_b.py
# Gunpowder Age `town-medium-b` with the Sinic kit (plans/art/kits/sinic/gunpowder/): the base
# layout of build_town_gunpowder_medium_b.py with the kit's poor cottages, courtyard houses and
# siheyuan on its spots, the barbican gate for the town hall and the yellow-roof temple for the
# churches and windmills; with `japan` Edo machiya, row houses and walled houses, the Edo castle
# keep for the town hall and a grey-tiled temple. Writes gunpowder-town-medium-b-<mode>.glb.
#
#   python scripts/blender/build_town_gunpowder_sinic_medium_b.py <out_dir> [atlas_px] [sinic|japan]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_gunpowder as sg  # noqa: E402
import build_town_gunpowder_medium_b as base  # noqa: E402

REPLACE = None

if __name__ == '__main__':
    sg.main(base.NAME, base.layout, base.GROUND, replace=REPLACE)
