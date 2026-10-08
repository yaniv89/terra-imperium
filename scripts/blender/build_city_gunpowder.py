# scripts/blender/build_city_gunpowder.py
# The Gunpowder city kit for the battle (plans/ART-MODELS-PLAN.md section 6; src/assets/battle/city/
# README.md), four files in the Gunpowder town kit's stuff so a besieged city of the age matches its
# town on the map:
#   walls-gunpowder.glb  the wall kit as a bastion trace (build_walls_bastion_gunpowder.py: wall-straight,
#                        wall-corner, tower, gate-open, gate-closed; each -damaged and -breached): curtains
#                        of scarp, cordon and turf, an arrow-head bastion, the sandstone gatehouse
#   ruins-gunpowder.glb  rubble-s, rubble-m, rubble-l (brick, stucco, roof tile), beams, scorch
#   fort-gunpowder.glb   fort: a star fort in the 50 m circle: ti_gunpowder's bastioned trace (four
#                        angled bastions with cannon, turf on stone scarps, a sandstone gatehouse) round
#                        a brick barrack block, a powder magazine, a well, a ball pile and the standard
#   civic-gunpowder.glb  keep, keep-damaged, keep-ruined: the Gunpowder town hall of rts-gunpowder.glb (a
#                        brick hall with a clock tower in its walled court); ruined, its walls stand as
#                        ragged stubs (named cream for build_city_classical.ruined)
# Made like build_city_kingdoms.py; one 1024 atlas per file, LOD0..LOD2, origin on the ground.
#   blender -b --factory-startup -P scripts/blender/build_city_gunpowder.py -- <out_dir> [walls,ruins,fort,civic]
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_map as tm  # noqa: E402
import build_rts_gunpowder as rg  # noqa: E402 (patches ti_classical's house and tree first)
import ti_gunpowder as tg  # noqa: E402
import ti_bronze as tb  # noqa: E402
import build_city_bronze as cb  # noqa: E402
import build_city_classical as cc  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from ti_town import G  # noqa: E402

WALL_MATS = {'brick': 'gp_scarp', 'limewash': 'gp_sandstone'}
RUIN_MATS = {'mudwall': 'gp_brick', 'mudwall_bare': 'gp_stucco', 'reed': 'gp_tile', 'brick': 'gp_brick'}


def remat(layout, mapping=None):
    return rc.remat(layout, mapping or rg.MATS)


def wall_items_shared():
    """Checkpoint 29's kit: the shared crenellated pieces in the age's stone (kept for comparison)."""
    return [(n, remat(fn, WALL_MATS if 'wall' in n or 'gate' in n or 'tower' in n else RUIN_MATS), g) for n, fn, g in cb.wall_items()]


def fort(ms, rng):
    """`fort` (50 m circle): a star fort: a square bastioned trace (turf on battered stone scarps, four
    angled bastions with cannon, a sandstone gatehouse with a pennant at the south) round a brick
    barrack block, a sandstone powder magazine, a well, a pile of balls and the standard."""
    tg.bastioned_walls(ms, rng, c=1.32, W=0.24, H=0.24 * tb.WALL_RAISE, gw=0.3,
                       g=0.48, f_=0.14, e=0.3, flag_top=0.8)
    tg.gp_house(ms, rng, -0.25, 0.62, 1.1, 0.34, yaw=0, wall='gp_brick', roof='gp_tile', kind='gable', storeys=2, rise=0.14,
                chimneys=2, dormers=0, props=1, back_windows=False)
    f = tm.house_frame(0.65, -0.1, -90)  # the powder magazine: a low vaulted sandstone store
    ms.box('gp_sandstone', (0.32, 0.26, 0.2), at=(0, 0, G), lod=2, frame=f, bevel=0.004)
    tg.hip(ms, f, 0.32, 0.26, G + 0.2, 0.08, mat='gp_slate', lod=2)
    ms.box('door', (0.08, 0.012, 0.13), at=(0, -0.136, G), lod=1, frame=f)
    tg.well(ms, -0.35, -0.2)
    for k, (x, y, z) in enumerate([(0.2, -0.5, 0), (0.25, -0.5, 0), (0.225, -0.46, 0.04), (0.3, -0.5, 0)]):
        ms.sphere('gp_iron', 0.025, at=(x, y, G + z + 0.025), u=6, v=4, lod=0)
    ms.cyl('timber', 0.014, 0.011, 0.8, at=(-0.1, -0.55, G), segs=6, lod=1)
    tt.pennant(ms, rb.WORLD, -0.1, -0.55, G + 0.795, yaw=-150, lod=2, w=0.22, h=0.14)
    tg.tree(ms, -0.8, -0.65)


def fort_budgeted(ms, rng):
    """The fort within its budget: the far level (LOD2) decimated to the improvement budget (300)."""
    import build_improvement_fort_classical as fc  # noqa: E402 (its trim; the module builds nothing on import)
    fort(ms, rng)
    fc.trim(ms, 2, 280)


def hall_for_ruin(ms, rng):
    """The town hall with its brick walls named cream, so build_city_classical.ruined finds them."""
    out = rg.town_hall(ms, rng)
    ms.parts[:] = [(bm, 'cream' if mat in ('gp_brick', 'gp_stucco') else mat, lod, only) for bm, mat, lod, only in ms.parts]
    return out


FILES = {
    'walls-gunpowder': lambda: __import__('build_walls_bastion_gunpowder').wall_items(),
    'ruins-gunpowder': lambda: [('rubble-s', remat(cb.rubble(0.8), RUIN_MATS), None), ('rubble-m', remat(cb.rubble(1.4), RUIN_MATS), None),
                                ('rubble-l', remat(cb.rubble(2.4), RUIN_MATS), None), ('beams', remat(cb.beams, RUIN_MATS), None), ('scorch', cb.scorch, None)],
    'fort-gunpowder': lambda: [('fort', cc.shifted(remat(fort_budgeted)), None)],
    'civic-gunpowder': lambda: [('keep', cc.shifted(remat(rg.town_hall)), None),
                                ('keep-damaged', cc.shifted(remat(rb.damaged(rg.town_hall))), None),
                                ('keep-ruined', cc.shifted(remat(cc.ruined(hall_for_ruin), {**rg.MATS, 'cream': 'gp_brick'})), None)],
}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'city-gunpowder')
    only = [n if n.endswith('-gunpowder') else n + '-gunpowder' for n in argv[1].split(',')] if len(argv) > 1 else list(FILES)
    import json
    report = {}
    for k, name in enumerate(only):
        report[name] = tt.build_file(name, FILES[name](), out_dir, atlas=1024, seed=6500 + 31 * k)
    with open(os.path.join(out_dir, 'report-%s.json' % '-'.join(only)), 'w') as fh:
        json.dump(report, fh, indent=2)
    print('CITY_BUILT', ' '.join(only), flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
