# scripts/blender/build_kingdoms_raider.py
# The Kingdoms raider, quality pass of 2026-10-14 (after the Classical raider and the Kingdoms
# knight), on the figure parts of ti_figure.py and the horse and tack of ti_mounts.py; replaces
# k_raider of build_units_kingdoms_irregular.py. A border raider on a small horse, so he reads apart
# from the knights at a glance (no helmet, no armour, no caparison, a hood):
#   - a dun rouncey at true size (ti_mounts.fine_horse: blaze, bridle) under a fringed sheepskin, a
#     girth and a plain breast band; the loot: a tied sack on each flank (ti_mounts.loot_sacks), a
#     rolled blanket, a looted iron pot and a tall church candlestick lashed on the croup
#   - the rider astride: a Team hood with a shoulder cape and a long tail (Head and Chest: the battle
#     dyes it), a beard, a quilted olive jack with long padded sleeves, a belt with a pouch and a long
#     knife, wool hose and boots
#   - a lit torch raised in the right fist (the orange Flame material, no baked shade), the reins in
#     the left fist, a short spear slung across the back
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Drawn for raider squads of the cavalry class (unitModels.js `raider`). Rest pose only. Rigs:
# MountRig, RaiderRig.
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_raider.py
# Outputs go to art-build/units/kingdoms-raider/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'kingdoms-raider'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': 'A07A4A', 'Mane': '2A1F17', 'Leather': '5E3A24', 'Boot': '3E2A1E', 'Wood': '5E4430', 'Jack': '6E6A3E', 'Hose': '5A4636',
         'Fleece': 'E9E1CF', 'Rug': '8A3A28', 'Sack': 'CDBB94', 'Metal': ('5E5B57', .5, .6), 'Iron': ('8E9094', .4, .7), 'Brass': ('C9A04E', .4, .7),
         'Hair': '3A2A1E', 'Skin': 'C48A62', 'Flame': 'F6A22E'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), socks=False)
parts.append(horse)
tm.tack(horse, 'Fleece', span=(-.28, .15), reach=100, fringe=.040, discs=0)
tm.loot_sacks(horse)
S = 'Mount_Spine'
# ---- on the croup: a rolled blanket, a looted iron pot and a church candlestick lashed to it ----
tube('LootRoll', [((-.170, .345, .742), .022, S), ((-.160, .345, .746), .054, S), ((.160, .345, .746), .054, S), ((.170, .345, .742), .022, S)], 'Rug', 7)
C = .330
tube('Pot', [((-.055, C, .790), .026, S), ((-.055, C, .800), .052, S), ((-.055, C, .842), .066, S), ((-.055, C, .880), .060, S), ((-.055, C, .888), .064, S),
             ((-.055, C, .894), .058, S)], 'Iron', 8, caps=(True, False))
tube('PotHandle', [((-.115, C, .884), .006, S), ((-.100, C, .930), .006, S), ((-.010, C, .930), .006, S), ((.005, C, .884), .006, S)], 'Iron', 3)
tube('Candlestick', [((.085, C + .010, .790), .034, S), ((.085, C + .010, .808), .030, S), ((.085, C + .010, .822), .010, S), ((.085, C + .012, .950), .009, S),
                     ((.085, C + .012, .962), .020, S), ((.085, C + .012, .985), .026, S), ((.085, C + .012, .995), .010, S)], 'Brass', 6)

# ---- the rider ----
rider = F.figure('Raider')
parts.append(rider)
F.legs(boots='Boot', hose='Hose')
F.arms(long='Jack', pad=.008, cuff='Leather')
F.head()
F.beard()
F.skirt('JackSkirt', 'Jack', low=.420, grow=.010, ribs=.06, seated=True)
F.torso('Jack', 'Jack', grow=.010, ribs=.06)
F.band('Belt', 'Leather', .515, .543, grow=.020, bone='Spine')
tube('Pouch', [((-.116, -.040, .510), .014, 'Hips'), ((-.124, -.044, .478), .030, 'Hips'), ((-.124, -.044, .446), .026, 'Hips'), ((-.122, -.042, .430), .008, 'Hips')], 'Leather', 6)
F.hip_sword('Knife', 'L', length=.30, tip=(.160, .110, .330))
F.hood('Hood', 'Team', cape=.200, low=.716)
tube('SlungSpear', [((-.170, .118, .520), .0075, 'Chest'), ((.215, .092, 1.010), .0068, 'Chest')], 'Wood', 4, attachment=True)
tube('SlungSpearHead', [((.211, .092, 1.005), (.012, .005), 'Chest'), ((.228, .091, 1.030), (.016, .005), 'Chest'), ((.256, .090, 1.074), .001, 'Chest')], 'Iron', 4, attachment=True)
F.astride(right=(-.250, -.120, .900), left=(.105, -.185, .640))
g = F.fist('R', None, (0, 0, 1))
gl = F.fist('L', None, (0, 1, 0), half=.020)
P = 'Prop_R'
tube('TorchHaft', [((g.x, g.y, g.z - .130), .0115, P), ((g.x, g.y, g.z + .250), .0105, P)], 'Wood', 5, attachment=True)
tube('TorchWrap', [((g.x, g.y, g.z + .225), .020, P), ((g.x, g.y, g.z + .262), .030, P), ((g.x, g.y, g.z + .310), .028, P)], 'Leather', 6, attachment=True)
flame = tube('TorchFlame', [((g.x, g.y, g.z + .300), .030, P), ((g.x, g.y - .006, g.z + .350), .046, P), ((g.x + .008, g.y - .004, g.z + .410), .030, P),
                            ((g.x - .004, g.y + .006, g.z + .480), .003, P)], 'Flame', 6, attachment=True)
F.bright.add(flame.name)
tm.stirrups(horse, mat='Iron')
tm.reins(horse, F.SEAT + gl)

tris = F.finish_unit(UID, parts, {
    'role': 'Kingdoms raider: a border raider on a dun rouncey under a fringed sheepskin (girth, breast band, bridle, stirrups), loot sacks on both flanks, a rolled blanket, a looted iron pot and a brass church candlestick on the croup; a Team hood with a cape and a long tail, a beard, a quilted olive jack, hose and boots, a long knife and a pouch, a raised torch, a short spear slung on the back',
    'pose': 'rest pose only (the rider seated, the torch arm raised); the vertex rig trots the horse',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, hood, quilted torso) and ti_mounts.py (fine_horse, tack, loot_sacks, stirrups, reins). The flame is a flat orange material named Flame with no baked shade; fire and smoke come from the battle effects.'},
    centre=(0, -.05, .75), scale=2.3)
print('TRIS', tris)
assert tris <= 3500, tris
