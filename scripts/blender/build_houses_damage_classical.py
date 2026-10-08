# scripts/blender/build_houses_damage_classical.py
# Damaged and ruined Classical houses for the battle and the map's close view (plans/ART-MODELS-PLAN.md
# section 6; src/assets/battle/city/README.md; read by src/battle/art/cityArt.js housesDamage): for one
# theme, `house-poor`, `house-common` and `house-rich` of that theme's Classical town kit, each as
# <house>-damaged and <house>-ruined, made exactly as build_houses_damage_bronze.py makes the Bronze
# ones (its damaged() and ruined(): a broken corner, a burnt roof, rubble; walls cut low, roof gone).
#   base: the Roman house of ti_classical (the base town a);
#   europe, indic, levant, sinic: the procedural Classical kits (ti_<theme>_classical <theme>_house);
#   americas, steppe, monsoon, eastafrica, maghreb, nile, westafrica, israelite: the kit's delivered
#     <kit_root>/<theme>/classical/houses/model.glb, loaded like assemble_kit_towns.py does.
# Output <out_dir>/classical[-<theme>]-houses-damage.glb, one 1024 atlas, LOD0..LOD2.
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_classical.py -- <out_dir> <theme> [kit_root]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import build_houses_damage_bronze as hb  # noqa: E402

KIT_THEMES = ('americas', 'steppe', 'monsoon', 'eastafrica', 'maghreb', 'nile', 'westafrica', 'israelite')
PROC_THEMES = ('base', 'europe', 'indic', 'levant', 'sinic')
# rubble: (main heap material, bits) in the kit's building stuff
RUBBLE = {
    'base': ('ashlar', 'tile'), 'europe': ('ashlar', 'tile'), 'levant': ('ashlar', 'timber'),
    'indic': ('mudwall_bare', 'tile'), 'sinic': ('mud', 'tile_dark'), 'americas': ('stone', 'thatch'),
    'steppe': ('mud', 'timber'), 'monsoon': ('timber', 'thatch'), 'eastafrica': ('stone', 'thatch'),
    'maghreb': ('ashlar', 'tile'), 'nile': ('mudwall_bare', 'reed'), 'westafrica': ('mud', 'thatch'),
    'israelite': ('stone', 'timber'),
}
# the Classical town scripts' slots (w, d) per house kind
SIZES = {'poor': (0.8, 0.66), 'common': (0.74, 0.62), 'rich': (0.74, 0.62)}


def procedural_house(theme, kind):
    """One intact house of a procedural Classical kit at the origin, front to -Y."""
    def build(ms, rng):
        w, d = SIZES[kind]
        if theme == 'base':
            if kind == 'poor':
                tc.roman_house(ms, rng, 0, 0, 0.8, 0.66, yaw=0, awning_w=0.32)
            elif kind == 'common':
                tc.roman_house(ms, rng, 0, 0, 0.8, 0.66, yaw=0, jar_n=2, chimney=True)
            else:
                tc.roman_house(ms, rng, 0, 0, 0.82, 0.7, yaw=0, storeys=2, balcony=True, gable_front=True)
            return
        mod = __import__('ti_%s_classical' % theme)
        slot = dict(x=0.0, y=0.0, w=w, d=d, kind=kind, yaw=0)
        if kind == 'rich' and theme != 'levant':
            slot['garden'] = False
        # lighter variants where the full house would break the damage budgets (2,500 / 600 / 120)
        if theme == 'levant':
            slot.update({'common': dict(jar_n=0, cloth=False), 'rich': dict(kind='common', w=0.8, d=0.66, jar_n=0, cloth=False)}.get(kind, {}))
        if theme == 'sinic' and kind == 'rich':
            slot.pop('garden', None)
            slot.update(kind='common', w=0.8, d=0.66, jar_n=3, tree_in=False)
        getattr(mod, '%s_house' % theme)(ms, rng, slot)
    return build


def kit_layouts(theme, kit_root, state):
    """build_houses_damage_bronze.kit_layouts for the Classical kit folder."""
    import assemble_kit_towns as ak  # noqa: E402
    path = os.path.join(kit_root, theme, 'classical', 'houses', 'model.glb')

    def kit_maker():
        boxes = ('house-poor', 'house-common', 'house-rich')
        parts, images = ak.load_kit({'houses': path}, lambda p: min(1.0, 270 / max(1, p.tris)), lambda p: 60, lod2_box=boxes)
        light, _ = ak.load_kit({'houses': path}, lambda p: min(1.0, 900 / max(1, p.tris)), lambda p: 60, lod2_box=boxes)
        state['light'] = light
        tone = ak.KIT_TONE.get((theme, 'classical'))
        for key, img in images.items():
            town = ak.lifted(img, [p.lod0['town'] for p in parts.values() if p.key == key and 'town' in p.lod0], *tone) if tone else None
            ak.kit_material('nl_%s_town' % key, town or img)
            ak.kit_material('nl_%s_team' % key, ak.team_retoned(img, parts, key) or img)
        state['parts'] = parts
    ak.register_materials(['nl_houses_town', 'nl_houses_team'], team=['nl_houses_team'])
    tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]

    def house(kind, ruin=False):
        def build(ms, rng):
            part = state['parts']['house-' + kind]
            if not ruin or part.tris <= 1000:
                ak.add_part(ms, part, tm.house_frame(0, 0, 0))
                return
            light = state['light']['house-' + kind]
            for lod, store in ((0, light.lod1), (1, part.lod1), (2, part.lod2)):
                for role, bm in store.items():
                    mat = 'nl_houses_%s' % role if role in ('town', 'team') else 'nl_houses_town'
                    ms.add(bm.copy(), mat, lod=2, only=(lod,))
        return build
    return {k: house(k) for k in ('poor', 'common', 'rich')}, {k: house(k, True) for k in ('poor', 'common', 'rich')}, ak


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    theme = argv[1]
    kit_root = argv[2] if len(argv) > 2 else os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')
    hb.RUBBLE.update(RUBBLE)  # damaged() and ruined() read the rubble by theme
    hb.INTERIOR = 'plaster'  # the ruins' standing walls get a lit inner face (no dark interiors at the cut)
    state = {}
    ak = None
    if theme in KIT_THEMES:
        intact, intact_ruin, ak = kit_layouts(theme, os.path.abspath(kit_root), state)
    else:
        if theme != 'base':
            __import__('ti_%s_classical' % theme)  # registers the kit's materials
        intact = {k: procedural_house(theme, k) for k in ('poor', 'common', 'rich')}
        intact_ruin = intact
    items = []
    for k in ('poor', 'common', 'rich'):
        items.append(('house-%s-damaged' % k, hb.damaged(intact[k], theme), None))
        items.append(('house-%s-ruined' % k, hb.ruined(intact_ruin[k], theme), None))
    name = 'classical-houses-damage' if theme == 'base' else 'classical-%s-houses-damage' % theme
    seed = 9000 + sum(ord(c) for c in theme)
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
