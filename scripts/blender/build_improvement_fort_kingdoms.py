# scripts/blender/build_improvement_fort_kingdoms.py
# The map's Kingdoms fort, src/assets/map/improvements/fort-kingdoms.glb (the tile improvement `fort`
# from the Kingdoms Age on; improvementModels.js): the battle's Kingdoms fort (build_city_kingdoms.py:
# the castellum in grey wall stone round a half-timbered barrack hall and store, a watch tower under
# slate, tents, a well and the standard) on its own round earth Ground patch in the 50 m circle, made
# like build_improvement_fort_classical.py (the lighter wall ring and its budget trim, 8,000 / 1,500 /
# 300). One root `fort-kingdoms`, LOD0..LOD2, materials Town, Team and Ground, one 1024 atlas.
#   blender -b --factory-startup -P scripts/blender/build_improvement_fort_kingdoms.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_rts_kingdoms as rk  # noqa: E402 (patches ti_classical's house and tree first)
import build_rts_classical as rc  # noqa: E402
import build_improvement_fort_classical as fc  # noqa: E402

GROUND = dict(fc.GROUND, mat='kg_soil')
fort_kingdoms = rc.remat(fc.fort_map, rk.MATS)


def fort_budgeted(ms, rng):
    fort_kingdoms(ms, rng)
    for lod, budget in ((0, 7400), (1, 1300), (2, 180)):
        fc.trim(ms, lod, budget)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    tt.build_file('fort-kingdoms', [('fort-kingdoms', fort_budgeted, GROUND)], out, atlas=1024, seed=6520)
    print('FORT_BUILT', flush=True)
    sys.stdout.flush()
    os._exit(0)
