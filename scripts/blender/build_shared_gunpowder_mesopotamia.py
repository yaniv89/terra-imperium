# scripts/blender/build_shared_gunpowder_mesopotamia.py
# The Mesopotamian Gunpowder shared file (audit I215 part 2): palace-small (a pasha's courtyard
# house with shanasheel oriels, a wind catcher and a tiled dome), palace (the serai: an arcaded
# two-storey government house with a clock tower) and brick wall rings with round bastions
# (walls-small, -medium, -big). The camp and fields stay the base file's.
#
#   blender -b --factory-startup -P scripts/blender/build_shared_gunpowder_mesopotamia.py -- <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_gunpowder as mg  # noqa: E402

ITEMS = [
    ('palace-small', mg.palace_small, None),
    ('palace', mg.palace, None),
    ('walls-small', mg.walls_small, None),
    ('walls-medium', mg.walls_medium, None),
    ('walls-big', mg.walls_big, None),
]

if __name__ == '__main__':
    tt.main_file('shared-gunpowder-mesopotamia', ITEMS)
