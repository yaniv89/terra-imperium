# scripts/blender/build_city_kingdoms.py
# The Kingdoms city kit for the battle (plans/ART-MODELS-PLAN.md section 6; src/assets/battle/city/
# README.md), four files in the Kingdoms town kit's stuff so a besieged medieval city matches its
# town on the map:
#   walls-kingdoms.glb  the wall kit of build_city_bronze.py (wall-straight, wall-corner, tower,
#                       gate-open, gate-closed; each -damaged and -breached) in grey wall stone with
#                       a dressed-stone band
#   ruins-kingdoms.glb  rubble-s, rubble-m, rubble-l (wall stone, lime plaster, slate), beams, scorch
#   fort-kingdoms.glb   fort: build_city_classical.py's castellum in wall stone round a half-timbered
#                       barrack hall and store, a watch tower under slate, tents, a well, the standard
#   civic-kingdoms.glb  keep, keep-damaged, keep-ruined: the Kingdoms town hall of rts-kingdoms.glb (a
#                       half-timbered guildhall behind a stone arcade in its walled court); ruined, its
#                       lime walls stand as ragged stubs (named cream for build_city_classical.ruined)
# The shapes are build_city_classical.py's with the Kingdoms houses and materials (build_rts_kingdoms.py
# swaps ti_classical.roman_house for ti_kingdoms.town_house and renames the materials). One 1024 atlas
# per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_kingdoms.py -- <out_dir> [walls,ruins,fort,civic]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_rts_kingdoms as rk  # noqa: E402 (patches ti_classical's house and tree first)
import build_city_bronze as cb  # noqa: E402
import build_city_classical as cc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402

WALL_MATS = {'brick': 'kg_wallstone', 'limewash': 'kg_stone'}
RUIN_MATS = {'mudwall': 'kg_wallstone', 'mudwall_bare': 'lime', 'reed': 'slate', 'brick': 'kg_wallstone'}


def remat(layout, mapping=None):
    return rc.remat(layout, mapping or rk.MATS)


def wall_items():
    return [(n, remat(fn, WALL_MATS if 'wall' in n or 'gate' in n or 'tower' in n else RUIN_MATS), g) for n, fn, g in cb.wall_items()]


FILES = {
    'walls-kingdoms': wall_items,
    'ruins-kingdoms': lambda: [('rubble-s', remat(cb.rubble(0.8), RUIN_MATS), None), ('rubble-m', remat(cb.rubble(1.4), RUIN_MATS), None),
                               ('rubble-l', remat(cb.rubble(2.4), RUIN_MATS), None), ('beams', remat(cb.beams, RUIN_MATS), None), ('scorch', cb.scorch, None)],
    'fort-kingdoms': lambda: [('fort', cc.shifted(remat(cc.fort)), None)],
    'civic-kingdoms': lambda: [('keep', cc.shifted(remat(rc.town_hall)), None),
                               ('keep-damaged', cc.shifted(remat(rb.damaged(rc.town_hall))), None),
                               ('keep-ruined', cc.shifted(remat(cc.ruined(remat(rc.town_hall, {'lime': 'cream'})))), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-kingdoms')
    only = [n if n.endswith('-kingdoms') else n + '-kingdoms' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6400 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
