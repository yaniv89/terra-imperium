# scripts/blender/build_kingdoms_cavalry.py
# Kingdoms cavalry (knights), quality pass of 2026-10-14 (after the Classical mounted units), on the
# figure parts of ti_figure.py and the horse and tack of ti_mounts.py; replaces k_cavalry of
# build_units_kingdoms.py. The look follows plans/art/concepts/oct13/units-kingdoms-set.png (design
# reference only):
#   - a grey destrier at true size (ti_mounts.fine_horse, bridle) under a Team caparison from the
#     chest to the croup falling to the knees with a dagged hem and a cream border (on a mount the
#     battle draws Team cloth as plain wool), a steel chanfron down its face, the high war saddle
#     with its cantle and pommel, stirrups
#   - the knight astride: a closed great helm with eye slits and a brass cross, a Team torse and a
#     Team mantling down the back (Head: the battle dyes them), a mail coif, a Team surcoat over the
#     chest with flaps over the lap and the cantle (Spine), mail sleeves and chausses, steel shoulder
#     pieces, knee cops and sabatons, steel gauntlets, a sword slanting back along the flank
#   - the lance upright in the right fist with a vamplate over the hand and a Team pennon under its
#     head (the battle fits the lance to 3.5 m; upright so the far detail level keeps it), a heater
#     shield on the left arm turned a little to the side (the squad's Emblem), the reins in the left fist
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Clips (ti_mounted_clips.py, 2026-10-14): the mounted set, the lance couched in the Charge and thrust down in
# the Attack, the feet kept in the stirrups as the knight rises to the trot. Rigs: MountRig, RiderRig.
#   blender -b --factory-startup -P scripts/blender/build_kingdoms_cavalry.py
# Outputs go to art-build/units/kingdoms-cavalry/ (TI_PREVIEW=1: stills); copy the GLB to src/assets/units/.
import math
import sys
from pathlib import Path
from mathutils import Matrix, Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402

UID = 'kingdoms-cavalry'
tube, box, vertical = F.tube, F.box, F.vertical
F.start({'Coat': 'A8A39A', 'Mane': '3B3633', 'Leather': '4E3122', 'Saddle': '5E2E22', 'Wood': '5A3A26', 'Trim': 'E8DDC0',
         'Metal': ('B4B8BD', .32, .82), 'Mail': ('7E848B', .55, .75), 'Brass': ('C9A04E', .4, .7), 'Slit': '141414',
         'Hair': '2B201A', 'Skin': 'C99472', 'Emblem': 'E6D6AF'}, rig=False)
parts = []
horse, _ = tm.fine_horse('Mount', (0, 0, 0), blaze=False, socks=False)
parts.append(horse)
tm.caparison(horse, 'Team', trim='Trim')
tm.war_saddle(horse, 'Saddle')
tm.chanfron(horse)

# ---- the knight ----
rider = F.figure('Rider')
parts.append(rider)
F.legs(boots='Metal', hose='Mail')
F.poleyns('Metal')
F.arms(long='Mail', pad=.004, shoulder='Metal')
F.head(ears=False)
F.drop('FaceNose', 'FaceEye_-1', 'FaceEye_1', 'FaceBrow_-1', 'FaceBrow_1')  # under the closed helm
F.skirt('MailSkirt', 'Mail', low=.400, grow=.008, seated=True)
F.mail_coif(cape=.186)
F.torso('Surcoat', 'Team', grow=.014, chest=.006)
F.surcoat_flaps('Surcoat', 'Team')
F.band('Belt', 'Leather', .528, .550, grow=.028, bone='Spine', bulge=.002)
F.hip_sword('Sword', 'L', tip=(.176, .150, .230))
F.great_helm()
F.astride(right=(-.215, -.120, .660), left=(.105, -.185, .640))
g = F.fist('R', None, (0, 0, 1), mat='Metal')
gl = F.fist('L', None, (0, 1, 0), half=.020, mat='Metal')

# ---- the lance, upright in the right fist (Spear*: the battle fits it to a 3.5 m lance from the butt) ----
P, low, top = 'Prop_R', .235, 1.55
tube('SpearShaft', [((g.x, g.y, low), .0120, P), ((g.x, g.y, g.z + .060), .0140, P), ((g.x, g.y, top), .0095, P)], 'Wood', 5, attachment=True)
tube('SpearHead', [((g.x, g.y, top - .012), (.007, .012), P), ((g.x, g.y, top + .040), (.007, .024), P), ((g.x, g.y, top + .120), .001, P)], 'Metal', 4, attachment=True)
tube('Vamplate', [((g.x, g.y, g.z + .040), .016, P), ((g.x, g.y, g.z + .070), .048, P), ((g.x, g.y, g.z + .082), .046, P)], 'Metal', 8, caps=(True, True), attachment=True)
# the pennon trails back from under the head (its name holds "Head": it moves with the head when the lance is fitted)
y0, z0 = g.y, top - .010
F.shell('SpearHeadPennon', [[(g.x, y0 + .006, z0), (g.x, y0 + .006, z0 - .048), (g.x, y0 + .006, z0 - .096)],
                            [(g.x, y0 + .090, z0 - .010), (g.x, y0 + .090, z0 - .050), (g.x, y0 + .090, z0 - .090)],
                            [(g.x, y0 + .185, z0 - .016), (g.x, y0 + .128, z0 - .050), (g.x, y0 + .185, z0 - .086)]], .004, 'Team', P, True)

# ---- the heater shield on the left forearm, turned to face out to the left ----
b = rider.data.bones
el, wr = b['Forearm_L'].head_local, b['Hand_L'].head_local
mid = el.lerp(wr, .40)
ANG = 10  # to the front (the battle's camera sees the rider's right side: turned further out, the face went edge on) (the squad's Emblem must read from the battle's camera), a little to the left
face_dir = Matrix.Rotation(math.radians(ANG), 3, 'Z') @ Vector((0, -1, 0))
centre = mid + face_dir * .058 + Vector((.010, 0, .020))
n0 = len(F.meshes)
face, back = F.heater_shield(tuple(centre), .250, .340, name='Shield')
F.turn(F.meshes[n0:], centre, ANG)
facing = {face: tuple(face_dir), back: tuple(-face_dir)}

tm.stirrups(horse)
tm.reins(horse, F.SEAT + gl)
tris = F.finish_unit(UID, parts, {
    'role': 'Knights: a knight astride a grey destrier under a Team caparison with a dagged cream-bordered hem (drawn as plain wool on a mount), a steel chanfron, the high war saddle and stirrups; a great helm with a Team torse and mantling, a Team surcoat over mail with flaps over the lap and the cantle, steel shoulders, knee cops and gauntlets, a sword at the hip; the lance upright with a vamplate and a Team pennon, a heater shield (Emblem) on the left arm, the reins in the left fist',
    'notes': 'Quality pass of 2026-10-14 on ti_figure.py (astride, great_helm, surcoat_flaps, heater_shield, poleyns) and ti_mounts.py (fine_horse, caparison, war_saddle, stirrups, chanfron, reins). The lance is SpearShaft and SpearHead (the battle fits it to 3.5 m from the butt); the pennon is SpearHeadPennon (moves with the head).'},
    open_facing=facing, centre=(0, -.1, .85), scale=2.7, mode='NLA_TRACKS',
    clips=MC.hook(UID, lambda: MC.mounted(horse, rider, 'lance', stirrups=True), 'mounted'))
print('TRIS', tris)
assert tris <= 3500, tris
