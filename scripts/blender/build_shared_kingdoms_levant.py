# scripts/blender/build_shared_kingdoms_levant.py
# `shared-kingdoms-levant.glb`: the Levant kit's palace-small, palace and walls-medium for the
# Kingdoms Age (plans/art/kits/levant/kingdoms/palace-small, palace, walls-medium), which the game
# takes for towns on Levant land (walls) and for Levant owners (palaces) in place of the base
# shared-kingdoms objects.
#
#   [ONLY_ITEMS=palace,...] python scripts/blender/build_shared_kingdoms_levant.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_levant_kingdoms as lk  # noqa: E402

ITEMS = [
    ('palace-small', lk.palace_small, None),
    ('palace', lk.palace, None),
    ('walls-medium', lk.walls_medium, None),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    tt.main_file('shared-kingdoms-levant', [it for it in ITEMS if not only or it[0] in only])
