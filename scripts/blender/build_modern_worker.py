# scripts/blender/build_modern_worker.py
# Modern worker (a present-day engineer labourer), quality pass of 2026-10-14 on the shared parts of
# ti_figure.py; replaces m_worker of build_units_modern.py:
#   blender -b --factory-startup -P scripts/blender/build_modern_worker.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the hard hat (HardHat, HardHatBrim,
# HardHatRidge), the vest (HiVis, HiVisStripe0 and 1), the tool bag (ToolBag, ToolBagHandle, Tool0-2)
# and the sledgehammer (HammerShaft, HammerHead) on the right hand's attachment; rest pose only (no
# clips). The look follows plans/art/concepts/oct13/units-modern-set.png (design reference only):
#   - a white hard hat with a front peak and a ridge (no Team: white is what says builder at 20 px)
#   - a Team high-visibility vest (Spine and Chest: the battle dyes it) with pale reflective bands round
#     the body and up the front
#   - a blue-grey work shirt with long sleeves, dark work trousers with cargo pockets, tan work gloves,
#     brown work boots, a leather tool belt with a tool bag at the right hip
#   - leaning on a sledgehammer stood on its head in front of him, both fists on the top of the handle
#     (the handle upright and thin, so the far detail level keeps it)
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/modern-worker/; copy the GLB to src/assets/units/modern-worker.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_worker_clips as W  # noqa: E402

UID = 'modern-worker'
arm = F.start({'Skin': 'C99472', 'Hair': '2E241C', 'Shirt': '56677A', 'Trousers': '2C3440', 'Boot': '6A4A2E', 'Sole': '231C16', 'HardHat': 'ECEAE2',
               'Reflect': 'DCE0E0', 'Leather': '553623', 'Glove': 'A88A5A', 'Gear': '2A2A27', 'Wood': '9A7448', 'Metal': ('7C8086', .45, .75)}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Boot', hose='Trousers')
F.combat_boots('Boot', top=.158)
F.arms(long='Shirt', pad=.007)
F.head()
F.hair(crown=False)
F.cargo_trousers('Trousers', pads=None)

# ---- shirt, vest, tool belt ---------------------------------------------------------------------------
F.torso('Shirt', 'Shirt', grow=.006, chest=.004)
F.hi_vis_vest('HiVis', 'Team', 'Reflect')
F.band('ToolBelt', 'Leather', .470, .498, grow=.016, bone='Hips')
box('ToolBag', (-.128, -.010, .430), (.050, .110, .080), 'Leather', 'Hips')
box('ToolBagHandle', (-.128, -.010, .482), (.010, .080, .024), 'Leather', 'Hips')
for k in range(3):
    box(f'Tool{k}', (-.128, -.040 + k * .030, .490), (.010, .010, .050), 'Metal', 'Hips')

# ---- the hard hat ------------------------------------------------------------------------------------------
F.hard_hat('HardHat', 'HardHat')

# ---- leaning on the sledgehammer: both fists on the top of the handle, then made the rest pose ---------------------
HX, HY = 0., -.182
F.hold('R', (HX, HY, .630), pole=(-1, .5, -.6))
F.hold('L', (HX, HY, .684), pole=(1, .5, -.6))
F.bake_rest()
F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
F.fist('L', None, (0, 0, 1), half=.022, mat='Glove')

# ---- the sledgehammer (the right hand's attachment), stood on its head --------------------------------------------
P = 'Prop_R'
tube('HammerShaft', [((HX, HY, .070), .0125, P), ((HX, HY, .725), .0110, P)], 'Wood', 5, attachment=True)
box('HammerHead', (HX, HY, .042), (.132, .046, .050), 'Metal', P, True)

# ---- work tools and clips (2026-10-14, ti_worker_clips.py): the sledgehammer moves from Prop_R to its own bone
# Tool_Held (same shape, same rest pose) and builds and repairs; a modern axe, pick and sickle (black
# grips) on Tool_Axe, Tool_Pick and Tool_Sickle, hidden (scale 0) but in the clips that use them. Walking
# he carries the sledgehammer on his right shoulder; Carry steadies a load on the left shoulder.
from mathutils import Vector  # noqa: E402
W.finish_worker(UID, 'Engineer: a white hard hat, a Team high-visibility vest with pale reflective bands, a blue-grey work shirt, dark work trousers with cargo pockets, '
                'tan gloves, brown work boots, a tool belt and bag, leaning on a sledgehammer stood on its head; modern work tools in the clips',
                'modern', 'sledge', held_frame=(Vector((0, 0, -1)), Vector((1, 0, 0))), build_tool='Held', notes={'role': 'worker'})
