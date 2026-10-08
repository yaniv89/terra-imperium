# scripts/blender/build_units_classical_signature.py
# The 38 Classical signature units of plans/ART-MODELS-PLAN.md 4.5 (one per people whose peak is the
# Classical age), on the person rig, the horse, the light chariot, the camel, the elephant and the
# siege frame (ti_units.py, ti_mounts.py), with the part libraries of build_units_bronze_signature.py
# and build_units_classical.py, in the base units' look (faceted, flat colours: Team, Skin, Emblem,
# Metal, Wood, Leather, Cloth; readable at 30 px). Original procedural geometry, no outside assets.
#   18 on foot, 13 horsemen, 2 light chariots (Pontus, Brigantes), 2 camels (Saba, Qedar),
#   2 war elephants (Magadha, Kalinga), 1 stone-thrower on the frame (Bosporan Kingdom).
#   blender -b --factory-startup -P scripts/blender/build_units_classical_signature.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json) and report.json; rest pose only.
# Camel and elephant units carry a `height` in their JSON (the loader's target height): the
# measured figure times the base cavalry's world-per-unit scale, so a camel or an elephant stands
# taller than a horse instead of being squeezed to a horseman's height (or, for Saba's ranged
# camel archers, to a foot archer's).
import bpy, sys, os, math, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('TI_UNITS_OUT', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'signature'))
from mathutils import Vector  # noqa: E402
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402

BRONZE = ('C2995A', .4, .6)
COPPER = ('B8733F', .4, .65)
IRON = ('8E8A84', .45, .7)
GOLD = ('D4A84A', .35, .8)
# world units per model unit of a mounted base unit: the procedural Classical cavalry (1.884) over the
# measured classical-cavalry.glb (1.467, attachments excluded): soldierFactory and gltfUnitLoader
MOUNTED_SCALE = 1.884 / 1.467
# An elephant squad draws two beasts at full size (RIG_FIGURES in src/data/signatureUnits.js; the
# squad's strength stays the role's), 3.6 world units tall with the howdah crew. Was 0.8 to fit eight.
ELEPHANT_DRAWN = 1
WIDE_SEAT = {'r': {'Leg_L': (-62, -42, 0), 'Leg_R': (-62, 42, 0), 'Shin_L': (72, 0, 0), 'Shin_R': (72, 0, 0)}}
P = lib.person


# ---- extra parts ------------------------------------------------------------------------------------

def brim_hat(arm, mat='Cloth', r=.15, z=.975, crown=1.03, name='Hat'):
    """A wide flat hat (straw hat, petasos): a brim disc and a low crown."""
    u.tube(name + 'Brim', [(0, 0, z - .006), (0, 0, z + .006)], [r, r * .97], mat, ['Head'] * 2, 10, arm)
    u.tube(name + 'Crown', [(0, 0, z), (0, 0, crown - .01), (0, 0, crown)], [(.066, .06), (.05, .045), (.02, .02)], mat, ['Head'] * 3, 8, arm)


def negau(arm, mat='Metal'):
    """The Etruscan Negau helmet: a bell with a ridge and a flared rim."""
    lib.cap(arm, mat, peak=1.04, name='Negau', low=.93, r=(.07, .064))
    lib.ring('NegauRim', arm, [.925, .935], [(.088, .082), (.084, .078)], mat, ['Head'] * 2, 10)
    u.box('NegauRidge', (0, 0, 1.0), (.012, .12, .03), mat, 'Head', arm)


def turban(arm, mat='Cloth', z=.965):
    for i, (dz, r) in enumerate([(0, (.072, .066)), (.025, (.074, .068)), (.05, (.066, .06))]):
        lib.ring(f'Turban{i}', arm, [z + dz - .014, z + dz + .014], [r, (r[0] - .004, r[1] - .004)], mat, ['Head'] * 2, 8)
    u.tube('TurbanTop', [(0, 0, z + .06), (0, 0, z + .09)], [(.05, .045), (.015, .015)], mat, ['Head'] * 2, 8, arm)


def skin_helmet(arm, mat='Leather'):
    """A helmet of wild-animal skin: a hide cap, the ears, the pelt hanging down the back."""
    lib.cap(arm, mat, peak=1.03, name='SkinCap', r=(.072, .066))
    for s in (-1, 1):
        u.mesh_obj(f'PeltEar{s}', [(s * .03, -.01, 1.0), (s * .06, -.01, 1.0), (s * .05, 0, 1.06)], [(0, 1, 2), (0, 2, 1)], mat, 'Head', arm=arm)
    u.tube('Pelt', [(0, .05, .99), (0, .10, .90), (0, .12, .74)], [(.06, .02), (.07, .02), (.05, .015)], mat, ['Head', 'Head', 'Chest'], 5, arm)


def animal_helmet(arm, mat='Leather', teeth='Cloth'):
    """A Zapotec animal-head helmet: a big hide head over the face with a snout and fangs."""
    lib.cap(arm, mat, peak=1.07, name='BeastHead', low=.92, r=(.082, .078))
    u.box('BeastSnout', (0, -.085, 1.0), (.09, .08, .06), mat, 'Head', arm)
    for s in (-1, 1):
        u.box(f'BeastFang{s}', (s * .03, -.12, .975), (.014, .014, .03), teeth, 'Head', arm)
        u.mesh_obj(f'BeastEar{s}', [(s * .04, .0, 1.04), (s * .075, .01, 1.04), (s * .065, .0, 1.1)], [(0, 1, 2), (0, 2, 1)], mat, 'Head', arm=arm)


def tall_hat(arm, mat='Cloth'):
    u.tube('TallHat', [(0, 0, .95), (0, 0, 1.0), (0, .01, 1.10), (0, .02, 1.14)], [(.06, .055), (.05, .045), (.045, .04), (.03, .028)], mat, ['Head'] * 4, 8, arm)


def fur_cap(arm, mat='Leather'):
    lib.cap(arm, mat, peak=1.03, name='FurCap', r=(.078, .072))
    lib.ring('FurBrim', arm, [.935, .965], [(.084, .078), (.082, .076)], mat, ['Head'] * 2, 8)


def torc(arm, mat='Metal'):
    lib.ring('Torc', arm, [.79, .805], [(.058, .05), (.056, .048)], mat, ['Neck'] * 2, 8)


def breastplate(arm, mat='Metal'):
    u.box('Breastplate', (0, -.075, .68), (.17, .02, .18), mat, 'Chest', arm)


def hair_buns(arm, mat='Wood'):
    lib.hair(arm, mat)
    for s in (-1, 1):
        u.tube(f'HairBun{s}', [(s * .055, .0, 1.0), (s * .08, .0, 1.04)], [.03, .015], mat, ['Head'] * 2, 6, arm)
    lib.hair_knot(arm, mat)


def suebian_knot(arm, mat='Wood'):
    lib.hair(arm, mat)
    u.tube('SuebianKnot', [(.05, .01, .99), (.075, .01, 1.01)], [.03, .018], mat, ['Head'] * 2, 6, arm)


def gorytos(arm, mat='Leather'):
    """A Scythian-style bow case at the left hip."""
    u.tube('Gorytos', [(.13, .02, .34), (.14, .03, .52)], [(.025, .06), (.03, .075)], mat, ['Hips'] * 2, 6, arm)


def atlatl(arm):
    w = lib.hand(arm)
    u.tube('Atlatl', [(w.x, w.y + .02, w.z - .02), (w.x, w.y + .10, w.z + .40)], [.012, .009], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.tube('Dart', [(w.x + .02, w.y + .12, w.z + .38), (w.x + .02, w.y - .25, w.z + .55)], [.006, .005], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.tube('DartHead', [(w.x + .02, w.y - .25, w.z + .55), (w.x + .02, w.y - .30, w.z + .57)], [.01, .001], 'Metal', ['Prop_R'] * 2, 4, arm, attachment=True)


def ge_ji(arm):
    """The Chu halberd: a long haft, a spear tip and a side dagger-axe blade."""
    lib.dagger_axe(arm)
    w = lib.hand(arm)
    u.tube('JiTip', [(w.x, w.y - .006, 1.18), (w.x, w.y - .006, 1.30)], [(.006, .018), .001], 'Metal', ['Prop_R'] * 2, 4, arm, attachment=True)


def repeating_bow(arm):
    lib.crossbow(arm)
    w = lib.hand(arm, 'R')
    u.box('Magazine', ((w.x + lib.hand(arm, 'L').x) / 2, w.y - .17, w.z + .07), (.035, .14, .06), 'Wood', 'Prop_R', arm, True)


def yumi(arm, height=1.30, below=.48):
    """The long asymmetric bow of the Wei zhi, gripped below its middle (`below` of it under the hand)."""
    w = lib.hand(arm, 'L'); pts = []; n = 8
    for i in range(n):
        t = i / (n - 1); z = w.z - below + height * t; y = w.y - .04 - .05 * math.sin(math.pi * t)
        pts.append((w.x + .01, y, max(.03, z)))
    u.tube('Yumi', pts, [.006, .009, .011, .012, .012, .011, .009, .006], 'Wood', ['Prop_L'] * n, 4, arm, attachment=True)
    u.tube('YumiString', [pts[0], (w.x + .01, w.y + .02, w.z), pts[-1]], [.003] * 3, 'Cloth', ['Prop_L'] * 3, 3, arm, attachment=True)


def long_sword(arm):
    lib.sword(arm, length=.55)


def sabre(arm):
    lib.belt_dagger(arm, at=(-.09, -.06, .50))
    u.tube('Sabre', [(-.10, -.02, .52), (-.12, .06, .30), (-.13, .14, .16)], [.012, .01, .004], 'Metal', ['Hips'] * 3, 4, arm)


def copper_axe(arm):
    lib.axe(arm, length=.40, mat='Metal')


def stone_pile(rig, at, n=5, mat='Cloth'):
    x0, y0 = at
    for k in range(n):
        a = 2 * math.pi * k / n
        x, y = x0 + .08 * math.cos(a), y0 + .08 * math.sin(a)
        u.tube(f'Stone{k}', [(x, y, 0), (x, y, .07)], [.05, .035], mat, ['Hull'] * 2, 5, rig)
    u.tube('StoneTop', [(x0, y0, .06), (x0, y0, .13)], [.05, .03], mat, ['Hull'] * 2, 5, rig)


# ---- foot ------------------------------------------------------------------------------------------

def tunic(arm, mat='Team', low=.36, name='Tunic'):
    lib.kilt(arm, mat, low=low, name=name)


FOOT = {
    'aghvank': dict(name='Aghvank skin-helmed javelin and bow troops', role='ranged', colors={'Skin': 'C99472', 'Leather': '7A5A3A', 'Metal': BRONZE, 'Cloth': 'D9CDA8'}, covered='top',
                    parts=[(tunic, 'Team', {'low': .37}), (lib.top, 'Cloth'), breastplate, skin_helmet, (lib.javelins, 3), (lib.shield, 'rect'), lib.sandals],
                    look='helmet of wild-animal skin, large oblong shield, javelins (the ranged role), bronze breastplate'),
    'nabataea': dict(name='Nabataean cliff archers', role='ranged', colors={'Skin': 'B98258', 'Cloth': 'D9C38E', 'Leather': '7A5236', 'Metal': BRONZE}, covered='robe',
                     parts=[(lib.robe, 'Team'), (lib.belt, 'Leather', .52), lib.belt_dagger, (brim_hat, 'Cloth', {'r': .16}), lib.bow, lib.quiver],
                     look='ankle-length tunic, quiver, dagger belt, the wide straw hat of the Petra frieze, bow'),
    'mauretania': dict(name='Mauri javelin skirmishers', role='infantry', colors={'Skin': 'A06A48', 'Cloth': 'E6DABC', 'Leather': '8A6040', 'Wood': '3A2A1E'}, covered='top',
                       parts=[(tunic, 'Team', {'low': .40}), (lib.top, 'Cloth'), (lib.belt, 'Cloth', .52), lib.hair, (lib.javelins, 2), (lib.shield, 'round', {'size': .12})],
                       look='short tunic, javelin pair, small leather shield, rope belt'),
    'rasenna': dict(name='Rasenna hoplite phalanx', role='infantry', colors={'Skin': 'C99472', 'Cloth': 'F0E8D4', 'Metal': BRONZE}, covered='top',
                    parts=[(tunic, 'Team', {'low': .40}), (lib.top, 'Cloth', {'name': 'Linothorax'}), (cl.pteruges, 'Cloth', .49), negau, (lib.spear, {'top': 1.25}), (lib.shield, 'round', {'size': .21}), lib.greaves, lib.sandals],
                    look='Etruscan: bronze Negau helmet, big round shield, short spear, linen cuirass, greaves'),
    'belgae': dict(name='Belgic noble swordsmen', role='infantry', colors={'Skin': 'D9A07A', 'Cloth': 'C9B58C', 'Metal': IRON, 'Leather': '6E4A30'}, covered='top',
                   parts=[(lib.trousers, 'Team'), (lib.top, 'Metal', {'name': 'Mail'}), (tunic, 'Metal', {'low': .40, 'name': 'MailSkirt'}), (lib.cap, 'Metal', {'peak': 1.04}), (lib.feathers, 'Team', {'n': 3, 'tall': .10, 'spread': .3}), long_sword, (cl.oval_shield, {'rx': .15, 'rz': .28})],
                   look='mail shirt, oval shield with a boss, long sword, plumed helmet, trousers'),
    'cherusci': dict(name='Cherusci forest ambushers', role='infantry', colors={'Skin': 'DDA884', 'Leather': '6B4A30', 'Wood': '7A5A38', 'Metal': IRON}, covered='hips',
                     parts=[(lib.trousers, 'Team'), (lib.cloak, 'Leather', {'low': .40}), suebian_knot, (lib.spear, {'top': 1.30}), (lib.shield, 'round', {'size': .17})],
                     look='Germanic: Suebian hair knot, framea spear, round board shield, cloak, bare chest, trousers'),
    'durotriges': dict(name='Durotrigan hillfort slingers', role='ranged', colors={'Skin': 'DDA884', 'Cloth': 'C8B68F', 'Leather': '7E5A3A', 'Wood': '8A5A30'}, covered='top',
                       parts=[(lib.trousers, 'Team'), (lib.top, 'Cloth'), (lib.cloak, 'Leather', {'low': .55, 'name': 'ShortCloak'}), lib.hair, lib.sling, (lib.hip_bag, 'Leather', {'name': 'PebblePouch'})],
                       look='bare head, sling, a big pouch of beach pebbles, short cloak'),
    'kroraina': dict(name='Kroraina oasis archers', role='ranged', colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '7A5236'}, covered='top',
                     parts=[(tunic, 'Team', {'low': .32}), (lib.top, 'Team', {'name': 'WoolTunic'}), (lib.belt, 'Leather', .52), (lib.cap, 'Cloth', {'peak': 1.07, 'name': 'FeltHat', 'r': (.07, .063)}), lib.bow, (lib.quiver, {'hip': True})],
                     look='belted wool tunic, felt hat, bow and quiver'),
    'kosala': dict(name='Kosalan foot archers', role='ranged', colors={'Skin': 'A06A48', 'Cloth': 'F0E8D4', 'Wood': '6A4A30'}, covered='hips',
                   parts=[(tunic, 'Team', {'low': .26, 'name': 'Dhoti'}), (turban, 'Cloth'), (lib.bow, {'height': 1.15, 'recurve': .06}), lib.quiver, (lib.armlets, 'Metal')],
                   look='dhoti, turban, tall bow, quiver, bare chest'),
    'chu': dict(name='Chu halberdiers', role='infantry', colors={'Skin': 'D2A47E', 'Leather': '6E2A20', 'Metal': BRONZE, 'Cloth': '2A2420'}, covered='top',
                parts=[(tunic, 'Team', {'low': .34}), (lib.top, 'Leather', {'name': 'LacquerArmour'}), (cl.pteruges, 'Leather', .50), (tall_hat, 'Cloth'), ge_ji, (lib.shield, 'rect')],
                look='lacquered leather armour, long ge-ji halberd, red-black lacquered shield (Emblem), tall hat'),
    'qi': dict(name='Qi crossbowmen of Maling', role='ranged', colors={'Skin': 'D2A47E', 'Leather': '5E2E22', 'Metal': BRONZE, 'Cloth': '2E2620'}, covered='top',
               parts=[(tunic, 'Team', {'low': .34}), (lib.top, 'Leather', {'name': 'LacquerArmour'}), (lib.hair_knot, 'Cloth'), lib.hair, lib.crossbow, (lib.quiver, {'hip': True}), lib.belt_dagger],
               look='lacquered leather armour, crossbow, bolt quiver, short sword, topknot'),
    'yue': dict(name='Yue sword-masters', role='infantry', colors={'Skin': 'C48A62', 'Cloth': 'E6DDC5', 'Metal': BRONZE, 'Wood': '9A7448'}, covered='hips',
                parts=[(tunic, 'Team', {'low': .40}), (lib.tattoo_bands, 'Wood'), (lib.armlets, 'Wood'), lib.hair, long_sword, (lib.shield, 'round', {'size': .15})],
                look='short tunic, bare arms and chest, long bronze sword, rattan shield, tattooed skin'),
    'nanyue': dict(name='Nanyue crossbowmen', role='ranged', colors={'Skin': 'C48A62', 'Leather': '7A5236', 'Metal': BRONZE, 'Cloth': 'DCCFAE'}, covered='top',
                   parts=[(tunic, 'Team', {'low': .34}), (lib.top, 'Leather'), (lib.headcloth, 'Cloth'), repeating_bow, lib.belt_dagger],
                   look='Han-Yue style: leather armour, repeating crossbow with a magazine, short sword, headcloth'),
    'yamatai': dict(name='Yamataian bowmen', role='ranged', colors={'Skin': 'D9AE88', 'Cloth': 'E6DDC5', 'Leather': '7A5236', 'Wood': '6A4A30'}, covered='top',
                    parts=[(tunic, 'Team', {'low': .30}), (lib.top, 'Cloth'), (lib.cap, 'Leather', {'peak': 1.0, 'name': 'HideCap'}), yumi, lib.quiver],
                    look='Yayoi: tunic, very long asymmetric bow, hide cap, quiver'),
    'nok': dict(name='Nok heavily armed warriors', role='infantry', colors={'Skin': '7A4E34', 'Wood': '2A1E16', 'Cloth': 'D9C7A0', 'Metal': IRON}, covered='hips',
                parts=[(tunic, 'Team', {'low': .38}), hair_buns, (lib.armlets, 'Cloth', {'wrists': True}), (lib.spear, {'top': 1.30}), (lib.shield, 'round', {'size': .13})],
                look='clay-sculpture style: elaborate hair in buns and a crest, bare chest, iron spear, small shield'),
    'teotihuacan': dict(name='Teotihuacan atlatl warriors', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Wood': '5A4130', 'Metal': ('2A2A30', .3, .2)}, covered='top',
                        parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Cloth', {'name': 'CottonArmour'}), (lib.headband, 'Team'), (lib.feathers, 'Cloth', {'n': 7, 'tall': .12}), atlatl, (lib.shield, 'round', {'size': .14})],
                        look='tasselled feather headdress, quilted cotton armour, atlatl and darts, round shield'),
    'zapotec': dict(name='Zapotec obsidian-spear warriors', role='infantry', colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Leather': '8A6A40', 'Metal': ('2A2A30', .3, .2), 'Wood': '6A4A30'}, covered='top',
                    parts=[(tunic, 'Team', {'low': .36}), (lib.top, 'Cloth', {'name': 'CottonArmour'}), animal_helmet, (lib.spear, {'top': 1.32}), (lib.shield, 'rect')],
                    look='animal-head helmet, cotton armour, obsidian-tipped spear, wooden shield'),
    'hopewell': dict(name='Hopewell copper-ornament warriors', role='infantry', colors={'Skin': 'A8724E', 'Leather': '8A6A40', 'Metal': COPPER, 'Cloth': 'E8D9B0'}, covered='hips',
                     parts=[(tunic, 'Team', {'low': .36}), breastplate, (lib.feathers, 'Cloth', {'n': 3, 'tall': .12, 'spread': .4}), lib.hair, copper_axe, (lib.shield, 'oxhide')],
                     look='copper breastplate, copper axe, hide shield, feather headdress'),
}

# ---- horsemen ----------------------------------------------------------------------------------------
# dress: before the astride pose; arms: after it; horse: extras on the horse rig (cloth, barding, plates)
HORSE = {
    'media': dict(name='Median horse archers', colors={'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Leather': '7E5A3A', 'Wood': '5A4130'},
                  dress=[(lib.trousers, 'Team'), (tunic, 'Cloth', {'low': .40}), (lib.top, 'Cloth'), (lib.phrygian, 'Team'), gorytos], arms=[(cl.composite_bow,)],
                  horse=dict(cloth='Team'), look='trousers and tunic, soft pointed cap, short composite bow, bow case'),
    'lydia': dict(name='Lydian lance cavalry', colors={'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Metal': GOLD, 'Wood': '5A4130'},
                  dress=[(tunic, 'Team', {'low': .40}), (lib.top, 'Cloth'), (lib.cap, 'Cloth', {'peak': 1.04, 'name': 'FeltCap'}), (lib.sash, 'Metal')], arms=[(lib.spear, {'top': 1.65, 'low': .30}), (cl.small_round, .11)],
                  horse=dict(cloth='Team'), look='plain tunic, felt cap, long lance, small round shield, a sash of Sardis gold coins'),
    'cyrene': dict(name='Cyrenaean horse javelineers', colors={'Skin': 'C99472', 'Cloth': 'E8DEC6', 'Leather': '6B4630', 'Wood': '5A4130'},
                   dress=[(tunic, 'Team', {'low': .42}), (lib.top, 'Team'), (brim_hat, 'Cloth', {'r': .12, 'name': 'Petasos'})], arms=[(lib.javelins, 2)],
                   horse=dict(cloth='Cloth', spots=True), look='short tunic, round petasos hat, javelin pair, horse with a spotted cloth'),
    'numidia': dict(name='Numidian javelin riders', colors={'Skin': '8A573A', 'Cloth': 'E6DABC', 'Leather': '6B4630', 'Wood': '3A2A1E'},
                    dress=[(tunic, 'Team', {'low': .42}), lib.hair], arms=[(lib.javelins, 2), (cl.small_round, .10)],
                    horse=dict(cloth=None, bridle=True), look='short tunic, no saddle, two javelins, small leather shield, horse with a rope bridle'),
    'arverni': dict(name='Arverni Gaulish noble horsemen', colors={'Skin': 'D9A07A', 'Cloth': 'C9B58C', 'Metal': IRON, 'Leather': '6B4630'},
                    dress=[(lib.trousers, 'Team'), (lib.top, 'Metal', {'name': 'Mail'}), (torc, 'Metal'), (lib.cap, 'Metal', {'peak': 1.04})], arms=[long_sword, (cl.oval_shield, {'rx': .12, 'rz': .2})],
                    horse=dict(cloth='Cloth'), look='mail shirt, torc, oval shield, long sword, horse in a plain saddle cloth'),
    'parthava': dict(name='Parthian horse archers', colors={'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Leather': '7A5236', 'Wood': '5A4130'},
                     dress=[(lib.trousers, 'Team'), (lib.top, 'Team'), (cl.seated_cloak, 'Leather'), (lib.phrygian, 'Cloth'), gorytos], arms=[(cl.composite_bow,)],
                     horse=dict(cloth='Cloth'), look='trousers, cloak, soft cap, composite bow (the Parthian shot)'),
    'bactria': dict(name='Bactrian armoured cavalry', colors={'Skin': 'C99472', 'Cloth': 'D9C7A0', 'Metal': BRONZE, 'Wood': '3F2E22'},
                    dress=[(tunic, 'Team', {'low': .40}), (lib.top, 'Metal', {'name': 'ScaleCoat'}), (cl.crested_helm, 'Team')], arms=[(lib.spear, {'top': 1.65, 'low': .30})],
                    horse=dict(cloth='Team', cheek=True, chest=True), look='scale coat, crested helm, long spear, horse in a saddle cloth with cheek and chest plates'),
    'wusun': dict(name='Wusun horse archers', colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '5A4130'},
                  dress=[(lib.trousers, 'Cloth'), (tunic, 'Team', {'low': .36, 'name': 'Coat'}), (lib.top, 'Team'), (lib.belt, 'Leather', .52), (lib.cap, 'Cloth', {'peak': 1.06, 'name': 'FeltCap'}), sabre], arms=[(cl.composite_bow,)],
                  horse=dict(cloth='Leather'), look='belted coat, felt cap, composite bow, short sabre'),
    'xianbei': dict(name='Xianbei armoured lancers', colors={'Skin': 'D2A47E', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '3F2E22'},
                    dress=[(tunic, 'Team', {'low': .40}), (lib.top, 'Metal', {'name': 'IronScale'}), fur_cap], arms=[(lib.spear, {'top': 1.7, 'low': .30})],
                    horse=dict(cloth='Team', chest=True), look='iron scale armour, long lance, fur cap, horse with a chest plate'),
    'avanti': dict(name='Avanti heavy cavalry', colors={'Skin': 'A06A48', 'Cloth': 'EFE6D0', 'Metal': BRONZE, 'Wood': '5A4130'},
                   dress=[(tunic, 'Cloth', {'low': .38}), (lib.top, 'Cloth', {'name': 'QuiltedCoat'}), (turban, 'Team'), sabre], arms=[(lib.spear, {'top': 1.55, 'low': .30})],
                   horse=dict(cloth='Team', caparison=True), look='quilted coat, turban, spear and sabre, horse with a caparison'),
    'satavahana': dict(name='Satavahana horsemen', colors={'Skin': 'A06A48', 'Cloth': 'EFE6D0', 'Metal': BRONZE, 'Wood': '5A4130'},
                       dress=[(tunic, 'Team', {'low': .36}), (turban, 'Cloth'), (lib.armlets, 'Metal')], arms=[(lib.spear, {'top': 1.65, 'low': .30}), (lib.sword, {'length': .36, 'side': 'L'})],
                       horse=dict(cloth='Team', embroidered=True), look='turban, long lance, sword, horse with an embroidered cloth'),
    'dian': dict(name='Dian mounted swordsmen', colors={'Skin': 'C48A62', 'Cloth': 'E6DDC5', 'Metal': BRONZE, 'Leather': '6B4630'},
                 dress=[(tunic, 'Team', {'low': .38}), (cl.seated_cloak, 'Team'), (lib.headband, 'Cloth'), (lib.feathers, 'Cloth', {'n': 5, 'tall': .12})], arms=[long_sword],
                 horse=dict(cloth='Leather', bells=True), look='feathered headdress, cloak, long sword, horse with a bell-hung harness'),
    'buyeo': dict(name='Buyeo mounted spearmen', colors={'Skin': 'D9AE88', 'Cloth': 'C9B58C', 'Leather': '7E5A3A', 'Wood': '5A4130'},
                  dress=[(lib.trousers, 'Team'), (tunic, 'Leather', {'low': .38, 'name': 'FurCoat'}), (lib.top, 'Team'), fur_cap, lib.quiver], arms=[(lib.spear, {'top': 1.6, 'low': .30})],
                  horse=dict(cloth='Leather', barding='Leather', small=True), look='fur-lined coat, long spear, bow quiver, small horse with hide barding'),
}


def horse_extras(horse, spec, kind='horse'):
    seat = u.MOUNTS[kind]['seat']
    if spec.get('cloth'):
        u.box('SaddleCloth', (0, seat[1], seat[2] - .10), (.34, .36, .12), spec['cloth'], 'Mount_Spine', horse)
    if spec.get('spots'):
        for k, (x, y) in enumerate([(-.12, -.12), (.12, -.02), (-.12, .1), (.12, .12)]):
            u.box(f'Spot{k}', (x * 1.45, seat[1] + y, seat[2] - .12), (.012, .07, .06), 'Leather', 'Mount_Spine', horse)
    if spec.get('embroidered'):
        for sx in (-1, 1):
            u.box(f'Embroidery{sx}', (sx * .175, seat[1], seat[2] - .13), (.008, .30, .03), 'Metal', 'Mount_Spine', horse)
    if spec.get('caparison') or spec.get('barding'):
        mat = spec.get('barding') or spec['cloth']
        u.tube('Caparison', [(0, -.40, .64), (0, -.15, .65), (0, .14, .65), (0, .36, .63)], [(.17, .155), (.175, .16), (.17, .155), (.155, .14)], mat, ['Mount_Spine'] * 4, 6, horse)
    if spec.get('chest'):
        u.box('ChestPlate', (0, -.48, .62), (.22, .03, .16), 'Metal', 'Mount_Spine', horse)
    if spec.get('cheek'):
        for sx in (-1, 1):
            u.box(f'CheekPlate{sx}', (sx * .05, -.67, .92), (.012, .08, .06), 'Metal', 'Mount_Head', horse)
        u.box('Chamfron', (0, -.70, .93), (.06, .10, .02), 'Metal', 'Mount_Head', horse)
    if spec.get('bridle'):
        u.tube('Bridle', [(.04, -.70, .90), (0, -.62, .99), (-.04, -.70, .90)], [.008] * 3, 'Wood', ['Mount_Head'] * 3, 3, horse)
        u.tube('Rein', [(0, -.66, .95), (0, -.40, .82), (0, -.20, .90)], [.006] * 3, 'Wood', ['Mount_Head', 'Mount_Neck', 'Mount_Spine'], 3, horse)
    if spec.get('bells'):
        for k in range(4):
            a = math.pi * (k / 3) - math.pi / 2
            u.tube(f'Bell{k}', [(.09 * math.sin(a), -.48 + .03 * math.cos(a), .80 - .04), (.09 * math.sin(a), -.48 + .03 * math.cos(a), .76 - .04)], [.012, .024], 'Metal', ['Mount_Neck'] * 2, 6, horse)
        u.tube('BellStrap', [(.09, -.46, .82), (0, -.52, .80), (-.09, -.46, .82)], [.01] * 3, 'Leather', ['Mount_Neck'] * 3, 4, horse)


def build_horseman(model, spec):
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    horse_extras(horse, spec['horse'])
    r = cl.rider(spec['dress'], spec['arms'])
    return [horse, r]


# ---- chariots ----------------------------------------------------------------------------------------
CHARIOTS = {
    'pontus': dict(name='Pontic scythed chariot', horses=4, crew=['driver'], helm='conical', scythes=True, colors={'Leather': '7A5236', 'Metal': IRON, 'Cloth': 'D9C7A0'},
                   look='four-horse light chariot with scythe blades on the axle hubs, a driver in a conical helm'),
    'brigantes': dict(name='Brigantian chariot skirmishers', horses=2, crew=['driver', 'javelin'], helm='headcloth', plaid=True, small=True, colors={'Leather': '8A6A48', 'Cloth': 'CDB98F', 'Metal': IRON},
                      look='small two-pony chariot, a driver and a javelin thrower, plaid cloaks'),
}


def build_chariot(model, spec):
    parts, info = tm.chariot(heavy=False, horses=spec['horses'], car='Team', sides='Cloth', spokes=10 if spec.get('small') else None)
    floor = info['floor']; n = len(spec['crew'])
    xs = [(i - (n - 1) / 2) * (info['width'] / max(2, n + .2)) for i in range(n)]
    for i, (role, x) in enumerate(zip(spec['crew'], xs)):
        c = lib.crew_member(f'Crew{i}', (x, info['cy'] + .02, floor), role, spec.get('helm', 'headcloth'))
        if spec.get('plaid'):
            lib.cloak(c, 'Team', low=.42, name=f'Crew{i}Plaid')
        parts.append(c)
    if spec.get('scythes'):
        rig = info['rig']; ax = info['width'] / 2 + .11; wy = info['cy'] + info['depth'] / 2 - .04; r = .27
        for sx in (-1, 1):
            u.box(f'ScytheBar{sx}', (sx * (ax + .14), wy, r), (.22, .025, .025), 'Metal', 'Hull', rig)
            v = [(sx * (ax + .22), wy - .01, r - .01), (sx * (ax + .52), wy + .02, r - .05), (sx * (ax + .50), wy + .03, r + .02), (sx * (ax + .22), wy + .01, r + .02)]
            u.mesh_obj(f'Scythe{sx}', v, [(0, 1, 2), (0, 2, 3), (0, 2, 1), (0, 3, 2)], 'Metal', 'Hull', arm=rig)
    return parts


# ---- camels and elephants ----------------------------------------------------------------------------

def pack_saddle(camel_arm, mat='Team', frame='Wood'):
    s = u.MOUNTS['camel']['seat']
    u.box('PackSaddleCloth', (0, s[1], s[2] - .07), (.40, .34, .06), mat, 'Mount_Spine', camel_arm)
    for sy in (-1, 1):
        u.box(f'PackSaddleBow{sy}', (0, s[1] + sy * .15, s[2] - .01), (.26, .04, .10), frame, 'Mount_Spine', camel_arm)


CAMELS = {
    'saba': dict(name='Sabaean camel archers', role='ranged', colors={'Skin': 'A8724E', 'Cloth': 'E8DEC6', 'Leather': 'B08A5E', 'Wood': '6A4A30', 'Metal': BRONZE},
                 dress=[(tunic, 'Team', {'low': .42, 'name': 'Loincloth'}), (lib.sash, 'Team'), lib.hair, lib.quiver], arms=[(cl.composite_bow,)],
                 look='loincloth and sash, curved bow, the archer seated on a camel pack saddle'),
    'qedar': dict(name='Qedarite camel raiders', role='cavalry', colors={'Skin': 'A8724E', 'Cloth': 'E2D6BC', 'Leather': '9A7650', 'Wood': '4A3626', 'Metal': IRON},
                  dress=[(tunic, 'Team', {'low': .36}), (cl.seated_cloak, 'Wood'), (lib.headcloth, 'Cloth', {'tail': True})], arms=[(lib.spear, {'top': 1.55, 'low': .30}), (lib.bow, {'height': .7})],
                  look='dark goat-hair cloak, headcloth, spear and bow, a rider on a dromedary'),
}


def build_camel(model, spec):
    camel, _ = tm.camel('Camel', coat='Leather', dark='Wood')
    pack_saddle(camel)
    r = cl.rider(spec['dress'], spec['arms'], at=cl.seat_offset('camel'), pose=WIDE_SEAT)
    return [camel, r]


ELEPHANTS = {
    'magadha': dict(name='Magadhan war elephants', colors={'Skin': 'A06A48', 'Cloth': 'EFE6D0', 'Leather': '7E7468', 'Wood': '6A4A30', 'Metal': BRONZE},
                    armour='Metal', crew=['bowman', 'bowman'], look='armoured elephant (bronze plates over the body and brow) with a howdah, a mahout and two archers'),
    'kalinga': dict(name='Kalingan elephant corps', colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Leather': '7A7064', 'Wood': '5A4130', 'Metal': IRON},
                    armour='Leather', forehead=True, crew=['spearman', 'spearman'], look='armoured elephant with a painted forehead, a mahout and two spearmen in the howdah'),
}


def build_elephant(model, spec):
    ele, _ = tm.elephant('Elephant', coat='Leather', dark='Wood', ivory='Cloth')
    floor = tm.howdah(ele, mat='Team', rail='Wood')
    u.tube('Armour', [(0, -.50, 1.30), (0, -.25, 1.33), (0, .10, 1.32), (0, .38, 1.27)], [(.44, .40), (.45, .41), (.45, .41), (.41, .38)], spec['armour'], ['Mount_Spine'] * 4, 8, ele)
    if spec.get('forehead'):
        u.box('PaintedBrow', (0, -1.0, 1.42), (.28, .03, .2), 'Team', 'Mount_Head', ele)
    else:
        u.box('BrowPlate', (0, -1.0, 1.42), (.26, .03, .18), 'Metal', 'Mount_Head', ele)
    parts = [ele]
    m = cl.rider([(tunic, 'Cloth', {'low': .42}), (turban, 'Team')], [(lib.staff, {'top': .95})], at=(0, -.67, 1.285), name='Mahout', pose=WIDE_SEAT)
    parts.append(m)
    for i, (role, x) in enumerate(zip(spec['crew'], (-.15, .15))):
        parts.append(lib.crew_member(f'Crew{i}', (x, .05, floor), role, 'headcloth'))
    return parts


# ---- the Bosporan stone-thrower ----------------------------------------------------------------------

def build_bosporan(model, spec):
    parts, info = tm.frame('Frame', length=1.1, width=.52)
    tm.torsion_engine(info, stone=True, scale=1.1)
    for i, (x, y, z, yaw) in enumerate(info['crew']):
        c, _ = u.crew(f'Crew{i}', (x, y, z), lite=True, head='cap', yaw=yaw)
        lib.top(c, 'Cloth', name=f'Crew{i}Linen')
        parts.append(c)
    stone_pile(info['rig'], (.62, .55))
    return parts


SPECIAL = {
    'bosporan-kingdom': dict(name='Bosporan stone-thrower crews', role='siege', colors={'Skin': 'C99472', 'Cloth': 'E8DEC6', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '8A6646'},
                             look='a torsion stone-thrower on the siege frame, three crew in linen cuirasses, a pile of stones', build=build_bosporan),
}


def measured_height():
    zs = [(o.matrix_world @ Vector(c)).z for o in bpy.context.scene.objects if o.type == 'MESH' and not o.get('attachment') for c in o.bound_box]
    return max(zs) - min(zs)


def build(model):
    lib.reset()
    height = None
    if model in FOOT:
        spec = FOOT[model]
        arm = P(spec)
        lib.finish(model, [arm], spec['colors'], {'name': spec['name'], 'role': spec['role'], 'look': spec['look'], 'rig': 'person'}, lib.PERSON_BUDGET, False)
        return
    if model in HORSE:
        spec = HORSE[model]; parts = build_horseman(model, spec); rig = 'horse'; role = 'cavalry'; budget = 3000
    elif model in CHARIOTS:
        spec = CHARIOTS[model]; parts = build_chariot(model, spec); rig = 'chariot-light'; role = 'cavalry'; budget = lib.MOUNTED_BUDGET
    elif model in CAMELS:
        spec = CAMELS[model]; parts = build_camel(model, spec); rig = 'camel'; role = spec['role']; budget = 3000
    elif model in ELEPHANTS:
        spec = ELEPHANTS[model]; parts = build_elephant(model, spec); rig = 'elephant'; role = 'cavalry'; budget = lib.MOUNTED_BUDGET
    else:
        spec = SPECIAL[model]; parts = spec['build'](model, spec); rig = 'frame'; role = spec['role']; budget = 4000
    bpy.context.view_layer.update()
    if rig in ('camel', 'elephant'):
        height = round(measured_height() * MOUNTED_SCALE * (ELEPHANT_DRAWN if rig == 'elephant' else 1), 3)
    lib.finish(model, parts, spec['colors'], {'name': spec['name'], 'role': role, 'rig': rig, 'look': spec['look'], **({'height': height} if height else {})}, budget, rig != 'frame')
    if height:  # the loader's target height (see the header)
        path = u.out_dir(model) / f'{model}.json'
        opts = json.loads(path.read_text()); opts['height'] = height
        path.write_text(json.dumps(opts, indent=2) + '\n')
    if rig == 'frame':
        path = u.out_dir(model) / f'{model}.json'
        opts = json.loads(path.read_text()); opts['triangleBudget'] = 5000
        path.write_text(json.dumps(opts, indent=2) + '\n')


ALL = list(FOOT) + list(HORSE) + list(CHARIOTS) + list(CAMELS) + list(ELEPHANTS) + list(SPECIAL)
if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or ALL
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
