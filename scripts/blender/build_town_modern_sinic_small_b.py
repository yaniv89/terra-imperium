# scripts/blender/build_town_modern_sinic_small_b.py
# Modern Age `town-small-b` with the Sinic kit (plans/art/kits/sinic/modern/): the base layout of
# build_town_modern_small_b.py with the kit's hutong houses, walk-ups and towers on its spots,
# granite paving, a small railway station (the wave-roofed glass hall, a platform and one track
# behind it) where the base town has its glazed canopy, and an 18 m TV tower where it has its clock
# tower. The benches under the old canopy go. Writes modern-town-small-b-sinic.glb.
#
#   python scripts/blender/build_town_modern_sinic_small_b.py <out_dir> [atlas_px]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_sinic_modern as sm  # noqa: E402
import build_town_modern_small_b as base  # noqa: E402

LANDMARKS = {
    'canopy': lambda ms, x, y, w, d, h=0.3, yaw=0, glass_walls=True: sm.rail_station(
        ms, 0.86, 1.42, length=1.1, hall_l=0.62, hall_d=0.4, eave=0.22, crown=0.4, tracks=(0.38,),
        platforms=((0.26, 0.1),), track_len=1.1, columns=3, front_extra=0.12),
    'clock_tower': lambda ms, x, y, h=1.0, s=0.16: sm.pearl_tower(ms, 1.62, 1.48, H=1.8, base_r=0.2),
}

if __name__ == '__main__':
    sm.main(base.NAME, base.layout, base.GROUND, landmarks=LANDMARKS, walkup_extra=0, tower_extra=1, poor_share=0.3,
            clear=((0.5, 1.2, 1.4, 1.7),))
