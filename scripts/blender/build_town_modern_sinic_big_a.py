# scripts/blender/build_town_modern_sinic_big_a.py
# Modern Age `town-big-a` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_big_a.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, a 50 m TV tower where the base city has its glass office tower and the
# wave-roofed railway station on its diagonal where it has its station. The stadium, the water
# tower among the houses and the market stay. Writes modern-town-big-a-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_big_a.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_big_a as base  # noqa: E402

LANDMARKS = {
    'glass_tower': lambda ms, x, y, tiers, podium=None, crown=0.06: sm.pearl_tower(ms, -2.35, 2.35, H=5.0, base_r=0.52),
    'station': lambda ms, x, y, length=2.0, yaw=0, width=0.42, tracks=2, track_len=None: sm.rail_station(
        ms, 2.4, 2.4, yaw=-45, length=2.0, hall_l=0.9, hall_d=0.6, eave=0.32, crown=0.6, tracks=(-0.2, 0.2),
        platforms=((0.0, 0.22),), track_len=2.5, front_extra=0.14),
}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS)
