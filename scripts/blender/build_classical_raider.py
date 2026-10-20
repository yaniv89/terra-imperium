# scripts/blender/build_classical_raider.py
# The Classical raider, quality pass of 2026-10-14 (after the Bronze raider), on the figure parts of
# ti_figure.py and the horse and tack of ti_mounts.py; replaces build_raider of
# build_units_classical_irregular.py. A light horseman of the northern and steppe fringe, so he reads
# apart from the heavy cavalry at a glance (no helmet, no armour, trousers):
#   - a chestnut dun horse at true size (ti_mounts.fine_horse: blaze, bridle) under a pale fleece with a
#     fringe, a girth and a plain breast band; the loot: a tied sack on each flank, a rolled striped
#     rug and a looted bronze cauldron on the croup
#   - the rider astride: a Team felt cap with its tip falling forward (Head: the battle dyes it), a
#     short Team cloak from the shoulders (Chest), a beard, a long-sleeved ochre tunic with leather
#     cuffs, a belt with a pouch, patterned trousers and boots
#   - a lit torch raised in the right fist (the orange Flame material, no baked shade), the reins in
#     the left fist, two javelins slung across the back
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Live rebuild of 2026-10-20 (in the running Blender over the MCP add-on): shaped horse legs
# (ti_mounts.fine_legs: knees, hocks, fetlocks, flared hooves), a fuller tail (full_tail) and a round
# torch fire with a second tongue in place of the leaf-shaped flame that read as a spear head.
# Drawn for raider squads of the cavalry class (unitModels.js `raider`). Clips (ti_mounted_clips.py,
# 2026-10-14): the mounted set, the torch raised in the gaits and thrust down in Charge and Attack. Rigs:
# MountRig, RaiderRig.
#   blender -b --factory-startup -P scripts/blender/build_classical_raider.py
# Outputs go to art-build/units/classical-raider/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402

UID = 'classical-raider'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': '8A5A34', 'Mane': '2A1F17', 'Leather': '5E3A24', 'Boot': '3E2A1E', 'Wood': '5E4430', 'Cloth': 'B07A3E', 'Trousers': '5C4A6A',
         'Fleece': 'E9E1CF', 'Rug': '9C3F2C', 'Sack': 'CDBB94', 'Metal': ('C09A54', .45, .6), 'Iron': ('B9BCC0', .35, .7),
         'Hair': '2B201A', 'Skin': 'C48A62', 'Flame': 'F6A22E'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), socks=False)
tm.fine_legs(horse)  # 2026-10-20: knees, hocks, fetlocks and flared hooves
tm.full_tail(horse)
parts.append(horse)
tm.tack(horse, 'Fleece', span=(-.28, .15), reach=100, fringe=.040, discs=0)
S = 'Mount_Spine'
# ---- the loot: a tied sack on each flank behind the rider's legs, a rolled rug and a bronze cauldron on the croup ----
for sx in (-1, 1):
    tube(f'LootSack{sx}', [((sx * .165, .22, .700), .030, S), ((sx * .190, .22, .640), (.080, .072), S), ((sx * .204, .22, .545), (.100, .086), S),
                           ((sx * .198, .22, .462), (.076, .066), S), ((sx * .193, .22, .432), .020, S)], 'Sack', 7)
    tube(f'SackTie{sx}', [((sx * .166, .22, .688), .035, S), ((sx * .171, .22, .672), .039, S)], 'Leather', 6, caps=(False, False))
tube('SackRope', [((-.160, .22, .715), .010, S), ((0, .22, .768), .010, S), ((.160, .22, .715), .010, S)], 'Leather', 4)
tube('LootRoll', [((-.175, .345, .742), .022, S), ((-.165, .345, .746), .056, S), ((.165, .345, .746), .056, S), ((.175, .345, .742), .022, S)], 'Rug', 7)
for k, x in enumerate((-.090, 0, .090)):  # pale stripes woven across the rug
    tube(f'RollStripe{k}', [((x - .012, .345, .746), .0585, S), ((x + .012, .345, .746), .0585, S)], 'Fleece', 7, caps=(False, False))
C = .335  # the cauldron sits on the rug, lashed to the rider's back roll
tube('Cauldron', [((0, C, .792), .022, S), ((0, C, .802), .052, S), ((0, C, .844), .074, S), ((0, C, .886), .068, S), ((0, C, .898), .074, S),
                  ((0, C, .905), .068, S)], 'Metal', 8, caps=(True, False))
tube('CauldronHandle', [((-.072, C, .902), .006, S), ((-.050, C, .952), .006, S), ((.050, C, .952), .006, S), ((.072, C, .902), .006, S)], 'Iron', 3)

# ---- the rider ----
rider = F.figure('Raider')
parts.append(rider)
F.legs(boots='Boot', hose='Trousers')
F.arms(long='Cloth', cuff='Leather')
F.head()
F.beard()
F.hair_nape()
F.phrygian_cap('FeltCap', 'Team')
F.skirt('Tunic', 'Cloth', low=.405, seated=True, sides=8)
F.torso('TunicTop', 'Cloth', grow=.006)
F.band('Belt', 'Leather', .515, .543, grow=.014, bone='Spine')
tube('Pouch', [((-.112, -.040, .510), .014, 'Hips'), ((-.120, -.044, .478), .030, 'Hips'), ((-.120, -.044, .446), .026, 'Hips'), ((-.118, -.042, .430), .008, 'Hips')], 'Leather', 6)
F.cloak('Cloak', 'Team', top=.795, low=.560, rows=3, k=5, arc=(150, 100), width=(.124, .160), depth=(.078, .090), back=(.006, .055))
box('CloakPin', (-.078, -.056, .774), (.026, .012, .026), 'Metal', 'Chest')
for k, dx in enumerate((0, .030)):  # two javelins slung across the back
    tube(f'Javelin{k}', [((-.160 + dx, .110, .545), .0065, 'Chest'), ((.200 + dx, .088, .990), .0060, 'Chest')], 'Wood', 4, attachment=True)
    tube(f'JavelinHead{k}', [((.196 + dx, .088, .985), (.011, .005), 'Chest'), ((.214 + dx, .087, 1.008), (.014, .005), 'Chest'), ((.240 + dx, .086, 1.042), .001, 'Chest')], 'Iron', 4, attachment=True)
F.astride(right=(-.250, -.120, .900), left=(.105, -.185, .640))
g = F.fist('R', None, (0, 0, 1))
gl = F.fist('L', None, (0, 1, 0), half=.020)
P = 'Prop_R'
tube('TorchHaft', [((g.x, g.y, g.z - .130), .0115, P), ((g.x, g.y, g.z + .250), .0105, P)], 'Wood', 5, attachment=True)
tube('TorchWrap', [((g.x, g.y, g.z + .225), .020, P), ((g.x, g.y, g.z + .262), .030, P), ((g.x, g.y, g.z + .310), .028, P)], 'Leather', 6, attachment=True)
# a round fire with a flicked tip and a second tongue, so the torch never reads as a spear head
flame = tube('TorchFlame', [((g.x, g.y, g.z + .285), .026, P), ((g.x, g.y - .004, g.z + .325), .050, P), ((g.x + .006, g.y - .004, g.z + .375), .056, P),
                            ((g.x + .002, g.y + .004, g.z + .425), .040, P), ((g.x - .010, g.y + .010, g.z + .470), .020, P),
                            ((g.x - .016, g.y + .016, g.z + .520), .002, P)], 'Flame', 7, attachment=True)
tongue = tube('TorchTongue', [((g.x + .020, g.y - .012, g.z + .380), .020, P), ((g.x + .032, g.y - .018, g.z + .430), .016, P),
                              ((g.x + .036, g.y - .020, g.z + .475), .002, P)], 'Flame', 5, attachment=True)
F.bright.add(tongue.name)
F.bright.add(flame.name)
tm.reins(horse, F.SEAT + gl)

tris = F.finish_unit(UID, parts, {
    'role': 'Classical raider: a light horseman on a chestnut dun horse under a fringed fleece (girth, breast band, bridle), loot sacks on both flanks, a rolled striped rug and a looted bronze cauldron on the croup; a Team felt cap with a forward tip, a short Team cloak, a long-sleeved ochre tunic, trousers and boots, a raised torch, two javelins slung on the back',
    'pose': 'rest pose = Idle frame 1 (the rider seated, the torch arm raised); the mounted clips (ti_mounted_clips.py, 2026-10-14)',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, cloak, phrygian_cap) and ti_mounts.py (fine_horse, tack, reins). The flame is a flat orange material named Flame with no baked shade; fire and smoke come from the battle effects.'},
    centre=(0, -.05, .75), scale=2.3, mode='NLA_TRACKS', clips=MC.hook(UID, lambda: MC.mounted(horse, rider, 'torch'), 'mounted'))
print('TRIS', tris)
assert tris <= 3500, tris
