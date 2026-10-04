# scripts/blender/build_town_modern_levant_small_b.py
# Modern Age `town-small-b` with the Levant kit (plans/art/kits/levant/modern/): the base layout
# of build_town_modern_small_b.py with the kit's villas on its spots, date palms, travertine
# paving, and a small mashrabiya tower (15 m, four floors of curtain wall behind bronze screens)
# where the base town has its clock tower; the glazed canopy beside it is shortened to make room.
# Writes modern-town-small-b-levant.glb.
#
#   python scripts/blender/build_town_modern_levant_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_levant_modern as lv  # noqa: E402
import ti_modern as md  # noqa: E402
import build_town_modern_small_b as base  # noqa: E402

ORIG_CANOPY = md.canopy


def canopy(ms, x, y, w, d, h=0.3, yaw=0, glass_walls=True):
    return ORIG_CANOPY(ms, x - 0.08, y, w - 0.16, d, h=h, yaw=yaw, glass_walls=glass_walls)


LANDMARKS = {
    'clock_tower': lambda ms, x, y, h=1.0, s=0.16: lv.mashrabiya_tower(ms, None, 1.56, 1.42, 1.5, w=0.32, d=0.3,
                                                                        podium=(0.36, 0.34, 0.05), palms=False),
    'canopy': canopy,
}

if __name__ == '__main__':
    lv.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
