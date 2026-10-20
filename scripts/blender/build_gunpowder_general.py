# scripts/blender/build_gunpowder_general.py
# The Gunpowder general (about 1750), quality pass of 2026-10-14 (after the Kingdoms general and the
# Gunpowder dragoons), on the figure parts of ti_figure.py and the horse and tack of ti_mounts.py;
# replaces g_general of build_units_gunpowder.py. The look follows
# plans/art/concepts/oct13/units-gunpowder-set.png (design reference only):
#   - a grey horse at true size (ti_mounts.fine_horse: bridle) under a dark shabraque with a broad gilt
#     lace border and pointed back corners (a mount draws no Team colour), the saddle, fur-capped
#     holsters, stirrups
#   - the general astride, pointing ahead with his right hand, the reins in his left: a black bicorne
#     worn athwart with gilt lace, a white feather edging and a Team cockade (Head), powdered hair in a
#     queue; a Team coat with gilt lace down the front, gilt epaulettes, its tails over the cantle
#     lined in white (Spine), a crimson sash over the right shoulder knotted at the left hip, a white
#     stock, grey sleeves with gilt cuffs, a buff waistcoat skirt and breeches, black jackboots, a sword
#     with a gilt hilt at the hip
#   - a colour bearer on foot at the horse's left shoulder (the lighter LITE figure) in the line's
#     dress: a tricorne with pale lace, a Team coat with long white-lined skirts, white cross belts,
#     buff breeches and black gaiters; the colour upright in his right fist, his left hand on the pole
#     below it: a square flag (the squad's Emblem) under a gilt spear-point finial, a gilt tassel
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Clips (ti_mounted_clips.py, 2026-10-14): the general's set (the mounted set and Cheer), the general's feet
# in the stirrups, the colour bearer carrying the colour in both fists, waving it in Cheer. Rigs: MountRig,
# CommanderRig, BearerRig.
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_general.py
# Outputs go to art-build/units/gunpowder-general/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402

UID = 'gunpowder-general'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': 'B9B6AE', 'Mane': '5E5A54', 'Leather': '2E241E', 'Saddle': '4A2E20', 'Shabraque': '27304A', 'Fur': '2A2420', 'Wool': '6E6A60',
         'Cloth': 'EEEAE0', 'Buff': 'D6CBAE', 'Boot': '1A1716', 'Felt': '1E1C1B', 'Sash': '9A2430', 'Gaiter': '2A2724', 'Shoe': '1F1C1A', 'Wood': '5A3A24',
         'Metal': ('B4B8BD', .32, .82), 'Gilt': ('D8AE4A', .35, .8), 'Brass': ('C9A04E', .4, .7), 'Hair': 'D6D0C4', 'Skin': 'C99472', 'Emblem': 'E6D6AF'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), blaze=False, socks=False)
tm.fine_legs(horse, sides=8)  # 2026-10-20: knees, hocks, fetlocks and flared hooves
tm.full_tail(horse, sides=10)
parts.append(horse)
tm.shabraque(horse, 'Shabraque', 'Gilt', depth=.028)
tm.war_saddle(horse, 'Saddle', cantle=.805, pommel=.805)
tm.holsters(horse, 'Leather', None)

# ---- the general astride ----
cmd = F.figure('Commander')
parts.append(cmd)
F.legs(boots='Boot', hose='Buff')
F.jackboots('Boot')
F.arms(long='Wool', pad=.004, cuff='Gilt')
F.head()
F.queue(curls=False)
F.skirt('WaistcoatSkirt', 'Buff', low=.440, grow=.010, seated=True)
F.torso('Coat', 'Team', grow=.010, chest=.010)
for s in (-1, 1):  # the gilt lace down the coat's front edges, from the collar to the waist
    pts = []
    for z, dx in ((.776, .040), (.730, .052), (.660, .050), (.590, .046), (.548, .046)):
        rx, ry = F.radius_at(z, F.TORSO)
        pts.append(((s * dx, -(ry + .010 + (.010 if .68 < z < .75 else 0)) - .003, z), (.008, .004), 'Spine' if z < .66 else 'Chest'))
    tube(f'CoatLace_{s}', pts, 'Gilt', 3)
F.seated_coat_tails('CoatTail', 'Team', 'Cloth')
F.neck_stock('Cloth')
F.epaulettes('Gilt')
F.cross_belts('Sash', 'Sash', plate=None, width=.052, grow=.026, which='R')
tube('SashKnot', [((.104, -.060, .545), .022, 'Spine'), ((.112, -.064, .515), .026, 'Spine')], 'Sash', 6)
for k, dx in enumerate((.000, .026)):
    tube(f'SashEnd{k}', [((.110 + dx, -.066, .505), (.014, .006), 'Hips'), ((.118 + dx, -.072, .440), (.016, .006), 'Hips'), ((.120 + dx, -.074, .410), (.020, .006), 'Hips')], 'Sash', 4)
F.hip_sword('Sword', 'L', mat='Gilt', tip=(.176, .150, .230))
F.bicorne()
F.astride(right=(-.300, -.430, .900), left=(.105, -.185, .640), right_pole=(-1, .2, -.4))
F.pointing_hand('R', mat='Skin')
gl = F.fist('L', None, (0, 1, 0), half=.020, mat='Skin')
tm.stirrups(horse)
tm.reins(horse, F.SEAT + gl)

# ---- the colour bearer on foot at the horse's left shoulder ----
bearer = F.figure('Bearer')
parts.append(bearer)
F.LITE = True  # the lighter figure: the general is the one seen up close
GRIP_R = Vector((-.223, -.137, .604))  # the right fist of the rig's ready pose
F.legs(boots='Shoe', hose='Buff')
F.gaiters('Gaiter', sides=6)
F.arms(long='Wool', pad=.004, cuff='Cloth')
F.head()
F.hair(crown=False)
F.skirt('WaistcoatSkirt', 'Buff', low=.462, grow=.010, sides=8, flare=.004)
F.torso('Coat', 'Team', grow=.010, chest=.010, sides=8)
F.coat_skirts('CoatSkirt', 'Team', 'Cloth', low=.352, grow=.016, flare=.026, open_deg=58, cols=6)
F.cross_belts(sides=12)
F.tricorne(sides=12, crown_sides=8)
LOW = Vector((GRIP_R.x, GRIP_R.y, .500))  # the left fist on the pole below the right
F.hold('L', LOW, pole=(.5, -1, -.4))
F.bake_rest()
g = F.fist('R', GRIP_R, (0, 0, 1))
F.fist('L', LOW, (0, 0, 1), half=.020)
F.place((.50, -.05, 0))
F.standard('Standard', g, top=1.80, w=.36, h=.33)

tris = F.finish_unit(UID, parts, {
    'role': 'Gunpowder general: a mounted general on a grey horse under a dark shabraque with a gilt lace border (saddle, holsters, stirrups), pointing ahead, in a black bicorne worn athwart with gilt lace, a white feather edging and a Team cockade, powdered hair in a queue, a Team coat laced in gilt with gilt epaulettes and its tails over the cantle, a crimson sash over the shoulder, buff breeches and jackboots, a gilt-hilted sword; a colour bearer on foot in the line dress (tricorne, Team coat, white cross belts, gaiters) whose square colour under a gilt finial is the squad emblem',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, bicorne, epaulettes, seated_coat_tails, jackboots, pointing_hand, standard, tricorne, coat_skirts) and ti_mounts.py (fine_horse, shabraque, war_saddle, holsters, stirrups, reins). The colour is StandardPole, StandardFinial, StandardEmblem (attachments of the bearer).'},
    centre=(-.2, -.1, .85), scale=2.8, mode='NLA_TRACKS',
    clips=MC.hook(UID, lambda: MC.mounted(horse, cmd, 'hand', 'general', stirrups=True, bearer=bearer, bearer_kit=FC.Kit('spear', two_hands=True),
                                         bearer_axes={'L': (0, 0, 1)}), 'general'))
print('TRIS', tris)
assert tris <= 5000, tris  # (5,000 since the legs and tail of 2026-10-20) two people and a horse: over the 3,500 target like the Kingdoms general (4,320)
