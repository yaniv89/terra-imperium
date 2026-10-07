# scripts/blender/build_units_kingdoms_irregular.py
# The Kingdoms irregulars of plans/ART-MODELS-PLAN.md 4.3 (Claude, 2026-10-08), on the shared rig and
# body of ti_units.py and the part libraries of build_units_kingdoms.py, made like
# build_units_classical_irregular.py, rest pose only like the general:
#   kingdoms-raider     a mounted border raider: a rouncey under a sheepskin with loot sacks on both
#                       flanks, a rolled bundle, a looted iron pot and a church candlestick on the
#                       croup; the rider in a padded Team jack, a hood, a raised torch in the right
#                       hand and a short spear slung across the back. Drawn for raider squads of the
#                       cavalry class (unitModels.js LOOK_CLASS raider).
#   kingdoms-mercenary  a hired soldier in a sell-sword's mixed kit: a pointed bascinet with a mail
#                       aventail, a riveted brigandine over Team sleeves and skirt, a striped sash and a
#                       coin pouch, a round buckler (the squad's Emblem) and a falchion. Drawn for
#                       mercenary squads of the infantry class.
# Culture neutral (no national motifs). Flame is its own flat material (not a tag).
#   blender -b --factory-startup -P scripts/blender/build_units_kingdoms_irregular.py -- [kingdoms-raider kingdoms-mercenary]
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units')
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_kingdoms as kb  # noqa: E402


def flame_material():
    m = bpy.data.materials.get('Flame') or bpy.data.materials.new('Flame')
    m.use_nodes = True
    c = tuple(u.linear(int('F29A2E'[i:i + 2], 16) / 255) for i in (0, 2, 4))
    m.diffuse_color = (*c, 1)
    n = m.node_tree.nodes.get('Principled BSDF')
    n.inputs['Base Color'].default_value = (*c, 1)
    n.inputs['Emission Color'].default_value = (*c, 1)
    n.inputs['Emission Strength'].default_value = .6
    return m


def torch(arm):
    w = lib.hand(arm)
    u.tube('TorchHaft', [(w.x, w.y + .05, w.z - .10), (w.x, w.y - .06, w.z + .30)], [.010, .009], 'Wood', ['Prop_R'] * 2, 4, arm, attachment=True)
    u.tube('TorchWrap', [(w.x, w.y - .055, w.z + .28), (w.x, w.y - .07, w.z + .34)], [.022, .02], 'Leather', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.tube('TorchFlame', [(w.x, w.y - .07, w.z + .335), (w.x, w.y - .075, w.z + .39), (w.x, w.y - .06, w.z + .46)], [.035, .03, .004], 'Flame', ['Prop_R'] * 3, 5, arm, attachment=True)


def slung_spear(arm):
    u.tube('SlungSpear', [(-.18, .11, .52), (.22, .08, 1.02)], [.008, .007], 'Wood', ['Chest'] * 2, 4, arm, attachment=True)
    u.tube('SlungSpearHead', [(.22, .08, 1.02), (.25, .075, 1.09)], [.014, .001], 'Metal', ['Chest'] * 2, 4, arm, attachment=True)


def k_raider():
    flame_material()
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    s = u.MOUNTS['horse']['seat']
    u.box('Sheepskin', (0, s[1], s[2] - .10), (.34, .36, .11), 'Cloth', 'Mount_Spine', horse)
    for sx in (-1, 1):
        u.tube(f'LootSack{sx}', [(sx * .19, s[1] + .22, s[2] - .02), (sx * .215, s[1] + .22, s[2] - .12), (sx * .205, s[1] + .22, s[2] - .22)], [(.07, .08), (.095, .1), (.06, .07)], 'Cloth', ['Mount_Spine'] * 3, 6, horse)
        u.tube(f'SackTie{sx}', [(sx * .17, s[1] + .22, s[2] + .04), (sx * .19, s[1] + .22, s[2] - .02)], [.015, .02], 'Leather', ['Mount_Spine'] * 2, 4, horse)
    u.tube('LootRoll', [(-.13, s[1] + .37, s[2] + .07), (.13, s[1] + .37, s[2] + .07)], [(.055, .05), (.055, .05)], 'Leather', ['Mount_Spine'] * 2, 6, horse)
    # a looted iron pot and a tall church candlestick lashed on the croup
    u.tube('Pot', [(-.05, s[1] + .38, s[2] + .11), (-.05, s[1] + .38, s[2] + .14), (-.05, s[1] + .38, s[2] + .20), (-.05, s[1] + .38, s[2] + .22)], [.03, .07, .072, .06], 'Metal', ['Mount_Spine'] * 4, 8, horse)
    u.tube('Candlestick', [(.08, s[1] + .36, s[2] + .10), (.08, s[1] + .36, s[2] + .13), (.08, s[1] + .38, s[2] + .33), (.08, s[1] + .38, s[2] + .36)], [.035, .012, .01, .028], 'Metal', ['Mount_Spine'] * 4, 6, horse)
    r = cl.rider([(kb.gambeson, 'Team', {'name': 'Jack', 'low': .40}), (kb.hood, 'Wood'), (lib.belt, 'Leather', .52)], [torch, slung_spear], name='Raider')
    return [horse, r], {'Skin': 'C48A62', 'Cloth': 'D9CDB0', 'Leather': '6E4A30', 'Metal': ('5E5B57', .5, .6), 'Wood': '5E4430'}, \
        'Kingdoms raider: a light horseman on a sheepskin with loot sacks on both flanks, a rolled bundle, a looted iron pot and an iron church candlestick on the croup; a padded Team jack, a hood, a raised torch, a short spear slung across the back', \
        dict(budget=2600, mounted=True)


def bascinet(arm, mat='Metal'):
    """A pointed bascinet with a mail aventail falling to the shoulders."""
    u.tube('Bascinet', [(0, .004, .93), (0, .006, .975), (0, .012, 1.02), (0, .03, 1.075)], [(.072, .066), (.07, .064), (.046, .044), (.004, .004)], mat, ['Head'] * 4, 8, arm)
    u.tube('Aventail', [(0, 0, .80), (0, 0, .86), (0, 0, .93)], [(.13, .088), (.092, .076), (.074, .068)], mat, ['Chest', 'Neck', 'Head'], 8, arm)


def brigandine(arm):
    """A riveted brigandine (leather over plates) on the torso, Team sleeves and skirt showing."""
    cl.tunic(arm, 'Team', low=.33, name='Skirt')
    lib.ring('Brigandine', arm, [.44, .53, .62, .70, .76], [(.122, .088), (.104, .076), (.102, .074), (.12, .08), (.124, .076)], 'Leather', ['Hips', 'Spine', 'Spine', 'Chest', 'Chest'], 8)
    for k, z in enumerate((.50, .58, .66)):
        for sx in (-1, 1):
            u.box(f'Rivets{k}{sx}', (sx * .05, -.085 if z > .55 else -.09, z), (.03, .008, .012), 'Metal', 'Spine' if z < .62 else 'Chest', arm)


def striped_sash(arm):
    u.tube('Sash', [(.10, -.07, .76), (0, -.09, .64), (-.10, -.08, .50)], [(.024, .008)] * 3, 'Cloth', ['Chest', 'Spine', 'Hips'], 4, arm)
    u.tube('CoinPouch', [(-.12, -.06, .47), (-.125, -.065, .43), (-.12, -.06, .39)], [.022, .034, .02], 'Leather', ['Hips'] * 3, 6, arm)


def buckler(arm):
    cx, cy, cz = lib.SHIELD_AT
    n, r = 14, .11
    lib.shield_face(arm, 'Buckler', [(r * math.cos(2 * math.pi * j / n), r * math.sin(2 * math.pi * j / n)) for j in range(n)])
    u.tube('BucklerBoss', [(cx, cy - .024, cz), (cx, cy - .055, cz)], [.035, .015], 'Metal', ['Prop_L'] * 2, 8, arm, attachment=True)


def falchion(arm):
    """A single-edged falchion, point up: the blade widening to a clipped tip."""
    w = lib.hand(arm)
    u.tube('FalchionGrip', [(w.x, w.y - .01, w.z - .05), (w.x, w.y - .01, w.z + .04)], [.012, .012], 'Wood', ['Prop_R'] * 2, 5, arm, attachment=True)
    u.box('FalchionGuard', (w.x, w.y - .01, w.z + .045), (.06, .02, .012), 'Metal', 'Prop_R', arm, True)
    v = [(w.x - .012, w.y - .01, w.z + .05), (w.x + .014, w.y - .01, w.z + .05), (w.x + .03, w.y - .01, w.z + .30), (w.x + .005, w.y - .01, w.z + .36),
         (w.x - .016, w.y - .01, w.z + .28), (w.x + .004, w.y - .016, w.z + .2), (w.x + .004, w.y - .004, w.z + .2)]
    f = [(0, 1, 5), (1, 2, 5), (2, 3, 5), (3, 4, 5), (4, 0, 5), (1, 0, 6), (2, 1, 6), (3, 2, 6), (4, 3, 6), (0, 4, 6)]
    u.mesh_obj('FalchionBlade', v, f, 'Metal', 'Prop_R', True, arm=arm)


def k_mercenary():
    arm = cl.person([brigandine, bascinet, striped_sash, (lib.belt, 'Leather', .52), (lib.greaves, 'Metal'), (lib.sandals, 'Leather'), buckler, falchion])
    return [arm], {'Skin': 'B9805C', 'Cloth': 'B8402E', 'Leather': '5A3A2A', 'Metal': kb.STEEL, 'Wood': '4E3828', 'Emblem': 'E6D6AF'}, \
        'Kingdoms mercenary: a sell-sword in mixed kit (a pointed bascinet with a mail aventail, a riveted brigandine over Team sleeves and skirt, greaves), a striped sash with a coin pouch, a round Emblem buckler and a falchion', \
        cl.PERSON_OPTS


BUILDERS = {'kingdoms-raider': k_raider, 'kingdoms-mercenary': k_mercenary}


def build(uid):
    lib.reset()
    parts, colors, look, opts = BUILDERS[uid]()
    lib.finish(uid, parts, colors, {'role': uid.split('-')[1], 'look': look, 'notes': 'Culture-neutral irregular (plan 4.3, 4.4); rest pose, the vertex rig walks it.'}, opts['budget'], opts['mounted'])


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
