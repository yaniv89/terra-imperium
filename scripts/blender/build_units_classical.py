# scripts/blender/build_units_classical.py
# The Classical base units and general of plans/ART-MODELS-PLAN.md 4.2 and 4.3 (Wave 3 in the
# production order: the next age after Bronze), on the shared person rig and body (ti_units.py), the
# horse and the siege frame (ti_mounts.py) and the part library of build_units_bronze_signature.py,
# in the base units' look (faceted, flat colours: Team, Skin, Emblem, Metal, Wood, Leather, Cloth;
# readable at 30 px). Culture-neutral: no national motifs (plan 4.4).
#   classical-infantry  Swordsmen: bronze cuirass with pteruges, crested helmet with cheek pieces,
#                       large oval shield (Emblem), short sword, greaves
#   classical-ranged    Composite archers: recurve bow, back quiver, leather corselet, felt cap
#   classical-cavalry   Heavy cavalry: scale coat, crested helmet, long spear, small round shield,
#                       horse with a Team saddle cloth, no stirrups
#   classical-siege     Ballista: a torsion bolt thrower on the siege frame, three crew
#   classical-support   Engineers: a wicker mantlet, a pick, a short ladder on the back
#   classical-worker    Laborer: tunic, pick and a basket on the back
#   classical-general   a mounted commander (Team cloak, transverse crest, muscled cuirass, sword)
#                       and a standard bearer with a cloth standard (the squad's Emblem)
#   blender -b --factory-startup -P scripts/blender/build_units_classical.py -- [id ...]
# Writes art-build/units/classical/<id>/<id>.(blend|glb|json) and report.json; rest pose only.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('TI_UNITS_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'classical'))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402

BRONZE = ('C2995A', .4, .6)
IRON = ('8E8A84', .45, .7)
SEATED = {'r': {'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0)}}


def apply(arm, steps):
    for step in steps:
        fn, *args = step if isinstance(step, tuple) else (step,)
        kw = args[-1] if args and isinstance(args[-1], dict) else {}
        pos = args[:-1] if kw else args
        fn(arm, *pos, **kw)


def ellipse(rx, rz, n=16):
    return [(rx * math.cos(2 * math.pi * j / n), rz * math.sin(2 * math.pi * j / n)) for j in range(n)]


def oval_shield(arm, rx=.17, rz=.27, boss=True):
    """The large oval (thureos-like) shield of the Classical line, its face the squad's Emblem."""
    lib.shield_face(arm, 'Shield', ellipse(rx, rz))
    cx, cy, cz = lib.SHIELD_AT
    if boss:
        u.tube('ShieldBoss', [(cx, cy - .022, cz), (cx, cy - .05, cz)], [.035, .01], 'Metal', ['Prop_L'] * 2, 6, arm, attachment=True)
        u.box('ShieldSpine', (cx, cy - .024, cz), (.025, .012, rz * 1.6), 'Metal', 'Prop_L', arm, True)


def small_round(arm, size=.12):
    lib.shield(arm, 'round', size=size)


def crested_helm(arm, crest='Team', transverse=False, name='Helm', mat='Metal'):
    lib.cap(arm, mat, peak=1.035, name=name, low=.925, r=(.07, .064))
    lib.cheek_flaps(arm, mat)
    u.box('Neckguard', (0, .055, .915), (.11, .02, .05), mat, 'Head', arm)
    if transverse:  # a centurion-style crest from ear to ear
        u.tube('Crest', [(-.075, 0, 1.0), (-.04, 0, 1.06), (.04, 0, 1.06), (.075, 0, 1.0)], [(.012, .03), (.014, .04), (.014, .04), (.012, .03)], crest, ['Head'] * 4, 4, arm)
    else:
        u.tube('CrestHolder', [(0, -.01, 1.03), (0, -.01, 1.07)], [.01, .01], mat, ['Head'] * 2, 4, arm)
        u.tube('Crest', [(0, -.08, 1.04), (0, -.03, 1.105), (0, .06, 1.10), (0, .13, 1.0), (0, .15, .92)], [(.008, .02), (.012, .035), (.012, .035), (.01, .028), (.006, .015)], crest, ['Head'] * 5, 4, arm)


def cuirass(arm, mat='Metal', name='Cuirass'):
    lib.top(arm, mat, name=name)
    lib.ring(name + 'Belly', arm, [.50, .54], [(.10, .072), (.096, .069)], mat, ['Hips'] * 2, 8)


def pteruges(arm, mat='Leather', z=.50):
    lib.fringe(arm, mat, z, n=12, length=.09)


def tunic(arm, mat='Team', low=.36, name='Tunic'):
    lib.kilt(arm, mat, low=low, name=name)


def pick(arm, length=.46):
    w = lib.hand(arm)
    u.tube('PickHaft', [(w.x, w.y + .04, w.z - .08), (w.x, w.y - .08, w.z + length)], [.011, .01], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.tube('PickHead', [(w.x, w.y - .19, w.z + length - .07), (w.x, w.y - .08, w.z + length), (w.x, w.y + .04, w.z + length - .02)], [.006, .016, .006], 'Metal', ['Prop_R'] * 3, 4, arm, attachment=True)


def basket(arm, mat='Wood'):
    u.tube('Basket', [(0, .12, .56), (0, .135, .66), (0, .14, .76)], [(.10, .07), (.12, .08), (.12, .085)], mat, ['Chest'] * 3, 8, arm)
    u.tube('BasketLoad', [(0, .14, .76), (0, .14, .80)], [(.10, .07), (.05, .04)], 'Cloth', ['Chest'] * 2, 6, arm)


def ladder(arm, mat='Wood'):
    for sx in (-1, 1):
        u.box(f'LadderRail{sx}', (sx * .09, .13, .74), (.022, .022, .80), mat, 'Chest', arm)
    for k in range(5):
        u.box(f'LadderRung{k}', (0, .13, .44 + k * .15), (.18, .018, .018), mat, 'Chest', arm)


def mantlet(arm):
    """A wicker mantlet carried on the left arm (a big plaited screen, not an emblem shield)."""
    lib.shield_face(arm, 'Mantlet', [(-.16, -.36), (.16, -.36), (.17, .30), (0, .36), (-.17, .30)], mat='Wood')
    for k in range(3):
        cx, cy, cz = lib.SHIELD_AT
        u.box(f'MantletBand{k}', (cx, cy - .025, cz - .22 + k * .22), (.33, .012, .025), 'Leather', 'Prop_L', arm, True)


def composite_bow(arm):
    lib.bow(arm, height=.72, recurve=.10)
    w = lib.hand(arm, 'L')
    for sz in (-1, 1):  # the recurved tips, bent forward
        u.tube(f'BowTip{sz}', [(w.x + .01, w.y - .04, w.z + sz * .36), (w.x + .01, w.y - .085, w.z + sz * .40)], [.006, .004], 'Wood', ['Prop_L'] * 2, 4, arm, attachment=True)


def person(steps, covered='top', name='Unit'):
    arm, body = u.build_body(ready=True, lite=False, modest=False); arm.name = f'{name}Rig'; body.name = f'{name}Body'
    drop_cover(body, covered)
    apply(arm, steps)
    return arm


def drop_cover(body, covered):
    if covered == 'robe':
        u.drop_faces(body, lambda c: .1 < c.z < .745 and abs(c.x) < .15)
    elif covered == 'top':
        u.drop_faces(body, lambda c: .35 < c.z < .745 and abs(c.x) < (.145 if c.z > .535 else .15))
    else:
        u.drop_faces(body, lambda c: .36 < c.z < .50 and abs(c.x) < .14)


def rider(dress, arms=(), at=(0, -.07, .33), covered='top', name='Rider', pose=SEATED):
    """A seated rider: dressed, posed astride (baked into the rest pose), then armed (weapons follow
    the posed hands). `at`: where the armature stands (the horse's seat: (0, -.07, .33))."""
    arm, body = u.build_body(ready=True, lite=False, modest=False); arm.name = f'{name}Rig'; body.name = f'{name}Body'
    drop_cover(body, covered)
    apply(arm, dress)
    arm.location = at
    u.bake_rest_pose(arm, [o for o in bpy.context.scene.objects if o.type == 'MESH' and o.parent == arm], pose)
    apply(arm, arms)
    return arm


def seat_offset(kind):
    """The rider armature's spot for a mount kind (the horse's seat is the reference)."""
    hz = u.MOUNTS['horse']['seat'][2]
    s = u.MOUNTS[kind]['seat']
    return (0, -.07 + s[1] - u.MOUNTS['horse']['seat'][1], .33 + s[2] - hz)


def saddle_cloth(horse, mat='Team', kind='horse'):
    s = u.MOUNTS[kind]['seat']
    u.box('SaddleCloth', (0, s[1], s[2] - .10), (.34, .36, .12), mat, 'Mount_Spine', horse)


def banner(arm, top, w_=.26, h_=.30, hanging=True, name='Standard'):
    """A cloth standard on a pole in the right hand: a crossbar and a hanging cloth (the Emblem)."""
    w = lib.hand(arm)
    u.tube(name + 'Pole', [(w.x, w.y, .06), (w.x, w.y, top)], [.011, .009], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.box(name + 'Bar', (w.x, w.y, top - .04), (w_ + .04, .02, .02), 'Metal', 'Prop_R', arm, attachment=True)
    x0, x1, z0, z1, y = w.x - w_ / 2, w.x + w_ / 2, top - .05 - h_, top - .05, w.y - .012
    b = u.mesh_obj(name + 'Emblem', [(x0, y, z0), (x1, y, z0), (x1, y, z1), (x0, y, z1)], [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Emblem', 'Prop_R', True, arm=arm)
    uv = b.data.uv_layers.active
    for poly in b.data.polygons:
        for li in poly.loop_indices:
            co = b.data.vertices[b.data.loops[li].vertex_index].co
            uv.data[li].uv = ((co.x - x0) / (x1 - x0), (co.z - z0) / (z1 - z0))
    u.tube(name + 'Finial', [(w.x, w.y, top), (w.x, w.y, top + .07)], [.025, .002], 'Metal', ['Prop_R'] * 2, 6, arm, attachment=True)


def seated_cloak(arm, mat='Team'):
    rows = [[(-.13, .04, .785), (0, .06, .795), (.13, .04, .785)], [(-.17, .16, .55), (0, .19, .56), (.17, .16, .55)], [(-.19, .25, .36), (0, .29, .37), (.19, .25, .36)]]
    v = [p for r in rows for p in r]; f = []
    for i in range(2):
        for j in range(2):
            a = 3 * i + j; b = a + 1; c = a + 4; d = a + 3
            f += [(a, b, c), (a, c, d), (a, c, b), (a, d, c)]
    u.mesh_obj('Cloak', v, f, mat, None, arm=arm, weights=[{'Chest': 1}] * 3 + [{'Spine': 1}] * 3 + [{'Hips': 1}] * 3)


# ---- the units -----------------------------------------------------------------------------------

PERSON_OPTS = dict(budget=1500, mounted=False)


def b_infantry():
    arm = person([(tunic, 'Team', {'low': .38}), cuirass, pteruges, crested_helm, lib.greaves, lib.sandals, (lib.sword, {'length': .36}), oval_shield, (lib.belt, 'Leather', .53)])
    return [arm], {'Skin': 'C99472', 'Cloth': 'E7DDC7', 'Leather': '6E4A30', 'Metal': BRONZE, 'Wood': '5A4130'}, \
        'Swordsmen: bronze cuirass with leather pteruges, crested helmet with cheek pieces and neck guard, large oval shield (Emblem) with a spine and boss, short sword, greaves, Team tunic', PERSON_OPTS


def b_ranged():
    arm = person([(tunic, 'Team', {'low': .37}), (lib.top, 'Leather', {'name': 'Corselet'}), (lib.cap, 'Cloth', {'peak': 1.02, 'name': 'FeltCap', 'r': (.068, .061)}), composite_bow, lib.quiver, lib.wrist_guard, lib.sandals, lib.belt_dagger])
    return [arm], {'Skin': 'C99472', 'Cloth': 'D8CBA6', 'Leather': '7A5236', 'Metal': BRONZE, 'Wood': '6A4A30'}, \
        'Composite archers: recurve composite bow with bent tips, back quiver, leather corselet, felt cap, wrist guard, Team tunic', PERSON_OPTS


def b_cavalry():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    saddle_cloth(horse)
    r = rider([(tunic, 'Team', {'low': .40}), (lib.top, 'Metal', {'name': 'ScaleCoat'}), (crested_helm, 'Team')],
              [(lib.spear, {'top': 1.55, 'low': .25}), (small_round, .12)])
    return [horse, r], {'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '3F2E22'}, \
        'Heavy cavalry: rider in a scale coat and crested helmet with a long spear and a small round shield (Emblem), horse with a Team saddle cloth, no stirrups', dict(budget=2600, mounted=True)


def b_siege():
    parts, info = tm.frame('Frame')
    tm.torsion_engine(info)
    for i, (x, y, z, yaw) in enumerate(info['crew']):
        c, _ = u.crew(f'Crew{i}', (x, y, z), lite=True, head='cap', yaw=yaw)
        parts.append(c)
    return parts, {'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '8A6646'}, \
        'Ballista: a torsion bolt thrower (two sinew spring bundles, arms, string, a bolt laid, winch) on the wheeled siege frame, three crew in caps', dict(budget=3200, mounted=False)


def b_support():
    arm = person([(tunic, 'Team', {'low': .36}), (lib.top, 'Cloth'), (lib.belt, 'Leather', .53), (lib.headband, 'Cloth'), lib.hair, pick, mantlet, ladder, lib.sandals])
    return [arm], {'Skin': 'C99472', 'Cloth': 'D8CBA6', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': 'A0784E'}, \
        'Engineers: wicker mantlet on the left arm, pick, a short ladder on the back, Team tunic', PERSON_OPTS


def b_worker():
    arm = person([(tunic, 'Team', {'low': .34}), (lib.top, 'Cloth'), (lib.belt, 'Leather', .53), (lib.headcloth, 'Cloth'), pick, basket])
    return [arm], {'Skin': 'C99472', 'Cloth': 'DDD0B0', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': '9A7448'}, \
        'Laborer: Team tunic, headcloth, pick, basket on the back', PERSON_OPTS


def b_general():
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    saddle_cloth(horse)
    r = rider([(tunic, 'Cloth', {'low': .40}), (cuirass, 'Metal', {'name': 'MuscleCuirass'}), (pteruges, 'Team', .50), (crested_helm, 'Team', {'transverse': True}), (seated_cloak, 'Team')],
              [(lib.sword, {'length': .40})], name='Commander')
    bearer, _ = u.crew('Bearer', (.50, -.05, 0), head='cap')
    banner(bearer, 1.62)
    return [horse, r, bearer], {'Skin': 'C99472', 'Cloth': 'E7DDC7', 'Leather': '7E4F31', 'Metal': BRONZE, 'Wood': '3F2E22'}, \
        'Classical general: a mounted commander (muscled cuirass, Team pteruges, transverse Team crest, Team cloak, saddle cloth, sword) with a standard bearer on foot whose cloth standard is the squad emblem', dict(budget=3000, mounted=True)


BUILDERS = {'classical-infantry': b_infantry, 'classical-ranged': b_ranged, 'classical-cavalry': b_cavalry, 'classical-siege': b_siege,
            'classical-support': b_support, 'classical-worker': b_worker, 'classical-general': b_general}


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
