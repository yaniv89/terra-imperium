# scripts/blender/ti_signature_mounted.py
# The mounted signature units' kit (2026-10-20): one people's horseman as a short recipe on the quality-pass
# horse (ti_mounts.fine_horse detail 2, fine_legs, full_tail) and rider (ti_figure.figure astride), with the
# base cavalry's authored clips (ti_mounted_clips.mounted). The foot kit is ti_signature.py; this is its
# counterpart for the 'horse' rig of src/data/signatureUnits.js. Each recipe keeps the people's look line
# from the old builders (build_units_<age>_signature.py HORSE tables, plans/ART-MODELS-PLAN.md 4.5).
#
#   recipe = dict(colors={...},                      # the palette: Coat and Mane are the horse's own
#                 horse=dict(style='cloth', cloth='Saddle', blaze=True, socks=False, ...),
#                 legs=('hose', 'Trousers'), sleeves='Cloth', dress=dict(...), head=('phrygian', {...}),
#                 hair='nape', beard=True, weapon=('lance', {...}), shield=('round', {...}),
#                 pre=[callables before the seat], post=[callables after], look='...', name='...')
#   mounted(model, recipe)  -> art-build/units/signature/<model>/<model>.glb with the mounted clips
#
# Weapons and their clip kind (ti_mounted_clips.RiderLib): 'lance' (a spear upright, couched in the Charge),
# 'javelin' (a short spear and a spare, on the lance clips; not named Spear* so the battle does not stretch
# it to a 3.5 m lance), 'sword' (a sabre or a long sword upright: the sword clips), 'bow' (the bow in the left
# fist with the reins; the right hand is the pointing hand on the mounted clips' 'bow' kind: it reaches to the
# string, draws to the cheek and looses in the Attack and at the Charge's contact; the string stays on the bow).
# Contract as the base units: faces -Y, Team only on the rider's Spine, Chest and Head parts (a mount's Team
# cloth is drawn as plain wool, so the horse's cloths take colours of their own), shield faces Emblem, flat
# colours, baked shade in COLOR_0. The close version stays under 5,000 triangles.
import math
import os
from mathutils import Matrix, Vector

import ti_figure as F
import ti_mounts as tm
import ti_mounted_clips as MC
import ti_signature as TS
import ti_units as u

V = Vector
tube, box = F.tube, F.box
BUDGET = 5000
S = 'Mount_Spine'

BASE = {'Coat': '6E3F24', 'Mane': '1F1712', 'Pale': 'EDE6D6', 'Leather': '5A3624', 'Boot': '4A2F20', 'Wood': '5A4130', 'Cloth': 'E2D8C2',
        'Saddle': '7A4A30', 'Trim': 'D8C99A', 'Metal': ('B8925A', .45, .6), 'Iron': ('9EA2A6', .4, .72), 'Gold': ('D4A84A', .35, .8),
        'Hair': '2B201A', 'Skin': 'C48A62', 'Emblem': 'E6D6AF', 'Fur': '4A3A2C', 'String': 'E8E0CC',
        'Horn': '3A2E24', 'Felt': '3A3530', 'Straw': 'C9B27A', 'Rope': 'B89E74', 'Hoof': '2E2620'}
PAL = dict(BASE)  # the current unit's palette (start)


def pale(colour, limit=.45):
    """Is a palette colour (hex, or (hex, roughness, metal)) light: its mean channel above `limit`?"""
    h = colour[0] if isinstance(colour, tuple) else colour
    return sum(int(h[i:i + 2], 16) for i in (0, 2, 4)) / (3 * 255) > limit


def start(colors):
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units' / 'signature')
    pal = dict(BASE)
    pal.update(colors or {})
    PAL.clear()
    PAL.update(pal)
    F.start(pal, rig=False)


# ---- the horse ----------------------------------------------------------------------------------------------

def _flank(y, a, out=.006):
    """A point on the horse's barrel at length y, `a` degrees from the top towards its left (+X)."""
    cz, h, w = tm.barrel_at(y)
    r = math.radians(a)
    return V(((w + out) * math.sin(r), y, cz + (h + out) * math.cos(r)))


def peytral(mat="Metal", name="Peytral"):
    """A chest plate round the horse's breast, a deep band following the breast band's arc (Mount_Spine)."""
    tube(name, [((.132, -.300, .672), (.052, .010), S), ((.100, -.452, .640), (.066, .012), S), ((0, -.514, .630), (.072, .012), S),
                ((-.100, -.452, .640), (.066, .012), S), ((-.132, -.300, .672), (.052, .010), S)], mat, 6)


def spots(mat, ys=(-.20, -.05, .10), angles=(70, 95), size=.026, name='Spot'):
    """Round patches on both flanks of a cloth (a spotted pard skin, an embroidered pattern)."""
    k = 0
    for sx in (-1, 1):
        for i, y in enumerate(ys):
            for a in angles:
                p = _flank(y + (.03 if (i + a) % 2 else 0), sx * a, .022)
                box(f'{name}{k}', tuple(p), (size * .45, size, size), mat, S)
                k += 1


def bells(mat='Gold', n=5, name='Bell'):
    """Small bells hung from the breast band."""
    arc = [(.110, -.380, .690), (.072, -.478, .660), (0, -.508, .652), (-.072, -.478, .660), (-.110, -.380, .690)]
    for k, (x, y, z) in enumerate(arc[:n]):
        tube(f'{name}{k}', [((x, y, z - .010), .006, S), ((x, y - .004, z - .030), .016, S), ((x, y - .004, z - .044), .018, S)], mat, 6, caps=(True, True))


def horse(h):
    """The mount and its tack. h: style 'cloth' (a saddle cloth, girth, breast band and discs), 'fleece' (a
    fringed sheepskin), 'bare' (no saddle: a girth strap only), 'caparison' (a cloth to the knees), 'barding'
    (a short hide or quilted cover), 'shabraque' (the hussar's pointed cloth over a war saddle); cloth: its
    material; border: a material for a broader cloth under it (an edge round the saddle cloth); blaze, socks;
    discs and disc; chanfron, peytral (materials); spots (material), bells (material), stirrups, tack (the
    bridle's material: 'Rope' for a rope bridle), hoof (the hooves' material: by default the mane's, or the dark
    'Hoof' under a pale mane)."""
    arm, _ = tm.fine_horse('Mount', (0, 0, 0), pale='Pale', tack=h.get('tack', 'Leather'), blaze=h.get('blaze', True), socks=h.get('socks', False), detail=2)
    # dark hooves under a pale (flaxen, white, grey) mane: fine_legs' default takes the mane's colour
    tm.fine_legs(arm, sides=8, hoof=h.get('hoof') or ('Hoof' if pale(PAL['Mane']) else 'Mane'))
    tm.full_tail(arm, sides=10)
    style, cloth = h.get('style', 'cloth'), h.get('cloth', 'Saddle')
    span = h.get('span', (-.30, .16))
    if h.get('border'):
        F.meshes.append(tm.drape('SaddleBorder', arm, h['border'], span[0] - .025, span[1] + .025, reach=h.get('reach', 108) + 9, grow=.009, steps=12, rows=5))
    if style == 'cloth':
        tm.tack(arm, cloth, span=span, reach=h.get('reach', 108), fringe=h.get('fringe', .028), discs=h.get('discs', 3), disc=h.get('disc', 'Metal'), steps=12, rows=5)
    elif style == 'fleece':
        tm.tack(arm, cloth, span=(-.28, .15), reach=100, fringe=.040, discs=h.get('discs', 0), disc=h.get('disc', 'Metal'), steps=12, rows=5)
    elif style == 'bare':
        tm.tack(arm, None, discs=0, band=h.get('band', 'Leather'))
    elif style == 'caparison':
        tm.caparison(arm, cloth, trim=h.get('trim'), hem=h.get('hem', .31))
    elif style == 'barding':
        tm.caparison(arm, cloth, trim=h.get('trim'), hem=h.get('hem', .42), dag=h.get('dag', .018), front=True, back=True)
    elif style == 'shabraque':
        tm.shabraque(arm, cloth, h.get('lace', 'Trim'))
    if h.get('saddle'):
        tm.war_saddle(arm, h['saddle'], cantle=h.get('cantle', .805), pommel=h.get('cantle', .805))
    if h.get('holsters'):
        tm.holsters(arm, 'Leather', 'Fur')
    if h.get('chanfron'):
        tm.chanfron(arm, h['chanfron'])
    if h.get('peytral'):
        F.use(arm)
        peytral(h['peytral'])
    if h.get('spots'):
        F.use(arm)
        spots(h['spots'], ys=h.get('spot_ys', (-.20, -.05, .10)), angles=h.get('spot_angles', (70, 95)))
    if h.get('bells'):
        F.use(arm)
        bells(h['bells'])
    return arm


# ---- the rider ----------------------------------------------------------------------------------------------

def lamellar(name='Lamellar', mat='Iron', low=.500, high=.785):
    """Lamellar: a coat of narrow scales, many short rows (ti_figure.scale_coat)."""
    return F.scale_coat(name, mat, low=low, high=high, rows=7, scallop=.008, grow=.014)


def dress(d):
    """d: skirt (mat), skirt_low, top (the torso's material), grow, chest, ribs (quilted), armour ('scale',
    'lamellar', 'mail', 'breastplate', 'quilt'), armour_mat, belt (mat), sash (mat), cloak (mat or dict)."""
    F.skirt('Skirt', d.get('skirt', 'Cloth'), low=d.get('skirt_low', .395), grow=d.get('skirt_grow', .004), ribs=d.get('skirt_ribs', 0), seated=True)
    if d.get('hem'):
        F.skirt('SkirtHem', d['hem'], low=d.get('skirt_low', .395) - .005, top=d.get('skirt_low', .395) + .022, grow=d.get('skirt_grow', .004) + .003, seated=True)
    F.torso('Top', d.get('top', 'Team'), grow=d.get('grow', .006), chest=d.get('chest', 0), ribs=d.get('ribs', 0))
    a, am = d.get('armour'), d.get('armour_mat', 'Iron')
    if a == 'scale':
        F.scale_coat('ScaleCoat', am, low=.505, high=.785, rows=5)
    elif a == 'lamellar':
        lamellar('Lamellar', am)
    elif a == 'mail':
        F.torso('Mail', am, grow=.014, chest=.006)
        F.skirt('MailSkirt', am, low=.420, grow=.010, seated=True)
    elif a == 'breastplate':
        F.torso('Breastplate', am, grow=.016, chest=.014)
    elif a == 'quilt':
        F.torso('Quilted', am, grow=.016, chest=.008, ribs=6)
    if d.get('belt'):
        F.band('Belt', d['belt'], .512, .540, grow=d.get('belt_grow', .028), bone='Spine')
    if d.get('sash'):
        F.band('Sash', d['sash'], .520, .566, grow=d.get('belt_grow', .028) + .004, bone='Spine')
    c = d.get('cloak')
    if c:
        ck = c if isinstance(c, dict) else {'mat': c}
        F.cloak('Cloak', ck.get('mat', 'Team'), top=.792, low=ck.get('low', .505), rows=3, k=6, arc=(140, 80), width=(.122, .180), depth=(.076, .086),
                back=(.006, .110))


def head(kind, k):
    """Headgear: the foot kit's (ti_signature.headgear: helmet, cap, headband, headcloth, phrygian, feathers,
    hood, kettle, turban) plus 'crested' (a helmet under a tall Team crest), 'fur' (a round fur cap), 'petasos'
    (a broad hat), 'plumed' (a felt cap and a plume), 'spiked' (a tall pointed helmet with an aventail),
    'kalpak' (a fur cap, its Team bag and a plume), 'szyszak' (a lobster-tail helmet)."""
    if kind == 'crested':
        F.helmet(k.get('mat', 'Metal'), cheeks=k.get('cheeks', True))
        F.ridge('Crest', [(-.070, .975, 1.016), (-.044, .996, 1.088), (0, 1.026, 1.124), (.046, .998, 1.112), (.078, .952, 1.070),
                          (.098, .900, 1.000), (.104, .866, .912)], k.get('crest', 'Team'), 'Head', half=(.014, .026))
    elif kind == 'fur':
        F.fur_cap('FurCap', k.get('mat', 'Fur'), plate=None, height=k.get('height', 1.060))
        if k.get('top'):
            F.cap('CapTop', k['top'], height=k.get('height', 1.060) + .040)
    elif kind == 'petasos':
        F.round_hat('Petasos', k.get('mat', 'Straw'), k.get('band', 'Team'), brim=k.get('brim', .132), crown=1.030)
    elif kind == 'plumed':
        F.cap('FeltCap', k.get('mat', 'Felt'), height=k.get('height', 1.070))
        F.headband(k.get('band', 'Team'), z=.952, height=.030)
        tube('Plume', [((0, .010, 1.050), .008, 'Head'), ((0, .030, 1.130), (.010, .022), 'Head'), ((0, .070, 1.180), (.006, .018), 'Head'),
                       ((0, .110, 1.190), .002, 'Head')], k.get('plume', 'Cloth'), 4)
    elif kind == 'spiked':
        F.helmet(k.get('mat', 'Iron'), cheeks=False, neck=False, peak=k.get('peak', 1.120))
        tube('HelmSpike', [((0, -.003, k.get('peak', 1.120) - .010), .010, 'Head'), ((0, -.003, k.get('peak', 1.120) + .050), .002, 'Head')], k.get('mat', 'Iron'), 5)
        F.mail_coif('Aventail', k.get('aventail', 'Iron'), cape=.150)
        if k.get('band'):
            F.headband(k['band'], z=.958, height=.026)
    elif kind == 'kalpak':
        F.fur_cap('Kalpak', k.get('mat', 'Fur'), plate=None, height=1.090)
        tube('KalpakBag', [((0, .010, 1.080), .040, 'Head'), ((.010, .070, 1.060), .032, 'Head'), ((.020, .100, 1.000), .022, 'Head')], 'Team', 6)
        tube('KalpakPlume', [((-.040, -.040, 1.060), .008, 'Head'), ((-.050, -.030, 1.150), (.010, .020), 'Head'), ((-.050, .000, 1.210), .002, 'Head')],
             k.get('plume', 'Cloth'), 4)
    elif kind == 'szyszak':
        F.helmet(k.get('mat', 'Iron'), cheeks=True, neck=False, peak=1.060)
        tube('LobsterTail', [((0, .040, .960), (.058, .020), 'Head'), ((0, .082, .900), (.062, .022), 'Head'), ((0, .108, .830), (.066, .022), 'Head')],
             k.get('mat', 'Iron'), 6)
        tube('NoseBar', [((0, -.074, .965), .005, 'Head'), ((0, -.080, .900), .005, 'Head')], k.get('mat', 'Iron'), 4)
    elif kind:
        TS.headgear(kind, **k)


def rider(r):
    rd = F.figure('Rider')
    legs = r.get('legs', 'boots')
    if legs == 'bare':
        F.legs(laces=False, straps=False)
    elif legs == 'sandals':
        F.legs()
    elif legs == 'boots':
        F.legs(boots='Boot')
    elif isinstance(legs, tuple) and legs[0] == 'hose':
        F.legs(boots=legs[2] if len(legs) > 2 else 'Boot', hose=legs[1])
    if r.get('jackboots'):
        F.jackboots('Boot')
    F.arms(sleeve=r.get('sleeve'), long=r.get('sleeves'), shoulder=r.get('shoulder'), pad=r.get('pad', 0.), cuff=r.get('cuff'))
    hk = r.get('head')
    name, kw = (hk if isinstance(hk, tuple) else (hk, {})) if hk else (None, {})
    F.head(ears=name in (None, 'headband', 'feathers', 'phrygian', 'petasos', 'turban', 'headcloth', 'plumed', 'cap', 'fur', 'kalpak'))
    if r.get('beard', True):
        F.beard()
    hair = r.get('hair', 'nape')
    if hair == 'nape':
        F.hair_nape()
    elif hair == 'full':
        F.hair(crown=name is None or name in ('headband', 'feathers'))
    elif hair == 'braids':
        F.hair_nape()
        for s in (-1, 1):
            tube(f'Braid{s}', [((s * .030, .052, .900), .012, 'Head'), ((s * .040, .080, .840), .011, 'Chest'), ((s * .044, .094, .760), .010, 'Chest'),
                               ((s * .046, .098, .690), .004, 'Chest')], 'Hair', 5)
    if r.get('moustache'):
        box('Moustache', (0, -.062, .884), (.060, .013, .012), 'Hair', 'Head')
    dress(r.get('dress', {}))
    head(name, kw)
    for fn in r.get('pre', []):
        fn()
    return rd


# ---- weapons ------------------------------------------------------------------------------------------------

def lance(g, top=1.55, low=.235, head='leaf', pennon=None, mat='Iron'):
    """A long spear upright in the right fist (SpearShaft and SpearHead: the battle fits it to a 3.5 m lance)."""
    P = 'Prop_R'
    tube('SpearShaft', [((g.x, g.y, low), .0115, P), ((g.x, g.y, top), .0095, P)], 'Wood', 5, attachment=True)
    w = {'leaf': .012, 'broad': .018, 'narrow': .008}.get(head, .012)
    tube('SpearHead', [((g.x, g.y, top - .012), (.006, w), P), ((g.x, g.y, top + .040), (.007, w * 2), P), ((g.x, g.y, top + .125), .001, P)], mat, 4, attachment=True)
    if pennon:
        y0, z0 = g.y, top - .010
        F.shell('SpearHeadPennon', [[(g.x, y0 + .006, z0), (g.x, y0 + .006, z0 - .048), (g.x, y0 + .006, z0 - .096)],
                                    [(g.x, y0 + .090, z0 - .010), (g.x, y0 + .090, z0 - .050), (g.x, y0 + .090, z0 - .090)],
                                    [(g.x, y0 + .185, z0 - .016), (g.x, y0 + .128, z0 - .050), (g.x, y0 + .185, z0 - .086)]], .004, pennon, P, True)


def javelins(g, top=1.200, low=.420, mat='Iron', spare=True):
    """A javelin upright in the right fist and a spare beside it (Javelin*, not Spear*: kept at its length)."""
    P = 'Prop_R'
    for k, dx in enumerate((0, .022) if spare else (0,)):
        t = top - k * .060
        tube(f'JavelinShaft{k}', [((g.x + dx, g.y + dx * .3, low + k * .03), .0080, P), ((g.x + dx, g.y + dx * .3, t), .0070, P)], 'Wood', 4, attachment=True)
        tube(f'JavelinHead{k}', [((g.x + dx, g.y + dx * .3, t - .010), (.005, .008), P), ((g.x + dx, g.y + dx * .3, t + .022), (.006, .014), P),
                                 ((g.x + dx, g.y + dx * .3, t + .085), .001, P)], mat, 4, attachment=True)


def composite_bow(grip, length=.62, mat='Wood', belly='Horn', string='String', prop='Prop_L', back=(0, 1, 0)):
    """A short recurved composite bow upright through the left fist: the limbs bend forward (-Y) and the
    ears flick back; the string straight between the nocks (towards the rider, +Y)."""
    g, b = V(grip), V(back).normalized()
    ring = []
    n = 12
    for i in range(n + 1):
        t = i / n * 2 - 1
        s = abs(t)
        bend = .040 * s * s - (.050 * max(0, s - .78) / .22 if s > .78 else 0)  # the limbs forward, the ears back
        ring.append((tuple(g + V((0, 0, t * length / 2)) - b * bend * 1.0 + b * .000), (.0125 - .005 * s, .0075), prop))
    tube('CompositeBow', ring, mat, 5, attachment=True)
    tube('BowGrip', [((g.x, g.y, g.z - .035), .0150, prop), ((g.x, g.y, g.z + .035), .0150, prop)], belly, 6, caps=(False, False), attachment=True)
    top, bottom = V(ring[-1][0]), V(ring[0][0])
    tube('BowString', [(tuple(bottom), .0028, prop), (tuple(top), .0028, prop)], string, 3, attachment=True)


def gorytos(mat='Leather', trim='Gold', side='L'):
    """The Scythian bow-and-arrow case at the hip, slanting back along the horse's flank (Hips)."""
    s = 1 if side == 'L' else -1
    tube('Gorytos', [((s * .135, -.010, .560), (.018, .044), 'Hips'), ((s * .158, .050, .450), (.020, .052), 'Hips'), ((s * .172, .100, .350), (.014, .036), 'Hips')],
         mat, 6)
    tube('GorytosBand', [((s * .140, .002, .540), (.022, .048), 'Hips'), ((s * .146, .018, .515), (.022, .050), 'Hips')], trim, 6, caps=(False, False))
    for k in range(3):
        tube(f'GorytosArrow{k}', [((s * .136, -.010 + k * .018, .560), .0035, 'Hips'), ((s * .120, -.030 + k * .018, .640), .0035, 'Hips')], 'Wood', 3)
        tube(f'GorytosFletch{k}', [((s * .124, -.026 + k * .018, .620), (.003, .010), 'Hips'), ((s * .119, -.032 + k * .018, .648), (.003, .008), 'Hips')], 'String', 4)


def hip_quiver(mat='Leather', side='R', arrows=3):
    """A quiver at the right hip, the arrows' fletching up behind the thigh (Hips)."""
    s = 1 if side == 'L' else -1
    tube('HipQuiver', [((s * .150, .040, .330), .022, 'Hips'), ((s * .140, .020, .470), .030, 'Hips'), ((s * .132, .010, .560), .032, 'Hips')], mat, 6)
    for k in range(arrows):
        dx = (k - 1) * .012
        tube(f'HipArrow{k}', [((s * .132 + dx, .010, .550), .0035, 'Hips'), ((s * .128 + dx, .004, .640), .0035, 'Hips')], 'Wood', 3)
        tube(f'HipFletch{k}', [((s * .129 + dx, .006, .610), (.003, .011), 'Hips'), ((s * .128 + dx, .004, .642), (.003, .009), 'Hips')], 'String', 4)


def sabre_at_hip(mat='Iron', length=.40):
    F.hip_sword('Sabre', 'L', mat=mat, length=length, tip=(.176, .150, .230))


def slung_gun(stock='Wood', barrel='Iron', name='SlungGun', long=False):
    """A carbine (or a long matchlock, `long`) slung across the back (Chest)."""
    e = .08 if long else 0
    tube(name, [((-.170 - e * .5, .124, .520 - e), (.010, .016), 'Chest'), ((.040, .112, .780), .009, 'Chest'), ((.200 + e * .5, .100, .990 + e * .6), .008, 'Chest')],
         stock, 5)
    tube(name + 'Barrel', [((.020, .108, .760), .0055, 'Chest'), ((.236 + e * .6, .096, 1.035 + e * .8), .0055, 'Chest')], barrel, 4)


def wings(frame='Wood', feather='Pale', n=7):
    """The winged hussar's wing: a curved wooden frame rising from the back over the head, a row of feathers
    along it (Chest)."""
    pts = [V((.040, .110, .560)), V((.046, .150, .800)), V((.040, .150, 1.050)), V((.030, .110, 1.230)), V((.020, .040, 1.300))]
    tube('WingFrame', [(tuple(p), .009, 'Chest') for p in pts], frame, 5)
    for k in range(n):
        t = (k + 1) / (n + 1)
        i = min(len(pts) - 2, int(t * (len(pts) - 1)))
        f = t * (len(pts) - 1) - i
        p = pts[i].lerp(pts[i + 1], f)
        tip = p + V((0, .060 + .020 * t, .010))
        tube(f'WingFeather{k}', [(tuple(p), (.004, .016), 'Chest'), (tuple(p.lerp(tip, .6)), (.004, .020), 'Chest'), (tuple(tip), .002, 'Chest')], feather, 4)


def back_pennant(mat='Team', pole='Wood'):
    """A small pennant on a pole behind the shoulders (Chest: the battle dyes a Team pennant)."""
    tube('PennantPole', [((.060, .120, .600), .007, 'Chest'), ((.070, .135, 1.300), .006, 'Chest')], pole, 4)
    F.slab('Pennant', [(.072, .136, 1.290), (.072, .300, 1.250), (.072, .136, 1.180), (.072, .136, 1.180)], mat, 'Chest', depth=.006)


def torc(mat='Gold'):
    tube('Torc', [((x, y, .792), .009, 'Chest') for x, y in ((-.060, .010), (-.044, -.040), (0, -.058), (.044, -.040), (.060, .010), (.040, .048),
                                                            (0, .060), (-.040, .048), (-.060, .010))], mat, 4)


# ---- the whole unit -----------------------------------------------------------------------------------------

def mounted(model, r):
    """Build one mounted signature unit from its recipe and export it with the mounted clips."""
    start(r.get('colors'))
    parts = []
    h = r.get('horse', {})
    mount = horse(h)
    parts.append(mount)
    rd = rider(r)
    parts.append(rd)
    wkind, wk = r['weapon'] if isinstance(r['weapon'], tuple) else (r['weapon'], {})
    if wkind == 'bow':
        F.astride(right=(-.010, -.170, .790), left=(.170, -.380, .770), right_pole=(-1, .6, -.2))  # the bow held out, the draw hand at the chest
        F.pointing_hand('R')
        gl = F.fist('L', None, (0, 0, 1), half=.020)
        if wk.get('long'):
            F.self_bow(gl, wk.get('length', 1.05), back=(0, 1, 0), brace=.040)
        else:
            composite_bow(gl, length=wk.get('length', .62))
        clip = 'bow'
    else:
        F.astride(right=(-.215, -.120, .680 if wkind == 'sword' else .660), left=(.105, -.185, .640))
        g = F.fist('R', None, (0, 0, 1), mat=r.get('glove', 'Skin'))
        gl = F.fist('L', None, (0, 1, 0), half=.020, mat=r.get('glove', 'Skin'))
        if wkind == 'lance':
            lance(g, **wk)
            clip = 'lance'
        elif wkind == 'javelin':
            javelins(g, **wk)
            clip = 'lance'
        else:
            F.upright_sabre(g, length=wk.get('length', .48), curve=wk.get('curve', .022), mat=wk.get('mat', 'Iron'), guard=wk.get('guard', 'Metal'),
                            width=wk.get('width', .017))
            clip = 'sword'
    facing = None
    sh = r.get('shield')
    if sh and wkind != 'bow':
        skind, sk = sh if isinstance(sh, tuple) else (sh, {})
        b = rd.data.bones
        el, wr = b['Forearm_L'].head_local, b['Hand_L'].head_local
        mid = el.lerp(wr, .45)
        ang = sk.get('angle', 28)
        face_dir = Matrix.Rotation(math.radians(ang), 3, 'Z') @ V((0, -1, 0))
        centre = mid + face_dir * .060 + V((0, 0, .03))
        n0 = len(F.meshes)
        if skind == 'round':
            face = F.round_shield(tuple(centre), sk.get('radius', .145), n=14, rim=sk.get('rim', 'Metal'), back=sk.get('back', 'Wood'))
            fname, bname = face.name, face.name.replace('Face', 'Back')
        else:  # 'oval': a tall oval, `rx`, `rz`
            F.oval_shield(tuple(centre), sk.get('rx', .120), sk.get('rz', .210), rim=sk.get('rim', 'Metal'), back=sk.get('back', 'Wood'),
                          boss=sk.get('boss'), spine=sk.get('spine'))
            made = F.meshes[n0:]
            fname = next(o.name for o in made if 'Face' in o.name)
            bname = next(o.name for o in made if o.name.endswith('Back'))
        F.turn(F.meshes[n0:], centre, ang)
        facing = {fname: tuple(face_dir), bname: tuple(-face_dir)}
    for fn in r.get('post', []):
        fn()
    stir = h.get('stirrups', False)
    if stir:
        tm.stirrups(mount, mat=h.get('stirrup_mat', 'Iron'))
    tm.reins(mount, F.SEAT + gl, mat=h.get('reins', 'Leather'))
    notes = {'name': r.get('name', model), 'role': r.get('role', 'cavalry') + ': ' + r['look'], 'signature': True,
             'recipe': 'ti_signature_mounted.mounted (2026-10-20)', 'clipKind': clip,
             'notes': r.get('notes', 'Quality pass of the mounted signature units on ti_figure.py (astride) and ti_mounts.py (fine_horse detail 2, fine_legs, full_tail).')}
    tris = F.finish_unit(model, parts, notes, open_facing=facing, centre=(0, -.1, .8), scale=2.6, mode='NLA_TRACKS',
                         clips=MC.hook(model, lambda: MC.mounted(mount, rd, clip, stirrups=stir), 'mounted'))
    print('TRIS', model, tris, flush=True)
    assert tris <= BUDGET, (model, tris)
    return tris
