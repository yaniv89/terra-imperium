# scripts/blender/build_projectiles_stone.py
# The Stone Age projectiles, src/assets/battle/projectiles/stone.glb (eight-ages plan U91;
# src/assets/battle/projectiles/README.md): `arrow` (a wooden shaft, a knapped flint head lashed on,
# feather fletching), `javelin` (a 1.8 m spear-thrower dart with a flint point and a sinew binding)
# and `sling-stone` (a river pebble). Under 60 triangles each, the point toward Blender -Y, origin
# at the middle, true size (the game draws them twice as big). Town kit materials baked into a small
# atlas, one level (LOD1 and LOD2 repeat it).
#   blender -b --factory-startup -P scripts/blender/build_projectiles_stone.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_stone_map as ts  # noqa: E402,F401  (st_flint)
from build_projectiles_bronze import fin  # noqa: E402


def arrow(ms, rng):
    L = 0.08  # 0.8 m
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.01, 0), 0.0017, 0.0017, segs=3, lod=2, caps=False)
    tn.limb(ms, 'st_flint', (0, -L / 2 + 0.011, 0), (0, -L / 2, 0), 0.0042, 0.0, segs=3, lod=2)
    tn.limb(ms, 'reed', (0, -L / 2 + 0.014, 0), (0, -L / 2 + 0.009, 0), 0.0022, 0.0022, segs=3, lod=2, caps=False)  # the binding
    for p in ((0.0045, 0), (0, 0.0045)):
        fin(ms, 'hide_pale', [(0, L / 2, 0), (p[0], L / 2 - 0.005, p[1]), (p[0], L / 2 - 0.017, p[1]), (0, L / 2 - 0.021, 0)])


def javelin(ms, rng):
    L = 0.18  # 1.8 m
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.016, 0), 0.0022, 0.0019, segs=4, lod=2, caps=False)
    tn.limb(ms, 'st_flint', (0, -L / 2 + 0.018, 0), (0, -L / 2, 0), 0.0045, 0.0, segs=4, lod=2)
    tn.limb(ms, 'reed', (0, -L / 2 + 0.022, 0), (0, -L / 2 + 0.015, 0), 0.0027, 0.0027, segs=4, lod=2, caps=False)
    for p in ((0.004, 0), (0, 0.004)):  # a dart's fletching
        fin(ms, 'hide_pale', [(0, L / 2, 0), (p[0], L / 2 - 0.006, p[1]), (p[0], L / 2 - 0.02, p[1]), (0, L / 2 - 0.024, 0)])


def sling_stone(ms, rng):
    tn.blob(ms, 'stone', (0, 0, 0), 0.0032, (1.0, 1.2, 0.85), rng, 0.15, 1, lod=2)


ITEMS = [('arrow', arrow, None), ('javelin', javelin, None), ('sling-stone', sling_stone, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('stone', ITEMS, out, atlas=256, seed=6000)
    sys.stdout.flush()
    os._exit(0)
