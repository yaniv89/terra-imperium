# scripts/blender/build_kingdoms_general.py
# The Kingdoms general, quality pass of 2026-10-14 (after the Classical general and the Kingdoms
# knight), on the figure parts of ti_figure.py and the horse and tack of ti_mounts.py; replaces
# k_general of build_units_kingdoms.py. The look follows plans/art/concepts/oct13/units-kingdoms-set.png
# (design reference only):
#   - a chestnut horse at true size (ti_mounts.fine_horse: blaze, bridle) under a shorter Team
#     caparison than the knights' (drawn as plain wool on a mount) with a cream border, the war saddle,
#     stirrups
#   - the lord astride, pointing ahead with his right hand, the reins in his left: an open steel
#     bascinet ringed by a gilt coronet (the commander's mark), a mail coif, a beard, a Team surcoat
#     with flaps over the lap and the cantle, a long Team cloak from the shoulders over the horse's
#     back with a gilt clasp, mail sleeves and chausses, steel shoulders and knee cops, a sword at the hip
#   - a banner bearer on foot at the horse's left shoulder (the lighter LITE figure): a kettle hat over
#     a mail coif, a Team tabard over a quilted gambeson, hose and boots; the banner upright in his
#     right fist: a pole with a spear-point finial, a swallow-tailed flag (the squad's Emblem) flying
#     from it, Team tassels
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Rest pose only. Rigs: MountRig, CommanderRig, BearerRig.
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_general.py
# Outputs go to art-build/units/kingdoms-general/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import math
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'kingdoms-general'
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
F.start({'Coat': '8A4A26', 'Mane': '2A1C14', 'Leather': '4E3122', 'Saddle': '5E2E22', 'Wood': '5A3A26', 'Trim': 'E8DDC0', 'Cloth': 'D6CBB0',
         'Hose': '4C4034', 'Metal': ('B4B8BD', .32, .82), 'Mail': ('7E848B', .55, .75), 'Gilt': ('D8AE4A', .35, .8),
         'Hair': '5A3A24', 'Skin': 'C99472', 'Emblem': 'E6D6AF'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), socks=False)
parts.append(horse)
tm.caparison(horse, 'Team', trim='Trim', hem=.40, dag=.022, ys=(-.50, -.42, -.28, -.14, 0, .14, .28, .42, .50))
tm.war_saddle(horse, 'Saddle')


def coronet(name='Coronet', mat='Gilt', z=.990, points=8):
    """A gilt circlet round the helmet with small points standing up from it (Head)."""
    tube(name, vertical([z, z + .020], -.004, [(.072, .070), (.071, .069)], 'Head'), mat, 10, caps=(False, False))
    for k in range(points):
        a = 2 * math.pi * k / points
        x, y = .071 * math.sin(a), -.004 - .069 * math.cos(a)
        tube(f'{name}Point{k}', [((x, y, z + .016), .009, 'Head'), ((x * 1.02, y * 1.02, z + .046), .002, 'Head')], mat, 3)


# ---- the lord astride ----
cmd = F.figure('Commander')
parts.append(cmd)
F.legs(boots='Metal', hose='Mail')
F.poleyns('Metal')
F.arms(long='Mail', pad=.004, shoulder='Metal')
F.head(ears=False)
F.beard()
F.skirt('MailSkirt', 'Mail', low=.400, grow=.008, seated=True)
F.mail_coif(cape=.186)
F.torso('Surcoat', 'Team', grow=.014, chest=.006)
F.surcoat_flaps('Surcoat', 'Team')
F.band('Belt', 'Leather', .528, .550, grow=.028, bone='Spine', bulge=.002)
F.hip_sword('Sword', 'L', tip=(.176, .150, .230))
F.cloak('Cloak', 'Team', top=.794, low=.440, rows=4, k=5, arc=(150, 92), width=(.130, .215), depth=(.080, .100), back=(.008, .200))
box('CloakClasp', (-.076, -.064, .772), (.034, .014, .034), 'Gilt', 'Chest')
# an open bascinet: the face stays bare under the brow, its crown rising to a low point
rings = [(.880, .074, .072, .006), (.920, .076, .073, .004), (.958, .075, .072, .002), (.996, .066, .064, .004), (1.030, .042, .041, .010), (1.058, .004, .004, .018)]
helm = tube('Bascinet', [((0, cy, z), (rx, ry), 'Head') for z, rx, ry, cy in rings], 'Metal', 10, caps=(True, True))
for i in range(2):
    helm.data.vertices[i * 10].co.y = -.020
    for j in (1, 9):
        helm.data.vertices[i * 10 + j].co.y *= .75
coronet()
F.astride(right=(-.300, -.430, .900), left=(.105, -.185, .640), right_pole=(-1, .2, -.4))
F.pointing_hand('R', mat='Skin')
gl = F.fist('L', None, (0, 1, 0), half=.020, mat='Metal')
tm.stirrups(horse)
tm.reins(horse, F.SEAT + gl)

# ---- the banner bearer on foot at the horse's left shoulder ----
bearer = F.figure('Bearer')
parts.append(bearer)
F.LITE = True  # the lighter figure: the lord is the one seen up close
GRIP_R, GRIP_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))
F.legs(boots='Leather', hose='Hose')
F.arms(long='Cloth', pad=.006)
F.head(ears=False)
F.skirt('GambesonSkirt', 'Cloth', low=.380, grow=.010, sides=8, ribs=.06)
F.tabard('Tabard', 'Team', low=.420, grow=.010, sides=8)
F.band('Belt', 'Leather', .536, .560, grow=.022, bone='Spine', sides=8)
F.hair(crown=False)
F.kettle_hat(brim=.118, droop=.028, comb=False, sides=10)
F.place((.50, -.05, 0))
g = F.fist('R', GRIP_R, (0, 0, 1))
F.fist('L', GRIP_L, (0, 1, 0), half=.020)
P, top = 'Prop_R', 1.70
tube('StandardPole', [((g.x, g.y, .040), .012, P), ((g.x, g.y, top), .010, P)], 'Wood', 5, attachment=True)
tube('StandardFinial', [((g.x, g.y, top - .005), .014, P), ((g.x, g.y, top + .035), (.009, .026), P), ((g.x, g.y, top + .110), .001, P)], 'Gilt', 4, attachment=True)
# the flag flies out to the side from the pole: a swallow tail, both faces the squad's Emblem
x0, x1, z0, z1, y = g.x + .010, g.x + .330, top - .330, top - .030, g.y
notch = .085
fv = [(x0, y, z1), (x1, y, z1 - .020), (x1 - notch, y, (z0 + z1) / 2), (x1, y, z0 + .020), (x0, y, z0)]
ff = [(0, 4, 2), (0, 2, 1), (4, 3, 2), (0, 1, 2), (0, 2, 4), (4, 2, 3)]
flag = raw('StandardEmblem', fv, ff, 'Emblem', P, True)
F.loose.add(flag.name)
uv = flag.data.uv_layers.active
for poly in flag.data.polygons:
    for li in poly.loop_indices:
        co = flag.data.vertices[flag.data.loops[li].vertex_index].co
        uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
box('StandardHoist', (g.x + .006, y, (z0 + z1) / 2), (.016, .016, z1 - z0 + .01), 'Gilt', P, True)
for k, zz in enumerate((z1 - .020, z0 + .020)):
    tube(f'StandardTassel{k}', [((x1 - .004, y, zz), .005, P), ((x1 + .010, y, zz - .045), .004, P), ((x1 + .014, y, zz - .068), .012, P)], 'Team', 4, attachment=True)

tris = F.finish_unit(UID, parts, {
    'role': 'Kingdoms general: a mounted lord on a chestnut horse under a short Team caparison (drawn as plain wool on a mount) with the war saddle and stirrups, pointing ahead, in an open bascinet with a gilt coronet, a beard, a mail coif, a Team surcoat over mail, a long Team cloak with a gilt clasp; a banner bearer on foot (kettle hat, Team tabard over a gambeson) whose swallow-tailed flag is the squad emblem',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, surcoat_flaps, cloak, pointing_hand, poleyns, tabard, kettle_hat) and ti_mounts.py (fine_horse, caparison, war_saddle, stirrups, reins). The banner pole, finial and flag are attachments (StandardPole, StandardEmblem).'},
    centre=(.2, -.1, .85), scale=2.8)
print('TRIS', tris)
assert tris <= 4500, tris  # two people and a horse: over the 3,500 target (the Classical general is 3,864, the Bronze 4,486)
