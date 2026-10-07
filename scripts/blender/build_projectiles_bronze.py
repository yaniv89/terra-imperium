# scripts/blender/build_projectiles_bronze.py
# The Bronze projectiles, src/assets/battle/projectiles/bronze.glb (plans/ART-MODELS-PLAN.md 8.3;
# src/assets/battle/projectiles/README.md): `arrow` (reed shaft, bronze leaf head, fletching),
# `javelin` (1.6 m, bronze head) and `sling-stone`. Under 60 triangles each, the point toward
# Blender -Y, origin at the middle, true size (the game draws them twice as big). Town kit materials
# baked into a small atlas, one level (LOD1 and LOD2 repeat it).
#   blender -b --factory-startup -P scripts/blender/build_projectiles_bronze.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402


def fin(ms, mat, pts):
    """A two-sided flat triangle fan (fletching), visible from both sides."""
    for order in (pts, list(reversed(pts))):
        bm = bmesh.new()
        bm.faces.new([bm.verts.new(p) for p in order])
        ms.add(bm, mat, 2)


def arrow(ms, rng):
    L = 0.08  # 0.8 m
    tn.limb(ms, 'reed', (0, L / 2, 0), (0, -L / 2 + 0.008, 0), 0.0016, 0.0016, segs=3, lod=2, caps=False)
    tn.limb(ms, 'bronze', (0, -L / 2 + 0.008, 0), (0, -L / 2, 0), 0.0035, 0.0, segs=3, lod=2)
    for p in ((0.004, 0), (0, 0.004)):
        fin(ms, 'linen', [(0, L / 2, 0), (p[0], L / 2 - 0.006, p[1]), (p[0], L / 2 - 0.016, p[1]), (0, L / 2 - 0.02, 0)])


def javelin(ms, rng):
    L = 0.16  # 1.6 m
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, -L / 2 + 0.014, 0), 0.0022, 0.002, segs=4, lod=2, caps=False)
    tn.limb(ms, 'bronze', (0, -L / 2 + 0.016, 0), (0, -L / 2, 0), 0.004, 0.0, segs=4, lod=2)
    tn.limb(ms, 'timber', (0, L / 2, 0), (0, L / 2 - 0.004, 0), 0.0024, 0.0024, segs=4, lod=2)


def sling_stone(ms, rng):
    tn.blob(ms, 'stone', (0, 0, 0), 0.003, (1.0, 1.15, 0.9), rng, 0.15, 1, lod=2)


ITEMS = [('arrow', arrow, None), ('javelin', javelin, None), ('sling-stone', sling_stone, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('bronze', ITEMS, out, atlas=256, seed=6100)
    sys.stdout.flush()
    os._exit(0)
