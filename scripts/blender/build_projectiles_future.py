# scripts/blender/build_projectiles_future.py
# The Future projectiles, src/assets/battle/projectiles/future.glb (eight-ages plan U91; beams are drawn by the
# renderer, not a model): `bolt` (a railgun slug: a short dart of graphite with a glowing tail), `shell` (a plasma
# shell: a glowing ovoid in a graphite cage) and `missile` (a micro-missile with a glowing exhaust). Under 60
# triangles each, the point toward Blender -Y, origin at the middle, true size; one small atlas, LOD1 and LOD2
# repeat LOD0.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_future.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_future_kit as fk  # noqa: E402,F401 (fu_ materials)
from build_projectiles_bronze import fin  # noqa: E402


def bolt(ms, rng):
    L = 0.06
    tn.limb(ms, 'fu_graphite', (0, L / 2, 0), (0, -L / 2, 0), 0.003, 0.0, segs=4, lod=2)
    tn.limb(ms, 'fu_glow', (0, L / 2 + 0.02, 0), (0, L / 2, 0), 0.0, 0.0025, segs=4, lod=2)


def shell(ms, rng):
    tn.limb(ms, 'fu_glow', (0, 0.012, 0), (0, -0.012, 0), 0.006, 0.006, segs=6, lod=2)
    tn.limb(ms, 'fu_graphite', (0, -0.012, 0), (0, -0.02, 0), 0.006, 0.0, segs=6, lod=2)


def missile(ms, rng):
    L = 0.10
    tn.limb(ms, 'fu_panel', (0, L / 2, 0), (0, -L / 2 + 0.012, 0), 0.0035, 0.0035, segs=5, lod=2, caps=False)
    tn.limb(ms, 'fu_graphite', (0, -L / 2 + 0.012, 0), (0, -L / 2, 0), 0.0035, 0.0, segs=5, lod=2)
    tn.limb(ms, 'fu_glow', (0, L / 2 + 0.012, 0), (0, L / 2, 0), 0.0, 0.003, segs=5, lod=2)
    for p in ((0.006, 0), (0, 0.006)):
        fin(ms, 'fu_graphite', [(0, L / 2, 0), (p[0], L / 2 - 0.004, p[1]), (p[0], L / 2 - 0.014, p[1]), (0, L / 2 - 0.018, 0)])


ITEMS = [('bolt', bolt, None), ('shell', shell, None), ('missile', missile, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('future', ITEMS, out, atlas=256, seed=6800)
    sys.stdout.flush()
    os._exit(0)
