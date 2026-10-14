# scripts/blender/build_gunpowder_mercenary.py
# Gunpowder mercenary (a free-company soldier of about 1750, drawn for mercenary squads of the
# infantry class), quality pass of 2026-10-14 on the shared parts of ti_figure.py; replaces
# g_mercenary of build_units_gunpowder_irregular.py (the raider stays there):
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_mercenary.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the musket (MusketStock,
# MusketBarrel, MusketLock), the hat (BroadHat, HatPlume), the coat (BuffCoat, BuffSkirt), the sash,
# the coin pouch and the waistcoat front; and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). He must not be taken for the line
# infantryman (build_gunpowder_infantry.py: black tricorne, Team coat, white cross belts, gaiters,
# bayonet), so he is a hired hand in his own kit:
#   - a broad black hat hooked up on the left under a large Team plume, a heavy moustache
#   - a buff leather coat with skirts to mid-thigh (lined dark red) and buff sleeves, open over a Team
#     waistcoat; a Team waist sash with a hanging end and a pistol thrust through it (Spine: the battle
#     dyes the waistcoat and the sash)
#   - a broad leather baldric from the right shoulder to a sabre at the left hip, the left fist on its
#     hilt; a coin pouch
#   - dark red breeches and tall black riding boots with turned-down cuffs
#   - a musket without a bayonet upright in the right fist, its butt by the foot
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/gunpowder-mercenary/; copy the GLB to src/assets/units/gunpowder-mercenary.glb.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'gunpowder-mercenary'
arm = F.start({'Skin': 'B9805C', 'Hair': '2B201A', 'Felt': '1E1C1B', 'Buff': 'C8A46A', 'Breeches': '6A2A26', 'Boots': '201C1A', 'BootCuff': '3A2C22',
               'Leather': '5A3A24', 'Metal': ('A9ADB2', .35, .8), 'Iron': ('4E4F52', .45, .7), 'Brass': ('C9A04E', .4, .7), 'Wood': '4E3828'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Boots', hose='Breeches')
F.gaiters('Boots', top=.330)
for side, s in (('L', 1), ('R', -1)):
    tube('BootCuff_' + side, [((s * .070, -.008, .300), (.048, .049), 'Leg_' + side), ((s * .070, -.008, .350), (.056, .056), 'Leg_' + side)],
         'BootCuff', 7, caps=(False, False))
F.arms(long='Buff', pad=.007, cuff='Buff')
F.head()
F.hair(crown=False)
box('Moustache', (0, -.062, .884), (.058, .013, .012), 'Hair', 'Head')

# ---- buff coat over a Team waistcoat, sash, baldric, pouch ---------------------------------------------------
F.torso('BuffCoat', 'Buff', grow=.014, chest=.008, sides=10)
F.slab('WaistcoatFront', [(-.046, -.092, .752), (.046, -.092, .752), (.054, -.088, .540), (-.054, -.088, .540)], 'Team', 'Spine', depth=.010)
F.coat_skirts('BuffSkirt', 'Buff', 'Breeches', low=.400, grow=.018, flare=.020, open_deg=40, cols=10)
F.band('Sash', 'Team', .526, .566, grow=.022, bone='Spine')
F.slab('SashEnd', [(.040, -.100, .548), (.074, -.094, .548), (.082, -.110, .420), (.040, -.116, .420)], 'Team', 'Spine')
tube('Pistol', [((-.040, -.112, .600), (.010, .012), 'Spine'), ((-.034, -.110, .520), (.008, .009), 'Spine'), ((-.028, -.128, .505), (.012, .016), 'Spine')], 'Wood', 5)
F.cross_belts('Baldric', 'Leather', plate=None, width=.036, grow=.024, which='R')
F.hip_sword('Sabre', 'L', mat='Brass', scabbard='Leather', grip='Leather', length=.40)
tube('CoinPouch', [((-.120, -.050, .524), (.022, .018), 'Hips'), ((-.128, -.052, .484), (.032, .026), 'Hips'), ((-.124, -.050, .448), (.020, .016), 'Hips')], 'Leather', 6)

# ---- the broad hat and its Team plume ---------------------------------------------------------------------------
F.round_hat('BroadHat', 'Felt', None, brim=.152, crown=1.022, up=.076)
F.ridge('HatPlume', [(-.050, .990, 1.020), (-.010, 1.010, 1.080), (.040, 1.000, 1.110), (.090, .975, 1.090)], 'Team', half=(.010, .022))
for v in F.meshes[-1].data.vertices:
    v.co.x += .062

# ---- the left fist on the sabre's hilt: posed, then made the rest pose -------------------------------------------
F.reach('L', (.138, -.098, .650), pole=(1, .4, -.4))
F.bake_rest()
F.fist('R', None, (0, 0, 1))
F.fist('L', None, (0, 0, 1), half=.022)

# ---- the musket (the right hand's attachment), upright, no bayonet -------------------------------------------------
F.musket(F.grip_point('R'), length=.880, bayonet=0, metal='Iron', lock='Brass')

F.finish_rest(UID, 'Mercenary: a broad black hat hooked up under a large Team plume, a heavy moustache, a buff leather coat open over a Team waistcoat, a Team waist sash '
              'with a pistol, a broad baldric to a sabre at the hip with the left hand on its hilt, a coin pouch, dark red breeches and tall cuffed riding boots, '
              'a musket upright without a bayonet', notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'},
              clips=FC.clips_hook(UID, FC.Kit('gun')))
