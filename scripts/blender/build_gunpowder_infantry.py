# scripts/blender/build_gunpowder_infantry.py
# Gunpowder infantry (line infantry, about 1750), quality pass of 2026-10-14, to the standard of the
# Bronze, Classical and Kingdoms passes on the shared parts of ti_figure.py; replaces g_infantry of
# build_units_gunpowder.py:
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_infantry.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the musket (MusketStock,
# MusketBarrel, MusketLock, Bayonet), rest pose only (no clips: the vertex rig marches the legs and
# swings the arms). The look follows plans/art/concepts/oct13/units-gunpowder-set.png (design
# reference only):
#   - a black felt tricorne with pale lace along its turned-up walls and a Team cockade
#   - a Team coat: the body and the long skirts round the sides and the back (weighted to the Spine,
#     so the battle dyes them; skirts on the hips would draw as plain cloth), the skirts lined in white
#     that shows at their front edges, plain wool sleeves with white cuffs, a black neck stock
#   - white cross belts over the chest with a brass plate, a black cartridge box at the right hip, a
#     bayonet and hanger at the left
#   - a buff waistcoat skirt and breeches, black gaiters above the knee, shoes
#   - the hair in a queue tied with a black ribbon, rolled curls over the ears
#   - the musket upright at the order in the right fist, its butt by the foot, the socket bayonet
#     standing above the head; the left arm hangs at the side
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/gunpowder-infantry/; copy the GLB to src/assets/units/gunpowder-infantry.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402

UID = 'gunpowder-infantry'
arm = F.start({'Skin': 'C99472', 'Hair': '3A2A1E', 'Felt': '1E1C1B', 'Cloth': 'EEEAE0', 'Buff': 'D6CBAE', 'Wool': '6E6A60', 'Gaiter': '2A2724',
               'Shoe': '1F1C1A', 'Leather': '2A2420', 'Metal': ('A9ADB2', .35, .8), 'Brass': ('C9A04E', .4, .7), 'Wood': '6A4A30'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Shoe', hose='Buff')
F.gaiters('Gaiter')
F.arms(long='Wool', pad=.004, cuff='Cloth')
F.head()
F.queue()

# ---- the coat, waistcoat skirt, belts ---------------------------------------------------------------------
F.skirt('WaistcoatSkirt', 'Buff', low=.462, grow=.010, sides=10, flare=.004)
F.torso('Coat', 'Team', grow=.010, chest=.010, sides=10)
F.coat_skirts('CoatSkirt', 'Team', 'Cloth', low=.352, grow=.016, flare=.026, open_deg=58)
F.neck_stock()
F.cross_belts()
box('CartridgeBox', (-.118, .052, .505), (.040, .100, .074), 'Leather', 'Hips')
F.hip_sword('Hanger', 'L', mat='Metal', scabbard='Leather', grip='Leather', length=.30)

# ---- the tricorne -----------------------------------------------------------------------------------------
F.tricorne()

# ---- the left arm hangs at the side: posed, then made the rest pose ------------------------------------------
F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
F.bake_rest()
F.fist('R', None, (0, 0, 1))
F.fist('L', None, (0, 1, 0), half=.020)

# ---- the musket (the right hand's attachment), upright at the order --------------------------------------------
F.musket(F.grip_point('R'))

F.finish_rest(UID, 'Line infantry: a black tricorne with pale lace and a Team cockade, a Team coat with long skirts lined in white, white cross belts with a brass plate, '
              'a cartridge box, buff breeches and black gaiters, the hair in a queue, a musket with a socket bayonet upright at the order',
              notes={'role': 'infantry'})
