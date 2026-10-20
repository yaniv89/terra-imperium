# scripts/blender/build_units_stone.py
# The Stone Age base foot units (eight-ages plan U80, 2026-10-20) on the quality-pass figure with authored
# clips (ti_signature.foot), the parts from build_signature_bronze.py's helpers and the Stone ones below:
# hide and fur, no helmets, stone axes, clubs and flint spears, short bows, body paint in the nation colour
# (Team stripes on the chest and a Team band on the brow: the battle dyes Chest and Head), a totem for the
# chief. Classes (src/data/unitClasses.js, stone): Warband (infantry), Hunters (ranged), Shaman (support),
# plus the chief (general), the mercenary and the raider (no horses in the Stone Age: they go on foot).
# The ladder crew (siege), the worker and the settler band are built by their own files.
#   blender -b --factory-startup -P scripts/blender/build_units_stone.py -- [uid ...]
# Outputs go to art-build/units/signature/<uid>/ (the kit's folder); copy each GLB and JSON to
# src/assets/units/stone-<class>.(glb|json).
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_signature as S  # noqa: E402
import ti_figure as F  # noqa: E402
import build_signature_bronze as B  # noqa: E402  (the part helpers; its own builds run only as __main__)
from mathutils import Vector as V  # noqa: E402

STONE = ('8C8780', .8, 0.)
FLINT = ('5A5A5E', .55, 0.)


# ---- Stone parts ----------------------------------------------------------------------------------------------

def paint(n=2):
    """Body paint in the nation's colour: stripes across the chest (Team on the Chest bone)."""
    for i, (z0, z1) in enumerate([(.700, .716), (.740, .754), (.660, .672)][:n]):
        F.band(f'Paint{i}', 'Team', z0, z1, grow=.003, bone='Chest', sides=10, bulge=.002)


def fur_cape(mat='Fur', low=.52, width=(.130, .200)):
    F.cloak('FurCape', mat, low=low, width=width, rows=3, k=6)


def bone_necklace(mat='Bone', n=7):
    for i in range(n):
        a = -.9 + 1.8 * i / (n - 1)
        F.box(f'Tooth{i}', (a * .060, -.075 + abs(a) * .020, .758 - (1 - abs(a)) * .022), (.010, .008, .022), mat, 'Chest')
    F.tube('NecklaceCord', [((-.062, -.052, .770), .004, 'Chest'), ((0, -.078, .738), .004, 'Chest'), ((.062, -.052, .770), .004, 'Chest')], 'Leather', 3)


def antlers(mat='Bone'):
    F.headband('Team', z=.952, height=.026)
    for s in (-1, 1):
        F.tube(f'Antler_{s}', [((s * .045, .010, .985), .012, 'Head'), ((s * .090, .010, 1.050), .010, 'Head'), ((s * .120, .020, 1.130), .007, 'Head'),
                               ((s * .110, .030, 1.190), .002, 'Head')], mat, 5)
        F.tube(f'AntlerTine_{s}', [((s * .095, .010, 1.060), .007, 'Head'), ((s * .060, -.010, 1.110), .002, 'Head')], mat, 4)


def feather_crown(n=9):
    """The chief's crown: a ring of tall feathers standing up from a Team band."""
    F.headband('Team', z=.955, height=.030)
    import math
    for i in range(n):
        a = math.radians(-80 + 160 * i / (n - 1))
        base = (math.sin(a) * .060, math.cos(a) * .050 - .004, .975)
        tip = (math.sin(a) * .100, math.cos(a) * .070, 1.150 - abs(math.sin(a)) * .030)
        B.plume(f'CrownFeather{i}', base, tip, .012, 'Feather')


def bear_mantle():
    """A bear-fur mantle over both shoulders and the upper chest, open at the front (the chief's)."""
    F.band('MantleCollar', 'Fur', .735, .790, grow=.030, bone='Chest', sides=10, bulge=.010)
    F.cloak('FurMantle', 'Fur', top=.790, low=.40, rows=4, k=7, arc=(170, 120), width=(.150, .240))

def wolf_hood():
    """A wolf pelt worn as a hood: the head over the brow, the ears up, the pelt down the back."""
    F.lathe('WolfHood', [(0, 1.040), (.046, 1.034), (.072, 1.000), (.078, .960), (.076, .930)], 'Fur', sides=10)
    F.tube('WolfSnout', [((0, -.060, 1.010), (.030, .022), 'Head'), ((0, -.110, .995), (.020, .014), 'Head'), ((0, -.128, .990), .006, 'Head')], 'Fur', 6)
    for s in (-1, 1):
        F.tube(f'WolfEar_{s}', [((s * .040, -.010, 1.030), .016, 'Head'), ((s * .046, -.006, 1.070), .002, 'Head')], 'Fur', 4)
    F.slab('WolfPelt', [(-.090, .070, .900), (.090, .070, .900), (.080, .120, .600), (-.080, .120, .600)], 'Fur', 'Chest', depth=.010)


def feather_pair():
    B.plume('Feather_L', (.030, .050, .975), (.070, .080, 1.120), .014, 'Feather')
    B.plume('Feather_R', (-.030, .050, .975), (-.060, .090, 1.100), .014, 'Feather')


def totem_head():
    """The chief's totem on top of his staff: a carved head post, two feathers and a Team cloth streamer
    (the staff is the kit's spear; the head replaces its point)."""
    F.drop('SpearHead', 'SpearSocket')
    x, y = S.HAND_R.x, S.HAND_R.y
    top = .040 + 2.2 / 1.75 - .150
    F.tube('TotemPost', [((x, y, top - .02), .030, 'Prop_R'), ((x, y, top + .10), .036, 'Prop_R'), ((x, y, top + .16), .028, 'Prop_R')], 'Wood', 8, attachment=True)
    F.box('TotemFace', (x, y - .030, top + .07), (.050, .012, .060), 'Paint', 'Prop_R', True)
    for s in (-1, 1):
        F.tube(f'TotemFeather_{s}', [((x + s * .020, y, top + .14), (.010, .004), 'Prop_R'), ((x + s * .060, y + .010, top + .26), .002, 'Prop_R')], 'Feather', 4,
               attachment=True)
    F.tube('TotemHorn_L', [((x + .028, y, top + .15), .010, 'Prop_R'), ((x + .070, y, top + .20), .003, 'Prop_R')], 'Bone', 4, attachment=True)
    F.tube('TotemHorn_R', [((x - .028, y, top + .15), .010, 'Prop_R'), ((x - .070, y, top + .20), .003, 'Prop_R')], 'Bone', 4, attachment=True)


def shaman_staff():
    """The shaman's crooked staff topped with a skull and hung with feathers (the kit's club haft)."""
    F.drop('ClubHead')
    x, y = S.HAND_R.x, S.HAND_R.y
    top = .560 + .90
    F.lathe('StaffSkull', [(0, top - .050), (.028, top - .040), (.036, top - .005), (.030, top + .030), (0, top + .040)], 'Bone', bone='Prop_R', sides=8,
            sy=1.0, cx=x, cy=y - .005, attachment=True)
    for k, dz in enumerate((-.08, -.12)):
        F.tube(f'StaffFeather{k}', [((x + .010, y, top + dz), .004, 'Prop_R'), ((x + .045, y - .010, top + dz - .10), (.010, .003), 'Prop_R')], 'Feather', 4,
               attachment=True)


def torch():
    """A burning torch in the left fist (the raider's): a resin-wrapped stick and a round flame."""
    g = S.HAND_L
    F.tube('TorchStick', [((g.x, g.y, g.z - .10), .010, 'Prop_L'), ((g.x, g.y, g.z + .28), .010, 'Prop_L')], 'Wood', 5, attachment=True)
    F.tube('TorchWrap', [((g.x, g.y, g.z + .24), .018, 'Prop_L'), ((g.x, g.y, g.z + .30), .024, 'Prop_L')], 'Leather', 6, attachment=True)
    fl = F.tube('TorchFlame', [((g.x, g.y, g.z + .29), .022, 'Prop_L'), ((g.x, g.y - .004, g.z + .34), .040, 'Prop_L'), ((g.x + .004, g.y, g.z + .40), .026, 'Prop_L'),
                               ((g.x - .006, g.y + .006, g.z + .46), .002, 'Prop_L')], 'Flame', 6, attachment=True)
    F.bright.add(fl.name)


def loot_bundle():
    F.lathe('LootBundle', [(0, .560), (.070, .580), (.090, .650), (.080, .730), (.040, .770), (0, .775)], 'Hide', bone='Chest', sides=8, sy=.8, cx=0, cy=.120)
    F.tube('LootStrap', [((-.080, -.050, .780), .006, 'Chest'), ((.040, .060, .640), .006, 'Chest')], 'Leather', 3)


COLORS = {'Skin': 'B98258', 'Hide': 'A88A62', 'Fur': '6A5038', 'Leather': '6E4A30', 'Wood': '6A4A30', 'Stone': STONE, 'Flint': FLINT,
          'Bone': 'EAE2CC', 'Feather': 'F0ECE0', 'Paint': 'C8402A', 'Paint2': 'E8C030', 'Flame': 'F6A22E', 'Hair': '2A1E16'}

RECIPES = {
    'stone-infantry': dict(name='Warband', role='infantry', colors=dict(COLORS), legs='bare', dress='kilt', dress_mat='Hide', team=None, hair='full',
                           head=('headband', {'mat': 'Team'}), weapon=('axe', {'length': .55, 'mat': 'Stone'}), shield=('small', {'rim': 'Wood', 'back': 'Hide'}),
                           extras=[paint, fur_cape],
                           look='Stone Age warband: a hide loincloth, a fur cape over the shoulders, long hair under a Team brow band, Team paint stripes '
                                'across the bare chest, a stone axe and a small round hide shield (Emblem)'),
    'stone-ranged': dict(name='Hunters', role='ranged', colors=dict(COLORS, Skin='A87650'), legs='bare', dress='tunic', dress_mat='Hide', team='sash', hair='full',
                         head=('headband', {'mat': 'Team'}), weapon=('bow', {'length': .74, 'recurve': 0.}),
                         extras=[feather_pair, bone_necklace],
                         look='Stone Age hunters: a short hide tunic with a Team sash, two feathers in a Team brow band, a tooth necklace, a short self bow and a quiver'),
    'stone-mercenary': dict(name='Hired hunters', role='infantry', colors=dict(COLORS, Skin='C49470', Fur='4A4A50'), legs='bare', dress='kilt', dress_mat='Fur', team=None,
                            hair='nape', head=None, weapon=('club', {'length': .62}), shield=None,
                            extras=[wolf_hood, lambda: paint(3), bone_necklace],
                            look='Stone Age band for hire: a grey wolf pelt worn as a hood, a fur loincloth, three Team paint stripes, a tooth necklace and a heavy club'),
    'stone-raider': dict(name='Raiders', role='infantry', colors=dict(COLORS, Hide='8E7250'), legs='bare', dress='kilt', dress_mat='Hide', team=None, hair='full',
                         head=('headband', {'mat': 'Team'}), weapon=('spear', {'length': 1.7, 'mat': 'Flint', 'head': 'narrow'}), shield=None,
                         extras=[paint, torch, loot_bundle],
                         look='Stone Age raider on foot: a hide loincloth, Team paint and brow band, a flint-headed spear, a burning torch and a loot bundle on the back'),
    'stone-general': dict(name='Chief', role='general', colors=dict(COLORS, Fur='8A6A44'), legs='bare', dress='robe', dress_mat='Hide', team='top', hair='full',
                          head=None, weapon=('spear', {'length': 2.2}), shield=None,
                          extras=[feather_crown, bear_mantle, bone_necklace, totem_head],
                          look='Stone Age chief: a long hide robe with a Team top, a bear-fur mantle over the shoulders, a crown of tall feathers on a Team band, a tooth necklace, '
                               'and the totem staff (a carved painted head with horns and feathers) instead of a banner'),
    'stone-support': dict(name='Shaman', role='support', colors=dict(COLORS, Fur='3A3028', Skin='B07A50'), legs='bare', dress='robe', dress_mat='Fur', team='top',
                          hair='full', head=None, weapon=('club', {'length': .90}), shield=None,
                          extras=[antlers, B.face_paint, bone_necklace, shaman_staff],
                          look='Stone Age shaman: a dark fur robe with a Team top, an antler headdress, a painted face, a tooth necklace, a tall staff topped with a skull and feathers'),
}

if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(RECIPES)
    for m in ids:
        S.foot(m, RECIPES[m])
