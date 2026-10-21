# scripts/blender/build_damage_future.py
# The Future damage sets (eight-ages plan U88; read by artIndex.housesDamage and artIndex.palaceDamage, drawn by
# cityLayer.js in battle and townDamage.js on the map), made as the other ages' are (build_houses_damage_bronze.py's
# damaged() and ruined(): a broken corner and rubble, a ruin cut down with its rubble) from the Future layouts:
#   future[-<theme>]-houses-damage.glb  house-poor (a pod), house-common (a dome, a court block in the levant), house-rich
#                                       (a residential tower; tiered in the sinic theme): each -damaged and -ruined
#   palace-damage-future.glb            palace-damaged, palace-ruined, palace-small-damaged, palace-small-ruined (the
#                                       palaces of build_shared_future.py)
# One 1024 atlas per file, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_damage_future.py -- <out_dir> <base|sinic|levant|palace>
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_town as tt  # noqa: E402
import ti_future_kit as fk  # noqa: E402
import build_houses_damage_bronze as hb  # noqa: E402
import build_town_future as tf  # noqa: E402
import build_shared_future as sf  # noqa: E402
from ti_town import G  # noqa: E402,F401

RUBBLE = {'base': ('fu_plinth', 'fu_panel'), 'sinic': ('fu_plinth', 'fu_lacquer'), 'levant': ('fu_sand', 'fu_plinth'), 'palace': ('fu_plinth', 'fu_panel')}


def house(theme, kind):
    """One intact Future house at the origin, front to -Y."""
    def build(ms, rng):
        if kind == 'poor':
            fk.pod(ms, 0, 0, .56, .40, .17)
        elif kind == 'common':
            if theme == 'levant':
                tf.court_block(ms, rng, 0, 0, 0, w=.56, d=.48, storeys=2)
            else:
                fk.dome(ms, 0, 0, .28, segs=(12, 8, 6))
        else:
            if theme == 'levant':
                tf.court_block(ms, rng, 0, 0, 0, w=.62, d=.52, storeys=3)
            else:
                tf.tower(ms, rng, 0, 0, 0, w=.36, d=.32, storeys=4, eaves='fu_lacquer' if theme == 'sinic' else None)
    return build


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir = os.path.abspath(argv[0])
    which = argv[1]
    hb.RUBBLE.update(RUBBLE)
    hb.INTERIOR = 'fu_panel'
    items = []
    if which == 'palace':
        for name, fn in (('palace', sf.palace), ('palace-small', sf.palace_small)):
            items.append(('%s-damaged' % name, hb.damaged(fn, 'palace'), None))
            items.append(('%s-ruined' % name, hb.ruined(fn, 'palace'), None))
        name, seed = 'palace-damage-future', 4644
    else:
        for k in ('poor', 'common', 'rich'):
            items.append(('house-%s-damaged' % k, hb.damaged(house(which, k), which), None))
            items.append(('house-%s-ruined' % k, hb.ruined(house(which, k), which), None))
        name = 'future-houses-damage' if which == 'base' else 'future-%s-houses-damage' % which
        seed = 9800 + sum(ord(c) for c in which)
    random.seed(seed)
    counts = tt.build_file(name, items, out_dir, atlas=1024, seed=seed)
    print('DAMAGE_BUILT', name, counts, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
