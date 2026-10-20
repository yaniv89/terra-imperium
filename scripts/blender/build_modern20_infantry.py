# scripts/blender/build_modern20_infantry.py
# The 20th-century Modern infantry (eight-ages plan U81, KTD15: today's present-day modern-* art becomes
# information-*, and Modern gets this mid-century set), on the shared parts of ti_figure.py and ti_modern20.py:
#   blender -b --factory-startup -P scripts/blender/build_modern20_infantry.py
# Generic, of no real army (no insignia, no national helmet shape): an olive drab rifleman.
#   - a round steel helmet with a narrow flared rim and a Team band, a chin strap
#   - an olive wool tunic to the hips with four pockets, olive trousers tucked into canvas gaiters, boots
#   - Team webbing: a belt with ammunition pouches and two braces over the shoulders (Spine and Chest:
#     the battle dyes them), a water bottle and an entrenching tool on the hips
#   - a bolt-action rifle with a bayonet upright at the order in the right hand (thin and upright: the
#     far detail level keeps it), the left arm at the side
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/modern-infantry/; copy the GLB to src/assets/units/modern-infantry.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_modern20 as M  # noqa: E402

UID = 'modern-infantry'
arm = F.start(M.COLORS, ready=True)
M.soldier()
F.tube('Bottle', F.vertical([.430, .500], .060, [(.026, .022), (.026, .022)], 'Hips'), 'Canvas', 6)
F.box('ToolBlade', (-.100, .070, .450), (.010, .050, .060), 'Canvas', 'Hips')

# ---- the left arm at the side: posed, then made the rest pose ----------------------------------------------------
F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
F.bake_rest()
F.fist('R', None, (0, 0, 1))
F.fist('L', None, (0, 1, 0), half=.020)

# ---- the bolt-action rifle with a bayonet, upright at the order -------------------------------------------------------
M.bolt_rifle(F.grip_point('R'))

F.finish_rest(UID, 'Rifle infantry (20th century): a round olive steel helmet with a Team band, an olive wool tunic with four pockets, Team webbing with '
              'ammunition pouches and braces, canvas gaiters and boots, a water bottle and an entrenching tool, a bolt-action rifle with a bayonet '
              'upright at the order', notes={'role': 'infantry'},
              clips=FC.clips_hook(UID, FC.Kit('gun', bayonet=True)))
