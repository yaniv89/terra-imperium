# scripts/blender/build_shared_kingdoms_mesopotamia.py
# The Mesopotamian Kingdoms shared file (audit I215 part 2): palace-small (a governor's courtyard
# house with a tiled iwan and a turquoise dome), palace (an Abbasid palace's great iwan between
# blind-arcaded wings, a turquoise dome behind) and the round city's brick wall rings with
# half-round towers (walls-small, -medium, -big). The camp and fields stay the base file's.
#
#   blender -b --factory-startup -P scripts/blender/build_shared_kingdoms_mesopotamia.py -- <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_kingdoms as mk  # noqa: E402

ITEMS = [
    ('palace-small', mk.palace_small, None),
    ('palace', mk.palace, None),
    ('walls-small', mk.walls_small, None),
    ('walls-medium', mk.walls_medium, None),
    ('walls-big', mk.walls_big, None),
]

if __name__ == '__main__':
    tt.main_file('shared-kingdoms-mesopotamia', ITEMS)
