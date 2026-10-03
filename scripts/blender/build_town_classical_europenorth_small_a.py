# scripts/blender/build_town_classical_europenorth_small_a.py
# Classical Age `town-small-a`, the northern variant of the Europe kit (art spec 3b: Europe,
# classical, "variant for the north: a Celtic hillfort hall"): the town of
# build_town_classical_europe_small_a.py with the Celtic hillfort hall
# (plans/art/kits/europe/classical/landmark-north) in place of the Roman temple.
#
#   python scripts/blender/build_town_classical_europenorth_small_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402,F401
import ti_europe_classical_north as en  # noqa: E402
import ti_europe_classical as ec  # noqa: E402
import build_town_classical_europe_small_a as base  # noqa: E402

NAME = base.NAME
FILE = 'classical-town-small-a-europenorth'
GROUND = base.GROUND


def layout(ms, rng):
    orig = ec.roman_temple
    ec.roman_temple = lambda ms, rng, x, y, *a, **kw: en.celtic_hall(ms, rng, x, y, w=0.5, d=0.7, top=0.62, bank=0.08, yaw=kw.get('yaw'))
    try:
        base.layout(ms, rng)
    finally:
        ec.roman_temple = orig


if __name__ == '__main__':
    ec.main(FILE, NAME, layout, GROUND)
