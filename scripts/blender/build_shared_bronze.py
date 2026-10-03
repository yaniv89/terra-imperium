# scripts/blender/build_shared_bronze.py
# The Bronze Age shared file (plans/model-brief-for-claude.md, section 4.2): the objects a town of
# that age borrows, in one GLB with one atlas: `palace-small` and `palace` (from
# plans/art/palaces/bronze/<id>/approval.png), the wall rings `walls-small`, `walls-medium`,
# `walls-big` and the outpost's `colony-camp` (plans/art/towns/bronze/<id>/reference-sheet.png).
# The fields join it later.
#
#   python scripts/blender/build_shared_bronze.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402

ITEMS = [
    ('palace-small', tb.palace_small, None),
    ('palace', tb.palace, None),
    ('walls-small', tb.walls_small, None),
    ('walls-medium', tb.walls_medium, None),
    ('walls-big', tb.walls_big, None),
    ('colony-camp', tb.colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5)),
]

if __name__ == '__main__':
    tt.main_file('shared-bronze', ITEMS)
