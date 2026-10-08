# scripts/blender/build_improvement_fort_gunpowder.py
# The map's Gunpowder fort, src/assets/map/improvements/fort-gunpowder.glb (the tile improvement `fort`
# from the Gunpowder Age on; improvementModels.js): the battle's star fort (build_city_gunpowder.py:
# a square bastioned trace with four angled bastions and cannon, a gatehouse, a brick barrack block,
# a powder magazine, a well and the standard) on its own round earth Ground patch in the 50 m circle,
# made like build_improvement_fort_kingdoms.py (the budget trim, 8,000 / 1,500 / 300). One root
# `fort-gunpowder`, LOD0..LOD2, materials Town, Team and Ground, one 1024 atlas.
#   blender -b --factory-startup -P scripts/blender/build_improvement_fort_gunpowder.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import build_city_gunpowder as cg  # noqa: E402 (patches ti_classical's house and tree first)
import build_improvement_fort_classical as fc  # noqa: E402

GROUND = dict(fc.GROUND, rx=2.5, ry=2.5, mat='earth')
fort_gunpowder = cg.remat(cg.fort)


def fort_budgeted(ms, rng):
    fort_gunpowder(ms, rng)
    for lod, budget in ((0, 7400), (1, 1300), (2, 270)):
        fc.trim(ms, lod, budget)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    tt.build_file('fort-gunpowder', [('fort-gunpowder', fort_budgeted, GROUND)], out, atlas=1024, seed=6620)
    print('FORT_BUILT', flush=True)
    sys.stdout.flush()
    os._exit(0)
