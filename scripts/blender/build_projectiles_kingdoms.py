# scripts/blender/build_projectiles_kingdoms.py
# The Kingdoms projectiles, src/assets/battle/projectiles/kingdoms.glb (plans/ART-MODELS-PLAN.md 8.3;
# src/assets/battle/projectiles/README.md): `arrow` (the longbow's: a long ash shaft, a narrow
# bodkin point, grey goose fletching), `javelin` (a throwing spear: an ash shaft and a leaf-shaped
# iron head on a socket), `sling-stone` (a river pebble), `bolt` (a crossbow quarrel: short and
# thick, a square bodkin head, two leather vanes) and `stone` (the trebuchet's dressed ball, bigger
# than the Classical stone-thrower's). Under 60 triangles each, the point toward Blender -Y, origin
# at the middle, true size (the game draws them twice as big). Made like build_projectiles_classical.py.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_kingdoms.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
from build_projectiles_bronze import fin  # noqa: E402


def arrow(ms, rng):
    L = 0.085  # a cloth-yard shaft
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.008, 0), 0.0016, 0.0016, segs=3, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.008, 0), (0, -L / 2, 0), 0.0024, 0.0, segs=3, lod=2)
    for p in ((0.0045, 0), (0, 0.0045)):
        fin(ms, 'stone', [(0, L / 2 - 0.002, 0), (p[0], L / 2 - 0.008, p[1]), (p[0], L / 2 - 0.02, p[1]), (0, L / 2 - 0.024, 0)])


def javelin(ms, rng):
    L = 0.17
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.024, 0), 0.0026, 0.0028, segs=4, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.026, 0), (0, -L / 2 + 0.016, 0), 0.0034, 0.0034, segs=4, lod=2, caps=False)  # the socket
    tn.limb(ms, 'dark', (0, -L / 2 + 0.016, 0), (0, -L / 2, 0), 0.0045, 0.0, segs=4, lod=2)  # the leaf head


def sling_stone(ms, rng):
    tn.blob(ms, 'stone', (0, 0, 0), 0.003, (1.0, 1.25, 0.85), rng, 0.08, 1, lod=2)


def bolt(ms, rng):
    L = 0.04
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.008, 0), 0.0028, 0.0028, segs=4, lod=2, caps=False)
    tn.limb(ms, 'dark', (0, -L / 2 + 0.008, 0), (0, -L / 2, 0), 0.0038, 0.0, segs=4, lod=2)
    for p in ((0.005, 0), (-0.005, 0)):
        fin(ms, 'leather' if 'leather' in tt.PROC else 'timber', [(0, L / 2, 0), (p[0], L / 2 - 0.003, p[1]), (p[0], L / 2 - 0.011, p[1]), (0, L / 2 - 0.014, 0)])


def stone(ms, rng):
    tn.blob(ms, 'stone', (0, 0, 0), 0.0095, (1.0, 1.04, 0.96), rng, 0.07, 1, lod=2)


ITEMS = [('arrow', arrow, None), ('javelin', javelin, None), ('sling-stone', sling_stone, None),
         ('bolt', bolt, None), ('stone', stone, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('kingdoms', ITEMS, out, atlas=256, seed=6300)
    sys.stdout.flush()
    os._exit(0)
