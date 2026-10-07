# scripts/blender/build_units_kingdoms_signature.py
# The 36 Kingdoms signature units of plans/ART-MODELS-PLAN.md 4.5 (one per people whose peak is the
# Kingdoms age), on the person rig, the horse, the elephant and the ox (ti_units.py, ti_mounts.py),
# with the part libraries of build_units_bronze_signature.py, build_units_classical.py,
# build_units_classical_signature.py and build_units_kingdoms.py, in the base units' look (faceted,
# flat colours: Team, Skin, Emblem, Metal, Wood, Leather, Cloth; readable at 30 px). Original
# procedural geometry, no outside assets.
#   24 on foot (Kitara's cattle guard with a long-horned ox beside him), 9 horsemen, 2 war elephants
#   (Kamarupa, Champa).
#   blender -b --factory-startup -P scripts/blender/build_units_kingdoms_signature.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json) and report.json; rest pose only.
import bpy, sys, os, math, json  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_classical_signature as cs  # noqa: E402
import build_units_kingdoms as kd  # noqa: E402
# build_units_kingdoms points the output at the base units' folder: the signature units have their own
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'signature')

IRON = ('8E8A84', .45, .7)
STEEL = ('A3A6A8', .35, .8)
GOLD = ('D4A84A', .35, .8)
BRONZE = ('C2995A', .4, .6)
tunic = cs.tunic


# ---- extra parts ------------------------------------------------------------------------------------

def lamellar(arm, mat='Metal', name='Lamellar'):
    lib.top(arm, mat, name=name)
    for k, z in enumerate((.58, .64, .70)):
        lib.ring(f'{name}Row{k}', arm, [z - .008, z + .008], [(.103, .074), (.105, .075)], 'Leather', ['Spine' if z < .62 else 'Chest'] * 2, 8)


def plumed_cap(arm, mat='Cloth', plume='Team'):
    lib.cap(arm, mat, peak=1.06, name='PlumedCap', r=(.07, .063))
    u.tube('Plume', [(0, .01, 1.05), (0, .03, 1.13), (0, .07, 1.17)], [.012, .016, .004], plume, ['Head'] * 3, 4, arm)


def steel_cap(arm, mat='Metal'):
    lib.cap(arm, mat, peak=1.07, name='SteelCap', r=(.07, .064))


def pointed_helm(arm, mat='Metal'):
    lib.cap(arm, mat, peak=1.10, name='PointedHelm', low=.92, r=(.072, .066))
    lib.cheek_flaps(arm, mat)


def braids(arm, mat='Wood'):
    lib.hair(arm, mat)
    for s in (-1, 1):
        u.tube(f'Braid{s}', [(s * .05, .04, .94), (s * .06, .06, .82), (s * .055, .06, .72)], [.014, .012, .008], mat, ['Head', 'Chest', 'Chest'], 4, arm)


def back_pennant(arm, mat='Team'):
    u.tube('PennantPole', [(.06, .09, .55), (.06, .10, 1.32)], [.008, .007], 'Wood', ['Chest'] * 2, 4, arm)
    u.mesh_obj('Pennant', [(.06, .10, 1.30), (.06, .30, 1.25), (.06, .10, 1.18)], [(0, 1, 2), (0, 2, 1)], mat, 'Chest', arm=arm)


def caftan(arm, mat='Team'):
    cl.tunic(arm, mat, low=.30, name='Caftan')
    lib.top(arm, mat, name='CaftanTop')


def jade_boss(arm):
    cx, cy, cz = lib.SHIELD_AT
    u.tube('JadeBoss', [(cx, cy - .022, cz), (cx, cy - .05, cz)], [.045, .015], 'Cloth', ['Prop_L'] * 2, 6, arm, attachment=True)


def fur_trim(arm, mat='Leather'):
    lib.ring('FurHem', arm, [.36, .40], [(.14, .10), (.135, .098)], mat, ['Hips'] * 2, 8)
    lib.ring('FurCollar', arm, [.76, .80], [(.12, .08), (.10, .07)], mat, ['Chest'] * 2, 8)


def felt_hat(arm, mat='Cloth'):
    cs.brim_hat(arm, mat, r=.11, crown=1.06, name='FeltHat')


def fish_banner(arm):
    """A small Team banner on a pole at the back (the Pandyan fish banner, drawn as the side's colour)."""
    u.tube('BannerPole', [(-.06, .10, .5), (-.06, .11, 1.40)], [.008, .007], 'Wood', ['Chest'] * 2, 4, arm)
    u.mesh_obj('FishBanner', [(-.06, .11, 1.38), (-.06, .33, 1.33), (-.06, .30, 1.27), (-.06, .33, 1.21), (-.06, .11, 1.25)],
               [(0, 1, 2), (0, 2, 4), (2, 3, 4), (0, 2, 1), (0, 4, 2), (2, 4, 3)], 'Team', 'Chest', arm=arm)


def bamboo_back(arm):
    u.box('BambooShield', (0, .14, .66), (.24, .02, .34), 'Wood', 'Chest', arm)
    for k in range(4):
        u.box(f'BambooRib{k}', (-.09 + .06 * k, .152, .66), (.012, .01, .34), 'Leather', 'Chest', arm)


def sarong(arm, mat='Team'):
    cl.tunic(arm, mat, low=.22, name='Sarong')


def beaded_crown(arm, mat='Cloth'):
    u.tube('BeadedCrown', [(0, 0, .95), (0, 0, 1.0), (0, 0, 1.06), (0, 0, 1.10)], [(.07, .064), (.068, .062), (.05, .046), (.02, .02)], mat, ['Head'] * 4, 8, arm)
    for k in range(5):
        a = math.pi * (k / 4)
        u.box(f'BeadStrand{k}', (.068 * math.cos(a), -.062 * math.sin(a), .91), (.008, .008, .07), mat, 'Head', arm)


def bangles(arm, mat='Metal'):
    lib.armlets(arm, mat, wrists=True)


def shell_necklace(arm, mat='Cloth'):
    lib.ring('ShellNecklace', arm, [.775, .79], [(.075, .06), (.07, .056)], mat, ['Chest'] * 2, 8)
    for k in range(5):
        a = math.pi * (.2 + .15 * k)
        u.box(f'Shell{k}', (.07 * math.cos(a), -.06 * math.sin(a) - .012, .75), (.018, .01, .02), mat, 'Chest', arm)


def big_headdress(arm, mat='Cloth'):
    """A Moche warrior-priest headdress: a tall half-moon crest over a band."""
    lib.headband(arm, 'Team', z=.97)
    u.mesh_obj('Crescent', [(-.10, -.02, 1.0), (0, -.02, 1.22), (.10, -.02, 1.0), (0, -.02, 1.08)], [(0, 1, 3), (3, 1, 2), (0, 3, 1), (3, 2, 1)], mat, 'Head', arm=arm)


def stepped_headdress(arm, mat='Cloth'):
    for k, (w, z) in enumerate(((.15, .97), (.11, 1.02), (.07, 1.07))):
        u.box(f'Step{k}', (0, 0, z), (w, .12, .05), mat, 'Head', arm)


def chequered(arm):
    for k, (x, z) in enumerate(((-.05, .62), (.05, .56), (-.05, .50), (.05, .68))):
        u.box(f'Cheq{k}', (x, -.085, z), (.05, .006, .05), 'Cloth', 'Spine' if z < .62 else 'Chest', arm)


def backrack(arm, mat='Cloth'):
    """A Maya feather backrack: a fan of long plumes rising behind the shoulders."""
    for k in range(7):
        a = math.radians(-60 + 20 * k)
        u.box(f'Plume{k}', (.18 * math.sin(a), .12, .95 + .16 * math.cos(a)), (.03, .012, .30), mat, 'Chest', arm)


def jaguar_kilt(arm):
    cl.tunic(arm, 'Leather', low=.40, name='JaguarKilt')
    for k, (x, z) in enumerate(((-.07, .46), (.06, .44), (0, .41), (-.1, .42), (.1, .47))):
        u.box(f'Rosette{k}', (x, -.1, z), (.022, .006, .02), 'Wood', 'Hips', arm)


def mace_star(arm):
    lib.mace(arm, length=.44)
    w = lib.hand(arm)
    for k in range(4):
        a = math.pi / 2 * k
        u.box(f'MaceSpike{k}', (w.x + .04 * math.cos(a), w.y - .04 * math.sin(a), w.z + .44), (.02, .02, .02), 'Metal', 'Prop_R', arm, True)


def fibre_armour(arm):
    lib.top(arm, 'Wood', name='FibreArmour')
    lib.ring('FibreBand', arm, [.60, .64], [(.11, .078), (.112, .079)], 'Cloth', ['Spine'] * 2, 8)


def body_paint(arm):
    lib.tattoo_bands(arm, 'Leather')


# ---- the roster ------------------------------------------------------------------------------------

def sp(parts, **k):
    return dict(parts=parts, **k)


FOOT = {
    'khotan': dict(name='Khotan oasis garrison spearmen (improvised)', role='infantry', colors={'Skin': 'D2A47E', 'Cloth': '6FA58A', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': '5A4130'}, covered='top',
                   parts=[(kd.gambeson, 'Team', {'name': 'QuiltedCoat'}), (lib.cap, 'Metal', {'peak': 1.04, 'name': 'RoundHelm'}), (lib.spear, {'top': 1.35}), (lib.shield, 'round', {'size': .16}), jade_boss, lib.sandals],
                   look='quilted coat, round helmet, spear, round shield with a jade-coloured boss'),
    'zhangzhung': dict(name='Zhangzhung highland spearmen (improvised)', role='infantry', colors={'Skin': 'C48A62', 'Cloth': 'B8A27A', 'Leather': '5E4030', 'Wood': '5A4130', 'Metal': IRON}, covered='top',
                       parts=[(kd.gambeson, 'Team', {'name': 'Coat', 'low': .34}), fur_trim, felt_hat, (lib.spear, {'top': 1.35}), (lib.shield, 'round', {'size': .17, 'mat': 'Emblem'}), lib.sandals],
                       look='fur-trimmed coat, spear, round yak-hide shield, felt hat'),
    'pandya': dict(name='Pandyan swordsmen (improvised)', role='infantry', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Metal': IRON, 'Wood': '5A4130'}, covered='hips',
                   parts=[(tunic, 'Team', {'low': .30, 'name': 'WaistCloth'}), (cs.turban, 'Cloth'), (lib.sword, {'length': .40}), (lib.shield, 'round', {'size': .14}), fish_banner],
                   look='waist-cloth, turban, sword and round shield, a fish banner on the back'),
    'rajarata': dict(name='Rajaratan spearmen (improvised)', role='infantry', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Metal': IRON, 'Wood': '5A4130'}, covered='hips',
                     parts=[(tunic, 'Team', {'low': .30, 'name': 'Dhoti'}), (lib.headcloth, 'Cloth'), (lib.spear, {'top': 1.30}), (lib.shield, 'rect')],
                     look='short dhoti, headcloth, spear and square shield'),
    'vanga': dict(name='Vangan delta boat archers (improvised)', role='ranged', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Wood': '8A7040', 'Leather': '6E4A30'}, covered='hips',
                  parts=[(tunic, 'Team', {'low': .28, 'name': 'Dhoti'}), (cs.turban, 'Cloth'), lib.bow, (lib.quiver, {'hip': True}), bamboo_back],
                  look='dhoti, turban, bow, quiver, a bamboo shield on the back'),
    'funan': dict(name='Funan marine archers (improvised)', role='ranged', colors={'Skin': 'A06A48', 'Cloth': 'D9C7A0', 'Wood': '6A4A30', 'Metal': IRON}, covered='hips',
                  parts=[sarong, (lib.hair_knot, 'Wood'), lib.hair, kd.longbow, lib.quiver, lib.belt_dagger],
                  look='sarong, topknot, long bow, short sword'),
    'pyu': dict(name='Pyu city-guard spearmen (improvised)', role='infantry', colors={'Skin': 'A06A48', 'Cloth': 'E6DDC5', 'Wood': '8A6A40', 'Metal': IRON}, covered='hips',
                parts=[sarong, (cs.turban, 'Cloth'), (lib.spear, {'top': 1.30}), (lib.shield, 'oxhide', {'mat': 'Emblem'})],
                look='wrapped sarong, turban, spear, wicker shield'),
    'dvaravati': dict(name='Dvaravati sword-and-spear infantry', role='infantry', colors={'Skin': 'A06A48', 'Cloth': 'E6DDC5', 'Metal': IRON, 'Wood': '5A4130'}, covered='hips',
                      parts=[(tunic, 'Team', {'low': .30, 'name': 'Dhoti'}), (lib.cap, 'Cloth', {'peak': 1.03, 'name': 'ClothCap'}), (lib.sword, {'length': .40}), (lib.shield, 'round', {'size': .12})],
                      look='dhoti, cloth cap, straight sword, small round shield'),
    'srivijaya': dict(name='Srivijayan orang laut sea warriors', role='infantry', colors={'Skin': '8A573A', 'Cloth': 'D9C7A0', 'Metal': IRON, 'Wood': '5A4130'}, covered='hips',
                      parts=[sarong, (lib.headcloth, 'Cloth'), (lib.spear, {'top': 1.30}), (lib.belt_dagger, 'Metal', {'at': (-.07, -.085, .40)})],
                      look='sarong, bare chest, spear and short sword, headcloth'),
    'tarumanagara': dict(name='Tarumanagara spear warriors (improvised)', role='infantry', colors={'Skin': '8A573A', 'Cloth': 'C9A66B', 'Wood': '5A4130', 'Metal': IRON}, covered='hips',
                         parts=[sarong, (lib.top, 'Cloth', {'name': 'BatikCloth'}), (lib.headcloth, 'Cloth'), (lib.spear, {'top': 1.30}), (lib.shield, 'round', {'size': .14})],
                         look='batik cloth, spear, round shield, headcloth'),
    'butuan': dict(name='Butuan gold-ornament swordsmen', role='infantry', colors={'Skin': '8A573A', 'Cloth': 'D9C7A0', 'Metal': GOLD, 'Wood': '6A4A30'}, covered='hips',
                   parts=[sarong, (lib.headcloth, 'Cloth'), (bangles, 'Metal'), (lib.armlets, 'Metal'), cs.long_sword, (lib.shield, 'rect')],
                   look='gold bands, kampilan sword, wooden shield, wrapped hair'),
    'djenne-djeno': dict(name='Djenne-Djeno spearmen (improvised)', role='infantry', colors={'Skin': '6A4430', 'Cloth': 'E6DDC5', 'Wood': '8A6A40', 'Metal': IRON}, covered='top',
                         parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Cloth', {'name': 'CottonTunic'}), lib.hair, (lib.spear, {'top': 1.30}), (lib.shield, 'oxhide', {'mat': 'Emblem'})],
                         look='cotton tunic, spear, mud-coloured wicker shield'),
    'ife': dict(name='Ife beaded-crown spearmen (improvised)', role='infantry', colors={'Skin': '6A4430', 'Cloth': 'D9B870', 'Leather': '8A6A40', 'Metal': IRON, 'Wood': '5A4130'}, covered='hips',
                parts=[(tunic, 'Team', {'low': .36, 'name': 'Wrapper'}), beaded_crown, (lib.spear, {'top': 1.30}), (lib.shield, 'round', {'size': .15})],
                look='beaded crown, short wrapper, spear, round hide shield'),
    'engaruka': dict(name='Engaruka terrace spearmen (improvised)', role='infantry', colors={'Skin': '6A4430', 'Leather': '8A6A40', 'Wood': '5A4130', 'Metal': IRON}, covered='top',
                     parts=[(tunic, 'Team', {'low': .38}), (lib.cloak, 'Leather', {'low': .40}), lib.hair, (lib.spear, {'top': 1.30}), (lib.shield, 'oxhide')],
                     look='stone-terrace farmers: spear, hide shield, cloak'),
    'mapungubwe': dict(name='Mapungubwe gold-rhino archers (improvised)', role='ranged', colors={'Skin': '6A4430', 'Leather': '8A6A40', 'Metal': GOLD, 'Wood': '5A4130'}, covered='hips',
                       parts=[(tunic, 'Team', {'low': .40, 'name': 'Loincloth'}), (bangles, 'Metal'), lib.hair, lib.bow, lib.quiver],
                       look='loincloth, gold bangles, bow, quiver'),
    'san': dict(name='San poison-arrow hunters', role='ranged', colors={'Skin': 'A8724E', 'Leather': '9A7650', 'Cloth': 'EFE6D0', 'Wood': '6A4A30'}, covered='hips',
                parts=[(tunic, 'Team', {'low': .42, 'name': 'Loincloth'}), shell_necklace, lib.hair, (lib.bow, {'height': .52, 'recurve': .03}), (lib.quiver, {'hip': True})],
                look='loincloth, small bow, quiver of poison arrows, ostrich-shell beads'),
    'moche': dict(name='Moche warrior-priest clubmen', role='infantry', colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Metal': ('B8733F', .4, .65), 'Wood': '5A4130'}, covered='top',
                  parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Team'), big_headdress, lib.club, (lib.shield, 'round', {'size': .12})],
                  look='large crescent headdress, tunic, war club, round shield'),
    'wari': dict(name='Wari mace-and-dart warriors', role='infantry', colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Wood': '5A4130', 'Metal': ('6A6A70', .3, .3)}, covered='top',
                 parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Team'), chequered, (lib.cap, 'Cloth', {'peak': 1.03, 'name': 'HelmetCap'}), mace_star, (lib.shield, 'rect')],
                 look='chequered tunic, helmet cap, stone-headed mace, square shield'),
    'tiwanaku': dict(name='Tiwanaku spear-thrower warriors (improvised)', role='infantry', colors={'Skin': 'A8724E', 'Cloth': 'C9A66B', 'Wood': '5A4130', 'Metal': ('6A6A70', .3, .3)}, covered='top',
                     parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Team'), stepped_headdress, mace_star, (lib.shield, 'round', {'size': .13})],
                     look='stepped headdress, tunic, star-headed mace, shield'),
    'marajoara': dict(name='Marajoara fortress archers (improvised)', role='ranged', colors={'Skin': 'A8724E', 'Leather': 'A04A2A', 'Cloth': 'E8D9B0', 'Wood': '6A4A30'}, covered='hips',
                      parts=[(tunic, 'Team', {'low': .42, 'name': 'Loincloth'}), body_paint, (lib.feathers, 'Cloth', {'n': 5, 'tall': .10}), kd.longbow, (lib.armlets, 'Leather')],
                      look='body paint, feather headdress, long bow, painted clay armlets'),
    'mutal': dict(name='Mutal spear-and-shield lords', role='infantry', colors={'Skin': 'A8724E', 'Leather': 'C99A4A', 'Wood': '3A2A1E', 'Cloth': '4E9A6A', 'Metal': ('2A2A30', .3, .2)}, covered='hips',
                  parts=[jaguar_kilt, backrack, (lib.headband, 'Team'), (lib.spear, {'top': 1.30}), (lib.shield, 'round', {'size': .15})],
                  look='Maya: jaguar-pelt kilt, feather backrack, spear, round shield'),
    'hohokam': dict(name='Hohokam shell-and-bow archers', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Leather': '9A7650', 'Wood': '6A4A30'}, covered='hips',
                    parts=[(tunic, 'Team', {'low': .40, 'name': 'BreechCloth'}), shell_necklace, lib.hair, lib.bow, lib.quiver],
                    look='breech cloth, shell jewelry, bow, quiver'),
    'chaco': dict(name='Chacoan great-house bowmen (improvised)', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Leather': '8A6A40', 'Wood': '6A4A30'}, covered='hips',
                  parts=[(tunic, 'Team', {'low': .34, 'name': 'CottonKilt'}), lib.hair, lib.sandals, lib.bow, lib.quiver, (lib.shield, 'round', {'size': .11})],
                  look='cotton kilt, sandals, bow, light shield'),
    'saudeleur': dict(name='Saudeleur basalt-city spearmen (improvised)', role='infantry', colors={'Skin': '8A573A', 'Wood': 'A08A5A', 'Cloth': 'D9C7A0', 'Metal': ('3A3A40', .3, .3)}, covered='top',
                      parts=[(tunic, 'Team', {'low': .34, 'name': 'Wrapper'}), fibre_armour, lib.hair, (lib.spear, {'top': 1.30}), (lib.shield, 'rect')],
                      look='wrapper, woven fibre armour, spear, a board shield'),
}

HORSE = {
    'alodia': dict(name='Alodian quilted-armour spear cavalry (improvised)', colors={'Skin': '6A4430', 'Cloth': 'E6DDC5', 'Leather': '7E5A3A', 'Wood': '5A4130', 'Metal': IRON},
                   dress=[(kd.gambeson, 'Team', {'name': 'QuiltedTunic', 'low': .40}), (lib.headcloth, 'Cloth')], arms=[(lib.spear, {'top': 1.6, 'low': .30}), (cl.small_round, .11)],
                   horse=dict(cloth='Team', chest=True), look='quilted tunic, small round shield, spear, horse in a leather chest cloth'),
    'khazaria': dict(name='Khazar heavy horse archers', colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '5A4130'},
                     dress=[(lib.trousers, 'Team'), (tunic, 'Team', {'low': .38}), lamellar, plumed_cap, cs.sabre], arms=[(cl.composite_bow,)],
                     horse=dict(cloth='Team'), look='lamellar cuirass, felt cap with a plume, composite bow, sabre'),
    'sogdia': dict(name='Sogdian armoured horsemen (Panjikent murals)', colors={'Skin': 'D2A47E', 'Cloth': 'B85A3A', 'Leather': '6B4630', 'Metal': STEEL, 'Wood': '3F2E22'},
                   dress=[caftan, lamellar, steel_cap], arms=[(lib.spear, {'top': 1.7, 'low': .30})],
                   horse=dict(cloth='Cloth', embroidered=True), look='mail and lamellar over a painted caftan, spear, horse with a patterned cloth'),
    'khwarazm': dict(name='Khwarazmian Kipchak horse archers', colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '5A4130'},
                     dress=[(lib.trousers, 'Cloth'), (kd.gambeson, 'Team', {'name': 'QuiltedCoat', 'low': .38}), plumed_cap, cs.sabre], arms=[(cl.composite_bow,)],
                     horse=dict(cloth='Leather'), look='felt cap with a plume, quilted coat, composite bow, sabre'),
    'gokturk': dict(name='Gokturk lamellar horse archers', colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '3A2A1E'},
                    dress=[(lib.trousers, 'Team'), (tunic, 'Team', {'low': .38}), lamellar, steel_cap, braids, back_pennant, cs.sabre], arms=[(cl.composite_bow,)],
                    horse=dict(cloth='Team'), look='lamellar vest, steel cap, braided hair, bow and sabre, a pennant on a pole'),
    'yarlung': dict(name='Yarlung lamellar lancers', colors={'Skin': 'C48A62', 'Cloth': 'B8A27A', 'Leather': '5E4030', 'Metal': IRON, 'Wood': '3F2E22'},
                    dress=[(tunic, 'Team', {'low': .38}), lamellar, pointed_helm], arms=[(lib.spear, {'top': 1.75, 'low': .30})],
                    horse=dict(cloth='Team', barding='Team'), look='Tibetan lamellar coat, pointed helm, lance, horse in armour cloth'),
    'baekje': dict(name='Baekje armoured cavalry', colors={'Skin': 'D9AE88', 'Cloth': 'C9B58C', 'Leather': '5E3A28', 'Metal': IRON, 'Wood': '3F2E22'},
                   dress=[(tunic, 'Team', {'low': .38}), lamellar, (cl.crested_helm, 'Team')], arms=[(lib.spear, {'top': 1.75, 'low': .30})],
                   horse=dict(cloth='Team', barding='Metal', cheek=True), look='plate and lamellar armour, crested helm, lance, horse armour'),
    'emishi': dict(name='Emishi horse archers', colors={'Skin': 'D9AE88', 'Cloth': 'C9B58C', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '5A4130'},
                   dress=[(tunic, 'Team', {'low': .38}), (lib.top, 'Team'), fur_trim, lib.hair, (lib.sword, {'length': .40, 'side': 'L'})], arms=[(cs.yumi, {'height': 1.1, 'below': .4})],
                   horse=dict(cloth='Leather'), look='fur-edged tunic, long bow, straight sword, small horse'),
    'wagadu': dict(name='Wagadu iron-spear cavalry', colors={'Skin': '6A4430', 'Cloth': 'E6DDC5', 'Leather': '7E5A3A', 'Metal': IRON, 'Wood': '3A2A1E'},
                   dress=[(tunic, 'Team', {'low': .38}), (lib.top, 'Cloth'), (lib.cap, 'Cloth', {'peak': 1.09, 'name': 'ConicalHat'})], arms=[(lib.spear, {'top': 1.65, 'low': .30}), (cl.small_round, .12)],
                   horse=dict(cloth='Team', caparison=True), look='quilted horse armour, iron spear, conical hat, round shield'),
}

ELEPHANTS = {
    'kamarupa': dict(name='Kamarupan war elephants', colors={'Skin': '8A573A', 'Cloth': 'E6DDC5', 'Leather': '7A7064', 'Wood': '8A7040', 'Metal': IRON},
                     armour='Cloth', crew=['bowman', 'bowman'], look='forest elephant with a wicker howdah, a mahout and two archers'),
    'champa': dict(name='Cham elephant lancers', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Leather': '7A7064', 'Wood': '5A4130', 'Metal': IRON},
                   armour='Metal', crew=['spearman', 'halberd'], banner=True, look='armoured elephant, a mahout and spearmen, a tower banner'),
}


def build_elephant(model, spec):
    parts = cs.build_elephant(model, spec)
    if spec.get('banner'):
        ele = parts[0]
        u.tube('TowerBannerPole', [(.30, .30, 1.4), (.30, .30, 2.3)], [.012, .01], 'Wood', ['Mount_Spine'] * 2, 4, ele)
        u.box('TowerBanner', (.30, .44, 2.12), (.012, .26, .30), 'Team', 'Mount_Spine', ele)
    return parts


def build_kitara(model):
    spec = dict(covered='top', parts=[(tunic, 'Leather', {'low': .34, 'name': 'LeatherSkirt'}), lib.hair, (lib.spear, {'top': 1.30}), (lib.shield, 'oxhide')])
    arm = lib.person(spec)
    arm.location = (-.28, 0, 0)
    ox, _ = tm.ox('Ox', at=(.32, .1, 0), coat='Leather', dark='Wood', horn='Cloth')
    for sx in (-1, 1):  # the Ankole longhorns: long lyre-shaped horns
        u.tube(f'LongHorn{sx}', [(.32 + sx * .05, -.62, .86), (.32 + sx * .22, -.60, .98), (.32 + sx * .26, -.55, 1.16)], [.03, .02, .006], 'Cloth', ['Mount_Head'] * 3, 5, ox)
    return [arm, ox]


KITARA = dict(name='Kitaran longhorn cattle guards (improvised)', role='infantry', colors={'Skin': '6A4430', 'Leather': '7E5A3A', 'Cloth': 'E6DDC5', 'Wood': '5A4130', 'Metal': IRON},
              look='leather skirt, spear, hide shield, a long-horned Ankole ox beside')


def build(model):
    lib.reset()
    if model in FOOT:
        spec = FOOT[model]
        arm = lib.person(spec)
        lib.finish(model, [arm], spec['colors'], {'name': spec['name'], 'role': spec['role'], 'look': spec['look'], 'rig': 'person'}, lib.PERSON_BUDGET, False)
        return
    height = None
    if model == 'kitara':
        spec = KITARA; parts = build_kitara(model); rig = 'ox'; role = 'infantry'; budget = 3000
    elif model in HORSE:
        spec = HORSE[model]; parts = cs.build_horseman(model, spec); rig = 'horse'; role = 'cavalry'; budget = 3000
    else:
        spec = ELEPHANTS[model]; parts = build_elephant(model, spec); rig = 'elephant'; role = 'cavalry'; budget = lib.MOUNTED_BUDGET
    bpy.context.view_layer.update()
    if rig == 'elephant':
        height = round(cs.measured_height() * cs.MOUNTED_SCALE * cs.ELEPHANT_DRAWN, 3)
    lib.finish(model, parts, spec['colors'], {'name': spec['name'], 'role': role, 'rig': rig, 'look': spec['look'], **({'height': height} if height else {})}, budget, True)
    if height:
        path = u.out_dir(model) / f'{model}.json'
        opts = json.loads(path.read_text()); opts['height'] = height
        path.write_text(json.dumps(opts, indent=2) + '\n')


ALL = list(FOOT) + list(HORSE) + list(ELEPHANTS) + ['kitara']
if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or ALL
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
