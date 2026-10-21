# scripts/blender/build_modern20_worker.py
# The 20th-century Modern worker (eight-ages plan U81), a mid-century labourer on the shared parts of
# ti_figure.py, with the worker clips of ti_worker_clips.py (the 'modern' tool style; the sledgehammer moves to
# its own bone Tool_Held as in build_modern_worker.py):
#   blender -b --factory-startup -P scripts/blender/build_modern20_worker.py
# He must not be taken for the present-day engineer (information-worker: hard hat, high-visibility vest), so:
#   - a flat peaked cloth cap with a Team band, a collarless work shirt with the sleeves rolled up
#   - a Team waistcoat over it, brown corduroy trousers with braces, a leather belt, hobnail work boots
#   - leaning on a sledgehammer stood on its head, both fists on the top of the handle
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/modern-worker/; copy the GLB to src/assets/units/modern-worker.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402
import ti_modern20 as M  # noqa: E402

UID = 'modern-worker'
arm = F.start({'Skin': 'C99472', 'Hair': '2E241C', 'Shirt': 'C8BCA0', 'Trousers': '5A4632', 'Boot': '3A2A1E', 'Sole': '1E1814', 'Wool': '4A4A44',
               'Leather': '553623', 'Gear': '2A2A27', 'Wood': '9A7448', 'Metal': ('7C8086', .45, .75)}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Boot', hose='Trousers')
F.combat_boots('Boot', top=.130)
F.arms(sleeve='Shirt')
F.head()
F.hair(crown=False)
F.skirt('TrouserSeat', 'Trousers', low=.450, grow=-.014, sides=10)
for s in ('L', 'R'):  # the sleeves rolled to the elbow
    e = arm.data.bones['Forearm_' + s].head_local
    tube('Roll_' + s, [((e.x, e.y, e.z + .030), .040, 'Arm_' + s), ((e.x, e.y, e.z - .004), .040, 'Arm_' + s)], 'Shirt', 6)

# ---- shirt, Team waistcoat, belt -----------------------------------------------------------------------------
F.torso('Shirt', 'Shirt', grow=.006, chest=.004)
F.torso('Waistcoat', 'Team', grow=.014, chest=.010, sides=10)
F.band('Belt', 'Leather', .500, .526, grow=.018, bone='Spine')
for k in range(3):  # waistcoat buttons
    box(f'Button{k}', (0, -.124, .560 + k * .050), (.012, .006, .012), 'Gear', 'Spine' if k < 2 else 'Chest')

# ---- the flat cap ----------------------------------------------------------------------------------------
M.field_cap('Cap', 'Wool', 'Team')

# ---- leaning on the sledgehammer: both fists on the top of the handle, then made the rest pose ---------------------
HX, HY = 0., -.182
F.hold('R', (HX, HY, .630), pole=(-1, .5, -.6))
F.hold('L', (HX, HY, .684), pole=(1, .5, -.6))
F.bake_rest()
F.fist('R', None, (0, 0, 1), half=.022)
F.fist('L', None, (0, 0, 1), half=.022)
P = 'Prop_R'
tube('HammerShaft', [((HX, HY, .070), .0125, P), ((HX, HY, .725), .0110, P)], 'Wood', 5, attachment=True)
box('HammerHead', (HX, HY, .042), (.132, .046, .050), 'Metal', P, True)

W.finish_worker(UID, 'Labourer (20th century): a flat cloth cap with a Team band, a collarless work shirt with rolled sleeves, a Team waistcoat, brown corduroy '
                'trousers, a leather belt, work boots, leaning on a sledgehammer stood on its head; work tools in the clips',
                'modern', 'sledge', held_frame=(Vector((0, 0, -1)), Vector((1, 0, 0))), build_tool='Held', notes={'role': 'worker'})
