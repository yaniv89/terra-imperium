# scripts/blender/build_city_future.py
# The Future city kit for the battle (eight-ages plan U88; src/assets/battle/city/README.md), four files with the
# Modern kit's object names, states, sizes and origins (build_city_modern.py), in the Future materials of
# ti_future_kit.py (md_* to fu_*: white composite slabs on graphite footings, pads, light lines), and the
# Future command dome (build_rts_future.town_hall) as the keep:
#   walls-future.glb  wall-straight, wall-corner, tower, gate-open, gate-closed; each -damaged and -breached
#   ruins-future.glb  rubble-s, rubble-m, rubble-l, beams, scorch
#   fort-future.glb   fort: the Modern bunker line re-dressed
#   civic-future.glb  keep, keep-damaged, keep-ruined: the command dome with its spire, pylons and pad
# One 1024 atlas per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_future.py -- <out_dir> [walls,ruins,fort,civic]
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_city_modern as cm  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_city_classical as cc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_future as rf  # noqa: E402

RUIN = dict(rf.FU, mudwall='fu_plinth', mudwall_bare='fu_panel', reed='fu_panel', brick='fu_graphite', limewash='fu_plinth', roof='fu_graphite',
            tile='fu_graphite', tile_dark='fu_graphite', ashlar='fu_plinth', cream='fu_panel', stone='fu_plinth', timber='fu_graphite', ash='fu_graphite')


def fu(layout, mapping=None):
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
    """The command dome with its white walls named cream, so build_city_classical.ruined finds them."""
    out = rf.town_hall(ms, rng)
    ms.parts[:] = [(bm, 'cream' if mat in ('fu_panel_win', 'fu_panel') else mat, lod, only) for bm, mat, lod, only in ms.parts]
    return out


FILES = {
    'walls-future': lambda: [(n, grounded(fu(fn)), x) for n, fn, x in cm.wall_items()],
    'ruins-future': lambda: [('rubble-s', fu(cb.rubble(0.8)), None), ('rubble-m', fu(cb.rubble(1.4)), None), ('rubble-l', fu(cb.rubble(2.4)), None),
                             ('beams', fu(cb.beams), None), ('scorch', cb.scorch, None)],
    'fort-future': lambda: [('fort', cc.shifted(fu(cm.remat(cm.fort_budgeted))), None)],
    'civic-future': lambda: [('keep', cc.shifted(rf.town_hall), None),
                             ('keep-damaged', cc.shifted(fu(rb.damaged(rf.town_hall), {**RUIN, **rf.DAMAGE_MATS})), None),
                             ('keep-ruined', cc.shifted(trimmed(fu(cc.ruined(hall_for_ruin), {**RUIN, **rf.DAMAGE_MATS, 'cream': 'fu_panel_win'}), 2, 280)), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-future')
    only = [n if n.endswith('-future') else n + '-future' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6800 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
