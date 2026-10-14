# scripts/blender/build_shared_bronze_mesopotamia.py
# The Mesopotamian Bronze shared file (audit I215): what the theme's capitals replace of
# shared-bronze.glb. `palace-small` is the marsh chief's great reed guest hall (a mudhif), `palace`
# the royal palace (an e-gal: a buttressed enclosure, a towered gate, the high throne hall). The wall
# rings, the colony camp and the fields stay the base file's (already mud brick and barley: the
# close view reads a regional shared file first and the base one for what it lacks).
#
#   blender -b --factory-startup -P scripts/blender/build_shared_bronze_mesopotamia.py -- <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_bronze as mb  # noqa: E402

ITEMS = [
    ('palace-small', mb.mudhif_hall, None),
    ('palace', mb.egal_palace, None),
]

if __name__ == '__main__':
    tt.main_file('shared-bronze-mesopotamia', ITEMS)
