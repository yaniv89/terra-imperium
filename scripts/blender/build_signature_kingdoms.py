# scripts/blender/build_signature_kingdoms.py
# The Kingdoms signature units on foot (the 24 'person' rigs of src/data/signatureUnits.js) on the
# quality-pass figure with authored clips (2026-10-20, ti_signature.py), one recipe per people from the
# look lines of build_units_kingdoms_signature.py and plans/ART-MODELS-PLAN.md 4.5. Its horsemen,
# elephants and the Kitaran ox stay on that builder. The parts the kit lacks (a bare chest under a
# loin cloth, sarongs, bangles, crowns, banners, backracks...) are the helpers below, put on through a
# recipe's `extras`. Outputs go to art-build/units/signature/<model>/; copy each GLB to
# src/assets/units/signature/ and merge its "clips" into the shipped <model>.json.
#   blender -b --factory-startup -P scripts/blender/build_signature_kingdoms.py -- [model ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_figure as F  # noqa: E402
import ti_signature as S  # noqa: E402
from mathutils import Vector as V  # noqa: E402

IRON = ('8E8A84', .45, .7)
GOLD = ('D4A84A', .35, .8)
COPPER = ('B8733F', .4, .65)
STONE = ('6A6A70', .3, .3)


# ---- helpers (zero-arg callables are built with these through `x(...)`) ---------------------------------

def x(fn, *a, **k):
    """A recipe extra: fn(*a, **k) once the figure, its dress, headgear and weapon are built."""
    return lambda: fn(*a, **k)


def bare_chest():
    """The bare trunk the kit leaves out under a kilt (dress 'kilt' or none, no armour)."""
    F.bronze_torso('BodyTorso', 'Skin', chest=True, grow=-.004)


def quilted(mat='Team', grow=.012, ribs=.06, name='Quilted'):
    """A quilted (or woven) coat on the trunk, Spine and Chest. The kit's dress(armour='quilt') passes
    ribs=6 to F.torso, which throws every second column far out into spikes; this is that coat with a
    channel depth of a few per cent."""
    F.torso(name, mat, grow=grow, chest=.008, ribs=ribs)


def wrapped_turban(mat='Team', knot=None):
    """A full wrapped turban: a broad rounded drum of cloth over the brow and a knot at the front."""
    F.lathe('Turban', [(0, 1.046), (.042, 1.042), (.070, 1.022), (.081, .992), (.080, .962), (.073, .940), (0, .942)], mat, sides=10)
    F.tube('TurbanKnot', [((0, -.070, 1.000), .020, 'Head'), ((0, -.084, 1.006), .016, 'Head'), ((0, -.088, 1.012), .006, 'Head')], knot or mat, 6)


def wrap(name='Wrap', mat='Cloth', low=.30, top=.548, flare=.008, grow=.004):
    """A cloth wrapped round the hips (a dhoti to the knee, a sarong to the ankle, a loin cloth), Hips."""
    F.skirt(name, mat, low=low, top=top, sides=10, grow=grow, flare=flare)


def hem_band(name, mat, z, grow=.010):
    """A band of another colour round a wrap (a batik border, a fur hem), Hips."""
    rs = [tuple(r + grow for r in F.radius_at(zz, F.SKIRT)) for zz in (z, z + .022)]
    F.tube(name, F.vertical([z, z + .022], 0, rs, 'Hips'), mat, 10, caps=(False, False))


def flat(name, outline, y, mat, bone, depth=.006, centre=None, attachment=False):
    """A flat plate in the XZ plane at depth y (its outline (x, z) points star-shaped about `centre`):
    a banner, a headdress plate."""
    n = len(outline)
    c = centre or (sum(p[0] for p in outline) / n, sum(p[1] for p in outline) / n)
    verts = [(c[0], y, c[1])] + [(px, y, pz) for px, pz in outline] + [(c[0], y + depth, c[1])] + [(px, y + depth, pz) for px, pz in outline]
    faces = []
    for j in range(n):
        q = (j + 1) % n
        faces += [(0, 1 + j, 1 + q), (n + 1, n + 2 + q, n + 2 + j), (1 + j, 1 + q, n + 2 + q), (1 + j, n + 2 + q, n + 2 + j)]
    return F.raw(name, verts, faces, mat, bone, attachment)


def _arm(side):
    b = F.arm.data.bones
    return b['Arm_' + side].head_local.copy(), b['Forearm_' + side].head_local.copy(), b['Hand_' + side].head_local.copy()


def bangles(mat='Metal', at=(.78, .90), name='Bangle'):
    """Rings round both wrists (gold, shell, painted clay), on the forearms."""
    for side in 'LR':
        _, el, wr = _arm(side)
        for k, t in enumerate(at):
            r = .034 - .010 * t
            F.tube(f'{name}{side}{k}', [(tuple(el.lerp(wr, t - .035)), r, 'Forearm_' + side), (tuple(el.lerp(wr, t + .035)), r, 'Forearm_' + side)],
                   mat, 6, caps=(False, False))


def armlets(mat='Metal', t=.45, wide=.035, name='Armlet'):
    """A band round each upper arm."""
    for side in 'LR':
        sh, el, _ = _arm(side)
        F.tube(f'{name}{side}', [(tuple(sh.lerp(el, t - wide)), .045, 'Arm_' + side), (tuple(sh.lerp(el, t + wide)), .044, 'Arm_' + side)],
               mat, 6, caps=(False, False))


def leg_bands(mat, zs=(.15, .40), name='LegBand'):
    """Painted (or tied) bands round the shins and the thighs."""
    for side, s in (('L', 1), ('R', -1)):
        for k, z in enumerate(zs):
            bone, r = ('Shin_' + side, (.041, .042)) if z < .26 else ('Leg_' + side, (.050, .048))
            lx = .061 + .009 * min(1, (.47 - z) / .15) if z > .32 else .072
            F.tube(f'{name}{side}{k}', [((s * lx, -.004, z - .012), r, bone), ((s * lx, -.004, z + .012), r, bone)], mat, 7, caps=(False, False))


def necklace(mat='Cloth', beads=None, n=5, name='Necklace', drop=.040):
    """A collar of beads on the shoulders with pendants hanging on the chest (shells, gold, beads), Chest."""
    F.tube(name, F.vertical([.776, .790], .002, [(.098, .068), (.083, .060)], 'Chest'), mat, 10, caps=(False, False))
    for k in range(n):
        a = math.pi * (.30 + .40 * k / max(1, n - 1))
        px, py = .080 * math.cos(a), -.074 * math.sin(a) - .010
        F.box(f'{name}Bead{k}', (px, py, .772 - drop * math.sin(a) * .9), (.018, .010, .020), beads or mat, 'Chest')


def ear_spools(mat='Metal'):
    for s in (-1, 1):
        F.tube(f'EarSpool{s}', [((s * .058, .002, .905), .016, 'Head'), ((s * .072, .002, .905), .016, 'Head')], mat, 6)


def topknot(mat='Hair'):
    F.lathe('Topknot', [(0, .992), (.024, .996), (.032, 1.022), (.026, 1.048), (0, 1.058)], mat, sides=8, cy=.012)


def fish_banner():
    """The Pandyan fish banner: a pole up the back (Chest) and a Team fish-shaped flag above the head."""
    px, py = .055, .102
    F.tube('BannerPole', [((px, py, .560), .008, 'Chest'), ((px, py, 1.420), .007, 'Chest')], 'Wood', 5)
    fish = [(.065, 1.352), (.105, 1.380), (.170, 1.388), (.230, 1.370), (.300, 1.400), (.268, 1.352), (.300, 1.304), (.230, 1.334),
            (.170, 1.316), (.105, 1.324)]
    flat('FishBanner', fish, py - .003, 'Team', 'Chest', centre=(.170, 1.352))
    F.tube('BannerFinial', [((px, py, 1.418), .012, 'Chest'), ((px, py, 1.446), .002, 'Chest')], 'Metal', 5)


def back_panel(mat='Wood', rib='Leather', y=.195, w=.250, h=.330, z=.640, ribs=4, name='BambooShield'):
    """A bamboo or board shield slung on the back (behind the quiver), Chest."""
    F.box(name, (0, y, z), (w, .018, h), mat, 'Chest')
    for k in range(ribs):
        F.box(f'{name}Rib{k}', (-w / 2 + w * (k + .5) / ribs, y + .011, z), (.012, .008, h), rib, 'Chest')


def back_round(radius=.140, y=.205, z=.640, rim='Wood', back='Wood'):
    """A light round shield slung on the back, its Emblem face outward (the round shield turned about)."""
    n0 = len(F.meshes)
    F.round_shield((0, y, z), radius, bone='Chest', rim=rim, back=back)
    F.turn(F.meshes[n0:], (0, y, z), 180)


def jade_boss(mat='Jade'):
    cx, cy, cz = .225, -.166, .612
    F.tube('JadeBoss', [((cx, cy - .030, cz), .046, 'Prop_L'), ((cx, cy - .048, cz), .036, 'Prop_L'), ((cx, cy - .058, cz), .012, 'Prop_L')], mat, 8, attachment=True)


def fur_trim(mat='Fur', low=.330):
    """A fur hem round the coat's skirt (Hips) and a fur collar (Chest)."""
    hem_band('FurHem', mat, low - .006, grow=.020)
    F.tube('FurCollar', F.vertical([.756, .792], .004, [(.134, .088), (.096, .068)], 'Chest'), mat, 10, caps=(False, False))


def crescent_headdress(mat='Metal'):
    """The Moche warrior-priest's crest: a tall half-moon plate standing over the brow."""
    pts = [(.15 * math.cos(math.radians(a)), .985 + .16 * math.sin(math.radians(a))) for a in range(0, 181, 20)]
    flat('Crescent', pts, -.050, mat, 'Head', depth=.008, centre=(0, 1.03))


def stepped_headdress(mat='Cloth'):
    for k, (w, d, z) in enumerate(((.156, .140, .975), (.118, .108, 1.012), (.078, .074, 1.046))):
        F.box(f'Step{k}', (0, -.003, z), (w, d, .040), mat, 'Head')


def four_corner_hat(mat='Cloth', tufts='Dye'):
    """The Wari four-cornered pile hat: a tall square cap with a tuft at each top corner."""
    F.box('FourCornerHat', (0, -.003, .995), (.150, .140, .090), mat, 'Head')
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        F.box(f'HatTuft{i}', (sx * .068, -.003 + sy * .063, 1.048), (.024, .024, .030), tufts, 'Head')


def chequer(mat='Cloth', grow=.004):
    """Light squares on a Team tunic front and back (Spine and Chest: the squares stay light)."""
    k = 0
    for z in (.575, .630, .685):
        for col in (-1, 1):
            if (round(z * 100) // 5 + (col > 0)) % 2:
                continue
            for side in (-1, 1):
                ry = F.radius_at(z, F.TORSO)[1] + grow
                F.box(f'Cheq{k}', (col * .036, side * ry, z), (.040, .006, .040), mat, 'Spine' if z < .66 else 'Chest')
                k += 1


def skirt_squares(mat='Dye', z=.420, n=8):
    """Squares of another colour round the tunic's skirt (Hips)."""
    for k in range(n):
        a = 2 * math.pi * (k + .5) / n
        rx, ry = F.radius_at(z, F.SKIRT)
        F.box(f'SkirtSq{k}', ((rx + .006) * math.sin(a), -(ry + .006) * math.cos(a), z), (.030, .030, .036), mat, 'Hips')


def ife_crown(beads='Beads', band='Team', plume='Cloth'):
    """The Ife beaded crown: a ridged cone of bead rows, a Team band at the brow, a crest on top and bead
    strands at the temples."""
    F.lathe('BeadedCrown', [(0, 1.158), (.020, 1.154), (.038, 1.110), (.048, 1.106), (.045, 1.096), (.055, 1.056), (.064, 1.052), (.060, 1.044),
                            (.068, 1.000), (.074, .994), (.071, .986), (.073, .944), (0, .944)], beads, sides=10)
    F.headband(band, z=.956, height=.026)
    F.tube('CrownCrest', [((0, -.004, 1.150), .012, 'Head'), ((0, -.012, 1.205), .010, 'Head'), ((0, -.026, 1.232), .004, 'Head')], plume, 5)
    for s in (-1, 1):
        for k in range(2):
            F.box(f'BeadStrand{s}{k}', (s * .070, -.020 + .022 * k, .900), (.008, .008, .070), beads, 'Head')


def backrack(mat='Plume', frame='Wood', n=7):
    """A Maya feather backrack: a fan of long plumes rising behind the shoulders (Chest)."""
    base = V((0, .118, .735))
    F.box('BackrackFrame', (0, .108, .700), (.120, .016, .080), frame, 'Chest')
    for k in range(n):
        a = math.radians(-66 + 132 * k / (n - 1))
        d = V((math.sin(a), .10, math.cos(a))).normalized()
        b = base + V((math.sin(a) * .030, 0, 0))
        F.tube(f'Plume{k}', [(tuple(b), (.010, .005), 'Chest'), (tuple(b + d * .200), (.028, .006), 'Chest'), (tuple(b + d * .390), (.006, .003), 'Chest')], mat, 4)


def spots(mat='Hair', zs=(.380, .450, .510), n=7, name='Rosette'):
    """Dark rosettes round a pelt kilt (Hips)."""
    k = 0
    for i, z in enumerate(zs):
        for j in range(n):
            a = 2 * math.pi * (j + .5 * i) / n
            rx, ry = F.radius_at(z, F.SKIRT)
            F.box(f'{name}{k}', ((rx + .008) * math.sin(a), -(ry + .008) * math.cos(a), z), (.020, .020, .018), mat, 'Hips')
            k += 1


def hip_club(head='star', mat='Metal', name='HipMace'):
    """A club or a star-headed mace thrust through the belt at the left hip, head up (Hips)."""
    lo, hi = V((.142, .030, .330)), V((.128, -.070, .640))
    F.tube(name + 'Haft', [(tuple(lo), .010, 'Hips'), (tuple(hi), .010, 'Hips')], 'Wood', 5)
    if head == 'star':
        F.box(name + 'Head', tuple(hi), (.034, .034, .034), mat, 'Hips')
        for i, d in enumerate(((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1))):
            F.tube(f'{name}Spike{i}', [(tuple(hi + V(d) * .012), .012, 'Hips'), (tuple(hi + V(d) * .040), .002, 'Hips')], mat, 4)
    else:
        F.tube(name + 'Knob', [(tuple(hi - V((0, 0, .030))), .014, 'Hips'), (tuple(hi + V((0, 0, .010))), .026, 'Hips'), (tuple(hi + V((0, 0, .040))), .010, 'Hips')], mat, 6)


def chest_stripes(mat='Paint'):
    """Painted stripes across the bare chest (Chest and Spine)."""
    for k, z in enumerate((.700, .640, .590)):
        ry = F.radius_at(z, F.TORSO)[1]
        F.box(f'ChestStripe{k}', (0, -ry + .002, z), (.120 - .015 * k, .006, .012), mat, 'Chest' if z > .66 else 'Spine')


def kampilan(length=.66, shield=True):
    """The kampilan: a long single-edged blade widening to a forked tip, upright in the right fist."""
    k = S.sword(length=length, mat='Steel')
    k.shield = shield  # the narrow shield comes with the extras (a custom weapon takes no recipe shield)
    x, y, top = S.HAND_R.x, S.HAND_R.y, .652 + length
    F.box('KampilanFork', (x, y + .004, top - .010), (.008, .046, .028), 'Steel', 'Prop_R', True)
    F.tube('KampilanSpike', [((x, y - .020, top - .020), .004, 'Prop_R'), ((x, y - .024, top + .028), .001, 'Prop_R')], 'Steel', 4, attachment=True)
    return k


def spear_and_kris(length=2.0, head='leaf'):
    """A spear in the right fist and a kris in the left, point up. The spear clips without a shield fail
    in ti_foot_clips.block (its hold() takes no pole there), so the kit is told there is a shield: the
    left fist brings the kris forward as a parrying blade wherever a shield would come up."""
    k = S.spear(length=length, head=head)
    x, y, P = S.HAND_L.x, S.HAND_L.y, 'Prop_L'
    F.tube('KrisGrip', [((x, y, .566), .010, P), ((x, y, .644), .010, P)], 'Wood', 5, attachment=True)
    F.box('KrisGuard', (x, y - .004, .648), (.018, .044, .012), 'Metal', P, True)
    F.tube('KrisBlade', [((x, y, .652), (.005, .016), P), ((x, y - .008, .700), (.005, .014), P), ((x, y + .006, .750), (.004, .012), P),
                         ((x, y - .004, .800), (.002, .002), P)], 'Metal', 4, attachment=True)
    k.shield = True
    return k


def spear_and_club(length=2.4, head='narrow'):
    """A spear in the right fist and a short hardwood club in the left, head up (the same shield
    stand-in as spear_and_kris)."""
    k = S.spear(length=length, head=head)
    x, y, P = S.HAND_L.x, S.HAND_L.y, 'Prop_L'
    F.tube('LeftClub', [((x, y, .560), .011, P), ((x, y, .700), .016, P), ((x, y, .830), .030, P), ((x, y, .870), .022, P), ((x, y, .884), .006, P)],
           'Wood', 6, attachment=True)
    k.shield = True
    return k


# ---- the roster ---------------------------------------------------------------------------------------------

RECIPES = {
    # Central Asia
    'khotan': dict(name='Khotan oasis garrison spearmen (improvised)', role='infantry',
                   colors={'Skin': 'D2A47E', 'Cloth': '6FA58A', 'Leather': '6E4A30', 'Metal': IRON, 'Wood': '5A4130', 'Jade': ('7FC2A0', .25, .1)},
                   legs='boots', sleeves='Cloth', beard=True, dress='tunic', team=None,
                   head=('helmet', {'peak': 1.064, 'cheeks': False, 'neck': True}),
                   weapon=('spear', {'length': 2.4}), shield=('round', {'size': .95}),
                   extras=[quilted, x(F.band, 'Belt', 'Leather', .536, .562, .030, bone='Spine'), jade_boss],
                   look='Khotan garrison spearman: a quilted Team coat over a green tunic with long sleeves, a leather belt, boots, an iron bowl helmet with a neck guard, a spear and a round shield with a jade boss'),
    'zhangzhung': dict(name='Zhangzhung highland spearmen (improvised)', role='infantry',
                       colors={'Skin': 'B47A52', 'Cloth': 'B8A27A', 'Leather': '5E4030', 'Wood': '5A4130', 'Metal': IRON, 'Fur': 'D8CDB4', 'Felt': '4E3A2C', 'Hide': '3A2C24'},
                       legs=('boots', 'Leather'), sleeves='Cloth', beard=False, hair='full', dress='tunic', dress_mat='Cloth', team='top',
                       weapon=('spear', {'length': 2.3, 'head': 'broad'}), shield=('round', {'size': 1.05, 'rim': 'Hide', 'back': 'Hide'}),
                       extras=[x(fur_trim, 'Fur', .360), x(F.round_hat, 'FeltHat', 'Felt', band='Team', brim=.120, crown=1.074, droop=.012)],
                       look='Zhangzhung highlander: a knee-length coat with a Team top and a pale fur hem and collar, a brown felt hat with a Team band, leather boots, a broad spear and a round yak-hide shield'),
    # South Asia
    'pandya': dict(name='Pandyan swordsmen (improvised)', role='infantry',
                   colors={'Skin': '8A573A', 'Cloth': 'F2ECDA', 'Metal': IRON, 'Wood': '5A4130', 'Hair': '1E1612'},
                   legs='bare', beard=True, hair='nape', dress='none', team=None,
                   weapon=('sword', {'length': .44}), shield=('round', {'size': .85}),
                   extras=[bare_chest, x(wrapped_turban, 'Team', 'Cloth'), x(wrap, 'WaistCloth', 'Cloth', .330), x(armlets, 'Metal'), fish_banner],
                   look='Pandyan swordsman: a white waist cloth, bare chest, iron armlets, a Team turban, a straight sword and a round shield, a Team fish banner on a pole over his back'),
    'rajarata': dict(name='Rajaratan spearmen (improvised)', role='infantry',
                     colors={'Skin': '7E4E33', 'Cloth': 'EFE6D0', 'Metal': IRON, 'Wood': '5A4130', 'Hair': '1E1612'},
                     legs='bare', beard=True, hair='nape', dress='none', team='shawl', head=('headcloth', {'band': 'Team', 'tail': False}),
                     weapon=('spear', {'length': 2.2}), shield=('rect', {'size': .66}),
                     extras=[bare_chest, x(wrap, 'Dhoti', 'Cloth', .360, flare=.014)],
                     look='Rajaratan spearman: a short white dhoti, a Team shawl over one shoulder, a white headcloth with a Team band, a spear and a square shield'),
    'vanga': dict(name='Vangan delta boat archers (improvised)', role='ranged',
                  colors={'Skin': '8A573A', 'Cloth': 'EFE6D0', 'Wood': '8A7040', 'Leather': '6E4A30', 'Bamboo': 'B8A060', 'Hair': '1E1612'},
                  legs='bare', beard=False, hair='nape', dress='none', team='shawl',
                  weapon=('bow', {'length': .95}),
                  extras=[bare_chest, x(wrapped_turban, 'Cloth'), x(wrap, 'Dhoti', 'Cloth', .300), x(back_panel, 'Bamboo', 'Leather')],
                  look='Vangan boat archer: a white dhoti, a Team shawl over one shoulder, a white turban, a bow, a quiver and a bamboo shield slung on his back'),
    # South-east Asia
    'funan': dict(name='Funan marine archers (improvised)', role='ranged',
                  colors={'Skin': 'A06A48', 'Cloth': 'D9C7A0', 'Wood': '6A4A30', 'Metal': IRON, 'Sarong': '7A3A2A', 'Hair': '1E1612'},
                  legs='bare', beard=False, hair='full', dress='none', team='sash',
                  weapon=('bow', {'length': 1.12, 'brace': .080}),
                  extras=[bare_chest, x(wrap, 'Sarong', 'Sarong', .120, flare=.010), topknot, x(F.hip_sword, 'ShortSword', 'L', length=.30), x(bangles, 'Metal', (.86,))],
                  look='Funan marine archer: a long dark red sarong with a Team sash, bare chest, a topknot, a tall bow, a quiver and a short sword at the hip'),
    'pyu': dict(name='Pyu city-guard spearmen (improvised)', role='infantry',
                colors={'Skin': 'A06A48', 'Cloth': 'E6DDC5', 'Wood': '8A6A40', 'Metal': IRON, 'Sarong': '3A4A7A', 'Wicker': 'B89A5E', 'Hair': '1E1612'},
                legs='bare', sleeves='Cloth', beard=False, hair='nape', dress='none', team=None, head=('turban', {'mat': 'Team'}),
                weapon=('spear', {'length': 2.2, 'head': 'narrow'}), shield=('oval', {'size': .85, 'rim': 'Wicker', 'back': 'Wicker'}),
                extras=[x(F.torso, 'Jacket', 'Cloth', grow=.004, chest=.004), x(wrap, 'Sarong', 'Sarong', .150, flare=.010), x(hem_band, 'SarongHem', 'Cloth', .200)],
                look='Pyu city guard: a white long-sleeved jacket over an indigo wrapped sarong, a tall Team turban, a narrow spear and an oval wicker shield'),
    'dvaravati': dict(name='Dvaravati sword-and-spear infantry', role='infantry',
                      colors={'Skin': 'A06A48', 'Cloth': 'E6DDC5', 'Metal': IRON, 'Wood': '5A4130', 'Hair': '1E1612'},
                      legs='bare', beard=False, hair='nape', dress='none', team=None, head=('cap', {'mat': 'Team', 'height': 1.076}),
                      weapon=('sword', {'length': .46}), shield=('small', {'size': 1.0}),
                      extras=[bare_chest, x(wrap, 'Dhoti', 'Cloth', .350, flare=.012), x(F.band, 'Belt', 'Team', .536, .560, .022, bone='Spine'),
                              x(ear_spools, 'Metal'), x(armlets, 'Metal', .30)],
                      look='Dvaravati swordsman: a white dhoti with a Team waistband, bare chest, a pointed Team cloth cap, ear spools and armlets, a straight sword and a small round buckler'),
    'srivijaya': dict(name='Srivijayan orang laut sea warriors', role='infantry',
                      colors={'Skin': '7E4E33', 'Cloth': 'D9C7A0', 'Metal': IRON, 'Wood': '5A4130', 'Batik': '6A4A2A', 'Hair': '1E1612'},
                      legs='bare', beard=False, hair='full', dress='none', team='sash', head=('headcloth', {'band': 'Team', 'tail': False, 'cloth': 'Batik'}),
                      weapon=('custom', {'make': spear_and_kris}),
                      extras=[bare_chest, x(wrap, 'Sarong', 'Batik', .300, flare=.010), x(hem_band, 'SarongHem', 'Cloth', .310),
                              x(F.hip_sword, 'Kris', 'L', length=.26, scabbard='Wood', hilt=False), x(bangles, 'Cloth', (.88,))],
                      look='Orang laut sea warrior: a knee-length brown batik sarong with a pale hem and a Team sash, bare chest, a batik headcloth with a Team band, a spear and a drawn kris in the left hand (its sheath at the hip), no shield'),
    'tarumanagara': dict(name='Tarumanagara spear warriors (improvised)', role='infantry',
                         colors={'Skin': '8A573A', 'Cloth': 'C9A66B', 'Wood': '5A4130', 'Metal': IRON, 'Batik': '8A5A2A', 'Hair': '1E1612'},
                         legs='bare', beard=True, hair='nape', dress='none', team='shawl', head=('headcloth', {'band': 'Batik', 'tail': True, 'cloth': 'Team'}),
                         weapon=('spear', {'length': 2.3, 'head': 'broad'}), shield=('round', {'size': .80, 'rim': 'Wood'}),
                         extras=[x(F.torso, 'BatikTop', 'Batik', grow=.002), x(wrap, 'BatikWrap', 'Cloth', .160, flare=.012),
                                 x(hem_band, 'WrapBand0', 'Batik', .250), x(hem_band, 'WrapBand1', 'Batik', .420)],
                         look='Tarumanagara spearman: an ankle-length ochre batik wrap with brown bands, a brown batik top under a Team shoulder cloth, a Team headcloth, a broad spear and a round wooden shield'),
    'butuan': dict(name='Butuan gold-ornament swordsmen', role='infantry',
                   colors={'Skin': '8A573A', 'Cloth': 'B03A2A', 'Metal': GOLD, 'Steel': ('A3A6A8', .35, .8), 'Wood': '6A4A30', 'Hair': '1E1612'},
                   legs='bare', beard=False, hair='full', dress='none', team='sash', head=('headcloth', {'band': 'Team', 'tail': True, 'cloth': 'Cloth'}),
                   weapon=('custom', {'make': kampilan}), shield=None,
                   extras=[bare_chest, x(wrap, 'Wrap', 'Cloth', .370), x(bangles, 'Metal', (.74, .86)), x(armlets, 'Metal'), x(necklace, 'Metal', n=5),
                           x(F.heater_shield, (.238, -.172, .560), .190, .440, rim='Wood', back='Wood', curve=.020)],
                   look='Butuan swordsman: a short red wrap with a Team sash, bare chest hung with gold, gold armlets and bangles, red wrapped hair with a Team band, a long kampilan with a forked tip and a narrow wooden shield'),
    # Africa
    'djenne-djeno': dict(name='Djenne-Djeno spearmen (improvised)', role='infantry',
                         colors={'Skin': '5E3C2A', 'Cloth': 'E6DDC5', 'Wood': '8A6A40', 'Metal': IRON, 'Mud': '9A6A44', 'Hair': '1A1410'},
                         legs='bare', sleeves=None, beard=True, hair='full', dress='tunic', dress_mat='Cloth', team='top', head=('cap', {'mat': 'Cloth', 'height': 1.040}),
                         weapon=('spear', {'length': 2.3}), shield=('oval', {'size': 1.0, 'rim': 'Mud', 'back': 'Mud'}),
                         extras=[x(F.band, 'Belt', 'Mud', .536, .562, .026, bone='Spine'), x(necklace, 'Mud', n=3)],
                         look='Djenne-Djeno spearman: a white cotton tunic with a Team top, a mud-brown belt and beads, a white cotton cap, a spear and a mud-coloured oval wicker shield'),
    'ife': dict(name='Ife beaded-crown spearmen (improvised)', role='infantry',
                colors={'Skin': '5E3C2A', 'Cloth': 'D9B870', 'Leather': '8A6A40', 'Metal': IRON, 'Wood': '5A4130', 'Beads': 'B8402E', 'Hide': 'C8A878'},
                legs='bare', beard=False, hair='none', dress='none', team=None,
                weapon=('spear', {'length': 2.2}), shield=('round', {'size': .90, 'rim': 'Leather', 'back': 'Hide'}),
                extras=[bare_chest, x(wrap, 'Wrapper', 'Cloth', .360, flare=.014), x(F.band, 'Belt', 'Team', .536, .562, .022, bone='Spine'),
                        x(ife_crown, 'Beads', 'Team', 'Beads'), x(necklace, 'Beads', n=5), x(bangles, 'Beads', (.86,))],
                look='Ife spearman: a tall red beaded crown with a crest and a Team band, a gold wrapper with a Team belt, bead collar and bracelets, a spear and a round hide shield'),
    'engaruka': dict(name='Engaruka terrace spearmen (improvised)', role='infantry',
                     colors={'Skin': '5E3C2A', 'Leather': '8A6A40', 'Wood': '5A4130', 'Metal': IRON, 'Hide': 'A8805A', 'Ochre': 'A0502E'},
                     legs='bare', beard=False, hair='none', dress='none', team='sash',
                     weapon=('spear', {'length': 2.5, 'head': 'narrow'}), shield=('oval', {'size': 1.08, 'rim': 'Leather', 'back': 'Hide'}),
                     extras=[bare_chest, x(wrap, 'Kilt', 'Ochre', .380), x(F.cloak, 'HideCloak', 'Hide', top=.792, low=.400, thick=.010),
                             x(F.headband, 'Team', z=.958), x(bangles, 'Leather', (.84,))],
                     look='Engaruka terrace farmer: a shaved head with a Team band, an ochre kilt with a Team sash, a long hide cloak down the back, a long narrow spear and a tall oval hide shield'),
    'mapungubwe': dict(name='Mapungubwe gold-rhino archers (improvised)', role='ranged',
                       colors={'Skin': '5E3C2A', 'Leather': '8A6A40', 'Metal': GOLD, 'Wood': '5A4130', 'Hide': '6E4A30'},
                       legs='bare', beard=True, hair='full', dress='none', team='sash',
                       weapon=('bow', {'length': .92}),
                       extras=[bare_chest, x(wrap, 'Loincloth', 'Hide', .420), x(bangles, 'Metal', (.70, .80, .90)), x(necklace, 'Metal', n=7, drop=.050),
                               x(leg_bands, 'Metal', (.14,)), x(F.headband, 'Team', z=.950)],
                       look='Mapungubwe archer: a hide loin cloth with a Team sash and headband, stacks of gold bangles, a gold collar and anklets, a bow and a quiver'),
    'san': dict(name='San poison-arrow hunters', role='ranged',
                colors={'Skin': 'A8724E', 'Leather': '9A7650', 'Cloth': 'EFE6D0', 'Wood': '6A4A30', 'Hair': '2A1E16', 'Shell': 'F2EAD8'},
                legs='bare', beard=False, hair='full', dress='none', team=None,
                weapon=('bow', {'length': .60, 'brace': .060, 'recurve': .03}),
                extras=[bare_chest, x(wrap, 'Loincloth', 'Leather', .440), x(F.cloak, 'Kaross', 'Leather', top=.790, low=.520, rows=3, thick=.008),
                        x(F.headband, 'Team', z=.955, height=.030), x(necklace, 'Shell', n=7, drop=.030), x(F.band, 'Belt', 'Team', .540, .560, .016, bone='Spine')],
                look='San hunter: a small slight figure in a leather loin cloth and short kaross cape, ostrich-shell beads, a Team headband and belt, a tiny bow and a quiver of poison arrows'),
    # The Americas
    'moche': dict(name='Moche warrior-priest clubmen', role='infantry',
                  colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Metal': COPPER, 'Wood': '5A4130', 'Hair': '1E1612'},
                  legs='bare', sleeves=None, beard=False, hair='nape', dress='tunic', dress_mat='Cloth', team='top', head=('headcloth', {'band': 'Team', 'tail': True}),
                  weapon=('club', {'length': .52}), shield=('small', {'size': 1.05, 'rim': 'Metal'}),
                  extras=[x(crescent_headdress, 'Metal'), x(ear_spools, 'Metal'), x(F.band, 'Belt', 'Metal', .536, .558, .022, bone='Spine')],
                  look='Moche warrior-priest: a tall copper half-moon crest over a cloth headdress with a Team band, ear spools, a Team tunic over a pale skirt, a copper belt, a conical war club and a small round shield'),
    'wari': dict(name='Wari mace-and-dart warriors', role='infantry',
                 colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Wood': '5A4130', 'Metal': STONE, 'Dye': '8A3A2A', 'Hair': '1E1612'},
                 legs='bare', beard=False, hair='nape', dress='tunic', dress_mat='Cloth', team='top',
                 weapon=('mace', {'length': .50}), shield=('rect', {'size': .58}),
                 extras=[chequer, x(skirt_squares, 'Dye'), x(four_corner_hat, 'Dye', 'Cloth')],
                 look='Wari warrior: a chequered tunic (Team and pale squares, red squares on the skirt), a red four-cornered hat with pale corner tufts, a stone-headed mace and a small square shield'),
    'tiwanaku': dict(name='Tiwanaku spear-thrower warriors (improvised)', role='infantry',
                     colors={'Skin': 'A8724E', 'Cloth': 'C9A66B', 'Wood': '5A4130', 'Metal': ('8A7A5A', .35, .5), 'Hair': '1E1612'},
                     legs='bare', beard=False, hair='nape', dress='tunic', dress_mat='Cloth', team='top',
                     weapon=('spear', {'length': 1.7, 'head': 'narrow'}), shield=('round', {'size': .70, 'rim': 'Wood'}),
                     extras=[x(stepped_headdress, 'Cloth'), x(F.headband, 'Team', z=.955, height=.022), x(hip_club, 'star', 'Metal'),
                             x(F.band, 'Belt', 'Wood', .536, .558, .022, bone='Spine')],
                     look='Tiwanaku warrior: a stepped ochre headdress over a Team band, a Team tunic, a short dart for the spear-thrower, a star-headed mace in the belt and a small round shield'),
    'marajoara': dict(name='Marajoara fortress archers (improvised)', role='ranged',
                      colors={'Skin': 'A8724E', 'Leather': '6A4A30', 'Cloth': 'E8D9B0', 'Wood': '6A4A30', 'Paint': 'A03A22', 'Clay': 'E0C8A0', 'Plume': 'E0B030', 'Hair': '1E1612'},
                      legs='bare', beard=False, hair='full', dress='none', team='sash', head=('feathers', {'band': 'Team', 'mat': 'Plume', 'n': 7, 'tall': .16}),
                      weapon=('bow', {'length': 1.15, 'brace': .080}),
                      extras=[bare_chest, x(wrap, 'Loincloth', 'Leather', .440), chest_stripes, x(leg_bands, 'Paint', (.15, .38)),
                              x(armlets, 'Clay', .40, .06), x(bangles, 'Paint', (.80,))],
                      look='Marajoara archer: red body paint in stripes and bands, a yellow feather crown on a Team band, painted clay armlets, a loin cloth with a Team sash, a tall bow and a quiver'),
    'mutal': dict(name='Mutal spear-and-shield lords', role='infantry',
                  colors={'Skin': 'A8724E', 'Jaguar': 'D0A048', 'Wood': '3A2A1E', 'Cloth': 'E8D9B0', 'Plume': '3E9A6A', 'Metal': ('2A2A30', .3, .2), 'Hair': '1E1612'},
                  legs='sandals', beard=False, hair='full', dress='none', team='sash', head=('headband', {'mat': 'Team'}),
                  weapon=('spear', {'length': 2.1, 'head': 'broad'}), shield=('round', {'size': .80, 'rim': 'Jaguar'}),
                  extras=[bare_chest, x(wrap, 'JaguarKilt', 'Jaguar', .380, flare=.010), x(spots, 'Hair'), backrack, x(necklace, 'Plume', n=5), x(ear_spools, 'Cloth')],
                  look='Maya lord: a spotted jaguar-pelt kilt with a Team sash, a green feather backrack fanning over the shoulders, a jade collar, a Team headband, sandals, an obsidian-edged spear and a round shield'),
    'hohokam': dict(name='Hohokam shell-and-bow archers', role='ranged',
                    colors={'Skin': 'A8724E', 'Cloth': 'EFE6D0', 'Leather': '9A7650', 'Wood': '6A4A30', 'Shell': ('F4EEE2', .3, .1), 'Hair': '1E1612'},
                    legs='sandals', beard=False, hair='full', dress='none', team='shawl', head=('headband', {'mat': 'Cloth'}),
                    weapon=('bow', {'length': .90}),
                    extras=[bare_chest, x(wrap, 'BreechCloth', 'Cloth', .420), x(necklace, 'Shell', n=7, drop=.050), x(bangles, 'Shell', (.78, .88)),
                            x(armlets, 'Shell', .40)],
                    look='Hohokam archer: a white breech cloth and a Team cotton blanket over one shoulder, white shell collar, bracelets and armlets, sandals, a bow and a quiver'),
    'chaco': dict(name='Chacoan great-house bowmen (improvised)', role='ranged',
                  colors={'Skin': 'A8724E', 'Cloth': 'E8D9B0', 'Leather': '8A6A40', 'Wood': '6A4A30', 'Turq': '3AA8A0', 'Hair': '1E1612'},
                  legs='sandals', sleeves=None, beard=False, hair='full', dress='tunic', dress_mat='Cloth', team='top',
                  weapon=('bow', {'length': .96}),
                  extras=[x(F.band, 'Belt', 'Turq', .536, .558, .022, bone='Spine'), x(necklace, 'Turq', n=3), x(F.headband, 'Turq', z=.952),
                          x(back_round, .130, .210, .600)],
                  look='Chacoan bowman: a white cotton kilt under a Team shirt, turquoise belt, beads and headband, sandals, a bow, a quiver and a light round shield on his back'),
    # The Pacific
    'saudeleur': dict(name='Saudeleur basalt-city spearmen (improvised)', role='infantry',
                      colors={'Skin': '7E4E33', 'Wood': 'A08A5A', 'Cloth': 'D9C7A0', 'Metal': ('3A3A40', .3, .3), 'Fibre': 'B89A5E', 'Hair': '1E1612'},
                      legs='bare', beard=True, hair='full', dress='none', team='sash',
                      weapon=('custom', {'make': spear_and_club}),
                      extras=[x(quilted, 'Fibre', .012, .08, 'FibreCuirass'), x(wrap, 'Wrapper', 'Cloth', .330), x(F.strips, 'FibreSkirt', 'Fibre', .520, .300, n=14, grow=.016), x(F.headband, 'Team', z=.958)],
                      look='Saudeleur spearman: a woven coconut-fibre cuirass, a fibre-strip skirt over a pale wrapper, a Team sash and headband, a long spear in one hand and a hardwood war club in the other'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        S.foot(m, RECIPES[m])
