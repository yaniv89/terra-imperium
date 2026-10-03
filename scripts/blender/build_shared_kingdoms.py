# scripts/blender/build_shared_kingdoms.py
# The Kingdoms Age shared file (plans/model-brief-for-claude.md, section 4.2): the palaces
# `palace-small` (a motte with a timber keep) and `palace` (a stone keep with four corner towers),
# the stone wall rings with round towers `walls-small`, `walls-medium`, `walls-big`, the outpost's
# `colony-camp` and the fields `field-1` (rye), `field-2` (apple orchard), `field-3` (pasture),
# `field-4` (flax), from plans/art/towns/kingdoms/<id>/reference-sheet.png, in one GLB with one
# atlas.
#
#   python scripts/blender/build_shared_kingdoms.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_kingdoms as tk  # noqa: E402

ITEMS = [
    ('palace-small', tk.palace_small, None),
    ('palace', tk.palace, None),
    ('walls-small', tk.walls_small, None),
    ('walls-medium', tk.walls_medium, None),
    ('walls-big', tk.walls_big, None),
    ('colony-camp', tk.colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5, mat='grass')),
    ('field-1', tk.field_1, dict(tb.FIELD_GROUND, rx=0.74, ry=0.54)),
    ('field-2', tk.field_2, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64, mat='grass')),
    ('field-3', tk.field_3, dict(tb.FIELD_GROUND, rx=0.74, ry=0.64, mat='grass')),
    ('field-4', tk.field_4, dict(tb.FIELD_GROUND, rx=0.84, ry=0.54)),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    tt.main_file('shared-kingdoms', [it for it in ITEMS if not only or it[0] in only])
