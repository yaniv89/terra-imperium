# scripts/blender/build_signature_modern.py
# The Modern signature FOOT units on the quality-pass figure with authored clips (2026-10-20, ti_signature.py),
# one recipe per people from the look lines of build_units_modern_signature.py and plans/ART-MODELS-PLAN.md 4.5
# (the tanks and the Kindah camel riflemen stay on that builder). Generic: no real army's insignia or flags.
# Every man holds a bolt-action rifle (bolt_rifle below) the way the Modern base units hold theirs:
#   - in both fists, upright before the right side of the chest (build_modern_infantry.py), or
#   - low in the right fist, the left thumb in a strap (build_modern_mercenary.py; the two skirmishers)
# so the gun clips (Aim-fire-reload: shouldered, fire, the magazine hand) work; the rifle stays under 0.75
# long (ti_foot_clips treats a longer gun as a muzzle-loader and rams it).
# Team only on Spine, Chest and Head parts (the tunic, the anorak, the shamma's border); flat colours.
# Outputs go to art-build/units/signature/<model>/; copy each GLB to src/assets/units/signature/ and merge its
# "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_modern.py -- [model ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mathutils import Vector as V  # noqa: E402

import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_signature as S  # noqa: E402

IRON = ('4A4C4E', .4, .7)
HELD = {}  # the right fist's grip, set by the fists and read by the rifle


# ---- hands and the rifle ---------------------------------------------------------------------------------------

def both_fists(mat='Skin'):
    """Both fists on the rifle, upright before the right side of the chest (the Modern rifleman's)."""
    def place():
        grip = (-.074, -.174, .596)
        F.hold('R', grip, pole=(-1, .6, -.5))
        F.hold('L', (grip[0] + .004, grip[1] - .002, grip[2] + .190), pole=(1, -.2, -.9))
        F.bake_rest()
        HELD['grip'] = F.fist('R', None, (0, 0, 1), half=.022, mat=mat)
        F.fist('L', None, (0, 0, 1), half=.022, mat=mat)
        HELD['two'] = True
    return place


def low_fist(mat='Skin'):
    """The rifle low in the right fist, the left thumb hooked in a strap on the chest (the mercenary's)."""
    def place():
        F.hold('R', (-.150, -.150, .560), pole=(-1, .4, -.5))
        F.hold('L', (.062, -.122, .705), pole=(1, .2, -.8))
        F.bake_rest()
        HELD['grip'] = F.fist('R', None, (0, 0, 1), half=.022, mat=mat)
        F.fist('L', None, (0, 1, 0), half=.018, mat=mat)
        HELD['two'] = False
    return place


def bolt_rifle(below=.170, above=.420, bayonet=0., prop='Prop_R'):
    """A bolt-action rifle upright, muzzle up, its wrist in the right fist: the wooden butt below, the
    receiver with its bolt handle out to the right, the wooden fore-end and the barrel above, a knife
    bayonet on the muzzle (`bayonet` long). One thin upright piece like F.assault_rifle (the far detail
    level keeps it). Returns the gun Kit for the fists placed before."""
    g = HELD['grip']
    x, y, z = g.x, g.y + .016, g.z
    F.tube('RifleStock', [((x, y + .004, z - below), (.010, .030), prop), ((x, y + .002, z - below + .060), (.010, .026), prop),
                          ((x, y, z - .030), (.009, .015), prop), ((x, y, z + .020), (.010, .014), prop)], 'Wood', 6, attachment=True)
    F.box('RifleBody', (x, y, z + .060), (.020, .026, .080), 'Gun', prop, True)
    F.tube('RifleBolt', [((x - .008, y + .004, z + .072), .004, prop), ((x - .034, y + .004, z + .066), .006, prop)], 'Gun', 4, attachment=True)
    F.tube('RifleFore', [((x, y, z + .100), (.011, .015), prop), ((x, y, z + .320), (.009, .012), prop)], 'Wood', 6, caps=(False, True), attachment=True)
    F.tube('RifleMuzzle', [((x, y, z + .300), .0058, prop), ((x, y, z + above), .0052, prop)], 'Gun', 5, caps=(False, True), attachment=True)
    F.tube('RifleSling', [((x, y + .016, z - below + .060), .003, prop), ((x, y + .020, z + .120), .003, prop),
                          ((x, y + .014, z + .290), .003, prop)], 'Leather', 3, attachment=True)
    if bayonet:
        t = z + above
        F.tube('Bayonet', [((x, y - .006, t - .040), (.004, .011), prop), ((x, y - .006, t + bayonet * .55), (.0035, .011), prop),
                           ((x, y - .006, t + bayonet), (.001, .002), prop)], 'Metal', 4, attachment=True)
    return FC.Kit('gun', two_hands=HELD['two'], bayonet=bool(bayonet))


def rifle(**k):
    return ('custom', {'make': lambda: bolt_rifle(**k)})


# ---- clothes and kit ---------------------------------------------------------------------------------------------

def tunic(mat='Team', belt='Leather', skirts=None):
    """A wool field tunic on the trunk (Spine and Chest), a belt; `skirts`: its skirts to the hip (on the
    Spine: they dye with the tunic), lined in that material."""
    def f():
        F.torso('Tunic', mat, grow=.008, chest=.004)
        F.band('Belt', belt, .528, .552, grow=.016, bone='Spine')
        if skirts:
            F.coat_skirts('TunicSkirt', mat, lining=skirts, low=.440, top=.552, grow=.016, flare=.012, open_deg=14, cols=10)
    return f


def trousers(mat, pockets=False):
    return lambda: F.cargo_trousers(mat, pads=None, pockets=pockets)


def puttees(mat='Puttee', top=.268):
    return lambda: F.gaiters(mat, top=top, sides=7)


def cartridge_pouches(mat='Leather', z=.540):
    def f():
        for s in (-1, 1):
            F.box(f'AmmoPouch_{s}', (s * .056, -.090, z), (.046, .026, .040), mat, 'Spine')
    return f


def bandolier(mat='Leather', which='R', grow=.022):
    """A cartridge bandolier over one shoulder ('R': from the right shoulder; 'LR': crossed)."""
    return lambda: F.cross_belts('Bandolier', mat, plate=None, low=.520, high=.800, width=.032, grow=grow, chest=.008, which=which)


def rucksack(mat='Pack', strap='Leather'):
    def f():
        F.box('Rucksack', (0, .122, .640), (.168, .070, .176), mat, 'Spine')
        F.box('RucksackFlap', (0, .124, .716), (.172, .078, .040), mat, 'Chest')
        F.tube('Bedroll', [((-.096, .118, .752), .028, 'Chest'), ((.096, .118, .752), .028, 'Chest')], strap, 6)
    return f


def moustache():
    F.box('Moustache', (0, -.0625, .887), (.050, .010, .011), 'Hair', 'Head')


def collar_badges():
    """Red and white collar patches (a generic regimental colour, no real badge)."""
    for s in (-1, 1):
        F.box(f'CollarPatch_{s}', (s * .040, -.050, .782), (.030, .010, .020), 'Red', 'Chest')
        F.box(f'CollarStripe_{s}', (s * .040, -.0560, .782), (.010, .004, .021), 'White', 'Chest')


def adrian_helmet(mat='Helmet'):
    """A WWI steel helmet of the Adrian kind: a round crown, a brim deeper front and back, a low comb."""
    F.lathe('Helmet', [(0, 1.050), (.036, 1.046), (.058, 1.028), (.070, 1.002), (.075, .975), (.077, .958), (0, .958)], mat, sides=12)
    rows = [[], [], []]
    n = 12
    for j in range(n):
        a = 2 * math.pi * j / n
        c = abs(math.cos(a))
        r = .092 + .026 * c ** 2
        zr = .952 - .006 * c
        for k, (rr, zz) in enumerate(((.076, .960), (r, zr), (.076, .951))):
            rows[k].append((rr * math.sin(a), -rr * math.cos(a) * .96 - .003, zz))
    F.sweep('HelmetBrim', rows, mat)
    F.ridge('HelmetComb', [(-.056, 1.022, 1.034), (-.030, 1.042, 1.062), (.026, 1.043, 1.063), (.054, 1.024, 1.036)], mat, half=(.006, .004))


def mountain_beret(mat='Felt', badge='White'):
    """The big floppy mountain beret, pulled down over the left side, a small white flower badge."""
    ob = F.lathe('Beret', [(0, 1.000), (.070, .998), (.112, .990), (.120, .978), (.104, .964), (.072, .956), (0, .958)], mat, sides=12)
    for v in ob.data.vertices:
        v.co.z -= .20 * max(0., v.co.x - .02)
        v.co.x += .012
    F.box('BeretBadge', (-.034, -.074, .978), (.020, .006, .020), badge, 'Head')


def mountain_cap(mat='Cap', feather='Feather', badge='White'):
    """A soft mountain cap with a short peak, a tuft of black feathers on the left and a white flower badge."""
    F.lathe('MountainCap', [(0, 1.034), (.050, 1.031), (.066, 1.012), (.070, .978), (.071, .950), (0, .952)], mat, sides=10)
    F.sheet('CapPeak', (-.050, -.062, .956), (.050, -.062, .956), (.046, -.104, .946), (-.046, -.104, .946), .007, mat, 'Head')
    for k, (dx, h) in enumerate(((0., .110), (.010, .090))):
        F.tube(f'CapFeather{k}', [((.064 + dx * .3, .012, .972), (.006, .010), 'Head'), ((.078 + dx, .040, 1.030 + h * .3), (.006, .013), 'Head'),
                                  ((.076 + dx, .080, 1.000 + h), (.001, .002), 'Head')], feather, 4)
    F.box('CapBadge', (.070, -.020, .985), (.008, .018, .018), badge, 'Head')


def snow_cap(mat='Snow', fold='Cloth'):
    """A round wool ski cap with a turned-up fold."""
    F.lathe('SkiCap', [(0, 1.040), (.044, 1.035), (.066, 1.012), (.072, .980), (.073, .955), (0, .955)], mat, sides=10)
    F.tube('SkiCapFold', F.vertical([.948, .972], -.003, [(.0775, .0735), (.0765, .0725)], 'Head'), fold, 10, caps=(False, False))


def skis(mat='Wood', pole='Leather'):
    """Long skis and a pole strapped upright on the back, the tips over the head."""
    for s in (-1, 1):
        F.tube(f'Ski_{s}', [((s * .024, .118, .180), (.020, .005), 'Chest'), ((s * .024, .122, 1.180), (.022, .005), 'Chest'),
                            ((s * .024, .150, 1.270), (.020, .005), 'Chest'), ((s * .024, .178, 1.300), (.012, .004), 'Chest')], mat, 4)
    F.tube('SkiPole', [((.064, .110, .200), .006, 'Chest'), ((.064, .112, 1.140), .006, 'Chest')], pole, 4)
    F.box('SkiBasket', (.064, .110, .260), (.050, .050, .006), pole, 'Chest')
    F.band('SkiStrap', 'Leather', .700, .722, grow=.016, bone='Chest')


def rope_and_axe(rope='Rope', haft='Wood', head='Metal'):
    """A climbing rope coiled across the body from the right shoulder, an ice axe slung across the back."""
    F.cross_belts('RopeCoil', rope, plate=None, low=.520, high=.800, width=.040, grow=.026, chest=.008, which='R')
    F.tube('IceAxeHaft', [((.090, .100, .440), .009, 'Spine'), ((-.040, .110, .860), .008, 'Chest')], haft, 5)
    F.box('IceAxeHead', (-.042, .110, .868), (.110, .016, .018), head, 'Chest')


def tall_felt_hat(mat='Felt'):
    F.lathe('FeltHat', [(0, 1.112), (.050, 1.110), (.059, 1.092), (.066, .976), (.090, .958), (.092, .950), (.068, .950), (0, .952)], mat, sides=10)


def shamma(cloth='Cloth', border='Team'):
    """A white cotton shamma wrapped over the body (Spine and Chest) and hanging to the knee (Hips), its
    wide coloured border over the left shoulder (Chest and Spine: the battle dyes it)."""
    F.torso('Shamma', cloth, grow=.012, chest=.004)
    F.skirt('ShammaSkirt', cloth, low=.380, top=.552, grow=.012, flare=.016)
    F.shawl('ShammaBorder', border, profile=F.TORSO)
    F.band('CartridgeBelt', 'Leather', .526, .556, grow=.022, bone='Spine')


def plis():
    """The white felt skullcap, rounded and close."""
    F.lathe('Plis', [(0, 1.028), (.040, 1.024), (.061, 1.008), (.068, .984), (.069, .952), (0, .952)], 'Felt', sides=10)


def braided_vest(mat='Team', braid='Braid', sash='Sash'):
    """A wool jacket (Spine and Chest), black braid down its front edges, a wide waist sash."""
    F.torso('Jacket', mat, grow=.010, chest=.004)
    for s in (-1, 1):
        F.slab(f'Braid_{s}', [(s * .022, -.090, .770), (s * .036, -.090, .770), (s * .044, -.080, .560), (s * .030, -.080, .560)], braid, 'Chest', depth=.006)
    F.band('WaistSash', sash, .512, .560, grow=.018, bone='Spine')


def trouser_braid(mat='Braid'):
    for side, s in (('L', 1), ('R', -1)):
        F.box(f'TrouserBraid_{side}', (s * .118, -.004, .380), (.006, .020, .170), mat, 'Leg_' + side)


def anorak(mat='Team', fur='Fur', band='Red'):
    """A hooded anorak (the body and the hood: Spine, Chest and Head), a fur ruff round the face, a red
    armband on the left arm, snow goggles."""
    F.torso('Anorak', mat, grow=.016, chest=.006)
    F.band('AnorakHem', mat, .470, .548, grow=.020, profile=F.SKIRT, bone='Spine')
    F.hood('Hood', mat, cape=.200, low=.730, dags=0., tail=False)
    pts = []
    for k in range(13):
        t = 2 * math.pi * k / 12
        pts.append(((.064 * math.sin(t), -.060, .918 + .082 * math.cos(t)), (.016, .014), 'Head'))
    F.tube('FurRuff', pts, fur, 5, caps=(False, False))
    sh, el = F.arm.data.bones['Arm_L'].head_local, F.arm.data.bones['Forearm_L'].head_local
    F.tube('Armband', [(tuple(sh.lerp(el, .40)), (.046, .043), 'Arm_L'), (tuple(sh.lerp(el, .58)), (.044, .041), 'Arm_L')], band, 7, caps=(False, False))
    F.box('SnowGoggles', (0, -.0615, .925), (.100, .012, .022), 'Gear', 'Head')


def mukluks(mat='Fur', sole='Leather'):
    for side, s in (('L', 1), ('R', -1)):
        Sh, Fo = 'Shin_' + side, 'Foot_' + side
        F.tube('Mukluk_' + side, [((s * .074, .004, .100), (.038, .040), Sh), ((s * .074, .004, .250), (.047, .048), Sh)], mat, 7, caps=(False, False))
        F.box('MuklukSole_' + side, (s * .074, -.040, .009), (.066, .144, .018), sole, Fo)


# ---- the recipes -------------------------------------------------------------------------------------------------

RECIPES = {
    'illyria': dict(
        name='Albanian Kachak riflemen', role='ranged',
        colors={'Skin': 'C99472', 'Cloth': 'EAE4D6', 'Felt': 'F2EEE4', 'Leather': '3A2A20', 'Braid': '1E1C1C', 'Sash': '7A2A22',
                'Wood': '5A3E28', 'Gun': '2A2B2D', 'Metal': IRON, 'Hair': '2A201A'},
        legs=('hose', 'Cloth', 'Leather'), sleeves='Cloth', beard=False, hair='nape', fists=low_fist(), dress=None, team=None,
        weapon=rifle(below=.160, above=.400),
        extras=[lambda: braided_vest(), trousers('Cloth'), lambda: trouser_braid(), bandolier('Leather', which='LR', grow=.026), plis, moustache],
        look='Kachak rifleman: a white felt skullcap, a moustache, a Team wool jacket with black braid, a dark red waist sash, crossed leather '
             'bandoliers, white trousers with black braid, leather shoes, a rifle low in the right fist'),
    'dacia': dict(
        name='Romanian mountain troops (vanatori de munte)', role='infantry',
        colors={'Skin': 'C99472', 'Khaki': '6A6650', 'Puttee': '57543F', 'Felt': '1C1C1E', 'White': 'EEEAE0', 'Pack': '7A6A48',
                'Leather': '2A2622', 'Wood': '5A3E28', 'Gun': '2A2B2D', 'Metal': IRON, 'Hair': '2A201A'},
        legs=('hose', 'Khaki', 'Leather'), sleeves='Khaki', beard=False, hair='nape', fists=both_fists(), dress=None, team=None,
        weapon=rifle(),
        extras=[tunic('Team'), trousers('Khaki', pockets=True), puttees('Puttee'), rucksack('Pack'), lambda: mountain_beret('Felt')],
        look='Mountain trooper: the big black mountain beret pulled down on the left with a white flower badge, a Team wool tunic, olive '
             'trousers and puttees, a rucksack with a bedroll, a rifle upright in both hands'),
    'nuragi': dict(
        name='Brigata Sassari infantry', role='infantry',
        colors={'Skin': 'C99472', 'Uniform': '6E7560', 'Helmet': '5E6652', 'Puttee': '626A56', 'Red': 'B8282A', 'White': 'EEEAE0',
                'Leather': '3A2E26', 'Wood': '5A3E28', 'Gun': '2A2B2D', 'Metal': ('8A8E92', .35, .8), 'Hair': '2A201A'},
        legs=('hose', 'Uniform', 'Leather'), sleeves='Uniform', beard=False, hair='nape', fists=both_fists(), dress=None, team=None,
        weapon=rifle(below=.160, above=.400, bayonet=.150),
        extras=[tunic('Team', skirts='Uniform'), trousers('Uniform'), puttees('Puttee'), cartridge_pouches(), collar_badges,
                lambda: adrian_helmet('Helmet')],
        look='Great War infantryman: a grey-green steel helmet with a comb, a Team tunic with long skirts and red-and-white collar patches, '
             'leather cartridge pouches, grey-green trousers and puttees, a rifle with a fixed bayonet upright in both hands'),
    'noricum': dict(
        name='Kaiserschuetzen mountain riflemen', role='infantry',
        colors={'Skin': 'D9AE88', 'Grey': '7A7C72', 'Cap': '6E7068', 'Feather': '141414', 'White': 'EEEAE0', 'Rope': 'C8B68A',
                'Leather': '2E2620', 'Wood': '6A4A30', 'Gun': '2A2B2D', 'Metal': ('8A8E92', .35, .8), 'Hair': '3A2A1E'},
        legs=('hose', 'Grey', 'Leather'), sleeves='Grey', beard=False, hair='nape', fists=both_fists(), dress=None, team=None,
        weapon=rifle(),
        extras=[tunic('Team'), trousers('Grey', pockets=True), lambda: F.combat_boots('Leather', sole='Leather', top=.200), lambda: rope_and_axe(),
                moustache, lambda: mountain_cap()],
        look='Mountain rifleman: a pike-grey mountain cap with a black feather tuft and a white flower badge, a moustache, a Team wool tunic, '
             'a climbing rope coiled across the body, an ice axe on the back, grey trousers, climbing boots, a rifle upright in both hands'),
    'rygir': dict(
        name='Norwegian ski infantry', role='infantry',
        colors={'Skin': 'E0B898', 'Snow': 'E4E4DE', 'Cloth': '8A8C86', 'Leather': '2E2620', 'Wood': 'B08A5A', 'Gun': '2A2B2D',
                'Metal': ('8A8E92', .35, .8), 'Hair': 'B08A5A'},
        legs=('hose', 'Snow', 'Leather'), sleeves='Snow', beard=False, hair='nape', fists=both_fists(), dress=None, team=None,
        weapon=rifle(),
        extras=[tunic('Team'), trousers('Snow'), lambda: F.combat_boots('Leather', sole='Leather', top=.170), lambda: skis(), lambda: snow_cap()],
        look='Ski trooper: a round white ski cap with a grey fold, a Team wool tunic, white snow trousers and sleeves, boots, long skis and a '
             'pole strapped upright on the back, a rifle upright in both hands'),
    'd-mt': dict(
        name='Ethiopian rifle infantry (Adwa, 1896)', role='infantry',
        colors={'Skin': '7A4E34', 'Cloth': 'F0EDE4', 'Felt': '3A2A20', 'Leather': '5E4030', 'Wood': '5A3E28', 'Gun': '2A2B2D',
                'Metal': IRON, 'Hair': '1C1612'},
        legs=('hose', 'Cloth', 'Skin'), sleeves='Cloth', beard=True, hair='nape', fists=both_fists(), dress=None, team=None,
        weapon=rifle(),
        extras=[lambda: shamma(), bandolier('Leather', which='R', grow=.030), lambda: tall_felt_hat()],
        look='Adwa rifleman: a tall dark felt hat, a beard, a white shamma to the knee with a wide Team border over the shoulder, a cartridge '
             'belt and bandolier, white jodhpurs, bare feet, a rifle upright in both hands'),
    'dorset': dict(
        name='Canadian Ranger riflemen', role='ranged',
        colors={'Skin': 'B07A58', 'Anorak': '5A5E50', 'Trousers': '3A3C36', 'Fur': 'D8CCB4', 'Red': 'C8302A', 'Gear': '1C1C1E',
                'Mitten': '4A3A2A', 'Leather': '2A2420', 'Wood': '6A4A30', 'Gun': '2A2B2D', 'Metal': IRON, 'Hair': '1C1612'},
        legs=('hose', 'Trousers', 'Fur'), sleeves='Anorak', beard=False, hair='nape', fists=low_fist('Mitten'), dress=None, team=None,
        weapon=rifle(below=.160, above=.400),
        extras=[lambda: anorak(), trousers('Trousers', pockets=True), lambda: mukluks()],
        look='Ranger: a Team hooded anorak with a pale fur ruff round the face, snow goggles, a red armband, dark trousers, pale fur mukluks, '
             'mittens, a rifle low in the right fist'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        HELD.clear()
        S.foot(m, RECIPES[m])
