# scripts/blender/build_houses_damage_gunpowder.py
# Damaged and ruined Gunpowder houses for the battle and the map's close view (plans/ART-MODELS-PLAN.md
# section 6; src/assets/battle/city/README.md; read by artIndex.housesDamage): for one theme,
# `house-poor`, `house-common` and `house-rich` of that theme's Gunpowder town kit, each as
# <house>-damaged and <house>-ruined, made exactly as build_houses_damage_kingdoms.py makes the
# Kingdoms ones (build_houses_damage_bronze.py's damaged() and ruined()).
#   base: ti_gunpowder.gp_house (stucco cottage, brick town house, the hip-roofed house with dormers);
#   europe, levant, sinic: the procedural Gunpowder kits (ti_<theme>_gunpowder);
#   americas, eastafrica, indic, israelite, maghreb, monsoon, nile, steppe, westafrica: the kit's
#     delivered <kit_root>/<theme>/gunpowder/houses/model.glb, loaded like assemble_kit_towns.py does.
# Output <out_dir>/gunpowder[-<theme>]-houses-damage.glb, one 1024 atlas, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_gunpowder.py -- <out_dir> <theme> [kit_root]
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_town as tt  # noqa: E402
import ti_gunpowder as tg  # noqa: E402
import build_houses_damage_bronze as hb  # noqa: E402
import build_houses_damage_classical as hc  # noqa: E402

KIT_THEMES = ('americas', 'eastafrica', 'indic', 'israelite', 'maghreb', 'monsoon', 'nile', 'steppe', 'westafrica')
PROC_THEMES = ('base', 'europe', 'levant', 'sinic')
# rubble: (main heap material, bits) in the kit's building stuff
RUBBLE = {
    'base': ('gp_brick', 'gp_tile'), 'europe': ('gp_brick', 'gp_slate'), 'levant': ('gp_stucco', 'gp_tile'), 'sinic': ('gp_brick', 'gp_tile'),
    'americas': ('stone', 'gp_tile'), 'eastafrica': ('stone', 'thatch'), 'indic': ('mudwall_bare', 'gp_tile'), 'israelite': ('stone', 'timber'),
    'maghreb': ('mudwall_bare', 'timber'), 'monsoon': ('timber', 'thatch'), 'nile': ('mudwall_bare', 'reed'), 'steppe': ('mud', 'timber'),
    'westafrica': ('mud', 'thatch'),
}
SIZES = {'poor': (0.6, 0.48), 'common': (0.78, 0.62), 'rich': (0.9, 0.7)}


def procedural_house(theme, kind):
    """One intact house of a procedural Gunpowder kit at the origin, front to -Y."""
    def build(ms, rng):
        w, d = SIZES[kind]
        if theme == 'base':
            if kind == 'poor':
                tg.gp_house(ms, rng, 0, 0, w, d, yaw=0, wall='gp_stucco', roof='gp_tile', kind='gable', storeys=1, rise=0.2, chimneys=1, dormers=0, props=1)
            elif kind == 'common':
                tg.gp_house(ms, rng, 0, 0, w, d, yaw=0, wall='gp_brick', roof='gp_tile', kind='gable', storeys=2, rise=0.22, chimneys=1, dormers=0, props=1)
            else:
                tg.gp_house(ms, rng, 0, 0, w, d, yaw=0, wall='gp_stucco', roof='gp_slate', kind='hip', storeys=2, chimneys=2, dormers=2, props=1)
            return
        mod = __import__('ti_%s_gunpowder' % theme)
        if theme == 'sinic':
            if kind == 'poor':
                mod.poor_house(ms, rng, 0, 0, w, d, yaw=0)
            else:
                mod.court_house(ms, rng, 0, 0, w, d, yaw=0, rich=kind == 'rich')
            return
        mod.kit_house(ms, rng, 0.0, 0.0, w, d, yaw=0, typ=kind)
    return build


def kit_layouts(theme, kit_root, state):
    """build_houses_damage_classical.kit_layouts pointed at the kit's Gunpowder folder (and its tone)."""
    import assemble_kit_towns as ak0  # noqa: E402
    real_join = os.path.join

    def join(*parts):
        return real_join(*tuple('gunpowder' if p == 'classical' else p for p in parts))
    os.path.join = join
    try:
        out = hc.kit_layouts(theme, kit_root, state)
    finally:
        os.path.join = real_join
    ak0.KIT_TONE.pop((theme, 'classical'), None)
    if (theme, 'gunpowder') in ak0.KIT_TONE:
        ak0.KIT_TONE[(theme, 'classical')] = ak0.KIT_TONE[(theme, 'gunpowder')]
    return out


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    theme = argv[1]
    kit_root = argv[2] if len(argv) > 2 else os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')
    hb.RUBBLE.update(RUBBLE)
    hb.INTERIOR = 'plaster'  # the ruins' standing walls get a lit inner face (no dark interiors at the cut)
    state = {}
    ak = None
    if theme in KIT_THEMES:
        intact, intact_ruin, ak = kit_layouts(theme, os.path.abspath(kit_root), state)
    else:
        if theme != 'base':
            __import__('ti_%s_gunpowder' % theme)  # registers the kit's materials
        intact = {k: procedural_house(theme, k) for k in ('poor', 'common', 'rich')}
        intact_ruin = intact
    items = []
    for k in ('poor', 'common', 'rich'):
        items.append(('house-%s-damaged' % k, hb.damaged(intact[k], theme), None))
        items.append(('house-%s-ruined' % k, hb.ruined(intact_ruin[k], theme), None))
    name = 'gunpowder-houses-damage' if theme == 'base' else 'gunpowder-%s-houses-damage' % theme
    seed = 9200 + sum(ord(c) for c in theme)
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
