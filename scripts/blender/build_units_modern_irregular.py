# scripts/blender/build_units_modern_irregular.py
# The Modern irregulars of plans/ART-MODELS-PLAN.md 4.3 (Claude, 2026-10-08), on the shared rig and body
# of ti_units.py, the wheeled rig of ti_mounts.py and the parts of build_units_modern.py, rest pose only:
#   modern-raider     a "technical": a pickup on the wheeled rig with a machine gun on a pintle in its
#                     bed (Turret and Barrel bones), loot (sacks, a television, a crate, jerrycans) lashed
#                     in the back, a Team tailgate and doors; a gunner in a headscarf and a
#                     Team shirt, a raised torch. Drawn for raider squads of the cavalry class (the
#                     Modern cavalry is the tank: the raid's light vehicle stands in for it).
#   modern-mercenary  a contractor: a ball cap and headset, a tan shirt, a Team chest rig, cargo trousers,
#                     a striped sash with a coin pouch, a beard, a carbine at the ready.
# Culture neutral (no national motifs). Flame is its own flat material (not a tag).
#   blender -b --factory-startup -P scripts/blender/build_units_modern_irregular.py -- [modern-raider modern-mercenary]
import bpy, sys, os, math, json  # noqa: F401
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_mounts as tm  # noqa: E402
import build_units_bronze_signature as lib  # noqa: E402
import build_units_classical as cl  # noqa: E402
import build_units_kingdoms_irregular as ki  # noqa: E402
import build_units_modern as md  # noqa: E402
os.environ['TI_UNITS_OUT'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'units', 'modern')


def headscarf(arm, mat='Cloth'):
    lib.headcloth(arm, mat, tail=True)
    u.box('FaceWrap', (0, -.06, .9), (.1, .03, .05), mat, 'Head', arm)


def ball_cap(arm, mat='Leather'):
    u.tube('BallCap', [(0, 0, .95), (0, 0, .99), (0, 0, 1.02)], [(.068, .064), (.066, .062), (.045, .042)], mat, ['Head'] * 3, 10, arm)
    u.box('CapBill', (0, -.085, .955), (.09, .06, .01), mat, 'Head', arm)
    for sx in (-1, 1):
        u.box(f'HeadsetCup{sx}', (sx * .062, 0, .92), (.02, .04, .04), 'Leather', 'Head', arm)


def chest_rig(arm, mat='Team'):
    lib.ring('ChestRig', arm, [.58, .64, .70, .745], [(.108, .08), (.11, .08), (.124, .086), (.12, .08)], mat, ['Spine', 'Spine', 'Chest', 'Chest'], 8)
    for k, x in enumerate((-.05, .0, .05)):
        u.box(f'RigPouch{k}', (x, -.09, .64), (.04, .028, .07), 'Leather', 'Spine', arm)


def m_raider():
    ki.flame_material()
    parts, info = tm.wheeled('Pickup', axles=(-.42, .36), track=.6, wheel_r=.13, wheel_w=.08, frame_z=.24, frame_len=1.0, turret_at=(0, .45, .52))
    rig = info['rig']
    W = .66
    md.truck_cab('Pickup', rig, -.66, -.02, W, .26, .38)
    u.box('PickupBed', (0, .38, .30), (W, .76, .04), 'Cloth', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'BedSide{sx}', (sx * (W / 2 - .01), .38, .38), (.02, .76, .12), 'Cloth', 'Hull', rig)
    u.box('Tailgate', (0, .76, .38), (W, .02, .12), 'Team', 'Hull', rig)
    # the machine gun on its pintle
    u.tube('Pintle', [(0, .45, .32), (0, .45, .62)], [.025, .02], 'Metal', ['Turret'] * 2, 6, rig)
    u.box('GunShield', (0, .34, .7), (.22, .02, .14), 'Metal', 'Turret', rig)
    u.tube('MGBarrel', [(0, .46, .66), (0, .2, .69), (0, -.15, .7)], [.03, .018, .014], 'Leather', ['Barrel'] * 3, 6, rig)
    u.box('AmmoCan', (.07, .46, .64), (.05, .08, .05), 'Cloth', 'Barrel', rig)
    # loot: sacks, a crate, jerrycans, a television
    for k, (x, y) in enumerate(((-.2, .62), (.2, .64), (-.18, .2))):
        u.tube(f'LootSack{k}', [(x, y, .32), (x, y, .4), (x, y, .46)], [(.07, .06), (.08, .07), (.04, .04)], 'Wood', ['Hull'] * 3, 6, rig)
    u.box('LootCrate', (.2, .2, .36), (.14, .12, .1), 'Wood', 'Hull', rig)
    u.box('Television', (.2, .2, .46), (.12, .1, .1), 'Leather', 'Hull', rig)
    u.box('TVScreen', (.2, .148, .465), (.09, .01, .07), 'Metal', 'Hull', rig)
    for k in range(2):
        u.box(f'Jerrycan{k}', (-.3 + .07 * k, .72, .36), (.05, .07, .09), 'Cloth', 'Hull', rig)
    gunner = cl.person([(lib.top, 'Team', {'name': 'Shirt'}), (md.sleeves, 'Team'), (md.yoke, 'Team'),
                        (md.cargo_trousers, 'Cloth', {'pads': None}), md.combat_boots, headscarf, ki.torch], name='Gunner')
    gunner.location = (0, .58, .28)
    return [*parts, gunner], {'Skin': 'B9805C', 'Cloth': 'C8B48A', 'Leather': '2A2826', 'Metal': ('5A5C5E', .45, .6), 'Wood': '8A6A44'}, \
        'Modern raider: a technical, a pickup with a machine gun on a pintle in its bed, loot (sacks, a crate, a television, jerrycans) in the back, a Team tailgate and doors; a gunner in a headscarf and a Team shirt, holding up a torch', \
        dict(budget=3000, mounted=False, vehicle=True)


def m_mercenary():
    arm = cl.person([(lib.top, 'Cloth', {'name': 'Shirt'}), (md.sleeves, 'Cloth'), (md.yoke, 'Cloth'), (md.cargo_trousers, 'Wood', {'pads': None}), md.combat_boots,
                     chest_rig, ki.striped_sash, ball_cap, (lib.beard, 'Leather'), md.assault_rifle])
    md.hide_skin(arm, legs=False)
    return [arm], {'Skin': 'C99472', 'Cloth': 'C8B48A', 'Leather': '2A2420', 'Metal': ('3E4144', .45, .6), 'Wood': '6A6450'}, \
        'Modern mercenary: a contractor in a ball cap with a headset, a tan shirt, a Team chest rig, cargo trousers, a striped sash with a coin pouch, a beard, a carbine at the ready', \
        cl.PERSON_OPTS


BUILDERS = {'modern-raider': m_raider, 'modern-mercenary': m_mercenary}


def build(uid):
    lib.reset()
    parts, colors, look, opts = BUILDERS[uid]()
    md.finish(uid, parts, colors, {'role': uid.split('-')[1], 'look': look, 'notes': 'Culture-neutral irregular (plan 4.3, 4.4); rest pose, the vertex rig walks it.'}, opts)


if __name__ == '__main__':
    ids = [a for a in (sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []) if a] or list(BUILDERS)
    for m in ids:
        build(m)
    sys.stdout.flush()
    os._exit(0)
