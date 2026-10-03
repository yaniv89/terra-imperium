# scripts/blender/build_town_kingdoms_easteurope_medium_b.py
# Kingdoms Age `town-medium-b` in the Europe kit's eastern variant (the Orthodox east: Russia,
# Ukraine, Belarus, Moldova, Romania, Bulgaria, Serbia, North Macedonia, Montenegro): the town of
# build_town_kingdoms_europe_medium_b.py with the onion-domed church (plans/art/kits/europe/
# kingdoms/landmark-east) in place of the Gothic church.
#
#   python scripts/blender/build_town_kingdoms_easteurope_medium_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_europe_kingdoms as ek  # noqa: E402
import build_town_kingdoms_europe_medium_b as base  # noqa: E402

NAME = base.NAME
FILE = 'kingdoms-town-medium-b-easteurope'


def layout(ms, rng):
    ek.replay(ms, rng, base.CALLS, base.SIZE, east=True, override=base.OVERRIDE_EAST)


if __name__ == '__main__':
    ek.main(FILE, NAME, layout, base.GROUND)
