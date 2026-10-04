# scripts/blender/build_shared_kingdoms_indic.py
# `shared-kingdoms-indic.glb`: the Indic kit's palace-small, palace and walls-medium for the
# Kingdoms Age (plans/art/kits/indic/kingdoms/palace-small, palace, walls-medium), which the game
# takes for towns on Indic land in place of the base shared-kingdoms objects.
#
#   [ONLY_ITEMS=palace,...] python scripts/blender/build_shared_kingdoms_indic.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_indic_kingdoms as ink  # noqa: E402

ITEMS = [
    ('palace-small', ink.palace_small, None),
    ('palace', ink.palace, None),
    ('walls-medium', ink.walls_medium, None),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    tt.main_file('shared-kingdoms-indic', [it for it in ITEMS if not only or it[0] in only])
