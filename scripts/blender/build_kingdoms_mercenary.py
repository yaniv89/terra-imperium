# scripts/blender/build_kingdoms_mercenary.py
# Kingdoms mercenary (a hired band's look, drawn for mercenary squads of the infantry class), quality
# pass of 2026-10-14 on the shared parts of ti_figure.py; replaces k_mercenary of
# build_units_kingdoms_irregular.py (the raider stays there):
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_mercenary.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team, Skin and Emblem tags, rest pose only (no clips). He must not be
# taken for the pikeman (build_kingdoms_infantry.py: kettle hat, Team tabard, pike), so he is a
# sell-sword in rich mixed kit:
#   - a pointed bascinet swept back to its tip, with a mail aventail over the shoulders and a small
#     Team plume at the back
#   - a wine-red brigandine studded with brass rivets over a short mail skirt, mail sleeves, steel
#     shoulder plates; a Team waist sash with a hanging end (Spine), a leather belt and a coin pouch
#   - parti-coloured hose (one leg ochre, one dark) and ankle boots
#   - a small round buckler (its face the Emblem) with a steel boss on the left fist
#   - a falchion upright in the right fist: a broad single-edged blade, widest near the clipped point
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/kingdoms-mercenary/; copy the GLB to src/assets/units/kingdoms-mercenary.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402

UID = 'kingdoms-mercenary'
arm = F.start({'Skin': 'B9805C', 'Velvet': '6A2430', 'Brass': ('C9A04E', .4, .7), 'Ochre': 'B88A3A', 'HoseDark': '2E2A28', 'Leather': '4A2E1E',
               'Metal': ('B4B8BD', .32, .82), 'Mail': ('7E848B', .55, .75), 'Wood': '5A3E2A', 'Hair': '2B201A'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical
HAND_R, HAND_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose=('Ochre', 'HoseDark'))
F.arms(long='Mail', pad=.005, shoulder='Metal')
F.fist('R', HAND_R, (0, 0, 1))
F.fist('L', HAND_L, (0, 0, 1))
F.head(ears=False)
F.beard()

# ---- mail skirt, brigandine, sash, belt, pouch ----------------------------------------------------------------
mail = F.skirt('MailSkirt', 'Mail', low=.410, grow=.010, sides=12)
for j in range(12):  # a dagged lower edge
    if j % 2:
        mail.data.vertices[j].co.z += .016
F.skirt('BrigandineSkirt', 'Velvet', low=.462, top=.548, grow=.018, sides=10, flare=.010)
F.torso('Brigandine', 'Velvet', grow=.010, chest=.012, sides=10)
for k, (z, bone) in enumerate(((.600, 'Spine'), (.680, 'Chest'), (.740, 'Chest'))):
    rx, ry = F.radius_at(z, F.TORSO)
    for sx in (-1, 1):
        box(f'Rivets{k}{sx}', (sx * rx * .45, -(ry + .016 + (.008 if .68 < z < .75 else 0)), z), (.034, .008, .010), 'Brass', bone)
F.band('Sash', 'Team', .540, .586, grow=.024, bone='Spine')
F.slab('SashEnd', [(-.070, -.098, .566), (-.036, -.100, .566), (-.028, -.118, .440), (-.072, -.116, .440)], 'Team', 'Spine')
F.band('Belt', 'Leather', .512, .530, grow=.026, bone='Spine', bulge=.002)
tube('CoinPouch', [((.124, -.046, .512), (.024, .020), 'Hips'), ((.130, -.048, .470), (.034, .028), 'Hips'), ((.126, -.046, .434), (.022, .018), 'Hips')], 'Leather', 6)

# ---- the bascinet, its aventail and plume ------------------------------------------------------------------------
F.mail_coif('Aventail', cape=.200)
rings = [(.880, .071, .070, .006), (.920, .073, .071, .004), (.955, .072, .069, .004), (.992, .062, .060, .010), (1.032, .038, .038, .024), (1.074, .004, .004, .046)]
helm = tube('Bascinet', [((0, cy, z), (rx, ry), 'Head') for z, rx, ry, cy in rings], 'Metal', 10, caps=(True, True))
for i, (z, *_r) in enumerate(rings[:2]):  # the face stays open under the brow
    helm.data.vertices[i * 10].co.y = -.020
    for j in (1, 9):
        helm.data.vertices[i * 10 + j].co.y *= .75
F.ridge('Plume', [(.030, 1.020, 1.062), (.066, .996, 1.078), (.104, .950, 1.050), (.126, .890, .980)], 'Team', 'Head', half=(.012, .026))

# ---- the falchion (the right hand's attachment), upright ------------------------------------------------------------
x, y, P = HAND_R.x, HAND_R.y, 'Prop_R'
tube('FalchionPommel', [((x, y, .552), .006, P), ((x, y, .563), .016, P), ((x, y, .574), .008, P)], 'Brass', 5, attachment=True)
tube('FalchionGrip', [((x, y, .570), .011, P), ((x, y, .642), .011, P)], 'Wood', 5, caps=(False, False), attachment=True)
box('FalchionGuard', (x, y, .647), (.018, .070, .014), 'Metal', P, True)
# rings are (thickness, width front to back): the back edge straight, the belly swelling forward to a clipped point
tube('FalchionBlade', [((x, y, .652), (.006, .016), P), ((x, y - .004, .790), (.006, .022), P), ((x, y - .010, .900), (.005, .032), P),
                       ((x, y - .006, .955), (.004, .028), P), ((x, y + .014, 1.000), (.002, .004), P)], 'Metal', 4, attachment=True)

# ---- the buckler (the left hand's attachment) ----------------------------------------------------------------------
F.oval_shield((.236, -.168, .600), .118, .118, n=12, rim='Metal', boss='Metal', dome=.030)

F.finish_rest(UID, 'Mercenary: a pointed bascinet with a mail aventail and a small Team plume, beard, a wine-red brigandine studded with brass rivets over a mail skirt, '
              'mail sleeves and steel shoulder plates, a Team waist sash, a coin pouch, parti-coloured hose and ankle boots, a round Emblem buckler with a steel boss, '
              'a falchion held upright', notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'})
