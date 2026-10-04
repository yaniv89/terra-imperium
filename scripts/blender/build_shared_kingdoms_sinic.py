# scripts/blender/build_shared_kingdoms_sinic.py
# `shared-kingdoms-sinic.glb`: the Sinic kit's palace-small, palace and walls-medium for the
# Kingdoms Age (plans/art/kits/sinic/kingdoms/palace-small, palace, walls-medium), which the game
# takes for towns on Sinic land (China, Taiwan, Hong Kong, Macau, the Koreas, Japan) in place of
# the base shared-kingdoms objects.
#
#   [ONLY_ITEMS=palace,...] python scripts/blender/build_shared_kingdoms_sinic.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_sinic_kingdoms as sk  # noqa: E402

ITEMS = [
    ('palace-small', sk.palace_small, None),
    ('palace', sk.palace, None),
    ('walls-medium', sk.walls_medium, None),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    tt.main_file('shared-kingdoms-sinic', [it for it in ITEMS if not only or it[0] in only])
