# scripts/blender/build_shared_classical_mesopotamia.py
# The Mesopotamian Classical shared file (audit I215): what the theme's towns replace of
# shared-classical.glb. `palace-small` a governor's residence (baked brick, stepped merlons, a glazed
# door surround), `palace` the throne room of Babylon's Southern Palace in small (its front in blue
# glazed brick behind a court and a glazed gate), and the wall rings `walls-small`, `walls-medium`,
# `walls-big`: the walls of Babylon (battered mud brick with stepped merlons, a blue glazed band at
# the foot, towers, a gate between glazed towers with team banners). The colony camp and the
# fields stay the base file's.
#
#   blender -b --factory-startup -P scripts/blender/build_shared_classical_mesopotamia.py -- <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_mesopotamia_classical as mc  # noqa: E402

ITEMS = [
    ('palace-small', mc.residence, None),
    ('palace', mc.throne_palace, None),
    ('walls-small', mc.walls_small, None),
    ('walls-medium', mc.walls_medium, None),
    ('walls-big', mc.walls_big, None),
]

if __name__ == '__main__':
    tt.main_file('shared-classical-mesopotamia', ITEMS)
