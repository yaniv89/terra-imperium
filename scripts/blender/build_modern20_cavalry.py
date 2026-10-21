# scripts/blender/build_modern20_cavalry.py
# The 20th-century Modern cavalry (eight-ages plan U81: Tanks), a generic mid-century medium tank on the
# tracked rig of ti_mounts.tank (Hull, Track_L/R, Turret, Barrel) with the base tank's clips
# (ti_vehicle_clips.tank: Idle, Move, Fire, Hit, Wreck), finished as the signature tanks are
# (build_signature_special.tank_unit; that module runs its own build on import, so the steps are here):
#   blender -b --factory-startup -P scripts/blender/build_modern20_cavalry.py
# Of no real army or model: a riveted hull without side skirts, five big road wheels a side, a tall
# rounded turret with a short gun and a cupola, olive drab, a Team stripe along the deck edge and a Team
# band on the turret. Shorter and taller than the present-day main battle tank (information-cavalry).
# Outputs go to art-build/units/modern-cavalry/; copy the GLB to src/assets/units/modern-cavalry.glb.
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402

UID = 'modern-cavalry'
MACHINE_BUDGET = 4000  # unitScale.test.js holds machines to 4,000
COLORS = {'Skin': 'C99472', 'Cloth': '5B5E3E', 'Leather': '2A2A28', 'Metal': ('4A4C48', .45, .6), 'Wood': '4A4038'}
LOOK = ('a generic mid-century medium tank: a riveted olive hull without skirts, five big road wheels a side, a tall rounded turret with a '
        'short gun and a cupola, a Team stripe along the deck edge and a Team band on the turret, no markings')

os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units')
lib.reset()
parts, info = tm.tank('Tank', hull_len=1.50, hull_w=.74, track_w=.24, hull_z=(.14, .40), deck_w=1.02, wheels=5, wheel_r=.13,
                      turret_at=(0, .02), turret_z=.46, turret_h=.26, turret_len=.66, turret_w=.60, gun_len=.62, gun_r=.030,
                      skirts=False, glacis=.38, wedge=.10, rivets=True, turret_top=.92, basket=False)
tm.enlarge(info['rig'], (1.05, 1.4))
state = {}


def clips():
    state['table'], state['order'] = VC.tank(parts)
    return state['table']


lib.finish(UID, parts, COLORS, {'name': 'Medium tank (20th century)', 'role': 'cavalry', 'rig': 'tank', 'look': LOOK,
                                'recipe': 'build_modern20_cavalry.py (eight-ages plan U81, 2026-10-20)'}, 5000, False, clips=clips)
tm.mark_machine(UID)
VC.write_options(UID, state['table'], state['order'])
tris = u.scene_triangles()
print('TRIS', UID, tris, flush=True)
assert tris <= MACHINE_BUDGET, (UID, tris)
