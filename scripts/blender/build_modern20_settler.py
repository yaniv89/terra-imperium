# scripts/blender/build_modern20_settler.py
# The 20th-century Modern settler party (eight-ages plan U81) for the map close view, on the parts and the
# walking leader of build_units_settler.py (rest pose only, as the other settlers):
#   blender -b --factory-startup -P scripts/blender/build_modern20_settler.py
# A mid-century farm lorry with the household roped under a Team tarp: a rounded bonnet with a tall grille,
# separate round mudguards and running boards, an upright cab, a wooden slatted bed, a chair and a bicycle
# on top; a man in a Team jacket and cap walking beside it. Of no real make. (The present-day pickup of
# build_units_settler.build_modern becomes information-settler.)
# Outputs go to art-build/units/modern-settler/; copy the GLB to src/assets/units/modern-settler.glb.
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_settler as S  # noqa: E402

UID = 'modern-settler'
F.start({**S.COLORS, 'Cloth': 'C9C3B4', 'Paint': '3E4A3A', 'Glass': '2D3D4E', 'Tyre': '1E1E1E', 'Hose': '3A4450', 'Slat': '7A5A3A'}, rig=False)
parts, info = tm.wheeled('Truck', axles=(-.52, .46), track=.60, wheel_r=.16, wheel_w=.08, frame_z=.26, frame_len=1.2, tyre='Tyre', metal='Metal')
rig = info['rig']
F.use(rig)
W = .66
tm.side_profile('TruckBonnet', [(-.86, .34), (-.44, .34), (-.44, .56), (-.60, .58), (-.84, .52)], -W / 2 + .08, W / 2 - .08, 'Paint', 'Hull', rig)
u.box('TruckGrille', (0, -.865, .45), (W - .26, .012, .20), 'Metal', 'Hull', rig)
tm.side_profile('TruckCab', [(-.44, .34), (-.02, .34), (-.02, .86), (-.36, .86), (-.44, .62)], -W / 2, W / 2, 'Paint', 'Hull', rig)
u.box('TruckWindscreen', (0, -.42, .74), (W - .08, .01, .18), 'Glass', 'Hull', rig)
for sx in (-1, 1):
    u.box(f'TruckSideWindow{sx}', (sx * (W / 2 + .004), -.20, .72), (.008, .26, .16), 'Glass', 'Hull', rig)
    u.box(f'TruckLight{sx}', (sx * .22, -.80, .58), (.07, .07, .07), 'Metal', 'Hull', rig)
    for y in (-.52, .46):  # separate round mudguards over each wheel
        u.tube(f'TruckGuard{sx}{int(y * 10)}', [(sx * .30, y - .22, .30), (sx * .30, y - .14, .40), (sx * .30, y + .14, .40), (sx * .30, y + .22, .30)],
               [(.06, .012)] * 4, 'Paint', ['Hull'] * 4, 4, rig)
    u.box(f'TruckStep{sx}', (sx * .32, -.06, .27), (.08, .50, .02), 'Tyre', 'Hull', rig)
    for k in range(3):  # the slatted wooden bed sides
        u.box(f'TruckSlat{sx}{k}', (sx * (W / 2 - .01), .44, .40 + k * .06), (.02, .80, .035), 'Slat', 'Hull', rig)
u.box('TruckBedFloor', (0, .44, .35), (W, .80, .04), 'Slat', 'Hull', rig)
u.box('TruckTailgate', (0, .845, .45), (W, .02, .16), 'Slat', 'Hull', rig)
u.box('TruckLoad', (0, .44, .50), (.56, .68, .26), 'Team', 'Hull', rig)
u.box('TruckLoadTop', (-.06, .40, .68), (.40, .44, .12), 'Team', 'Hull', rig)
for k, y in enumerate((.24, .64)):
    u.box(f'TruckStrap{k}', (0, y, .64), (.58, .02, .02), 'Rope', 'Hull', rig)
u.box('TruckChair', (.18, .68, .72), (.12, .1, .16), 'Wood', 'Hull', rig)
for k, y in enumerate((.20, .44)):  # a bicycle roped on top: two wheels and the frame
    u.tube(f'TruckBikeWheel{k}', [(-.16, y, .86), (-.14, y, .86)], [.09, .09], 'Tyre', ['Hull'] * 2, 10, rig)
u.tube('TruckBikeFrame', [(-.15, .20, .88), (-.15, .32, .94), (-.15, .44, .88)], [.008, .008, .008], 'Metal', ['Hull'] * 3, 4, rig)
parts.append(S.leader('Man', (.62, -.55, 0), staff=False, dress='modern', hat='cap', bearded=False))

tris = F.finish_unit(UID, parts, {'role': 'A settler household on the move (20th century): a mid-century farm lorry with a rounded bonnet, round mudguards and '
                                          'running boards, a slatted wooden bed with the household under a Team tarp, a chair and a bicycle on top; a man in a '
                                          'Team jacket and cap walking beside it',
                                  'notes': 'Settler party for the map close view (eight-ages plan U81, build_modern20_settler.py).'}, centre=(0, 0, .5), scale=2.8)
print('SETTLER', UID, tris, flush=True)
