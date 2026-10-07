# scripts/blender/build_units_kingdoms.py
# The Kingdoms base units and general of plans/ART-MODELS-PLAN.md 4.2 and 4.3 (the medieval age, Wave
# 4 in the production order), on the shared person rig and body (ti_units.py), the horse and the
# siege frame (ti_mounts.py) and the part libraries of build_units_bronze_signature.py and
# build_units_classical.py, in the base units' look (faceted, flat colours: Team, Skin, Emblem,
# Metal, Wood, Leather, Cloth; readable at 30 px). Culture-neutral: no national motifs (plan 4.4).
#   kingdoms-infantry  Pikemen: padded Team gambeson, kettle hat, a long pike, a side sword
#   kingdoms-ranged    Longbowmen: a tall self bow, an arrow bag at the hip, padded jack, hood
#   kingdoms-cavalry   Knights: mail and plate, great helm, couched lance, kite shield (Emblem), a
#                      warhorse in a Team caparison
#   kingdoms-siege     Trebuchet: a counterweight engine on the siege frame (no wheels), sling, 3 crew
#   kingdoms-support   Pioneers: a pavise on the back, shovel, sapping pick, padded coat
#   kingdoms-worker    Villager: tunic, hood, axe and a sack on the back
#   kingdoms-general   a mounted lord in a Team surcoat with a crowned helm and cloak, sword drawn;
#                      a banner bearer on foot with the squad's Emblem banner
#   blender -b --factory-startup -P scripts/blender/build_units_kingdoms.py -- [id ...]
# Writes art-build/units/kingdoms/<id>/<id>.(blend|glb) and report.json; rest pose only.
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'kingdoms')
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402

IRON = ('8E8A84', .45, .7)
STEEL = ('A3A6A8', .35, .8)


# ---- parts -----------------------------------------------------------------------------------------

def gambeson(arm, mat='Team', name='Gambeson', low=.36):
    """A padded coat to mid-thigh: a skirt and a quilted top with stitched rings."""
    cl.tunic(arm, mat, low=low, name=name + 'Skirt')
    lib.top(arm, mat, name=name)
    for k, z in enumerate((.60, .67)):
        lib.ring(f'{name}Quilt{k}', arm, [z - .006, z + .006], [(.104, .074), (.106, .075)], 'Cloth', ['Spine' if z < .62 else 'Chest'] * 2, 8)


def kettle_hat(arm, mat='Metal'):
    lib.cap(arm, mat, peak=1.03, name='KettleHat', low=.94, r=(.068, .062))
    u.tube('KettleBrim', [(0, 0, .945), (0, 0, .955)], [(.115, .108), (.115, .108)], mat, ['Head'] * 2, 10, arm)


def hood(arm, mat='Cloth'):
    lib.cap(arm, mat, peak=1.03, name='Hood', low=.90, r=(.074, .068))
    u.tube('HoodCape', [(0, 0, .78), (0, 0, .84), (0, 0, .89)], [(.125, .085), (.10, .075), (.074, .066)], mat, ['Chest', 'Neck', 'Neck'], 8, arm)


def great_helm(arm, mat='Metal', crown=False):
    u.tube('GreatHelm', [(0, 0, .875), (0, 0, .93), (0, 0, 1.0), (0, 0, 1.04)], [(.076, .072), (.078, .074), (.076, .072), (.06, .056)], mat, ['Head'] * 4, 8, arm)
    u.box('HelmSlit', (0, -.074, .965), (.10, .01, .012), 'Wood', 'Head', arm)
    u.box('HelmCross', (0, -.077, .935), (.012, .01, .06), mat, 'Head', arm)
    if crown:  # a lord's crowned helm: a Team circlet with points
        u.tube('Circlet', [(0, 0, 1.035), (0, 0, 1.055)], [(.07, .066), (.07, .066)], 'Team', ['Head'] * 2, 8, arm)
        for k in range(5):
            a = math.pi * (k / 4)
            u.box(f'CrownPoint{k}', (.065 * math.cos(a), -.06 * math.sin(a), 1.065), (.02, .012, .03), 'Team', 'Head', arm)


def mail(arm, mat='Metal', low=.40):
    lib.ring('Hauberk', arm, [low, .50, .56], [(.13, .095), (.105, .075), (.098, .07)], mat, ['Hips', 'Hips', 'Spine'], 8)
    lib.top(arm, mat, name='MailTop')


def surcoat(arm, mat='Team', low=.33):
    cl.tunic(arm, mat, low=low, name='Surcoat')
    lib.ring('SurcoatTop', arm, [.55, .70, .76], [(.10, .072), (.122, .08), (.13, .08)], mat, ['Spine', 'Chest', 'Chest'], 8)


def kite_shield(arm, name='Shield'):
    lib.shield_face(arm, name, [(-.14, .30), (.14, .30), (.16, .12), (.10, -.10), (0, -.36), (-.10, -.10), (-.16, .12)])


def pike(arm):
    lib.spear(arm, top=2.05, low=.03, head=.10)


def lance(arm):
    lib.spear(arm, top=1.95, low=.30, head=.10)


def side_sword(arm):
    u.tube('Scabbard', [(.10, -.02, .52), (.13, .02, .25)], [.018, .014], 'Leather', ['Hips'] * 2, 5, arm)
    u.box('SwordHilt', (.095, -.03, .56), (.06, .02, .015), 'Metal', 'Hips', arm)


def longbow(arm):
    lib.bow(arm, height=1.0, recurve=0.0)


def arrow_bag(arm):
    u.tube('ArrowBag', [(-.12, -.02, .58), (-.13, .0, .44), (-.13, .01, .36)], [(.03, .025), (.04, .032), (.035, .03)], 'Cloth', ['Hips', 'Hips', 'Hips'], 6, arm)
    for k in range(4):
        u.tube(f'Fletch{k}', [(-.125 + .008 * k, -.02, .58), (-.125 + .008 * k, -.025, .65)], [.006, .004], 'Cloth', ['Hips'] * 2, 3, arm)


def pavise(arm):
    """The pioneers' pavise slung on the back: a tall board with a ridge, its face the Emblem."""
    pts = [(-.16, .02), (.16, .02), (.17, .70), (0, .76), (-.17, .70)]
    v = [(x, .16, z + .18) for x, z in pts] + [(0, .155, .5)]
    n = len(pts)
    f = [(n, (j + 1) % n, j) for j in range(n)] + [(n, j, (j + 1) % n) for j in range(n)]
    face = u.mesh_obj('Pavise', v, f, 'Emblem', 'Chest', arm=arm)
    for poly in face.data.polygons:
        for li in poly.loop_indices:
            co = face.data.vertices[face.data.loops[li].vertex_index].co
            face.data.uv_layers.active.data[li].uv = ((co.x + .17) / .34, (co.z - .2) / .76)
    u.box('PaviseRidge', (0, .17, .55), (.04, .02, .7), 'Wood', 'Chest', arm)


def shovel(arm):
    w = lib.hand(arm)
    u.tube('ShovelHaft', [(w.x, w.y + .03, w.z - .06), (w.x, w.y - .02, w.z + .42)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.box('ShovelBlade', (w.x, w.y + .035, w.z - .12), (.09, .015, .11), 'Metal', 'Prop_R', arm, True)


def hand_axe(arm, length=.40):
    w = lib.hand(arm)
    u.tube('AxeHaft', [(w.x, w.y, w.z - .06), (w.x, w.y - .02, w.z + length)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.box('AxeHead', (w.x, w.y - .06, w.z + length - .06), (.02, .1, .07), 'Metal', 'Prop_R', arm, True)


def sack(arm):
    u.tube('Sack', [(0, .12, .58), (0, .15, .68), (0, .15, .80), (0, .13, .86)], [(.09, .07), (.12, .085), (.11, .08), (.05, .04)], 'Cloth', ['Chest'] * 4, 8, arm)


def caparison(horse):
    """A Team cloth over the warhorse: a body cover and a drape down the flanks."""
    s = u.MOUNTS['horse']['seat']
    u.tube('Caparison', [(0, s[1] - .32, s[2] - .04), (0, s[1] - .1, s[2] + .0), (0, s[1] + .2, s[2] - .02), (0, s[1] + .42, s[2] - .08)],
           [(.19, .16), (.21, .18), (.21, .18), (.17, .15)], 'Team', ['Mount_Spine'] * 4, 8, horse)
    # the drape: a lower, wider band of the same cloth down the flanks
    u.tube('CaparisonDrape', [(0, s[1] - .28, s[2] - .16), (0, s[1] + .05, s[2] - .17), (0, s[1] + .38, s[2] - .18)], [(.20, .10), (.215, .11), (.19, .10)], 'Team', ['Mount_Spine'] * 3, 8, horse)


def trebuchet(info, mat='Wood', rope='Cloth', metal='Metal'):
    """A counterweight trebuchet on the frame: two A-frame uprights, the axle, the long beam cocked
    with its sling end down at the back, the counterweight box hanging at the front, a sling and a
    stone on the trough."""
    rig = info['rig']; z = info['deck']
    top = z + 1.05
    for sx in (-1, 1):
        x = sx * .2
        u.tube(f'Upright{sx}a', [(x, -.22, z), (x, 0, top)], [.03, .026], mat, ['Hull'] * 2, 5, rig)
        u.tube(f'Upright{sx}b', [(x, .22, z), (x, 0, top)], [.03, .026], mat, ['Hull'] * 2, 5, rig)
        u.box(f'UprightBrace{sx}', (x, 0, z + .4), (.05, .40, .04), mat, 'Hull', rig)
    u.tube('Axle', [(-.26, 0, top), (.26, 0, top)], [.03, .03], metal, ['Hull'] * 2, 6, rig)
    long_end = (0, .95, z + .2)
    short_end = (0, -.32, top + .4)
    u.tube('Beam', [long_end, (0, 0, top), short_end], [.022, .04, .035], mat, ['Hull'] * 3, 5, rig)
    cw = (0, -.32, top - .05)
    u.tube('CwHanger', [short_end, (0, -.32, cw[2] + .17)], [.01, .01], metal, ['Hull'] * 2, 4, rig)
    u.box('Counterweight', (0, -.32, cw[2] - .17), (.32, .30, .34), mat, 'Hull', rig)
    u.box('CounterweightBand', (0, -.32, cw[2]), (.34, .32, .04), metal, 'Hull', rig)
    u.box('Trough', (0, .62, z + .02), (.16, .55, .04), mat, 'Hull', rig)
    u.tube('Sling', [long_end, (0, .78, z + .1), (0, .58, z + .07)], [.006, .006, .006], rope, ['Hull'] * 3, 3, rig)
    u.box('SlingPouch', (0, .55, z + .08), (.09, .08, .03), 'Leather', 'Hull', rig)
    u.tube('Stone', [(0, .55, z + .09), (0, .55, z + .17)], [.05, .04], 'Cloth', ['Hull'] * 2, 6, rig)
    u.tube('WinchDrum', [(-.24, .3, z + .1), (.24, .3, z + .1)], [.05, .05], mat, ['Hull'] * 2, 6, rig)


# ---- the units ---------------------------------------------------------------------------------------

PERSON_OPTS = cl.PERSON_OPTS


def k_infantry():
    arm = cl.person([gambeson, kettle_hat, (lib.belt, 'Leather', .52), side_sword, pike, (lib.sandals, 'Leather')])
    return [arm], {'Skin': 'C99472', 'Cloth': 'D9CFB4', 'Leather': '5E4030', 'Metal': IRON, 'Wood': '6A4A30'}, \
        'Pikemen: padded Team gambeson, kettle hat, a long pike held upright, a sword at the side', PERSON_OPTS


def k_ranged():
    arm = cl.person([(gambeson, 'Team', {'name': 'Jack', 'low': .38}), hood, (lib.belt, 'Leather', .52), arrow_bag, longbow, lib.belt_dagger, (lib.sandals, 'Leather')])
    return [arm], {'Skin': 'C99472', 'Cloth': '7A6A4A', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': '7A5530'}, \
        'Longbowmen: a tall self bow, an arrow bag at the hip, a padded Team jack, a hood, a dagger', PERSON_OPTS


def k_cavalry():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    caparison(horse)
    r = cl.rider([mail, (surcoat, 'Team', {'low': .40}), great_helm], [lance, kite_shield])
    return [horse, r], {'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Leather': '5B3B28', 'Metal': STEEL, 'Wood': '3F2E22'}, \
        'Knights: mail with plate, Team surcoat, great helm, an upright lance, kite shield (Emblem), a warhorse in a Team caparison', dict(budget=2600, mounted=True)


def k_siege():
    parts, info = tm.frame('Frame', wheels=False, deck_z=.22, length=1.3, width=.56)
    trebuchet(info)
    for i, (x, y, z, yaw) in enumerate(info['crew']):
        c, _ = u.crew(f'Crew{i}', (x, y, z), lite=True, head='cap', yaw=yaw)
        parts.append(c)
    return parts, {'Skin': 'C99472', 'Cloth': 'C9BB98', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '8A6646'}, \
        'Trebuchet: a counterweight engine on a skid frame (A-frame uprights, axle, the beam cocked with its sling down, the counterweight box, a stone in the sling), three crew in caps', dict(budget=3200, mounted=False)


def k_support():
    arm = cl.person([(gambeson, 'Team', {'name': 'Coat', 'low': .36}), (lib.belt, 'Leather', .52), (lib.cap, 'Cloth', {'peak': 1.02, 'name': 'Coif', 'r': (.07, .063)}), shovel, pavise, (lib.sandals, 'Leather')])
    cx, cy, cz = lib.SHIELD_AT
    u.tube('SapPick', [(cx, cy, cz - .2), (cx, cy - .02, cz + .2)], [.011, .01], 'Wood', ['Prop_L'] * 2, 4, arm, attachment=True)
    u.tube('SapPickHead', [(cx, cy - .1, cz + .16), (cx, cy - .02, cz + .2), (cx, cy + .06, cz + .18)], [.006, .014, .006], 'Metal', ['Prop_L'] * 3, 4, arm, attachment=True)
    return [arm], {'Skin': 'C99472', 'Cloth': 'CFC4A4', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': 'A0784E'}, \
        'Pioneers: a pavise (Emblem) slung on the back, a shovel and a sapping pick, padded Team coat, coif', PERSON_OPTS


def k_worker():
    arm = cl.person([(cl.tunic, 'Team', {'low': .36}), (lib.top, 'Cloth'), (lib.belt, 'Leather', .53), hood, hand_axe, sack, (lib.sandals, 'Leather')])
    return [arm], {'Skin': 'C99472', 'Cloth': '8A7A5A', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': '9A7448'}, \
        'Villager: Team tunic, hood, axe, a sack on the back', PERSON_OPTS


def k_general():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    caparison(horse)
    r = cl.rider([mail, (surcoat, 'Team', {'low': .38}), (great_helm, 'Metal', {'crown': True}), (cl.seated_cloak, 'Team')],
                 [(lib.sword, {'length': .42})], name='Commander')
    bearer, _ = u.crew('Bearer', (.50, -.05, 0), head='cap')
    cl.banner(bearer, 1.66, w_=.24, h_=.34)
    return [horse, r, bearer], {'Skin': 'C99472', 'Cloth': 'E7DDC7', 'Leather': '6E4530', 'Metal': STEEL, 'Wood': '3F2E22'}, \
        'Kingdoms general: a mounted lord (mail, Team surcoat, crowned great helm, Team cloak, sword) on a caparisoned horse, with a banner bearer on foot whose banner is the squad emblem', dict(budget=3000, mounted=True)


BUILDERS = {'kingdoms-infantry': k_infantry, 'kingdoms-ranged': k_ranged, 'kingdoms-cavalry': k_cavalry, 'kingdoms-siege': k_siege,
            'kingdoms-support': k_support, 'kingdoms-worker': k_worker, 'kingdoms-general': k_general}


def build(uid):
    lib.reset()
    parts, colors, look, opts = BUILDERS[uid]()
    lib.finish(uid, parts, colors, {'role': uid.split('-')[1], 'look': look}, opts['budget'], opts['mounted'])


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
