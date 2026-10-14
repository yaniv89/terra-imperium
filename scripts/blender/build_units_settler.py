# scripts/blender/build_units_settler.py
# The settler party (art items units/settler-<age>, MD01): what the map's close view draws for
# settlers on their tile (closeViewScene.js, through the soldier layer like an army). Civilians, no
# weapons, one per age band (an age shows the latest band at or below it: unitModels.js
# findSettlerModel):
#   bronze-settler    a long-horned ox in shafts pulling a two-wheeled cart piled with bundles under a
#                     Team cover, jars and a basket; a bearded man in a headcloth leading it with a
#                     staff, a woman behind with a Team bundle on her back
#   kingdoms-settler  a horse in shafts pulling a four-wheeled wagon with a hooped canvas cover (a Team
#                     band round it), barrels and sacks at the tail; a man in a Team hood leading it with
#                     a staff, a woman in a straw hat behind with a bundle on her back
#   modern-settler    a small pickup truck with the household under a Team tarp in the bed; a man in a
#                     Team jacket and cap walking beside it
# On the figure parts of ti_figure.py (a person 1 tall, front -Y), the animals of ti_mounts.fine_ox /
# fine_horse and the wheeled rig; flat colours, baked shade in COLOR_0 (F.finish_unit). Rest pose
# only: the soldier loader bakes it, its vertex rig walks the legs.
#   blender -b --factory-startup -P scripts/blender/build_units_settler.py -- [bronze-settler kingdoms-settler modern-settler]
# Writes art-build/units/<id>/<id>.blend, <id>.glb and report.json; copy the GLB to src/assets/units/.
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
from mathutils import Vector  # noqa: E402

tube, box = F.tube, F.box
COLORS = {'Coat': '7E4E2E', 'Mane': '2A1E16', 'Horn': 'E2D8C0', 'Leather': '5E3A26', 'Wood': '8A6646', 'DarkWood': '5C432C',
          'Cloth': 'E6DCC2', 'Sack': 'CDBB94', 'Clay': 'B4683F', 'Rope': 'B8A47A', 'Metal': ('C09A54', .45, .6), 'Hair': '2B201A',
          'Skin': 'C98E66', 'Straw': 'D2B46A', 'Hose': '5A4A3A', 'Dress': '8C6A4A', 'Canvas': 'E2DCCB'}


def leader(name, at, yaw=0, staff=True, dress='kilt', hat='headcloth', bearded=True, tunic='Cloth', load=False):
    """A walking civilian: `dress` kilt (the Bronze set's crew figure), gown (a long belted gown to the
    shins) or modern (a jacket and trousers); `hat` headcloth, hood (Team), straw, cap (Team); a staff
    upright in the right fist, `load` a Team bundle on the back. Returns the rig."""
    if dress == 'kilt':
        rig = F.crew(name, headgear='headcloth', accent='shawl' if staff else 'sash', bearded=bearded, tunic=tunic, lite=True)
    else:
        rig = F.figure(name)
        F.LITE = True
        if dress == 'modern':
            F.legs(boots='Leather', hose='Hose')
            F.arms(long='Team', pad=.006)
            F.head()
            F.hair(crown=False)
            F.torso('Jacket', 'Team', grow=.008, chest=.004, sides=8)
            F.skirt('JacketHem', 'Team', low=.47, grow=.006, sides=8)
        else:
            F.legs(boots='Leather', hose='Hose')
            F.arms(long=tunic, pad=.004)
            F.head()
            if bearded:
                F.beard()
            F.torso('Gown', tunic, grow=.004, sides=8)
            F.skirt('GownSkirt', tunic, low=.24, grow=.004, flare=.02, sides=8)
            F.band('Belt', 'Leather', .520, .548, grow=.012, sides=8)
        if hat == 'hood':
            F.hood('Hood', 'Team', sides=8, tail=False)
        elif hat == 'straw':
            F.hair(crown=False)
            F.straw_hat('StrawHat', 'Straw', band='Team', sides=10)
        elif hat == 'cap':
            F.ball_cap('Cap', 'Team', headset=None, sides=8)
    if staff:
        F.reach('R', (-.17, -.14, .62), pole=(-.8, .3, -1))
    F.bake_rest()
    F.place(at, yaw)
    if staff:
        g = F.fist('R', None, (0, 0, 1))
        tube(f'{name}Staff', [((g.x, g.y, .02), .011, 'Prop_R'), ((g.x, g.y, g.z + .42), .010, 'Prop_R')], 'DarkWood', 5, attachment=True)
    else:
        F.fist('R')
    F.fist('L')
    if load:  # a bundle on the back, its rope over the shoulders
        tube(f'{name}Bundle', [((0, .13, .60), (.07, .05), 'Chest'), ((0, .16, .70), (.13, .09), 'Chest'), ((0, .16, .82), (.12, .085), 'Chest'), ((0, .13, .88), (.05, .04), 'Chest')], 'Team', 8)
        tube(f'{name}Strap', [((.06, -.07, .80), .008, 'Chest'), ((.08, .02, .84), .008, 'Chest'), ((.08, .12, .80), .008, 'Chest')], 'Rope', 4)
    return rig


def cart(prefix, two_wheels=True, cover='Team'):
    """A cart (two plank wheels) or a wagon (four spoked wheels) facing -Y behind the animal, loaded."""
    if two_wheels:
        rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, .40, .40), (0, .40, .6), None), ('Wheel_L', (.34, .42, .25), (.40, .42, .25), 'Hull'),
                                               ('Wheel_R', (-.34, .42, .25), (-.40, .42, .25), 'Hull')])
    else:
        rig = u.make_armature(f'{prefix}Rig', [('Hull', (0, .55, .42), (0, .55, .62), None),
                                               ('Wheel_L', (.34, .22, .22), (.40, .22, .22), 'Hull'), ('Wheel_R', (-.34, .22, .22), (-.40, .22, .22), 'Hull'),
                                               ('Wheel_2_L', (.34, .92, .26), (.40, .92, .26), 'Hull'), ('Wheel_2_R', (-.34, .92, .26), (-.40, .92, .26), 'Hull')])
    F.use(rig)
    H = 'Hull'
    bed = .44
    y0, y1 = (.09, .75) if two_wheels else (.12, 1.02)
    yc, ln = (y0 + y1) / 2, y1 - y0
    box(f'{prefix}Bed', (0, yc, bed - .02), (.54, ln, .04), 'Wood', H)
    for sx in (-1, 1):
        box(f'{prefix}Side{sx}', (sx * .265, yc, bed + .045), (.025, ln, .09), 'Wood', H)
    box(f'{prefix}Tail', (0, y1 - .005, bed + .045), (.54, .025, .09), 'Wood', H)
    if two_wheels:
        tube(f'{prefix}Axle', [((-.40, .42, .25), .026, H), ((.40, .42, .25), .026, H)], 'DarkWood', 6)
        for side, sx in [('L', 1), ('R', -1)]:
            F.adopt(tm.fine_disc_wheel(f'{prefix}Wheel{side}', rig, f'Wheel_{side}', sx * .34, .42, .25, .25, mat='Wood', dark='DarkWood'))
    else:
        for i, (wy, wr, tag) in enumerate(((.22, .22, ''), (.92, .26, '2_'))):
            tube(f'{prefix}Axle{i}', [((-.40, wy, wr), .024, H), ((.40, wy, wr), .024, H)], 'DarkWood', 6)
            for side, sx in [('L', 1), ('R', -1)]:
                F.adopt(tm.fine_wheel(f'{prefix}Wheel{tag}{side}', rig, f'Wheel_{tag}{side}', sx * .34, wy, wr, wr, spokes=6, mat='Wood', hub='DarkWood', n=10))
    for sx in (-1, 1):  # shafts from the bed's front corners to the animal's withers
        tube(f'{prefix}Shaft{sx}', [((sx * .21, y0 + .2, bed - .03), .021, H), ((sx * .21, y0 - .07, bed + .02), .021, H), ((sx * .21, -.55, .66), .019, H),
                                    ((sx * .215, -.99, .74), .016, H)], 'DarkWood', 5)
    if two_wheels:
        # the load: jars and a basket in front, bundles under a Team cover lashed with ropes
        for i, (x, y) in enumerate(((.14, .24), (-.13, .26))):
            tube(f'{prefix}Jar{i}', [((x, y, bed), .045, H), ((x, y, bed + .08), .085, H), ((x, y, bed + .18), .075, H), ((x, y, bed + .25), .036, H),
                                     ((x, y, bed + .275), .044, H)], 'Clay', 8)
        tube(f'{prefix}Basket', [((0, .22, bed), .07, H), ((0, .22, bed + .12), .09, H)], 'Straw', 8, caps=(True, False))
        c = tube(f'{prefix}Cover', [((0, .38, bed + .16), (.10, .20), H), ((0, .42, bed + .16), (.21, .30), H), ((0, .58, bed + .16), (.235, .32), H),
                                     ((0, .70, bed + .16), (.205, .30), H), ((0, .755, bed + .16), (.09, .22), H)], cover, 8)
        for j in (1, 7):
            c.data.vertices[2 * 8 + j].co.z += .04
        for k, y in enumerate((.50, .66)):
            tube(f'{prefix}Rope{k}', [((0, y - .008, bed + .16), (.24, .315), H), ((0, y + .008, bed + .16), (.24, .315), H)], 'Rope', 8, caps=(False, False))
    else:
        # a hooped canvas cover over the bed, a Team band round its middle, barrels and sacks at the tail
        hoops = [.18, .38, .58, .78, .96]
        tube(f'{prefix}Canvas', [((0, y, bed + .06), (.29, .36), H) for y in hoops], 'Canvas', 10, caps=(True, True))
        tube(f'{prefix}Band', [((0, .56, bed + .06), (.295, .365), H), ((0, .62, bed + .06), (.295, .365), H)], cover, 10, caps=(False, False))
        box(f'{prefix}Opening', (0, .172, bed + .2), (.36, .01, .26), 'Hair', H)
        for i, x in enumerate((-.14, .14)):
            tube(f'{prefix}Barrel{i}', [((x, 1.06, bed), .07, H), ((x, 1.06, bed + .08), .085, H), ((x, 1.06, bed + .16), .07, H)], 'Wood', 8)
    return rig


def build_bronze():
    F.start(COLORS, rig=False)
    parts = []
    ox, _ = tm.fine_ox('Ox', (0, -.66, 0))
    parts.append(ox)
    parts.append(cart('Cart', two_wheels=True))
    F.use(parts[-1])
    YOKE, YZ = -.99, .775
    tube('WithersYoke', [((-.27, YOKE, YZ - .02), .018, 'Hull'), ((-.12, YOKE, YZ + .01), .024, 'Hull'), ((.12, YOKE, YZ + .01), .024, 'Hull'), ((.27, YOKE, YZ - .02), .018, 'Hull')], 'DarkWood', 6)
    parts.append(leader('Man', (.42, -1.05, 0), staff=True, dress='kilt'))
    parts.append(leader('Woman', (-.30, .98, 0), staff=False, dress='gown', hat='straw', bearded=False, tunic='Dress', load=True))
    return parts, 'A settler family: a long-horned ox in shafts pulling a two-wheeled cart of bundles under a Team cover, jars and a basket; a man in a headcloth leading it with a staff, a woman in a long gown and straw hat behind with a Team bundle on her back'


def build_kingdoms():
    F.start({**COLORS, 'Coat': '6A442A'}, rig=False)
    parts = []
    horse, _ = tm.fine_horse('Horse', (0, -.70, 0), blaze=True, socks=False, bridle=True)
    parts.append(horse)
    parts.append(cart('Wagon', two_wheels=False))
    F.use(parts[-1])
    tube('Collar', [((-.12, -.99, .80), .022, 'Hull'), ((0, -1.02, .86), .026, 'Hull'), ((.12, -.99, .80), .022, 'Hull')], 'Leather', 6)
    parts.append(leader('Man', (.44, -1.08, 0), staff=True, dress='gown', hat='hood'))
    parts.append(leader('Woman', (-.32, 1.42, 0), staff=False, dress='gown', hat='straw', bearded=False, tunic='Dress', load=True))
    return parts, 'A settler family: a horse in shafts pulling a four-wheeled wagon with a hooped canvas cover and a Team band, barrels at the tail; a man in a Team hood leading it with a staff, a woman in a straw hat behind with a Team bundle on her back'


def build_modern():
    F.start({**COLORS, 'Cloth': 'C9C3B4', 'Paint': '7A6F5A', 'Glass': '2D3D4E', 'Tyre': '1E1E1E', 'Hose': '3A4450'}, rig=False)
    parts, info = tm.wheeled('Truck', axles=(-.50, .48), track=.62, wheel_r=.15, wheel_w=.09, frame_z=.24, frame_len=1.2, tyre='Tyre', metal='Metal')
    rig = info['rig']
    F.use(rig)
    W = .7
    # a small pickup: bonnet, cab, a bed with the household under a Team tarp
    tm.side_profile('TruckBonnet', [(-.82, .30), (-.42, .30), (-.42, .50), (-.80, .47)], -W / 2 + .03, W / 2 - .03, 'Paint', 'Hull', rig)
    tm.side_profile('TruckCab', [(-.42, .30), (.08, .30), (.08, .80), (-.22, .80), (-.42, .52)], -W / 2, W / 2, 'Paint', 'Hull', rig)
    u.box('TruckWindscreen', (0, -.33, .67), (W - .08, .01, .2), 'Glass', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'TruckSideWindow{sx}', (sx * (W / 2 + .004), -.12, .66), (.008, .3, .18), 'Glass', 'Hull', rig)
        u.box(f'TruckBedSide{sx}', (sx * (W / 2 - .01), .45, .42), (.02, .74, .14), 'Paint', 'Hull', rig)
        u.box(f'TruckLight{sx}', (sx * .22, -.825, .41), (.07, .012, .05), 'Metal', 'Hull', rig)
    u.box('TruckBedFloor', (0, .45, .33), (W, .74, .04), 'Paint', 'Hull', rig)
    u.box('TruckTailgate', (0, .815, .42), (W, .02, .14), 'Paint', 'Hull', rig)
    u.box('TruckBumper', (0, -.84, .32), (W + .04, .04, .06), 'Tyre', 'Hull', rig)
    u.box('TruckLoad', (0, .44, .48), (.58, .64, .26), 'Team', 'Hull', rig)
    u.box('TruckLoadTop', (-.06, .40, .66), (.40, .44, .12), 'Team', 'Hull', rig)
    for k, y in enumerate((.26, .62)):
        u.box(f'TruckStrap{k}', (0, y, .62), (.6, .02, .02), 'Rope', 'Hull', rig)
    u.box('TruckChair', (.18, .68, .70), (.12, .1, .16), 'Wood', 'Hull', rig)
    parts.append(leader('Man', (.62, -.55, 0), staff=False, dress='modern', hat='cap', bearded=False))
    return parts, 'A settler household on the move: a small pickup with the household under a Team tarp and a chair on top; a man in a Team jacket and cap walking beside it'


BUILDERS = {'bronze-settler': build_bronze, 'kingdoms-settler': build_kingdoms, 'modern-settler': build_modern}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for uid in ids:
        parts, role = BUILDERS[uid]()
        tris = F.finish_unit(uid, parts, {'role': role, 'notes': 'Settler party for the map close view (2026-10-14, build_units_settler.py).'}, centre=(0, 0, .5), scale=2.8)
        print('SETTLER', uid, tris, flush=True)
    sys.stdout.flush()
    os._exit(0)
