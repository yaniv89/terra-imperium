# scripts/blender/build_improvement_fort_modern.py
# The map's Modern fort, src/assets/map/improvements/fort-modern.glb (the tile improvement `fort`
# from the Modern Age on; improvementModels.js): the battle's bunker line (build_city_modern.py:
# a grassed berm with a crest trench, barbed wire and four pillboxes round a command bunker, a radio
# mast, prefab huts, AA gun pits and the flag) on its own round earth Ground patch in the 50 m circle,
# made like build_improvement_fort_kingdoms.py (the budget trim, 8,000 / 1,500 / 300). One root
# `fort-modern`, LOD0..LOD2, materials Town, Team and Ground, one 1024 atlas.
#   blender -b --factory-startup -P scripts/blender/build_improvement_fort_modern.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_city_modern as cg  # noqa: E402 (patches ti_classical's house and tree first)
import build_improvement_fort_classical as fc  # noqa: E402

GROUND = dict(fc.GROUND, rx=2.5, ry=2.5, mat='earth')
fort_modern = cg.remat(cg.fort)


def fort_budgeted(ms, rng):
    fort_modern(ms, rng)
    for lod, budget in ((0, 7400), (1, 1300), (2, 270)):
        fc.trim(ms, lod, budget)
    for bm, _m, _l, _o in ms.parts:  # a trench or heap that reached under the ground sits on it
        for v in bm.verts:
            v.co.z = max(v.co.z, 0.0)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    tt.build_file('fort-modern', [('fort-modern', fort_budgeted, GROUND)], out, atlas=1024, seed=6720)
    print('FORT_BUILT', flush=True)
    sys.stdout.flush()
    os._exit(0)
