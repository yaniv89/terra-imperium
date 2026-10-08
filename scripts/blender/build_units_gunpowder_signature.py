# scripts/blender/build_units_gunpowder_signature.py
# The 32 Gunpowder signature units of plans/ART-MODELS-PLAN.md 4.5 (one per people whose peak is the
# Gunpowder age), on the person rig, the horse, the ox and the siege frame (ti_units.py, ti_mounts.py),
# with the part libraries of build_units_bronze_signature.py, build_units_classical.py,
# build_units_classical_signature.py, build_units_kingdoms.py, build_units_kingdoms_signature.py and
# build_units_gunpowder.py, in the base units' look (faceted, flat colours: Team, Skin, Emblem, Metal,
# Wood, Leather, Cloth; readable at 30 px). Original procedural geometry, no outside assets.
#   25 on foot, 4 horsemen (Avaria, the Sarmatians, Kanem, Ajuran), the Khoekhoe ox rider and the
#   Tondo lantaka crew on the siege frame.
#   blender -b --factory-startup -P scripts/blender/build_units_gunpowder_signature.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json) and report.json; rest pose only.
import bpy, sys, os, math, json  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_classical_signature as cs  # noqa: E402
import build_units_kingdoms as kd  # noqa: E402
import build_units_kingdoms_signature as ks  # noqa: E402
import build_units_gunpowder as gp  # noqa: E402
# the base unit builders point the output at their own folders: the signature units have their own
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'signature')

IRON = ('4A4A4E', .45, .7)
STEEL = ('A3A6A8', .35, .8)
GOLD = ('D4A84A', .35, .8)
BRASS = ('B8913E', .5, .8)
tunic = cs.tunic


# ---- extra parts ------------------------------------------------------------------------------------

def long_musket(arm):
    gp.musket(arm, bayonet=False, length=.9)


def trade_musket(arm):
    gp.musket(arm, bayonet=False, length=.82)


def slung_musket(arm):
    """A musket slung on the back, muzzle up over the right shoulder."""
    u.tube('SlungMusket', [(.12, .11, .36), (-.08, .12, .70), (-.16, .12, .98)], [(.014, .022), .011, .008], 'Wood', ['Hips', 'Chest', 'Chest'], 4, arm)
    u.tube('SlungBarrel', [(-.04, .115, .66), (-.17, .125, 1.0)], [.006, .006], 'Metal', ['Chest'] * 2, 4, arm)


def jezail(arm):
    """The long Afghan jezail: a very long barrel and a deep curved stock."""
    w = lib.hand(arm)
    u.tube('JezailStock', [(w.x, w.y + .03, w.z - .26), (w.x, w.y + .04, w.z - .16), (w.x, w.y + .008, w.z - .04), (w.x, w.y, w.z + .45)], [(.012, .04), (.014, .04), (.013, .018), (.011, .011)], 'Wood', ['Prop_R'] * 4, 5, arm, attachment=True)
    u.tube('JezailBarrel', [(w.x, w.y - .006, w.z), (w.x, w.y - .006, w.z + .78)], [.007, .006], 'Metal', ['Prop_R'] * 2, 5, arm, attachment=True)


def pistols(arm):
    for k, x in enumerate((-.05, .04)):
        u.tube(f'Pistol{k}', [(x, -.10, .56), (x + .01, -.10, .47), (x + .03, -.07, .43)], [.012, .01, .016], 'Wood', ['Spine', 'Hips', 'Hips'], 4, arm)


def wide_sash(arm, mat='Cloth'):
    lib.ring('WideSash', arm, [.47, .55], [(.108, .08), (.104, .076)], mat, ['Hips', 'Spine'], 8)


def shako(arm, mat='Leather'):
    u.tube('Shako', [(0, 0, .945), (0, .004, 1.0), (0, .008, 1.08), (0, .008, 1.09)], [(.066, .06), (.07, .064), (.074, .068), (.06, .055)], mat, ['Head'] * 4, 8, arm)
    u.box('ShakoPeak', (0, -.07, .945), (.11, .05, .01), mat, 'Head', arm)
    u.box('ShakoPlate', (0, -.072, 1.02), (.04, .01, .04), 'Metal', 'Head', arm)


def flat_bonnet(arm, mat='Team'):
    u.tube('Bonnet', [(0, 0, .95), (0, 0, .985), (0, .01, 1.01), (0, .01, 1.02)], [(.068, .062), (.098, .092), (.09, .086), (.03, .03)], mat, ['Head'] * 4, 10, arm)
    u.box('BonnetBadge', (.06, -.05, .99), (.02, .01, .025), 'Metal', 'Head', arm)


def targe(arm):
    """The Highland targe: a round shield with a boss and a ring of studs."""
    lib.shield(arm, 'round', size=.15)
    cx, cy, cz = lib.SHIELD_AT
    for k in range(6):
        a = 2 * math.pi * k / 6
        u.box(f'Stud{k}', (cx + .09 * math.cos(a), cy - .03, cz + .09 * math.sin(a)), (.016, .01, .016), 'Metal', 'Prop_L', arm, True)


def kris(arm):
    """A wavy-bladed kris, point up, a pistol-grip hilt."""
    w = lib.hand(arm)
    u.tube('KrisHilt', [(w.x, w.y - .01, w.z - .04), (w.x, w.y - .03, w.z + .05)], [.012, .014], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    pts = [(w.x + .012 * math.sin(k * 1.6), w.y - .03, w.z + .06 + k * .045) for k in range(8)]
    u.tube('KrisBlade', pts, [.016, .015, .014, .013, .012, .01, .007, .002], 'Metal', ['Prop_R'] * 8, 4, arm, attachment=True)


def blowgun(arm):
    """A long blowgun with a spear blade at the muzzle, held upright."""
    w = lib.hand(arm)
    u.tube('Blowgun', [(w.x, w.y, .05), (w.x, w.y - .008, 1.45)], [.012, .010], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.tube('BlowgunBlade', [(w.x, w.y - .008, 1.45), (w.x, w.y - .008, 1.55)], [(.006, .02), .001], 'Metal', ['Prop_R'] * 2, 4, arm, attachment=True)


def dart_quiver(arm):
    u.tube('DartQuiver', [(-.12, -.03, .50), (-.13, -.02, .36)], [.022, .026], 'Wood', ['Hips'] * 2, 6, arm)


def leaf_cap(arm, mat='Cloth'):
    lib.cap(arm, mat, peak=1.06, name='LeafCap', r=(.075, .068))
    for k in range(4):
        a = math.pi / 2 * k + .4
        u.box(f'Leaf{k}', (.07 * math.cos(a), .07 * math.sin(a), .97), (.05, .012, .03), mat, 'Head', arm)


def round_cap(arm, mat='Cloth'):
    lib.cap(arm, mat, peak=1.02, name='RoundCap', r=(.07, .064))


def powder_gourd(arm):
    u.tube('PowderGourd', [(.12, -.02, .48), (.13, -.04, .43), (.125, -.05, .38)], [.02, .034, .02], 'Cloth', ['Hips'] * 3, 6, arm)


def embroidered_cap(arm, mat='Cloth'):
    lib.ring('KofiaCap', arm, [.94, 1.0], [(.07, .064), (.07, .064)], mat, ['Head'] * 2, 8)
    u.tube('KofiaTop', [(0, 0, 1.0), (0, 0, 1.005)], [(.07, .064), (.01, .01)], mat, ['Head'] * 2, 8, arm)
    lib.ring('KofiaBand', arm, [.955, .97], [(.072, .066), (.072, .066)], 'Metal', ['Head'] * 2, 8)


def beaded_cap(arm, mat='Cloth'):
    lib.cap(arm, mat, peak=1.02, name='BeadedCap', r=(.072, .066))
    for k in range(5):
        a = math.pi * (k / 4)
        u.box(f'CapBead{k}', (.07 * math.cos(a), -.064 * math.sin(a), .95), (.014, .014, .014), 'Metal', 'Head', arm)


def raffia_kilt(arm, mat='Cloth'):
    tunic(arm, 'Team', low=.40, name='Belt')
    lib.fringe(arm, mat, .44, n=12, length=.12)


def feather_cap(arm, mat='Cloth'):
    lib.cap(arm, 'Leather', peak=1.02, name='SkinCap', r=(.07, .064))
    lib.feathers(arm, mat, n=4, tall=.10, z=1.0)


def big_hide_shield(arm):
    lib.shield(arm, 'oxhide', mat='Emblem')
    cx, cy, cz = lib.SHIELD_AT
    u.box('ShieldLength', (cx, cy - .006, cz), (.24, .006, .36), 'Leather', 'Prop_L', arm, True)  # the long hide behind


def axe_at_belt(arm):
    u.tube('BeltAxeHaft', [(-.10, -.08, .56), (-.12, -.08, .32)], [.01, .01], 'Wood', ['Hips'] * 2, 4, arm)
    u.box('BeltAxeHead', (-.12, -.12, .54), (.016, .07, .06), 'Metal', 'Hips', arm)


def long_battle_axe(arm):
    lib.axe(arm, length=.62)


def bow_on_back(arm):
    u.tube('BackBow', [(.14, .12, .35), (0, .15, .70), (-.14, .12, 1.05)], [.008, .011, .008], 'Wood', ['Hips', 'Chest', 'Chest'], 4, arm)


def lamba(arm, mat='Cloth'):
    """The Malagasy lamba: a white cloth over one shoulder, falling to the knee."""
    lib.cloak(arm, mat, low=.30, name='Lamba')
    u.tube('LambaDrape', [(.12, -.05, .78), (0, -.09, .64), (-.12, -.06, .42)], [(.05, .012)] * 3, mat, ['Chest', 'Spine', 'Hips'], 4, arm)


def cartridge_belt(arm):
    gp.cross_belts(arm, 'Leather')


def poncho(arm, mat='Team'):
    lib.top(arm, mat, name='Poncho')
    lib.ring('PonchoSkirt', arm, [.36, .46, .537], [(.14, .1), (.13, .094), (.11, .08)], mat, ['Hips'] * 3, 8)


def arquebus(arm):
    gp.musket(arm, bayonet=False, length=.72)


def nose_ornament(arm, mat='Metal'):
    u.box('NoseOrnament', (0, -.075, .875), (.04, .008, .02), mat, 'Head', arm)


def feather_crown(arm, mat='Cloth'):
    lib.headband(arm, 'Team', z=.97)
    lib.feathers(arm, mat, n=7, tall=.12, z=.99)


def darts(arm):
    lib.javelins(arm, n=2)


def feather_cloak(arm):
    lib.cloak(arm, 'Leather', low=.28, name='FeatherCloak')
    for k, z in enumerate((.66, .52, .38)):
        u.box(f'FeatherRow{k}', (0, .14 + .02 * k, z), (.30, .01, .03), 'Cloth', 'Chest' if z > .6 else ('Spine' if z > .45 else 'Hips'), arm)


def club_at_hip(arm):
    u.tube('HipClub', [(-.11, -.06, .54), (-.13, -.04, .34), (-.14, -.02, .24)], [.012, .02, .03], 'Wood', ['Hips'] * 3, 5, arm)


def shell_spear(arm):
    lib.spear(arm, top=1.32, mat='Cloth', head=.10)


def plank_armour(arm, mat='Wood'):
    """Haida slat armour: vertical wooden slats laced round the torso."""
    lib.ring('SlatBack', arm, [.46, .76], [(.12, .086), (.13, .082)], 'Leather', ['Spine', 'Chest'], 8)
    for k in range(7):
        x = -.09 + .03 * k
        u.box(f'Slat{k}', (x, -.088, .61), (.024, .012, .30), mat, 'Spine', arm)


def carved_helmet(arm, mat='Wood'):
    """A carved wooden helmet: a domed cap with a beaked crest and painted eyes."""
    lib.cap(arm, mat, peak=1.07, name='CarvedHelm', r=(.075, .07))
    u.tube('HelmBeak', [(0, -.06, 1.04), (0, -.12, 1.03), (0, -.15, 1.0)], [.03, .02, .004], mat, ['Head'] * 3, 5, arm)
    for sx in (-1, 1):
        u.box(f'HelmEye{sx}', (sx * .035, -.07, 1.02), (.022, .01, .014), 'Cloth', 'Head', arm)


def boomerang(arm):
    v = [(-.11, -.10, .48), (-.13, -.10, .42), (-.06, -.10, .38), (.0, -.10, .46), (-.05, -.10, .43)]
    u.mesh_obj('Boomerang', v, [(0, 1, 4), (1, 2, 4), (2, 3, 4), (0, 4, 1), (1, 4, 2), (2, 4, 3)], 'Wood', 'Hips', arm=arm)


def stone_pouch(arm):
    lib.hip_bag(arm, 'Cloth', name='StonePouch')


def woven_kilt(arm):
    tunic(arm, 'Team', low=.34, name='WovenKilt')
    lib.ring('KiltBand', arm, [.50, .52], [(.105, .076), (.105, .076)], 'Wood', ['Hips'] * 2, 8)


def tall_club(arm):
    w = lib.hand(arm)
    u.tube('TallClub', [(w.x, w.y + .02, w.z - .2), (w.x, w.y - .04, w.z + .35), (w.x, w.y - .08, w.z + .62)], [.014, .022, .05], 'Wood', ['Prop_R'] * 3, 6, arm, attachment=True)


def big_feather_headdress(arm, mat='Cloth'):
    lib.headband(arm, 'Team', z=.97)
    lib.feathers(arm, mat, n=9, tall=.16, spread=1.2, z=.99)


def kaross(arm):
    lib.cloak(arm, 'Leather', low=.34, name='Kaross')
    lib.ring('KarossCollar', arm, [.75, .79], [(.12, .08), (.11, .075)], 'Leather', ['Chest'] * 2, 8)


def wings(arm):
    """The winged hussar's wings: two tall wooden arcs on the back, a row of feathers on each."""
    for sx in (-1, 1):
        pts = [(sx * .07, .12, .50), (sx * .09, .16, .90), (sx * .06, .14, 1.25), (sx * .0, .08, 1.42)]
        u.tube(f'WingBar{sx}', pts, [.012, .012, .01, .006], 'Wood', ['Chest'] * 4, 4, arm)
        for k in range(7):  # the feathers along the bar, each touching it
            t = k / 6
            seg = min(2, int(t * 3)); f = t * 3 - seg
            (x0, y0, z0), (x1, y1, z1) = pts[seg], pts[seg + 1]
            x, y, z = x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, z0 + (z1 - z0) * f
            u.box(f'WingFeather{sx}{k}', (x + sx * .035, y + .006, z - .02), (.06, .012, .13), 'Cloth', 'Chest', arm)


def leopard_cloak(arm):
    lib.cloak(arm, 'Cloth', low=.36, name='LeopardSkin')
    for k, (x, z) in enumerate(((-.08, .62), (.07, .55), (-.02, .46), (.1, .68), (-.11, .5))):
        u.box(f'LeopardSpot{k}', (x, .17, z), (.025, .006, .022), 'Wood', 'Chest' if z > .6 else 'Spine', arm)


def pelisse(arm):
    """A hussar's pelisse slung over the left shoulder, fur-edged."""
    u.tube('Pelisse', [(.10, .02, .78), (.13, .06, .64), (.14, .07, .52)], [(.06, .05), (.07, .05), (.065, .045)], 'Team', ['Chest', 'Chest', 'Spine'], 6, arm)
    u.tube('PelisseFur', [(.10, .02, .80), (.14, .07, .51)], [.02, .02], 'Leather', ['Chest', 'Spine'], 4, arm)


def braided_jacket(arm):
    gp.short_jacket(arm, 'Team')
    for k, z in enumerate((.58, .64, .70)):
        u.box(f'Braid{k}', (0, -.086, z), (.12, .008, .01), 'Cloth', 'Spine' if z < .62 else 'Chest', arm)


def lance_long(arm):
    lib.spear(arm, top=1.95, low=.30, head=.10)


def lance_mid(arm):
    lib.spear(arm, top=1.7, low=.30)


# ---- the roster -------------------------------------------------------------------------------------

def C(skin, **k):
    return dict({'Skin': skin}, **k)


FOOT = {
    'odrysia': dict(name='Haiduk musketeers', role='ranged', colors=C('C99472', Cloth='B8402E', Leather='4A3426', Metal=IRON, Wood='5A3E28'), covered='top',
                    parts=[gp.short_jacket, (wide_sash, 'Cloth'), (lib.trousers, 'Leather'), gp.boots, (cs.fur_cap, 'Leather'), pistols, long_musket],
                    look='sash, short jacket, fur cap, long musket, pistols in the sash'),
    'celtiberia': dict(name='Spanish guerrilleros', role='ranged', colors=C('C99472', Cloth='4E3A2A', Leather='5E4030', Metal=IRON, Wood='5A3E28'), covered='top',
                       parts=[gp.short_jacket, (lib.cloak, 'Cloth', {'low': .34}), (wide_sash, 'Leather'), (lib.trousers, 'Leather'), gp.boots, (cs.brim_hat, 'Cloth', {'r': .13}), long_musket],
                       look='brown cloak, sash, broad hat, flintlock'),
    'lusitania': dict(name='Portuguese cacadores', role='ranged', colors=C('C99472', Cloth='2A2420', Leather='2A2420', Metal=IRON, Wood='5A3E28'), covered='top',
                      parts=[gp.short_jacket, (gp.cross_belts, 'Leather'), (lib.trousers, 'Cloth'), gp.boots, shako, gp.rifle_ready],
                      look='Team jacket, shako, Baker rifle at the ready, black belts and pouch'),
    'ulaid': dict(name='United Irishmen pikemen (1798)', role='infantry', colors=C('D9AE88', Cloth='4E9A5A', Leather='3A2E26', Metal=IRON, Wood='6A4A30'), covered='top',
                  parts=[(gp.long_coat, 'Team', {'low': .30}), (lib.trousers, 'Leather'), gp.boots, gp.round_hat, kd.pike],
                  look='frieze coat, round hat with a green cockade, long pike'),
    'fortriu': dict(name='Highland broadsword clansmen', role='infantry', colors=C('D9AE88', Cloth='E2D8C0', Leather='5E4030', Metal=STEEL, Wood='5A3E28'), covered='top',
                    parts=[(tunic, 'Team', {'low': .34, 'name': 'BeltedPlaid'}), (lib.top, 'Cloth', {'name': 'Shirt'}), (lib.cloak, 'Team', {'low': .36, 'name': 'Plaid'}), (lib.belt, 'Leather', .50), flat_bonnet, targe, (lib.sword, {'length': .52})],
                    look='belted tartan plaid, targe, broadsword, flat bonnet'),
    'geats': dict(name='Carolean pike-and-shot infantry', role='infantry', colors=C('D9AE88', Cloth='D9B870', Leather='2A2420', Metal=IRON, Wood='6A4A30'), covered='top',
                  parts=[gp.long_coat, (gp.cross_belts, 'Leather'), gp.breeches_gaiters, gp.tricorne, gp.scabbard, kd.pike],
                  look='Team coat with yellow cuffs, tricorne, pike, short sword'),
    'gandhara': dict(name='Pashtun jezail riflemen', role='ranged', colors=C('C48A62', Cloth='E8E2D2', Leather='5E4030', Metal=IRON, Wood='6A4A30'), covered='top',
                     parts=[(gp.long_coat, 'Team', {'low': .22, 'turnbacks': 'Team'}), (lib.trousers, 'Cloth'), (cs.turban, 'Cloth'), (lib.belt, 'Leather', .52), (lib.belt_dagger, 'Metal', {'at': (-.09, -.08, .50)}), jezail],
                     look='turban, long coat, long jezail, curved knife'),
    'medang': dict(name='Mataram kris infantry', role='infantry', colors=C('A06A48', Cloth='8A5A2A', Metal=IRON, Wood='5A3E28'), covered='hips',
                   parts=[ks.sarong, (lib.headcloth, 'Cloth'), slung_musket, (lib.shield, 'round', {'size': .12}), kris],
                   look='batik sarong, wavy-bladed kris, small round shield, matchlock slung on the back'),
    'kutai': dict(name='Kutai sumpitan skirmishers', role='ranged', colors=C('A06A48', Cloth='5E7A3A', Leather='8A6A48', Metal=IRON, Wood='6A4A30'), covered='hips',
                  parts=[(tunic, 'Leather', {'low': .38, 'name': 'BarkCloth'}), leaf_cap, dart_quiver, blowgun],
                  look='bark cloth, blowgun with a spear tip, dart quiver, leaf cap'),
    'bono': dict(name='Akan musketeers', role='ranged', colors=C('6A4430', Cloth='C9A24A', Metal=GOLD, Wood='5A3E28'), covered='hips',
                 parts=[(tunic, 'Team', {'low': .30, 'name': 'Wrapper'}), (lib.armlets, 'Metal'), round_cap, powder_gourd, trade_musket],
                 look='wrapper cloth, gold-wire armlets, long trade musket, powder gourd, round cap'),
    'kilwa': dict(name='Kilwa mainland archers (1505)', role='ranged', colors=C('6A4430', Cloth='E8E2D2', Leather='6E4A30', Metal=IRON, Wood='6A4A30'), covered='hips',
                  parts=[(tunic, 'Team', {'low': .30, 'name': 'Kikoi'}), embroidered_cap, cs.sabre, lib.quiver, lib.bow],
                  look='kikoi wrapper, embroidered cap, bow and quiver, curved sword'),
    'luba': dict(name='Luba bow-and-shield warriors (improvised)', role='ranged', colors=C('6A4430', Cloth='C9A66B', Leather='8A6A48', Metal=IRON, Wood='5A3E28'), covered='hips',
                 parts=[(tunic, 'Team', {'low': .34, 'name': 'Wrapper'}), beaded_cap, big_hide_shield, trade_musket],
                 look='beaded cap, wrapper, trade musket, large hide shield'),
    'lunda': dict(name='Lunda musket-and-axe warriors (improvised)', role='infantry', colors=C('6A4430', Cloth='C9B070', Leather='6E4A30', Metal=IRON, Wood='5A3E28'), covered='hips',
                  parts=[raffia_kilt, feather_cap, slung_musket, lib.axe],
                  look='raffia kilt, battle axe, trade musket slung, feather cap'),
    'ndongo': dict(name='Ndongo musket-and-axe guard', role='ranged', colors=C('6A4430', Cloth='C9B070', Leather='6E4A30', Metal=IRON, Wood='5A3E28'), covered='hips',
                   parts=[raffia_kilt, (lib.headband, 'Team'), lib.hair, axe_at_belt, trade_musket],
                   look="raffia kilt, curved axe at the belt, trade musket, headband (Queen Njinga's guard)"),
    'mutapa': dict(name='Mutapa battle-axe and shield warriors', role='infantry', colors=C('6A4430', Cloth='C9A66B', Leather='8A6A48', Metal=IRON, Wood='5A3E28'), covered='hips',
                   parts=[(tunic, 'Team', {'low': .32, 'name': 'Wrapper'}), lib.hair, bow_on_back, (cl.oval_shield, {'rx': .14, 'rz': .24}), long_battle_axe],
                   look='wrapper, long battle axe, oval shield, bow on the back'),
    'merina': dict(name='Merina musket highlanders', role='ranged', colors=C('A06A48', Cloth='EFEAE0', Leather='5E4030', Metal=IRON, Wood='6A4A30'), covered='top',
                   parts=[(tunic, 'Team', {'low': .34}), (lib.top, 'Team'), lamba, cartridge_belt, (cs.brim_hat, 'Wood', {'r': .12}), trade_musket],
                   look='lamba cloak, flintlock musket, cartridge belts, straw hat'),
    'diaguita': dict(name='Calchaqui valley warriors', role='ranged', colors=C('A8724E', Cloth='E8D9B0', Leather='8A6A48', Metal=IRON, Wood='5A3E28'), covered='top',
                     parts=[poncho, (lib.headband, 'Team'), (lib.single_feather, 'Cloth'), lib.hair, bow_on_back, arquebus],
                     look='poncho tunic, a bow on the back, feathered headband, captured arquebus'),
    'muisca': dict(name='Muisca gold-adorned spearmen', role='infantry', colors=C('A8724E', Cloth='E8DCC0', Metal=GOLD, Wood='5A3E28'), covered='top',
                   parts=[(tunic, 'Team', {'low': .34}), (lib.cloak, 'Cloth', {'low': .36}), nose_ornament, feather_crown, (lib.armlets, 'Metal'), (lib.spear, {'top': 1.30}), (lib.javelins, {'n': 2})],
                   look='gold nose ornament, cotton cloak, spear and darts, feather crown'),
    'tupinamba': dict(name='Tupinamba feather-cloak archers', role='ranged', colors=C('A8724E', Cloth='C8382A', Leather='A83A2A', Wood='5A3E28'), covered='hips',
                      parts=[(tunic, 'Team', {'low': .42, 'name': 'Loincloth'}), feather_cloak, (lib.feathers, 'Cloth', {'n': 5, 'tall': .09}), club_at_hip, kd.longbow],
                      look='red feather cloak, long bow, war club'),
    'jaragua': dict(name='Taino cotton-armour spearmen (improvised)', role='infantry', colors=C('A8724E', Cloth='EFE6D0', Wood='5A3E28', Metal=('6A6A70', .3, .3)), covered='hips',
                    parts=[(tunic, 'Team', {'low': .40, 'name': 'Naguas'}), (lib.belt, 'Cloth', .52), feather_crown, club_at_hip, (lib.spear, {'top': 1.30})],
                    look="cotton belt, feather headband, spear, wooden club (Anacaona's warriors)"),
    'kalinago': dict(name='Kalinago canoe raiders', role='infantry', colors=C('A8724E', Leather='A04A2A', Cloth='3A9A5A', Wood='5A3E28'), covered='hips',
                     parts=[(tunic, 'Team', {'low': .42, 'name': 'Loincloth'}), ks.body_paint, feather_crown, (lib.armlets, 'Cloth'), bow_on_back, lib.club],
                     look='body paint, club, bow, feather crown, parrot-feather armlets'),
    'calusa': dict(name='Calusa shell-spear warriors', role='infantry', colors=C('A8724E', Cloth='EFE6D0', Wood='5A3E28', Metal=IRON), covered='hips',
                   parts=[(tunic, 'Team', {'low': .40, 'name': 'ClothKilt'}), (lib.headband, 'Team'), (lib.single_feather, 'Cloth'), lib.hair, (lib.quiver, {'hip': True}), cs.atlatl],
                   look='cloth kilt, shell-tipped darts and an atlatl, feather headband'),
    'haida': dict(name='Haida plank-armour musketeers', role='ranged', colors=C('B07A58', Wood='8A6A40', Cloth='C8382A', Leather='2A2420', Metal=IRON), covered='top',
                  parts=[(tunic, 'Team', {'low': .36}), plank_armour, carved_helmet, (lib.shield, 'rect'), trade_musket],
                  look='plank armour, carved helmet, trade musket, wooden shield'),
    'gunditjmara': dict(name='Gunditjmara spear-and-boomerang men', role='ranged', colors=C('6A4430', Leather='6A5A44', Wood='7A5A3A', Metal=('6A6A70', .3, .3)), covered='hips',
                        parts=[(tunic, 'Team', {'low': .44, 'name': 'Belt'}), (lib.cloak, 'Leather', {'low': .40, 'name': 'PossumCloak'}), lib.hair, (lib.beard, 'Wood'), boomerang, cs.atlatl],
                        look='possum-fur cloak, spear and spear-thrower, a boomerang at the belt'),
    'latte-chiefs': dict(name='Latte chief slingers', role='ranged', colors=C('8A573A', Cloth='C9B48A', Wood='6A4A30'), covered='hips',
                         parts=[woven_kilt, lib.hair, (lib.hair_knot, 'Wood'), stone_pouch, lib.sling],
                         look='woven kilt, stone sling, a pouch of polished sling stones'),
    'bau': dict(name='Bau war-club warriors', role='infantry', colors=C('6A4430', Cloth='E8DCC0', Wood='4A3426', Metal=IRON), covered='hips',
                parts=[(tunic, 'Team', {'low': .36, 'name': 'TapaKilt'}), big_feather_headdress, slung_musket, tall_club],
                look='Fijian: tapa kilt, tall war club, trade musket slung, feather headdress'),
}

HORSE = {
    'avaria': dict(name='Hungarian hussars', colors=C('C99472', Cloth='D9B870', Leather='3A2A20', Metal=IRON, Wood='5A3E28'),
                   dress=[braided_jacket, pelisse, (lib.trousers, 'Team'), gp.boots, (cs.fur_cap, 'Leather'), gp.carbine_slung], arms=[gp.sabre],
                   horse=dict(cloth='Team'), look='braided jacket with a pelisse, fur kalpak, sabre and carbine, horse in a saddle cloth'),
    'sarmatians': dict(name='Winged hussars', colors=C('C99472', Cloth='E8E2D2', Leather='8A3A2A', Metal=STEEL, Wood='5A3E28'),
                       dress=[(tunic, 'Team', {'low': .38}), (lib.top, 'Team'), cs.breastplate, (lib.cap, 'Metal', {'peak': 1.07, 'name': 'Szyszak'}), gp.boots, leopard_cloak, wings], arms=[lance_long],
                       horse=dict(cloth='Team'), look='steel breastplate, wooden wings on the back, long lance, leopard-skin cloak'),
    'kanem': dict(name='Bornu mailed horsemen', colors=C('6A4430', Cloth='E8E2D2', Leather='6E4A30', Metal=IRON, Wood='5A3E28'),
                  dress=[(tunic, 'Team', {'low': .36}), kd.mail, (cs.turban, 'Cloth'), gp.carbine_slung], arms=[lance_mid],
                  horse=dict(cloth='Team', caparison=True), look='quilted horse cloth, mail shirt, turban, lance and carbine'),
    'ajuran': dict(name='Ajuran matchlock horsemen', colors=C('8A573A', Cloth='EFEAE0', Leather='6E4A30', Metal=IRON, Wood='5A3E28'),
                   dress=[(tunic, 'Team', {'low': .36}), (lib.top, 'Cloth', {'name': 'CottonTunic'}), (cs.turban, 'Cloth'), slung_musket], arms=[lance_mid],
                   horse=dict(cloth='Team'), look='cotton tunic, turban, matchlock slung and a lance, horse in cloth'),
}


def build_khoekhoe(model):
    ox, _ = tm.ox('Mount', coat='Leather', dark='Wood', horn='Cloth')
    s = u.MOUNTS['ox']['seat']
    u.box('HideSaddle', (0, s[1], s[2] - .07), (.34, .34, .06), 'Wood', 'Mount_Spine', ox)
    u.tube('Halter', [(.05, -.58, .74), (0, -.40, .74), (0, -.15, s[2] + .06)], [.008] * 3, 'Wood', ['Mount_Head', 'Mount_Neck', 'Mount_Spine'], 3, ox)
    r = cl.rider([(tunic, 'Team', {'low': .40, 'name': 'Loincloth'}), kaross, lib.hair], [(lib.spear, {'top': 1.6, 'low': .30})], at=cl.seat_offset('ox'))
    return [ox, r]


KHOEKHOE = dict(name='Khoekhoe ox riders', colors=C('8A573A', Leather='7A5A3A', Wood='4A3426', Cloth='E8DCC0', Metal=IRON),
                look='skin kaross cloak, spear, the rider seated on a war ox with a hide saddle')


def lantaka(info, mat='Wood', bronze='Metal'):
    """A lantaka: a bronze swivel gun on a yoke atop a post set in the frame's wooden rest."""
    rig = info['rig']; z = info['deck']
    u.tube('RestPost', [(0, -.05, z), (0, -.05, z + .32)], [.05, .045], mat, ['Hull'] * 2, 6, rig)
    u.box('Yoke', (0, -.05, z + .36), (.16, .04, .05), 'Leather', 'Hull', rig)
    zg = z + .42
    u.tube('LantakaBarrel', [(0, .32, zg), (0, .28, zg), (0, .12, zg), (0, -.30, zg + .01), (0, -.52, zg + .02), (0, -.55, zg + .02)], [.02, .05, .045, .035, .032, .04], bronze, ['Hull'] * 6, 8, rig)
    u.tube('LantakaTiller', [(0, .32, zg), (0, .52, zg - .04)], [.012, .01], mat, ['Hull'] * 2, 4, rig)
    for k in range(3):  # a few balls by the rest
        u.tube(f'Ball{k}', [(.18 + .05 * k, .25, .02), (.18 + .05 * k, .25, .07)], [.025, .025], 'Leather', ['Hull'] * 2, 6, rig)


def build_tondo(model):
    parts, info = tm.frame('Frame', wheels=False, deck_z=.24, length=.9, width=.44)
    lantaka(info)
    for i, (x, y, z, yaw) in enumerate(info['crew']):
        c, _ = u.crew(f'Crew{i}', (x, y, z), lite=True, head='headcloth', yaw=yaw)
        cl.tunic(c, 'Team', low=.22, name=f'Crew{i}Sarong')
        u.tube(f'Crew{i}Gourd', [(.12, -.02, .48), (.13, -.04, .43), (.125, -.05, .38)], [.02, .034, .02], 'Cloth', ['Hips'] * 3, 6, c)
        parts.append(c)
    return parts


TONDO = dict(name='Tondo lantaka gun crews', colors=C('8A573A', Cloth='C9A66B', Leather='2E2A28', Metal=('A8823C', .55, .75), Wood='6E5236'),
             look='a bronze lantaka swivel gun on a wooden rest, three crew in sarongs with powder gourds')


def build(model):
    lib.reset()
    if model in FOOT:
        spec = FOOT[model]
        arm = lib.person(spec)
        lib.finish(model, [arm], spec['colors'], {'name': spec['name'], 'role': spec['role'], 'look': spec['look'], 'rig': 'person'}, lib.PERSON_BUDGET, False)
        return
    if model == 'khoekhoe':
        spec = KHOEKHOE; parts = build_khoekhoe(model); rig = 'ox'; role = 'cavalry'; budget = 3000; mounted = True
    elif model == 'tondo':
        spec = TONDO; parts = build_tondo(model); rig = 'frame'; role = 'siege'; budget = 3200; mounted = False
    else:
        spec = HORSE[model]; parts = cs.build_horseman(model, spec); rig = 'horse'; role = 'cavalry'; budget = 3000; mounted = True
    lib.finish(model, parts, spec['colors'], {'name': spec['name'], 'role': role, 'rig': rig, 'look': spec['look']}, budget, mounted)


ALL = list(FOOT) + list(HORSE) + ['khoekhoe', 'tondo']
if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or ALL
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
