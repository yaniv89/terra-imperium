# scripts/blender/build_shared_modern.py
# The Modern Age shared file (plans/model-brief-for-claude.md, section 4.2): the town hall
# `palace-small`, the parliament `palace`, the earthwork, bunker and barbed-wire perimeters
# `walls-small`, `walls-medium`, `walls-big`, the prefab outpost `colony-camp` and the fields
# `field-1` (wheat), `field-2` (apple orchard), `field-3` (pasture), `field-4` (polytunnel market
# garden), from plans/art/towns/modern/<id>/reference-sheet.png, in one GLB with one atlas.
#
#   python scripts/blender/build_shared_modern.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_modern as md  # noqa: E402

ITEMS = [
    ('palace-small', md.palace_small, None),
    ('palace', md.palace, None),
    ('walls-small', md.walls_small, None),
    ('walls-medium', md.walls_medium, None),
    ('walls-big', md.walls_big, None),
    ('colony-camp', md.colony_camp, dict(rx=0.98, ry=0.88, square=None, power=5)),
    ('field-1', md.field_1, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64)),
    ('field-2', md.field_2, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64, mat='md_lawn')),
    ('field-3', md.field_3, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64, mat='md_lawn')),
    ('field-4', md.field_4, dict(tb.FIELD_GROUND, rx=0.84, ry=0.64)),
]

if __name__ == '__main__':
    if os.environ.get('ONLY'):
        keep = os.environ['ONLY'].split(',')
        ITEMS[:] = [it for it in ITEMS if it[0] in keep]
    tt.main_file('shared-modern', ITEMS)
