# scripts/blender/build_shared_classical.py
# The Classical Age shared file (plans/model-brief-for-claude.md, section 4.2): the wall rings
# `walls-small`, `walls-medium`, `walls-big`, the outpost's `colony-camp` and the fields `field-1`
# (wheat), `field-2` (olives), `field-3` (pasture), `field-4` (vineyard), from
# plans/art/towns/classical/<id>/reference-sheet.png, in one GLB with one atlas. The palaces join
# it when their sheets arrive.
#
#   python scripts/blender/build_shared_classical.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_classical as tc  # noqa: E402

ITEMS = [
    ('walls-small', tc.walls_small, None),
    ('walls-medium', tc.walls_medium, None),
    ('walls-big', tc.walls_big, None),
    ('colony-camp', tc.colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5)),
    ('field-1', tc.field_1, dict(tb.FIELD_GROUND, rx=0.74, ry=0.54)),
    ('field-2', tc.field_2, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64)),
    ('field-3', tc.field_3, dict(tb.FIELD_GROUND, rx=0.74, ry=0.64, mat='grass')),
    ('field-4', tc.field_4, dict(tb.FIELD_GROUND, rx=0.84, ry=0.54)),
]

if __name__ == '__main__':
    tt.main_file('shared-classical', ITEMS)
