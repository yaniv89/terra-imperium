# scripts/blender/build_signature_mounted.py
# The 26 signature horsemen (rig 'horse' in src/data/signatureUnits.js: 13 Classical, 9 Kingdoms, 4 Gunpowder)
# on the quality pipeline of the base mounted units (build_classical_cavalry.py and the rest): the fine horse
# at detail 2 with shaped legs and a full tail, the rider astride on the quality figure, the mounted clips
# (ti_mounted_clips.mounted). One recipe each (ti_signature_mounted.py), keeping each people's look line from
# the old builders (build_units_classical/kingdoms/gunpowder_signature.py, plans/ART-MODELS-PLAN.md 4.5) and
# made distinct at a glance by the horse's coat, the tack and the rider.
#   blender -b --factory-startup -P scripts/blender/build_signature_mounted.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json); copy the GLB to
# src/assets/units/signature/ and merge the JSON's clips into the asset's JSON.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_signature_mounted as SM  # noqa: E402

BRONZE = ('C2995A', .4, .6)
IRON = ('8E9094', .4, .72)
STEEL = ('B4B8BD', .32, .82)
GOLD = ('D4A84A', .35, .8)


def armlets(mat='Gold'):
    b = F.arm.data.bones
    for s in 'LR':
        sh, el = b['Arm_' + s].head_local, b['Forearm_' + s].head_local
        F.tube(f'Armlet_{s}', [(tuple(sh.lerp(el, .50)), .045, 'Arm_' + s), (tuple(sh.lerp(el, .58)), .044, 'Arm_' + s)], mat, 7, caps=(False, False))


def braid_cords(mat='Lace', zs=(.600, .640, .680, .720)):
    """The hussar's dolman: cords across the chest."""
    for k, z in enumerate(zs):
        F.band(f'Cord{k}', mat, z, z + .010, grow=.016, bone='Spine' if z < .66 else 'Chest', bulge=.002)


def fur_hem(mat='Fur', low=.395):
    F.skirt('FurHem', mat, low=low - .008, top=low + .030, grow=.012, seated=True)


R = {
    # ---- Classical (13) ----
    'media': dict(name='Median horse archers', role='Horse archers',
                  colors={'Coat': 'BDB7AC', 'Mane': '4E4842', 'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Trousers': '6A4E78', 'Saddle': 'A0402C'},
                  horse=dict(style='cloth', cloth='Saddle', discs=3, disc='Gold', socks=True),
                  legs=('hose', 'Trousers'), sleeves='Cloth', dress=dict(skirt='Cloth', top='Team', belt='Leather'),
                  head=('phrygian', {'mat': 'Team'}), weapon=('bow', {}), pre=[lambda: SM.gorytos('Leather', 'Gold')],
                  look='a Nisean grey with white socks under a red saddle cloth with gold discs; a Team soft pointed cap, a Team tunic over pale sleeves, purple trousers, a gorytos at the hip, a short composite bow'),
    'lydia': dict(name='Lydian lance cavalry', role='Lance cavalry',
                  colors={'Coat': 'A4562E', 'Mane': 'E2C890', 'Skin': 'C99472', 'Cloth': 'E2D6BC', 'Saddle': '5E2A58', 'Gold': GOLD, 'Metal': GOLD},
                  horse=dict(style='cloth', cloth='Saddle', border='Gold', discs=3, disc='Gold'),
                  legs='boots', sleeve='Cloth', dress=dict(skirt='Cloth', top='Team', sash='Gold'),
                  head=('cap', {'mat': 'Cloth', 'height': 1.050}), weapon=('lance', {'top': 1.60}), shield=('round', {'radius': .130, 'rim': 'Gold'}),
                  look='a flaxen chestnut under a purple saddle cloth bordered in gold; a Team tunic, a sash of Sardis gold, a white felt cap, a long lance, a small round shield'),
    'cyrene': dict(name='Cyrenaean horse javelineers', role='Horse javelineers',
                   colors={'Coat': '4E2E1C', 'Mane': '1A1410', 'Skin': 'C99472', 'Cloth': 'E8DEC6', 'Pard': 'C8963E', 'Spot': '3A2A1E', 'Straw': 'C9B27A'},
                   horse=dict(style='cloth', cloth='Pard', spots='Spot', discs=0, fringe=.040),
                   legs='sandals', dress=dict(skirt='Cloth', skirt_low=.420, top='Team', belt='Leather'),
                   head=('petasos', {'mat': 'Straw', 'band': 'Team'}), weapon=('javelin', {}),
                   look='a dark bay under a spotted pard skin; a broad straw petasos with a Team band, a short Team tunic, sandals, a javelin and a spare'),
    'numidia': dict(name='Numidian javelin riders', role='Javelin riders',
                    colors={'Coat': '3E2A1E', 'Mane': '15100C', 'Skin': '7A4A30', 'Hair': '1A1410', 'Cloth': 'E6DABC', 'Rope': 'B89E74'},
                    horse=dict(style='bare', tack='Rope', band='Rope', blaze=False, reins='Rope'),
                    legs='bare', beard=True, hair='full', dress=dict(skirt='Cloth', skirt_low=.430, top='Team'),
                    head=None, weapon=('javelin', {}), shield=('round', {'radius': .115, 'rim': 'Leather', 'back': 'Leather'}),
                    look='a small dark horse ridden bareback with a rope bridle and a rope neck strap; bare legs, curled hair, a short Team tunic, javelins, a small leather shield'),
    'arverni': dict(name='Arverni Gaulish noble horsemen', role='Noble horsemen',
                    colors={'Coat': '8A4A2C', 'Mane': '3A2418', 'Skin': 'D9A07A', 'Hair': 'B8803A', 'Cloth': 'C9B58C', 'Plaid': '4A6A3A', 'Iron': IRON, 'Mail': ('7E848B', .55, .75),
                            'Gold': GOLD, 'Saddle': 'B8A27A'},
                    horse=dict(style='cloth', cloth='Saddle', discs=3, disc='Gold', socks=True, saddle='Leather', cantle=.800),
                    legs=('hose', 'Plaid'), sleeves='Cloth', beard=False, moustache=True, hair='nape',
                    dress=dict(skirt='Mail', top='Team', armour='mail', armour_mat='Mail', belt='Leather', cloak='Team'),
                    head=('helmet', {'mat': 'Iron', 'cheeks': True}), weapon=('sword', {'length': .56, 'curve': 0, 'width': .020, 'guard': 'Iron'}),
                    shield=('oval', {'rx': .115, 'rz': .210, 'boss': 'Iron', 'spine': 'Wood', 'rim': 'Iron'}), pre=[lambda: SM.torc('Gold')],
                    look='a chestnut roan with white socks in a four-horned saddle on a pale cloth; a mail shirt, a gold torc, a Team cloak, green check trousers, an iron helmet, a long sword, a tall oval shield'),
    'parthava': dict(name='Parthian horse archers', role='Horse archers',
                     colors={'Coat': 'C89A52', 'Mane': 'EADBB4', 'Skin': 'C99472', 'Cloth': 'D6C9A6', 'Trousers': 'B8A27A', 'Saddle': '3E5A3A', 'Leather': '7A5236'},
                     horse=dict(style='fleece', cloth='Saddle', discs=3, disc='Metal'),
                     legs=('hose', 'Trousers'), sleeves='Cloth', dress=dict(skirt='Cloth', top='Team', belt='Leather', cloak='Leather'),
                     head=('headband', {'mat': 'Team'}), hair='full', weapon=('bow', {'length': .66}), pre=[lambda: SM.gorytos('Leather', 'Metal'), lambda: SM.hip_quiver('Leather')],
                     look='a golden palomino under a fringed green cloth; bare head with a Team diadem band, a Team tunic, a leather cloak, baggy trousers, a gorytos and a quiver, a composite bow (the Parthian shot)'),
    'bactria': dict(name='Bactrian armoured cavalry', role='Armoured cavalry',
                    colors={'Coat': '7A4A2A', 'Mane': '1A1410', 'Skin': 'C99472', 'Cloth': 'D9C7A0', 'Metal': BRONZE, 'Saddle': '8A2E28'},
                    horse=dict(style='cloth', cloth='Saddle', discs=0, peytral='Metal', chanfron='Metal'),
                    legs='boots', sleeve='Cloth', shoulder='Metal', dress=dict(skirt='Cloth', top='Team', armour='scale', armour_mat='Metal', belt='Leather'),
                    head=('crested', {'mat': 'Metal', 'crest': 'Team'}), weapon=('lance', {'top': 1.62}),
                    look='a bay with a bronze breastplate and chamfron under a red cloth; a bronze scale coat, a crested helmet with a Team crest, a long lance'),
    'wusun': dict(name='Wusun horse archers', role='Horse archers',
                  colors={'Coat': 'B89A6A', 'Mane': '3A2A1E', 'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Felt': 'E8E0CC', 'Trousers': '6A5236', 'Saddle': '7A4A30'},
                  horse=dict(style='fleece', cloth='Saddle', socks=True),
                  legs=('hose', 'Trousers'), sleeves='Cloth', dress=dict(skirt='Cloth', skirt_low=.380, top='Team', belt='Leather'),
                  head=('cap', {'mat': 'Felt', 'height': 1.150}), weapon=('bow', {}), pre=[SM.sabre_at_hip, lambda: SM.hip_quiver('Leather')],
                  look='a pale dun heavenly horse with white socks under a brown fleece; a tall white felt cap, a belted Team coat, a sabre, a quiver, a composite bow'),
    'xianbei': dict(name='Xianbei armoured lancers', role='Armoured lancers',
                    colors={'Coat': '2A2420', 'Mane': '141210', 'Skin': 'D2A47E', 'Iron': IRON, 'Lamella': ('5E6064', .45, .7), 'Fur': '6A4E36', 'Cloth': 'B8A27A'},
                    horse=dict(style='barding', cloth='Lamella', trim='Leather', hem=.40, chanfron='Iron', blaze=False, stirrups=True),
                    legs='boots', sleeves='Cloth', shoulder='Iron', dress=dict(skirt='Iron', top='Team', armour='lamellar', armour_mat='Iron', sash='Team'),
                    head=('fur', {'mat': 'Fur'}), weapon=('lance', {'top': 1.66, 'head': 'narrow'}),
                    look='a black horse in iron lamellar barding and a chamfron, stirrups; iron lamellar with a Team sash, a fur cap, a long lance'),
    'avanti': dict(name='Avanti heavy cavalry', role='Heavy cavalry',
                   colors={'Coat': 'E2DCCF', 'Mane': 'B8B0A0', 'Skin': 'A06A48', 'Cloth': 'EFE6D0', 'Quilt': 'E8DCC0', 'Caparison': 'D08A2A', 'Red': '9C3328', 'Metal': BRONZE},
                   horse=dict(style='caparison', cloth='Caparison', trim='Red', blaze=False),
                   legs='bare', sleeves='Quilt', beard=True, dress=dict(skirt='Cloth', top='Team', armour='quilt', armour_mat='Quilt', belt='Red'),
                   head=('turban', {'mat': 'Team'}), weapon=('lance', {'top': 1.52, 'head': 'broad'}), pre=[SM.sabre_at_hip],
                   look='a white horse under a saffron caparison with a red border; a quilted coat, a Team turban, a spear and a sabre'),
    'satavahana': dict(name='Satavahana horsemen', role='Horsemen',
                       colors={'Coat': 'A8A49C', 'Mane': '3A3530', 'Skin': 'A06A48', 'Cloth': 'EFE6D0', 'Saddle': '7A1E2A', 'Gold': GOLD},
                       horse=dict(style='cloth', cloth='Saddle', border='Gold', spots='Gold', spot_angles=(80,), discs=3, disc='Gold'),
                       legs='bare', dress=dict(skirt='Cloth', top='Team', belt='Gold'), head=('turban', {'mat': 'Cloth'}),
                       weapon=('lance', {'top': 1.62}), pre=[armlets, lambda: F.hip_sword('Sword', 'L', length=.36, tip=(.176, .150, .230))],
                       look='an iron-grey horse under an embroidered crimson cloth with gold borders; a white turban, a Team tunic, gold armlets, bare legs, a lance and a sword'),
    'dian': dict(name='Dian mounted swordsmen', role='Mounted swordsmen',
                 colors={'Coat': '7A3E22', 'Mane': '2A1A12', 'Skin': 'C48A62', 'Cloth': 'E6DDC5', 'Metal': BRONZE, 'Saddle': '5E3A24', 'Gold': BRONZE},
                 horse=dict(style='cloth', cloth='Saddle', discs=0, bells='Gold'),
                 legs='bare', dress=dict(skirt='Cloth', top='Team', belt='Leather', cloak='Team'),
                 head=('feathers', {'band': 'Cloth', 'mat': 'Pale', 'n': 5, 'tall': .14}), weapon=('sword', {'length': .52, 'curve': 0, 'mat': 'Metal'}),
                 look='a small chestnut with a bell-hung bronze harness; a feathered headdress, a Team cloak, a long bronze sword'),
    'buyeo': dict(name='Buyeo mounted spearmen', role='Mounted spearmen',
                  colors={'Coat': 'A58A5E', 'Mane': '2A1F17', 'Skin': 'D9AE88', 'Cloth': 'C9B58C', 'FurCoat': '7E5A3A', 'Hide': '8A6A48', 'Fur': '4A3A2C', 'Trousers': '5A4636'},
                  horse=dict(style='barding', cloth='Hide', trim='Fur', hem=.46, blaze=False),
                  legs=('hose', 'Trousers'), sleeves='FurCoat', cuff='Fur', dress=dict(skirt='FurCoat', top='Team', belt='Leather'),
                  head=('fur', {'mat': 'Fur', 'height': 1.080}), weapon=('lance', {'top': 1.58}), pre=[fur_hem, lambda: SM.hip_quiver('Leather')],
                  look='a stocky dun under hide barding edged in fur; a fur-lined coat with a Team breast, a round fur cap, a long spear, a quiver'),
    # ---- Kingdoms (9) ----
    'alodia': dict(name='Alodian quilted-armour spear cavalry (improvised)', role='Quilted spear cavalry',
                   colors={'Coat': 'D8D2C6', 'Mane': 'A8A094', 'Skin': '6A4430', 'Cloth': 'E6DDC5', 'Quilt': 'D9CBA8', 'Saddle': '2E5A6A', 'Iron': IRON},
                   horse=dict(style='cloth', cloth='Saddle', discs=0, peytral='Leather', stirrups=True, blaze=False),
                   legs='boots', sleeves='Quilt', pad=.006, dress=dict(skirt='Quilt', skirt_ribs=6, top='Team', ribs=6, grow=.012, belt='Leather'),
                   head=('headcloth', {'band': 'Team', 'cloth': 'Cloth'}), weapon=('lance', {'top': 1.58}), shield=('round', {'radius': .130, 'rim': 'Leather'}),
                   look='a white horse with a leather breast guard under a blue cloth; a quilted Team tunic, a white headcloth, a spear, a small round shield'),
    'khazaria': dict(name='Khazar heavy horse archers', role='Heavy horse archers',
                     colors={'Coat': '4A2A1A', 'Mane': '15100C', 'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Iron': IRON, 'Felt': 'D8CDB4', 'Plume': '2A2420', 'Saddle': '8A2E22', 'Gold': GOLD},
                     horse=dict(style='cloth', cloth='Saddle', border='Gold', discs=3, disc='Gold', stirrups=True),
                     legs='boots', sleeves='Cloth', shoulder='Iron', dress=dict(skirt='Cloth', skirt_low=.370, top='Team', armour='lamellar', armour_mat='Iron', belt='Leather'),
                     head=('plumed', {'mat': 'Felt', 'band': 'Team', 'plume': 'Plume'}), weapon=('bow', {}), pre=[SM.sabre_at_hip, lambda: SM.hip_quiver('Leather')],
                     look='a dark bay under a red cloth bordered in gold, stirrups; iron lamellar, a white felt cap with a Team band and a black plume, a sabre, a quiver, a composite bow'),
    'sogdia': dict(name='Sogdian armoured horsemen (Panjikent murals)', role='Armoured horsemen',
                   colors={'Coat': '9A5530', 'Mane': '2A1A12', 'Skin': 'D2A47E', 'Cloth': 'B85A3A', 'Iron': STEEL, 'Saddle': '2E5A3E', 'Gold': GOLD, 'Pennon': 'E8DCC0'},
                   horse=dict(style='cloth', cloth='Saddle', border='Gold', spots='Gold', spot_angles=(85,), discs=0, stirrups=True),
                   legs='boots', sleeves='Cloth', shoulder='Iron', dress=dict(skirt='Cloth', skirt_low=.340, top='Team', armour='lamellar', armour_mat='Iron', sash='Team'),
                   head=('spiked', {'mat': 'Iron', 'aventail': 'Iron', 'peak': 1.100}), weapon=('lance', {'top': 1.66, 'pennon': 'Pennon'}),
                   look='a chestnut under a green cloth patterned and bordered in gold, stirrups; steel lamellar over a long red caftan, a Team sash, a pointed helmet with a mail aventail, a lance with a pennon'),
    'khwarazm': dict(name='Khwarazmian Kipchak horse archers', role='Horse archers',
                     colors={'Coat': 'A9A59E', 'Mane': '4E4A44', 'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Quilt': '8A6A3E', 'Felt': '3A3530', 'Plume': 'E8E0CC', 'Saddle': '6A4A30'},
                     horse=dict(style='fleece', cloth='Saddle', stirrups=True, socks=True),
                     legs=('hose', 'Cloth'), sleeves='Quilt', pad=.006, dress=dict(skirt='Quilt', skirt_ribs=6, top='Team', ribs=6, grow=.012, belt='Leather'),
                     head=('plumed', {'mat': 'Felt', 'band': 'Team', 'plume': 'Plume'}), weapon=('bow', {}), pre=[SM.sabre_at_hip, lambda: SM.hip_quiver('Leather')],
                     look='a grey with white socks under a brown fleece, stirrups; a quilted Team coat, a black felt cap with a white plume, a sabre, a quiver, a composite bow'),
    'gokturk': dict(name='Gokturk lamellar horse archers', role='Horse archers',
                    colors={'Coat': 'B08A58', 'Mane': '1A1410', 'Skin': 'D2A47E', 'Cloth': 'C9A66B', 'Iron': IRON, 'Saddle': '2E4A6A', 'Hair': '1A1410'},
                    horse=dict(style='cloth', cloth='Saddle', discs=3, disc='Iron', stirrups=True),
                    legs='boots', sleeves='Cloth', dress=dict(skirt='Cloth', top='Team', armour='lamellar', armour_mat='Iron', belt='Leather'),
                    head=('cap', {'mat': 'Iron', 'height': 1.120}), hair='braids', beard=False, moustache=True,
                    weapon=('bow', {}), pre=[SM.sabre_at_hip, lambda: SM.hip_quiver('Leather'), lambda: SM.back_pennant('Team')],
                    look='a dun with a black mane under a blue cloth, stirrups; iron lamellar, a pointed iron cap, long braids, a Team pennant on the back, a sabre, a quiver, a composite bow'),
    'yarlung': dict(name='Yarlung lamellar lancers', role='Lamellar lancers',
                    colors={'Coat': '2C2622', 'Mane': '141210', 'Skin': 'C48A62', 'Cloth': 'B8A27A', 'Iron': IRON, 'Lacquer': ('6A2E22', .5, .3), 'Barding': 'C8A24A', 'Trim': '2A2420'},
                    horse=dict(style='barding', cloth='Barding', trim='Trim', hem=.40, stirrups=True, blaze=False),
                    legs='boots', sleeves='Cloth', shoulder='Lacquer', dress=dict(skirt='Lacquer', top='Team', armour='lamellar', armour_mat='Lacquer', sash='Team'),
                    head=('spiked', {'mat': 'Iron', 'aventail': 'Lacquer', 'peak': 1.150}), weapon=('lance', {'top': 1.70, 'head': 'narrow'}),
                    look='a black horse under a felted yellow armour cloth with a dark edge, stirrups; red lacquered lamellar with a Team sash, a tall pointed iron helmet, a long lance'),
    'baekje': dict(name='Baekje armoured cavalry', role='Armoured cavalry',
                   colors={'Coat': '6E3F24', 'Mane': '1F1712', 'Skin': 'D9AE88', 'Cloth': 'C9B58C', 'Iron': IRON, 'Lamella': ('4E5056', .45, .7), 'Trim': '9C3328'},
                   horse=dict(style='barding', cloth='Lamella', trim='Trim', hem=.36, chanfron='Iron', peytral='Iron', stirrups=True),
                   legs='boots', sleeves='Iron', shoulder='Iron', dress=dict(skirt='Iron', top='Team', armour='lamellar', armour_mat='Iron', belt='Leather'),
                   head=('crested', {'mat': 'Iron', 'crest': 'Team'}), weapon=('lance', {'top': 1.70}),
                   look='a bay in full iron lamellar horse armour with a red edge, a chamfron and a breastplate, stirrups; lamellar with iron sleeves, a helmet with a Team crest, a long lance'),
    'emishi': dict(name='Emishi horse archers', role='Horse archers',
                   colors={'Coat': '8A6A48', 'Mane': '2A1F17', 'Skin': 'D9AE88', 'Hair': '1A1410', 'Cloth': 'C9B58C', 'Fur': '6A5440', 'Saddle': '4A3A2C'},
                   horse=dict(style='fleece', cloth='Fur', blaze=False, stirrups=True),
                   legs=('hose', 'Cloth'), sleeves='Cloth', cuff='Fur', hair='full', beard=True,
                   dress=dict(skirt='Cloth', top='Team', belt='Leather'), head=('headband', {'mat': 'Team'}),
                   weapon=('bow', {'long': True, 'length': 1.10}), pre=[fur_hem, lambda: F.hip_sword('Sword', 'L', length=.40, tip=(.176, .150, .230))],
                   look='a small brown horse under a fur, stirrups; a fur-edged Team tunic, bare head with a Team band, full beard, a long bow, a straight sword'),
    'wagadu': dict(name='Wagadu iron-spear cavalry', role='Iron-spear cavalry',
                   colors={'Coat': 'E6E0D2', 'Mane': 'C8C0B0', 'Skin': '6A4430', 'Cloth': 'E6DDC5', 'Quilt': 'D8C49A', 'Red': '9C3328', 'Straw': 'D8C08A', 'Iron': IRON},
                   horse=dict(style='caparison', cloth='Quilt', trim='Red', blaze=False, stirrups=True),
                   legs='boots', sleeves='Cloth', dress=dict(skirt='Cloth', top='Team', belt='Red'),
                   head=('cap', {'mat': 'Straw', 'height': 1.110}), weapon=('lance', {'top': 1.58, 'head': 'broad'}), shield=('round', {'radius': .140, 'rim': 'Leather', 'back': 'Leather'}),
                   look='a white horse under a quilted caparison with a red edge, stirrups; a Team tunic, a conical straw hat, a broad iron spear, a round hide shield'),
    # ---- Gunpowder (4) ----
    'avaria': dict(name='Hungarian hussars', role='Hussars',
                   colors={'Coat': '5A3420', 'Mane': '15100C', 'Skin': 'C99472', 'Breeches': '9C2E28', 'Pelisse': '2E3A5A', 'Lace': 'D8C99A', 'Fur': '2A2420', 'Shabraque': '2E3A5A',
                           'Boot': '1A1716', 'Iron': STEEL, 'Plume': 'E8E0CC', 'Gold': GOLD},
                   horse=dict(style='shabraque', cloth='Shabraque', lace='Lace', saddle='Leather', stirrups=True),
                   legs=('hose', 'Breeches'), jackboots=True, sleeves='Pelisse', cuff='Lace', beard=False, moustache=True,
                   dress=dict(skirt='Breeches', top='Team', grow=.010, sash='Lace', cloak={'mat': 'Pelisse', 'low': .600}),
                   head=('kalpak', {'mat': 'Fur', 'plume': 'Plume'}), weapon=('sword', {'length': .50, 'curve': .032}),
                   pre=[braid_cords, lambda: SM.slung_gun()],
                   look='a dark bay under a blue shabraque with pointed corners and pale lace, a war saddle, stirrups; a Team dolman with cords, a blue pelisse, a fur kalpak with a Team bag and a plume, red breeches, black boots, a drawn sabre, a carbine'),
    'sarmatians': dict(name='Winged hussars', role='Winged hussars',
                       colors={'Coat': 'C4C0B8', 'Mane': '6A645C', 'Skin': 'C99472', 'Cloth': 'A8342A', 'Iron': STEEL, 'Pard': 'C8963E', 'Spot': '2A2018', 'Saddle': '8A3A2A',
                               'Boot': 'B8902A', 'Pennon': 'E8E0CC', 'Gold': GOLD},
                       horse=dict(style='cloth', cloth='Saddle', border='Gold', discs=0, saddle='Leather', stirrups=True),
                       legs=('hose', 'Cloth'), jackboots=True, sleeves='Cloth', shoulder='Iron', beard=False, moustache=True,
                       dress=dict(skirt='Cloth', top='Team', armour='breastplate', armour_mat='Iron', sash='Team', cloak={'mat': 'Pard', 'low': .560}),
                       head=('szyszak', {'mat': 'Iron'}), weapon=('lance', {'top': 1.72, 'pennon': 'Pennon'}),
                       pre=[lambda: SM.wings('Wood', 'Pale')],
                       look='a grey under a red cloth bordered in gold, a war saddle, stirrups; a steel breastplate with a Team sash, a lobster-tail helmet, a leopard-skin cloak, a feathered wing on the back, yellow boots, a long lance with a pennon'),
    'kanem': dict(name='Bornu mailed horsemen', role='Mailed horsemen',
                  colors={'Coat': '8E4A26', 'Mane': '2A1A12', 'Skin': '6A4430', 'Cloth': 'E8E2D2', 'Quilt': 'E0D2B0', 'Red': '9C3328', 'Mail': ('7E848B', .55, .75), 'Iron': IRON},
                  horse=dict(style='caparison', cloth='Quilt', trim='Red', stirrups=True, chanfron='Iron'),
                  legs='boots', sleeves='Mail', dress=dict(skirt='Mail', top='Team', armour='mail', armour_mat='Mail', sash='Team'),
                  head=('turban', {'mat': 'Cloth'}), weapon=('lance', {'top': 1.56, 'head': 'broad'}), pre=[lambda: SM.slung_gun()],
                  look='a chestnut under a quilted caparison with a red edge and an iron chamfron, stirrups; a mail shirt with a Team sash, a white turban, a lance, a carbine on the back'),
    'ajuran': dict(name='Ajuran matchlock horsemen', role='Matchlock horsemen',
                   colors={'Coat': 'D6D0C4', 'Mane': '8A847A', 'Skin': '8A573A', 'Cloth': 'EFEAE0', 'Saddle': '2A3A6A', 'Gold': GOLD, 'Iron': IRON},
                   horse=dict(style='cloth', cloth='Saddle', border='Gold', discs=3, disc='Gold', stirrups=True, blaze=False),
                   legs='bare', sleeves='Cloth', dress=dict(skirt='Cloth', skirt_low=.360, top='Team', belt='Leather'),
                   head=('turban', {'mat': 'Cloth'}), weapon=('lance', {'top': 1.55}), pre=[lambda: SM.slung_gun(long=True)],
                   look='a white-grey under an indigo cloth bordered in gold, stirrups; a white cotton robe with a Team top, a white turban, a lance, a long matchlock slung on the back'),
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    models = argv or list(R)
    done, failed = {}, {}
    for m in models:
        try:
            done[m] = SM.mounted(m, R[m])
        except Exception as e:  # keep building the rest; the summary lists it
            import traceback
            traceback.print_exc()
            failed[m] = repr(e)
    print('SUMMARY', done, 'FAILED', failed, flush=True)
    if failed:
        sys.exit(1)


main()
