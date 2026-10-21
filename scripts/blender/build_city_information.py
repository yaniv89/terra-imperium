# scripts/blender/build_city_information.py
# The Information city kit for the battle (eight-ages plan U88; src/assets/battle/city/README.md), four files with the
# Modern kit's object names, states, sizes and origins (build_city_modern.py), in today's materials of
# ti_information_kit.py (md_* to in_*: concrete and clad walls, blast walls, asphalt, painted marks), and the
# Information headquarters (build_rts_information.town_hall: the glass tower) as the keep:
#   walls-information.glb  wall-straight, wall-corner, tower, gate-open, gate-closed; each -damaged and -breached
#   ruins-information.glb  rubble-s, rubble-m, rubble-l, beams, scorch
#   fort-information.glb   fort: the Modern bunker line re-dressed
#   civic-information.glb  keep, keep-damaged, keep-ruined: the glass headquarters tower on its podium
# One 1024 atlas per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_information.py -- <out_dir> [walls,ruins,fort,civic]
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_city_modern as cm  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_city_classical as cc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_information as rf  # noqa: E402

RUIN = dict(rf.IN, mudwall='in_plinth', mudwall_bare='in_panel', reed='in_panel', brick='in_graphite', limewash='in_plinth', roof='in_graphite',
            tile='in_graphite', tile_dark='in_graphite', ashlar='in_plinth', cream='in_panel', stone='in_plinth', timber='in_graphite', ash='in_graphite')


def inf(layout, mapping=None):
    return rf.remat(layout, mapping or RUIN)


def grounded(layout):
    """Nothing below the ground (validate_model.py): the slabs knocked over flattened at z = 0."""
    def build(ms, rng):
        out = layout(ms, rng)
        for bm, *_ in ms.parts:
            for v in bm.verts:
                if v.co.z < 0:
                    v.co.z = 0.0
        return out
    return build


def trimmed(layout, lod, budget):
    """The layout with one detail level decimated to `budget` (build_improvement_fort_classical.trim)."""
    def build(ms, rng):
        import build_improvement_fort_classical as fc  # noqa: E402
        out = layout(ms, rng)
        fc.trim(ms, lod, budget)
        return out
    return build


def hall_for_ruin(ms, rng):
    """The headquarters with its clad walls named cream, so build_city_classical.ruined finds them."""
    out = rf.town_hall(ms, rng)
    ms.parts[:] = [(bm, 'cream' if mat in ('in_panel_win', 'in_panel') else mat, lod, only) for bm, mat, lod, only in ms.parts]
    return out


FILES = {
    'walls-information': lambda: [(n, grounded(inf(fn)), x) for n, fn, x in cm.wall_items()],
    'ruins-information': lambda: [('rubble-s', inf(cb.rubble(0.8)), None), ('rubble-m', inf(cb.rubble(1.4)), None), ('rubble-l', inf(cb.rubble(2.4)), None),
                             ('beams', inf(cb.beams), None), ('scorch', cb.scorch, None)],
    'fort-information': lambda: [('fort', cc.shifted(inf(cm.remat(cm.fort_budgeted))), None)],
    'civic-information': lambda: [('keep', cc.shifted(rf.town_hall), None),
                             ('keep-damaged', cc.shifted(inf(rb.damaged(rf.town_hall), {**RUIN, **rf.DAMAGE_MATS})), None),
                             ('keep-ruined', cc.shifted(trimmed(inf(cc.ruined(hall_for_ruin), {**RUIN, **rf.DAMAGE_MATS, 'cream': 'in_panel_win'}), 2, 280)), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-information')
    only = [n if n.endswith('-information') else n + '-information' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6700 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
