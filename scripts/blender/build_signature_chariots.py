# scripts/blender/build_signature_chariots.py
# The signature chariots on the quality pipeline (2026-10-20): the Bronze chariot of build_units_bronze.py
# (build_cavalry: fine horses with blankets and breast bands, the ChariotRig car with Hull/Wheel_L/Wheel_R,
# fine wheels, crew on the ti_figure figure, reins) generalised into one builder, and one recipe per people
# keeping its look line from the roster (plans/ART-MODELS-PLAN.md 4.5; the old rest-pose builders
# build_units_bronze_signature.py CHARIOTS and build_units_classical_signature.py CHARIOTS). Every file
# carries the chariot clip set of ti_mounted_clips.chariot (Idle, Move, Charge, Archer-shoot, Hit, Wreck)
# over every rig: two or four horses, the car, a driver, a bowman and/or a man with a spear, a javelin or a
# halberd (he thrusts or chops where the bowman looses).
#   blender -b --factory-startup -P scripts/blender/build_signature_chariots.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb), report.json and <model>.json (the shipped
# options with the clips; triangleBudget 6000). Copy the GLB to src/assets/units/signature/ and the json's
# keys over the shipped one.
import json
import math
import bpy
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector  # noqa: E402

import ti_figure as F  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_units as u  # noqa: E402

V = Vector
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical
BUDGET = 6000
BRONZE = ('C2995A', .4, .6)
IRON = ('8E8A84', .45, .7)
YOKE = -.88  # (ti_mounted_clips.chariot: the yoke on the yoke pair's withers)
BASE_COLORS = {'Coat': '7A4A2C', 'Mane': '231912', 'CoatB': '7A4A2C', 'ManeB': '231912', 'Leather': '5E3A24', 'Wood': '6B4A2E', 'Hide': 'D9CCAE',
               'Blanket': 'B8A57E', 'Cloth': 'E6DCC2', 'Metal': ('C59A50', .4, .6), 'Hair': '2B201A', 'Skin': 'C98E66', 'Emblem': 'E6D6AF'}


# ---- the people in the car ------------------------------------------------------------------------------

def corselet(mat, low=.585, scales=True):
    """A corselet over the tunic from `low` to the neck: overlapping bands of scales (scales=True) or plain
    linen layers. Kept above the waist so a Team sash shows below it."""
    rings = []
    prof = [p for p in F.BRONZE_TORSO if p[0] >= low - .001]
    if prof[0][0] > low:
        rx, ry = F.torso_radius(low)
        prof = [(low, rx, ry)] + prof
    for i, (z, rx, ry) in enumerate(prof):
        wt = 'Spine' if z < .66 else 'Chest'
        if scales and 0 < i < len(prof) - 2:
            rings.append(((0, 0, z - .003), (rx + .019, ry + .017), wt))
        rings.append(((0, 0, z), (rx + .011, ry + .010), wt))
    return tube('Corselet', rings, mat, 8 if F.LITE else 10, caps=(False, True))


def cloak(mat):
    """A cloak from the shoulders down the back (the Bronze general's)."""
    tube('Cloak', [((0, .070, .785), (.120, .014), 'Chest'), ((0, .105, .665), (.150, .016), 'Chest'), ((0, .150, .545), (.172, .016), 'Spine'),
                   ((0, .200, .440), (.180, .012), 'Spine')], mat, 6)


def headgear(kind, m):
    """The man's head: 'headcloth' (a linen cloth under a band), 'cap' (the pointed bronze cap), 'conical'
    (a tall bronze helm), 'felt' (a round felt cap), 'turban', 'helmet' (a bowl helmet with cheek pieces),
    'hair' (his own hair under a band)."""
    lite = F.LITE
    if kind == 'headcloth':
        F.headcloth(m.get('band', 'Team'), tail=not lite, cloth=m.get('cloth', 'Cloth'))
    elif kind == 'hair':
        F.hair()
        F.headband(m.get('band', 'Team'))
    elif m.get('nape', True):
        F.hair_nape()
    if kind == 'cap':
        F.cap()
    elif kind == 'conical':
        zs = [.944, .951, .964, 1.010, 1.060, 1.110, 1.165]
        tube('ConicalHelm', vertical(zs, -.003, [(.070, .065), (.074, .069), (.068, .063), (.054, .050), (.036, .034), (.018, .017), (.003, .003)], 'Head'),
             'Metal', 8 if lite else 10, caps=(True, True), attachment=True)
        tube('HelmRim', vertical([.944, .958], -.003, [(.077, .072), (.077, .072)], 'Head'), 'Metal', 8 if lite else 10, caps=(False, False))
    elif kind == 'felt':
        tip = m.get('tip', 1.075)
        F.lathe('FeltCap', [(.073, .944), (.074, .962), (.066, .995), (.046, (1.000 + tip) / 2), (0, tip)], m.get('cap', 'Felt'), sides=8 if lite else 10, attachment=True)
    elif kind == 'turban':
        tube('Turban', vertical([.930, .955, .985, 1.010, 1.030], -.004, [(.070, .066), (.080, .075), (.079, .074), (.066, .062), (.030, .030)], 'Head'),
             m.get('cap', 'Turban'), 8 if lite else 10, caps=(True, True))
        tube('TurbanBand', vertical([.948, .968], -.004, [(.082, .077), (.082, .077)], 'Head'), m.get('band', 'Team'), 8, caps=(False, False))
    elif kind == 'helmet':  # a bronze bowl helmet with a ridge and cheek pieces (8 sides on a lite figure)
        tube('Helmet', vertical([.944, .952, .966, .995, 1.020, 1.050], -.003, [(.070, .066), (.0745, .070), (.069, .065), (.058, .055), (.036, .034), (.008, .008)], 'Head'),
             m.get('cap', 'Metal'), 8 if lite else 10, caps=(True, True), attachment=True)
        for s in (-1, 1):
            box(f'CheekPiece_{s}', (s * .0575, -.035, .905), (.012, .044, .070), m.get('cap', 'Metal'), 'Head')
    if m.get('feather'):
        tube('Feather', [((0, .040, .990), (.010, .004), 'Head'), ((0, .060, 1.080), (.022, .005), 'Head'), ((0, .080, 1.170), (.008, .003), 'Head')],
             m['feather'], 4, attachment=True)


def many_spoked(prefix, arm, bone, cx, cy, cz, radius, spokes, mat='Wood', hub='Metal', rim=None, n=10):
    """tm.fine_wheel for a wheel of many spokes (the Zhou, the Sintashta): the felloe the same, each spoke a
    thin three-sided rod, a nave of two flanges."""
    out = []
    for o in tm.fine_wheel(prefix, arm, bone, cx, cy, cz, radius, spokes=0, mat=mat, hub=hub, rim=rim, n=n):
        if o.name.startswith(prefix + 'Hub'):
            bpy.data.objects.remove(o, do_unlink=True)
        else:
            out.append(o)
    for i in range(spokes):  # an open three-sided prism (its ends hidden in the nave and the felloe)
        a = 2 * math.pi * (i + .5) / spokes
        ca, sa = math.cos(a), math.sin(a)
        ends = [(V((cx, cy, cz)) + V((0, ca, sa)) * r, w) for r, w in ((.035, .011), (radius - .040, .008))]
        vs = []
        for c, w in ends:
            for j in range(3):
                t = 2 * math.pi * j / 3
                vs.append(tuple(c + V((math.cos(t) * w, -sa * math.sin(t) * w, ca * math.sin(t) * w))))
        fs = [f for j in range(3) for f in ((j, (j + 1) % 3, 3 + (j + 1) % 3), (j, 3 + (j + 1) % 3, 3 + j))]
        out.append(u.mesh_obj(f'{prefix}Spoke{i}', vs, fs, mat, bone, arm=arm))
    out.append(u.tube(f'{prefix}Hub', [(cx - .058, cy, cz), (cx - .030, cy, cz), (cx + .030, cy, cz), (cx + .058, cy, cz)], [.022, .046, .046, .022], hub, [bone] * 4, 6, arm))
    return out


def man(name, m, lite):
    """A crewman on his own rig (ti_figure.crew's figure, opened up for the peoples' looks): `m` = beard
    (True, False, 'long'), bare (a bare chest), tunic (its material), armour ('scale', 'linen'), accent
    ('shawl', 'sash': the side's colour), head (see headgear), cloak (a material)."""
    rig = F.figure(name)
    F.LITE = lite
    sides = 8 if lite else 10
    F.legs(laces=False, straps=True, simple=True)
    F.arms(shoulder=None if lite else 'Skin')
    F.head()
    beard = m.get('beard', True)
    if beard:
        F.beard()
    if beard == 'long':  # a long beard down onto the chest
        tube('LongBeard', [((0, -.052, .860), (.042, .022), 'Head'), ((0, -.070, .815), (.036, .022), 'Head'), ((0, -.080, .765), (.022, .016), 'Head'),
                           ((0, -.082, .735), (.006, .006), 'Head')], 'Hair', 6)
    if beard == 'moustache':
        box('Moustache', (0, -.064, .884), (.050, .010, .010), 'Hair', 'Head')
    F.kilt('Kilt', m.get('kilt', 'Team'), sides=sides)
    if m.get('bare'):
        F.bronze_torso('BodyTorso', 'Skin', chest=True, grow=-.004, sides=sides)
    elif m.get('armour'):  # under a corselet only the tunic's waist shows
        tube('Tunic', [((0, 0, z), (rx, ry), 'Spine') for z, rx, ry in F.BRONZE_TORSO[:3]], m.get('tunic', 'Cloth'), sides, caps=(False, False))
    else:
        F.bronze_torso('Tunic', m.get('tunic', 'Cloth'), sides=sides)
    if m.get('accent', 'shawl') == 'shawl':
        tube('Belt', vertical([.520, .548], 0, [(.103, .076), (.101, .074)], 'Spine'), 'Leather', sides, caps=(False, False))
        F.shawl('Shawl', 'Team', sides=sides, end=not lite)
    else:
        F.sash('Sash', 'Team', end=not lite, knot=not lite)
    if m.get('armour') == 'scale':
        corselet('Metal')
    elif m.get('armour') == 'linen':
        corselet('Linen', scales=False)
    headgear(m.get('head', 'headcloth'), m)
    if m.get('cloak'):
        cloak(m['cloak'])
    if m.get('axe'):  # a bronze shaft-hole axe through the belt at the left hip
        tube('BeltAxeHaft', [((.112, -.050, .400), .009, 'Hips'), ((.118, -.040, .640), .009, 'Hips')], 'Wood', 4)
        tube('BeltAxeHead', [((.118, -.042, .610), (.016, .012), 'Hips'), ((.118, -.090, .600), (.022, .010), 'Hips'), ((.118, -.120, .596), (.030, .004), 'Hips')], 'Metal', 4)
    return rig


# ---- the build ------------------------------------------------------------------------------------------

def build(model, R):
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units' / 'signature')
    F.start({**BASE_COLORS, **R['colors']}, rig=False)
    lite = R.get('lite', False)
    lean = R.get('lean', False)  # a four-horse file at the budget's edge: small trims (see the zhou recipe)
    parts, horses, extra = [], [], []
    # ---- the team: the yoke pair at x +-.165 (as the base chariot), a four-horse team's outer pair beside it ----
    team = [('HorseNear', .165, 0), ('HorseOff', -.165, 1)]
    if R.get('horses', 2) == 4:
        team += [('HorseOuterNear', .495, 0), ('HorseOuterOff', -.495, 1)]
    for k, (name, x, like) in enumerate(team):
        coat, mane, blaze, socks = R['coats'][k]
        h, _ = tm.fine_horse(name, (x, -.62, 0), coat=coat, dark=mane, blaze=blaze, socks=socks, bridle=k < 2)  # (the outer pair: no bridle, for the budget)
        horses.append(h)
        dress = R.get('horse', {})
        if dress.get('barding'):  # scale barding over the back and a scale crinet down the neck
            F.meshes.extend([tm.drape(f'{name}Barding', h, dress['barding'], -.44, .40, reach=96, grow=.018, rows=4, steps=8, fringe=.030),
                             tm.drape(f'{name}BardingRow', h, dress['barding'], -.40, .36, reach=60, grow=.030, rows=3, steps=6, fringe=.024)])
            F.use(h, name)
            tube('Crinet', [((0, -.375, .712), (.090, .147), 'Mount_Neck'), ((0, -.455, .815), (.075, .113), 'Mount_Neck'), ((0, -.525, .912), (.064, .090), 'Mount_Neck')],
                 dress['barding'], 6, caps=(False, False))
        elif dress.get('blanket') and k < 2:
            F.meshes.append(tm.drape(f'{name}Blanket', h, dress['blanket'], -.25, .08, reach=92, fringe=.02))
        if len(team) == 2 and not dress.get('barding'):  # (a girth only on a pair: the budget)
            F.meshes.append(tm.drape(f'{name}Girth', h, 'Leather', -.20, -.155, reach=180, grow=.024, rows=2, steps=12))
        F.use(h, name)
        tube('BreastBand', [((.122, -.30, .705), .012, 'Mount_Spine'), ((.092, -.452, .665), .013, 'Mount_Spine'), ((0, -.505, .655), .013, 'Mount_Spine'),
                            ((-.092, -.452, .665), .013, 'Mount_Spine'), ((-.122, -.30, .705), .012, 'Mount_Spine')], 'Leather', 4)
        if k < 2 or not lean:
            box('BreastBoss', (0, -.515, .655), (.040, .016, .040), 'Metal', 'Mount_Spine')
        else:  # (lean: the outer pair's eyes go, unseen at the battle's distance)
            for ob in [o for o in list(h.children) if o.name.startswith(name + 'Eye')]:
                F.meshes.remove(ob) if ob in F.meshes else None
                bpy.data.objects.remove(ob, do_unlink=True)
        if dress.get('plume'):  # an ostrich-plume crest on the poll
            H = 'Mount_Head'
            tube('PlumeStem', [((0, -.548, 1.040), .010, H), ((0, -.552, 1.080), .010, H)], 'Metal', 4)
            for j, (dx, lean) in enumerate(((-.012, -.02), (.012, .02))):
                tube(f'Plume{j}', [((dx, -.552, 1.075), (.012, .010), H), ((dx + lean, -.545, 1.140), (.030, .016), H), ((dx + lean * 2, -.520, 1.215), (.034, .016), H),
                                   ((dx + lean * 2.5, -.480, 1.255), (.010, .006), H)], dress['plume'], 5)
        if dress.get('frontlet') and k < 2:  # a bronze frontlet on the yoke pair's faces
            F.use(h, name)
            tm.chanfron(h, dress['frontlet'])
    car_spec = R.get('car', {})
    heavy = car_spec.get('heavy', False)
    hw = car_spec.get('width', .52) / 2
    yf = .058
    depth = car_spec.get('depth', .314)
    yb = yf + depth
    yc = (yf + yb) / 2
    wr = car_spec.get('wheel_r', .27)
    floor = car_spec.get('floor', .33)
    ax_y = yf + depth * car_spec.get('axle_at', .77)
    wx = hw + .11
    car = u.make_armature('ChariotRig', [('Hull', (0, yc, floor - .03), (0, yc, floor + .17), None), ('Wheel_L', (wx, ax_y, wr), (wx + .06, ax_y, wr), 'Hull'),
                                         ('Wheel_R', (-wx, ax_y, wr), (-wx - .06, ax_y, wr), 'Hull')])
    parts += horses
    parts.append(car)
    F.use(car)
    H = 'Hull'
    side_mat, front_mat = car_spec.get('sides', 'Hide'), car_spec.get('front', 'Team')
    rail_h = car_spec.get('rail', .38)
    box('CarFloor', (0, yc, floor - .015), (2 * hw, depth + .026, .03), 'Wood', H)
    style = car_spec.get('style', 'light')
    if style == 'hoops':  # the Celtic car: open sides of two arched hoops with wicker between
        for sx in (-1, 1):
            pts = [(sx * hw, yf + depth * t, floor + .02 + .25 * math.sin(math.pi * t)) for t in (0, .2, .5, .8, 1)]
            tube(f'Hoop{sx}', [(p, .016, H) for p in pts], 'Wood', 5)
            box(f'HoopWicker{sx}', (sx * hw, yc, floor + .085), (.012, depth * .72, .13), side_mat, H)
        box('CarFront', (0, yf, floor + .14), (2 * hw - .04, .018, .24), front_mat, H)
        tube('CarFrontRail', [((-hw, yf, floor + .02), .015, H), ((-hw + .02, yf - .005, floor + .27), .016, H), ((hw - .02, yf - .005, floor + .27), .016, H),
                              ((hw, yf, floor + .02), .015, H)], 'Wood', 5)
    elif style == 'box':  # a box car (the Zhou chariot, the Oxus cart): straight sides to a rail all round
        top = floor + rail_h
        for sx in (-1, 1):
            box(f'CarSide{sx}', (sx * hw, yc, floor + rail_h * .45), (.020, depth, rail_h * .9), side_mat, H)
            for k, y in enumerate((yf, yb)):
                box(f'CarPost{sx}{k}', (sx * hw, y, floor + rail_h / 2), (.032, .032, rail_h), 'Wood', H)
        box('CarFront', (0, yf, floor + rail_h * .5), (2 * hw - .02, .020, rail_h * .92), front_mat, H)
        if car_spec.get('back'):
            box('CarBack', (0, yb, floor + rail_h * .25), (2 * hw - .02, .018, rail_h * .45), side_mat, H)
        rail = [(-hw, yb, top), (-hw, yf, top), (hw, yf, top), (hw, yb, top)]
        tube('CarRail', [(p, .018, H) for p in rail], 'Wood', 5)
        if car_spec.get('studs'):
            for sx in (-1, 1):
                for k in range(3):
                    box(f'CarStud{sx}{k}', (sx * (hw + .012), yf + depth * (k + 1) / 4, top - .03), (.010, .030, .030), 'Metal', H)
    else:  # the base chariot's light car: posts, hide sides, a dyed hide front, a bent rail
        for sx in (-1, 1):
            box(f'CarPostF{sx}', (sx * (hw - .01), yf, floor + .19), (.032, .032, .38), 'Wood', H)
            box(f'CarPostB{sx}', (sx * (hw - .01), yb, floor + .16), (.030, .030, .32), 'Wood', H)
            box(f'CarSide{sx}', (sx * (hw - .01), yc, floor + .15), (.016, depth - .024, .27), side_mat, H)
        box('CarFront', (0, yf - .002, floor + .185), (2 * hw - .05, .018, .33), front_mat, H)
        box('CarFrontBand', (0, yf - .012, floor + .345), (2 * hw - .02, .020, .030), 'Metal', H)
        rail = [(-(hw - .01), yb, floor + .32), (-(hw - .01), yf, floor + .38), (0, yf - .013, floor + .40), (hw - .01, yf, floor + .38), (hw - .01, yb, floor + .32)]
        tube('CarRail', [(p, .019, H) for p in rail], 'Wood', 6)
    tube('Axle', [((-wx - .06, ax_y, wr), .022, H), ((wx + .06, ax_y, wr), .022, H)], 'Wood', 6)
    tube('Pole', [((0, ax_y, wr + .02), .024, H), ((0, -.05, floor + .03), .024, H), ((0, -.50, .60), .021, H), ((0, YOKE - .02, .79), .018, H),
                  ((0, YOKE - .08, .83), .012, H)], 'Wood', 5)
    tube('Yoke', [((-.27, YOKE, .770), .015, H), ((-.165, YOKE, .808), .020, H), ((0, YOKE, .822), .020, H), ((.165, YOKE, .808), .020, H), ((.27, YOKE, .770), .015, H)], 'Wood', 4 if lean else 6)
    for sx in (-1, 1):
        for k, dx in enumerate((-.06, .06)):
            tube(f'YokeSaddle{sx}{k}', [((sx * .165 + dx * .4, YOKE, .80), .011, H), ((sx * .165 + dx, YOKE + .01, .72), .009, H)], 'Metal', 4)
    if R.get('horses', 2) == 4:  # the outer pair's traces from the car's front corners to their breast bands
        for sx in (-1, 1):
            tube(f'Trace{sx}', [((sx * hw, yf, floor + .06), .008, H), ((sx * .40, -.45, .66), .008, H), ((sx * .40, -.86, .70), .008, H)], 'Leather', 3)
    if car_spec.get('axle_caps'):  # long bronze axle caps beyond the hubs (the Zhou wei)
        for sx in (-1, 1):
            tube(f'AxleCap{sx}', [((sx * (wx + .06), ax_y, wr), .030, H), ((sx * (wx + .17), ax_y, wr), .024, H), ((sx * (wx + .19), ax_y, wr), .030, H)], 'Metal', 4 if lean else 6)
    if car_spec.get('scythes'):  # scythe blades out from the axle ends, swept forward (Pontus)
        for sx in (-1, 1):
            a, b = V((sx * (wx + .07), ax_y, wr)), V((sx * (wx + .55), ax_y - .16, wr - .05))
            raw(f'Scythe{sx}', [tuple(a + V((0, 0, .025))), tuple(a - V((0, 0, .025))), tuple(b + V((0, .02, .004))), tuple(a.lerp(b, .6) + V((0, -.05, .01)))],
                [(0, 1, 2), (0, 2, 1), (0, 2, 3), (0, 3, 2)], 'Metal', H)
            tube(f'ScytheSocket{sx}', [((sx * (wx + .055), ax_y, wr), .030, H), ((sx * (wx + .12), ax_y, wr), .026, H)], 'Metal', 5)
    for kind, side in car_spec.get('cases', ()):  # a quiver or a bow case slung on the car's side
        sx = 1 if side == 'L' else -1
        if kind == 'quiver':
            q0, q1 = V((sx * (hw + .032), yb - .03, floor + .07)), V((sx * (hw + .032), yb - .27, floor + .40))
            qa = (q1 - q0).normalized()
            tube(f'Quiver{sx}', [(tuple(q0), .030, H), (tuple(q0.lerp(q1, .5)), .038, H), (tuple(q1), .042, H)], 'Leather', 6)
            tube(f'QuiverRim{sx}', [(tuple(q1 - qa * .02), .046, H), (tuple(q1), .046, H)], 'Metal', 6, caps=(False, False))
            for k, (dx, dy) in enumerate(((-.012, .010), (.012, -.008), (0, .018))):
                tip = q1 + qa * .085 + V((dx, dy, 0))
                tube(f'QuiverArrow{sx}{k}', [(tuple(q1 + V((dx, dy, 0))), .004, H), (tuple(tip), .004, H)], 'Wood', 3)
        elif kind == 'bowcase':  # a long tapered case, wide end up and forward
            c0, c1 = V((sx * (hw + .034), yb - .02, floor + .05)), V((sx * (hw + .040), yf + .02, floor + .44))
            tube(f'BowCase{sx}', [(tuple(c0), (.016, .024), H), (tuple(c0.lerp(c1, .55)), (.020, .044), H), (tuple(c1), (.020, .056), H)], car_spec.get('case_mat', 'Leather'), 5)
        elif kind == 'javelins':  # a sheaf of javelins in a case at the back corner
            j0 = V((sx * (hw + .03), yb - .02, floor + .05))
            tube(f'JavelinCase{sx}', [(tuple(j0), .032, H), (tuple(j0 + V((0, -.08, .30))), .036, H)], 'Leather', 6)
            for k, (dx, dy) in enumerate(((-.012, 0), (.012, -.01), (0, .012))):
                b0 = j0 + V((dx, dy - .08, .30))
                tube(f'CaseJavelin{sx}{k}', [(tuple(b0), .005, H), (tuple(b0 + V((0, -.15, .55))), .005, H)], 'Wood', 3)
                tube(f'CaseJavelinHead{sx}{k}', [(tuple(b0 + V((0, -.15, .55))), (.010, .004), H), (tuple(b0 + V((0, -.175, .64))), .001, H)], 'Metal', 3)
    spokes = car_spec.get('spokes', 6)
    for side, sx in (('L', 1), ('R', -1)):
        if spokes >= 10:  # many spokes: thin three-sided ones, a lighter nave
            F.adopt(many_spoked(f'Wheel{side}', car, f'Wheel_{side}', sx * wx, ax_y, wr, wr, spokes, rim=car_spec.get('rim', 'Metal'), n=car_spec.get('felloe', 10)))
        else:
            F.adopt(tm.fine_wheel(f'Wheel{side}', car, f'Wheel_{side}', sx * wx, ax_y, wr, wr, spokes=spokes, rim=car_spec.get('rim', 'Metal'), n=car_spec.get('felloe', 12)))
    if car_spec.get('banner'):  # a banner on a pole at the car's back corner: the squad's Emblem
        bx, by, top = -(hw - .02), yb - .01, floor + car_spec['banner']
        tube('BannerPole', [((bx, by, floor), .012, H), ((bx, by, top), .010, H)], 'Wood', 5)
        if not lean:
            tube('BannerFinial', [((bx, by, top - .005), .016, H), ((bx, by, top + .03), (.026, .006), H), ((bx, by, top + .08), .002, H)], 'Metal', 4)
        x0, x1, z0, z1 = bx - .02, bx - .30, top - .30, top - .04
        ban = raw('BannerEmblem', [(x0, by, z0), (x1, by, z0), (x1, by, z1), (x0, by, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', H)
        F.loose.add(ban.name)
        uv = ban.data.uv_layers.active
        for poly in ban.data.polygons:
            for li in poly.loop_indices:
                co = ban.data.vertices[ban.data.loops[li].vertex_index].co
                uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
        if not lean:
            tube('BannerTail', [((x1, by, z0 + .02), .010, H), ((x1 - .02, by, z0 - .12), .008, H), ((x1 - .03, by, z0 - .18), .003, H)], car_spec.get('tail', 'Team'), 4)
    # ---- the crew ----
    crew = R['crew']
    spots = {1: [(0, .20)], 2: [(-.11, .17), (.12, .31)], 3: []}[len(crew)]
    if len(crew) == 2 and crew[1][0] != 'bow':  # a spearman stands on the right, the driver on the left
        spots = [(.11, .17), (-.12, .31)]
    if len(crew) == 3:
        spots = [(0, yf + .10), (.150, yb - .085), (-.150, yb - .085)]
    driver = archer = None
    more = []
    sides = [-.12, .15]
    for (role, look), (x, y) in zip(crew, spots):
        at = V((x, y, floor))
        if role == 'driver':
            driver = man('Driver', look, lite)
            parts.append(driver)
            F.reach('L', (.098, -.200, .672), pole=(.8, .2, -1))
            F.reach('R', (-.098, -.200, .672), pole=(-.8, .2, -1))
            F.bake_rest()
            F.place(at)
            gl = F.fist('L', None, (1, 0, 0), half=.020)
            gr = F.fist('R', None, (1, 0, 0), half=.020)
            sides[0] = math.copysign(.12, x) if abs(x) > .01 else -.12
            F.use(car)
            for h, (name, hx, like) in zip(horses, team):
                hand = at + (gl if like == 0 else gr)
                for sx in ((1,) if hx > .3 else (-1,) if hx < -.3 else (-1, 1)) if lean else (-1, 1):  # (lean: one rein to an outer horse)
                    bit = V((hx + sx * .043, -.62 - .722, .898))
                    mid = bit.lerp(hand, .55) + V((0, 0, -.05))
                    tube(f'{name}Rein{sx}', [(tuple(bit), .006, H), (tuple(mid), .006, H), (tuple(hand), .006, H)], 'Leather', 3)
        elif role == 'bow':
            archer = man('Archer', look, lite)
            parts.append(archer)
            F.reach('L', (.170, -.230, .800), pole=(1, .2, -.6))
            F.reach('R', (.010, -.075, .770), pole=(-.6, 1, .1))
            F.bake_rest()
            F.place(at)
            sides[1] = .15
            g = F.fist('L', None, (0, 0, 1))
            r = F.fist('R', None, (0, 1, 0), half=.018)
            bow_len, brace, recurve = look.get('bow', .84), .085, look.get('recurve', 0)
            back = r - g
            back.z = 0
            back = back.normalized()
            pts = []
            for i in range(9):
                t = i / 8
                tip = max(0, abs(t - .5) * 2 - .7) / .3  # the last fifth of each limb bends forward (a recurve)
                p = g + V((0, 0, (t - .5) * bow_len)) + back * brace * (1 - max(0, math.sin(math.pi * t)) ** .8) - back * .02 * math.sin(math.pi * t) - back * recurve * tip
                pts.append((tuple(p), .0075 + .0055 * math.sin(math.pi * t), 'Prop_L'))
            tube('SelfBow', pts, look.get('bow_mat', 'Wood'), 5, attachment=True)
            tube('BowGrip', [((g.x, g.y, g.z - .040), .0155, 'Prop_L'), ((g.x, g.y, g.z + .040), .0155, 'Prop_L')], 'Leather', 6, caps=(False, False), attachment=True)
            tube('BowString', [(pts[0][0], .0032, 'Prop_L'), (tuple(r), .0032, 'Hand_R'), (pts[-1][0], .0032, 'Prop_L')], 'Cloth', 3, attachment=True)
            d = (g - r).normalized()
            tube('NockedArrow', [(tuple(r), .004, 'Prop_R'), (tuple(g + d * .10), .004, 'Prop_R')], 'Wood', 4, attachment=True)
            tube('NockedArrowHead', [(tuple(g + d * .095), (.010, .004), 'Prop_R'), (tuple(g + d * .14), .001, 'Prop_R')], 'Metal', 4, attachment=True)
        else:  # a spear, a javelin or a halberd upright in the right fist
            nm = {'spear': 'Warrior', 'javelin': 'Javelineer', 'halberd': 'Lord'}[role]  # (not 'Spearman': the battle's polearm test matches part names)
            rig = man(nm, look, lite)
            parts.append(rig)
            F.place(at)
            g = F.fist('R', V((-.223, -.137, .604)), (0, 0, 1))
            F.fist('L', V((.225, -.130, .608)), (0, 0, 1))
            P = 'Prop_R'
            if role == 'halberd':  # the ge: a long haft, a bronze blade at right angles near the top, a butt cap
                top = g.z + .78
                tube('HalberdHaft', [((g.x, g.y, g.z - .36), .010, P), ((g.x, g.y, top), .009, P)], 'Wood', 5, attachment=True)
                raw('HalberdBlade', [(g.x, g.y - .010, top - .03), (g.x, g.y - .010, top - .09), (g.x, g.y - .23, top - .07), (g.x, g.y - .16, top - .02)],
                    [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Metal', P, True)
                tube('HalberdTang', [((g.x, g.y + .010, top - .045), .008, P), ((g.x, g.y + .06, top - .05), .004, P)], 'Metal', 4, attachment=True)
                if not lean:
                    tube('HalberdButt', [((g.x, g.y, g.z - .38), .013, P), ((g.x, g.y, g.z - .34), .011, P)], 'Metal', 5, attachment=True)
            else:
                short = role == 'javelin'
                nm2 = 'Javelin' if short else 'Spear'
                top = g.z + (.55 if short else .74)
                tube(nm2, [((g.x, g.y, g.z - (.30 if short else .40)), .008, P), ((g.x, g.y, top), .007, P)], 'Wood', 4, attachment=True)
                tube(nm2 + 'Head', [((g.x, g.y, top - .005), .010, P), ((g.x, g.y, top + .03), (.020, .008), P), ((g.x, g.y, top + (.09 if short else .12)), .001, P)],
                     'Metal', 4, attachment=True)
            more.append((rig, 'halberd' if role == 'halberd' else 'spear', math.copysign(.15, x)))

    def author():
        return MC.chariot(horses[0], horses[1], car, driver, archer, extra_horses=[(h, t[2]) for h, t in zip(horses[2:], team[2:])], crew=more, sides=tuple(sides))
    tris = F.finish_unit(model, parts, {'name': R['name'], 'role': 'Chariots (signature cavalry)', 'rig': R.get('rig', 'chariot-light'), 'look': R['look'],
                                        'notes': R.get('notes', '') + ' Built by build_signature_chariots.py (the base Bronze chariot generalised); clips: ti_mounted_clips.chariot.'},
                         centre=(0, -.35, .55), scale=3.2 if R.get('horses', 2) == 4 else 2.8, mode='NLA_TRACKS', clips=hook(model, author))
    assert tris <= BUDGET, (model, tris)
    return tris


def hook(model, author):
    """The clips for F.finish_unit, with the shipped options kept (its budget raised to the chariot's)."""
    p = u.REPO / 'src' / 'assets' / 'units' / 'signature' / f'{model}.json'
    extra = json.loads(p.read_text()) if p.exists() else {}
    extra.pop('clips', None)
    extra.pop('restClip', None)
    extra.update({'quadruped': True, 'triangleBudget': BUDGET})
    return author, None, extra


# ---- the recipes ----------------------------------------------------------------------------------------
# coats: (coat material, mane material, blaze, white socks) for the near, off, outer near, outer off horse.
# crew: [(role, look)] role 'driver' first, then 'bow', 'spear', 'javelin' or 'halberd'.

def coats(n, a=('Coat', 'Mane', True, True), b=('CoatB', 'ManeB', False, False)):
    return [a, b, b, a][:n]


RECIPES = {
    'ugarit': dict(name='Ugaritic maryannu chariot crews', horses=2, lite=True,
                   colors={'Coat': '6E4128', 'Mane': '1E1611', 'CoatB': '8A5A36', 'ManeB': '2A1C14', 'Leather': '8C5A34', 'Metal': BRONZE, 'Cloth': 'D9C7A0', 'Hide': 'C7B48C',
                           'Skin': 'C08A63', 'Hair': '221812'},
                   coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', False, False)],
                   horse={'barding': 'Metal'}, car={'sides': 'Leather', 'cases': [('bowcase', 'L')], 'felloe': 10},
                   crew=[('driver', {'head': 'conical', 'armour': 'scale', 'accent': 'sash', 'beard': False, 'nape': False}),
                         ('bow', {'head': 'conical', 'armour': 'scale', 'accent': 'sash', 'bow': .86, 'recurve': .03}),
                         ('javelin', {'head': 'conical', 'armour': 'scale', 'accent': 'sash'})],
                   look='Ugaritic maryannu: an armoured chariot, its two horses under bronze scale barding with scale crinets, a leather-sided car with a bow case; three crew in conical bronze helms and scale corselets (Team sashes): a young beardless driver, a bowman with a recurved bow and a javelin man'),
    'kemet': dict(name='Chariot archers', horses=2,
                  colors={'Coat': 'B8B2A6', 'Mane': '3A332C', 'CoatB': '7A4A2C', 'ManeB': '231912', 'Leather': 'A87B52', 'Cloth': 'F1EAD8', 'Linen': 'F4EEDC', 'Metal': BRONZE,
                          'Plume': 'F2EEE6', 'Hide': 'E2D2AE', 'Skin': 'A8704A', 'Hair': '17110C'},
                  coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', True, True)],
                  horse={'plume': 'Plume', 'blanket': 'Team'}, car={'sides': 'Hide', 'cases': [('quiver', 'R'), ('bowcase', 'L')], 'case_mat': 'Team'},
                  crew=[('driver', {'head': 'headcloth', 'beard': False, 'armour': 'linen', 'accent': 'sash', 'tunic': 'Linen'}),
                        ('bow', {'head': 'headcloth', 'beard': False, 'armour': 'linen', 'accent': 'sash', 'tunic': 'Linen', 'bow': .92, 'recurve': .045})],
                  look='Kemet chariot archers: a grey and a bay with white ostrich-plume crests on their polls and Team blankets, a light pale-hide car with a quiver and a Team bow case, a clean-shaven driver and archer in white headcloths and layered linen corselets (Team sashes), a long composite bow'),
    'garamantes': dict(name='Garamantian war chariot', horses=4, lite=True,
                       colors={'Coat': '8E6A44', 'Mane': '2A1E14', 'CoatB': '5C3A24', 'ManeB': '1A120C', 'Leather': '7A5236', 'Cloth': 'B08A5E', 'Hide': '8A6440',
                               'Skin': '7A4E34', 'Hair': '17110C', 'Plume': 'EDE6D6'},
                       coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', False, False), ('CoatB', 'ManeB', False, False), ('Coat', 'Mane', False, False)],
                       horse={}, car={'sides': 'Hide', 'front': 'Team', 'width': .48, 'felloe': 10},
                       crew=[('driver', {'head': 'headcloth', 'band': 'Leather', 'beard': False, 'bare': True, 'accent': 'sash', 'feather': 'Plume'}),
                             ('spear', {'head': 'headcloth', 'band': 'Leather', 'beard': False, 'bare': True, 'accent': 'sash', 'feather': 'Plume'})],
                       look='Garamantian war chariot: four horses abreast (two duns, two dark bays; the outer pair on traces), a small light car covered in brown hide, a bare-chested driver and spearman in headcloths with an ostrich feather and Team sashes'),
    'oxus': dict(name='Oxus cart-borne spearmen (improvised)', horses=2,
                 colors={'Coat': 'B39A6E', 'Mane': '3A2A1C', 'CoatB': 'A88E62', 'ManeB': '33251A', 'Leather': '9A7048', 'Metal': BRONZE, 'Wood': '7A5A3A', 'Felt': '8C6E4C',
                         'Skin': 'B98258', 'Hair': '241A14'},
                 coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', False, False)],
                 horse={'blanket': 'Felt'}, car={'style': 'box', 'sides': 'Wood', 'front': 'Team', 'rail': .30, 'spokes': 4, 'rim': 'Metal', 'depth': .36, 'back': True,
                                                'width': .50, 'axle_at': .55},
                 crew=[('driver', {'head': 'felt', 'cap': 'Felt', 'accent': 'shawl'}), ('spear', {'head': 'felt', 'cap': 'Felt', 'accent': 'shawl', 'axe': True})],
                 look='Oxus (Gonur) cart-borne spearmen: two dun horses under felt blankets, a small plank-sided box cart with a Team front and four-spoke wheels with bronze tyres, a driver and a spearman in felt caps and Team shawls; a bronze shaft-hole axe at the spearman\'s belt',
                 notes='Improvised from the Gonur Depe carts.'),
    'andronovo': dict(name='Andronovo spoke-wheel charioteers', horses=2,
                      colors={'Coat': 'C9B48A', 'Mane': '4A3A28', 'CoatB': '9C9488', 'ManeB': '2C2620', 'Leather': '8A6A48', 'Cloth': 'CDB98F', 'Hide': '9A7A52', 'Felt': '6E5238',
                              'Skin': 'D2A47E', 'Hair': '5A4030', 'Metal': BRONZE},
                      coats=[('Coat', 'Mane', False, True), ('CoatB', 'ManeB', True, False)],
                      horse={'blanket': 'Hide'}, car={'sides': 'Hide', 'spokes': 10, 'rim': 'Wood', 'width': .46, 'cases': [('quiver', 'L')]},
                      crew=[('driver', {'head': 'felt', 'cap': 'Felt', 'accent': 'shawl', 'tunic': 'Cloth'}),
                            ('spear', {'head': 'felt', 'cap': 'Felt', 'accent': 'shawl', 'tunic': 'Leather'})],
                      look='Andronovo (Sintashta) charioteers: a pale dun and a grey under hide blankets, a narrow hide-sided car on ten-spoke wheels, a driver and a spearman in pointed felt caps and Team shawls, a quiver on the car'),
    'kuru': dict(name='Kuru chariot-warriors', horses=2,
                 colors={'Coat': 'E2DCCF', 'Mane': 'B8AE9C', 'CoatB': 'D8D0C0', 'ManeB': 'A89E8C', 'Leather': '9A6238', 'Cloth': 'EFE6D0', 'Turban': 'F2ECDC', 'Metal': BRONZE,
                         'Skin': 'A06A48', 'Hair': '1E1712', 'Hide': 'C9A46A'},
                 coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', False, False)],
                 horse={'blanket': 'Team'}, car={'sides': 'Hide', 'spokes': 8, 'banner': 1.35, 'cases': [('quiver', 'R')]},
                 crew=[('driver', {'head': 'turban', 'accent': 'shawl'}), ('bow', {'head': 'turban', 'beard': 'long', 'accent': 'shawl', 'bow': 1.0})],
                 look='Kuru epic-age chariot: two white horses under Team blankets, a car on eight-spoke wheels flying a banner (the squad Emblem) from its back corner, a quiver; a driver and a long-bearded bowman with a tall bow, both in white turbans with Team bands and Team shawls'),
    'zhou': dict(name='Zhou chariot lords', horses=4, lite=True, lean=True, rig='chariot-heavy',
                 colors={'Coat': '5A3A26', 'Mane': '15100C', 'CoatB': '7A4E30', 'ManeB': '1E1610', 'Leather': '6E4A30', 'Metal': BRONZE, 'Cloth': 'D8CBA6', 'Wood': '4A2E20',
                         'Skin': 'D2A47E', 'Hair': '17110C', 'Hide': '5E2E22'},
                 coats=[('Coat', 'Mane', False, False), ('CoatB', 'ManeB', False, False), ('CoatB', 'ManeB', False, False), ('Coat', 'Mane', False, False)],
                 horse={},
                 car={'style': 'box', 'heavy': True, 'width': .64, 'depth': .40, 'rail': .34, 'sides': 'Hide', 'front': 'Team', 'wheel_r': .32, 'floor': .37, 'spokes': 14,
                      'rim': 'Wood', 'axle_at': .5, 'axle_caps': True, 'banner': 1.45, 'tail': 'Team'},
                 crew=[('driver', {'head': 'helmet', 'accent': 'shawl', 'beard': False, 'nape': False}),
                       ('halberd', {'head': 'helmet', 'accent': 'shawl', 'cloak': 'Team', 'tunic': 'Leather', 'nape': False, 'beard': False})],
                 look='Zhou chariot lords: four horses abreast (the outer pair on traces), bronze yoke saddles, a broad lacquered-hide box car with long bronze axle caps and fourteen-spoke wheels, a banner (the squad Emblem); a driver and the lord with a bronze dagger-axe (ge) and a Team cloak, both in bronze helmets',
                 notes='The roster names a third man (an archer); two are kept so the four-horse file stays inside 6,000 triangles.'),
    'pontus': dict(name='Pontic scythed chariot', horses=4,
                   colors={'Coat': '3E2A1E', 'Mane': '120D0A', 'CoatB': '6A4228', 'ManeB': '1A120C', 'Leather': '7A5236', 'Metal': IRON, 'Cloth': 'D9C7A0', 'Hide': '8A6A48',
                           'Skin': 'C49070', 'Hair': '241A14'},
                   coats=[('Coat', 'Mane', True, False), ('CoatB', 'ManeB', False, False), ('CoatB', 'ManeB', False, False), ('Coat', 'Mane', True, False)],
                   horse={'frontlet': 'Metal', 'barding': None}, car={'sides': 'Leather', 'front': 'Team', 'scythes': True, 'width': .48, 'rim': 'Metal'},
                   crew=[('driver', {'head': 'conical', 'armour': 'scale', 'accent': 'sash'})],
                   look='Pontic scythed chariot: four horses abreast (the yoke pair with iron frontlets, the outer pair on traces), a small leather-sided car with long iron scythe blades from the axle ends, iron tyres, one armoured driver in a conical iron helm and a scale corselet (Team sash)'),
    'brigantes': dict(name='Brigantian chariot skirmishers', horses=2,
                      colors={'Coat': '2E2420', 'Mane': '0F0C0A', 'CoatB': '5A3E2A', 'ManeB': '1A120C', 'Leather': '8A6A48', 'Cloth': 'CDB98F', 'Metal': IRON, 'Wicker': 'A88A5A',
                              'Plaid': '5E7A4A', 'Skin': 'DDB08C', 'Hair': '8A5A30'},
                      coats=[('Coat', 'Mane', True, True), ('CoatB', 'ManeB', False, True)],
                      horse={'blanket': 'Plaid'}, car={'style': 'hoops', 'sides': 'Wicker', 'front': 'Team', 'width': .48, 'depth': .30, 'rim': 'Metal', 'spokes': 8},
                      crew=[('driver', {'head': 'hair', 'beard': 'moustache', 'accent': 'sash', 'cloak': 'Plaid', 'tunic': 'Cloth'}),
                            ('javelin', {'head': 'hair', 'beard': 'moustache', 'accent': 'sash', 'cloak': 'Plaid', 'tunic': 'Cloth'})],
                      look='Brigantian chariot: two dark ponies under plaid cloths, a small open car with arched wicker sides and iron-tyred eight-spoke wheels, a driver and a javelin thrower with long moustaches, plaid cloaks and Team sashes'),
}


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    done = {}
    for m in ids:
        done[m] = build(m, RECIPES[m])
    print('TRIS', json.dumps(done), flush=True)
    sys.stdout.flush()
    os._exit(0)
