# scripts/blender/build_units_bronze.py
# The Bronze base units Claude built in Wave 1 (plans/ART-MODELS-PLAN.md 4.2, 4.3), quality pass of
# 2026-10-14 (after the spearman, the archer and the labourer): every person on the figure parts of
# ti_figure.py (shaped head, fists, sandals, the set's clothes, the side's colour on the chest, the
# waist or the head, where the battle draws it), the animals of ti_mounts.fine_horse / fine_ox, the
# fine wheels, and baked shade in COLOR_0 over the whole file.
#   bronze-cavalry   light two-horse chariot: a hide-sided car with a Team front in a wooden frame,
#                    six-spoke wheels with bronze tyres, pole, yoke and breast bands; the driver (bronze
#                    cap, Team shawl) holds the reins of both horses, the archer (headcloth with a Team
#                    band, Team sash) half draws his bow over the horses
#   bronze-general   a mounted commander on a pale horse (Team saddle cloth, bronze scale corselet,
#                    helmet with a Team crest, Team cloak and collar, a mace held upright, reins) and a
#                    standard bearer on foot whose banner is the squad's Emblem
#   bronze-support   baggage train: a long-horned ox (pale face and patch) under a withers yoke, a
#                    two-wheeled cart with plank wheels and rails, jars and a sack, the rest of the load
#                    under a Team cover lashed with ropes, a seated driver with a goad
# Rest pose only (no clips): the soldier loader bakes the rest pose and its vertex rig walks the legs
# and swings the arms. Rigs, bone names and the root object keep their names (ChariotRig, Hull,
# Wheel_L/R, HorseNearRig/HorseOffRig, MountRig, OxRig, CartRig, the people's canonical rigs).
#   blender -b --factory-startup -P scripts/blender/build_units_bronze.py -- bronze-cavalry [more ids]
# Writes art-build/units/<id>/<id>.blend, <id>.glb (uncompressed) and report.json (TI_PREVIEW=1: stills).
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
from mathutils import Vector  # noqa: E402

tube, box, raw, vertical, sheet = F.tube, F.box, F.raw, F.vertical, F.sheet
SEAT = Vector((0, -.07, .345))  # a rider's rig on the horse's back
ASTRIDE = {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0)}


# ---- bronze-cavalry: light two-horse chariot -------------------------------------------------------

def build_cavalry():
    F.start({'Coat': '7A4A2C', 'Mane': '231912', 'Leather': '5E3A24', 'Wood': '6B4A2E', 'Hide': 'D9CCAE', 'Blanket': 'B8A57E', 'Cloth': 'E6DCC2',
             'Metal': ('C59A50', .4, .6), 'Hair': '2B201A', 'Skin': 'C98E66'}, rig=False)
    parts = []
    for name, x, socks in [('HorseNear', .165, True), ('HorseOff', -.165, False)]:
        h, _ = tm.fine_horse(name, (x, -.62, 0), socks=socks)
        parts.append(h)
        F.meshes.extend([tm.drape(f'{name}Blanket', h, 'Blanket', -.25, .08, reach=92, fringe=.02),
                         tm.drape(f'{name}Girth', h, 'Leather', -.20, -.155, reach=180, grow=.024, rows=2, steps=12)])
        F.use(h, name)
        tube('BreastBand', [((.122, -.30, .705), .012, 'Mount_Spine'), ((.092, -.452, .665), .013, 'Mount_Spine'), ((0, -.505, .655), .013, 'Mount_Spine'),
                            ((-.092, -.452, .665), .013, 'Mount_Spine'), ((-.122, -.30, .705), .012, 'Mount_Spine')], 'Leather', 4)
        box('BreastBoss', (0, -.515, .655), (.040, .016, .040), 'Metal', 'Mount_Spine')
    car = u.make_armature('ChariotRig', [('Hull', (0, .22, .30), (0, .22, .5), None), ('Wheel_L', (.36, .30, .27), (.42, .30, .27), 'Hull'),
                                         ('Wheel_R', (-.36, .30, .27), (-.42, .30, .27), 'Hull')])
    parts.append(car)
    F.use(car)
    floor, H = .33, 'Hull'
    box('CarFloor', (0, .22, floor - .015), (.52, .34, .03), 'Wood', H)
    for sx in (-1, 1):
        box(f'CarPostF{sx}', (sx * .25, .058, floor + .19), (.032, .032, .38), 'Wood', H)
        box(f'CarPostB{sx}', (sx * .25, .372, floor + .16), (.030, .030, .32), 'Wood', H)
        box(f'CarSide{sx}', (sx * .25, .215, floor + .15), (.016, .29, .27), 'Hide', H)  # pale hide sides
    box('CarFront', (0, .056, floor + .185), (.47, .018, .33), 'Team', H)  # the dyed hide breastwork
    box('CarFrontBand', (0, .046, floor + .345), (.50, .020, .030), 'Metal', H)
    rail = [(-.25, .37, floor + .32), (-.25, .06, floor + .38), (0, .045, floor + .40), (.25, .06, floor + .38), (.25, .37, floor + .32)]
    tube('CarRail', [(p, .019, H) for p in rail], 'Wood', 6)
    tube('Axle', [((-.42, .30, .27), .022, H), ((.42, .30, .27), .022, H)], 'Wood', 6)
    YOKE = -.88
    tube('Pole', [((0, .30, .29), .024, H), ((0, -.05, .36), .024, H), ((0, -.50, .60), .021, H), ((0, YOKE - .02, .79), .018, H), ((0, YOKE - .08, .83), .012, H)], 'Wood', 5)
    tube('Yoke', [((-.27, YOKE, .770), .015, H), ((-.165, YOKE, .808), .020, H), ((0, YOKE, .822), .020, H), ((.165, YOKE, .808), .020, H), ((.27, YOKE, .770), .015, H)], 'Wood', 6)
    for sx in (-1, 1):
        for k, dx in enumerate((-.06, .06)):  # the yoke saddle's two legs down the horse's shoulders
            tube(f'YokeSaddle{sx}{k}', [((sx * .165 + dx * .4, YOKE, .80), .011, H), ((sx * .165 + dx, YOKE + .01, .72), .009, H)], 'Metal', 4)
    q0, q1 = Vector((-.282, .34, floor + .07)), Vector((-.282, .10, floor + .40))
    qa = (q1 - q0).normalized()
    tube('Quiver', [(tuple(q0), .030, H), (tuple(q0.lerp(q1, .5)), .038, H), (tuple(q1), .042, H)], 'Leather', 6)
    tube('QuiverRim', [(tuple(q1 - qa * .02), .046, H), (tuple(q1), .046, H)], 'Metal', 6, caps=(False, False))
    for k, (dx, dy) in enumerate(((-.012, .010), (.012, -.008), (0, .018))):
        tip = q1 + qa * .085 + Vector((dx, dy, 0))
        tube(f'QuiverArrow{k}', [(tuple(q1 + Vector((dx, dy, 0))), .004, H), (tuple(tip), .004, H)], 'Wood', 3)
        tube(f'QuiverFletch{k}', [(tuple(tip - qa * .04), (.012, .003), H), (tuple(tip), (.012, .003), H)], 'Cloth', 3)
    for side, sx in [('L', 1), ('R', -1)]:
        F.adopt(tm.fine_wheel(f'Wheel{side}', car, f'Wheel_{side}', sx * .36, .30, .27, .27, spokes=6, rim='Metal'))
    # ---- the driver, both fists forward on the reins ----
    drv = F.crew('Driver', headgear='cap', accent='shawl', simple=True)
    parts.append(drv)
    F.reach('L', (.098, -.200, .672), pole=(.8, .2, -1))
    F.reach('R', (-.098, -.200, .672), pole=(-.8, .2, -1))
    F.bake_rest()
    at = Vector((-.11, .17, floor))
    F.place(at)
    gl = F.fist('L', None, (1, 0, 0), half=.020)
    gr = F.fist('R', None, (1, 0, 0), half=.020)
    F.use(car)
    for hx, g, name in ((.165, gl, 'Near'), (-.165, gr, 'Off')):
        hand = at + g
        for sx in (-1, 1):
            bit = Vector((hx + sx * .043, -.62 - .722, .898))
            mid = bit.lerp(hand, .55) + Vector((0, 0, -.05))
            tube(f'{name}Rein{sx}', [(tuple(bit), .006, H), (tuple(mid), .006, H), (tuple(hand), .006, H)], 'Leather', 3)
    # ---- the archer: the bow out over the horses in the left fist, the right hand at the chest on the string ----
    arc = F.crew('Archer', headgear='headcloth', accent='sash', simple=True)
    parts.append(arc)
    F.reach('L', (.170, -.230, .800), pole=(1, .2, -.6))
    F.reach('R', (.010, -.075, .770), pole=(-.6, 1, .1))
    F.bake_rest()
    F.place((.12, .31, floor))
    g = F.fist('L', None, (0, 0, 1))
    r = F.fist('R', None, (0, 1, 0), half=.018)
    BOW_LEN, BRACE = .84, .085
    back = (r - g)
    back.z = 0
    back = back.normalized()
    pts = []
    for i in range(9):
        t = i / 8
        p = g + Vector((0, 0, (t - .5) * BOW_LEN)) + back * BRACE * (1 - max(0, math.sin(math.pi * t)) ** .8) - back * .02 * math.sin(math.pi * t)
        pts.append((tuple(p), .0075 + .0055 * math.sin(math.pi * t), 'Prop_L'))
    tube('SelfBow', pts, 'Wood', 5, attachment=True)
    tube('BowGrip', [((g.x, g.y, g.z - .040), .0155, 'Prop_L'), ((g.x, g.y, g.z + .040), .0155, 'Prop_L')], 'Leather', 6, caps=(False, False), attachment=True)
    tube('BowString', [(pts[0][0], .0032, 'Prop_L'), (tuple(r), .0032, 'Hand_R'), (pts[-1][0], .0032, 'Prop_L')], 'Cloth', 3, attachment=True)
    d = (g - r).normalized()
    tube('NockedArrow', [(tuple(r), .004, 'Prop_R'), (tuple(g + d * .10), .004, 'Prop_R')], 'Wood', 4, attachment=True)
    tube('NockedArrowHead', [(tuple(g + d * .095), (.010, .004), 'Prop_R'), (tuple(g + d * .14), .001, 'Prop_R')], 'Metal', 4, attachment=True)
    tris = F.finish_unit('bronze-cavalry', parts, {
        'role': 'Chariots (bronze cavalry): two small horses (bridles, breast bands, blankets) under a yoke on the withers, a hide-sided car with a Team front in a wooden frame, six-spoke wheels with bronze tyres, a quiver on the car; the driver holds the reins of both horses, the archer half draws his bow',
        'notes': 'Quality pass of 2026-10-14 (ti_figure crew, ti_mounts.fine_horse and fine_wheel). Horses are small Bronze Age horses (0.78 H at the withers). Yoke on the withers with saddles; no stirrups or collars. Culture-neutral: no national motifs.'},
        centre=(0, -.35, .55), scale=2.8)
    assert tris <= 6000, tris


# ---- bronze-general: mounted commander and standard bearer -------------------------------------------

def build_general():
    F.start({'Coat': 'CFC6B4', 'Mane': '4A4038', 'Leather': '5C3826', 'Wood': '3F2E22', 'Cloth': 'E7DDC7', 'Metal': ('C9A055', .4, .65),
             'Hair': '2B201A', 'Skin': 'C98E66', 'Emblem': 'E6D6AF'}, rig=False)
    parts = []
    horse, _ = tm.fine_horse('Mount', (0, 0, 0), blaze=False, socks=False)
    parts.append(horse)
    F.meshes.extend([tm.drape('SaddleCloth', horse, 'Team', -.30, .16, reach=108, fringe=.028),
                     tm.drape('Girth', horse, 'Leather', -.22, -.175, reach=180, grow=.031, rows=2, steps=12)])
    F.use(horse)
    S = 'Mount_Spine'
    tube('BreastBand', [((.124, -.30, .705), .012, S), ((.094, -.452, .665), .013, S), ((0, -.505, .655), .013, S), ((-.094, -.452, .665), .013, S), ((-.124, -.30, .705), .012, S)], 'Leather', 4)
    for k, x in enumerate((-.07, 0, .07)):
        box(f'BreastDisc{k}', (x, -.500 + abs(x) * .6, .650), (.036, .014, .036), 'Metal', S)
    # ---- the commander astride ----
    cmd = F.figure('Commander')
    parts.append(cmd)
    F.legs(laces=True)
    F.arms(sleeve='Cloth', shoulder='Metal')
    F.head()
    F.beard()
    F.hair_nape()
    F.kilt('Tunic', 'Cloth', seated=True)
    rings = []
    for i, (z, rx, ry) in enumerate(F.BRONZE_TORSO):
        wt = 'Spine' if z < .66 else 'Chest'
        if 0 < i < 6:  # scales: each band overlaps the one below
            rings.append(((0, 0, z - .003), (rx + .010, ry + .009), wt))
        rings.append(((0, 0, z), (rx + .002, ry + .002), wt))
    tube('ScaleCorselet', rings, 'Metal', 10, caps=(False, True))
    tube('Belt', vertical([.520, .548], 0, [(.105, .078), (.103, .076)], 'Spine'), 'Leather', 10, caps=(False, False))
    tube('CloakCollar', vertical([.770, .800], [.004, .006], [(.112, .080), (.078, .060)], 'Chest'), 'Team', 10, caps=(False, False))
    box('CloakClasp', (.050, -.068, .785), (.030, .012, .030), 'Metal', 'Chest')
    tube('Cloak', [((0, .070, .785), (.120, .014), 'Chest'), ((0, .105, .665), (.150, .016), 'Chest'), ((0, .150, .545), (.172, .016), 'Spine'),
                   ((0, .215, .420), (.188, .012), 'Spine')], 'Team', 6)
    F.cap('Helmet', height=1.075)
    tube('HelmetRim', vertical([.944, .958], -.003, [(.075, .070), (.075, .070)], 'Head'), 'Leather', 10, caps=(False, False))
    tube('Plume', [((0, -.010, 1.065), .016, 'Head'), ((0, .020, 1.120), .036, 'Head'), ((0, .085, 1.125), .040, 'Head'), ((0, .150, 1.065), .030, 'Head'),
                   ((0, .175, .985), .010, 'Head')], 'Team', 6, attachment=True)
    F.pose(ASTRIDE)
    F.reach('R', (-.240, -.130, .665), pole=(-.8, .3, -1))
    F.reach('L', (.105, -.185, .640), pole=(.8, .2, -1))
    F.bake_rest()
    F.place(SEAT)
    g = F.fist('R', None, (0, 0, 1))
    gl = F.fist('L', None, (0, 1, 0), half=.020)
    P = 'Prop_R'
    tube('MaceHaft', [((g.x, g.y, g.z - .110), .0105, P), ((g.x, g.y, g.z + .300), .0095, P)], 'Wood', 5, attachment=True)
    tube('MaceHead', [((g.x, g.y, g.z + .285), .014, P), ((g.x, g.y, g.z + .310), .034, P), ((g.x, g.y, g.z + .350), .036, P), ((g.x, g.y, g.z + .380), .012, P)], 'Metal', 7, attachment=True)
    F.use(horse)
    hand = SEAT + gl
    for sx in (-1, 1):
        bit = Vector((sx * .043, -.722, .898))
        mid = bit.lerp(hand, .5) + Vector((sx * .03, 0, -.05))
        tube(f'Rein{sx}', [(tuple(bit), .0065, 'Mount_Head'), (tuple(mid), .0065, 'Mount_Neck'), (tuple(hand), .0065, 'Mount_Neck')], 'Leather', 3)
    # ---- the standard bearer on foot at the horse's left shoulder ----
    bearer = F.crew('Bearer', headgear='headcloth', accent='shawl', laces=True)
    parts.append(bearer)
    F.place((.50, -.05, 0))
    g = F.fist('R', Vector((-.223, -.137, .604)), (0, 0, 1))
    F.fist('L', Vector((.225, -.130, .608)), (0, 1, 0), half=.020)
    P, top = 'Prop_R', 1.62
    tube('StandardPole', [((g.x, g.y, .040), .012, P), ((g.x, g.y, top), .010, P)], 'Wood', 5, attachment=True)
    tube('StandardFinial', [((g.x, g.y, top - .005), .016, P), ((g.x, g.y, top + .030), (.028, .006), P), ((g.x, g.y, top + .085), .002, P)], 'Metal', 4, attachment=True)
    box('StandardBar', (g.x + .12, g.y, top - .03), (.30, .02, .02), 'Metal', P, True)
    x0, x1, z0, z1, y = g.x - .02, g.x + .26, top - .27, top - .04, g.y - .012
    banner = raw('StandardEmblem', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', P, True)
    F.loose.add(banner.name)
    uv = banner.data.uv_layers.active
    for poly in banner.data.polygons:
        for li in poly.loop_indices:
            co = banner.data.vertices[banner.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    for k, x in enumerate((x0 + .01, x1 - .01)):
        tube(f'StandardTassel{k}', [((x, y + .012, top - .040), .006, P), ((x, y + .012, top - .200), .004, P), ((x, y + .012, top - .230), .014, P)], 'Team', 4, attachment=True)
    tris = F.finish_unit('bronze-general', parts, {
        'role': 'Bronze general: a mounted commander on a pale horse (Team saddle cloth, bronze scale corselet, helmet with a Team crest, Team cloak and collar, a mace held upright) with a standard bearer on foot; the banner prints the squad emblem',
        'notes': 'Quality pass of 2026-10-14 (ti_figure, ti_mounts.fine_horse). A role abstraction: Bronze Age commanders mostly fought from chariots; the plan (D6, 4.3) asks for a mounted general in every age. The pole, mace, crest and banner are attachments (not counted in the model height). The battle draws the saddle cloth as plain wool (Team on a mount).'},
        centre=(.2, -.1, .7), scale=2.4)
    assert tris <= 5000, tris


# ---- bronze-support: ox baggage cart ------------------------------------------------------------------

def build_support():
    F.start({'Coat': '7E4E2E', 'Mane': '2A1E16', 'Horn': 'E2D8C0', 'Leather': '5E3A26', 'Wood': '8A6646', 'DarkWood': '5C432C', 'Cloth': 'E6DCC2',
             'Sack': 'CDBB94', 'Clay': 'B4683F', 'Rope': 'B8A47A', 'Metal': ('C09A54', .45, .6), 'Hair': '2B201A', 'Skin': 'C98E66'}, rig=False)
    parts = []
    ox, _ = tm.fine_ox('Ox', (0, -.66, 0))
    parts.append(ox)
    cart = u.make_armature('CartRig', [('Hull', (0, .40, .40), (0, .40, .6), None), ('Wheel_L', (.34, .42, .25), (.40, .42, .25), 'Hull'),
                                       ('Wheel_R', (-.34, .42, .25), (-.40, .42, .25), 'Hull')])
    parts.append(cart)
    F.use(cart)
    bed, H = .44, 'Hull'
    box('CartBed', (0, .42, bed - .02), (.54, .66, .04), 'Wood', H)
    for sx in (-1, 1):
        box(f'SideBoard{sx}', (sx * .265, .42, bed + .045), (.025, .66, .09), 'Wood', H)
        tube(f'SideRail{sx}', [((sx * .265, .09, bed + .19), .014, H), ((sx * .265, .75, bed + .19), .014, H)], 'DarkWood', 5)
        for k, y in enumerate((.10, .31, .53, .74)):
            box(f'RailPost{sx}{k}', (sx * .265, y, bed + .10), (.022, .022, .19), 'DarkWood', H)
    box('TailBoard', (0, .745, bed + .045), (.54, .025, .09), 'Wood', H)
    box('FrontBoard', (0, .095, bed + .03), (.54, .025, .06), 'DarkWood', H)
    tube('Axle', [((-.40, .42, .25), .026, H), ((.40, .42, .25), .026, H)], 'DarkWood', 6)
    for side, sx in [('L', 1), ('R', -1)]:
        F.adopt(tm.fine_disc_wheel(f'Wheel{side}', cart, f'Wheel_{side}', sx * .34, .42, .25, .25, mat='Wood', dark='DarkWood'))
        # shafts from the bed's front corners to the yoke on the ox's withers
        tube(f'Shaft{side}', [((sx * .21, .30, bed - .03), .021, H), ((sx * .21, .02, bed + .02), .021, H), ((sx * .21, -.55, .66), .019, H), ((sx * .215, -.99, .74), .016, H)], 'DarkWood', 5)
    YOKE, YZ = -.99, .775
    tube('WithersYoke', [((-.27, YOKE, YZ - .02), .018, H), ((-.12, YOKE, YZ + .01), .024, H), ((.12, YOKE, YZ + .01), .024, H), ((.27, YOKE, YZ - .02), .018, H)], 'DarkWood', 6)
    for sx in (-1, 1):
        box(f'YokePad{sx}', (sx * .075, YOKE, YZ - .035), (.07, .08, .04), 'Leather', H)
        tube(f'YokeBow{sx}', [((sx * .15, YOKE, YZ), .009, H), ((sx * .175, YOKE - .01, YZ - .12), .009, H), ((sx * .11, YOKE - .02, YZ - .22), .009, H)], 'DarkWood', 4)
    # ---- the load: two jars and a sack in front, the rest under a Team cover lashed with ropes ----
    for i, (x, y, h) in enumerate([(.13, .30, .03), (-.12, .33, 0)]):
        tube(f'Jar{i}', [((x, y, bed), .045, H), ((x, y, bed + .07 + h), .088, H), ((x, y, bed + .17 + h), .080, H), ((x, y, bed + .24 + h), .036, H),
                         ((x, y, bed + .265 + h), .046, H), ((x, y, bed + .285 + h), .040, H)], 'Clay', 8)
    tube('Sack0', [((.0, .27, bed), (.06, .10), H), ((.0, .27, bed + .10), (.10, .085), H), ((.0, .27, bed + .17), (.06, .05), H), ((.0, .27, bed + .20), .015, H)], 'Sack', 7)
    # (rings at one height: the tube runs straight along Y, so every ring keeps its orientation)
    cover = tube('LoadCover', [((0, .43, bed + .16), (.10, .20), H), ((0, .47, bed + .16), (.20, .27), H), ((0, .62, bed + .16), (.225, .285), H),
                               ((0, .72, bed + .16), (.195, .27), H), ((0, .765, bed + .16), (.09, .20), H)], 'Team', 8)
    for j in (1, 7):  # bundles under the cloth push it up in places
        cover.data.vertices[2 * 8 + j].co.z += .035
    for k, (y, r) in enumerate(((.52, (.217, .282)), (.68, (.213, .282)))):
        tube(f'CoverRope{k}', [((0, y - .008, bed + .16), r, H), ((0, y + .008, bed + .16), r, H)], 'Rope', 8, caps=(False, False))
    # ---- the driver sits on the front of the bed, legs over the front board, a goad upright in the right fist ----
    drv = F.crew('Driver', headgear='headcloth', accent='shawl', seated=True)
    parts.append(drv)
    F.pose({'Leg_L': (-88, -6, 0), 'Leg_R': (-88, 6, 0), 'Shin_L': (85, 0, 0), 'Shin_R': (85, 0, 0), 'Chest': (6, 0, 0)})
    F.reach('L', (.120, -.200, .600), pole=(.8, .2, -1))
    F.bake_rest()
    at = Vector((0, .20, bed - .43))
    F.place(at)
    g = F.fist('R', None, (0, 0, 1))
    gl = F.fist('L', None, (0, 1, 0), half=.020)
    P = 'Prop_R'
    tube('Goad', [((g.x, g.y, g.z - .14), .009, P), ((g.x, g.y, g.z + .55), .007, P)], 'Wood', 4, attachment=True)
    tube('GoadTip', [((g.x, g.y, g.z + .545), .008, P), ((g.x, g.y, g.z + .60), .001, P)], 'Metal', 4, attachment=True)
    F.use(cart)
    hand = at + gl
    tube('Lead', [(tuple(hand), .007, H), ((.03, -.40, .60), .007, H), ((.02, -1.36, .58), .007, H)], 'Rope', 3)
    tris = F.finish_unit('bronze-support', parts, {
        'role': 'Baggage train (bronze support): one long-horned draught ox (pale face, muzzle and back patch) in shafts with a withers yoke, a two-wheeled cart with plank wheels and rails, two jars and a sack, the rest of the load under a Team cover lashed with ropes, a seated driver with a goad and a lead rope',
        'notes': 'Quality pass of 2026-10-14 (ti_figure crew, ti_mounts.fine_ox and fine_disc_wheel). Jars are their own Clay material now.'},
        centre=(0, -.2, .5), scale=2.6)
    assert tris <= 5000, tris


BUILDERS = {'bronze-cavalry': build_cavalry, 'bronze-support': build_support, 'bronze-general': build_general}
ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(BUILDERS)
for uid in ids:
    BUILDERS[uid]()
