# scripts/blender/build_houses_damage_kingdoms.py
# Damaged and ruined Kingdoms houses for the battle and the map's close view (plans/ART-MODELS-PLAN.md
# section 6; src/assets/battle/city/README.md; read by artIndex.housesDamage): for one theme,
# `house-poor`, `house-common` and `house-rich` of that theme's Kingdoms town kit, each as
# <house>-damaged and <house>-ruined, made exactly as build_houses_damage_classical.py makes the
# Classical ones (build_houses_damage_bronze.py's damaged() and ruined()).
#   base: the half-timbered tudor_house of ti_kingdoms (the base towns);
#   europe, indic, levant, sinic: the procedural Kingdoms kits (ti_<theme>_kingdoms house());
#   americas, steppe, monsoon, eastafrica, maghreb, nile, westafrica, israelite: the kit's delivered
#     <kit_root>/<theme>/kingdoms/houses/model.glb, loaded like assemble_kit_towns.py does.
# Output <out_dir>/kingdoms[-<theme>]-houses-damage.glb, one 1024 atlas, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_kingdoms.py -- <out_dir> <theme> [kit_root]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_kingdoms as tk  # noqa: E402
import build_houses_damage_bronze as hb  # noqa: E402
import build_houses_damage_classical as hc  # noqa: E402

KIT_THEMES = hc.KIT_THEMES
PROC_THEMES = ('base', 'europe', 'indic', 'levant', 'sinic')
# rubble: (main heap material, bits) in the kit's building stuff
RUBBLE = {
    'base': ('kg_wallstone', 'slate'), 'europe': ('ek_stone', 'ek_slate'), 'levant': ('lvk_brick', 'timber'),
    'indic': ('ink_sandstone', 'ink_tile'), 'sinic': ('snk_brick', 'snk_tile'), 'americas': ('stone', 'thatch'),
    'steppe': ('mud', 'timber'), 'monsoon': ('timber', 'thatch'), 'eastafrica': ('stone', 'thatch'),
    'maghreb': ('mudwall_bare', 'timber'), 'nile': ('mudwall_bare', 'reed'), 'westafrica': ('mud', 'thatch'),
    'israelite': ('stone', 'timber'),
}
# the kits' house_kind() areas: poor under 0.3, rich 0.6 and up
SIZES = {'poor': (0.6, 0.48), 'common': (0.8, 0.66), 'rich': (0.9, 0.7)}


def procedural_house(theme, kind, light=False):
    """One intact house of a procedural Kingdoms kit at the origin, front to -Y. `light` trims
    the optional extras where the full house breaks the damage budgets (2,500 / 600 / 120)."""
    def build(ms, rng):
        w, d = SIZES[kind]
        if theme == 'base':
            if kind == 'poor':
                tk.tudor_house(ms, rng, 0, 0, 0.62, 0.56, yaw=0, roof='thatch', rise=0.28)
            elif kind == 'common':
                tk.tudor_house(ms, rng, 0, 0, 0.8, 0.66, yaw=0, chimneys=1, jar_n=0 if light else 2)
            else:
                tk.tudor_house(ms, rng, 0, 0, 0.92, 0.74, yaw=0, chimneys=2, jar_n=0 if light else 2)
            return
        mod = __import__('ti_%s_kingdoms' % theme)
        mod.house(ms, rng, kind, 0.0, 0.0, w, d, yaw=0)
    return build


def kit_layouts(theme, kit_root, state):
    """build_houses_damage_classical.kit_layouts pointed at the kit's Kingdoms folder (and its tone)."""
    import assemble_kit_towns as ak0  # noqa: E402
    real_join = os.path.join

    def join(*parts):
        return real_join(*tuple('kingdoms' if p == 'classical' else p for p in parts))
    os.path.join = join
    try:
        out = hc.kit_layouts(theme, kit_root, state)
    finally:
        os.path.join = real_join
    # kit_maker reads the tone under the Classical key: give it the Kingdoms one (or none)
    ak0.KIT_TONE.pop((theme, 'classical'), None)
    if (theme, 'kingdoms') in ak0.KIT_TONE:
        ak0.KIT_TONE[(theme, 'classical')] = ak0.KIT_TONE[(theme, 'kingdoms')]
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    theme = argv[1]
    kit_root = argv[2] if len(argv) > 2 else os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')
    light = os.environ.get('LIGHT', '') == '1'
    hb.RUBBLE.update(RUBBLE)  # damaged() and ruined() read the rubble by theme
    state = {}
    ak = None
    if theme in KIT_THEMES:
        intact, intact_ruin, ak = kit_layouts(theme, os.path.abspath(kit_root), state)
    else:
        if theme != 'base':
            __import__('ti_%s_kingdoms' % theme)  # registers the kit's materials
        intact = {k: procedural_house(theme, k, light) for k in ('poor', 'common', 'rich')}
        intact_ruin = intact
    items = []
    for k in ('poor', 'common', 'rich'):
        items.append(('house-%s-damaged' % k, hb.damaged(intact[k], theme), None))
        items.append(('house-%s-ruined' % k, hb.ruined(intact_ruin[k], theme), None))
    name = 'kingdoms-houses-damage' if theme == 'base' else 'kingdoms-%s-houses-damage' % theme
    seed = 9100 + sum(ord(c) for c in theme)
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
