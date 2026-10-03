# scripts/blender/build_shared_gunpowder.py
# The Gunpowder Age shared file (plans/model-brief-for-claude.md, section 4.2): the manor
# `palace-small`, the domed baroque `palace`, the bastioned traces `walls-small`, `walls-medium`,
# `walls-big`, the outpost's `colony-camp` and the fields `field-1` (wheat), `field-2` (pears),
# `field-3` (pasture), `field-4` (potatoes), from plans/art/towns/gunpowder/<id>/
# reference-sheet.png, in one GLB with one atlas.
#
#   python scripts/blender/build_shared_gunpowder.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_gunpowder as gp  # noqa: E402

ITEMS = [
    ('palace-small', gp.palace_small, None),
    ('palace', gp.palace, None),
    ('walls-small', gp.walls_small, None),
    ('walls-medium', gp.walls_medium, None),
    ('walls-big', gp.walls_big, None),
    ('colony-camp', gp.colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5, mat='gp_meadow')),
    ('field-1', gp.field_1, dict(tb.FIELD_GROUND, rx=0.74, ry=0.54)),
    ('field-2', gp.field_2, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64, mat='gp_meadow')),
    ('field-3', gp.field_3, dict(tb.FIELD_GROUND, rx=0.74, ry=0.64, mat='grass')),
    ('field-4', gp.field_4, dict(tb.FIELD_GROUND, rx=0.84, ry=0.54)),
]

if __name__ == '__main__':
    only = [n for n in os.environ.get('ONLY_ITEMS', '').split(',') if n]
    items = [it for it in ITEMS if not only or it[0] in only]
    tt.main_file('shared-gunpowder', items)
