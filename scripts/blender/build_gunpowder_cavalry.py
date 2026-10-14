# scripts/blender/build_gunpowder_cavalry.py
# Gunpowder cavalry (dragoons, about 1750), quality pass of 2026-10-14 (after the Kingdoms mounted
# units), on the figure parts of ti_figure.py and the horse and tack of ti_mounts.py; replaces
# g_cavalry of build_units_gunpowder.py. The look follows plans/art/concepts/oct13/units-gunpowder-set.png
# (design reference only):
#   - a bay horse at true size (ti_mounts.fine_horse: blaze, bridle) under a dark shabraque with
#     pointed back corners and a pale worsted lace border (a mount draws no Team colour, so the cloth
#     has its own), the saddle, pistol holsters with fur caps at the pommel, a rolled cloak behind
#     the cantle, stirrups
#   - the dragoon astride: a brass helmet with a black leather peak, a brass comb and a black horsehair
#     crest streaming down the back, a Team turban round its base (Head: the battle dyes it); the hair
#     in a queue; a Team coat whose tails lie over the cantle, turned back to show the white lining
#     (Spine), grey wool sleeves with white cuffs, a black stock, a white carbine belt from the left
#     shoulder to the right hip and a white waist belt, a buff waistcoat skirt, buff breeches and tall
#     black jackboots over the knee, an empty scabbard slanting back along the flank
#   - the sabre drawn and held upright in the right fist (thin and upright, so the far detail level
#     keeps it), the carbine hanging muzzle down from the belt's swivel behind the right thigh, the
#     reins in the left fist
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Rest pose only (the vertex rig trots the horse). Rigs: MountRig, RiderRig.
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_cavalry.py
# Outputs go to art-build/units/gunpowder-cavalry/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'gunpowder-cavalry'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': '6E3F24', 'Mane': '1C1511', 'Leather': '2E241E', 'Saddle': '4A2E20', 'Shabraque': '2F3542', 'Lace': 'D8C99A', 'Fur': '2A2420',
         'Wool': '6E6A60', 'Cloth': 'EEEAE0', 'Buff': 'D6CBAE', 'Boot': '1A1716', 'Felt': '1E1C1B', 'Crest': '151312', 'Wood': '5A3A24',
         'Metal': ('B4B8BD', .32, .82), 'Iron': ('5E6064', .45, .7), 'Brass': ('C9A04E', .4, .7), 'Hair': '3A2A1E', 'Skin': 'C99472'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), socks=False)
parts.append(horse)
tm.shabraque(horse, 'Shabraque', 'Lace')
tm.war_saddle(horse, 'Saddle', cantle=.805, pommel=.805)
tm.holsters(horse, 'Leather', 'Fur')
tm.roll(horse, 'Shabraque', y=.255, z=.790, half=.150, r=.040)

# ---- the dragoon ----
rider = F.figure('Rider')
parts.append(rider)
F.legs(boots='Boot', hose='Buff')
F.jackboots('Boot')
F.arms(long='Wool', pad=.004, cuff='Cloth')
F.head(ears=False)
F.queue()
F.skirt('WaistcoatSkirt', 'Buff', low=.440, grow=.010, seated=True)
F.torso('Coat', 'Team', grow=.010, chest=.010)
F.seated_coat_tails('CoatTail', 'Team', 'Cloth')
F.neck_stock()
F.cross_belts('CarbineBelt', 'Cloth', plate=None, which='L')
F.band('Belt', 'Cloth', .530, .552, grow=.024, bone='Spine', bulge=.002)
F.hip_sword('Sword', 'L', tip=(.176, .150, .230), hilt=False)
F.dragoon_helmet()
F.astride(right=(-.215, -.120, .680), left=(.105, -.185, .640))
g = F.fist('R', None, (0, 0, 1))
gl = F.fist('L', None, (0, 1, 0), half=.020)
F.upright_sabre(g, length=.500)

# ---- the carbine hanging muzzle down behind the right thigh (Hips: it rides with the man) ----
cx, cy = -.205, .110
tube('CarbineStock', [((cx, cy, .600), (.012, .026), 'Hips'), ((cx, cy - .004, .470), (.009, .015), 'Hips'), ((cx, cy - .006, .410), (.010, .012), 'Hips'),
                      ((cx, cy - .006, .190), (.008, .010), 'Hips')], 'Wood', 6)
tube('CarbineBarrel', [((cx, cy + .010, .420), .0060, 'Hips'), ((cx, cy + .010, .110), .0060, 'Hips')], 'Iron', 5)
box('CarbineLock', (cx - .010, cy + .002, .430), (.006, .030, .022), 'Brass', 'Hips')
tube('CarbineSling', [((-.150, .040, .560), .006, 'Hips'), ((cx, cy - .012, .520), .006, 'Hips')], 'Cloth', 3)

tm.stirrups(horse)
tm.reins(horse, F.SEAT + gl)
tris = F.finish_unit(UID, parts, {
    'role': 'Dragoons: a dragoon astride a bay horse under a dark shabraque with pointed back corners and a pale lace border, the saddle, fur-capped pistol holsters, a rolled cloak, stirrups; a brass helmet with a black horsehair crest and a Team turban, a Team coat with its tails over the cantle lined in white, a white carbine belt and waist belt, buff breeches and black jackboots; the sabre drawn upright in the right fist, a carbine hanging behind the right thigh, the reins in the left fist',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, jackboots, seated_coat_tails, dragoon_helmet, upright_sabre) and ti_mounts.py (fine_horse, shabraque, war_saddle, holsters, roll, stirrups, reins). Sabre parts SabreGrip, SabreGuard, SabreBlade (Prop_R).'},
    centre=(0, -.1, .85), scale=2.7)
print('TRIS', tris)
assert tris <= 3500, tris
