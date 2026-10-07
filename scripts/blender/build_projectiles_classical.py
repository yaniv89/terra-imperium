# scripts/blender/build_projectiles_classical.py
# The Classical projectiles, src/assets/battle/projectiles/classical.glb (plans/ART-MODELS-PLAN.md 8.3;
# src/assets/battle/projectiles/README.md; projectiles.js TABLE): `arrow` (cane shaft, iron
# three-bladed head, fletching), `javelin` (a pilum: wooden shaft, long iron shank and pyramid
# point), `sling-stone` (a cast lead bullet), `bolt` (the ballista's: a short heavy shaft, an iron
# pyramid head, three wooden vanes) and `stone` (a dressed round stone of the stone-throwers). Under
# 60 triangles each, the point toward Blender -Y, origin at the middle, true size (the game draws
# them twice as big). Made like build_projectiles_bronze.py; one small atlas, one level.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_classical.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
from build_projectiles_bronze import fin  # noqa: E402


def arrow(ms, rng):
    L = 0.075
    tn.limb(ms, 'reed', (0, L / 2, 0), (0, -L / 2 + 0.007, 0), 0.0015, 0.0015, segs=3, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.007, 0), (0, -L / 2, 0), 0.003, 0.0, segs=3, lod=2)
    for p in ((0.004, 0), (0, 0.004)):
        fin(ms, 'linen', [(0, L / 2, 0), (p[0], L / 2 - 0.006, p[1]), (p[0], L / 2 - 0.016, p[1]), (0, L / 2 - 0.02, 0)])


def javelin(ms, rng):
    L = 0.2  # 2 m: 1.4 m of wood, 0.6 m of iron
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.06, 0), 0.0024, 0.0026, segs=4, lod=2, caps=False)
    tn.limb(ms, 'timber', (0, -L / 2 + 0.06, 0), (0, -L / 2 + 0.054, 0), 0.0034, 0.0034, segs=4, lod=2)  # the binding
    tn.limb(ms, 'dark', (0, -L / 2 + 0.056, 0), (0, -L / 2 + 0.005, 0), 0.0011, 0.0011, segs=3, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.006, 0), (0, -L / 2, 0), 0.002, 0.0, segs=3, lod=2)


def sling_stone(ms, rng):
    tn.blob(ms, 'dark', (0, 0, 0), 0.0025, (0.8, 1.4, 0.8), rng, 0.05, 1, lod=2)


def bolt(ms, rng):
    L = 0.07
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.012, 0), 0.0035, 0.003, segs=4, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.012, 0), (0, -L / 2, 0), 0.0045, 0.0, segs=4, lod=2)
    for p in ((0.006, 0), (-0.003, 0.005), (-0.003, -0.005)):
        fin(ms, 'timber', [(0, L / 2, 0), (p[0], L / 2 - 0.004, p[1]), (p[0], L / 2 - 0.016, p[1]), (0, L / 2 - 0.02, 0)])


def stone(ms, rng):
    tn.blob(ms, 'stone', (0, 0, 0), 0.008, (1.0, 1.05, 0.95), rng, 0.08, 1, lod=2)


ITEMS = [('arrow', arrow, None), ('javelin', javelin, None), ('sling-stone', sling_stone, None),
         ('bolt', bolt, None), ('stone', stone, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('classical', ITEMS, out, atlas=256, seed=6200)
    sys.stdout.flush()
    os._exit(0)
