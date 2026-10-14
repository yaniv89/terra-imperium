# scripts/blender/build_modern_mercenary.py
# Modern mercenary (a private military contractor, drawn for mercenary squads of the infantry class),
# quality pass of 2026-10-14 on the shared parts of ti_figure.py; replaces m_mercenary of
# build_units_modern_irregular.py (the technical stays there):
#   blender -b --factory-startup -P scripts/blender/build_modern_mercenary.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the cap (BallCap, CapBill,
# HeadsetCup1 and -1), the chest rig (ChestRig, RigPouch0-2) and the carbine (RifleBody, RifleMag,
# RifleOptic, RifleMuzzle); and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). He must not be taken for the rifleman
# (build_modern_infantry.py: helmet, plate carrier, dark uniform, rifle in both hands), so he is a hired
# hand in his own kit:
#   - a black ball cap with a headset and boom microphone, dark sunglasses, a full beard
#   - a tan shirt with short sleeves (bare forearms), a Team chest rig (Spine and Chest: the battle
#     dyes it) with dark pouches and X straps, khaki cargo trousers, a pistol in a thigh holster, tan boots
#   - a short carbine upright in the right fist, muzzle up; the left thumb hooked in the rig
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/modern-mercenary/; copy the GLB to src/assets/units/modern-mercenary.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'modern-mercenary'
arm = F.start({'Skin': 'B9805C', 'Hair': '2B201A', 'Shirt': 'C4AE82', 'Khaki': '625C4C', 'Boot': '8A6C46', 'Sole': '2A221A', 'Cap': '1F1F21',
               'Gear': '232325', 'Pouch': '3A3832', 'Glove': '2C2A27', 'Gun': '27282A', 'Metal': ('5A5D60', .4, .7)}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Boot', hose='Khaki')
F.combat_boots('Boot', top=.165)
F.arms(sleeve='Shirt')
F.head()
F.beard()
F.hair(crown=False)
F.cargo_trousers('Khaki', pads=None)

# ---- shirt, rig, belt, holster ---------------------------------------------------------------------------
F.torso('Shirt', 'Shirt', grow=.008, chest=.004)
F.chest_rig('ChestRig', 'Team', 'Pouch')
F.band('Belt', 'Gear', .520, .546, grow=.016, bone='Spine')
box('Holster', (-.112, -.020, .385), (.030, .060, .090), 'Gear', 'Leg_R')
box('HolsterPistol', (-.112, -.030, .446), (.024, .036, .044), 'Gun', 'Leg_R')
box('HolsterStrap', (-.098, -.004, .330), (.044, .060, .016), 'Gear', 'Leg_R')

# ---- cap, headset, glasses ------------------------------------------------------------------------------------
F.ball_cap('BallCap', 'Cap', 'Gear')
F.sunglasses('Sunglasses', 'Gear')

# ---- the carbine low in the right fist, the left thumb in the rig: posed, then made the rest pose ---------------
F.hold('R', (-.150, -.150, .560), pole=(-1, .4, -.5))
F.hold('L', (.062, -.122, .705), pole=(1, .2, -.8))
F.bake_rest()
g = F.fist('R', None, (0, 0, 1), half=.022, mat='Glove')
F.fist('L', None, (0, 1, 0), half=.018, mat='Glove')
F.assault_rifle(g, below=.130, above=.330)

F.finish_rest(UID, 'Mercenary: a contractor in a black ball cap with a headset and microphone, dark sunglasses, a full beard, a tan shirt with short sleeves, a Team chest rig '
              'with dark pouches and X straps, khaki cargo trousers, a pistol in a thigh holster, tan boots, a short carbine upright in the right fist',
              notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'},
              clips=FC.clips_hook(UID, FC.Kit('gun')))
