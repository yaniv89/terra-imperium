# scripts/blender/build_houses_damage_modern.py
# Damaged and ruined Modern houses for the battle and the map's close view (plans/ART-MODELS-PLAN.md
# section 6; src/assets/battle/city/README.md; read by artIndex.housesDamage): for one theme,
# `house-poor`, `house-common` and `house-rich` of that theme's Modern town kit, each as
# <house>-damaged and <house>-ruined, made as build_houses_damage_gunpowder.py makes the Gunpowder ones
# (build_houses_damage_bronze.py's damaged() and ruined()).
#   base: ti_modern (a slate-roofed brick house, a two-storey rendered block with a shopfront, a
#     three-storey brick block with balconies);
#   levant, sinic: the procedural Modern kits (ti_<theme>_modern.kit_block, typ poor/common/rich);
#   americas, eastafrica, europe, indic, israelite, maghreb, monsoon, nile, steppe, westafrica: the kit's
#     delivered <kit_root>/<theme>/modern/houses/model.glb, loaded like assemble_kit_towns.py does.
# Output <out_dir>/modern[-<theme>]-houses-damage.glb, one 1024 atlas, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_modern.py -- <out_dir> <theme> [kit_root]
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_town as tt  # noqa: E402
import ti_modern as tmd  # noqa: E402 (registers the md_ materials)
import build_houses_damage_bronze as hb  # noqa: E402
import build_houses_damage_classical as hc  # noqa: E402

KIT_THEMES = ('americas', 'eastafrica', 'europe', 'indic', 'israelite', 'maghreb', 'monsoon', 'nile', 'steppe', 'westafrica')
PROC_THEMES = ('base', 'levant', 'sinic')
# rubble: (main heap material, bits): concrete and the kit's building stuff
RUBBLE = {
    'base': ('md_concrete', 'md_brick'), 'levant': ('md_concrete', 'md_render'), 'sinic': ('md_concrete', 'md_brick'),
    'americas': ('md_concrete', 'md_corrugated'), 'eastafrica': ('md_concrete', 'md_corrugated'), 'europe': ('md_concrete', 'md_brick'),
    'indic': ('md_concrete', 'md_render'), 'israelite': ('stone', 'md_concrete'), 'maghreb': ('md_render', 'md_concrete'),
    'monsoon': ('md_concrete', 'md_corrugated'), 'nile': ('md_render', 'md_concrete'), 'steppe': ('md_concrete', 'md_corrugated'),
    'westafrica': ('md_concrete', 'md_corrugated'),
}
# a different draw of rubble where the first one ran a few triangles over the damage budget
SEED_SHIFT = {'steppe': 7}
SIZES = {'poor': (0.6, 0.48), 'common': (0.72, 0.56), 'rich': (0.8, 0.62)}


def procedural_house(theme, kind):
    """One intact house of a procedural Modern kit at the origin, front to -Y."""
    def build(ms, rng):
        w, d = SIZES[kind]
        if theme == 'base':
            if kind == 'poor':
                tmd.house(ms, rng, 0, 0, w, d, yaw=0)
            elif kind == 'common':
                tmd.block(ms, rng, 0, 0, w, d, storeys=2, wall='md_render_win', yaw=0, shop=True, awning=True, units=1)
            else:
                tmd.block(ms, rng, 0, 0, w, d, storeys=3, wall='md_brick_win', yaw=0, balcony=True, units=2, stair=True)
            return
        mod = __import__('ti_%s_modern' % theme)
        storeys = {'poor': 1, 'common': 2, 'rich': 3}[kind]
        mod.kit_block(ms, rng, 0.0, 0.0, w, d, storeys=storeys, yaw=0, typ=kind)
    return build


def kit_layouts(theme, kit_root, state):
    """build_houses_damage_classical.kit_layouts pointed at the kit's Modern folder (and its tone)."""
    import assemble_kit_towns as ak0  # noqa: E402
    real_join = os.path.join

    def join(*parts):
        return real_join(*tuple('modern' if p == 'classical' else p for p in parts))
    os.path.join = join
    try:
        out = hc.kit_layouts(theme, kit_root, state)
    finally:
        os.path.join = real_join
    ak0.KIT_TONE.pop((theme, 'classical'), None)
    if (theme, 'modern') in ak0.KIT_TONE:
        ak0.KIT_TONE[(theme, 'classical')] = ak0.KIT_TONE[(theme, 'modern')]
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    theme = argv[1]
    kit_root = argv[2] if len(argv) > 2 else os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')
    hb.RUBBLE.update(RUBBLE)
    state = {}
    ak = None
    if theme in KIT_THEMES:
        intact, intact_ruin, ak = kit_layouts(theme, os.path.abspath(kit_root), state)
    else:
        if theme != 'base':
            __import__('ti_%s_modern' % theme)  # registers the kit's materials
        intact = {k: procedural_house(theme, k) for k in ('poor', 'common', 'rich')}
        intact_ruin = intact
    items = []
    for k in ('poor', 'common', 'rich'):
        items.append(('house-%s-damaged' % k, hb.damaged(intact[k], theme), None))
        items.append(('house-%s-ruined' % k, hb.ruined(intact_ruin[k], theme), None))
    name = 'modern-houses-damage' if theme == 'base' else 'modern-%s-houses-damage' % theme
    seed = 9600 + sum(ord(c) for c in theme) + SEED_SHIFT.get(theme, 0)
    random.seed(seed)
    counts = tt.build_file(name, items, out_dir, atlas=1024, seed=seed, write=ak is None)
    if ak is not None:
        ak.finish(out_dir, name)
    import json
    with open(os.path.join(out_dir, name + '.report.json'), 'w') as fh:
        json.dump({'file': name + '.glb', 'theme': theme, 'triangles': counts}, fh, indent=2)
    print('HOUSES_BUILT', name, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
