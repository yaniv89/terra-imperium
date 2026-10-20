# scripts/blender/build_signature_classical.py
# The Classical signature units on foot (the 18 person-rig units of src/data/signatureUnits.js whose age is
# 'classical') on the quality-pass figure with authored clips (2026-10-20, ti_signature.py), one recipe per
# people from the look lines of build_units_classical_signature.py (FOOT) and plans/ART-MODELS-PLAN.md 4.5.
# Its horsemen, chariots, camels, elephants and the stone-thrower stay on that builder.
# The parts the kit lacks (a Negau helmet, a linothorax, a skin helmet, a jaguar helm, a ge-ji halberd,
# crossbows, an atlatl, a staff sling, hats, hair knots) are small helpers below, passed through a recipe's
# `extras` (zero-arg callables) or its custom weapon. The crossbowmen (Qi, Nanyue) take the gun clips
# (shouldered, shoot, reload), the slinger and the javelin troops the spear clips, the archers the bow clips.
# Outputs go to art-build/units/signature/<model>/; copy each GLB to src/assets/units/signature/ and merge
# its "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_classical.py -- [model ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_signature as S  # noqa: E402

BRONZE = ('C2995A', .4, .6)
COPPER = ('B8733F', .4, .65)
IRON = ('8E8A84', .45, .7)
GOLD = ('D4A84A', .35, .8)
OBSIDIAN = ('1E1E26', .25, .3)
P_R, P_L = 'Prop_R', 'Prop_L'
HX, HY = S.HAND_R.x, S.HAND_R.y

# ti_foot_clips.block() calls the spear's hold(pole) without a shield, but melee_spear's hold takes no
# argument (a TypeError for a spear kit without a shield: the staff sling). Until the shared module is fixed,
# the hold is wrapped here so the pole is dropped when it is not taken.
_block = FC.block


def _block_any_hold(L, guard, hold):
    def h(*a):
        try:
            return hold(*a)
        except TypeError:
            return hold()
    return _block(L, guard, h)


FC.block = _block_any_hold


# ---- headgear ---------------------------------------------------------------------------------------------

def negau(mat='Metal'):
    """The Etruscan Negau helmet: a tall bell with a flared rim and a ridge from brow to nape."""
    def make():
        F.lathe('Negau', [(0, 1.082), (.034, 1.074), (.058, 1.046), (.068, 1.000), (.071, .960), (.090, .936), (.093, .928), (.072, .934), (0, .944)], mat, sides=10)
        F.ridge('NegauRidge', [(-.050, 1.040, 1.068), (-.010, 1.070, 1.100), (.040, 1.058, 1.088), (.068, 1.010, 1.036)], mat, half=(.008, .010))
    return make


def montefortino(mat='Metal', plume='Team'):
    """The Celtic iron helmet: a bowl with a top knob and a horsehair tail, cheek pieces."""
    def make():
        F.helmet(mat, cheeks=True, neck=True, peak=1.060)
        F.tube('HelmKnob', [((0, -.003, 1.054), .012, 'Head'), ((0, -.003, 1.074), .016, 'Head'), ((0, -.003, 1.088), .006, 'Head')], mat, 6)
        F.ridge('Plume', [(-.004, 1.064, 1.110), (.040, 1.050, 1.112), (.082, .990, 1.076), (.106, .906, .992), (.112, .846, .884)], plume, half=(.012, .022))
    return make


def skin_helmet(mat='Pelt'):
    """A helmet of wild-animal skin: a hide cap with the beast's ears, the pelt hanging down the back."""
    def make():
        F.cap('SkinCap', mat, height=1.040, attachment=False)
        for s in (-1, 1):
            F.tube(f'PeltEar{s}', [((s * .040, .004, 1.010), (.016, .008), 'Head'), ((s * .052, .006, 1.050), (.010, .006), 'Head'), ((s * .056, .008, 1.072), .002, 'Head')], mat, 4)
        F.tube('PeltTail', [((0, .056, .990), (.060, .022), 'Head'), ((0, .094, .880), (.072, .024), 'Head'), ((0, .108, .770), (.064, .020), 'Chest'),
                            ((0, .112, .690), (.040, .014), 'Chest')], mat, 6)
        F.box('PeltSnout', (0, -.066, .992), (.040, .030, .022), mat, 'Head')
    return make


def jaguar_helm(mat='Jaguar', teeth='Bone'):
    """The Zapotec animal-head helmet: a big hide head over the skull, a snout over the brow, fangs, ears."""
    def make():
        F.lathe('BeastHead', [(0, 1.110), (.048, 1.100), (.078, 1.064), (.088, 1.008), (.086, .958), (.080, .936), (0, .946)], mat, sides=10)
        F.box('BeastSnout', (0, -.084, 1.010), (.090, .070, .050), mat, 'Head')
        F.box('BeastNose', (0, -.122, 1.024), (.036, .012, .020), 'Hair', 'Head')
        for s in (-1, 1):
            F.box(f'BeastFang{s}', (s * .030, -.112, .978), (.012, .012, .030), teeth, 'Head')
            F.box(f'BeastEye{s}', (s * .030, -.090, 1.040), (.018, .014, .010), 'Hair', 'Head')
            F.tube(f'BeastEar{s}', [((s * .050, .000, 1.070), (.018, .010), 'Head'), ((s * .064, .004, 1.112), .003, 'Head')], mat, 4)
        for i, (x, y, z) in enumerate(((.060, .030, 1.050), (-.064, .020, 1.030), (.020, .060, 1.074), (-.030, .070, 1.000))):
            F.box(f'BeastSpot{i}', (x, y, z), (.016, .016, .014), 'Hair', 'Head')
    return make


def tall_hat(mat='Felt'):
    """The Chu officer's tall black hat."""
    def make():
        F.lathe('TallHat', [(0, 1.150), (.032, 1.148), (.044, 1.112), (.052, 1.030), (.068, .978), (.072, .950), (0, .956)], mat, sides=10)
        F.tube('HatTie', [((-.058, -.030, .950), .005, 'Head'), ((-.050, -.040, .880), .005, 'Head'), ((0, -.042, .846), .005, 'Head'),
                          ((.050, -.040, .880), .005, 'Head'), ((.058, -.030, .950), .005, 'Head')], 'Felt', 3)
    return make


def felt_hat(mat='Felt'):
    """The Tarim felt hat: a rounded crown with a rolled brim."""
    def make():
        F.lathe('FeltHat', [(0, 1.092), (.040, 1.086), (.064, 1.044), (.071, .990), (.082, .962), (.086, .946), (.074, .940), (0, .948)], mat, sides=10)
    return make


def turban(mat='Cloth', jewel='Gold'):
    """A wound turban with a jewel at the front."""
    def make():
        F.lathe('Turban', [(0, 1.050), (.050, 1.044), (.076, 1.016), (.082, .982), (.078, .950), (.068, .938), (0, .944)], mat, sides=10)
        F.ridge('TurbanWrap', [(-.078, .952, .994), (-.040, .980, 1.030), (.020, 1.000, 1.044), (.070, .990, 1.020)], mat, half=(.040, .030))
        F.box('TurbanJewel', (0, -.082, .992), (.022, .010, .026), jewel, 'Head')
    return make


def topknot(ribbon='Team'):
    """Hair drawn up into a knot on the crown, tied with a ribbon."""
    def make():
        F.hair()
        F.tube('Topknot', [((0, .010, 1.000), .022, 'Head'), ((0, .012, 1.040), .026, 'Head'), ((0, .014, 1.072), .012, 'Head')], 'Hair', 6)
        F.tube('TopknotTie', [((0, .010, 1.004), .024, 'Head'), ((0, .010, 1.018), .024, 'Head')], ribbon, 6, caps=(False, False))
    return make


def suebian_knot():
    """The Suebian knot: the hair combed to the right side of the head and knotted there."""
    def make():
        F.hair()
        F.tube('SuebianKnot', [((-.050, .010, .990), .020, 'Head'), ((-.074, .012, 1.006), .030, 'Head'), ((-.094, .014, 1.016), .014, 'Head')], 'Hair', 6)
    return make


def mizura():
    """Yayoi hair: a cap of hair with a loop tied at each side of the head."""
    def make():
        for s in (-1, 1):
            F.tube(f'Mizura{s}', [((s * .060, .004, .936), .012, 'Head'), ((s * .082, -.004, .900), .016, 'Head'), ((s * .078, .000, .860), .014, 'Head'),
                                  ((s * .062, .008, .872), .010, 'Head')], 'Hair', 5)
    return make


def hair_buns():
    """The Nok sculptures' hair: three buns and a crest over a cap of hair."""
    def make():
        F.hair()
        for i, (x, y, z) in enumerate(((-.054, .010, 1.000), (.054, .010, 1.000), (0, .060, .990))):
            F.tube(f'HairBun{i}', [((x, y, z - .020), .018, 'Head'), ((x * 1.15, y * 1.1, z + .006), .028, 'Head'), ((x * 1.2, y * 1.15, z + .030), .010, 'Head')], 'Hair', 6)
        F.ridge('HairCrest', [(-.046, .990, 1.030), (-.010, 1.000, 1.066), (.030, .996, 1.060), (.056, .980, 1.020)], 'Hair', half=(.012, .016))
    return make


def moustache():
    def make():
        F.tube('Moustache', [((-.040, -.052, .858), .006, 'Head'), ((-.018, -.064, .878), .009, 'Head'), ((.018, -.064, .878), .009, 'Head'),
                             ((.040, -.052, .858), .006, 'Head')], 'Hair', 4)
    return make


def feather_crown(mat='Feather', band='Team', n=7, tall=.150):
    """A wide feather headdress over a Team headband (Teotihuacan, Hopewell)."""
    return lambda: S.headgear('feathers', mat=mat, band=band, n=n, tall=tall)


# ---- body dress and armour ------------------------------------------------------------------------------------

def linothorax(mat='Linen', strips='Linen'):
    """The linen cuirass with two rows of pteruges below it."""
    def make():
        F.torso('Linothorax', mat, grow=.010, chest=.006)
        F.strips('Pteruges', strips, .505, .398, n=10, grow=.010)
        F.strips('PterugesUpper', strips, .548, .462, n=10, grow=.015, phase=.5)
    return make


def lacquer_strips(mat='Lacquer'):
    return lambda: F.strips('LacquerSkirt', mat, .540, .420, n=10, grow=.016)


def breastplate(mat='Metal'):
    """A bronze plate over the chest on straps."""
    def make():
        F.slab('Breastplate', [(-.082, -.096, .760), (.082, -.096, .760), (.072, -.090, .618), (-.072, -.090, .618)], mat, 'Chest', depth=.010)
        for s in (-1, 1):
            F.tube(f'PlateStrap{s}', [((s * .060, -.090, .760), (.010, .004), 'Chest'), ((s * .070, -.020, .800), (.010, .004), 'Chest'), ((s * .060, .070, .760), (.010, .004), 'Chest')], 'Leather', 4)
    return make


def gorget(mat='Metal'):
    """A Hopewell copper breastplate (a round disc on the chest) and copper ear spools."""
    def make():
        F.tube('CopperDisc', [((0, -.086, .700), .052, 'Chest'), ((0, -.096, .700), .050, 'Chest')], mat, 10)
        F.tube('DiscCord', [((-.050, -.060, .760), .004, 'Chest'), ((0, -.050, .786), .004, 'Chest'), ((.050, -.060, .760), .004, 'Chest')], 'Leather', 3)
        for s in (-1, 1):
            F.tube(f'EarSpool{s}', [((s * .060, .002, .902), .012, 'Head'), ((s * .070, .002, .902), .012, 'Head')], mat, 6)
    return make


def quilted(mat='Cotton'):
    """Quilted cotton armour over the trunk (the kit's armour 'quilt' passes ribs=6, a share above 1 that
    throws the quilted columns out sideways, so it is built here with a share of 0.06)."""
    return lambda: F.torso('Quilted', mat, grow=.012, chest=.008, ribs=.06)


def bare_chest():
    """The bare trunk (dress 'none' and the kit's 'kilt' build no trunk of their own)."""
    return lambda: F.torso('BareChest', 'Skin')


def skirt(mat='Cloth', low=.400, name='Loincloth', ribs=0.):
    """A short skirt or loincloth (Hips) for a bare-chested man."""
    return lambda: F.skirt(name, mat, low=low, top=.548, sides=10, ribs=ribs)


def belt(mat='Leather', dagger=True):
    """A belt with a dagger at the right hip."""
    def make():
        F.band('Belt', mat, .540, .560, grow=.018, bone='Spine')
        if dagger:
            F.tube('BeltDagger', [((-.118, -.040, .560), (.010, .016), 'Hips'), ((-.126, -.050, .470), (.008, .012), 'Hips'), ((-.128, -.054, .430), .003, 'Hips')], 'Leather', 4)
            F.box('BeltDaggerHilt', (-.116, -.038, .580), (.014, .020, .030), 'Metal', 'Hips')
    return make


def torc(mat='Gold'):
    return lambda: F.tube('Torc', F.vertical([.784, .800], 0, [(.054, .050), (.052, .048)], 'Neck'), mat, 8, caps=(False, False))


def arm_bands(mat, where=(.55,), name='ArmBand', r=.040):
    """Bands round both arms at shares of the way from the shoulder to the wrist (armlets, beads, tattoos)."""
    def make():
        B = F.arm.data.bones
        for side in 'LR':
            sh, el, wr = B['Arm_' + side].head_local, B['Forearm_' + side].head_local, B['Hand_' + side].head_local
            for k, t in enumerate(where):
                a, b, bone = (sh, el, 'Arm_' + side) if t < 1 else (el, wr, 'Forearm_' + side)
                tt = t if t < 1 else t - 1
                c0, c1 = a.lerp(b, max(0, tt - .05)), a.lerp(b, min(1, tt + .05))
                rr = r * (1 - .25 * (t >= 1))
                F.tube(f'{name}{side}{k}', [(tuple(c0), rr, bone), (tuple(c1), rr, bone)], mat, 6, caps=(False, False))
    return make


def pebble_pouch():
    """The slinger's big pouch of beach pebbles at the left hip."""
    def make():
        F.tube('PebblePouch', [((.128, -.030, .540), (.026, .022), 'Hips'), ((.140, -.036, .470), (.046, .040), 'Hips'), ((.136, -.032, .410), (.030, .026), 'Hips')], 'Leather', 6)
        for i, (x, z) in enumerate(((.124, .556), (.146, .552))):
            F.tube(f'Pebble{i}', [((x, -.032, z - .010), .010, 'Hips'), ((x, -.032, z + .008), .012, 'Hips')], 'Stone', 5)
    return make


def hip_quiver(mat='Leather', fletch='Cloth'):
    """A bolt quiver at the right hip."""
    def make():
        F.tube('BoltQuiver', [((-.136, .030, .350), (.024, .032), 'Hips'), ((-.142, .040, .540), (.030, .040), 'Hips')], mat, 6)
        for i, dx in enumerate((-.010, .010)):
            F.tube(f'Bolt{i}', [((-.142 + dx, .040, .530), (.006, .010), 'Hips'), ((-.142 + dx, .044, .600), (.006, .010), 'Hips')], fletch, 4)
    return make


def cloak(mat='Fur', low=.460):
    return lambda: F.cloak('Cloak', mat, low=low)


def greaves(mat='Metal'):
    return lambda: F.greaves(mat)


def spare_javelins(n=2, length=1.30):
    """Spare javelins upright in the left fist behind the shield."""
    def make():
        x, y = S.HAND_L.x + .010, S.HAND_L.y + .030
        for i in range(n):
            dx = (i - (n - 1) / 2) * .016
            F.tube(f'JavelinSpare{i}', [((x + dx, y, .140), .006, P_L), ((x + dx, y, .140 + length / 1.75 * .95), .005, P_L)], 'Wood', 4, attachment=True)
            top = .140 + length / 1.75 * .95
            F.tube(f'JavelinSpareHead{i}', [((x + dx, y, top), (.010, .004), P_L), ((x + dx, y, top + .060), .001, P_L)], 'Metal', 4, attachment=True)
    return make


# ---- weapons (custom: each returns its clip Kit) ----------------------------------------------------------------

def crossbow(repeating=False, prod='Wood', stock='Wood'):
    """A crossbow upright in the right fist, the bolt groove towards the chest (its top when it is shouldered):
    the stock from below the fist past the prod, the bronze lock and trigger, the prod across the top with
    its string drawn to the nut and a bolt laid. `repeating`: the Nanyue magazine over the groove.
    The gun clips aim it (shouldered, shoot, a fresh bolt laid)."""
    def make():
        x, y = HX, HY
        F.tube('CrossbowStock', [((x, y + .004, .440), (.012, .021), P_R), ((x, y, .560), (.011, .016), P_R), ((x, y, .650), (.011, .015), P_R),
                                 ((x, y, 1.010), (.009, .012), P_R)], stock, 5, attachment=True)
        F.box('CrossbowLock', (x, y + .010, .770), (.018, .030, .056), 'Metal', P_R, True)
        F.box('CrossbowTrigger', (x, y - .030, .742), (.007, .030, .012), 'Metal', P_R, True)
        F.tube('CrossbowProd', [((x - .150, y + .002, .950), .006, P_R), ((x - .075, y, .986), .009, P_R), ((x, y, 1.000), .012, P_R),
                                ((x + .075, y, .986), .009, P_R), ((x + .150, y + .002, .950), .006, P_R)], prod, 5, attachment=True)
        F.tube('CrossbowString', [((x - .148, y + .004, .948), .0025, P_R), ((x, y + .022, .790), .0025, P_R), ((x + .148, y + .004, .948), .0025, P_R)],
               'Cloth', 3, attachment=True)
        F.tube('CrossbowBolt', [((x, y + .020, .790), .0040, P_R), ((x, y + .020, 1.050), .0040, P_R)], 'Wood', 4, attachment=True)
        F.tube('CrossbowBoltHead', [((x, y + .020, 1.046), (.008, .004), P_R), ((x, y + .020, 1.080), .001, P_R)], 'Metal', 4, attachment=True)
        if repeating:
            F.box('CrossbowMagazine', (x, y + .036, .890), (.026, .024, .190), stock, P_R, True)
            F.tube('CrossbowLever', [((x + .006, y + .020, .620), .006, P_R), ((x + .006, y + .040, .760), .006, P_R), ((x + .006, y + .046, .820), .006, P_R)],
                   'Wood', 4, attachment=True)
        return FC.Kit('gun')
    return make


def ge_ji(length=2.5, shield_size=.80):
    """The Chu halberd: a long black-lacquered haft, a spear tip and a dagger-axe blade to the front, with the
    red-black lacquered shield (Emblem) on the left arm."""
    def make():
        x, y = HX, HY
        top = .040 + length / 1.75
        F.tube('HalberdShaft', [((x, y, .040), .0100, P_R), ((x, y, top), .0085, P_R)], 'Lacquer', 6, caps=(True, False), attachment=True)
        F.tube('HalberdButt', [((x, y, .006), .003, P_R), ((x, y, .040), .012, P_R)], 'Metal', 4, attachment=True)
        F.tube('HalberdSocket', [((x, y, top - .060), .0120, P_R), ((x, y, top), .0105, P_R)], 'Metal', 6, attachment=True)
        F.tube('HalberdTip', [((x, y, top - .004), (.008, .008), P_R), ((x, y, top + .040), (.016, .006), P_R), ((x, y, top + .110), .0015, P_R)], 'Metal', 4, attachment=True)
        F.tube('HalberdBlade', [((x, y - .008, top - .050), (.022, .004), P_R), ((x, y - .080, top - .066), (.018, .004), P_R),
                                ((x, y - .150, top - .090), (.003, .002), P_R)], 'Metal', 4, attachment=True)
        S.shield('rect', size=shield_size, rim='Lacquer', back='Wood')
        return FC.Kit('spear', shield=True)
    return make


def atlatl_dart(shield_size=1.1):
    """A spear-thrower: the dart upright through the fist, the atlatl board along it; a small round shield
    with a feather fringe on the left arm."""
    def make():
        x, y = HX, HY
        F.tube('JavelinDart', [((x, y, .260), .0060, P_R), ((x, y, 1.300), .0055, P_R)], 'Wood', 4, attachment=True)
        F.tube('JavelinDartHead', [((x, y, 1.296), (.012, .004), P_R), ((x, y, 1.340), (.008, .003), P_R), ((x, y, 1.376), .001, P_R)], 'Obsidian', 4, attachment=True)
        F.tube('JavelinDartFletch', [((x, y, .280), (.003, .016), P_R), ((x, y, .360), (.003, .010), P_R)], 'Feather', 4, attachment=True)
        F.tube('AtlatlBoard', [((x, y + .020, .560), (.010, .006), P_R), ((x, y + .020, .960), (.012, .005), P_R), ((x, y + .014, .990), (.004, .010), P_R)],
               'Wood', 4, attachment=True)
        S.shield('small', size=shield_size, rim='Feather', back='Wood')
        return FC.Kit('spear', shield=True)
    return make


def staff_sling():
    """A staff sling (fustibalus): a stave with the sling's cords hanging from its head and the loaded pouch."""
    def make():
        x, y = HX, HY
        F.tube('SlingStaff', [((x, y, .060), .0095, P_R), ((x, y, 1.150), .0085, P_R)], 'Wood', 5, attachment=True)
        F.tube('SlingCord', [((x, y, 1.150), .003, P_R), ((x, y - .020, 1.100), .003, P_R), ((x, y - .034, 1.010), .003, P_R)], 'Leather', 3, attachment=True)
        F.tube('SlingPouch', [((x, y - .034, 1.020), .010, P_R), ((x, y - .036, .990), .020, P_R), ((x, y - .034, .960), .008, P_R)], 'Leather', 5, attachment=True)
        return FC.Kit('spear')
    return make


# ---- the recipes ---------------------------------------------------------------------------------------------------

RECIPES = {
    'aghvank': dict(name='Aghvank skin-helmed javelin and bow troops', role='ranged',
                    colors={'Skin': 'C99472', 'Leather': '7A5A3A', 'Metal': BRONZE, 'Cloth': 'D9CDA8', 'Pelt': '8A6A48', 'Hair': '2A1E16'},
                    legs='sandals', dress='tunic', team='top', beard=True,
                    weapon=('javelin', {'length': 1.6, 'head': 'narrow'}), shield=('rect', {'size': .82, 'rim': 'Leather'}),
                    extras=[breastplate('Metal'), skin_helmet('Pelt')],
                    look='Aghvank (Caucasian Albanian) javelin man: a helmet of wild-animal skin with ears and the pelt down the back, a bronze breastplate over a Team tunic top, '
                         'a large oblong shield (Emblem), a javelin'),
    'nabataea': dict(name='Nabataean cliff archers', role='ranged',
                     colors={'Skin': 'B98258', 'Cloth': 'D9C38E', 'Leather': '7A5236', 'Metal': BRONZE, 'Straw': 'E0C27A', 'Hair': '2A1E16'},
                     legs='sandals', dress='robe', team='top', beard=True,
                     weapon=('bow', {'length': .90}),
                     extras=[lambda: F.straw_hat('NabataeanHat', 'Straw', band='Team', brim=.150), belt('Leather')],
                     look='Nabataean archer: an ankle-length tunic with a Team top, the wide straw hat of the Petra frieze with a Team band, a dagger belt, a bow and a quiver'),
    'mauretania': dict(name='Mauri javelin skirmishers', role='infantry',
                       colors={'Skin': '9A6444', 'Cloth': 'EEE4CC', 'Leather': '8A6040', 'Wood': '3A2A1E', 'Hair': '1E1612', 'Rope': 'B8A07A'},
                       legs='bare', dress='tunic', team='sash', beard=True, hair='full',
                       weapon=('javelin', {'length': 1.5, 'head': 'narrow'}), shield=('small', {'size': 1.0, 'rim': 'Leather', 'back': 'Leather'}),
                       extras=[lambda: F.band('RopeBelt', 'Rope', .566, .582, grow=.018, bone='Spine'), spare_javelins(2)],
                       look='Mauri skirmisher: bare feet, a short white tunic, curly hair and beard, a rope belt over a Team sash, a javelin and two spares, a small leather shield (Emblem)'),
    'rasenna': dict(name='Rasenna hoplite phalanx', role='infantry',
                    colors={'Skin': 'C99472', 'Cloth': 'B04A32', 'Linen': 'F0E8D4', 'Metal': BRONZE, 'Hair': '2A1E16'},
                    legs='sandals', dress='none', team='sash', beard=True, shoulder='Linen',
                    weapon=('spear', {'length': 2.2}), shield=('round', {'size': 1.18}),
                    extras=[skirt('Cloth', .370, 'Tunic'), linothorax('Linen'), greaves('Metal'), negau('Metal')],
                    look='Etruscan hoplite: a bronze Negau helmet with a ridge, a white linen cuirass and pteruges over a red tunic, a Team sash, bronze greaves, '
                         'a big round shield (Emblem), a spear'),
    'belgae': dict(name='Belgic noble swordsmen', role='infantry',
                   colors={'Skin': 'D9A07A', 'Cloth': 'C9B58C', 'Trews': '7A4A2C', 'Metal': IRON, 'Leather': '6E4A30', 'Gold': GOLD, 'Hair': 'B08A50'},
                   legs=('hose', 'Trews'), dress='none', armour='mail', armour_mat='Metal', team='sash', beard=False,
                   weapon=('sword', {'length': .56}), shield=('oval', {'size': 1.0, 'boss': 'Metal'}),
                   extras=[skirt('Cloth', .420, 'Tunic'), montefortino('Metal', 'Team'), moustache(), torc('Gold')],
                   look='Belgic noble: an iron mail shirt over brown trousers, a gold torc, a long moustache, an iron helmet with a knob and a Team horsehair plume, '
                        'a long sword, a tall oval shield with an iron boss (Emblem)'),
    'cherusci': dict(name='Cherusci forest ambushers', role='infantry',
                     colors={'Skin': 'DDA884', 'Leather': '6B4A30', 'Wood': '7A5A38', 'Metal': IRON, 'Cloth': '5E5440', 'Fur': '5A4632', 'Hair': '8A6438'},
                     legs=('hose', 'Cloth'), dress='none', team='sash', beard=True, hair=None,
                     weapon=('spear', {'length': 2.0, 'head': 'narrow'}), shield=('round', {'size': .95, 'rim': 'Wood'}),
                     extras=[bare_chest(), skirt('Cloth', .420, 'Breeches'), cloak('Fur', .440), suebian_knot()],
                     look='Germanic ambusher: bare chest under a fur cloak, wool breeches, a Team waist sash, a Suebian hair knot and beard, a framea spear, a round board shield (Emblem)'),
    'durotriges': dict(name='Durotrigan hillfort slingers', role='ranged',
                       colors={'Skin': 'DDA884', 'Cloth': '8A9A6A', 'Leather': '7E5A3A', 'Wood': '8A5A30', 'Stone': 'B8B4AA', 'Fur': '6E5A44', 'Hair': 'A0582C'},
                       legs=('hose', 'Cloth'), dress='trousers', team='top', beard=True, hair='full',
                       weapon=('custom', {'make': staff_sling()}),
                       extras=[cloak('Fur', .600), pebble_pouch()],
                       look='Durotrigan slinger: bare head of red hair, a Team tunic over green trousers, a short hide cloak, a staff sling with its loaded pouch, a big pouch of beach pebbles'),
    'kroraina': dict(name='Kroraina oasis archers', role='ranged',
                     colors={'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Leather': '7A5236', 'Felt': 'E6DDC5', 'Trouser': '6A5A44', 'Hair': '3A2A1E'},
                     legs=('hose', 'Trouser'), sleeves='Cloth', dress='tunic', team='top', beard=True,
                     weapon=('bow', {'length': .84, 'recurve': .03}),
                     extras=[felt_hat('Felt'), belt('Leather', dagger=False)],
                     look='Kroraina oasis archer: a white felt hat with a rolled brim, a belted wool tunic with long sleeves and a Team top, trousers and boots, a short recurved bow and a quiver'),
    'kosala': dict(name='Kosalan foot archers', role='ranged',
                   colors={'Skin': '9A6444', 'Cloth': 'F0E8D4', 'Wood': '6A4A30', 'Gold': GOLD, 'Hair': '1E1612'},
                   legs='bare', dress='none', team='sash', beard=True,
                   weapon=('bow', {'length': 1.15, 'recurve': .03}),
                   extras=[bare_chest(), skirt('Cloth', .260, 'Dhoti'), turban('Cloth', 'Gold'), arm_bands('Gold', (.25,), 'Armlet', .042)],
                   look='Kosalan archer: a long white dhoti with a Team waist sash, bare chest with gold armlets, a white turban with a jewel, a tall bamboo bow and a quiver'),
    'chu': dict(name='Chu halberdiers', role='infantry',
                colors={'Skin': 'D2A47E', 'Lacquer': '6E2A20', 'Metal': BRONZE, 'Cloth': '2A2420', 'Felt': '1A1614', 'Wood': '3A2A1E', 'Hair': '1A1412'},
                legs=('hose', 'Cloth'), dress='none', armour='leather', armour_mat='Lacquer', team='sash', beard=True, shoulder='Lacquer',
                weapon=('custom', {'make': ge_ji(2.5, .80)}),
                extras=[skirt('Cloth', .380, 'Tunic'), lacquer_strips('Lacquer'), tall_hat('Felt')],
                look='Chu halberdier: red-black lacquered leather armour with a lacquered skirt and shoulder guards over a dark tunic and trousers, a Team sash, '
                     'a tall black hat, the long ge-ji halberd, a lacquered shield (Emblem)'),
    'qi': dict(name='Qi crossbowmen of Maling', role='ranged',
               colors={'Skin': 'D2A47E', 'Lacquer': '4A2A24', 'Leather': '5E2E22', 'Metal': BRONZE, 'Cloth': '3A4048', 'Wood': '6A4A30', 'Hair': '1A1412'},
               legs=('hose', 'Cloth'), dress='tunic', armour='scale', armour_mat='Lacquer', team=None, beard=False, hair=None,
               weapon=('custom', {'make': crossbow(False, 'Wood', 'Wood')}),
               extras=[lambda: F.band('TeamSash', 'Team', .512, .566, grow=.034, bone='Spine'), topknot('Team'), hip_quiver('Leather'), belt('Leather')],
               look='Qi crossbowman: dark lacquered lamellar over a slate tunic and trousers, a Team sash over the lamellar, the hair in a topknot tied with a Team ribbon, '
                    'a bronze-locked crossbow held upright, a bolt quiver and a short sword'),
    'yue': dict(name='Yue sword-masters', role='infantry',
                colors={'Skin': 'C48A62', 'Cloth': 'E6DDC5', 'Metal': BRONZE, 'Wood': '9A7448', 'Rattan': 'B89A5A', 'Tattoo': '2E3A5A', 'Hair': '1A1412'},
                legs='bare', dress='none', team='sash', beard=False, hair='full',
                weapon=('sword', {'length': .58}), shield=('round', {'size': .80, 'rim': 'Rattan', 'back': 'Rattan'}),
                extras=[bare_chest(), skirt('Cloth', .400, 'ShortKilt'), arm_bands('Tattoo', (.35, .65, 1.4, 1.7), 'Tattoo', .042)],
                look='Yue swordsman: cropped hair, bare chest and bare feet, tattooed arms, a short white kilt with a Team sash, a long bronze sword, a rattan shield (Emblem)'),
    'nanyue': dict(name='Nanyue crossbowmen', role='ranged',
                   colors={'Skin': 'C48A62', 'Leather': 'A07A4A', 'Metal': BRONZE, 'Cloth': 'DCCFAE', 'Wood': '7A5636', 'Hair': '1A1412'},
                   legs='sandals', dress='none', armour='leather', armour_mat='Leather', team='sash', beard=False,
                   head=('headcloth', {'band': 'Team'}),
                   weapon=('custom', {'make': crossbow(True, 'Wood', 'Wood')}),
                   extras=[skirt('Cloth', .370, 'Tunic'), belt('Metal')],
                   look='Nanyue crossbowman: a linen headcloth with a Team band, a tan leather corselet over a pale tunic, sandals, a repeating crossbow with its magazine, a short sword'),
    'yamatai': dict(name='Yamataian bowmen', role='ranged',
                    colors={'Skin': 'D9AE88', 'Cloth': 'E6DDC5', 'Leather': '7A5236', 'Wood': '6A4A30', 'Hair': '1A1412'},
                    legs='bare', dress='tunic', team='top', beard=True, hair='full',
                    weapon=('bow', {'length': 1.20}),
                    extras=[mizura(), lambda: F.band('TieBelt', 'Leather', .548, .566, grow=.018, bone='Spine')],
                    look='Yayoi bowman: the hair tied in a loop at each side, a poncho tunic with a Team top, bare legs and feet, a very long bow and a quiver'),
    'nok': dict(name='Nok heavily armed warriors', role='infantry',
                colors={'Skin': '6E4430', 'Wood': '2A1E16', 'Cloth': 'C98A4A', 'Metal': IRON, 'Bead': 'D9C7A0', 'Hair': '140E0A'},
                legs='bare', dress='none', team='sash', beard=True, hair=None,
                weapon=('spear', {'length': 2.1, 'head': 'broad'}), shield=('small', {'size': 1.05, 'rim': 'Wood', 'back': 'Wood'}),
                extras=[bare_chest(), skirt('Cloth', .400, 'Wrap'), hair_buns(), arm_bands('Bead', (.15, 1.85), 'Beads', .040)],
                look='Nok warrior after the terracotta heads: the hair in three buns and a crest, bare chest, bead armlets and wristlets, an ochre wrap with a Team sash, '
                     'a broad iron spear, a small shield (Emblem)'),
    'teotihuacan': dict(name='Teotihuacan atlatl warriors', role='ranged',
                        colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Cotton': 'F2ECDC', 'Wood': '5A4130', 'Feather': '2E8A5A', 'Obsidian': OBSIDIAN, 'Hair': '1A1412'},
                        legs='sandals', dress='none', team='sash', beard=False,
                        weapon=('custom', {'make': atlatl_dart(1.1)}),
                        extras=[quilted('Cotton'), skirt('Cotton', .420, 'QuiltSkirt', .06), feather_crown('Feather', 'Team', 7, .150)],
                        look='Teotihuacan warrior: a green feather headdress on a Team band, quilted white cotton armour and skirt, a Team sash, an atlatl and an obsidian dart, '
                             'a round shield with a feather rim (Emblem)'),
    'zapotec': dict(name='Zapotec obsidian-spear warriors', role='infantry',
                    colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Cotton': 'D8C08A', 'Leather': '8A6A40', 'Jaguar': 'D0A040', 'Bone': 'F0EAD8',
                            'Obsidian': OBSIDIAN, 'Wood': '6A4A30', 'Hair': '1A1412'},
                    legs='sandals', dress='none', team='sash', beard=False,
                    weapon=('spear', {'length': 2.0, 'head': 'broad', 'mat': 'Obsidian'}), shield=('rect', {'size': .72, 'rim': 'Leather'}),
                    extras=[quilted('Cotton'), skirt('Cotton', .400, 'QuiltSkirt', .06), jaguar_helm('Jaguar', 'Bone')],
                    look='Zapotec warrior: a spotted jaguar-head helmet with fangs over the face, ochre quilted cotton armour and skirt, a Team sash, '
                         'an obsidian-bladed spear, a wooden shield (Emblem)'),
    'hopewell': dict(name='Hopewell copper-ornament warriors', role='infantry',
                     colors={'Skin': 'A8724E', 'Leather': '8A6A40', 'Metal': COPPER, 'Cloth': 'E8D9B0', 'Feather': 'E8E0CC', 'Hair': '1A1412'},
                     legs='bare', dress='none', team='sash', beard=False, hair='full',
                     weapon=('axe', {'length': .50}), shield=('round', {'size': .85, 'rim': 'Leather', 'back': 'Leather'}),
                     extras=[bare_chest(), skirt('Leather', .400, 'Breechcloth'), gorget('Metal'), feather_crown('Feather', 'Team', 3, .150)],
                     look='Hopewell warrior: a round copper breastplate and copper ear spools, three white feathers on a Team headband, a leather breechcloth with a Team sash, '
                          'a copper axe, a round hide shield (Emblem)'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        S.foot(m, RECIPES[m])
