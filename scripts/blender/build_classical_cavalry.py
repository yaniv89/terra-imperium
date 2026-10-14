# scripts/blender/build_classical_cavalry.py
# Classical heavy cavalry, quality pass of 2026-10-14 (after the Bronze general and raider), on the
# figure parts of ti_figure.py and the horse and tack of ti_mounts.py; replaces b_cavalry of
# build_units_classical.py. The look follows plans/art/concepts/oct13/units-classical-set.png (design
# reference only):
#   - a bay horse at true size (ti_mounts.fine_horse: blaze, white socks, bridle), a Team saddle cloth
#     (the battle draws a mount's Team cloth as plain wool), girth and a breast band with bronze discs;
#     no stirrups
#   - the rider astride: a bronze helmet with cheek pieces and neck guard under a tall Team crest, a
#     coat of bronze scales with shoulder pieces over a white tunic with a red hem, a Team cloak from
#     the shoulders, a belt, boots
#   - a long spear held upright in the right fist (the battle fits it to 3.5 m; upright so the far
#     detail level keeps it), a small round shield on the left arm turned to the side (the squad's
#     Emblem), the reins in the left fist
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Rest pose only (the vertex rig trots the horse). Rigs: MountRig, RiderRig.
#   blender -b --factory-startup -P scripts/blender/build_classical_cavalry.py
# Outputs go to art-build/units/classical-cavalry/ (TI_PREVIEW=1: stills); copy the GLB and the JSON's
# budget to src/assets/units/.
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402

UID = 'classical-cavalry'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': '6E3F24', 'Mane': '1F1712', 'Leather': '5A3624', 'Boot': '4A2F20', 'Wood': '3A2A1E', 'Cloth': 'F0E8D4', 'Trim': '9C3328',
         'Metal': ('D2A24C', .36, .65), 'Iron': ('C9CCD0', .32, .75), 'Hair': '2B201A', 'Skin': 'C99472', 'Emblem': 'E6D6AF'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0))
parts.append(horse)
tm.tack(horse, 'Team', discs=3)

# ---- the rider ----
rider = F.figure('Rider')
parts.append(rider)
F.legs(boots='Boot')
F.arms(sleeve='Cloth', shoulder='Metal')
F.head(ears=False)
F.hair_nape()
F.skirt('Tunic', 'Cloth', low=.385, seated=True)
hem = F.skirt('TunicHem', 'Trim', low=.380, top=.405, grow=.003, seated=True)
F.torso('TunicTop', 'Cloth', sides=8)
F.scale_coat('ScaleCoat', 'Metal', low=.505, high=.785, rows=5)
F.band('Belt', 'Leather', .512, .540, grow=.030, bone='Spine')
F.cloak('Cloak', 'Team', top=.792, low=.505, rows=3, k=6, arc=(140, 80), width=(.122, .180), depth=(.076, .086), back=(.006, .110))
F.helmet('Metal')
F.ridge('Crest', [(-.070, .975, 1.016), (-.044, .996, 1.088), (0, 1.026, 1.124), (.046, .998, 1.112), (.078, .952, 1.070),
                  (.098, .900, 1.000), (.104, .866, .912)], 'Team', 'Head', half=(.014, .026))
F.astride(right=(-.215, -.120, .660), left=(.105, -.185, .640))
g = F.fist('R', None, (0, 0, 1))
gl = F.fist('L', None, (0, 1, 0), half=.020)

# ---- the spear, upright in the right fist (Spear*: the battle fits it to a 3.5 m lance) ----
P, low, top = 'Prop_R', .235, 1.55
tube('SpearShaft', [((g.x, g.y, low), .0115, P), ((g.x, g.y, top), .0100, P)], 'Wood', 5, attachment=True)
tube('SpearHead', [((g.x, g.y, top - .012), (.006, .012), P), ((g.x, g.y, top + .040), (.007, .026), P), ((g.x, g.y, top + .125), .001, P)], 'Iron', 4, attachment=True)

# ---- the small round shield on the left forearm, turned to face out to the left ----
b = rider.data.bones
el, wr = b['Forearm_L'].head_local, b['Hand_L'].head_local
mid = el.lerp(wr, .45)
ANG = 28  # mostly to the front (the squad's Emblem must read from the battle's camera), a little to the left
face_dir = Matrix.Rotation(math.radians(ANG), 3, 'Z') @ Vector((0, -1, 0))
centre = mid + face_dir * .060 + Vector((0, 0, .03))
n0 = len(F.meshes)
F.round_shield(tuple(centre), .145, n=14)
F.turn(F.meshes[n0:], centre, ANG)
facing = {'RiderShieldFace': tuple(face_dir), 'RiderShieldBack': tuple(-face_dir)}

tm.reins(horse, F.SEAT + gl)
tris = F.finish_unit(UID, parts, {
    'role': 'Heavy cavalry: a rider astride a bay horse (Team saddle cloth, girth, breast band with bronze discs, no stirrups) in a coat of bronze scales over a white tunic with a red hem, a Team cloak, a helmet with cheek pieces and a tall Team crest, boots; a long spear upright in the right fist, a small round Emblem shield on the left arm, the reins in the left fist',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, scale_coat, cloak) and ti_mounts.py (fine_horse, tack, reins). The spear is SpearShaft and SpearHead (the battle fits it to a 3.5 m lance from the butt).'},
    open_facing=facing, centre=(0, -.1, .8), scale=2.6)
print('TRIS', tris)
assert tris <= 3500, tris
