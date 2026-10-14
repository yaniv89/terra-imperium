# scripts/blender/build_classical_general.py
# The Classical general, quality pass of 2026-10-14 (after the Bronze general), on the figure parts of
# ti_figure.py and the horse and tack of ti_mounts.py; replaces b_general of build_units_classical.py.
# The look follows plans/art/concepts/oct13/units-classical-set.png (design reference only):
#   - a pale grey horse at true size (ti_mounts.fine_horse, bridle), a Team saddle cloth (drawn as
#     plain wool on a mount), girth and a breast band with three bronze discs
#   - the commander astride, pointing ahead with his right hand, the reins in his left: a bronze helmet
#     with cheek pieces and a transverse Team crest from ear to ear (the officer's mark), a bronze
#     muscled cuirass with shoulder guards over a white tunic, red pteruges, a long Team cloak from the
#     shoulders over the horse's back with a bronze clasp, a sword at the hip, sandals
#   - a standard bearer on foot at the horse's left shoulder: helmet with a Team crest, a Team cloak,
#     white tunic and belt, sandals; the standard upright in his right fist: a pole with a spear-point
#     finial and a crossbar, the cloth hanging from it the squad's Emblem, Team tassels
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Rest pose only. Rigs: MountRig, CommanderRig, BearerRig.
#   blender -b --factory-startup -P scripts/blender/build_classical_general.py
# Outputs go to art-build/units/classical-general/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'classical-general'
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
F.start({'Coat': 'D6D0C4', 'Mane': '6B635A', 'Leather': '5A3624', 'Wood': '4A3626', 'Cloth': 'F0E8D4', 'Trim': '9C3328',
         'Metal': ('D2A24C', .36, .65), 'Iron': ('C9CCD0', .32, .75), 'Hair': '2B201A', 'Skin': 'C99472', 'Emblem': 'E6D6AF'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), blaze=False, socks=False)
parts.append(horse)
tm.tack(horse, 'Team', discs=3)


def crest_transverse(name, mat='Team'):
    """A crest from ear to ear: the swordsman's ridge turned across the helmet."""
    ob = F.ridge(name, [(-.080, .930, .990), (-.056, .990, 1.074), (0, 1.030, 1.112), (.056, .990, 1.074), (.080, .930, .990)], mat, 'Head', half=(.013, .022))
    F.turn([ob], (0, -.003, 1.0), 90)
    return ob


# ---- the commander astride ----
cmd = F.figure('Commander')
parts.append(cmd)
F.legs(laces=False)
F.arms(sleeve='Cloth', shoulder='Metal')
F.head(ears=False)
F.skirt('Tunic', 'Cloth', low=.390, seated=True)
F.strips('Pteruges', 'Trim', .512, .410, n=10, grow=.008, seated=True)
cuirass = F.torso('Cuirass', 'Metal', grow=.008, chest=.011)
for j in range(10):  # the flange at the waist
    v = cuirass.data.vertices[j].co
    v.x, v.y = v.x * 1.07, v.y * 1.07
F.band('Belt', 'Leather', .528, .552, grow=.022, bone='Spine')
F.cloak('Cloak', 'Team', top=.794, low=.430, rows=4, k=5, arc=(150, 88), width=(.124, .215), depth=(.078, .100), back=(.006, .190))
box('CloakClasp', (-.074, -.060, .772), (.032, .014, .032), 'Metal', 'Chest')
tube('Scabbard', [((.122, -.020, .540), (.016, .010), 'Hips'), ((.150, .010, .430), (.015, .009), 'Hips'), ((.166, .034, .340), (.008, .006), 'Hips')], 'Leather', 4)
tube('SwordHilt', [((.118, -.024, .548), .010, 'Hips'), ((.104, -.036, .610), .011, 'Hips')], 'Metal', 4)
F.helmet('Metal')
crest_transverse('Crest')
F.astride(right=(-.300, -.430, .900), left=(.105, -.185, .640), right_pole=(-1, .2, -.4))
F.pointing_hand('R')
gl = F.fist('L', None, (0, 1, 0), half=.020)
tm.reins(horse, F.SEAT + gl)

# ---- the standard bearer on foot at the horse's left shoulder ----
bearer = F.figure('Bearer')
parts.append(bearer)
F.LITE = True  # the lighter figure (fewer sides on the head, arms and fists): the commander is the one seen up close
GRIP_R, GRIP_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))
F.legs(laces=False)
F.arms()
F.head(ears=False)
F.skirt('Tunic', 'Cloth', low=.365, sides=8)
F.torso('TunicTop', 'Cloth', sides=8)
F.band('Belt', 'Leather', .515, .545, grow=.012, bone='Spine', sides=8)
F.cloak('Cloak', 'Team', top=.794, low=.420, rows=3, k=5, arc=(150, 95), width=(.124, .175), depth=(.078, .098), back=(.006, .060))
box('CloakClasp', (-.074, -.060, .772), (.030, .014, .030), 'Metal', 'Chest')
F.helmet('Metal')
F.ridge('Crest', [(-.066, .975, 1.012), (-.040, .996, 1.072), (0, 1.024, 1.098), (.046, .996, 1.088), (.076, .952, 1.044), (.094, .900, .980)],
        'Team', 'Head', half=(.012, .020))
F.place((.50, -.05, 0))
g = F.fist('R', GRIP_R, (0, 0, 1))
F.fist('L', GRIP_L, (0, 1, 0), half=.020)
P, top = 'Prop_R', 1.66
tube('StandardPole', [((g.x, g.y, .040), .012, P), ((g.x, g.y, top), .010, P)], 'Wood', 5, attachment=True)
tube('StandardFinial', [((g.x, g.y, top - .005), .014, P), ((g.x, g.y, top + .035), (.009, .026), P), ((g.x, g.y, top + .110), .001, P)], 'Metal', 4, attachment=True)
tube('StandardBar', [((g.x - .165, g.y, top - .045), .009, P), ((g.x + .165, g.y, top - .045), .009, P)], 'Metal', 5, attachment=True)
x0, x1, z0, z1, y = g.x - .140, g.x + .140, top - .390, top - .055, g.y - .016
banner = raw('StandardEmblem', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', P, True)
F.loose.add(banner.name)
uv = banner.data.uv_layers.active
for poly in banner.data.polygons:
    for li in poly.loop_indices:
        co = banner.data.vertices[banner.data.loops[li].vertex_index].co
        uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
box('StandardHem', ((x0 + x1) / 2, y, z0 - .008), (x1 - x0 + .01, .012, .016), 'Metal', P, True)
for k, x in enumerate((x0 + .012, x1 - .012)):
    tube(f'StandardTassel{k}', [((x, y - .004, z0), .005, P), ((x, y - .004, z0 - .060), .004, P), ((x, y - .004, z0 - .085), .013, P)], 'Team', 4, attachment=True)

tris = F.finish_unit(UID, parts, {
    'role': 'Classical general: a mounted commander on a pale grey horse (Team saddle cloth, breast band with bronze discs), pointing ahead, in a bronze muscled cuirass over a white tunic with red pteruges, a long Team cloak, a helmet with a transverse Team crest; a standard bearer on foot (crested helmet, Team cloak) whose hanging standard is the squad emblem',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, cloak, pointing_hand) and ti_mounts.py (fine_horse, tack, reins). The standard pole, finial and banner are attachments.'},
    centre=(.2, -.1, .8), scale=2.6)
print('TRIS', tris)
assert tris <= 4000, tris  # two people and a horse (the Bronze general is 4,486): over the 3,500 target, under its JSON budget
