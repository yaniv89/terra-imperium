# scripts/blender/build_units_gunpowder_irregular.py
# The Gunpowder irregulars of plans/ART-MODELS-PLAN.md 4.3 (Claude, 2026-10-08), on the shared rig and
# body of ti_units.py and the part libraries of build_units_gunpowder.py, made like
# build_units_kingdoms_irregular.py, rest pose only:
#   gunpowder-raider     a mounted freebooter: a horse under a blanket with loot sacks, a rolled
#                        bundle, a looted brass kettle and a clock on the croup; the rider in a loose
#                        Team coat, a slouch hat, a bandolier, a raised torch and a carbine slung.
#                        Drawn for raider squads of the cavalry class (unitModels.js LOOK_CLASS raider).
#   gunpowder-mercenary  a hired soldier in a buff leather coat over a Team waistcoat, a broad hat with
#                        a plume, a bandolier of powder chargers, a striped sash and a coin pouch, high
#                        boots, a matchlock musket at the shoulder and a short sword. Drawn for
#                        mercenary squads of the infantry class.
# Culture neutral (no national motifs). Flame is its own flat material (not a tag).
#   blender -b --factory-startup -P scripts/blender/build_units_gunpowder_irregular.py -- [gunpowder-raider gunpowder-mercenary]
import bpy, sys, os, math  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_classical_signature as cs  # noqa: E402
import build_units_kingdoms_irregular as ki  # noqa: E402
import build_units_gunpowder as gp  # noqa: E402
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'gunpowder')


def slouch_hat(arm, mat='Leather'):
    cs.brim_hat(arm, mat, r=.13, z=.968, crown=1.04, name='Slouch')
    u.box('SlouchDip', (0, -.11, .955), (.12, .04, .012), mat, 'Head', arm)  # the brim pulled down at the front


def plumed_hat(arm, mat='Leather'):
    cs.brim_hat(arm, mat, r=.14, z=.968, crown=1.05, name='BroadHat')
    u.tube('HatPlume', [(.06, .02, 1.0), (.09, .05, 1.07), (.13, .1, 1.08)], [.02, .024, .006], 'Cloth', ['Head'] * 3, 5, arm)


def bandolier(arm):
    u.tube('Bandolier', [(.11, -.078, .78), (0, -.095, .64), (-.10, -.08, .48)], [(.016, .006)] * 3, 'Leather', ['Chest', 'Spine', 'Hips'], 4, arm)
    for k, t in enumerate((.2, .4, .6, .8)):  # the wooden powder chargers hanging from it
        x = .11 - .21 * t; z = .78 - .30 * t
        u.tube(f'Charger{k}', [(x, -.1, z), (x, -.105, z - .05)], [.01, .01], 'Wood', ['Chest' if z > .62 else 'Spine'] * 2, 4, arm)


def buff_coat(arm):
    """A buff leather coat with skirts to the thigh, over a Team waistcoat."""
    lib.ring('BuffSkirt', arm, [.34, .44, .537], [(.14, .1), (.13, .094), (.106, .076)], 'Leather', ['Hips'] * 3, 8)
    lib.top(arm, 'Leather', name='BuffCoat')
    u.box('WaistcoatFront', (0, -.088, .63), (.09, .012, .2), 'Team', 'Spine', arm)


def g_raider():
    ki.flame_material()
    horse, _ = tm.horse('Mount', coat='Leather', dark='Wood')
    s = u.MOUNTS['horse']['seat']
    u.box('Blanket', (0, s[1], s[2] - .10), (.34, .36, .11), 'Cloth', 'Mount_Spine', horse)
    for sx in (-1, 1):
        u.tube(f'LootSack{sx}', [(sx * .19, s[1] + .22, s[2] - .02), (sx * .215, s[1] + .22, s[2] - .12), (sx * .205, s[1] + .22, s[2] - .22)], [(.07, .08), (.095, .1), (.06, .07)], 'Cloth', ['Mount_Spine'] * 3, 6, horse)
    u.tube('LootRoll', [(-.13, s[1] + .37, s[2] + .07), (.13, s[1] + .37, s[2] + .07)], [(.055, .05), (.055, .05)], 'Leather', ['Mount_Spine'] * 2, 6, horse)
    # a looted brass kettle and a mantel clock lashed on the croup
    u.tube('Kettle', [(-.05, s[1] + .38, s[2] + .11), (-.05, s[1] + .38, s[2] + .15), (-.05, s[1] + .38, s[2] + .21), (-.05, s[1] + .38, s[2] + .23)], [.04, .07, .06, .02], 'Metal', ['Mount_Spine'] * 4, 8, horse)
    u.box('Clock', (.09, s[1] + .37, s[2] + .17), (.08, .06, .12), 'Wood', 'Mount_Spine', horse)
    u.box('ClockFace', (.09, s[1] + .337, s[2] + .19), (.05, .01, .05), 'Cloth', 'Mount_Spine', horse)
    r = cl.rider([(gp.long_coat, 'Team', {'low': .36}), slouch_hat, bandolier, gp.boots, gp.carbine_slung], [ki.torch], name='Raider')
    return [horse, r], {'Skin': 'C48A62', 'Cloth': 'B8A27A', 'Leather': '4A3426', 'Metal': ('B8913E', .5, .8), 'Wood': '5E4430'}, \
        'Gunpowder raider: a light horseman on a blanket with loot sacks, a rolled bundle, a looted brass kettle and a clock on the croup; a loose Team coat, a slouch hat, a bandolier, a raised torch, a carbine slung', \
        dict(budget=2600, mounted=True)


def g_mercenary():
    arm = cl.person([buff_coat, (plumed_hat, 'Wood'), bandolier, ki.striped_sash, (lib.trousers, 'Cloth'), (gp.boots, 'Wood'), gp.scabbard, (gp.musket, {'bayonet': False, 'length': .82})])
    return [arm], {'Skin': 'B9805C', 'Cloth': 'B8402E', 'Leather': 'A07A4A', 'Metal': ('4A4A4E', .45, .7), 'Wood': '4E3828'}, \
        'Gunpowder mercenary: a buff leather coat over a Team waistcoat, a broad plumed hat, a bandolier of powder chargers, a striped sash with a coin pouch, high boots, a matchlock musket and a short sword', \
        cl.PERSON_OPTS


BUILDERS = {'gunpowder-raider': g_raider, 'gunpowder-mercenary': g_mercenary}


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
