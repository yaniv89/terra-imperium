# scripts/blender/build_damage_information.py
# The Information damage sets (eight-ages plan U88; read by artIndex.housesDamage and artIndex.palaceDamage, drawn by
# cityLayer.js in battle and townDamage.js on the map), made as the other ages' are (build_houses_damage_bronze.py's
# damaged() and ruined(): a broken corner and rubble, a ruin cut down with its rubble) from the Information layouts:
#   information[-<theme>]-houses-damage.glb  house-poor (a villa), house-common (an apartment block), house-rich (a
#                                            residential tower; with lacquer eaves in the sinic theme): each -damaged
#                                            and -ruined, in the theme's facade (build_town_information.WALL)
#   palace-damage-information.glb            palace-damaged, palace-ruined, palace-small-damaged, palace-small-ruined
#                                            (the city hall and parliament of build_shared_information.py)
# One 1024 atlas per file, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_damage_information.py -- <out_dir> <base|europe|levant|sinic|indic|palace>
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_town as tt  # noqa: E402
import ti_information_kit as ik  # noqa: E402,F401
import build_houses_damage_bronze as hb  # noqa: E402
import build_town_information as ti  # noqa: E402
import build_shared_information as si  # noqa: E402

RUBBLE = {'base': ('in_plinth', 'in_panel'), 'europe': ('in_brick', 'in_plinth'), 'levant': ('in_sand', 'in_plinth'),
          'sinic': ('in_plinth', 'in_lacquer'), 'indic': ('in_ochre', 'in_plinth'), 'palace': ('in_plinth', 'in_panel')}


def house(theme, kind):
    """One intact Information house at the origin, front to -Y."""
    wall = ti.WALL[theme]

    def build(ms, rng):
        if kind == 'poor':
            ti.villa(ms, rng, 0, 0, 0, w=.42, d=.34, wall=wall, roof='in_lacquer' if theme == 'sinic' else 'in_graphite')
        elif kind == 'common':
            ti.block(ms, rng, 0, 0, 0, w=.56, d=.4, storeys=3, wall=wall if theme != 'sinic' else 'in_panel_win')
        else:
            ti.tower(ms, rng, 0, 0, 0, w=.34, d=.3, storeys=5, eaves='in_lacquer' if theme == 'sinic' else None)
    return build


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir = os.path.abspath(argv[0])
    which = argv[1]
    hb.RUBBLE.update(RUBBLE)
    hb.INTERIOR = 'in_panel'
    items = []
    if which == 'palace':
        for name, fn in (('palace', si.palace), ('palace-small', si.palace_small)):
            items.append(('%s-damaged' % name, hb.damaged(fn, 'palace'), None))
            items.append(('%s-ruined' % name, hb.ruined(fn, 'palace'), None))
        name, seed = 'palace-damage-information', 4544
    else:
        for k in ('poor', 'common', 'rich'):
            items.append(('house-%s-damaged' % k, hb.damaged(house(which, k), which), None))
            items.append(('house-%s-ruined' % k, hb.ruined(house(which, k), which), None))
        name = 'information-houses-damage' if which == 'base' else 'information-%s-houses-damage' % which
        seed = 9700 + sum(ord(c) for c in which)
    random.seed(seed)
    counts = tt.build_file(name, items, out_dir, atlas=1024, seed=seed)
    print('DAMAGE_BUILT', name, counts, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
