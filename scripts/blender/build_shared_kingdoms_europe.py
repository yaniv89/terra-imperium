# scripts/blender/build_shared_kingdoms_europe.py
# `shared-kingdoms-europe.glb`: the Europe kit's palace-small, palace and walls-medium for the
# Kingdoms Age (plans/art/kits/europe/kingdoms/palace-small, palace, walls-medium), which the game
# takes for towns on European land in place of the base shared-kingdoms objects.
#
#   [ONLY_ITEMS=palace,...] python scripts/blender/build_shared_kingdoms_europe.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_europe_kingdoms as ek  # noqa: E402

ITEMS = [
    ('palace-small', ek.palace_small, None),
    ('palace', ek.palace, None),
    ('walls-medium', ek.walls_medium, None),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    tt.main_file('shared-kingdoms-europe', [it for it in ITEMS if not only or it[0] in only])
