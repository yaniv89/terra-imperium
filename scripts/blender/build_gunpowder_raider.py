# scripts/blender/build_gunpowder_raider.py
# The Gunpowder raider (a mounted freebooter of about 1750), quality pass of 2026-10-14 (after the
# Kingdoms raider and the Gunpowder dragoons), on the figure parts of ti_figure.py and the horse and
# tack of ti_mounts.py; replaces g_raider of build_units_gunpowder_irregular.py. He reads apart from
# the dragoons at a glance: no helmet but a broad slouch hat, no shabraque but a fringed blanket, loot
# on the croup, a torch:
#   - a dun horse at true size (ti_mounts.fine_horse: blaze, bridle) under a fringed red blanket, a
#     girth and a plain breast band; the loot: a tied sack on each flank (ti_mounts.loot_sacks), a
#     rolled blanket, a looted brass kettle and a mantel clock lashed on the croup
#   - the rider astride: a black slouch hat with its brim pulled down in front and a Team band (Head:
#     the battle dyes it), a heavy moustache, a red neckerchief; a loose Team coat with its
#     tails over the cantle (Spine), brown sleeves, a leather bandolier from the right shoulder, a red
#     waist sash with a pistol thrust in it, a sabre at the hip, brown breeches and cuffed jackboots
#   - a lit torch raised in the right fist (the orange Flame material, no baked shade), the reins in
#     the left fist, a carbine slung across the back
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Drawn for raider squads of the cavalry class (unitModels.js `raider`). Rest pose only. Rigs:
# MountRig, RaiderRig.
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_raider.py
# Outputs go to art-build/units/gunpowder-raider/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'gunpowder-raider'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': 'A68458', 'Mane': '2A1F17', 'Leather': '5E3A24', 'Boot': '2A211C', 'Wood': '5E4430', 'Hose': '5A4636', 'Wool': '6A5640', 'Felt': '1E1C1B',
         'Rug': '8A3A28', 'Fringe': 'D9C9A0', 'Sack': 'CDBB94', 'Kerchief': 'A8342A', 'Cloth': 'E2D8C0', 'Metal': ('A9ADB2', .35, .8), 'Iron': ('5E6064', .45, .7),
         'Brass': ('C9A04E', .4, .7), 'Hair': '3A2A1E', 'Skin': 'C48A62', 'Flame': 'F6A22E'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), socks=False)
parts.append(horse)
tm.tack(horse, 'Rug', span=(-.28, .16), reach=100, fringe=.040, discs=0)
tm.loot_sacks(horse)
tm.roll(horse, 'Fringe', y=.330, z=.745, half=.160, r=.046, name='LootRoll')
S = 'Mount_Spine'
# ---- on the croup, lashed on the roll: a looted brass kettle and a mantel clock ----
C = .335
F.use(horse)
tube('Kettle', [((-.075, C, .780), .030, S), ((-.075, C, .792), .056, S), ((-.075, C, .826), .064, S), ((-.075, C, .858), .050, S), ((-.075, C, .866), .034, S),
                ((-.075, C, .880), .014, S)], 'Brass', 8)
tube('KettleSpout', [((-.030, C - .010, .815), .010, S), ((.000, C - .022, .850), .006, S)], 'Brass', 4)
tube('KettleHandle', [((-.125, C, .855), .005, S), ((-.110, C, .905), .005, S), ((-.040, C, .905), .005, S), ((-.025, C, .855), .005, S)], 'Iron', 3)
box('Clock', (.080, C + .010, .850), (.090, .060, .130), 'Wood', S)
tube('ClockTop', [((.080, C + .010, .912), (.040, .028), S), ((.080, C + .010, .940), (.012, .010), S)], 'Wood', 6)
tube('ClockFace', [((.080, C - .022, .862), .032, S), ((.080, C - .026, .862), .032, S)], 'Cloth', 10)
box('ClockHands', (.080, C - .028, .868), (.004, .003, .026), 'Felt', S)

# ---- the rider ----
rider = F.figure('Raider')
parts.append(rider)
F.legs(boots='Boot', hose='Hose')
F.jackboots('Boot', top=.315)
F.arms(long='Wool', pad=.006, cuff='Leather')
F.head()
F.hair(crown=False)
box('Moustache', (0, -.062, .884), (.060, .013, .012), 'Hair', 'Head')
F.neck_stock('Kerchief')
tube('KerchiefKnot', [((.000, -.060, .790), .016, 'Chest'), ((.008, -.074, .760), .012, 'Chest')], 'Kerchief', 5)
F.skirt('WaistcoatSkirt', 'Hose', low=.440, grow=.010, seated=True)
F.torso('Coat', 'Team', grow=.016, chest=.010)
F.seated_coat_tails('CoatTail', 'Team', 'Wool')
F.cross_belts('Bandolier', 'Leather', plate=None, width=.032, grow=.026, which='R')
F.band('Sash', 'Kerchief', .526, .566, grow=.026, bone='Spine')
tube('Pistol', [((-.040, -.118, .610), (.010, .012), 'Spine'), ((-.034, -.114, .530), (.008, .009), 'Spine'), ((-.028, -.132, .508), (.012, .016), 'Spine')], 'Wood', 5)
F.hip_sword('Sabre', 'L', mat='Brass', length=.40, tip=(.176, .150, .230))
F.round_hat('SlouchHat', 'Felt', 'Team', brim=.152, crown=1.040, droop=.034)
tube('SlungCarbine', [((-.170, .124, .520), (.010, .016), 'Chest'), ((.040, .112, .780), .009, 'Chest'), ((.200, .100, .990), .008, 'Chest')], 'Wood', 5)
tube('SlungCarbineBarrel', [((.020, .108, .760), .0055, 'Chest'), ((.236, .096, 1.035), .0055, 'Chest')], 'Iron', 4)
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
    'role': 'Gunpowder raider: a freebooter on a dun horse under a fringed red blanket (girth, breast band, bridle, stirrups), loot sacks on both flanks, a rolled blanket, a looted brass kettle and a mantel clock on the croup; a black slouch hat with a Team band, a moustache, a red neckerchief, a loose Team coat with its tails over the cantle, a leather bandolier, a red sash with a pistol, a sabre at the hip, brown breeches and cuffed jackboots, a raised torch, a carbine slung on the back',
    'pose': 'rest pose only (the rider seated, the torch arm raised); the vertex rig trots the horse',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, round_hat droop, seated_coat_tails, jackboots) and ti_mounts.py (fine_horse, tack, loot_sacks, roll, stirrups, reins). The flame is a flat orange material named Flame with no baked shade; fire and smoke come from the battle effects.'},
    centre=(0, -.05, .75), scale=2.3)
print('TRIS', tris)
assert tris <= 3500, tris
