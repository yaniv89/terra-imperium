# scripts/blender/build_town_modern_sinic_big_b.py
# Modern Age `town-big-b` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_big_b.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, a 50 m TV tower where the base city has its stepped skyscraper and the
# wave-roofed railway station (facing the plaza, tracks running east to west) where it has its
# works and chimney. The water tower park, covered market and bus shelter stay. Writes
# modern-town-big-b-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_big_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_big_b as base  # noqa: E402

LANDMARKS = {
    'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: sm.pearl_tower(ms, 2.35, 1.95, H=5.0, base_r=0.52),
    'factory': lambda ms, x, y, w, d, h=0.42, teeth=4, yaw=0, rise=0.16, chimney=None: sm.rail_station(
        ms, -2.35, -2.35, yaw=180, length=2.4, hall_l=0.95, hall_d=0.6, eave=0.32, crown=0.6, tracks=(-0.2, 0.2),
        platforms=((0.0, 0.22),), track_len=2.5, front_extra=0.14),
}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS, clear=((-3.7, -2.75, -1.0, -1.95),))
