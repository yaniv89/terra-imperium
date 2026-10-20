# scripts/blender/build_signature_gunpowder.py
# The Gunpowder signature units on foot (about 1500 to 1850) on the quality-pass figure with authored clips
# (2026-10-20, ti_signature.py), one recipe per people from the look lines of
# build_units_gunpowder_signature.py (FOOT; its horsemen, the Khoekhoe ox rider and the Tondo crew stay on
# that builder) and plans/ART-MODELS-PLAN.md 4.5. Firearms are custom weapons: the recipe places both fists
# (as build_gunpowder_infantry.py, _ranged.py and _mercenary.py do) and builds the musket of ti_figure.py,
# returning the gun's clip Kit, so Aim-fire-reload works. Outputs go to art-build/units/signature/<model>/;
# copy each GLB to src/assets/units/signature/ and merge its "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_gunpowder.py -- [model ...]
# Rules: Team only on Spine, Chest or Head parts; shield faces Emblem; flat colours; person budget 3,000.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_signature as S  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
from mathutils import Vector as V  # noqa: E402

IRON = ('4E4F52', .45, .7)
STEEL = ('A3A6A8', .35, .8)
GOLD = ('D4A84A', .35, .8)
BRASS = ('C9A04E', .4, .7)


def C(skin, **k):
    return dict({'Skin': skin}, **k)


# ---- hands for a gun (posed, then made the rest pose; as the base Gunpowder builders) ---------------------

def order_arms():
    """The musket at the order in the right fist, the left arm hanging (build_gunpowder_infantry.py)."""
    F.reach('L', (.198, -.030, .505), pole=(.3, 1, .1))
    F.bake_rest()
    F.fist('R', None, (0, 0, 1))
    F.fist('L', None, (0, 1, 0), half=.020)


def rifle_arms():
    """The rifle upright in the left fist, the right arm hanging (build_gunpowder_ranged.py)."""
    F.reach('R', (-.196, -.030, .505), pole=(-.3, 1, .1))
    F.bake_rest()
    F.fist('L', None, (0, 0, 1))
    F.fist('R', None, (0, 1, 0), half=.020)


def hilt_arms():
    """The musket in the right fist, the left fist on a hilt at the left hip (build_gunpowder_mercenary.py)."""
    F.reach('L', (.138, -.098, .650), pole=(1, .4, -.4))
    F.bake_rest()
    F.fist('R', None, (0, 0, 1))
    F.fist('L', None, (0, 0, 1), half=.022)


def musket(length=.86, bayonet=0, metal='Iron', lock='Brass', butt=.012, wood='Wood'):
    """A musket (or a long jezail, an arquebus) in the right fist; returns its maker for weapon=('custom')."""
    def make():
        F.musket(F.grip_point('R'), butt=butt, length=length, bayonet=bayonet, metal=metal, lock=lock, wood=wood)
        return FC.Kit('gun', bayonet=bool(bayonet))
    return ('custom', {'make': make})


def rifle(length=.82, metal='Iron', lock='Brass'):
    def make():
        g = F.grip_point('L')
        F.musket(V((g.x, g.y, g.z)), butt=.200, length=length, bayonet=0, prop='Prop_L', name='Rifle', metal=metal, lock=lock)
        return FC.Kit('gun', side='L')
    return ('custom', {'make': make})


# ---- hats --------------------------------------------------------------------------------------------------

def shako(mat='Felt', plate='Brass', plume='Plume'):
    def f():
        F.lathe('Shako', [(0, 1.098), (.074, 1.098), (.075, 1.090), (.071, 1.000), (.069, .960), (.071, .946), (0, .946)], mat)
        F.tube('ShakoBand', F.vertical([.952, .972], -.003, [(.0735, .0695), (.0730, .069)], 'Head'), 'Team', 10, caps=(False, False))
        F.box('ShakoPeak', (0, -.090, .950), (.110, .046, .008), mat, 'Head')
        F.box('ShakoPlate', (0, -.073, 1.030), (.040, .008, .044), plate, 'Head')
        F.tube('ShakoPlume', [((0, -.060, 1.090), .012, 'Head'), ((0, -.062, 1.150), .018, 'Head'), ((0, -.062, 1.180), .006, 'Head')], plume, 6)
    return f


def bonnet(mat='Bonnet', toorie='Team'):
    """The flat Highland bonnet: a broad soft disc over a band, a toorie on top, a badge."""
    def f():
        F.lathe('Bonnet', [(0, 1.012), (.060, 1.014), (.094, 1.000), (.092, .984), (.074, .962), (.072, .946), (0, .946)], mat)
        F.tube('BonnetBand', F.vertical([.946, .962], -.003, [(.0735, .0695), (.0735, .0695)], 'Head'), 'Team', 10, caps=(False, False))
        F.tube('Toorie', [((0, -.003, 1.010), .016, 'Head'), ((0, -.003, 1.030), .014, 'Head')], toorie, 6)
        F.box('BonnetBadge', (.058, -.050, .970), (.020, .010, .026), 'Metal', 'Head')
        F.tube('BonnetFeather', [((.066, -.040, .975), .006, 'Head'), ((.080, -.010, 1.030), .008, 'Head'), ((.086, .020, 1.070), .002, 'Head')], 'Hair', 4)
    return f


def kofia(mat='Cap', band='Gold'):
    def f():
        F.lathe('Kofia', [(0, 1.002), (.066, 1.002), (.070, .994), (.071, .950), (0, .950)], mat)
        F.tube('KofiaBand', F.vertical([.958, .974], -.003, [(.0730, .069), (.0730, .069)], 'Head'), band, 10, caps=(False, False))
    return f


def turban(mat='Turban', tail=True):
    """A broad wound turban, its end falling down the back."""
    def f():
        F.lathe('Turban', [(0, 1.040), (.050, 1.044), (.080, 1.024), (.088, .990), (.084, .960), (.074, .940), (0, .942)], mat, sides=12)
        F.tube('TurbanWrap', [((0, -.010, .955), (.088, .084), 'Head'), ((0, -.010, .990), (.094, .088), 'Head')], mat, 10, caps=(False, False))
        if tail:
            F.slab('TurbanTail', [(-.030, .080, .980), (.030, .080, .980), (.036, .092, .800), (-.026, .092, .800)], mat, 'Head')
    return f


def leaf_cap(mat='Leaf'):
    def f():
        F.lathe('LeafCap', [(0, 1.040), (.044, 1.034), (.068, 1.000), (.072, .960), (.074, .944), (0, .946)], 'Bark')
        for k in range(5):
            a = 2 * math.pi * k / 5 + .3
            c = V((math.sin(a) * .072, -math.cos(a) * .068, .985))
            t = V((math.sin(a) * .090, -math.cos(a) * .086, 1.050))
            F.tube(f'Leaf{k}', [(tuple(c), (.006, .020), 'Head'), (tuple(c.lerp(t, .5)), (.006, .026), 'Head'), (tuple(t), .002, 'Head')], mat, 4)
    return f


def beaded_cap(mat='Beads', bead='Shell'):
    def f():
        F.lathe('BeadedCap', [(0, 1.024), (.046, 1.018), (.068, .992), (.073, .960), (.074, .946), (0, .948)], mat)
        for k in range(7):
            a = math.pi * (k / 6 - .5)
            F.box(f'CapBead{k}', (math.sin(a) * .075, -math.cos(a) * .071, .952), (.014, .014, .014), bead, 'Head')
        F.tube('CapTuft', [((0, 0, 1.020), .012, 'Head'), ((0, .010, 1.070), .018, 'Head'), ((0, .020, 1.090), .004, 'Head')], 'Feather', 5)
    return f


def feather_cap(mat='Feather'):
    def f():
        F.lathe('SkinCap', [(0, 1.020), (.046, 1.016), (.068, .990), (.073, .958), (.074, .946), (0, .948)], 'Hide')
        F.headband('Team', z=.955)
        for k in range(4):
            a = math.radians(-35 + 70 * k / 3)
            b = V((math.sin(a) * .040, .030 + math.cos(a) * .020, 1.000))
            t = b + V((math.sin(a) * .050, .040, .130))
            F.tube(f'CapFeather{k}', [(tuple(b), (.004, .012), 'Head'), (tuple(b.lerp(t, .5)), (.003, .018), 'Head'), (tuple(t), .002, 'Head')], mat, 4)
    return f


def carved_helmet(mat='Carved', paint='Paint'):
    """The Haida carved wooden helmet: a high dome, a beaked crest over the brow, painted eyes."""
    def f():
        F.lathe('CarvedHelm', [(0, 1.070), (.050, 1.064), (.076, 1.030), (.080, .980), (.078, .944), (0, .946)], mat)
        F.tube('HelmBeak', [((0, -.050, 1.060), (.020, .030), 'Head'), ((0, -.110, 1.050), (.014, .020), 'Head'), ((0, -.150, 1.020), .003, 'Head')], mat, 5)
        for s in (-1, 1):
            F.box(f'HelmEye{s}', (s * .036, -.074, 1.015), (.026, .008, .016), paint, 'Head')
        F.tube('HelmBand', F.vertical([.948, .964], -.003, [(.0805, .0765), (.0805, .0765)], 'Head'), 'Team', 10, caps=(False, False))
    return f


def hair_knot(mat='Hair'):
    def f():
        F.hair(mat)
        F.tube('HairKnot', [((0, .030, 1.000), .020, 'Head'), ((0, .040, 1.030), .028, 'Head'), ((0, .046, 1.058), .010, 'Head')], mat, 6)
    return f


def big_hair(mat='Hair'):
    """Fijian buiniga hair: a big round mass."""
    def f():
        F.lathe('BigHair', [(0, 1.070), (.060, 1.062), (.094, 1.020), (.098, .970), (.086, .920), (.060, .880), (0, .900)], mat, cy=.006, sides=10)
    return f


def single_feather(mat='Feather', x=.040):
    def f():
        F.tube('Feather', [((x, .045, .970), (.004, .012), 'Head'), ((x + .008, .060, 1.040), (.003, .016), 'Head'), ((x + .014, .070, 1.110), .002, 'Head')], mat, 4)
    return f


# ---- dress ------------------------------------------------------------------------------------------------

def jacket(mat='Team', tails=None, buttons='Brass', low=.462):
    """A short jacket to the waist (Spine and Chest), buttons down the front, short tails."""
    def f():
        F.torso('Jacket', mat, grow=.008, chest=.008, sides=10)
        if tails:
            F.coat_skirts('JacketTail', mat, tails, low=low, grow=.014, flare=.010, open_deg=42, cols=10)
        if buttons:
            for k, z in enumerate((.585, .650, .715)):
                ry = F.radius_at(z, F.TORSO)[1] + .010 + (.006 if .68 < z < .75 else 0)
                F.box(f'Button{k}', (0, -ry - .003, z), (.012, .008, .012), buttons, 'Spine' if z < .66 else 'Chest')
    return f


def long_coat(mat='Team', lining='Cloth', low=.300, open_deg=50):
    def f():
        F.torso('Coat', mat, grow=.010, chest=.010, sides=10)
        F.coat_skirts('CoatSkirt', mat, lining, low=low, grow=.016, flare=.030, open_deg=open_deg)
    return f


def wide_sash(mat='Team', z0=.500, z1=.585):
    def f():
        F.band('WideSash', mat, z0, z1, grow=.020, bone='Spine')
    return f


def belt(mat='Leather', z0=.528, z1=.552, grow=.018):
    def f():
        F.band('Belt', mat, z0, z1, grow=grow, bone='Spine', bulge=.002)
    return f


def wrapper(mat, low=.300, top=.560):
    """A wrapped cloth from the waist (a sarong, a kikoi, a tapa kilt), on the Hips."""
    def f():
        F.skirt('Wrapper', mat, low=low, top=top, grow=.006, sides=10, flare=.006)
    return f


def poncho(mat='Team', low=.430):
    def f():
        F.torso('Poncho', mat, grow=.020, chest=.006, sides=10)
        F.coat_skirts('PonchoSkirt', mat, mat, low=low, grow=.024, flare=.020, open_deg=6, cols=12)
    return f


def lamba(mat='Lamba'):
    """The Malagasy lamba: a white cloth round the back and over the left shoulder."""
    def f():
        F.cloak('Lamba', mat, low=.330, arc=(150, 100))
        F.slab('LambaDrape', [(.070, -.088, .785), (.120, -.070, .785), (-.040, -.100, .560), (-.090, -.090, .600)], mat, 'Chest', depth=.010)
    return f


def plank_armour(mat='Slat', lace='Hide'):
    """Haida slat armour: vertical wooden slats laced round the trunk."""
    def f():
        F.torso('SlatBack', lace, grow=.012, sides=10)
        for k in range(7):
            a = math.radians(-60 + 20 * k)
            z = .640
            rx, ry = F.radius_at(z, F.TORSO)
            x, y = (rx + .020) * math.sin(a), -(ry + .020) * math.cos(a)
            F.box(f'Slat{k}', (x, y, .640), (.024, .012, .250), mat, 'Spine')
        F.band('SlatLace', lace, .600, .616, grow=.034, bone='Spine')
    return f


def feather_cloak(mat='Feather', row='Feather2'):
    def f():
        F.cloak('FeatherCloak', mat, low=.300, width=(.122, .210))
        for k, z in enumerate((.680, .540, .400)):
            F.box(f'FeatherRow{k}', (0, .175 + .012 * k, z), (.300, .010, .026), row, 'Chest' if z > .66 else 'Spine')
    return f


def possum_cloak(mat='Possum'):
    def f():
        F.cloak('PossumCloak', mat, low=.360, arc=(160, 110))
        for k, z in enumerate((.700, .600, .500)):
            F.box(f'CloakSeam{k}', (0, .170 + .010 * k, z), (.260, .008, .010), 'Paint', 'Chest' if z > .66 else 'Spine')
    return f


def plaid(mat='Team'):
    """The belted plaid's upper half over the left shoulder and down the back (Chest and Spine)."""
    def f():
        F.shawl('Plaid', mat)
        F.cloak('PlaidBack', mat, top=.780, low=.420, arc=(110, 80))
    return f


def covered():
    """A kilt under a shirt, a poncho or a cotton coat: drop the kit's bare skin trunk, which they hide."""
    def f():
        F.drop('BodyTorso')
    return f


def cotton_armour(mat='Cotton'):
    """A thick quilted cotton coat: the trunk padded, stitched in rows (ti_signature's armour='quilt'
    folds out into wings on this figure, so it is drawn here)."""
    def f():
        F.torso('CottonCoat', mat, grow=.016, chest=.008, sides=10)
        for k, z in enumerate((.580, .640, .700)):
            F.band(f'CottonRow{k}', 'Stitch', z - .005, z + .005, grow=.020, bone='Spine' if z < .66 else 'Chest', bulge=0)
    return f


def hair_band(mat='Team'):
    """A band round a big mass of hair (big_hair)."""
    def f():
        F.tube('HairBand', F.vertical([.936, .962], .004, [(.094, .090), (.096, .092)], 'Head'), mat, 10, caps=(False, False))
    return f


def body_paint(mat='Paint'):
    def f():
        for k, z in enumerate((.700, .640, .580)):
            ry = F.radius_at(z, F.TORSO)[1]
            F.box(f'PaintStripe{k}', (0, -ry - .001, z), (.140, .006, .016), mat, 'Chest' if z > .66 else 'Spine')
        for s in (-1, 1):
            F.box(f'FacePaint{s}', (s * .030, -.057, .905), (.030, .006, .010), mat, 'Head')
    return f


def armlets(mat='Gold', t=(.35,), sides=('L', 'R')):
    def f():
        for side in sides:
            B = F.arm.data.bones
            sh, el = B['Arm_' + side].head_local, B['Forearm_' + side].head_local
            for i, tt in enumerate(t):
                p, d = sh.lerp(el, tt), (el - sh).normalized()
                F.tube(f'Armlet_{side}{i}', [(tuple(p - d * .012), .045, 'Arm_' + side), (tuple(p + d * .012), .043, 'Arm_' + side)], mat, 7, caps=(False, False))
    return f


def cuffs(mat):
    def f():
        B = F.arm.data.bones
        for side in 'LR':
            el, wr = B['Forearm_' + side].head_local, B['Hand_' + side].head_local
            F.tube('Cuff_' + side, [(tuple(el.lerp(wr, .78)), (.033, .033), 'Forearm_' + side), (tuple(el.lerp(wr, .98)), (.030, .031), 'Forearm_' + side)], mat, 6, caps=(False, False))
    return f


def moustache(mat='Hair', w=.052):
    def f():
        F.box('Moustache', (0, -.062, .884), (w, .012, .011), mat, 'Head')
    return f


# ---- kit at the belt and on the back -------------------------------------------------------------------------

def pistols():
    def f():
        for k, x in enumerate((-.050, .040)):
            F.tube(f'Pistol{k}', [((x, -.112, .600), (.010, .012), 'Spine'), ((x + .006, -.110, .520), (.008, .009), 'Spine'),
                                  ((x + .012, -.128, .505), (.012, .016), 'Spine')], 'Wood', 5)
    return f


def slung_musket():
    """A musket slung on the back, muzzle up over the right shoulder."""
    def f():
        F.tube('SlungStock', [((.120, .110, .380), (.012, .024), 'Spine'), ((.040, .118, .560), (.010, .014), 'Spine'), ((-.080, .122, .780), (.009, .010), 'Chest')], 'Wood', 5)
        F.tube('SlungBarrel', [((-.040, .112, .700), .006, 'Chest'), ((-.180, .124, 1.010), .006, 'Chest')], 'Iron', 5)
        F.tube('SlungStrap', [((.110, .080, .400), (.010, .004), 'Spine'), ((.100, -.070, .640), (.010, .004), 'Spine'), ((-.070, -.070, .790), (.010, .004), 'Chest'),
                              ((-.080, .090, .790), (.010, .004), 'Chest')], 'Leather', 4)
    return f


def bow_on_back(mat='Wood'):
    def f():
        F.tube('BackBow', [((.140, .118, .360), .008, 'Spine'), ((0, .150, .700), .012, 'Chest'), ((-.140, .118, 1.050), .008, 'Chest')], mat, 5)
        F.tube('BackBowString', [((.140, .112, .360), .002, 'Spine'), ((-.140, .112, 1.050), .002, 'Chest')], 'Cloth', 3)
    return f


def hide_shield_back(mat='Hide'):
    """A tall hide shield slung on the back."""
    def f():
        F.slab('BackShield', [(-.140, .110, .900), (.140, .110, .900), (.120, .120, .300), (-.120, .120, .300)], mat, 'Chest', depth=.014)
        F.box('BackShieldRib', (0, .108, .600), (.020, .010, .600), 'Wood', 'Chest')
    return f


def dart_quiver():
    def f():
        F.tube('DartQuiver', [((-.120, -.020, .520), .024, 'Hips'), ((-.132, -.010, .330), .028, 'Hips')], 'Bamboo', 6)
        F.tube('DartTufts', [((-.120, -.020, .520), .018, 'Hips'), ((-.118, -.022, .560), .022, 'Hips')], 'Cloth', 6)
    return f


def powder_gourd(mat='Gourd', side=1):
    def f():
        x = side * .120
        F.tube('PowderGourd', [((x, -.030, .500), .014, 'Hips'), ((x + side * .010, -.040, .450), .034, 'Hips'), ((x + side * .006, -.046, .390), .020, 'Hips')], mat, 6)
    return f


def hip_axe(side=-1, curved=False):
    def f():
        x = side * .110
        F.tube('BeltAxeHaft', [((x, -.080, .600), .010, 'Hips'), ((x - side * .010, -.070, .340), .010, 'Hips')], 'Wood', 5)
        if curved:
            F.slab('BeltAxeHead', [(x, -.150, .620), (x, -.080, .600), (x, -.080, .560), (x, -.160, .540)], 'Iron', 'Hips', depth=.008)
        else:
            F.box('BeltAxeHead', (x, -.115, .585), (.014, .070, .050), 'Iron', 'Hips')
    return f


def hip_club(side=-1):
    def f():
        x = side * .110
        F.tube('HipClub', [((x, -.060, .560), .012, 'Hips'), ((x - side * .016, -.040, .360), .020, 'Hips'), ((x - side * .026, -.020, .250), .032, 'Hips')], 'Wood', 6)
    return f


def hip_bag(mat='Bag', side=-1, name='Pouch'):
    def f():
        F.box(name, (side * .100, -.070, .480), (.060, .034, .070), mat, 'Hips')
    return f


def dagger(side=-1, curved=True):
    def f():
        x = side * .060
        F.tube('KnifeSheath', [((x, -.100, .555), (.016, .008), 'Hips'), ((x - side * .010, -.104, .450), (.012, .007), 'Hips'),
                               ((x - side * (.040 if curved else .014), -.100, .390), (.006, .005), 'Hips')], 'Leather', 4)
        F.tube('KnifeHilt', [((x, -.104, .560), .010, 'Hips'), ((x + side * .006, -.108, .620), .013, 'Hips')], 'Horn', 5)
    return f


def boomerang():
    def f():
        F.tube('Boomerang', [((-.120, -.060, .560), (.006, .018), 'Hips'), ((-.140, -.070, .440), (.006, .022), 'Hips'),
                             ((-.090, -.090, .390), (.006, .018), 'Hips')], 'Wood', 4)
    return f


def atlatl(side=1):
    def f():
        x = side * .115
        F.tube('Atlatl', [((x, -.060, .560), (.006, .016), 'Hips'), ((x + side * .010, -.040, .330), (.006, .016), 'Hips'),
                          ((x + side * .012, -.036, .310), .010, 'Hips')], 'Wood', 4)
    return f


def nose_ring(mat='Gold'):
    def f():
        F.box('NoseOrnament', (0, -.078, .884), (.044, .008, .016), mat, 'Head')
    return f


def pectoral(mat='Gold'):
    def f():
        F.tube('Pectoral', [((0, -.086, .720), (.040, .036), 'Chest'), ((0, -.094, .720), (.040, .036), 'Chest')], mat, 8)
    return f


def necklace(mat='Shell', z=.775):
    def f():
        F.tube('Necklace', F.vertical([z, z + .012], -.004, [(.066, .056), (.060, .052)], 'Chest'), mat, 8, caps=(False, False))
    return f


def targe_studs():
    def f():
        cx, cy, cz = .225, -.166, .612
        for k in range(8):
            a = 2 * math.pi * k / 8
            F.box(f'TargeStud{k}', (cx + .110 * math.cos(a), cy - .026, cz + .110 * math.sin(a)), (.016, .010, .016), 'Brass', 'Prop_L', True)
        F.tube('TargeSpike', [((cx, cy - .036, cz), .014, 'Prop_L'), ((cx, cy - .080, cz), .002, 'Prop_L')], 'Metal', 5, attachment=True)
    return f


def basket_hilt():
    def f():
        x, y = S.HAND_R.x, S.HAND_R.y
        F.lathe('BasketHilt', [(.010, .640), (.032, .648), (.036, .668), (.020, .684), (.010, .686)], 'Metal', bone='Prop_R', sides=8, sy=1.0, cy=y, cx=x, attachment=True)
    return f


def kris_and_shield():
    """A wavy-bladed kris point up in the right fist and a small round shield on the left arm."""
    def make():
        x, y, P = S.HAND_R.x, S.HAND_R.y, S.P_R
        F.tube('KrisHilt', [((x, y + .010, .560), .012, P), ((x, y, .600), .011, P), ((x, y - .018, .650), .015, P)], 'Wood', 5, attachment=True)
        F.box('KrisGuard', (x, y - .010, .656), (.018, .060, .016), 'Gold', P, True)
        F.tube('KrisBlade', [((x, y + .012 * math.sin(k * 1.7) - .006, .664 + k * .050), (.004, .017 - k * .0018), P) for k in range(8)] +
               [((x, y, .664 + 8 * .050), .0015, P)], 'Iron', 4, attachment=True)
        S.shield('small', size=1.05, rim='Metal', back='Wood')
        return FC.Kit('sword', shield=True)
    return ('custom', {'make': make})


def sling():
    """A sling hanging from the right fist, its pouch loaded with a stone."""
    def make():
        x, y, P = S.HAND_R.x, S.HAND_R.y, S.P_R
        F.tube('SlingCordA', [((x - .006, y, .600), .0035, P), ((x - .010, y - .010, .380), .0035, P)], 'Cord', 3, attachment=True)
        F.tube('SlingCordB', [((x + .006, y, .600), .0035, P), ((x + .010, y - .010, .380), .0035, P)], 'Cord', 3, attachment=True)
        F.tube('SlingPouch', [((x, y - .010, .390), (.022, .012), P), ((x, y - .010, .350), (.026, .016), P), ((x, y - .010, .325), (.010, .008), P)], 'Cord', 5, attachment=True)
        F.tube('SlingStone', [((x, y - .022, .350), .014, P), ((x, y - .022, .372), .012, P)], 'Stone', 5, attachment=True)
        return FC.Kit('sword', shield=False)
    return ('custom', {'make': make})


# ---- the roster ------------------------------------------------------------------------------------------------

def R(**k):
    return k


RECIPES = {
    # ---- Europe ----
    'odrysia': R(name='Haiduk musketeers', role='ranged',
                 colors=C('C99472', Cloth='E8E2D2', Leather='4A3426', Trews='3E3A44', Fur='2E241C', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28', Hair='241A12'),
                 legs=('hose', 'Trews', 'Leather'), sleeves='Cloth', fists=order_arms, beard=False, hair='nape', dress='none', team=None,
                 weapon=musket(length=.92), extras=[jacket('Team', buttons='Brass'), wide_sash('Sash'), pistols(), moustache(w=.060),
                                                    lambda: F.fur_cap('FurCap', 'Fur', plate=None, height=1.110), hip_bag('Leather', side=1)],
                 look='Haiduk musketeer: a tall dark fur cap, a heavy moustache, a short Team jacket with brass buttons over white shirt sleeves, a broad red sash with two pistols, '
                      'dark trousers and boots, a long musket without a bayonet upright at the order'),
    'celtiberia': R(name='Spanish guerrilleros', role='ranged',
                    colors=C('C48A62', Cloth='E8E2D2', Jacket='5A4632', Cloak='6A5236', Leather='5E4030', Trews='4E3A2A', Felt='2A2420', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28'),
                    legs=('hose', 'Trews', 'Leather'), sleeves='Jacket', fists=order_arms, beard=True, hair='nape', dress='none', team=None,
                    weapon=musket(length=.86), extras=[jacket('Jacket', buttons=None), wide_sash('Team', .505, .575),
                                                       lambda: F.cloak('Cloak', 'Cloak', low=.340), lambda: F.round_hat('BroadHat', 'Felt', 'Team', brim=.150, crown=1.050, droop=.020),
                                                       lambda: F.cross_belts('Bandolier', 'Leather', plate=None, width=.024, which='L'), powder_gourd('Horn', side=-1)],
                    look='Spanish guerrillero: a broad black hat with a Team band, a beard, a brown cloak over a brown jacket, a Team waist sash, a bandolier and a powder horn, '
                         'a flintlock without a bayonet'),
    'lusitania': R(name='Portuguese cacadores', role='ranged',
                   colors=C('C99472', Cloth='E8E2D2', Sleeve='5A3E2A', Trews='4A3A2C', Felt='1E1C1B', Plume='2E4A2A', Leather='1E1C1B', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28'),
                   legs=('hose', 'Trews', 'Leather'), sleeves='Sleeve', fists=rifle_arms, beard=False, hair='full', dress='none', team=None,
                   weapon=rifle(length=.82), extras=[jacket('Team', tails='Sleeve'), shako('Felt', 'Brass', 'Plume'), cuffs('Felt'),
                                                     lambda: F.cross_belts('CrossBelt', 'Leather', plate='Brass'), hip_bag('Leather', side=-1, name='CartridgePouch')],
                   look='Portuguese cacador: a tall black shako with a green plume and brass plate, a short Team jacket with short tails, black cross belts, brown trousers, '
                        'a short Baker rifle upright in the left hand'),
    'ulaid': R(name='United Irishmen pikemen (1798)', role='infantry',
               colors=C('D9AE88', Cloth='E8E2D2', Frieze='6A6458', Leather='3A2E26', Breeches='4E4434', Felt='2A2420', Green='2F8A3E', Metal=IRON, Wood='6A4A30', Hair='4A2E1A'),
               legs=('hose', 'Breeches', 'Leather'), sleeves='Frieze', beard=False, hair='nape', dress='none', team=None,
               weapon=('pike', {'length': 3.6, 'head': 'narrow'}),
               extras=[long_coat('Team', 'Frieze', low=.300), lambda: F.neck_stock('Cloth'), belt('Leather'),
                       lambda: F.round_hat('RoundHat', 'Felt', 'Green', brim=.118, crown=1.070),
                       lambda: F.box('Cockade', (.052, -.060, 1.000), (.030, .010, .030), 'Green', 'Head')],
               look='United Irishman: a round felt hat with a green band and cockade, a long Team frieze coat with grey skirts, a white neckcloth, breeches and boots, a long pike'),
    'fortriu': R(name='Highland broadsword clansmen', role='infantry',
                 colors=C('D9AE88', Cloth='E8E2D8', Tartan='3E4A3A', Hose='8A3A30', Bonnet='2A3550', Leather='5E4030', Metal=STEEL, Brass=BRASS, Wood='5A3E28', Hair='6A3A1E'),
                 legs=('hose', 'Hose', 'Leather'), sleeves='Cloth', beard=True, hair='nape', dress='kilt', dress_mat='Tartan', team=None,
                 weapon=('sword', {'length': .56}), shield=('round', {'size': .95, 'rim': 'Leather', 'back': 'Leather'}),
                 extras=[covered(), lambda: F.torso('Shirt', 'Cloth', grow=.004, sides=10), plaid('Team'), belt('Leather'), bonnet('Bonnet'), targe_studs(), basket_hilt(),
                         hip_bag('Leather', side=-1, name='Sporran')],
                 look='Highland clansman: a blue flat bonnet with a Team toorie and a feather, a beard, the belted plaid (a dark tartan kilt, the Team plaid over the shoulder '
                      'and down the back), a white shirt, red hose, a studded targe (Emblem) with a spike, a basket-hilted broadsword, a sporran'),
    'geats': R(name='Carolean pike-and-shot infantry', role='infantry',
               colors=C('D9AE88', Cloth='E8E2D2', Yellow='D9B850', Coat='2E4A8A', Buff='D6CBAE', Leather='2A2420', Felt='1E1C1B', Shoe='1F1C1A', Metal=IRON, Brass=BRASS, Wood='6A4A30', Hair='6A4A2A'),
               legs=('hose', 'Buff', 'Shoe'), sleeves='Coat', beard=False, hair='nape', dress='none', team=None,
               weapon=('pike', {'length': 3.6}),
               extras=[long_coat('Team', 'Yellow', low=.330), cuffs('Yellow'), lambda: F.cross_belts('CrossBelt', 'Leather', plate=None, which='R'),
                       lambda: F.tricorne(lace='Felt', cockade='Yellow'), lambda: F.queue(curls=False),
                       lambda: F.hip_sword('Hanger', 'L', mat='Brass', scabbard='Leather', grip='Leather', length=.34), lambda: F.gaiters('Leather', top=.300)],
               look='Carolean: a black tricorne with a yellow cockade, a long Team coat lined yellow with yellow cuffs, a black shoulder belt to a hanger, buff breeches, '
                    'black gaiters, a long pike'),
    # ---- Asia ----
    'gandhara': R(name='Pashtun jezail riflemen', role='ranged',
                  colors=C('C48A62', Cloth='E8E2D2', Turban='E8E2D2', Leather='5E4030', Horn='E6D9B8', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='6A4A30', Hair='1E1612'),
                  legs='sandals', sleeves='Cloth', fists=order_arms, beard=True, hair=None, dress='robe', dress_mat='Cloth', team=None,
                  weapon=musket(length=.90, lock='Brass', metal='Iron'),
                  extras=[lambda: F.torso('Waistcoat', 'Team', grow=.012, chest=.010, sides=10), belt('Leather', .540, .566, grow=.020), dagger(side=-1),
                          turban('Turban'), powder_gourd('Horn', side=1), lambda: F.cross_belts('Bandolier', 'Leather', plate=None, width=.020, which='L')],
                  look='Pashtun rifleman: a big white turban with its end down the back, a full beard, a long white shirt to the shins under a Team waistcoat, a leather belt '
                       'with a curved khyber knife, a bandolier and powder horn, a very long jezail upright'),
    'medang': R(bare=True, name='Mataram kris infantry', role='infantry',
                colors=C('A06A48', Batik='7A4A26', Cloth='C9A66B', Gold=GOLD, Metal=IRON, Iron=IRON, Wood='4A3426', Leather='4A3426', Hair='1A1410'),
                legs='bare', beard=False, hair='nape', dress='none', team='sash',
                head=('headcloth', {'band': 'Team', 'cloth': 'Batik', 'tail': False}),
                weapon=kris_and_shield(), extras=[wrapper('Batik', low=.150), slung_musket()],
                look='Mataram soldier: a batik headcloth with a Team band, bare chest, a long batik sarong, a Team waist sash, a wavy-bladed kris with a gold guard, '
                     'a small round shield (Emblem), a matchlock slung on the back'),
    'kutai': R(bare=True, name='Kutai sumpitan skirmishers', role='ranged',
               colors=C('A06A48', Bark='8A6A48', Leaf='4E7A32', Cloth='E8DCC0', Bamboo='B8A060', Metal=IRON, Wood='4A3A28', Hair='1A1410'),
               legs='bare', beard=False, hair='nape', dress='kilt', dress_mat='Bark', team='sash',
               weapon=('pike', {'length': 2.6, 'head': 'narrow', 'mat': 'Metal'}), extras=[leaf_cap('Leaf'), dart_quiver(), armlets('Bark', t=(.30,))],
               look='Kutai skirmisher: a bark cap ringed with green leaves, a bark-cloth kilt, a Team sash, a long blowgun tipped with a spear blade, a bamboo dart quiver at the hip'),
    # ---- Africa ----
    'bono': R(bare=True, name='Akan musketeers', role='ranged',
              colors=C('6A4430', Kente='C9A24A', Cloth='E8DCC0', Cap='C8382A', Gourd='C9A66B', Gold=GOLD, Metal=IRON, Iron=IRON, Brass=GOLD, Wood='5A3E28', Hair='1A1410'),
              legs='sandals', fists=order_arms, beard=False, hair='nape', dress='none', team='shawl',
              weapon=musket(length=.88, lock='Brass'), extras=[wrapper('Kente', low=.280), armlets('Gold', t=(.30, .42)), kofia('Cap', 'Gold'), powder_gourd('Gourd'),
                                                             necklace('Gold')],
              look='Akan musketeer: a red cap with a gold band, a kente wrapper, a Team cloth over the shoulder, gold armlets and a gold collar, a powder gourd, '
                   'a long trade musket upright'),
    'kilwa': R(name='Kilwa mainland archers (1505)', role='ranged',
               colors=C('6A4430', Cloth='EFEAE0', Kikoi='C8382A', Cap='EFEAE0', Gold=GOLD, Leather='6E4A30', Metal=STEEL, Wood='6A4A30', Hair='1A1410'),
               legs='sandals', beard=True, hair='nape', dress='robe', dress_mat='Cloth', team='sash',
               weapon=('bow', {'length': .96, 'recurve': .02}),
               extras=[lambda: F.torso('Kanzu', 'Cloth', grow=.006, sides=10), kofia('Cap', 'Gold'),
                       lambda: F.hip_sword('Sabre', 'L', mat='Metal', scabbard='Leather', grip='Leather', length=.42)],
               look='Kilwa archer: a white embroidered kofia cap with a gold band, a beard, a long white kanzu robe, a Team waist sash, a curved sword at the hip, a bow and quiver'),
    'luba': R(bare=True, name='Luba bow-and-shield warriors (improvised)', role='ranged',
              colors=C('6A4430', Wrap='C9A66B', Beads='E8DCC0', Shell='E8E2D2', Feather='C8382A', Hide='8A6A48', Cloth='E8DCC0', Metal=IRON, Wood='5A3E28', Hair='1A1410'),
              legs='bare', beard=False, hair=None, dress='kilt', dress_mat='Wrap', team='sash',
              weapon=('bow', {'length': .90}), extras=[beaded_cap('Beads', 'Shell'), hide_shield_back('Hide'), necklace('Shell')],
              look='Luba warrior: a white beaded cap with a red tuft, a shell necklace, a wrapper kilt, a Team sash, a bow and quiver, a tall hide shield slung on the back'),
    'lunda': R(bare=True, name='Lunda musket-and-axe warriors (improvised)', role='infantry',
               colors=C('6A4430', Raffia='C9B070', Hide='6E4A30', Feather='E8E2D2', Cloth='E8DCC0', Metal=IRON, Iron=IRON, Wood='5A3E28', Leather='5E4030', Hair='1A1410'),
               legs='bare', beard=False, hair=None, dress='kilt', dress_mat='Raffia', team='sash',
               weapon=('axe', {'length': .62}), extras=[feather_cap('Feather'), slung_musket(), armlets('Hide', t=(.30,))],
               look='Lunda warrior: a hide cap with white feathers and a Team band, a raffia kilt, a Team sash, a battle axe in hand, a trade musket slung on the back'),
    'ndongo': R(bare=True, name='Ndongo musket-and-axe guard', role='ranged',
                colors=C('6A4430', Raffia='C9B070', Cloth='E8DCC0', Leather='6E4A30', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28', Hair='1A1410'),
                legs='bare', fists=hilt_arms, beard=True, hair='full', dress='kilt', dress_mat='Raffia', team='shawl', head=('headband', {'mat': 'Team'}),
                weapon=musket(length=.86), extras=[hip_axe(side=1, curved=True), lambda: F.cross_belts('Bandolier', 'Leather', plate=None, width=.020, which='R')],
                look="Ndongo guard (Queen Njinga's): a Team headband, a beard, a raffia kilt, a Team cloth over the shoulder, a bandolier, a curved axe at the left hip with the "
                     'hand on its haft, a trade musket upright'),
    'mutapa': R(bare=True, name='Mutapa battle-axe and shield warriors', role='infantry',
                colors=C('6A4430', Wrap='C9A66B', Hide='8A6A48', Cloth='E8DCC0', Metal=IRON, Wood='5A3E28', Hair='1A1410'),
                legs='bare', beard=False, hair='full', dress='kilt', dress_mat='Wrap', team='sash', head=('headband', {'mat': 'Hide'}),
                weapon=('axe', {'length': .74}), shield=('oval', {'size': 1.1, 'rim': 'Hide', 'back': 'Hide'}), extras=[bow_on_back(), necklace('Metal')],
                look='Mutapa warrior: a hide headband, a wrapper kilt, a Team sash, a long battle axe, a tall oval hide shield (Emblem), a bow on the back'),
    'merina': R(name='Merina musket highlanders', role='ranged',
                colors=C('A06A48', Lamba='EFEAE0', Cloth='E8E2D2', Straw='D2B870', Leather='5E4030', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='6A4A30', Hair='1A1410'),
                legs='bare', fists=order_arms, beard=False, hair='nape', dress='tunic', dress_mat='Cloth', team='top',
                weapon=musket(length=.86, bayonet=.230), extras=[lamba('Lamba'), lambda: F.cross_belts('CrossBelt', 'Leather', plate=None),
                                                                lambda: F.straw_hat('StrawHat', 'Straw', 'Team', brim=.140)],
                look='Merina highlander: a broad straw hat with a Team band, a Team shirt, a white lamba cloth round the back and over the shoulder, black cross belts, '
                     'bare legs, a flintlock with a bayonet'),
    # ---- the Americas ----
    'diaguita': R(name='Calchaqui valley warriors', role='ranged',
                  colors=C('A8724E', Cloth='E8D9B0', Feather='E8E2D2', Leather='8A6A48', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28', Hair='1A1410'),
                  legs='sandals', fists=order_arms, beard=False, hair='full', dress='kilt', dress_mat='Cloth', team=None, head=('headband', {'mat': 'Team'}),
                  weapon=musket(length=.76), extras=[covered(), poncho('Team'), single_feather('Feather'), bow_on_back()],
                  look='Calchaqui warrior: a Team poncho, a Team headband with a white feather, long hair, a cloth kilt, a bow on the back, a captured arquebus'),
    'muisca': R(name='Muisca gold-adorned spearmen', role='infantry',
                colors=C('A8724E', Cloth='E8DCC0', Feather='2E8A6A', Gold=GOLD, Metal=GOLD, Wood='5A3E28', Hair='1A1410'),
                legs='bare', beard=False, hair='nape', dress='tunic', dress_mat='Cloth', team='top',
                head=('feathers', {'band': 'Gold', 'mat': 'Feather', 'n': 7, 'tall': .12}),
                weapon=('pike', {'length': 2.2}), extras=[lambda: F.cloak('Cloak', 'Cloth', low=.360), nose_ring('Gold'), pectoral('Gold'), armlets('Gold')],
                look='Muisca spearman: a gold band with a crown of green feathers, a gold nose ornament, a gold pectoral disc and armlets, a Team tunic, a white cotton cloak, '
                     'a gold-tipped spear'),
    'tupinamba': R(bare=True, name='Tupinamba feather-cloak archers', role='ranged',
                   colors=C('A8724E', Feather='C8382A', Feather2='E8B830', Cloth='E8DCC0', Leather='6E4A30', Wood='5A3E28', Hair='1A1410'),
                   legs='bare', beard=False, hair='full', dress='kilt', dress_mat='Leather', team='sash',
                   head=('feathers', {'band': 'Team', 'mat': 'Feather2', 'n': 5, 'tall': .09}),
                   weapon=('bow', {'length': 1.05}), extras=[feather_cloak('Feather', 'Feather2'), hip_club(side=-1)],
                   look='Tupinamba archer: a red feather cloak with yellow rows, a Team headband with yellow feathers, a loincloth, a Team sash, a tall bow, a war club at the hip'),
    'jaragua': R(name='Taino cotton-armour spearmen (improvised)', role='infantry',
                 colors=C('A8724E', Cotton='EFE6D0', Feather='E8B830', Cloth='EFE6D0', Wood='5A3E28', Metal=('6A6A70', .3, .3), Hair='1A1410'),
                 legs='bare', beard=False, hair='full', dress='kilt', dress_mat='Cotton', team='sash',
                 head=('feathers', {'band': 'Team', 'mat': 'Feather', 'n': 3, 'tall': .10}),
                 weapon=('pike', {'length': 2.1, 'head': 'narrow'}), extras=[covered(), cotton_armour('Cotton'), hip_club(side=-1)],
                 look="Taino spearman (Anacaona's warriors): a quilted white cotton coat, a Team sash, a Team headband with yellow feathers, a fire-hardened spear, "
                      'a wooden club at the hip'),
    'kalinago': R(bare=True, name='Kalinago canoe raiders', role='infantry',
                  colors=C('A8724E', Paint='A04A2A', Feather='3A9A5A', Cloth='8A3A24', Wood='4A3426', Leather='4A3426', Hair='1A1410'),
                  legs='bare', beard=False, hair='full', dress='kilt', dress_mat='Cloth', team='sash',
                  head=('feathers', {'band': 'Team', 'mat': 'Feather', 'n': 5, 'tall': .11}),
                  weapon=('club', {'length': .66}), extras=[body_paint('Paint'), armlets('Feather', t=(.32,)), bow_on_back()],
                  look='Kalinago raider: red body and face paint, a Team headband with green parrot feathers, green feather armlets, a red loincloth, a Team sash, '
                       'a heavy boutou club, a bow on the back'),
    'calusa': R(bare=True, name='Calusa shell-spear warriors', role='infantry',
                colors=C('A8724E', Cloth='A88A60', Shell='F2EDE0', Feather='2A2A2A', Wood='5A3E28', Metal=('F2EDE0', .5, .0), Hair='1A1410'),
                legs='bare', beard=False, hair='full', dress='kilt', dress_mat='Cloth', team='sash', head=('headband', {'mat': 'Team'}),
                weapon=('pike', {'length': 2.0, 'head': 'broad'}), extras=[single_feather('Feather'), atlatl(side=1), necklace('Shell')],
                look='Calusa warrior: a Team headband with a black feather, long hair, a shell necklace, a deerskin kilt, a Team sash, a shell-tipped dart and an atlatl at the hip'),
    'haida': R(name='Haida plank-armour musketeers', role='ranged',
               colors=C('B07A58', Slat='8A6A40', Hide='5A4030', Carved='A0784A', Paint='1E1C1B', Cloth='C8382A', Leather='2A2420', Metal=IRON, Iron=IRON, Brass=BRASS, Wood='5A3E28', Hair='1A1410'),
               legs='bare', fists=order_arms, beard=False, hair='nape', dress='tunic', dress_mat='Hide', team='top',
               weapon=musket(length=.84), extras=[plank_armour('Slat', 'Hide'), carved_helmet('Carved', 'Paint')],
               look='Haida warrior: a carved wooden helmet with a beak and painted eyes over a Team band, wooden slat armour laced over a Team tunic, a trade musket upright'),
    # ---- Oceania ----
    'gunditjmara': R(bare=True, name='Gunditjmara spear-and-boomerang men', role='ranged',
                     colors=C('6A4430', Possum='6A5A44', Paint='E8E2D2', Cloth='E8DCC0', Wood='7A5A3A', Metal=('6A6A70', .3, .3), Hair='1A1410'),
                     legs='bare', beard=True, hair='full', dress='kilt', dress_mat='Possum', team='sash', head=('headband', {'mat': 'Team'}),
                     weapon=('pike', {'length': 2.2, 'head': 'narrow', 'mat': 'Wood'}), extras=[possum_cloak('Possum'), boomerang(), atlatl(side=1)],
                     look='Gunditjmara hunter: a possum-skin cloak with painted seams, a Team headband, a beard, a Team belt, a long spear, a spear-thrower and a boomerang at the belt'),
    'latte-chiefs': R(bare=True, name='Latte chief slingers', role='ranged',
                      colors=C('8A573A', Woven='C9B48A', Cord='B8A078', Stone='D8D2C4', Bag='A08A60', Cloth='E8DCC0', Wood='6A4A30', Hair='1A1410'),
                      legs='bare', beard=False, hair=None, dress='kilt', dress_mat='Woven', team='sash',
                      weapon=sling(), extras=[hair_knot('Hair'), hip_bag('Bag', side=1, name='StonePouch'), necklace('Stone')],
                      look='Chamorro slinger: hair tied in a topknot, a woven kilt, a Team sash, a stone necklace, a sling with a stone in its pouch, a pouch of sling stones'),
    'bau': R(bare=True, name='Bau war-club warriors', role='infantry',
             colors=C('6A4430', Tapa='E8DCC0', Pattern='4A3426', Cloth='E8DCC0', Wood='4A3426', Iron=IRON, Leather='4A3426', Hair='1A1410'),
             legs='bare', beard=True, hair=None, dress='kilt', dress_mat='Tapa', team='sash',
             weapon=('club', {'length': .86}), extras=[big_hair('Hair'), hair_band('Team'), slung_musket(), necklace('Cloth')],
             look='Fijian warrior of Bau: a great round mass of hair with a Team band, a beard, a white tapa kilt, a Team sash, a tall war club, a trade musket slung on the back'),
}

# the helpers' materials, for a recipe that does not set its own
DEFAULTS = {'Iron': IRON, 'Brass': BRASS, 'Gold': GOLD, 'Horn': 'E6D9B8', 'Hide': '8A6A48', 'Cord': 'B8A078', 'Stone': 'D8D2C4', 'Bag': 'A08A60',
            'Paint': 'A04A2A', 'Feather': 'E8E2D2', 'Feather2': 'E8B830', 'Shell': 'F2EDE0', 'Leaf': '4E7A32', 'Bark': '8A6A48', 'Bamboo': 'B8A060',
            'Gourd': 'C9A66B', 'Stitch': 'B8AE98', 'Felt': '1E1C1B', 'Plume': '2E4A2A', 'Sash': 'B8402E', 'Leather': '5E4030'}


def build(m):
    r = dict(RECIPES[m])
    r['colors'] = dict(DEFAULTS, **r.get('colors', {}))
    if r.pop('bare', False) and r.get('dress', 'kilt') != 'kilt':  # a bare trunk over a wrapper (ti_signature's kilt draws its own)
        r['extras'] = [lambda: F.bronze_torso('BodyTorso', 'Skin', chest=True, grow=-.004)] + list(r.get('extras', []))
    S.foot(m, r)


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        build(m)
