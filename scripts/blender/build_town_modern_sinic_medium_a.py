# scripts/blender/build_town_modern_sinic_medium_a.py
# Modern Age `town-medium-a` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_medium_a.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, a 32 m TV tower where the base town has its glass office tower and the
# wave-roofed railway station (its hall, platform canopies and two tracks) where it has its
# station. The market tents and park stay. Writes modern-town-medium-a-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_medium_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_medium_a as base  # noqa: E402

LANDMARKS = {
    'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: sm.pearl_tower(ms, -2.2, 1.95, H=3.2, base_r=0.42),
    'station': lambda ms, x, y, length=2.0, yaw=0, width=0.42, tracks=2, track_len=None: sm.rail_station(
        ms, 1.25, 2.4, length=1.8, hall_l=0.8, hall_d=0.55, eave=0.3, crown=0.55, tracks=(-0.2, 0.2),
        platforms=((0.0, 0.22),), track_len=2.1, front_extra=0.12),
}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
