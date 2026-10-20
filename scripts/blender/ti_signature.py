# scripts/blender/ti_signature.py
# The signature units' kit (2026-10-20): one people's unit as a short recipe on the quality-pass figure of
# ti_figure.py, with the base units' authored clips (ti_foot_clips.py) chosen by its weapon. Replaces the
# old signature builders' garment library (build_units_<age>_signature.py: ti_units.build_body, rest pose
# only, the vertex rig) for foot units; the recipe keeps each people's look line from the roster
# (plans/ART-MODELS-PLAN.md 4.5, src/data/signatureUnits.js).
#
#   recipe = dict(colors={...}, legs='sandals', dress='kilt', armour=None, head=('helmet', {...}), beard=True,
#                 weapon=('spear', {...}), shield=('round', {...}), extras=[...], look='...')
#   foot(model, recipe)   -> builds art-build/units/signature/<model>/<model>.glb with its clips
#
# Contract (src/assets/units/signature/README.md): faces -Y in Blender (+Z glTF), feet on the ground, the
# materials Team (only on Spine, Chest and Head bones: the battle dyes those), Skin, Emblem (shield faces),
# flat colours, baked shade in COLOR_0; the weapon in the right fist (Prop_R) or the bow in the left (Prop_L).
import math
import os
from mathutils import Vector

import ti_figure as F
import ti_foot_clips as FC
import ti_units as u

V = Vector
HAND_R, HAND_L = V((-.223, -.137, .604)), V((.225, -.130, .608))
BOW_GRIP, ARROW_HAND = V((.222, -.132, .606)), V((-.219, -.137, .605))
P_R, P_L = 'Prop_R', 'Prop_L'


def start(colors):
    """An empty scene, the palette and the canonical rig; outputs go to art-build/units/signature/<model>/."""
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units' / 'signature')
    base = {'Hair': '2B201A', 'Skin': 'C48A62', 'Cloth': 'E2D8C2', 'Leather': '6A4630', 'Wood': '6A4A30', 'Metal': ('B8925A', .45, .6)}
    base.update(colors or {})
    return F.start(base, ready=True)


# ---- body --------------------------------------------------------------------------------------------------

def body(legs='sandals', sleeves=None, beard=True, hair='nape', bow=False, shoulder=None):
    """legs: 'sandals', 'bare', 'boots', ('hose', mat) or ('boots', mat); sleeves: a material for long sleeves."""
    if legs == 'sandals':
        F.legs(laces=True)
    elif legs == 'bare':
        F.legs(laces=False, straps=False)
    elif legs == 'boots':
        F.legs(boots='Leather')
    elif isinstance(legs, tuple) and legs[0] == 'hose':
        F.legs(boots=legs[2] if len(legs) > 2 else 'Leather', hose=legs[1])
    elif isinstance(legs, tuple) and legs[0] == 'boots':
        F.legs(boots=legs[1])
    F.arms(long=sleeves, shoulder=shoulder)
    if bow:
        F.fist('L', BOW_GRIP, (0, 0, 1))
        F.fist('R', ARROW_HAND, (0, 1, 0), half=.020)
    else:
        F.fist('R', HAND_R, (0, 0, 1))
        F.fist('L', HAND_L, (0, 0, 1))
    F.head()
    if beard:
        F.beard()
    if hair == 'nape':
        F.hair_nape()
    elif hair == 'full':
        F.hair()


# ---- dress and armour ---------------------------------------------------------------------------------------

def dress(kind='kilt', mat='Cloth', armour=None, armour_mat='Leather', team='sash'):
    """kind: 'kilt' (a knee kilt, bare chest unless armoured), 'tunic' (short sleeves to the knee), 'robe'
    (to the ankle), 'trousers' (a short tunic over the legs' hose). armour: None, 'leather' (a corselet),
    'scale', 'bronze' (a muscled bronze torso), 'mail', 'quilt'. team: 'sash' (a Team waist sash, Spine),
    'shawl' (over the shoulder, Chest), 'top' (the tunic's top itself Team), None."""
    if kind == 'kilt':
        F.skirt('Kilt', mat, low=.335, top=.548, sides=10)
        F.tufted_hem('KiltHem')
    elif kind == 'tunic':
        F.skirt('Tunic', mat, low=.360, top=.470, sides=10)
        F.torso('TunicTop', 'Team' if team == 'top' else mat, sides=10)
    elif kind == 'robe':
        F.skirt('Robe', mat, low=.090, top=.548, sides=12, flare=.040)
        F.torso('RobeTop', 'Team' if team == 'top' else mat, sides=10)
    elif kind == 'trousers':
        F.skirt('Tunic', mat, low=.420, top=.470, sides=10)
        F.torso('TunicTop', 'Team' if team == 'top' else mat, sides=10)
    if armour == 'leather':
        F.torso('Corselet', armour_mat, grow=.008, chest=.006)
    elif armour == 'scale':
        F.scale_coat('ScaleCoat', armour_mat)
    elif armour == 'bronze':
        F.bronze_torso('Cuirass', armour_mat, chest=True, grow=.006)
    elif armour == 'mail':
        F.torso('Mail', armour_mat, grow=.008, chest=.008)
    elif armour == 'quilt':
        F.torso('Quilted', armour_mat, grow=.012, chest=.008, ribs=6)
    if team == 'sash':
        F.band('TeamSash', 'Team', .512, .566, grow=.014, bone='Spine')
    elif team == 'shawl':
        F.shawl('TeamShawl', 'Team')


# ---- headgear -----------------------------------------------------------------------------------------------

def headgear(kind, **k):
    """kind: 'helmet' (peak, crest: a material for a ridge crest), 'cap' (mat, height), 'headband' (mat),
    'headcloth' (band), 'phrygian' (mat), 'feathers' (mat, n), 'horns' (mat), 'hood' (mat), 'kettle' (mat),
    'turban' (mat), None. A Team accent always reaches the head when the body has none (crest or band)."""
    if kind == 'helmet':
        F.helmet(k.get('mat', 'Metal'), cheeks=k.get('cheeks', True), neck=k.get('neck', True), peak=k.get('peak', 1.036))
        if k.get('crest'):
            # stations (y, bottom z, top z) from the brow to the nape, as the mercenary's horsehair crest
            F.ridge('Crest', [(-.050, 1.000, 1.050), (-.010, 1.030, 1.110), (.040, 1.020, 1.105), (.080, .960, 1.030)], k['crest'], 'Head', half=(.012, .022))
    elif kind == 'cap':
        F.cap('Cap', k.get('mat', 'Metal'), height=k.get('height', 1.106))
    elif kind == 'headband':
        F.headband(k.get('mat', 'Team'))
    elif kind == 'headcloth':
        F.headcloth(k.get('band', 'Team'), tail=k.get('tail', True), cloth=k.get('cloth', 'Cloth'))
    elif kind == 'phrygian':
        F.phrygian_cap('PhrygianCap', k.get('mat', 'Team'))
    elif kind == 'feathers':
        F.headband(k.get('band', 'Team'))
        n = k.get('n', 5)
        for i in range(n):
            a = math.radians(-50 + 100 * i / max(1, n - 1))
            base = V((math.sin(a) * .050, math.cos(a) * .045, .975))
            tip = base + V((math.sin(a) * .030, math.cos(a) * .020, k.get('tall', .14)))
            F.tube(f'Feather{i}', [(tuple(base), (.004, .012), 'Head'), (tuple(base.lerp(tip, .5)), (.003, .016), 'Head'), (tuple(tip), .001, 'Head')],
                   k.get('mat', 'Cloth'), 4)
    elif kind == 'horns':
        F.cap('Cap', k.get('cap', 'Metal'), height=1.060)
        for s in (-1, 1):
            F.tube(f'Horn{s}', [((s * .050, 0, 1.000), .014, 'Head'), ((s * .095, -.010, 1.040), .011, 'Head'), ((s * .110, -.030, 1.095), .002, 'Head')],
                   k.get('mat', 'Cloth'), 5)
        F.headband('Team', z=.952)
    elif kind == 'hood':
        F.hood('Hood', k.get('mat', 'Team'))
    elif kind == 'kettle':
        F.kettle_hat('KettleHat', k.get('mat', 'Metal'))
    elif kind == 'turban':
        F.headband(k.get('mat', 'Team'), z=.962, height=.060)
        F.cap('TurbanTop', k.get('mat', 'Team'), height=1.040)


# ---- weapons (the right fist, upright; or the bow in the left) ----------------------------------------------

def spear(length=2.2, head='leaf', at=HAND_R, mat='Metal'):
    """A spear upright in the right fist, `length` metres at a 1.75 m body (fitPolearm finds SpearShaft and
    the head)."""
    x, y, base = at.x, at.y, .040
    L = length / 1.75
    top = base + L - .150
    F.tube('SpearShaft', [((x, y, base), .0105, P_R), ((x, y, top), .0085, P_R)], 'Wood', 6, caps=(False, False), attachment=True)
    F.tube('SpearButt', [((x, y, .006), .002, P_R), ((x, y, base - .004), .011, P_R), ((x, y, base + .022), .012, P_R)], mat, 4, attachment=True)
    F.tube('SpearSocket', [((x, y, top - .028), .0125, P_R), ((x, y, top + .014), .010, P_R)], mat, 6, caps=(False, False), attachment=True)
    w = {'leaf': .030, 'broad': .040, 'narrow': .018}.get(head, .030)
    F.tube('SpearHead', [((x, y, top + .010), (.008, .008), P_R), ((x, y, top + .050), (w, .008), P_R),
                         ((x, y, top + .100), (w * .7, .006), P_R), ((x, y, top + .150), (.0015, .0015), P_R)], mat, 4, attachment=True)
    return FC.Kit('spear', shield=False)


def sword(length=.42, curved=False, at=HAND_R, mat='Metal'):
    x, y, P = at.x, at.y, P_R
    F.tube('SwordPommel', [((x, y + .006, .556), .006, P), ((x, y + .012, .566), .015, P), ((x, y + .004, .576), .008, P)], mat, 5, attachment=True)
    F.tube('SwordGrip', [((x, y, .570), .011, P), ((x, y, .642), .011, P)], 'Wood', 5, caps=(False, False), attachment=True)
    F.box('SwordGuard', (x, y - .004, .647), (.020, .050, .014), mat, P, True)
    end = .652 + length
    lean = -.030 if curved else 0
    F.tube('SwordBlade', [((x, y, .652), (.006, .018), P), ((x, y + .002, .652 + length * .5), (.006, .018 if not curved else .022), P),
                          ((x, y + lean, end - .040), (.004, .016), P), ((x, y + lean * 1.4, end), (.002, .002), P)], mat, 4, attachment=True)
    return FC.Kit('sword', shield=False)


def axe(length=.55, at=HAND_R, mat='Metal', head='axe'):
    """An axe (or a mace, head='mace'; a club, head='club') upright in the right fist."""
    x, y, P = at.x, at.y, P_R
    top = .560 + length
    F.tube('AxeHaft', [((x, y, .540), .011, P), ((x, y, top), .010, P)], 'Wood', 6, attachment=True)
    if head == 'axe':
        F.slab('AxeBlade', [(x, y - .010, top - .090), (x, y - .095, top - .110), (x, y - .100, top - .010), (x, y - .010, top - .030)], mat, P, attachment=True)
    elif head == 'mace':
        F.lathe('MaceHead', [(0, top - .040), (.030, top - .020), (.034, top + .010), (.022, top + .036), (0, top + .044)], mat, bone=P, sides=8, sy=1.0, cy=y, cx=x, attachment=True)
    else:
        F.tube('ClubHead', [((x, y, top - .120), .018, P), ((x, y, top - .010), .030, P), ((x, y, top + .020), .012, P)], 'Wood', 6, attachment=True)
    return FC.Kit('sword', shield=False)


def bow(length=.86, brace=.086, mat='Wood', string='Cloth', recurve=0.):
    """A bow upright through the left fist, its string on a bone of its own (Prop_String), an arrow nocked
    in the right fist (on Tool_Arrow for the clips). Call before body(bow=True)? No: after start(), before
    body(): it adds the string bone in edit mode."""
    import bpy
    arm = F.arm
    back = V((-math.sin(math.radians(40)), math.cos(math.radians(40)), 0))
    st = BOW_GRIP + back * brace
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    bs = arm.data.edit_bones.new('Prop_String')
    bs.head, bs.tail, bs.parent = tuple(st), (st.x, st.y, st.z + .02), arm.data.edit_bones['Prop_L']
    bpy.ops.object.mode_set(mode='OBJECT')
    arm.pose.bones['Prop_String'].rotation_mode = 'QUATERNION'
    return st, back, length, recurve, mat, string


def bow_parts(b):
    st, back, length, recurve, mat, string = b
    P = P_L
    g = BOW_GRIP
    pts = []
    n = 10
    for i in range(n + 1):
        t = i / n * 2 - 1
        z = g.z + t * length / 2
        bend = .040 * (1 - t * t) - (recurve * abs(t) ** 3 if recurve else 0)
        pts.append(((g.x + back.x * -bend * .3, g.y - bend, z), (.0130 * (1 - .45 * abs(t)), .0065), P))
    F.tube('self-bow', pts, mat, 5, attachment=True)
    F.tube('bow-grip', [((g.x, g.y, g.z - .040), .0155, P), ((g.x, g.y, g.z + .040), .0155, P)], 'Leather', 6, caps=(False, False), attachment=True)
    top, bottom = V(pts[-1][0]), V(pts[0][0])
    F.tube('bow-string', [(tuple(bottom), .0032, P), (tuple(st), .0032, 'Prop_String'), (tuple(top), .0032, P)], string, 3, attachment=True)
    ax, az = ARROW_HAND.x + .006, ARROW_HAND.z + .008
    F.tube('nocked-arrow-shaft', [((ax, -.108, az), .0040, P_R), ((ax, -.505, az), .0040, P_R)], 'Wood', 4, attachment=True)
    F.tube('nocked-arrow-head', [((ax, -.500, az), (.011, .004), P_R), ((ax, -.548, az), (.0012, .0012), P_R)], 'Metal', 4, attachment=True)
    F.tube('nocked-arrow-fletching', [((ax, -.170, az), (.004, .015), P_R), ((ax, -.222, az), (.004, .011), P_R)], 'Cloth', 4, attachment=True)
    return FC.Kit('bow', side='L', arrow=('nocked-arrow-shaft', 'nocked-arrow-head', 'nocked-arrow-fletching'), string=True, quiver='back')


# ---- shields (the left fist) ---------------------------------------------------------------------------------

def shield(kind='round', size=1.0, rim='Metal', back='Wood', boss=None):
    """kind: 'round', 'oval' (tall), 'rect' (a tall body shield), 'small' (a buckler), 'crescent' (a pelta)."""
    if kind == 'round':
        F.round_shield((.225, -.166, .612), .192 * size, rim=rim, back=back)
    elif kind == 'small':
        F.round_shield((.225, -.160, .612), .120 * size, rim=rim, back=back)
    elif kind == 'oval':
        F.oval_shield((.238, -.170, .570), .150 * size, .270 * size, rim=rim, back=back, boss=boss)
    elif kind == 'rect':
        F.heater_shield((.238, -.172, .560), .300 * size, .560 * size, rim=rim, back=back, curve=.030)
    elif kind == 'crescent':
        F.oval_shield((.232, -.168, .600), .190 * size, .150 * size, rim=rim, back=back)


SHIELD_FACING = {'ShieldFace': V((0, -1, 0)), 'ShieldBack': V((0, 1, 0))}


# ---- the whole unit -------------------------------------------------------------------------------------------

def foot(model, r):
    """Build one foot signature unit from its recipe `r` and export it with its clips."""
    start(r.get('colors'))
    wkind, wk = (r['weapon'] if isinstance(r['weapon'], tuple) else (r['weapon'], {}))
    is_bow = wkind == 'bow'
    b = bow(**wk) if is_bow else None
    body(legs=r.get('legs', 'sandals'), sleeves=r.get('sleeves'), beard=r.get('beard', True), hair=r.get('hair', 'nape'), bow=is_bow,
         shoulder=r.get('shoulder'))
    dk = r.get('dress', 'kilt')
    dress(dk, r.get('dress_mat', 'Cloth'), r.get('armour'), r.get('armour_mat', 'Leather'), r.get('team', 'sash'))
    hk = r.get('head')
    if hk:
        name, kw = hk if isinstance(hk, tuple) else (hk, {})
        headgear(name, **kw)
    if is_bow:
        kit = bow_parts(b)
        F.back_quiver()
    elif wkind in ('spear', 'javelin', 'pike'):
        kit = spear(**wk)
        if wkind == 'pike':
            kit = FC.Kit('pike')
    elif wkind == 'sword':
        kit = sword(**wk)
    else:
        kit = axe(head=wkind if wkind in ('mace', 'club') else 'axe', **wk)
    sh = r.get('shield')
    if sh and not is_bow:
        name, kw = sh if isinstance(sh, tuple) else (sh, {})
        shield(name, **kw)
        kit.shield = True
    for fn in r.get('extras', []):
        fn()
    F.finish_rest(model, r['look'], budget=3000, rig_name='SignatureRig', notes={'name': r.get('name', model), 'role': r.get('role', 'infantry'),
                                                                     'signature': True, 'recipe': 'ti_signature.foot (2026-10-20)'},
                  clips=FC.clips_hook(model, kit))
